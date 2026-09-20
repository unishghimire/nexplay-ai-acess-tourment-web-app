/**
 * Level System Unit Tests
 * Tests the 100-level progression system: calculateLevel, getXPForNextLevel,
 * getLevelProgress, getCurrentSeasonId, formatSeasonLabel,
 * calculateDepositXP, calculateWithdrawalXP, applyExpWithSeasonCheck.
 *
 * Run with: npx tsx src/shared/services/levelSystem.test.ts
 */

import {
    calculateLevel,
    getXPForNextLevel,
    getLevelProgress,
    getCurrentSeasonId,
    formatSeasonLabel,
    calculateDepositXP,
    calculateWithdrawalXP,
    applyExpWithSeasonCheck,
    MAX_LEVEL,
    MAX_LEVEL_XP
} from '../utils/utils.js';

let passed = 0;
let failed = 0;

function assert(label: string, actual: unknown, expected: unknown): void {
    if (actual === expected) {
        passed++;
    } else {
        failed++;
        console.error(`  ✗ FAIL: ${label}\n    Expected: ${expected}\n    Actual:   ${actual}`);
    }
}

function assertClose(label: string, actual: number, expected: number, tolerance: number = 0.5): void {
    if (Math.abs(actual - expected) <= tolerance) {
        passed++;
    } else {
        failed++;
        console.error(`  ✗ FAIL: ${label}\n    Expected: ~${expected}\n    Actual:   ${actual}`);
    }
}

// ── Constants ──
console.log('\n── Constants ──');
assert('MAX_LEVEL is 100', MAX_LEVEL, 100);
assert('MAX_LEVEL_XP is 20100', MAX_LEVEL_XP, 20100);

// ── calculateLevel ──
console.log('\n── calculateLevel ──');
assert('0 XP → Level 1', calculateLevel(0), 1);
assert('100 XP → Level 1', calculateLevel(100), 1);
assert('299 XP → Level 1', calculateLevel(299), 1);
assert('300 XP → Level 2', calculateLevel(300), 2);
assert('499 XP → Level 2', calculateLevel(499), 2);
assert('500 XP → Level 3', calculateLevel(500), 3);
assert('700 XP → Level 4', calculateLevel(700), 4);
assert('900 XP → Level 5', calculateLevel(900), 5);
assert('1100 XP → Level 6', calculateLevel(1100), 6);
assert('2100 XP → Level 11', calculateLevel(2100), 11);
assert('4100 XP → Level 21', calculateLevel(4100), 21);
assert('10100 XP → Level 51', calculateLevel(10100), 51);
assert('19900 XP → Level 100', calculateLevel(19900), 100);
assert('20100 XP → Level 100', calculateLevel(20100), 100);
assert('50000 XP → Level 100 (capped)', calculateLevel(50000), 100);
assert('Negative XP → Level 1', calculateLevel(-500), 1);
assert('NaN defaults → Level 1', calculateLevel(NaN), 1);
assert('undefined defaults → Level 1', calculateLevel(undefined as unknown as number), 1);

// ── getXPForNextLevel ──
console.log('\n── getXPForNextLevel ──');
assert('Level 1 target = 300', getXPForNextLevel(1), 300);
assert('Level 2 target = 500', getXPForNextLevel(2), 500);
assert('Level 3 target = 700', getXPForNextLevel(3), 700);
assert('Level 10 target = 2100', getXPForNextLevel(10), 2100);
assert('Level 50 target = 10100', getXPForNextLevel(50), 10100);
assert('Level 99 target = 19900', getXPForNextLevel(99), 19900);
assert('Level 100 target = 20100 (MAX)', getXPForNextLevel(100), 20100);
assert('Level 200 target = 20100 (capped)', getXPForNextLevel(200), 20100);

// ── getLevelProgress ──
console.log('\n── getLevelProgress ──');
assertClose('0 XP → 0% progress', getLevelProgress(0), 0);
assertClose('150 XP → 50% of Level 1', getLevelProgress(150), 50);
assertClose('300 XP → 0% of Level 2', getLevelProgress(300), 0);
assertClose('400 XP → 50% of Level 2', getLevelProgress(400), 50);
assertClose('20100+ XP → 100% progress', getLevelProgress(25000), 100);

// ── getCurrentSeasonId ──
console.log('\n── getCurrentSeasonId ──');
assert('January → S1', getCurrentSeasonId(new Date(Date.UTC(2026, 0, 15))), '2026_S1');
assert('March → S1', getCurrentSeasonId(new Date(Date.UTC(2026, 2, 1))), '2026_S1');
assert('May → S1', getCurrentSeasonId(new Date(Date.UTC(2026, 4, 30))), '2026_S1');
assert('June → S1', getCurrentSeasonId(new Date(Date.UTC(2026, 5, 15))), '2026_S1');
assert('July → S2', getCurrentSeasonId(new Date(Date.UTC(2026, 6, 1))), '2026_S2');
assert('October → S2', getCurrentSeasonId(new Date(Date.UTC(2026, 9, 15))), '2026_S2');
assert('December → S2', getCurrentSeasonId(new Date(Date.UTC(2026, 11, 31))), '2026_S2');

// ── formatSeasonLabel ──
console.log('\n── formatSeasonLabel ──');
assert('2026_S1 → "2026 Season 1"', formatSeasonLabel('2026_S1'), '2026 Season 1');
assert('2026_S2 → "2026 Season 2"', formatSeasonLabel('2026_S2'), '2026 Season 2');
assert('undefined → "Season 1"', formatSeasonLabel(undefined), 'Season 1');
assert('empty string → "Season 1"', formatSeasonLabel(''), 'Season 1');
assert('junk → passthrough', formatSeasonLabel('random_text'), 'random_text');

// ── calculateDepositXP ──
console.log('\n── calculateDepositXP ──');
assert('Rs. 100 → 100 XP', calculateDepositXP(100), 100);
assert('Rs. 250 → 200 XP', calculateDepositXP(250), 200);
assert('Rs. 1000 → 1000 XP', calculateDepositXP(1000), 1000);
assert('Rs. 0 → 0 XP', calculateDepositXP(0), 0);
assert('Rs. 50 → 0 XP', calculateDepositXP(50), 0);
assert('Rs. 1050 → 1000 XP', calculateDepositXP(1050), 1000);
assert('Negative → 0 XP', calculateDepositXP(-500), 0);

// ── calculateWithdrawalXP ──
console.log('\n── calculateWithdrawalXP ──');
assert('Rs. 1000 → 500 XP', calculateWithdrawalXP(1000), 500);
assert('Rs. 2500 → 1000 XP', calculateWithdrawalXP(2500), 1000);
assert('Rs. 999 → 0 XP', calculateWithdrawalXP(999), 0);
assert('Rs. 0 → 0 XP', calculateWithdrawalXP(0), 0);
assert('Negative → 0 XP', calculateWithdrawalXP(-1000), 0);

// ── applyExpWithSeasonCheck ──
console.log('\n── applyExpWithSeasonCheck ──');

// Normal: same season, xp accumulates
const sameSeasonResult = applyExpWithSeasonCheck(
    { xp: 200, level: 1, seasonId: '2026_S2' },
    100,
    new Date(Date.UTC(2026, 7, 15)) // August = S2
);
assert('Same season: newXP = 300', sameSeasonResult.newXP, 300);
assert('Same season: newLevel = 2', sameSeasonResult.newLevel, 2);
assert('Same season: seasonId = 2026_S2', sameSeasonResult.seasonId, '2026_S2');
assert('Same season: no previousSeasonStats', sameSeasonResult.previousSeasonStats, undefined);

// Season reset: old season → new season
const resetResult = applyExpWithSeasonCheck(
    { xp: 5000, level: 25, seasonId: '2025_S2' },
    50,
    new Date(Date.UTC(2026, 1, 15)) // February 2026 = S1
);
assert('Reset: newXP = 50 (reset)', resetResult.newXP, 50);
assert('Reset: newLevel = 1', resetResult.newLevel, 1);
assert('Reset: seasonId = 2026_S1', resetResult.seasonId, '2026_S1');
assert('Reset: previous seasonId = 2025_S2', resetResult.previousSeasonStats?.seasonId, '2025_S2');
assert('Reset: previous finalLevel = 25', resetResult.previousSeasonStats?.finalLevel, 25);
assert('Reset: previous finalXP = 5000', resetResult.previousSeasonStats?.finalXP, 5000);

// No season set (new entity)
const noSeasonResult = applyExpWithSeasonCheck(
    { xp: 0 },
    50,
    new Date(Date.UTC(2026, 7, 15))
);
assert('No season: newXP = 50', noSeasonResult.newXP, 50);
assert('No season: newLevel = 1', noSeasonResult.newLevel, 1);
assert('No season: seasonId = 2026_S2', noSeasonResult.seasonId, '2026_S2');

// Cap at Level 100
const capResult = applyExpWithSeasonCheck(
    { xp: 20000, level: 100, seasonId: '2026_S2' },
    500,
    new Date(Date.UTC(2026, 7, 15))
);
assert('Cap: newXP = 20500', capResult.newXP, 20500);
assert('Cap: newLevel = 100 (capped)', capResult.newLevel, 100);

// ── Comprehensive Level Boundary Check ──
console.log('\n── Level Boundary Check (Spot checks) ──');
// Verify the formula: Threshold(L) = 100 + L * 200
for (const lvl of [1, 10, 25, 50, 75, 99, 100]) {
    const threshold = 100 + lvl * 200;
    if (lvl === 1) {
        assert(`Level 1: xp=${threshold} is Level 2`, calculateLevel(threshold), 2);
    } else if (lvl < 100) {
        assert(`Level ${lvl}: xp=${threshold} is Level ${lvl + 1}`, calculateLevel(threshold), lvl + 1);
        assert(`Level ${lvl}: xp=${threshold - 1} is Level ${lvl}`, calculateLevel(threshold - 1), lvl);
    } else {
        assert(`Level 100: xp=${threshold} is Level 100 (max)`, calculateLevel(threshold), 100);
    }
}

// ── Organization Level & Hosting Rewards ──
console.log('\n── Organization Level & Hosting Rewards ──');

// Organizer completing 1 tournament (+150 EXP)
const orgTourney1 = applyExpWithSeasonCheck(
    { xp: 0, level: 1, seasonId: '2026_S2' },
    150,
    new Date(Date.UTC(2026, 7, 15))
);
assert('Org 1st tournament: newXP = 150', orgTourney1.newXP, 150);
assert('Org 1st tournament: level = 1', orgTourney1.newLevel, 1);

// Organizer completing 2nd tournament (+150 EXP) -> 300 EXP = Level 2!
const orgTourney2 = applyExpWithSeasonCheck(
    { xp: orgTourney1.newXP, level: orgTourney1.newLevel, seasonId: orgTourney1.seasonId },
    150,
    new Date(Date.UTC(2026, 7, 15))
);
assert('Org 2nd tournament: newXP = 300', orgTourney2.newXP, 300);
assert('Org 2nd tournament: level = 2 (Level up!)', orgTourney2.newLevel, 2);

// Organizer completing 1 scrim (+100 EXP)
const orgScrim1 = applyExpWithSeasonCheck(
    { xp: orgTourney2.newXP, level: orgTourney2.newLevel, seasonId: orgTourney2.seasonId },
    100,
    new Date(Date.UTC(2026, 7, 15))
);
assert('Org 1st scrim: newXP = 400', orgScrim1.newXP, 400);
assert('Org 1st scrim: level = 2', orgScrim1.newLevel, 2);

// Organization seasonal rollover
const orgSeasonRollover = applyExpWithSeasonCheck(
    { xp: 4500, level: 23, seasonId: '2026_S1' },
    150,
    new Date(Date.UTC(2026, 8, 1)) // September 2026 = S2
);
assert('Org seasonal reset: newXP = 150', orgSeasonRollover.newXP, 150);
assert('Org seasonal reset: newLevel = 1', orgSeasonRollover.newLevel, 1);
assert('Org seasonal reset: seasonId = 2026_S2', orgSeasonRollover.seasonId, '2026_S2');
assert('Org seasonal reset: previous seasonId = 2026_S1', orgSeasonRollover.previousSeasonStats?.seasonId, '2026_S1');
assert('Org seasonal reset: previous finalLevel = 23', orgSeasonRollover.previousSeasonStats?.finalLevel, 23);
assert('Org seasonal reset: previous finalXP = 4500', orgSeasonRollover.previousSeasonStats?.finalXP, 4500);

// ── Summary ──
console.log('\n══════════════════════════════');
console.log(`  TOTAL: ${passed + failed}  |  ✓ PASSED: ${passed}  |  ✗ FAILED: ${failed}`);
console.log('══════════════════════════════\n');

if (failed > 0) {
    process.exit(1);
}
