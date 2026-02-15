import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deserializeMapLayout } from '@/lib/game/map-generator';
import {
  validateTokenPlacement,
  calculateImmediateReward,
} from '@/lib/game/token-placement-logic';
import { processAllAITokenPlacements } from '@/lib/game/ai-token-placement';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId } = await params;
    const body = await request.json();
    const { edgeId, tokenType, orientation } = body;

    // Validate input
    if (!edgeId || !tokenType || !orientation) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['4/0', '3/1', '2/2'].includes(tokenType)) {
      return NextResponse.json({ error: 'Invalid token type' }, { status: 400 });
    }

    if (!['A', 'B'].includes(orientation)) {
      return NextResponse.json({ error: 'Invalid orientation' }, { status: 400 });
    }

    // Get game with all related data
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { createdAt: 'asc' }, // Maintain join order
        },
        influenceTokens: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Verify player is in game
    const player = game.players.find((p) => p.id === session.playerId);
    if (!player) {
      return NextResponse.json(
        { error: 'You are not a player in this game' },
        { status: 403 }
      );
    }

    // Verify game is in TOKEN_PLACEMENT or FINAL_PLACEMENT status
    if (game.status !== 'TOKEN_PLACEMENT' && game.status !== 'FINAL_PLACEMENT') {
      return NextResponse.json(
        { error: 'Not in token placement phase' },
        { status: 400 }
      );
    }

    // For FINAL_PLACEMENT, we don't need winningSong
    if (game.status === 'TOKEN_PLACEMENT') {
      if (!game.mapLayout || !game.winningSong || !game.highlightedEdges) {
        return NextResponse.json(
          { error: 'Missing map, winning song, or highlighted edges data' },
          { status: 500 }
        );
      }
    } else if (game.status === 'FINAL_PLACEMENT') {
      if (!game.mapLayout || !game.highlightedEdges) {
        return NextResponse.json(
          { error: 'Missing map or highlighted edges data' },
          { status: 500 }
        );
      }
    }

    // Deserialize map layout
    if (!game.mapLayout) {
      return NextResponse.json({ error: "Map layout not found" }, { status: 400 });
    }
    const mapLayout = deserializeMapLayout(game.mapLayout);

    // Get turn order from stored game data (already randomized and stored as player IDs)
    const getTurnOrder = (): string[] => {
      // For FINAL_PLACEMENT, use turnOrderA which stores the money-based final turn order
      if (game.status === 'FINAL_PLACEMENT' && game.turnOrderA) {
        return JSON.parse(game.turnOrderA);
      }
      // For regular TOKEN_PLACEMENT, use song-based turn order
      if (game.winningSong === 'A' && game.turnOrderA) return JSON.parse(game.turnOrderA);
      if (game.winningSong === 'B' && game.turnOrderB) return JSON.parse(game.turnOrderB);
      if (game.winningSong === 'C' && game.turnOrderC) return JSON.parse(game.turnOrderC);
      if (game.winningSong === 'D' && game.turnOrderD) return JSON.parse(game.turnOrderD);
      return [];
    };

    const turnOrderPlayerIds = getTurnOrder();

    // Convert to PlacementTurn format with player info
    const turnOrder = turnOrderPlayerIds.map((playerId, index) => {
      const player = game.players.find(p => p.id === playerId);
      return {
        playerIndex: index,
        playerId: playerId,
        playerName: player?.name || 'Unknown',
      };
    });

    // Use stored currentTurnIndex instead of counting tokens
    const currentTurnIndex = game.currentTurnIndex ?? 0;

    if (currentTurnIndex >= turnOrder.length) {
      return NextResponse.json(
        { error: 'All tokens for this round already placed' },
        { status: 400 }
      );
    }

    const currentTurn = turnOrder[currentTurnIndex];

    // Get highlighted edges from database
    if (!game.highlightedEdges) {
      return NextResponse.json({ error: "Highlighted edges not found" }, { status: 400 });
    }
    const highlightedEdges = JSON.parse(game.highlightedEdges);

    // Validate placement
    // For Multi-Map mode, only check tokens from current map
    let relevantTokens = game.influenceTokens;
    if (game.isMultiMap) {
      // Helper function to calculate rounds per map
      const getRoundsPerMap = (playerCount: number, gameVariant?: string | null): number => {
        // 5A variant uses 4 rounds per map (5 tokens × 4 rounds = 20 edges on NYC20)
        if (gameVariant === "5A") return 4;
        if (playerCount === 3) return 5;
        if (playerCount === 4) return 5; // 4-player: 5 rounds per map
        if (playerCount === 5) return 5; // 5-player: 5 rounds per map (5 tokens × 5 = 25 edges on NYC25)
        if (playerCount === 6) return 5;
        return 5;
      };
      const realPlayersForMap = game.players.filter(p => p.name !== 'NPC');
      const roundsPerMap = getRoundsPerMap(realPlayersForMap.length, game.gameVariant);

      if (game.currentMapNumber === 1) {
        relevantTokens = game.influenceTokens.filter(t => t.roundNumber <= roundsPerMap);
      } else if (game.currentMapNumber === 2) {
        relevantTokens = game.influenceTokens.filter(t => t.roundNumber >= roundsPerMap + 1);
      }
    }

    const existingTokens = relevantTokens.map((t) => ({
      edgeId: t.edgeId,
    }));

    const validation = validateTokenPlacement(
      edgeId,
      player.id,
      currentTurn.playerId,
      highlightedEdges, // Use persisted highlighted edges
      existingTokens
    );

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Create the token
    const newToken = await prisma.influenceToken.create({
      data: {
        gameId,
        playerId: player.id,
        roundNumber: game.roundNumber,
        edgeId,
        tokenType,
        orientation,
      },
    });

    // Calculate immediate rewards (lightning/dollar hexes)
    const immediateReward = calculateImmediateReward(
      edgeId,
      tokenType,
      orientation,
      mapLayout
    );

    // Apply immediate rewards
    if (immediateReward) {
      if (immediateReward.victoryPoints !== undefined) {
        await prisma.player.update({
          where: { id: player.id },
          data: {
            victoryPoints: player.victoryPoints + immediateReward.victoryPoints,
          },
        });
      }

      if (immediateReward.currency !== undefined) {
        await prisma.player.update({
          where: { id: player.id },
          data: {
            currencyBalance: player.currencyBalance + immediateReward.currency,
          },
        });
      }
    }

    // Advance turn index
    const nextTurnIndex = currentTurnIndex + 1;
    const allTokensPlaced = nextTurnIndex >= turnOrder.length;

    // Update game state
    await prisma.game.update({
      where: { id: gameId },
      data: {
        currentTurnIndex: nextTurnIndex,
        placementTimeout: allTokensPlaced
          ? null
          : new Date(Date.now() + 90000), // Reset timeout for next player (90s)
      },
    });

    // If all tokens placed, call advance endpoint to handle round progression
    if (allTokensPlaced) {
      // Call advance endpoint server-side
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const advanceResponse = await fetch(`${baseUrl}/api/game/${gameId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'completeTokenPlacement' }),
        });

        if (!advanceResponse.ok) {
          console.error('Failed to complete token placement:', await advanceResponse.text());
        }
      } catch (err) {
        console.error('Error completing token placement:', err);
      }

      // Return success - advance endpoint handles game state changes
      return NextResponse.json({
        success: true,
        tokenPlaced: {
          id: newToken.id,
          edgeId: newToken.edgeId,
          tokenType: newToken.tokenType,
          orientation: newToken.orientation,
        },
        immediateReward: immediateReward || undefined,
        allTokensPlaced: true,
      });
    }

    // DISABLED: Old auto-advance logic (replaced by advance endpoint call above)
    /*
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (false) {
      // Save highlighted edges before clearing (needed for Multi-Map NPC token placement)
      const savedHighlightedEdges = game!.highlightedEdges;

      // Clear token placement data and advance to next round
      await prisma.game.update({
        where: { id: gameId },
        data: {
          highlightedEdges: null,
          currentTurnIndex: null,
          placementTimeout: null,
        },
      });

      // If this was FINAL_PLACEMENT, go directly to FINISHED
      if (game.status === 'FINAL_PLACEMENT') {
        await prisma.game.update({
          where: { id: gameId },
          data: { status: 'FINISHED' },
        });
        return NextResponse.json({ success: true, allTokensPlaced: true, gameFinished: true });
      }

      // Check if map is complete (all edges filled)
      const mapLayout = deserializeMapLayout(game.mapLayout!);
      const totalEdges = mapLayout.edges.length;

      // For Multi-Map mode, only count tokens from current map
      let tokenCountWhere: any = { gameId };
      if (game.isMultiMap) {
        // Helper function to calculate rounds per map
        const getRoundsPerMap = (playerCount: number, gameVariant?: string | null): number => {
          // 5A variant uses 4 rounds per map (5 tokens × 4 rounds = 20 edges on NYC20)
          if (gameVariant === "5A") return 4;
          if (playerCount === 3) return 5;
          if (playerCount === 4) return 5; // 4-player: 5 rounds per map
          if (playerCount === 5) return 5; // 5-player standard: 5 rounds per map (5 tokens × 5 = 25 edges on NYC25)
          if (playerCount === 6) return 5;
          return 5;
        };
        const realPlayersForMap = game.players.filter(p => p.name !== 'NPC');
        const roundsPerMap = getRoundsPerMap(realPlayersForMap.length, game.gameVariant);

        if (game.currentMapNumber === 2) {
          tokenCountWhere = { gameId, roundNumber: { gte: roundsPerMap + 1 } };
        } else if (game.currentMapNumber === 1) {
          tokenCountWhere = { gameId, roundNumber: { lte: roundsPerMap } };
        }
      }

      const placedTokens = await prisma.influenceToken.count({
        where: tokenCountWhere,
      });

      if (placedTokens >= totalEdges) {
        // Map is complete - go to FINISHED
        await prisma.game.update({
          where: { id: gameId },
          data: { status: 'FINISHED' },
        });
      } else if (game.isMultiMap) {
        // Determine player count for this game
        const realPlayersCheck = await prisma.player.findMany({
          where: { gameId, name: { not: 'NPC' } }
        });
        const playerCount = realPlayersCheck.length;

        // Helper function to calculate rounds per map
        const getRoundsPerMap = (playerCount: number, gameVariant?: string | null): number => {
          // 5A variant uses 4 rounds per map (5 tokens × 4 rounds = 20 edges on NYC20)
          if (gameVariant === "5A") return 4;
          if (playerCount === 3) return 5;
          if (playerCount === 4) return 5; // 4-player: 5 rounds per map
          if (playerCount === 5) return 5; // 5-player standard: 5 rounds per map (5 tokens × 5 = 25 edges on NYC25)
          if (playerCount === 6) return 5;
          return 5;
        };
        const roundsPerMap = getRoundsPerMap(playerCount, game.gameVariant);

        // Check if we just completed a map (final round of that map)
        const isMapEnd = game.roundNumber === roundsPerMap || game.roundNumber === roundsPerMap * 2;

        if (isMapEnd) {

          // For 5-player mode, NPCs are placed during rounds (not at map end)
          // Skip this end-of-map NPC placement
          if (playerCount === 5) {
            // 5-player mode: Skip NPC placement, go directly to map completion logic
            if (game.roundNumber === roundsPerMap) {
            console.log(`🗺️ Round ${roundsPerMap} complete (5-player) - calculating first map results`);

            // Calculate and store first map results
            const { calculateSymbolsCollected } = await import('@/lib/game/end-game-scoring');
            const allTokens = await prisma.influenceToken.findMany({
              where: { gameId },
              include: { player: true },
            });

            const allPlayers = await prisma.player.findMany({
              where: { gameId },
            });

            // Filter out NPC player from results and map to expected format
            const players = allPlayers
              .filter(p => p.name !== 'NPC')
              .map(p => ({
                id: p.id,
                name: p.name,
                color: p.playerColor || '#888888'
              }));

            const symbolsCollected = calculateSymbolsCollected(
              allTokens,
              mapLayout,
              players
            );

            await prisma.game.update({
              where: { id: gameId },
              data: {
                status: 'FIRST_MAP_COMPLETED',
                firstMapLayout: game.mapLayout,
                firstMapResults: JSON.stringify(symbolsCollected),
              },
            });

            return NextResponse.json({
              success: true,
              allTokensPlaced: true,
              firstMapCompleted: true,
              symbolsCollected,
            });
          } else {
            // Second map complete - game finished
            await prisma.game.update({
              where: { id: gameId },
              data: { status: 'FINISHED' },
            });

            return NextResponse.json({
              success: true,
              allTokensPlaced: true,
              gameFinished: true,
            });
          }
          } else {
            // For 3, 4, 6-player modes: Place NPC tokens at end of map (skip for 3A variant)
            const { calculateSymbolsCollected } = await import('@/lib/game/end-game-scoring');

            // Find the NPC player for this game
            const npcPlayer = await prisma.player.findFirst({
              where: {
                gameId,
                name: 'NPC',
              },
            });

            // For 3A, 3B, 4-player, and 5-player (or any game without NPC player), skip NPC token placement
            // Place NPC tokens if NPC player exists and variant is not 3A/3B and not 4-player and not 5-player
            if (npcPlayer && game.gameVariant !== "3A" && game.gameVariant !== "3B" && playerCount !== 4 && playerCount !== 5) {
              console.log(`🎮 MULTI-MAP ROUND ${game.roundNumber} - Placing NPC tokens`);

              // Get existing tokens from current map only
              const whereClause = game.roundNumber === roundsPerMap
                ? { gameId, roundNumber: { lte: roundsPerMap } }  // First map
                : { gameId, roundNumber: { gte: roundsPerMap + 1 } }; // Second map

              const existingTokens = await prisma.influenceToken.findMany({
                where: whereClause,
                select: { edgeId: true },
              });
              const placedEdges = existingTokens.map(t => t.edgeId);

              // Get the highlighted edges from this round
              const lastHighlightedEdges = savedHighlightedEdges
                ? JSON.parse(savedHighlightedEdges)
                : [];

              // Find the highlighted edges that weren't filled by players
              const remainingHighlightedEdges = lastHighlightedEdges.filter(
                (edge: string) => !placedEdges.includes(edge)
              );

              // Calculate NPC token count based on player count
              const npcTokenCount = playerCount === 3 ? 3
                                   : playerCount === 4 ? 2
                                   : playerCount === 5 ? 0  // 5-player handled separately
                                   : 4;  // 6-player

              // Place NPC tokens on remaining highlighted edges
              const npcEdges = remainingHighlightedEdges.slice(0, npcTokenCount);
              console.log(`📍 Creating ${npcEdges.length} NPC tokens on edges:`, npcEdges);

              // Save NPC tokens directly (using actual NPC player ID)
              for (const edgeId of npcEdges) {
                await prisma.influenceToken.create({
                  data: {
                    gameId,
                    playerId: npcPlayer.id, // Use actual NPC player ID
                    roundNumber: game.roundNumber,
                    edgeId,
                    tokenType: '0/0',
                    orientation: 'A',
                  },
                });
              }
            }

            // Calculate and store map results (regardless of whether NPC tokens were placed)
            if (game.roundNumber === roundsPerMap) {
              console.log(`🗺️ Round ${roundsPerMap} complete - calculating first map results`);

              // Calculate and store first map results
              const allTokens = await prisma.influenceToken.findMany({
                where: { gameId },
                include: { player: true },
              });

              console.log(`📊 Found ${allTokens.length} total tokens for first map`);

              const allPlayers = await prisma.player.findMany({
                where: { gameId },
              });

              // Filter out NPC player from results and map to expected format
              const players = allPlayers
                .filter(p => p.name !== 'NPC')
                .map(p => ({
                  id: p.id,
                  name: p.name,
                  color: p.playerColor || '#888888'
                }));

              console.log(`👥 Calculating results for ${players.length} real players`);

              const symbolsCollected = calculateSymbolsCollected(
                allTokens,
                mapLayout,
                players
              );

              console.log('✅ Symbols calculated:', symbolsCollected);

              await prisma.game.update({
                where: { id: gameId },
                data: {
                  status: 'FIRST_MAP_COMPLETED',
                  firstMapLayout: game.mapLayout,
                  firstMapResults: JSON.stringify(symbolsCollected),
                },
              });

              console.log('✅ Game status updated to FIRST_MAP_COMPLETED');

              return NextResponse.json({
                success: true,
                allTokensPlaced: true,
                firstMapCompleted: true,
                symbolsCollected,
              });
            } else {
              // Second map complete - game finished
              await prisma.game.update({
                where: { id: gameId },
                data: { status: 'FINISHED' },
              });

              return NextResponse.json({
                success: true,
                allTokensPlaced: true,
                gameFinished: true,
              });
            }
          }
        }
      } else if (game.isPOTS && game.roundNumber === game.totalRounds) {
        // POTS MODE: After final round, enter FINAL_PLACEMENT phase
        const existingTokens = await prisma.influenceToken.findMany({
          where: { gameId },
          select: { edgeId: true },
        });

        const remainingEdges = mapLayout.edges.filter(edgeId =>
          !existingTokens.some(token => token.edgeId === edgeId)
        );

        console.log(`FINAL_PLACEMENT (from place-token): ${remainingEdges.length} remaining edges out of ${mapLayout.edges.length} total`);

        // Calculate turn order based on money remaining
        const playersWithTokensRaw = await prisma.player.findMany({
          where: { gameId },
          include: {
            influenceTokens: {
              where: { gameId },
            },
          },
        });

        // Filter out NPC player from final placement
        const playersWithTokens = playersWithTokensRaw.filter(p => p.name !== 'NPC');

        // Sort by money (descending), then by token count (ascending for ties)
        const sortedPlayers = playersWithTokens.sort((a, b) => {
          if (b.currencyBalance !== a.currencyBalance) {
            return b.currencyBalance - a.currencyBalance;
          }
          return a.influenceTokens.length - b.influenceTokens.length;
        });

        // Create final turn order based on player count
        const finalTurnOrder: string[] = [];

        if (playersWithTokens.length === 6) {
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
        } else if (playersWithTokens.length === 5) {
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
        } else if (playersWithTokens.length === 4) {
          // 4-player: Each player places 1 token
          sortedPlayers.forEach(player => finalTurnOrder.push(player.id));
        } else {
          // 3-player or other: Each player places equal number of tokens
          const tokensPerPlayer = Math.floor(remainingEdges.length / playersWithTokens.length);
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
            placementTimeout: new Date(Date.now() + 90000),
          },
        });

        // Process AI token placements immediately for FINAL_PLACEMENT
        try {
          const allTokensPlacedInFinal = await processAllAITokenPlacements(gameId);
          console.log('AI token placements processed for FINAL_PLACEMENT, all placed:', allTokensPlacedInFinal);

          if (allTokensPlacedInFinal) {
            await prisma.game.update({
              where: { id: gameId },
              data: {
                status: 'FINISHED',
                highlightedEdges: null,
                currentTurnIndex: null,
                placementTimeout: null,
              },
            });
          }
        } catch (err) {
          console.error('Failed to process AI token placements for FINAL_PLACEMENT:', err);
        }
      }
      // For normal games and multimap: Don't auto-advance here
      // The frontend should call advance endpoint with completeTokenPlacement action
    }
    */
    // Continue with normal flow
    {
      // Process AI token placements if next player is AI
      const nextPlayerTurn = turnOrder[nextTurnIndex];
      const nextPlayer = game.players.find(p => p.id === nextPlayerTurn.playerId);

      if (nextPlayer?.isAI) {
        try {
          // Await AI token placements to ensure they complete
          const allTokensPlaced = await processAllAITokenPlacements(gameId);

          // If all tokens placed after AI turns, call advance endpoint
          if (allTokensPlaced) {
            // Call advance endpoint server-side
            try {
              const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
              const advanceResponse = await fetch(`${baseUrl}/api/game/${gameId}/advance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'completeTokenPlacement' }),
              });

              if (!advanceResponse.ok) {
                console.error('Failed to complete token placement (AI):', await advanceResponse.text());
              }
            } catch (err) {
              console.error('Error completing token placement (AI):', err);
            }

            // Return success - advance endpoint handles game state changes
            return NextResponse.json({
              success: true,
              tokenPlaced: {
                id: newToken.id,
                edgeId: newToken.edgeId,
                tokenType: newToken.tokenType,
                orientation: newToken.orientation,
              },
              immediateReward: immediateReward || undefined,
              allTokensPlaced: true,
            });
          }

          // DISABLED: Old AI auto-advance logic (replaced by advance endpoint call above)
          /*
          if (false) {
            // Save highlighted edges before clearing (needed for Multi-Map NPC token placement)
            const savedHighlightedEdgesAI = game.highlightedEdges;

            // Clear token placement data
            await prisma.game.update({
              where: { id: gameId },
              data: {
                highlightedEdges: null,
                currentTurnIndex: null,
                placementTimeout: null,
              },
            });

            // If this was FINAL_PLACEMENT, go directly to FINISHED
            if (game.status === 'FINAL_PLACEMENT') {
              await prisma.game.update({
                where: { id: gameId },
                data: { status: 'FINISHED' },
              });
              // Don't return here, let the normal response flow continue
            } else {
              // Check if map is complete
              const mapLayout = deserializeMapLayout(game.mapLayout!);
              const totalEdges = mapLayout.edges.length;

              // For Multi-Map mode, only count tokens from current map
              let tokenCountWhereAI: any = { gameId };
              if (game.isMultiMap) {
                // Helper function to calculate rounds per map
                const getRoundsPerMap = (playerCount: number, gameVariant?: string | null): number => {
                  // 5A variant uses 4 rounds per map (5 tokens × 4 rounds = 20 edges on NYC20)
                  if (gameVariant === "5A") return 4;
                  if (playerCount === 3) return 5;
                  if (playerCount === 4) return 5; // 4-player: 5 rounds per map
                  if (playerCount === 5) return 5; // 5-player standard: 5 rounds per map (5 tokens × 5 = 25 edges on NYC25)
                  if (playerCount === 6) return 5;
                  return 5;
                };
                const realPlayersForMap = game.players.filter(p => p.name !== 'NPC');
                const roundsPerMap = getRoundsPerMap(realPlayersForMap.length, game.gameVariant);

                if (game.currentMapNumber === 2) {
                  tokenCountWhereAI = { gameId, roundNumber: { gte: roundsPerMap + 1 } };
                } else if (game.currentMapNumber === 1) {
                  tokenCountWhereAI = { gameId, roundNumber: { lte: roundsPerMap } };
                }
              }

              const placedTokens = await prisma.influenceToken.count({
                where: tokenCountWhereAI,
              });

              if (placedTokens >= totalEdges) {
                await prisma.game.update({
                  where: { id: gameId },
                  data: { status: 'FINISHED' },
                });
              } else if (game.isMultiMap) {
                // Determine player count for this game (AI path)
                const realPlayersCheckAI = await prisma.player.findMany({
                  where: { gameId, name: { not: 'NPC' } }
                });
                const playerCountAI = realPlayersCheckAI.length;

                // Helper function to calculate rounds per map
                const getRoundsPerMap = (playerCount: number, gameVariant?: string | null): number => {
                  // 5A variant uses 4 rounds per map (5 tokens × 4 rounds = 20 edges on NYC20)
                  if (gameVariant === "5A") return 4;
                  if (playerCount === 3) return 5;
                  if (playerCount === 4) return 5; // 4-player: 5 rounds per map
                  if (playerCount === 5) return 5; // 5-player standard: 5 rounds per map (5 tokens × 5 = 25 edges on NYC25)
                  if (playerCount === 6) return 5;
                  return 5;
                };
                const roundsPerMapAI = getRoundsPerMap(playerCountAI, game.gameVariant);

                // Check if we just completed a map (final round of that map)
                const isMapEndAI = game.roundNumber === roundsPerMapAI || game.roundNumber === roundsPerMapAI * 2;

                if (isMapEndAI) {

                  // For 5-player mode, NPCs are placed during rounds (not at map end)
                  // Skip this end-of-map NPC placement
                  if (playerCountAI === 5) {
                    // 5-player mode: Skip NPC placement, go directly to map completion logic
                    if (game.roundNumber === roundsPerMapAI) {
                    // Calculate and store first map results
                    const { calculateSymbolsCollected } = await import('@/lib/game/end-game-scoring');
                    const allTokens = await prisma.influenceToken.findMany({
                      where: { gameId },
                      include: { player: true },
                    });
                    const allPlayersAI = await prisma.player.findMany({
                      where: { gameId },
                    });

                    // Filter out NPC player from results and map to expected format
                    const players = allPlayersAI
                      .filter(p => p.name !== 'NPC')
                      .map(p => ({
                        id: p.id,
                        name: p.name,
                        color: p.playerColor || '#888888'
                      }));

                    const symbolsCollected = calculateSymbolsCollected(
                      allTokens,
                      mapLayout,
                      players
                    );

                    await prisma.game.update({
                      where: { id: gameId },
                      data: {
                        status: 'FIRST_MAP_COMPLETED',
                        firstMapLayout: game.mapLayout,
                        firstMapResults: JSON.stringify(symbolsCollected),
                      },
                    });
                  } else {
                    // Second map complete - game finished
                    await prisma.game.update({
                      where: { id: gameId },
                      data: { status: 'FINISHED' },
                    });
                  }
                  // Skip NPC placement and continue to next part
                  } else {
                    // For 3, 4, 6-player modes: Place NPC tokens at end of map
                    // MULTI-MAP MODE: After final round of each map, place NPC tokens on remaining highlighted edges
                    const { calculateSymbolsCollected } = await import('@/lib/game/end-game-scoring');

                    // Find the NPC player for this game
                    const npcPlayerAI = await prisma.player.findFirst({
                      where: {
                        gameId,
                        name: 'NPC',
                      },
                    });

                    if (!npcPlayerAI) {
                      console.error('NPC player not found for Multi-Map game (AI path)');
                      // Don't fail completely, just skip NPC placement
                    } else {
                      // Get existing tokens from current map only
                      const whereClauseAI = game.roundNumber === roundsPerMapAI
                        ? { gameId, roundNumber: { lte: roundsPerMapAI } }  // First map
                        : { gameId, roundNumber: { gte: roundsPerMapAI + 1 } }; // Second map

                      const existingTokens = await prisma.influenceToken.findMany({
                        where: whereClauseAI,
                        select: { edgeId: true },
                      });
                      const placedEdges = existingTokens.map(t => t.edgeId);

                      // Get the highlighted edges from this round
                      const lastHighlightedEdges = savedHighlightedEdgesAI
                        ? JSON.parse(savedHighlightedEdgesAI)
                        : [];

                      // Find the highlighted edges that weren't filled by players
                      const remainingHighlightedEdges = lastHighlightedEdges.filter(
                        (edge: string) => !placedEdges.includes(edge)
                      );

                      // Calculate NPC token count based on player count
                      const npcTokenCountAI = playerCountAI === 3 ? 3
                                           : playerCountAI === 4 ? 0  // 4-player: NYC30 fills perfectly (6 × 5 = 30)
                                           : playerCountAI === 5 ? 0  // 5-player: NYC25 fills perfectly (5 × 5 = 25)
                                           : 4;  // 6-player

                      // Place NPC tokens on remaining highlighted edges
                      const npcEdges = remainingHighlightedEdges.slice(0, npcTokenCountAI);
                      console.log(`📍 Creating ${npcEdges.length} NPC tokens (AI path) on edges:`, npcEdges);

                      // Save NPC tokens directly (using actual NPC player ID)
                      for (const edgeId of npcEdges) {
                        await prisma.influenceToken.create({
                          data: {
                            gameId,
                            playerId: npcPlayerAI.id, // Use actual NPC player ID
                            roundNumber: game.roundNumber,
                            edgeId,
                            tokenType: '0/0',
                            orientation: 'A',
                          },
                        });
                      }
                    }

                    if (game.roundNumber === roundsPerMapAI) {
                      // Calculate and store first map results
                      const allTokens = await prisma.influenceToken.findMany({
                        where: { gameId },
                        include: { player: true },
                      });
                      const allPlayersAI = await prisma.player.findMany({
                        where: { gameId },
                      });

                      // Filter out NPC player from results and map to expected format
                      const players = allPlayersAI
                        .filter(p => p.name !== 'NPC')
                        .map(p => ({
                          id: p.id,
                          name: p.name,
                          color: p.playerColor || '#888888'
                        }));

                      const symbolsCollected = calculateSymbolsCollected(
                        allTokens,
                        mapLayout,
                        players
                      );

                      await prisma.game.update({
                        where: { id: gameId },
                        data: {
                          status: 'FIRST_MAP_COMPLETED',
                          firstMapLayout: game.mapLayout,
                          firstMapResults: JSON.stringify(symbolsCollected),
                        },
                      });
                    } else {
                      // Second map complete - game finished
                      await prisma.game.update({
                        where: { id: gameId },
                        data: { status: 'FINISHED' },
                      });
                    }
                  }
                }
              } else if (game.isPOTS && game.roundNumber === game.totalRounds) {
                // POTS MODE: After final round, enter FINAL_PLACEMENT phase
                const existingTokens = await prisma.influenceToken.findMany({
                  where: { gameId },
                  select: { edgeId: true },
                });

                const remainingEdges = mapLayout.edges.filter(edgeId =>
                  !existingTokens.some(token => token.edgeId === edgeId)
                );

                console.log(`FINAL_PLACEMENT (from place-token AI completion): ${remainingEdges.length} remaining edges out of ${mapLayout.edges.length} total`);

                // Calculate turn order based on money remaining
                const playersWithTokens = await prisma.player.findMany({
                  where: { gameId },
                  include: {
                    influenceTokens: {
                      where: { gameId },
                    },
                  },
                });

                // Sort by money (descending), then by token count (ascending for ties)
                const sortedPlayers = playersWithTokens.sort((a, b) => {
                  if (b.currencyBalance !== a.currencyBalance) {
                    return b.currencyBalance - a.currencyBalance;
                  }
                  return a.influenceTokens.length - b.influenceTokens.length;
                });

                // Create final turn order based on player count
                const finalTurnOrder: string[] = [];

                if (playersWithTokens.length === 6) {
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
                } else if (playersWithTokens.length === 5) {
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
                } else if (playersWithTokens.length === 4) {
                  // 4-player: Each player places 1 token
                  sortedPlayers.forEach(player => finalTurnOrder.push(player.id));
                } else {
                  // 3-player or other: Each player places equal number of tokens
                  const tokensPerPlayer = Math.floor(remainingEdges.length / playersWithTokens.length);
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
                    placementTimeout: new Date(Date.now() + 90000),
                  },
                });

                // Process AI token placements immediately for FINAL_PLACEMENT
                try {
                  const allTokensPlacedInFinal = await processAllAITokenPlacements(gameId);
                  console.log('AI token placements processed for FINAL_PLACEMENT (from AI completion), all placed:', allTokensPlacedInFinal);

                  if (allTokensPlacedInFinal) {
                    await prisma.game.update({
                      where: { id: gameId },
                      data: {
                        status: 'FINISHED',
                        highlightedEdges: null,
                        currentTurnIndex: null,
                        placementTimeout: null,
                      },
                    });
                  }
                } catch (err) {
                  console.error('Failed to process AI token placements for FINAL_PLACEMENT (from AI completion):', err);
                }
              }
              // For normal games and multimap: Don't auto-advance here
              // The frontend should call advance endpoint with completeTokenPlacement action
            }
          }
          */
        } catch (err) {
          console.error('Error processing AI token placements:', err);
        }
      }
    }

    // Prepare response
    const response: any = {
      success: true,
      tokenPlaced: {
        id: newToken.id,
        edgeId: newToken.edgeId,
        tokenType: newToken.tokenType,
        orientation: newToken.orientation,
      },
      immediateReward: immediateReward || undefined,
      allTokensPlaced,
    };

    if (!allTokensPlaced) {
      const nextTurn = turnOrder[nextTurnIndex];
      response.nextTurn = {
        playerId: nextTurn.playerId,
        playerName: nextTurn.playerName,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Place token error:', error);
    return NextResponse.json(
      { error: 'Failed to place token' },
      { status: 500 }
    );
  }
}
