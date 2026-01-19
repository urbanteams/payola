/**
 * Final Scoring Logic
 *
 * Calculates final scores at the end of the game:
 * - House control (1st/2nd/3rd place: 10/6/3 VP)
 * - Set collection (exponential: 1/3/6/10/15 VP)
 * - Lightning hex bonuses (already awarded during placement)
 *
 * IMPORTANT: VP splits use Math.floor() truncation, not rounding
 */

import { calculateHexControl, HexCoordinate } from './hex-grid';
import { MapLayout, HexType } from './map-generator';

export interface PlayerScore {
  playerId: string;
  playerName: string;

  // House scoring
  totalHouses: number;
  houseRank: number; // 1, 2, or 3
  houseVP: number; // 10, 6, or 3 (with potential splits)

  // Set collection
  collectedSymbols: HexType[]; // Unique symbols controlled
  symbolCount: number;
  setCollectionVP: number; // 1, 3, 6, 10, or 15

  // Lightning bonuses (already awarded)
  lightningVP: number;

  // Currency from dollar hexes (already awarded)
  dollarCurrency: number;

  // Final totals
  totalVP: number;
  finalRank: number; // Overall placement
}

export interface FinalResults {
  scores: PlayerScore[];
  winner: PlayerScore;
}

/**
 * Calculate house scoring
 * Each house hex is worth 2 houses if one player controls it, or 1 house each if tied
 * Final ranking: Most houses = 1st (10 VP), 2nd most = 2nd (6 VP), 3rd most = 3rd (3 VP)
 * Ties split the VP using Math.floor() truncation
 */
function calculateHouseScoring(
  players: Array<{ id: string; name: string }>,
  tokens: Array<{
    vertexId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  mapLayout: MapLayout
): Record<string, { totalHouses: number; rank: number; vp: number }> {
  const houseHexes = mapLayout.hexes.filter((h) => h.type === 'house');
  const playerHouses: Record<string, number> = {};

  // Initialize all players
  players.forEach((p) => {
    playerHouses[p.id] = 0;
  });

  // For each house hex, determine control
  for (const hex of houseHexes) {
    const control = calculateHexControl(hex.coordinate, tokens, mapLayout.hexes.map(h => h.coordinate));
    const entries = Object.entries(control);

    if (entries.length === 0) continue; // No one controls this hex

    const maxInfluence = Math.max(...entries.map(([, inf]) => inf));
    const controllers = entries.filter(([, inf]) => inf === maxInfluence).map(([pid]) => pid);

    // Award houses
    if (controllers.length === 1) {
      // Single controller gets 2 houses
      playerHouses[controllers[0]] += 2;
    } else {
      // Tied players each get 1 house
      controllers.forEach((pid) => {
        playerHouses[pid] += 1;
      });
    }
  }

  // Rank players by total houses
  const sortedPlayers = Object.entries(playerHouses).sort(([, a], [, b]) => b - a);

  // Assign ranks and VP with tie-splitting
  const results: Record<string, { totalHouses: number; rank: number; vp: number }> = {};
  const vpAwards = [10, 6, 3]; // 1st, 2nd, 3rd place VP

  let currentRank = 1;
  let i = 0;

  while (i < sortedPlayers.length && currentRank <= 3) {
    const [playerId, houses] = sortedPlayers[i];

    // Find all players tied at this house count
    const tiedPlayers = sortedPlayers.filter(([, h]) => h === houses);

    if (tiedPlayers.length === 1) {
      // No tie, award full VP
      results[playerId] = {
        totalHouses: houses,
        rank: currentRank,
        vp: vpAwards[currentRank - 1] || 0,
      };
      i++;
      currentRank++;
    } else {
      // Tie: split VP for tied ranks
      // If tied for 1st, split 10+6 = 16
      // If tied for 2nd, split 6+3 = 9
      // If tied for 3rd (only in 5-6 player), split just 3

      let totalVPToSplit = 0;
      for (let r = currentRank; r < currentRank + tiedPlayers.length && r <= 3; r++) {
        totalVPToSplit += vpAwards[r - 1] || 0;
      }

      const vpPerPlayer = Math.floor(totalVPToSplit / tiedPlayers.length);

      tiedPlayers.forEach(([pid, h]) => {
        results[pid] = {
          totalHouses: h,
          rank: currentRank,
          vp: vpPerPlayer,
        };
      });

      i += tiedPlayers.length;
      currentRank += tiedPlayers.length;
    }
  }

  // Fill in remaining players with 0 VP
  players.forEach((p) => {
    if (!results[p.id]) {
      results[p.id] = {
        totalHouses: playerHouses[p.id] || 0,
        rank: currentRank,
        vp: 0,
      };
    }
  });

  return results;
}

/**
 * Calculate set collection scoring
 * Exponential rewards: 1/3/6/10/15 VP for 1/2/3/4/5 unique symbols
 * In 5-6 player games, there are 6 collectibles (including singer)
 */
function calculateSetCollectionScoring(
  players: Array<{ id: string; name: string }>,
  tokens: Array<{
    vertexId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  mapLayout: MapLayout
): Record<string, { symbols: HexType[]; count: number; vp: number }> {
  const collectibleTypes: HexType[] = ['trumpet', 'cowboy', 'saxophone', 'guitar', 'microphone'];

  // Add singer for 5-6 player games
  if (mapLayout.playerCount >= 5) {
    collectibleTypes.push('singer');
  }

  const collectibleHexes = mapLayout.hexes.filter((h) => collectibleTypes.includes(h.type));
  const playerSymbols: Record<string, Set<HexType>> = {};

  // Initialize all players
  players.forEach((p) => {
    playerSymbols[p.id] = new Set();
  });

  // For each collectible hex, determine who controls it
  for (const hex of collectibleHexes) {
    const control = calculateHexControl(hex.coordinate, tokens, mapLayout.hexes.map(h => h.coordinate));
    const entries = Object.entries(control);

    if (entries.length === 0) continue;

    const maxInfluence = Math.max(...entries.map(([, inf]) => inf));
    const controllers = entries.filter(([, inf]) => inf === maxInfluence).map(([pid]) => pid);

    // All tied controllers get the symbol
    controllers.forEach((pid) => {
      if (playerSymbols[pid]) {
        playerSymbols[pid].add(hex.type);
      }
    });
  }

  // Calculate VP based on unique symbol count
  const vpByCount = [0, 1, 3, 6, 10, 15, 21]; // Index = count, value = VP
  // (Index 0 unused, index 6 is for potential 6-symbol completion in 5-6 player)

  const results: Record<string, { symbols: HexType[]; count: number; vp: number }> = {};

  players.forEach((p) => {
    const symbols = Array.from(playerSymbols[p.id] || []);
    const count = symbols.length;
    const vp = vpByCount[count] || 0;

    results[p.id] = { symbols, count, vp };
  });

  return results;
}

/**
 * Generate final results for a game
 * Aggregates all scoring components and determines winner
 */
export async function generateFinalResults(
  players: Array<{ id: string; name: string; victoryPoints: number }>,
  tokens: Array<{
    vertexId: string;
    playerId: string;
    tokenType: string;
    orientation: string;
  }>,
  mapLayout: MapLayout
): Promise<FinalResults> {
  // Calculate house scoring
  const houseScores = calculateHouseScoring(players, tokens, mapLayout);

  // Calculate set collection scoring
  const setCollectionScores = calculateSetCollectionScoring(players, tokens, mapLayout);

  // Build player scores
  const scores: PlayerScore[] = players.map((player) => {
    const house = houseScores[player.id] || { totalHouses: 0, rank: 999, vp: 0 };
    const setCollection = setCollectionScores[player.id] || { symbols: [], count: 0, vp: 0 };

    // Lightning VP already in player.victoryPoints
    const lightningVP = player.victoryPoints || 0;

    // Calculate total VP
    const totalVP = house.vp + setCollection.vp + lightningVP;

    return {
      playerId: player.id,
      playerName: player.name,
      totalHouses: house.totalHouses,
      houseRank: house.rank,
      houseVP: house.vp,
      collectedSymbols: setCollection.symbols,
      symbolCount: setCollection.count,
      setCollectionVP: setCollection.vp,
      lightningVP,
      dollarCurrency: 0, // Currency doesn't affect VP
      totalVP,
      finalRank: 0, // Will be assigned below
    };
  });

  // Sort by total VP (descending) and assign final ranks
  scores.sort((a, b) => b.totalVP - a.totalVP);

  let currentRank = 1;
  for (let i = 0; i < scores.length; i++) {
    if (i > 0 && scores[i].totalVP < scores[i - 1].totalVP) {
      currentRank = i + 1;
    }
    scores[i].finalRank = currentRank;
  }

  // Determine winner (highest VP, ties share 1st place)
  const winner = scores[0];

  return {
    scores,
    winner,
  };
}

/**
 * Format scoring breakdown for display
 */
export function formatScoringBreakdown(score: PlayerScore): string {
  return `
${score.playerName}:
  Houses: ${score.totalHouses} (Rank ${score.houseRank}) = ${score.houseVP} VP
  Symbols: ${score.symbolCount} unique = ${score.setCollectionVP} VP
  Lightning Bonuses: ${score.lightningVP} VP
  TOTAL: ${score.totalVP} VP
  `.trim();
}
