import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRoomCode, generateSessionToken, createSession } from "@/lib/auth";
import { generateMapLayoutWithEdgeCount, serializeMapLayout } from "@/lib/game/map-generator";
import { getTotalRounds, getSongImplications } from "@/lib/game/song-implications";
import { selectRandomVertices } from "@/lib/game/token-placement-logic";
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
    const { playerName, playerCount = 3, gameVariant } = body;

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: "Player name is required" },
        { status: 400 }
      );
    }

    if (typeof playerCount !== "number" || playerCount < 3 || playerCount > 6) {
      return NextResponse.json(
        { error: "Player count must be between 3 and 6" },
        { status: 400 }
      );
    }

    // Use provided gameVariant, or automatically select B variant based on player count
    const selectedVariant = gameVariant || (
      playerCount === 3 ? "3B"
      : playerCount === 4 ? "4B"
      : playerCount === 5 ? "5B"
      : "6B" // 6 players
    );

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingGame = await prisma.game.findUnique({ where: { roomCode } });

    // Ensure unique room code
    while (existingGame) {
      roomCode = generateRoomCode();
      existingGame = await prisma.game.findUnique({ where: { roomCode } });
    }

    // Generate FIRST map with appropriate edge count for variants
    const edgeCount = selectedVariant === "3B" ? 15  // 3B variant uses NYC15
                    : (selectedVariant === "4A" || selectedVariant === "4B") ? 20  // 4A/4B variants use NYC20 (4 tokens × 5 rounds = 20)
                    : selectedVariant === "5A" ? 20  // 5A variant uses NYC20 (5 tokens × 4 rounds = 20)
                    : selectedVariant === "5B" ? 25  // 5B variant uses NYC25 (5 tokens × 5 rounds = 25)
                    : 30; // 6B variant uses NYC30 (6 tokens × 5 rounds = 30)
    const includeClassicalStars = selectedVariant === "6B"; // Only 6B gets Classical Stars
    const noMoneyHub = true; // All variants replace Money Hub with Household
    const firstMapLayout = generateMapLayoutWithEdgeCount(edgeCount, includeClassicalStars, noMoneyHub);
    const totalRounds = getTotalRounds(playerCount, false, true, selectedVariant); // useMultiMap = true, pass selectedVariant

    // Generate turn orders for the first round using Multi-Map patterns
    const implications = getSongImplications(playerCount, undefined, false, true, selectedVariant); // useMultiMap = true, pass variant

    // Generate initial highlighted edges for first map
    const tokensPerRound = implications.tokensPerRound;
    const highlightedEdges = selectRandomVertices(firstMapLayout, [], tokensPerRound);

    const game = await prisma.game.create({
      data: {
        roomCode,
        status: "ROUND1", // Start game immediately in Promise Phase for AI mode
        roundNumber: 1,
        mapType: firstMapLayout.mapType,
        mapLayout: serializeMapLayout(firstMapLayout),
        totalRounds,
        isPOTS: false, // Not using POTS mode
        isMultiMap: true, // Enable Multi-Map mode
        gameVariant: selectedVariant, // Store variant (3B, 4A, 4B, 5B, or 6B)
        currentMapNumber: 1, // Starting with first map
        firstMapLayout: serializeMapLayout(firstMapLayout), // Store first map separately
        highlightedEdges: JSON.stringify(highlightedEdges), // Store for later use
        // Turn orders will be set after players are created
      },
    });

    // Create human player with first color
    const sessionToken = generateSessionToken();
    const humanPlayer = await prisma.player.create({
      data: {
        gameId: game.id,
        name: playerName.trim(),
        sessionToken,
        currencyBalance: 20, // Multi-Map mode starts with $20
        cardInventory: serializeInventory(createInitialInventory()), // All B variants use card-based bidding
        isAI: false,
        playerColor: PLAYER_COLORS[0], // First player gets first color
      },
    });

    // Create AI players (playerCount - 1 bots)
    const aiCount = playerCount - 1;
    const aiNames = ["Bailey", "Karthik", "Grace", "Roberto", "Tricks"];
    const aiPlayers = [];
    for (let i = 0; i < aiCount; i++) {
      const aiPlayer = await prisma.player.create({
        data: {
          gameId: game.id,
          name: aiNames[i],
          sessionToken: generateSessionToken(), // AI still needs a token but won't use it
          currencyBalance: 20, // Multi-Map mode starts with $20
          cardInventory: serializeInventory(createInitialInventory()), // All B variants use card-based bidding
          isAI: true,
          playerColor: PLAYER_COLORS[i + 1], // AI players get subsequent colors
        },
      });
      aiPlayers.push(aiPlayer);
    }

    // Now convert turn order indices to player IDs
    const allPlayers = [humanPlayer, ...aiPlayers];
    const convertIndicesToPlayerIds = (indexString: string): string[] => {
      return indexString.split('').map(indexChar => {
        const index = parseInt(indexChar, 10);
        return allPlayers[index].id;
      });
    };

    // Update game with actual player IDs in turn orders (stored as JSON strings)
    await prisma.game.update({
      where: { id: game.id },
      data: {
        turnOrderA: JSON.stringify(convertIndicesToPlayerIds(implications.songA)),
        turnOrderB: JSON.stringify(convertIndicesToPlayerIds(implications.songB)),
        turnOrderC: implications.songC ? JSON.stringify(convertIndicesToPlayerIds(implications.songC)) : null,
        turnOrderD: implications.songD ? JSON.stringify(convertIndicesToPlayerIds(implications.songD)) : null,
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
    console.error("Create AI game error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Failed to create AI game", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
