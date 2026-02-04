import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRoomCode, generateSessionToken, createSession } from "@/lib/auth";
import { generateMapLayout, serializeMapLayout } from "@/lib/game/map-generator";
import { getTotalRounds } from "@/lib/game/song-implications";
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
    const { playerName } = body;

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: "Player name is required" },
        { status: 400 }
      );
    }

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingGame = await prisma.game.findUnique({ where: { roomCode } });

    // Ensure unique room code
    while (existingGame) {
      roomCode = generateRoomCode();
      existingGame = await prisma.game.findUnique({ where: { roomCode } });
    }

    // Note: Map layout will be generated when game starts (when we know player count)
    // Map type is determined based on player count and will use B variants by default
    // All games now use Multi-Map mode with card-based bidding
    const game = await prisma.game.create({
      data: {
        roomCode,
        status: "LOBBY",
        roundNumber: 1,
        isMultiMap: true, // All games use Multi-Map mode with B variants
        // gameVariant will be set when game starts (based on player count: 3B, 4B, 5B, or 6B)
        // mapType, mapLayout and totalRounds will be set when game starts
      },
    });

    // Create player with first color (red)
    const sessionToken = generateSessionToken();
    const player = await prisma.player.create({
      data: {
        gameId: game.id,
        name: playerName.trim(),
        sessionToken,
        currencyBalance: 20, // Multi-Map mode starts with $20
        cardInventory: serializeInventory(createInitialInventory()), // All B variants use card-based bidding
        playerColor: PLAYER_COLORS[0], // First player gets first color
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
    console.error("Create game error:", error);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }
}
