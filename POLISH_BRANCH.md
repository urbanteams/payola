# Polish Branch - Development Log

**Branch:** `polish`
**Base Branch:** `master`
**Purpose:** Aesthetic and UX improvements for card-based game variants

---

## Overview

The Polish branch focuses on refining the visual presentation and user experience of the card-based bidding system (B variants). This branch implements aesthetic improvements that make the game more visually appealing and easier to understand at a glance.

**Important:** This branch is designed to be **squash committed** or **squash merged** into the main branch once all features are complete and tested. This keeps the main branch history clean while allowing experimental development in this branch.

---

## Changes Log

### 2026-02-04: Spent Cards Visual Display

**Summary:** Replaced text-based spent card display with visual card components in player sidebar

**Problem:**
- Spent cards were displayed as plain text (e.g., "$1, $3, $5") in the player sidebar
- Text format was less visually engaging and harder to scan quickly
- Inconsistent with the visual card style used in the card selector

**Solution:**
- Implemented small visual card components for spent cards
- Cards display in a 5-column grid layout with fixed positions
- Each column represents a card value ($1-$5) in order
- Duplicate spent cards stack vertically in their respective columns
- Empty spaces preserved for unspent card values

**Visual Design:**
- Small compact cards (40px × 28px) to fit sidebar window
- Red border (`border-red-400`) and light red background (`bg-red-50`)
- Bold red text (`text-red-700`) to distinguish as "spent"
- Grid layout: 5 columns (one per card value)
- Vertical stacking for duplicate cards

**Example Display:**
```
Spent cards: [$1, $3, $5, $3]

Visual grid:
Row 1: [$1] [  ] [$3] [  ] [$5]
Row 2: [  ] [  ] [$3] [  ] [  ]
```

**Files Modified:**
- `components/game/PlayerList.tsx` (lines 63-108)
  - Replaced text display with grid-based card components
  - Implemented card grouping by value
  - Created fixed 5-column layout with row stacking

**Technical Details:**
- Groups cards by value using `cardsByValue` object
- Calculates `maxRows` to determine grid height
- Uses CSS Grid (`grid-cols-5`) for fixed column positions
- Iterates through card values 1-5 for each row
- Conditionally renders cards based on count for that value

**Benefits:**
- More visually appealing and professional appearance
- Easier to scan spent cards at a glance
- Shows card availability patterns clearly
- Consistent with card selector visual language
- Maintains spatial relationship between card values

---

## Previous Changes (From Commit History)

### 2026-02-04: Progressive Card Distribution System
**Commit:** `598f1ef` - Implement progressive card distribution for polish branch

**Summary:** Redesigned card distribution to start players with fewer cards and grant additional cards when the second map begins

**Previous System:**
- All players started with 8 cards: 2×$1, 2×$2, 2×$3, 2×$4 (total value: $20)
- No additional cards received throughout the game
- Spent cards remained spent across both maps

**New System:**
- **Game Start:** Each player receives 5 cards: 1×$1, 1×$2, 1×$3, 1×$4, 1×$5 (total value: $15)
- **Second Map Transition:** When the second map begins, each player receives 5 additional cards: 1×$1, 1×$2, 1×$3, 1×$4, 1×$5
- **Total After Second Map:** 10 cards (2 of each denomination, total value: $30)
- Spent cards remain spent (permanent across maps)

**Timing:**
- Second map appears at the start of Round 6 for most games (3B, 4B, 6B)
- Second map appears at the start of Round 5 for 5-player games (5B variant)

**Game Design Benefits:**
- Creates distinct strategic phases: scarcity (first map) vs. abundance (second map)
- Players must be more conservative with bidding in early rounds
- Second map provides strategic refresh and new opportunities
- More dramatic shift in gameplay dynamics between maps
- Rewards players who conserve cards in first half

**Technical Implementation:**

**Files Modified:**

1. **`lib/game/card-inventory.ts`**
   - Updated `STARTING_CARDS` constant from `[1, 1, 2, 2, 3, 3, 4, 4]` to `[1, 2, 3, 4, 5]`
   - Added `SECOND_MAP_CARDS` constant: `[1, 2, 3, 4, 5]`
   - Created new `addCards()` function to add cards to existing inventory
   - Function includes automatic sorting to maintain card order

2. **`app/api/game/[gameId]/advance/route.ts`**
   - Added imports for card inventory functions: `deserializeInventory`, `addCards`, `serializeInventory`, `SECOND_MAP_CARDS`
   - Enhanced `startSecondMap` action (lines 274-290):
     - Checks if game variant is a B variant (ends with 'B')
     - Iterates through all players
     - Deserializes each player's current card inventory
     - Adds `SECOND_MAP_CARDS` to their remaining cards
     - Serializes and saves updated inventory back to database
   - Only applies to B variants to preserve currency-based variants

3. **`PROJECT_STATUS.md`**
   - Updated documentation to reflect new starting cards (line 32)
   - Updated 3B variant feature description (line 79-80)
   - Added note about second map card distribution

4. **`lib/game/song-implications-data.ts`**
   - Updated 4B variant documentation (line 308-309)
   - Updated 5B variant documentation (line 336-337)
   - Added second map card distribution notes to variant descriptions

**Card Inventory Sorting:**
Note: The `addCards()` function automatically sorts remaining cards in ascending order (1, 2, 3, 4, 5) for consistent display. This matches the behavior of `deserializeInventory()` and `spendCards()` which also maintain sorted order.

**Database Impact:**
- No schema changes required
- Uses existing `Player.cardInventory` JSON field
- Card distribution happens server-side during `startSecondMap` action
- Changes persist in PostgreSQL database

**Backward Compatibility:**
- Only affects new games created in this branch
- Existing games continue with their current card inventories
- Non-B variants (if any remain) unaffected by changes

---

## Branch Status

**Current State:** Active development
**Ready for Merge:** No - awaiting user testing and approval
**Testing Status:**
- Visual changes verified in local testing (spent cards display)
- Progressive card distribution implemented (needs gameplay testing)

**Merge Strategy:** This branch will be **squash merged** into `master` when ready. This preserves a clean git history while allowing iterative development.

---

## Future Polish Items (Ideas)

Potential aesthetic improvements for future consideration:
- Animation transitions when cards are spent
- Hover effects on spent cards
- Color coding for high-value vs low-value cards
- Visual indicators for strategic card availability
- Improved responsive layout for mobile devices

---

## Related Documentation

- `PROJECT_STATUS.md` - Main project status (master branch)
- `CLAUDE.md` - Project overview and architecture
- `3B_VARIANT_IMPLEMENTATION.md` - Card-based bidding system

---

**Last Updated:** 2026-02-04
