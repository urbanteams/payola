/**
 * Song options in the game
 */
export type Song = "A" | "B" | "C" | "D";

/**
 * Calculate total bids for each song
 */
export function calculateSongTotals(bids: Array<{ song: string; amount: number }>): Record<Song, number> {
  const totals: Record<Song, number> = { A: 0, B: 0, C: 0, D: 0 };

  for (const bid of bids) {
    if (bid.song === "A" || bid.song === "B" || bid.song === "C" || bid.song === "D") {
      totals[bid.song] += bid.amount;
    }
  }

  return totals;
}

/**
 * Check if there's a tie requiring the wheel spinner
 * For 2-song games: 2-way tie between A and B
 * For 3-song games: 3-way tie between A, B, and C
 * For 4-song games (4B variant): ONLY 4-way tie requires wheel (2-way and 3-way ties resolve automatically)
 * For 4-song games (4A variant): 2-way and 4-way ties require wheel (3-way ties resolve automatically)
 * Note: 2-way ties in 4B resolve by second-highest amount winning
 * Note: 2-way ties in 4A require wheel spin between tied songs
 * Note: 3-way ties in all 4-song games resolve by fourth song winning
 * Note: All-zero ties (all players promise/bribe nothing) also require wheel
 */
export function isTieRequiringWheel(totals: Record<Song, number>, availableSongs: Song[], gameVariant?: string | null): boolean {
  // For 2-song games (A and B only)
  if (availableSongs.length === 2) {
    return totals.A === totals.B; // Removed maxTotal > 0 check to include all-zero ties
  }

  // For 3-song games (A, B, and C)
  if (availableSongs.length === 3) {
    return totals.A === totals.B && totals.B === totals.C; // Removed maxTotal > 0 check to include all-zero ties
  }

  // For 4-song games
  if (availableSongs.length === 4) {
    const maxTotal = Math.max(...availableSongs.map(s => totals[s]));
    const topSongs = availableSongs.filter(song => totals[song] === maxTotal);

    if (gameVariant === "4B" || gameVariant === "5B") {
      // 4B/5B variant: Only 4-way ties require wheel
      // 2-way ties resolve by second-highest amount winning
      // 3-way ties resolve by fourth song winning
      return topSongs.length === 4; // Removed maxTotal > 0 check to include all-zero ties
    } else {
      // 4A/5A variant or unspecified: 2-way and 4-way ties require wheel
      // 3-way ties resolve by fourth song winning
      return (topSongs.length === 2 || topSongs.length === 4); // Removed maxTotal > 0 check to include all-zero ties
    }
  }

  return false;
}

/**
 * Check if there's a three-way tie (legacy function for compatibility)
 */
export function isThreeWayTie(totals: Record<Song, number>): boolean {
  return totals.A === totals.B && totals.B === totals.C;
}

/**
 * Get which songs should appear on the wheel spinner
 * For 4A variant with 2-way tie: only the two tied songs (including all-zero ties)
 * For all other cases: all available songs
 */
export function getWheelSongs(totals: Record<Song, number>, availableSongs: Song[], gameVariant?: string | null): Song[] {
  // For 4A variant with 4 songs, check if there's a 2-way tie
  if (gameVariant === "4A" && availableSongs.length === 4) {
    const maxTotal = Math.max(...availableSongs.map(s => totals[s]));
    const topSongs = availableSongs.filter(song => totals[song] === maxTotal);

    // If there's a 2-way tie, wheel spins between those two (including all-zero ties)
    if (topSongs.length === 2) {
      return topSongs;
    }
  }

  // For all other cases, all available songs are on the wheel
  return availableSongs;
}

/**
 * Determine winning song with tie-breaking rules:
 * - If one song has the most, it wins
 * - For 2-song games: If they tie, needs wheel spinner (return null)
 * - For 3-song games: If two songs tie for most, the third song wins
 * - For 4-song games (4B variant) with 2-way tie: song with second-highest amount wins
 * - For 4-song games (4A variant) with 2-way tie: wheel spins between tied songs (return null)
 * - For 4-song games with 3-way tie: the fourth song wins automatically
 * - For 4-song games with 4-way tie: wheel spins between all four (return null)
 * - If all songs tie at 0 (all players promise/bribe nothing), needs wheel spinner (return null)
 */
export function determineWinningSong(totals: Record<Song, number>, forcedWinner?: Song, availableSongs?: Song[], gameVariant?: string | null): Song | null {
  // If a winner is forced (from wheel spin), use it
  if (forcedWinner) {
    return forcedWinner;
  }

  const songs = availableSongs || ["A", "B"];
  const maxTotal = Math.max(...songs.map(s => totals[s]));
  const topSongs = songs.filter((song) => totals[song] === maxTotal);

  if (topSongs.length === 1) {
    // Clear winner
    return topSongs[0];
  } else if (topSongs.length === 2) {
    // Two songs tied for the most
    if (songs.length === 2) {
      // For 2-song games, a tie requires wheel spinner
      return null;
    } else if (songs.length === 3) {
      // For 3-song games, the third song wins
      const thirdSong = songs.find((s) => !topSongs.includes(s));
      return thirdSong!;
    } else if (songs.length === 4) {
      // For 4-song games with 2-way tie:
      // - 4B variant: song with second-highest amount wins
      // - 4A variant: wheel spins between tied songs
      if (gameVariant === "4B" || gameVariant === "5B") {
        const otherSongs = songs.filter((s) => !topSongs.includes(s));
        const secondHighest = Math.max(...otherSongs.map(s => totals[s]));
        const winningSong = otherSongs.find(s => totals[s] === secondHighest);
        return winningSong!;
      } else {
        // 4A/5A variant or unspecified: wheel spins between tied songs
        return null;
      }
    }
  } else if (topSongs.length === 3) {
    // Three songs tied for the most
    if (songs.length === 4) {
      // For 4-song games, the fourth song wins
      const fourthSong = songs.find((s) => !topSongs.includes(s));
      return fourthSong!;
    }
    // For other cases (3-song game with all tied), needs wheel (including all-zero)
    return null;
  } else {
    // All songs tied (4-way tie in 4-song games, or other cases)
    // Needs wheel for both zero and non-zero ties
    return null;
  }

  return null;
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
