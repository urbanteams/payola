"use client";

import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface Player {
  id: string;
  name: string;
  currencyBalance?: number | null;
  isMe: boolean;
}

interface PlayerListProps {
  players: Player[];
  currentRound: number;
}

export function PlayerList({ players, currentRound }: PlayerListProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-gray-800">Players</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className={`
                border-2 rounded-lg p-3 flex items-center justify-between
                ${player.isMe ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"}
              `}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-gray-800">
                  {player.name}
                  {player.isMe && <span className="text-blue-600 ml-2">(You)</span>}
                </span>
              </div>

              {player.currencyBalance !== null && player.currencyBalance !== undefined ? (
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">${player.currencyBalance}</div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">-</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Round {currentRound}</p>
        </div>
      </CardContent>
    </Card>
  );
}
