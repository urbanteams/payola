"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join" | "vsai">("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiPlayerCount, setAiPlayerCount] = useState<3 | 4 | 5 | 6>(3);
  const [fourPlayerVariant, setFourPlayerVariant] = useState<"4A" | "4B">("4B");

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
          playerCount: aiPlayerCount,
          gameVariant: aiPlayerCount === 4 ? fourPlayerVariant : undefined
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-800 mb-2">Payola</h1>
            <p className="text-gray-600">Control the Airwaves</p>
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
              <Button onClick={() => setMode("join")} variant="secondary" className="w-full text-lg py-3">
                Join Existing Game
              </Button>

              {/* Game Rules */}
              <details className="mt-8 bg-gray-50 rounded-lg p-4">
                <summary className="font-semibold text-gray-700 mb-2 cursor-pointer hover:text-gray-900">
                  📖 Game Rules (Click to Expand)
                </summary>
                <div className="mt-4 text-sm text-gray-600 space-y-4">
                  {/* Objective */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">🎯 Objective</h4>
                    <p>You are each in charge of your own music studio in the 1950s and your goal is to expand your studio's influence across the country. Gain influence tokens by bribing radio stations to play your preferred songs. Then use these influence tokens to help your studio reach as many households and recruit as many different types of musical stars as possible. Win by having the most points at the end of the game.</p>
                  </div>

                  {/* Setup */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">🎮 Setup</h4>
                    <ul className="space-y-1 ml-4">
                      <li>• 3-6 players required</li>
                      <li>• Each player starts with 5 bidding cards: $1, $2, $3, $4, and $5. Each player receives an additional, identical set of cards at the halfway point.</li>
                      <li>• Total rounds: 10 (for 3-4 players) or 8 (for 5-6 players)</li>
                    </ul>
                  </div>

                  {/* Game Flow */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">🔄 Game Flow</h4>
                    <p className="mb-2">Each round consists of three phases:</p>
                    <ol className="space-y-1 ml-4 list-decimal">
                      <li><strong>Promise Phase:</strong> Players choose up to one card (in the first half of the game) or two cards (in the second half of the game) to promise to the radio station if they play a specific song. These bids will be public information in the next phase, but they're refunded if your desired song does not win.</li>
                      <li><strong>Bribe Phase:</strong> All players that did not promise any cards in the previous phase may now bribe the radio station with a bid card (or two, in the second half of the game) in order to get a specific song played. Bribes, unlike Promises, are non-refundable - regardless of the outcome.</li>
                      <li><strong>Token Placement Phase:</strong> Players place Influence Tokens on the map in the order dictated by the winning song.</li>
                    </ol>
                      <br></br>
                      <li>If there is a tie between all three songs at the end of the Bribe Phase, a wheel spin will determine the winner.</li>
                      <li>If there is a tie between two songs for the most money received, the third song wins!</li>
                      <li>In the final round, players can Promise or Bribe as many of their remaining cards as they want.</li>

                  </div>

                  {/* Token Placement */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">🎲 Token Placement</h4>
                    <ul className="space-y-1 ml-4">
                      <li>• Tokens can be placed on any highlighted edge between two hexagons</li>
                      <li>• There are three types of tokens: 4/0, 3/1, and 2/2 - and you can choose either orientation when placing it on a highlighted edge between two hexagons</li>
                      <li>• Each value contributes influence to adjacent hexagons</li>
                      <li>• Whoever has the most influence within a hexagon controls it</li>
                      <li>• Ties for hexagon control are friendly; all players tied for the most control of a hexagon earn its contents</li>
                    </ul>
                  </div>

                  {/* Hexagon Types */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">⭐ Hexagon Types</h4>
                    <ul className="space-y-1 ml-4">
                      <li>• <strong>Star Hexagons:</strong> Collect unique star types (Pop, Rock, Jazz, Blues, Country - and Classical in 6P games)</li>
                      <li>• <strong>Household Hexagons:</strong> Whoever has reached the most Households receives the most Victory Points in this category, 2nd-most gets fewer VP, and 3rd-most gets even fewer VP (5-6 player games only)</li>
                      <li>• <strong>Power Hub:</strong> Earn VP immediately based on how much Influence you assign to this hexagon</li>
                    </ul>
                  </div>

                  {/* Scoring */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">📊 Scoring</h4>
                    <p className="mb-1"><strong>Star Collection Points:</strong></p>
                    <ul className="space-y-1 ml-4 mb-2">
                      <li>• 1 star type: 10 pts</li>
                      <li>• 2 types: 25 pts</li>
                      <li>• 3 types: 45 pts</li>
                      <li>• 4 types: 70 pts</li>
                      <li>• 5 types: 100 pts</li>
                      <li>• 6 types: 1000 pts (AUTO-WIN - 6P game only)</li>
                    </ul>
                      <li><strong>Remaining Money:</strong> In addition to Star Collection, Household Points, and Power Hub Points, players earn 1 VP for each unspent dollar they have remaining at the end of the game.</li>
                  </div>
                </div>
              </details>
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

              {aiPlayerCount === 4 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    4-Player Variant:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFourPlayerVariant("4A")}
                      disabled={loading}
                      className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                        fourPlayerVariant === "4A"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      4A (3 Songs)
                    </button>
                    <button
                      onClick={() => setFourPlayerVariant("4B")}
                      disabled={loading}
                      className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                        fourPlayerVariant === "4B"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      4B (4 Songs)
                    </button>
                  </div>
                </div>
              )}

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
