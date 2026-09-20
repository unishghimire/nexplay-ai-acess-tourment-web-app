import assert from 'node:assert';
import { 
    sanitizeExternalUrl, 
    mapToPublicOrganization, 
    calculateOrganizationStats 
} from './organizationService';
import { Tournament } from '../types/types';

console.log('--- STARTING ORGANIZATION SERVICE TESTS ---');

// 1. URL Sanitization Tests
{
    console.log('[TEST 1] sanitizeExternalUrl security and protocol validation');

    // Valid protocols
    assert.strictEqual(
        sanitizeExternalUrl('https://discord.gg/nexplay'),
        'https://discord.gg/nexplay',
        'Valid https URL should be preserved'
    );
    assert.strictEqual(
        sanitizeExternalUrl('http://example.com/tournaments'),
        'http://example.com/tournaments',
        'Valid http URL should be preserved'
    );

    // Protocol-less URLs
    assert.strictEqual(
        sanitizeExternalUrl('youtube.com/@nexplay'),
        'https://youtube.com/@nexplay',
        'Protocol-less URL should be prepended with https://'
    );

    // XSS / Malicious protocols must be strictly blocked
    assert.strictEqual(
        sanitizeExternalUrl('javascript:alert("XSS")'),
        null,
        'javascript: protocol must be blocked'
    );
    assert.strictEqual(
        sanitizeExternalUrl('JAVASCRIPT:alert(1)'),
        null,
        'Case-insensitive javascript: protocol must be blocked'
    );
    assert.strictEqual(
        sanitizeExternalUrl('data:text/html,<script>alert(1)</script>'),
        null,
        'data: protocol must be blocked'
    );
    assert.strictEqual(
        sanitizeExternalUrl('vbscript:msgbox("test")'),
        null,
        'vbscript: protocol must be blocked'
    );
    assert.strictEqual(
        sanitizeExternalUrl('file:///etc/passwd'),
        null,
        'file: protocol must be blocked'
    );

    // Empty and null inputs
    assert.strictEqual(sanitizeExternalUrl(''), null, 'Empty string should return null');
    assert.strictEqual(sanitizeExternalUrl('   '), null, 'Whitespace string should return null');
    assert.strictEqual(sanitizeExternalUrl(null as any), null, 'null should return null');
    assert.strictEqual(sanitizeExternalUrl(undefined as any), null, 'undefined should return null');

    console.log('✓ sanitizeExternalUrl tests passed');
}

// 2. Data Mapping & Privacy Tests
{
    console.log('[TEST 2] mapToPublicOrganization data hygiene & private field stripping');

    const rawPrivateDoc = {
        uid: 'org_123',
        username: 'elite_esports',
        orgName: 'Elite Esports Club',
        email: 'private_owner@elite.gg',
        phone: '+9779800000000',
        balance: 50000,
        orgWalletBalance: 25000,
        reservedBalance: 10000,
        bio: 'Premier esports organization in Nepal.',
        country: 'Nepal',
        region: 'Kathmandu',
        website: 'https://elite.gg',
        discord: 'https://discord.gg/elite',
        youtubeUrl: 'javascript:alert(1)', // Malicious link in DB
        isVerified: true,
        xp: 4500,
        level: 4,
        role: 'organizer'
    };

    const mapped = mapToPublicOrganization('org_123', rawPrivateDoc);

    assert.strictEqual(mapped.id, 'org_123');
    assert.strictEqual(mapped.name, 'Elite Esports Club');
    assert.strictEqual(mapped.username, 'elite_esports');
    assert.strictEqual(mapped.isVerified, true);
    assert.strictEqual(mapped.level, 4);
    assert.strictEqual(mapped.xp, 4500);
    assert.strictEqual(mapped.description, 'Premier esports organization in Nepal.');
    assert.strictEqual(mapped.website, 'https://elite.gg/');
    assert.strictEqual(mapped.socialLinks?.discord, 'https://discord.gg/elite');
    assert.strictEqual(mapped.socialLinks?.youtube, undefined, 'Malicious youtube link must be sanitized out');

    // Verify private fields are NEVER exposed on PublicOrganization
    const mappedAny = mapped as any;
    assert.strictEqual(mappedAny.email, undefined, 'Email must not exist on public organization');
    assert.strictEqual(mappedAny.phone, undefined, 'Phone must not exist on public organization');
    assert.strictEqual(mappedAny.balance, undefined, 'Balance must not exist on public organization');
    assert.strictEqual(mappedAny.orgWalletBalance, undefined, 'orgWalletBalance must not exist on public organization');
    assert.strictEqual(mappedAny.reservedBalance, undefined, 'reservedBalance must not exist on public organization');

    console.log('✓ mapToPublicOrganization tests passed');
}

// 3. Public Stats Calculation Tests
{
    console.log('[TEST 3] calculateOrganizationStats tournament metrics calculation');

    const mockTournaments: Tournament[] = [
        // 1. Live tournament
        {
            id: 't_live_1',
            title: 'PUBG Winter Championship',
            game: 'PUBG Mobile',
            prizePool: 50000,
            entryFee: 500,
            slots: 25,
            currentPlayers: 25,
            type: 'squad',
            teamSize: 4,
            teamType: 'squad',
            startTime: new Date(),
            status: 'live',
            hostUid: 'org_123',
            createdAt: new Date()
        },
        // 2. Upcoming tournament
        {
            id: 't_upcoming_1',
            title: 'Free Fire Clash Squad Open',
            game: 'Free Fire',
            prizePool: 20000,
            entryFee: 0,
            slots: 16,
            currentPlayers: 10,
            type: 'squad',
            teamSize: 4,
            teamType: 'squad',
            startTime: new Date(Date.now() + 86400000),
            status: 'upcoming',
            hostUid: 'org_123',
            createdAt: new Date()
        },
        // 3. Published tournament (treated as upcoming)
        {
            id: 't_pub_1',
            title: 'Valorant Community Cup',
            game: 'Valorant',
            prizePool: 30000,
            entryFee: 1000,
            slots: 8,
            currentPlayers: 6,
            type: 'squad',
            teamSize: 5,
            teamType: 'squad',
            startTime: new Date(Date.now() + 172800000),
            status: 'published',
            hostUid: 'org_123',
            createdAt: new Date()
        },
        // 4. Completed tournament with winners
        {
            id: 't_comp_1',
            title: 'PUBG Mobile Season 1',
            game: 'PUBG Mobile',
            prizePool: 40000,
            entryFee: 400,
            slots: 25,
            currentPlayers: 25,
            type: 'squad',
            teamSize: 4,
            teamType: 'squad',
            startTime: new Date(Date.now() - 864000000),
            status: 'completed',
            hostUid: 'org_123',
            createdAt: new Date(),
            winners: [
                { uid: 'u1', amount: 25000, rank: 1, teamName: 'Alpha' },
                { uid: 'u2', amount: 15000, rank: 2, teamName: 'Beta' }
            ]
        },
        // 5. Draft tournament (MUST be excluded from public stats)
        {
            id: 't_draft_1',
            title: 'Unpublished Draft',
            game: 'MLBB',
            prizePool: 100000,
            entryFee: 0,
            slots: 50,
            currentPlayers: 0,
            type: 'squad',
            teamSize: 5,
            teamType: 'squad',
            startTime: new Date(),
            status: 'draft',
            hostUid: 'org_123',
            createdAt: new Date()
        },
        // 6. Cancelled tournament (MUST be excluded from public stats)
        {
            id: 't_cancel_1',
            title: 'Cancelled Tourney',
            game: 'Valorant',
            prizePool: 10000,
            entryFee: 0,
            slots: 10,
            currentPlayers: 2,
            type: 'squad',
            teamSize: 5,
            teamType: 'squad',
            startTime: new Date(),
            status: 'cancelled',
            hostUid: 'org_123',
            createdAt: new Date()
        }
    ];

    const stats = calculateOrganizationStats(mockTournaments);

    assert.strictEqual(stats.runningTournaments, 1, 'Should have 1 live/running tournament');
    assert.strictEqual(stats.upcomingTournaments, 2, 'Should have 2 upcoming tournaments (upcoming + published)');
    assert.strictEqual(stats.completedTournaments, 1, 'Should have 1 completed tournament');
    assert.strictEqual(stats.totalTournaments, 4, 'Total tournaments should be 1 + 2 + 1 = 4 (excluding draft & cancelled)');
    assert.strictEqual(stats.totalPrizePool, 140000, 'Total prize pool should be 50k + 20k + 30k + 40k = 140k');
    assert.strictEqual(stats.totalSlots, 74, 'Total slots should be 25 + 16 + 8 + 25 = 74');
    assert.strictEqual(stats.filledSlots, 66, 'Filled slots should be 25 + 10 + 6 + 25 = 66');
    assert.strictEqual(stats.publishedWinners, 2, 'Published winners should count 2 winners');

    console.log('✓ calculateOrganizationStats tests passed');
}

console.log('--- ALL ORGANIZATION SERVICE TESTS PASSED SUCCESSFULLY ---');
