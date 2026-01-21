'use client';

import React from 'react';
import { MapViewer } from './MapViewer';
import { Card, CardContent } from '@/components/ui/Card';
import type { MapLayout } from '@/lib/game/map-generator';
import type { EdgeId } from '@/lib/game/hex-grid';

interface InfluenceToken {
  edgeId: EdgeId;
  playerId: string;
  playerName?: string;
  playerColor?: string | null;
  tokenType: string;
  orientation: string;
}

interface RoundTransitionMapViewProps {
  mapLayout: MapLayout;
  tokens: InfluenceToken[];
  highlightedEdges: EdgeId[];
  roundNumber: number;
  onContinue: () => void;
}

export function RoundTransitionMapView({
  mapLayout,
  tokens,
  highlightedEdges,
  roundNumber,
  onContinue,
}: RoundTransitionMapViewProps) {

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Round {roundNumber} Starting</h1>
          <p className="text-gray-600">
            New token placement spots have been highlighted on the map
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="py-8">
            <MapViewer
              mapLayout={mapLayout}
              tokens={tokens}
              highlightedEdges={highlightedEdges}
            />
          </CardContent>
        </Card>

        <div className="text-center">
          <button
            onClick={onContinue}
            className="px-8 py-4 rounded-lg font-semibold text-lg transition-all bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
          >
            Continue to Bidding
          </button>
        </div>
      </div>
    </div>
  );
}
