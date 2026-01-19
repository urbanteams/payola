/**
 * Hex Grid Coordinate System
 *
 * Uses axial coordinates (q, r) for hexagons
 * Vertices are identified by their position relative to hexagons
 */

// Axial coordinate system for hexagons
export interface HexCoordinate {
  q: number; // Column
  r: number; // Row
}

// Vertex coordinates - identified by hex coordinate plus vertex index (0-5)
export interface VertexCoordinate {
  hexQ: number;
  hexR: number;
  vertexIndex: number; // 0-5, starting from top and going clockwise
}

// Vertex ID string format: "v_{hexQ}_{hexR}_{vertexIndex}"
export type VertexId = string;

// Edge ID string format: "e_{hex1Q}_{hex1R}_{hex2Q}_{hex2R}"
// Always use smaller q,r coordinates first for consistency
export type EdgeId = string;

// Convert vertex coordinate to unique string ID
export function vertexToId(vertex: VertexCoordinate): VertexId {
  return `v_${vertex.hexQ}_${vertex.hexR}_${vertex.vertexIndex}`;
}

// Parse vertex ID back to coordinate
export function idToVertex(id: VertexId): VertexCoordinate | null {
  const match = id.match(/^v_(-?\d+)_(-?\d+)_(\d+)$/);
  if (!match) return null;

  return {
    hexQ: parseInt(match[1]),
    hexR: parseInt(match[2]),
    vertexIndex: parseInt(match[3]),
  };
}

/**
 * Get the 6 vertices surrounding a hexagon
 * For FLAT-TOP hexagons, vertices are numbered 0-5 starting from right, going clockwise:
 *     5 _____ 0
 *      /     \
 *   4 |       | 1
 *      \_____/
 *     3       2
 */
export function getVerticesForHex(hex: HexCoordinate): VertexCoordinate[] {
  return [0, 1, 2, 3, 4, 5].map((vertexIndex) => ({
    hexQ: hex.q,
    hexR: hex.r,
    vertexIndex,
  }));
}

/**
 * Get the hexagons adjacent to a vertex
 * Each vertex is shared by up to 3 hexagons (or 2 for edge vertices, 1 for corner vertices)
 *
 * For FLAT-TOP hexagons, vertex mapping (using axial coordinates q, r):
 * - Vertex 0 (right): shared by current hex, hex at (q+1, r-1), and hex at (q+1, r)
 * - Vertex 1 (bottom-right): shared by current hex, hex at (q+1, r), and hex at (q, r+1)
 * - Vertex 2 (bottom-left): shared by current hex, hex at (q, r+1), and hex at (q-1, r+1)
 * - Vertex 3 (left): shared by current hex, hex at (q-1, r+1), and hex at (q-1, r)
 * - Vertex 4 (top-left): shared by current hex, hex at (q-1, r), and hex at (q, r-1)
 * - Vertex 5 (top-right): shared by current hex, hex at (q, r-1), and hex at (q+1, r-1)
 */
export function getAdjacentHexesForVertex(vertex: VertexCoordinate): HexCoordinate[] {
  const { hexQ, hexR, vertexIndex } = vertex;
  const currentHex: HexCoordinate = { q: hexQ, r: hexR };

  // Define the two other hexes that share each vertex (for flat-top orientation)
  const adjacentHexOffsets: Record<number, HexCoordinate[]> = {
    0: [{ q: hexQ + 1, r: hexR - 1 }, { q: hexQ + 1, r: hexR }],     // right vertex
    1: [{ q: hexQ + 1, r: hexR }, { q: hexQ, r: hexR + 1 }],         // bottom-right vertex
    2: [{ q: hexQ, r: hexR + 1 }, { q: hexQ - 1, r: hexR + 1 }],     // bottom-left vertex
    3: [{ q: hexQ - 1, r: hexR + 1 }, { q: hexQ - 1, r: hexR }],     // left vertex
    4: [{ q: hexQ - 1, r: hexR }, { q: hexQ, r: hexR - 1 }],         // top-left vertex
    5: [{ q: hexQ, r: hexR - 1 }, { q: hexQ + 1, r: hexR - 1 }],     // top-right vertex
  };

  return [currentHex, ...adjacentHexOffsets[vertexIndex]];
}

/**
 * Calculate hex control based on influence tokens
 * Returns the total influence each player has around this hex
 */
export function calculateHexControl(
  hex: HexCoordinate,
  tokens: Array<{
    vertexId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  allHexes: HexCoordinate[]
): Record<string, number> {
  const control: Record<string, number> = {};

  // Get all 6 vertices for this hex
  const vertices = getVerticesForHex(hex);

  for (const vertex of vertices) {
    const vertexId = vertexToId(vertex);
    const token = tokens.find((t) => t.vertexId === vertexId);

    if (!token) continue;

    // Parse token values (e.g., "4/0" -> [4, 0], "2/2" -> [2, 2], "1/3" -> [1, 3])
    const [valueA, valueB] = token.tokenType.split('/').map(Number);

    // Determine which value applies to this hex based on orientation
    // Get the 2-3 adjacent hexes for this vertex
    const adjacentHexes = getAdjacentHexesForVertex(vertex);

    // Find which of the adjacent hexes is our target hex
    const hexIndex = adjacentHexes.findIndex(
      (h) => h.q === hex.q && h.r === hex.r
    );

    if (hexIndex === -1) continue; // Shouldn't happen

    // Orientation "A" means valueA goes to first adjacent hex, valueB to second
    // Orientation "B" means valueB goes to first adjacent hex, valueA to second
    // Current hex is always first in the array
    let influence = 0;

    if (hexIndex === 0) {
      // This is the current hex
      influence = token.orientation === 'A' ? valueA : valueB;
    } else {
      // This is one of the adjacent hexes - check if it's mapped to the higher or lower value
      // For simplicity in orientation choice, we assume:
      // - Orientation A: current hex gets valueA
      // - Orientation B: current hex gets valueB
      // Adjacent hexes get the remaining values distributed
      // (In practice, the orientation choice in UI will show which specific hex gets which value)
      influence = token.orientation === 'A' ? valueB : valueA;
    }

    control[token.playerId] = (control[token.playerId] || 0) + influence;
  }

  return control;
}

/**
 * Find which player controls a hexagon (highest total influence)
 * Returns null if no tokens around the hex, or the controlling player ID
 * If there's a tie, returns array of tied player IDs
 */
export function getControllingPlayer(
  hex: HexCoordinate,
  tokens: Array<{
    vertexId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  allHexes: HexCoordinate[]
): string | string[] | null {
  const control = calculateHexControl(hex, tokens, allHexes);

  const entries = Object.entries(control);
  if (entries.length === 0) return null;

  const maxInfluence = Math.max(...entries.map(([, influence]) => influence));
  const winners = entries
    .filter(([, influence]) => influence === maxInfluence)
    .map(([playerId]) => playerId);

  if (winners.length === 1) return winners[0];
  return winners; // Tie
}

/**
 * Get all unique vertices from a set of hexagons
 */
export function getAllVertices(hexes: HexCoordinate[]): VertexId[] {
  const vertexSet = new Set<VertexId>();

  for (const hex of hexes) {
    const vertices = getVerticesForHex(hex);
    for (const vertex of vertices) {
      vertexSet.add(vertexToId(vertex));
    }
  }

  return Array.from(vertexSet);
}

/**
 * Get the 6 neighboring hexagon coordinates for flat-top orientation
 */
export function getNeighbors(hex: HexCoordinate): HexCoordinate[] {
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
 * Create an edge ID from two hexagon coordinates
 * Always orders by q first, then r, to ensure consistency
 */
export function createEdgeId(hex1: HexCoordinate, hex2: HexCoordinate): EdgeId {
  // Sort to ensure consistent ID regardless of order
  const [first, second] = [hex1, hex2].sort((a, b) => {
    if (a.q !== b.q) return a.q - b.q;
    return a.r - b.r;
  });
  return `e_${first.q}_${first.r}_${second.q}_${second.r}`;
}

/**
 * Get all edges (shared sides between hexagons)
 * Returns only edges that are shared between two hexagons in the map
 * Excludes edges at the map boundary
 */
export function getAllEdges(hexes: HexCoordinate[]): EdgeId[] {
  const edgeSet = new Set<EdgeId>();
  const hexSet = new Set(hexes.map(h => `${h.q}_${h.r}`));

  for (const hex of hexes) {
    const neighbors = getNeighbors(hex);

    for (const neighbor of neighbors) {
      // Only add edge if neighbor exists in our hex set
      if (hexSet.has(`${neighbor.q}_${neighbor.r}`)) {
        edgeSet.add(createEdgeId(hex, neighbor));
      }
    }
  }

  return Array.from(edgeSet);
}

/**
 * Calculate the pixel position for the center of an edge between two hexagons
 * For flat-top hexagons
 */
export function edgeToPixel(hex1: HexCoordinate, hex2: HexCoordinate, hexSize: number): { x: number; y: number } {
  // Get centers of both hexagons
  const center1 = hexToPixel(hex1, hexSize);
  const center2 = hexToPixel(hex2, hexSize);

  // Edge center is midpoint between hex centers
  return {
    x: (center1.x + center2.x) / 2,
    y: (center1.y + center2.y) / 2,
  };
}

/**
 * Calculate the rotation angle for a token placed on an edge
 * Returns angle in degrees for FLAT-TOP hexagons
 *
 * The token's dividing line must align with the edge between two hexagons.
 * In flat-top hexagons:
 * - Top/bottom edges are horizontal (0°)
 * - Upper-right and lower-left edges slant at 60° (↗)
 * - Upper-left and lower-right edges slant at -60° (↘)
 */
export function getEdgeRotation(hex1: HexCoordinate, hex2: HexCoordinate): number {
  const dq = hex2.q - hex1.q;
  const dr = hex2.r - hex1.r;

  // For flat-top hexagons in axial coordinates:

  if (dq === 0) {
    // Horizontal edges (top and bottom of hexagon)
    // dr = ±1
    return 0;
  } else if ((dq === 1 && dr === -1) || (dq === -1 && dr === 1)) {
    // Diagonal edges slanting from lower-left to upper-right (↗)
    // Upper-right edge: dq=1, dr=-1
    // Lower-left edge: dq=-1, dr=1
    return 60;
  } else {
    // Diagonal edges slanting from upper-left to lower-right (↘)
    // Upper-left/right edge: dq=-1, dr=0
    // Lower-right/left edge: dq=1, dr=0
    return -60;
  }
}

/**
 * Parse an edge ID back to hex coordinates
 */
export function parseEdgeId(edgeId: EdgeId): [HexCoordinate, HexCoordinate] | null {
  const match = edgeId.match(/^e_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)$/);
  if (!match) return null;

  return [
    { q: parseInt(match[1]), r: parseInt(match[2]) },
    { q: parseInt(match[3]), r: parseInt(match[4]) },
  ];
}

/**
 * Calculate pixel position for a hex in SVG coordinates
 * Using flat-top hexagon orientation
 */
export function hexToPixel(hex: HexCoordinate, hexSize: number): { x: number; y: number } {
  const x = hexSize * (3 / 2) * hex.q;
  const y = hexSize * Math.sqrt(3) * (hex.r + hex.q / 2);
  return { x, y };
}

/**
 * Calculate pixel position for a vertex in SVG coordinates
 * For flat-top hexagons (flat side on top/bottom)
 */
export function vertexToPixel(
  vertex: VertexCoordinate,
  hexSize: number
): { x: number; y: number } {
  const hexCenter = hexToPixel({ q: vertex.hexQ, r: vertex.hexR }, hexSize);

  // Vertex angles for flat-top hexagons (0° = right, going clockwise)
  // Vertices numbered 0-5 starting from right vertex
  const angles = [
    0,                    // 0: right (0°)
    Math.PI / 3,          // 1: bottom-right (60°)
    (2 * Math.PI) / 3,    // 2: bottom-left (120°)
    Math.PI,              // 3: left (180°)
    (4 * Math.PI) / 3,    // 4: top-left (240°)
    (5 * Math.PI) / 3,    // 5: top-right (300°)
  ];

  const angle = angles[vertex.vertexIndex];

  return {
    x: hexCenter.x + hexSize * Math.cos(angle),
    y: hexCenter.y + hexSize * Math.sin(angle),
  };
}

/**
 * Generate SVG polygon points for a hexagon (flat-top orientation)
 * Flat-top means the flat sides are horizontal (top and bottom)
 */
export function getHexagonPoints(centerX: number, centerY: number, size: number): string {
  const points: string[] = [];

  // For flat-top hexagons, start from right side (0°) and go clockwise
  // Vertices are at: 0°, 60°, 120°, 180°, 240°, 300°
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // 60-degree intervals starting from right (0°)
    const x = centerX + size * Math.cos(angle);
    const y = centerY + size * Math.sin(angle);
    points.push(`${x},${y}`);
  }

  return points.join(' ');
}
