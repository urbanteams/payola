/**
 * Map Generator
 *
 * Generates hexagonal map layouts for New York and California maps
 * with randomized hex types and support for 3-6 players
 */

import { HexCoordinate, getAllEdges, EdgeId } from './hex-grid';

export type HexType =
  | 'households'
  | 'bluesStar'
  | 'countryStar'
  | 'jazzStar'
  | 'rockStar'
  | 'popStar'
  | 'classicalStar' // 5-6 player only
  | 'powerHub' // 1 per map
  | 'moneyHub'; // 1 per map

export type MapType = 'NYC15' | 'NYC18' | 'NYC20' | 'NYC24' | 'NYC25' | 'NYC30' | 'NYC36' | 'NYC48';

export interface HexTile {
  coordinate: HexCoordinate;
  type?: HexType; // Legacy: single type (backward compatibility)
  types?: HexType[]; // New: array to support multiple symbols per hex
  id: string; // Unique identifier: "hex_{q}_{r}"
  edgeCount: number; // Number of edges (token spaces) surrounding this hex
}

/**
 * Helper function to get hex types (handles both old 'type' and new 'types' format)
 */
export function getHexTypes(hex: HexTile): HexType[] {
  // If types array exists, use it
  if (hex.types && hex.types.length > 0) {
    return hex.types;
  }
  // Otherwise fall back to legacy 'type' field
  if (hex.type) {
    return [hex.type];
  }
  // Default to empty array if neither exists
  return [];
}

export interface MapLayout {
  mapType: 'NYC15' | 'NYC18' | 'NYC20' | 'NYC24' | 'NYC25' | 'NYC30' | 'NYC36' | 'NYC48';
  playerCount: number;
  hexes: HexTile[];
  edges: EdgeId[]; // All edge IDs (shared sides between hexagons where tokens can be placed)
  totalRounds: number; // Calculated based on edges and tokens per round
}

// Helper to generate hex ID
function hexId(coord: HexCoordinate): string {
  return `hex_${coord.q}_${coord.r}`;
}

/**
 * NYC15 Fallback Map (3A/3B variant Multi-Map)
 * Compact layout: 9 hexagons creating exactly 15 edges (verified)
 */
const NYC15_POSITIONS: HexCoordinate[] = [
  // Row r=0 (2 hexes)
  { q: 0, r: 0 },
  { q: 1, r: 0 },

  // Row r=1 (2 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },

  // Row r=2 (2 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },

  // Row r=3 (2 hexes)
  { q: 0, r: 3 },
  { q: 1, r: 3 },

  // Row r=4 (1 hex)
  { q: 0, r: 4 },
]; // 9 hexes = exactly 15 edges (verified)

/**
 * NYC18 Fallback Map (3-player no-variant Multi-Map)
 * Compact layout: 10 hexagons creating exactly 18 edges (verified)
 */
const NYC18_POSITIONS: HexCoordinate[] = [
  // Row r=0 (2 hexes)
  { q: 1, r: 0 },
  { q: 2, r: 0 },

  // Row r=1 (3 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },

  // Row r=2 (3 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },

  // Row r=3 (2 hexes)
  { q: 1, r: 3 },
  { q: 2, r: 3 },
]; // 10 hexes = exactly 18 edges (verified)

/**
 * NYC20 Fallback Map (4A/4B/5A variant Multi-Map)
 * Compact layout: 11 hexagons creating exactly 20 edges (verified)
 */
const NYC20_POSITIONS: HexCoordinate[] = [
  // Row r=0 (3 hexes)
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },

  // Row r=1 (4 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },
  { q: 3, r: 1 },

  // Row r=2 (4 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 3, r: 2 },
]; // 11 hexes = exactly 20 edges (verified)

/**
 * NYC24 Fallback Map (6-player no-variant Multi-Map)
 * Compact layout: 13 hexagons creating exactly 24 edges (verified)
 */
const NYC24_POSITIONS: HexCoordinate[] = [
  // Row r=0 (4 hexes)
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: 3, r: 0 },
  { q: 4, r: 0 },

  // Row r=1 (5 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },
  { q: 3, r: 1 },
  { q: 4, r: 1 },

  // Row r=2 (4 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 3, r: 2 },
  { q: 4, r: 2 },
]; // 13 hexes = exactly 24 edges (verified)

/**
 * NYC25 Fallback Map (5B/5-player Multi-Map)
 * Compact layout: 13 hexagons creating exactly 25 edges (verified)
 */
const NYC25_POSITIONS: HexCoordinate[] = [
  // Row r=0 (4 hexes)
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: 3, r: 0 },

  // Row r=1 (5 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },
  { q: 3, r: 1 },
  { q: 4, r: 1 },

  // Row r=2 (4 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 3, r: 2 },
]; // 13 hexes = exactly 25 edges (verified)

/**
 * NYC30 Fallback Map (6A/6B/4-player no-variant Multi-Map)
 * Compact layout: 15 hexagons creating exactly 30 edges (verified)
 */
const NYC30_POSITIONS: HexCoordinate[] = [
  // Row r=0 (5 hexes)
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: 3, r: 0 },
  { q: 4, r: 0 },

  // Row r=1 (5 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },
  { q: 3, r: 1 },
  { q: 4, r: 1 },

  // Row r=2 (5 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 3, r: 2 },
  { q: 4, r: 2 },
]; // 15 hexes = exactly 30 edges (verified)

/**
 * NYC36 Fallback Map (3-4 player standard)
 * Compact layout: 17 hexagons creating exactly 36 edges (verified)
 */
const NYC36_POSITIONS: HexCoordinate[] = [
  // Row r=0 (3 hexes)
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: 3, r: 0 },

  // Row r=1 (4 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },
  { q: 3, r: 1 },

  // Row r=2 (4 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 3, r: 2 },

  // Row r=3 (4 hexes)
  { q: 0, r: 3 },
  { q: 1, r: 3 },
  { q: 2, r: 3 },
  { q: 3, r: 3 },

  // Row r=4 (2 hexes)
  { q: 1, r: 4 },
  { q: 2, r: 4 },
]; // 17 hexes = exactly 36 edges (verified)

/**
 * NYC48 Fallback Map (5-6 player standard)
 * Compact layout: 22 hexagons creating exactly 48 edges (verified)
 */
const NYC48_POSITIONS: HexCoordinate[] = [
  // Row r=0 (4 hexes)
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: 3, r: 0 },

  // Row r=1 (4 hexes)
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },
  { q: 3, r: 1 },

  // Row r=2 (4 hexes)
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 3, r: 2 },

  // Row r=3 (4 hexes)
  { q: 0, r: 3 },
  { q: 1, r: 3 },
  { q: 2, r: 3 },
  { q: 3, r: 3 },

  // Row r=4 (3 hexes)
  { q: 0, r: 4 },
  { q: 1, r: 4 },
  { q: 2, r: 4 },

  // Row r=5 (3 hexes)
  { q: 0, r: 5 },
  { q: 1, r: 5 },
  { q: 2, r: 5 },
]; // 22 hexes = exactly 48 edges (verified)

/**
 * Define hex type distribution based on player count
 * Creates distribution for variable number of hexes
 * Always includes: 1 powerHub, 1 moneyHub, 2x each star type, rest are households
 */
function getHexTypeDistribution(
  totalHexes: number,
  playerCount: number
): HexType[] {
  const is56Player = playerCount >= 5;

  // Fixed special hexes (always exactly 1 of each)
  const distribution: HexType[] = ['powerHub', 'moneyHub'];

  // Star collectibles (2 of each type)
  distribution.push('bluesStar', 'bluesStar');
  distribution.push('countryStar', 'countryStar');
  distribution.push('jazzStar', 'jazzStar');
  distribution.push('rockStar', 'rockStar');
  distribution.push('popStar', 'popStar');

  // Add classical stars for 5-6 player games (2x)
  if (is56Player) {
    distribution.push('classicalStar', 'classicalStar');
  }

  // Current count: 12 (3-4 player) or 14 (5-6 player)

  // Fill remaining slots with households
  const householdsNeeded = totalHexes - distribution.length;

  for (let i = 0; i < householdsNeeded; i++) {
    distribution.push('households');
  }

  return distribution;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get all 6 neighbors of a hexagon (flat-top orientation)
 */
function getHexNeighbors(hex: HexCoordinate): HexCoordinate[] {
  const { q, r } = hex;
  return [
    { q: q + 1, r },      // right
    { q: q - 1, r },      // left
    { q: q + 1, r: r - 1 }, // top-right
    { q, r: r - 1 },      // top-left
    { q, r: r + 1 },      // bottom-right
    { q: q - 1, r: r + 1 }, // bottom-left
  ];
}

/**
 * Check if two coordinates are equal
 */
function coordsEqual(a: HexCoordinate, b: HexCoordinate): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * Validate that no hexagon has only one Token Space (edge)
 * A hexagon with only one neighbor is invalid
 */
function validateMapHasNoSingleEdgeHexes(hexes: HexCoordinate[]): boolean {
  const hexSet = new Set(hexes.map(h => `${h.q}_${h.r}`));

  for (const hex of hexes) {
    const neighbors = getHexNeighbors(hex);
    const edgeCount = neighbors.filter(n => hexSet.has(`${n.q}_${n.r}`)).length;

    // Reject map if any hex has only one edge (one Token Space)
    if (edgeCount === 1) {
      return false;
    }
  }

  return true;
}

/**
 * Generate a random connected map with target number of edges
 * Grows map from center, randomly adding adjacent hexes until target edge count is reached
 */
function generateRandomMapLayout(targetEdges: number, maxAttempts: number = 150): HexCoordinate[] {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Start with center hex
    const hexes: HexCoordinate[] = [{ q: 0, r: 0 }];
    const hexSet = new Set<string>(['0_0']);

    // Build frontier of potential hexes to add
    let frontier: HexCoordinate[] = getHexNeighbors({ q: 0, r: 0 });

    // Keep adding hexes until we reach target edge count
    while (frontier.length > 0) {
      // Calculate current edge count
      const currentEdges = getAllEdges(hexes).length;

      if (currentEdges >= targetEdges) {
        // Check if we hit target exactly
        if (currentEdges === targetEdges) {
          // Validate that no hex has only one Token Space
          if (validateMapHasNoSingleEdgeHexes(hexes)) {
            return hexes;
          }
          // Invalid map, restart attempt
          break;
        }
        // Overshot, restart
        break;
      }

      // Randomly pick from frontier
      const idx = Math.floor(Math.random() * frontier.length);
      const newHex = frontier[idx];
      const hexKey = `${newHex.q}_${newHex.r}`;

      // Add the hex
      hexes.push(newHex);
      hexSet.add(hexKey);

      // Update frontier: remove this hex, add its neighbors
      frontier.splice(idx, 1);

      const newNeighbors = getHexNeighbors(newHex);
      for (const neighbor of newNeighbors) {
        const neighborKey = `${neighbor.q}_${neighbor.r}`;
        // Only add to frontier if not already in map and not already in frontier
        if (!hexSet.has(neighborKey) &&
            !frontier.some(h => coordsEqual(h, neighbor))) {
          frontier.push(neighbor);
        }
      }

      // Limit frontier size to encourage more compact shapes
      if (frontier.length > 15) {
        // Keep only the closest hexes to origin
        frontier.sort((a, b) => {
          const distA = Math.abs(a.q) + Math.abs(a.r);
          const distB = Math.abs(b.q) + Math.abs(b.r);
          return distA - distB;
        });
        frontier = frontier.slice(0, 12);
      }
    }
  }

  // Fallback: return the fixed layouts if random generation fails
  console.warn(`Failed to generate map with ${targetEdges} edges after ${maxAttempts} attempts, using fallback`);

  // Each fallback has exactly the target number of edges (verified)
  const fallbackMap: Record<number, HexCoordinate[]> = {
    15: NYC15_POSITIONS,
    18: NYC18_POSITIONS,
    20: NYC20_POSITIONS,
    24: NYC24_POSITIONS,
    25: NYC25_POSITIONS,
    30: NYC30_POSITIONS,
    36: NYC36_POSITIONS,
    48: NYC48_POSITIONS,
  };

  const fallback = fallbackMap[targetEdges];
  if (fallback) {
    console.log(`Using NYC${targetEdges} fallback (${targetEdges} edges)`);
    return fallback;
  }

  // For any unexpected edge count, use the closest larger fallback
  const sortedKeys = Object.keys(fallbackMap).map(Number).sort((a, b) => a - b);
  const closestKey = sortedKeys.find(k => k >= targetEdges) || sortedKeys[sortedKeys.length - 1];
  console.log(`Using NYC${closestKey} fallback (${closestKey} edges) for unexpected target ${targetEdges}`);
  return fallbackMap[closestKey];
}

/**
 * Calculate estimated number of rounds based on player count
 * Ensures all edges are filled by game end
 */
function calculateTotalRounds(totalEdges: number, playerCount: number): number {
  // Estimate tokens per round based on song implications
  // Rough estimate: 6-8 tokens per round (varies by song)
  const averageTokensPerRound = 6 + playerCount;
  const rounds = Math.ceil(totalEdges / averageTokensPerRound);
  return Math.max(rounds, 3); // Minimum 3 rounds
}

/**
 * Generate a map layout for the specified player count
 * 3-4 players: Random map with exactly 36 edges (token spaces)
 * 5-6 players: Random map with exactly 48 edges (token spaces)
 */
export function generateMapLayout(
  playerCount: number
): MapLayout {
  if (playerCount < 3 || playerCount > 6) {
    throw new Error('Player count must be between 3 and 6');
  }

  // Determine map type and target edge count based on player count
  const is56Player = playerCount >= 5;
  const mapType = is56Player ? 'NYC48' : 'NYC36';
  const targetEdges = is56Player ? 48 : 36;

  // Generate random map with target edge count
  const positions = generateRandomMapLayout(targetEdges);

  const totalHexes = positions.length;

  // Get hex type distribution
  const hexTypes = getHexTypeDistribution(totalHexes, playerCount);

  // Shuffle hex types for randomization
  const shuffledTypes = shuffle(hexTypes);

  // Create a set for quick lookup
  const hexSet = new Set(positions.map(h => `${h.q}_${h.r}`));

  // Create hex tiles
  const hexes: HexTile[] = positions.map((coord, index) => {
    // Count how many edges this hex has (how many neighbors it has in the map)
    const neighbors = getHexNeighbors(coord);
    const edgeCount = neighbors.filter(n => hexSet.has(`${n.q}_${n.r}`)).length;

    return {
      coordinate: coord,
      types: [shuffledTypes[index]], // Wrap in array to support multiple symbols
      id: hexId(coord),
      edgeCount,
    };
  });

  // Calculate all edges (shared sides between hexagons)
  const edges = getAllEdges(positions);

  // Calculate total rounds
  const totalRounds = calculateTotalRounds(edges.length, playerCount);

  return {
    mapType,
    playerCount,
    hexes,
    edges,
    totalRounds,
  };
}

/**
 * Generate a map layout with a specific number of edges (for testing purposes)
 * Supports 15, 18, 20, 24, 25, 30, 36, or 48 edges
 * Small maps (15/18/20/24/25): Stars appear 1x each (no Classical Star)
 * Medium map (30): Stars appear 2x each (no Classical Star)
 * Large maps (36/48): Stars appear 2x each (Classical Star for 48 only)
 * @param includeClassicalStars Optional flag to force inclusion of Classical Stars (for 6-player NYC24)
 * @param noMoneyHub Optional flag to replace Money Hub with an additional Household tile (for 3B/4B variants)
 */
export function generateMapLayoutWithEdgeCount(
  targetEdges: number,
  includeClassicalStars?: boolean,
  noMoneyHub?: boolean
): MapLayout {
  if (![15, 18, 20, 24, 25, 30, 36, 48].includes(targetEdges)) {
    throw new Error('Target edges must be 15, 18, 20, 24, 25, 30, 36, or 48');
  }

  // Determine map type and player count
  let mapType: MapType;
  let playerCount: number;

  if (targetEdges === 15) {
    mapType = 'NYC15';
    playerCount = 2; // Estimate for small map
  } else if (targetEdges === 18) {
    mapType = 'NYC18';
    playerCount = 2; // Estimate for small map
  } else if (targetEdges === 20) {
    mapType = 'NYC20';
    playerCount = 4; // 4B variant
  } else if (targetEdges === 24) {
    mapType = 'NYC24';
    playerCount = 3; // Estimate for medium map
  } else if (targetEdges === 25) {
    mapType = 'NYC25';
    playerCount = 3; // Estimate for medium map
  } else if (targetEdges === 30) {
    mapType = 'NYC30';
    playerCount = 3; // Estimate for medium map
  } else if (targetEdges === 36) {
    mapType = 'NYC36';
    playerCount = 4;
  } else {
    mapType = 'NYC48';
    playerCount = 6;
  }

  // Generate random map with target edge count
  const positions = generateRandomMapLayout(targetEdges);
  const totalHexes = positions.length;

  // Get hex type distribution based on edge count
  // For 3B/4B/6B variants (noMoneyHub), replace moneyHub with households
  let distribution: HexType[] = [];

  if (noMoneyHub) {
    // 3B/4B/6B variants: No Money Hub, just Power Hub
    distribution = ['powerHub'];
  } else {
    // Standard: Both hubs
    distribution = ['powerHub', 'moneyHub'];
  }

  // Maps with 1x each of 5 main stars (no Classical Star)
  if (targetEdges === 15 || targetEdges === 18 || targetEdges === 20 || targetEdges === 24 || targetEdges === 25) {
    distribution.push('bluesStar');
    distribution.push('countryStar');
    distribution.push('jazzStar');
    distribution.push('rockStar');
    distribution.push('popStar');

    // Add classical star if explicitly requested (6-player Multi-Map on NYC24)
    if (includeClassicalStars && targetEdges === 24) {
      distribution.push('classicalStar');
    }
    // Current count: 7 (without classical) or 8 (with classical for NYC24)
    // For NYC20 with noMoneyHub: 6 (powerHub + 5 stars) base distribution
  }
  // Maps with 2x each of 5 main stars (+ 2x Classical Star for NYC30 6B variant)
  else if (targetEdges === 30 || targetEdges === 36) {
    distribution.push('bluesStar', 'bluesStar');
    distribution.push('countryStar', 'countryStar');
    distribution.push('jazzStar', 'jazzStar');
    distribution.push('rockStar', 'rockStar');
    distribution.push('popStar', 'popStar');

    // Add 2x Classical Stars for 6B variant (NYC30)
    if (includeClassicalStars && targetEdges === 30) {
      distribution.push('classicalStar', 'classicalStar');
    }
    // Current count: 12 for standard (powerHub + moneyHub + 10 stars)
    //                11 for 4B (powerHub + 10 stars, no moneyHub)
    //                13 for 6B (powerHub + 10 stars + 2 classicalStars, no moneyHub)
  }
  // 48-edge map: 2x each of 5 main stars + 2x Classical Star
  else if (targetEdges === 48) {
    distribution.push('bluesStar', 'bluesStar');
    distribution.push('countryStar', 'countryStar');
    distribution.push('jazzStar', 'jazzStar');
    distribution.push('rockStar', 'rockStar');
    distribution.push('popStar', 'popStar');
    distribution.push('classicalStar', 'classicalStar');
    // Current count: 14
  }

  // Fill remaining slots with households
  const householdsNeeded = totalHexes - distribution.length;
  for (let i = 0; i < householdsNeeded; i++) {
    distribution.push('households');
  }

  // Shuffle hex types for randomization
  const shuffledTypes = shuffle(distribution);

  // Create a set for quick lookup
  const hexSet = new Set(positions.map(h => `${h.q}_${h.r}`));

  // Create hex tiles
  const hexes: HexTile[] = positions.map((coord, index) => {
    const neighbors = getHexNeighbors(coord);
    const edgeCount = neighbors.filter(n => hexSet.has(`${n.q}_${n.r}`)).length;

    return {
      coordinate: coord,
      types: [shuffledTypes[index]], // Wrap in array to support multiple symbols
      id: hexId(coord),
      edgeCount,
    };
  });

  // Calculate all edges
  const edges = getAllEdges(positions);

  // Calculate total rounds
  const totalRounds = calculateTotalRounds(edges.length, playerCount);

  return {
    mapType,
    playerCount,
    hexes,
    edges,
    totalRounds,
  };
}

/**
 * Serialize map layout to JSON string for database storage
 */
export function serializeMapLayout(layout: MapLayout): string {
  return JSON.stringify(layout);
}

/**
 * Deserialize map layout from JSON string
 */
export function deserializeMapLayout(json: string): MapLayout {
  return JSON.parse(json) as MapLayout;
}

/**
 * Get hex colors for rendering (based on reference images)
 */
export function getHexColor(type: HexType): string {
  const colors: Record<HexType, string> = {
    households: '#FF69B4', // Pink
    bluesStar: '#87CEEB', // Sky blue
    countryStar: '#F4E4C1', // Tan/beige
    jazzStar: '#B19CD9', // Purple
    rockStar: '#FFB6B9', // Coral
    popStar: '#90EE90', // Light green
    classicalStar: '#D3D3D3', // Light gray
    powerHub: '#FFFF00', // Bright yellow
    moneyHub: '#00FF00', // Bright green
  };

  return colors[type];
}

/**
 * Get hex label for accessibility/debugging
 */
export function getHexLabel(types: HexType | HexType[]): string {
  const labels: Record<HexType, string> = {
    households: 'Household', // Singular by default
    bluesStar: 'Blues Star',
    countryStar: 'Country Star',
    jazzStar: 'Jazz Star',
    rockStar: 'Rock Star',
    popStar: 'Pop Star',
    classicalStar: 'Classical Star',
    powerHub: 'Power Hub',
    moneyHub: 'Money Hub',
  };

  // Support both single type and array of types for backward compatibility
  const typeArray = Array.isArray(types) ? types : [types];

  if (typeArray.length === 0) return 'Unknown';

  // Special case: double households → "Households" (plural)
  if (typeArray.length === 2 && typeArray[0] === 'households' && typeArray[1] === 'households') {
    return 'Households';
  }

  if (typeArray.length === 1) return labels[typeArray[0]];

  // Multiple types: remove duplicates for labeling
  const uniqueTypes = Array.from(new Set(typeArray));
  const labelStrings = uniqueTypes.map(t => labels[t]);

  if (labelStrings.length === 2) {
    return `${labelStrings[0]} and ${labelStrings[1]}`;
  }

  // More than 2: use commas and "and"
  const lastLabel = labelStrings.pop();
  return `${labelStrings.join(', ')}, and ${lastLabel}`;
}
