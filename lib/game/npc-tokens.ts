/**
 * NPC Token System for Multi-Map Mode
 *
 * After rounds 5 and 10 in Multi-Map mode, 3 white "blank" NPC tokens are placed
 * on the remaining empty edges of each map. These tokens count as 0 influence
 * for both adjacent hexagons.
 */

import { MapLayout } from './map-generator';
import { EdgeId } from './hex-grid';

/**
 * NPC Token structure
 * Similar to regular InfluenceToken but with special properties
 */
export interface NPCToken {
  id: string;
  gameId: string;
  playerId: string; // Set to 'NPC'
  roundNumber: number;
  edgeId: string;
  tokenType: string; // Always '0/0' for NPCs
  orientation: string; // Always 'A' (doesn't matter since both values are 0)
}

/**
 * Get all edges that don't have tokens placed yet
 */
export function getUnusedEdges(
  mapLayout: MapLayout,
  placedTokenEdges: string[]
): EdgeId[] {
  const placedSet = new Set(placedTokenEdges);
  return mapLayout.edges.filter(edgeId => !placedSet.has(edgeId));
}

/**
 * Select random edges from the unused edges for NPC token placement
 * @param mapLayout The current map layout
 * @param placedTokenEdges Array of edge IDs that already have tokens
 * @param npcTokenCount Number of NPC tokens to place (default 3 for 3-player, 4 for 6-player)
 */
export function selectNPCEdges(
  mapLayout: MapLayout,
  placedTokenEdges: string[],
  npcTokenCount: number = 3
): EdgeId[] {
  const unusedEdges = getUnusedEdges(mapLayout, placedTokenEdges);

  if (unusedEdges.length < npcTokenCount) {
    console.warn(`Only ${unusedEdges.length} unused edges available for ${npcTokenCount} NPC tokens`);
    return unusedEdges;
  }

  // Randomly select the specified number of edges
  const shuffled = [...unusedEdges].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, npcTokenCount);
}

/**
 * Create NPC tokens for the selected edges
 */
export function createNPCTokens(
  gameId: string,
  roundNumber: number,
  npcEdges: EdgeId[]
): NPCToken[] {
  return npcEdges.map((edgeId, index) => ({
    id: `npc_${gameId}_${roundNumber}_${index}`,
    gameId,
    playerId: 'NPC',
    roundNumber,
    edgeId,
    tokenType: '0/0',
    orientation: 'A',
  }));
}

/**
 * Calculate influence on a hex including NPC tokens
 * NPC tokens always contribute 0 influence
 */
export function getTokenInfluence(
  token: { tokenType: string; orientation: string; playerId: string },
  hexIndex: number // 0 or 1 (which of the two adjacent hexes)
): number {
  // NPC tokens always contribute 0
  if (token.playerId === 'NPC') {
    return 0;
  }

  // Parse token type (e.g., "4/0" -> [4, 0])
  const [valueA, valueB] = token.tokenType.split('/').map(Number);

  // Return appropriate value based on orientation and hex index
  if (token.orientation === 'A') {
    return hexIndex === 0 ? valueA : valueB;
  } else {
    return hexIndex === 0 ? valueB : valueA;
  }
}

/**
 * Check if a token is an NPC token
 */
export function isNPCToken(token: { playerId: string }): boolean {
  return token.playerId === 'NPC';
}
