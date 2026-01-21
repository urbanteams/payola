'use client';

import React from 'react';
import { HexIcon } from './HexIcon';
import type { HexTile } from '@/lib/game/map-generator';
import type { EdgeId } from '@/lib/game/hex-grid';
import { getHexLabel } from '@/lib/game/map-generator';
import { parseEdgeId, getEdgeRotation } from '@/lib/game/hex-grid';

export interface OrientationModalProps {
  edgeId: EdgeId;
  adjacentHexes: HexTile[];
  tokenType: '4/0' | '3/1' | '2/2';
  onConfirm: (orientation: 'A' | 'B') => void;
  onCancel: () => void;
  isPlacing: boolean;
}

export function OrientationModal({
  edgeId,
  adjacentHexes,
  tokenType,
  onConfirm,
  onCancel,
  isPlacing,
}: OrientationModalProps) {
  const [valueA, valueB] = tokenType.split('/').map(Number);

  // Calculate rotation for the token based on edge orientation
  const hexPair = parseEdgeId(edgeId);
  const rotation = hexPair ? getEdgeRotation(hexPair[0], hexPair[1]) : 0;

  // Check if this edge needs value flipping for display (60° diagonal edges)
  const needsFlip = hexPair ? (() => {
    const dq = hexPair[1].q - hexPair[0].q;
    const dr = hexPair[1].r - hexPair[0].r;
    return (dq === 1 && dr === -1);
  })() : false;

  // Get the first two adjacent hexes for orientation choice
  const hex1 = adjacentHexes[0];
  const hex2 = adjacentHexes[1] || adjacentHexes[0]; // Fallback to same hex if only one

  // Calculate display values based on whether we need to flip
  const getDisplayValues = (orientation: 'A' | 'B') => {
    if (needsFlip) {
      // For flipped edges, swap the values in the display
      return {
        hex1Value: orientation === 'A' ? valueB : valueA,
        hex2Value: orientation === 'A' ? valueA : valueB,
      };
    } else {
      // Normal edges
      return {
        hex1Value: orientation === 'A' ? valueA : valueB,
        hex2Value: orientation === 'A' ? valueB : valueA,
      };
    }
  };

  const optionAValues = getDisplayValues('A');
  const optionBValues = getDisplayValues('B');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
        <h3 className="text-2xl font-bold mb-4">Choose Token Orientation</h3>

        <p className="text-gray-300 mb-6">
          Your {tokenType} token has two values. Choose which adjacent hex receives which value:
        </p>

        {/* Orientation Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Option A */}
          <button
            onClick={() => onConfirm('A')}
            disabled={isPlacing}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 disabled:cursor-not-allowed rounded-lg p-6 transition-colors border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-xl font-bold mb-4 text-blue-400">Option A</div>

            {/* Token Display */}
            <div className="flex items-center justify-center mb-4">
              <div
                className="w-20 h-20 rounded-full border-4 border-yellow-500 flex flex-col items-center justify-center bg-yellow-100"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <div className="text-xl font-bold text-gray-900">{valueA}</div>
                <div className="w-full h-px bg-gray-900"></div>
                <div className="text-xl font-bold text-gray-900">{valueB}</div>
              </div>
            </div>

            {/* Hex Mappings */}
            <div className="space-y-3 text-left">
              {hex1 && (
                <div className="flex items-center gap-3 bg-gray-800 p-3 rounded">
                  <HexIcon type={hex1.type} className="text-3xl" />
                  <div className="flex-1">
                    <div className="font-semibold">{getHexLabel(hex1.type)}</div>
                  </div>
                  <div className="text-2xl font-bold text-blue-400">→ {optionAValues.hex1Value}</div>
                </div>
              )}

              {hex2 && hex2 !== hex1 && (
                <div className="flex items-center gap-3 bg-gray-800 p-3 rounded">
                  <HexIcon type={hex2.type} className="text-3xl" />
                  <div className="flex-1">
                    <div className="font-semibold">{getHexLabel(hex2.type)}</div>
                  </div>
                  <div className="text-2xl font-bold text-blue-400">→ {optionAValues.hex2Value}</div>
                </div>
              )}

              {/* Show remaining hexes with lower value */}
              {adjacentHexes.length > 2 && (
                <div className="text-sm text-gray-400">
                  Other adjacent hexes: {valueB} influence each
                </div>
              )}
            </div>
          </button>

          {/* Option B */}
          <button
            onClick={() => onConfirm('B')}
            disabled={isPlacing}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 disabled:cursor-not-allowed rounded-lg p-6 transition-colors border-2 border-transparent hover:border-green-500"
          >
            <div className="text-xl font-bold mb-4 text-green-400">Option B</div>

            {/* Token Display */}
            <div className="flex items-center justify-center mb-4">
              <div
                className="w-20 h-20 rounded-full border-4 border-yellow-500 flex flex-col items-center justify-center bg-yellow-100"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <div className="text-xl font-bold text-gray-900">{valueB}</div>
                <div className="w-full h-px bg-gray-900"></div>
                <div className="text-xl font-bold text-gray-900">{valueA}</div>
              </div>
            </div>

            {/* Hex Mappings */}
            <div className="space-y-3 text-left">
              {hex1 && (
                <div className="flex items-center gap-3 bg-gray-800 p-3 rounded">
                  <HexIcon type={hex1.type} className="text-3xl" />
                  <div className="flex-1">
                    <div className="font-semibold">{getHexLabel(hex1.type)}</div>
                  </div>
                  <div className="text-2xl font-bold text-green-400">→ {optionBValues.hex1Value}</div>
                </div>
              )}

              {hex2 && hex2 !== hex1 && (
                <div className="flex items-center gap-3 bg-gray-800 p-3 rounded">
                  <HexIcon type={hex2.type} className="text-3xl" />
                  <div className="flex-1">
                    <div className="font-semibold">{getHexLabel(hex2.type)}</div>
                  </div>
                  <div className="text-2xl font-bold text-green-400">→ {optionBValues.hex2Value}</div>
                </div>
              )}

              {/* Show remaining hexes with lower value */}
              {adjacentHexes.length > 2 && (
                <div className="text-sm text-gray-400">
                  Other adjacent hexes: {valueA} influence each
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Special Hex Highlights */}
        {adjacentHexes.some((hex) => hex.type === 'buzzHub' || hex.type === 'moneyHub') && (
          <div className="bg-yellow-900 border border-yellow-700 p-4 rounded-lg mb-4">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              ⚠️ Immediate Reward Available!
            </h4>
            {adjacentHexes
              .filter((hex) => hex.type === 'buzzHub' || hex.type === 'moneyHub')
              .map((hex) => (
                <p key={hex.id} className="text-sm text-yellow-100">
                  {hex.type === 'buzzHub' && (
                    <>⚡ Buzz Hub hex: You'll gain Victory Points equal to the influence you place!</>
                  )}
                  {hex.type === 'moneyHub' && (
                    <>💵 Money Hub hex: You'll gain Currency equal to the influence you place!</>
                  )}
                </p>
              ))}
          </div>
        )}

        {/* Cancel Button */}
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            disabled={isPlacing}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {isPlacing ? 'Placing...' : 'Cancel'}
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-400 mt-4">
          The numbers on your token represent how much influence each adjacent hex receives. Choose carefully based on which hexes you want to control!
        </p>
      </div>
    </div>
  );
}
