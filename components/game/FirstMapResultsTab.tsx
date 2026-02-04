"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/Card";

interface FirstMapResultsTabProps {
  firstMapResults: string;
}

export function FirstMapResultsTab({ firstMapResults }: FirstMapResultsTabProps) {
  const symbolCounts = JSON.parse(firstMapResults);

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">First Map Results</h2>
        <p className="text-center text-gray-600 mb-6">
          Symbols collected during rounds 1-5
        </p>
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
  );
}
