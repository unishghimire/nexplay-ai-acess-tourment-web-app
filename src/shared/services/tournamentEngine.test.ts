// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENGINE SELF-CHECK
// ponytail: one runnable check that fails if the engine breaks.
// Run: npx tsx src/shared/services/tournamentEngine.test.ts
// ═══════════════════════════════════════════════════════════════

import {
    calculateGroupSizes,
    generateGroups,
    generateMatchesForRound,
    calculateGroupStandings,
    generateQualificationPreview,
    getQualifiedTeams,
    createNextRound,
    isBRTournament,
    isRoundComplete,
    computeRoadmap,
    validateGroupAssignment,
} from './tournamentEngine';
import { Tournament, TournamentGroup, Match, Team } from '../types/types';

// ─── Test 1: Group sizes are even ─────────────────────────────
(function testGroupSizes() {
    const sizes = calculateGroupSizes(50, 4);
    assert(sizes.length === 4, `Expected 4 groups, got ${sizes.length}`);
    assert(sizes[0] === 13 && sizes[1] === 13 && sizes[2] === 12 && sizes[3] === 12,
        `Expected [13,13,12,12], got [${sizes.join(',')}]`);
    assert(Math.max(...sizes) - Math.min(...sizes) <= 1, 'Size diff > 1');
    console.log('✓ Group sizes: 50/4 → [13,13,12,12]');
})();

// ─── Test 2: Group generation assigns all participants ────────
(function testGroupGeneration() {
    const participants = Array.from({ length: 24 }, (_, i) => ({
        userId: `user-${i}`,
        username: `Player${i}`,
        teamName: `Team${i}`,
        teamId: `team-${i}`,
    }));
    const result = generateGroups({ participants, numGroups: 4, roundNumber: 1 });
    assert(result.groups.length === 4, `Expected 4 groups, got ${result.groups.length}`);
    assert(result.totalAssigned === 24, `Expected 24 assigned, got ${result.totalAssigned}`);
    const allTeams = result.groups.flatMap(g => g.teams);
    assert(allTeams.length === 24, `Expected 24 teams across groups, got ${allTeams.length}`);
    const validation = validateGroupAssignment(result.groups as TournamentGroup[]);
    assert(validation.valid, `Duplicate teams: ${validation.errors.join(', ')}`);
    console.log('✓ Group generation: 24 participants → 4 groups, no duplicates');
})();

// ─── Test 3: BR match generation creates lobby matches ────────
(function testBRMatches() {
    const group: TournamentGroup = {
        id: 'group-1',
        name: 'Group A',
        teamLimit: 12,
        teams: Array.from({ length: 12 }, (_, i) => ({ id: `team-${i}`, name: `Team${i}` })),
        matches: [],
        isPublic: true,
    };
    const matches = generateMatchesForRound({ groups: [group], matchesPerGroup: 3, isBR: true, roundNumber: 1 });
    assert(matches[0].matches.length === 3, `Expected 3 BR matches, got ${matches[0].matches.length}`);
    assert(!matches[0].matches[0].team1Id, 'BR match should not have team1Id');
    assert(matches[0].matches[0].results !== undefined, 'BR match should have results array');
    console.log('✓ BR matches: 12 teams → 3 lobby matches with empty results[]');
})();

// ─── Test 4: BR standings use results[] not score1/score2 ─────
(function testBRStandings() {
    const team1: Team = { id: 'team-1', name: 'Team Alpha' };
    const team2: Team = { id: 'team-2', name: 'Team Bravo' };
    const team3: Team = { id: 'team-3', name: 'Team Charlie' };

    const group: TournamentGroup = {
        id: 'group-1',
        name: 'Group A',
        teamLimit: 3,
        teams: [team1, team2, team3],
        matches: [{
            id: 'match-1',
            round: 1,
            status: 'completed',
            results: [
                { teamId: 'team-1', teamName: 'Team Alpha', placement: 1, kills: 10, totalPoints: 22 },
                { teamId: 'team-2', teamName: 'Team Bravo', placement: 2, kills: 5, totalPoints: 14 },
                { teamId: 'team-3', teamName: 'Team Charlie', placement: 3, kills: 3, totalPoints: 11 },
            ],
        }],
        isPublic: true,
    };

    const tournament: Tournament = {
        id: 't-1',
        title: 'Test Tournament',
        game: 'Free Fire',
        prizePool: 1000,
        entryFee: 50,
        slots: 48,
        currentPlayers: 3,
        type: 'BR',
        teamSize: 4,
        teamType: 'squad',
        startTime: new Date(),
        status: 'live',
        stage: 'group_stage',
        hostUid: 'host-1',
        createdAt: new Date(),
        scoringSnapshot: {
            gameId: 'free-fire',
            gameName: 'Free Fire',
            killPoints: 1,
            placementPoints: { '1': 12, '2': 9, '3': 8 },
            maxPlacement: 12,
            scoringVersion: 1,
            source: 'game-default',
            snapshotAt: new Date(),
        },
    };

    const standings = calculateGroupStandings({ group, tournament });
    assert(standings.length === 3, `Expected 3 standings, got ${standings.length}`);
    assert(standings[0].teamId === 'team-1', `Expected Team Alpha #1, got ${standings[0].teamName}`);
    assert(standings[0].totalPoints === 22, `Expected 22 points, got ${standings[0].totalPoints}`);
    assert(standings[0].kills === 10, `Expected 10 kills, got ${standings[0].kills}`);
    console.log('✓ BR standings: reads from results[], Team Alpha wins with 22 pts');
})();

// ─── Test 5: Qualification preview picks top N per group ──────
(function testQualification() {
    const teams = Array.from({ length: 6 }, (_, i) => ({ id: `team-${i}`, name: `Team${i}` }));
    const group: TournamentGroup = {
        id: 'group-1',
        name: 'Group A',
        teamLimit: 6,
        teams,
        matches: [{
            id: 'match-1',
            round: 1,
            status: 'completed',
            results: teams.map((t, i) => ({
                teamId: t.id,
                teamName: t.name,
                placement: i + 1,
                kills: 6 - i,
                totalPoints: (6 - i) * 2 + (6 - i),
            })),
        }],
        isPublic: true,
    };

    const tournament: Tournament = {
        id: 't-1',
        title: 'Test',
        game: 'Free Fire',
        prizePool: 0,
        entryFee: 0,
        slots: 6,
        currentPlayers: 6,
        type: 'BR',
        teamSize: 1,
        teamType: 'solo',
        startTime: new Date(),
        status: 'live',
        stage: 'group_stage',
        hostUid: 'host',
        createdAt: new Date(),
        scoringSnapshot: {
            gameId: 'ff', gameName: 'Free Fire', killPoints: 1,
            placementPoints: { '1': 12, '2': 9, '3': 8, '4': 7, '5': 6, '6': 5 },
            maxPlacement: 12, scoringVersion: 1, source: 'game-default', snapshotAt: new Date(),
        },
    };

    const preview = generateQualificationPreview({
        groups: [group],
        tournament,
        roundNumber: 1,
        qualificationCount: 2,
    });

    assert(preview.totalQualified === 2, `Expected 2 qualified, got ${preview.totalQualified}`);
    assert(preview.totalEliminated === 4, `Expected 4 eliminated, got ${preview.totalEliminated}`);
    const qualifiers = getQualifiedTeams(preview);
    assert(qualifiers.length === 2, `Expected 2 qualifier teams, got ${qualifiers.length}`);
    assert(qualifiers[0].id === 'team-0', `Expected Team0 first, got ${qualifiers[0].id}`);
    console.log('✓ Qualification: top 2 of 6 qualify, no ties');
})();

// ─── Test 6: isRoundComplete detects incomplete rounds ────────
(function testRoundComplete() {
    const group: TournamentGroup = {
        id: 'g1',
        name: 'Group A',
        teamLimit: 4,
        teams: [{ id: 't1', name: 'T1' }, { id: 't2', name: 'T2' }],
        matches: [
            { id: 'm1', round: 1, status: 'completed', results: [] },
            { id: 'm2', round: 1, status: 'scheduled', results: [] },
        ],
        isPublic: true,
    };

    const result = isRoundComplete({ groups: [group], tournament: {} as Tournament });
    assert(!result.complete, 'Should not be complete with 1/2 matches');
    assert(result.totalMatches === 2, `Expected 2 total, got ${result.totalMatches}`);
    assert(result.completedMatches === 1, `Expected 1 completed, got ${result.completedMatches}`);
    console.log('✓ Round completion: correctly detects 1/2 matches incomplete');
})();

// ─── Test 7: Roadmap computes from tournament state ───────────
(function testRoadmap() {
    const tournament: Tournament = {
        id: 't1',
        title: 'Test Cup',
        game: 'Free Fire',
        prizePool: 0,
        entryFee: 0,
        slots: 32,
        currentPlayers: 16,
        type: 'BR',
        teamSize: 4,
        teamType: 'squad',
        startTime: new Date(),
        status: 'live',
        stage: 'group_stage',
        hostUid: 'host',
        createdAt: new Date(),
        currentRound: 1,
        roadmap: [
            { roundNumber: 1, numGroups: 4, qualificationRule: 2, maps: ['Bermuda'], stageName: 'Group Stage' },
            { roundNumber: 2, numGroups: 2, qualificationRule: 2, maps: ['Purgatory'], stageName: 'Semi Finals' },
        ],
        groups: [{ id: 'group-r1-1', name: 'Group A', teamLimit: 4, teams: [], matches: [], isPublic: true }],
    };

    const roadmap = computeRoadmap(tournament);
    assert(roadmap.length > 0, 'Roadmap should have stages');
    assert(roadmap.some(s => s.label === 'Registration'), 'Should have Registration stage');
    assert(roadmap.some(s => s.label === 'Group Stage'), 'Should have Group Stage');
    assert(roadmap.some(s => s.label === 'Semi Finals'), 'Should have Semi Finals');
    console.log('✓ Roadmap: dynamically computes stages from tournament state');
})();

// ─── Helper ───────────────────────────────────────────────────
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`✗ FAILED: ${message}`);
        process.exit(1);
    }
}

console.log('\n═══ All tournament engine self-checks passed ═══');

// ─── Test 8: Default roadmap generation ───────────────────────
import { generateDefaultRoadmap } from './tournamentEngine';

(function testDefaultRoadmap48() {
    const roadmap = generateDefaultRoadmap(48, 'Battle Royale');
    assert(roadmap.length >= 2, `48-slot BR should have >= 2 rounds, got ${roadmap.length}`);
    assert(roadmap[0].stageName === 'Group Stage', `First stage should be Group Stage, got ${roadmap[0].stageName}`);
    assert(roadmap[roadmap.length - 1].stageName === 'Grand Finals', `Last stage should be Grand Finals`);
    // All rounds should have status 'upcoming' initially
    assert(roadmap.every(r => r.status === 'upcoming'), 'All rounds should start as upcoming');
    console.log(`✓ Default roadmap (48 BR): ${roadmap.length} rounds — ${roadmap.map(r => r.stageName).join(' → ')}`);
})();

(function testDefaultRoadmapSmall() {
    const roadmap = generateDefaultRoadmap(8, 'Battle Royale');
    assert(roadmap.length === 1, `8-slot BR should have 1 round, got ${roadmap.length}`);
    assert(roadmap[0].stageName === 'Grand Finals', `Should be Grand Finals for small tournament`);
    console.log('✓ Default roadmap (8 BR): 1 round — Grand Finals');
})();

(function testDefaultRoadmap100() {
    const roadmap = generateDefaultRoadmap(100, 'Battle Royale');
    assert(roadmap.length >= 3, `100-slot BR should have >= 3 rounds, got ${roadmap.length}`);
    // Verify qualification chain: total qualified from round N should fit in round N+1
    let remaining = 100;
    for (const round of roadmap) {
        const totalQualified = round.qualificationRule * round.numGroups;
        if (round !== roadmap[roadmap.length - 1]) {
            assert(totalQualified <= remaining, `Round ${round.roundNumber}: qualified ${totalQualified} > remaining ${remaining}`);
        }
        remaining = totalQualified;
    }
    console.log(`✓ Default roadmap (100 BR): ${roadmap.length} rounds — ${roadmap.map(r => r.stageName).join(' → ')}`);
})();
