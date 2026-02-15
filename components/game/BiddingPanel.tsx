"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SongSelector, Song } from "./SongSelector";
import CardSelector from "./CardSelector";
import { CardInventory, calculateTotalValue } from "@/lib/game/card-inventory";

interface Player {
  id: string;
  name: string;
  isMe: boolean;
}

interface BiddingPanelProps {
  currencyBalance: number;
  round: number;
  onSubmitBid: (song: Song, amount: number, cards?: number[]) => Promise<void>;
  disabled?: boolean;
  players?: Player[]; // Player list to show names
  turnOrderA?: string[] | null; // Array of player IDs
  turnOrderB?: string[] | null; // Array of player IDs
  turnOrderC?: string[] | null; // Array of player IDs
  turnOrderD?: string[] | null; // Array of player IDs
  isPOTS?: boolean; // POTS mode flag
  cardInventory?: CardInventory | null; // For 3B variant
  is3BVariant?: boolean; // Flag for 3B variant
  currentRound?: number; // Current game round (1-10)
  totalRounds?: number; // Total rounds in game (to detect final round)
  gameVariant?: string | null; // Game variant (e.g., "3B", "5B")
}

export function BiddingPanel({ currencyBalance, round, onSubmitBid, disabled = false, players, turnOrderA, turnOrderB, turnOrderC, turnOrderD, isPOTS = false, cardInventory = null, is3BVariant = false, currentRound = 1, totalRounds = 10, gameVariant = null }: BiddingPanelProps) {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Calculate actual bid amount based on mode
    const calculatedAmount = is3BVariant ? calculateTotalValue(selectedCards) : bidAmount;

    // For $0 bids, song selection is not required (use "A" as default)
    // For non-zero bids, song selection is required
    if (calculatedAmount > 0 && !selectedSong) {
      return;
    }

    if (!is3BVariant && (bidAmount < 0 || bidAmount > currencyBalance)) {
      return;
    }

    setSubmitting(true);
    try {
      // Use selected song, or default to "A" for $0 bids
      const songToSubmit = selectedSong || "A";

      if (is3BVariant) {
        await onSubmitBid(songToSubmit, calculatedAmount, selectedCards);
      } else {
        await onSubmitBid(songToSubmit, bidAmount);
      }

      setSelectedSong(null);
      setBidAmount(0);
      setSelectedCards([]);
    } catch (error) {
      console.error("Failed to submit bid:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            {round === 1 ? "Promise Phase" : "Bribe Phase"}
          </h2>
          {!is3BVariant && (
            <div className="text-right">
              <p className="text-sm text-gray-600">Your Currency</p>
              <p className="text-3xl font-bold text-green-600">${currencyBalance}</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Song Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            Choose a Song: {((is3BVariant && selectedCards.length === 0) || (!is3BVariant && bidAmount === 0)) && <span className="text-sm font-normal text-gray-500">(optional for $0 bids)</span>}
          </h3>
          <SongSelector
            selectedSong={selectedSong}
            onSelectSong={setSelectedSong}
            disabled={disabled || submitting}
            players={players}
            turnOrderA={turnOrderA}
            turnOrderB={turnOrderB}
            turnOrderC={turnOrderC}
            turnOrderD={turnOrderD}
            isPOTS={isPOTS}
          />
        </div>

        {/* Bid Input - Either Card Selector or Amount Input */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            {round === 1 ? "Promise Amount:" : "Bribe Amount:"}
          </label>

          {is3BVariant && cardInventory ? (
            <CardSelector
              inventory={cardInventory}
              selectedCards={selectedCards}
              onSelectCards={setSelectedCards}
              disabled={disabled || submitting}
              currentRound={currentRound}
              totalRounds={totalRounds}
              gameVariant={gameVariant}
            />
          ) : (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-700">$</span>
              <input
                type="number"
                min="0"
                max={currencyBalance}
                value={bidAmount}
                onChange={(e) => setBidAmount(Math.max(0, Math.min(currencyBalance, parseInt(e.target.value) || 0)))}
                disabled={disabled || submitting}
                className="w-full pl-8 pr-4 py-3 text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 text-gray-900 bg-white"
                placeholder="0"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={
            (is3BVariant
              ? (selectedCards.length > 0 && !selectedSong)
              : (bidAmount > 0 && !selectedSong)
            ) || disabled || submitting
          }
          className="w-full text-lg py-3"
        >
          {submitting ? "Submitting..." : (round === 1 ? "Submit Promise" : "Submit Bribe")}
        </Button>

        {/* Info */}
        {round === 1 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Promise Phase:</strong> You only {is3BVariant ? "spend cards" : "pay"} if you bid on the winning song.
              {is3BVariant ? " Select no cards" : " Bid 0"} to wait for Bribe Phase.
            </p>
          </div>
        )}
        {round === 2 && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-800">
              <strong>Bribe Phase:</strong> You will {is3BVariant ? "spend your selected cards" : "pay your bid amount"} regardless of the outcome.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
