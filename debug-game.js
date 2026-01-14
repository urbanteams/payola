const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugGame() {
  const roomCode = 'FWKVGL';

  const game = await prisma.game.findUnique({
    where: { roomCode },
    include: {
      players: true,
      bids: {
        where: { gameRound: 1 },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!game) {
    console.log('Game not found');
    return;
  }

  console.log('=== GAME STATE ===');
  console.log('Status:', game.status);
  console.log('Round Number:', game.roundNumber);
  console.log('Player Count:', game.players.length);
  console.log('\n=== PLAYERS ===');
  game.players.forEach(p => {
    console.log(`${p.name} (${p.id})`);
  });

  console.log('\n=== BIDS ===');
  game.bids.forEach(b => {
    const player = game.players.find(p => p.id === b.playerId);
    console.log(`${player?.name || 'Unknown'}: Song ${b.song}, Amount ${b.amount}, Round ${b.round}`);
  });

  console.log('\n=== ANALYSIS ===');
  console.log('Total players:', game.players.length);
  console.log('Total bids:', game.bids.length);
  console.log('Round 1 bids:', game.bids.filter(b => b.round === 1).length);
  console.log('Round 2 bids:', game.bids.filter(b => b.round === 2).length);

  await prisma.$disconnect();
}

debugGame();
