# POTS Branch Implementation Summary

## Overview
The POTS branch implements a new game configuration with fixed song implications and a special final placement phase based on money remaining.

## Key Changes

### 1. Song Implications (Fixed, No Randomization)
- **Song A: ABB** - Player A gets 1 token, Player B gets 2 tokens
- **Song B: BCC** - Player B gets 1 token, Player C gets 2 tokens
- **Song C: CAA** - Player C gets 1 token, Player A gets 2 tokens
- **Tokens per round:** 3 (instead of 6 in standard mode)
- **Total rounds:** 10 (instead of 6 in standard mode)

### 2. Game Structure
- **Regular rounds:** 10 rounds × 3 tokens = 30 tokens placed
- **Remaining tokens:** 6 tokens on NYC36 map (36 total edges)
- **Final placement phase:** Special money-based turn order for last 6 tokens

### 3. Final Placement Phase
After round 10 completion:
1. Game enters `FINAL_PLACEMENT` status
2. All 6 remaining edges are highlighted
3. Turn order determined by money remaining (descending)
4. **Tie-breaker:** If players have equal money, player with **least** influence tokens on board goes first
5. Each player places 2 tokens in this final phase
6. After all 6 tokens placed, game goes to `FINISHED` status

## Files Modified

### Database Schema
- **`prisma/schema.prisma`**
  - Added `isPOTS` boolean field to Game model
  - Added `FINAL_PLACEMENT` to status enum documentation

### Core Game Logic
- **`lib/game/song-implications-data.ts`**
  - Added `isPOTS` and `finalPlacementPhase` to interface
  - Added `POTS_PATTERN` with fixed implications (ABB, BCC, CAA)

- **`lib/game/song-implications.ts`**
  - Updated `getSongImplications()` to accept `usePOTS` parameter
  - For POTS mode: uses fixed mapping (A=0, B=1, C=2) instead of randomization
  - Added `getTotalRounds()` to support POTS mode (returns 10 rounds)
  - Added `hasFinalPlacementPhase()` helper function

### API Routes
- **`app/api/game/create-pots/route.ts`** (NEW)
  - Creates POTS mode games
  - Always 3 players (1 human + 2 AI)
  - Sets `isPOTS = true` in database

- **`app/api/game/[gameId]/advance/route.ts`**
  - Detects end of round 10 in POTS mode
  - Calculates final turn order based on money remaining
  - Creates `FINAL_PLACEMENT` phase with 6 highlighted edges
  - Turn order stored as: `[richest, richest, middle, middle, poorest, poorest]`
  - Uses `isPOTS` flag when generating song implications

- **`app/api/game/[gameId]/place-token/route.ts`**
  - Accepts both `TOKEN_PLACEMENT` and `FINAL_PLACEMENT` statuses
  - For `FINAL_PLACEMENT`: doesn't require `winningSong`
  - Uses `turnOrderA` for final placement turn order
  - After all tokens placed in `FINAL_PLACEMENT`, goes directly to `FINISHED`

### UI
- **`app/page.tsx`**
  - Added "POTS Mode (Experimental)" button (green)
  - New mode screen with explanation of POTS rules
  - Calls `/api/game/create-pots` endpoint

## How to Use

1. **Start a POTS game:**
   - From main menu, click "POTS Mode (Experimental)"
   - Enter your name and click "Start POTS Game"

2. **Play 10 regular rounds:**
   - Bid on songs (A, B, or C)
   - Place 3 tokens per round based on winning song
   - Fixed implications mean: A=player 1, B=player 2, C=player 3

3. **Final placement phase:**
   - After round 10, enter special final placement
   - 6 remaining edges highlighted
   - Players place 2 tokens each, ordered by money remaining
   - Player with most money places first (twice in a row)
   - Ties broken by least influence tokens

4. **Game ends:**
   - After all 36 tokens placed
   - View final scoring and statistics

## Testing

To test the POTS implementation:

```bash
cd payola
npm run dev
```

1. Navigate to http://localhost:3000
2. Click "POTS Mode (Experimental)"
3. Enter your name and start game
4. Play through to round 10
5. Verify final placement phase triggers correctly
6. Confirm game ends after final placement

## Database Migration

The database migration has been applied:
- Migration: `20260120203358_add_pots_mode`
- Adds `isPOTS` boolean field (default: false)

## Technical Notes

- POTS mode only works with 3-player games
- Uses same NYC36 map as standard 3-player games
- AI players use existing AI bidding logic (random bids)
- Final placement uses same token placement interface
- Money-based turn order calculated fresh each time (accounts for spending in round 10)

## Future Enhancements

Potential improvements:
- Allow human multiplayer POTS games (not just vs AI)
- Custom token counts per round
- Configurable final placement rules
- Additional game mode variations
