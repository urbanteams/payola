"use client";

import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { deserializeInventory } from "@/lib/game/card-inventory";

interface Player {
  id: string;
  name: string;
  currencyBalance?: number | null;
  playerColor?: string | null;
  cardInventory?: string | null;
  isMe: boolean;
}

interface PlayerListProps {
  players: Player[];
  currentRound: number;
  gameStatus?: string;
  isMultiMap?: boolean;
  totalRounds?: number;
  is3BVariant?: boolean;
}

export function PlayerList({ players, currentRound, gameStatus, isMultiMap, totalRounds, is3BVariant = false }: PlayerListProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-gray-800">Players</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {players.map((player) => {
            const borderColor = player.playerColor || '#d1d5db';
            const textColor = player.playerColor || '#1f2937';

            return (
              <div
                key={player.id}
                className={`border-2 rounded-lg p-3 flex items-center justify-between ${
                  player.isMe ? "bg-blue-50" : "bg-white"
                }`}
                style={{ borderColor }}
              >
                <div className="flex items-center space-x-3">
                  {player.playerColor && (
                    <div
                      className="w-6 h-6 rounded-full border-2 border-gray-700"
                      style={{ backgroundColor: player.playerColor }}
                    />
                  )}
                  <span className="font-bold" style={{ color: textColor }}>
                    {player.name}
                    {player.isMe && <span className="text-blue-600 ml-2">(You)</span>}
                  </span>
                </div>

                {!is3BVariant && player.currencyBalance !== null && player.currencyBalance !== undefined ? (
                  // Standard variant: Show currency
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">${player.currencyBalance}</div>
                  </div>
                ) : is3BVariant && player.cardInventory ? (
                  // Card Variant: Show spent cards from previous rounds as visual cards
                  <div className="text-right">
                    {(() => {
                      const inventory = deserializeInventory(player.cardInventory);
                      const sortedSpent = [...inventory.spent].sort((a, b) => a - b);

                      // Group cards by value to create column structure
                      const cardsByValue: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                      sortedSpent.forEach(card => {
                        if (card >= 1 && card <= 5) {
                          cardsByValue[card] = (cardsByValue[card] || 0) + 1;
                        }
                      });

                      const maxRows = Math.max(...Object.values(cardsByValue), 1);
                      const hasCards = sortedSpent.length > 0;

                      return (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Spent:</div>
                          {hasCards ? (
                            <div className="grid grid-cols-5 gap-1 justify-items-end">
                              {/* Create rows for each duplicate level */}
                              {Array.from({ length: maxRows }).map((_, rowIndex) => (
                                <React.Fragment key={rowIndex}>
                                  {/* Create columns for each card value (1-5) */}
                                  {[1, 2, 3, 4, 5].map(cardValue => {
                                    const count = cardsByValue[cardValue];
                                    const shouldShow = rowIndex < count;

                                    return (
                                      <div
                                        key={`${rowIndex}-${cardValue}`}
                                        className="w-[40px] h-[28px] flex items-center justify-center"
                                      >
                                        {shouldShow ? (
                                          <div className="w-full h-full flex items-center justify-center rounded border-2 border-red-400 bg-red-50 text-red-700 text-xs font-bold">
                                            ${cardValue}
                                          </div>
                                        ) : (
                                          <div className="w-full h-full" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">None</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">-</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            {gameStatus === "FINAL_PLACEMENT"
              ? "Final Round"
              : isMultiMap && totalRounds
              ? `Round ${currentRound}/${totalRounds}`
              : `Round ${currentRound}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
