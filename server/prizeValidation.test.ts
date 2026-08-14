import { validatePrizeWinners } from './prizeValidation';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const validWinners = [
  { userId: 'player-1', prize: 1000, rank: 1 },
  { userId: 'player-2', prize: 500, rank: 2 },
];

assert(validatePrizeWinners(validWinners) === null, 'unique valid winners are accepted');
assert(validatePrizeWinners([...validWinners, { userId: 'player-1', prize: 250, rank: 3 }]) === 'A winner may only appear once', 'duplicate recipient is rejected');
assert(validatePrizeWinners([...validWinners, { userId: 'player-3', prize: 250, rank: 2 }]) === 'Each prize rank must be unique', 'duplicate rank is rejected');
assert(validatePrizeWinners([{ userId: 'player-1', prize: Number.NaN, rank: 1 }]) === 'Invalid prize amount', 'non-finite prize is rejected');
assert(validatePrizeWinners([{ userId: 'player-1', prize: 100, rank: 1.5 }]) === 'Invalid rank', 'non-integer rank is rejected');

console.log('Prize winner validation tests: 5 passed, 0 failed');
