import { generateInitialSlots, mapDocToScrim } from './scrimsService';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
}

console.log('--- Testing ScrimsService utilities ---');

// Test slot generation
const slots12 = generateInitialSlots(12);
assert(slots12.length === 12, 'Default generates 12 slots');
assert(slots12[0].slotNumber === 1, 'First slot is 1');
assert(slots12[11].slotNumber === 12, 'Last slot is 12');
assert(slots12.every(s => s.status === 'open'), 'All slots start open');

const slotsBounded = generateInitialSlots(150);
assert(slotsBounded.length === 100, 'Slots are capped at 100 max');

const slotsMin = generateInitialSlots(0);
assert(slotsMin.length === 12, 'Fallback to 12 when invalid or zero');

// Test mapDocToScrim
const mockDocData = {
    title: 'Daily Pro Scrim',
    game: 'Free Fire',
    hostUid: 'host-123',
    hostName: 'Organizer Alpha',
    matchTime: '2026-08-16T18:00:00Z',
    status: 'open',
    slots: [
        { slotNumber: 1, teamName: 'Team Liquid', status: 'filled' },
        { slotNumber: 2, teamName: null, status: 'open' },
    ],
    totalSlots: 2,
    requirements: {
        minTier: 'Diamond',
        discordRequired: true,
        entryFee: 50,
    },
    roomId: '998877',
    roomPass: 'pro2026',
    streamUrl: 'https://youtube.com/live/123',
};

const mapped = mapDocToScrim('scrim-abc', mockDocData);
assert(mapped.id === 'scrim-abc', 'Maps ID correctly');
assert(mapped.title === 'Daily Pro Scrim', 'Maps title correctly');
assert(mapped.game === 'Free Fire', 'Maps game correctly');
assert(mapped.filledSlots === 1, 'Counts filled slots correctly');
assert(mapped.totalSlots === 2, 'Maps totalSlots correctly');
assert(mapped.requirements?.minTier === 'Diamond', 'Maps minTier');
assert(mapped.requirements?.discordRequired === true, 'Maps discordRequired');
assert(mapped.requirements?.entryFee === 50, 'Maps entryFee');
assert(mapped.roomDetails?.roomId === '998877', 'Maps roomDetails.roomId');
assert(mapped.roomDetails?.roomPassword === 'pro2026', 'Maps roomDetails.roomPassword');
assert(mapped.roomDetails?.streamUrl === 'https://youtube.com/live/123', 'Maps streamUrl');

console.log('✓ All ScrimsService unit tests passed!');
