import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSongTotals, determineWinningSong, calculateCurrencyDeductions, Song } from "@/lib/game/bidding-logic";
import { processAIBids } from "@/lib/game/ai-bidding";
import {
  deserializeInventory,
  serializeInventory,
  validateCardSelection,
  spendCards,
  calculateTotalValue,
} from "@/lib/game/card-inventory";

// Helper function to determine available songs based on game turn orders
function getAvailableSongs(game: { turnOrderA: string | null; turnOrderB: string | null; turnOrderC: string | null; turnOrderD?: string | null }): Song[] {
  const songs: Song[] = [];
  if (game.turnOrderA) songs.push("A");
  if (game.turnOrderB) songs.push("B");
  if (game.turnOrderC) songs.push("C");
  if (game.turnOrderD) songs.push("D");
  return songs;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await params;
    const body = await request.json();
    const { song, amount, cards } = body;

    // Validate input
    if (!song || !["A", "B", "C", "D"].includes(song)) {
      return NextResponse.json(
        { error: "Invalid song choice" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount < 0 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { error: "Invalid bid amount" },
        { status: 400 }
      );
    }

    // Fetch game and player
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        bids: {
          where: { gameRound: await prisma.game.findUnique({ where: { id: gameId } }).then(g => g?.roundNumber || 1) },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const player = game.players.find(p => p.id === session.playerId);
    if (!player) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    // Check if game is in valid state for bidding
    if (!["LOBBY", "ROUND1", "ROUND2"].includes(game.status)) {
      return NextResponse.json(
        { error: "Game is not accepting bids" },
        { status: 400 }
      );
    }

    // Check if this is a card-based variant (3B or 6B)
    const is3BVariant = game.gameVariant === "3B" || game.gameVariant === "4B" || game.gameVariant === "5B" || game.gameVariant === "6B";

    // Validate bid based on variant
    if (is3BVariant) {
      // 3B variant: Validate card selection
      if (!player.cardInventory) {
        return NextResponse.json(
          { error: "Player card inventory not initialized" },
          { status: 500 }
        );
      }

      const inventory = deserializeInventory(player.cardInventory);
      const selectedCards = cards || [];

      // Validate card count based on round and variant
      const totalRounds = game.totalRounds || 10;
      const isFinalRound = game.roundNumber >= totalRounds;

      let maxCards: number;
      if (isFinalRound) {
        maxCards = Infinity; // Final round: unlimited cards for all variants
      } else if (game.gameVariant === "5B") {
        // 5B variant: R1-4 = 1 card, R5-7 = 2 cards, R8 = unlimited
        maxCards = game.roundNumber <= 4 ? 1 : 2;
      } else {
        // Default (3B, 4B, 6B): R1-5 = 1 card, R6+ = 2 cards, final = unlimited
        maxCards = game.roundNumber <= 5 ? 1 : 2;
      }

      if (!isFinalRound && selectedCards.length > maxCards) {
        return NextResponse.json(
          { error: `You can only use ${maxCards} card${maxCards > 1 ? 's' : ''} per bid in round ${game.roundNumber}` },
          { status: 400 }
        );
      }

      // Validate cards are available
      const validation = validateCardSelection(inventory, selectedCards);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Invalid card selection" },
          { status: 400 }
        );
      }

      // Verify amount matches card total
      const cardTotal = calculateTotalValue(selectedCards);
      if (cardTotal !== amount) {
        return NextResponse.json(
          { error: `Card total ($${cardTotal}) does not match bid amount ($${amount})` },
          { status: 400 }
        );
      }
    } else {
      // Standard variant: Validate currency balance
      if (amount > player.currencyBalance) {
        return NextResponse.json(
          { error: "Insufficient currency" },
          { status: 400 }
        );
      }
    }

    // Determine which round we're in
    const currentRoundBids = game.bids.filter(b => b.gameRound === game.roundNumber);
    const round1Bids = currentRoundBids.filter(b => b.round === 1);
    const myRound1Bid = round1Bids.find(b => b.playerId === session.playerId);

    let biddingRound = 1;
    if (myRound1Bid && myRound1Bid.amount === 0) {
      biddingRound = 2; // This is a Round 2 bid
    }

    // Check if player already submitted a bid for this round
    const existingBid = currentRoundBids.find(
      b => b.playerId === session.playerId && b.round === biddingRound
    );

    if (existingBid) {
      return NextResponse.json(
        { error: "You have already submitted a bid for this round" },
        { status: 400 }
      );
    }

    // Create bid with cards if 3B variant
    await prisma.bid.create({
      data: {
        gameId: game.id,
        playerId: player.id,
        round: biddingRound,
        gameRound: game.roundNumber,
        song,
        amount,
        promisedCards: is3BVariant && cards ? JSON.stringify(cards) : null,
      },
    });

    // For card variants: Cards are NOT spent immediately in Round 2
    // They will be spent when results are determined (all Round 2 bids spend their cards)

    // Check if all players have submitted Round 1 bids
    const newRound1Count = round1Bids.length + (biddingRound === 1 ? 1 : 0);
    if (biddingRound === 1 && newRound1Count === game.players.length && game.status === "ROUND1") {
      // All players submitted Round 1, check if we need Round 2
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
        // No one bid 0, skip to results - determine winner and apply deductions
        const songTotals = calculateSongTotals(allBids);
        const availableSongs = getAvailableSongs(game);
        let winningSong = determineWinningSong(songTotals, undefined, availableSongs, game.gameVariant);

        // If tie (null), randomly select from tied songs
        if (winningSong === null) {
          const maxTotal = Math.max(...availableSongs.map((s: Song) => songTotals[s]));
          const tiedSongs = availableSongs.filter((s: Song) => songTotals[s] === maxTotal);
          winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
        }

        const deductions = calculateCurrencyDeductions(allBids, winningSong);

        console.log('End of Round 1 (no bribes) - Calculating deductions:', {
          songTotals,
          winningSong,
          deductions: Array.from(deductions.entries()),
        });

        // Handle card spending for 3B variant or currency deductions for standard
        if (is3BVariant) {
          // Process promise phase cards - only spend if bid on winning song
          for (const bid of allBids) {
            const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
            if (bidCards.length > 0) {
              const bidPlayer = game.players.find(p => p.id === bid.playerId);
              if (bidPlayer && bidPlayer.cardInventory) {
                const inventory = deserializeInventory(bidPlayer.cardInventory);
                if (bid.song === winningSong) {
                  // Song won: Spend the promised cards
                  const updatedInventory = spendCards(inventory, bidCards);
                  await prisma.player.update({
                    where: { id: bid.playerId },
                    data: { cardInventory: serializeInventory(updatedInventory) },
                  });
                }
                // Song lost: Cards remain in inventory (do nothing)
              }
            }
          }
        } else {
          // Standard variant: Update currency balances
          for (const [playerId, deduction] of deductions.entries()) {
            const currentPlayer = game.players.find(p => p.id === playerId);
            if (currentPlayer) {
              await prisma.player.update({
                where: { id: playerId },
                data: {
                  currencyBalance: Math.max(0, currentPlayer.currencyBalance - deduction),
                },
              });
            }
          }
        }

        await prisma.game.update({
          where: { id: game.id },
          data: {
            status: "RESULTS",
            winningSong: winningSong
          },
        });
      }
    }

    // Check if all Round 2 bids are in
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

      console.log('Bribe Phase completion check:', {
        round2BidsCount,
        zeroBiddersCount: zeroBidders.length,
        willAdvance: round2BidsCount === zeroBidders.length
      });

      if (round2BidsCount === zeroBidders.length) {
        // All Round 2 bids submitted, calculate deductions and move to results
        const allCurrentRoundBids = await prisma.bid.findMany({
          where: {
            gameId: game.id,
            gameRound: game.roundNumber
          },
        });

        // Calculate winner and deductions
        const songTotals = calculateSongTotals(allCurrentRoundBids);
        const availableSongs = getAvailableSongs(game);
        let winningSong = determineWinningSong(songTotals, undefined, availableSongs, game.gameVariant);

        // If tie (null), randomly select from tied songs
        if (winningSong === null) {
          const maxTotal = Math.max(...availableSongs.map((s: Song) => songTotals[s]));
          const tiedSongs = availableSongs.filter((s: Song) => songTotals[s] === maxTotal);
          winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
        }

        const deductions = calculateCurrencyDeductions(allCurrentRoundBids, winningSong);

        console.log('End of Bribe Phase - Calculating deductions:', {
          songTotals,
          winningSong,
          deductions: Array.from(deductions.entries()),
        });

        // Re-fetch game for 3B check
        const gameForDeductions = await prisma.game.findUnique({
          where: { id: game.id },
          include: { players: true },
        });
        const is3BForDeductions = gameForDeductions?.gameVariant === "3B" || gameForDeductions?.gameVariant === "4B" || gameForDeductions?.gameVariant === "5B" || gameForDeductions?.gameVariant === "6B";

        // Handle card spending for 3B variant or currency deductions for standard
        if (is3BForDeductions && gameForDeductions) {
          // Process promise phase cards (Round 1) - only spend if bid on winning song
          const round1BidsWithCards = allCurrentRoundBids.filter(b => b.round === 1);
          for (const bid of round1BidsWithCards) {
            const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
            if (bidCards.length > 0) {
              const bidPlayer = gameForDeductions.players.find(p => p.id === bid.playerId);
              if (bidPlayer && bidPlayer.cardInventory) {
                const inventory = deserializeInventory(bidPlayer.cardInventory);
                if (bid.song === winningSong) {
                  // Song won: Spend the promised cards
                  const updatedInventory = spendCards(inventory, bidCards);
                  await prisma.player.update({
                    where: { id: bid.playerId },
                    data: { cardInventory: serializeInventory(updatedInventory) },
                  });
                }
                // Song lost: Cards remain in inventory (do nothing)
              }
            }
          }
          // Process bribe phase cards (Round 2) - ALL Round 2 bids spend their cards
          const round2BidsWithCards = allCurrentRoundBids.filter(b => b.round === 2);
          for (const bid of round2BidsWithCards) {
            const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
            if (bidCards.length > 0) {
              const bidPlayer = gameForDeductions.players.find(p => p.id === bid.playerId);
              if (bidPlayer && bidPlayer.cardInventory) {
                const inventory = deserializeInventory(bidPlayer.cardInventory);
                // Bribe Phase: All cards are spent regardless of outcome
                const updatedInventory = spendCards(inventory, bidCards);
                await prisma.player.update({
                  where: { id: bid.playerId },
                  data: { cardInventory: serializeInventory(updatedInventory) },
                });
              }
            }
          }
        } else {
          // Standard variant: Update currency balances
          for (const [playerId, deduction] of deductions.entries()) {
            const currentPlayer = game.players.find(p => p.id === playerId);
            if (currentPlayer) {
              await prisma.player.update({
                where: { id: playerId },
                data: {
                  currencyBalance: Math.max(0, currentPlayer.currencyBalance - deduction),
                },
              });
            }
          }
        }

        // Move to results
        await prisma.game.update({
          where: { id: game.id },
          data: {
            status: "RESULTS",
            winningSong: winningSong
          },
        });
      }
    }

    // Process AI bids immediately if there are any AI players
    if (game.players.some(p => p.isAI)) {
      try {
        await processAIBids(gameId);
        console.log('AI bids processed successfully');

        // Re-fetch game to check if we need to advance state
        const updatedGame = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            players: true,
            bids: {
              where: { gameRound: game.roundNumber },
            },
          },
        });

        if (!updatedGame) {
          return NextResponse.json({ success: true });
        }

        const updatedRound1Bids = updatedGame.bids.filter(b => b.round === 1);
        const updatedRound2Bids = updatedGame.bids.filter(b => b.round === 2);

        // If we're in ROUND1 and all Round 1 bids are in, advance to ROUND2 or RESULTS
        if (updatedGame.status === "ROUND1" && updatedRound1Bids.length === updatedGame.players.length) {
          const zeroBidders = updatedRound1Bids.filter(b => b.amount === 0);

          if (zeroBidders.length > 0) {
            // Transition to ROUND2
            await prisma.game.update({
              where: { id: gameId },
              data: { status: "ROUND2" },
            });

            // Process Round 2 AI bids
            await processAIBids(gameId);

            // Re-check if all Round 2 bids are now in
            const finalRound2Count = await prisma.bid.count({
              where: { gameId, gameRound: game.roundNumber, round: 2 },
            });

            if (finalRound2Count === zeroBidders.length) {
              // All Round 2 bids are in, advance to RESULTS
              const allBids = await prisma.bid.findMany({
                where: { gameId, gameRound: game.roundNumber },
              });

              const songTotals = calculateSongTotals(allBids);
              const availableSongs = getAvailableSongs(updatedGame);
              let winningSong = determineWinningSong(songTotals, undefined, availableSongs, updatedGame.gameVariant);

              if (winningSong === null) {
                const maxTotal = Math.max(...availableSongs.map((s: Song) => songTotals[s]));
                const tiedSongs = availableSongs.filter((s: Song) => songTotals[s] === maxTotal);
                winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
              }

              const deductions = calculateCurrencyDeductions(allBids, winningSong);

              console.log('AI Round 2 complete - Calculating deductions:', {
                songTotals,
                winningSong,
                deductions: Array.from(deductions.entries()),
              });

              const is3BAI = updatedGame.gameVariant === "3B" || updatedGame.gameVariant === "4B" || updatedGame.gameVariant === "5B" || updatedGame.gameVariant === "6B";

              // Handle card spending for 3B variant or currency deductions for standard
              if (is3BAI) {
                // Process promise phase cards (Round 1) - only spend if bid on winning song
                const round1BidsWithCards = allBids.filter(b => b.round === 1);
                for (const bid of round1BidsWithCards) {
                  const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
                  if (bidCards.length > 0) {
                    const bidPlayer = updatedGame.players.find(p => p.id === bid.playerId);
                    if (bidPlayer && bidPlayer.cardInventory) {
                      const inventory = deserializeInventory(bidPlayer.cardInventory);
                      if (bid.song === winningSong) {
                        // Song won: Spend the promised cards
                        const updatedInventory = spendCards(inventory, bidCards);
                        await prisma.player.update({
                          where: { id: bid.playerId },
                          data: { cardInventory: serializeInventory(updatedInventory) },
                        });
                      }
                      // Song lost: Cards remain in inventory (do nothing)
                    }
                  }
                }
                // Process bribe phase cards (Round 2) - ALL Round 2 bids spend their cards
                const round2BidsWithCards = allBids.filter(b => b.round === 2);
                for (const bid of round2BidsWithCards) {
                  const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
                  if (bidCards.length > 0) {
                    const bidPlayer = updatedGame.players.find(p => p.id === bid.playerId);
                    if (bidPlayer && bidPlayer.cardInventory) {
                      const inventory = deserializeInventory(bidPlayer.cardInventory);
                      // Bribe Phase: All cards are spent regardless of outcome
                      const updatedInventory = spendCards(inventory, bidCards);
                      await prisma.player.update({
                        where: { id: bid.playerId },
                        data: { cardInventory: serializeInventory(updatedInventory) },
                      });
                    }
                  }
                }
              } else {
                // Standard variant: Update currency balances
                for (const [playerId, deduction] of deductions.entries()) {
                  const currentPlayer = updatedGame.players.find(p => p.id === playerId);
                  if (currentPlayer) {
                    await prisma.player.update({
                      where: { id: playerId },
                      data: {
                        currencyBalance: Math.max(0, currentPlayer.currencyBalance - deduction),
                      },
                    });
                  }
                }
              }

              await prisma.game.update({
                where: { id: gameId },
                data: {
                  status: "RESULTS",
                  winningSong: winningSong
                },
              });
            }
          } else {
            // No zero bidders, skip to RESULTS
            const songTotals = calculateSongTotals(updatedRound1Bids);
            const availableSongs = getAvailableSongs(updatedGame);
            let winningSong = determineWinningSong(songTotals, undefined, availableSongs, updatedGame.gameVariant);

            if (winningSong === null) {
              const maxTotal = Math.max(...availableSongs.map((s: Song) => songTotals[s]));
              const tiedSongs = availableSongs.filter((s: Song) => songTotals[s] === maxTotal);
              winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
            }

            const deductions = calculateCurrencyDeductions(updatedRound1Bids, winningSong);

            console.log('AI Round 1 complete (no bribes) - Calculating deductions:', {
              songTotals,
              winningSong,
              deductions: Array.from(deductions.entries()),
            });

            const is3BAI2 = updatedGame.gameVariant === "3B" || updatedGame.gameVariant === "4B" || updatedGame.gameVariant === "5B" || updatedGame.gameVariant === "6B";

            // Handle card spending for 3B variant or currency deductions for standard
            if (is3BAI2) {
              // Process promise phase cards - only spend if bid on winning song
              for (const bid of updatedRound1Bids) {
                const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
                if (bidCards.length > 0) {
                  const bidPlayer = updatedGame.players.find(p => p.id === bid.playerId);
                  if (bidPlayer && bidPlayer.cardInventory) {
                    const inventory = deserializeInventory(bidPlayer.cardInventory);
                    if (bid.song === winningSong) {
                      // Song won: Spend the promised cards
                      const updatedInventory = spendCards(inventory, bidCards);
                      await prisma.player.update({
                        where: { id: bid.playerId },
                        data: { cardInventory: serializeInventory(updatedInventory) },
                      });
                    }
                    // Song lost: Cards remain in inventory (do nothing)
                  }
                }
              }
            } else {
              // Standard variant: Update currency balances
              for (const [playerId, deduction] of deductions.entries()) {
                const currentPlayer = updatedGame.players.find(p => p.id === playerId);
                if (currentPlayer) {
                  await prisma.player.update({
                    where: { id: playerId },
                    data: {
                      currencyBalance: Math.max(0, currentPlayer.currencyBalance - deduction),
                    },
                  });
                }
              }
            }

            await prisma.game.update({
              where: { id: gameId },
              data: {
                status: "RESULTS",
                winningSong: winningSong
              },
            });
          }
        }

        // If we're in ROUND2 and all Round 2 bids are in, advance to RESULTS
        if (updatedGame.status === "ROUND2" && updatedRound2Bids.length === updatedRound1Bids.filter(b => b.amount === 0).length) {
          const allBids = updatedGame.bids;
          const songTotals = calculateSongTotals(allBids);
          const availableSongs = getAvailableSongs(updatedGame);
          let winningSong = determineWinningSong(songTotals, undefined, availableSongs, updatedGame.gameVariant);

          if (winningSong === null) {
            const maxTotal = Math.max(...availableSongs.map((s: Song) => songTotals[s]));
            const tiedSongs = availableSongs.filter((s: Song) => songTotals[s] === maxTotal);
            winningSong = tiedSongs[Math.floor(Math.random() * tiedSongs.length)];
          }

          const deductions = calculateCurrencyDeductions(allBids, winningSong);

          console.log('AI Round 2 complete - Calculating deductions:', {
            songTotals,
            winningSong,
            deductions: Array.from(deductions.entries()),
          });

          const is3BAI3 = updatedGame.gameVariant === "3B" || updatedGame.gameVariant === "4B" || updatedGame.gameVariant === "5B" || updatedGame.gameVariant === "6B";

          // Handle card spending for 3B variant or currency deductions for standard
          if (is3BAI3) {
            // Process promise phase cards (Round 1) - only spend if bid on winning song
            const round1BidsWithCards = allBids.filter(b => b.round === 1);
            for (const bid of round1BidsWithCards) {
              const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
              if (bidCards.length > 0) {
                const bidPlayer = updatedGame.players.find(p => p.id === bid.playerId);
                if (bidPlayer && bidPlayer.cardInventory) {
                  const inventory = deserializeInventory(bidPlayer.cardInventory);
                  if (bid.song === winningSong) {
                    // Song won: Spend the promised cards
                    const updatedInventory = spendCards(inventory, bidCards);
                    await prisma.player.update({
                      where: { id: bid.playerId },
                      data: { cardInventory: serializeInventory(updatedInventory) },
                    });
                  }
                  // Song lost: Cards remain in inventory (do nothing)
                }
              }
            }
            // Process bribe phase cards (Round 2) - ALL Round 2 bids spend their cards
            const round2BidsWithCards = allBids.filter(b => b.round === 2);
            for (const bid of round2BidsWithCards) {
              const bidCards = bid.promisedCards ? JSON.parse(bid.promisedCards) : [];
              if (bidCards.length > 0) {
                const bidPlayer = updatedGame.players.find(p => p.id === bid.playerId);
                if (bidPlayer && bidPlayer.cardInventory) {
                  const inventory = deserializeInventory(bidPlayer.cardInventory);
                  // Bribe Phase: All cards are spent regardless of outcome
                  const updatedInventory = spendCards(inventory, bidCards);
                  await prisma.player.update({
                    where: { id: bid.playerId },
                    data: { cardInventory: serializeInventory(updatedInventory) },
                  });
                }
              }
            }
          } else {
            // Standard variant: Update currency balances
            for (const [playerId, deduction] of deductions.entries()) {
              const currentPlayer = updatedGame.players.find(p => p.id === playerId);
              if (currentPlayer) {
                await prisma.player.update({
                  where: { id: playerId },
                  data: {
                    currencyBalance: Math.max(0, currentPlayer.currencyBalance - deduction),
                  },
                });
              }
            }
          }

          await prisma.game.update({
            where: { id: gameId },
            data: {
              status: "RESULTS",
              winningSong: winningSong
            },
          });
        }
      } catch (err) {
        console.error('Failed to process AI bids:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit bid error:", error);
    return NextResponse.json(
      { error: "Failed to submit bid" },
      { status: 500 }
    );
  }
}
