import {
  clampBudgetToLedger,
  clampToBudget,
  computePerKillReward,
  payoutRefId,
  resolvePayouts,
  resolveScrimBudget,
  scrimEntryFeeOf,
} from './scrimSettlement';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// ── entry escrow budget ──────────────────────────────────────────────────────
const feeScrim = { entryFee: 50, requirements: { entryFee: 50 }, prizePool: 1000, collectedEntryFees: 300, lockedMoney: 300 };
assert(scrimEntryFeeOf(feeScrim) === 50, 'entry fee resolves through the requirements chain');

const feeBudget = resolveScrimBudget(feeScrim, { orgTournamentsLockedBalance: 300, orgPendingEarnings: 300 });
assert(feeBudget.budget === 300 && feeBudget.source === 'entry_escrow', 'entry-fee scrim pays from collected escrow, not the advertised pool');

const partialBudget = resolveScrimBudget({ ...feeScrim, collectedEntryFees: 300, lockedMoney: 120 }, null);
assert(partialBudget.budget === 120, 'escrow read uses the conservative min of collected vs locked');

const settledBudget = resolveScrimBudget({ ...feeScrim, payoutsReleased: 200 }, null);
assert(settledBudget.budget === 100 && settledBudget.alreadyPaid === 200, 'already-released prizes reduce the remaining budget');

// ── host escrow budget (free scrim, host-funded pool) ────────────────────────
const freeScrim = { prizePool: 500, collectedEntryFees: 0, lockedMoney: 0 };
assert(resolveScrimBudget(freeScrim, { orgTournamentsLockedBalance: 800, orgPendingEarnings: 800 }).budget === 500, 'free scrim pays up to the declared pool from host escrow');
assert(resolveScrimBudget(freeScrim, { orgTournamentsLockedBalance: 800, orgPendingEarnings: 200 }).budget === 200, 'free scrim is capped by the smaller host ledger');
assert(resolveScrimBudget(freeScrim, null).budget === 0 && resolveScrimBudget(freeScrim, null).source === 'none', 'unfunded free scrim pays nothing');

// ── per-kill reward ──────────────────────────────────────────────────────────
const killConfig = { rewardPerKill: 10, minimumKillsForReward: 3, maximumRewardPerPlayer: 100 };
assert(computePerKillReward(2, killConfig).reward === 0, 'below the minimum kill threshold pays nothing');
assert(computePerKillReward(5, killConfig).reward === 50, 'kills x rate above the threshold');
assert(computePerKillReward(20, killConfig).reward === 100, 'per-player cap clamps the bounty');
assert(computePerKillReward(20, killConfig, 60).reward === 40, 'per-player cap accounts for earlier matches');
assert(computePerKillReward(9, { rewardPerKill: 10, maximumRewardPerMatch: 50, minimumKillsForReward: 0 }).reward === 50, 'per-match cap clamps a single match');
assert(computePerKillReward(4, { rewardPerKill: 0 }).reward === 0, 'a scrim with no rate pays nothing instead of a fabricated rate');

// ── payout normalisation ─────────────────────────────────────────────────────
const placement = resolvePayouts([{ userId: 'u1', rank: 1, prize: 300 }, { userId: 'u2', rank: 2, amount: 100 }], [], {});
assert(placement.error === null && placement.payouts.length === 2, 'prize and amount are both accepted');
assert(resolvePayouts([{ userId: 'u1', rank: 1, prize: 100 }, { userId: 'u1', rank: 1, prize: 50 }], [], {}).error === 'Duplicate winner entry for u1', 'duplicate recipient+rank is rejected');
assert(resolvePayouts([{ rank: 1, prize: 100 }], [], {}).error === 'Every winner needs a userId', 'missing userId is rejected');
assert(resolvePayouts([{ userId: 'u1', rank: 0, prize: 100 }], [], {}).error === 'Invalid rank for winner u1', 'rank zero is rejected');

const kills = resolvePayouts([], [{ playerId: 'p1', kills: 5 }, { playerId: 'p1', kills: 20 }, { playerId: 'p2', kills: 1 }], killConfig);
assert(kills.error === null && kills.killLedger.length === 3, 'every submitted kill entry gets a ledger row');
assert(kills.payouts.length === 2 && kills.payouts[0].amount === 50 && kills.payouts[1].amount === 50, 'per-player cap splits the bounty across matches (50 + 50 of a 100 cap)');
assert(kills.killLedger[2].payable === false && kills.killLedger[2].reward === 0, 'sub-threshold kills are recorded but not payable');
assert(kills.killLedger[1].capped === true, 'capped bounty is flagged in the ledger');
assert(resolvePayouts([], [{ kills: 3 }], killConfig).error === 'Every kill entry needs a playerId', 'kill entry without a player is rejected');

// ── budget clamp ─────────────────────────────────────────────────────────────
const clamped = clampToBudget([
  { userId: 'a', rank: 1, amount: 400, teamId: null, label: 'a', kind: 'placement', refOrdinal: 0 },
  { userId: 'b', rank: 2, amount: 300, teamId: null, label: 'b', kind: 'placement', refOrdinal: 1 },
], 500);
assert(clamped.total === 400 && clamped.kept.length === 1 && clamped.dropped.length === 1, 'over-allocation drops the unaffordable row instead of overpaying');

// ── deterministic ids ────────────────────────────────────────────────────────
assert(payoutRefId('scrim_1', 'user-9', 'placement', 1, 0) === 'SCRIM-PAY-scrim_1-user-9-placement-1-0', 'ref id is deterministic and id-safe');
assert(payoutRefId('scrim/../../x', 'u', 'kill', 2, 1).includes('..') === false, 'path characters are stripped from ref ids');

// ── R-01 ledger clamp ────────────────────────────────────────────────────────
assert(clampBudgetToLedger(999999, 400, 0) === 400, 'inflated doc budget is clamped to the join ledger');
assert(clampBudgetToLedger(300, 400, 0) === 300, 'honest doc budget below the ledger is untouched');
assert(clampBudgetToLedger(400, 400, 150) === 250, 'already-released payouts reduce the ledger remainder');
assert(clampBudgetToLedger(500, 100, 100) === 0, 'fully released ledger leaves zero budget');
assert(clampBudgetToLedger(-5, 400, 0) === 0, 'negative doc budget stays zero');

console.log('Scrim settlement math tests: 29 passed, 0 failed');
