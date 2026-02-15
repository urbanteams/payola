"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MapViewer } from "./MapViewer";
import { deserializeMapLayout } from "@/lib/game/map-generator";
import { HexagonalMap } from "./HexagonalMap";

interface FirstMapCompletedScreenProps {
  gameId: string;
  firstMapResults: string;
  firstMapLayout: string;
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
  onAdvanceToSecondMap: () => void;
  isAdvancing: boolean;
  isSpectator?: boolean;
}

export function FirstMapCompletedScreen({
  gameId,
  firstMapResults,
  firstMapLayout,
  players,
  tokens,
  onAdvanceToSecondMap,
  isAdvancing,
  isSpectator = false,
}: FirstMapCompletedScreenProps) {
  const mapLayout = deserializeMapLayout(firstMapLayout);
  const symbolCounts = JSON.parse(firstMapResults);

  // Filter tokens to only show those from first map (rounds 1-5)
  const firstMapTokens = tokens.filter(t => t.roundNumber <= 5);

  return (
    <>
      <Card className="mb-6">
        <CardContent className="py-12 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">First Map Completed!</h2>
          <p className="text-gray-600 mb-6">
            You've completed the first map. Review your results below, then advance to the second map.
          </p>
        </CardContent>
      </Card>

      {/* Symbols Collected from First Map */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Symbols Collected - First Map</h2>
          <div className="space-y-3">
            {symbolCounts
              .sort((a: any, b: any) => b.totalSymbols - a.totalSymbols)
              .map((count: any) => (
                <div
                  key={count.playerId}
                  className="p-4 rounded-lg border-2"
                  style={{ borderColor: count.playerColor }}
                >
                  <div className="mb-2">
                    <span className="font-bold text-lg" style={{ color: count.playerColor }}>
                      {count.playerName}
                    </span>
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

      {/* Final Map View */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">First Map - Final State</h2>
          <MapViewer
            mapLayout={mapLayout}
            tokens={firstMapTokens}
            highlightedEdges={[]}
          />
        </CardContent>
      </Card>

      {/* Advance Button - Hidden for spectators */}
      {!isSpectator && (
        <div className="flex justify-center mb-6">
          <Button
            onClick={onAdvanceToSecondMap}
            disabled={isAdvancing}
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 text-lg"
          >
            {isAdvancing ? "Loading..." : "Advance to Second Map"}
          </Button>
        </div>
      )}
    </>
  );
}
