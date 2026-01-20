"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join" | "vsai" | "pots">("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiPlayerCount, setAiPlayerCount] = useState<3 | 4 | 5 | 6>(3);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create game");
      }

      const data = await response.json();
      router.push(`/game/${data.gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/game/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName: playerName.trim(),
          roomCode: roomCode.trim().toUpperCase(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to join game");
      }

      const data = await response.json();
      router.push(`/game/${data.gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
      setLoading(false);
    }
  };

  const handleCreateAIGame = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/game/create-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName: playerName.trim(),
          playerCount: aiPlayerCount
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        const errorMsg = errorData.details || errorData.error || "Failed to create AI game";
        throw new Error(errorMsg);
      }

      const data = await response.json();
      router.push(`/game/${data.gameId}`);
    } catch (err) {
      console.error("Create AI game error:", err);
      setError(err instanceof Error ? err.message : "Failed to create AI game");
      setLoading(false);
    }
  };

  const handleCreatePOTSGame = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/game/create-pots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName: playerName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        const errorMsg = errorData.details || errorData.error || "Failed to create POTS game";
        throw new Error(errorMsg);
      }

      const data = await response.json();
      router.push(`/game/${data.gameId}`);
    } catch (err) {
      console.error("Create POTS game error:", err);
      setError(err instanceof Error ? err.message : "Failed to create POTS game");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-800 mb-2">Payola</h1>
            <p className="text-gray-600">Strategic bidding game</p>
          </div>
        </CardHeader>
        <CardContent>
          {mode === "menu" && (
            <div className="space-y-4">
              <Button onClick={() => setMode("create")} className="w-full text-lg py-3">
                Create New Game
              </Button>
              <Button onClick={() => setMode("vsai")} variant="secondary" className="w-full text-lg py-3 bg-purple-600 hover:bg-purple-700 text-white">
                VS AI Mode
              </Button>
              <Button onClick={() => setMode("pots")} variant="secondary" className="w-full text-lg py-3 bg-green-600 hover:bg-green-700 text-white">
                POTS Mode (Experimental)
              </Button>
              <Button onClick={() => setMode("join")} variant="secondary" className="w-full text-lg py-3">
                Join Existing Game
              </Button>

              {/* Game Info */}
              <div className="mt-8 bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">About Payola:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Make promises and bribes to radio stations to get them to play your preferred songs</li>
                  <li>• Expand your influence on the map if your preferred songs get played</li>
                  <li>• 3+ players required</li>
                </ul>
              </div>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 text-gray-900"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateGame()}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button onClick={handleCreateGame} disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create Game"}
              </Button>
              <Button onClick={() => { setMode("menu"); setError(""); }} variant="secondary" className="w-full">
                Back
              </Button>
            </div>
          )}

          {mode === "vsai" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 text-gray-900"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateAIGame()}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Players:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([3, 4, 5, 6] as const).map((count) => (
                    <button
                      key={count}
                      onClick={() => setAiPlayerCount(count)}
                      disabled={loading}
                      className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                        aiPlayerCount === count
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800">
                  <strong>VS AI Mode:</strong> Play against {aiPlayerCount - 1} AI opponent{aiPlayerCount > 2 ? 's' : ''} in a {aiPlayerCount}-player game.
                  AI players make strategic bids automatically.
                </p>
              </div>

              <Button onClick={handleCreateAIGame} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                {loading ? "Creating..." : "Start AI Game"}
              </Button>
              <Button onClick={() => { setMode("menu"); setError(""); }} variant="secondary" className="w-full">
                Back
              </Button>
            </div>
          )}

          {mode === "pots" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 text-gray-900"
                  onKeyDown={(e) => e.key === "Enter" && handleCreatePOTSGame()}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 mb-2">
                  <strong>POTS Mode:</strong> 3-player game with fixed song implications vs 2 AI opponents.
                </p>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• Song A: ABB (1 token for A, 2 for B)</li>
                  <li>• Song B: BCC (1 token for B, 2 for C)</li>
                  <li>• Song C: CAA (1 token for C, 2 for A)</li>
                  <li>• 10 rounds with 3 tokens per round</li>
                  <li>• Final placement phase based on money remaining</li>
                </ul>
              </div>

              <Button onClick={handleCreatePOTSGame} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white">
                {loading ? "Creating..." : "Start POTS Game"}
              </Button>
              <Button onClick={() => { setMode("menu"); setError(""); }} variant="secondary" className="w-full">
                Back
              </Button>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Room Code:
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 uppercase text-center text-2xl tracking-widest font-bold text-gray-900"
                  onKeyDown={(e) => e.key === "Enter" && handleJoinGame()}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button onClick={handleJoinGame} disabled={loading} className="w-full">
                {loading ? "Joining..." : "Join Game"}
              </Button>
              <Button onClick={() => { setMode("menu"); setError(""); }} variant="secondary" className="w-full">
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
