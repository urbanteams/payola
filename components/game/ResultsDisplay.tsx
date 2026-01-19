"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { calculateSongTotals, determineWinningSong } from "@/lib/game/bidding-logic";

interface Bid {
  playerId: string;
  playerName?: string;
  song: string;
  amount: number;
  round: number;
}

interface Player {
  id: string;
  name: string;
  isMe: boolean;
}

interface ResultsDisplayProps {
  bids: Bid[];
  onNextRound: () => void;
  onFinishGame: () => void;
  isAdvancing: boolean;
  forcedWinner?: "A" | "B" | "C" | null;
  players?: Player[]; // Player list
  turnOrderA?: string[] | null; // Array of player IDs
  turnOrderB?: string[] | null; // Array of player IDs
  turnOrderC?: string[] | null; // Array of player IDs
}

export function ResultsDisplay({
  bids,
  onNextRound,
  onFinishGame,
  isAdvancing,
  forcedWinner,
  players,
  turnOrderA,
  turnOrderB,
  turnOrderC
}: ResultsDisplayProps) {
  const songTotals = calculateSongTotals(bids);
  const winningSong = determineWinningSong(songTotals, forcedWinner || undefined);
  const [countdown, setCountdown] = useState(7);

  // Get the turn order for the winning song
  let winningTurnOrder: string[] | null = null;
  if (winningSong === "A") winningTurnOrder = turnOrderA || null;
  if (winningSong === "B") winningTurnOrder = turnOrderB || null;
  if (winningSong === "C") winningTurnOrder = turnOrderC || null;

  // Convert turn order (player IDs) to player names with bold for current player
  const winningImplicationDisplay = (() => {
    if (!winningTurnOrder || !players || players.length === 0) return null;

    // Map player IDs to player objects
    const playerObjects = winningTurnOrder.map(playerId => {
      const player = players.find(p => p.id === playerId);
      return player || { id: playerId, name: 'Unknown', isMe: false };
    });

    return (
      <span>
        {playerObjects.map((player, i) => {
          return (
            <React.Fragment key={i}>
              {i > 0 && <span className="mx-1">→</span>}
              {player.isMe ? (
                <span className="font-bold text-amber-800">{player.name}</span>
              ) : (
                <span>{player.name}</span>
              )}
            </React.Fragment>
          );
        })}
      </span>
    );
  })();

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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
        <h2 className="text-3xl font-bold text-center text-gray-800">Round Results</h2>
      </CardHeader>
      <CardContent>
        {/* Winning Song Implications */}
        {winningImplicationDisplay && (
          <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">🏆 Winning Song Implications</h3>
            <p className="text-center text-sm text-gray-700 mb-3">
              Song <span className="font-bold text-xl">{winningSong}</span> won! Token placement order:
            </p>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-lg text-gray-700 leading-relaxed">
                {winningImplicationDisplay}
              </div>
            </div>
            <p className="text-xs text-center text-gray-600 mt-3">
              Your name appears in bold
            </p>
          </div>
        )}

        {/* Song Totals */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-700 mb-4 text-center">Total Bids by Song</h3>
          <div className={`grid gap-4 ${players && players.length === 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {["A", "B", "C"].filter(song => {
              // Filter out Song C for 3-player games
              if (song === "C" && players && players.length === 3) return false;
              return true;
            }).map((song) => {
              const total = songTotals[song as "A" | "B" | "C"];
              const isWinner = song === winningSong;
              const color = getSongColor(song);

              return (
                <div
                  key={song}
                  className={`
                    border-4 rounded-lg p-6 text-center transition-all
                    ${isWinner ? `bg-${color}-100 border-${color}-500` : "bg-gray-50 border-gray-300"}
                  `}
                >
                  <div className={`text-5xl font-bold mb-2 text-${color}-600`}>{song}</div>
                  <div className="text-3xl font-bold text-gray-800">${total}</div>
                  {isWinner && (
                    <div className="mt-2 bg-yellow-400 text-yellow-900 text-xs font-bold py-1 px-3 rounded-full inline-block">
                      WINNER!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Bids */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-700 mb-3">All Bids</h3>
          <div className="space-y-2">
            {bids.filter(bid => bid.amount > 0).map((bid, index) => {
              const color = getSongColor(bid.song);
              const paidBid = (bid.round === 2) || (bid.round === 1 && bid.song === winningSong);

              return (
                <div
                  key={index}
                  className={`
                    border-2 rounded-lg p-4 flex items-center justify-between
                    ${paidBid ? `bg-red-50 border-red-300` : `bg-green-50 border-green-300`}
                  `}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {bid.playerName?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{bid.playerName || "Unknown"}</div>
                      <div className="text-sm text-gray-600">{bid.round === 1 ? "Promise" : "Bribe"}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className={`text-2xl font-bold text-${color}-600`}>
                      Song {bid.song}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-800">${bid.amount}</div>
                      <div className={`text-xs font-semibold ${paidBid ? "text-red-600" : "text-green-600"}`}>
                        {paidBid ? "PAID" : "KEPT"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Currency Deductions:</strong> Promise Phase bidders only paid if they backed Song {winningSong} (the winner).
            Bribe Phase bidders paid regardless. Everyone else kept their currency!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="secondary"
            onClick={onFinishGame}
            disabled={isAdvancing}
            className="w-full"
          >
            End Game
          </Button>
          <Button
            onClick={onNextRound}
            disabled={isAdvancing || countdown > 0}
            className="w-full"
          >
            {isAdvancing ? "Advancing to Placement..." : countdown > 0 ? `Advance to Placement (${countdown}s)` : "Advance to Placement"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
