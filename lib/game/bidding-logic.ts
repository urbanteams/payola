/**
 * Song options in the game
 */
export type Song = "A" | "B" | "C";

/**
 * Calculate total bids for each song
 */
export function calculateSongTotals(bids: Array<{ song: string; amount: number }>): Record<Song, number> {
  const totals: Record<Song, number> = { A: 0, B: 0, C: 0 };

  for (const bid of bids) {
    if (bid.song === "A" || bid.song === "B" || bid.song === "C") {
      totals[bid.song] += bid.amount;
    }
  }

  return totals;
}

/**
 * Determine winning song with tie-breaking rules:
 * - If one song has the most, it wins
 * - If two songs tie for most, the third song wins
 * - If all three tie, random winner
 */
export function determineWinningSong(totals: Record<Song, number>): Song {
  const songs: Song[] = ["A", "B", "C"];
  const maxTotal = Math.max(totals.A, totals.B, totals.C);
  const topSongs = songs.filter((song) => totals[song] === maxTotal);

  if (topSongs.length === 1) {
    // Clear winner
    return topSongs[0];
  } else if (topSongs.length === 2) {
    // Two songs tied - the third song wins
    const thirdSong = songs.find((s) => !topSongs.includes(s));
    return thirdSong!;
  } else {
    // All three tied - random winner
    return songs[Math.floor(Math.random() * 3)];
  }
}

/**
 * Calculate currency deductions for all players
 * Round 1 bidders: Only pay if they bid on the winning song
 * Round 2 bidders: Always pay
 */
export function calculateCurrencyDeductions(
  bids: Array<{
    playerId: string;
    song: string;
    amount: number;
    round: number;
  }>,
  winningSong: Song
): Map<string, number> {
  const deductions = new Map<string, number>();

  for (const bid of bids) {
    const currentDeduction = deductions.get(bid.playerId) || 0;

    if (bid.round === 2) {
      // Round 2: always pay
      deductions.set(bid.playerId, currentDeduction + bid.amount);
    } else if (bid.round === 1 && bid.song === winningSong) {
      // Round 1: only pay if you backed the winner
      deductions.set(bid.playerId, currentDeduction + bid.amount);
    }
    // Round 1 non-winners keep their currency (no deduction)
  }

  return deductions;
}
