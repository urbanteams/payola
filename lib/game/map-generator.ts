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
  | 'buzzHub' // 1 per map
  | 'moneyHub'; // 1 per map

export type MapType = 'NYC36' | 'NYC48';

export interface HexTile {
  coordinate: HexCoordinate;
  type: HexType;
  id: string; // Unique identifier: "hex_{q}_{r}"
  edgeCount: number; // Number of edges (token spaces) surrounding this hex
}

export interface MapLayout {
  mapType: 'NYC36' | 'NYC48';
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
 * NYC36 Fallback Map (3-4 players)
 * Used if random generation fails
 * 20 hexagons creating 36 edges
 */
const NYC36_POSITIONS: HexCoordinate[] = [
  // Row r=0 (2 hexes) - top
  { q: 4, r: 0 },
  { q: 5, r: 0 },

  // Row r=1 (3 hexes)
  { q: 3, r: 1 },
  { q: 4, r: 1 },
  { q: 5, r: 1 },

  // Row r=2 (5 hexes) - left wing + right section with gap
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 3, r: 2 },
  { q: 4, r: 2 },
  { q: 5, r: 2 },

  // Row r=3 (7 hexes) - widest section
  { q: 0, r: 3 },
  { q: 1, r: 3 },
  { q: 2, r: 3 },
  { q: 3, r: 3 },
  { q: 4, r: 3 },
  { q: 5, r: 3 },
  { q: 6, r: 3 },

  // Row r=4 (2 hexes) - bottom, scattered
  { q: 1, r: 4 },
  { q: 6, r: 4 },

  // Row r=5 (1 hex) - bottom right tip
  { q: 6, r: 5 },
]; // 20 hexes total = 36 edges

/**
 * NYC48 Fallback Map (5-6 players)
 * Used if random generation fails
 * 24 hexagons creating 48 edges
 */
const NYC48_POSITIONS: HexCoordinate[] = [
  // Row r=0 (3 hexes) - expanded top
  { q: 3, r: 0 },
  { q: 4, r: 0 },
  { q: 5, r: 0 },

  // Row r=1 (4 hexes)
  { q: 2, r: 1 },
  { q: 3, r: 1 },
  { q: 4, r: 1 },
  { q: 5, r: 1 },

  // Row r=2 (6 hexes) - left wing + right section with gap
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 3, r: 2 },
  { q: 4, r: 2 },
  { q: 5, r: 2 },

  // Row r=3 (8 hexes) - widest section
  { q: 0, r: 3 },
  { q: 1, r: 3 },
  { q: 2, r: 3 },
  { q: 3, r: 3 },
  { q: 4, r: 3 },
  { q: 5, r: 3 },
  { q: 6, r: 3 },
  { q: 7, r: 3 },

  // Row r=4 (2 hexes) - bottom scattered
  { q: 1, r: 4 },
  { q: 7, r: 4 },

  // Row r=5 (1 hex) - bottom right tip
  { q: 7, r: 5 },
]; // 24 hexes total = 48 edges

/**
 * Define hex type distribution based on player count
 * Creates distribution for variable number of hexes
 * Always includes: 1 buzzHub, 1 moneyHub, 2x each star type, rest are households
 */
function getHexTypeDistribution(
  totalHexes: number,
  playerCount: number
): HexType[] {
  const is56Player = playerCount >= 5;

  // Fixed special hexes (always exactly 1 of each)
  const distribution: HexType[] = ['buzzHub', 'moneyHub'];

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
function generateRandomMapLayout(targetEdges: number, maxAttempts: number = 50): HexCoordinate[] {
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
  return targetEdges === 36 ? NYC36_POSITIONS : NYC48_POSITIONS;
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
      type: shuffledTypes[index],
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
    buzzHub: '#FFFF00', // Bright yellow
    moneyHub: '#00FF00', // Bright green
  };

  return colors[type];
}

/**
 * Get hex label for accessibility/debugging
 */
export function getHexLabel(type: HexType): string {
  const labels: Record<HexType, string> = {
    households: 'Households',
    bluesStar: 'Blues Star',
    countryStar: 'Country Star',
    jazzStar: 'Jazz Star',
    rockStar: 'Rock Star',
    popStar: 'Pop Star',
    classicalStar: 'Classical Star',
    buzzHub: 'Buzz Hub',
    moneyHub: 'Money Hub',
  };

  return labels[type];
}
