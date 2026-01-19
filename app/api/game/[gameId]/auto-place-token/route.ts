import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const TOKEN_TYPES = ['4/0', '2/2', '1/3'] as const;
const ORIENTATIONS = ['A', 'B'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get game and player
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
      },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const player = game.players.find((p) => p.id === session.playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Get current turn and highlighted edges
    if (!game.highlightedEdges) {
      return NextResponse.json(
        { error: 'No highlighted edges available' },
        { status: 400 }
      );
    }

    const highlightedEdges = JSON.parse(game.highlightedEdges);

    // Get existing tokens for this round to avoid duplicates
    const existingTokens = await prisma.influenceToken.findMany({
      where: {
        gameId,
        roundNumber: game.roundNumber,
      },
      select: { edgeId: true },
    });

    const occupiedEdges = new Set(existingTokens.map((t) => t.edgeId));

    // Find available edges
    const availableEdges = highlightedEdges.filter(
      (edge: string) => !occupiedEdges.has(edge)
    );

    if (availableEdges.length === 0) {
      return NextResponse.json(
        { error: 'No available edges for placement' },
        { status: 400 }
      );
    }

    // Select random edge, token type, and orientation
    const randomEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
    const randomTokenType = TOKEN_TYPES[Math.floor(Math.random() * TOKEN_TYPES.length)];
    const randomOrientation = ORIENTATIONS[Math.floor(Math.random() * ORIENTATIONS.length)];

    // Delegate to place-token endpoint
    const placeTokenResponse = await fetch(
      `${request.nextUrl.origin}/api/game/${gameId}/place-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          edgeId: randomEdge,
          tokenType: randomTokenType,
          orientation: randomOrientation,
        }),
      }
    );

    if (!placeTokenResponse.ok) {
      const errorData = await placeTokenResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to auto-place token' },
        { status: placeTokenResponse.status }
      );
    }

    const result = await placeTokenResponse.json();

    return NextResponse.json({
      success: true,
      autoPlaced: true,
      edgeId: randomEdge,
      tokenType: randomTokenType,
      orientation: randomOrientation,
      ...result,
    });
  } catch (error) {
    console.error('Auto-place token error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-place token' },
      { status: 500 }
    );
  }
}
