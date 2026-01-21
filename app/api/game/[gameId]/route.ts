import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await params;

    // Fetch game with all related data
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { createdAt: "asc" },
        },
        bids: {
          where: { gameRound: await prisma.game.findUnique({ where: { id: gameId } }).then(g => g?.roundNumber || 1) },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Verify player is in this game
    const currentPlayer = game.players.find(p => p.id === session.playerId);
    if (!currentPlayer) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    // Get current round bids
    const currentRoundBids = game.bids.filter(b => b.gameRound === game.roundNumber);
    const myBid = currentRoundBids.find(b => b.playerId === session.playerId);

    // Determine which round we're in
    const round1Bids = currentRoundBids.filter(b => b.round === 1);
    const round2Bids = currentRoundBids.filter(b => b.round === 2);
    const allPlayersSubmittedRound1 = game.players.length > 0 && round1Bids.length === game.players.length;

    // Check if player needs to submit Round 2 bid
    // Only show Bribe Phase interface after ALL Promise Phase bids are submitted
    const myRound1Bid = round1Bids.find(b => b.playerId === session.playerId);
    const needsRound2Bid = allPlayersSubmittedRound1 && myRound1Bid?.amount === 0 && !round2Bids.find(b => b.playerId === session.playerId);

    // Fetch all tokens for any state where map is shown
    const tokens = await prisma.influenceToken.findMany({
      where: { gameId },
      include: { player: { select: { name: true, playerColor: true } } },
    });

    return NextResponse.json({
      game: {
        id: game.id,
        roomCode: game.roomCode,
        status: game.status,
        roundNumber: game.roundNumber,
        winningSong: game.winningSong,
        isPOTS: game.isPOTS,
        turnOrderA: game.turnOrderA ? JSON.parse(game.turnOrderA) : null,
        turnOrderB: game.turnOrderB ? JSON.parse(game.turnOrderB) : null,
        turnOrderC: game.turnOrderC ? JSON.parse(game.turnOrderC) : null,
        turnOrderD: game.turnOrderD ? JSON.parse(game.turnOrderD) : null,
        mapType: game.mapType,
        mapLayout: game.mapLayout,
        highlightedEdges: game.highlightedEdges,
        currentTurnIndex: game.currentTurnIndex,
        placementTimeout: game.placementTimeout,
      },
      players: game.players.map(p => ({
        id: p.id,
        name: p.name,
        currencyBalance: p.currencyBalance, // Show all players' balances
        victoryPoints: p.victoryPoints,
        playerColor: p.playerColor,
        isMe: p.id === session.playerId,
      })),
      tokens: tokens.map(t => ({
        id: t.id,
        edgeId: t.edgeId,
        playerId: t.playerId,
        playerName: t.player.name,
        playerColor: t.player.playerColor,
        tokenType: t.tokenType,
        orientation: t.orientation,
        roundNumber: t.roundNumber,
      })),
      currentBid: (myBid && !needsRound2Bid) ? {
        song: myBid.song,
        amount: myBid.amount,
        round: myBid.round,
      } : null,
      biddingState: {
        allPlayersSubmittedRound1,
        needsRound2Bid,
        waitingForRound2: allPlayersSubmittedRound1 && !needsRound2Bid && round2Bids.length < round1Bids.filter(b => b.amount === 0).length,
      },
      // Show Promise Phase (round 1) bids during Bribe Phase (ROUND2 status)
      promisePhaseBids: (game.status === "ROUND2" || game.status === "RESULTS") ? round1Bids.map(b => ({
        playerId: b.playerId,
        playerName: game.players.find(p => p.id === b.playerId)?.name,
        song: b.song,
        amount: b.amount,
        round: b.round,
      })) : null,
      // Only show all bids when in RESULTS state
      allBids: game.status === "RESULTS" ? currentRoundBids.map(b => ({
        playerId: b.playerId,
        playerName: game.players.find(p => p.id === b.playerId)?.name,
        song: b.song,
        amount: b.amount,
        round: b.round,
      })) : null,
    });
  } catch (error) {
    console.error("Get game state error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
