# Payola

A digital companion app for a physical board game featuring multi-round blind bidding mechanics.

**🎮 Game Overview**: Players strategically bid on songs across two phases per round (Promise Phase and Bribe Phase) using limited currency to influence which song wins.

## Quick Start

```bash
# Install dependencies and setup database
npm run setup

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the game.

## 📚 Documentation

**For developers picking up this project** (especially in new Claude Code sessions):
- **Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) first** - Contains complete project context, architecture, recent changes, and troubleshooting
- [`DEBUG_GUIDE.md`](./DEBUG_GUIDE.md) - Original debugging reference (historical, some info superseded by PROJECT_CONTEXT.md)

## Tech Stack

- **Framework**: Next.js 15 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite via Prisma ORM
- **Auth**: JWT session cookies
- **Real-time**: 2-second polling

## Project Structure

```
payola/
├── app/
│   ├── api/game/              # Game API endpoints
│   │   ├── create/            # Create new game
│   │   ├── join/              # Join existing game
│   │   └── [gameId]/          # Game state, bidding, advancement
│   ├── game/[gameId]/         # Game UI page
│   └── page.tsx               # Landing page
├── components/game/           # Game UI components
│   ├── GameBoard.tsx          # Main game coordinator
│   ├── BiddingPanel.tsx       # Promise/Bribe input
│   ├── PromisePhaseSummary.tsx # Promise results display
│   ├── ResultsDisplay.tsx     # End of round results
│   └── PlayerList.tsx         # Player status sidebar
├── lib/
│   ├── game/bidding-logic.ts  # Core game calculations
│   ├── contexts/game-context.tsx # React state management
│   └── auth.ts                # Session management
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── dev.db                 # SQLite database
└── PROJECT_CONTEXT.md         # 📖 Complete project documentation
```

## Development Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Vitest tests

# Database
npm run setup        # Install deps + generate Prisma client + migrate
npm run db:reset     # Reset database (destructive)
npx prisma generate  # Regenerate Prisma client
npx prisma migrate dev  # Create and run migrations
npx prisma studio    # Open database GUI
```

## Game Mechanics (Quick Reference)

- **Starting Currency**: $30 per player
- **Songs**: Three options (A, B, C) each round
- **Promise Phase**: All players bid simultaneously (can bid $0 to defer to Bribe Phase)
- **Bribe Phase**: Only $0 Promise bidders participate
- **Winner**: Song with highest total currency
- **Payment Rules**:
  - Promise Phase: Pay only if you backed the winner
  - Bribe Phase: Always pay regardless of outcome

## Common Issues

### "Failed to Create Game"
Check database path in `.env` points to `./prisma/dev.db`

### Server Won't Start
```bash
# Kill process on port 3000
taskkill //F //PID <pid>  # Windows
# Or find PID: netstat -ano | findstr :3000

# Restart server
npm run dev
```

### Database Issues
```bash
# Reset and regenerate
npm run db:reset
npx prisma generate
```

## Important Files

- **Game Logic**: `lib/game/bidding-logic.ts`
- **Main API**: `app/api/game/[gameId]/route.ts`
- **Bid Submission**: `app/api/game/[gameId]/bid/route.ts`
- **Database Schema**: `prisma/schema.prisma`
- **Environment**: `.env` (DATABASE_URL)

## Contributing

This is a personal project for a physical board game companion. See `PROJECT_CONTEXT.md` for detailed architecture and development guidelines.

## License

Private project - not licensed for public use.
