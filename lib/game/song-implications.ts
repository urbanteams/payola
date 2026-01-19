/**
 * Song Implications
 *
 * Converts song implication patterns into actual turn orders with player assignments
 * Supports randomization of player-to-letter mappings each round
 */

import { SONG_IMPLICATION_PATTERNS, SongImplicationPattern } from './song-implications-data';

export interface SongImplications {
  songA: string; // Turn order string with player indices (e.g., "012012")
  songB: string;
  songC?: string;
  tokensPerRound: number;
}

/**
 * Create a random mapping from pattern letters to player indices
 * Example: For 3 players, might map A→2, B→0, C→1
 *
 * @param playerCount Number of players
 * @returns Object mapping letters (A, B, C...) to player indices (0, 1, 2...)
 */
export function createRandomPlayerMapping(playerCount: number): Record<string, number> {
  // Create array of player indices [0, 1, 2, ...]
  const indices = Array.from({ length: playerCount }, (_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Map letters to shuffled indices
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const mapping: Record<string, number> = {};

  for (let i = 0; i < playerCount; i++) {
    mapping[letters[i]] = indices[i];
  }

  return mapping;
}

/**
 * Convert a pattern string (e.g., "ABCCBA") to a turn order string using a player mapping
 *
 * @param pattern Pattern string with letters (A, B, C...)
 * @param playerMapping Mapping from letters to player indices
 * @returns Turn order string with player indices (e.g., "012210")
 */
export function applyPlayerMapping(
  pattern: string,
  playerMapping: Record<string, number>
): string {
  return pattern
    .split('')
    .map((letter) => {
      const index = playerMapping[letter];
      if (index === undefined) {
        throw new Error(`Invalid letter in pattern: ${letter}`);
      }
      return index.toString();
    })
    .join('');
}

/**
 * Get song implications for a given player count with optional custom mapping
 * If no mapping provided, creates a random one
 *
 * @param playerCount Number of players in the game (3-6)
 * @param playerMapping Optional custom mapping from letters to player indices
 * @returns Song implications object with turn orders
 */
export function getSongImplications(
  playerCount: number,
  playerMapping?: Record<string, number>
): SongImplications {
  const pattern = SONG_IMPLICATION_PATTERNS[playerCount];

  if (!pattern) {
    throw new Error(`Invalid player count: ${playerCount}. Must be 3-6.`);
  }

  // Use provided mapping or create a random one
  const mapping = playerMapping || createRandomPlayerMapping(playerCount);

  return {
    songA: applyPlayerMapping(pattern.songA, mapping),
    songB: applyPlayerMapping(pattern.songB, mapping),
    songC: pattern.songC ? applyPlayerMapping(pattern.songC, mapping) : undefined,
    tokensPerRound: pattern.tokensPerRound,
  };
}

/**
 * Get the raw pattern data for a player count (without player mapping)
 */
export function getSongImplicationPattern(playerCount: number): SongImplicationPattern {
  const pattern = SONG_IMPLICATION_PATTERNS[playerCount];
  if (!pattern) {
    throw new Error(`Invalid player count: ${playerCount}. Must be 3-6.`);
  }
  return pattern;
}

/**
 * Parse turn order string into array of player indices
 * Example: "012012" -> [0, 1, 2, 0, 1, 2]
 */
export function parseTurnOrder(turnOrderString: string): number[] {
  return turnOrderString.split('').map((char) => parseInt(char, 10));
}

/**
 * Get the number of tokens that will be placed for a given song/player count
 */
export function getTokensPerRound(playerCount: number): number {
  const pattern = SONG_IMPLICATION_PATTERNS[playerCount];
  if (!pattern) return 0;
  return pattern.tokensPerRound;
}

/**
 * Get total number of rounds for a player count
 */
export function getTotalRounds(playerCount: number): number {
  const pattern = SONG_IMPLICATION_PATTERNS[playerCount];
  if (!pattern) return 0;
  return pattern.totalRounds;
}

/**
 * Get formatted display string for song implications (for UI)
 * Converts player indices to player names
 *
 * Example: "012012" with names ["Alice", "Bob", "Charlie"] ->
 *          "Alice → Bob → Charlie → Alice → Bob → Charlie"
 */
export function formatTurnOrderDisplay(
  turnOrderString: string,
  playerNames: string[]
): string {
  const playerIndices = parseTurnOrder(turnOrderString);
  const names = playerIndices.map((index) => playerNames[index] || `Player ${index + 1}`);
  return names.join(' → ');
}

/**
 * Check if a player gets to place more tokens with one song vs another
 * Useful for showing players which song benefits them
 */
export function getPlayerTokenCount(turnOrderString: string, playerIndex: number): number {
  return turnOrderString.split('').filter((char) => parseInt(char, 10) === playerIndex).length;
}

/**
 * Compare songs for a specific player to show preference
 * Returns positive if song A is better, negative if song B is better, 0 if equal
 */
export function compareSongsForPlayer(
  songATurnOrder: string,
  songBTurnOrder: string,
  playerIndex: number
): number {
  const aCount = getPlayerTokenCount(songATurnOrder, playerIndex);
  const bCount = getPlayerTokenCount(songBTurnOrder, playerIndex);
  return aCount - bCount;
}

/**
 * Get a preview of song implications for UI display (showing pattern, not actual players)
 * Example: For a 3-player game, shows "ABABAC" vs "BCCCBA" so players can compare
 */
export function getSongImplicationPreview(playerCount: number): {
  songA: string;
  songB: string;
  songC?: string;
} {
  const pattern = SONG_IMPLICATION_PATTERNS[playerCount];
  if (!pattern) {
    throw new Error(`Invalid player count: ${playerCount}`);
  }

  return {
    songA: pattern.songA,
    songB: pattern.songB,
    songC: pattern.songC,
  };
}

/**
 * Calculate expected token placements per player for each song
 * Useful for strategy display in UI
 */
export function calculateTokenDistribution(
  playerCount: number
): Record<string, Record<number, number>> {
  const pattern = SONG_IMPLICATION_PATTERNS[playerCount];
  if (!pattern) return {};

  const result: Record<string, Record<number, number>> = {
    songA: {},
    songB: {},
  };

  if (pattern.songC) {
    result.songC = {};
  }

  // Count occurrences of each letter in each song pattern
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, playerCount);

  for (let i = 0; i < playerCount; i++) {
    const letter = letters[i];

    result.songA[i] = (pattern.songA.match(new RegExp(letter, 'g')) || []).length;
    result.songB[i] = (pattern.songB.match(new RegExp(letter, 'g')) || []).length;

    if (pattern.songC) {
      result.songC![i] = (pattern.songC.match(new RegExp(letter, 'g')) || []).length;
    }
  }

  return result;
}
