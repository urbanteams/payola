'use client';

import React from 'react';
import { HexagonalMap } from './HexagonalMap';
import { Card, CardContent } from '@/components/ui/Card';
import type { MapLayout } from '@/lib/game/map-generator';
import type { VertexId } from '@/lib/game/hex-grid';

interface InitialMapViewProps {
  mapLayout: MapLayout;
  highlightedEdges?: VertexId[];
  onContinue: () => void;
  isMultiMap?: boolean;
}

export function InitialMapView({ mapLayout, highlightedEdges = [], onContinue, isMultiMap }: InitialMapViewProps) {

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {isMultiMap ? "First Map" : "Game Map"}
          </h1>
          <p className="text-gray-600">
            This is the board where you'll place Influence Tokens throughout the game.
          </p>
          <p className="text-gray-600 mt-2">
            The highlighted spaces with <span className="font-semibold">!</span> marks show where tokens can be placed in the first round.
          </p>
        </div>

        <div className="text-center mb-6">
          <button
            onClick={onContinue}
            className="px-8 py-4 rounded-lg font-semibold text-lg transition-all bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
          >
            Continue to Bidding
          </button>
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
      </div>
    </div>
  );
}
