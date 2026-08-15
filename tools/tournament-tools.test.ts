import {
  calculatePlacementPoints,
  calculateTournamentPoints,
  sortScoredEntries,
  generateGroups,
  collectQualifiedTeams,
  buildDefaultRoadmapSteps,
  type ScoredEntry
} from './tournament-tools.js';
import type { PointRule, Team } from '../src/shared/types/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${msg}`);
  }
}

// 1. Placement points calculation
const pointRule: PointRule = {
  placementPoints: [
    { rank: 1, points: 15 },
    { rank: 2, points: 12 },
    { rank: 3, points: 10 },
    { rank: 4, points: 8 },
  ],
  pointsPerKill: 2,
  winnerBonus: 5,
  consistencyBonus: 3,
};

assert(calculatePlacementPoints(pointRule, 1) === 15, "rank 1 should yield 15 placement points");
assert(calculatePlacementPoints(pointRule, 3) === 10, "rank 3 should yield 10 placement points");
assert(calculatePlacementPoints(pointRule, 5) === 0, "unranked placement should yield 0 placement points");
assert(calculatePlacementPoints(undefined, 1) === 0, "undefined point rule should yield 0 placement points");

// 2. Tournament points calculation
const entry1 = { placement: 1, kills: 5, bonuses: 2, penalties: 1 };
// 5 kills * 2 = 10 + 15 (placement) + 5 (winner) + 3 (consistency) + 2 (bonuses) - 1 (penalties) = 34
const points1 = calculateTournamentPoints(pointRule, entry1);
assert(points1 === 34, `calculated total points should be 34 (got ${points1})`);

// 3. Fallback when penalties exceed points
const entryNegative = { placement: 10, kills: 0, bonuses: 0, penalties: 50 };
const pointsNegative = calculateTournamentPoints(pointRule, entryNegative);
assert(pointsNegative === 0, "points should not fall below 0");

// 4. Sort scored entries (placement ASC, kills DESC, teamName ASC)
const entries: ScoredEntry[] = [
  { teamId: 't2', teamName: 'Beta', placement: 2, kills: 10 },
  { teamId: 't1', teamName: 'Alpha', placement: 1, kills: 3 },
  { teamId: 't3', teamName: 'Gamma', placement: 2, kills: 5 },
  { teamId: 't4', teamName: 'Alpha2', placement: 2, kills: 10 },
];
const sorted = sortScoredEntries(entries);
assert(sorted[0].teamId === 't1', "first place team should rank 1st");
assert(sorted[1].teamName === 'Alpha2', "tie-break: higher kills and alphabetical name Alpha2 before Beta");
assert(sorted[2].teamName === 'Beta', "tie-break: same kills Beta after Alpha2");
assert(sorted[3].teamId === 't3', "lower kills should be ranked last among placement 2");

// 5. Group generation
const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => ({
  id: `team-${i + 1}`,
  name: `Team ${i + 1}`,
  tag: `T${i + 1}`,
  ownerId: `owner-${i + 1}`,
  members: [],
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  totalPrizeWon: 0,
  createdAt: new Date()
}));

const groups = generateGroups(mockTeams, 4, { groupPrefix: 'Group', seed: 'stable-seed' });
assert(groups.length === 3, "12 teams in groups of 4 should yield 3 groups");
assert(groups[0].name === 'Group A', "first group named Group A");
assert(groups[0].teams.length === 4, "group A should have 4 teams");
assert(groups[1].teams.length === 4, "group B should have 4 teams");
assert(groups[2].teams.length === 4, "group C should have 4 teams");

// 6. Seed reproducibility
const groupsCopy = generateGroups(mockTeams, 4, { groupPrefix: 'Group', seed: 'stable-seed' });
assert(groups[0].teams[0].id === groupsCopy[0].teams[0].id, "same seed must produce identical team assignments");

// 7. Progression & Qualified Teams
const progressionInput = [
  {
    roundNumber: 1,
    teams: [
      { teamId: 't1', teamName: 'Alpha', placement: 1, kills: 10 },
      { teamId: 't2', teamName: 'Beta', placement: 2, kills: 8 },
      { teamId: 't3', teamName: 'Gamma', placement: 3, kills: 4 },
      { teamId: 't4', teamName: 'Delta', placement: 4, kills: 2 },
    ]
  }
];
const qualified = collectQualifiedTeams(progressionInput, 2);
assert(qualified.length === 1, "should return 1 round of progression");
assert(qualified[0].advancingTeams.length === 2, "top 2 should qualify");
assert(qualified[0].advancingTeams[0].id === 't1', "rank 1 should advance");
assert(qualified[0].advancingTeams[1].id === 't2', "rank 2 should advance");

// 8. Roadmap Steps
const roadmapSteps = buildDefaultRoadmapSteps(3);
assert(roadmapSteps.length === 3, "total 3 rounds should generate 3 steps");
assert(roadmapSteps[0].stageName === 'Registration', "round 1 is Registration");
assert(roadmapSteps[1].stageName === 'Round 2', "round 2 is Round 2");
assert(roadmapSteps[2].stageName === 'Finals', "round 3 is Finals");

console.log(`Tournament tools tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All tournament tools checks passed ✓");
