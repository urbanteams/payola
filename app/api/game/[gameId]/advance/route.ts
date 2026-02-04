import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSongTotals, determineWinningSong, calculateCurrencyDeductions } from "@/lib/game/bidding-logic";
import { generateMapLayout, serializeMapLayout, deserializeMapLayout, generateMapLayoutWithEdgeCount } from "@/lib/game/map-generator";
import { getTotalRounds, getTokensPerRound, getSongImplications } from "@/lib/game/song-implications";
import { selectRandomVertices } from "@/lib/game/token-placement-logic";
import { processAllAITokenPlacements } from "@/lib/game/ai-token-placement";
import { selectNPCEdges, createNPCTokens } from "@/lib/game/npc-tokens";
import { calculateSymbolsCollected } from "@/lib/game/end-game-scoring";
import { deserializeInventory, addCards, serializeInventory, SECOND_MAP_CARDS } from "@/lib/game/card-inventory";

/**
 * Calculate rounds per map for Multi-Map mode based on player count and variant
 */
function getRoundsPerMap(playerCount: number, gameVariant?: string | null): number {
  // 5B variant uses 4 rounds per map (5 tokens × 4 rounds = 20 edges on NYC20)
  if (gameVariant === "5B") return 4;

  if (playerCount === 3) return 5;
  if (playerCount === 4) return 5; // 4-player: 5 rounds per map (6 tokens × 5 = 30 edges on NYC30)
  if (playerCount === 5) return 5; // 5-player: 5 rounds per map (5 tokens × 5 = 25 edges on NYC25)
  if (playerCount === 6) return 5;
  return 5; // Default
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    let { action } = body; // "start" | "nextRound" | "startTokenPlacement" | "completeTokenPlacement" | "finish"

    // completeTokenPlacement is called server-side from place-token route (which has auth)
    // So we skip session check for this action to allow internal calls
    const requiresAuth = action !== 'completeTokenPlacement';

    let session = null;
    let player = null;

    if (requiresAuth) {
      session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

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

    // Verify player is in game (skip for completeTokenPlacement since it's internal)
    if (requiresAuth && session) {
      player = game.players.find(p => p.id === session.playerId);
      if (!player) {
        return NextResponse.json(
          { error: "You are not a player in this game" },
          { status: 403 }
        );
      }
    }

    if (action === "start") {
      // Start game from lobby
      if (game.status !== "LOBBY") {
        return NextResponse.json(
          { error: "Game has already started" },
          { status: 400 }
        );
      }

      // Filter out NPC player when checking player count
      const realPlayersCheck = game.players.filter(p => p.name !== 'NPC');
      if (realPlayersCheck.length < 3) {
        return NextResponse.json(
          { error: "Need at least 3 players to start" },
          { status: 400 }
        );
      }

      // Generate map layout based on player count using B variants
      // Filter out NPC player when counting players
      const realPlayers = game.players.filter(p => p.name !== 'NPC');
      const playerCount = realPlayers.length;

      // Automatically select B variant based on player count
      const gameVariant = playerCount === 3 ? "3B"
                        : playerCount === 4 ? "4B"
                        : playerCount === 5 ? "5B"
                        : "6B"; // 6 players

      // Generate FIRST map with appropriate edge count for B variants
      const edgeCount = gameVariant === "3B" ? 15  // 3B variant uses NYC15
                      : gameVariant === "4B" ? 20  // 4B variant uses NYC20 (4 tokens × 5 rounds = 20)
                      : gameVariant === "5B" ? 20  // 5B variant uses NYC20 (5 tokens × 4 rounds = 20)
                      : 30; // 6B variant uses NYC30 (6 tokens × 5 rounds = 30)
      const includeClassicalStars = gameVariant === "6B"; // Only 6B gets Classical Stars
      const noMoneyHub = true; // All B variants replace Money Hub with Household
      const mapLayout = generateMapLayoutWithEdgeCount(edgeCount, includeClassicalStars, noMoneyHub);
      const totalRounds = getTotalRounds(playerCount, false, true, gameVariant); // useMultiMap = true

      // Generate turn orders for the first round using Multi-Map patterns
      const implications = getSongImplications(playerCount, undefined, false, true, gameVariant); // useMultiMap = true

      // Find NPC player for Multi-Map mode (if exists)
      const npcPlayerForStart = game.players.find(p => p.name === 'NPC');

      // Convert turn order indices to player IDs
      const convertIndicesToPlayerIds = (indexString: string): string[] => {
        return indexString.split('').map(indexChar => {
          // Map "X" to NPC player ID (not used in B variants)
          if (indexChar === 'X' || indexChar === 'x') {
            if (!npcPlayerForStart) {
              throw new Error('NPC player not found for Multi-Map mode');
            }
            return npcPlayerForStart.id;
          }
          const index = parseInt(indexChar, 10);
          if (isNaN(index) || index < 0 || index >= realPlayers.length) {
            throw new Error(`Invalid player index '${indexChar}' in turn order for playerCount ${realPlayers.length}`);
          }
          return realPlayers[index].id;
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
          mapType: mapLayout.mapType, // Store which map was selected
          mapLayout: serializeMapLayout(mapLayout),
          totalRounds,
          gameVariant: gameVariant, // Store variant (3B, 4B, 5B, or 6B)
          currentMapNumber: 1, // Starting with first map
          firstMapLayout: serializeMapLayout(mapLayout), // Store first map separately for multi-map mode
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
          placementTimeout: new Date(Date.now() + 90000), // 90 second timeout
        },
      });

      // Process AI token placements immediately
      try {
        const allTokensPlaced = await processAllAITokenPlacements(gameId);
        console.log('AI token placements processed (startTokenPlacement), all placed:', allTokensPlaced);

        if (allTokensPlaced) {
          console.log('All tokens placed by AI, handling round completion');
          // Note: The place-token route will handle round advancement when the last token is placed
        }
      } catch (err) {
        console.error('Failed to process AI token placements in startTokenPlacement:', err);
      }

      return NextResponse.json({
        success: true,
        highlightedEdges,
      });
    }

    if (action === "startSecondMap") {
      // Multi-Map Mode: Transition from first map completed to second map
      if (game.status !== "FIRST_MAP_COMPLETED") {
        return NextResponse.json(
          { error: "Not in first map completed state" },
          { status: 400 }
        );
      }

      if (!game.isMultiMap) {
        return NextResponse.json(
          { error: "This action is only for Multi-Map mode" },
          { status: 400 }
        );
      }

      // Filter out NPC player when counting players
      const realPlayersSecondMap = game.players.filter(p => p.name !== 'NPC');
      const playerCount = realPlayersSecondMap.length;
      const roundsPerMap = getRoundsPerMap(playerCount, game.gameVariant);

      // Generate second map with NYC15 (for 3A/3B), NYC18 (3 players), NYC20 (4B/5B), NYC30 (4 players or 6A/6B), NYC25 (5 players), or NYC24 (6 players)
      const edgeCount = (game.gameVariant === "3A" || game.gameVariant === "3B") ? 15  // 3A/3B variants use NYC15
                      : game.gameVariant === "4B" ? 20  // 4B variant uses NYC20 (4 tokens × 5 rounds = 20)
                      : game.gameVariant === "5B" ? 20  // 5B variant uses NYC20 (5 tokens × 4 rounds = 20)
                      : (game.gameVariant === "6A" || game.gameVariant === "6B") ? 30  // 6A/6B variants use NYC30 (6 tokens × 5 rounds = 30)
                      : playerCount === 3 ? 18
                      : playerCount === 4 ? 30  // 4-player uses NYC30 (6 tokens × 5 rounds = 30)
                      : playerCount === 5 ? 25  // 5-player uses NYC25 (5 tokens × 5 rounds = 25)
                      : 24; // 6-player standard
      const includeClassicalStars = (playerCount >= 5 && game.gameVariant !== "5B") || game.gameVariant === "6B"; // 5+ player modes get Classical Stars (except 5B variant)
      const noMoneyHub = game.gameVariant === "3B" || game.gameVariant === "4B" || game.gameVariant === "5B" || game.gameVariant === "6B"; // 3B/4B/5B/6B variants replace Money Hub with Household
      const secondMapLayout = generateMapLayoutWithEdgeCount(edgeCount, includeClassicalStars, noMoneyHub);

      // Get Multi-Map implications
      const implications = getSongImplications(playerCount, undefined, false, true, game.gameVariant); // useMultiMap = true, pass variant

      // Find NPC player for 5-player mode
      const npcPlayerForSecondMap = await prisma.player.findFirst({
        where: { gameId, name: 'NPC' },
      });

      // Convert turn order indices to player IDs
      const convertIndicesToPlayerIds = (indexString: string): string[] => {
        return indexString.split('').map(indexChar => {
          // Map "X" to NPC player ID for 5-player mode
          if (indexChar === 'X' || indexChar === 'x') {
            if (!npcPlayerForSecondMap) {
              throw new Error('NPC player not found for 5-player Multi-Map mode');
            }
            return npcPlayerForSecondMap.id;
          }
          const index = parseInt(indexChar, 10);
          return realPlayersSecondMap[index].id;
        });
      };

      // Generate highlighted edges for the second map
      const tokensPerRound = implications.tokensPerRound;
      const highlightedEdges = selectRandomVertices(secondMapLayout, [], tokensPerRound);

      // Add cards to all players for second map (B variants only)
      if (game.gameVariant && game.gameVariant.endsWith('B')) {
        for (const player of game.players) {
          if (player.cardInventory) {
            const currentInventory = deserializeInventory(player.cardInventory);
            const updatedInventory = addCards(currentInventory, SECOND_MAP_CARDS);
            await prisma.player.update({
              where: { id: player.id },
              data: {
                cardInventory: serializeInventory(updatedInventory),
              },
            });
          }
        }
      }

      // Update game to second map
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'ROUND1',
          roundNumber: roundsPerMap + 1, // Continue from round after first map
          currentMapNumber: 2,
          mapLayout: serializeMapLayout(secondMapLayout),
          secondMapLayout: serializeMapLayout(secondMapLayout),
          winningSong: null,
          turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
          turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
          turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
          turnOrderD: implications.songD ? JSON.stringify(convertIndicesToPlayerIds(implications.songD)) : null,
          highlightedEdges: JSON.stringify(highlightedEdges),
        },
      });

      return NextResponse.json({
        success: true,
        secondMapStarted: true,
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

      // Reload game to get updated state
      const updatedGameAfterClear = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          players: true,
          bids: true,
        },
      });

      if (!updatedGameAfterClear) {
        return NextResponse.json({ error: "Game not found after update" }, { status: 404 });
      }

      // Update the game variable to use the reloaded state
      Object.assign(game, updatedGameAfterClear);

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
            placementTimeout: new Date(Date.now() + 90000),
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

            // For Multi-Map mode, only count tokens from current map
            let tokenCountWhere: any = { gameId };
            if (updatedGame.isMultiMap) {
              const realPlayers = updatedGame.players.filter(p => p.name !== 'NPC');
              const roundsPerMap = getRoundsPerMap(realPlayers.length, updatedGame.gameVariant);

              if (updatedGame.currentMapNumber === 1) {
                tokenCountWhere = { gameId, roundNumber: { lte: roundsPerMap } };
              } else if (updatedGame.currentMapNumber === 2) {
                tokenCountWhere = { gameId, roundNumber: { gte: roundsPerMap + 1 } };
              }
            }

            const placedTokens = await prisma.influenceToken.count({
              where: tokenCountWhere,
            });

            // MULTI-MAP MODE: Check if we just completed first map or second map
            // IMPORTANT: This must come BEFORE the general completion check because
            // 3A variant and 4-player fill the entire first map, triggering the completion check early
            if (updatedGame.isMultiMap) {
              const realPlayersMap1 = updatedGame.players.filter(p => p.name !== 'NPC');
              const playerCount = realPlayersMap1.length;
              const roundsPerMap = getRoundsPerMap(playerCount, updatedGame.gameVariant);

              if (updatedGame.roundNumber === roundsPerMap) {
                // First map completed - place NPC tokens on remaining highlighted edges (skip for 3A, 3B, 4B, 5B, 6A, 6B variants, 4-player, and 5-player)
                if (updatedGame.gameVariant !== "3A" && updatedGame.gameVariant !== "3B" && updatedGame.gameVariant !== "4B" && updatedGame.gameVariant !== "5B" && updatedGame.gameVariant !== "6A" && updatedGame.gameVariant !== "6B" && playerCount !== 4 && playerCount !== 5) {
                  const existingTokens = await prisma.influenceToken.findMany({
                    where: { gameId },
                    select: { edgeId: true },
                  });
                  const placedEdges = existingTokens.map(t => t.edgeId);

                  // Get the highlighted edges from last round (should still be stored)
                  const highlightedEdges = updatedGame.highlightedEdges
                    ? JSON.parse(updatedGame.highlightedEdges)
                    : [];

                  // Find the highlighted edges that weren't filled by players
                  const remainingHighlightedEdges = highlightedEdges.filter(
                    (edge: string) => !placedEdges.includes(edge)
                  );

                  // Determine NPC token count based on player count
                  const npcTokenCount = playerCount === 3 ? 3
                                       : playerCount === 4 ? 2
                                       : 4; // 6-player

                  // Use remaining highlighted edges for NPC tokens (should be exactly npcTokenCount)
                  const npcEdges = remainingHighlightedEdges.slice(0, npcTokenCount);
                  const npcTokens = createNPCTokens(gameId, roundsPerMap, npcEdges);

                  // Save NPC tokens as regular influence tokens
                  for (const npcToken of npcTokens) {
                    await prisma.influenceToken.create({
                      data: {
                        gameId: npcToken.gameId,
                        playerId: npcToken.playerId,
                        roundNumber: npcToken.roundNumber,
                        edgeId: npcToken.edgeId,
                        tokenType: npcToken.tokenType,
                        orientation: npcToken.orientation,
                      },
                    });
                  }
                }

                // Calculate and store first map results
                const allTokensRaw = await prisma.influenceToken.findMany({
                  where: { gameId },
                  include: { player: true },
                });
                const allPlayers = await prisma.player.findMany({
                  where: { gameId },
                });

                // Map tokens to expected format
                const allTokens = allTokensRaw.map(t => ({
                  id: t.id,
                  edgeId: t.edgeId,
                  playerId: t.playerId,
                  playerName: t.player.name,
                  playerColor: t.player.playerColor,
                  tokenType: t.tokenType as "4/0" | "2/2" | "1/3",
                  orientation: t.orientation as "A" | "B",
                  roundNumber: t.roundNumber,
                }));

                // Filter out NPC player from results and map to expected format
                const players = allPlayers
                  .filter(p => p.name !== 'NPC')
                  .map(p => ({
                    id: p.id,
                    name: p.name,
                    color: p.playerColor || '#888888'
                  }));

                const symbolsCollected = calculateSymbolsCollected(allTokens, mapLayout, players);

                // Update game status to FIRST_MAP_COMPLETED
                await prisma.game.update({
                  where: { id: gameId },
                  data: {
                    status: 'FIRST_MAP_COMPLETED',
                    firstMapResults: JSON.stringify(symbolsCollected),
                    firstMapLayout: updatedGame.mapLayout, // Save first map layout for display
                  },
                });

                return NextResponse.json({
                  success: true,
                  firstMapCompleted: true,
                  symbolsCollected,
                });
              } else if (updatedGame.roundNumber === roundsPerMap * 2) {
                // Determine player count for second map check
                const realPlayersMap2Check = updatedGame.players.filter(p => p.name !== 'NPC');
                const playerCountMap2Check = realPlayersMap2Check.length;
                // Second map completed - place NPC tokens on remaining highlighted edges (skip for 3A, 3B, 4B, 5B, 6A, 6B variants, 4-player, and 5-player)
                if (updatedGame.gameVariant !== "3A" && updatedGame.gameVariant !== "3B" && updatedGame.gameVariant !== "4B" && updatedGame.gameVariant !== "5B" && updatedGame.gameVariant !== "6A" && updatedGame.gameVariant !== "6B" && playerCountMap2Check !== 4 && playerCountMap2Check !== 5) {
                  const existingTokens = await prisma.influenceToken.findMany({
                    where: {
                      gameId,
                      roundNumber: { gte: roundsPerMap + 1 }, // Only tokens from second map
                    },
                    select: { edgeId: true },
                  });
                  const placedEdges = existingTokens.map(t => t.edgeId);

                  // Get the highlighted edges from last round (should still be stored)
                  const highlightedEdges = updatedGame.highlightedEdges
                    ? JSON.parse(updatedGame.highlightedEdges)
                    : [];

                  // Find the highlighted edges that weren't filled by players
                  const remainingHighlightedEdges = highlightedEdges.filter(
                    (edge: string) => !placedEdges.includes(edge)
                  );

                  // Determine NPC token count based on player count
                  const realPlayersMap2 = updatedGame.players.filter(p => p.name !== 'NPC');
                  const playerCountMap2 = realPlayersMap2.length;
                  const npcTokenCount = playerCountMap2 === 3 ? 3
                                       : playerCountMap2 === 4 ? 2
                                       : 4; // 6-player

                  // Use remaining highlighted edges for NPC tokens (should be exactly npcTokenCount)
                  const npcEdges = remainingHighlightedEdges.slice(0, npcTokenCount);
                  const npcTokens = createNPCTokens(gameId, roundsPerMap * 2, npcEdges);

                  // Save NPC tokens as regular influence tokens
                  for (const npcToken of npcTokens) {
                    await prisma.influenceToken.create({
                      data: {
                        gameId: npcToken.gameId,
                        playerId: npcToken.playerId,
                        roundNumber: npcToken.roundNumber,
                        edgeId: npcToken.edgeId,
                        tokenType: npcToken.tokenType,
                        orientation: npcToken.orientation,
                      },
                    });
                  }
                }

                // Game is finished - update status
                await prisma.game.update({
                  where: { id: gameId },
                  data: {
                    status: 'FINISHED',
                  },
                });

                return NextResponse.json({
                  success: true,
                  gameFinished: true,
                });
              }
            }

            // GENERAL COMPLETION CHECK: For non-Multi-Map games, check if map is complete
            // Multi-Map games are handled by the block above
            if (!updatedGame.isMultiMap && placedTokens >= totalEdges) {
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
              const playersRaw = await prisma.player.findMany({
                where: { gameId },
                include: {
                  influenceTokens: {
                    where: { gameId },
                  },
                },
              });

              // Filter out NPC player from final placement
              const players = playersRaw.filter(p => p.name !== 'NPC');

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
                  placementTimeout: new Date(Date.now() + 90000),
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
            // Filter out NPC player when counting players
            const realPlayersNext = updatedGame.players.filter(p => p.name !== 'NPC');
            const playerCount = realPlayersNext.length;
            const implications = getSongImplications(playerCount, undefined, updatedGame.isPOTS, updatedGame.isMultiMap, updatedGame.gameVariant);

            // Convert turn order indices to player IDs
            const convertIndicesToPlayerIds = (indexString: string): string[] => {
              return indexString.split('').map(indexChar => {
                // Handle NPC marker 'X' (should never appear in 3A variant)
                if (indexChar === 'X' || indexChar === 'x') {
                  console.error(`ERROR: 'X' character found in turn order for gameVariant: ${updatedGame.gameVariant}, playerCount: ${playerCount}`);
                  throw new Error(`NPC marker 'X' found in turn order but not expected for this game configuration`);
                }
                const index = parseInt(indexChar, 10);
                if (isNaN(index) || index < 0 || index >= realPlayersNext.length) {
                  console.error(`ERROR: Invalid index '${indexChar}' in turn order. playerCount: ${playerCount}, realPlayers: ${realPlayersNext.length}`);
                  throw new Error(`Invalid player index in turn order: ${indexChar}`);
                }
                return realPlayersNext[index].id;
              });
            };

            // Generate highlighted edges for the next round
            // MULTI-MAP MODE: Only get tokens from current map to avoid edge ID conflicts
            const nextRound = updatedGame.roundNumber + 1;
            let tokenWhereClause: any = { gameId };
            if (updatedGame.isMultiMap) {
              const realPlayers = updatedGame.players.filter(p => p.name !== 'NPC');
              const playerCount = realPlayers.length;
              const roundsPerMap = getRoundsPerMap(playerCount, updatedGame.gameVariant);

              if (updatedGame.currentMapNumber === 1) {
                tokenWhereClause = { gameId, roundNumber: { lte: roundsPerMap } };
              } else if (updatedGame.currentMapNumber === 2) {
                tokenWhereClause = { gameId, roundNumber: { gte: roundsPerMap + 1 } };
              }
            }
            const existingTokens = await prisma.influenceToken.findMany({
              where: tokenWhereClause,
              select: { edgeId: true },
            });
            // Use tokensPerRound from implications (correct for all player counts)
            let tokensPerRound = implications.tokensPerRound;

            // MULTI-MAP MODE: For final rounds of each map, highlight extra edges for NPCs (skip for 3A, 3B, 4B, 5B, 6A, and 6B variants)
            // Song implications still show the same number of tokens (3 or 4)
            if (updatedGame.isMultiMap && updatedGame.gameVariant !== "3A" && updatedGame.gameVariant !== "3B" && updatedGame.gameVariant !== "4B" && updatedGame.gameVariant !== "5B" && updatedGame.gameVariant !== "6A" && updatedGame.gameVariant !== "6B") {
              const realPlayers = updatedGame.players.filter(p => p.name !== 'NPC');
              const playerCount = realPlayers.length;
              const roundsPerMap = getRoundsPerMap(playerCount, updatedGame.gameVariant);

              console.log(`🔍 Multi-Map Highlighted Edges Check (RESULTS path):`, {
                currentRound: updatedGame.roundNumber,
                nextRound,
                playerCount,
                roundsPerMap,
                currentMapNumber: updatedGame.currentMapNumber,
                shouldAddNPC: nextRound === roundsPerMap || nextRound === roundsPerMap * 2,
                tokensPerRoundBefore: tokensPerRound
              });

              if (playerCount !== 4 && playerCount !== 5 && (nextRound === roundsPerMap || nextRound === roundsPerMap * 2)) {
                const npcTokenCount = playerCount === 3 ? 3
                                     : playerCount === 4 ? 0  // 4-player: no NPC
                                     : playerCount === 5 ? 0  // 5-player: no NPC
                                     : 4; // 6-player
                tokensPerRound = tokensPerRound + npcTokenCount;
                console.log(`✅ Adding ${npcTokenCount} NPC tokens. Total highlighted edges: ${tokensPerRound}`);
              }
            }

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

        // For Multi-Map mode, only count tokens from current map
        let tokenCountWhereAdv: any = { gameId };
        if (game.isMultiMap) {
          const realPlayers = game.players.filter(p => p.name !== 'NPC');
          const roundsPerMap = getRoundsPerMap(realPlayers.length, game.gameVariant);

          if (game.currentMapNumber === 1) {
            tokenCountWhereAdv = { gameId, roundNumber: { lte: roundsPerMap } };
          } else if (game.currentMapNumber === 2) {
            tokenCountWhereAdv = { gameId, roundNumber: { gte: roundsPerMap + 1 } };
          }
        }

        const placedTokens = await prisma.influenceToken.count({
          where: tokenCountWhereAdv,
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
          const playersRaw2 = await prisma.player.findMany({
            where: { gameId },
            include: {
              influenceTokens: {
                where: { gameId },
              },
            },
          });

          // Filter out NPC player from final placement
          const players = playersRaw2.filter(p => p.name !== 'NPC');

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
              placementTimeout: new Date(Date.now() + 90000),
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

        // MULTI-MAP MODE: Check if we just completed first map or second map (from TOKEN_PLACEMENT path)
        // This handles the completeTokenPlacement → nextRound fall-through for 3A and 4-player
        if (game.isMultiMap && placedTokens >= totalVertices) {
          const realPlayersMap = game.players.filter(p => p.name !== 'NPC');
          const playerCount = realPlayersMap.length;
          const roundsPerMap = getRoundsPerMap(playerCount, game.gameVariant);

          if (game.roundNumber === roundsPerMap) {
            // First map just completed - transition to FIRST_MAP_COMPLETED
            const allTokensRaw = await prisma.influenceToken.findMany({
              where: { gameId },
              include: { player: true },
            });
            const allPlayers = await prisma.player.findMany({
              where: { gameId },
            });

            // Map tokens to expected format
            const allTokens = allTokensRaw.map(t => ({
              id: t.id,
              edgeId: t.edgeId,
              playerId: t.playerId,
              playerName: t.player.name,
              playerColor: t.player.playerColor,
              tokenType: t.tokenType as "4/0" | "2/2" | "1/3",
              orientation: t.orientation as "A" | "B",
              roundNumber: t.roundNumber,
            }));

            const players = allPlayers
              .filter(p => p.name !== 'NPC')
              .map(p => ({
                id: p.id,
                name: p.name,
                color: p.playerColor || '#888888'
              }));

            const symbolsCollected = calculateSymbolsCollected(allTokens, mapLayout, players);

            await prisma.game.update({
              where: { id: gameId },
              data: {
                status: 'FIRST_MAP_COMPLETED',
                firstMapResults: JSON.stringify(symbolsCollected),
                firstMapLayout: game.mapLayout,
              },
            });

            return NextResponse.json({
              success: true,
              firstMapCompleted: true,
              symbolsCollected,
            });
          } else if (game.roundNumber === roundsPerMap * 2) {
            // Second map completed - game finished
            await prisma.game.update({
              where: { id: gameId },
              data: { status: 'FINISHED' },
            });

            return NextResponse.json({
              success: true,
              gameFinished: true,
            });
          }
        }

        // GENERAL COMPLETION CHECK: For non-Multi-Map games, if map is complete, go to FINISHED
        if (!game.isMultiMap && placedTokens >= totalVertices) {
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
        // Filter out NPC player when counting players
        const realPlayersRound = game.players.filter(p => p.name !== 'NPC');
        const playerCount = realPlayersRound.length;
        const implications = getSongImplications(playerCount, undefined, game.isPOTS, game.isMultiMap, game.gameVariant);

        // Convert turn order indices to player IDs
        const convertIndicesToPlayerIds = (indexString: string): string[] => {
          return indexString.split('').map(indexChar => {
            // Handle NPC marker 'X' (should never appear in 3A variant or 4-player games)
            if (indexChar === 'X' || indexChar === 'x') {
              console.error(`ERROR: 'X' character found in turn order for gameVariant: ${game.gameVariant}, playerCount: ${playerCount}`);
              throw new Error(`NPC marker 'X' found in turn order but not expected for this game configuration`);
            }
            const index = parseInt(indexChar, 10);
            if (isNaN(index) || index < 0 || index >= realPlayersRound.length) {
              console.error(`ERROR: Invalid index '${indexChar}' in turn order. playerCount: ${playerCount}, realPlayers: ${realPlayersRound.length}`);
              throw new Error(`Invalid player index in turn order: ${indexChar}`);
            }
            return realPlayersRound[index].id;
          });
        };

        // Generate highlighted edges for the next round
        // MULTI-MAP MODE: Only get tokens from current map to avoid edge ID conflicts
        const nextRound = game.roundNumber + 1;
        let tokenWhereClauseRound: any = { gameId };
        if (game.isMultiMap) {
          const realPlayers = game.players.filter(p => p.name !== 'NPC');
          const roundsPerMap = getRoundsPerMap(realPlayers.length, game.gameVariant);

          if (game.currentMapNumber === 1) {
            tokenWhereClauseRound = { gameId, roundNumber: { lte: roundsPerMap } };
          } else if (game.currentMapNumber === 2) {
            tokenWhereClauseRound = { gameId, roundNumber: { gte: roundsPerMap + 1 } };
          }
        }
        const existingTokens = await prisma.influenceToken.findMany({
          where: tokenWhereClauseRound,
          select: { edgeId: true },
        });
        // Use tokensPerRound from implications (correct for all player counts)
        let tokensPerRound = implications.tokensPerRound;

        // MULTI-MAP MODE: For final rounds of each map, highlight extra edges for NPCs (skip for 3A, 3B, 4B, 5B, 6A, and 6B variants)
        // Song implications still show the same number of tokens (3 or 4)
        if (game.isMultiMap && game.gameVariant !== "3A" && game.gameVariant !== "3B" && game.gameVariant !== "4B" && game.gameVariant !== "5B" && game.gameVariant !== "6A" && game.gameVariant !== "6B") {
          const realPlayers = game.players.filter(p => p.name !== 'NPC');
          const playerCount = realPlayers.length;
          const roundsPerMap = getRoundsPerMap(playerCount, game.gameVariant);

          console.log(`🔍 Multi-Map Highlighted Edges Check (TOKEN_PLACEMENT path):`, {
            currentRound: game.roundNumber,
            nextRound,
            playerCount,
            roundsPerMap,
            currentMapNumber: game.currentMapNumber,
            shouldAddNPC: nextRound === roundsPerMap || nextRound === roundsPerMap * 2,
            tokensPerRoundBefore: tokensPerRound
          });

          if (playerCount !== 4 && playerCount !== 5 && (nextRound === roundsPerMap || nextRound === roundsPerMap * 2)) {
            const npcTokenCount = playerCount === 3 ? 3
                                 : playerCount === 4 ? 0  // 4-player: no NPC
                                 : playerCount === 5 ? 0  // 5-player: no NPC
                                 : 4; // 6-player
            tokensPerRound = tokensPerRound + npcTokenCount;
            console.log(`✅ Adding ${npcTokenCount} NPC tokens. Total highlighted edges: ${tokensPerRound}`);
          }
        }

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
