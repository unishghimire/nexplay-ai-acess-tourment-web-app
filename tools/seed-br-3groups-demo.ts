import { db, admin } from '../server/shared.js';

async function seedBr3GroupsDemo() {
  console.log('🧹 Purging old demo tournaments and scrims...');

  const hostUid = '7iMD1FBVZMhZpEAJdpyY4bv2p7m2'; // Admin / Organizer UID
  const hostName = 'Unish Ghimire (NexPlay Official)';

  // 1. Delete previous demo tournaments and scrims
  const oldTournIds = [
    'tourn_ff_championship_demo',
    'tourn_ff_championship_47teams',
    'tourn_ff_pro_circuit_2026',
    'demo-tourn-1',
    'demo-tourn-2'
  ];

  for (const id of oldTournIds) {
    try {
      // delete credentials subcollections
      const credSnaps = await db.collection('tournaments').doc(id).collection('credentials').get();
      for (const c of credSnaps.docs) {
        await c.ref.delete();
      }
      await db.collection('tournaments').doc(id).delete();
    } catch {
      // ignore
    }
  }

  const oldScrimIds = [
    'scrim_ff_daily_squad_101',
    'scrim_ff_squad_11teams',
    'demo-scrim-1',
    'demo-scrim-2'
  ];

  for (const id of oldScrimIds) {
    try {
      const credSnaps = await db.collection('scrims').doc(id).collection('credentials').get();
      for (const c of credSnaps.docs) {
        await c.ref.delete();
      }
      await db.collection('scrims').doc(id).delete();
    } catch {
      // ignore
    }
  }

  console.log('✅ Cleaned up old demo records');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CREATE 36 TEAMS (12 TEAMS PER GROUP STRICTLY)
  // ═══════════════════════════════════════════════════════════════════════════
  const teamNames = [
    // Group A (12 Teams)
    'Skylightz Gaming', 'Deadly Sins', 'Team Hydra', 'Nepal Esports', 'Alpha Squad',
    '7Sea Esports', 'GodLike Nepal', 'Soul Warriors', 'Revenant Gaming', 'Entity Gaming',
    'Global Esports', 'Orange Rock',

    // Group B (12 Teams)
    'Team Secret', 'Fnatic Nepal', 'Nigma Galaxy', 'EVOS Esports', 'RRQ Hoshi',
    'ONIC Esports', 'Blacklist Int', 'Echo Esports', 'Bigetron RA', 'FaZe Clan NP',
    'Nova Esports', 'Team Liquid NP',

    // Group C (12 Teams)
    'Natus Vincere NP', 'G2 Esports NP', 'Sentinels NP', 'Paper Rex NP', 'Cloud9 Nepal',
    'Team Vitality NP', 'T1 Gaming NP', 'Gen.G Nepal', 'DRX Esports NP', 'Rex Regum NP',
    'Execration NP', 'Talon Esports NP'
  ];

  const allTeams = teamNames.map((name, i) => {
    const id = `team_${i + 1}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const tag = name.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase();
    return {
      id,
      name,
      tag,
      logoUrl: `https://images.unsplash.com/photo-${1540000000000 + (i * 345678) % 90000000}?w=100&auto=format&fit=crop`,
      leaderId: i === 0 ? hostUid : `leader_${i + 1}`,
      members: [`m_${i}_1`, `m_${i}_2`, `m_${i}_3`, `m_${i}_4`],
    };
  });

  const batch = db.batch();
  allTeams.forEach(t => {
    const tRef = db.collection('teams').doc(t.id);
    batch.set(tRef, {
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
  await batch.commit();
  console.log('✅ 36 Teams created in /teams');

  // Partition into 3 Groups (Strictly 12 Teams Per Group/Map)
  const groupATeams = allTeams.slice(0, 12);  // 12 teams
  const groupBTeams = allTeams.slice(12, 24); // 12 teams
  const groupCTeams = allTeams.slice(24, 36); // 12 teams

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. BATTLE ROYALE TOURNAMENT (3 GROUPS • 12 TEAMS/MAP • PTS + KILL + TOTAL)
  // ═══════════════════════════════════════════════════════════════════════════
  const tournId = 'tourn_ff_br_3groups_36teams';

  // Group A Match 1 Result (Standard 6-Column Standings Table: [# | LOGO | NAME | KILL | PLACEMENT | TOTAL])
  const groupAMatches = [
    {
      id: 'match_ga_1',
      round: 1,
      map: 'Bermuda',
      status: 'completed',
      results: [
        { teamId: groupATeams[0].id, teamName: groupATeams[0].name, placement: 1, kills: 15, placementPoints: 12, killPoints: 15, totalPoints: 27 },
        { teamId: groupATeams[1].id, teamName: groupATeams[1].name, placement: 2, kills: 10, placementPoints: 9, killPoints: 10, totalPoints: 19 },
        { teamId: groupATeams[2].id, teamName: groupATeams[2].name, placement: 3, kills: 8, placementPoints: 8, killPoints: 8, totalPoints: 16 },
        { teamId: groupATeams[3].id, teamName: groupATeams[3].name, placement: 4, kills: 6, placementPoints: 7, killPoints: 6, totalPoints: 13 },
        { teamId: groupATeams[4].id, teamName: groupATeams[4].name, placement: 5, kills: 5, placementPoints: 6, killPoints: 5, totalPoints: 11 },
        { teamId: groupATeams[5].id, teamName: groupATeams[5].name, placement: 6, kills: 4, placementPoints: 5, killPoints: 4, totalPoints: 9 },
        { teamId: groupATeams[6].id, teamName: groupATeams[6].name, placement: 7, kills: 3, placementPoints: 4, killPoints: 3, totalPoints: 7 },
        { teamId: groupATeams[7].id, teamName: groupATeams[7].name, placement: 8, kills: 2, placementPoints: 3, killPoints: 2, totalPoints: 5 },
        { teamId: groupATeams[8].id, teamName: groupATeams[8].name, placement: 9, kills: 2, placementPoints: 2, killPoints: 2, totalPoints: 4 },
        { teamId: groupATeams[9].id, teamName: groupATeams[9].name, placement: 10, kills: 1, placementPoints: 1, killPoints: 1, totalPoints: 2 },
        { teamId: groupATeams[10].id, teamName: groupATeams[10].name, placement: 11, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0 },
        { teamId: groupATeams[11].id, teamName: groupATeams[11].name, placement: 12, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0 },
      ]
    }
  ];

  await db.collection('tournaments').doc(tournId).set({
    id: tournId,
    title: '🏆 Free Fire Battle Royale Pro Championship (3 Groups • 12 Teams/Map)',
    game: 'Free Fire',
    gameTitle: 'Free Fire',
    format: 'Battle Royale',
    type: 'Battle Royale',
    stage: 'group_stage',
    currentRound: 1,
    status: 'upcoming',
    hostUid: hostUid,
    hostId: hostUid,
    orgId: hostUid,
    organizerId: hostUid,
    organizerName: hostName,
    maxParticipants: 36,
    registeredCount: 36,
    entryFee: 150,
    prizePool: 15000,
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600&auto=format&fit=crop',
    scoring: {
      killPoints: 1,
      placementPoints: { '1': 12, '2': 9, '3': 8, '4': 7, '5': 6, '6': 5, '7': 4, '8': 3, '9': 2, '10': 1, '11': 0, '12': 0 },
    },
    roadmap: [
      {
        roundNumber: 1,
        stageName: 'Qualifiers (3 Groups × 12 Teams)',
        numGroups: 3,
        teamsPerGroup: 12,
        qualificationRule: 4,
        status: 'active',
        description: '3 Groups (36 Teams total) → Top 4 teams per group advance to Grand Finals (12 Finalist Teams)',
      },
      {
        roundNumber: 2,
        stageName: 'Grand Finals (1 Lobby × 12 Teams)',
        numGroups: 1,
        teamsPerGroup: 12,
        qualificationRule: 1,
        status: 'upcoming',
        description: '12 Finalist Teams battle for the Grand Championship & NPR 15,000 Prize Pool',
      }
    ],
    groups: [
      {
        id: 'group_A',
        name: 'Group A (Qualifiers - 12 Teams)',
        roundNumber: 1,
        teamLimit: 12,
        teams: groupATeams,
        matches: groupAMatches,
        status: 'preview',
      },
      {
        id: 'group_B',
        name: 'Group B (Qualifiers - 12 Teams)',
        roundNumber: 1,
        teamLimit: 12,
        teams: groupBTeams,
        matches: [],
        status: 'preview',
      },
      {
        id: 'group_C',
        name: 'Group C (Qualifiers - 12 Teams)',
        roundNumber: 1,
        teamLimit: 12,
        teams: groupCTeams,
        matches: [],
        status: 'preview',
      }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Add room credentials subcollections for all 3 groups
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_A').set({
    roomId: '334455',
    roomPass: 'grpA_pass',
    streamUrl: 'https://youtube.com/live/ff_grpa_stream',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_B').set({
    roomId: '667788',
    roomPass: 'grpB_pass',
    streamUrl: 'https://youtube.com/live/ff_grpb_stream',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_C').set({
    roomId: '990011',
    roomPass: 'grpC_pass',
    streamUrl: 'https://youtube.com/live/ff_grpc_stream',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Battle Royale Tournament created: ${tournId} (3 Groups × 12 Teams, 6-col standings table in Group A)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LIVE SQUAD SCRIM (12 SLOTS STRICT • 11 FILLED • 1 OPEN)
  // ═══════════════════════════════════════════════════════════════════════════
  const scrimId = 'scrim_ff_squad_12slots';
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
    title: '🔥 Free Fire Squad Scrim #202 (11/12 Teams • Slot #12 Open)',
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
    matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    matchDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
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
    roomId: '998877',
    roomPass: 'scrim2026pass',
    streamUrl: 'https://youtube.com/live/ff_scrim_stream',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ Scrim created: ${scrimId} (12 slots, 11 filled, 1 open slot #12)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. 4V4 CLASH SQUAD INVITATIONAL TOURNAMENT (HEAD-TO-HEAD FORMAT)
  // ═══════════════════════════════════════════════════════════════════════════
  const clashId = 'tourn_ff_4v4_clash_squad';
  await db.collection('tournaments').doc(clashId).set({
    id: clashId,
    title: '⚡ Free Fire 4v4 Clash Squad Invitational (8 Teams Knockout)',
    game: 'Free Fire',
    gameTitle: 'Free Fire',
    format: '4v4',
    type: '4v4',
    stage: 'group_stage',
    currentRound: 1,
    status: 'upcoming',
    hostUid: hostUid,
    hostId: hostUid,
    orgId: hostUid,
    organizerId: hostUid,
    organizerName: hostName,
    maxParticipants: 8,
    registeredCount: 8,
    entryFee: 100,
    prizePool: 3000,
    startDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop',
    groups: [
      {
        id: 'group_4v4_A',
        name: 'Bracket Round 1 (4v4 Matches)',
        roundNumber: 1,
        teamLimit: 8,
        teams: allTeams.slice(0, 8),
        matches: [
          {
            id: 'match_4v4_1',
            round: 1,
            team1Id: allTeams[0].id,
            team2Id: allTeams[1].id,
            team1Name: allTeams[0].name,
            team2Name: allTeams[1].name,
            score1: 7,
            score2: 4,
            status: 'completed',
            winnerId: allTeams[0].id,
          },
          {
            id: 'match_4v4_2',
            round: 1,
            team1Id: allTeams[2].id,
            team2Id: allTeams[3].id,
            team1Name: allTeams[2].name,
            team2Name: allTeams[3].name,
            score1: 7,
            score2: 5,
            status: 'completed',
            winnerId: allTeams[2].id,
          }
        ],
        status: 'preview',
      }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`✅ 4v4 Clash Squad Tournament created: ${clashId}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. PENDING DEPOSIT & WITHDRAWAL TRANSACTIONS FOR 1-CLICK APPROVAL TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  const depTxId = `${hostUid}_DEP_esewa_3groups_1500`;
  await db.collection('transactions').doc(depTxId).set({
    id: depTxId,
    userId: hostUid,
    username: 'Unish Ghimire',
    type: 'deposit',
    amount: 1500,
    method: 'eSewa',
    status: 'pending',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    transactionCode: 'ESEWA-3GROUPS-1500',
    accountDetails: 'Sender Number: 9841234567\nTransaction Code: ESEWA-3GROUPS-1500',
    proofUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=eSewa-Deposit-1500-NPR',
    refId: 'DEP-3G-01',
  }, { merge: true });

  const withTxId = `${hostUid}_WIT_khalti_3groups_600`;
  await db.collection('transactions').doc(withTxId).set({
    id: withTxId,
    userId: hostUid,
    username: 'Unish Ghimire',
    type: 'withdrawal',
    amount: -600,
    method: 'Khalti',
    status: 'pending',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    accountDetails: 'Khalti ID: 9800000000 (Unish Ghimire Official Payout)',
    refId: 'WIT-3G-02',
    balanceBefore: 1500,
    balanceAfter: 900,
    deductPlayer: 600,
    deductOrg: 0,
  }, { merge: true });
  console.log('✅ Payment Requests created: NPR 1,500 Deposit + NPR 600 Withdrawal');

  console.log('\n🎉 NEW 3-GROUP BATTLE ROYALE & 4V4 DEMO DATA CREATED SUCCESSFULLY! 🎉');
}

seedBr3GroupsDemo().catch(console.error);
