/**
 * AI Bidding Logic
 *
 * Implements random bidding strategy for AI players
 */

import { prisma } from "@/lib/prisma";

/**
 * Generate a random bid for an AI player
 * Strategy: Random amount between 0 and available balance, random song
 * Never bids on songs with fewer token placements
 * In final round, promises all money
 */
function generateAIBid(
  currencyBalance: number,
  playerId: string,
  turnOrderA: string[],
  turnOrderB: string[],
  turnOrderC: string[] | null,
  currentRound: number,
  totalRounds: number
): { song: "A" | "B" | "C", amount: number } {
  // Only 6-player games have Song C available
  let availableSongs: ("A" | "B" | "C")[] = turnOrderC ? ["A", "B", "C"] : ["A", "B"];

  // Filter out songs with fewer token placements
  // Count how many tokens this player gets to place for each song
  const songTokenCounts: Record<"A" | "B" | "C", number> = {
    A: turnOrderA.filter(id => id === playerId).length,
    B: turnOrderB.filter(id => id === playerId).length,
    C: turnOrderC ? turnOrderC.filter(id => id === playerId).length : 0,
  };

  // Find maximum token count
  const maxTokens = Math.max(...availableSongs.map(song => songTokenCounts[song]));

  // Filter to only songs that give maximum tokens
  availableSongs = availableSongs.filter(song => songTokenCounts[song] === maxTokens);

  // Random song from available options
  const randomSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];

  // In the final round (round 6), promise all money
  if (currentRound >= totalRounds) {
    return { song: randomSong, amount: currencyBalance };
  }

  // Random amount between 0 and balance (weighted toward lower amounts)
  // 50% chance of bidding 0
  // 50% chance of bidding 1 to balance
  let amount: number;
  if (Math.random() < 0.5) {
    amount = 0;
  } else {
    // Random amount from 1 to min(balance, 10) for more reasonable bids
    const maxBid = Math.min(currencyBalance, 10);
    amount = Math.floor(Math.random() * maxBid) + 1;
  }

  return { song: randomSong, amount };
}

/**
 * Process AI bids for all AI players who haven't bid yet in the current round
 */
export async function processAIBids(gameId: string): Promise<void> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { createdAt: 'asc' }, // Maintain join order for player indices
        },
        bids: {
          where: { gameRound: await prisma.game.findUnique({ where: { id: gameId } }).then(g => g?.roundNumber || 1) },
        },
      },
    });

    if (!game) {
      console.error("Game not found for AI bidding");
      return;
    }

    // Check if game is in bidding phase
    if (!["ROUND1", "ROUND2"].includes(game.status)) {
      return;
    }

    // Get AI players
    const aiPlayers = game.players.filter(p => p.isAI);
    if (aiPlayers.length === 0) {
      return;
    }

    const currentRoundBids = game.bids.filter(b => b.gameRound === game.roundNumber);
    const round1Bids = currentRoundBids.filter(b => b.round === 1);

    // Determine if we're in Round 1 or Round 2
    const biddingRound = game.status === "ROUND1" ? 1 : 2;

    // Get total rounds for this game
    const totalRounds = game.totalRounds || 6;

    // Parse turn orders from database (stored as JSON arrays of player IDs)
    const turnOrderA = game.turnOrderA ? JSON.parse(game.turnOrderA) : [];
    const turnOrderB = game.turnOrderB ? JSON.parse(game.turnOrderB) : [];
    const turnOrderC = game.turnOrderC ? JSON.parse(game.turnOrderC) : null;

    for (const aiPlayer of aiPlayers) {
      // Check if AI player needs to bid in current round
      const hasRound1Bid = round1Bids.find(b => b.playerId === aiPlayer.id);

      if (biddingRound === 1 && !hasRound1Bid) {
        // AI needs to submit Round 1 bid
        const { song, amount } = generateAIBid(
          aiPlayer.currencyBalance,
          aiPlayer.id,
          turnOrderA,
          turnOrderB,
          turnOrderC,
          game.roundNumber,
          totalRounds
        );

        await prisma.bid.create({
          data: {
            gameId: game.id,
            playerId: aiPlayer.id,
            round: 1,
            gameRound: game.roundNumber,
            song,
            amount,
          },
        });

        console.log(`AI ${aiPlayer.name} bid ${amount} on Song ${song} in Round 1 (round ${game.roundNumber}/${totalRounds})`);
      } else if (biddingRound === 2 && hasRound1Bid && hasRound1Bid.amount === 0) {
        // AI bid 0 in Round 1, needs to submit Round 2 bid
        const hasRound2Bid = currentRoundBids.find(b => b.playerId === aiPlayer.id && b.round === 2);

        if (!hasRound2Bid) {
          const { song, amount } = generateAIBid(
            aiPlayer.currencyBalance,
            aiPlayer.id,
            turnOrderA,
            turnOrderB,
            turnOrderC,
            game.roundNumber,
            totalRounds
          );

          await prisma.bid.create({
            data: {
              gameId: game.id,
              playerId: aiPlayer.id,
              round: 2,
              gameRound: game.roundNumber,
              song,
              amount,
            },
          });

          console.log(`AI ${aiPlayer.name} bid ${amount} on Song ${song} in Round 2 (round ${game.roundNumber}/${totalRounds})`);
        }
      }
    }
  } catch (error) {
    console.error("Error processing AI bids:", error);
  }
}
