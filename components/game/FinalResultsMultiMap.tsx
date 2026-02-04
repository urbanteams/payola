"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MapViewer } from "./MapViewer";
import { deserializeMapLayout } from "@/lib/game/map-generator";
import { calculateSymbolsCollected, calculateBuzzHubScores } from "@/lib/game/end-game-scoring";

interface FinalResultsMultiMapProps {
  gameId: string;
  firstMapResults: string;
  firstMapLayout: string;
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

  // Calculate Buzz Hub scores for second map
  const secondMapBuzzHubScores = calculateBuzzHubScores(
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

  // Calculate Buzz Hub scores for first map
  const firstMapBuzzHubScores = calculateBuzzHubScores(
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

  // Calculate combined Buzz Hub VP
  const combinedBuzzHubVP = playerInfo.map(player => {
    const firstMap = firstMapBuzzHubScores.find(s => s.playerId === player.id);
    const secondMap = secondMapBuzzHubScores.find(s => s.playerId === player.id);

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      totalVP: (firstMap?.buzzHubVictoryPoints || 0) + (secondMap?.buzzHubVictoryPoints || 0),
    };
  });

  return (
    <>
      <Card className="mb-6">
        <CardContent className="py-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Multi-Map Game Complete!</h2>
          <p className="text-gray-600 mb-6">Thanks for playing Payola Multi-Map Mode!</p>
        </CardContent>
      </Card>

      {/* Second Map - Final State */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Second Map - Final State</h2>
          <MapViewer
            mapLayout={secondMapLayoutDeserialized}
            tokens={secondMapTokens}
            highlightedEdges={[]}
          />
        </CardContent>
      </Card>

      {/* Second Map Results - Symbols */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Second Map Results</h2>
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

      {/* Second Map Buzz Hub VP */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Second Map - Buzz Hub Victory Points</h2>
          <div className="space-y-3">
            {secondMapBuzzHubScores
              .sort((a, b) => b.buzzHubVictoryPoints - a.buzzHubVictoryPoints)
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
                    <span className="text-2xl font-bold text-gray-800">{score.buzzHubVictoryPoints} VP</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

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

      {/* Combined Buzz Hub VP */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Total Victory Points (Both Maps)</h2>
          <div className="space-y-3">
            {combinedBuzzHubVP
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
