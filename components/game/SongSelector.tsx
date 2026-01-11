"use client";

import React from "react";

export type Song = "A" | "B" | "C";

interface SongSelectorProps {
  selectedSong: Song | null;
  onSelectSong: (song: Song) => void;
  disabled?: boolean;
}

export function SongSelector({ selectedSong, onSelectSong, disabled = false }: SongSelectorProps) {
  const songs: { id: Song; name: string; color: string; bgColor: string; borderColor: string; textColor: string }[] = [
    { id: "A", name: "Song A", color: "blue", bgColor: "bg-blue-50", borderColor: "border-blue-400", textColor: "text-blue-600" },
    { id: "B", name: "Song B", color: "green", bgColor: "bg-green-50", borderColor: "border-green-400", textColor: "text-green-600" },
    { id: "C", name: "Song C", color: "purple", bgColor: "bg-purple-50", borderColor: "border-purple-400", textColor: "text-red-600" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {songs.map((song) => (
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
          </div>
        </button>
      ))}
    </div>
  );
}
