import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSessionToken, createSession } from "@/lib/auth";
import { createInitialInventory, serializeInventory } from "@/lib/game/card-inventory";

const PLAYER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFD93D', // Yellow
  '#6C5CE7', // Purple
  '#00D2FF', // Cyan
  '#FF8C42', // Orange
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomCode, playerName } = body;

    if (!roomCode || typeof roomCode !== "string") {
      return NextResponse.json(
        { error: "Room code is required" },
        { status: 400 }
      );
    }

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: "Player name is required" },
        { status: 400 }
      );
    }

    // Find game
    const game = await prisma.game.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: { players: true },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    // If game is in progress or finished (not LOBBY), join as spectator
    if (game.status !== "LOBBY") {
      // For FINISHED games, only allow spectators if game ended recently (within 1 hour)
      if (game.status === "FINISHED") {
        const ONE_HOUR_MS = 60 * 60 * 1000;
        const gameEndTime = new Date(game.updatedAt).getTime();
        const now = Date.now();

        if (now - gameEndTime > ONE_HOUR_MS) {
          return NextResponse.json(
            { error: "This game ended more than 1 hour ago and is no longer available for viewing" },
            { status: 400 }
          );
        }
      }

      // Create spectator session (no player record)
      await createSession({
        playerId: null,
        playerName: playerName.trim() + " (Spectator)",
        gameId: game.id,
        isSpectator: true,
      });

      return NextResponse.json({
        gameId: game.id,
        roomCode: game.roomCode,
        isSpectator: true,
      });
    }

    // Assign player color based on join order
    const existingPlayerCount = game.players.length;
    const playerColor = PLAYER_COLORS[existingPlayerCount % PLAYER_COLORS.length];

    // Create player
    const sessionToken = generateSessionToken();
    const player = await prisma.player.create({
      data: {
        gameId: game.id,
        name: playerName.trim(),
        sessionToken,
        currencyBalance: 20, // Multi-Map mode starts with $20
        cardInventory: serializeInventory(createInitialInventory()), // All B variants use card-based bidding
        playerColor,
      },
    });

    // Create session
    await createSession({
      playerId: player.id,
      playerName: player.name,
      gameId: game.id,
    });

    return NextResponse.json({
      gameId: game.id,
      roomCode: game.roomCode,
      playerId: player.id,
    });
  } catch (error) {
    console.error("Join game error:", error);
    return NextResponse.json(
      { error: "Failed to join game" },
      { status: 500 }
    );
  }
}
