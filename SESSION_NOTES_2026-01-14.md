# Payola Session Notes - January 14, 2026

## Issues Fixed in This Session

### 1. Tie-Breaking Logic for 3-Player Games
**Problem:** When Song A and Song B tied in a 3-player game, the results showed no winner (likely following logic that Song C won even though it doesn't exist in 3-player games).

**Solution:**
- Updated `bidding-logic.ts` to handle 2-song vs 3-song tie scenarios
- Added `isTieRequiringWheel()` function that checks for:
  - 2-way ties (A vs B) in 3-player games → requires wheel
  - 3-way ties (A vs B vs C) in 4+ player games → requires wheel
- Modified `determineWinningSong()` to accept `availableSongs` parameter and return `null` for ties requiring wheel

### 2. Spinning Wheel Support for 2-Song Games
**Problem:** SpinningWheel component was hardcoded for 3 sections (A, B, C), couldn't handle 2-song games.

**Solution:**
- Added `availableSongs` prop to SpinningWheel component
- Implemented conditional rendering: 2 sections (180° each) for 3-player games, 3 sections (120° each) for 4+ player games
- Dynamic title: "Two-Way Tie!" vs "Three-Way Tie!"
- Updated section centers and SVG paths for proper 2-section wheel

### 3. Server-Side Tie Handling
**Problem:** Bid processing routes weren't handling `null` returns from `determineWinningSong()`, causing database to store `null` as winner.

**Solution:**
- Updated both `bid/route.ts` and `ai-bid/route.ts` to:
  - Calculate `availableSongs` based on player count
  - Pass `availableSongs` to `determineWinningSong()`
  - When `determineWinningSong()` returns `null` (tie), randomly select winner from tied songs
  - Store random winner in database for client to animate with wheel

### 4. "Next Round" Blank Page Issue
**Problem:** Clicking "Next Round" button advanced game to TOKEN_PLACEMENT status, but GameBoard had no UI for that status, showing blank page with only player balances.

**Solution:**
- Modified `advance/route.ts` to skip TOKEN_PLACEMENT phase (UI not implemented yet)
- Now transitions directly: RESULTS → ROUND1 (Promise Phase)
- Added game completion check: round 9 → FINISHED status
- Generates new randomized turn orders for each round

## Files Modified

### 1. `payola/lib/game/bidding-logic.ts`
- Lines 26-34: Added `isTieRequiringWheel()` function
- Lines 50-82: Updated `determineWinningSong()` to accept `availableSongs` parameter and handle 2-song vs 3-song logic

### 2. `payola/components/game/SpinningWheel.tsx`
- Lines 6-12: Added `availableSongs` prop to interface and component
- Lines 31-40: Dynamic section centers calculation based on song count
- Lines 55-142: Conditional rendering for 2-section vs 3-section wheel with proper SVG paths

### 3. `payola/components/game/GameBoard.tsx`
- Line 252: Pass `availableSongs` prop to SpinningWheel based on player count

### 4. `payola/app/api/game/[gameId]/bid/route.ts`
- Lines 127-136: Handle ties in Round 1 (no bribes) path
- Lines 204-211: Handle ties in Round 2 (bribes) path
- Both locations: Calculate availableSongs, check for null winner, randomly select from tied songs

### 5. `payola/app/api/game/[gameId]/ai-bid/route.ts`
- Lines 88-95: Handle ties in Round 2 AI completion path
- Lines 126-133: Handle ties in Round 1 AI completion path
- Same logic as bid route

### 6. `payola/app/api/game/[gameId]/advance/route.ts`
- Lines 137-231: Complete rewrite of `nextRound` action
  - Skip TOKEN_PLACEMENT phase
  - Check for game completion at round 9
  - Generate new turn orders each round
  - Direct transition from RESULTS to ROUND1

## How the Fixes Work

### Tie Detection and Resolution Flow

1. **Promise/Bribe Phase Completes:**
   - All bids collected in `bid/route.ts` or `ai-bid/route.ts`
   - `calculateSongTotals()` sums bids for each song

2. **Determine Winner:**
   - Call `determineWinningSong(totals, undefined, availableSongs)`
   - For 3-player games: `availableSongs = ["A", "B"]`
   - For 4+ player games: `availableSongs = ["A", "B", "C"]`

3. **Handle Tie (null result):**
   ```typescript
   if (winningSong === null) {
     const maxTotal = Math.max(...availableSongs.map(s => songTotals[s]));
     const tiedSongs = availableSongs.filter(s => songTotals[s] === maxTotal);
     winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
   }
   ```

4. **Store Winner:**
   - Server stores randomly selected winner in `game.winningSong`
   - Client receives this in `gameState.game.winningSong`

5. **Display Wheel:**
   - GameBoard checks `isTieRequiringWheel()` on RESULTS status
   - If tie detected, shows SpinningWheel component
   - Wheel animates spin to predetermined `winner` prop
   - After animation, displays ResultsDisplay

### Round Advancement Flow

1. **User clicks "Next Round"** in ResultsDisplay
2. **GameBoard calls** `advanceGame("nextRound")`
3. **Server checks** `game.status === "RESULTS"`
4. **Server checks** if `game.roundNumber >= 9`:
   - Yes → Set status to "FINISHED"
   - No → Generate new turn orders, increment roundNumber, set status to "ROUND1"
5. **Client polls** and receives updated game state
6. **GameBoard renders** BiddingPanel for new Promise Phase

## Key Technical Details

### Available Songs Logic
- **3 players:** Songs A and B only (`["A", "B"]`)
- **4+ players:** Songs A, B, and C (`["A", "B", "C"]`)
- Calculated dynamically: `game.players.length === 3 ? ["A", "B"] : ["A", "B", "C"]`

### Turn Order Randomization
- Turn orders stored in database: `game.turnOrderA`, `game.turnOrderB`, `game.turnOrderC`
- Regenerated each round using `getSongImplications(playerCount)`
- Format: String of digits representing player indices (e.g., "012012")
- Displayed in UI as actual player names with arrows

### Wheel Spinner Timing
- Wheel spins for 4 seconds (4000ms)
- 6 full rotations + lands on predetermined section
- 1.5 second delay after completion before hiding wheel
- Shows results immediately after wheel disappears

## Game Completion Logic

- Game ends when `roundNumber >= 9` (after 9 rounds complete)
- Transitions to "FINISHED" status
- GameBoard shows game over screen with "Return Home" button

## What Still Needs Implementation

1. **Token Placement Phase UI:**
   - Currently skipped entirely
   - Would need MapDisplay component
   - Token selection interface
   - Turn-based placement logic

2. **Map Display:**
   - Hex grid rendering
   - Token visualization
   - Edge highlighting
   - Victory point calculation display

3. **Final Scoring:**
   - Territory control calculation
   - Final victory point totals
   - Winner determination and display

4. **3-Way Tie in 4+ Player Games:**
   - Should be tested to ensure wheel works correctly with 3 sections

## Testing Checklist

- [x] 2-way tie (A vs B) in 3-player game shows wheel
- [x] Wheel displays with 2 sections for 3-player games
- [x] Server randomly selects winner from tied songs
- [x] Next Round button advances to Promise Phase
- [x] Turn orders randomize each round
- [x] Song C filtered from 3-player games
- [ ] Test 3-way tie in 4+ player game (not tested yet)
- [ ] Test game completion at round 9
- [ ] Test all-zero bids scenario

## Code Patterns to Remember

### Checking Available Songs
```typescript
const playerCount = game.players.length;
const availableSongs = playerCount === 3 ? ["A", "B"] : ["A", "B", "C"];
```

### Filtering Song C in 3-Player Games
```typescript
const songs = players && players.length === 3
  ? allSongs.filter(s => s.id !== "C")
  : allSongs;
```

### Handling Null Winners from Ties
```typescript
let winningSong = determineWinningSong(songTotals, undefined, availableSongs);
if (winningSong === null) {
  const maxTotal = Math.max(...availableSongs.map(s => songTotals[s]));
  const tiedSongs = availableSongs.filter(s => songTotals[s] === maxTotal);
  winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
}
```

## Database Schema Notes

### Game Model Fields Used
- `status`: "LOBBY" | "ROUND1" | "ROUND2" | "RESULTS" | "TOKEN_PLACEMENT" | "FINISHED"
- `roundNumber`: Current round (1-9)
- `winningSong`: "A" | "B" | "C" | null
- `turnOrderA`: String of player indices
- `turnOrderB`: String of player indices
- `turnOrderC`: String of player indices (null for 3-player games)
- `mapLayout`: Serialized map data (not actively used for bidding)
- `totalRounds`: Always 9 for now

### Player Model Fields
- `isAI`: Boolean for AI players
- `currencyBalance`: Current money
- `victoryPoints`: Current VP (not actively used yet)

## Next Session TODO

1. Consider implementing basic map display
2. Add game completion announcement with final scores
3. Test edge cases:
   - All players bid 0
   - All players bid same amount on same song
   - Round 9 completion
4. Add player names to wheel sections (optional enhancement)
5. Consider adding turn order preview before each round starts
