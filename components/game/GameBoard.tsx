"use client";

import React, { useState } from "react";
import { useGame } from "@/lib/contexts/game-context";
import { GameLobby } from "./GameLobby";
import { BiddingPanel } from "./BiddingPanel";
import { PlayerList } from "./PlayerList";
import { ResultsDisplay } from "./ResultsDisplay";
import { Card, CardContent } from "@/components/ui/Card";

export function GameBoard() {
  const { gameState, loading, error, submitBid, advanceGame } = useGame();
  const [isAdvancing, setIsAdvancing] = useState(false);

  const handleStartGame = async () => {
    setIsAdvancing(true);
    try {
      await advanceGame("start");
    } catch (err) {
      console.error("Failed to start game:", err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSubmitBid = async (song: string, amount: number) => {
    await submitBid(song, amount);
  };

  const handleNextRound = async () => {
    setIsAdvancing(true);
    try {
      await advanceGame("nextRound");
    } catch (err) {
      console.error("Failed to advance to next round:", err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleFinishGame = async () => {
    setIsAdvancing(true);
    try {
      await advanceGame("finish");
    } catch (err) {
      console.error("Failed to finish game:", err);
    } finally {
      setIsAdvancing(false);
    }
  };

  if (loading && !gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-700">Loading game...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Game</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.href = "/"}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return Home
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameState) {
    return null;
  }

  const { game, players, currentBid, biddingState, allBids } = gameState;
  const myPlayer = players.find(p => p.isMe);
  const currencyBalance = myPlayer?.currencyBalance || 0;

  // LOBBY state
  if (game.status === "LOBBY") {
    return (
      <GameLobby
        roomCode={game.roomCode}
        players={players}
        onStartGame={handleStartGame}
        isStarting={isAdvancing}
      />
    );
  }

  // Main game view
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Payola</h1>
          <p className="text-gray-600">Room Code: <span className="font-mono font-bold">{game.roomCode}</span></p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Player List */}
          <div>
            <PlayerList players={players} currentRound={game.roundNumber} />
          </div>

          {/* Center Column - Main Content */}
          <div className="lg:col-span-2">
            {/* ROUND1 or ROUND2 - Bidding */}
            {(game.status === "ROUND1" || game.status === "ROUND2") && (
              <>
                {currentBid ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <div className="text-6xl mb-4">⏳</div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">Bid Submitted!</h2>
                      <p className="text-gray-600 mb-4">
                        You bid <span className="font-bold text-blue-600">{currentBid.amount}</span> on{" "}
                        <span className="font-bold text-blue-600">Song {currentBid.song}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        Waiting for other players...
                      </p>
                    </CardContent>
                  </Card>
                ) : biddingState.needsRound2Bid ? (
                  <BiddingPanel
                    currencyBalance={currencyBalance}
                    round={2}
                    onSubmitBid={handleSubmitBid}
                  />
                ) : biddingState.waitingForRound2 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <div className="text-6xl mb-4">⏳</div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">Round 2 in Progress</h2>
                      <p className="text-gray-600">
                        Players who bid 0 in Round 1 are now making their bids...
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <BiddingPanel
                    currencyBalance={currencyBalance}
                    round={1}
                    onSubmitBid={handleSubmitBid}
                  />
                )}
              </>
            )}

            {/* RESULTS */}
            {game.status === "RESULTS" && allBids && (
              <ResultsDisplay
                bids={allBids}
                onNextRound={handleNextRound}
                onFinishGame={handleFinishGame}
                isAdvancing={isAdvancing}
              />
            )}

            {/* FINISHED */}
            {game.status === "FINISHED" && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">Game Over!</h2>
                  <p className="text-gray-600 mb-6">Thanks for playing Payola!</p>
                  <button
                    onClick={() => window.location.href = "/"}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold"
                  >
                    Return Home
                  </button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
