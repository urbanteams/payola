# Payola Project Context & Session History

Last Updated: January 11, 2026

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

## Tech Stack

- **Framework**: Next.js 15 + TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite via Prisma ORM
- **Auth**: JWT-based session cookies (no passwords)
- **Real-time**: Polling every 2 seconds
- **Dev Server**: Turbopack (npm run dev)

## Critical Architecture Decisions

### Database Location
- **Path**: `payola/prisma/dev.db` (NOT nested in prisma/prisma/)
- **Environment Variable**: `DATABASE_URL="file:./prisma/dev.db"`
- ⚠️ **Common Issue**: Database was previously in wrong location, caused "Error code 14: Unable to open the database file"

### Game State Flow

```
LOBBY → ROUND1 (Promise Phase) → ROUND2 (Bribe Phase) → RESULTS → ROUND1 (next game round) → ...
```

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

## Session Handoff Checklist

When resuming work on this project:

- [ ] Read this document thoroughly
- [ ] Check if server is running: `curl http://localhost:3000`
- [ ] If not running: `cd payola && npm run dev`
- [ ] Verify database exists at correct path
- [ ] Review recent git commits for any changes
- [ ] Test basic game flow (create → join → promise → bribe → results)
- [ ] Check for any new issues or bugs reported

## Contact Information

- Project located at: `C:\Users\ocean\Downloads\uigen\payola\`
- Server URL: http://localhost:3000
- Network URL: http://192.168.1.72:3000

---

**Remember**: This is a board game companion app. The physical game provides additional context and rules. The digital app handles blind bidding, currency tracking, and result calculation.
