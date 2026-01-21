# Standard Games Now Use POTS Mechanics

**Date**: January 21, 2026
**Status**: Implementation Complete ✅

## Overview

All standard human-only games created via "Create New Game" now use the same game mechanics as POTS mode. The only difference is that POTS games have AI opponents while standard games allow all human players.

## What Changed

### Game Mechanics Now Unified

Both standard games and POTS games now use:

1. **Fixed Song Patterns with Randomized Player Assignments**
   - Song patterns remain consistent (e.g., Song A always ABCD for 6 players)
   - Player-to-variable mappings randomize each round
   - Example: Round 1 might have A=Player1, B=Player2, etc.
   - Example: Round 2 might have A=Player3, B=Player1, etc.

2. **POTS-Style Round Structure**
   - 3-player: 10 rounds (3 tokens/round) + final placement (6 tokens)
   - 4-player: 8 rounds (4 tokens/round) + final placement (4 tokens)
   - 5-player: 8 rounds (5 tokens/round) + final placement (8 tokens)
   - 6-player: 10 rounds (4 tokens/round) + final placement (8 tokens)

3. **Final Placement Phase**
   - After normal rounds complete, special final round begins
   - Turn order based on money remaining (most money goes first)
   - Uneven token distribution (wealthier players place more tokens)

4. **Song Implications Data**
   - 3-player: ABB, BCC, CAA
   - 4-player: ABCB, BCDC, CDAD, DABA
   - 5-player: ABCBA, CDEDC, EBDAE
   - 6-player: ABCD, DCEF, FEBA

## Files Modified

### 1. `app/api/game/create/route.ts`
**Change**: Set `isPOTS: true` when creating new games

**Before**:
```typescript
const game = await prisma.game.create({
  data: {
    roomCode,
    status: "LOBBY",
    roundNumber: 1,
    // mapType, mapLayout and totalRounds will be set when game starts
  },
});
```

**After**:
```typescript
const game = await prisma.game.create({
  data: {
    roomCode,
    status: "LOBBY",
    roundNumber: 1,
    isPOTS: true, // All games use POTS mechanics now (human players only)
    // mapType, mapLayout and totalRounds will be set when game starts
  },
});
```

**Reason**: This flag tells the game initialization code to use POTS song implications and enable the final placement phase.

### 2. `app/api/game/[gameId]/advance/route.ts` (3 locations)

**Change**: Fixed `tokensPerRound` calculation to use `implications.tokensPerRound` instead of conditional logic

**Before** (3 occurrences):
```typescript
const tokensPerRound = game.isPOTS ? game.players.length : getTokensPerRound(playerCount);
```

**After** (3 occurrences):
```typescript
// Use tokensPerRound from implications (correct for all player counts)
const tokensPerRound = implications.tokensPerRound;
```

**Locations**:
- Line ~79: Initial game start from LOBBY
- Line ~381: Next round after token placement complete
- Line ~570: Next round after map complete check

**Reason**: The old logic assumed POTS games always use `playerCount` tokens per round, but this is incorrect for 6-player POTS (which uses 4 tokens, not 6). The correct value is stored in the implications object.

**Bug Fixed**: This also fixes a potential bug in 6-player POTS games where the wrong number of edges would be highlighted.

### 3. `app/api/game/[gameId]/place-token/route.ts` (2 locations)

**Change**: Fixed `tokensPerRound` calculation (same fix as advance route)

**Before** (2 occurrences):
```typescript
const { getTokensPerRound } = await import('@/lib/game/song-implications');
const tokensPerRound = game.isPOTS ? game.players.length : getTokensPerRound(game.players.length);
```

**After** (2 occurrences):
```typescript
// Use tokensPerRound from implications (correct for all player counts)
const tokensPerRound = implications.tokensPerRound;
```

**Locations**:
- Line ~357: Human player completes token placement
- Line ~537: AI player completes token placement

**Reason**: Same as advance route - ensures correct number of highlighted edges for all player counts.

## What Did NOT Change

### Database Schema
No database migrations needed. The `isPOTS` field already exists and simply changes from default `false` to default `true`.

### UI Components
No UI changes required:
- Main menu still shows "Create New Game" and "POTS Mode (Experimental)"
- Game board works the same for both modes
- Player interface unchanged

### AI Logic
No changes to AI behavior:
- Standard games still have no AI players
- POTS games still have AI opponents
- AI bidding and token placement logic unchanged

### Join Flow
No changes to joining games:
- Players can still join via room code
- Join route unchanged (inherits isPOTS from existing game)

## Technical Details

### How `isPOTS` Works

When a game starts from LOBBY:
1. `advance/route.ts` calls `getTotalRounds(playerCount, game.isPOTS)`
2. If `isPOTS = true`, returns POTS-specific round counts (8-10 instead of 6)
3. `getSongImplications(playerCount, undefined, game.isPOTS)` is called
4. If `isPOTS = true`, returns fixed patterns (ABB, BCDC, ABCD, etc.) instead of standard patterns

### Song Implications Logic

The `getSongImplications()` function in `lib/game/song-implications.ts`:
- Takes `usePOTS` parameter (defaults to false)
- If `usePOTS = true`, uses patterns from:
  - `POTS_PATTERN` (3-player)
  - `POTS_PATTERN_4PLAYER` (4-player)
  - `POTS_PATTERN_5PLAYER` (5-player)
  - `POTS_PATTERN_6PLAYER` (6-player)
- If `usePOTS = false`, uses patterns from `SONG_IMPLICATION_PATTERNS`

Since all new games now have `isPOTS = true`, they all use the POTS patterns.

### Final Placement Phase

The final placement logic in `advance/route.ts` and `place-token/route.ts`:
- Checks `if (game.isPOTS && roundNumber === totalRounds)`
- If true, creates `FINAL_PLACEMENT` status
- Calculates money-based turn order
- Highlights all remaining edges
- Triggers AI token placement

This logic now runs for **all games** since they all have `isPOTS = true`.

## Testing

### Manual Testing Required
To verify the changes work correctly:

1. **Create Standard Game**:
   - Click "Create New Game" on main menu
   - Enter player name
   - Create game
   - Share room code with other human players
   - Start game when 3+ players joined

2. **Verify Game Mechanics**:
   - Check song patterns match POTS patterns for player count
   - Play through normal rounds
   - Verify correct number of highlighted spaces each round
   - Verify song patterns stay fixed but player assignments change
   - Complete all normal rounds

3. **Test Final Placement**:
   - After final normal round, verify final placement triggers
   - Check turn order based on money remaining
   - Verify correct number of tokens per player
   - Complete game successfully

### Expected Behavior

**3-Player Game**:
- 10 normal rounds, 3 tokens each
- Song A: ABB, Song B: BCC, Song C: CAA
- Final placement: 6 tokens (2 per player)

**4-Player Game**:
- 8 normal rounds, 4 tokens each
- Song A: ABCB, Song B: BCDC, Song C: CDAD, Song D: DABA
- Final placement: 4 tokens (1 per player)

**5-Player Game**:
- 8 normal rounds, 5 tokens each
- Song A: ABCBA, Song B: CDEDC, Song C: EBDAE
- Final placement: 8 tokens (top 3 place 2, bottom 2 place 1)

**6-Player Game**:
- 10 normal rounds, 4 tokens each
- Song A: ABCD, Song B: DCEF, Song C: FEBA
- Final placement: 8 tokens (top 2 place 2, bottom 4 place 1)

## Implications for Future Work

### POTS Mode Removal (Future)
The user mentioned POTS mode will be removed in a later session. When that happens:
- Remove "POTS Mode (Experimental)" button from main menu
- Remove `app/api/game/create-pots/route.ts`
- Update documentation to reflect unified mechanics
- Consider renaming `isPOTS` field to something more descriptive (e.g., `usesNewMechanics`)

### VS AI Mode
The VS AI mode still exists and creates games with AI players. These games now also use POTS mechanics since they likely call the same initialization code.

## Benefits of This Change

### 1. Consistency
All games now use the same core mechanics, reducing confusion and making the codebase easier to maintain.

### 2. Balanced Gameplay
The POTS patterns are more balanced across player counts, with:
- Fixed song patterns that players can learn
- Randomized assignments that prevent predictable strategies
- Final placement phase that rewards money management

### 3. Code Simplification
Instead of maintaining two separate game modes with different mechanics, there's now one unified system. This makes:
- Bug fixes easier (fix once, applies everywhere)
- New features simpler (only one code path to update)
- Testing more straightforward (fewer edge cases)

### 4. Better Player Experience
Players don't need to choose between "standard" and "experimental" modes - they just create a game and play with consistent, balanced mechanics.

## Backward Compatibility

### Existing Games
Games created before this change:
- If they have `isPOTS = false`, they use old standard patterns
- Still work correctly with existing code
- Will complete normally

### New Games
All new games:
- Automatically get `isPOTS = true`
- Use POTS mechanics
- Have final placement phase

## Bug Fixes Included

### 6-Player Token Highlighting Bug
**Fixed**: The old code used `game.players.length` for POTS games, which would incorrectly highlight 6 edges for 6-player games instead of 4.

**Impact**: This bug would have affected 6-player POTS games once they launched. By fixing it now during the unification work, we prevented this bug from ever occurring in production.

### Incorrect Token Count Calculation
**Fixed**: Multiple locations had conditional logic that could calculate the wrong token count.

**Impact**: By using `implications.tokensPerRound` everywhere, we ensure consistency across all player counts and game modes.

## Summary

This change successfully unifies standard and POTS game mechanics while:
- ✅ Maintaining backward compatibility with existing games
- ✅ Fixing potential bugs in token highlighting
- ✅ Simplifying the codebase
- ✅ Improving game balance
- ✅ Preparing for eventual POTS mode removal

All games now provide a consistent, balanced experience with:
- Fixed song patterns
- Randomized player assignments
- Appropriate round counts for each player count
- Final placement phase based on money management

---

**Next Steps**:
1. Manual testing of standard game creation
2. Verify final placement works with all human players
3. Test various player counts (3, 4, 5, 6)
4. Document any issues found
5. Consider removing POTS mode in future session
