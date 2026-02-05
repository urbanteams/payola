"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MapViewer } from "./MapViewer";
import { deserializeMapLayout } from "@/lib/game/map-generator";
import { calculateSymbolsCollected, calculatePowerHubScores } from "@/lib/game/end-game-scoring";

interface SecondMapResultsScreenProps {
  gameId: string;
  secondMapLayout: string;
  players: Array<{
    id: string;
    name: string;
    playerColor: string | null;
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
  onAdvanceToFinalResults: () => void;
  isAdvancing: boolean;
}

export function SecondMapResultsScreen({
  gameId,
  secondMapLayout,
  players,
  tokens,
  onAdvanceToFinalResults,
  isAdvancing,
}: SecondMapResultsScreenProps) {
  const mapLayout = deserializeMapLayout(secondMapLayout);

  // Filter tokens to only show those from second map (rounds 6+)
  const secondMapTokens = tokens.filter(t => t.roundNumber >= 6);

  const playerInfo = players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.playerColor || '#888888',
  }));

  // Calculate second map symbols
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
    mapLayout,
    playerInfo
  );

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
    mapLayout,
    playerInfo
  );

  return (
    <>
      <Card className="mb-6">
        <CardContent className="py-12 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Second Map Completed!</h2>
          <p className="text-gray-600 mb-6">
            You've completed the second map. Review your results below, then view final scores.
          </p>
        </CardContent>
      </Card>

      {/* Second Map - Final State */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Second Map - Final State</h2>
          <MapViewer
            mapLayout={mapLayout}
            tokens={secondMapTokens}
            highlightedEdges={[]}
          />
        </CardContent>
      </Card>

      {/* Second Map Results - Symbols */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Second Map - Symbols Collected</h2>
          <div className="space-y-3">
            {secondMapSymbols
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
                    <span className="ml-2 text-gray-600">({count.totalSymbols} symbols)</span>
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

      {/* Second Map Power Hub VP */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Second Map - Power Hub Victory Points</h2>
          <div className="space-y-3">
            {secondMapPowerHubScores
              .sort((a, b) => b.powerHubVictoryPoints - a.powerHubVictoryPoints)
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
                    <span className="text-2xl font-bold text-gray-800">{score.powerHubVictoryPoints} VP</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Advance Button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={onAdvanceToFinalResults}
          disabled={isAdvancing}
          className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 text-lg"
        >
          {isAdvancing ? "Loading..." : "View Final Results"}
        </Button>
      </div>
    </>
  );
}
