"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";

interface PlayerAidProps {
  playerCount: number;
}

export function PlayerAid({ playerCount }: PlayerAidProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Star type points
  const starPoints = [
    { types: 1, points: 10 },
    { types: 2, points: 25 },
    { types: 3, points: 45 },
    { types: 4, points: 70 },
    { types: 5, points: 100 },
  ];

  // Add 6 types only for non-6-player games
  if (playerCount !== 6) {
    starPoints.push({ types: 6, points: 1000 });
  }

  // Household scoring based on player count
  const getHouseholdScoring = () => {
    if (playerCount <= 2) {
      return [{ place: "1st", points: 50 }];
    } else if (playerCount <= 4) {
      return [
        { place: "1st", points: 50 },
        { place: "2nd", points: 20 },
      ];
    } else {
      return [
        { place: "1st", points: 50 },
        { place: "2nd", points: 30 },
        { place: "3rd", points: 20 },
      ];
    }
  };

  return (
    <div className="fixed top-4 left-4 z-50">
      {/* Circle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl shadow-lg flex items-center justify-center transition-all"
        title="Victory Points Guide"
      >
        ?
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <Card className="mt-2 w-80 max-h-[80vh] overflow-y-auto shadow-xl">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Victory Points Guide</h2>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-500 hover:text-gray-700 font-bold text-xl"
              >
                ×
              </button>
            </div>

            {/* Star Types */}
            <div className="mb-4">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-xl">⭐</span>
                Star Types
              </h3>
              <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                {starPoints.map((entry) => (
                  <div key={entry.types} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {entry.types} {entry.types === 1 ? "type" : "types"}
                      {entry.types === 6 && " (AUTO-WIN)"}
                    </span>
                    <span className="font-bold text-blue-700">{entry.points} VP</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Star types: 🎺 Blues, 🤠 Country, 🎷 Jazz, 🎸 Rock, 🎤 Pop, 🎹 Classical
              </p>
            </div>

            {/* Household Scoring */}
            <div className="mb-4">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-xl">🏠</span>
                Household Scoring
              </h3>
              <div className="bg-green-50 rounded-lg p-3 space-y-1">
                {getHouseholdScoring().map((entry) => (
                  <div key={entry.place} className="flex justify-between text-sm">
                    <span className="text-gray-700">{entry.place} place</span>
                    <span className="font-bold text-green-700">{entry.points} VP</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Competitive scoring based on total households collected. Ties share points equally (rounded down).
              </p>
            </div>

            {/* Power Hub */}
            <div className="mb-4">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-xl">⚡</span>
                Power Hub
              </h3>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  Earn <span className="font-bold text-purple-700">1 VP</span> for each point of influence in the Power Hub hexagon.
                </p>
              </div>
            </div>

            {/* Leftover Money */}
            <div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-xl">💰</span>
                Leftover Money
              </h3>
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  Earn <span className="font-bold text-yellow-700">1 VP</span> for each dollar (or card value) remaining at game end.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
