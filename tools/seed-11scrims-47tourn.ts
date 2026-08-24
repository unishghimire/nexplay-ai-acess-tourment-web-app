import { db, admin } from '../server/shared.js';

async function seed11ScrimsAnd47Tourn() {
  console.log('🚀 Seeding Scrim (11 Teams / 12 Slots) and Tournament (47 Teams / 48 Slots)...');

  const hostUid = '7iMD1FBVZMhZpEAJdpyY4bv2p7m2'; // Admin / Organizer UID
  const hostName = 'Unish Ghimire (NexPlay Official)';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. GENERATE 47 UNIQUE TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  const teamNames = [
    'Skylightz Gaming', 'Deadly Sins', 'Team Hydra', 'Nepal Esports', 'Alpha Squad',
    '7Sea Esports', 'GodLike Nepal', 'Soul Warriors', 'Revenant Gaming', 'Entity Gaming',
    'Global Esports', 'Orange Rock', 'Team Secret', 'Fnatic Nepal', 'Nigma Galaxy',
    'EVOS Esports', 'RRQ Hoshi', 'ONIC Esports', 'Blacklist Int', 'Echo Esports',
    'Bigetron RA', 'FaZe Clan NP', 'Nova Esports', 'Team Liquid NP', 'Natus Vincere NP',
    'G2 Esports NP', 'Sentinels NP', 'Paper Rex NP', 'Cloud9 Nepal', 'Team Vitality NP',
    'T1 Gaming NP', 'Gen.G Nepal', 'DRX Esports NP', 'Rex Regum NP', 'Execration NP',
    'Talon Esports NP', 'Bleed Esports NP', 'BOOM Esports NP', 'Alter Ego NP', 'Geek Fam NP',
    'Team Flash NP', 'Bacon Time NP', 'Vampire Esports', 'Buriram United NP', 'TEM Gaming',
    'Attack All Around', 'XERXIA Esports'
  ];

  const allTeams = teamNames.map((name, i) => {
    const id = `team_${i + 1}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const tag = name.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase();
    return {
      id,
      name,
      tag,
      logoUrl: `https://images.unsplash.com/photo-${1540000000000 + (i * 123456) % 90000000}?w=100&auto=format&fit=crop`,
      leaderId: `leader_${i + 1}`,
      members: [`m_${i}_1`, `m_${i}_2`, `m_${i}_3`, `m_${i}_4`],
    };
  });

  // Batch seed teams
  const batch1 = db.batch();
  allTeams.forEach(t => {
    const tRef = db.collection('teams').doc(t.id);
    batch1.set(tRef, {
      id: t.id,
      name: t.name,
      tag: t.tag,
      logoUrl: t.logoUrl,
      leaderId: t.leaderId,
      members: t.members,
      memberCount: 4,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch1.commit();
  console.log(`✅ 47 Teams created in /teams`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LIVE SQUAD SCRIM WITH EXACTLY 11 TEAMS (SLOT 12 OPEN)
  // ═══════════════════════════════════════════════════════════════════════════
  const scrimId = 'scrim_ff_squad_11teams';
  const scrimSlots = [];

  for (let i = 1; i <= 12; i++) {
    if (i <= 11) {
      const team = allTeams[i - 1];
      scrimSlots.push({
        slotNumber: i,
        teamId: team.id,
        teamName: team.name,
        captainUid: i === 1 ? hostUid : team.leaderId,
        captainName: i === 1 ? 'Unish Ghimire' : `${team.name} Captain`,
        status: 'filled',
        reservedAt: new Date().toISOString(),
      });
    } else {
      scrimSlots.push({
        slotNumber: 12,
        status: 'open',
      });
    }
  }

  await db.collection('scrims').doc(scrimId).set({
    id: scrimId,
    title: '🔥 Free Fire Squad Scrim (11/12 Teams Joined - Test Lobby)',
    game: 'Free Fire',
    gameTitle: 'Free Fire',
    format: 'Squad',
    totalSlots: 12,
    filledSlots: 11,
    currentPlayers: 11,
    maxParticipants: 12,
    registeredCount: 11,
    entryFee: 50,
    prizePool: 600,
    status: 'open',
    hostUid: hostUid,
    hostId: hostUid,
    orgId: hostUid,
    userId: hostUid,
    createdBy: hostUid,
    organizerId: hostUid,
    organizerName: hostName,
    matchTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    matchDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    slots: scrimSlots,
    rules: '1. Strict 12-Slot Squad Format.\n2. Arrive 10 minutes prior.\n3. Emulators strictly blocked.',
    payoutPresets: 'top3',
    payoutDistribution: [
      { rank: 1, amount: 300, label: '1st Place (50%)' },
      { rank: 2, amount: 180, label: '2nd Place (30%)' },
      { rank: 3, amount: 120, label: '3rd Place (20%)' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('scrims').doc(scrimId).collection('credentials').doc('main').set({
    roomId: '776655',
    roomPass: 'scrim11teams',
    streamUrl: 'https://youtube.com/live/scrim_11teams_demo',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ Scrim created: ${scrimId} (11 Teams Joined, 1 Open Slot #12, Credentials Attached)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MULTI-STAGE TOURNAMENT WITH 47 TEAMS (4 GROUPS ROADMAP)
  // ═══════════════════════════════════════════════════════════════════════════
  const tournId = 'tourn_ff_championship_47teams';

  const groupATeams = allTeams.slice(0, 12);   // 12 teams
  const groupBTeams = allTeams.slice(12, 24);  // 12 teams
  const groupCTeams = allTeams.slice(24, 36);  // 12 teams
  const groupDTeams = allTeams.slice(36, 47);  // 11 teams (Total = 47)

  // Match 1 Completed Results in Group A (to test 6-column standings table)
  const groupAMatches = [
    {
      id: 'match_ga_1',
      round: 1,
      map: 'Bermuda',
      status: 'completed',
      results: [
        { teamId: groupATeams[0].id, teamName: groupATeams[0].name, placement: 1, kills: 16, placementPoints: 12, killPoints: 16, totalPoints: 28 },
        { teamId: groupATeams[1].id, teamName: groupATeams[1].name, placement: 2, kills: 11, placementPoints: 9, killPoints: 11, totalPoints: 20 },
        { teamId: groupATeams[2].id, teamName: groupATeams[2].name, placement: 3, kills: 8, placementPoints: 8, killPoints: 8, totalPoints: 16 },
        { teamId: groupATeams[3].id, teamName: groupATeams[3].name, placement: 4, kills: 6, placementPoints: 7, killPoints: 6, totalPoints: 13 },
        { teamId: groupATeams[4].id, teamName: groupATeams[4].name, placement: 5, kills: 5, placementPoints: 6, killPoints: 5, totalPoints: 11 },
        { teamId: groupATeams[5].id, teamName: groupATeams[5].name, placement: 6, kills: 4, placementPoints: 5, killPoints: 4, totalPoints: 9 },
        { teamId: groupATeams[6].id, teamName: groupATeams[6].name, placement: 7, kills: 3, placementPoints: 4, killPoints: 3, totalPoints: 7 },
        { teamId: groupATeams[7].id, teamName: groupATeams[7].name, placement: 8, kills: 2, placementPoints: 3, killPoints: 2, totalPoints: 5 },
        { teamId: groupATeams[8].id, teamName: groupATeams[8].name, placement: 9, kills: 1, placementPoints: 2, killPoints: 1, totalPoints: 3 },
        { teamId: groupATeams[9].id, teamName: groupATeams[9].name, placement: 10, kills: 1, placementPoints: 1, killPoints: 1, totalPoints: 2 },
        { teamId: groupATeams[10].id, teamName: groupATeams[10].name, placement: 11, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0 },
        { teamId: groupATeams[11].id, teamName: groupATeams[11].name, placement: 12, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0 },
      ]
    }
  ];

  await db.collection('tournaments').doc(tournId).set({
    id: tournId,
    title: '🏆 NexPlay Nepal Pro Series 2026 (47 Teams • 4-Group Roadmap)',
    game: 'Free Fire',
    gameTitle: 'Free Fire',
    format: 'Squad',
    type: 'tournament',
    stage: 'group_stage',
    currentRound: 1,
    status: 'upcoming',
    hostUid: hostUid,
    hostId: hostUid,
    orgId: hostUid,
    organizerId: hostUid,
    organizerName: hostName,
    maxParticipants: 48,
    registeredCount: 47,
    entryFee: 150,
    prizePool: 10000,
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600&auto=format&fit=crop',
    scoring: {
      killPoints: 1,
      placementPoints: { '1': 12, '2': 9, '3': 8, '4': 7, '5': 6, '6': 5, '7': 4, '8': 3, '9': 2, '10': 1, '11': 0, '12': 0 },
    },
    roadmap: [
      {
        roundNumber: 1,
        stageName: 'Qualifiers (Round 1)',
        numGroups: 4,
        teamsPerGroup: 12,
        qualificationRule: 3,
        status: 'active',
        description: '4 groups (47 teams) → Top 3 per group advance to Grand Finals (12 teams total)',
      },
      {
        roundNumber: 2,
        stageName: 'Grand Finals',
        numGroups: 1,
        teamsPerGroup: 12,
        qualificationRule: 1,
        status: 'upcoming',
        description: 'Top 12 qualifying teams battle for NPR 10,000 Prize Pool & National Trophy',
      }
    ],
    groups: [
      {
        id: 'group_A',
        name: 'Group A (Qualifiers)',
        roundNumber: 1,
        teamLimit: 12,
        teams: groupATeams,
        matches: groupAMatches,
        status: 'preview',
      },
      {
        id: 'group_B',
        name: 'Group B (Qualifiers)',
        roundNumber: 1,
        teamLimit: 12,
        teams: groupBTeams,
        matches: [],
        status: 'preview',
      },
      {
        id: 'group_C',
        name: 'Group C (Qualifiers)',
        roundNumber: 1,
        teamLimit: 12,
        teams: groupCTeams,
        matches: [],
        status: 'preview',
      },
      {
        id: 'group_D',
        name: 'Group D (Qualifiers)',
        roundNumber: 1,
        teamLimit: 12,
        teams: groupDTeams,
        matches: [],
        status: 'preview',
      }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Add credentials subcollections for all 4 tournament groups
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_A').set({
    roomId: '101010',
    roomPass: 'groupA_pass',
    streamUrl: 'https://youtube.com/live/group_A_live',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_B').set({
    roomId: '202020',
    roomPass: 'groupB_pass',
    streamUrl: 'https://youtube.com/live/group_B_live',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_C').set({
    roomId: '303030',
    roomPass: 'groupC_pass',
    streamUrl: 'https://youtube.com/live/group_C_live',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_D').set({
    roomId: '404040',
    roomPass: 'groupD_pass',
    streamUrl: 'https://youtube.com/live/group_D_live',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Tournament created: ${tournId} (47 Teams in 4 Groups, 6-col table in Group A, Credentials in all 4 groups)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. FRESH PENDING PAYMENT TRANSACTIONS (FOR ADMIN APPROVAL TESTS)
  // ═══════════════════════════════════════════════════════════════════════════
  const depTxId = `${hostUid}_DEP_esewa_1000_test`;
  await db.collection('transactions').doc(depTxId).set({
    id: depTxId,
    userId: hostUid,
    username: 'Unish Ghimire',
    type: 'deposit',
    amount: 1000,
    method: 'eSewa',
    status: 'pending',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    transactionCode: 'ESEWA-47TEAMS-1000',
    accountDetails: 'Sender Number: 9841999999\nTransaction Code/Name: ESEWA-47TEAMS-1000',
    proofUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=eSewa-1000-NPR-Proof',
    refId: 'DEP-47T-01',
  }, { merge: true });

  const withTxId = `${hostUid}_WIT_khalti_500_test`;
  await db.collection('transactions').doc(withTxId).set({
    id: withTxId,
    userId: hostUid,
    username: 'Unish Ghimire',
    type: 'withdrawal',
    amount: -500,
    method: 'Khalti',
    status: 'pending',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    accountDetails: 'Khalti ID: 9800000000 (Payout 47 Teams Test)',
    refId: 'WIT-47T-02',
    balanceBefore: 1250,
    balanceAfter: 750,
    deductPlayer: 500,
    deductOrg: 0,
  }, { merge: true });

  console.log('✅ Payment Requests created: NPR 1,000 Deposit + NPR 500 Withdrawal');
  console.log('\n🎉 ALL 11-TEAM SCRIM & 47-TEAM TOURNAMENT DEMO DATA READY! 🎉');
}

seed11ScrimsAnd47Tourn().catch(console.error);
