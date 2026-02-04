"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface SpinningWheelProps {
  winner: "A" | "B" | "C" | "D";
  onWinnerSelected: (winner: "A" | "B" | "C" | "D") => void;
  availableSongs?: ("A" | "B" | "C" | "D")[];
}

// Define colors for each song
const SONG_COLORS = {
  A: "#3B82F6", // Blue
  B: "#10B981", // Green
  C: "#EF4444", // Red
  D: "#8B5CF6", // Purple
};

export function SpinningWheel({ winner, onWinnerSelected, availableSongs = ["A", "B", "C"] }: SpinningWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [showWinner, setShowWinner] = useState(false);

  useEffect(() => {
    // Start spinning after a short delay
    const startDelay = setTimeout(() => {
      spinWheel();
    }, 500);

    return () => clearTimeout(startDelay);
  }, []);

  const spinWheel = () => {
    // Use the predetermined winner from server
    const winnerIndex = availableSongs.indexOf(winner);

    // Calculate final rotation based on number of sections
    // The pointer is at the top (0 degrees). Section centers are at:
    // For 2 sections: 90° (right), 270° (left)
    // For 3 sections: 60°, 180°, 300°
    // For 4 sections: 45°, 135°, 225°, 315°
    let sectionCenters: number[];
    if (availableSongs.length === 2) {
      sectionCenters = [90, 270];
    } else if (availableSongs.length === 3) {
      sectionCenters = [60, 180, 300];
    } else {
      sectionCenters = [45, 135, 225, 315];
    }
    const sectionCenter = sectionCenters[winnerIndex];

    // To bring the section center to the top (0 degrees), we need to rotate by (360 - sectionCenter)
    // Plus 6 full rotations for the spinning effect
    const fullRotations = 6;
    const finalRotation = fullRotations * 360 + (360 - sectionCenter);

    setRotation(finalRotation);

    // After animation completes, show winner and notify parent
    setTimeout(() => {
      setIsSpinning(false);
      setShowWinner(true);
      // Wait a bit before notifying parent to show the winner
      setTimeout(() => {
        onWinnerSelected(winner);
      }, 1500);
    }, 4000); // 4 second animation
  };

  const tieTitle =
    availableSongs.length === 2 ? "Two-Way Tie!" :
    availableSongs.length === 3 ? "Three-Way Tie!" :
    "Four-Way Tie!";

  // Helper to render wheel sections dynamically
  const renderWheel = () => {
    const numSongs = availableSongs.length;

    if (numSongs === 2) {
      // Two sections: each 180 degrees
      const songs = availableSongs;
      return (
        <>
          {/* First song section (0-180 degrees) - Right half */}
          <path
            d="M 100 100 L 100 0 A 100 100 0 0 1 100 200 Z"
            fill={SONG_COLORS[songs[0]]}
            stroke="#fff"
            strokeWidth="2"
          />
          {/* Second song section (180-360 degrees) - Left half */}
          <path
            d="M 100 100 L 100 200 A 100 100 0 0 1 100 0 Z"
            fill={SONG_COLORS[songs[1]]}
            stroke="#fff"
            strokeWidth="2"
          />
        </>
      );
    } else if (numSongs === 3) {
      // Three sections: each 120 degrees
      const songs = availableSongs;
      return (
        <>
          {/* First song section (0-120 degrees) - Top section */}
          <path
            d="M 100 100 L 100 0 A 100 100 0 0 1 186.6 150 Z"
            fill={SONG_COLORS[songs[0]]}
            stroke="#fff"
            strokeWidth="2"
          />
          {/* Second song section (120-240 degrees) - Bottom-right section */}
          <path
            d="M 100 100 L 186.6 150 A 100 100 0 0 1 13.4 150 Z"
            fill={SONG_COLORS[songs[1]]}
            stroke="#fff"
            strokeWidth="2"
          />
          {/* Third song section (240-360 degrees) - Bottom-left section */}
          <path
            d="M 100 100 L 13.4 150 A 100 100 0 0 1 100 0 Z"
            fill={SONG_COLORS[songs[2]]}
            stroke="#fff"
            strokeWidth="2"
          />
        </>
      );
    } else {
      // Four sections: each 90 degrees
      const songs = availableSongs;
      return (
        <>
          {/* First song section (0-90 degrees) */}
          <path
            d="M 100 100 L 100 0 A 100 100 0 0 1 200 100 Z"
            fill={SONG_COLORS[songs[0]]}
            stroke="#fff"
            strokeWidth="2"
          />
          {/* Second song section (90-180 degrees) */}
          <path
            d="M 100 100 L 200 100 A 100 100 0 0 1 100 200 Z"
            fill={SONG_COLORS[songs[1]]}
            stroke="#fff"
            strokeWidth="2"
          />
          {/* Third song section (180-270 degrees) */}
          <path
            d="M 100 100 L 100 200 A 100 100 0 0 1 0 100 Z"
            fill={SONG_COLORS[songs[2]]}
            stroke="#fff"
            strokeWidth="2"
          />
          {/* Fourth song section (270-360 degrees) */}
          <path
            d="M 100 100 L 0 100 A 100 100 0 0 1 100 0 Z"
            fill={SONG_COLORS[songs[3]]}
            stroke="#fff"
            strokeWidth="2"
          />
        </>
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-3xl font-bold text-center text-gray-800">{tieTitle}</h2>
        <p className="text-center text-gray-600 mt-2">Spinning the wheel to determine the winner...</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8">
          {/* Pointer at top */}
          <div className="relative mb-4">
            <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-red-600"></div>
          </div>

          {/* Wheel */}
          <div className="relative w-80 h-80">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full transition-transform duration-[4000ms] ease-out"
              style={{
                transform: `rotate(${rotation}deg)`,
              }}
            >
              {renderWheel()}

              {/* Center circle */}
              <circle cx="100" cy="100" r="15" fill="#1F2937" />
            </svg>
          </div>

          {/* Status message */}
          <div className="mt-8 text-center">
            {isSpinning ? (
              <p className="text-xl font-semibold text-gray-700 animate-pulse">
                Spinning...
              </p>
            ) : showWinner ? (
              <div>
                <p className="text-2xl font-bold text-gray-800 mb-2">
                  Winner: Song {winner}!
                </p>
                <p className="text-sm text-gray-600">Loading results...</p>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
