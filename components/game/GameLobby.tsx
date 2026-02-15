"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Player {
  id: string;
  name: string;
  isMe: boolean;
}

interface GameLobbyProps {
  roomCode: string;
  players: Player[];
  onStartGame: (variant?: string) => void;
  isStarting: boolean;
}

export function GameLobby({ roomCode, players, onStartGame, isStarting }: GameLobbyProps) {
  const isCreator = players.length > 0 && players[0].isMe;
  const [fourPlayerVariant, setFourPlayerVariant] = useState<"4A" | "4B">("4B");
  const [fivePlayerVariant, setFivePlayerVariant] = useState<"5A" | "5B">("5B");

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Payola</h1>
            <p className="text-gray-600">Waiting for players to join...</p>
          </div>
        </CardHeader>
        <CardContent>
          {/* Room Code */}
          <div className="bg-indigo-100 border-2 border-indigo-300 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-indigo-600 font-semibold mb-1">Room Code</p>
            <p className="text-4xl font-bold text-indigo-900 tracking-widest">{roomCode}</p>
            <p className="text-xs text-indigo-600 mt-2">Share this code with other players</p>
          </div>

          {/* Players List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Players ({players.length})
            </h3>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
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
                  {index === 0 && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Variant Selection for 4 Players */}
          {isCreator && players.length === 4 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Choose 4-Player Variant:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFourPlayerVariant("4A")}
                  disabled={isStarting}
                  className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                    fourPlayerVariant === "4A"
                      ? "bg-indigo-600 text-white border-2 border-indigo-700"
                      : "bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400"
                  } disabled:opacity-50`}
                >
                  <div className="font-bold">4A Variant</div>
                  <div className="text-xs mt-1">3 Songs</div>
                </button>
                <button
                  onClick={() => setFourPlayerVariant("4B")}
                  disabled={isStarting}
                  className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                    fourPlayerVariant === "4B"
                      ? "bg-indigo-600 text-white border-2 border-indigo-700"
                      : "bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400"
                  } disabled:opacity-50`}
                >
                  <div className="font-bold">4B Variant</div>
                  <div className="text-xs mt-1">4 Songs</div>
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {fourPlayerVariant === "4A"
                  ? "Classic mode with 3 songs. 2-way ties trigger wheel spin."
                  : "Enhanced mode with 4 songs. 2-way ties resolved by second-highest bid."}
              </p>
            </div>
          )}

          {/* Variant Selection for 5 Players */}
          {isCreator && players.length === 5 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Choose 5-Player Variant:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFivePlayerVariant("5A")}
                  disabled={isStarting}
                  className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                    fivePlayerVariant === "5A"
                      ? "bg-indigo-600 text-white border-2 border-indigo-700"
                      : "bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400"
                  } disabled:opacity-50`}
                >
                  <div className="font-bold">5A Variant</div>
                  <div className="text-xs mt-1">3 Songs</div>
                </button>
                <button
                  onClick={() => setFivePlayerVariant("5B")}
                  disabled={isStarting}
                  className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                    fivePlayerVariant === "5B"
                      ? "bg-indigo-600 text-white border-2 border-indigo-700"
                      : "bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400"
                  } disabled:opacity-50`}
                >
                  <div className="font-bold">5B Variant</div>
                  <div className="text-xs mt-1">4 Songs</div>
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {fivePlayerVariant === "5A"
                  ? "Classic mode with 3 songs. 2-way ties trigger wheel spin."
                  : "Enhanced mode with 4 songs. 2-way ties resolved by second-highest bid."}
              </p>
            </div>
          )}

          {/* Start Button */}
          {isCreator && (
            <Button
              onClick={() => onStartGame(players.length === 4 ? fourPlayerVariant : players.length === 5 ? fivePlayerVariant : undefined)}
              disabled={players.length < 3 || isStarting}
              className="w-full text-lg py-3"
            >
              {isStarting ? "Starting..." : players.length < 3 ? "Need at least 3 players" : "Start Game"}
            </Button>
          )}

          {!isCreator && (
            <div className="text-center text-gray-600">
              Waiting for host to start the game...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
