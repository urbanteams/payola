"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface GameState {
  game: {
    id: string;
    roomCode: string;
    status: string;
    roundNumber: number;
    winningSong: string | null;
  };
  players: Array<{
    id: string;
    name: string;
    currencyBalance: number | null;
    isMe: boolean;
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

export function GameProvider({ gameId, children, pollingInterval = 2000 }: GameProviderProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

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

      // Immediately fetch updated state
      await fetchGameState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to advance game";
      setError(errorMessage);
      console.error("Error advancing game:", err);
      throw err;
    }
  }, [gameId, fetchGameState]);

  // Polling effect
  useEffect(() => {
    if (!isPolling) return;

    // Initial fetch
    fetchGameState();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchGameState();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [isPolling, pollingInterval, fetchGameState]);

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
