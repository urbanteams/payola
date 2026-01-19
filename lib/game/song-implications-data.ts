/**
 * Song Implications Data (Reference File)
 *
 * This file contains the actual turn order patterns for all player counts
 * Letters (A, B, C, D, E, F) represent arbitrary player positions that are
 * randomized at the start of each round
 *
 * Example: "ABCCBA" means Player A, Player B, Player C (2x), Player B, Player A
 * In an actual game round, this could be randomized to any permutation of players
 * that follows this structure (e.g., Devon/Grace/John/John/Grace/Devon)
 */

export interface SongImplicationPattern {
  songA: string;
  songB: string;
  songC?: string;
  tokensPerRound: number;
  totalRounds: number;
}

/**
 * Song implication patterns by player count
 */
export const SONG_IMPLICATION_PATTERNS: Record<number, SongImplicationPattern> = {
  /**
   * 3-PLAYER GAME
   * - Song A = ABABAC (6 tokens per round)
   * - Song B = BCCCBA (6 tokens per round)
   * - No Song C
   * - Players: A, B, C
   */
  3: {
    songA: 'ABABAC',
    songB: 'BCCCBA',
    tokensPerRound: 6,
    totalRounds: 6, // Estimated based on map size
  },

  /**
   * 4-PLAYER GAME
   * - Song A = ABCDBA (6 tokens per round)
   * - Song B = DCBACD (6 tokens per round)
   * - 6 rounds total (6 rounds × 6 tokens = 36 tokens total)
   * - Players: A, B, C, D
   */
  4: {
    songA: 'ABCDBA',
    songB: 'DCBACD',
    tokensPerRound: 6,
    totalRounds: 6,
  },

  /**
   * 5-PLAYER GAME
   * - Song A = EABBAABE (8 tokens per round)
   * - Song B = CDDEECCD (8 tokens per round)
   * - No Song C
   * - 6 rounds total (6 rounds × 8 tokens = 48 tokens total)
   * - Players: A, B, C, D, E
   */
  5: {
    songA: 'EABBAABE',
    songB: 'CDDEECCD',
    tokensPerRound: 8,
    totalRounds: 6,
  },

  /**
   * 6-PLAYER GAME
   * - Song A = ABCDDCEF (8 tokens per round)
   * - Song B = DCEFFEBA (8 tokens per round)
   * - Song C = FEABBACD (8 tokens per round)
   * - 6 rounds total (6 rounds × 8 tokens = 48 tokens total)
   * - Players: A, B, C, D, E, F
   */
  6: {
    songA: 'ABCDDCEF',
    songB: 'DCEFFEBA',
    songC: 'FEABBACD',
    tokensPerRound: 8,
    totalRounds: 6,
  },
};

/**
 * Validate that a pattern string only contains valid letters for the player count
 */
export function validatePattern(pattern: string, playerCount: number): boolean {
  const validLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, playerCount);
  return pattern.split('').every((char) => validLetters.includes(char));
}

/**
 * Get the total number of vertices needed for a given player count
 */
export function calculateTotalVertices(playerCount: number): number {
  const pattern = SONG_IMPLICATION_PATTERNS[playerCount];
  if (!pattern) return 0;
  return pattern.tokensPerRound * pattern.totalRounds;
}
