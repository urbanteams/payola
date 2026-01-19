# Payola Project Context & Session History

Last Updated: January 17, 2026

## Project Overview

**Payola** is a digital companion app for a physical board game featuring multi-round blind bidding mechanics where players strategically bid on songs to influence outcomes.

### Core Game Mechanics

- **Starting Currency**: Each player begins with $30
- **Songs**: Three options available each round - Song A, B, and C
- **Two Bidding Phases per Round**:
  - **Promise Phase**: All players bid simultaneously (can bid $0 to skip to Bribe Phase)
  - **Bribe Phase**: Only players who bid $0 in Promise Phase participate (must pay regardless of outcome)
- **Winner Determination**: Song with highest total currency wins
- **Tie-Breaking Rules**:
  - 2-way tie → 3rd song wins
  - 3-way tie → random selection
- **Payment Rules**:
  - Promise Phase bidders: Only pay if they backed the winning song
  - Bribe Phase bidders: Always pay regardless of outcome
- **No Round Limit**: Game continues indefinitely until players choose to end it

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
- All hex type names changed (e.g., `lightning` → `buzzHub`, `house` → `households`)

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
- Buzz Hub (⚡) - 1x per map - Yellow
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
- Exception: Buzz Hub and Money Hub never show extra house icon
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

## Known Issues (January 17, 2026)

### ⚠️ Critical Issues - AI Games

The following three issues prevent AI games from functioning properly:

**1. Highlighted Edges Not Showing on Initial Map View**
- **Problem**: When the initial map view displays at game start, all token spaces appear grey instead of 6 (or 8) being highlighted in orange
- **Expected**: 6 edges should be orange for 3-4 player games, 8 edges for 5-6 player games
- **Impact**: Players don't know which edges are valid for first round token placement
- **Status**: Implementation attempted but not working
- **Files Involved**:
  - `app/api/game/create-ai/route.ts` - Generates highlighted edges on game creation
  - `components/game/InitialMapView.tsx` - Should display highlighted edges
  - `components/game/GameBoard.tsx` - Passes edges to InitialMapView

**2. AI Bribe Phase Not Triggering**
- **Problem**: When human player submits a Promise Phase bid of $1+, game gets stuck on "Waiting for Other Players" if AI players need to do Bribe Phase (bid $0 in Promise)
- **Expected**: AI players should immediately submit their Bribe Phase bids
- **Impact**: Game cannot progress past Promise Phase in AI mode
- **Status**: Auto-trigger code added but not functioning
- **Files Involved**:
  - `app/api/game/[gameId]/bid/route.ts` - Added fetch to trigger AI bids (lines 245-254)
  - `app/api/game/[gameId]/ai-bid/route.ts` - Should process AI bids
- **Note**: AI Promise Phase bids work correctly

**3. Token Placement Shows "Unknown Player" in AI Games**
- **Problem**: When TOKEN_PLACEMENT phase starts in AI game, turn indicator shows "Current Turn: Unknown" and no tokens are placed
- **Expected**: Should show current player's name and AI players should auto-place tokens
- **Impact**: Token placement phase is completely non-functional in AI games
- **Status**: AI token placement route created but not triggering
- **Files Involved**:
  - `app/api/game/[gameId]/ai-token-placement/route.ts` - AI placement logic (new file)
  - `app/api/game/[gameId]/advance/route.ts` - Should trigger AI placement (lines 194-211)
  - `app/api/game/[gameId]/place-token/route.ts` - Should trigger next AI placement (lines 187-198)
  - `components/game/TokenPlacementPhase.tsx` - Displays current turn

### Debug Notes

**For Issue #1**:
- Check if `game.highlightedEdges` is populated when InitialMapView renders
- Verify JSON parsing of highlightedEdges
- Confirm HexagonalMap receives and processes highlightedVertices prop correctly

**For Issue #2**:
- Check server logs when human player submits Promise Phase bid
- Verify fetch request to `/api/game/[gameId]/ai-bid` is being made
- Check if AI bid route is receiving requests and processing them
- May need to use `await` instead of fire-and-forget fetch

**For Issue #3**:
- Check if TOKEN_PLACEMENT state is being set correctly
- Verify turn order is calculated properly (getTurnOrder function)
- Check if first player ID matches an AI player
- Verify fetch to ai-token-placement endpoint is being called
- May need session/auth handling for server-to-server fetch calls

## Session Handoff Checklist

When resuming work on this project:

- [ ] Read this document thoroughly
- [ ] Check if server is running: `curl http://localhost:3000` (may be port 3001 or 3002)
- [ ] If not running: `cd payola && npm run dev`
- [ ] Verify database exists at correct path
- [ ] Review recent git commits for any changes
- [ ] Test basic game flow (create → join → promise → bribe → results → token placement)
- [ ] Test map generation at /test-map
- [ ] **PRIORITY**: Fix the three AI game issues listed above
- [ ] Test AI game flow end-to-end after fixes

## Contact Information

- Project located at: `C:\Users\ocean\Downloads\uigen\payola\`
- Server URL: http://localhost:3000 (or 3001/3002 if port 3000 in use)
- Network URL: http://192.168.1.72:3000 (adjust port as needed)
- Current Session: Server running on port 3002

---

**Remember**: This is a board game companion app. The physical game provides additional context and rules. The digital app handles blind bidding, currency tracking, token placement, and result calculation.

## Recent Session Summary (January 17, 2026)

**Work Completed**:
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

**Known Issues** (see above for details):
1. Highlighted edges not showing in orange on initial map view
2. AI Bribe Phase not triggering automatically
3. Token Placement shows "Unknown Player" and doesn't work in AI games

**Next Steps**:
- Debug and fix the three AI game issues
- Test complete game flow with both multiplayer and AI modes
- Verify highlighted edges display correctly
- Ensure AI players respond immediately during all phases
