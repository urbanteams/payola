import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TOKEN_TYPES = ['4/0', '2/2', '1/3'] as const;
const ORIENTATIONS = ['A', 'B'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    // Get game state
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
      },
    });

    if (!game || game.status !== 'TOKEN_PLACEMENT') {
      return NextResponse.json({ success: true, message: 'Not in token placement phase' });
    }

    if (!game.highlightedEdges) {
      return NextResponse.json({ success: true, message: 'No highlighted edges' });
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
      return NextResponse.json({ success: true, message: 'All tokens placed' });
    }

    const currentTurnPlayerId = turnOrder[currentTurnIndex];
    const currentPlayer = game.players.find(p => p.id === currentTurnPlayerId);

    // Check if current player is AI or NPC
    const isNPCPlayer = currentPlayer?.name === 'NPC';
    if (!currentPlayer || (!currentPlayer.isAI && !isNPCPlayer)) {
      return NextResponse.json({ success: true, message: 'Current player is not AI or NPC' });
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
      return NextResponse.json(
        { error: 'No available edges for AI placement' },
        { status: 400 }
      );
    }

    // Select random edge, token type, and orientation
    const randomEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
    // For NPC players, always use blank (0/0) tokens
    const randomTokenType = isNPCPlayer ? '0/0' : TOKEN_TYPES[Math.floor(Math.random() * TOKEN_TYPES.length)];
    const randomOrientation = isNPCPlayer ? 'A' : ORIENTATIONS[Math.floor(Math.random() * ORIENTATIONS.length)];

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

    // Advance turn
    const nextTurnIndex = currentTurnIndex + 1;
    const allTokensPlaced = nextTurnIndex >= turnOrder.length;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        currentTurnIndex: nextTurnIndex,
        placementTimeout: allTokensPlaced ? null : new Date(Date.now() + 90000),
      },
    });

    // If all tokens placed, advance game
    if (allTokensPlaced) {
      await fetch(`${request.nextUrl.origin}/api/game/${gameId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeTokenPlacement' }),
      });
    } else {
      // Check if next player is also AI and recursively place their token
      const nextPlayerId = turnOrder[nextTurnIndex];
      const nextPlayer = game.players.find(p => p.id === nextPlayerId);

      if (nextPlayer?.isAI) {
        // Small delay to avoid overwhelming the server
        setTimeout(() => {
          fetch(`${request.nextUrl.origin}/api/game/${gameId}/ai-token-placement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch(err => console.error('Failed to trigger next AI token placement:', err));
        }, 500);
      }
    }

    return NextResponse.json({
      success: true,
      aiPlaced: true,
      edgeId: randomEdge,
      tokenType: randomTokenType,
      orientation: randomOrientation,
    });
  } catch (error) {
    console.error('AI token placement error:', error);
    return NextResponse.json(
      { error: 'Failed to place AI token' },
      { status: 500 }
    );
  }
}
