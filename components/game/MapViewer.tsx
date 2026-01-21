'use client';

import React, { useState } from 'react';
import { HexagonalMap } from './HexagonalMap';
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

interface MapViewerProps {
  mapLayout: MapLayout;
  tokens: InfluenceToken[];
  highlightedEdges?: EdgeId[];
}

export function MapViewer({ mapLayout, tokens, highlightedEdges = [] }: MapViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      {/* Zoom Controls */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
          disabled={zoomLevel <= 0.5}
          className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
            zoomLevel <= 0.5
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          Zoom Out
        </button>
        <span className="text-white text-sm font-semibold min-w-[60px] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
          disabled={zoomLevel >= 2}
          className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
            zoomLevel >= 2
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          Zoom In
        </button>
      </div>

      {/* Map Container with Zoom and Pan */}
      <div
        className="bg-white rounded-lg p-4 overflow-hidden relative"
        style={{ maxHeight: '600px', cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: 'top left',
          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
        }}>
          <HexagonalMap
            mapLayout={mapLayout}
            tokens={tokens}
            highlightedEdges={highlightedEdges}
            interactionMode="view"
          />
        </div>
      </div>
    </div>
  );
}
