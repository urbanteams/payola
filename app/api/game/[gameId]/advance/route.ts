import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSongTotals, determineWinningSong, calculateCurrencyDeductions } from "@/lib/game/bidding-logic";

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
    const { action } = body; // "start" | "nextRound" | "finish"

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        bids: true,
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Verify player is in game
    const player = game.players.find(p => p.id === session.playerId);
    if (!player) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    if (action === "start") {
      // Start game from lobby
      if (game.status !== "LOBBY") {
        return NextResponse.json(
          { error: "Game has already started" },
          { status: 400 }
        );
      }

      if (game.players.length < 3) {
        return NextResponse.json(
          { error: "Need at least 3 players to start" },
          { status: 400 }
        );
      }

      await prisma.game.update({
        where: { id: gameId },
        data: { status: "ROUND1" },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "nextRound") {
      // Calculate results and start next round
      if (game.status !== "RESULTS") {
        return NextResponse.json(
          { error: "Not in results phase" },
          { status: 400 }
        );
      }

      // Get current round bids
      const currentRoundBids = game.bids.filter(b => b.gameRound === game.roundNumber);

      // Calculate winner and deductions
      const songTotals = calculateSongTotals(currentRoundBids);
      const winningSong = determineWinningSong(songTotals);
      const deductions = calculateCurrencyDeductions(currentRoundBids, winningSong);

      // Update player balances
      for (const [playerId, deduction] of deductions.entries()) {
        const currentPlayer = game.players.find(p => p.id === playerId);
        if (currentPlayer) {
          await prisma.player.update({
            where: { id: playerId },
            data: {
              currencyBalance: Math.max(0, currentPlayer.currencyBalance - deduction),
            },
          });
        }
      }

      // Start next round
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "ROUND1",
          roundNumber: game.roundNumber + 1,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "finish") {
      // End the game
      await prisma.game.update({
        where: { id: gameId },
        data: { status: "FINISHED" },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Advance game error:", error);
    return NextResponse.json(
      { error: "Failed to advance game" },
      { status: 500 }
    );
  }
}
