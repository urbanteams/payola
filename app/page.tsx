"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
              <Button onClick={() => setMode("join")} variant="secondary" className="w-full text-lg py-3">
                Join Existing Game
              </Button>

              {/* Game Info */}
              <div className="mt-8 bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">About Payola:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Bid on songs to make them win</li>
                  <li>• Strategic two-round bidding system</li>
                  <li>• Hidden currency balances</li>
                  <li>• Unique tie-breaking rules</li>
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
