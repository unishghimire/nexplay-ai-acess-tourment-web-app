import type { PointRule, Team } from '../src/shared/types/types';

export interface ScoredEntry {
  teamId: string;
  teamName: string;
  placement: number;
  kills: number;
  penalties?: number;
  bonuses?: number;
}

export interface GeneratedGroup {
  id: string;
  name: string;
  teams: Team[];
}

export interface ProgressionResult {
  roundNumber: number;
  advancingTeams: Team[];
  qualifiedCount: number;
}

const DEFAULT_GROUP_PREFIX = 'Group';

function normalizeSeed(seed?: string | number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.floor(seed)) || 1;
  }

  if (typeof seed === 'string' && seed.trim()) {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return hash || 1;
  }

  return 1;
}

function createSeededRandom(seed?: string | number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function calculatePlacementPoints(pointRule: PointRule | undefined, placement: number): number {
  if (!pointRule || !Array.isArray(pointRule.placementPoints)) {
    return 0;
  }

  const placementRule = pointRule.placementPoints.find((entry) => entry.rank === placement);
  return placementRule?.points || 0;
}

export function calculateTournamentPoints(
  pointRule: PointRule | undefined,
  entry: Pick<ScoredEntry, 'placement' | 'kills'> & Partial<Pick<ScoredEntry, 'penalties' | 'bonuses'>>
): number {
  if (!pointRule) {
    return Math.max(0, (entry.bonuses || 0) - (entry.penalties || 0));
  }

  const killPoints = (Number(entry.kills) || 0) * (Number(pointRule.pointsPerKill) || 0);
  const placementPoints = calculatePlacementPoints(pointRule, Number(entry.placement) || 0);
  const winnerBonus = Number(pointRule.winnerBonus) || 0;
  const consistencyBonus = Number(pointRule.consistencyBonus) || 0;
  const extraBonuses = Number(entry.bonuses) || 0;
  const penalties = Number(entry.penalties) || 0;

  return Math.max(0, killPoints + placementPoints + winnerBonus + consistencyBonus + extraBonuses - penalties);
}

export function sortScoredEntries(entries: ScoredEntry[]): ScoredEntry[] {
  return [...entries].sort((left, right) => {
    if (right.placement !== left.placement) {
      return left.placement - right.placement;
    }

    if (right.kills !== left.kills) {
      return right.kills - left.kills;
    }

    return left.teamName.localeCompare(right.teamName);
  });
}

export function generateGroups(
  teams: Team[],
  teamsPerGroup: number,
  options?: {
    groupPrefix?: string;
    seed?: string | number;
  }
): GeneratedGroup[] {
  const groupPrefix = options?.groupPrefix || DEFAULT_GROUP_PREFIX;
  const random = createSeededRandom(options?.seed);
  const shuffledTeams = [...teams].sort(() => random() - 0.5);
  const groupCount = Math.max(1, Math.ceil(shuffledTeams.length / Math.max(1, teamsPerGroup)));
  const groups: GeneratedGroup[] = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `${groupPrefix} ${String.fromCharCode(65 + index)}`,
    teams: []
  }));

  shuffledTeams.forEach((team, index) => {
    groups[index % groupCount].teams.push(team);
  });

  return groups;
}

export function collectQualifiedTeams(
  groupedEntries: Array<{
    roundNumber: number;
    teams: ScoredEntry[];
  }>,
  teamsToQualify: number
): ProgressionResult[] {
  return groupedEntries.map((group) => ({
    roundNumber: group.roundNumber,
    advancingTeams: sortScoredEntries(group.teams).slice(0, Math.max(1, teamsToQualify)).map((entry) => ({
      id: entry.teamId,
      name: entry.teamName
    } as Team)),
    qualifiedCount: Math.max(1, teamsToQualify)
  }));
}

export function buildDefaultRoadmapSteps(totalRounds: number): Array<{ roundNumber: number; stageName: string; qualificationRule: number; numGroups: number }> {
  return Array.from({ length: Math.max(0, totalRounds) }, (_, index) => ({
    roundNumber: index + 1,
    stageName: index === 0 ? 'Registration' : index === totalRounds - 1 ? 'Finals' : `Round ${index + 1}`,
    qualificationRule: index === totalRounds - 1 ? 1 : 2,
    numGroups: index === 0 ? 1 : Math.max(1, totalRounds - index)
  }));
}
