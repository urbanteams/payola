"use client";

import React from "react";
import { CardInventory, calculateTotalValue } from "@/lib/game/card-inventory";

interface CardSelectorProps {
  inventory: CardInventory;
  onSelectCards: (cards: number[]) => void;
  disabled?: boolean;
  selectedCards: number[];
  currentRound?: number; // Current game round to determine max cards
  totalRounds?: number; // Total rounds in game (to detect final round)
  gameVariant?: string | null; // Game variant to determine round limits
}

export default function CardSelector({
  inventory,
  onSelectCards,
  disabled = false,
  selectedCards,
  currentRound = 1,
  totalRounds = 10,
  gameVariant = null,
}: CardSelectorProps) {
  // Determine max cards based on variant and round
  const isFinalRound = currentRound >= totalRounds;

  let maxCards: number;
  if (isFinalRound) {
    maxCards = Infinity; // Final round: unlimited cards
  } else if (gameVariant === "5A") {
    // 5A variant: R1-4 = 1 card, R5-7 = 2 cards, R8 = unlimited
    maxCards = currentRound <= 4 ? 1 : 2;
  } else {
    // Default (3B, 4B, 6B): R1-5 = 1 card, R6+ = 2 cards, final = unlimited
    maxCards = currentRound <= 5 ? 1 : 2;
  }
  // Track which card indices have been used (to handle selecting/deselecting individual cards)
  const [usedIndices, setUsedIndices] = React.useState<number[]>([]);

  // Rebuild usedIndices when selectedCards changes externally (e.g., on clear)
  React.useEffect(() => {
    if (selectedCards.length === 0) {
      setUsedIndices([]);
    }
  }, [selectedCards.length]);

  const handleCardClick = (index: number, value: number) => {
    if (disabled) return;

    // Check if this specific card (by index) is already selected
    const isThisCardSelected = usedIndices.includes(index);

    if (isThisCardSelected) {
      // Deselect this specific card
      const newUsedIndices = usedIndices.filter(i => i !== index);
      setUsedIndices(newUsedIndices);

      // Remove one instance of this value from selectedCards
      const newSelectedCards = [...selectedCards];
      const cardIndex = newSelectedCards.indexOf(value);
      if (cardIndex !== -1) {
        newSelectedCards.splice(cardIndex, 1);
      }
      onSelectCards(newSelectedCards);
    } else {
      // Check if we've reached the max number of cards
      if (usedIndices.length >= maxCards) {
        // If maxCards is 1, allow switching to a different card
        if (maxCards === 1) {
          // Clear current selection and select new card
          setUsedIndices([index]);
          onSelectCards([value]);
        } else {
          // For multiple card selection, don't allow more selections
          return;
        }
      } else {
        // Select this card
        setUsedIndices([...usedIndices, index]);
        onSelectCards([...selectedCards, value]);
      }
    }
  };

  const handleClear = () => {
    if (!disabled) {
      setUsedIndices([]);
      onSelectCards([]);
    }
  };

  const totalValue = calculateTotalValue(selectedCards);

  return (
    <div className="space-y-4">
      {/* Individual Card Buttons - Horizontal card-like shape */}
      <div className="flex flex-wrap gap-2">
        {inventory.remaining.map((cardValue, index) => {
          const isSelected = usedIndices.includes(index);

          return (
            <button
              key={index}
              onClick={() => handleCardClick(index, cardValue)}
              disabled={disabled}
              className={`
                relative px-6 py-3 rounded border-2 font-bold text-xl
                transition-all duration-200 min-w-[80px]
                ${
                  isSelected
                    ? "bg-blue-500 border-blue-600 text-white shadow-lg scale-105"
                    : "bg-white border-gray-300 text-gray-800 hover:border-blue-400 hover:shadow-md hover:scale-105"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              ${cardValue}
            </button>
          );
        })}
      </div>

      {/* Selected Cards Summary */}
      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-700">Selected Cards:</span>
          {selectedCards.length > 0 && (
            <button
              onClick={handleClear}
              disabled={disabled}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {selectedCards.length === 0 ? (
          <div className="text-gray-500 text-sm">No cards selected ($0 bid)</div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectedCards.map((card, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 text-sm font-medium"
                >
                  ${card}
                </span>
              ))}
            </div>
            <div className="text-lg font-bold text-gray-900 mt-2">
              Total: ${totalValue}
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-sm text-gray-600 italic">
        {isFinalRound
          ? "FINAL ROUND: Click as many cards as you want to bid. Click again to deselect."
          : maxCards === 1
          ? "Click ONE card to bid (Rounds 1-5). Click a different card to change selection."
          : "Click up to TWO cards to bid (Rounds 6+). Click again to deselect."}
      </div>
    </div>
  );
}
