import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSongTotals, determineWinningSong, calculateCurrencyDeductions } from "@/lib/game/bidding-logic";
import { generateMapLayout, serializeMapLayout, deserializeMapLayout } from "@/lib/game/map-generator";
import { getTotalRounds, getTokensPerRound, getSongImplications } from "@/lib/game/song-implications";
import { selectRandomVertices } from "@/lib/game/token-placement-logic";
import { processAllAITokenPlacements } from "@/lib/game/ai-token-placement";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await params;
    const body = await request.json();
    let { action } = body; // "start" | "nextRound" | "startTokenPlacement" | "completeTokenPlacement" | "finish"

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        bids: true,
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Verify player is in game
    const player = game.players.find(p => p.id === session.playerId);
    if (!player) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    if (action === "start") {
      // Start game from lobby
      if (game.status !== "LOBBY") {
        return NextResponse.json(
          { error: "Game has already started" },
          { status: 400 }
        );
      }

      if (game.players.length < 3) {
        return NextResponse.json(
          { error: "Need at least 3 players to start" },
          { status: 400 }
        );
      }

      // Generate map layout based on player count
      // Map type (NYC36 vs NYC48) is determined automatically
      const playerCount = game.players.length;
      const mapLayout = generateMapLayout(playerCount);
      const totalRounds = getTotalRounds(playerCount, game.isPOTS);

      // Generate turn orders for the first round (these are index strings like "012012")
      const implications = getSongImplications(playerCount, undefined, game.isPOTS);

      // Convert turn order indices to player IDs
      const convertIndicesToPlayerIds = (indexString: string): string[] => {
        return indexString.split('').map(indexChar => {
          const index = parseInt(indexChar, 10);
          return game.players[index].id;
        });
      };

      // Generate highlighted edges for the first round to show on initial map view
      // Use tokensPerRound from implications (correct for all player counts)
      const tokensPerRound = implications.tokensPerRound;
      const highlightedEdges = selectRandomVertices(mapLayout, [], tokensPerRound);

      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "ROUND1",
          mapType: mapLayout.mapType, // Store which map was selected (NYC36 or NYC48)
          mapLayout: serializeMapLayout(mapLayout),
          totalRounds,
          turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
          turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
          turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
          turnOrderD: implications.songD ? JSON.stringify(convertIndicesToPlayerIds(implications.songD)) : null,
          highlightedEdges: JSON.stringify(highlightedEdges), // Store highlighted edges for initial map view
        },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "startTokenPlacement") {
      // Transition from RESULTS to TOKEN_PLACEMENT phase
      if (game.status !== "RESULTS") {
        return NextResponse.json(
          { error: "Not in results phase" },
          { status: 400 }
        );
      }

      if (!game.mapLayout || !game.winningSong) {
        return NextResponse.json(
          { error: "Missing map or winning song data" },
          { status: 400 }
        );
      }

      // Reuse highlighted edges that were already generated for this round
      if (!game.highlightedEdges) {
        return NextResponse.json(
          { error: "No highlighted edges available for this round" },
          { status: 500 }
        );
      }

      const highlightedEdges = JSON.parse(game.highlightedEdges);

      // Update game state to TOKEN_PLACEMENT
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "TOKEN_PLACEMENT",
          // DO NOT update highlightedEdges - reuse existing ones
          currentTurnIndex: 0, // Start at first turn
          placementTimeout: new Date(Date.now() + 60000), // 60 second timeout
        },
      });

      return NextResponse.json({
        success: true,
        highlightedEdges,
      });
    }

    if (action === "completeTokenPlacement") {
      // Called when all tokens placed - clean up and advance to next round
      if (game.status !== "TOKEN_PLACEMENT") {
        return NextResponse.json(
          { error: "Not in token placement phase" },
          { status: 400 }
        );
      }

      // Clear token placement data
      await prisma.game.update({
        where: { id: gameId },
        data: {
          highlightedEdges: null,
          currentTurnIndex: null,
          placementTimeout: null,
        },
      });

      // Change action to nextRound and fall through to continue processing
      action = "nextRound";
    }

    if (action === "nextRound") {
      if (game.status === "RESULTS") {
        // CHANGED: Transition to TOKEN_PLACEMENT instead of skipping to next round
        // Directly set up token placement
        if (!game.mapLayout || !game.winningSong) {
          return NextResponse.json(
            { error: "Missing map or winning song data" },
            { status: 400 }
          );
        }

        // Reuse highlighted edges that were already generated for this round
        if (!game.highlightedEdges) {
          return NextResponse.json(
            { error: "No highlighted edges available for this round" },
            { status: 500 }
          );
        }

        const highlightedEdges = JSON.parse(game.highlightedEdges);

        await prisma.game.update({
          where: { id: gameId },
          data: {
            status: "TOKEN_PLACEMENT",
            // DO NOT update highlightedEdges - reuse existing ones
            currentTurnIndex: 0,
            placementTimeout: new Date(Date.now() + 60000),
          },
        });

        // Process AI token placements immediately
        try {
          const allTokensPlaced = await processAllAITokenPlacements(gameId);
          console.log('AI token placements processed successfully, all placed:', allTokensPlaced);

          // If AI players placed all tokens, advance to next round
          if (allTokensPlaced) {
            // Clear token placement data
            await prisma.game.update({
              where: { id: gameId },
              data: {
                highlightedEdges: null,
                currentTurnIndex: null,
                placementTimeout: null,
              },
            });

            // Get updated game state
            const updatedGame = await prisma.game.findUnique({
              where: { id: gameId },
              include: { players: true },
            });

            if (!updatedGame) {
              return NextResponse.json({ error: 'Game not found' }, { status: 404 });
            }

            // If this was FINAL_PLACEMENT, go directly to FINISHED
            if (updatedGame.status === 'FINAL_PLACEMENT') {
              await prisma.game.update({
                where: { id: gameId },
                data: { status: 'FINISHED' },
              });
              return NextResponse.json({ success: true, gameFinished: true });
            }

            // Check if map is complete (all edges filled)
            const mapLayout = updatedGame.mapLayout ? deserializeMapLayout(updatedGame.mapLayout) : null;
            if (!mapLayout) {
              return NextResponse.json({ error: 'Map layout not found' }, { status: 400 });
            }

            const totalEdges = mapLayout.edges.length;
            const placedTokens = await prisma.influenceToken.count({
              where: { gameId },
            });

            if (placedTokens >= totalEdges) {
              // Map is complete - go to FINISHED
              await prisma.game.update({
                where: { id: gameId },
                data: { status: 'FINISHED' },
              });
              return NextResponse.json({ success: true, mapComplete: true });
            }

            // POTS MODE: Check if we just completed round 10
            if (updatedGame.isPOTS && updatedGame.roundNumber === updatedGame.totalRounds) {
              // After final round in POTS mode, enter FINAL_PLACEMENT phase
              const existingTokens = await prisma.influenceToken.findMany({
                where: { gameId },
                select: { edgeId: true },
              });

              const remainingEdges = mapLayout.edges.filter(edgeId =>
                !existingTokens.some(token => token.edgeId === edgeId)
              );

              console.log(`FINAL_PLACEMENT: ${remainingEdges.length} remaining edges out of ${mapLayout.edges.length} total`);

              // Calculate turn order based on money remaining
              const players = await prisma.player.findMany({
                where: { gameId },
                include: {
                  influenceTokens: {
                    where: { gameId },
                  },
                },
              });

              // Sort by money (descending), then by token count (ascending for ties)
              const sortedPlayers = players.sort((a, b) => {
                if (b.currencyBalance !== a.currencyBalance) {
                  return b.currencyBalance - a.currencyBalance;
                }
                return a.influenceTokens.length - b.influenceTokens.length;
              });

              // Create final turn order based on player count
              const finalTurnOrder: string[] = [];

              if (players.length === 6) {
                // 6-player: Top 2 place 2 tokens, bottom 4 place 1 token
                // Order: 1st, 2nd, 3rd, 4th, 5th, 6th, 1st, 2nd
                finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 1st token
                finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 1st token
                finalTurnOrder.push(sortedPlayers[2].id); // 3rd place, only token
                finalTurnOrder.push(sortedPlayers[3].id); // 4th place, only token
                finalTurnOrder.push(sortedPlayers[4].id); // 5th place, only token
                finalTurnOrder.push(sortedPlayers[5].id); // 6th place (least), only token
                finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 2nd token
                finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 2nd token
              } else if (players.length === 5) {
                // 5-player: Top 3 place 2 tokens, bottom 2 place 1 token
                // Order: 1st, 2nd, 3rd, 4th, 5th, 1st, 2nd, 3rd
                finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 1st token
                finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 1st token
                finalTurnOrder.push(sortedPlayers[2].id); // 3rd place, 1st token
                finalTurnOrder.push(sortedPlayers[3].id); // 4th place, only token
                finalTurnOrder.push(sortedPlayers[4].id); // 5th place, only token
                finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 2nd token
                finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 2nd token
                finalTurnOrder.push(sortedPlayers[2].id); // 3rd place, 2nd token
              } else if (players.length === 4) {
                // 4-player: Each player places 1 token
                sortedPlayers.forEach(player => finalTurnOrder.push(player.id));
              } else {
                // 3-player or other: Each player places equal number of tokens
                const tokensPerPlayer = Math.floor(remainingEdges.length / players.length);
                sortedPlayers.forEach(player => {
                  for (let i = 0; i < tokensPerPlayer; i++) {
                    finalTurnOrder.push(player.id);
                  }
                });
              }

              await prisma.game.update({
                where: { id: gameId },
                data: {
                  status: 'FINAL_PLACEMENT',
                  highlightedEdges: JSON.stringify(remainingEdges),
                  turnOrderA: JSON.stringify(finalTurnOrder),
                  currentTurnIndex: 0,
                  placementTimeout: new Date(Date.now() + 60000),
                },
              });

              // Process AI token placements immediately
              console.log(`Triggering AI placement for FINAL_PLACEMENT. Turn order: ${finalTurnOrder.length} turns`);
              try {
                const allTokensPlaced = await processAllAITokenPlacements(gameId);
                console.log('AI token placements processed for FINAL_PLACEMENT, all placed:', allTokensPlaced);

                // If AI players placed all tokens, advance to FINISHED
                if (allTokensPlaced) {
                  await prisma.game.update({
                    where: { id: gameId },
                    data: {
                      status: 'FINISHED',
                      highlightedEdges: null,
                      currentTurnIndex: null,
                      placementTimeout: null,
                    },
                  });
                  return NextResponse.json({ success: true, status: 'FINISHED', gameFinished: true });
                }
              } catch (err) {
                console.error('Failed to process AI token placements for FINAL_PLACEMENT:', err);
              }

              return NextResponse.json({
                success: true,
                status: 'FINAL_PLACEMENT',
              });
            }

            // Start next round
            const playerCount = updatedGame.players.length;
            const implications = getSongImplications(playerCount, undefined, updatedGame.isPOTS);

            // Convert turn order indices to player IDs
            const convertIndicesToPlayerIds = (indexString: string): string[] => {
              return indexString.split('').map(indexChar => {
                const index = parseInt(indexChar, 10);
                return updatedGame.players[index].id;
              });
            };

            // Generate highlighted edges for the next round
            const existingTokens = await prisma.influenceToken.findMany({
              where: { gameId },
              select: { edgeId: true },
            });
            // Use tokensPerRound from implications (correct for all player counts)
            const tokensPerRound = implications.tokensPerRound;
            const newHighlightedEdges = selectRandomVertices(mapLayout, existingTokens, tokensPerRound);

            await prisma.game.update({
              where: { id: gameId },
              data: {
                status: 'ROUND1',
                roundNumber: updatedGame.roundNumber + 1,
                winningSong: null,
                turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
                turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
                turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
                turnOrderD: implications.songD ? JSON.stringify(convertIndicesToPlayerIds(implications.songD)) : null,
                highlightedEdges: JSON.stringify(newHighlightedEdges),
              },
            });

            return NextResponse.json({ success: true, roundAdvanced: true });
          }
        } catch (err) {
          console.error('Failed to process AI token placements:', err);
        }

        return NextResponse.json({
          success: true,
          highlightedEdges,
        });
      }

      // Transition from TOKEN_PLACEMENT back to ROUND1 for next bidding round
      if (game.status === "TOKEN_PLACEMENT") {
        // Check if map is complete (all vertices filled)
        const mapLayout = game.mapLayout ? deserializeMapLayout(game.mapLayout) : null;
        if (!mapLayout) {
          return NextResponse.json(
            { error: "Map layout not found" },
            { status: 400 }
          );
        }

        const totalVertices = mapLayout.edges.length;
        const placedTokens = await prisma.influenceToken.count({
          where: { gameId },
        });

        // POTS MODE: Check if we just completed final round
        if (game.isPOTS && game.roundNumber === game.totalRounds) {
          // After final round in POTS mode, enter FINAL_PLACEMENT phase
          // Get all remaining edges
          const existingTokens = await prisma.influenceToken.findMany({
            where: { gameId },
            select: { edgeId: true },
          });

          const remainingEdges = mapLayout.edges.filter(edgeId =>
            !existingTokens.some(token => token.edgeId === edgeId)
          );

          console.log(`FINAL_PLACEMENT (from TOKEN_PLACEMENT): ${remainingEdges.length} remaining edges out of ${mapLayout.edges.length} total`);

          // Calculate turn order based on money remaining
          // Most money → second → third (ties broken by least influence tokens)
          const players = await prisma.player.findMany({
            where: { gameId },
            include: {
              influenceTokens: {
                where: { gameId },
              },
            },
          });

          // Sort by money (descending), then by token count (ascending for ties)
          const sortedPlayers = players.sort((a, b) => {
            if (b.currencyBalance !== a.currencyBalance) {
              return b.currencyBalance - a.currencyBalance; // Most money first
            }
            // Tie: least influence tokens first
            return a.influenceTokens.length - b.influenceTokens.length;
          });

          // Create final turn order based on player count
          const finalTurnOrder: string[] = [];

          if (players.length === 6) {
            // 6-player: Top 2 place 2 tokens, bottom 4 place 1 token
            // Order: 1st, 2nd, 3rd, 4th, 5th, 6th, 1st, 2nd
            finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 1st token
            finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 1st token
            finalTurnOrder.push(sortedPlayers[2].id); // 3rd place, only token
            finalTurnOrder.push(sortedPlayers[3].id); // 4th place, only token
            finalTurnOrder.push(sortedPlayers[4].id); // 5th place, only token
            finalTurnOrder.push(sortedPlayers[5].id); // 6th place (least), only token
            finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 2nd token
            finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 2nd token
          } else if (players.length === 5) {
            // 5-player: Top 3 place 2 tokens, bottom 2 place 1 token
            // Order: 1st, 2nd, 3rd, 4th, 5th, 1st, 2nd, 3rd
            finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 1st token
            finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 1st token
            finalTurnOrder.push(sortedPlayers[2].id); // 3rd place, 1st token
            finalTurnOrder.push(sortedPlayers[3].id); // 4th place, only token
            finalTurnOrder.push(sortedPlayers[4].id); // 5th place, only token
            finalTurnOrder.push(sortedPlayers[0].id); // 1st place, 2nd token
            finalTurnOrder.push(sortedPlayers[1].id); // 2nd place, 2nd token
            finalTurnOrder.push(sortedPlayers[2].id); // 3rd place, 2nd token
          } else if (players.length === 4) {
            // 4-player: Each player places 1 token
            sortedPlayers.forEach(player => finalTurnOrder.push(player.id));
          } else {
            // 3-player or other: Each player places equal number of tokens
            const tokensPerPlayer = Math.floor(remainingEdges.length / players.length);
            sortedPlayers.forEach(player => {
              for (let i = 0; i < tokensPerPlayer; i++) {
                finalTurnOrder.push(player.id);
              }
            });
          }

          await prisma.game.update({
            where: { id: gameId },
            data: {
              status: "FINAL_PLACEMENT",
              highlightedEdges: JSON.stringify(remainingEdges),
              turnOrderA: JSON.stringify(finalTurnOrder), // Store final turn order in turnOrderA
              currentTurnIndex: 0,
              placementTimeout: new Date(Date.now() + 60000),
            },
          });

          // Process AI token placements immediately
          try {
            const allTokensPlaced = await processAllAITokenPlacements(gameId);
            console.log('AI token placements processed for FINAL_PLACEMENT, all placed:', allTokensPlaced);

            // If AI players placed all tokens, advance to FINISHED
            if (allTokensPlaced) {
              await prisma.game.update({
                where: { id: gameId },
                data: {
                  status: 'FINISHED',
                  highlightedEdges: null,
                  currentTurnIndex: null,
                  placementTimeout: null,
                },
              });
              return NextResponse.json({ success: true, status: 'FINISHED', gameFinished: true });
            }
          } catch (err) {
            console.error('Failed to process AI token placements for FINAL_PLACEMENT:', err);
          }

          return NextResponse.json({
            success: true,
            status: "FINAL_PLACEMENT",
            remainingEdges: remainingEdges.length,
          });
        }

        // If map is complete, go to FINISHED
        if (placedTokens >= totalVertices) {
          await prisma.game.update({
            where: { id: gameId },
            data: { status: "FINISHED" },
          });

          return NextResponse.json({
            success: true,
            mapComplete: true,
          });
        }

        // Otherwise, start next round
        const playerCount = game.players.length;
        const implications = getSongImplications(playerCount, undefined, game.isPOTS);

        // Convert turn order indices to player IDs
        const convertIndicesToPlayerIds = (indexString: string): string[] => {
          return indexString.split('').map(indexChar => {
            const index = parseInt(indexChar, 10);
            return game.players[index].id;
          });
        };

        // Generate highlighted edges for the next round
        const existingTokens = await prisma.influenceToken.findMany({
          where: { gameId },
          select: { edgeId: true },
        });
        // Use tokensPerRound from implications (correct for all player counts)
        const tokensPerRound = implications.tokensPerRound;
        const highlightedEdges = selectRandomVertices(mapLayout, existingTokens, tokensPerRound);

        await prisma.game.update({
          where: { id: gameId },
          data: {
            status: "ROUND1",
            roundNumber: game.roundNumber + 1,
            winningSong: null, // Clear winner for new round
            turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
            turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
            turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
            turnOrderD: implications.songD ? JSON.stringify(convertIndicesToPlayerIds(implications.songD)) : null,
            highlightedEdges: JSON.stringify(highlightedEdges), // Store highlighted edges for preview
          },
        });

        return NextResponse.json({
          success: true,
          mapComplete: false,
        });
      }

      return NextResponse.json(
        { error: "Cannot advance from current game state" },
        { status: 400 }
      );
    }

    if (action === "finish") {
      // End the game
      await prisma.game.update({
        where: { id: gameId },
        data: { status: "FINISHED" },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Advance game error:", error);
    return NextResponse.json(
      { error: "Failed to advance game" },
      { status: 500 }
    );
  }
}
