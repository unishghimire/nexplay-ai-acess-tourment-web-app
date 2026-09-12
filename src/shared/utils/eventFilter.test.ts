import assert from 'node:assert/strict';
import { isScrimEvent, isTournamentEvent } from './utils.js';

console.log('Testing eventFilter (isScrimEvent and isTournamentEvent)...');

// 1. Live document from database: "nexplay leauge s1" (q7OlamU0R24wV5G8szK8)
const tournamentInScrimsCollection = {
    id: 'q7OlamU0R24wV5G8szK8',
    title: 'nexplay leauge s1',
    matchType: 'tournament',
    type: 'BATTEL ROYAL',
    isScrim: false,
    status: 'live',
    format: 'single_elimination',
    _sourceCollection: 'scrims'
};

assert.equal(isScrimEvent(tournamentInScrimsCollection), false, 'Tournament document must NOT be classified as scrim');
assert.equal(isTournamentEvent(tournamentInScrimsCollection), true, 'Tournament document must be classified as tournament');

// 2. Live document from database: "nexplay daily" (Y8dO0CbHaKkOvyV2YzeM)
const scrimDoc = {
    id: 'Y8dO0CbHaKkOvyV2YzeM',
    title: 'nexplay daily',
    matchType: 'scrims',
    isScrim: true,
    status: 'open',
    format: 'Battle Royale',
    _sourceCollection: 'scrims'
};

assert.equal(isScrimEvent(scrimDoc), true, 'Scrim document must be classified as scrim');
assert.equal(isTournamentEvent(scrimDoc), false, 'Scrim document must NOT be classified as tournament');

// 3. Elimination brackets should never be scrims even without explicit matchType
const bracketEvent = {
    id: 't-123',
    title: 'Winter Championship 2026',
    format: 'single_elimination',
    status: 'upcoming'
};

assert.equal(isScrimEvent(bracketEvent), false, 'Bracket event must NOT be scrim');
assert.equal(isTournamentEvent(bracketEvent), true, 'Bracket event must be tournament');

// 4. Scrim with title keyword
const titleScrim = {
    id: 's-456',
    title: 'Free Fire TDM Practice Scrim',
    status: 'open',
    format: 'Clash Squad'
};

assert.equal(isScrimEvent(titleScrim), true, 'Title scrim must be classified as scrim');
assert.equal(isTournamentEvent(titleScrim), false, 'Title scrim must NOT be tournament');

// 5. Explicit isScrim: false
const falseScrim = {
    id: 't-789',
    title: 'Casual Battle',
    isScrim: false,
    status: 'open'
};

assert.equal(isScrimEvent(falseScrim), false, 'isScrim: false must NOT be scrim');
assert.equal(isTournamentEvent(falseScrim), true, 'isScrim: false must be tournament');

// 6. Generic scrims collection item with no tournament flags
const genericScrim = {
    id: 's-generic',
    title: 'Daily Practice Round 1',
    format: 'Squad',
    _sourceCollection: 'scrims'
};

assert.equal(isScrimEvent(genericScrim), true, 'Generic scrims collection item must be scrim');
assert.equal(isTournamentEvent(genericScrim), false, 'Generic scrims collection item must NOT be tournament');

// 7. Per-Kill events: strictly scrims, never tournaments
const perKillByMode = {
    id: 'pk-001',
    title: 'PUBG Mobile Pro Bounty',
    tournamentMode: 'PER_KILL_REWARD',
    rewardPerKill: 25,
};
assert.equal(isScrimEvent(perKillByMode), true, 'Per-kill by mode must be classified as scrim');
assert.equal(isTournamentEvent(perKillByMode), false, 'Per-kill by mode must NOT be tournament');

const perKillByTitle = {
    id: 'pk-002',
    title: 'Free Fire 100K Per-Kill Tournament', // Even if titled "tournament", per-kill is a scrim!
    rewardPerKill: 50,
};
assert.equal(isScrimEvent(perKillByTitle), true, 'Per-kill titled event must be classified as scrim');
assert.equal(isTournamentEvent(perKillByTitle), false, 'Per-kill titled event must NOT be tournament');

// 8. Null or invalid inputs
assert.equal(isScrimEvent(null), false);
assert.equal(isTournamentEvent(null), false);
assert.equal(isScrimEvent(undefined), false);
assert.equal(isTournamentEvent(undefined), false);

console.log('All eventFilter tests passed successfully! [OK]');
