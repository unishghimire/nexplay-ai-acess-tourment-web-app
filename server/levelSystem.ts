// ─────────────────────────────────────────────────────────────────────────────
// 100-LEVEL PROGRESSION & SEASON SYSTEM FOR SERVER
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_LEVEL = 100;
export const MAX_LEVEL_XP = 20100; // 100 + 100 * 200 = 20,100 EXP

/**
 * Calculates Level (1–100) based on accumulated EXP.
 * Threshold for Level L: 100 + L * 200
 * - Level 1: 0 - 299 EXP (Target to reach Level 2 is 300 EXP)
 * - Level 2: 300 - 499 EXP (Target to reach Level 3 is 500 EXP)
 * - Level 3: 500 - 699 EXP (Target to reach Level 4 is 700 EXP)
 * - ...
 * - Level 100: 19,900 - 20,100+ EXP (Capped at 100)
 */
export const calculateLevel = (xp: number = 0): number => {
  const validXP = Math.max(0, Number(xp) || 0);
  if (validXP < 300) return 1;
  const lvl = Math.floor((validXP - 100) / 200) + 1;
  return Math.min(MAX_LEVEL, Math.max(1, lvl));
};

export const getXPForNextLevel = (level: number): number => {
  const validLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (validLevel >= MAX_LEVEL) return MAX_LEVEL_XP;
  return 100 + validLevel * 200;
};

export const getLevelProgress = (xp: number = 0): number => {
  const validXP = Math.max(0, Number(xp) || 0);
  if (validXP >= MAX_LEVEL_XP) return 100;
  const level = calculateLevel(validXP);
  if (level === 1) {
    const progress = (validXP / 300) * 100;
    return Math.min(100, Math.max(0, progress));
  }
  const prevThreshold = 100 + (level - 1) * 200;
  const nextThreshold = 100 + level * 200;
  const progress = ((validXP - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
  return Math.min(100, Math.max(0, progress));
};

export const getCurrentSeasonId = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0 to 11
  const seasonNum = month < 6 ? 1 : 2;
  return `${year}_S${seasonNum}`;
};

export const formatSeasonLabel = (seasonId?: string): string => {
  if (!seasonId) return 'Season 1';
  const match = seasonId.match(/^(\d{4})_S([12])$/);
  if (match) {
    return `${match[1]} Season ${match[2]}`;
  }
  return seasonId;
};

export const calculateDepositXP = (amount: number): number => {
  const validAmount = Math.max(0, Number(amount) || 0);
  return Math.floor(validAmount / 100) * 100;
};

export const calculateWithdrawalXP = (amount: number): number => {
  const validAmount = Math.max(0, Number(amount) || 0);
  return Math.floor(validAmount / 1000) * 500;
};

export interface PreviousSeasonStats {
  seasonId: string;
  finalLevel: number;
  finalXP: number;
  wins?: number;
}

export interface SeasonEntityData {
  xp?: number;
  level?: number;
  seasonId?: string;
  previousSeasonStats?: PreviousSeasonStats;
}

export const applyExpWithSeasonCheck = (
  entity: SeasonEntityData,
  expToAdd: number,
  now: Date = new Date()
): {
  newXP: number;
  newLevel: number;
  seasonId: string;
  previousSeasonStats?: PreviousSeasonStats;
} => {
  const currentSeason = getCurrentSeasonId(now);
  const isNewSeason = Boolean(entity.seasonId && entity.seasonId !== currentSeason);

  const previousSeasonStats = isNewSeason ? {
    seasonId: entity.seasonId!,
    finalLevel: entity.level || 1,
    finalXP: entity.xp || 0
  } : entity.previousSeasonStats;

  const baseXP = isNewSeason ? 0 : (entity.xp || 0);
  const newXP = baseXP + Math.max(0, expToAdd);
  const newLevel = calculateLevel(newXP);

  return {
    newXP,
    newLevel,
    seasonId: currentSeason,
    ...(previousSeasonStats ? { previousSeasonStats } : {})
  };
};
