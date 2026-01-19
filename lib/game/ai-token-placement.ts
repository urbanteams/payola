/**
 * AI Token Placement Logic
 *
 * Handles automatic token placement for AI players
 */

import { prisma } from '@/lib/prisma';

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

    if (!game || game.status !== 'TOKEN_PLACEMENT') {
      console.log('Game not in token placement phase');
      return false;
    }

    if (!game.highlightedEdges) {
      console.log('No highlighted edges available');
      return false;
    }

    // Get turn order based on winning song
    const getTurnOrder = (): string[] => {
      if (game.winningSong === 'A' && game.turnOrderA) return JSON.parse(game.turnOrderA);
      if (game.winningSong === 'B' && game.turnOrderB) return JSON.parse(game.turnOrderB);
      if (game.winningSong === 'C' && game.turnOrderC) return JSON.parse(game.turnOrderC);
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

    // Check if current player is AI
    if (!currentPlayer || !currentPlayer.isAI) {
      console.log('Current player is not AI:', currentPlayer?.name);
      return false;
    }

    // Get existing tokens to avoid duplicates
    const existingTokens = await prisma.influenceToken.findMany({
      where: {
        gameId,
        roundNumber: game.roundNumber,
      },
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
    if (game.winningSong === 'A' && game.turnOrderA) return JSON.parse(game.turnOrderA);
    if (game.winningSong === 'B' && game.turnOrderB) return JSON.parse(game.turnOrderB);
    if (game.winningSong === 'C' && game.turnOrderC) return JSON.parse(game.turnOrderC);
    return [];
  };

  const turnOrder = getTurnOrder();
  const currentTurnIndex = game.currentTurnIndex ?? 0;

  // All tokens placed if we've gone through the entire turn order
  return currentTurnIndex >= turnOrder.length;
}
