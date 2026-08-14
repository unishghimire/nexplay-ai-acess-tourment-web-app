export interface PrizeWinnerInput {
  userId?: unknown;
  prize?: unknown;
  rank?: unknown;
}

export function validatePrizeWinners(winners: unknown): string | null {
  if (!Array.isArray(winners) || winners.length === 0) {
    return 'Winners array is required';
  }

  const winnerUserIds = new Set<string>();
  const winnerRanks = new Set<number>();

  for (const winner of winners as PrizeWinnerInput[]) {
    if (!winner.userId || typeof winner.userId !== 'string') {
      return 'Invalid winner data';
    }
    if (winnerUserIds.has(winner.userId)) {
      return 'A winner may only appear once';
    }
    if (typeof winner.prize !== 'number' || !Number.isFinite(winner.prize) || winner.prize < 0 || winner.prize > 1000000) {
      return 'Invalid prize amount';
    }
    if (typeof winner.rank !== 'number' || !Number.isInteger(winner.rank) || winner.rank < 1 || winner.rank > 999) {
      return 'Invalid rank';
    }
    if (winnerRanks.has(winner.rank)) {
      return 'Each prize rank must be unique';
    }

    winnerUserIds.add(winner.userId);
    winnerRanks.add(winner.rank);
  }

  return null;
}
