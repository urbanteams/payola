# Payola Project Context & Session History

Last Updated: February 4, 2026 (B Variants Now Default for All Games)

## Project Overview

**Payola** is a digital companion app for a physical board game featuring multi-round blind bidding mechanics where players strategically bid on songs to influence outcomes.

### Current Game System: B Variants (Multi-Map + Card-Based Bidding)

**As of February 2026**, all games automatically use B variants based on player count. There is no variant selection UI - the appropriate variant is chosen automatically:

- **3 Players**: 3B variant (NYC15 maps, 10 rounds, 2 maps of 5 rounds each)
- **4 Players**: 4B variant (NYC20 maps, 10 rounds, 2 maps of 5 rounds each)
- **5 Players**: 5B variant (NYC20 maps, 8 rounds, 2 maps of 4 rounds each)
- **6 Players**: 6B variant (NYC30 maps, 10 rounds, 2 maps of 5 rounds each, with Classical Stars)

### Core Game Mechanics

- **Starting Currency**: Each player begins with $20
- **Card-Based Bidding**: Players use a fixed set of 8 cards (2×$1, 2×$2, 2×$3, 2×$4) instead of traditional currency
- **Multi-Map Mode**: All games play on two sequential maps
- **Songs**: Three options available each round - Song A, B, and C
- **Two Bidding Phases per Round**:
  - **Promise Phase**: All players bid simultaneously using cards (can bid $0 to skip to Bribe Phase)
  - **Bribe Phase**: Only players who bid $0 in Promise Phase participate (must pay regardless of outcome)
- **Winner Determination**: Song with highest total bid value wins
- **Tie-Breaking Rules**:
  - 2-way tie → 3rd song wins
  - 3-way tie → random selection
- **Payment Rules**:
  - Promise Phase bidders: Only pay if they backed the winning song (cards permanently spent)
  - Bribe Phase bidders: Always pay regardless of outcome (cards permanently spent)
  - Spent cards are visible to all players
- **Game Duration**: Fixed rounds based on variant (8-10 rounds total across 2 maps)

## Important Terminology Changes (January 2026)

### Original vs Current Terms
- ~~Round 1~~ → **Promise Phase**
- ~~Round 2~~ → **Bribe Phase**
- **Game Round**: Still called "Round 1, Round 2, etc." (the overall game round number)
- **Bidding Round**: Internal concept - round 1 (Promise) or round 2 (Bribe) within a game round

### UI Text Updates
- "Bid Amount" → "Promise Amount" (Promise Phase) or "Bribe Amount" (Bribe Phase)
- "Submit Bid" → "Submit Promise" (Promise Phase) or "Submit Bribe" (Bribe Phase)
- Currency displays: Always prefixed with "$" (e.g., "$29" not "29 currency")

## POTS Mode Implementation

**Important Note (January 21, 2026)**: POTS Mode has been unified with VS AI Mode. All VS AI games now use POTS patterns for all player counts (3, 4, 5, 6). The separate "POTS Mode (Experimental)" button has been removed. All mechanics described below are now part of the standard VS AI Mode experience.

### 3-Player POTS Mode (January 21, 2026)

Implemented the final placement phase for 3-player POTS mode where, after round 10 completes, players place the remaining 6 tokens based on money remaining instead of song implications.

### Feature Details

**Final Placement Trigger**:
- After round 10 token placement completes in POTS mode
- Game enters `FINAL_PLACEMENT` status
- All 6 remaining empty token spaces are highlighted
- No bidding phase - goes directly from round 10 results to final placement

**Turn Order Calculation**:
- Players sorted by money remaining (descending)
- Ties broken by fewest influence tokens on board (ascending)
- Each player places 2 tokens in this order:
  1. Player with most money → places first 2 tokens
  2. Player with middle money → places next 2 tokens
  3. Player with least money → places last 2 tokens

**Game Flow**:
```
Round 10 RESULTS → TOKEN_PLACEMENT → FINAL_PLACEMENT → FINISHED
```

### Files Modified

**UI Components**:
1. **`components/game/PlayerList.tsx`**
   - Added `gameStatus` prop
   - Shows "Final Round" instead of round number when status is `FINAL_PLACEMENT`

2. **`components/game/TokenPlacementPhase.tsx`**
   - Added header "🎯 Final Round" for final placement phase
   - Updated messaging to explain money-based turn order
   - Removed winningSong references during final placement

3. **`components/game/ResultsDisplay.tsx`**
   - Added `isPOTS` and `currentRound` props
   - Button text changes to "Advance to Final Placement" when completing round 10 in POTS mode
   - Countdown timer adjusted for final placement transition

4. **`components/game/GameBoard.tsx`**
   - Passes `gameStatus` to PlayerList component
   - Passes `isPOTS` and `roundNumber` to ResultsDisplay component

**API Routes**:
5. **`app/api/game/[gameId]/advance\route.ts`** (2 locations updated)
   - Lines ~254-303: Added FINAL_PLACEMENT creation after AI completes round 10
   - Lines ~369-423: Added FINAL_PLACEMENT creation after human completes round 10
   - Calculates money-based turn order and stores in `turnOrderA`
   - Highlights all remaining edges (should be 6)
   - Triggers AI token placement immediately after creation
   - Added debug logging for edge counts

6. **`app/api/game/[gameId]/place-token\route.ts`** (2 locations updated)
   - Lines ~234-306: Added FINAL_PLACEMENT check after round 10 completion (when all tokens placed)
   - Lines ~365-430: Added FINAL_PLACEMENT check after round 10 completion (when AI completes placement)
   - Both locations calculate turn order and trigger AI placement
   - Added debug logging for edge counts

**AI Logic**:
7. **`lib/game/ai-token-placement.ts`**
   - Updated status check to accept both `TOKEN_PLACEMENT` and `FINAL_PLACEMENT` (line 28)
   - Modified `getTurnOrder()` to use `turnOrderA` for FINAL_PLACEMENT (money-based turn order)
   - Updated token query to check all rounds for FINAL_PLACEMENT (line 64-70)
   - Added debug logging to track AI placement behavior
   - Fixed duplicate logic in `processAllAITokenPlacements()` (line 192)

### Critical Bug Fixes

**1. Highlighted Edges Not Showing in Final Round** ✅ FIXED
- **Problem**: `remainingEdges` was calculated as `mapLayout.edges.filter(edge => !existingTokens.some(token => token.edgeId === edge.id))`
- **Root Cause**: `mapLayout.edges` is an array of strings (`EdgeId[]`), not objects. Accessing `edge.id` returned `undefined`, causing filter to fail
- **Solution**: Changed to `mapLayout.edges.filter(edgeId => !existingTokens.some(token => token.edgeId === edgeId))`
- **Also Fixed**: Removed incorrect `.map(e => e.id)` when storing highlightedEdges
- **Locations**: All 4 places where FINAL_PLACEMENT is created in advance and place-token routes

**2. AI Players Not Placing Tokens in Final Round** ✅ FIXED
- **Problem**: AI token placement function immediately returned `false` when game status was `FINAL_PLACEMENT`
- **Root Cause**: Hardcoded status check `game.status !== 'TOKEN_PLACEMENT'` on line 28
- **Solution**: Updated to accept both statuses: `(game.status !== 'TOKEN_PLACEMENT' && game.status !== 'FINAL_PLACEMENT')`
- **Additional Fix**: Modified turn order logic to use `turnOrderA` for FINAL_PLACEMENT instead of song-based turn orders
- **Additional Fix**: Changed existing token query to check all rounds (not just current round) during FINAL_PLACEMENT

### Implementation Details

**Turn Order Storage**:
- Final placement turn order stored in `game.turnOrderA` as JSON array of player IDs
- Format: `[playerId1, playerId1, playerId2, playerId2, playerId3, playerId3]`
- Each player ID appears twice (for their 2 token placements)

**Highlighted Edges**:
- All remaining empty edges highlighted (should be exactly 6 for POTS mode)
- Calculated by filtering `mapLayout.edges` to exclude edges with existing tokens
- Stored in `game.highlightedEdges` as JSON array of edge ID strings

**AI Token Placement**:
- Triggered immediately when FINAL_PLACEMENT is created
- AI players place tokens automatically using same logic as regular rounds
- Stops at human player's turn if human is in turn order
- Resumes after human places token (via normal place-token route)

### Testing Checklist

To verify final placement works correctly:
1. ✅ Create POTS mode game
2. ✅ Play through 10 rounds
3. ✅ After round 10 results, click "Advance to Final Placement"
4. ✅ Verify game enters FINAL_PLACEMENT status (not round 11)
5. ✅ Verify "Final Round" label appears in PlayerList
6. ✅ Verify 6 remaining spaces are highlighted in orange
7. ✅ Verify AI players immediately place their tokens
8. ✅ Verify human player can place tokens on highlighted spaces
9. ✅ Verify game advances to FINISHED after all 6 tokens placed
10. ✅ Verify final scoring displays correctly

### Known Edge Cases

**Money Tie-Breaking**:
- If two players have same money, player with fewer tokens on board goes first
- This ensures fairest placement order when money is equal

**All AI Players**:
- If all players are AI in POTS mode, final placement completes instantly
- Game goes directly to FINISHED status without waiting

**Human Goes First**:
- If human player has most money, they place first 2 tokens
- AI players then place remaining 4 tokens automatically

### 4-Player POTS Mode (January 21, 2026)

**Overview**:
Extended POTS experimental mode to support 4-player games with the same core mechanics as 3-player POTS but adapted for 4 players with Song D enabled.

**Key Differences from 3-Player POTS**:

| Aspect | 3-Player POTS | 4-Player POTS |
|--------|---------------|---------------|
| Songs Available | A, B, C | A, B, C, D |
| Song Patterns | A=ABB, B=BCC, C=CAA | A=ABCB, B=BCDC, C=CDAD, D=DABA |
| Tokens per Round | 3 | 4 |
| Total Rounds | 10 | 8 |
| Normal Round Tokens | 30 (10×3) | 32 (8×4) |
| Final Placement Tokens | 6 (2 per player) | 4 (1 per player) |
| Total Tokens | 36 | 36 |
| Map Type | NYC36 | NYC36 |

**Song Implications**:
- Song A **always** has pattern ABCB
- Song B **always** has pattern BCDC
- Song C **always** has pattern CDAD
- Song D **always** has pattern DABA
- Player assignments to variables A, B, C, D randomize each round
- Example: Round 1 might have A=Player1, B=Player3, C=Player2, D=Player4
- Example: Round 2 might have A=Player4, B=Player1, C=Player3, D=Player2

**Final Placement Phase**:
- Triggers after round 8 (instead of round 10 for 3-player)
- Players sorted by money remaining (descending)
- Ties broken by fewest influence tokens on board (ascending)
- Each player places exactly 1 token (instead of 2 for 3-player)
- Turn order: Player with most money → 2nd → 3rd → Player with least money
- 4 remaining edges highlighted for final placement

**Implementation Details**:

1. **Pattern Consistency**: Just like 3-player POTS, song patterns are fixed to specific songs, only player assignments change each round

2. **Dynamic Token Calculation**: Code now uses `game.players.length` for POTS mode instead of hardcoded values:
   - 3 players → 3 tokens per round
   - 4 players → 4 tokens per round

3. **Dynamic Final Placement**: Uses `Math.floor(remainingEdges.length / players.length)` to calculate tokens per player:
   - 3 players: 6 edges / 3 = 2 tokens each
   - 4 players: 4 edges / 4 = 1 token each

4. **Round Completion Trigger**: Changed from hardcoded `roundNumber === 10` to dynamic `roundNumber === totalRounds`:
   - Works for both 3-player (10 rounds) and 4-player (8 rounds)

**Files Modified**:

1. **`lib/game/song-implications-data.ts`**
   - Added `POTS_PATTERN_4PLAYER` constant with 4-player patterns
   - Set `totalRounds: 8` for 4-player POTS
   - Set `tokensPerRound: 4` for 4-player POTS

2. **`lib/game/song-implications.ts`**
   - Added `shuffleArray()` helper function (Fisher-Yates shuffle)
   - Updated `getSongImplications()` to handle both 3 and 4 player POTS modes
   - Fixed song patterns stay consistent per song, only player assignments shuffle
   - Updated `getTotalRounds()` to support 4-player POTS

3. **`app/api/game/create-ai/route.ts`** (VS AI Mode)
   - Unified with POTS patterns for all player counts
   - Uses `isPOTS: true` flag for all AI games
   - Dynamic AI player creation based on player count (3-6)
   - Player colors: Red, Teal, Yellow, Purple, Cyan, Orange

4. **`app/api/game/[gameId]/advance/route.ts`** (6 updates)
   - Lines 254, 399: Changed round check to `roundNumber === totalRounds`
   - Lines 285-294, 433-442: Dynamic final turn order calculation
   - Lines 79, 353, 515: Fixed tokensPerRound to use `game.players.length`

5. **`app/api/game/[gameId]/place-token/route.ts`** (6 updates)
   - Lines 240, 394: Changed round check to `roundNumber === totalRounds`
   - Lines 271-280, 425-434: Dynamic final turn order calculation
   - Lines 330, 483: Fixed tokensPerRound to use `game.players.length`

6. **`components/game/SongSelector.tsx`**
   - Removed hardcoded filter that excluded Song D from POTS mode
   - Now shows Song D when `turnOrderD` exists (4-player POTS)

7. **`app/page.tsx`**
   - Added `potsPlayerCount` state (3 or 4)
   - Added player count selector UI (2 buttons)
   - Dynamic info display showing correct patterns and game details
   - Updated to send `playerCount` to create-pots API

**Critical Bug Fixes**:

1. **Song D Not Appearing** ✅ FIXED
   - Problem: `SongSelector` filtered out Song D for all POTS games
   - Solution: Removed hardcoded filter, use `availableSongs` which respects `turnOrderD`

2. **Only 3 Spaces Highlighted in Round 2** ✅ FIXED
   - Problem: One location still had `isPOTS ? 3 :` hardcoded
   - Solution: Changed to `isPOTS ? game.players.length :`
   - Location: `app/api/game/[gameId]/advance/route.ts:353`

**Testing Results**:
- ✅ 4-player POTS games successfully created
- ✅ Song D appears in bidding interface
- ✅ 4 token placement spaces highlighted each round
- ✅ 8 rounds of normal play complete correctly
- ✅ Final placement triggers after round 8
- ✅ 4 spaces highlighted for final placement (1 per player)
- ✅ Game completes and advances to FINISHED status
- ✅ AI players function correctly in 4-player POTS mode

### 5-Player POTS Mode (January 21, 2026)

**Overview**:
Extended POTS experimental mode to support 5-player games with unique mechanics for asymmetric final placement.

**Key Differences from 4-Player POTS**:

| Aspect | 4-Player POTS | 5-Player POTS |
|--------|---------------|---------------|
| Songs Available | A, B, C, D | A, B, C |
| Song Patterns | A=ABCB, B=BCDC, C=CDAD, D=DABA | A=ABCBA, B=CDEDC, C=EBDAE |
| Tokens per Round | 4 | 5 |
| Total Rounds | 8 | 8 |
| Normal Round Tokens | 32 (8×4) | 40 (8×5) |
| Final Placement Tokens | 4 (1 per player) | 8 (top 3 place 2, bottom 2 place 1) |
| Total Tokens | 36 | 48 |
| Map Type | NYC36 | NYC48 |

**Song Implications**:
- Song A **always** has pattern ABCBA (A=2, B=2, C=1)
- Song B **always** has pattern CDEDC (C=2, D=2, E=1)
- Song C **always** has pattern EBDAE (E=2, B=1, D=1, A=1)
- Player assignments to variables A, B, C, D, E randomize each round
- Only 3 songs (A, B, C) - Song D does NOT appear in 5-player POTS

**Final Placement Phase**:
- Triggers after round 8 (same as 4-player)
- Players sorted by money remaining (descending)
- Ties broken by fewest influence tokens on board (ascending)
- **Unique turn order**: 1st, 2nd, 3rd, 4th, 5th, 1st, 2nd, 3rd
- Top 3 players place 2 tokens each (positions 1,6 / 2,7 / 3,8)
- Bottom 2 players place 1 token each (positions 4 / 5)
- 8 remaining edges highlighted for final placement

**Implementation Details**:

1. **AI Players**: Bailey, Karthik, Morgan, Casey (4 AI opponents)
2. **Player Colors**: Red, Teal, Yellow, Purple, Cyan

**Files Modified**:

1. **`lib/game/song-implications-data.ts`**
   - Added `POTS_PATTERN_5PLAYER` constant with 5-player patterns
   - Set `totalRounds: 8` and `tokensPerRound: 5`

2. **`lib/game/song-implications.ts`**
   - Updated `getSongImplications()` to handle playerCount === 5
   - Updated `getTotalRounds()` to return 8 for 5-player POTS

3. **`app/api/game/create-ai/route.ts`** (VS AI Mode)
   - Supports 5-player games with POTS patterns
   - Added 5th player color (Cyan)
   - Added "Casey" as 4th AI player name
   - Dynamic tokensPerRound based on player count

4. **`app/api/game/[gameId]/advance/route.ts`** (2 locations)
   - Lines 299-307: Added 5-player final placement turn order logic
   - Top 3 place 2 tokens, bottom 2 place 1 token

5. **`app/api/game/[gameId]/place-token/route.ts`** (2 locations)
   - Lines 285-295, 455-465: Same 5-player turn order logic

6. **`app/page.tsx`** (VS AI Mode UI)
   - 4-column grid for player count selection (3, 4, 5, 6)
   - Dynamic info display for all player counts

**Testing Results**:
- ✅ 5-player POTS games successfully created
- ✅ NYC48 map generates correctly
- ✅ 3 songs (A, B, C) appear, Song D does not
- ✅ 5 token spaces highlighted each round
- ✅ 8 rounds of normal play complete correctly
- ✅ Final placement triggers after round 8
- ✅ 8 spaces highlighted for final placement
- ✅ Turn order follows asymmetric pattern correctly
- ✅ Game completes with all 48 tokens placed

### 6-Player POTS Mode (January 21, 2026)

**Overview**:
Extended POTS experimental mode to support 6-player games with different song patterns and final placement mechanics.

**Key Configuration**:

| Aspect | Value |
|--------|-------|
| Songs Available | A, B, C |
| Song Patterns | A=ABCD, B=DCEF, C=FEBA |
| Tokens per Round | 4 |
| Total Rounds | 10 |
| Normal Round Tokens | 40 (10×4) |
| Final Placement Tokens | 8 (top 2 place 2, bottom 4 place 1) |
| Total Tokens | 48 |
| Map Type | NYC48 |

**Song Implications**:
- Song A **always** has pattern ABCD
- Song B **always** has pattern DCEF
- Song C **always** has pattern FEBA
- Player assignments to variables A, B, C, D, E, F randomize each round
- Only 3 songs (A, B, C) - uses 6 variables but only 3 songs

**Final Placement Phase**:
- Triggers after round 10
- **Unique turn order**: 1st, 2nd, 3rd, 4th, 5th, 6th, 1st, 2nd
- Top 2 players place 2 tokens each (positions 1,7 / 2,8)
- Bottom 4 players place 1 token each (positions 3, 4, 5, 6)
- 8 remaining edges highlighted for final placement

**Implementation Details**:

1. **AI Players**: Bailey, Karthik, Morgan, Casey, Quinn (5 AI opponents)
2. **Player Colors**: Red, Teal, Yellow, Purple, Cyan, Orange

**Files Modified**: Same files as 5-player implementation with 6-player logic added (all changes in `create-ai/route.ts`, not separate POTS mode)

**Testing Results**:
- ✅ 6-player POTS games successfully created
- ✅ NYC48 map generates correctly
- ✅ 3 songs appear with 6-variable patterns
- ✅ 4 token spaces highlighted each round
- ✅ 10 rounds of normal play complete correctly
- ✅ Final placement triggers after round 10
- ✅ Turn order follows top 2/bottom 4 pattern correctly

## Recent Major Updates (January 14, 2026)

### Hexagonal Map System Implementation

**What Was Added**:
1. **Random Map Generator**: Creates unique maps with exactly 36 or 48 token placement spaces (edges)
2. **Flat-Top Hexagon Rendering**: Fixed hexagon orientation (flat sides on top/bottom, no gaps)
3. **Edge-Based Token System**: Grey circles placed on shared sides between hexagons (not corners)
4. **New Hex Type Names & Distribution**: Updated from generic names to game-specific names with 2x multiplier for star types
5. **Double House Icon Feature**: High-connectivity hexes (5-6 surrounding edges) show extra house icon

**Files Modified**:
- `lib/game/map-generator.ts` - Complete rewrite with random generation
- `lib/game/hex-grid.ts` - Added edge-based system, fixed flat-top rendering
- `components/game/HexagonalMap.tsx` - Updated to render edges instead of vertices
- `components/game/HexIcon.tsx` - Updated names, added size prop
- `app/test-map/page.tsx` - Map testing interface

**Breaking Changes**:
- MapLayout interface changed: `vertices` → `edges`
- HexTile interface added `edgeCount` property
- All hex type names changed (e.g., `lightning` → `powerHub`, `house` → `households`)

## Token Placement System (January 17, 2026)

After each bidding round, players place Influence Tokens on the hexagonal map one at a time based on turn order from the winning song.

### Token Placement Flow

```
RESULTS → TOKEN_PLACEMENT → ROUND1 (next round) → ...
```

**Key Features**:
1. **Initial Map View**: 3-second countdown showing map with highlighted edges (orange) at game start
2. **Tab View Switcher**: Toggle between "Game View" and "Map View" during all phases (bidding, results, finished)
3. **Turn-Based Placement**: Players take turns placing tokens following winning song's turn order
4. **Token Types**: Players choose from 4/0, 2/2, or 1/3 tokens with A or B orientation
5. **Highlighted Edges**: 6 random edges (3-4 players) or 8 edges (5-6 players) highlighted in orange each round
6. **Real-Time Updates**: All players see token placements immediately via 1-second polling
7. **60-Second Timer**: Countdown for current player's turn, auto-places random token on timeout
8. **Player Colors**: Each player has unique color assigned on join (Red, Teal, Yellow, Purple, Cyan, Orange)
9. **Immediate Rewards**: Lightning/dollar hexes grant instant VP/currency when token placed adjacent

### Database Schema Updates

```prisma
model Game {
  // ... existing fields ...
  mapType           String?   // "NYC36" or "NYC48"
  mapLayout         String?   // Serialized MapLayout JSON
  totalRounds       Int?      // 6-9 rounds based on player count
  turnOrderA        String[]  // Player IDs in turn order for Song A
  turnOrderB        String[]  // Player IDs in turn order for Song B
  turnOrderC        String[]? // Player IDs in turn order for Song C (5-6 players)
  winningSong       String?   // "A", "B", or "C"
  highlightedEdges  String?   // JSON array of highlighted edge IDs
  currentTurnIndex  Int?      // Current turn index in token placement (0-based)
  placementTimeout  DateTime? // When current player's turn expires
}

model Player {
  // ... existing fields ...
  victoryPoints Int      @default(0)
  playerColor   String?  // Hex color code (#FF6B6B, etc.)
  isAI          Boolean  @default(false)
}

model InfluenceToken {
  id          String   @id @default(cuid())
  gameId      String
  game        Game     @relation(...)
  playerId    String
  player      Player   @relation(...)
  roundNumber Int      // Which game round token was placed
  edgeId      String   // Edge ID where token is placed
  tokenType   String   // "4/0", "2/2", or "1/3"
  orientation String   // "A" or "B"
  createdAt   DateTime @default(now())

  @@unique([gameId, edgeId])
  @@index([gameId])
}
```

### New Components

**Core Token Placement**:
- `components/game/InitialMapView.tsx` - Shows map for 3 seconds at game start with countdown
- `components/game/TabViewSwitcher.tsx` - Toggle between Game View and Map View
- `components/game/TokenPlacementPhase.tsx` - Main token placement UI with turn indicator, timer, token selector
- `components/game/TokenPlacementInterface.tsx` - Map interaction for placing tokens
- `components/game/OrientationModal.tsx` - Modal for selecting token orientation (A or B)

**Map Visualization**:
- `components/game/HexagonalMap.tsx` - Renders hexagonal map with tokens (updated to support player colors)
- Components already existed from previous session but were updated to support token placement

### New API Routes

**Token Placement**:
- `app/api/game/[gameId]/place-token` - Place a token on the map (updated to use persisted highlighted edges)
- `app/api/game/[gameId]/auto-place-token` - Automatically place random token on timeout
- `app/api/game/[gameId]/ai-token-placement` - AI player token placement logic
- `app/api/game/[gameId]/advance` - Updated to handle TOKEN_PLACEMENT state transitions

**AI Support**:
- `app/api/game/create-ai` - Create game with 2 AI players (generates map immediately)

### Logic Libraries

- `lib/game/token-placement-logic.ts` - Token placement validation and edge selection
- `lib/game/song-implications.ts` - Turn order patterns for each song
- `lib/game/ai-bidding.ts` - AI bidding behavior (existing, not modified)

### Key Implementation Details

**Terminology Clarification**:
- Code uses `vertexId` and `edgeId` interchangeably (historical artifact)
- **Edges** = shared flat sides between hexagons where tokens are placed (NOT corners/vertices)
- Function `selectRandomVertices()` actually selects edges (name kept for backward compatibility)

**Dynamic Polling Intervals**:
- TOKEN_PLACEMENT: 1 second (real-time token visibility)
- ROUND1/ROUND2: 2 seconds (normal bidding)
- RESULTS: 3 seconds (slower, less critical)
- FINISHED: 0 seconds (stops polling)

**Player Color Assignment**:
- Colors assigned on join/creation in order: Red → Teal → Yellow → Purple → Cyan → Orange
- Applied to: create, join, create-ai routes
- Displayed in: PlayerList, TokenPlacementPhase, HexagonalMap

**State Management**:
- Highlighted edges generated once per round, persisted in `game.highlightedEdges`
- Turn tracking via `game.currentTurnIndex` (0-based)
- Timeout tracking via `game.placementTimeout` (60 seconds per turn)
- Auto-advances when all tokens placed via `completeTokenPlacement` action

## Tech Stack

- **Framework**: Next.js 15 + TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite via Prisma ORM
- **Auth**: JWT-based session cookies (no passwords)
- **Real-time**: Dynamic polling (1s-3s based on game state)
- **Dev Server**: Turbopack (npm run dev)

## Critical Architecture Decisions

### Database Location
- **Path**: `payola/prisma/dev.db` (NOT nested in prisma/prisma/)
- **Environment Variable**: `DATABASE_URL="file:./prisma/dev.db"`
- ⚠️ **Common Issue**: Database was previously in wrong location, caused "Error code 14: Unable to open the database file"

### Game State Flow

```
LOBBY → ROUND1 (Promise Phase) → ROUND2 (Bribe Phase) → RESULTS → TOKEN_PLACEMENT → ROUND1 (next game round) → ...
```

**State Descriptions**:
- **LOBBY**: Waiting for players to join before game starts
- **ROUND1**: Promise Phase - all players bid simultaneously
- **ROUND2**: Bribe Phase - only $0 bidders from Promise Phase
- **RESULTS**: Show winning song and currency deductions
- **TOKEN_PLACEMENT**: Players place Influence Tokens one at a time
- **FINISHED**: Game ended by player choice

### Key Behavioral Rules

1. **Promise Phase $0 Bidders Wait**: Players who bid $0 must wait for ALL Promise Phase bids before seeing Bribe Phase interface
2. **Balance Updates**: Player balances update ONLY at end of Bribe Phase (not during bidding, not after Promise Phase)
3. **Public Balances**: All players can see each other's balances (updated twice per round: after Promise Phase results shown, after Bribe Phase results shown)
4. **Promise Phase Visibility**: During Bribe Phase, all players see Promise Phase bid results (totals by song + individual promises)

## Project Structure

### Key Files & Their Purposes

#### API Routes
- **`app/api/game/create/route.ts`**: Create new game
- **`app/api/game/join/route.ts`**: Join existing game
- **`app/api/game/[gameId]/route.ts`**: Get game state (polled every 2s)
- **`app/api/game/[gameId]/bid/route.ts`**: Submit promise/bribe, handles state transitions
- **`app/api/game/[gameId]/advance/route.ts`**: Start game, next round, finish game

#### Components
- **`components/game/GameBoard.tsx`**: Main game coordinator
- **`components/game/BiddingPanel.tsx`**: Promise/Bribe input interface
- **`components/game/PromisePhaseSummary.tsx`**: Shows Promise Phase results during Bribe Phase
- **`components/game/ResultsDisplay.tsx`**: End of round results
- **`components/game/PlayerList.tsx`**: Shows all players and their balances
- **`components/game/GameLobby.tsx`**: Pre-game waiting room

#### Logic & Context
- **`lib/game/bidding-logic.ts`**: Core game calculations (totals, winner, deductions)
- **`lib/contexts/game-context.tsx`**: React context for game state
- **`lib/auth.ts`**: Session management

#### Database
- **`prisma/schema.prisma`**: Database schema
- **`prisma/dev.db`**: SQLite database file

## Database Schema

```prisma
model Game {
  id          String   @id @default(cuid())
  roomCode    String   @unique
  status      String   // LOBBY, ROUND1, ROUND2, RESULTS, FINISHED
  roundNumber Int      @default(1) // Overall game round number
  players     Player[]
  bids        Bid[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Player {
  id              String   @id @default(cuid())
  gameId          String
  game            Game     @relation(...)
  name            String
  sessionToken    String   @unique
  currencyBalance Int      @default(30)
  bids            Bid[]
  createdAt       DateTime @default(now())
}

model Bid {
  id        String   @id @default(cuid())
  gameId    String
  playerId  String
  round     Int      // 1=Promise Phase, 2=Bribe Phase
  gameRound Int      // Overall game round number
  song      String   // "A", "B", or "C"
  amount    Int      // Bid amount in currency
  createdAt DateTime @default(now())
}
```

## Recent Bug Fixes (January 2026)

### 1. Bribe Phase Skip Bug ✅ FIXED
**Problem**: Game advanced to RESULTS immediately after Promise Phase, skipping Bribe Phase entirely.

**Root Cause**: `app/api/game/[gameId]/bid/route.ts:138` was using stale data from `currentRoundBids` and adding `+1`, causing premature advancement.

**Solution**: Use fresh database query with `prisma.bid.count()` to get accurate count.

**File**: `payola/app/api/game/[gameId]/bid/route.ts:140-146`

### 2. Database Path Issue ✅ FIXED
**Problem**: "Error code 14: Unable to open the database file"

**Root Cause**: Database was in `prisma/prisma/dev.db` but `.env` pointed to `./prisma/dev.db`

**Solution**:
- Copied database to correct location: `prisma/dev.db`
- Updated `.env` file to match
- Restarted server

### 3. Promise Phase $0 Bidders See Bribe Phase Too Early ✅ FIXED
**Problem**: Players who bid $0 immediately saw Bribe Phase interface before other players finished Promise Phase.

**Solution**: Added `allPlayersSubmittedRound1` check to `needsRound2Bid` logic.

**File**: `payola/app/api/game/[gameId]/route.ts:56`

### 4. Balance Deduction Timing ✅ FIXED
**Problem**: Balances were being deducted twice - once at end of Bribe Phase, once when starting next round.

**Solution**:
- Moved deduction logic to end of Bribe Phase in `bid/route.ts:155-193`
- Removed duplicate deduction logic from `advance/route.ts`
- Balances now update exactly twice per round: visible after Promise Phase ends, deducted after Bribe Phase ends

## API Response Structure

### GET `/api/game/[gameId]`

Returns current game state (polled every 2s):

```typescript
{
  game: {
    id: string;
    roomCode: string;
    status: "LOBBY" | "ROUND1" | "ROUND2" | "RESULTS" | "FINISHED";
    roundNumber: number;
  },
  players: Array<{
    id: string;
    name: string;
    currencyBalance: number; // Now visible for ALL players
    isMe: boolean;
  }>,
  currentBid: {
    song: string;
    amount: number;
    round: number;
  } | null,
  biddingState: {
    allPlayersSubmittedRound1: boolean;
    needsRound2Bid: boolean;
    waitingForRound2: boolean;
  },
  promisePhaseBids: Array<{
    playerId: string;
    playerName: string;
    song: string;
    amount: number;
    round: number;
  }> | null, // Available during ROUND2 and RESULTS
  allBids: Array<...> | null // Only available during RESULTS
}
```

## Development Workflow

### Starting the Server

```bash
cd payola
npm run dev  # Starts on http://localhost:3000
```

### Database Commands

```bash
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset database (destructive)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev  # Create and run new migrations
```

### Testing a Full Game Flow

1. Create game with 3+ players
2. **Promise Phase**:
   - Have 2 players bid $0
   - Have 1 player bid non-zero
   - Verify $0 bidders see "Waiting for other players..."
3. **Bribe Phase**:
   - Verify all players see Promise Phase results
   - Verify only $0 bidders can submit Bribe Phase bids
   - Verify non-zero bidders see "Bribe Phase in Progress"
4. **Results**:
   - Verify winning song is correct
   - Verify PAID/KEPT indicators are correct
   - Verify balances are updated
5. **Next Round**:
   - Verify balances carry over
   - Verify process repeats

## Important Code Patterns

### Conditional Text Based on Round

```typescript
// In BiddingPanel.tsx
{round === 1 ? "Promise Phase" : "Bribe Phase"}
{round === 1 ? "Promise Amount:" : "Bribe Amount:"}
{round === 1 ? "Submit Promise" : "Submit Bribe"}
```

### Currency Display

Always prefix with `$`:
```typescript
${currencyBalance}
${bid.amount}
${total}
```

### Checking if Player Needs Bribe Phase Bid

```typescript
const needsRound2Bid =
  allPlayersSubmittedRound1 &&
  myRound1Bid?.amount === 0 &&
  !round2Bids.find(b => b.playerId === session.playerId);
```

## Known Quirks & Considerations

1. **Polling Frequency**: Game state polls every 2 seconds. This means UI updates aren't instant.

2. **No Real-Time Push**: Uses polling, not WebSockets. If lag becomes an issue, consider implementing WebSockets.

3. **Turbopack Warnings**: Next.js may show warnings about multiple lockfiles. This is expected (payola has its own package.json).

4. **Fast Refresh**: TypeScript interface changes may require full page reload.

5. **Currency Balance Visibility**: All players see each other's balances. This is intentional for gameplay transparency.

6. **Session Tokens**: Stored in cookies. Clearing cookies = losing game session.

7. **Database File Location**: Must be at `payola/prisma/dev.db`, NOT `payola/prisma/prisma/dev.db`

## File Locations Quick Reference

### Most Frequently Edited Files

- Game state API: `app/api/game/[gameId]/route.ts`
- Bid submission: `app/api/game/[gameId]/bid/route.ts`
- Main game UI: `components/game/GameBoard.tsx`
- Bidding interface: `components/game/BiddingPanel.tsx`
- Promise Phase summary: `components/game/PromisePhaseSummary.tsx`
- Player list: `components/game/PlayerList.tsx`
- Game logic: `lib/game/bidding-logic.ts`

### Configuration Files

- Database schema: `prisma/schema.prisma`
- Environment: `.env` (DATABASE_URL)
- Package config: `package.json`
- TypeScript: `tsconfig.json`
- Next.js: `next.config.ts`

## Game State Transitions

### Critical Transition Points

1. **All Promise Phase bids submitted**:
   - Check if any players bid $0
   - If yes → `status = "ROUND2"`
   - If no → `status = "RESULTS"` (skip Bribe Phase)
   - Location: `app/api/game/[gameId]/bid/route.ts:109-130`

2. **All Bribe Phase bids submitted**:
   - Calculate song totals and winner
   - Calculate and apply currency deductions
   - Update all player balances in database
   - `status = "RESULTS"`
   - Location: `app/api/game/[gameId]/bid/route.ts:155-193`

3. **Next Round button clicked**:
   - `status = "ROUND1"`
   - `roundNumber++`
   - Location: `app/api/game/[gameId]/advance/route.ts:65-84`

## Debug Tips

### Server Logs
Watch the terminal for:
- Prisma errors (database issues)
- "Bribe Phase completion check" logs (shows bid counts)
- "End of Bribe Phase - Calculating deductions" logs (shows winner and deductions)

### Database Inspection
Use `prisma studio` to view database contents:
```bash
cd payola
npx prisma studio
```

### Common Issues

**"Failed to Create Game"**:
- Check database path in `.env`
- Verify database file exists at `prisma/dev.db`
- Check server logs for Prisma errors

**Players stuck in Promise Phase**:
- Check `allPlayersSubmittedRound1` in game state API
- Verify all players have submitted bids
- Check round1Bids.length vs game.players.length

**Bribe Phase skipped**:
- Check bid count logic in `bid/route.ts:140-146`
- Verify using fresh DB query, not stale data

**Balances not updating**:
- Check deduction logic runs at end of Bribe Phase
- Verify no double-deductions
- Check console logs for deduction calculations

## Future Considerations

### Potential Enhancements
- WebSocket support for real-time updates instead of polling
- Sound effects for phase transitions
- Animation for currency deductions
- Game history/replay feature
- Player statistics across multiple games
- Mobile-responsive improvements
- Accessibility improvements (ARIA labels, keyboard navigation)

### Performance Optimizations
- Consider caching game state
- Optimize database queries (add indexes)
- Reduce polling frequency when no active bidding

### Security Considerations
- Add rate limiting to API endpoints
- Validate all user inputs server-side
- Sanitize player names (prevent XSS)
- Add CSRF protection

## Hexagonal Map System (Added January 14, 2026)

The game includes a hexagonal map system for token placement mechanics.

### Map Generation

**Random Map Generator** (`lib/game/map-generator.ts`):
- Generates unique maps with **exactly 36 edges** (3-4 players) or **48 edges** (5-6 players)
- Edges = shared flat sides between hexagons where Influence Tokens can be placed
- Algorithm grows from center, randomly adding connected hexagons until target edge count is reached
- Creates compact, connected layouts (not stringy/spread out)
- Hex count varies (typically 18-22 for 36 edges, 24-28 for 48 edges)
- Falls back to fixed layouts if random generation fails after 50 attempts

**Key Functions**:
- `generateRandomMapLayout(targetEdges)`: Creates random connected map
- `getAllEdges(hexes)`: Calculates shared edges (excludes map boundaries)
- `getHexNeighbors(hex)`: Returns 6 neighboring positions for flat-top hex

### Hexagon Rendering

**Flat-Top Orientation** (`lib/game/hex-grid.ts`):
- Hexagons have flat sides on top/bottom (not pointy-top)
- Vertex numbering: 0=right, 1=bottom-right, 2=bottom-left, 3=left, 4=top-left, 5=top-right
- Edge-based system: Grey circles placed on shared flat sides between hexagons
- No gaps between adjacent hexagons

**Key Functions**:
- `hexToPixel()`: Converts axial coordinates to pixel position
- `getHexagonPoints()`: Generates SVG polygon points for flat-top hex
- `edgeToPixel()`: Calculates midpoint of shared edge between two hexes
- `createEdgeId()`: Creates unique ID for edge between two hexagons

### Hex Types & Distribution

**Updated Names (January 14, 2026)**:
- Power Hub (⚡) - 1x per map - Yellow
- Money Hub (💵) - 1x per map - Bright green
- Blues Star (🎺) - 2x per map - Sky blue
- Country Star (🤠) - 2x per map - Tan/beige
- Jazz Star (🎷) - 2x per map - Purple
- Rock Star (🎸) - 2x per map - Coral
- Pop Star (🎤) - 2x per map - Light green
- Classical Star (🎤) - 2x per map (5-6 player only) - Light gray
- Households (🏠) - Remaining hexes - Pink

**Distribution Totals**:
- 3-4 player maps: 12 special hexes + households (typically 6-10 households)
- 5-6 player maps: 14 special hexes + households (typically 10-14 households)

**Special Rule - Double House Icon**:
- Hexes with 5-6 surrounding token spaces show an extra 🏠 icon
- Exception: Power Hub and Money Hub never show extra house icon
- Icons are sized at 1rem (smaller) when doubled to prevent clipping

### Map Layout Interface

```typescript
interface MapLayout {
  mapType: 'NYC36' | 'NYC48';
  playerCount: number;
  hexes: HexTile[];
  edges: EdgeId[];  // Shared sides between hexagons
  totalRounds: number;
}

interface HexTile {
  coordinate: HexCoordinate;
  type: HexType;
  id: string;
  edgeCount: number;  // Number of adjacent hexagons
}

type EdgeId = string;  // Format: "e_{q1}_{r1}_{q2}_{r2}"
```

### Components

**HexagonalMap** (`components/game/HexagonalMap.tsx`):
- Renders hexagons, edges (grey circles), and influence tokens
- Uses SVG with calculated viewBox
- Edge component places grey circles on shared sides between hexagons
- HexagonTile component shows hex type icon(s)

**HexIcon** (`components/game/HexIcon.tsx`):
- Renders Unicode emoji for hex types
- Supports `size` prop: 'normal' (1.5rem) or 'small' (1rem)
- Designed for easy upgrade to SVG icons later

**Test Page** (`app/test-map/page.tsx`):
- Visual test interface at `/test-map`
- Generate random maps with player count selector
- Shows map info: hex count, edge count, distribution
- Useful for verifying map generation works correctly

### Key Files

**Map System**:
- `lib/game/map-generator.ts` - Random map generation, hex distribution
- `lib/game/hex-grid.ts` - Coordinate system, edge calculations, pixel conversion
- `components/game/HexagonalMap.tsx` - SVG rendering of map
- `components/game/HexIcon.tsx` - Hex type icon display

### Testing

Visit http://localhost:3000/test-map to:
- Generate random maps (click "Generate Map" multiple times for variety)
- Verify edge counts: 36 for 3-4 players, 48 for 5-6 players
- Check hex distribution (should see 2x of each star type)
- Observe double house icons on high-connectivity hexes

## Known Issues

### ✅ Previously Critical Issues - NOW RESOLVED (January 21, 2026)

The following issues have been fixed:

**1. Highlighted Edges Not Showing on Initial Map View** ✅ FIXED (January 17, 2026)
- Issue was resolved in previous session

**2. AI Bribe Phase Not Triggering** ✅ FIXED (January 17, 2026)
- Issue was resolved in previous session

**3. Token Placement Shows "Unknown Player" in AI Games** ✅ FIXED (January 17, 2026)
- Issue was resolved in previous session

**4. POTS Mode Final Placement Not Implemented** ✅ FIXED (January 21, 2026)
- Final placement phase now triggers after round 10
- All 6 remaining spaces are highlighted
- Turn order based on money remaining
- AI players automatically place tokens
- See "POTS Mode Final Placement Implementation" section above for full details

**5. Highlighted Edges Bug in Final Round** ✅ FIXED (January 21, 2026)
- Fixed incorrect `edge.id` access (should be `edgeId` for string arrays)
- All 4 locations in advance and place-token routes updated

**6. AI Token Placement Not Working in Final Round** ✅ FIXED (January 21, 2026)
- Updated status check to accept `FINAL_PLACEMENT` in addition to `TOKEN_PLACEMENT`
- Fixed turn order logic to use money-based order for final placement
- Fixed token query to check all rounds during final placement

### Current Known Issues

No critical issues at this time. The game is fully functional for both standard and POTS modes.

## Session Handoff Checklist

When resuming work on this project:

- [ ] Read this document thoroughly
- [ ] Check if server is running: `curl http://localhost:3000` (may be port 3001 or 3002)
- [ ] If not running: `cd payola && npm run dev`
- [ ] Verify database exists at correct path
- [ ] Review recent git commits for any changes
- [ ] Test basic game flow (create → join → promise → bribe → results → token placement)
- [ ] Test POTS mode flow (10 rounds → final placement → game end)
- [ ] Test map generation at /test-map
- [ ] Test AI game flow end-to-end (all previously critical issues now resolved)
- [ ] Verify final placement phase works correctly in POTS mode

## Contact Information

- Project located at: `C:\Users\ocean\Downloads\uigen\payola\`
- Server URL: http://localhost:3000 (or 3001/3002 if port 3000 in use)
- Network URL: http://192.168.1.72:3000 (adjust port as needed)
- Current Session: Server running on port 3002

---

**Remember**: This is a board game companion app. The physical game provides additional context and rules. The digital app handles blind bidding, currency tracking, token placement, and result calculation.

## Recent Session Summary (January 21, 2026)

**Session 1: 3-Player POTS Mode Final Placement**:
- ✅ Implemented POTS mode final placement phase (after round 10)
- ✅ Updated UI to show "Final Round" label instead of "Round 11"
- ✅ Fixed highlighted edges bug (`edge.id` vs `edgeId` string comparison)
- ✅ Fixed AI token placement to work with FINAL_PLACEMENT status
- ✅ Added money-based turn order calculation for final placement
- ✅ Updated 4 components: PlayerList, TokenPlacementPhase, ResultsDisplay, GameBoard
- ✅ Updated 2 API routes: advance (2 locations), place-token (2 locations)
- ✅ Updated AI placement logic to support FINAL_PLACEMENT status
- ✅ Added comprehensive debug logging throughout final placement flow
- ✅ Tested complete game flow from round 1 through final placement to game end

**Session 2: 4-Player POTS Mode Implementation**:
- ✅ Extended POTS mode to support 4-player games
- ✅ Added 4-player song patterns: ABCB, BCDC, CDAD, DABA
- ✅ Implemented 8 rounds with 4 tokens per round (32 total)
- ✅ Implemented final placement with 1 token per player (4 total)
- ✅ Added dynamic token calculation based on player count
- ✅ Updated all hardcoded `3` values to use `game.players.length`
- ✅ Fixed Song D not appearing in 4-player POTS games
- ✅ Fixed only 3 spaces being highlighted instead of 4 in subsequent rounds
- ✅ Added player count selector UI (3 or 4 players)
- ✅ Updated 7 files: song-implications-data, song-implications, create-pots, advance, place-token, SongSelector, page
- ✅ Verified complete 4-player POTS game flow works correctly

**Previous Session Summary (January 17, 2026)**:
- ✅ Integrated token placement system into bidding game flow
- ✅ Created initial map view with 3-second countdown
- ✅ Added tab switcher for game/map views during all phases
- ✅ Implemented TOKEN_PLACEMENT game state
- ✅ Created token placement UI components (TokenPlacementPhase, InitialMapView, TabViewSwitcher)
- ✅ Added player color assignment system
- ✅ Implemented dynamic polling (1s/2s/3s based on state)
- ✅ Created AI token placement endpoint
- ✅ Updated database schema with token placement fields
- ✅ Added auto-trigger for AI bids after human player submits

**All Known Issues Resolved**: The game is now fully functional for:
- Standard mode (3-6 players) - Human multiplayer
- VS AI Mode (3-6 players) - Uses POTS patterns for all player counts ✅ UNIFIED (January 21, 2026)
  - 3-player: 10 rounds, 3 tokens/round, 6 final tokens
  - 4-player: 8 rounds, 4 tokens/round, 4 final tokens
  - 5-player: 8 rounds, 5 tokens/round, 8 final tokens (asymmetric)
  - 6-player: 10 rounds, 4 tokens/round, 8 final tokens (asymmetric)

**Next Steps**:
- Continue playtesting to discover any edge cases
- Consider adding visual improvements to final placement phase
- ~~Consider unifying VS AI Mode with POTS Mode mechanics~~ ✅ COMPLETE
