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

    // Verify game is in TOKEN_PLACEMENT status
    if (game.status !== 'TOKEN_PLACEMENT') {
      return NextResponse.json(
        { error: 'Not in token placement phase' },
        { status: 400 }
      );
    }

    if (!game.mapLayout || !game.winningSong || !game.highlightedEdges) {
      return NextResponse.json(
        { error: 'Missing map, winning song, or highlighted edges data' },
        { status: 500 }
      );
    }

    // Deserialize map layout
    const mapLayout = deserializeMapLayout(game.mapLayout);

    // Get turn order from stored game data (already randomized and stored as player IDs)
    const getTurnOrder = (): string[] => {
      if (game.winningSong === 'A' && game.turnOrderA) return JSON.parse(game.turnOrderA);
      if (game.winningSong === 'B' && game.turnOrderB) return JSON.parse(game.turnOrderB);
      if (game.winningSong === 'C' && game.turnOrderC) return JSON.parse(game.turnOrderC);
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
    const highlightedEdges = JSON.parse(game.highlightedEdges);

    // Validate placement
    const existingTokens = game.influenceTokens.map((t) => ({
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
          : new Date(Date.now() + 60000), // Reset timeout for next player (60s)
      },
    });

    // If all tokens placed, auto-advance to next round
    if (allTokensPlaced) {
      // Clear token placement data and advance to next round
      await prisma.game.update({
        where: { id: gameId },
        data: {
          highlightedEdges: null,
          currentTurnIndex: null,
          placementTimeout: null,
        },
      });

      // Check if map is complete (all edges filled)
      const mapLayout = deserializeMapLayout(game.mapLayout!);
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
      } else {
        // Start next round
        const implications = await import('@/lib/game/song-implications').then(m => m.getSongImplications(game.players.length));
        const { getTokensPerRound } = await import('@/lib/game/song-implications');
        const { selectRandomVertices } = await import('@/lib/game/token-placement-logic');

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
        const tokensPerRound = getTokensPerRound(game.players.length);
        const highlightedEdges = selectRandomVertices(mapLayout, existingTokens, tokensPerRound);

        await prisma.game.update({
          where: { id: gameId },
          data: {
            status: 'ROUND1',
            roundNumber: game.roundNumber + 1,
            winningSong: null,
            turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
            turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
            turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
            highlightedEdges: JSON.stringify(highlightedEdges),
          },
        });
      }
    } else {
      // Process AI token placements if next player is AI
      const nextPlayerTurn = turnOrder[nextTurnIndex];
      const nextPlayer = game.players.find(p => p.id === nextPlayerTurn.playerId);

      if (nextPlayer?.isAI) {
        try {
          // Await AI token placements to ensure they complete
          const allTokensPlaced = await processAllAITokenPlacements(gameId);
          console.log('AI token placements completed, all tokens placed:', allTokensPlaced);

          // If all tokens placed after AI turns, advance to next round
          if (allTokensPlaced) {
            console.log('All tokens placed, advancing to next round');

            // Clear token placement data
            await prisma.game.update({
              where: { id: gameId },
              data: {
                highlightedEdges: null,
                currentTurnIndex: null,
                placementTimeout: null,
              },
            });

            // Check if map is complete
            const mapLayout = deserializeMapLayout(game.mapLayout!);
            const totalEdges = mapLayout.edges.length;
            const placedTokens = await prisma.influenceToken.count({
              where: { gameId },
            });

            if (placedTokens >= totalEdges) {
              await prisma.game.update({
                where: { id: gameId },
                data: { status: 'FINISHED' },
              });
            } else {
              const implications = await import('@/lib/game/song-implications').then(m => m.getSongImplications(game.players.length));
              const { getTokensPerRound } = await import('@/lib/game/song-implications');
              const { selectRandomVertices } = await import('@/lib/game/token-placement-logic');

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
              const tokensPerRound = getTokensPerRound(game.players.length);
              const highlightedEdges = selectRandomVertices(mapLayout, existingTokens, tokensPerRound);

              await prisma.game.update({
                where: { id: gameId },
                data: {
                  status: 'ROUND1',
                  roundNumber: game.roundNumber + 1,
                  winningSong: null,
                  turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
                  turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
                  turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
                  highlightedEdges: JSON.stringify(highlightedEdges),
                },
              });
            }
          }
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
