import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processAIBids } from "@/lib/game/ai-bidding";
import { calculateSongTotals, determineWinningSong, calculateCurrencyDeductions, Song } from "@/lib/game/bidding-logic";

// Helper function to determine available songs based on game turn orders
function getAvailableSongs(game: { turnOrderA: string | null; turnOrderB: string | null; turnOrderC: string | null; turnOrderD?: string | null }): Song[] {
  const songs: Song[] = [];
  if (game.turnOrderA) songs.push("A");
  if (game.turnOrderB) songs.push("B");
  if (game.turnOrderC) songs.push("C");
  if (game.turnOrderD) songs.push("D");
  return songs;
}

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

    // Fetch game
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

    // Process AI bids
    await processAIBids(gameId);

    // Re-fetch game to check if round should advance
    const updatedGame = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        bids: {
          where: { gameRound: game.roundNumber },
        },
      },
    });

    if (!updatedGame) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const currentRoundBids = updatedGame.bids.filter(b => b.gameRound === updatedGame.roundNumber);
    const round1Bids = currentRoundBids.filter(b => b.round === 1);

    // Check if all players have submitted Round 1 bids
    if (updatedGame.status === "ROUND1" && round1Bids.length === updatedGame.players.length) {
      const zeroBidders = round1Bids.filter(b => b.amount === 0);

      if (zeroBidders.length > 0) {
        // Move to Round 2
        await prisma.game.update({
          where: { id: gameId },
          data: { status: "ROUND2" },
        });

        // Recursively process Round 2 AI bids
        await processAIBids(gameId);

        // Check again if Round 2 is complete
        const finalGame = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            players: true,
            bids: { where: { gameRound: updatedGame.roundNumber } },
          },
        });

        if (finalGame) {
          const round2Bids = finalGame.bids.filter(b => b.round === 2);
          const round1ZeroBidders = finalGame.bids.filter(b => b.round === 1 && b.amount === 0);

          if (round2Bids.length === round1ZeroBidders.length) {
            // All Round 2 bids submitted, calculate results
            const allBids = finalGame.bids;
            const songTotals = calculateSongTotals(allBids);
            const availableSongs = getAvailableSongs(finalGame);
            let winningSong = determineWinningSong(songTotals, undefined, availableSongs);

            // If tie (null), randomly select from tied songs
            if (winningSong === null) {
              const maxTotal = Math.max(...availableSongs.map((s: Song) => songTotals[s]));
              const tiedSongs = availableSongs.filter((s: Song) => songTotals[s] === maxTotal);
              winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
            }

            const deductions = calculateCurrencyDeductions(allBids, winningSong);

            // Update player balances
            for (const [playerId, deduction] of deductions.entries()) {
              const player = finalGame.players.find(p => p.id === playerId);
              if (player) {
                await prisma.player.update({
                  where: { id: playerId },
                  data: {
                    currencyBalance: Math.max(0, player.currencyBalance - deduction),
                  },
                });
              }
            }

            await prisma.game.update({
              where: { id: gameId },
              data: {
                status: "RESULTS",
                winningSong: winningSong
              },
            });
          }
        }
      } else {
        // No one bid 0, skip to results
        const songTotals = calculateSongTotals(round1Bids);
        const availableSongs = getAvailableSongs(updatedGame);
        let winningSong = determineWinningSong(songTotals, undefined, availableSongs);

        // If tie (null), randomly select from tied songs
        if (winningSong === null) {
          const maxTotal = Math.max(...availableSongs.map((s: Song) => songTotals[s]));
          const tiedSongs = availableSongs.filter((s: Song) => songTotals[s] === maxTotal);
          winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
        }

        const deductions = calculateCurrencyDeductions(round1Bids, winningSong);

        // Update player balances
        for (const [playerId, deduction] of deductions.entries()) {
          const player = updatedGame.players.find(p => p.id === playerId);
          if (player) {
            await prisma.player.update({
              where: { id: playerId },
              data: {
                currencyBalance: Math.max(0, player.currencyBalance - deduction),
              },
            });
          }
        }

        await prisma.game.update({
          where: { id: gameId },
          data: {
            status: "RESULTS",
            winningSong: winningSong
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("AI bid processing error:", error);
    return NextResponse.json(
      { error: "Failed to process AI bids" },
      { status: 500 }
    );
  }
}
