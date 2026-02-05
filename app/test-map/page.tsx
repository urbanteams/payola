'use client';

import React, { useState } from 'react';
import { generateMapLayout, generateMapLayoutWithEdgeCount } from '@/lib/game/map-generator';
import { HexagonalMap } from '@/components/game/HexagonalMap';
import { getSongImplicationPreview } from '@/lib/game/song-implications';

export default function TestMapPage() {
  const [edgeCount, setEdgeCount] = useState<15 | 18 | 24 | 25 | 30 | 36 | 48>(36);
  const [noMoneyHub, setNoMoneyHub] = useState(false);
  const [mapLayout, setMapLayout] = useState<any>(null);
  const [songPreview, setSongPreview] = useState<any>(null);

  const generateMap = () => {
    const layout = generateMapLayoutWithEdgeCount(edgeCount, false, noMoneyHub);
    setMapLayout(layout);

    // Only show song preview for standard player counts
    if (edgeCount >= 36) {
      const playerCount = edgeCount === 36 ? 4 : 6;
      const preview = getSongImplicationPreview(playerCount);
      setSongPreview(preview);
    } else {
      setSongPreview(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Map Generation Test</h1>

      {/* Controls */}
      <div className="bg-gray-800 p-6 rounded-lg mb-8 max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>

        <div className="space-y-4">
          {/* Edge Count Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Map Size (Token Spaces):
            </label>
            <div className="grid grid-cols-4 gap-2">
              {([15, 18, 24, 25, 30, 36, 48] as const).map((count) => (
                <button
                  key={count}
                  onClick={() => setEdgeCount(count)}
                  className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                    edgeCount === count
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-3">
              {edgeCount === 15 && '15 edges: Extra small map (1x each star, no Classical)'}
              {edgeCount === 18 && '18 edges: Small map (1x each star, no Classical)'}
              {edgeCount === 24 && '24 edges: Medium map (1x each star, no Classical)'}
              {edgeCount === 25 && '25 edges: Medium+ map (1x each star, no Classical)'}
              {edgeCount === 30 && '30 edges: Large map (2x each star, no Classical)'}
              {edgeCount === 36 && '36 edges: Standard map (2x each star, no Classical)'}
              {edgeCount === 48 && '48 edges: Extra large map (2x each star, includes Classical)'}
            </p>
          </div>

          {/* No Money Hub Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="noMoneyHub"
              checked={noMoneyHub}
              onChange={(e) => setNoMoneyHub(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500 focus:ring-offset-gray-800"
            />
            <label htmlFor="noMoneyHub" className="text-sm font-medium cursor-pointer">
              No Money Hub (replace with Household tile - for 3B variant)
            </label>
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
              <li>🎺 Blues Star (blue) - {edgeCount === 15 || edgeCount === 18 || edgeCount === 24 || edgeCount === 25 ? '1x' : '2x'} per map</li>
              <li>🤠 Country Star (tan) - {edgeCount === 15 || edgeCount === 18 || edgeCount === 24 || edgeCount === 25 ? '1x' : '2x'} per map</li>
              <li>🎷 Jazz Star (purple) - {edgeCount === 15 || edgeCount === 18 || edgeCount === 24 || edgeCount === 25 ? '1x' : '2x'} per map</li>
              <li>🎸 Rock Star (coral) - {edgeCount === 15 || edgeCount === 18 || edgeCount === 24 || edgeCount === 25 ? '1x' : '2x'} per map</li>
              <li>🎤 Pop Star (green) - {edgeCount === 15 || edgeCount === 18 || edgeCount === 24 || edgeCount === 25 ? '1x' : '2x'} per map</li>
              {edgeCount === 48 && (
                <li>🎤 Classical Star (grey) - 2x per map (48-edge only)</li>
              )}
              <li>⚡ Power Hub (yellow) - 1x per map</li>
              {!noMoneyHub && <li>💵 Money Hub (bright green) - 1x per map</li>}
              {noMoneyHub && <li className="text-yellow-400 font-semibold">💵 Money Hub replaced with additional Household</li>}
            </ul>
            <p className="mt-3 text-xs">
              Grey circles = edges where Influence Tokens are placed
            </p>
            <p className="mt-2 text-xs">
              Hexes with 5-6 surrounding token spaces show an extra 🏠 icon (except Buzz/Money Hubs)
            </p>
            <p className="mt-2 text-xs font-semibold text-yellow-400">
              {(edgeCount === 15 || edgeCount === 18 || edgeCount === 24 || edgeCount === 25) && 'Small/Medium maps (15/18/24/25): Each star appears only once, no Classical Star'}
              {(edgeCount === 30 || edgeCount === 36) && 'Large maps (30/36): Each star appears twice, no Classical Star'}
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!mapLayout && (
        <div className="bg-blue-900 border border-blue-700 p-6 rounded-lg max-w-2xl">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <p className="text-sm text-blue-100">
            Select a map size (15, 18, 24, 25, 30, 36, or 48 token spaces), then click "Generate Map" to see a
            randomly generated hexagonal board layout. Each map is uniquely generated with a random
            arrangement of hexagons that creates exactly the target number of edges (token spaces).
          </p>
          <p className="text-sm text-blue-100 mt-2">
            <strong>Map Sizes:</strong>
          </p>
          <ul className="text-sm text-blue-100 mt-1 ml-4 space-y-1">
            <li>• <strong>15 edges:</strong> Extra small map - Each star appears 1x, no Classical Star</li>
            <li>• <strong>18 edges:</strong> Small map - Each star appears 1x, no Classical Star</li>
            <li>• <strong>24 edges:</strong> Medium map - Each star appears 1x, no Classical Star</li>
            <li>• <strong>25 edges:</strong> Medium+ map - Each star appears 1x, no Classical Star</li>
            <li>• <strong>30 edges:</strong> Large map - Each star appears 2x, no Classical Star</li>
            <li>• <strong>36 edges:</strong> Standard map - Each star appears 2x, no Classical Star</li>
            <li>• <strong>48 edges:</strong> Extra large map - Each star appears 2x, includes Classical Star (2x)</li>
          </ul>
          <p className="text-sm text-blue-100 mt-2">
            <strong>Note:</strong> Grey circles show valid spaces where Influence Tokens can be placed
            (on the shared flat sides between two adjacent hexagons). Map boundary edges cannot have tokens.
          </p>
        </div>
      )}
    </div>
  );
}
