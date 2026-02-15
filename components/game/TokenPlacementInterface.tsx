'use client';

import React, { useState } from 'react';
import { HexagonalMap } from './HexagonalMap';
import { OrientationModal } from './OrientationModal';
import type { MapLayout } from '@/lib/game/map-generator';
import type { EdgeId } from '@/lib/game/hex-grid';
import { parseEdgeId } from '@/lib/game/hex-grid';

interface InfluenceToken {
  id: string;
  edgeId: EdgeId;
  playerId: string;
  playerName: string;
  playerColor: string | null;
  tokenType: string;
  orientation: string;
  roundNumber: number;
}

export interface TokenPlacementInterfaceProps {
  gameId: string;
  mapLayout: MapLayout;
  tokens: InfluenceToken[];
  highlightedVertices: EdgeId[];
  currentTurn: {
    playerId: string;
    playerName: string;
  };
  isMyTurn: boolean;
  onTokenPlaced: () => void;
}

type TokenType = '4/0' | '3/1' | '2/2';

export function TokenPlacementInterface({
  gameId,
  mapLayout,
  tokens,
  highlightedVertices,
  currentTurn,
  isMyTurn,
  onTokenPlaced,
}: TokenPlacementInterfaceProps) {
  const [selectedTokenType, setSelectedTokenType] = useState<TokenType>('2/2');
  const [selectedVertex, setSelectedVertex] = useState<EdgeId | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [show22Confirmation, setShow22Confirmation] = useState(false);

  const handleVertexClick = async (edgeId: EdgeId) => {
    if (!isMyTurn) {
      setError('Not your turn');
      return;
    }

    // Check if space is available
    if (!highlightedVertices.includes(edgeId)) {
      setError('This space is not available for placement');
      return;
    }

    // Check if space already has a token
    const occupied = tokens.some((t) => t.edgeId === edgeId);
    if (occupied) {
      setError('This space already has a token');
      return;
    }

    setError(null);

    // For 2/2 tokens, show confirmation modal
    if (selectedTokenType === '2/2') {
      setSelectedVertex(edgeId);
      setShow22Confirmation(true);
    } else {
      // Open orientation modal for other token types
      setSelectedVertex(edgeId);
    }
  };

  const handleConfirm22Placement = async () => {
    if (!selectedVertex) return;
    setShow22Confirmation(false);
    await placeToken(selectedVertex, 'A'); // Use 'A' by default for 2/2 tokens
    setSelectedVertex(null);
  };

  const handleCancel22Placement = () => {
    setShow22Confirmation(false);
    setSelectedVertex(null);
  };

  const placeToken = async (edgeId: EdgeId, orientation: 'A' | 'B') => {
    setIsPlacing(true);
    setError(null);

    try {
      const response = await fetch(`/api/game/${gameId}/place-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          edgeId,
          tokenType: selectedTokenType,
          orientation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to place token');
      }

      const result = await response.json();

      // Show immediate reward if any
      if (result.immediateReward) {
        // TODO: Show toast notification
        console.log('Immediate reward:', result.immediateReward);
      }

      // If all tokens placed for this round, call advance endpoint to complete round
      if (result.allTokensPlaced) {
        try {
          const advanceResponse = await fetch(`/api/game/${gameId}/advance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'completeTokenPlacement',
            }),
          });

          if (!advanceResponse.ok) {
            console.error('Failed to complete token placement');
          }
        } catch (err) {
          console.error('Error completing token placement:', err);
        }

        // Refresh game state AFTER completeTokenPlacement finishes
        onTokenPlaced();
      } else {
        // Refresh game state for next turn
        onTokenPlaced();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to place token';
      setError(errorMessage);
      console.error('Error placing token:', err);
    } finally {
      setIsPlacing(false);
    }
  };

  const handleConfirmPlacement = async (orientation: 'A' | 'B') => {
    if (!selectedVertex) return;

    await placeToken(selectedVertex, orientation);

    // Close modal after placement
    setSelectedVertex(null);
  };

  const handleCancelPlacement = () => {
    setSelectedVertex(null);
    setError(null);
  };

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

  // Get adjacent hexes for the selected edge
  const getAdjacentHexes = (edgeId: EdgeId) => {
    const hexPair = parseEdgeId(edgeId);
    if (!hexPair) return [];

    const [hex1Coord, hex2Coord] = hexPair;
    return [
      mapLayout.hexes.find((hex) => hex.coordinate.q === hex1Coord.q && hex.coordinate.r === hex1Coord.r),
      mapLayout.hexes.find((hex) => hex.coordinate.q === hex2Coord.q && hex.coordinate.r === hex2Coord.r),
    ].filter((hex) => hex !== undefined);
  };

  return (
    <div className="space-y-6">
      {/* Turn Indicator */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-xl font-semibold mb-2 text-white">Token Placement Phase</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Current Turn:</p>
            <p className="text-lg font-bold text-white">
              {currentTurn.playerName}
              {isMyTurn && <span className="ml-2 text-green-400">← Your Turn!</span>}
            </p>
          </div>
          {isMyTurn && (
            <div className="text-sm text-gray-400">
              Select a highlighted space to place your token
            </div>
          )}
        </div>
      </div>

      {/* Token Type Selector */}
      {isMyTurn && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-lg font-semibold mb-3 text-white">Select Token Type</h4>
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedTokenType('4/0')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                selectedTokenType === '4/0'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              4 / 0
            </button>
            <button
              onClick={() => setSelectedTokenType('3/1')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                selectedTokenType === '3/1'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              3 / 1
            </button>
            <button
              onClick={() => setSelectedTokenType('2/2')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                selectedTokenType === '2/2'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              2 / 2
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            You have unlimited tokens of each type. Numbers represent influence values for adjacent hexes.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900 border border-red-700 p-3 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Map */}
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
              highlightedEdges={highlightedVertices}
              interactionMode={isMyTurn ? 'place' : 'view'}
              onEdgeClick={isMyTurn ? handleVertexClick : undefined}
            />
          </div>
        </div>
      </div>

      {/* Orientation Modal - Only show for non-2/2 tokens */}
      {selectedVertex && selectedTokenType !== '2/2' && !show22Confirmation && (
        <OrientationModal
          edgeId={selectedVertex}
          adjacentHexes={getAdjacentHexes(selectedVertex)}
          tokenType={selectedTokenType}
          onConfirm={handleConfirmPlacement}
          onCancel={handleCancelPlacement}
          isPlacing={isPlacing}
        />
      )}

      {/* Confirmation Modal for 2/2 tokens */}
      {show22Confirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4 text-white">Confirm Placement</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to place a 2/2 token at this location?
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleCancel22Placement}
                disabled={isPlacing}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm22Placement}
                disabled={isPlacing}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors text-white"
              >
                {isPlacing ? 'Placing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
