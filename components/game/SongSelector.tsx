"use client";

import React from "react";
import { PlacementOrderDisplay } from "./PlacementOrderDisplay";

export type Song = "A" | "B" | "C" | "D";

interface Player {
  id: string;
  name: string;
  isMe: boolean;
  playerColor?: string | null;
}

interface SongSelectorProps {
  selectedSong: Song | null;
  onSelectSong: (song: Song) => void;
  disabled?: boolean;
  players?: Player[]; // Player list to show names
  turnOrderA?: string[] | null; // Turn order for Song A (array of player IDs)
  turnOrderB?: string[] | null; // Turn order for Song B (array of player IDs)
  turnOrderC?: string[] | null; // Turn order for Song C (array of player IDs)
  turnOrderD?: string[] | null; // Turn order for Song D (array of player IDs)
  isPOTS?: boolean; // POTS mode: always show all 3 songs
}

export function SongSelector({
  selectedSong,
  onSelectSong,
  disabled = false,
  players,
  turnOrderA,
  turnOrderB,
  turnOrderC,
  turnOrderD,
  isPOTS = false
}: SongSelectorProps) {
  const allSongs: { id: Song; name: string; color: string; bgColor: string; borderColor: string; textColor: string }[] = [
    { id: "A", name: "Song A", color: "blue", bgColor: "bg-blue-50", borderColor: "border-blue-400", textColor: "text-blue-600" },
    { id: "B", name: "Song B", color: "green", bgColor: "bg-green-50", borderColor: "border-green-400", textColor: "text-green-600" },
    { id: "C", name: "Song C", color: "purple", bgColor: "bg-purple-50", borderColor: "border-purple-400", textColor: "text-red-600" },
    { id: "D", name: "Song D", color: "orange", bgColor: "bg-orange-50", borderColor: "border-orange-400", textColor: "text-orange-600" },
  ];

  // Determine available songs based on turn orders
  let availableSongs = allSongs.filter(s => s.id === "A" || s.id === "B"); // A and B always available
  if (turnOrderC) availableSongs.push(allSongs.find(s => s.id === "C")!);
  if (turnOrderD) availableSongs.push(allSongs.find(s => s.id === "D")!);

  // For POTS mode, use availableSongs (which includes D for 4-player POTS)
  const songs = availableSongs;

  // Get turn order for a specific song
  const getTurnOrder = (songId: Song): string[] | null => {
    if (songId === "A") return turnOrderA || null;
    if (songId === "B") return turnOrderB || null;
    if (songId === "C") return turnOrderC || null;
    if (songId === "D") return turnOrderD || null;
    return null;
  };

  return (
    <div className="space-y-3">
      {songs.map((song) => {
        const turnOrder = getTurnOrder(song.id);
        const hasPlayers = players && players.length > 0;
        const hasTurnOrder = turnOrder && turnOrder.length > 0;

        return (
          <div
            key={song.id}
            className="flex items-center gap-4"
          >
            {/* Song Button - Compact */}
            <button
              onClick={() => onSelectSong(song.id)}
              disabled={disabled}
              className={`
                ${song.bgColor} border-2 rounded-lg p-4 transition-all flex-shrink-0
                ${selectedSong === song.id ? `${song.borderColor} ring-4 ring-${song.color}-200` : "border-gray-300"}
                ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 cursor-pointer"}
                w-32
              `}
            >
              <div className="text-center">
                <div className={`text-3xl font-bold mb-1 ${song.textColor}`}>
                  {song.id}
                </div>
                <div className="text-xs font-semibold text-gray-700">{song.name}</div>
              </div>
            </button>

            {/* Visual Placement Order Display */}
            {hasPlayers && hasTurnOrder && (
              <div className="flex-1 bg-white border-2 border-gray-200 rounded-lg p-3">
                <PlacementOrderDisplay turnOrder={turnOrder} players={players} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
