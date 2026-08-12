// ═══════════════════════════════════════════════════════════════
// SCORING ENGINE TESTS — minimal, framework-free, runnable
// ponytail: assert-based self-check, no test framework needed.
// ═══════════════════════════════════════════════════════════════

import { calculateTeamScore, validateResult, validateScoringConfig, aggregateStandings, scoreTeamResult, createScoringSnapshot } from './scoringEngine';
import { FREE_FIRE_DEFAULT_SCORING, GameScoringConfig } from '../types/scoring';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.error(`FAIL: ${label}`);
    }
}

function assertEq(a: any, b: any, label: string) {
    assert(a === b, label + ' — expected ' + b + ', got ' + a);
}

// ═══════════════════════════════════════════════════════════════
// 1. BASIC SCORING — Free Fire defaults
// ═══════════════════════════════════════════════════════════════
const ff = FREE_FIRE_DEFAULT_SCORING;

assertEq(calculateTeamScore({ position: 1, kills: 0, scoring: ff }).totalPoints, 12, '1st + 0 kills = 12');
assertEq(calculateTeamScore({ position: 1, kills: 1, scoring: ff }).totalPoints, 13, '1st + 1 kill = 13');
assertEq(calculateTeamScore({ position: 1, kills: 10, scoring: ff }).totalPoints, 22, '1st + 10 kills = 22');
assertEq(calculateTeamScore({ position: 2, kills: 0, scoring: ff }).totalPoints, 9, '2nd + 0 kills = 9');
assertEq(calculateTeamScore({ position: 2, kills: 5, scoring: ff }).totalPoints, 14, '2nd + 5 kills = 14');
assertEq(calculateTeamScore({ position: 3, kills: 8, scoring: ff }).totalPoints, 16, '3rd + 8 kills = 16');
assertEq(calculateTeamScore({ position: 5, kills: 6, scoring: ff }).totalPoints, 12, '5th + 6 kills = 12');
assertEq(calculateTeamScore({ position: 10, kills: 0, scoring: ff }).totalPoints, 1, '10th + 0 kills = 1');
assertEq(calculateTeamScore({ position: 10, kills: 5, scoring: ff }).totalPoints, 6, '10th + 5 kills = 6');
assertEq(calculateTeamScore({ position: 11, kills: 0, scoring: ff }).totalPoints, 0, '11th + 0 kills = 0');
assertEq(calculateTeamScore({ position: 11, kills: 5, scoring: ff }).totalPoints, 5, '11th + 5 kills = 5');
assertEq(calculateTeamScore({ position: 12, kills: 10, scoring: ff }).totalPoints, 10, '12th + 10 kills = 10');

// ═══════════════════════════════════════════════════════════════
// 2. VALIDATION — invalid inputs
// ═══════════════════════════════════════════════════════════════
assert(!validateResult({ position: 0, kills: 0 }).valid, 'position 0 invalid');
assert(!validateResult({ position: -1, kills: 0 }).valid, 'position -1 invalid');
assert(!validateResult({ position: 1.5, kills: 0 }).valid, 'position 1.5 invalid');
assert(!validateResult({ position: 1, kills: -1 }).valid, 'kills -1 invalid');
assert(!validateResult({ position: 1, kills: 2.5 }).valid, 'kills 2.5 invalid');
assert(!validateResult({ position: 13, kills: 0, maxPlacement: 12 }).valid, 'position 13 > max 12 invalid');
assert(validateResult({ position: 12, kills: 0, maxPlacement: 12 }).valid, 'position 12 == max 12 valid');
assert(validateResult({ position: 1, kills: 0 }).valid, 'position 1 kills 0 valid');
assert(validateResult({ position: 1, kills: 1000 }).valid, 'kills 1000 valid');

// ═══════════════════════════════════════════════════════════════
// 3. EDGE CASES — beyond max placement
// ═══════════════════════════════════════════════════════════════
const r13 = calculateTeamScore({ position: 13, kills: 5, scoring: ff });
assertEq(r13.placementPoints, 0, 'position 13 placement = 0');
assertEq(r13.killPoints, 5, 'position 13 kills = 5');
assertEq(r13.totalPoints, 5, 'position 13 total = 5');

// ═══════════════════════════════════════════════════════════════
// 4. SCORING CONFIG VALIDATION
// ═══════════════════════════════════════════════════════════════
assert(validateScoringConfig(FREE_FIRE_DEFAULT_SCORING as GameScoringConfig).valid, 'Free Fire config valid');

const badConfig: GameScoringConfig = {
    enabled: true, killPoints: -1,
    placementPoints: { '1': 12 }, maxPlacement: 12, scoringVersion: 1,
};
assert(!validateScoringConfig(badConfig).valid, 'negative killPoints invalid');

const negConfig: GameScoringConfig = {
    enabled: true, killPoints: 1,
    placementPoints: { '1': -5 }, maxPlacement: 12, scoringVersion: 1,
};
assert(!validateScoringConfig(negConfig).valid, 'negative placement points invalid');

// ═══════════════════════════════════════════════════════════════
// 5. SNAPSHOT — versioning isolation
// ═══════════════════════════════════════════════════════════════
const snapshot = createScoringSnapshot({
    gameId: 'free-fire', gameName: 'Free Fire',
    scoring: { ...FREE_FIRE_DEFAULT_SCORING, scoringVersion: 1 },
});
assertEq(snapshot.killPoints, 1, 'snapshot killPoints = 1');
assertEq(snapshot.placementPoints['1'], 12, 'snapshot 1st = 12');
assertEq(snapshot.scoringVersion, 1, 'snapshot version = 1');
assertEq(snapshot.source, 'game-default', 'snapshot source = game-default');

// Admin changes kill points to 2 (version 2)
const scoringV2 = { ...FREE_FIRE_DEFAULT_SCORING, killPoints: 2, scoringVersion: 2 };
const snapshotV2 = createScoringSnapshot({
    gameId: 'free-fire', gameName: 'Free Fire', scoring: scoringV2,
});
// Old tournament with v1: 1st + 10 kills = 22
assertEq(calculateTeamScore({ position: 1, kills: 10, scoring: snapshot }).totalPoints, 22, 'v1 snapshot: 1st + 10 = 22');
// New tournament with v2: 1st + 10 kills = 32 (12 + 20)
assertEq(calculateTeamScore({ position: 1, kills: 10, scoring: snapshotV2 }).totalPoints, 32, 'v2 snapshot: 1st + 10 = 32');

// ═══════════════════════════════════════════════════════════════
// 6. MULTI-MATCH AGGREGATION
// ═══════════════════════════════════════════════════════════════
const match1 = [
    scoreTeamResult({ teamId: 'alpha', teamName: 'Alpha', position: 1, kills: 7, scoring: snapshot }),
    scoreTeamResult({ teamId: 'bravo', teamName: 'Bravo', position: 2, kills: 5, scoring: snapshot }),
    scoreTeamResult({ teamId: 'charlie', teamName: 'Charlie', position: 3, kills: 8, scoring: snapshot }),
];
const match2 = [
    scoreTeamResult({ teamId: 'alpha', teamName: 'Alpha', position: 5, kills: 4, scoring: snapshot }),
    scoreTeamResult({ teamId: 'bravo', teamName: 'Bravo', position: 2, kills: 6, scoring: snapshot }),
    scoreTeamResult({ teamId: 'charlie', teamName: 'Charlie', position: 3, kills: 6, scoring: snapshot }),
];
const standings = aggregateStandings({ matchResults: [match1, match2] });

// Charlie: 16 + 14 = 30, Alpha: 19 + 10 = 29, Bravo: 14 + 15 = 29
assertEq(standings[0].teamName, 'Charlie', 'Charlie ranked 1st (30 pts)');
assertEq(standings[0].totalPoints, 30, 'Charlie total = 30');
assertEq(standings[0].kills, 14, 'Charlie kills = 14');
assertEq(standings[0].matches, 2, 'Charlie matches = 2');
assertEq(standings[0].placementPoints, 16, 'Charlie placement pts = 16');
assertEq(standings[0].killPoints, 14, 'Charlie kill pts = 14');

// Alpha and Bravo tied at 29 — tie-breaker: best placement (Alpha: 1 > Bravo: 2)
assertEq(standings[1].teamName, 'Alpha', 'Alpha ranked 2nd (tie-break: best placement)');
assertEq(standings[1].totalPoints, 29, 'Alpha total = 29');
assertEq(standings[2].teamName, 'Bravo', 'Bravo ranked 3rd');
assertEq(standings[2].totalPoints, 29, 'Bravo total = 29');

// ═══════════════════════════════════════════════════════════════
// 7. NO DOUBLE COUNTING
// ═══════════════════════════════════════════════════════════════
const single = scoreTeamResult({ teamId: 't1', teamName: 'T1', position: 1, kills: 10, scoring: snapshot });
assertEq(single.totalPoints, single.placementPoints + single.killPoints, 'total = placement + kill (no double count)');
assertEq(single.totalPoints, 22, '1st + 10 kills = 22 (no double count)');

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════
console.log('\nScoring Engine Tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
    process.exit(1);
}
