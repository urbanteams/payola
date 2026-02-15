import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Store for tracking game state changes
const gameStateCache = new Map<string, { status: string; roundNumber: number; updatedAt: Date }>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { gameId } = await params;

  // Verify user has access to this game
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) {
    return new Response("Game not found", { status: 404 });
  }

  // Check if user is a spectator or player
  const isSpectator = !session.playerId || !game.players.find(p => p.id === session.playerId);

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Poll for game state changes
      const pollInterval = setInterval(async () => {
        try {
          const currentGame = await prisma.game.findUnique({
            where: { id: gameId },
            select: {
              status: true,
              roundNumber: true,
              updatedAt: true,
              winningSong: true,
              currentTurnIndex: true,
            },
          });

          if (!currentGame) {
            controller.close();
            clearInterval(pollInterval);
            return;
          }

          // Check if game state has changed
          const cached = gameStateCache.get(gameId);
          const hasChanged = !cached ||
            cached.status !== currentGame.status ||
            cached.roundNumber !== currentGame.roundNumber ||
            cached.updatedAt.getTime() !== currentGame.updatedAt.getTime();

          if (hasChanged) {
            // Update cache
            gameStateCache.set(gameId, {
              status: currentGame.status,
              roundNumber: currentGame.roundNumber,
              updatedAt: currentGame.updatedAt,
            });

            // Send update event
            const update = {
              type: 'update',
              status: currentGame.status,
              roundNumber: currentGame.roundNumber,
              winningSong: currentGame.winningSong,
              currentTurnIndex: currentGame.currentTurnIndex,
              timestamp: currentGame.updatedAt.toISOString(),
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
          }
        } catch (error) {
          console.error('[SSE] Error polling game state:', error);
          controller.close();
          clearInterval(pollInterval);
        }
      }, 2000); // Poll every 2 seconds

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}
