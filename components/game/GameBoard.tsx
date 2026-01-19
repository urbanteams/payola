"use client";

import React, { useState, useEffect } from "react";
import { useGame } from "@/lib/contexts/game-context";
import { GameLobby } from "./GameLobby";
import { BiddingPanel } from "./BiddingPanel";
import { PlayerList } from "./PlayerList";
import { ResultsDisplay } from "./ResultsDisplay";
import { PromisePhaseSummary } from "./PromisePhaseSummary";
import { SpinningWheel } from "./SpinningWheel";
import { InitialMapView } from "./InitialMapView";
import { RoundTransitionMapView } from "./RoundTransitionMapView";
import { TabViewSwitcher } from "./TabViewSwitcher";
import { TokenPlacementPhase } from "./TokenPlacementPhase";
import { MapViewer } from "./MapViewer";
import { Card, CardContent } from "@/components/ui/Card";
import { calculateSongTotals, isTieRequiringWheel } from "@/lib/game/bidding-logic";
import { deserializeMapLayout } from "@/lib/game/map-generator";
import { calculateSymbolsCollected, calculateBuzzHubScores } from "@/lib/game/end-game-scoring";
import { HexIcon } from "./HexIcon";

export function GameBoard() {
  const { gameState, loading, error, submitBid, advanceGame } = useGame();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [hasShownWheel, setHasShownWheel] = useState(false);
  const [showInitialMap, setShowInitialMap] = useState(false);
  const [hasShownInitialMap, setHasShownInitialMap] = useState(false);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [previousRound, setPreviousRound] = useState(1);
  const [currentView, setCurrentView] = useState<'game' | 'map'>('game');

  // Show initial map view when game starts
  useEffect(() => {
    if (
      gameState?.game.status === "ROUND1" &&
      gameState.game.roundNumber === 1 &&
      !hasShownInitialMap &&
      gameState.game.mapLayout
    ) {
      setShowInitialMap(true);
      setHasShownInitialMap(true);
    }
  }, [gameState?.game.status, gameState?.game.roundNumber, hasShownInitialMap, gameState?.game.mapLayout]);

  // Check for tie requiring wheel when entering RESULTS state
  useEffect(() => {
    if (gameState?.game.status === "RESULTS" && gameState.allBids && !hasShownWheel) {
      const songTotals = calculateSongTotals(gameState.allBids);
      const availableSongs = gameState.players.length === 3 ? ["A", "B"] : ["A", "B", "C"];
      if (isTieRequiringWheel(songTotals, availableSongs as any)) {
        setShowWheel(true);
        setHasShownWheel(true);
      }
    }
    // Reset when leaving RESULTS state
    if (gameState?.game.status !== "RESULTS") {
      setShowWheel(false);
      setHasShownWheel(false);
    }
  }, [gameState?.game.status, gameState?.allBids, hasShownWheel, gameState?.players.length]);

  // Show round transition map when starting a new round (after round 1)
  useEffect(() => {
    if (
      gameState?.game.status === "ROUND1" &&
      gameState.game.roundNumber > previousRound &&
      gameState.game.roundNumber > 1 &&
      gameState.game.mapLayout &&
      gameState.game.highlightedEdges
    ) {
      setShowRoundTransition(true);
      setPreviousRound(gameState.game.roundNumber);
    }
  }, [gameState?.game.status, gameState?.game.roundNumber, previousRound, gameState?.game.mapLayout, gameState?.game.highlightedEdges]);

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

  const handleContinueFromInitialMap = () => {
    setShowInitialMap(false);
  };

  const handleContinueFromRoundTransition = () => {
    setShowRoundTransition(false);
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

  // Round Transition Map View - Show when new round starts (after round 1)
  if (showRoundTransition && game.mapLayout && game.highlightedEdges) {
    const highlightedEdges = JSON.parse(game.highlightedEdges);
    return (
      <RoundTransitionMapView
        mapLayout={deserializeMapLayout(game.mapLayout)}
        tokens={gameState.tokens?.map(t => ({
          id: t.id,
          edgeId: t.edgeId as any,
          playerId: t.playerId,
          playerName: t.playerName,
          playerColor: t.playerColor,
          tokenType: t.tokenType as any,
          orientation: t.orientation as any,
          roundNumber: t.roundNumber,
        })) || []}
        highlightedEdges={highlightedEdges}
        roundNumber={game.roundNumber}
        onContinue={handleContinueFromRoundTransition}
      />
    );
  }

  // Initial Map View - Show at game start
  if (showInitialMap && game.mapLayout) {
    const highlightedEdges = game.highlightedEdges ? JSON.parse(game.highlightedEdges) : [];
    return (
      <InitialMapView
        mapLayout={deserializeMapLayout(game.mapLayout)}
        highlightedEdges={highlightedEdges}
        onContinue={handleContinueFromInitialMap}
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

        {/* Tab View Switcher - Show during bidding, results, and finished states */}
        {(game.status === "ROUND1" || game.status === "ROUND2" || game.status === "RESULTS" || game.status === "FINISHED") && game.mapLayout && (
          <TabViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
        )}

        {/* Map View - Show when map view is selected */}
        {currentView === 'map' && game.mapLayout && game.status !== "TOKEN_PLACEMENT" && (
          <Card className="mb-6">
            <CardContent className="py-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Game Map</h2>
              <MapViewer
                mapLayout={deserializeMapLayout(game.mapLayout)}
                tokens={gameState.tokens?.map(t => ({
                  id: t.id,
                  edgeId: t.edgeId as any,
                  playerId: t.playerId,
                  playerName: t.playerName,
                  playerColor: t.playerColor,
                  tokenType: t.tokenType as any,
                  orientation: t.orientation as any,
                  roundNumber: t.roundNumber,
                })) || []}
                highlightedEdges={game.highlightedEdges ? JSON.parse(game.highlightedEdges) : []}
              />
              <div className="mt-4 text-center">
                <p className="text-gray-600">
                  Switch to <strong>Game View</strong> to continue playing
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game View Content */}
        {currentView === 'game' && (
          <>
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
                        promisePhaseBids && promisePhaseBids.length > 0 ? (
                          "Waiting for Bribe Phase players to submit their bids..."
                        ) : (
                          "Waiting for other Promise Phase players..."
                        )
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
                      players={players}
                      turnOrderA={game.turnOrderA}
                      turnOrderB={game.turnOrderB}
                      turnOrderC={game.turnOrderC}
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
                    players={players}
                    turnOrderA={game.turnOrderA}
                    turnOrderB={game.turnOrderB}
                    turnOrderC={game.turnOrderC}
                  />
                )}
              </>
            )}

            {/* RESULTS - Show wheel for tie, then results */}
            {game.status === "RESULTS" && allBids && (
              <>
                {showWheel && game.winningSong ? (
                  <SpinningWheel
                    winner={game.winningSong as "A" | "B" | "C"}
                    onWinnerSelected={handleWheelWinnerSelected}
                    availableSongs={players.length === 3 ? ["A", "B"] : ["A", "B", "C"]}
                  />
                ) : (
                  <ResultsDisplay
                    bids={allBids}
                    onNextRound={handleNextRound}
                    onFinishGame={() => setShowEndGameConfirm(true)}
                    isAdvancing={isAdvancing}
                    forcedWinner={game.winningSong as "A" | "B" | "C" | null}
                    players={players}
                    turnOrderA={game.turnOrderA}
                    turnOrderB={game.turnOrderB}
                    turnOrderC={game.turnOrderC}
                  />
                )}
              </>
            )}

            {/* TOKEN_PLACEMENT */}
            {game.status === "TOKEN_PLACEMENT" && (
              <TokenPlacementPhase
                gameId={game.id}
                players={players}
                mapLayout={game.mapLayout}
                highlightedEdges={game.highlightedEdges}
                currentTurnIndex={game.currentTurnIndex ?? 0}
                winningSong={game.winningSong}
                turnOrderA={game.turnOrderA}
                turnOrderB={game.turnOrderB}
                turnOrderC={game.turnOrderC}
                placementTimeout={game.placementTimeout}
                tokens={gameState.tokens || []}
                onTokenPlaced={() => {
                  // Refetch will happen automatically via polling
                }}
              />
            )}

            {/* FINISHED */}
            {game.status === "FINISHED" && (
              <>
                <Card className="mb-6">
                  <CardContent className="py-12 text-center">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-4">Game Over!</h2>
                    <p className="text-gray-600 mb-6">Thanks for playing Payola!</p>
                  </CardContent>
                </Card>

                {/* End Game Statistics */}
                {game.mapLayout && gameState.tokens && (() => {
                  const mapLayout = deserializeMapLayout(game.mapLayout);
                  const playerInfo = players.map(p => ({
                    id: p.id,
                    name: p.name,
                    color: p.playerColor || '#888888',
                  }));
                  const symbolCounts = calculateSymbolsCollected(
                    gameState.tokens.map(t => ({
                      id: t.id,
                      edgeId: t.edgeId as any,
                      playerId: t.playerId,
                      playerName: t.playerName,
                      playerColor: t.playerColor,
                      tokenType: t.tokenType as any,
                      orientation: t.orientation as any,
                      roundNumber: t.roundNumber,
                    })),
                    mapLayout,
                    playerInfo
                  );
                  const buzzHubScores = calculateBuzzHubScores(
                    gameState.tokens.map(t => ({
                      id: t.id,
                      edgeId: t.edgeId as any,
                      playerId: t.playerId,
                      playerName: t.playerName,
                      playerColor: t.playerColor,
                      tokenType: t.tokenType as any,
                      orientation: t.orientation as any,
                      roundNumber: t.roundNumber,
                    })),
                    mapLayout,
                    playerInfo
                  );

                  return (
                    <>
                      {/* Symbols Collected */}
                      <Card className="mb-6">
                        <CardContent className="py-6">
                          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Symbols Collected</h2>
                          <div className="space-y-3">
                            {symbolCounts
                              .sort((a, b) => b.totalSymbols - a.totalSymbols)
                              .map((count) => (
                                <div
                                  key={count.playerId}
                                  className="p-4 rounded-lg border-2"
                                  style={{ borderColor: count.playerColor }}
                                >
                                  <div className="mb-2">
                                    <span className="font-bold text-lg" style={{ color: count.playerColor }}>
                                      {count.playerName}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {count.households > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl">🏠</span>
                                        <span className="text-black font-semibold">{count.households}</span>
                                      </div>
                                    )}
                                    {count.bluesStar > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎺</span>
                                        <span className="text-black font-semibold">{count.bluesStar}</span>
                                      </div>
                                    )}
                                    {count.countryStar > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl">🤠</span>
                                        <span className="text-black font-semibold">{count.countryStar}</span>
                                      </div>
                                    )}
                                    {count.jazzStar > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎷</span>
                                        <span className="text-black font-semibold">{count.jazzStar}</span>
                                      </div>
                                    )}
                                    {count.rockStar > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎸</span>
                                        <span className="text-black font-semibold">{count.rockStar}</span>
                                      </div>
                                    )}
                                    {count.popStar > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎤</span>
                                        <span className="text-black font-semibold">{count.popStar}</span>
                                      </div>
                                    )}
                                    {count.classicalStar > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎹</span>
                                        <span className="text-black font-semibold">{count.classicalStar}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Buzz Hub Victory Points */}
                      <Card className="mb-6">
                        <CardContent className="py-6">
                          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                            <HexIcon type="buzzHub" className="mr-2" />
                            Buzz Hub Victory Points
                          </h2>
                          <div className="space-y-3">
                            {buzzHubScores
                              .sort((a, b) => b.buzzHubVictoryPoints - a.buzzHubVictoryPoints)
                              .map((score) => (
                                <div
                                  key={score.playerId}
                                  className="p-4 rounded-lg border-2 flex items-center justify-between"
                                  style={{ borderColor: score.playerColor }}
                                >
                                  <span className="font-bold text-lg" style={{ color: score.playerColor }}>
                                    {score.playerName}
                                  </span>
                                  <span className="text-2xl font-bold text-gray-700">
                                    {score.buzzHubVictoryPoints} VP
                                  </span>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}

                {/* Final Map State */}
                {game.mapLayout && (
                  <Card className="mb-6">
                    <CardContent className="py-8">
                      <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Final Map</h2>
                      <MapViewer
                        mapLayout={deserializeMapLayout(game.mapLayout)}
                        tokens={gameState.tokens?.map(t => ({
                          id: t.id,
                          edgeId: t.edgeId as any,
                          playerId: t.playerId,
                          playerName: t.playerName,
                          playerColor: t.playerColor,
                          tokenType: t.tokenType as any,
                          orientation: t.orientation as any,
                          roundNumber: t.roundNumber,
                        })) || []}
                        highlightedEdges={[]}
                      />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="py-8 text-center">
                    <button
                      onClick={() => window.location.href = "/"}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold"
                    >
                      Return Home
                    </button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
          </>
        )}

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
