"use client";

import React from "react";

export type Song = "A" | "B" | "C";

interface Player {
  id: string;
  name: string;
  isMe: boolean;
}

interface SongSelectorProps {
  selectedSong: Song | null;
  onSelectSong: (song: Song) => void;
  disabled?: boolean;
  players?: Player[]; // Player list to show names
  turnOrderA?: string[] | null; // Turn order for Song A (array of player IDs)
  turnOrderB?: string[] | null; // Turn order for Song B (array of player IDs)
  turnOrderC?: string[] | null; // Turn order for Song C (array of player IDs)
}

export function SongSelector({
  selectedSong,
  onSelectSong,
  disabled = false,
  players,
  turnOrderA,
  turnOrderB,
  turnOrderC
}: SongSelectorProps) {
  const allSongs: { id: Song; name: string; color: string; bgColor: string; borderColor: string; textColor: string }[] = [
    { id: "A", name: "Song A", color: "blue", bgColor: "bg-blue-50", borderColor: "border-blue-400", textColor: "text-blue-600" },
    { id: "B", name: "Song B", color: "green", bgColor: "bg-green-50", borderColor: "border-green-400", textColor: "text-green-600" },
    { id: "C", name: "Song C", color: "purple", bgColor: "bg-purple-50", borderColor: "border-purple-400", textColor: "text-red-600" },
  ];

  // Filter out Song C for 3, 4, and 5 player games (only 6-player games have Song C)
  const songs = players && players.length < 6
    ? allSongs.filter(s => s.id !== "C")
    : allSongs;

  // Convert turn order (player IDs) to player names with bold for current player
  const getTurnOrderDisplay = (songId: Song): React.ReactNode | null => {
    if (!players || players.length === 0) return null;

    let turnOrder: string[] | null = null;
    if (songId === "A") turnOrder = turnOrderA || null;
    if (songId === "B") turnOrder = turnOrderB || null;
    if (songId === "C") turnOrder = turnOrderC || null;

    if (!turnOrder || turnOrder.length === 0) return null;

    // Map player IDs to player objects
    const playerObjects = turnOrder.map(playerId => {
      const player = players.find(p => p.id === playerId);
      return player || { id: playerId, name: 'Unknown', isMe: false };
    });

    // Create elements with bold for current player
    return (
      <span>
        {playerObjects.map((player, i) => {
          return (
            <React.Fragment key={i}>
              {i > 0 && <span className="mx-0.5">→</span>}
              {player.isMe ? (
                <span className="font-bold">{player.name}</span>
              ) : (
                <span>{player.name}</span>
              )}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  return (
    <div className={`grid gap-4 ${songs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {songs.map((song) => {
        const turnOrderDisplay = getTurnOrderDisplay(song.id);

        return (
          <button
            key={song.id}
            onClick={() => onSelectSong(song.id)}
            disabled={disabled}
            className={`
              ${song.bgColor} border-2 rounded-lg p-6 transition-all
              ${selectedSong === song.id ? `${song.borderColor} ring-4 ring-${song.color}-200` : "border-gray-300"}
              ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 cursor-pointer"}
            `}
          >
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${song.textColor}`}>
                {song.id}
              </div>
              <div className="text-sm font-semibold text-gray-700">{song.name}</div>
              {turnOrderDisplay && (
                <div className="mt-2 text-xs text-gray-700 bg-white rounded px-2 py-1 leading-relaxed text-center break-words">
                  {turnOrderDisplay}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
