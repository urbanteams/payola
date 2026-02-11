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
import { FirstMapCompletedScreen } from "./FirstMapCompletedScreen";
import { SecondMapResultsScreen } from "./SecondMapResultsScreen";
import { FinalResultsMultiMap } from "./FinalResultsMultiMap";
import { FirstMapResultsTab } from "./FirstMapResultsTab";
import { Card, CardContent } from "@/components/ui/Card";
import { calculateSongTotals, isTieRequiringWheel, getWheelSongs } from "@/lib/game/bidding-logic";
import { deserializeMapLayout } from "@/lib/game/map-generator";
import { calculateSymbolsCollected, calculatePowerHubScores, calculateMoneyPoints } from "@/lib/game/end-game-scoring";
import { HexIcon } from "./HexIcon";
import { deserializeInventory, CardInventory, calculateTotalValue } from "@/lib/game/card-inventory";

export function GameBoard() {
  const { gameState, loading, error, submitBid, advanceGame } = useGame();

  // Debug: Log game state to browser console
  React.useEffect(() => {
    if (gameState?.game) {
      console.error('🎮 GAME STATE:', {
        roundNumber: gameState.game.roundNumber,
        isMultiMap: gameState.game.isMultiMap,
        isPOTS: gameState.game.isPOTS,
        hasTurnOrderA: !!gameState.game.turnOrderA,
        hasTurnOrderB: !!gameState.game.turnOrderB,
        hasTurnOrderC: !!gameState.game.turnOrderC,
        hasTurnOrderD: !!gameState.game.turnOrderD,
      });
    }
  }, [gameState?.game.roundNumber, gameState?.game.isMultiMap]);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [hasShownWheel, setHasShownWheel] = useState(false);
  const [showInitialMap, setShowInitialMap] = useState(false);
  const [hasShownInitialMap, setHasShownInitialMap] = useState(false);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [previousRound, setPreviousRound] = useState(1);
  const [currentView, setCurrentView] = useState<'game' | 'map' | 'firstMap'>('game');

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
      // Filter out NPC bids before calculating totals
      const filteredBids = gameState.allBids.filter(bid => bid.playerName !== 'NPC');
      const songTotals = calculateSongTotals(filteredBids);
      // Dynamically determine available songs based on which turn orders exist
      const availableSongs: Array<"A" | "B" | "C" | "D"> = [];
      if (gameState.game.turnOrderA) availableSongs.push("A");
      if (gameState.game.turnOrderB) availableSongs.push("B");
      if (gameState.game.turnOrderC) availableSongs.push("C");
      if (gameState.game.turnOrderD) availableSongs.push("D");

      if (isTieRequiringWheel(songTotals, availableSongs as any, gameState.game.gameVariant)) {
        setShowWheel(true);
        setHasShownWheel(true);
      }
    }
    // Reset when leaving RESULTS state
    if (gameState?.game.status !== "RESULTS") {
      setShowWheel(false);
      setHasShownWheel(false);
    }
  }, [gameState?.game.status, gameState?.allBids, hasShownWheel, gameState?.game.turnOrderA, gameState?.game.turnOrderB, gameState?.game.turnOrderC, gameState?.game.turnOrderD]);

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

  const handleWheelWinnerSelected = (winner: "A" | "B" | "C" | "D") => {
    // Wait a moment before showing results
    setTimeout(() => {
      setShowWheel(false);
    }, 1500);
  };

  const handleStartGame = async (variant?: string) => {
    setIsAdvancing(true);
    try {
      await advanceGame("start", variant);
    } catch (err) {
      console.error("Failed to start game:", err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSubmitBid = async (song: string, amount: number, cards?: number[]) => {
    await submitBid(song, amount, cards);
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

  const handleAdvanceToSecondMap = async () => {
    setIsAdvancing(true);
    try {
      await advanceGame("startSecondMap");
    } catch (err) {
      console.error("Failed to advance to second map:", err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleAdvanceToFinalResults = async () => {
    setIsAdvancing(true);
    try {
      await advanceGame("viewFinalResults");
    } catch (err) {
      console.error("Failed to advance to final results:", err);
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

  const { game, players: allPlayers, currentBid, biddingState, allBids: allBidsRaw, promisePhaseBids: allPromisePhaseBids } = gameState;

  // Filter out NPC player from display
  const players = allPlayers.filter(p => p.name !== 'NPC');

  // Filter out NPC bids from all bids and promise phase
  const allBids = allBidsRaw?.filter(bid => bid.playerName !== 'NPC') || null;
  const promisePhaseBids = allPromisePhaseBids?.filter(bid => bid.playerName !== 'NPC') || null;

  const myPlayer = players.find(p => p.isMe);
  const currencyBalance = myPlayer?.currencyBalance || 0;

  // Check if card-based variant (3B, 4B, 5B, 6B)
  const isCardVariant = game.gameVariant === "3B" || game.gameVariant === "4B" || game.gameVariant === "5B" || game.gameVariant === "6B";
  const is3BVariant = isCardVariant; // For backward compatibility with prop names

  // Parse card inventory for card variants
  let cardInventory: CardInventory | null = null;
  if (isCardVariant && myPlayer?.cardInventory) {
    try {
      cardInventory = deserializeInventory(myPlayer.cardInventory);
    } catch (error) {
      console.error("Failed to parse card inventory:", error);
    }
  }

  // Helper function to calculate rounds per map for Multi-Map mode
  const getRoundsPerMap = (playerCount: number, gameVariant?: string | null): number => {
    // 5B variant uses 4 rounds per map (5 tokens × 4 rounds = 20 edges on NYC20)
    if (gameVariant === "5B") return 4;
    if (playerCount === 3) return 5;
    if (playerCount === 4) return 5;
    if (playerCount === 5) return 5;
    if (playerCount === 6) return 5;
    return 5;
  };

  // Calculate rounds per map for token filtering
  const roundsPerMap = game.isMultiMap ? getRoundsPerMap(players.length, game.gameVariant) : 5;

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

    // For Multi-Map mode, filter tokens based on current map
    const allTokens = gameState.tokens || [];
    const filteredTokens = game.isMultiMap && game.currentMapNumber === 2
      ? allTokens.filter(t => t.roundNumber >= roundsPerMap + 1) // Second map
      : game.isMultiMap && game.currentMapNumber === 1
      ? allTokens.filter(t => t.roundNumber <= roundsPerMap) // First map
      : allTokens; // Normal mode: show all tokens

    return (
      <RoundTransitionMapView
        mapLayout={deserializeMapLayout(game.mapLayout)}
        tokens={filteredTokens.map(t => ({
          id: t.id,
          edgeId: t.edgeId as any,
          playerId: t.playerId,
          playerName: t.playerName,
          playerColor: t.playerColor,
          tokenType: t.tokenType as any,
          orientation: t.orientation as any,
          roundNumber: t.roundNumber,
        }))}
        highlightedEdges={highlightedEdges}
        roundNumber={game.roundNumber}
        onContinue={handleContinueFromRoundTransition}
        isMultiMap={game.isMultiMap}
        totalRounds={game.totalRounds ?? undefined}
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
        isMultiMap={game.isMultiMap}
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
          <TabViewSwitcher
            currentView={currentView}
            onViewChange={setCurrentView}
            showFirstMapTab={game.isMultiMap && game.currentMapNumber === 2 && game.firstMapResults !== null}
          />
        )}

        {/* Map View - Show when map view is selected */}
        {currentView === 'map' && game.mapLayout && game.status !== "TOKEN_PLACEMENT" && game.status !== "FINAL_PLACEMENT" && (() => {
          // For Multi-Map mode, filter tokens based on current map
          const allTokensMapView = gameState.tokens || [];
          const filteredTokensMapView = game.isMultiMap && game.currentMapNumber === 2
            ? allTokensMapView.filter(t => t.roundNumber >= roundsPerMap + 1) // Second map
            : game.isMultiMap && game.currentMapNumber === 1
            ? allTokensMapView.filter(t => t.roundNumber <= roundsPerMap) // First map
            : allTokensMapView; // Normal mode: show all tokens

          return (
            <Card className="mb-6">
              <CardContent className="py-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                  {game.isMultiMap
                    ? game.currentMapNumber === 1
                      ? "First Map"
                      : "Second Map"
                    : "Game Map"}
                </h2>
                <MapViewer
                  mapLayout={deserializeMapLayout(game.mapLayout)}
                  tokens={filteredTokensMapView.map(t => ({
                    id: t.id,
                    edgeId: t.edgeId as any,
                    playerId: t.playerId,
                    playerName: t.playerName,
                    playerColor: t.playerColor,
                    tokenType: t.tokenType as any,
                    orientation: t.orientation as any,
                    roundNumber: t.roundNumber,
                  }))}
                  highlightedEdges={game.highlightedEdges ? JSON.parse(game.highlightedEdges) : []}
                />
                <div className="mt-4 text-center">
                  <p className="text-gray-600">
                    Switch to <strong>Game View</strong> to continue playing
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* First Map Results Tab - Show in Multi-Map mode during second map */}
        {currentView === 'firstMap' && game.isMultiMap && game.firstMapResults && (
          <FirstMapResultsTab firstMapResults={game.firstMapResults} />
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
            <PlayerList players={players} currentRound={game.roundNumber} gameStatus={game.status} isMultiMap={game.isMultiMap} totalRounds={game.totalRounds ?? undefined} is3BVariant={is3BVariant} />
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
                      <PromisePhaseSummary
                        bids={promisePhaseBids}
                        availableSongs={(() => {
                          const songs: Array<"A" | "B" | "C" | "D"> = [];
                          if (game.turnOrderA) songs.push("A");
                          if (game.turnOrderB) songs.push("B");
                          if (game.turnOrderC) songs.push("C");
                          if (game.turnOrderD) songs.push("D");
                          return songs;
                        })()}
                      />
                    )}
                  </div>
                ) : biddingState.needsRound2Bid ? (
                  <div className="space-y-6">
                    {promisePhaseBids && promisePhaseBids.length > 0 && (
                      <PromisePhaseSummary
                        bids={promisePhaseBids}
                        availableSongs={(() => {
                          const songs: Array<"A" | "B" | "C" | "D"> = [];
                          if (game.turnOrderA) songs.push("A");
                          if (game.turnOrderB) songs.push("B");
                          if (game.turnOrderC) songs.push("C");
                          if (game.turnOrderD) songs.push("D");
                          return songs;
                        })()}
                      />
                    )}
                    <BiddingPanel
                      currencyBalance={currencyBalance}
                      round={2}
                      onSubmitBid={handleSubmitBid}
                      players={players}
                      turnOrderA={game.turnOrderA}
                      turnOrderB={game.turnOrderB}
                      turnOrderC={game.turnOrderC}
                      turnOrderD={game.turnOrderD}
                      isPOTS={game.isPOTS}
                      cardInventory={cardInventory}
                      is3BVariant={is3BVariant}
                      currentRound={game.roundNumber}
                      totalRounds={game.totalRounds ?? 10}
                      gameVariant={game.gameVariant}
                    />
                  </div>
                ) : biddingState.waitingForRound2 ? (
                  <div className="space-y-6">
                    {promisePhaseBids && promisePhaseBids.length > 0 && (
                      <PromisePhaseSummary
                        bids={promisePhaseBids}
                        availableSongs={(() => {
                          const songs: Array<"A" | "B" | "C" | "D"> = [];
                          if (game.turnOrderA) songs.push("A");
                          if (game.turnOrderB) songs.push("B");
                          if (game.turnOrderC) songs.push("C");
                          if (game.turnOrderD) songs.push("D");
                          return songs;
                        })()}
                      />
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
                    turnOrderD={game.turnOrderD}
                    isPOTS={game.isPOTS}
                    cardInventory={cardInventory}
                    is3BVariant={is3BVariant}
                    currentRound={game.roundNumber}
                    totalRounds={game.totalRounds ?? 10}
                    gameVariant={game.gameVariant}
                  />
                )}
              </>
            )}

            {/* RESULTS - Show wheel for tie, then results */}
            {game.status === "RESULTS" && allBids && (
              <>
                {showWheel && game.winningSong ? (
                  <SpinningWheel
                    winner={game.winningSong as "A" | "B" | "C" | "D"}
                    onWinnerSelected={handleWheelWinnerSelected}
                    availableSongs={(() => {
                      const allSongs: Array<"A" | "B" | "C" | "D"> = [];
                      if (game.turnOrderA) allSongs.push("A");
                      if (game.turnOrderB) allSongs.push("B");
                      if (game.turnOrderC) allSongs.push("C");
                      if (game.turnOrderD) allSongs.push("D");

                      // Use getWheelSongs to determine which songs should appear on the wheel
                      // For 4-song games with 2-way tie, only the other two songs appear
                      const songTotals = calculateSongTotals(allBids);
                      return getWheelSongs(songTotals, allSongs, game.gameVariant);
                    })()}
                  />
                ) : (
                  <ResultsDisplay
                    bids={allBids}
                    onNextRound={handleNextRound}
                    onFinishGame={() => setShowEndGameConfirm(true)}
                    isAdvancing={isAdvancing}
                    forcedWinner={game.winningSong as "A" | "B" | "C" | "D" | null}
                    players={players}
                    turnOrderA={game.turnOrderA}
                    turnOrderB={game.turnOrderB}
                    turnOrderC={game.turnOrderC}
                    turnOrderD={game.turnOrderD}
                    isPOTS={game.isPOTS}
                    currentRound={game.roundNumber}
                    totalRounds={game.totalRounds ?? undefined}
                    gameVariant={game.gameVariant}
                  />
                )}
              </>
            )}

            {/* TOKEN_PLACEMENT and FINAL_PLACEMENT */}
            {(game.status === "TOKEN_PLACEMENT" || game.status === "FINAL_PLACEMENT") && (() => {
              // For Multi-Map mode, filter tokens based on current map
              const allTokensPlacement = gameState.tokens || [];
              const filteredTokensPlacement = game.isMultiMap && game.currentMapNumber === 2
                ? allTokensPlacement.filter(t => t.roundNumber >= roundsPerMap + 1) // Second map
                : game.isMultiMap && game.currentMapNumber === 1
                ? allTokensPlacement.filter(t => t.roundNumber <= roundsPerMap) // First map
                : allTokensPlacement; // Normal mode: show all tokens

              return (
                <TokenPlacementPhase
                  gameId={game.id}
                  players={players}
                  mapLayout={game.mapLayout}
                  highlightedEdges={game.highlightedEdges}
                  currentTurnIndex={game.currentTurnIndex ?? 0}
                  winningSong={game.winningSong}
                  turnOrderA={game.turnOrderA || []}
                  turnOrderB={game.turnOrderB || []}
                  turnOrderC={game.turnOrderC}
                  turnOrderD={game.turnOrderD}
                  placementTimeout={game.placementTimeout}
                  tokens={filteredTokensPlacement}
                  isFinalPlacement={game.status === "FINAL_PLACEMENT"}
                  isMultiMap={game.isMultiMap}
                  currentMapNumber={game.currentMapNumber}
                  firstMapResults={game.firstMapResults}
                  onTokenPlaced={() => {
                    // Refetch will happen automatically via polling
                  }}
                />
              );
            })()}

            {/* FIRST_MAP_COMPLETED - Multi-Map Mode only */}
            {game.status === "FIRST_MAP_COMPLETED" && game.isMultiMap && game.firstMapResults && game.firstMapLayout && (
              <FirstMapCompletedScreen
                gameId={game.id}
                firstMapResults={game.firstMapResults}
                firstMapLayout={game.firstMapLayout}
                players={players}
                tokens={gameState.tokens || []}
                onAdvanceToSecondMap={handleAdvanceToSecondMap}
                isAdvancing={isAdvancing}
              />
            )}

            {/* SECOND_MAP_COMPLETED - Multi-Map Mode only */}
            {game.status === "SECOND_MAP_COMPLETED" && game.isMultiMap && game.secondMapLayout && (
              <SecondMapResultsScreen
                gameId={game.id}
                secondMapLayout={game.secondMapLayout}
                players={players}
                tokens={gameState.tokens || []}
                onAdvanceToFinalResults={handleAdvanceToFinalResults}
                isAdvancing={isAdvancing}
              />
            )}

            {/* FINISHED - Multi-Map Mode */}
            {game.status === "FINISHED" && game.isMultiMap && game.firstMapResults && game.firstMapLayout && game.secondMapLayout && (
              <FinalResultsMultiMap
                gameId={game.id}
                firstMapResults={game.firstMapResults}
                firstMapLayout={game.firstMapLayout}
                secondMapLayout={game.secondMapLayout}
                players={players}
                tokens={gameState.tokens || []}
              />
            )}

            {/* FINISHED - Standard Mode */}
            {game.status === "FINISHED" && !game.isMultiMap && (
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
                  const powerHubScores = calculatePowerHubScores(
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
                  const moneyPoints = calculateMoneyPoints(
                    players.map(p => {
                      let remainingCardValue: number | undefined;

                      // If player has card inventory, calculate total value of remaining cards
                      if (p.cardInventory) {
                        try {
                          const inventory = deserializeInventory(p.cardInventory);
                          remainingCardValue = calculateTotalValue(inventory.remaining);
                        } catch (error) {
                          console.error(`Failed to parse card inventory for player ${p.name}:`, error);
                          remainingCardValue = 0;
                        }
                      }

                      return {
                        id: p.id,
                        name: p.name,
                        color: p.playerColor || '#888888',
                        currencyBalance: p.currencyBalance,
                        remainingCardValue,
                      };
                    })
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

                      {/* Power Hub Victory Points */}
                      <Card className="mb-6">
                        <CardContent className="py-6">
                          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                            <HexIcon type="powerHub" className="mr-2" />
                            Power Hub Victory Points
                          </h2>
                          <div className="space-y-3">
                            {powerHubScores
                              .sort((a, b) => b.powerHubVictoryPoints - a.powerHubVictoryPoints)
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
                                    {score.powerHubVictoryPoints} VP
                                  </span>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Unspent Money Points */}
                      <Card className="mb-6">
                        <CardContent className="py-6">
                          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Unspent Money Victory Points</h2>
                          <p className="text-sm text-gray-600 text-center mb-4">
                            Each player receives 1 victory point for each dollar they have remaining unspent at the end of the game.
                          </p>
                          <div className="space-y-3">
                            {moneyPoints
                              .sort((a, b) => b.moneyPoints - a.moneyPoints)
                              .map((score) => (
                                <div
                                  key={score.playerId}
                                  className="p-4 rounded-lg border-2 flex items-center justify-between"
                                  style={{ borderColor: score.playerColor }}
                                >
                                  <div>
                                    <span className="font-bold text-lg" style={{ color: score.playerColor }}>
                                      {score.playerName}
                                    </span>
                                    <span className="ml-2 text-gray-600">
                                      (${score.unspentMoney} remaining)
                                    </span>
                                  </div>
                                  <span className="text-2xl font-bold text-gray-700">{score.moneyPoints} VP</span>
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
