import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRoomCode, generateSessionToken, createSession } from "@/lib/auth";
import { generateMapLayout, serializeMapLayout } from "@/lib/game/map-generator";
import { getTotalRounds } from "@/lib/game/song-implications";

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
    // Map type (NYC36 vs NYC48) is determined automatically based on player count
    // All games now use POTS mechanics (fixed song patterns with randomized player assignments)
    const game = await prisma.game.create({
      data: {
        roomCode,
        status: "LOBBY",
        roundNumber: 1,
        isPOTS: true, // All games use POTS mechanics now (human players only)
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
        currencyBalance: 30,
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
