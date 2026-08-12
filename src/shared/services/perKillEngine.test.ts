// ═══════════════════════════════════════════════════════════════
// PER-KILL ENGINE — SELF-CHECK
// ponytail: one runnable check, no frameworks. Run with: npx tsx src/shared/services/perKillEngine.test.ts
// Tests the acceptance scenarios from the spec:
//   - Solo Per-Kill: 12 kills × NPR 10 = NPR 120
//   - Duo Per-Kill: Player A (7×10=70), Player B (3×10=30), Team=100
//   - Squad Per-Kill: A(8×10=80), B(5×10=50), C(2×10=20), D(1×10=10), Team=160
//   - Validation: reject -1, 1.5, null, string
//   - Idempotency: re-verify same kills = same reward
// ═══════════════════════════════════════════════════════════════

import {
    validateKills,
    calculatePlayerReward,
    createKillRewardEntry,
    verifyKillReward,
    aggregateTeamRewards,
    buildPerKillLeaderboard,
    buildPerKillSummary,
    rewardIdempotencyKey,
    buildFinancialBreakdown,
} from './perKillEngine';
import { PlayerKillReward } from '../types/per-kill';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
    if (cond) { passed++; console.log(`  ✓ ${msg}`); }
    else { failed++; console.error(`  ✗ ${msg}`); }
}

// ── Validation tests ──
console.log('\nValidation:');
assert(validateKills(0).valid, '0 kills is valid');
assert(validateKills(7).valid, '7 kills is valid');
assert(!validateKills(-1).valid, '-1 rejected');
assert(!validateKills(1.5).valid, '1.5 rejected');
assert(!validateKills(null).valid, 'null rejected');
assert(!validateKills('abc' as any).valid, '"abc" rejected');
assert(validateKills(100).valid, '100 kills is valid');

// ── Solo per-kill: 12 kills × NPR 10 = NPR 120 ──
console.log('\nSolo Per-Kill:');
const soloReward = calculatePlayerReward({
    verifiedKills: 12,
    rewardPerKill: 10,
    minimumKillsForReward: 0,
});
assert(soloReward.rewardAmount === 120, '12 kills × NPR 10 = NPR 120');

// ── Duo per-kill: A(7×10=70), B(3×10=30), Team=100 ──
console.log('\nDuo Per-Kill:');
const duoA = calculatePlayerReward({ verifiedKills: 7, rewardPerKill: 10, minimumKillsForReward: 0 });
const duoB = calculatePlayerReward({ verifiedKills: 3, rewardPerKill: 10, minimumKillsForReward: 0 });
assert(duoA.rewardAmount === 70, 'Player A: 7 × 10 = 70');
assert(duoB.rewardAmount === 30, 'Player B: 3 × 10 = 30');
assert(duoA.rewardAmount + duoB.rewardAmount === 100, 'Team total: 100');

// ── Squad per-kill: A(8×10=80), B(5×10=50), C(2×10=20), D(1×10=10), Team=160 ──
console.log('\nSquad Per-Kill:');
const sqA = calculatePlayerReward({ verifiedKills: 8, rewardPerKill: 10, minimumKillsForReward: 0 });
const sqB = calculatePlayerReward({ verifiedKills: 5, rewardPerKill: 10, minimumKillsForReward: 0 });
const sqC = calculatePlayerReward({ verifiedKills: 2, rewardPerKill: 10, minimumKillsForReward: 0 });
const sqD = calculatePlayerReward({ verifiedKills: 1, rewardPerKill: 10, minimumKillsForReward: 0 });
assert(sqA.rewardAmount === 80, 'Player A: 8 × 10 = 80');
assert(sqB.rewardAmount === 50, 'Player B: 5 × 10 = 50');
assert(sqC.rewardAmount === 20, 'Player C: 2 × 10 = 20');
assert(sqD.rewardAmount === 10, 'Player D: 1 × 10 = 10');
assert(sqA.rewardAmount + sqB.rewardAmount + sqC.rewardAmount + sqD.rewardAmount === 160, 'Team total: 160');

// ── Zero kills = zero reward ──
console.log('\nZero kills:');
const zeroReward = calculatePlayerReward({ verifiedKills: 0, rewardPerKill: 10, minimumKillsForReward: 0 });
assert(zeroReward.rewardAmount === 0, '0 kills = NPR 0');

// ── Minimum kills threshold ──
console.log('\nMinimum kills threshold:');
const minPass = calculatePlayerReward({ verifiedKills: 1, rewardPerKill: 10, minimumKillsForReward: 1 });
const minFail = calculatePlayerReward({ verifiedKills: 0, rewardPerKill: 10, minimumKillsForReward: 1 });
assert(minPass.rewardAmount === 10, '1 kill with minKills=1 → 10');
assert(minFail.rewardAmount === 0, '0 kills with minKills=1 → 0');

// ── Per-match cap ──
console.log('\nPer-match cap:');
const capped = calculatePlayerReward({ verifiedKills: 100, rewardPerKill: 10, minimumKillsForReward: 0, maximumRewardPerMatch: 500 });
assert(capped.rewardAmount === 500, '100 kills capped at 500');
assert(capped.capped, 'capped flag true');

// ── Per-player-per-tournament cap ──
console.log('\nPer-player-per-tournament cap:');
const pCap = calculatePlayerReward({
    verifiedKills: 100, rewardPerKill: 10, minimumKillsForReward: 0,
    maximumRewardPerPlayer: 5000, currentTournamentReward: 4950,
});
assert(pCap.rewardAmount === 50, '1000 reward but only 50 remaining under 5000 cap');
assert(pCap.capped, 'tournament cap flag true');

// ── Idempotency key ──
console.log('\nIdempotency:');
const key1 = rewardIdempotencyKey('t1', 'm1', 'p1');
const key2 = rewardIdempotencyKey('t1', 'm1', 'p1');
assert(key1 === key2, 'same params = same key');
const key3 = rewardIdempotencyKey('t1', 'm2', 'p1');
assert(key1 !== key3, 'different match = different key');

// ── Kill reward entry lifecycle ──
console.log('\nEntry lifecycle:');
const entry = createKillRewardEntry({
    tournamentId: 't1', groupId: 'g1', matchId: 'm1',
    teamId: 'team1', playerId: 'p1', playerName: 'Player A',
    submittedKills: 7, rewardPerKill: 10, currency: 'NPR', minimumKillsForReward: 0,
});
assert(entry.killStatus === 'submitted', 'new entry starts as submitted');
assert(entry.rewardStatus === 'pending_verification', 'new entry pending verification');
assert(entry.verifiedKills === 0, 'verifiedKills starts at 0');
assert(entry.rewardAmount === 0, 'rewardAmount starts at 0 (unverified)');

// Verify it
const verified = verifyKillReward({ entry, verifiedBy: 'admin1', minimumKillsForReward: 0 });
assert(verified.killStatus === 'verified', 'after verify: status = verified');
assert(verified.verifiedKills === 7, 'verifiedKills = 7');
assert(verified.rewardAmount === 70, 'rewardAmount = 70');
assert(verified.rewardStatus === 'verified', 'rewardStatus = verified');

// Re-verify with same kills (idempotent)
const reVerified = verifyKillReward({ entry: verified, verifiedBy: 'admin1', minimumKillsForReward: 0 });
assert(reVerified.verifiedKills === 7, 're-verify: same kills');
assert(reVerified.rewardAmount === 70, 're-verify: same reward (no duplication)');

// Verify with adjusted kills (correction)
const corrected = verifyKillReward({ entry: verified, verifiedKills: 8, verifiedBy: 'admin1', minimumKillsForReward: 0 });
assert(corrected.verifiedKills === 8, 'correction: verifiedKills = 8');
assert(corrected.rewardAmount === 80, 'correction: rewardAmount = 80');

// ── Team aggregation ──
console.log('\nTeam aggregation:');
const mockEntries: PlayerKillReward[] = [
    { ...verified, teamId: 'alpha', playerId: 'pA', playerName: 'Player A', verifiedKills: 8, rewardAmount: 80 },
    { ...verified, teamId: 'alpha', playerId: 'pB', playerName: 'Player B', verifiedKills: 5, rewardAmount: 50 },
    { ...verified, teamId: 'alpha', playerId: 'pC', playerName: 'Player C', verifiedKills: 2, rewardAmount: 20 },
    { ...verified, teamId: 'alpha', playerId: 'pD', playerName: 'Player D', verifiedKills: 1, rewardAmount: 10 },
    { ...verified, teamId: 'bravo', playerId: 'pE', playerName: 'Player E', verifiedKills: 10, rewardAmount: 100 },
];
const teamSummaries = aggregateTeamRewards({ killRewards: mockEntries });
assert(teamSummaries.length === 2, '2 teams');
assert(teamSummaries[0].teamId === 'alpha', 'alpha has more kills (16)');
assert(teamSummaries[0].totalKills === 16, 'alpha total kills = 16');
assert(teamSummaries[0].totalReward === 160, 'alpha total reward = 160');
assert(teamSummaries[0].playerBreakdown.length === 4, 'alpha has 4 players');
assert(teamSummaries[1].totalKills === 10, 'bravo total kills = 10');
assert(teamSummaries[1].totalReward === 100, 'bravo total reward = 100');

// ── Leaderboard ──
console.log('\nLeaderboard:');
const leaderboard = buildPerKillLeaderboard({ killRewards: mockEntries });
assert(leaderboard[0].rank === 1, 'rank 1 exists');
assert(leaderboard[0].kills === 10, 'top killer has 10 kills');
assert(leaderboard[1].kills === 8, 'second has 8 kills');
assert(leaderboard.length === 5, '5 players on leaderboard');

// ── Financial breakdown ──
console.log('\nFinancial breakdown:');
const breakdown = buildFinancialBreakdown({ killRewards: mockEntries });
assert(breakdown.verified === 260, 'verified total = 260');
assert(breakdown.pendingApproval === 0, 'no pending');
assert(breakdown.paid === 0, 'no paid');

// ── Tournament summary ──
console.log('\nTournament summary:');
const summary = buildPerKillSummary({ killRewards: mockEntries, totalParticipants: 5, totalMatches: 1 });
assert(summary.totalVerifiedKills === 26, 'total verified kills = 26');
assert(summary.totalRewardsGenerated === 260, 'total rewards = 260');
assert(summary.topKiller?.playerName === 'Player E', 'top killer = Player E');
assert(summary.topTeam?.teamId === 'alpha', 'top team = alpha');

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
