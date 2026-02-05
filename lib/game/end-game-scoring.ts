/**
 * End Game Scoring Logic
 *
 * Calculates final game statistics:
 * - Symbol collection (hexagon control)
 * - Power Hub victory points
 */

import { MapLayout, HexTile, getHexTypes } from './map-generator';
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

export interface PlayerPowerHubScore {
  playerId: string;
  playerName: string;
  playerColor: string;
  powerHubVictoryPoints: number;
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
 * Note: powerHub and moneyHub have nothing to control at end of game
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

  // Process each hex (excluding powerHub and moneyHub)
  const scoringHexes = mapLayout.hexes.filter(
    h => !getHexTypes(h).includes('powerHub') && !getHexTypes(h).includes('moneyHub')
  );

  for (const hex of scoringHexes) {
    const influence = calculateHexInfluence(hex, tokens, mapLayout);
    const controllingPlayers = getControllingPlayers(influence);

    // Each controlling player gets this symbol
    for (const playerId of controllingPlayers) {
      const playerCount = symbolCounts.get(playerId);
      if (!playerCount) continue;

      // Check if this hex has 5-6 edges (double symbol)
      const hasDoubleSymbol = hex.edgeCount >= 5 && !getHexTypes(hex).includes('powerHub') && !getHexTypes(hex).includes('moneyHub');

      // Process each type in the hex (hexes can have multiple types)
      for (const hexType of getHexTypes(hex)) {
        switch (hexType) {
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
  }

  return Array.from(symbolCounts.values());
}

/**
 * Calculate Power Hub victory points for each player
 * Players get VP equal to their total influence in the Power Hub hex
 * @param tokens All placed tokens
 * @param mapLayout The map layout
 * @param players List of players with their info
 * @returns Array of Power Hub VP per player
 */
export function calculatePowerHubScores(
  tokens: PlayerToken[],
  mapLayout: MapLayout,
  players: Array<{ id: string; name: string; color: string }>
): PlayerPowerHubScore[] {
  // Find the Power Hub hex
  const powerHub = mapLayout.hexes.find(h => getHexTypes(h).includes('powerHub'));
  if (!powerHub) {
    // No power hub on map - return zeros
    return players.map(p => ({
      playerId: p.id,
      playerName: p.name,
      playerColor: p.color,
      powerHubVictoryPoints: 0,
    }));
  }

  // Calculate influence in power hub
  const influence = calculateHexInfluence(powerHub, tokens, mapLayout);

  // Return scores for all players
  return players.map(p => ({
    playerId: p.id,
    playerName: p.name,
    playerColor: p.color,
    powerHubVictoryPoints: influence.get(p.id) || 0,
  }));
}

export interface PlayerStarPoints {
  playerId: string;
  playerName: string;
  playerColor: string;
  uniqueStarTypes: number;
  starPoints: number;
}

/**
 * Calculate star points based on unique star types collected
 * 1 type = 10 pts, 2 types = 25 pts, 3 types = 45 pts,
 * 4 types = 70 pts, 5 types = 100 pts, 6 types = 1000 pts (auto-win)
 * @param symbolCounts Array of player symbol counts
 * @returns Array of star points per player
 */
export function calculateStarPoints(
  symbolCounts: PlayerSymbolCount[]
): PlayerStarPoints[] {
  const pointsMap = [0, 10, 25, 45, 70, 100, 1000];

  return symbolCounts.map(count => {
    // Count unique star types (excluding households)
    let uniqueStarTypes = 0;
    if (count.bluesStar > 0) uniqueStarTypes++;
    if (count.countryStar > 0) uniqueStarTypes++;
    if (count.jazzStar > 0) uniqueStarTypes++;
    if (count.rockStar > 0) uniqueStarTypes++;
    if (count.popStar > 0) uniqueStarTypes++;
    if (count.classicalStar > 0) uniqueStarTypes++;

    // Calculate points (6 types = 1000 pts for auto-win)
    const starPoints = pointsMap[uniqueStarTypes] || 0;

    return {
      playerId: count.playerId,
      playerName: count.playerName,
      playerColor: count.playerColor,
      uniqueStarTypes,
      starPoints,
    };
  });
}

export interface PlayerHouseholdPoints {
  playerId: string;
  playerName: string;
  playerColor: string;
  households: number;
  householdPoints: number;
  placement: number; // 1st, 2nd, 3rd, etc.
}

/**
 * Calculate competitive household scoring with tie-breaking
 * Most households: 50 pts
 * 3-4 players: 2nd place = 20 pts
 * 5-6 players: 2nd place = 30 pts, 3rd place = 20 pts
 * Ties share points for tied placement + placement below, rounded down
 * @param symbolCounts Array of player symbol counts
 * @param totalPlayers Total number of players in the game
 * @returns Array of household points per player
 */
export function calculateHouseholdPoints(
  symbolCounts: PlayerSymbolCount[],
  totalPlayers: number
): PlayerHouseholdPoints[] {
  // Sort players by household count (descending)
  const sortedPlayers = [...symbolCounts].sort((a, b) => b.households - a.households);

  // Group players by household count to handle ties
  const householdGroups = new Map<number, PlayerSymbolCount[]>();
  sortedPlayers.forEach(player => {
    const existing = householdGroups.get(player.households) || [];
    existing.push(player);
    householdGroups.set(player.households, existing);
  });

  // Define point values based on player count
  let pointsForPlacement: number[];
  if (totalPlayers <= 2) {
    pointsForPlacement = [50, 0]; // 1st only
  } else if (totalPlayers <= 4) {
    pointsForPlacement = [50, 20, 0, 0]; // 1st, 2nd
  } else {
    pointsForPlacement = [50, 30, 20, 0, 0, 0]; // 1st, 2nd, 3rd
  }

  const results: PlayerHouseholdPoints[] = [];
  let currentPlacement = 0;

  // Get unique household counts in descending order
  const uniqueCounts = Array.from(householdGroups.keys()).sort((a, b) => b - a);

  for (const householdCount of uniqueCounts) {
    const playersInTie = householdGroups.get(householdCount)!;
    const tieSize = playersInTie.length;

    // Calculate points to distribute for this tie
    let totalPointsForTie = 0;
    for (let i = 0; i < tieSize; i++) {
      totalPointsForTie += pointsForPlacement[currentPlacement + i] || 0;
    }

    // Each player in tie gets equal share (rounded down)
    const pointsPerPlayer = Math.floor(totalPointsForTie / tieSize);

    // Assign points to all players in this tie
    playersInTie.forEach(player => {
      results.push({
        playerId: player.playerId,
        playerName: player.playerName,
        playerColor: player.playerColor,
        households: player.households,
        householdPoints: pointsPerPlayer,
        placement: currentPlacement + 1, // 1-indexed for display
      });
    });

    // Move placement counter forward by tie size
    currentPlacement += tieSize;
  }

  return results;
}

export interface AutoWinCheck {
  hasAutoWin: boolean;
  autoWinners: Array<{
    playerId: string;
    playerName: string;
    playerColor: string;
  }>;
}

/**
 * Check if any players have all 6 star types for an automatic win
 * @param symbolCounts Array of player symbol counts
 * @returns Auto-win information
 */
export function checkAutoWin(
  symbolCounts: PlayerSymbolCount[]
): AutoWinCheck {
  const autoWinners = symbolCounts.filter(count => {
    return count.bluesStar > 0 &&
           count.countryStar > 0 &&
           count.jazzStar > 0 &&
           count.rockStar > 0 &&
           count.popStar > 0 &&
           count.classicalStar > 0;
  }).map(count => ({
    playerId: count.playerId,
    playerName: count.playerName,
    playerColor: count.playerColor,
  }));

  return {
    hasAutoWin: autoWinners.length > 0,
    autoWinners,
  };
}

export interface PlayerMoneyPoints {
  playerId: string;
  playerName: string;
  playerColor: string;
  unspentMoney: number;
  moneyPoints: number;
}

/**
 * Calculate victory points from unspent money
 * Each player gets 1 VP per dollar remaining at the end of the game
 * For card-based variants: calculates total value of remaining cards
 * For currency-based variants: uses currency balance directly
 * @param players Array of players with their currency balance and optional card inventory
 * @returns Array of money points per player
 */
export function calculateMoneyPoints(
  players: Array<{
    id: string;
    name: string;
    color: string;
    currencyBalance: number | null;
    remainingCardValue?: number; // For card-based variants, pre-calculated total value of remaining cards
  }>
): PlayerMoneyPoints[] {
  return players.map(player => {
    // Use remaining card value if provided (card-based variants), otherwise use currency balance
    const unspentMoney = player.remainingCardValue !== undefined
      ? player.remainingCardValue
      : (player.currencyBalance ?? 0);

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      unspentMoney,
      moneyPoints: unspentMoney,
    };
  });
}
