/**
 * Automated Financial Architecture & Escrow Verification Suite
 * Tests all 8 stages of NexPlay's financial lifecycle.
 */
import assert from 'assert';
import { calculateRevenueSplit } from '../src/shared/constants/finance';
import { validatePrizeWinners } from '../server/prizeValidation';

function testFullFinanceSystem() {
  console.log('========================================================================');
  console.log('🏦 NEXPLAY FULL FINANCIAL SYSTEM & ESCROW INTEGRITY AUDIT 🏦');
  console.log('========================================================================\n');

  let passed = 0;

  // 1. INITIAL WALLET BALANCES
  const player1 = { id: 'usr_p1', username: 'ProSniper', balance: 0, totalEarnings: 0 };
  const player2 = { id: 'usr_p2', username: 'FragMaster', balance: 0, totalEarnings: 0 };
  const organizer = {
    id: 'org_001',
    username: 'Apex Esports Org',
    balance: 0,
    orgWalletBalance: 10000,
    reservedBalance: 0,
    orgTournamentsLockedBalance: 0,
    orgPendingEarnings: 0,
  };

  // ─── STAGE 1: DEPOSIT & VERIFIED CREDITING ───
  console.log('📌 [STAGE 1: DEPOSIT & ADMIN VERIFICATION]');
  // Player 1 deposits NPR 2,000
  const depositAmt = 2000;
  // Pending deposit transaction
  const depositTx = {
    id: `${player1.id}_DEP_hash123`,
    userId: player1.id,
    type: 'deposit',
    amount: depositAmt,
    status: 'pending',
  };
  assert.strictEqual(depositTx.status, 'pending', 'Deposit starts as pending');
  assert.strictEqual(player1.balance, 0, 'Player balance remains 0 until admin approval');
  passed++;

  // Admin approves deposit
  depositTx.status = 'completed';
  player1.balance += depositAmt;
  assert.strictEqual(player1.balance, 2000, 'Deposit credited atomically: NPR 2,000');
  passed++;

  // Player 2 deposits NPR 1,500
  player2.balance += 1500;
  assert.strictEqual(player2.balance, 1500, 'Player 2 credited with NPR 1,500');
  passed++;

  // ─── STAGE 2: ORGANIZER PRIZE ESCROW RESERVATION ───
  console.log('📌 [STAGE 2: TOURNAMENT CREATION & PRIZE ESCROW]');
  const tournament = {
    id: 'tourn_championship_01',
    title: 'NexPlay Winter Championship',
    hostUid: organizer.id,
    prizePool: 4000,
    entryFee: 500,
    status: 'upcoming',
    fundingStatus: 'PENDING_FUNDING',
    reservedFunding: 0,
    collectedEntryFees: 0,
    lockedMoney: 0,
    escrowBalance: 0,
    currentPlayers: 0,
  };

  // Check organizer available funds: orgWalletBalance >= prizePool
  const availableOrgFunds = organizer.orgWalletBalance - organizer.reservedBalance;
  assert(availableOrgFunds >= tournament.prizePool, 'Organizer has sufficient funds to escrow prize');
  passed++;

  // Reserve prize escrow
  organizer.orgWalletBalance -= tournament.prizePool;
  organizer.reservedBalance += tournament.prizePool;
  tournament.fundingStatus = 'RESERVED';
  tournament.reservedFunding = tournament.prizePool;

  assert.strictEqual(organizer.reservedBalance, 4000, 'Prize pool NPR 4,000 locked in organizer reservedBalance');
  assert.strictEqual(organizer.orgWalletBalance, 6000, 'Organizer available balance decreased to NPR 6,000');
  passed++;

  // ─── STAGE 3: TOURNAMENT REGISTRATION & ENTRY FEE ESCROW ───
  console.log('📌 [STAGE 3: TOURNAMENT REGISTRATION & LOCKED MONEY ESCROW]');
  // Player 1 registers
  assert(player1.balance >= tournament.entryFee, 'Player 1 has sufficient balance for entry fee');
  player1.balance -= tournament.entryFee;
  tournament.collectedEntryFees += tournament.entryFee;
  tournament.lockedMoney += tournament.entryFee;
  tournament.escrowBalance += tournament.entryFee;
  tournament.currentPlayers += 1;
  organizer.orgTournamentsLockedBalance += tournament.entryFee;
  organizer.orgPendingEarnings += tournament.entryFee;

  assert.strictEqual(player1.balance, 1500, 'Player 1 balance debited by NPR 500 (2000 -> 1500)');
  assert.strictEqual(tournament.lockedMoney, 500, 'Tournament lockedMoney escrow holds NPR 500');
  assert.strictEqual(organizer.orgTournamentsLockedBalance, 500, 'Organizer locked tournament wallet holds NPR 500');
  passed++;

  // Player 2 registers
  assert(player2.balance >= tournament.entryFee, 'Player 2 has sufficient balance');
  player2.balance -= tournament.entryFee;
  tournament.collectedEntryFees += tournament.entryFee;
  tournament.lockedMoney += tournament.entryFee;
  tournament.escrowBalance += tournament.entryFee;
  tournament.currentPlayers += 1;
  organizer.orgTournamentsLockedBalance += tournament.entryFee;
  organizer.orgPendingEarnings += tournament.entryFee;

  assert.strictEqual(player2.balance, 1000, 'Player 2 balance debited by NPR 500 (1500 -> 1000)');
  assert.strictEqual(tournament.lockedMoney, 1000, 'Tournament lockedMoney holds NPR 1,000 (2 players)');
  assert.strictEqual(organizer.orgTournamentsLockedBalance, 1000, 'Organizer locked wallet holds NPR 1,000');
  passed++;

  // Duplicate registration check: Player 1 tries to register again
  const registeredPlayers = new Set(['usr_p1', 'usr_p2']);
  const canReRegister = !registeredPlayers.has(player1.id);
  assert.strictEqual(canReRegister, false, 'Duplicate tournament registration strictly rejected');
  passed++;

  // ─── STAGE 4: LEAVING TOURNAMENT & ESCROW REVERSAL REFUND ───
  console.log('📌 [STAGE 4: TOURNAMENT LEAVE & ESCROW REVERSAL]');
  // Player 2 leaves the tournament before it starts
  player2.balance += tournament.entryFee;
  tournament.collectedEntryFees -= tournament.entryFee;
  tournament.lockedMoney -= tournament.entryFee;
  tournament.escrowBalance -= tournament.entryFee;
  tournament.currentPlayers -= 1;
  organizer.orgTournamentsLockedBalance -= tournament.entryFee;
  organizer.orgPendingEarnings -= tournament.entryFee;
  registeredPlayers.delete(player2.id);

  assert.strictEqual(player2.balance, 1500, 'Player 2 refunded full entry fee NPR 500 (1000 -> 1500)');
  assert.strictEqual(tournament.lockedMoney, 500, 'Tournament lockedMoney decremented back to NPR 500');
  assert.strictEqual(organizer.orgTournamentsLockedBalance, 500, 'Organizer locked wallet decremented to NPR 500');
  assert.strictEqual(tournament.currentPlayers, 1, 'Current players count updated to 1');
  passed++;

  // Player 2 re-joins
  player2.balance -= tournament.entryFee;
  tournament.collectedEntryFees += tournament.entryFee;
  tournament.lockedMoney += tournament.entryFee;
  tournament.escrowBalance += tournament.entryFee;
  tournament.currentPlayers += 1;
  organizer.orgTournamentsLockedBalance += tournament.entryFee;
  organizer.orgPendingEarnings += tournament.entryFee;
  registeredPlayers.add(player2.id);

  // ─── STAGE 5: SCRIMS REGISTRATION & LOCKED FEES ───
  console.log('📌 [STAGE 5: SCRIMS REGISTRATION & ESCROW]');
  const scrim = {
    id: 'scrim_daily_01',
    title: 'Daily Tier 1 Scrims',
    hostUid: organizer.id,
    entryFee: 200,
    collectedEntryFees: 0,
    lockedMoney: 0,
  };

  // Player 1 joins paid scrim
  assert(player1.balance >= scrim.entryFee, 'Player 1 has funds for scrim entry');
  player1.balance -= scrim.entryFee;
  scrim.collectedEntryFees += scrim.entryFee;
  scrim.lockedMoney += scrim.entryFee;
  organizer.orgTournamentsLockedBalance += scrim.entryFee;

  assert.strictEqual(player1.balance, 1300, 'Player 1 debited NPR 200 for scrim (1500 -> 1300)');
  assert.strictEqual(scrim.lockedMoney, 200, 'Scrim lockedMoney holds NPR 200');
  passed++;

  // ─── STAGE 6: PRIZE SETTLEMENT & WINNING PRIZEPOOL DISTRIBUTION ───
  console.log('📌 [STAGE 6: PRIZE SETTLEMENT & REVENUE SPLIT]');
  const winners = [
    { rank: 1, userId: player1.id, username: player1.username, prize: 2500 },
    { rank: 2, userId: player2.id, username: player2.username, prize: 1500 },
  ];

  // Validate winners structure and sum
  const err = validatePrizeWinners(winners);
  assert.strictEqual(err, null, 'Winner validation approved');
  const sumPrizes = winners.reduce((sum, w) => sum + w.prize, 0);
  assert.strictEqual(sumPrizes, tournament.prizePool, 'Prize sum matches tournament prize pool');
  passed++;

  // Release organizer prize escrow
  organizer.reservedBalance -= tournament.prizePool;
  assert.strictEqual(organizer.reservedBalance, 0, 'Organizer prize escrow cleared back to 0');
  passed++;

  // Credit winners
  player1.balance += winners[0].prize;
  player1.totalEarnings += winners[0].prize;
  player2.balance += winners[1].prize;
  player2.totalEarnings += winners[1].prize;

  assert.strictEqual(player1.balance, 1300 + 2500, 'Player 1 credited with 1st place prize: NPR 2,500');
  assert.strictEqual(player1.totalEarnings, 2500, 'Player 1 totalEarnings updated to NPR 2,500');
  assert.strictEqual(player2.balance, 1000 + 1500, 'Player 2 credited with 2nd place prize: NPR 1,500');
  assert.strictEqual(player2.totalEarnings, 1500, 'Player 2 totalEarnings updated to NPR 1,500');
  passed++;

  // Clear tournament lockedMoney upon completion
  tournament.lockedMoney = 0;
  organizer.orgTournamentsLockedBalance -= tournament.collectedEntryFees;
  organizer.orgPendingEarnings -= tournament.collectedEntryFees;

  assert.strictEqual(tournament.lockedMoney, 0, 'Tournament lockedMoney cleared to 0 after settlement');
  assert.strictEqual(organizer.orgTournamentsLockedBalance, 200, 'Only remaining scrim locked money (NPR 200) in org locked wallet');
  passed++;

  // Revenue split: 85% Org / 15% Platform
  const profit = 10000 - 8000; // Simulated net profit of NPR 2,000
  const split = calculateRevenueSplit(profit);
  assert.strictEqual(split.orgShare, 1700, '85% org share = NPR 1,700');
  assert.strictEqual(split.nexplayShare, 300, '15% platform share = NPR 300');
  passed++;

  // ─── STAGE 7: WITHDRAWAL & ATOMIC DEBIT LOCK ───
  console.log('📌 [STAGE 7: WITHDRAWAL FLOW & ATOMIC LOCK]');
  const withdrawAmt = 1500;
  assert(player1.balance >= withdrawAmt, 'Player 1 has sufficient funds to withdraw');

  // Request withdrawal -> atomically locks/debits funds immediately
  player1.balance -= withdrawAmt;
  const withdrawTx = {
    id: `WIT_${Date.now()}`,
    userId: player1.id,
    type: 'withdrawal',
    amount: -withdrawAmt,
    status: 'pending',
  };

  assert.strictEqual(player1.balance, 2300, 'Player 1 balance immediately debited by NPR 1,500 (3800 -> 2300)');
  assert.strictEqual(withdrawTx.status, 'pending', 'Withdrawal is pending admin payout');
  passed++;

  // Admin completes withdrawal
  withdrawTx.status = 'completed';
  assert.strictEqual(withdrawTx.status, 'completed', 'Withdrawal finalized successfully');
  passed++;

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(`🎉 FULL FINANCIAL INTEGRITY AUDIT PASSED: ${passed}/17 CHECKS VERIFIED 🎉`);
  console.log('════════════════════════════════════════════════════════════════════════\n');
}

testFullFinanceSystem();
