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
 * Multi-Map Mode - 3 Player Game
 *
 * Key differences from standard 3-player:
 * - Two maps: NYC18 (18 edges each)
 * - 5 rounds per map (10 rounds total)
 * - 3 tokens per round (same as standard mode)
 * - After round 5: 3 white NPC tokens fill remaining spaces on first map
 * - After round 10: 3 white NPC tokens fill remaining spaces on second map
 * - Starting money: $20 (instead of $30)
 * - Money carries over between maps
 * - Songs A, B, C available
 * - Uses SAME song patterns as standard 3-player (ABB, BCC, CAA)
 * - Player assignments randomize each round (same as standard)
 */
export const MULTI_MAP_PATTERN_3PLAYER: SongImplicationPattern = {
  songA: 'ABB',
  songB: 'BCC',
  songC: 'CAA',
  tokensPerRound: 3,
  totalRounds: 10,
  isPOTS: false,
  finalPlacementPhase: false,
};

/**
 * Multi-Map Mode - 4 Player Game
 *
 * Key differences from standard 4-player:
 * - Two maps: NYC30 (30 edges each)
 * - 5 rounds per map (10 rounds total)
 * - 6 tokens per round
 * - NO NPC tokens (map is exactly filled by player tokens: 6 × 5 = 30)
 * - Starting money: $20 (instead of $30)
 * - Money carries over between maps
 * - Only 2 songs available (no Song C)
 * - Song patterns: Song A = ABCDCD, Song B = CDABAB
 * - Player assignments randomize each round
 */
export const MULTI_MAP_PATTERN_4PLAYER: SongImplicationPattern = {
  songA: 'ABCDCD',
  songB: 'CDABAB',
  tokensPerRound: 6,
  totalRounds: 10,
  isPOTS: false,
  finalPlacementPhase: false,
};

/**
 * Multi-Map Mode - 6 Player Game
 *
 * Key differences from standard 6-player:
 * - Two maps: NYC24 (24 edges each)
 * - 5 rounds per map (10 rounds total)
 * - 4 tokens per round
 * - After round 5: 4 white NPC tokens fill remaining spaces on first map
 * - After round 10: 4 white NPC tokens fill remaining spaces on second map
 * - Starting money: $20 (instead of $30)
 * - Money carries over between maps
 * - Songs A, B, C available
 * - Song patterns: ABCD, EFAB, CDEF
 * - Player assignments randomize each round
 * - Classical Stars present on both maps
 */
export const MULTI_MAP_PATTERN_6PLAYER: SongImplicationPattern = {
  songA: 'ABCD',
  songB: 'EFAB',
  songC: 'CDEF',
  tokensPerRound: 4,
  totalRounds: 10,
  isPOTS: false,
  finalPlacementPhase: false,
};

/**
 * Multi-Map Mode - 5 Player Game
 *
 * Key features:
 * - Two maps: NYC25 (25 edges each)
 * - 5 rounds per map (10 rounds total)
 * - 5 tokens per round (no NPC tokens)
 * - Map is exactly filled by player tokens: 5 × 5 = 25
 * - Starting money: $20 (instead of $30)
 * - Money carries over between maps
 * - Classical Stars present on both maps (5+ players)
 * - Only 2 songs available (Song A and Song B)
 * - Song patterns: CDCDE, EABAB
 */
export const MULTI_MAP_PATTERN_5PLAYER: SongImplicationPattern = {
  songA: 'CDCDE',
  songB: 'EABAB',
  tokensPerRound: 5,
  totalRounds: 10,
  isPOTS: false,
  finalPlacementPhase: false,
};

/**
 * Multi-Map Mode - 6A Variant (6 Players, No NPC)
 *
 * Key differences from standard 6-player Multi-Map:
 * - Two maps: NYC30 (30 edges each) instead of NYC24
 * - 5 rounds per map (10 rounds total)
 * - 6 tokens per round (instead of 4)
 * - NO NPC tokens (map is exactly filled by player tokens: 6 × 5 = 30)
 * - Starting money: $20 (instead of $30)
 * - Money carries over between maps
 * - Songs A, B, C available (3 songs)
 * - Song patterns: Song A = ABCDAB, Song B = CDEFCD, Song C = EFABEF
 * - Each player (A-F) appears exactly 3 times across all songs
 * - Player assignments randomize each round
 * - Classical Stars present on both maps
 */
export const MULTI_MAP_PATTERN_6A: SongImplicationPattern = {
  songA: 'ABCDAB',
  songB: 'CDEFCD',
  songC: 'EFABEF',
  tokensPerRound: 6,
  totalRounds: 10,
  isPOTS: false,
  finalPlacementPhase: false,
};

/**
 * Multi-Map Mode - 4B Variant (4 Players, Card-Based Bidding)
 *
 * Key features:
 * - Two maps: NYC20 (20 edges each)
 * - 5 rounds per map (10 rounds total)
 * - 4 tokens per round
 * - Map is exactly filled by player tokens: 4 × 5 = 20
 * - Starting cards: 8 cards (2×$1, 2×$2, 2×$3, 2×$4) - card-based bidding
 * - Cards carry over between maps (spent cards permanent)
 * - Rounds 1-5: Max 1 card per bid, Rounds 6-10: Max 2 cards per bid
 * - Only 3 songs available (Song A, B, C)
 * - Song patterns: Song A = ADBA, Song B = DACD, Song C = BCBC
 * - Each player (A-D) appears exactly 3 times across all songs
 * - Player assignments randomize each round
 * - No Money Hub (replaced with Household)
 * - 1 Buzz Hub + 1 of each of 5 star types
 */
export const MULTI_MAP_PATTERN_4B: SongImplicationPattern = {
  songA: 'ADBA',
  songB: 'DACD',
  songC: 'BCBC',
  tokensPerRound: 4,
  totalRounds: 10,
  isPOTS: false,
  finalPlacementPhase: false,
};

/**
 * Multi-Map Mode - 5B Variant (5 Players, Card-Based Bidding)
 *
 * Key features:
 * - Two maps: NYC20 (20 edges each)
 * - 4 rounds per map (8 rounds total)
 * - 5 tokens per round
 * - Map is exactly filled by player tokens: 5 × 4 = 20
 * - Starting cards: 8 cards (2×$1, 2×$2, 2×$3, 2×$4) - card-based bidding
 * - Cards carry over between maps (spent cards permanent)
 * - Rounds 1-4: Max 1 card per bid, Rounds 5-7: Max 2 cards per bid, Round 8: Unlimited
 * - Only 3 songs available (Song A, B, C)
 * - Song patterns: Song A = ABCAB, Song B = DEBDE, Song C = CECAD
 * - Each player (A-E) appears exactly 3 times across all songs
 * - Player assignments randomize each round
 * - No Money Hub (replaced with Household)
 * - 1 Buzz Hub + 1 of each of 5 star types
 */
export const MULTI_MAP_PATTERN_5B: SongImplicationPattern = {
  songA: 'ABCAB',
  songB: 'DEBDE',
  songC: 'CECAD',
  tokensPerRound: 5,
  totalRounds: 8,
  isPOTS: false,
  finalPlacementPhase: false,
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
