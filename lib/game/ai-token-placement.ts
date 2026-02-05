/**
 * AI Token Placement Logic
 *
 * Handles automatic token placement for AI players
 *
 * STRATEGIC PRIORITIES:
 * 1. Close hexagons (2 total edges or only 1 unfilled edge)
 * 2. Avoid duplicate star types already collected
 * 3. Use minimum value needed to win/tie
 * 4. Fall back to random placement if any issues
 */

import { prisma } from '@/lib/prisma';
import { deserializeMapLayout, MapLayout, HexType, getHexTypes } from '@/lib/game/map-generator';
import { calculateImmediateReward } from '@/lib/game/token-placement-logic';
import { parseEdgeId, createEdgeId, calculateHexControl, HexCoordinate, EdgeId } from '@/lib/game/hex-grid';

const TOKEN_TYPES = ['4/0', '3/1', '2/2'] as const;
const ORIENTATIONS = ['A', 'B'] as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get all edges adjacent to a specific hexagon
 */
function getEdgesForHex(hexCoord: HexCoordinate, mapLayout: MapLayout): EdgeId[] {
  const allEdges = mapLayout.edges;
  return allEdges.filter(edgeId => {
    const hexPair = parseEdgeId(edgeId);
    if (!hexPair) return false;
    const [hex1, hex2] = hexPair;
    return (hex1.q === hexCoord.q && hex1.r === hexCoord.r) ||
           (hex2.q === hexCoord.q && hex2.r === hexCoord.r);
  });
}

/**
 * Get edges that already have tokens placed on them for a specific hex
 */
function getFilledEdgesForHex(
  hexCoord: HexCoordinate,
  existingTokens: Array<{ edgeId: string }>,
  mapLayout: MapLayout
): EdgeId[] {
  const hexEdges = getEdgesForHex(hexCoord, mapLayout);
  const filledEdgeIds = new Set(existingTokens.map(t => t.edgeId));
  return hexEdges.filter(edgeId => filledEdgeIds.has(edgeId));
}

/**
 * Get edges that have 0/0 tokens (NPC or blank tokens that don't contribute)
 * These are functionally equivalent to non-existent edges
 */
function getZeroEdgesForHex(
  hexCoord: HexCoordinate,
  existingTokens: Array<{ edgeId: string; tokenType: string }>,
  mapLayout: MapLayout
): EdgeId[] {
  const hexEdges = getEdgesForHex(hexCoord, mapLayout);
  return hexEdges.filter(edgeId => {
    const token = existingTokens.find(t => t.edgeId === edgeId);
    return token && token.tokenType === '0/0';
  });
}

/**
 * Calculate effective edge count (total edges minus 0/0 token edges)
 */
function getEffectiveEdgeCount(
  hexCoord: HexCoordinate,
  existingTokens: Array<{ edgeId: string; tokenType: string }>,
  mapLayout: MapLayout
): number {
  const totalEdges = getEdgesForHex(hexCoord, mapLayout).length;
  const zeroEdges = getZeroEdgesForHex(hexCoord, existingTokens, mapLayout).length;
  return totalEdges - zeroEdges;
}

/**
 * Calculate current player scores on a hexagon (using edge-based tokens)
 * Adapted from end-game-scoring.ts calculateHexInfluence
 */
function calculateCurrentScores(
  hexCoord: HexCoordinate,
  existingTokens: Array<{
    edgeId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  mapLayout: MapLayout
): Record<string, number> {
  const influence: Record<string, number> = {};

  for (const token of existingTokens) {
    // Parse edge to get adjacent hexes
    const hexPair = parseEdgeId(token.edgeId);
    if (!hexPair) continue;

    const [hex1Coord, hex2Coord] = hexPair;

    // Check if this token is adjacent to the target hex
    const isHex1 = hex1Coord.q === hexCoord.q && hex1Coord.r === hexCoord.r;
    const isHex2 = hex2Coord.q === hexCoord.q && hex2Coord.r === hexCoord.r;

    if (!isHex1 && !isHex2) continue;

    // Parse token values
    const [valueA, valueB] = token.tokenType.split('/').map(Number);

    // Calculate edge direction to detect if visual orientation needs flipping
    const dq = hex2Coord.q - hex1Coord.q;
    const dr = hex2Coord.r - hex1Coord.r;

    // For 60° diagonal edges (dq=1, dr=-1), the visual rotation causes the values to appear flipped
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
    influence[token.playerId] = (influence[token.playerId] || 0) + influenceValue;
  }

  return influence;
}

/**
 * Get star types that a player has already collected (winning or tied)
 */
function getPlayerStarCollection(
  playerId: string,
  existingTokens: Array<{
    edgeId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  mapLayout: MapLayout
): Set<HexType> {
  const collectedStars = new Set<HexType>();
  const starTypes: HexType[] = ['bluesStar', 'countryStar', 'jazzStar', 'rockStar', 'popStar', 'classicalStar'];

  const starHexes = mapLayout.hexes.filter(h =>
    getHexTypes(h).some(type => starTypes.includes(type))
  );

  for (const hex of starHexes) {
    const scores = calculateCurrentScores(hex.coordinate, existingTokens, mapLayout);

    if (scores[playerId] === undefined || scores[playerId] === 0) continue;

    const maxScore = Math.max(...Object.values(scores));

    // Player has collected this star if they're winning or tied for the lead
    if (scores[playerId] === maxScore) {
      getHexTypes(hex).forEach(type => {
        if (starTypes.includes(type)) {
          collectedStars.add(type);
        }
      });
    }
  }

  return collectedStars;
}

/**
 * Check if a hexagon is closable (can be won by filling the last space)
 * Returns the unfilled edge if closable, null otherwise
 *
 * IMPORTANT: Treats 0/0 tokens as non-existent (e.g., 3 edges with one 0/0 = effectively 2 edges)
 */
function getClosableEdge(
  hexCoord: HexCoordinate,
  highlightedEdges: EdgeId[],
  existingTokens: Array<{ edgeId: string; tokenType: string }>,
  mapLayout: MapLayout
): EdgeId | null {
  const allEdges = getEdgesForHex(hexCoord, mapLayout);
  const filledEdges = getFilledEdgesForHex(hexCoord, existingTokens, mapLayout);
  const zeroEdges = getZeroEdgesForHex(hexCoord, existingTokens, mapLayout);
  const highlightedSet = new Set(highlightedEdges);

  const totalEdges = allEdges.length;
  const effectiveEdges = totalEdges - zeroEdges.length; // Subtract 0/0 tokens
  const filledCount = filledEdges.length;

  // Case 1: Hex has effectively 2 edges (might be 2 total, or 3+ with 0/0 tokens)
  // Example: 3 edges total with one 0/0 token = 2 effective edges
  if (effectiveEdges === 2) {
    // Get highlighted edges that aren't 0/0 tokens
    const highlightedForThisHex = allEdges.filter(e =>
      highlightedSet.has(e) && !zeroEdges.includes(e)
    );
    if (highlightedForThisHex.length > 0) {
      // Return any highlighted edge (prioritize unfilled ones)
      const unfilledHighlighted = highlightedForThisHex.find(e => !filledEdges.includes(e));
      return unfilledHighlighted || highlightedForThisHex[0];
    }
  }

  // Case 2: Only 1 edge remains unfilled and it's highlighted
  if (filledCount === totalEdges - 1) {
    const unfilledEdges = allEdges.filter(e => !filledEdges.includes(e));
    if (unfilledEdges.length === 1 && highlightedSet.has(unfilledEdges[0])) {
      return unfilledEdges[0];
    }
  }

  return null;
}

/**
 * Find all edges that can close valuable hexagons
 */
interface ClosableOption {
  edgeId: EdgeId;
  hexCoord: HexCoordinate;
  hexTypes: HexType[];
  currentScores: Record<string, number>;
  totalEdges: number;
  effectiveEdges: number; // totalEdges minus 0/0 token edges
}

function findClosableHexes(
  playerId: string,
  highlightedEdges: EdgeId[],
  existingTokens: Array<{
    edgeId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  mapLayout: MapLayout,
  playerStars: Set<HexType>
): ClosableOption[] {
  const closableOptions: ClosableOption[] = [];
  const starTypes: HexType[] = ['bluesStar', 'countryStar', 'jazzStar', 'rockStar', 'popStar', 'classicalStar'];

  // Check each hexagon to see if it's closable
  for (const hex of mapLayout.hexes) {
    const closableEdge = getClosableEdge(hex.coordinate, highlightedEdges, existingTokens, mapLayout);

    if (!closableEdge) continue;

    const hexTypes = getHexTypes(hex);
    const currentScores = calculateCurrentScores(hex.coordinate, existingTokens, mapLayout);
    const totalEdges = getEdgesForHex(hex.coordinate, mapLayout).length;
    const effectiveEdges = getEffectiveEdgeCount(hex.coordinate, existingTokens, mapLayout);

    // Skip if this hex has a star type we've already collected
    const hasAlreadyCollectedStar = hexTypes.some(type =>
      starTypes.includes(type) && playerStars.has(type)
    );

    if (hasAlreadyCollectedStar) continue;

    closableOptions.push({
      edgeId: closableEdge,
      hexCoord: hex.coordinate,
      hexTypes,
      currentScores,
      totalEdges,
      effectiveEdges,
    });
  }

  return closableOptions;
}

/**
 * Calculate the minimum value needed to win or tie a hexagon
 * Returns the minimum value (0-4) or null if impossible to win
 */
function calculateMinimumWinningValue(
  playerId: string,
  hexCoord: HexCoordinate,
  currentScores: Record<string, number>
): number | null {
  const playerScore = currentScores[playerId] || 0;
  const otherScores = Object.entries(currentScores)
    .filter(([pid]) => pid !== playerId)
    .map(([, score]) => score);

  if (otherScores.length === 0) {
    // No competition, minimum value of 1 is enough
    return 1;
  }

  const maxOtherScore = Math.max(...otherScores);

  // Calculate how much we need to add to win or tie
  const neededToTie = maxOtherScore - playerScore;
  const neededToWin = maxOtherScore - playerScore + 1;

  // If we need more than 4 to tie, we can't win
  if (neededToTie > 4) return null;

  // Return the minimum value needed to tie (we accept ties)
  return Math.max(neededToTie, 1);
}

/**
 * Choose the best token type and orientation for a closable hex
 * OPTIMIZED: Considers both hexagons to minimize waste
 */
interface TokenChoice {
  tokenType: string;
  orientation: string;
}

function chooseTokenForClosableHex(
  playerId: string,
  edgeId: EdgeId,
  hexCoord: HexCoordinate,
  currentScores: Record<string, number>,
  totalEdgesForHex: number,
  effectiveEdgesForHex: number,
  isNPCPlayer: boolean,
  existingTokens: Array<{
    edgeId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  mapLayout: MapLayout
): TokenChoice | null {
  if (isNPCPlayer) {
    return { tokenType: '0/0', orientation: 'A' };
  }

  const hexPair = parseEdgeId(edgeId);
  if (!hexPair) return null;

  const [hex1Coord, hex2Coord] = hexPair;

  // Check if this edge needs orientation flipping
  const dq = hex2Coord.q - hex1Coord.q;
  const dr = hex2Coord.r - hex1Coord.r;
  const needsFlip = (dq === 1 && dr === -1);

  // Determine which hex is the "target" (closable one)
  const isHex1Target = hex1Coord.q === hexCoord.q && hex1Coord.r === hexCoord.r;

  // Calculate scores and requirements for BOTH hexagons
  const hex1Scores = calculateCurrentScores(hex1Coord, existingTokens, mapLayout);
  const hex2Scores = calculateCurrentScores(hex2Coord, existingTokens, mapLayout);

  const hex1MinNeeded = calculateMinimumWinningValue(playerId, hex1Coord, hex1Scores) || 0;
  const hex2MinNeeded = calculateMinimumWinningValue(playerId, hex2Coord, hex2Scores) || 0;

  console.log(`Optimizing distribution for edge between hex1(${hex1Coord.q},${hex1Coord.r}) and hex2(${hex2Coord.q},${hex2Coord.r})`);
  console.log(`  Hex1 needs: ${hex1MinNeeded}, Hex2 needs: ${hex2MinNeeded}, Target: ${isHex1Target ? 'hex1' : 'hex2'}`);
  console.log(`  Target hex effectiveEdges: ${effectiveEdgesForHex}`);

  // CRITICAL: For 2-effective-edge hexagons, target MUST get 4
  // For other hexagons, optimize distribution between both hexes
  const is2EdgeHex = effectiveEdgesForHex === 2;

  const targetMinNeeded = isHex1Target ? hex1MinNeeded : hex2MinNeeded;
  const otherMinNeeded = isHex1Target ? hex2MinNeeded : hex1MinNeeded;

  const targetRequired = is2EdgeHex ? 4 : targetMinNeeded;

  console.log(`  Requirements - Target: ${targetRequired} (2-edge: ${is2EdgeHex}), Other: ${otherMinNeeded}`);

  // Find optimal token type and orientation
  const tokenOptions = [
    { type: '4/0', values: [4, 0] },
    { type: '3/1', values: [3, 1] },
    { type: '2/2', values: [2, 2] },
  ];

  let bestChoice: { tokenType: string; orientation: string; waste: number; hex1Gets: number; hex2Gets: number } | null = null;

  for (const token of tokenOptions) {
    // Try both orientations, accounting for edge flipping
    for (const orientation of ['A', 'B'] as const) {
      // Calculate which hex gets which value based on orientation and flip
      let hex1Gets: number, hex2Gets: number;

      if (needsFlip) {
        // Flipped edge: orientation is reversed
        if (orientation === 'A') {
          hex1Gets = token.values[1];
          hex2Gets = token.values[0];
        } else {
          hex1Gets = token.values[0];
          hex2Gets = token.values[1];
        }
      } else {
        // Normal edge: standard orientation
        if (orientation === 'A') {
          hex1Gets = token.values[0];
          hex2Gets = token.values[1];
        } else {
          hex1Gets = token.values[1];
          hex2Gets = token.values[0];
        }
      }

      const targetGets = isHex1Target ? hex1Gets : hex2Gets;
      const otherGets = isHex1Target ? hex2Gets : hex1Gets;

      // TARGET MUST BE SATISFIED (non-negotiable)
      if (targetGets < targetRequired) continue;

      // For non-2-edge hexagons, try to satisfy both
      if (!is2EdgeHex && otherGets < otherMinNeeded) continue;

      // Calculate waste (points beyond minimum needed)
      const targetWaste = Math.max(0, targetGets - targetRequired);
      const otherWaste = Math.max(0, otherGets - otherMinNeeded);
      const totalWaste = targetWaste + otherWaste;

      // Update best choice if this is better (less waste)
      if (bestChoice === null || totalWaste < bestChoice.waste) {
        bestChoice = { tokenType: token.type, orientation, waste: totalWaste, hex1Gets, hex2Gets };
      }
    }
  }

  if (!bestChoice) {
    console.log(`  ERROR: No valid token found! targetRequired=${targetRequired}, otherMinNeeded=${otherMinNeeded}`);
    return null;
  }

  const targetGets = isHex1Target ? bestChoice.hex1Gets : bestChoice.hex2Gets;
  console.log(`  ✓ Best choice: ${bestChoice.tokenType} (${bestChoice.orientation})`);
  console.log(`    Hex1 gets ${bestChoice.hex1Gets}, Hex2 gets ${bestChoice.hex2Gets}`);
  console.log(`    Target gets ${targetGets} (required: ${targetRequired}), Waste: ${bestChoice.waste}`);

  // SAFETY CHECK: For 2-edge hexagons, ensure we're giving 4 to target
  if (is2EdgeHex && targetGets !== 4) {
    console.error(`  CRITICAL ERROR: 2-edge hex but target only gets ${targetGets} instead of 4!`);
    console.error(`    Falling back to 4/0 token`);
    // Force 4/0 with correct orientation
    const force4Orientation = isHex1Target ? (needsFlip ? 'B' : 'A') : (needsFlip ? 'A' : 'B');
    return { tokenType: '4/0', orientation: force4Orientation };
  }

  return { tokenType: bestChoice.tokenType, orientation: bestChoice.orientation };
}

// ==================== MAIN PLACEMENT LOGIC ====================

/**
 * Place a token for the current AI player and advance turn
 * Returns true if more AI players need to place tokens
 */
export async function processAITokenPlacement(gameId: string): Promise<boolean> {
  try {
    // Get game state
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
      },
    });

    if (!game || (game.status !== 'TOKEN_PLACEMENT' && game.status !== 'FINAL_PLACEMENT')) {
      return false;
    }

    if (!game.highlightedEdges) {
      return false;
    }

    // Get turn order based on status and winning song
    const getTurnOrder = (): string[] => {
      // For FINAL_PLACEMENT, use turnOrderA which stores the money-based turn order
      if (game.status === 'FINAL_PLACEMENT' && game.turnOrderA) {
        return JSON.parse(game.turnOrderA);
      }
      // For regular TOKEN_PLACEMENT, use song-based turn order
      if (game.winningSong === 'A' && game.turnOrderA) return JSON.parse(game.turnOrderA);
      if (game.winningSong === 'B' && game.turnOrderB) return JSON.parse(game.turnOrderB);
      if (game.winningSong === 'C' && game.turnOrderC) return JSON.parse(game.turnOrderC);
      if (game.winningSong === 'D' && game.turnOrderD) return JSON.parse(game.turnOrderD);
      return [];
    };

    const turnOrder = getTurnOrder();
    const currentTurnIndex = game.currentTurnIndex ?? 0;

    if (currentTurnIndex >= turnOrder.length) {
      return false;
    }

    const currentTurnPlayerId = turnOrder[currentTurnIndex];
    const currentPlayer = game.players.find(p => p.id === currentTurnPlayerId);

    // Check if current player is AI or NPC
    const isNPCPlayer = currentPlayer?.name === 'NPC';

    if (!currentPlayer) {
      console.error(`ERROR: Player ID '${currentTurnPlayerId}' from turn order not found in game players`);
      console.error(`Turn order: ${JSON.stringify(turnOrder)}`);
      console.error(`Game players: ${game.players.map(p => `${p.name}(${p.id})`).join(', ')}`);
      console.error(`Game variant: ${game.gameVariant}, isMultiMap: ${game.isMultiMap}`);
      return false;
    }

    if (!currentPlayer.isAI && !isNPCPlayer) {
      return false;
    }

    // Get existing tokens to avoid duplicates
    // For FINAL_PLACEMENT, check all tokens across all rounds
    // For regular rounds, only check tokens from current round
    const existingTokens = await prisma.influenceToken.findMany({
      where: game.status === 'FINAL_PLACEMENT'
        ? { gameId }
        : { gameId, roundNumber: game.roundNumber },
      select: { edgeId: true },
    });

    const highlightedEdges = JSON.parse(game.highlightedEdges);
    const occupiedEdges = new Set(existingTokens.map(t => t.edgeId));
    const availableEdges = highlightedEdges.filter((edge: string) => !occupiedEdges.has(edge));

    if (availableEdges.length === 0) {
      console.error('No available edges for AI placement');
      return false;
    }

    // SMART PLACEMENT LOGIC
    let selectedEdge: string;
    let selectedTokenType: string;
    let selectedOrientation: string;

    try {
      // For NPC players, always use random placement with blank tokens
      if (isNPCPlayer) {
        selectedEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
        selectedTokenType = '0/0';
        selectedOrientation = 'A';
      } else if (!game.mapLayout) {
        // No map layout, fall back to random
        throw new Error('No map layout available');
      } else {
        const mapLayout = deserializeMapLayout(game.mapLayout);

        // Get all existing tokens (edge-based)
        const allTokens = await prisma.influenceToken.findMany({
          where: { gameId },
          select: {
            edgeId: true,
            playerId: true,
            tokenType: true,
            orientation: true,
          },
        });

        // Get player's current star collection
        const playerStars = getPlayerStarCollection(currentPlayer.id, allTokens, mapLayout);

        // Find closable hexagons
        const closableOptions = findClosableHexes(
          currentPlayer.id,
          availableEdges,
          allTokens,
          mapLayout,
          playerStars
        );

        if (closableOptions.length > 0) {
          // PRIORITY 1: Close a hex!
          // Pick random closable option
          const chosen = closableOptions[Math.floor(Math.random() * closableOptions.length)];

          // Log detailed info about chosen hex
          console.log(`AI ${currentPlayer.name} found ${closableOptions.length} closable hex(es)`);
          console.log(`Chosen hex: (${chosen.hexCoord.q},${chosen.hexCoord.r}), totalEdges: ${chosen.totalEdges}, effectiveEdges: ${chosen.effectiveEdges}, types: ${chosen.hexTypes.join(', ')}`);
          console.log(`Current scores on hex:`, chosen.currentScores);

          // Choose optimal token and orientation (considers both hexagons)
          const tokenChoice = chooseTokenForClosableHex(
            currentPlayer.id,
            chosen.edgeId,
            chosen.hexCoord,
            chosen.currentScores,
            chosen.totalEdges,
            chosen.effectiveEdges,
            false,
            allTokens,
            mapLayout
          );

          if (tokenChoice) {
            selectedEdge = chosen.edgeId;
            selectedTokenType = tokenChoice.tokenType;
            selectedOrientation = tokenChoice.orientation;

            const hexTypeStr = chosen.effectiveEdges === 2
              ? `${chosen.effectiveEdges}-effective-edge hex (${chosen.totalEdges} total - MUST USE 4)`
              : `${chosen.effectiveEdges}-edge hex`;
            console.log(`AI ${currentPlayer.name} is closing ${hexTypeStr} at (${chosen.hexCoord.q},${chosen.hexCoord.r}) with ${selectedTokenType} (${selectedOrientation})`);
          } else {
            // Couldn't determine optimal token, fall back
            throw new Error('Could not determine optimal token for closable hex');
          }
        } else {
          // No closable hexes, fall back to random
          throw new Error('No closable hexes available');
        }
      }
    } catch (error) {
      // FALLBACK: Random placement if any errors occur
      console.log(`AI ${currentPlayer.name} falling back to random placement:`, error instanceof Error ? error.message : 'Unknown error');
      selectedEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
      selectedTokenType = isNPCPlayer ? '0/0' : TOKEN_TYPES[Math.floor(Math.random() * TOKEN_TYPES.length)];
      selectedOrientation = isNPCPlayer ? 'A' : ORIENTATIONS[Math.floor(Math.random() * ORIENTATIONS.length)];
    }

    // Create token
    await prisma.influenceToken.create({
      data: {
        gameId,
        playerId: currentPlayer.id,
        roundNumber: game.roundNumber,
        edgeId: selectedEdge,
        tokenType: selectedTokenType,
        orientation: selectedOrientation,
      },
    });

    console.log(`AI ${currentPlayer.name} placed token ${selectedTokenType} (${selectedOrientation}) on edge ${selectedEdge}`);

    // Calculate and apply immediate rewards (money hub bonuses)
    if (game.mapLayout) {
      const mapLayout = deserializeMapLayout(game.mapLayout);
      const immediateReward = calculateImmediateReward(
        selectedEdge,
        selectedTokenType,
        selectedOrientation,
        mapLayout
      );

      if (immediateReward) {
        if (immediateReward.victoryPoints !== undefined) {
          await prisma.player.update({
            where: { id: currentPlayer.id },
            data: {
              victoryPoints: currentPlayer.victoryPoints + immediateReward.victoryPoints,
            },
          });
        }

        if (immediateReward.currency !== undefined) {
          await prisma.player.update({
            where: { id: currentPlayer.id },
            data: {
              currencyBalance: currentPlayer.currencyBalance + immediateReward.currency,
            },
          });
        }

        console.log(`AI ${currentPlayer.name} received immediate reward:`, immediateReward);
      }
    }

    // Advance turn
    const nextTurnIndex = currentTurnIndex + 1;
    const allTokensPlaced = nextTurnIndex >= turnOrder.length;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        currentTurnIndex: nextTurnIndex,
        placementTimeout: allTokensPlaced ? null : new Date(Date.now() + 90000),
      },
    });

    // Check if next player is also AI or NPC
    if (!allTokensPlaced) {
      const nextPlayerId = turnOrder[nextTurnIndex];
      const nextPlayer = game.players.find(p => p.id === nextPlayerId);
      const nextIsNPC = nextPlayer?.name === 'NPC';
      return nextPlayer?.isAI === true || nextIsNPC;
    }

    return false; // All tokens placed
  } catch (error) {
    console.error('AI token placement error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    return false;
  }
}

/**
 * Process all consecutive AI token placements
 * Continues until a human player's turn or all tokens are placed
 * Returns true if all tokens for this round have been placed
 */
export async function processAllAITokenPlacements(gameId: string): Promise<boolean> {
  let hasMoreAI = true;
  let attempts = 0;
  const maxAttempts = 20; // Safety limit

  while (hasMoreAI && attempts < maxAttempts) {
    hasMoreAI = await processAITokenPlacement(gameId);
    attempts++;

    // Small delay to avoid overwhelming the database
    if (hasMoreAI) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  if (attempts >= maxAttempts) {
    console.error('Max AI token placement attempts reached - possible infinite loop');
  }

  // Check if all tokens are now placed
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) return false;

  const getTurnOrder = (): string[] => {
    // For FINAL_PLACEMENT, use turnOrderA which stores the money-based turn order
    if (game.status === 'FINAL_PLACEMENT' && game.turnOrderA) {
      return JSON.parse(game.turnOrderA);
    }
    // For regular TOKEN_PLACEMENT, use song-based turn order
    if (game.winningSong === 'A' && game.turnOrderA) return JSON.parse(game.turnOrderA);
    if (game.winningSong === 'B' && game.turnOrderB) return JSON.parse(game.turnOrderB);
    if (game.winningSong === 'C' && game.turnOrderC) return JSON.parse(game.turnOrderC);
    if (game.winningSong === 'D' && game.turnOrderD) return JSON.parse(game.turnOrderD);
    return [];
  };

  const turnOrder = getTurnOrder();
  const currentTurnIndex = game.currentTurnIndex ?? 0;

  // All tokens placed if we've gone through the entire turn order
  return currentTurnIndex >= turnOrder.length;
}
