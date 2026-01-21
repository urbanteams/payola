# Payola Tie-Breaking Rules

## Overview
This document explains the tie-breaking rules for different game configurations.

## 2-Song Games (3-player and 5-player games)
**Songs Available:** A, B

**Tie Rule:**
- If Song A and Song B are tied with the most money, the wheel spins between A and B
- The wheel determines the winner

## 3-Song Games (POTS mode)
**Songs Available:** A, B, C

**Tie Rules:**
- **2-way tie:** If two songs are tied for the most money, the third song automatically wins
  - Example: If A and B tie for most, Song C wins
- **3-way tie:** If all three songs are tied with the most money, the wheel spins between A, B, and C

## 4-Song Games (4-player AI games)
**Songs Available:** A, B, C, D

**Tie Rules:**
- **2-way tie:** If two songs are tied for the most money, the wheel spins between those two songs
  - Example 1: If A and C tie for most, wheel spins between A and C
  - Example 2: If B and D tie for most, wheel spins between B and D
- **3-way tie:** The fourth song automatically wins
  - Example: If A, B, and C tie for most, Song D wins
- **4-way tie:** If all four songs are tied with the most money, the wheel spins between all four

## Implementation Details

### Key Functions (lib/game/bidding-logic.ts)

1. **`isTieRequiringWheel()`**
   - Detects when a wheel spin is needed
   - For 4-song games: Returns true for 2-way or 4-way ties

2. **`determineWinningSong()`**
   - Determines the winning song based on bid totals
   - For 4-song games with 2-way tie: Returns null (triggers wheel)

3. **`getWheelSongs()`**
   - Determines which songs should appear on the wheel
   - For 4-song games with 2-way tie: Returns only the two tied songs

### Example Scenarios

#### Scenario 1: 4-Song Game, A and C tied
```
Bid Totals: A=$15, B=$8, C=$15, D=$10
- Songs A and C are tied for most ($15)
- Wheel spins between A and C
- Winner is either A or C (50/50 chance)
```

#### Scenario 2: 4-Song Game, all tied
```
Bid Totals: A=$10, B=$10, C=$10, D=$10
- All four songs tied
- Wheel spins between A, B, C, and D
- Winner determined by wheel (25% chance each)
```

#### Scenario 3: 4-Song Game, clear winner
```
Bid Totals: A=$20, B=$10, C=$15, D=$8
- Song A has the most
- A wins immediately, no wheel needed
```
