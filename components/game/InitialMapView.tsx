'use client';

import React, { useState, useEffect } from 'react';
import { HexagonalMap } from './HexagonalMap';
import { Card, CardContent } from '@/components/ui/Card';
import type { MapLayout } from '@/lib/game/map-generator';
import type { VertexId } from '@/lib/game/hex-grid';

interface InitialMapViewProps {
  mapLayout: MapLayout;
  highlightedEdges?: VertexId[];
  onContinue: () => void;
}

export function InitialMapView({ mapLayout, highlightedEdges = [], onContinue }: InitialMapViewProps) {
  const [countdown, setCountdown] = useState(3);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanSkip(true);
    }
  }, [countdown]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Game Map</h1>
          <p className="text-gray-600">
            This is the board where you'll place Influence Tokens throughout the game.
          </p>
          <p className="text-gray-600 mt-2">
            The highlighted spaces with <span className="font-semibold">!</span> marks show where tokens can be placed in the first round.
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="py-8">
            <div className="bg-white rounded-lg p-6">
              <HexagonalMap
                mapLayout={mapLayout}
                tokens={[]}
                highlightedEdges={highlightedEdges}
                interactionMode="view"
              />
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <button
            onClick={onContinue}
            disabled={!canSkip}
            className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
              canSkip
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canSkip ? 'Continue to Bidding' : `Please wait... (${countdown}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
