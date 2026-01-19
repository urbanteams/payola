"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface SpinningWheelProps {
  winner: "A" | "B" | "C";
  onWinnerSelected: (winner: "A" | "B" | "C") => void;
  availableSongs?: ("A" | "B" | "C")[];
}

export function SpinningWheel({ winner, onWinnerSelected, availableSongs = ["A", "B", "C"] }: SpinningWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    // Start spinning after a short delay
    const startDelay = setTimeout(() => {
      spinWheel();
    }, 500);

    return () => clearTimeout(startDelay);
  }, []);

  const spinWheel = () => {
    setIsSpinning(true);

    // Use the predetermined winner from server
    const winnerIndex = availableSongs.indexOf(winner);

    // Calculate final rotation based on number of sections
    // For 2 sections: A: 0-180, B: 180-360 (centers: 90°, 270°)
    // For 3 sections: A: 0-120, B: 120-240, C: 240-360 (centers: 60°, 180°, 300°)
    let sectionCenters: number[];
    if (availableSongs.length === 2) {
      sectionCenters = [90, 270]; // degrees for A, B
    } else {
      sectionCenters = [60, 180, 300]; // degrees for A, B, C
    }
    const targetAngle = sectionCenters[winnerIndex];

    // Spin multiple times (always 6 full rotations for consistency) + land on target
    const fullRotations = 6;
    const finalRotation = fullRotations * 360 + targetAngle;

    setRotation(finalRotation);

    // After animation completes, notify parent
    setTimeout(() => {
      setIsSpinning(false);
      onWinnerSelected(winner);
    }, 4000); // 4 second animation
  };

  const tieTitle = availableSongs.length === 2 ? "Two-Way Tie!" : "Three-Way Tie!";

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
              {availableSongs.length === 2 ? (
                <>
                  {/* Song A section (0-180 degrees) - Blue */}
                  <path
                    d="M 100 100 L 100 0 A 100 100 0 0 1 100 200 Z"
                    fill="#3B82F6"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* Song B section (180-360 degrees) - Green */}
                  <path
                    d="M 100 100 L 100 200 A 100 100 0 0 1 100 0 Z"
                    fill="#10B981"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* Labels */}
                  <text x="100" y="70" textAnchor="middle" fill="white" fontSize="32" fontWeight="bold">
                    A
                  </text>
                  <text x="100" y="150" textAnchor="middle" fill="white" fontSize="32" fontWeight="bold">
                    B
                  </text>
                </>
              ) : (
                <>
                  {/* Song A section (0-120 degrees) - Blue */}
                  <path
                    d="M 100 100 L 100 0 A 100 100 0 0 1 186.6 150 Z"
                    fill="#3B82F6"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* Song B section (120-240 degrees) - Green */}
                  <path
                    d="M 100 100 L 186.6 150 A 100 100 0 0 1 13.4 150 Z"
                    fill="#10B981"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* Song C section (240-360 degrees) - Red */}
                  <path
                    d="M 100 100 L 13.4 150 A 100 100 0 0 1 100 0 Z"
                    fill="#EF4444"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* Labels */}
                  <text x="100" y="50" textAnchor="middle" fill="white" fontSize="32" fontWeight="bold">
                    A
                  </text>
                  <text x="145" y="135" textAnchor="middle" fill="white" fontSize="32" fontWeight="bold">
                    B
                  </text>
                  <text x="55" y="135" textAnchor="middle" fill="white" fontSize="32" fontWeight="bold">
                    C
                  </text>
                </>
              )}

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
            ) : (
              <div>
                <p className="text-2xl font-bold text-gray-800 mb-2">
                  Winner: Song {winner}!
                </p>
                <p className="text-sm text-gray-600">Loading results...</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
