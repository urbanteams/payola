/**
 * End Game Scoring Logic
 *
 * Calculates final game statistics:
 * - Symbol collection (hexagon control)
 * - Buzz Hub victory points
 */

import { MapLayout, HexTile } from './map-generator';
import { EdgeId, parseEdgeId, HexCoordinate } from './hex-grid';

export interface PlayerToken {
  id: string;
  edgeId: EdgeId;
  playerId: string;
  playerName: string;
  playerColor: string | null;
  tokenType: '4/0' | '2/2' | '1/3';
  orientation: 'A' | 'B';
  roundNumber: number;
}

export interface PlayerSymbolCount {
  playerId: string;
  playerName: string;
  playerColor: string;
  households: number;
  bluesStar: number;
  countryStar: number;
  jazzStar: number;
  rockStar: number;
  popStar: number;
  classicalStar: number;
  totalSymbols: number;
}

export interface PlayerBuzzHubScore {
  playerId: string;
  playerName: string;
  playerColor: string;
  buzzHubVictoryPoints: number;
}

/**
 * Calculate influence points each player has in a given hexagon
 * @param hex The hexagon to check
 * @param tokens All placed tokens
 * @param mapLayout The map layout
 * @returns Map of playerId to total influence in this hex
 */
function calculateHexInfluence(
  hex: HexTile,
  tokens: PlayerToken[],
  mapLayout: MapLayout
): Map<string, number> {
  const influence = new Map<string, number>();

  for (const token of tokens) {
    // Parse edge to get adjacent hexes
    const hexPair = parseEdgeId(token.edgeId);
    if (!hexPair) continue;

    const [hex1Coord, hex2Coord] = hexPair;

    // Check if this token is adjacent to the hex
    const isHex1 = hex1Coord.q === hex.coordinate.q && hex1Coord.r === hex.coordinate.r;
    const isHex2 = hex2Coord.q === hex.coordinate.q && hex2Coord.r === hex.coordinate.r;

    if (!isHex1 && !isHex2) continue;

    // Parse token values
    const [valueA, valueB] = token.tokenType.split('/').map(Number);

    // Calculate edge direction to detect if visual orientation needs flipping
    const dq = hex2Coord.q - hex1Coord.q;
    const dr = hex2Coord.r - hex1Coord.r;

    // For 60° diagonal edges (dq=1, dr=-1), the visual rotation causes the values to appear flipped
    // These are top-right/bottom-left edges that need their value assignment corrected
    const needsFlip = (dq === 1 && dr === -1);

    // Determine which value applies to this hex
    let influenceValue: number;
    if (isHex1) {
      if (needsFlip) {
        influenceValue = token.orientation === 'A' ? valueB : valueA;
      } else {
        influenceValue = token.orientation === 'A' ? valueA : valueB;
      }
    } else {
      if (needsFlip) {
        influenceValue = token.orientation === 'A' ? valueA : valueB;
      } else {
        influenceValue = token.orientation === 'A' ? valueB : valueA;
      }
    }

    // Add to player's influence in this hex
    const current = influence.get(token.playerId) || 0;
    influence.set(token.playerId, current + influenceValue);
  }

  return influence;
}

/**
 * Determine which players control a hexagon
 * Players with the most influence control the hex
 * Ties mean ALL tied players control it
 * @param influence Map of playerId to influence in hex
 * @returns Array of playerIds who control the hex
 */
function getControllingPlayers(influence: Map<string, number>): string[] {
  if (influence.size === 0) return [];

  // Find maximum influence
  const maxInfluence = Math.max(...influence.values());

  // Return all players with max influence (handles ties)
  return Array.from(influence.entries())
    .filter(([_, value]) => value === maxInfluence)
    .map(([playerId, _]) => playerId);
}

/**
 * Calculate symbols collected by each player
 * Players collect symbols from hexagons they control
 * Note: buzzHub and moneyHub have nothing to control at end of game
 * @param tokens All placed tokens
 * @param mapLayout The map layout
 * @param players List of players with their info
 * @returns Array of symbol counts per player
 */
export function calculateSymbolsCollected(
  tokens: PlayerToken[],
  mapLayout: MapLayout,
  players: Array<{ id: string; name: string; color: string }>
): PlayerSymbolCount[] {
  // Initialize symbol counts for all players
  const symbolCounts: Map<string, PlayerSymbolCount> = new Map();

  for (const player of players) {
    symbolCounts.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      households: 0,
      bluesStar: 0,
      countryStar: 0,
      jazzStar: 0,
      rockStar: 0,
      popStar: 0,
      classicalStar: 0,
      totalSymbols: 0,
    });
  }

  // Process each hex (excluding buzzHub and moneyHub)
  const scoringHexes = mapLayout.hexes.filter(
    h => h.type !== 'buzzHub' && h.type !== 'moneyHub'
  );

  for (const hex of scoringHexes) {
    const influence = calculateHexInfluence(hex, tokens, mapLayout);
    const controllingPlayers = getControllingPlayers(influence);

    // Each controlling player gets this symbol
    for (const playerId of controllingPlayers) {
      const playerCount = symbolCounts.get(playerId);
      if (!playerCount) continue;

      // Check if this hex has 5-6 edges (double symbol)
      const hasDoubleSymbol = hex.edgeCount >= 5 && hex.type !== 'buzzHub' && hex.type !== 'moneyHub';

      switch (hex.type) {
        case 'households':
          // Hexagons with 5-6 edges award 2 households instead of 1
          playerCount.households += hasDoubleSymbol ? 2 : 1;
          playerCount.totalSymbols += hasDoubleSymbol ? 2 : 1;
          break;
        case 'bluesStar':
          playerCount.bluesStar++;
          playerCount.totalSymbols++;
          // Music star hexes with 5-6 edges also award 1 household
          if (hasDoubleSymbol) {
            playerCount.households++;
            playerCount.totalSymbols++;
          }
          break;
        case 'countryStar':
          playerCount.countryStar++;
          playerCount.totalSymbols++;
          if (hasDoubleSymbol) {
            playerCount.households++;
            playerCount.totalSymbols++;
          }
          break;
        case 'jazzStar':
          playerCount.jazzStar++;
          playerCount.totalSymbols++;
          if (hasDoubleSymbol) {
            playerCount.households++;
            playerCount.totalSymbols++;
          }
          break;
        case 'rockStar':
          playerCount.rockStar++;
          playerCount.totalSymbols++;
          if (hasDoubleSymbol) {
            playerCount.households++;
            playerCount.totalSymbols++;
          }
          break;
        case 'popStar':
          playerCount.popStar++;
          playerCount.totalSymbols++;
          if (hasDoubleSymbol) {
            playerCount.households++;
            playerCount.totalSymbols++;
          }
          break;
        case 'classicalStar':
          playerCount.classicalStar++;
          playerCount.totalSymbols++;
          if (hasDoubleSymbol) {
            playerCount.households++;
            playerCount.totalSymbols++;
          }
          break;
      }
    }
  }

  return Array.from(symbolCounts.values());
}

/**
 * Calculate Buzz Hub victory points for each player
 * Players get VP equal to their total influence in the Buzz Hub hex
 * @param tokens All placed tokens
 * @param mapLayout The map layout
 * @param players List of players with their info
 * @returns Array of Buzz Hub VP per player
 */
export function calculateBuzzHubScores(
  tokens: PlayerToken[],
  mapLayout: MapLayout,
  players: Array<{ id: string; name: string; color: string }>
): PlayerBuzzHubScore[] {
  // Find the Buzz Hub hex
  const buzzHub = mapLayout.hexes.find(h => h.type === 'buzzHub');
  if (!buzzHub) {
    // No buzz hub on map - return zeros
    return players.map(p => ({
      playerId: p.id,
      playerName: p.name,
      playerColor: p.color,
      buzzHubVictoryPoints: 0,
    }));
  }

  // Calculate influence in buzz hub
  const influence = calculateHexInfluence(buzzHub, tokens, mapLayout);

  // Return scores for all players
  return players.map(p => ({
    playerId: p.id,
    playerName: p.name,
    playerColor: p.color,
    buzzHubVictoryPoints: influence.get(p.id) || 0,
  }));
}
