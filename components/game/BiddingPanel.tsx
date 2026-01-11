"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SongSelector, Song } from "./SongSelector";

interface BiddingPanelProps {
  currencyBalance: number;
  round: number;
  onSubmitBid: (song: Song, amount: number) => Promise<void>;
  disabled?: boolean;
}

export function BiddingPanel({ currencyBalance, round, onSubmitBid, disabled = false }: BiddingPanelProps) {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedSong || bidAmount < 0 || bidAmount > currencyBalance) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitBid(selectedSong, bidAmount);
      setSelectedSong(null);
      setBidAmount(0);
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
            Round {round} Bidding
          </h2>
          <div className="text-right">
            <p className="text-sm text-gray-600">Your Currency</p>
            <p className="text-3xl font-bold text-green-600">{currencyBalance}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Song Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Choose a Song:</h3>
          <SongSelector
            selectedSong={selectedSong}
            onSelectSong={setSelectedSong}
            disabled={disabled || submitting}
          />
        </div>

        {/* Bid Amount */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            Bid Amount:
          </label>
          <input
            type="number"
            min="0"
            max={currencyBalance}
            value={bidAmount}
            onChange={(e) => setBidAmount(Math.max(0, Math.min(currencyBalance, parseInt(e.target.value) || 0)))}
            disabled={disabled || submitting}
            className="w-full px-4 py-3 text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 text-gray-900"
            placeholder="0"
          />
          <p className="text-sm text-gray-500 mt-2">
            Enter 0 to skip to Round 2 (if in Round 1)
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!selectedSong || disabled || submitting}
          className="w-full text-lg py-3"
        >
          {submitting ? "Submitting..." : "Submit Bid"}
        </Button>

        {/* Info */}
        {round === 1 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Round 1:</strong> You only pay if you bid on the winning song.
              Bid 0 to wait for Round 2.
            </p>
          </div>
        )}
        {round === 2 && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-800">
              <strong>Round 2:</strong> You will pay your bid amount regardless of the outcome.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
