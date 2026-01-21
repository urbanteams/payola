/**
 * AI Token Placement Logic
 *
 * Handles automatic token placement for AI players
 */

import { prisma } from '@/lib/prisma';
import { deserializeMapLayout } from '@/lib/game/map-generator';
import { calculateImmediateReward } from '@/lib/game/token-placement-logic';

const TOKEN_TYPES = ['4/0', '3/1', '2/2'] as const;
const ORIENTATIONS = ['A', 'B'] as const;

/**
 * Place a token for the current AI player and advance turn
 * Returns true if more AI players need to place tokens
 */
export async function processAITokenPlacement(gameId: string): Promise<boolean> {
  try {
    // Get game state
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
      },
    });

    if (!game || (game.status !== 'TOKEN_PLACEMENT' && game.status !== 'FINAL_PLACEMENT')) {
      console.log('Game not in token placement phase, status:', game?.status);
      return false;
    }

    if (!game.highlightedEdges) {
      console.log('No highlighted edges available');
      return false;
    }

    // Get turn order based on status and winning song
    const getTurnOrder = (): string[] => {
      // For FINAL_PLACEMENT, use turnOrderA which stores the money-based turn order
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

    const turnOrder = getTurnOrder();
    const currentTurnIndex = game.currentTurnIndex ?? 0;

    if (currentTurnIndex >= turnOrder.length) {
      console.log('All tokens already placed');
      return false;
    }

    const currentTurnPlayerId = turnOrder[currentTurnIndex];
    const currentPlayer = game.players.find(p => p.id === currentTurnPlayerId);

    console.log(`AI Placement Check - Status: ${game.status}, Turn ${currentTurnIndex + 1}/${turnOrder.length}, Player: ${currentPlayer?.name}, isAI: ${currentPlayer?.isAI}`);

    // Check if current player is AI
    if (!currentPlayer || !currentPlayer.isAI) {
      console.log('Current player is not AI:', currentPlayer?.name);
      return false;
    }

    // Get existing tokens to avoid duplicates
    // For FINAL_PLACEMENT, check all tokens across all rounds
    // For regular rounds, only check tokens from current round
    const existingTokens = await prisma.influenceToken.findMany({
      where: game.status === 'FINAL_PLACEMENT'
        ? { gameId }
        : { gameId, roundNumber: game.roundNumber },
      select: { edgeId: true },
    });

    const highlightedEdges = JSON.parse(game.highlightedEdges);
    const occupiedEdges = new Set(existingTokens.map(t => t.edgeId));
    const availableEdges = highlightedEdges.filter((edge: string) => !occupiedEdges.has(edge));

    if (availableEdges.length === 0) {
      console.error('No available edges for AI placement');
      return false;
    }

    // Select random edge, token type, and orientation
    const randomEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
    const randomTokenType = TOKEN_TYPES[Math.floor(Math.random() * TOKEN_TYPES.length)];
    const randomOrientation = ORIENTATIONS[Math.floor(Math.random() * ORIENTATIONS.length)];

    // Create token
    await prisma.influenceToken.create({
      data: {
        gameId,
        playerId: currentPlayer.id,
        roundNumber: game.roundNumber,
        edgeId: randomEdge,
        tokenType: randomTokenType,
        orientation: randomOrientation,
      },
    });

    console.log(`AI ${currentPlayer.name} placed token ${randomTokenType} (${randomOrientation}) on edge ${randomEdge}`);

    // Calculate and apply immediate rewards (money hub bonuses)
    if (game.mapLayout) {
      const mapLayout = deserializeMapLayout(game.mapLayout);
      const immediateReward = calculateImmediateReward(
        randomEdge,
        randomTokenType,
        randomOrientation,
        mapLayout
      );

      if (immediateReward) {
        if (immediateReward.victoryPoints !== undefined) {
          await prisma.player.update({
            where: { id: currentPlayer.id },
            data: {
              victoryPoints: currentPlayer.victoryPoints + immediateReward.victoryPoints,
            },
          });
        }

        if (immediateReward.currency !== undefined) {
          await prisma.player.update({
            where: { id: currentPlayer.id },
            data: {
              currencyBalance: currentPlayer.currencyBalance + immediateReward.currency,
            },
          });
        }

        console.log(`AI ${currentPlayer.name} received immediate reward:`, immediateReward);
      }
    }

    // Advance turn
    const nextTurnIndex = currentTurnIndex + 1;
    const allTokensPlaced = nextTurnIndex >= turnOrder.length;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        currentTurnIndex: nextTurnIndex,
        placementTimeout: allTokensPlaced ? null : new Date(Date.now() + 60000),
      },
    });

    // Check if next player is also AI
    if (!allTokensPlaced) {
      const nextPlayerId = turnOrder[nextTurnIndex];
      const nextPlayer = game.players.find(p => p.id === nextPlayerId);
      return nextPlayer?.isAI === true;
    }

    return false; // All tokens placed
  } catch (error) {
    console.error('AI token placement error:', error);
    return false;
  }
}

/**
 * Process all consecutive AI token placements
 * Continues until a human player's turn or all tokens are placed
 * Returns true if all tokens for this round have been placed
 */
export async function processAllAITokenPlacements(gameId: string): Promise<boolean> {
  let hasMoreAI = true;
  let attempts = 0;
  const maxAttempts = 20; // Safety limit

  while (hasMoreAI && attempts < maxAttempts) {
    hasMoreAI = await processAITokenPlacement(gameId);
    attempts++;

    // Small delay to avoid overwhelming the database
    if (hasMoreAI) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  if (attempts >= maxAttempts) {
    console.error('Max AI token placement attempts reached - possible infinite loop');
  }

  // Check if all tokens are now placed
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) return false;

  const getTurnOrder = (): string[] => {
    // For FINAL_PLACEMENT, use turnOrderA which stores the money-based turn order
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

  const turnOrder = getTurnOrder();
  const currentTurnIndex = game.currentTurnIndex ?? 0;

  // All tokens placed if we've gone through the entire turn order
  return currentTurnIndex >= turnOrder.length;
}
