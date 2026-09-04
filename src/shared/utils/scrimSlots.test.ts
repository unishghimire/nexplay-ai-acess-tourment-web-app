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

import { SCRIM_FORMAT_SLOTS, getScrimSlotCount } from './scrimSlots';
assert(SCRIM_FORMAT_SLOTS.Squad === 12, 'Squad format must have exactly 12 slots');
assert(SCRIM_FORMAT_SLOTS.Duo === 25, 'Duo format must have exactly 25 slots');
assert(SCRIM_FORMAT_SLOTS.Solo === 48, 'Solo format must have exactly 48 slots');
assert(getScrimSlotCount('Squad') === 12, 'getScrimSlotCount(Squad) must return 12');
assert(getScrimSlotCount('Duo') === 25, 'getScrimSlotCount(Duo) must return 25');
assert(getScrimSlotCount('Solo') === 48, 'getScrimSlotCount(Solo) must return 48');

// Team event slot normalization assertions
const teamSlots = normalizeScrimSlots(
  [
    { slotNumber: 1, status: 'filled', teamName: 'Phoenix Esports', inGameName: 'PhoenixCap' },
    { slotNumber: 2, status: 'filled', teamName: '', inGameName: 'ShadowNinja' },
    { slotNumber: 3, status: 'open' },
  ],
  12,
  2,
  {
    isTeamEvent: true,
    mySlotNumber: 3,
    myTeamName: 'GodLike Esports',
    myUserName: 'GodPlayer',
    myInGameName: 'GodIGN',
  }
);
assert(teamSlots[0].teamName === 'Phoenix Esports', 'Explicit team name must be preserved in team events');
assert(teamSlots[1].teamName === "ShadowNinja's Team", 'Filled slot without explicit teamName must format as Team');
assert(teamSlots[2].teamName === 'GodLike Esports', 'User slot in team event must prioritize dedicated myTeamName');

// Solo event slot normalization assertions
const soloSlots = normalizeScrimSlots(
  [
    { slotNumber: 1, status: 'filled', teamName: '', inGameName: 'SoloSniper' },
  ],
  48,
  1,
  {
    isTeamEvent: false,
    mySlotNumber: 1,
    myUserName: 'SoloPlayer',
    myInGameName: 'SoloIGN',
  }
);
assert(soloSlots[0].teamName === 'SoloPlayer', 'Solo slot must use player username/IGN');

console.log('Scrim slot normalization tests: 18 passed, 0 failed');

