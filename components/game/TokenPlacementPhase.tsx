'use client';

import React, { useState, useEffect } from 'react';
import { TokenPlacementInterface } from './TokenPlacementInterface';
import { HexagonalMap } from './HexagonalMap';
import { TabViewSwitcher } from './TabViewSwitcher';
import { Card, CardContent } from '@/components/ui/Card';
import { deserializeMapLayout } from '@/lib/game/map-generator';
import type { MapLayout, InfluenceToken } from '@/lib/game/map-generator';
import type { VertexId } from '@/lib/game/hex-grid';

interface Player {
  id: string;
  name: string;
  playerColor: string | null;
  isMe?: boolean;
}

interface TokenPlacementPhaseProps {
  gameId: string;
  players: Player[];
  mapLayout: string | null;
  highlightedEdges: string | null;
  currentTurnIndex: number;
  winningSong: string | null;
  turnOrderA: string[];
  turnOrderB: string[];
  turnOrderC: string[] | null;
  placementTimeout: string | null;
  tokens: Array<{
    id: string;
    edgeId: string;
    playerId: string;
    playerName: string;
    playerColor: string | null;
    tokenType: string;
    orientation: string;
    roundNumber: number;
  }>;
  onTokenPlaced: () => void;
}

export function TokenPlacementPhase({
  gameId,
  players,
  mapLayout: mapLayoutStr,
  highlightedEdges: highlightedEdgesStr,
  currentTurnIndex,
  winningSong,
  turnOrderA,
  turnOrderB,
  turnOrderC,
  placementTimeout: placementTimeoutStr,
  tokens: tokensData,
  onTokenPlaced,
}: TokenPlacementPhaseProps) {
  const [currentView, setCurrentView] = useState<'game' | 'map'>('map');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [autoPlacing, setAutoPlacing] = useState(false);

  // Parse data
  const mapLayout: MapLayout | null = mapLayoutStr ? deserializeMapLayout(mapLayoutStr) : null;
  const highlightedEdges: VertexId[] = highlightedEdgesStr ? JSON.parse(highlightedEdgesStr) : [];

  // Convert tokens data to InfluenceToken format for map display
  const tokens: InfluenceToken[] = tokensData.map((t) => ({
    id: t.id,
    edgeId: t.edgeId as VertexId,
    playerId: t.playerId,
    playerName: t.playerName,
    playerColor: t.playerColor,
    tokenType: t.tokenType as '4/0' | '2/2' | '1/3',
    orientation: t.orientation as 'A' | 'B',
    roundNumber: t.roundNumber,
  }));

  // Calculate turn order based on winning song
  const getTurnOrder = (): string[] => {
    if (winningSong === 'A') return turnOrderA;
    if (winningSong === 'B') return turnOrderB;
    if (winningSong === 'C' && turnOrderC) return turnOrderC;
    return [];
  };

  const turnOrder = getTurnOrder();
  const currentTurnPlayerId = turnOrder[currentTurnIndex];
  const currentTurnPlayer = players.find((p) => p.id === currentTurnPlayerId);
  const myPlayer = players.find((p) => p.isMe);
  const isMyTurn = myPlayer?.id === currentTurnPlayerId;

  // Countdown timer
  useEffect(() => {
    if (!placementTimeoutStr) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const timeout = new Date(placementTimeoutStr).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((timeout - now) / 1000));
      setTimeRemaining(remaining);

      // Auto-place when timer reaches 0
      if (remaining === 0 && isMyTurn && !autoPlacing) {
        handleAutoPlace();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [placementTimeoutStr, isMyTurn, autoPlacing]);

  const handleAutoPlace = async () => {
    setAutoPlacing(true);
    try {
      const response = await fetch(`/api/game/${gameId}/auto-place-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.error('Auto-place failed');
      }

      onTokenPlaced();
    } catch (error) {
      console.error('Error auto-placing token:', error);
    } finally {
      setAutoPlacing(false);
    }
  };

  if (!mapLayout) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-600">Loading map...</p>
        </CardContent>
      </Card>
    );
  }

  // Create player color map
  const playerColors: Record<string, string> = {};
  players.forEach((p) => {
    if (p.playerColor) {
      playerColors[p.id] = p.playerColor;
    }
  });

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <TabViewSwitcher currentView={currentView} onViewChange={setCurrentView} />

      {currentView === 'map' ? (
        <>
          {/* Turn Indicator Card */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Turn:</p>
                  <div className="flex items-center gap-3">
                    {currentTurnPlayer?.playerColor && (
                      <div
                        className="w-6 h-6 rounded-full border-2 border-gray-700"
                        style={{ backgroundColor: currentTurnPlayer.playerColor }}
                      />
                    )}
                    <p className="text-2xl font-bold text-gray-800">
                      {currentTurnPlayer?.name || 'Unknown Player'}
                      {isMyTurn && <span className="ml-3 text-green-600">← Your Turn!</span>}
                    </p>
                  </div>
                </div>

                {timeRemaining !== null && isMyTurn && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Time Remaining:</p>
                    <p
                      className={`text-3xl font-bold ${
                        timeRemaining <= 10 ? 'text-red-600' : 'text-blue-600'
                      }`}
                    >
                      {timeRemaining}s
                    </p>
                  </div>
                )}
              </div>

              {!isMyTurn && (
                <p className="text-gray-500 mt-3">
                  Waiting for {currentTurnPlayer?.name} to place their token...
                </p>
              )}

              {autoPlacing && (
                <p className="text-yellow-600 mt-3 font-semibold">
                  Auto-placing token...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Turn Order Display */}
          <Card>
            <CardContent className="py-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Placement Order</h3>
              <div className="flex flex-wrap gap-2">
                {turnOrder.map((playerId, index) => {
                  const player = players.find(p => p.id === playerId);
                  const isCurrent = index === currentTurnIndex;
                  const hasPlaced = index < currentTurnIndex;

                  return (
                    <div
                      key={`${playerId}-${index}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${
                        isCurrent
                          ? 'bg-blue-100 border-blue-500'
                          : hasPlaced
                          ? 'bg-green-50 border-green-300'
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    >
                      {player?.playerColor && (
                        <div
                          className="w-4 h-4 rounded-full border border-gray-700"
                          style={{ backgroundColor: player.playerColor }}
                        />
                      )}
                      <span className={`text-sm font-semibold ${isCurrent ? 'text-blue-800' : 'text-gray-700'}`}>
                        {player?.name || 'Unknown'}
                      </span>
                      {hasPlaced && <span className="text-green-600 text-xs">✓</span>}
                      {isCurrent && <span className="text-blue-600 text-xs">◀</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Token Placement Interface */}
          <TokenPlacementInterface
            gameId={gameId}
            mapLayout={mapLayout}
            tokens={tokens}
            highlightedVertices={highlightedEdges}
            currentTurn={{
              playerId: currentTurnPlayerId,
              playerName: currentTurnPlayer?.name || 'Unknown',
            }}
            isMyTurn={isMyTurn}
            onTokenPlaced={onTokenPlaced}
          />
        </>
      ) : (
        <>
          {/* Game View - Show all players and their colors */}
          <Card>
            <CardContent className="py-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Token Placement in Progress</h3>
              <p className="text-gray-600 mb-4">
                Players are placing Influence Tokens on the map based on the turn order from Song{' '}
                {winningSong}.
              </p>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700">Players:</h4>
                {players.map((player, index) => {
                  const isCurrent = player.id === currentTurnPlayerId;
                  const hasPlaced = currentTurnIndex > turnOrder.indexOf(player.id);
                  const borderColor = player.playerColor || '#d1d5db';
                  const textColor = player.playerColor || '#1f2937';

                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                        isCurrent ? 'bg-blue-100' : 'bg-gray-50'
                      }`}
                      style={{ borderColor: isCurrent ? '#3b82f6' : borderColor }}
                    >
                      {player.playerColor && (
                        <div
                          className="w-6 h-6 rounded-full border-2 border-gray-700"
                          style={{ backgroundColor: player.playerColor }}
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-bold" style={{ color: textColor }}>{player.name}</p>
                        {isCurrent && <p className="text-sm text-blue-600">Placing token now...</p>}
                        {hasPlaced && <p className="text-sm text-green-600">Token placed ✓</p>}
                        {!isCurrent && !hasPlaced && (
                          <p className="text-sm text-gray-500">Waiting...</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Switch to <strong>Map View</strong> to see token placements in real-time
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
