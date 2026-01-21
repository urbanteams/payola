"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface GameState {
  game: {
    id: string;
    roomCode: string;
    status: string;
    roundNumber: number;
    winningSong: string | null;
    isPOTS: boolean;
    turnOrderA: string[] | null;
    turnOrderB: string[] | null;
    turnOrderC: string[] | null;
    turnOrderD: string[] | null;
    mapType: string | null;
    mapLayout: string | null;
    highlightedEdges: string | null;
    currentTurnIndex: number | null;
    placementTimeout: string | null;
  };
  players: Array<{
    id: string;
    name: string;
    currencyBalance: number | null;
    victoryPoints: number;
    playerColor: string | null;
    isMe: boolean;
  }>;
  tokens: Array<{
    id: string;
    edgeId: string;
    playerId: string;
    playerName: string;
    playerColor: string | null;
    tokenType: string;
    orientation: string;
    roundNumber: number;
  }>;
  currentBid: {
    song: string;
    amount: number;
    round: number;
  } | null;
  biddingState: {
    allPlayersSubmittedRound1: boolean;
    needsRound2Bid: boolean;
    waitingForRound2: boolean;
  };
  promisePhaseBids: Array<{
    playerId: string;
    playerName?: string;
    song: string;
    amount: number;
    round: number;
  }> | null;
  allBids: Array<{
    playerId: string;
    playerName?: string;
    song: string;
    amount: number;
    round: number;
  }> | null;
}

interface GameContextType {
  gameState: GameState | null;
  loading: boolean;
  error: string | null;
  submitBid: (song: string, amount: number) => Promise<void>;
  advanceGame: (action: "start" | "nextRound" | "finish") => Promise<void>;
  refetch: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  gameId: string;
  children: React.ReactNode;
  pollingInterval?: number;
}

export function GameProvider({ gameId, children }: Omit<GameProviderProps, 'pollingInterval'>) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Dynamic polling interval based on game state
  const dynamicInterval = React.useMemo(() => {
    if (!gameState) return 2000;

    switch (gameState.game.status) {
      case 'TOKEN_PLACEMENT':
        return 1000; // 1 second - need faster updates for real-time placement
      case 'ROUND1':
      case 'ROUND2':
        return 2000; // 2 seconds - normal bidding
      case 'RESULTS':
        return 3000; // 3 seconds - slower, just showing results
      case 'FINISHED':
        return 0; // Stop polling
      default:
        return 2000;
    }
  }, [gameState?.game.status]);

  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/game/${gameId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch game state: ${response.status}`);
      }

      const data: GameState = await response.json();
      setGameState(data);
      setError(null);

      // Stop polling if game is finished
      if (data.game.status === "FINISHED") {
        setIsPolling(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching game state:", err);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const submitBid = useCallback(async (song: string, amount: number) => {
    try {
      setError(null);
      const response = await fetch(`/api/game/${gameId}/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ song, amount }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit bid: ${response.status}`);
      }

      // Trigger AI bids (will check if game has AI players)
      await fetch(`/api/game/${gameId}/ai-bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }).catch(err => {
        console.error("Failed to process AI bids:", err);
        // Don't throw - AI bids are non-critical
      });

      // Immediately fetch updated state
      await fetchGameState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to submit bid";
      setError(errorMessage);
      console.error("Error submitting bid:", err);
      throw err;
    }
  }, [gameId, fetchGameState]);

  const advanceGame = useCallback(async (action: "start" | "nextRound" | "finish") => {
    try {
      setError(null);
      const response = await fetch(`/api/game/${gameId}/advance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to advance game: ${response.status}`);
      }

      // Trigger AI bids after advancing (e.g., after starting game or next round)
      if (action === "start" || action === "nextRound") {
        await fetch(`/api/game/${gameId}/ai-bid`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }).catch(err => {
          console.error("Failed to process AI bids:", err);
        });
      }

      // Immediately fetch updated state
      await fetchGameState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to advance game";
      setError(errorMessage);
      console.error("Error advancing game:", err);
      throw err;
    }
  }, [gameId, fetchGameState]);

  // Trigger initial AI bids for games that start in bidding phases (AI games)
  useEffect(() => {
    if (gameState && ["ROUND1", "ROUND2"].includes(gameState.game.status)) {
      // Check if we haven't triggered AI bids yet on initial load
      const hasAnyBids = gameState.currentBid !== null ||
                         (gameState.allBids && gameState.allBids.length > 0);

      if (!hasAnyBids) {
        // Trigger AI bids on initial load
        fetch(`/api/game/${gameId}/ai-bid`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }).catch(err => {
          console.error("Failed to process initial AI bids:", err);
        });
      }
    }
  }, [gameState?.game.status, gameId]); // Only run when status changes or on mount

  // Polling effect with dynamic interval
  useEffect(() => {
    if (!isPolling || dynamicInterval === 0) return;

    // Initial fetch
    fetchGameState();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchGameState();
    }, dynamicInterval);

    return () => clearInterval(interval);
  }, [isPolling, dynamicInterval, fetchGameState]);

  // Visibility change handler - refetch when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loading) {
        fetchGameState(); // Refetch when tab becomes visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchGameState, loading]);

  const value: GameContextType = {
    gameState,
    loading,
    error,
    submitBid,
    advanceGame,
    refetch: fetchGameState,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
