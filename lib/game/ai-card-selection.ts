/**
 * AI Card Selection Logic for 3B Variant
 *
 * Implements card selection strategy for AI players using card-based bidding
 */

import { CardInventory, calculateTotalValue, getCardCounts } from "./card-inventory";

export type CardSelectionStrategy = "random" | "greedy" | "exact";

/**
 * Select cards to bid (3B variant rule: 1 card in rounds 1-5, up to 2 cards in rounds 6+, unlimited in final round)
 * @param inventory - Current card inventory
 * @param targetAmount - Desired bid amount
 * @param strategy - Selection strategy to use
 * @param maxCards - Maximum number of cards allowed (1 for rounds 1-5, 2 for rounds 6+, Infinity for final round)
 * @returns Array containing selected card denominations (or empty for $0 bid)
 */
export function selectCardsForAmount(
  inventory: CardInventory,
  targetAmount: number,
  strategy: CardSelectionStrategy = "random",
  maxCards: number = 1
): number[] {
  if (targetAmount === 0 || inventory.remaining.length === 0) {
    return [];
  }

  const availableCards = [...inventory.remaining];

  // Handle unlimited cards (final round)
  if (maxCards === Infinity) {
    // Try to find exact match with any combination of cards
    // Use a greedy approach: sort cards and try to match target
    const sortedCards = [...availableCards].sort((a, b) => b - a); // Descending order

    // First, try to find exact match with single card
    const exactCard = sortedCards.find(card => card === targetAmount);
    if (exactCard) {
      return [exactCard];
    }

    // Try to find exact match with multiple cards using dynamic programming approach
    // For simplicity, use a greedy strategy: pick largest cards that don't exceed target
    const selectedCards: number[] = [];
    let remainingTarget = targetAmount;

    for (const card of sortedCards) {
      if (card <= remainingTarget) {
        selectedCards.push(card);
        remainingTarget -= card;

        if (remainingTarget === 0) {
          // Exact match found!
          return selectedCards;
        }
      }
    }

    // If we couldn't match exactly, return the combination we got (as close as possible without going over)
    if (selectedCards.length > 0) {
      return selectedCards;
    }

    // If no valid combination, use smallest card
    const smallestCard = Math.min(...availableCards);
    return [smallestCard];
  }

  if (maxCards === 1) {
    // Single card selection (Rounds 1-5)
    // Strategy 1: Try to find exact match
    const exactCard = availableCards.find(card => card === targetAmount);
    if (exactCard) {
      return [exactCard];
    }

    // Strategy 2: Find closest card without going over
    const validCards = availableCards.filter(card => card <= targetAmount);
    if (validCards.length > 0) {
      // Pick the highest card that doesn't exceed target
      const bestCard = Math.max(...validCards);
      return [bestCard];
    }

    // Strategy 3: No card fits under target, pick the smallest card available
    const smallestCard = Math.min(...availableCards);
    return [smallestCard];
  } else {
    // Two card selection (Rounds 6-10)
    // Strategy 1: Try to find exact match with one card
    const exactCard = availableCards.find(card => card === targetAmount);
    if (exactCard) {
      return [exactCard];
    }

    // Strategy 2: Try to find exact match with two cards
    for (let i = 0; i < availableCards.length; i++) {
      for (let j = i + 1; j < availableCards.length; j++) {
        if (availableCards[i] + availableCards[j] === targetAmount) {
          return [availableCards[i], availableCards[j]];
        }
      }
    }

    // Strategy 3: Find best combination without going over
    let bestCombination: number[] = [];
    let bestTotal = 0;

    // Try single cards
    for (const card of availableCards) {
      if (card <= targetAmount && card > bestTotal) {
        bestCombination = [card];
        bestTotal = card;
      }
    }

    // Try two-card combinations
    for (let i = 0; i < availableCards.length; i++) {
      for (let j = i + 1; j < availableCards.length; j++) {
        const total = availableCards[i] + availableCards[j];
        if (total <= targetAmount && total > bestTotal) {
          bestCombination = [availableCards[i], availableCards[j]];
          bestTotal = total;
        }
      }
    }

    // If no valid combination found, use smallest card
    if (bestCombination.length === 0) {
      const smallestCard = Math.min(...availableCards);
      return [smallestCard];
    }

    return bestCombination;
  }
}

/**
 * Determine how much AI should bid based on card inventory
 * Mirrors the logic from currency-based bidding
 *
 * @param inventory - Current card inventory
 * @param biddingRound - 1=Promise, 2=Bribe
 * @param currentRound - Current game round number
 * @param totalRounds - Total rounds in game
 * @param round1Bids - Bids from Round 1
 * @param isAISoloBriber - Whether AI is the only player in bribe phase
 * @param winningSongTotal - Total for currently winning song (for solo briber)
 * @param preferredSongTotal - Total for AI's preferred song (for solo briber)
 * @returns Bid amount
 */
export function determineAIBidAmount(
  inventory: CardInventory,
  biddingRound: number,
  currentRound: number,
  totalRounds: number,
  round1Bids: Array<{ amount: number }>,
  isAISoloBriber: boolean,
  winningSongTotal: number = 0,
  preferredSongTotal: number = 0
): number {
  const totalAvailable = calculateTotalValue(inventory.remaining);

  // No cards remaining - can only bid $0
  if (totalAvailable === 0) {
    return 0;
  }

  // Final round: Bid all cards
  if (currentRound >= totalRounds) {
    return totalAvailable;
  }

  // BRIBE PHASE (Round 2) SPECIAL LOGIC
  if (biddingRound === 2) {
    if (isAISoloBriber) {
      // AI is the only player in Bribe Phase
      // Calculate minimum amount needed to be $1 ahead of current leader
      const minAmountNeeded = winningSongTotal - preferredSongTotal + 1;

      if (minAmountNeeded <= 0 || minAmountNeeded > totalAvailable) {
        // Already winning or can't afford to win
        return 0;
      } else {
        // 50% chance to bid 0, 50% chance to bid exact amount needed
        // NOTE: The actual card selection may return less than this amount due to card limits
        // (max 1 card in rounds 1-5, max 2 in rounds 6+). This is checked in generateAIBid()
        // to prevent pointless bribes where the AI can't bid enough to actually win.
        return Math.random() < 0.5 ? 0 : minAmountNeeded;
      }
    } else {
      // Other players are also in the Bribe Phase
      const highestPromise = Math.max(...round1Bids.map(b => b.amount), 0);

      if (highestPromise === 0) {
        // No one promised, AI can bid any amount
        if (Math.random() < 0.5) {
          return 0;
        } else {
          const maxBid = Math.min(totalAvailable, 10);
          return Math.floor(Math.random() * maxBid) + 1;
        }
      } else {
        // Must bid higher than highest promise
        const minBid = highestPromise + 1;
        if (minBid > totalAvailable) {
          // Can't afford to bid higher
          return 0;
        } else {
          // 50% chance to bid 0, 50% chance to bid higher
          if (Math.random() < 0.5) {
            return 0;
          } else {
            const maxBid = Math.min(totalAvailable, highestPromise + 10);
            return Math.floor(Math.random() * (maxBid - minBid + 1)) + minBid;
          }
        }
      }
    }
  }

  // PROMISE PHASE (Round 1) LOGIC
  // 50% chance of bidding 0
  // 50% chance of bidding 1 to min(total, 10)
  if (Math.random() < 0.5) {
    return 0;
  } else {
    const maxBid = Math.min(totalAvailable, 10);
    return Math.floor(Math.random() * maxBid) + 1;
  }
}
