# AI Token Placement Improvements

## Overview
Enhanced AI players to make strategic token placements by:
1. Prioritizing hexagons that can be "closed" (guaranteed to win)
2. Accounting for 0/0 tokens when calculating effective edges
3. Optimizing value distribution between both hexagons adjacent to an edge
4. Ensuring 2-edge hexagons always receive 4 to guarantee control

## Changes Made

### File Modified
- `lib/game/ai-token-placement.ts`

### Strategic Priority Logic

The AI now follows this decision hierarchy:

1. **Identify Closable Hexagons**
   - Hexagons with exactly 2 edges total (at least one highlighted)
   - Hexagons with **effectively 2 edges** (e.g., 3 edges with one being a 0/0 token)
   - Hexagons with only 1 unfilled edge remaining (and that edge is highlighted)
   - **Key Insight**: 0/0 tokens don't contribute influence, so they're treated as non-existent edges

2. **Filter by Star Collection**
   - Skip hexagons with star types the AI has already collected
   - Prevents wasting tokens on duplicate stars

3. **Calculate Minimum Winning Value**
   - Determines the minimum token value (1-4) needed to win or tie
   - Considers current player scores on the hexagon
   - Returns null if impossible to win (e.g., opponent has 7+ and AI has 0)

4. **Choose Optimal Token & Orientation (BOTH Hexagons)**
   - **Key Innovation**: Considers BOTH hexagons adjacent to the edge
   - **Critical Rule**: For 2-effective-edge hexagons, target MUST get 4 (non-negotiable)
   - **For other hexagons**: Optimize distribution to minimize waste

   **Algorithm**:
   ```
   1. Calculate minimum needed for target hex and other hex
   2. If target has 2 effective edges:
      - targetRequired = 4 (hardcoded)
   3. Else:
      - targetRequired = calculated minimum

   4. Try all token types (4/0, 3/1, 2/2) and orientations
   5. For 2-edge hexagons:
      - Require: target gets ≥ 4
      - Don't require other hex to be satisfied
   6. For other hexagons:
      - Require: both hexes satisfied
      - Minimize total waste

   7. Select token with least waste
   8. Safety check: If 2-edge hex and target ≠ 4, force 4/0
   ```

   **Examples**:
   - 2-edge hex (empty): Uses 4/0 to guarantee target gets 4
   - If Hex A needs 1, Hex B needs 3 → uses 3/1 to minimize waste
   - If Hex A needs 0 (already winning), Hex B needs 4 → uses 0/4
   - Correctly handles edge orientation flipping for diagonal edges

5. **Fallback to Random**
   - If no closable hexagons exist, uses random placement
   - If any errors occur during calculation, falls back to random
   - Ensures the game never crashes due to AI logic issues

### Helper Functions Added

#### `getEdgesForHex(hexCoord, mapLayout)`
Returns all edges adjacent to a specific hexagon.

#### `getFilledEdgesForHex(hexCoord, existingTokens, mapLayout)`
Returns which edges already have tokens for a specific hexagon.

#### `getZeroEdgesForHex(hexCoord, existingTokens, mapLayout)`
Returns edges that have 0/0 tokens (which don't contribute to influence).

#### `getEffectiveEdgeCount(hexCoord, existingTokens, mapLayout)`
Calculates effective edge count by subtracting 0/0 token edges from total edges.

#### `calculateCurrentScores(hexCoord, existingTokens, mapLayout)`
Calculates current player influence scores on a hexagon using edge-based tokens.
Properly handles edge orientation flipping for 60° diagonal edges.

#### `getPlayerStarCollection(playerId, existingTokens, mapLayout)`
Determines which star types a player has already collected (winning or tied).

#### `getClosableEdge(hexCoord, highlightedEdges, existingTokens, mapLayout)`
Checks if a hexagon is closable and returns the edge that can close it.

#### `findClosableHexes(playerId, highlightedEdges, existingTokens, mapLayout, playerStars)`
Finds all closable hexagons, excluding those with already-collected star types.

#### `calculateMinimumWinningValue(playerId, hexCoord, currentScores)`
Calculates the minimum value (1-4) needed to win or tie a hexagon.
Returns null if impossible to win.

#### `chooseTokenForClosableHex(playerId, edgeId, hexCoord, currentScores, isNPCPlayer)`
Selects the optimal token type and orientation to close a hexagon.
Accounts for edge direction flipping on diagonal edges.

### Edge Orientation Handling

The implementation correctly handles the visual orientation flipping that occurs on 60° diagonal edges:
- For edges where `dq=1` and `dr=-1`, the values appear flipped
- The orientation calculation accounts for this when determining which hex gets which value

### Error Handling

All strategic logic is wrapped in try-catch blocks:
- Any calculation errors fall back to random placement
- Logs the reason for fallback to console
- Ensures the game never crashes due to AI logic

### NPC Player Handling

NPC players (non-AI placeholders) continue to use simple random placement with 0/0 tokens.

## Example Scenarios

### Scenario 1: Actual 2-Edge Hexagon
- Hex has exactly 2 edges: edge1 and edge2
- edge1 is highlighted and unfilled
- AI places a 4/0 token with orientation to guarantee the 4 goes to the target hex
- This ensures no other player can beat the AI on this hex

### Scenario 1b: Effective 2-Edge Hexagon (3 edges with 0/0)
- Hex has 3 edges total: edge1 (0/0 token), edge2 (highlighted), edge3 (not highlighted)
- Effective edges: 2 (since 0/0 contributes nothing)
- AI places a 4/0 token on edge2 with orientation to put 4 in the target hex
- Result: AI has 4 points, opponent can at best place 4 on edge3 later (4-4 tie guaranteed)

### Scenario 2: Last Remaining Edge
- Hex has 6 edges total, 5 are filled
- The 6th edge is highlighted
- Current scores: Opponent has 5, AI has 2
- AI needs 4 to win (5 - 2 + 1 = 4)
- AI places a 4/0 token to win the hex

### Scenario 3: Already Collected Star
- Two closable hexagons exist
- One is a "bluesStar" hex (AI already collected this)
- One is a "rockStar" hex (AI hasn't collected this)
- AI chooses the rockStar hex

### Scenario 4: Optimal Distribution (bad4.PNG example)
- Edge between Pop Star and Household hexagons
- Household needs only 1 to win, Pop Star needs 3
- **Old behavior**: Places 4/0 (0 in Pop Star, 4 in Household) - wastes 3 points
- **New behavior**: Places 3/1 (3 in Pop Star, 1 in Household) - optimal!
- Result: Wins Household with 1, gets 3 towards Pop Star

### Scenario 5: Don't Waste on Already-Winning Hexagons (bad22.PNG example)
- Edge between Jazz Star (already has 4) and Blues Star (needs 4)
- Jazz Star: AI already has 4 (winning), doesn't need more
- Blues Star: AI needs 4 to secure
- **Old behavior**: Places 2/2 (2 in Jazz, 2 in Blues) - wastes 2 on Jazz
- **New behavior**: Places 0/4 (0 in Jazz, 4 in Blues) - optimal!
- Result: Jazz stays at 4 (still winning), Blues gets 4 instead of 2

### Scenario 6: Fallback
- No closable hexagons available
- AI falls back to random placement
- Logs: "AI [name] falling back to random placement: No closable hexes available"

## Development History & Bug Fixes

### Initial Implementation
- Added closable hexagon detection (2 total edges or only 1 unfilled)
- Star collection tracking to avoid duplicates
- Minimum winning value calculation

### Enhancement 1: Effective Edge Count
- Recognized that 0/0 tokens don't contribute to influence
- Added `getZeroEdgesForHex()` and `getEffectiveEdgeCount()`
- Hexagons with 3 edges where one is 0/0 now treated as 2-edge hexagons

### Enhancement 2: Optimal Distribution
- Initial implementation only considered the target hex
- Enhanced to consider BOTH hexagons adjacent to an edge
- Minimizes waste by distributing values optimally
- Examples: 3/1 instead of 4/0 when one hex needs only 1

### Bug Fix: Prioritization Override
- **Issue**: Optimization logic was too complex and broke 2-edge hex prioritization
- **Symptom**: AI placing 2/2 instead of 4/0 on 2-edge hexagons
- **Root Cause**: Distribution optimizer was trying to satisfy both hexes equally
- **Fix**: Simplified logic with clear hierarchy:
  1. For 2-edge hexagons: Target MUST get 4 (non-negotiable)
  2. For other hexagons: Optimize distribution between both
- **Safety Net**: Added failsafe that forces 4/0 if logic somehow fails for 2-edge hex

## Testing Notes

- Build passes successfully with no TypeScript errors
- All existing token placement logic remains unchanged
- AI behavior is now strategic but maintains random fallback for robustness
- Extensive console logging helps debug AI decision-making
