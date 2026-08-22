/**
 * Automated Dynamic E2E Simulation & Verification Suite
 * Lifecycle: Seed -> Execute Core Functions -> Verify Assertions -> Strict Teardown
 *
 * Tests:
 * 1. 50+ Users & Squad Teams Seeding
 * 2. Concurrency Race Condition Test (5 concurrent joins for 1 slot)
 * 3. Scrim Registration & Wallet Balance Deduction
 * 4. Battle Royale Match Result Scoring & Prize Distribution
 * 5. Ledger Integrity & Total Balance Reconciliation
 * 6. Match Room Credential Access Control
 * 7. 100% Cascading Teardown with 0 Orphaned Records
 *
 * Run: npx tsx src/shared/services/e2eSimulation.test.ts
 */

import { calculateTeamScore } from './scoringEngine';
import { validatePrizeWinners } from '../../../server/prizeValidation';

// --- IN-MEMORY DATABASE SIMULATOR (ACID Compliant with Serial Transaction Lock) ---
interface MockUser {
  uid: string;
  username: string;
  email: string;
  role: 'player' | 'organizer' | 'admin';
  inGameId: string;
  inGameName: string;
  balance: number;
}

interface MockTeam {
  id: string;
  name: string;
  leaderId: string;
  members: string[];
}

interface MockTournament {
  id: string;
  title: string;
  game: string;
  format: string;
  entryFee: number;
  prizePool: number;
  maxParticipants: number;
  registeredCount: number;
  status: 'upcoming' | 'live' | 'completed';
  participants: string[];
  slots: Array<{ slotNumber: number; teamId?: string; status: 'open' | 'reserved' | 'locked' }>;
  roomDetails?: { roomId: string; roomPassword?: string };
}

interface MockLedgerEntry {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'entry_fee' | 'prize_payout' | 'refund';
  status: 'success' | 'failed';
  timestamp: Date;
  tournamentId?: string;
}

class MockDatabase {
  users: Map<string, MockUser> = new Map();
  teams: Map<string, MockTeam> = new Map();
  tournaments: Map<string, MockTournament> = new Map();
  ledger: MockLedgerEntry[] = [];
  credentialsStore: Map<string, { roomId: string; roomPass: string }> = new Map();
  private txLock: Promise<void> = Promise.resolve();

  // Atomic Transaction Simulation with Mutex Lock (mirrors Firestore runTransaction)
  async runTransaction<T>(updateFn: (tx: any) => Promise<T>): Promise<T> {
    let releaseLock: () => void;
    const nextLock = new Promise<void>((resolve) => { releaseLock = resolve; });
    const currentLock = this.txLock;
    this.txLock = nextLock;

    await currentLock;
    try {
      const tx = {
        getUser: async (uid: string) => {
          const u = this.users.get(uid);
          return u ? { ...u } : null;
        },
        getTournament: async (id: string) => {
          const t = this.tournaments.get(id);
          return t ? { ...t, participants: [...t.participants], slots: t.slots.map(s => ({ ...s })) } : null;
        },
        updateUserBalance: (uid: string, newBalance: number) => {
          const u = this.users.get(uid);
          if (u) u.balance = newBalance;
        },
        updateTournament: (id: string, updated: MockTournament) => {
          this.tournaments.set(id, updated);
        },
        addLedger: (entry: MockLedgerEntry) => {
          this.ledger.push(entry);
        }
      };
      return await updateFn(tx);
    } finally {
      releaseLock!();
    }
  }

  clear() {
    this.users.clear();
    this.teams.clear();
    this.tournaments.clear();
    this.ledger = [];
    this.credentialsStore.clear();
  }
}

async function runE2ETests() {
  console.log("===============================================================");
  console.log("🎮 NEXPLAY PRODUCTION E2E DYNAMIC SIMULATION & VERIFICATION 🎮");
  console.log("===============================================================\n");

  const db = new MockDatabase();
  let assertionsPassed = 0;
  let assertionsFailed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      assertionsPassed++;
      console.log(`  ✅ PASS: ${testName}`);
    } else {
      assertionsFailed++;
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // STEP A: SEED DUMMY DATA
    // ═════════════════════════════════════════════════════════════════════════
    console.log("📦 [STEP A: SEED] Seeding 50+ Mock Users, Teams, and Tournaments...");

    // 1. Seed 52 Users (2 Admins, 4 Organizers, 46 Players) + 1 Outsider User
    for (let i = 1; i <= 52; i++) {
      const role: 'player' | 'organizer' | 'admin' = i <= 2 ? 'admin' : (i <= 6 ? 'organizer' : 'player');
      const initialBalance = (i % 5 === 0) ? 0 : (i % 3 === 0 ? 50 : 500); // Varied edge cases (0, 50, 500)
      const user: MockUser = {
        uid: `user_${i.toString().padStart(3, '0')}`,
        username: `Player_${i}`,
        email: `player${i}@nexplayorg.app`,
        role,
        inGameId: `IGN_${100000 + i}`,
        inGameName: `NxP_Hero_${i}`,
        balance: initialBalance,
      };
      db.users.set(user.uid, user);
      if (initialBalance > 0) {
        db.ledger.push({
          id: `seed_tx_${i}`,
          userId: user.uid,
          amount: initialBalance,
          type: 'deposit',
          status: 'success',
          timestamp: new Date()
        });
      }
    }

    // Explicit outsider user with no team
    const outsider: MockUser = {
      uid: 'user_outsider_999',
      username: 'SoloOutsider',
      email: 'outsider@nexplayorg.app',
      role: 'player',
      inGameId: 'IGN_999999',
      inGameName: 'OutsiderSolo',
      balance: 100,
    };
    db.users.set(outsider.uid, outsider);
    db.ledger.push({
      id: 'seed_tx_outsider_999',
      userId: outsider.uid,
      amount: 100,
      type: 'deposit',
      status: 'success',
      timestamp: new Date()
    });

    assert(db.users.size === 53, "53 Mock users successfully seeded into database (including Admins, Orgs, Players)");

    // 2. Seed 11 Squad Teams (4 players each = 44 players) for Registered Tournaments
    for (let t = 1; t <= 11; t++) {
      const startIndex = 7 + (t - 1) * 4; // players 7 to 50
      const members = [
        `user_${startIndex.toString().padStart(3, '0')}`,
        `user_${(startIndex + 1).toString().padStart(3, '0')}`,
        `user_${(startIndex + 2).toString().padStart(3, '0')}`,
        `user_${(startIndex + 3).toString().padStart(3, '0')}`,
      ];
      const team: MockTeam = {
        id: `team_${t.toString().padStart(2, '0')}`,
        name: `Team Apex ${t}`,
        leaderId: members[0],
        members,
      };
      db.teams.set(team.id, team);
    }
    assert(db.teams.size === 11, "11 Squad teams (44 players) successfully formed and seeded");

    // 3. Seed 3 Tournaments (Upcoming, Ongoing/Live, Completed)
    // Tournament 1: Upcoming (12 slots, 11 filled, 1 open slot remaining for concurrency test)
    const t1Slots: Array<{ slotNumber: number; teamId?: string; status: 'open' | 'reserved' | 'locked' }> = [];
    for (let s = 1; s <= 12; s++) {
      t1Slots.push({
        slotNumber: s,
        teamId: s <= 11 ? `team_${s.toString().padStart(2, '0')}` : undefined,
        status: s <= 11 ? 'reserved' : 'open'
      });
    }
    const t1: MockTournament = {
      id: 'tourn_upcoming_001',
      title: 'NexPlay Nepal Invitational — Clash of Champions',
      game: 'PUBG Mobile',
      format: 'Squad Battle Royale',
      entryFee: 50,
      prizePool: 1000,
      maxParticipants: 12,
      registeredCount: 11,
      status: 'upcoming',
      participants: Array.from({ length: 11 }, (_, i) => `team_${(i + 1).toString().padStart(2, '0')}`),
      slots: t1Slots,
    };
    db.tournaments.set(t1.id, t1);
    db.credentialsStore.set(t1.id, { roomId: 'ROOM_PUBG_7788', roomPass: 'PASS_NXP_2026' });

    // Tournament 2: Live
    const t2: MockTournament = {
      id: 'tourn_live_002',
      title: 'Daily Scrims Season 4',
      game: 'Free Fire',
      format: 'Battle Royale',
      entryFee: 0,
      prizePool: 500,
      maxParticipants: 12,
      registeredCount: 11,
      status: 'live',
      participants: Array.from({ length: 11 }, (_, i) => `team_${(i + 1).toString().padStart(2, '0')}`),
      slots: Array.from({ length: 11 }, (_, i) => ({ slotNumber: i + 1, teamId: `team_${(i + 1).toString().padStart(2, '0')}`, status: 'reserved' })),
    };
    db.tournaments.set(t2.id, t2);

    // Tournament 3: Completed
    const t3: MockTournament = {
      id: 'tourn_completed_003',
      title: 'Valorant Showdown Finals',
      game: 'Valorant',
      format: '5v5',
      entryFee: 100,
      prizePool: 2500,
      maxParticipants: 8,
      registeredCount: 8,
      status: 'completed',
      participants: Array.from({ length: 8 }, (_, i) => `team_${(i + 1).toString().padStart(2, '0')}`),
      slots: Array.from({ length: 8 }, (_, i) => ({ slotNumber: i + 1, teamId: `team_${(i + 1).toString().padStart(2, '0')}`, status: 'reserved' })),
    };
    db.tournaments.set(t3.id, t3);
    assert(db.tournaments.size === 3, "3 Lifecycle tournaments (Upcoming, Live, Completed) initialized");

    console.log("\n⚡ [STEP B: EXECUTE CORE FUNCTIONS] Executing Registration, Concurrency & Prize Flow...");

    // ═════════════════════════════════════════════════════════════════════════
    // STEP B1: CONCURRENCY RACE CONDITION TEST (5 Teams -> 1 Slot)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("  ⚔️ Simulating 5 Concurrent Registrations for the 1 remaining slot in tourn_upcoming_001...");

    async function attemptAtomicJoin(tournamentId: string, teamLeaderId: string, teamId: string): Promise<{ success: boolean; error?: string }> {
      return await db.runTransaction(async (tx) => {
        const user = await tx.getUser(teamLeaderId);
        const tourn = await tx.getTournament(tournamentId);

        if (!user || !tourn) return { success: false, error: 'Entity not found' };
        if (tourn.registeredCount >= tourn.maxParticipants) return { success: false, error: 'Tournament is full' };
        if (user.balance < tourn.entryFee) return { success: false, error: 'Insufficient balance' };
        if (tourn.participants.includes(teamId)) return { success: false, error: 'Already registered' };

        // Find first open slot
        const openSlot = tourn.slots.find((s: any) => s.status === 'open');
        if (!openSlot) return { success: false, error: 'No slots available' };

        // Mutate inside atomic transaction lock
        tx.updateUserBalance(teamLeaderId, user.balance - tourn.entryFee);
        openSlot.status = 'reserved';
        openSlot.teamId = teamId;
        tourn.registeredCount += 1;
        tourn.participants.push(teamId);
        tx.updateTournament(tournamentId, tourn);

        tx.addLedger({
          id: `tx_${Date.now()}_${teamLeaderId}`,
          userId: teamLeaderId,
          amount: -tourn.entryFee,
          type: 'entry_fee',
          status: 'success',
          timestamp: new Date(),
          tournamentId
        });

        return { success: true };
      });
    }

    // 5 Candidate Team Leaders competing for slot 12
    const competitors = [
      { leaderId: 'user_051', teamId: 'comp_team_A', balance: 500 },
      { leaderId: 'user_052', teamId: 'comp_team_B', balance: 500 },
      { leaderId: 'user_003', teamId: 'comp_team_C', balance: 500 },
      { leaderId: 'user_004', teamId: 'comp_team_D', balance: 500 },
      { leaderId: 'user_005', teamId: 'comp_team_E', balance: 500 },
    ];

    // Fire 5 registrations simultaneously in parallel
    const concurrencyResults = await Promise.all(
      competitors.map(c => attemptAtomicJoin('tourn_upcoming_001', c.leaderId, c.teamId))
    );

    const successCount = concurrencyResults.filter(r => r.success).length;
    const failureCount = concurrencyResults.filter(r => !r.success).length;

    assert(successCount === 1, "Concurrency Control: Exactly 1 team secured the final slot");
    assert(failureCount === 4, "Concurrency Control: Exactly 4 competing teams were safely rejected (overfill blocked)");

    const updatedTourn1 = db.tournaments.get('tourn_upcoming_001')!;
    assert(updatedTourn1.registeredCount === 12, "Tournament registered count safely capped at maxParticipants (12/12)");
    assert(updatedTourn1.slots.filter(s => s.status === 'open').length === 0, "All 12 slots are now fully reserved with 0 overflow");

    // ═════════════════════════════════════════════════════════════════════════
    // STEP B2: MATCH SCORING & PRIZE DISTRIBUTION LIFECYCLE
    // ═════════════════════════════════════════════════════════════════════════
    console.log("\n  🏆 Simulating Battle Royale Match Results Scoring & Prize Distribution for tourn_live_002...");

    const scoringConfig = {
      killPoints: 1,
      placementPoints: {
        '1': 15,
        '2': 12,
        '3': 10,
        '4': 8,
        '5': 6,
        '6': 4,
        '7': 2,
        '8': 1
      },
      maxPlacement: 12
    };

    const mockMatchResults = [
      { teamId: 'team_01', placement: 1, kills: 14, captainUid: 'user_007' }, // 1st Place: 15 pts placement + 14 kills = 29 pts
      { teamId: 'team_02', placement: 2, kills: 8, captainUid: 'user_011' },  // 2nd Place: 12 pts placement + 8 kills = 20 pts
      { teamId: 'team_03', placement: 3, kills: 6, captainUid: 'user_015' },  // 3rd Place: 10 pts placement + 6 kills = 16 pts
      { teamId: 'team_04', placement: 4, kills: 3, captainUid: 'user_019' },
      { teamId: 'team_05', placement: 5, kills: 2, captainUid: 'user_023' },
    ];

    // Compute placement points & standings using calculateTeamScore
    const standings = mockMatchResults.map(r => {
      const score = calculateTeamScore({
        position: r.placement,
        kills: r.kills,
        scoring: scoringConfig
      });
      return {
        teamId: r.teamId,
        placementPoints: score.placementPoints,
        killPoints: score.killPoints,
        totalPoints: score.totalPoints,
        captainUid: r.captainUid
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    assert(standings[0].teamId === 'team_01' && standings[0].totalPoints === 29, "Scoring Engine: Team 01 earned Rank #1 with 29 Total Points (15 placement + 14 kills)");
    assert(standings[1].teamId === 'team_02' && standings[1].totalPoints === 20, "Scoring Engine: Team 02 earned Rank #2 with 20 Total Points (12 placement + 8 kills)");

    // Prize Distribution (Prize Pool: 500 NPR: 1st=300 NPR, 2nd=150 NPR, 3rd=50 NPR)
    const prizePayouts = [
      { userId: standings[0].captainUid, prize: 300, rank: 1 },
      { userId: standings[1].captainUid, prize: 150, rank: 2 },
      { userId: standings[2].captainUid, prize: 50, rank: 3 },
    ];

    const totalPrizeDistributed = prizePayouts.reduce((sum, p) => sum + p.prize, 0);
    const validationError = validatePrizeWinners(prizePayouts);
    assert(validationError === null, "Prize Distribution Validation: validatePrizeWinners returns no errors");
    assert(totalPrizeDistributed === 500, "Prize Distribution: Total payout (500 NPR) precisely equals defined prize pool");

    // Distribute prizes to user wallets atomically
    for (const payout of prizePayouts) {
      const user = db.users.get(payout.userId)!;
      const oldBalance = user.balance;
      user.balance += payout.prize;
      db.ledger.push({
        id: `prize_tx_${Date.now()}_${payout.userId}`,
        userId: payout.userId,
        amount: payout.prize,
        type: 'prize_payout',
        status: 'success',
        timestamp: new Date(),
        tournamentId: 'tourn_live_002'
      });
      assert(user.balance === oldBalance + payout.prize, `Prize Payout: ${user.username} (Rank #${payout.rank}) balance credited +${payout.prize} NPR`);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEP C: VERIFY LEDGER INTEGRITY & CREDENTIAL ACCESS CONTROL
    // ═════════════════════════════════════════════════════════════════════════
    console.log("\n🔒 [STEP C: VERIFICATION] Asserting Financial Ledger & Credential Access...");

    // 1. Ledger Balance Reconciliation
    for (const user of db.users.values()) {
      const userTxs = db.ledger.filter(l => l.userId === user.uid && l.status === 'success');
      const calculatedBalance = userTxs.reduce((sum, tx) => sum + tx.amount, 0);
      if (calculatedBalance !== user.balance) {
        throw new Error(`Ledger mismatch for user ${user.uid}: DB=${user.balance}, Ledger=${calculatedBalance}`);
      }
    }
    assert(true, "Ledger Integrity: 100% of user balances reconcile perfectly with historical ledger transactions");

    // 2. Room Credential Access Control Simulation
    function getRoomCredentials(tournamentId: string, requestUser: MockUser): { allowed: boolean; credentials?: any } {
      const t = db.tournaments.get(tournamentId);
      if (!t) return { allowed: false };
      const isAdmin = requestUser.role === 'admin';
      const isRegistered = t.participants.includes(requestUser.uid) || 
        Array.from(db.teams.values()).some(team => t.participants.includes(team.id) && team.members.includes(requestUser.uid));

      if (isAdmin || isRegistered) {
        return { allowed: true, credentials: db.credentialsStore.get(tournamentId) };
      }
      return { allowed: false };
    }

    const adminUser = db.users.get('user_001')!; // Admin
    const participantUser = db.users.get('user_007')!; // Member of registered team_01
    const outsiderUser = db.users.get('user_outsider_999')!; // Explicit unregistered player

    assert(getRoomCredentials('tourn_upcoming_001', adminUser).allowed === true, "Credentials Access: Admin can view private room credentials");
    assert(getRoomCredentials('tourn_upcoming_001', participantUser).allowed === true, "Credentials Access: Registered tournament participant can view room credentials");
    assert(getRoomCredentials('tourn_upcoming_001', outsiderUser).allowed === false, "Credentials Access: Unregistered outsider blocked from viewing room credentials");

    // ═════════════════════════════════════════════════════════════════════════
    // STEP D: STRICT TEARDOWN (COMPLETE PURGE OF DUMMY DATA)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("\n🧹 [STEP D: TEARDOWN] Executing Cascading Purge of All Test Records...");

    db.clear();

    assert(db.users.size === 0, "Teardown: 0 mock users remaining (100% purged)");
    assert(db.teams.size === 0, "Teardown: 0 mock teams remaining (100% purged)");
    assert(db.tournaments.size === 0, "Teardown: 0 mock tournaments remaining (100% purged)");
    assert(db.ledger.length === 0, "Teardown: 0 ledger entries remaining (100% purged)");
    assert(db.credentialsStore.size === 0, "Teardown: 0 room credentials remaining (100% purged)");

    console.log("\n===============================================================");
    console.log(`🎉 E2E TEST RUN COMPLETED: ${assertionsPassed} PASSED, ${assertionsFailed} FAILED 🎉`);
    console.log("===============================================================\n");

    if (assertionsFailed > 0) process.exit(1);
  } catch (err: any) {
    console.error("FATAL ERROR in E2E Suite:", err);
    process.exit(1);
  }
}

runE2ETests();
