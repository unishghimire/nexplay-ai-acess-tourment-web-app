import { db, admin } from '../server/shared.js';

async function seedFullInteractiveDemo() {
  console.log('🚀 Seeding Full Interactive Demo Data to Firestore...');

  const hostUid = '7iMD1FBVZMhZpEAJdpyY4bv2p7m2'; // Admin / Organizer UID
  const hostName = 'Unish Ghimire (NexPlay Official)';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  const teams = [
    { id: 'team_skl', name: 'Skylightz Gaming', tag: 'SKL', logoUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&auto=format&fit=crop', leaderId: hostUid, members: [hostUid, 'p1', 'p2', 'p3'] },
    { id: 'team_ds', name: 'Deadly Sins', tag: 'DS', logoUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&auto=format&fit=crop', leaderId: 'ds_lead', members: ['ds1', 'ds2', 'ds3', 'ds4'] },
    { id: 'team_hydra', name: 'Team Hydra', tag: 'HYDRA', logoUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=100&auto=format&fit=crop', leaderId: 'hydra_lead', members: ['h1', 'h2', 'h3', 'h4'] },
    { id: 'team_nepal', name: 'Nepal Esports', tag: 'NEPAL', logoUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100&auto=format&fit=crop', leaderId: 'nepal_lead', members: ['n1', 'n2', 'n3', 'n4'] },
    { id: 'team_alpha', name: 'Alpha Squad', tag: 'ALPHA', logoUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop', leaderId: 'alpha_lead', members: ['a1', 'a2', 'a3', 'a4'] },
    { id: 'team_7sea', name: '7Sea Esports', tag: '7SEA', logoUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=100&auto=format&fit=crop', leaderId: '7sea_lead', members: ['s1', 's2', 's3', 's4'] },
  ];

  for (const t of teams) {
    await db.collection('teams').doc(t.id).set({
      id: t.id,
      name: t.name,
      tag: t.tag,
      logoUrl: t.logoUrl,
      leaderId: t.leaderId,
      members: t.members,
      memberCount: t.members.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log('✅ Teams seeded: 6 teams created');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LIVE SQUAD SCRIM (12 SLOTS STRICT)
  // ═══════════════════════════════════════════════════════════════════════════
  const scrimId = 'scrim_ff_daily_squad_101';
  const initialSlots = [
    { slotNumber: 1, teamId: 'team_skl', teamName: 'Skylightz Gaming', captainUid: hostUid, captainName: 'Unish Ghimire', status: 'filled', reservedAt: new Date().toISOString() },
    { slotNumber: 2, teamId: 'team_ds', teamName: 'Deadly Sins', captainUid: 'ds_lead', captainName: 'Sin Leader', status: 'filled', reservedAt: new Date().toISOString() },
    { slotNumber: 3, teamId: 'team_hydra', teamName: 'Team Hydra', captainUid: 'hydra_lead', captainName: 'Hydra Cap', status: 'filled', reservedAt: new Date().toISOString() },
    { slotNumber: 4, teamId: 'team_nepal', teamName: 'Nepal Esports', captainUid: 'nepal_lead', captainName: 'Nepal Pro', status: 'filled', reservedAt: new Date().toISOString() },
    { slotNumber: 5, teamId: 'team_alpha', teamName: 'Alpha Squad', captainUid: 'alpha_lead', captainName: 'Alpha One', status: 'filled', reservedAt: new Date().toISOString() },
    { slotNumber: 6, teamId: 'team_7sea', teamName: '7Sea Esports', captainUid: '7sea_lead', captainName: 'Sea Boss', status: 'filled', reservedAt: new Date().toISOString() },
    { slotNumber: 7, status: 'open' },
    { slotNumber: 8, status: 'open' },
    { slotNumber: 9, status: 'open' },
    { slotNumber: 10, status: 'open' },
    { slotNumber: 11, status: 'open' },
    { slotNumber: 12, status: 'open' },
  ];

  await db.collection('scrims').doc(scrimId).set({
    id: scrimId,
    title: '🔥 Free Fire Daily Squad Pro Scrim #101',
    game: 'Free Fire',
    gameTitle: 'Free Fire',
    format: 'Squad',
    totalSlots: 12,
    filledSlots: 6,
    currentPlayers: 6,
    maxParticipants: 12,
    registeredCount: 6,
    entryFee: 0,
    prizePool: 500,
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
    slots: initialSlots,
    rules: '1. Emulators strictly blocked.\n2. Arrive in lobby 10 minutes prior.\n3. Fair play only.',
    payoutPresets: 'top3',
    payoutDistribution: [
      { rank: 1, amount: 250, label: '1st Place (50%)' },
      { rank: 2, amount: 150, label: '2nd Place (30%)' },
      { rank: 3, amount: 100, label: '3rd Place (20%)' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Add credentials subcollection for Scrim
  await db.collection('scrims').doc(scrimId).collection('credentials').doc('main').set({
    roomId: '889977',
    roomPass: 'scrim2026',
    streamUrl: 'https://youtube.com/live/demo_scrim_stream',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ Scrim seeded: ${scrimId} (12 slots, 6 filled, credentials attached)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MULTI-STAGE TOURNAMENT WITH ROADMAP & GROUPS
  // ═══════════════════════════════════════════════════════════════════════════
  const tournId = 'tourn_ff_championship_demo';
  const groupATeams = [
    { id: 'team_skl', name: 'Skylightz Gaming', logoUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&auto=format&fit=crop' },
    { id: 'team_ds', name: 'Deadly Sins', logoUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&auto=format&fit=crop' },
    { id: 'team_hydra', name: 'Team Hydra', logoUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=100&auto=format&fit=crop' },
    { id: 'team_nepal', name: 'Nepal Esports', logoUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100&auto=format&fit=crop' },
    { id: 'team_alpha', name: 'Alpha Squad', logoUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop' },
    { id: 'team_7sea', name: '7Sea Esports', logoUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=100&auto=format&fit=crop' },
    { id: 'team_g7', name: 'GodLike Nepal', logoUrl: '' },
    { id: 'team_g8', name: 'Soul Warriors', logoUrl: '' },
    { id: 'team_g9', name: 'Revenant Gaming', logoUrl: '' },
    { id: 'team_g10', name: 'Entity Gaming', logoUrl: '' },
    { id: 'team_g11', name: 'Global Esports', logoUrl: '' },
    { id: 'team_g12', name: 'Orange Rock', logoUrl: '' },
  ];

  const groupBTeams = [
    { id: 'team_b1', name: 'Team Secret', logoUrl: '' },
    { id: 'team_b2', name: 'Fnatic Nepal', logoUrl: '' },
    { id: 'team_b3', name: 'Nigma Galaxy', logoUrl: '' },
    { id: 'team_b4', name: 'EVOS Esports', logoUrl: '' },
    { id: 'team_b5', name: 'RRQ Hoshi', logoUrl: '' },
    { id: 'team_b6', name: 'ONIC Esports', logoUrl: '' },
    { id: 'team_b7', name: 'Blacklist Int', logoUrl: '' },
    { id: 'team_b8', name: 'Echo Esports', logoUrl: '' },
    { id: 'team_b9', name: 'Bigetron RA', logoUrl: '' },
    { id: 'team_b10', name: 'FaZe Clan NP', logoUrl: '' },
    { id: 'team_b11', name: 'Nova Esports', logoUrl: '' },
    { id: 'team_b12', name: 'Team Liquid NP', logoUrl: '' },
  ];

  // Match 1 Scored Results in Group A for 6-Column Standings Demonstration
  const groupAMatches = [
    {
      id: 'match_ga_1',
      round: 1,
      map: 'Bermuda',
      status: 'completed',
      results: [
        { teamId: 'team_skl', teamName: 'Skylightz Gaming', placement: 1, kills: 14, placementPoints: 12, killPoints: 14, totalPoints: 26 },
        { teamId: 'team_ds', teamName: 'Deadly Sins', placement: 2, kills: 9, placementPoints: 9, killPoints: 9, totalPoints: 18 },
        { teamId: 'team_hydra', teamName: 'Team Hydra', placement: 3, kills: 7, placementPoints: 8, killPoints: 7, totalPoints: 15 },
        { teamId: 'team_nepal', teamName: 'Nepal Esports', placement: 4, kills: 5, placementPoints: 7, killPoints: 5, totalPoints: 12 },
        { teamId: 'team_alpha', teamName: 'Alpha Squad', placement: 5, kills: 4, placementPoints: 6, killPoints: 4, totalPoints: 10 },
        { teamId: 'team_7sea', teamName: '7Sea Esports', placement: 6, kills: 3, placementPoints: 5, killPoints: 3, totalPoints: 8 },
        { teamId: 'team_g7', teamName: 'GodLike Nepal', placement: 7, kills: 2, placementPoints: 4, killPoints: 2, totalPoints: 6 },
        { teamId: 'team_g8', teamName: 'Soul Warriors', placement: 8, kills: 2, placementPoints: 3, killPoints: 2, totalPoints: 5 },
        { teamId: 'team_g9', teamName: 'Revenant Gaming', placement: 9, kills: 1, placementPoints: 2, killPoints: 1, totalPoints: 3 },
        { teamId: 'team_g10', teamName: 'Entity Gaming', placement: 10, kills: 1, placementPoints: 1, killPoints: 1, totalPoints: 2 },
        { teamId: 'team_g11', teamName: 'Global Esports', placement: 11, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0 },
        { teamId: 'team_g12', teamName: 'Orange Rock', placement: 12, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0 },
      ]
    }
  ];

  await db.collection('tournaments').doc(tournId).set({
    id: tournId,
    title: '🏆 NexPlay Free Fire Grand Championship (Multi-Stage Demo)',
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
    maxParticipants: 24,
    registeredCount: 24,
    entryFee: 100,
    prizePool: 5000,
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600&auto=format&fit=crop',
    scoring: {
      killPoints: 1,
      placementPoints: { '1': 12, '2': 9, '3': 8, '4': 7, '5': 6, '6': 5, '7': 4, '8': 3, '9': 2, '10': 1, '11': 0, '12': 0 },
    },
    roadmap: [
      {
        roundNumber: 1,
        stageName: 'Qualifiers (Group Stage)',
        numGroups: 2,
        teamsPerGroup: 12,
        qualificationRule: 6,
        status: 'active',
        description: '2 groups × 12 teams → top 6 per group advance to Grand Finals (12 teams total)',
      },
      {
        roundNumber: 2,
        stageName: 'Grand Finals',
        numGroups: 1,
        teamsPerGroup: 12,
        qualificationRule: 1,
        status: 'upcoming',
        description: '12 Finalist teams compete for the Championship & NPR 5,000 Prize Pool',
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
      }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Add credentials subcollections for tournament groups
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_A').set({
    roomId: '112233',
    roomPass: 'groupA2026',
    streamUrl: 'https://youtube.com/live/group_A_stream',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('tournaments').doc(tournId).collection('credentials').doc('group_group_B').set({
    roomId: '445566',
    roomPass: 'groupB2026',
    streamUrl: 'https://youtube.com/live/group_B_stream',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ Tournament seeded: ${tournId} (24 teams, 2 groups, 6-col results populated)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PENDING PAYMENT TRANSACTIONS FOR ADMIN 1-CLICK APPROVAL/REJECTION
  // ═══════════════════════════════════════════════════════════════════════════
  const depTxId = `${hostUid}_DEP_demo_esewa_500`;
  await db.collection('transactions').doc(depTxId).set({
    id: depTxId,
    userId: hostUid,
    username: 'Unish Ghimire',
    type: 'deposit',
    amount: 500,
    method: 'eSewa',
    status: 'pending',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    transactionCode: 'ESEWA-DEMO-77889',
    accountDetails: 'Sender Number: 9841000000\nTransaction Code/Name: ESEWA-DEMO-77889',
    proofUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=eSewa-Demo-Receipt-Proof',
    refId: 'DEP-DEMO-01',
  }, { merge: true });

  const withTxId = `${hostUid}_WIT_demo_khalti_300`;
  await db.collection('transactions').doc(withTxId).set({
    id: withTxId,
    userId: hostUid,
    username: 'Unish Ghimire',
    type: 'withdrawal',
    amount: -300,
    method: 'Khalti',
    status: 'pending',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    accountDetails: 'Khalti ID: 9800000000 (Unish Ghimire Official Payout)',
    refId: 'WIT-DEMO-02',
    balanceBefore: 750,
    balanceAfter: 450,
    deductPlayer: 300,
    deductOrg: 0,
  }, { merge: true });

  console.log('✅ Payment Transactions seeded: 1 Pending Deposit + 1 Pending Withdrawal');

  console.log('\n🎉 ALL DEMO DATA SUCCESSFULLY SEEDED! READY FOR LIVE BROWSER VERIFICATION 🎉');
}

seedFullInteractiveDemo().catch(console.error);
