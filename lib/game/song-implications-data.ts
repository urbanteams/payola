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
  songD?: string;
  tokensPerRound: number;
  totalRounds: number;
  isPOTS?: boolean; // POTS mode: fixed patterns (ABB, BCC, CAA), but player assignments randomize each round
  finalPlacementPhase?: boolean; // Whether to have a special final placement phase
}

/**
 * Song implication patterns by player count
 */
export const SONG_IMPLICATION_PATTERNS: Record<number, SongImplicationPattern> = {
  /**
   * 3-PLAYER GAME (STANDARD)
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
   * - Song B = CADBAC (6 tokens per round)
   * - Song C = BDACDB (6 tokens per round)
   * - Song D = DCBACD (6 tokens per round)
   * - 6 rounds total (6 rounds × 6 tokens = 36 tokens total)
   * - Players: A, B, C, D
   */
  4: {
    songA: 'ABCDBA',
    songB: 'CADBAC',
    songC: 'BDACDB',
    songD: 'DCBACD',
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
 * POTS Mode - 3 Player Game
 *
 * Key differences from standard 3-player:
 * - Fixed song patterns: Song A = ABB, Song B = BCC, Song C = CAA
 * - Player assignments randomize each round
 * - 3 tokens per round (instead of 6)
 * - 10 rounds total (30 tokens)
 * - Final placement phase for remaining 6 tokens (2 per player, based on money)
 * - Total: 36 tokens on NYC36 map
 */
export const POTS_PATTERN: SongImplicationPattern = {
  songA: 'ABB',
  songB: 'BCC',
  songC: 'CAA',
  tokensPerRound: 3,
  totalRounds: 10,
  isPOTS: true,
  finalPlacementPhase: true,
};

/**
 * POTS Mode - 4 Player Game
 *
 * Key differences from standard 4-player:
 * - Fixed song patterns: Song A = ABCB, Song B = BCDC, Song C = CDAD, Song D = DABA
 * - Player assignments randomize each round (same as 3-player POTS)
 * - 4 tokens per round (instead of 6)
 * - 8 rounds total (32 tokens)
 * - Final placement phase for remaining 4 tokens (1 per player, based on money)
 * - Total: 36 tokens on NYC36 map
 */
export const POTS_PATTERN_4PLAYER: SongImplicationPattern = {
  songA: 'ABCB',
  songB: 'BCDC',
  songC: 'CDAD',
  songD: 'DABA',
  tokensPerRound: 4,
  totalRounds: 8,
  isPOTS: true,
  finalPlacementPhase: true,
};

/**
 * POTS Mode - 5 Player Game
 *
 * Key differences from standard 5-player:
 * - Fixed song patterns: Song A = ABCBA, Song B = CDEDC, Song C = EBDAE
 * - Player assignments randomize each round (same as 3/4-player POTS)
 * - 5 tokens per round (instead of 8)
 * - 8 rounds total (40 tokens)
 * - Final placement phase for remaining 8 tokens (top 3 place 2, bottom 2 place 1, based on money)
 * - Total: 48 tokens on NYC48 map
 */
export const POTS_PATTERN_5PLAYER: SongImplicationPattern = {
  songA: 'ABCBA',
  songB: 'CDEDC',
  songC: 'EBDAE',
  tokensPerRound: 5,
  totalRounds: 8,
  isPOTS: true,
  finalPlacementPhase: true,
};

/**
 * POTS Mode - 6 Player Game
 *
 * Key differences from standard 6-player:
 * - Fixed song patterns: Song A = ABCD, Song B = DCEF, Song C = FEBA
 * - Player assignments randomize each round (same as 3/4/5-player POTS)
 * - 4 tokens per round (instead of 8)
 * - 10 rounds total (40 tokens)
 * - Final placement phase for remaining 8 tokens (top 2 place 2, bottom 4 place 1, based on money)
 * - Total: 48 tokens on NYC48 map
 */
export const POTS_PATTERN_6PLAYER: SongImplicationPattern = {
  songA: 'ABCD',
  songB: 'DCEF',
  songC: 'FEBA',
  tokensPerRound: 4,
  totalRounds: 10,
  isPOTS: true,
  finalPlacementPhase: true,
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
