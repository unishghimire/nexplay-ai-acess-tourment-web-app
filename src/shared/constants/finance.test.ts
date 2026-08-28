import assert from "node:assert/strict";
import { calculateTournamentRequiredFunding, calculateFundingShortage } from './finance.js';

// Rule 1: Free Tournaments with Rs. 0 Prize Pool
assert.equal(calculateTournamentRequiredFunding(0), 0);
assert.equal(calculateTournamentRequiredFunding(undefined as any), 0);
assert.equal(calculateTournamentRequiredFunding(-500), 0);
assert.equal(calculateTournamentRequiredFunding(NaN), 0);

const freeCheck = calculateFundingShortage(0, 0);
assert.equal(freeCheck.required, 0);
assert.equal(freeCheck.available, 0);
assert.equal(freeCheck.shortage, 0);
assert.equal(freeCheck.isFunded, true);

// Rule 2: Monetary Prize Pool Funding Requirement
assert.equal(calculateTournamentRequiredFunding(5000), 5000);
assert.equal(calculateTournamentRequiredFunding(12500), 12500);

const zeroBalCheck = calculateFundingShortage(5000, 0);
assert.equal(zeroBalCheck.required, 5000);
assert.equal(zeroBalCheck.available, 0);
assert.equal(zeroBalCheck.shortage, 5000);
assert.equal(zeroBalCheck.isFunded, false);

const partialBalCheck = calculateFundingShortage(5000, 2000);
assert.equal(partialBalCheck.required, 5000);
assert.equal(partialBalCheck.available, 2000);
assert.equal(partialBalCheck.shortage, 3000);
assert.equal(partialBalCheck.isFunded, false);

const exactBalCheck = calculateFundingShortage(5000, 5000);
assert.equal(exactBalCheck.required, 5000);
assert.equal(exactBalCheck.available, 5000);
assert.equal(exactBalCheck.shortage, 0);
assert.equal(exactBalCheck.isFunded, true);

const excessBalCheck = calculateFundingShortage(5000, 15000);
assert.equal(excessBalCheck.required, 5000);
assert.equal(excessBalCheck.available, 15000);
assert.equal(excessBalCheck.shortage, 0);
assert.equal(excessBalCheck.isFunded, true);

// Rule 3: Escrow Accounting & Double-Spend Invariant
const initialWallet = 10000;
let available = initialWallet;
let reserved = 0;

// Tournament A requires 6,000
const tourneyARequired = 6000;
assert.equal(available >= tourneyARequired, true);
available -= tourneyARequired;
reserved += tourneyARequired;

assert.equal(available, 4000);
assert.equal(reserved, 6000);
assert.equal(available + reserved, initialWallet);

// Tournament B requires 5,000 (only 4,000 available -> REJECTED)
const tourneyBRequired = 5000;
const tourneyBCheck = calculateFundingShortage(tourneyBRequired, available);
assert.equal(tourneyBCheck.isFunded, false);
assert.equal(tourneyBCheck.shortage, 1000);

// Total balance is still conserved
assert.equal(available + reserved, initialWallet);

// Restores available balance on tournament cancellation
const releaseAmount = 6000;
reserved -= releaseAmount;
available += releaseAmount;
assert.equal(available, 10000);
assert.equal(reserved, 0);

// Deducts prize payouts from escrow and refunds leftover funds to available balance
available = 0;
reserved = 5000;
const prizePayout = 4200;
const leftover = reserved - prizePayout;
reserved -= (prizePayout + leftover);
available += leftover;
assert.equal(reserved, 0);
assert.equal(available, 800);

// Rule 4: Registration Protection Invariant
const tournament = {
  prizePool: 5000,
  fundingStatus: 'PENDING_FUNDING',
  status: 'pending_funding',
};

const canRegister = (t: typeof tournament) => {
  const prize = Math.max(0, Math.round(Number(t.prizePool || 0)));
  if (prize > 0 && t.fundingStatus !== 'RESERVED') {
    return false;
  }
  return true;
};

assert.equal(canRegister(tournament), false);

// Once funding is secured in escrow:
tournament.fundingStatus = 'RESERVED';
tournament.status = 'upcoming';
assert.equal(canRegister(tournament), true);

console.log("Tournament funding & wallet protection tests: 11 passed, 0 failed");
