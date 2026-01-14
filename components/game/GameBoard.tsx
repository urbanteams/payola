"use client";

import React, { useState, useEffect } from "react";
import { useGame } from "@/lib/contexts/game-context";
import { GameLobby } from "./GameLobby";
import { BiddingPanel } from "./BiddingPanel";
import { PlayerList } from "./PlayerList";
import { ResultsDisplay } from "./ResultsDisplay";
import { PromisePhaseSummary } from "./PromisePhaseSummary";
import { SpinningWheel } from "./SpinningWheel";
import { Card, CardContent } from "@/components/ui/Card";
import { calculateSongTotals, isThreeWayTie } from "@/lib/game/bidding-logic";

export function GameBoard() {
  const { gameState, loading, error, submitBid, advanceGame } = useGame();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [hasShownWheel, setHasShownWheel] = useState(false);

  // Check for 3-way tie when entering RESULTS state
  useEffect(() => {
    if (gameState?.game.status === "RESULTS" && gameState.allBids && !hasShownWheel) {
      const songTotals = calculateSongTotals(gameState.allBids);
      if (isThreeWayTie(songTotals)) {
        setShowWheel(true);
        setHasShownWheel(true);
      }
    }
    // Reset when leaving RESULTS state
    if (gameState?.game.status !== "RESULTS") {
      setShowWheel(false);
      setHasShownWheel(false);
    }
  }, [gameState?.game.status, gameState?.allBids, hasShownWheel]);

  const handleWheelWinnerSelected = (winner: "A" | "B" | "C") => {
    // Wait a moment before showing results
    setTimeout(() => {
      setShowWheel(false);
    }, 1500);
  };

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
    setShowEndGameConfirm(false);
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

  const { game, players, currentBid, biddingState, allBids, promisePhaseBids } = gameState;
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

        {/* Waiting Messages - Always at Top */}
        {(game.status === "ROUND1" || game.status === "ROUND2") && currentBid && (
          <div className="mb-6">
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {currentBid.round === 1 ? (
                    currentBid.amount === 0 ? "Promise Submitted!" : "Waiting on other players"
                  ) : (
                    "Bribe Submitted!"
                  )}
                </h2>
                <p className="text-gray-600 mb-4">
                  You {currentBid.round === 1 ? "promised" : "bribed"} <span className="font-bold text-blue-600">${currentBid.amount}</span> on{" "}
                  <span className="font-bold text-blue-600">Song {currentBid.song}</span>
                </p>
                <p className="text-sm text-gray-500">
                  {currentBid.round === 1 && currentBid.amount === 0 ? (
                    "Waiting for other Promise Phase players..."
                  ) : currentBid.round === 1 && currentBid.amount > 0 ? (
                    "Waiting for Bribe Phase players to submit their bids..."
                  ) : (
                    "Waiting for other players..."
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bribe Phase in Progress - Also at Top */}
        {(game.status === "ROUND1" || game.status === "ROUND2") && !currentBid && biddingState.waitingForRound2 && (
          <div className="mb-6">
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Bribe Phase in Progress</h2>
                <p className="text-gray-600">
                  Players who bid 0 in the Promise Phase are now making their bids...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

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
                  <div className="space-y-6">
                    {/* Show Promise Phase Summary if available */}
                    {promisePhaseBids && promisePhaseBids.length > 0 && (
                      <PromisePhaseSummary bids={promisePhaseBids} />
                    )}
                  </div>
                ) : biddingState.needsRound2Bid ? (
                  <div className="space-y-6">
                    {promisePhaseBids && promisePhaseBids.length > 0 && (
                      <PromisePhaseSummary bids={promisePhaseBids} />
                    )}
                    <BiddingPanel
                      currencyBalance={currencyBalance}
                      round={2}
                      onSubmitBid={handleSubmitBid}
                    />
                  </div>
                ) : biddingState.waitingForRound2 ? (
                  <div className="space-y-6">
                    {promisePhaseBids && promisePhaseBids.length > 0 && (
                      <PromisePhaseSummary bids={promisePhaseBids} />
                    )}
                  </div>
                ) : (
                  <BiddingPanel
                    currencyBalance={currencyBalance}
                    round={1}
                    onSubmitBid={handleSubmitBid}
                  />
                )}
              </>
            )}

            {/* RESULTS - Show wheel for 3-way tie, then results */}
            {game.status === "RESULTS" && allBids && (
              <>
                {showWheel && game.winningSong ? (
                  <SpinningWheel
                    winner={game.winningSong as "A" | "B" | "C"}
                    onWinnerSelected={handleWheelWinnerSelected}
                  />
                ) : (
                  <ResultsDisplay
                    bids={allBids}
                    onNextRound={handleNextRound}
                    onFinishGame={() => setShowEndGameConfirm(true)}
                    isAdvancing={isAdvancing}
                    forcedWinner={game.winningSong as "A" | "B" | "C" | null}
                  />
                )}
              </>
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

        {/* End Game Confirmation Modal */}
        {showEndGameConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="py-8">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-4">⚠️</div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">End Game?</h2>
                  <p className="text-gray-600">
                    Are you sure you want to end the game? This will end the game for all players.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowEndGameConfirm(false)}
                    className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
                    disabled={isAdvancing}
                  >
                    No
                  </button>
                  <button
                    onClick={handleFinishGame}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                    disabled={isAdvancing}
                  >
                    {isAdvancing ? "Ending..." : "Yes"}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
