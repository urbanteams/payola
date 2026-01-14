# Payola Debug Guide - Round 2 Bidding Issue

> **⚠️ NOTE (January 2026)**: This guide documents the historical "Round 2 Skip Bug" that has been FIXED. For current project context, architecture, and recent changes, see **[`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)** which supersedes this document.
>
> **Terminology Update**: "Round 1/Round 2" are now called "Promise Phase/Bribe Phase" throughout the codebase.

## Project Overview

**Payola** is a digital companion app for a physical board game featuring multi-round blind bidding mechanics.

### Core Game Mechanics
- Players start with **30 currency**
- Three song options: **Song A, B, C**
- **Round 1**: All players bid simultaneously (can bid 0 to skip to Round 2)
- **Round 2**: Only players who bid 0 in Round 1 get to bid (guaranteed cost)
- **Results**:
  - Winning song = highest total currency
  - Tie-breaking: 2-way tie → 3rd song wins, 3-way tie → random
  - Round 1 bidders: only pay if they backed the winner
  - Round 2 bidders: always pay regardless of outcome

### Tech Stack
- Next.js 15 + TypeScript + Tailwind CSS
- Prisma ORM + SQLite database
- Session-based auth (cookies, no passwords)
- Real-time updates via polling (2-second intervals)

## Current Bug Report

**Issue**: Players who bid 0 in Round 1 have their Round 2 bidding opportunity skipped. The game goes straight to RESULTS instead of showing the Round 2 bidding interface.

**Expected Behavior**:
1. All players submit Round 1 bids
2. Game advances to ROUND2 status
3. Players who bid 0 see the Round 2 bidding interface
4. Players who bid non-zero see "Round 2 in Progress" waiting message
5. After all Round 2 bids submitted, game advances to RESULTS

**Actual Behavior**:
1. All players submit Round 1 bids
2. Game advances to ROUND2 status
3. Players who bid 0 briefly see the Round 2 bidding interface (after recent fix)
4. **BUG**: Game immediately advances to RESULTS without accepting Round 2 bids

## Recent Fix Applied

**File**: `payola/app/api/game/[gameId]/route.ts:70`

**Change**: Modified `currentBid` logic to return `null` when player needs Round 2 bid:
```typescript
// BEFORE:
currentBid: myBid ? { ... } : null,

// AFTER:
currentBid: (myBid && !needsRound2Bid) ? { ... } : null,
```

**Result**: Fixed the initial freeze bug. Now Round 2 interface appears for zero-bidders, but game advances too quickly.

## Key Files & Architecture

### Database Schema
**File**: `payola/prisma/schema.prisma`

Models:
- **Game**: roomCode, status (LOBBY/ROUND1/ROUND2/RESULTS/FINISHED), roundNumber
- **Player**: gameId, name, sessionToken, currencyBalance (starts at 30)
- **Bid**: gameId, playerId, round (1 or 2), gameRound, song (A/B/C), amount

### Game State API
**File**: `payola/app/api/game/[gameId]/route.ts`

**Purpose**: Returns current game state to frontend
**Key Logic** (lines 44-78):
```typescript
const round1Bids = currentRoundBids.filter(b => b.round === 1);
const round2Bids = currentRoundBids.filter(b => b.round === 2);
const allPlayersSubmittedRound1 = round1Bids.length === game.players.length;

const myRound1Bid = round1Bids.find(b => b.playerId === session.playerId);
const needsRound2Bid = myRound1Bid?.amount === 0 && !round2Bids.find(b => b.playerId === session.playerId);

// Returns:
biddingState: {
  allPlayersSubmittedRound1,
  needsRound2Bid,
  waitingForRound2: allPlayersSubmittedRound1 && !needsRound2Bid && round2Bids.length < round1Bids.filter(b => b.amount === 0).length,
}
```

### Bid Submission API
**File**: `payola/app/api/game/[gameId]/bid/route.ts`

**Purpose**: Handle bid submissions and game state transitions

**Critical Logic** (lines 107-147):
1. Create the bid in database
2. Check if all Round 1 bids are in (line 107-130)
   - If yes and some players bid 0 → advance to ROUND2
   - If yes and no one bid 0 → advance to RESULTS
3. Check if all Round 2 bids are in (line 132-147)
   - Count zero-bidders from Round 1
   - If Round 2 bid count equals zero-bidders → advance to RESULTS

**SUSPECTED BUG LOCATION**: Lines 132-147 - Round 2 completion logic

### Frontend GameBoard Component
**File**: `payola/components/game/GameBoard.tsx`

**Rendering Logic** (lines 124-164):
```typescript
if (game.status === "ROUND1" || game.status === "ROUND2") {
  if (currentBid) {
    // Show "Bid Submitted! Waiting..." message
  } else if (biddingState.needsRound2Bid) {
    // Show Round 2 bidding panel
  } else if (biddingState.waitingForRound2) {
    // Show "Round 2 in Progress" message
  } else {
    // Show Round 1 bidding panel
  }
}
```

## Debugging Information

### How to Test
1. Create a game with 3 players
2. Have 2 players bid 0 in Round 1 (they should go to Round 2)
3. Have 1 player bid non-zero in Round 1 (they should wait)
4. Observe if Round 2 interface appears for the 2 zero-bidders
5. Check if they can submit Round 2 bids before game advances to RESULTS

### Database Inspection Script
**File**: `payola/debug-game.js`

```bash
node payola/debug-game.js
```

Shows:
- Game status
- Round number
- Player count
- All bids with player names, songs, amounts, and rounds
- Analysis of Round 1 vs Round 2 bid counts

### Dev Server Logs
Check `C:\Users\ocean\AppData\Local\Temp\claude\C--Users-ocean-Downloads-uigen\tasks\bd40a9d.output` for server logs

## Action Plan to Fix Round 2 Skip Bug

### Step 1: Identify the Problem
**Hypothesis**: The bid submission API is incorrectly advancing to RESULTS too early.

**Check**: Line 138 in `payola/app/api/game/[gameId]/bid/route.ts`
```typescript
const round2BidsCount = currentRoundBids.filter(b => b.round === 2).length + 1;
```

**Potential Issue**: This calculates Round 2 bids AFTER adding the current bid, but the check happens DURING a Round 2 bid submission. The `+ 1` might be causing an off-by-one error.

### Step 2: Verify the Logic
**Expected behavior in bid submission**:
- When a Round 2 bid is created (line 96-105), it's already in the database
- The check on line 138 adds `+ 1` to the count
- This might double-count the just-submitted bid

**Test**: Remove the `+ 1` and see if it's already counted:
```typescript
// Line 138 - CURRENT (possibly wrong):
const round2BidsCount = currentRoundBids.filter(b => b.round === 2).length + 1;

// PROPOSED FIX:
const round2BidsCount = await prisma.bid.count({
  where: {
    gameId: game.id,
    gameRound: game.roundNumber,
    round: 2
  }
});
```

### Step 3: Review Round 1 → Round 2 Transition
**File**: `payola/app/api/game/[gameId]/bid/route.ts:107-130`

Verify this logic correctly identifies when to move to ROUND2:
```typescript
if (biddingRound === 1 && newRound1Count === game.players.length && game.status === "ROUND1") {
  const allBids = await prisma.bid.findMany({
    where: { gameId: game.id, gameRound: game.roundNumber, round: 1 },
  });
  const zeroBidders = allBids.filter(b => b.amount === 0);

  if (zeroBidders.length > 0) {
    // Move to Round 2
    await prisma.game.update({
      where: { id: game.id },
      data: { status: "ROUND2" },
    });
  } else {
    // No one bid 0, skip to results
    await prisma.game.update({
      where: { id: game.id },
      data: { status: "RESULTS" },
    });
  }
}
```

**Looks correct** - This properly checks for zero-bidders.

### Step 4: Fix Round 2 → RESULTS Transition
**File**: `payola/app/api/game/[gameId]/bid/route.ts:132-147`

**Current code**:
```typescript
if (biddingRound === 2) {
  const allRound1Bids = await prisma.bid.findMany({
    where: { gameId: game.id, gameRound: game.roundNumber, round: 1 },
  });
  const zeroBidders = allRound1Bids.filter(b => b.amount === 0);
  const round2BidsCount = currentRoundBids.filter(b => b.round === 2).length + 1;

  if (round2BidsCount === zeroBidders.length) {
    // All Round 2 bids submitted, move to results
    await prisma.game.update({
      where: { id: game.id },
      data: { status: "RESULTS" },
    });
  }
}
```

**PROBLEM IDENTIFIED**:
1. `currentRoundBids` is fetched at the START of the request (line 74 in bid/route.ts)
2. The new bid is created (line 96-105)
3. Then we check `currentRoundBids.filter(b => b.round === 2).length + 1`
4. But `currentRoundBids` doesn't include the just-created bid yet!
5. The `+ 1` is correct, but we should re-fetch to be safe

**PROPOSED FIX**:
```typescript
if (biddingRound === 2) {
  const allRound1Bids = await prisma.bid.findMany({
    where: { gameId: game.id, gameRound: game.roundNumber, round: 1 },
  });
  const zeroBidders = allRound1Bids.filter(b => b.amount === 0);

  // Re-fetch Round 2 bids to include the just-submitted bid
  const round2BidsCount = await prisma.bid.count({
    where: {
      gameId: game.id,
      gameRound: game.roundNumber,
      round: 2
    }
  });

  if (round2BidsCount === zeroBidders.length) {
    // All Round 2 bids submitted, move to results
    await prisma.game.update({
      where: { id: game.id },
      data: { status: "RESULTS" },
    });
  }
}
```

### Step 5: Additional Safety Check
Consider adding a debug log before advancing to RESULTS:
```typescript
console.log('Round 2 completion check:', {
  round2BidsCount,
  zeroBiddersCount: zeroBidders.length,
  willAdvance: round2BidsCount === zeroBidders.length
});
```

## Implementation Checklist

- [ ] Open `payola/app/api/game/[gameId]/bid/route.ts`
- [ ] Locate the Round 2 completion check (lines 132-147)
- [ ] Replace `currentRoundBids.filter(b => b.round === 2).length + 1` with a fresh database count
- [ ] Use `prisma.bid.count()` to get accurate Round 2 bid count
- [ ] Add console.log for debugging
- [ ] Test with 3 players (2 bid 0, 1 bids non-zero)
- [ ] Verify Round 2 interface appears and accepts bids
- [ ] Verify game only advances to RESULTS after ALL Round 2 bids submitted
- [ ] Remove debug logs once confirmed working

## Summary

**Root Cause**: The bid submission API is using stale data (`currentRoundBids`) to count Round 2 bids, then adding `+ 1`. This might be triggering the RESULTS transition prematurely.

**Solution**: Re-fetch Round 2 bid count from database after creating the new bid to ensure accurate count before advancing game state.

**Files to Edit**:
- `payola/app/api/game/[gameId]/bid/route.ts` (lines ~138-140)

**Expected Result**: Game will wait for all zero-bidders to submit Round 2 bids before advancing to RESULTS.
