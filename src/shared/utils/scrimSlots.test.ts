import { countFilledScrimSlots, normalizeScrimSlots } from './scrimSlots';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const numericSlots = normalizeScrimSlots(4, undefined, 2);
assert(numericSlots.length === 4, 'numeric slot count should create four slots');
assert(countFilledScrimSlots(numericSlots) === 2, 'numeric filled count should be preserved');

const storedSlots = normalizeScrimSlots([
  { slotNumber: 2, status: 'filled', teamName: 'Alpha' },
  { slotNumber: 3, status: 'open' },
]);
assert(storedSlots[0].slotNumber === 2, 'stored slot number should be preserved');
assert(storedSlots[0].teamName === 'Alpha', 'stored team name should be preserved');
assert(storedSlots[1].status === 'open', 'stored open state should be preserved');

const malformedSlots = normalizeScrimSlots([{ status: 'unexpected' }], 10);
assert(malformedSlots[0].slotNumber === 1, 'invalid slot numbers should fall back to position');
assert(malformedSlots[0].status === 'open', 'unknown states should safely become open');

console.log('Scrim slot normalization tests: 7 passed, 0 failed');
