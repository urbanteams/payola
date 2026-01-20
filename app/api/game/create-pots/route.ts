import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRoomCode, generateSessionToken, createSession } from "@/lib/auth";
import { generateMapLayout, serializeMapLayout } from "@/lib/game/map-generator";
import { getTotalRounds, getSongImplications } from "@/lib/game/song-implications";
import { selectRandomVertices } from "@/lib/game/token-placement-logic";

const PLAYER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFD93D', // Yellow
];

/**
 * Create a new POTS mode game
 * POTS mode features:
 * - 3 players only
 * - Fixed song implications: ABB, BCC, CAA
 * - 3 tokens per round
 * - 10 rounds total
 * - Final placement phase for remaining 6 tokens (based on money)
 */
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

    // POTS mode is always 3 players
    const playerCount = 3;
    const mapLayout = generateMapLayout(playerCount);
    const totalRounds = getTotalRounds(playerCount, true); // usePOTS = true

    // Generate turn orders for POTS mode (fixed implications, no randomization)
    const implications = getSongImplications(playerCount, undefined, true); // usePOTS = true

    // Generate initial highlighted edges (3 for POTS mode)
    const tokensPerRound = 3;
    const highlightedEdges = selectRandomVertices(mapLayout, [], tokensPerRound);

    const game = await prisma.game.create({
      data: {
        roomCode,
        status: "ROUND1", // Start game immediately in Promise Phase
        roundNumber: 1,
        mapType: mapLayout.mapType,
        mapLayout: serializeMapLayout(mapLayout),
        totalRounds,
        isPOTS: true, // Enable POTS mode
        highlightedEdges: JSON.stringify(highlightedEdges),
      },
    });

    // Create human player with first color
    const sessionToken = generateSessionToken();
    const humanPlayer = await prisma.player.create({
      data: {
        gameId: game.id,
        name: playerName.trim(),
        sessionToken,
        currencyBalance: 30,
        isAI: false,
        playerColor: PLAYER_COLORS[0],
      },
    });

    // Create 2 AI players with different colors
    const aiNames = ["AI Bot 1", "AI Bot 2"];
    const aiPlayers = [];
    for (let i = 0; i < aiNames.length; i++) {
      const aiPlayer = await prisma.player.create({
        data: {
          gameId: game.id,
          name: aiNames[i],
          sessionToken: generateSessionToken(),
          currencyBalance: 30,
          isAI: true,
          playerColor: PLAYER_COLORS[i + 1],
        },
      });
      aiPlayers.push(aiPlayer);
    }

    // Convert turn order indices to player IDs
    const allPlayers = [humanPlayer, ...aiPlayers];
    const convertIndicesToPlayerIds = (indexString: string): string[] => {
      return indexString.split('').map(indexChar => {
        const index = parseInt(indexChar, 10);
        return allPlayers[index].id;
      });
    };

    // Update game with actual player IDs in turn orders
    await prisma.game.update({
      where: { id: game.id },
      data: {
        turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
        turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
        turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
      },
    });

    // Create session for human player
    await createSession({
      playerId: humanPlayer.id,
      playerName: humanPlayer.name,
      gameId: game.id,
    });

    return NextResponse.json({
      gameId: game.id,
      roomCode: game.roomCode,
      playerId: humanPlayer.id,
    });
  } catch (error) {
    console.error("Create POTS game error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Failed to create POTS game", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
