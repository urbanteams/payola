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
    const { playerName, playerCount: requestedPlayerCount, variant } = body;

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: "Player name is required" },
        { status: 400 }
      );
    }

    // Multi-Map mode supports 3, 4, or 6 players (default 3 for backward compatibility)
    const playerCount = requestedPlayerCount || 3;

    // Validate player count
    if (![3, 4, 5, 6].includes(playerCount)) {
      return NextResponse.json(
        { error: "Multi-Map mode only supports 3, 4, 5, or 6 players" },
        { status: 400 }
      );
    }

    // Validate variant
    const gameVariant = variant || null;
    if (gameVariant && !["3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B"].includes(gameVariant)) {
      return NextResponse.json(
        { error: "Invalid game variant" },
        { status: 400 }
      );
    }

    // 3A and 3B variants are only valid for 3 players
    if ((gameVariant === "3A" || gameVariant === "3B") && playerCount !== 3) {
      return NextResponse.json(
        { error: "3A and 3B variants are only valid for 3-player games" },
        { status: 400 }
      );
    }

    // 4A and 4B variants are only valid for 4 players
    if ((gameVariant === "4A" || gameVariant === "4B") && playerCount !== 4) {
      return NextResponse.json(
        { error: "4A and 4B variants are only valid for 4-player games" },
        { status: 400 }
      );
    }

    // 5A and 5B variants are only valid for 5 players
    if ((gameVariant === "5A" || gameVariant === "5B") && playerCount !== 5) {
      return NextResponse.json(
        { error: "5A and 5B variants are only valid for 5-player games" },
        { status: 400 }
      );
    }

    // 6A and 6B variants are only valid for 6 players
    if ((gameVariant === "6A" || gameVariant === "6B") && playerCount !== 6) {
      return NextResponse.json(
        { error: "6A and 6B variants are only valid for 6-player games" },
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

    // Generate FIRST map with NYC15 (for 3A/3B), NYC18 (3 players), NYC20 (4A/4B/5A), NYC25 (5B), NYC30 (4 players or 6A/6B), or NYC24 (6 players)
    const edgeCount = (gameVariant === "3A" || gameVariant === "3B") ? 15  // 3A/3B variants use NYC15
                    : (gameVariant === "4A" || gameVariant === "4B") ? 20  // 4A/4B variants use NYC20 (4 tokens × 5 rounds = 20)
                    : gameVariant === "5A" ? 20  // 5A variant uses NYC20 (5 tokens × 4 rounds = 20)
                    : gameVariant === "5B" ? 25  // 5B variant uses NYC25 (5 tokens × 5 rounds = 25)
                    : (gameVariant === "6A" || gameVariant === "6B") ? 30  // 6A/6B variants use NYC30 (6 tokens × 5 rounds = 30)
                    : playerCount === 3 ? 18
                    : playerCount === 4 ? 30  // 4-player uses NYC30 (6 tokens × 5 rounds = 30)
                    : playerCount === 5 ? 25  // 5-player uses NYC25 (5 tokens × 5 rounds = 25)
                    : 24; // 6-player standard
    const includeClassicalStars = (playerCount >= 5 && gameVariant !== "5A" && gameVariant !== "5B") || gameVariant === "6B"; // 5+ player modes get Classical Stars (except 5A/5B variants)
    const noMoneyHub = gameVariant === "3B" || gameVariant === "4A" || gameVariant === "4B" || gameVariant === "5A" || gameVariant === "5B" || gameVariant === "6B"; // 3B/4A/4B/5A/5B/6B variants replace Money Hub with Household
    const firstMapLayout = generateMapLayoutWithEdgeCount(edgeCount, includeClassicalStars, noMoneyHub);
    const totalRounds = getTotalRounds(playerCount, false, true, gameVariant); // useMultiMap = true, pass gameVariant

    // Generate turn orders for the first round using Multi-Map patterns
    const implications = getSongImplications(playerCount, undefined, false, true, gameVariant); // useMultiMap = true, pass variant

    // Generate initial highlighted edges for first map (3 tokens per round)
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
        isMultiMap: true, // Enable Multi-Map mode
        gameVariant: gameVariant, // Store variant (e.g., "3A")
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
        cardInventory: (gameVariant === "3B" || gameVariant === "4A" || gameVariant === "4B" || gameVariant === "5A" || gameVariant === "5B" || gameVariant === "6B") ? serializeInventory(createInitialInventory()) : null,
        isAI: false,
        playerColor: PLAYER_COLORS[0], // First player gets first color
      },
    });

    // Create AI players (number depends on player count)
    const aiNames = ["Bailey", "Karthik", "Grace", "Roberto", "Tricks"];
    const aiPlayerCount = playerCount - 1; // All players except human are AI
    const aiPlayers = [];
    for (let i = 0; i < aiPlayerCount; i++) {
      const aiPlayer = await prisma.player.create({
        data: {
          gameId: game.id,
          name: aiNames[i],
          sessionToken: generateSessionToken(), // AI still needs a token but won't use it
          currencyBalance: 20, // Multi-Map mode starts with $20
          cardInventory: (gameVariant === "3B" || gameVariant === "4A" || gameVariant === "4B" || gameVariant === "5A" || gameVariant === "5B" || gameVariant === "6B") ? serializeInventory(createInitialInventory()) : null,
          isAI: true,
          playerColor: PLAYER_COLORS[i + 1], // AI players get subsequent colors
        },
      });
      aiPlayers.push(aiPlayer);
    }

    // Create NPC player for blank tokens in Multi-Map mode
    // Skip for: 3A variant, 3B variant, 6A variant, 6B variant, 4-player (uses NYC30, no NPC needed), 5-player (uses NYC25, no NPC needed)
    let npcPlayer = null;
    if (gameVariant !== "3A" && gameVariant !== "3B" && gameVariant !== "6A" && gameVariant !== "6B" && playerCount !== 4 && playerCount !== 5) {
      npcPlayer = await prisma.player.create({
        data: {
          gameId: game.id,
          name: "NPC",
          sessionToken: generateSessionToken(),
          currencyBalance: 0, // NPC doesn't participate in bidding
          isAI: true,
          playerColor: "#FFFFFF", // White for NPC tokens
        },
      });
    }

    // Now convert turn order indices to player IDs
    const allPlayers = [humanPlayer, ...aiPlayers];
    const convertIndicesToPlayerIds = (indexString: string): string[] => {
      return indexString.split('').map(indexChar => {
        // Map "X" to NPC player ID for 5-player mode
        if (indexChar === 'X' || indexChar === 'x') {
          if (!npcPlayer) {
            throw new Error('NPC player required for this mode');
          }
          return npcPlayer.id;
        }
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
    console.error("Create Multi-Map game error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Failed to create Multi-Map game", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
