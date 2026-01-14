"use client";

import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { calculateSongTotals } from "@/lib/game/bidding-logic";

interface Bid {
  playerId: string;
  playerName?: string;
  song: string;
  amount: number;
  round: number;
}

interface PromisePhaseSummaryProps {
  bids: Bid[];
}

export function PromisePhaseSummary({ bids }: PromisePhaseSummaryProps) {
  const songTotals = calculateSongTotals(bids);

  const getSongColor = (song: string) => {
    switch (song) {
      case "A": return "blue";
      case "B": return "green";
      case "C": return "red";
      default: return "gray";
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xl font-bold text-center text-gray-800">Promise Phase Results</h3>
        <p className="text-sm text-center text-gray-600 mt-1">
          Here's what everyone promised to each song
        </p>
      </CardHeader>
      <CardContent>
        {/* Song Totals */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {["A", "B", "C"].map((song) => {
            const total = songTotals[song as "A" | "B" | "C"];
            const color = getSongColor(song);

            return (
              <div
                key={song}
                className="border-2 border-gray-300 rounded-lg p-4 text-center bg-gray-50"
              >
                <div className={`text-4xl font-bold mb-1 text-${color}-600`}>{song}</div>
                <div className="text-2xl font-bold text-gray-800">${total}</div>
                <div className="text-xs text-gray-600">promised</div>
              </div>
            );
          })}
        </div>

        {/* Individual Bids */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Individual Promises:</h4>
          {bids.map((bid, index) => {
            const color = getSongColor(bid.song);

            return (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-3 flex items-center justify-between bg-white"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {bid.playerName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="font-medium text-gray-800">{bid.playerName || "Unknown"}</div>
                </div>

                <div className="flex items-center space-x-3">
                  {bid.amount > 0 && (
                    <div className={`text-lg font-bold text-${color}-600`}>
                      Song {bid.song}
                    </div>
                  )}
                  <div className="text-lg font-bold text-gray-800">${bid.amount}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
