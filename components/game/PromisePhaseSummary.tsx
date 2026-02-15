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
  availableSongs?: Array<"A" | "B" | "C" | "D">;
  hideOtherPromises?: boolean; // Hide other players' promises until all submitted (human-only games)
  currentPlayerId?: string; // ID of current player to show their own promise
}

export function PromisePhaseSummary({ bids, availableSongs, hideOtherPromises = false, currentPlayerId }: PromisePhaseSummaryProps) {
  // Filter bids to show based on hideOtherPromises flag
  const visibleBids = hideOtherPromises && currentPlayerId
    ? bids.filter(bid => bid.playerId === currentPlayerId)
    : bids;

  const songTotals = calculateSongTotals(bids);

  // Determine available songs from bids if not provided
  const songs = availableSongs || (() => {
    const uniqueSongs = new Set(bids.map(b => b.song));
    const result: Array<"A" | "B" | "C" | "D"> = [];
    if (uniqueSongs.has("A")) result.push("A");
    if (uniqueSongs.has("B")) result.push("B");
    if (uniqueSongs.has("C")) result.push("C");
    if (uniqueSongs.has("D")) result.push("D");
    // If no bids yet, default to A and B
    return result.length > 0 ? result : ["A", "B"];
  })();

  const getSongColorClasses = (song: string) => {
    switch (song) {
      case "A": return { text: "text-blue-600", bg: "bg-gray-50" };
      case "B": return { text: "text-green-600", bg: "bg-gray-50" };
      case "C": return { text: "text-red-600", bg: "bg-gray-50" };
      case "D": return { text: "text-orange-600", bg: "bg-gray-50" };
      default: return { text: "text-gray-600", bg: "bg-gray-50" };
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xl font-bold text-center text-gray-800">Promise Phase Results</h3>
        <p className="text-sm text-center text-gray-600 mt-1">
          {hideOtherPromises
            ? "Your promise (waiting for others to submit)"
            : "Here's what everyone promised to each song"
          }
        </p>
      </CardHeader>
      <CardContent>
        {hideOtherPromises ? (
          // Show only current player's promise when hiding others
          <div className="space-y-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm font-semibold text-blue-900 mb-2">Your Promise:</p>
              {visibleBids.map((bid, index) => {
                const colorClasses = getSongColorClasses(bid.song);
                return (
                  <div key={index} className="space-y-2">
                    {bid.amount > 0 && (
                      <div className={`text-2xl font-bold ${colorClasses.text}`}>
                        Song {bid.song}
                      </div>
                    )}
                    <div className="text-3xl font-bold text-gray-800">${bid.amount}</div>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-gray-600 text-sm">
              <p>Other players' promises will be revealed once everyone has submitted.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Song Totals */}
            <div className={`grid gap-4 mb-4 ${
              songs.length === 2 ? 'grid-cols-2' :
              songs.length === 3 ? 'grid-cols-3' :
              'grid-cols-4'
            }`}>
              {songs.map((song) => {
                const total = songTotals[song];
                const colorClasses = getSongColorClasses(song);

                return (
                  <div
                    key={song}
                    className={`border-2 border-gray-300 rounded-lg p-4 text-center ${colorClasses.bg}`}
                  >
                    <div className={`text-4xl font-bold mb-1 ${colorClasses.text}`}>{song}</div>
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
                const colorClasses = getSongColorClasses(bid.song);

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
                        <div className={`text-lg font-bold ${colorClasses.text}`}>
                          Song {bid.song}
                        </div>
                      )}
                      <div className="text-lg font-bold text-gray-800">${bid.amount}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
