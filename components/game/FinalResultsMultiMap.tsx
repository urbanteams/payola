"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MapViewer } from "./MapViewer";
import { deserializeMapLayout } from "@/lib/game/map-generator";
import {
  calculateSymbolsCollected,
  calculatePowerHubScores,
  calculateStarPoints,
  calculateHouseholdPoints,
  checkAutoWin,
  calculateMoneyPoints,
} from "@/lib/game/end-game-scoring";
import { deserializeInventory, calculateTotalValue } from "@/lib/game/card-inventory";

interface FinalResultsMultiMapProps {
  gameId: string;
  firstMapResults: string;
  firstMapLayout: string;
  secondMapLayout: string;
  players: Array<{
    id: string;
    name: string;
    playerColor: string | null;
    currencyBalance?: number | null;
    cardInventory?: string | null;
  }>;
  tokens: Array<{
    id: string;
    edgeId: string;
    playerId: string;
    playerName: string;
    playerColor: string | null;
    tokenType: string;
    orientation: string;
    roundNumber: number;
  }>;
}

export function FinalResultsMultiMap({
  gameId,
  firstMapResults,
  firstMapLayout,
  secondMapLayout,
  players,
  tokens,
}: FinalResultsMultiMapProps) {
  const router = useRouter();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const playerCount = players.length;

  // Generate dynamic star scoring explanation
  const starScoringExplanation = playerCount === 6
    ? "Points awarded for collecting unique star types (not quantity). 1 type = 10 pts, 2 types = 25 pts, 3 types = 45 pts, 4 types = 70 pts, 5 types = 100 pts. Collecting all 6 types results in an automatic victory."
    : "Points awarded for collecting unique star types (not quantity). 1 type = 10 pts, 2 types = 25 pts, 3 types = 45 pts, 4 types = 70 pts, 5 types = 100 pts.";

  // Generate dynamic household scoring explanation based on player count
  let householdScoringExplanation = "Competitive scoring based on household collection ranking. ";
  if (playerCount <= 4) {
    householdScoringExplanation += "First place = 50 pts, Second place = 20 pts. ";
  } else {
    householdScoringExplanation += "First place = 50 pts, Second place = 30 pts, Third place = 20 pts. ";
  }
  householdScoringExplanation += "Tied players share points for their placement and the placement(s) below, rounded down.";

  const firstMapLayoutDeserialized = deserializeMapLayout(firstMapLayout);
  const secondMapLayoutDeserialized = deserializeMapLayout(secondMapLayout);

  // Parse first map results
  const firstMapSymbols = JSON.parse(firstMapResults);

  // Calculate second map results
  const secondMapTokens = tokens.filter(t => t.roundNumber >= 6);
  const playerInfo = players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.playerColor || '#888888',
  }));

  const secondMapSymbols = calculateSymbolsCollected(
    secondMapTokens.map(t => ({
      id: t.id,
      edgeId: t.edgeId as any,
      playerId: t.playerId,
      playerName: t.playerName,
      playerColor: t.playerColor,
      tokenType: t.tokenType as any,
      orientation: t.orientation as any,
      roundNumber: t.roundNumber,
    })),
    secondMapLayoutDeserialized,
    playerInfo
  );

  // Calculate combined totals
  const combinedSymbols = playerInfo.map(player => {
    const firstMap: any = firstMapSymbols.find((s: any) => s.playerId === player.id) || {};
    const secondMap: any = secondMapSymbols.find(s => s.playerId === player.id) || {};

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      households: (firstMap.households || 0) + (secondMap.households || 0),
      bluesStar: (firstMap.bluesStar || 0) + (secondMap.bluesStar || 0),
      countryStar: (firstMap.countryStar || 0) + (secondMap.countryStar || 0),
      jazzStar: (firstMap.jazzStar || 0) + (secondMap.jazzStar || 0),
      rockStar: (firstMap.rockStar || 0) + (secondMap.rockStar || 0),
      popStar: (firstMap.popStar || 0) + (secondMap.popStar || 0),
      classicalStar: (firstMap.classicalStar || 0) + (secondMap.classicalStar || 0),
      totalSymbols: (firstMap.totalSymbols || 0) + (secondMap.totalSymbols || 0),
    };
  });

  // Filter tokens by map
  const firstMapTokens = tokens.filter(t => t.roundNumber <= 5);

  // Calculate Power Hub scores for second map
  const secondMapPowerHubScores = calculatePowerHubScores(
    secondMapTokens.map(t => ({
      id: t.id,
      edgeId: t.edgeId as any,
      playerId: t.playerId,
      playerName: t.playerName,
      playerColor: t.playerColor,
      tokenType: t.tokenType as any,
      orientation: t.orientation as any,
      roundNumber: t.roundNumber,
    })),
    secondMapLayoutDeserialized,
    playerInfo
  );

  // Calculate Power Hub scores for first map
  const firstMapPowerHubScores = calculatePowerHubScores(
    firstMapTokens.map(t => ({
      id: t.id,
      edgeId: t.edgeId as any,
      playerId: t.playerId,
      playerName: t.playerName,
      playerColor: t.playerColor,
      tokenType: t.tokenType as any,
      orientation: t.orientation as any,
      roundNumber: t.roundNumber,
    })),
    firstMapLayoutDeserialized,
    playerInfo
  );

  // Calculate combined Power Hub VP
  const combinedPowerHubVP = playerInfo.map(player => {
    const firstMap = firstMapPowerHubScores.find(s => s.playerId === player.id);
    const secondMap = secondMapPowerHubScores.find(s => s.playerId === player.id);

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      totalVP: (firstMap?.powerHubVictoryPoints || 0) + (secondMap?.powerHubVictoryPoints || 0),
    };
  });

  // Calculate star points based on unique star types collected
  const starPoints = calculateStarPoints(combinedSymbols);

  // Calculate household points with competitive scoring
  const householdPoints = calculateHouseholdPoints(combinedSymbols, players.length);

  // Calculate money points (1 VP per unspent dollar)
  // For card-based variants, calculate total value of remaining cards
  const moneyPoints = calculateMoneyPoints(
    players.map(p => {
      let remainingCardValue: number | undefined;

      // If player has card inventory, calculate total value of remaining cards
      if (p.cardInventory) {
        try {
          const inventory = deserializeInventory(p.cardInventory);
          remainingCardValue = calculateTotalValue(inventory.remaining);
        } catch (error) {
          console.error(`Failed to parse card inventory for player ${p.name}:`, error);
          remainingCardValue = 0;
        }
      }

      return {
        id: p.id,
        name: p.name,
        color: p.playerColor || '#888888',
        currencyBalance: p.currencyBalance || 0,
        remainingCardValue,
      };
    })
  );

  // Check for auto-win (all 6 star types)
  const autoWinCheck = checkAutoWin(combinedSymbols);

  // Calculate final totals (Power Hub VP + Star Points + Household Points + Money Points)
  const finalScores = playerInfo.map(player => {
    const powerHub = combinedPowerHubVP.find(s => s.playerId === player.id);
    const stars = starPoints.find(s => s.playerId === player.id);
    const households = householdPoints.find(s => s.playerId === player.id);
    const money = moneyPoints.find(s => s.playerId === player.id);
    const isAutoWinner = autoWinCheck.autoWinners.some(w => w.playerId === player.id);

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      powerHubVP: powerHub?.totalVP || 0,
      starPoints: stars?.starPoints || 0,
      householdPoints: households?.householdPoints || 0,
      moneyPoints: money?.moneyPoints || 0,
      unspentMoney: money?.unspentMoney || 0,
      totalPoints: (powerHub?.totalVP || 0) + (stars?.starPoints || 0) + (households?.householdPoints || 0) + (money?.moneyPoints || 0),
      isAutoWinner,
      uniqueStarTypes: stars?.uniqueStarTypes || 0,
      householdsCollected: households?.households || 0,
      householdPlacement: households?.placement || 0,
    };
  }).sort((a, b) => {
    // Auto-winners first
    if (a.isAutoWinner && !b.isAutoWinner) return -1;
    if (!a.isAutoWinner && b.isAutoWinner) return 1;
    // Then by total points
    return b.totalPoints - a.totalPoints;
  });

  return (
    <>
      <Card className="mb-6">
        <CardContent className="py-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Game Complete!</h2>
          <p className="text-gray-600 mb-6">Final scores from both maps</p>
        </CardContent>
      </Card>

      {/* Auto-Win Announcement */}
      {autoWinCheck.hasAutoWin && (
        <Card className="mb-6 bg-yellow-50 border-4 border-yellow-400">
          <CardContent className="py-8 text-center">
            <div className="text-6xl mb-4">⭐</div>
            <h2 className="text-3xl font-bold text-yellow-800 mb-4">
              Automatic Victory!
            </h2>
            <p className="text-xl text-yellow-700 mb-2">
              {autoWinCheck.autoWinners.length === 1 ? 'Winner' : 'Winners'} with all 6 star types:
            </p>
            <div className="flex flex-col gap-2 items-center">
              {autoWinCheck.autoWinners.map((winner) => (
                <span
                  key={winner.playerId}
                  className="text-2xl font-bold"
                  style={{ color: winner.playerColor }}
                >
                  {winner.playerName}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combined Symbols */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Total Symbols Collected (Both Maps)</h2>
          <div className="space-y-3">
            {combinedSymbols
              .sort((a, b) => b.totalSymbols - a.totalSymbols)
              .map((count) => (
                <div
                  key={count.playerId}
                  className="p-4 rounded-lg border-2"
                  style={{ borderColor: count.playerColor }}
                >
                  <div className="mb-2">
                    <span className="font-bold text-lg" style={{ color: count.playerColor }}>
                      {count.playerName}
                    </span>
                    <span className="ml-2 text-gray-600">({count.totalSymbols} total)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {count.households > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏠</span>
                        <span className="text-black font-semibold">{count.households}</span>
                      </div>
                    )}
                    {count.bluesStar > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎺</span>
                        <span className="text-black font-semibold">{count.bluesStar}</span>
                      </div>
                    )}
                    {count.countryStar > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🤠</span>
                        <span className="text-black font-semibold">{count.countryStar}</span>
                      </div>
                    )}
                    {count.jazzStar > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎷</span>
                        <span className="text-black font-semibold">{count.jazzStar}</span>
                      </div>
                    )}
                    {count.rockStar > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎸</span>
                        <span className="text-black font-semibold">{count.rockStar}</span>
                      </div>
                    )}
                    {count.popStar > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎤</span>
                        <span className="text-black font-semibold">{count.popStar}</span>
                      </div>
                    )}
                    {count.classicalStar > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎹</span>
                        <span className="text-black font-semibold">{count.classicalStar}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Star Scoring */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Star Collection Scoring</h2>
          <p className="text-sm text-gray-600 text-center mb-4">
            {starScoringExplanation}
          </p>
          <div className="space-y-3">
            {starPoints
              .sort((a, b) => {
                // Auto-winners (6 unique star types) first
                if (a.uniqueStarTypes === 6 && b.uniqueStarTypes !== 6) return -1;
                if (a.uniqueStarTypes !== 6 && b.uniqueStarTypes === 6) return 1;
                // Then by star points descending
                return b.starPoints - a.starPoints;
              })
              .map((score) => (
                <div
                  key={score.playerId}
                  className={`p-4 rounded-lg border-2 ${score.uniqueStarTypes === 6 ? 'bg-yellow-50' : ''}`}
                  style={{ borderColor: score.playerColor }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-lg" style={{ color: score.playerColor }}>
                        {score.playerName}
                      </span>
                      {score.uniqueStarTypes === 6 && <span className="ml-2 text-2xl">⭐</span>}
                      <span className="ml-2 text-gray-600">
                        ({score.uniqueStarTypes} unique {score.uniqueStarTypes === 1 ? 'type' : 'types'})
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-800">
                      {score.uniqueStarTypes === 6 ? 'AUTO-WIN' : `${score.starPoints} pts`}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Household Scoring */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Household Competitive Scoring</h2>
          <p className="text-sm text-gray-600 text-center mb-4">
            {householdScoringExplanation}
          </p>
          <div className="space-y-3">
            {householdPoints
              .sort((a, b) => a.placement - b.placement)
              .map((score) => (
                <div
                  key={score.playerId}
                  className="p-4 rounded-lg border-2"
                  style={{ borderColor: score.playerColor }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-lg" style={{ color: score.playerColor }}>
                        {score.playerName}
                      </span>
                      <span className="ml-2 text-gray-600">
                        ({score.households} 🏠 - {score.placement === 1 ? '1st' : score.placement === 2 ? '2nd' : score.placement === 3 ? '3rd' : `${score.placement}th`} place)
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-800">{score.householdPoints} pts</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Power Hub VP */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Power Hub Victory Points (Both Maps)</h2>
          <div className="space-y-3">
            {combinedPowerHubVP
              .sort((a, b) => b.totalVP - a.totalVP)
              .map((score) => (
                <div
                  key={score.playerId}
                  className="p-4 rounded-lg border-2"
                  style={{ borderColor: score.playerColor }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg" style={{ color: score.playerColor }}>
                      {score.playerName}
                    </span>
                    <span className="text-2xl font-bold text-gray-800">{score.totalVP} VP</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Unspent Money Points */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Unspent Money Victory Points</h2>
          <p className="text-sm text-gray-600 text-center mb-4">
            Each player receives 1 victory point for each dollar they have remaining unspent at the end of the game.
          </p>
          <div className="space-y-3">
            {moneyPoints
              .sort((a, b) => b.moneyPoints - a.moneyPoints)
              .map((score) => (
                <div
                  key={score.playerId}
                  className="p-4 rounded-lg border-2"
                  style={{ borderColor: score.playerColor }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-lg" style={{ color: score.playerColor }}>
                        {score.playerName}
                      </span>
                      <span className="ml-2 text-gray-600">
                        (${score.unspentMoney} remaining)
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-800">{score.moneyPoints} VP</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Final Scores */}
      <Card className="mb-6 bg-blue-50 border-4 border-blue-400">
        <CardContent className="py-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">🏆 Final Scores 🏆</h2>
          <div className="space-y-4">
            {finalScores.map((score, index) => (
              <div
                key={score.playerId}
                className={`p-5 rounded-lg border-4 ${
                  score.isAutoWinner ? 'bg-yellow-100 border-yellow-500' : 'border-gray-300 bg-white'
                }`}
                style={!score.isAutoWinner ? { borderColor: score.playerColor } : {}}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-gray-400">#{index + 1}</span>
                    <span className="font-bold text-2xl" style={{ color: score.playerColor }}>
                      {score.playerName}
                    </span>
                    {score.isAutoWinner && (
                      <span className="text-2xl">⭐</span>
                    )}
                  </div>
                  <span className="text-3xl font-bold text-gray-800">{score.totalPoints} pts</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm text-gray-700">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold">Power Hub</div>
                    <div className="text-lg font-bold">{score.powerHubVP}</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold">Stars</div>
                    <div className="text-lg font-bold">{score.starPoints}</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold">Households</div>
                    <div className="text-lg font-bold">{score.householdPoints}</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold">Money</div>
                    <div className="text-lg font-bold">{score.moneyPoints}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Return Home Button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={() => router.push("/")}
          className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 text-lg"
        >
          Return Home
        </Button>
      </div>
    </>
  );
}
