'use client';

import React, { useState } from 'react';
import { generateMapLayout } from '@/lib/game/map-generator';
import { HexagonalMap } from '@/components/game/HexagonalMap';
import { getSongImplicationPreview } from '@/lib/game/song-implications';

export default function TestMapPage() {
  const [playerCount, setPlayerCount] = useState(4);
  const [mapLayout, setMapLayout] = useState<any>(null);
  const [songPreview, setSongPreview] = useState<any>(null);

  const generateMap = () => {
    const layout = generateMapLayout(playerCount);
    setMapLayout(layout);

    const preview = getSongImplicationPreview(playerCount);
    setSongPreview(preview);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Map Generation Test</h1>

      {/* Controls */}
      <div className="bg-gray-800 p-6 rounded-lg mb-8 max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>

        <div className="space-y-4">
          {/* Player Count */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Player Count: {playerCount}
            </label>
            <input
              type="range"
              min="3"
              max="6"
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {playerCount <= 4
                ? '3-4 players: Random map with exactly 36 token spaces'
                : '5-6 players: Random map with exactly 48 token spaces'}
            </p>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateMap}
            className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-semibold"
          >
            Generate Map
          </button>
        </div>
      </div>

      {/* Map Info */}
      {mapLayout && (
        <div className="bg-gray-800 p-6 rounded-lg mb-8 max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">Map Information</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-gray-400">Map Type:</span>{' '}
              <span className="font-semibold">{mapLayout.mapType}</span>
            </p>
            <p>
              <span className="text-gray-400">Player Count:</span>{' '}
              <span className="font-semibold">{mapLayout.playerCount}</span>
            </p>
            <p>
              <span className="text-gray-400">Total Hexes:</span>{' '}
              <span className="font-semibold">{mapLayout.hexes.length}</span>
            </p>
            <p>
              <span className="text-gray-400">Total Edges (Token Spaces):</span>{' '}
              <span className="font-semibold">{mapLayout.edges.length}</span>
            </p>
            <p>
              <span className="text-gray-400">Total Rounds:</span>{' '}
              <span className="font-semibold">{mapLayout.totalRounds}</span>
            </p>
          </div>

          {/* Hex Type Distribution */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h3 className="font-semibold mb-2">Hex Distribution</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {Object.entries(
                mapLayout.hexes.reduce((acc: any, hex: any) => {
                  acc[hex.type] = (acc[hex.type] || 0) + 1;
                  return acc;
                }, {})
              ).map(([type, count]) => (
                <div key={type} className="text-gray-300">
                  {type}: <span className="font-semibold">{count as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Song Implications Preview */}
      {songPreview && (
        <div className="bg-gray-800 p-6 rounded-lg mb-8 max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">Song Implications (Pattern)</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-blue-400 font-semibold">Song A:</span>{' '}
              <span className="font-mono">{songPreview.songA}</span>
            </p>
            <p>
              <span className="text-green-400 font-semibold">Song B:</span>{' '}
              <span className="font-mono">{songPreview.songB}</span>
            </p>
            {songPreview.songC && (
              <p>
                <span className="text-red-400 font-semibold">Song C:</span>{' '}
                <span className="font-mono">{songPreview.songC}</span>
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Letters represent players. Actual player assignment is randomized each round.
          </p>
        </div>
      )}

      {/* Map Visualization */}
      {mapLayout && (
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Map Visualization</h2>
          <div className="bg-white rounded-lg p-4">
            <HexagonalMap
              mapLayout={mapLayout}
              tokens={[]}
              highlightedEdges={[]}
              interactionMode="view"
            />
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <h3 className="font-semibold text-white mb-2">Legend:</h3>
            <ul className="space-y-1">
              <li>🏠 Households (pink) - Most common space</li>
              <li>🎺 Blues Star (blue) - 2x per map</li>
              <li>🤠 Country Star (tan) - 2x per map</li>
              <li>🎷 Jazz Star (purple) - 2x per map</li>
              <li>🎸 Rock Star (coral) - 2x per map</li>
              <li>🎤 Pop Star (green) - 2x per map</li>
              <li>🎤 Classical Star (grey) - 2x per map (5-6 player only)</li>
              <li>⚡ Buzz Hub (yellow) - 1x per map</li>
              <li>💵 Money Hub (bright green) - 1x per map</li>
            </ul>
            <p className="mt-3 text-xs">
              Grey circles = edges where Influence Tokens are placed
            </p>
            <p className="mt-2 text-xs">
              Hexes with 5-6 surrounding token spaces show an extra 🏠 icon (except Buzz/Money Hubs)
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!mapLayout && (
        <div className="bg-blue-900 border border-blue-700 p-6 rounded-lg max-w-2xl">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <p className="text-sm text-blue-100">
            Select a player count (3-6), then click "Generate Map" to see a randomly generated
            hexagonal board layout. Each map is uniquely generated with a random arrangement of
            hexagons that creates exactly 36 token spaces (3-4 players) or 48 token spaces
            (5-6 players). Hex types are randomly distributed following the game rules.
          </p>
          <p className="text-sm text-blue-100 mt-2">
            <strong>Note:</strong> Grey circles show valid spaces where Influence Tokens can be placed
            (on the shared flat sides between two adjacent hexagons). Map boundary edges cannot have tokens.
          </p>
        </div>
      )}
    </div>
  );
}
