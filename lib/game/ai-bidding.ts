/**
 * AI Bidding Logic
 *
 * Implements random bidding strategy for AI players
 */

import { prisma } from "@/lib/prisma";
import {
  deserializeInventory,
  serializeInventory,
  spendCards,
  calculateTotalValue,
} from "./card-inventory";
import { selectCardsForAmount, determineAIBidAmount } from "./ai-card-selection";

/**
 * Generate a random bid for an AI player
 * Strategy: Random amount between 0 and available balance, random song
 * Never bids on songs with fewer token placements
 * AI bids strategically in all rounds (including final) since leftover money/cards = victory points
 */
function generateAIBid(
  currencyBalance: number,
  playerId: string,
  turnOrderA: string[],
  turnOrderB: string[],
  turnOrderC: string[] | null,
  turnOrderD: string[] | null,
  currentRound: number,
  totalRounds: number,
  biddingRound: number,
  round1Bids: Array<{ playerId: string; song: string; amount: number }>,
  aiPlayers: Array<{ id: string }>,
  isPOTS: boolean,
  cardInventory: string | null = null,
  is3BVariant: boolean = false,
  gameVariant: string | null = null
): { song: "A" | "B" | "C" | "D", amount: number, cards?: number[] } {
  // 3B VARIANT: Use card-based bidding
  if (is3BVariant && cardInventory) {
    const inventory = deserializeInventory(cardInventory);
    const totalAvailable = calculateTotalValue(inventory.remaining);

    // Determine available songs
    let availableSongs: ("A" | "B" | "C" | "D")[] = ["A", "B"];
    if (turnOrderC) availableSongs.push("C");
    if (turnOrderD) availableSongs.push("D");

    // Filter out songs with fewer token placements
    const songTokenCounts: Record<"A" | "B" | "C" | "D", number> = {
      A: turnOrderA.filter(id => id === playerId).length,
      B: turnOrderB.filter(id => id === playerId).length,
      C: turnOrderC ? turnOrderC.filter(id => id === playerId).length : 0,
      D: turnOrderD ? turnOrderD.filter(id => id === playerId).length : 0,
    };
    const maxTokens = Math.max(...availableSongs.map(song => songTokenCounts[song]));
    availableSongs = availableSongs.filter(song => songTokenCounts[song] === maxTokens);
    const randomSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];

    // Check if AI has any cards
    if (totalAvailable === 0) {
      console.log(`[AI 3B Bidding] Player has no cards, can only bid $0 to ${randomSong}`);
      return { song: randomSong, amount: 0, cards: [] };
    }

    // Determine bid amount based on card inventory
    const isAISoloBriber = biddingRound === 2 && round1Bids.filter(b => b.amount === 0).length === 1 &&
      round1Bids.find(b => b.amount === 0)?.playerId === playerId;

    let winningSongTotal = 0;
    let preferredSongTotal = 0;
    if (isAISoloBriber) {
      const songTotals: Record<"A" | "B" | "C" | "D", number> = { A: 0, B: 0, C: 0, D: 0 };
      for (const bid of round1Bids) {
        songTotals[bid.song as "A" | "B" | "C" | "D"] += bid.amount;
      }
      winningSongTotal = Math.max(...availableSongs.map(s => songTotals[s]));
      preferredSongTotal = songTotals[randomSong];
    }

    const targetAmount = determineAIBidAmount(
      inventory,
      biddingRound,
      currentRound,
      totalRounds,
      round1Bids,
      isAISoloBriber,
      winningSongTotal,
      preferredSongTotal
    );

    // Select cards to match target amount
    // Determine max cards based on variant and round
    let maxCards: number;
    if (gameVariant === "5A") {
      // 5A variant: R1-4 = 1 card, R5+ = 2 cards
      maxCards = currentRound <= 4 ? 1 : 2;
    } else {
      // Default (3B, 4B, 6B): R1-5 = 1 card, R6+ = 2 cards
      maxCards = currentRound <= 5 ? 1 : 2;
    }
    const selectedCards = selectCardsForAmount(inventory, targetAmount, "random", maxCards);
    const actualAmount = calculateTotalValue(selectedCards);

    // CRITICAL FIX: If we're a solo briber and can't bid enough to actually win, bid $0 instead
    // This prevents pointless bribes where we spend cards but still lose
    if (isAISoloBriber && actualAmount > 0 && actualAmount < targetAmount) {
      console.log(`[AI 3B Solo Briber] Cannot bid enough to win (need $${targetAmount}, can only bid $${actualAmount}). Bidding $0 instead.`);
      return { song: randomSong, amount: 0, cards: [] };
    }

    console.log(`[AI 3B Bidding] Player bidding $${actualAmount} to ${randomSong} with cards: ${JSON.stringify(selectedCards)}`);

    return { song: randomSong, amount: actualAmount, cards: selectedCards };
  }

  // CRITICAL: If AI has no money, can only bid $0
  if (currencyBalance <= 0) {
    // Determine available songs for selection (even though bidding $0)
    let availableSongs: ("A" | "B" | "C" | "D")[] = ["A", "B"];
    if (turnOrderC) availableSongs.push("C");
    if (turnOrderD) availableSongs.push("D");

    // Filter out songs with fewer token placements
    const songTokenCounts: Record<"A" | "B" | "C" | "D", number> = {
      A: turnOrderA.filter(id => id === playerId).length,
      B: turnOrderB.filter(id => id === playerId).length,
      C: turnOrderC ? turnOrderC.filter(id => id === playerId).length : 0,
      D: turnOrderD ? turnOrderD.filter(id => id === playerId).length : 0,
    };
    const maxTokens = Math.max(...availableSongs.map(song => songTokenCounts[song]));
    availableSongs = availableSongs.filter(song => songTokenCounts[song] === maxTokens);
    const randomSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];

    console.log(`[AI Bidding] Player has $0 balance, can only bid $0 to ${randomSong}`);
    return { song: randomSong, amount: 0 };
  }

  // Determine available songs based on which turn orders exist
  let availableSongs: ("A" | "B" | "C" | "D")[] = ["A", "B"];
  if (turnOrderC) availableSongs.push("C");
  if (turnOrderD) availableSongs.push("D");

  // Filter out songs with fewer token placements
  // Count how many tokens this player gets to place for each song
  const songTokenCounts: Record<"A" | "B" | "C" | "D", number> = {
    A: turnOrderA.filter(id => id === playerId).length,
    B: turnOrderB.filter(id => id === playerId).length,
    C: turnOrderC ? turnOrderC.filter(id => id === playerId).length : 0,
    D: turnOrderD ? turnOrderD.filter(id => id === playerId).length : 0,
  };

  // Find maximum token count
  const maxTokens = Math.max(...availableSongs.map(song => songTokenCounts[song]));

  // Filter to only songs that give maximum tokens
  availableSongs = availableSongs.filter(song => songTokenCounts[song] === maxTokens);

  // Random song from available options
  const randomSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];

  // REMOVED: AI no longer automatically bids all money in the final round
  // Money now converts to VP at end of game (1 VP per dollar), so AI should bid strategically

  // BRIBE PHASE (Round 2) SPECIAL LOGIC
  if (biddingRound === 2) {
    // Find the highest promise amount from Round 1
    const highestPromise = Math.max(...round1Bids.map(b => b.amount), 0);

    // Check if AI is the only player in the Bribe Phase
    // This happens when only this AI player bid zero in Round 1 (all others promised non-zero)
    const zeroBidders = round1Bids.filter(b => b.amount === 0);
    const isAISoloBriber = zeroBidders.length === 1 && zeroBidders[0].playerId === playerId;

    console.log(`[AI Bribe Logic] Round 2 bidding - zeroBidders: ${zeroBidders.length}, isAISoloBriber: ${isAISoloBriber}, highestPromise: $${highestPromise}`);

    if (isAISoloBriber) {
      // AI is the only player in Bribe Phase
      // Calculate current totals from Round 1
      const songTotals: Record<"A" | "B" | "C" | "D", number> = {
        A: 0, B: 0, C: 0, D: 0
      };
      for (const bid of round1Bids) {
        const song = bid.song as "A" | "B" | "C" | "D";
        songTotals[song] += bid.amount;
      }

      // Find the currently leading song
      const maxTotal = Math.max(...availableSongs.map(s => songTotals[s]));

      // Calculate minimum amount needed to put preferred song $1 ahead
      const minAmountNeeded = maxTotal - songTotals[randomSong] + 1;

      console.log(`[AI Solo Briber] Song totals: A=$${songTotals.A}, B=$${songTotals.B}, C=$${songTotals.C}, D=$${songTotals.D}`);
      console.log(`[AI Solo Briber] Preferred song: ${randomSong}, current total: $${songTotals[randomSong]}, maxTotal: $${maxTotal}, minAmountNeeded: $${minAmountNeeded}`);

      // AI can only bid 0 or the exact amount needed
      if (minAmountNeeded <= 0 || minAmountNeeded > currencyBalance) {
        // Preferred song is already winning or can't afford to win
        console.log(`[AI Solo Briber] Bidding $0 (already winning or can't afford $${minAmountNeeded})`);
        return { song: randomSong, amount: 0 };
      } else {
        // 50% chance to bid 0, 50% chance to bid exact amount needed
        const amount = Math.random() < 0.5 ? 0 : minAmountNeeded;
        console.log(`[AI Solo Briber] Bidding $${amount} to ${randomSong} (can only bid $0 or $${minAmountNeeded})`);
        return { song: randomSong, amount };
      }
    } else {
      // Other players are also in the Bribe Phase
      // AI must bid higher than the highest promise, unless no one promised
      console.log(`[AI Multi Briber] Other players also in Bribe Phase. Highest promise: $${highestPromise}`);

      if (highestPromise === 0) {
        // No one promised, AI can bid any amount
        let amount: number;
        if (Math.random() < 0.5) {
          amount = 0;
        } else {
          const maxBid = Math.min(currencyBalance, 10);
          amount = Math.floor(Math.random() * maxBid) + 1;
        }
        console.log(`[AI Multi Briber] No one promised, bidding $${amount} to ${randomSong}`);
        return { song: randomSong, amount };
      } else {
        // Must bid higher than highest promise
        const minBid = highestPromise + 1;
        if (minBid > currencyBalance) {
          // Can't afford to bid higher, bid 0
          console.log(`[AI Multi Briber] Cannot afford to bid higher than $${highestPromise}, bidding $0`);
          return { song: randomSong, amount: 0 };
        } else {
          // 50% chance to bid 0, 50% chance to bid higher than highest promise
          if (Math.random() < 0.5) {
            console.log(`[AI Multi Briber] Chose to bid $0 to ${randomSong}`);
            return { song: randomSong, amount: 0 };
          } else {
            const maxBid = Math.min(currencyBalance, highestPromise + 10);
            const amount = Math.floor(Math.random() * (maxBid - minBid + 1)) + minBid;
            console.log(`[AI Multi Briber] Bidding $${amount} to ${randomSong} (must be > $${highestPromise})`);
            return { song: randomSong, amount };
          }
        }
      }
    }
  }

  // PROMISE PHASE (Round 1) LOGIC
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
    const turnOrderD = game.turnOrderD ? JSON.parse(game.turnOrderD) : null;

    const is3BVariant = game.gameVariant === "3B" || game.gameVariant === "4A" || game.gameVariant === "4B" || game.gameVariant === "5A" || game.gameVariant === "5B" || game.gameVariant === "6B";

    for (const aiPlayer of aiPlayers) {
      // Check if AI player needs to bid in current round
      const hasRound1Bid = round1Bids.find(b => b.playerId === aiPlayer.id);

      if (biddingRound === 1 && !hasRound1Bid) {
        // AI needs to submit Round 1 bid
        const { song, amount, cards } = generateAIBid(
          aiPlayer.currencyBalance,
          aiPlayer.id,
          turnOrderA,
          turnOrderB,
          turnOrderC,
          turnOrderD,
          game.roundNumber,
          totalRounds,
          biddingRound,
          round1Bids,
          aiPlayers,
          game.isPOTS,
          aiPlayer.cardInventory,
          is3BVariant,
          game.gameVariant
        );

        await prisma.bid.create({
          data: {
            gameId: game.id,
            playerId: aiPlayer.id,
            round: 1,
            gameRound: game.roundNumber,
            song,
            amount,
            promisedCards: is3BVariant && cards ? JSON.stringify(cards) : null,
          },
        });

        // For Round 1 (promise phase), cards are NOT spent yet - wait for results

        console.log(`AI ${aiPlayer.name} bid ${amount} on Song ${song} in Round 1 (round ${game.roundNumber}/${totalRounds})`);
      } else if (biddingRound === 2 && hasRound1Bid && hasRound1Bid.amount === 0) {
        // AI bid 0 in Round 1, needs to submit Round 2 bid
        const hasRound2Bid = currentRoundBids.find(b => b.playerId === aiPlayer.id && b.round === 2);

        if (!hasRound2Bid) {
          const { song, amount, cards } = generateAIBid(
            aiPlayer.currencyBalance,
            aiPlayer.id,
            turnOrderA,
            turnOrderB,
            turnOrderC,
            turnOrderD,
            game.roundNumber,
            totalRounds,
            biddingRound,
            round1Bids,
            aiPlayers,
            game.isPOTS,
            aiPlayer.cardInventory,
            is3BVariant,
            game.gameVariant
          );

          await prisma.bid.create({
            data: {
              gameId: game.id,
              playerId: aiPlayer.id,
              round: 2,
              gameRound: game.roundNumber,
              song,
              amount,
              promisedCards: is3BVariant && cards ? JSON.stringify(cards) : null,
            },
          });

          // For card variants: Cards are NOT spent immediately in Round 2
          // They will be spent when results are determined (all Round 2 bids spend their cards)

          console.log(`AI ${aiPlayer.name} bid ${amount} on Song ${song} in Round 2 (round ${game.roundNumber}/${totalRounds})`);
        }
      }
    }
  } catch (error) {
    console.error("Error processing AI bids:", error);
  }
}
