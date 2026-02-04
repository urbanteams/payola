/**
 * Card Inventory Management for 3B Variant
 *
 * Handles card-based bidding system where players have a fixed set of cards
 * that they can use to form bids. Spent cards are permanent (even across maps).
 */

export interface CardInventory {
  remaining: number[]; // Cards still available to use
  spent: number[];     // Cards already spent (public information)
}

/**
 * Starting cards for B variants: 1×$1, 1×$2, 1×$3, 1×$4, 1×$5
 * Total value: $15
 */
export const STARTING_CARDS = [1, 2, 3, 4, 5];

/**
 * Cards added when second map appears: 1×$1, 1×$2, 1×$3, 1×$4, 1×$5
 * Total value: $15 (bringing total to $30 after second map)
 */
export const SECOND_MAP_CARDS = [1, 2, 3, 4, 5];

/**
 * Create initial card inventory for a new player
 */
export function createInitialInventory(): CardInventory {
  return {
    remaining: [...STARTING_CARDS],
    spent: [],
  };
}

/**
 * Serialize card inventory to JSON string for database storage
 */
export function serializeInventory(inventory: CardInventory): string {
  return JSON.stringify(inventory);
}

/**
 * Deserialize card inventory from JSON string
 */
export function deserializeInventory(json: string): CardInventory {
  const parsed = JSON.parse(json);
  return {
    remaining: parsed.remaining || [],
    spent: parsed.spent || [],
  };
}

/**
 * Calculate total value of a set of cards
 */
export function calculateTotalValue(cards: number[]): number {
  return cards.reduce((sum, card) => sum + card, 0);
}

/**
 * Validate that selected cards are available in the inventory
 * Returns true if all cards can be selected, false otherwise
 */
export function validateCardSelection(
  inventory: CardInventory,
  selectedCards: number[]
): { valid: boolean; error?: string } {
  if (selectedCards.length === 0) {
    // $0 bid is always valid
    return { valid: true };
  }

  // Create a copy of remaining cards to track availability
  const availableCards = [...inventory.remaining];

  for (const card of selectedCards) {
    const index = availableCards.indexOf(card);
    if (index === -1) {
      return {
        valid: false,
        error: `Card $${card} is not available in your inventory`,
      };
    }
    // Remove the card so we don't use it twice
    availableCards.splice(index, 1);
  }

  return { valid: true };
}

/**
 * Spend cards from inventory (move from remaining to spent)
 * Returns updated inventory
 * IMPORTANT: Does not validate - call validateCardSelection first
 */
export function spendCards(
  inventory: CardInventory,
  cardsToSpend: number[]
): CardInventory {
  const newRemaining = [...inventory.remaining];
  const newSpent = [...inventory.spent, ...cardsToSpend];

  // Remove spent cards from remaining
  for (const card of cardsToSpend) {
    const index = newRemaining.indexOf(card);
    if (index !== -1) {
      newRemaining.splice(index, 1);
    }
  }

  return {
    remaining: newRemaining,
    spent: newSpent,
  };
}

/**
 * Get card counts grouped by denomination for display
 * Returns object like { 1: 4, 2: 3, 3: 2, 4: 1 }
 */
export function getCardCounts(cards: number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const card of cards) {
    counts[card] = (counts[card] || 0) + 1;
  }
  return counts;
}

/**
 * Format card inventory for display
 * Example: "4×$1, 3×$2, 2×$3, 1×$4"
 */
export function formatCardInventory(cards: number[]): string {
  if (cards.length === 0) {
    return "None";
  }

  const counts = getCardCounts(cards);
  const denominations = Object.keys(counts)
    .map(Number)
    .sort((a, b) => a - b);

  return denominations
    .map(denom => `${counts[denom]}×$${denom}`)
    .join(", ");
}

/**
 * Check if player has any cards remaining
 */
export function hasCardsRemaining(inventory: CardInventory): boolean {
  return inventory.remaining.length > 0;
}

/**
 * Get total value of remaining cards
 */
export function getRemainingValue(inventory: CardInventory): number {
  return calculateTotalValue(inventory.remaining);
}

/**
 * Add cards to an existing inventory
 * Returns updated inventory with new cards added to remaining
 */
export function addCards(
  inventory: CardInventory,
  cardsToAdd: number[]
): CardInventory {
  return {
    remaining: [...inventory.remaining, ...cardsToAdd],
    spent: [...inventory.spent],
  };
}
