"use client";

import React from "react";

interface Player {
  id: string;
  name: string;
  isMe: boolean;
  playerColor?: string | null;
}

interface PlacementOrderDisplayProps {
  turnOrder: string[];
  players: Player[];
}

/**
 * Visual display of token placement order with colored player badges
 * Replaces the old text-based "name → name → name" format
 */
export function PlacementOrderDisplay({ turnOrder, players }: PlacementOrderDisplayProps) {
  // Map player IDs to player objects
  const playerObjects = turnOrder.map(playerId => {
    const player = players.find(p => p.id === playerId);
    return player || { id: playerId, name: 'Unknown', isMe: false, playerColor: null };
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {playerObjects.map((player, index) => {
        const backgroundColor = player.playerColor || '#e5e7eb'; // Default to gray-200 if no color
        const textColor = player.isMe ? '#78350f' : '#1f2937'; // amber-900 for current player, gray-800 for others

        return (
          <React.Fragment key={`${player.id}-${index}`}>
            {index > 0 && (
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            <div
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border-2
                ${player.isMe ? 'border-amber-800 bg-amber-50' : 'border-gray-300 bg-white'}
                transition-all
              `}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-gray-700 flex-shrink-0"
                style={{ backgroundColor }}
              />
              <span
                className={`text-sm ${player.isMe ? 'font-bold' : 'font-medium'}`}
                style={{ color: textColor }}
              >
                {player.name}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
