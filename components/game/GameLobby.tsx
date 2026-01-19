"use client";

import React from "react";
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
  onStartGame: () => void;
  isStarting: boolean;
}

export function GameLobby({ roomCode, players, onStartGame, isStarting }: GameLobbyProps) {
  const isCreator = players.length > 0 && players[0].isMe;

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

          {/* Game Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-700 mb-2">How to Play:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Each player starts with 30 currency</li>
              <li>• Bid on Song A, B, or C in each round</li>
              <li>• The song with the most bids wins</li>
              <li>• Round 1 bidders only pay if they backed the winner</li>
              <li>• Round 2 bidders always pay their bid</li>
              <li>• The winning song determines how many influence tokens you place on the board</li>
              <li>• Win the game by controlling different regions on the board</li>
            </ul>
          </div>

          {/* Start Button */}
          {isCreator && (
            <Button
              onClick={onStartGame}
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
