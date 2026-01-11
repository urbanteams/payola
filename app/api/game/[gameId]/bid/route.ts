import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await params;
    const body = await request.json();
    const { song, amount } = body;

    // Validate input
    if (!song || !["A", "B", "C"].includes(song)) {
      return NextResponse.json(
        { error: "Invalid song choice" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount < 0 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { error: "Invalid bid amount" },
        { status: 400 }
      );
    }

    // Fetch game and player
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        bids: {
          where: { gameRound: await prisma.game.findUnique({ where: { id: gameId } }).then(g => g?.roundNumber || 1) },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const player = game.players.find(p => p.id === session.playerId);
    if (!player) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    // Check if game is in valid state for bidding
    if (!["LOBBY", "ROUND1", "ROUND2"].includes(game.status)) {
      return NextResponse.json(
        { error: "Game is not accepting bids" },
        { status: 400 }
      );
    }

    // Validate currency balance
    if (amount > player.currencyBalance) {
      return NextResponse.json(
        { error: "Insufficient currency" },
        { status: 400 }
      );
    }

    // Determine which round we're in
    const currentRoundBids = game.bids.filter(b => b.gameRound === game.roundNumber);
    const round1Bids = currentRoundBids.filter(b => b.round === 1);
    const myRound1Bid = round1Bids.find(b => b.playerId === session.playerId);

    let biddingRound = 1;
    if (myRound1Bid && myRound1Bid.amount === 0) {
      biddingRound = 2; // This is a Round 2 bid
    }

    // Check if player already submitted a bid for this round
    const existingBid = currentRoundBids.find(
      b => b.playerId === session.playerId && b.round === biddingRound
    );

    if (existingBid) {
      return NextResponse.json(
        { error: "You have already submitted a bid for this round" },
        { status: 400 }
      );
    }

    // Create bid
    await prisma.bid.create({
      data: {
        gameId: game.id,
        playerId: player.id,
        round: biddingRound,
        gameRound: game.roundNumber,
        song,
        amount,
      },
    });

    // Check if all players have submitted Round 1 bids
    const newRound1Count = round1Bids.length + (biddingRound === 1 ? 1 : 0);
    if (biddingRound === 1 && newRound1Count === game.players.length && game.status === "ROUND1") {
      // All players submitted Round 1, check if we need Round 2
      const allBids = await prisma.bid.findMany({
        where: { gameId: game.id, gameRound: game.roundNumber, round: 1 },
      });

      const zeroBidders = allBids.filter(b => b.amount === 0);

      if (zeroBidders.length > 0) {
        // Move to Round 2
        await prisma.game.update({
          where: { id: game.id },
          data: { status: "ROUND2" },
        });
      } else {
        // No one bid 0, skip to results
        await prisma.game.update({
          where: { id: game.id },
          data: { status: "RESULTS" },
        });
      }
    }

    // Check if all Round 2 bids are in
    if (biddingRound === 2) {
      const allRound1Bids = await prisma.bid.findMany({
        where: { gameId: game.id, gameRound: game.roundNumber, round: 1 },
      });
      const zeroBidders = allRound1Bids.filter(b => b.amount === 0);
      const round2BidsCount = currentRoundBids.filter(b => b.round === 2).length + 1;

      if (round2BidsCount === zeroBidders.length) {
        // All Round 2 bids submitted, move to results
        await prisma.game.update({
          where: { id: game.id },
          data: { status: "RESULTS" },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit bid error:", error);
    return NextResponse.json(
      { error: "Failed to submit bid" },
      { status: 500 }
    );
  }
}
