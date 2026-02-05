/**
 * Token Placement Logic
 *
 * Handles vertex selection, placement validation, and immediate rewards
 */

import { EdgeId, parseEdgeId, HexCoordinate } from './hex-grid';
import { MapLayout, HexTile, getHexTypes } from './map-generator';
import { getSongImplications, parseTurnOrder } from './song-implications';

export interface PlacementTurn {
  playerIndex: number;
  playerId: string;
  playerName: string;
}

export interface ImmediateReward {
  victoryPoints?: number;
  currency?: number;
  hexType: 'powerHub' | 'moneyHub';
  hexId: string;
}

/**
 * Select random vertices for token placement this round
 * @param mapLayout The current map layout
 * @param existingTokens Already placed tokens (to avoid selection)
 * @param count Number of vertices to select
 * @returns Array of edge IDs to highlight
 */
export function selectRandomVertices(
  mapLayout: MapLayout,
  existingTokens: Array<{ edgeId: string }>,
  count: number
): EdgeId[] {
  // Get all edges (token spaces) from map
  const allVertices = mapLayout.edges;

  // Filter out vertices that already have tokens
  const occupiedVertexIds = new Set(existingTokens.map((t) => t.edgeId));
  const availableVertices = allVertices.filter((vId) => !occupiedVertexIds.has(vId));

  if (availableVertices.length < count) {
    throw new Error(
      `Not enough available vertices. Need ${count}, have ${availableVertices.length}`
    );
  }

  // Fisher-Yates shuffle and take first N
  const shuffled = [...availableVertices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

/**
 * Get the placement turn order for this round
 * @param winningSong The song that won ("A", "B", or "C")
 * @param playerIds Ordered array of player IDs (by join order)
 * @param playerNames Ordered array of player names
 * @returns Array of PlacementTurn objects in order
 */
export function getPlacementTurnOrder(
  winningSong: string,
  playerIds: string[],
  playerNames: string[]
): PlacementTurn[] {
  const playerCount = playerIds.length;
  const implications = getSongImplications(playerCount);

  // Get turn order string for winning song
  let turnOrderString: string;
  switch (winningSong) {
    case 'A':
      turnOrderString = implications.songA;
      break;
    case 'B':
      turnOrderString = implications.songB;
      break;
    case 'C':
      if (!implications.songC) {
        throw new Error('Song C not available for this player count');
      }
      turnOrderString = implications.songC;
      break;
    default:
      throw new Error(`Invalid winning song: ${winningSong}`);
  }

  // Parse turn order into player indices
  const playerIndices = parseTurnOrder(turnOrderString);

  // Map indices to player info
  return playerIndices.map((index) => ({
    playerIndex: index,
    playerId: playerIds[index],
    playerName: playerNames[index],
  }));
}

/**
 * Validate that a token placement is legal
 * @param edgeId The edge where player wants to place token
 * @param playerId The player attempting to place
 * @param currentTurnPlayerId The player whose turn it is
 * @param highlightedEdges Edges available for placement this round
 * @param existingTokens Already placed tokens
 * @returns Validation result with error message if invalid
 */
export function validateTokenPlacement(
  edgeId: EdgeId,
  playerId: string,
  currentTurnPlayerId: string,
  highlightedEdges: EdgeId[],
  existingTokens: Array<{ edgeId: string }>
): { valid: boolean; error?: string } {
  // Check if it's this player's turn
  if (playerId !== currentTurnPlayerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if edge is highlighted (available)
  if (!highlightedEdges.includes(edgeId)) {
    return { valid: false, error: 'This edge is not available for placement' };
  }

  // Check if edge already has a token
  const occupied = existingTokens.some((t) => t.edgeId === edgeId);
  if (occupied) {
    return { valid: false, error: 'This edge already has a token' };
  }

  return { valid: true };
}

/**
 * Calculate immediate rewards (VP or currency) from power/money hubs
 * @param edgeId Where the token was placed
 * @param tokenType The type of token ("4/0", "2/2", "1/3")
 * @param orientation Which hex gets which value ("A" or "B")
 * @param mapLayout The map layout with hex types
 * @returns Immediate reward object if applicable, null otherwise
 */
export function calculateImmediateReward(
  edgeId: EdgeId,
  tokenType: string,
  orientation: string,
  mapLayout: MapLayout
): ImmediateReward | null {
  // Parse edge ID to get the two adjacent hexagon coordinates
  const hexPair = parseEdgeId(edgeId);
  if (!hexPair) return null;

  const [hex1Coord, hex2Coord] = hexPair;

  // Parse token values (e.g., "4/0" -> [4, 0])
  const [valueA, valueB] = tokenType.split('/').map(Number);

  // Calculate edge direction to detect if visual orientation needs flipping
  const dq = hex2Coord.q - hex1Coord.q;
  const dr = hex2Coord.r - hex1Coord.r;

  // For 60° diagonal edges (dq=1, dr=-1), the visual rotation causes the values to appear flipped
  // These are top-right/bottom-left edges that need their value assignment corrected
  const needsFlip = (dq === 1 && dr === -1);

  // Determine which value goes to which hex based on orientation and edge direction
  let hex1Value: number, hex2Value: number;
  if (needsFlip) {
    // Reversed edge: flip the value assignment
    hex1Value = orientation === 'A' ? valueB : valueA;
    hex2Value = orientation === 'A' ? valueA : valueB;
  } else {
    // Normal edge: standard assignment
    hex1Value = orientation === 'A' ? valueA : valueB;
    hex2Value = orientation === 'A' ? valueB : valueA;
  }

  // Check each hex for powerHub or moneyHub
  const checkHexReward = (hexCoord: HexCoordinate, value: number): ImmediateReward | null => {
    const hex = mapLayout.hexes.find(
      (h) => h.coordinate.q === hexCoord.q && h.coordinate.r === hexCoord.r
    );

    if (!hex || value === 0) return null;

    if (getHexTypes(hex).includes('powerHub')) {
      return {
        victoryPoints: value,
        hexType: 'powerHub',
        hexId: hex.id,
      };
    } else if (getHexTypes(hex).includes('moneyHub')) {
      return {
        currency: value,
        hexType: 'moneyHub',
        hexId: hex.id,
      };
    }

    return null;
  };

  // Check hex1 first, then hex2
  const reward1 = checkHexReward(hex1Coord, hex1Value);
  if (reward1) return reward1;

  const reward2 = checkHexReward(hex2Coord, hex2Value);
  if (reward2) return reward2;

  return null;
}

/**
 * Check if the map is complete (all vertices have tokens)
 * @param totalVertices Total number of vertices on the map
 * @param placedTokenCount Number of tokens placed so far
 * @returns True if map is complete
 */
export function isMapComplete(totalVertices: number, placedTokenCount: number): boolean {
  return placedTokenCount >= totalVertices;
}

/**
 * Get the next player in turn order
 * @param currentTurnIndex Current index in turn order
 * @param turnOrder Full turn order array
 * @returns Next player's info, or null if this was the last turn
 */
export function getNextTurn(
  currentTurnIndex: number,
  turnOrder: PlacementTurn[]
): PlacementTurn | null {
  const nextIndex = currentTurnIndex + 1;
  if (nextIndex >= turnOrder.length) return null;
  return turnOrder[nextIndex];
}

/**
 * Format immediate reward for display
 * @param reward Immediate reward object
 * @param playerName Name of the player who earned it
 * @returns Formatted message
 */
export function formatRewardMessage(reward: ImmediateReward, playerName: string): string {
  if (reward.victoryPoints !== undefined) {
    return `${playerName} gained ${reward.victoryPoints} VP from the Power Hub!`;
  } else if (reward.currency !== undefined) {
    return `${playerName} gained $${reward.currency} from the Money Hub!`;
  }
  return '';
}
