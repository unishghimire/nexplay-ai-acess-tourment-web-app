/**
 * Demo mode mock data for the Organization Panel.
 * Realistic Free Fire esports data — no lorem ipsum.
 * All Firestore APIs remain wired; this fallback activates when
 * collections return empty (demo mode) or while loading.
 */

export interface MockTeam {
  id: string;
  name: string;
  igid: string;
  players: { name: string; igid: string; role: 'leader' | 'member' }[];
  rosterLocked: boolean;
  banned: boolean;
  banReason?: string;
  strikes: number;
  registeredAt: string;
}

export interface MockScrimSlot {
  slotNumber: number;
  teamId: string | null;
  teamName: string | null;
  status: 'open' | 'filled' | 'reserved';
}

export interface MockScrim {
  id: string;
  title: string;
  game: string;
  format: 'battle-royale' | '5v5';
  slots: MockScrimSlot[];
  totalSlots: number;
  filledSlots: number;
  startTime: string;
  status: 'open' | 'live' | 'completed';
  entryFee: number;
  prizePool: number;
  recurring: boolean;
  recurrencePattern?: string;
}

export interface MockMatchRoom {
  id: string;
  tournamentId: string;
  tournamentName: string;
  roomId: string;
  roomPass: string;
  map: string;
  status: 'pending' | 'live' | 'completed';
  streamUrl?: string;
  createdAt: string;
}

export interface MockDispute {
  id: string;
  tournamentName: string;
  matchRoom: string;
  reportedBy: string;
  reason: string;
  screenshotUrl: string;
  status: 'pending' | 'reviewing' | 'resolved';
  filedAt: string;
}

export interface MockTransaction {
  id: string;
  type: 'entry_fee' | 'prize' | 'withdraw' | 'deposit' | 'sponsor';
  amount: number;
  method: string;
  refId: string;
  status: 'pending' | 'completed' | 'rejected';
  desc: string;
  timestamp: string;
}

export const mockTeams: MockTeam[] = [
  {
    id: 't1',
    name: 'Team Crimson',
    igid: 'FF-T001',
    players: [
      { name: 'RageBlade', igid: '284719305', role: 'leader' },
      { name: 'ShadowOP', igid: '583029174', role: 'member' },
      { name: 'VenomX', igid: '471920385', role: 'member' },
      { name: 'GhostRecon', igid: '839201746', role: 'member' },
    ],
    rosterLocked: true,
    banned: false,
    strikes: 1,
    registeredAt: '2026-07-28',
  },
  {
    id: 't2',
    name: 'Viper Esports',
    igid: 'FF-T002',
    players: [
      { name: 'VenomStrike', igid: '192837465', role: 'leader' },
      { name: 'NightFury', igid: '648291035', role: 'member' },
      { name: 'BlazeKing', igid: '374658129', role: 'member' },
      { name: 'ToxicAce', igid: '910283746', role: 'member' },
    ],
    rosterLocked: true,
    banned: false,
    strikes: 2,
    registeredAt: '2026-07-25',
  },
  {
    id: 't3',
    name: 'Lethal Esports',
    igid: 'FF-T003',
    players: [
      { name: 'SnipeMaster', igid: '564738291', role: 'leader' },
      { name: 'ClutchGod', igid: '283746510', role: 'member' },
      { name: 'HeadHunter', igid: '647382910', role: 'member' },
      { name: 'DarkLord', igid: '829103746', role: 'member' },
    ],
    rosterLocked: false,
    banned: false,
    strikes: 0,
    registeredAt: '2026-08-01',
  },
  {
    id: 't4',
    name: 'Phoenix Force',
    igid: 'FF-T004',
    players: [
      { name: 'FireBird', igid: '102938475', role: 'leader' },
      { name: 'AshKetchum', igid: '475829103', role: 'member' },
      { name: 'EmberBlade', igid: '738291046', role: 'member' },
      { name: 'ScorchKing', igid: '581029374', role: 'member' },
    ],
    rosterLocked: true,
    banned: false,
    strikes: 0,
    registeredAt: '2026-08-02',
  },
  {
    id: 't5',
    name: 'Omega Squad',
    igid: 'FF-T005',
    players: [
      { name: 'OmegaOne', igid: '394827156', role: 'leader' },
      { name: 'BetaStrike', igid: '627154839', role: 'member' },
      { name: 'GammaRay', igid: '483927156', role: 'member' },
    ],
    rosterLocked: false,
    banned: true,
    banReason: 'Cheating confirmed — auto-aim detected in match replay',
    strikes: 3,
    registeredAt: '2026-07-15',
  },
];

export const generateScrimSlots = (total: number, teams: MockTeam[]): MockScrimSlot[] => {
  return Array.from({ length: total }, (_, i) => {
    const team = i < teams.length ? teams[i] : null;
    return {
      slotNumber: i + 1,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      status: team ? 'filled' : 'open',
    } as MockScrimSlot;
  });
};

export const mockScrims: MockScrim[] = [
  {
    id: 's1',
    title: 'FF Pro League — BR Scrim Block A',
    game: 'Free Fire',
    format: 'battle-royale',
    slots: generateScrimSlots(20, mockTeams.slice(0, 4)),
    totalSlots: 20,
    filledSlots: 4,
    startTime: '2026-08-06T19:00',
    status: 'open',
    entryFee: 100,
    prizePool: 15000,
    recurring: true,
    recurrencePattern: 'Daily — 7:00 PM NPT',
  },
  {
    id: 's2',
    title: 'Squad Showdown — 5v5 Competitive',
    game: 'Free Fire',
    format: '5v5',
    slots: generateScrimSlots(10, mockTeams.slice(0, 3)),
    totalSlots: 10,
    filledSlots: 3,
    startTime: '2026-08-06T21:00',
    status: 'open',
    entryFee: 200,
    prizePool: 25000,
    recurring: true,
    recurrencePattern: 'Mon/Wed/Fri — 9:00 PM NPT',
  },
  {
    id: 's3',
    title: 'Winter Clash Qualifier Scrim',
    game: 'Free Fire',
    format: 'battle-royale',
    slots: generateScrimSlots(24, mockTeams),
    totalSlots: 24,
    filledSlots: 5,
    startTime: '2026-08-07T18:00',
    status: 'open',
    entryFee: 150,
    prizePool: 30000,
    recurring: false,
  },
];

export const mockMatchRooms: MockMatchRoom[] = [
  {
    id: 'r1',
    tournamentId: 's1',
    tournamentName: 'FF Pro League — BR Scrim Block A',
    roomId: '5240212',
    roomPass: 'ffpro2026',
    map: 'Bermuda — Clash Squad',
    status: 'live',
    streamUrl: 'https://youtube.com/live/nexplay-stream-1',
    createdAt: '2026-08-05 19:00',
  },
  {
    id: 'r2',
    tournamentId: 's2',
    tournamentName: 'Squad Showdown — 5v5 Competitive',
    roomId: '6193847',
    roomPass: 'squad5v5',
    map: 'Purgatory — 5v5',
    status: 'pending',
    createdAt: '2026-08-05 21:00',
  },
];

export const mockDisputes: MockDispute[] = [
  {
    id: 'd1',
    tournamentName: 'FF Pro League — BR Scrim Block A',
    matchRoom: '5240212',
    reportedBy: 'Team Crimson',
    reason: 'Opponent (Omega Squad) suspected of using auto-headshot hack. Reviewing kill cam clip.',
    screenshotUrl: '/mock-dispute-1.png',
    status: 'pending',
    filedAt: '2 hours ago',
  },
  {
    id: 'd2',
    tournamentName: 'Squad Showdown — 5v5',
    matchRoom: '6193847',
    reportedBy: 'Viper Esports',
    reason: 'Match room disconnected mid-round. Requesting rematch — room was unstable.',
    screenshotUrl: '/mock-dispute-2.png',
    status: 'reviewing',
    filedAt: '5 hours ago',
  },
];

export const mockTransactions: MockTransaction[] = [
  { id: 'tx1', type: 'entry_fee', amount: 400, method: 'Wallet', refId: 'ENT-482910', status: 'completed', desc: 'Entry fees — FF Pro League BR Scrim (4 teams)', timestamp: '2026-08-05 14:30' },
  { id: 'tx2', type: 'entry_fee', amount: 600, method: 'Wallet', refId: 'ENT-482911', status: 'completed', desc: 'Entry fees — Squad Showdown 5v5 (3 teams)', timestamp: '2026-08-05 14:15' },
  { id: 'tx3', type: 'sponsor', amount: 25000, method: 'Bank Transfer', refId: 'SPN-2026-001', status: 'completed', desc: 'Sponsorship — Red Bull Gaming Nepal', timestamp: '2026-08-03 10:00' },
  { id: 'tx4', type: 'prize', amount: 15000, method: 'Wallet', refId: 'PRZ-391028', status: 'pending', desc: 'Prize payout — Winter Clash Qualifier Winner', timestamp: '2026-08-02 16:45' },
  { id: 'tx5', type: 'withdraw', amount: 5000, method: 'eSewa', refId: 'WTH-581029', status: 'pending', desc: 'Withdrawal request to eSewa wallet', timestamp: '2026-08-01 11:20' },
  { id: 'tx6', type: 'entry_fee', amount: 750, method: 'Wallet', refId: 'ENT-482908', status: 'completed', desc: 'Entry fees — Winter Clash Qualifier (5 teams)', timestamp: '2026-07-31 13:00' },
];

export const mockActivityFeed = [
  { id: 'a1', icon: 'trophy', text: 'Team Crimson won FF Pro League — BR Scrim Block A', time: '2 mins ago', type: 'success' },
  { id: 'a2', icon: 'users', text: 'Phoenix Force registered for Winter Clash Qualifier', time: '15 mins ago', type: 'info' },
  { id: 'a3', icon: 'alert', text: 'Dispute filed: Omega Squad reported for suspected cheating', time: '1 hour ago', type: 'warn' },
  { id: 'a4', icon: 'dollar', text: 'Sponsorship received: Rs. 25,000 from Red Bull Gaming Nepal', time: '3 hours ago', type: 'success' },
  { id: 'a5', icon: 'radio', text: 'Match Room 5240212 broadcasted to 4 registered teams', time: '5 hours ago', type: 'info' },
  { id: 'a6', icon: 'shield', text: 'Roster locked for Viper Esports — 4 players confirmed', time: '6 hours ago', type: 'info' },
];

export const mockKPIs = {
  activeTournaments: 3,
  liveScrims: 1,
  totalTeams: 5,
  totalSlots: 54,
  filledSlots: 12,
  prizePool: 70000,
  monthlyRevenue: 27750,
  pendingPayouts: 20000,
  orgWalletBalance: 47250,
  escrowBalance: 15000,
};

export const mockTournaments = [
  {
    id: 'tour1',
    title: 'FF Pro League Season 3',
    game: 'Free Fire',
    status: 'live' as const,
    format: 'single_elimination',
    teamType: 'squad' as const,
    slots: 32,
    currentPlayers: 20,
    prizePool: 50000,
    entryFee: 300,
    startTime: '2026-08-05T18:00',
    roomId: '5240212',
    roomPass: 'ffpro2026',
    ytLink: 'https://youtube.com/live/nexplay-stream-1',
    map: 'Bermuda',
    bracketMatches: [
      { round: 1, match: 1, teamA: 'Team Crimson', teamB: 'Phoenix Force', winner: 'Team Crimson', scoreA: 14, scoreB: 7 },
      { round: 1, match: 2, teamA: 'Viper Esports', teamB: 'Lethal Esports', winner: 'Viper Esports', scoreA: 12, scoreB: 9 },
      { round: 1, match: 3, teamA: 'Omega Squad', teamB: 'Team Crimson B', winner: null, scoreA: 0, scoreB: 0 },
      { round: 2, match: 1, teamA: 'Team Crimson', teamB: 'Viper Esports', winner: null, scoreA: 0, scoreB: 0 },
    ],
  },
  {
    id: 'tour2',
    title: 'Winter Clash 2026 Qualifier',
    game: 'Free Fire',
    status: 'upcoming' as const,
    format: 'double_elimination',
    teamType: 'squad' as const,
    slots: 48,
    currentPlayers: 32,
    prizePool: 100000,
    entryFee: 200,
    startTime: '2026-08-12T18:00',
    roomId: '',
    roomPass: '',
    map: 'Purgatory',
    bracketMatches: [],
  },
  {
    id: 'tour3',
    title: 'Daily Squad Scrim Series',
    game: 'Free Fire',
    status: 'completed' as const,
    format: 'round_robin',
    teamType: 'squad' as const,
    slots: 16,
    currentPlayers: 16,
    prizePool: 20000,
    entryFee: 150,
    startTime: '2026-07-30T19:00',
    roomId: '3847561',
    roomPass: 'dailyscrim',
    map: 'Kalahari',
    bracketMatches: [],
  },
];
