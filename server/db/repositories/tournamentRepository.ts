import { query, withTransaction } from '../index.js';
import { WalletRepository } from './walletRepository.js';

export interface DbTournament {
  id: string;
  organization_id?: string | null;
  host_uid: string;
  title: string;
  game: string;
  type: string;
  match_type: 'tournament' | 'scrims';
  tournament_mode: 'POINTS' | 'PER_KILL_REWARD';
  format: string;
  team_type: 'solo' | 'duo' | 'squad';
  team_size: number;
  entry_fee: number;
  prize_pool: number;
  currency: string;
  slots: number;
  filled_slots: number;
  current_players: number;
  status: string;
  funding_status: string;
  required_funding: number;
  reserved_funding: number;
  stage: string;
  current_round: number;
  map?: string | null;
  banner_url?: string | null;
  rules?: string | null;
  scoring_snapshot?: any;
  reward_snapshot?: any;
  roadmap?: any;
  prize_distribution?: any;
  start_time: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DbRegistration {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id?: string | null;
  team_name: string;
  in_game_id?: string | null;
  in_game_name?: string | null;
  teammates?: any;
  slot_number?: number | null;
  status: string;
  registered_at: Date;
}

export const TournamentRepository = {
  async findById(id: string): Promise<DbTournament | null> {
    const res = await query<DbTournament>(
      `SELECT id, organization_id, host_uid, title, game, type, match_type, tournament_mode, format, team_type, team_size,
              entry_fee::float, prize_pool::float, currency, slots, filled_slots, current_players, status, funding_status,
              required_funding::float, reserved_funding::float, stage, current_round, map, banner_url, rules, scoring_snapshot,
              reward_snapshot, roadmap, prize_distribution, start_time, created_at, updated_at
       FROM tournaments WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  },

  async list(filters?: { status?: string; game?: string; matchType?: string; hostUid?: string; limit?: number }): Promise<DbTournament[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.game) {
      conditions.push(`game = $${paramIndex++}`);
      params.push(filters.game);
    }
    if (filters?.matchType) {
      conditions.push(`match_type = $${paramIndex++}`);
      params.push(filters.matchType);
    }
    if (filters?.hostUid) {
      conditions.push(`host_uid = $${paramIndex++}`);
      params.push(filters.hostUid);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = `LIMIT ${Math.min(filters?.limit || 50, 100)}`;

    const res = await query<DbTournament>(
      `SELECT id, organization_id, host_uid, title, game, type, match_type, tournament_mode, format, team_type, team_size,
              entry_fee::float, prize_pool::float, currency, slots, filled_slots, current_players, status, funding_status,
              required_funding::float, reserved_funding::float, stage, current_round, map, banner_url, start_time, created_at, updated_at
       FROM tournaments ${whereClause} ORDER BY start_time ASC ${limitClause}`,
      params
    );
    return res.rows;
  },

  async create(data: {
    id: string;
    organizationId?: string;
    hostUid: string;
    title: string;
    game: string;
    type?: string;
    matchType?: 'tournament' | 'scrims';
    tournamentMode?: 'POINTS' | 'PER_KILL_REWARD';
    format?: string;
    teamType?: 'solo' | 'duo' | 'squad';
    entryFee?: number;
    prizePool?: number;
    slots: number;
    startTime: Date;
    rules?: string;
    scoringSnapshot?: any;
    rewardSnapshot?: any;
    prizeDistribution?: any;
  }): Promise<DbTournament> {
    const entryFee = Number(data.entryFee || 0);
    const prizePool = Number(data.prizePool || 0);
    const requiredFunding = prizePool;
    const initialStatus = requiredFunding > 0 ? 'pending_funding' : 'upcoming';
    const fundingStatus = requiredFunding > 0 ? 'PENDING_FUNDING' : 'NOT_REQUIRED';

    const sql = `
      INSERT INTO tournaments (
        id, organization_id, host_uid, title, game, type, match_type, tournament_mode, format, team_type,
        entry_fee, prize_pool, slots, filled_slots, current_players, status, funding_status, required_funding,
        reserved_funding, rules, scoring_snapshot, reward_snapshot, prize_distribution, start_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, $14, $15, $16, 0, $17, $18, $19, $20, $21)
      RETURNING *;
    `;

    const res = await query<DbTournament>(sql, [
      data.id,
      data.organizationId || null,
      data.hostUid,
      data.title,
      data.game,
      data.type || 'Battle Royale',
      data.matchType || 'tournament',
      data.tournamentMode || 'POINTS',
      data.format || 'single_elimination',
      data.teamType || 'squad',
      entryFee,
      prizePool,
      data.slots,
      initialStatus,
      fundingStatus,
      requiredFunding,
      data.rules || null,
      JSON.stringify(data.scoringSnapshot || {}),
      JSON.stringify(data.rewardSnapshot || {}),
      JSON.stringify(data.prizeDistribution || []),
      data.startTime,
    ]);

    return res.rows[0];
  },

  /**
   * Authoritative activation of tournament with prize pool fund reservation.
   */
  async activateTournament(tournamentId: string, hostUid: string): Promise<DbTournament> {
    return withTransaction(async (client) => {
      const tRes = await client.query<DbTournament>(
        'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
        [tournamentId]
      );
      if (tRes.rows.length === 0) throw new Error('Tournament not found');

      const t = tRes.rows[0];
      if (t.host_uid !== hostUid) throw new Error('Unauthorized to activate this tournament');

      if (t.funding_status === 'RESERVED' || t.status === 'upcoming' || t.status === 'open') {
        return t; // Already active
      }

      const required = Number(t.required_funding || t.prize_pool || 0);
      if (required > 0) {
        // Reserve funds from host wallet
        await WalletRepository.reserveTournamentPrize(hostUid, required, tournamentId, t.title);

        await client.query(
          `UPDATE tournaments SET
            funding_status = 'RESERVED',
            reserved_funding = $1,
            status = 'upcoming',
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [required, tournamentId]
        );
      } else {
        await client.query(
          `UPDATE tournaments SET status = 'upcoming', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [tournamentId]
        );
      }

      const updated = await client.query<DbTournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
      return updated.rows[0];
    });
  },

  /**
   * Register user or team with atomic slot allocation and entry fee deduction.
   */
  async registerParticipant(data: {
    tournamentId: string;
    userId: string;
    teamId?: string;
    teamName: string;
    inGameId?: string;
    inGameName?: string;
    teammates?: string[];
    slotNumber?: number;
  }): Promise<{ registration: DbRegistration; newBalance: number }> {
    return withTransaction(async (client) => {
      // 1. Lock tournament record
      const tRes = await client.query<DbTournament>(
        'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
        [data.tournamentId]
      );
      if (tRes.rows.length === 0) throw new Error('Tournament not found');

      const t = tRes.rows[0];
      if (['completed', 'cancelled', 'live'].includes(t.status)) {
        throw new Error('Tournament registration is closed');
      }
      if (t.filled_slots >= t.slots) {
        throw new Error('Tournament is full');
      }

      // 2. Deduct entry fee if required
      let newBalance = 0;
      if (t.entry_fee > 0) {
        const debit = await WalletRepository.deductTournamentEntry(
          data.userId,
          Number(t.entry_fee),
          t.id,
          t.title
        );
        newBalance = debit.newBalance;
      }

      // 3. Insert registration record
      const regId = `reg_${data.tournamentId}_${data.userId}`;
      const regRes = await client.query<DbRegistration>(
        `INSERT INTO tournament_registrations (
          id, tournament_id, user_id, team_id, team_name, in_game_id, in_game_name, teammates, slot_number, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved')
        RETURNING *;`,
        [
          regId,
          data.tournamentId,
          data.userId,
          data.teamId || null,
          data.teamName,
          data.inGameId || null,
          data.inGameName || null,
          JSON.stringify(data.teammates || []),
          data.slotNumber || (t.filled_slots + 1),
        ]
      );

      // 4. Increment filled slots & current players
      await client.query(
        `UPDATE tournaments SET
          filled_slots = filled_slots + 1,
          current_players = current_players + 1,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [data.tournamentId]
      );

      return { registration: regRes.rows[0], newBalance };
    });
  },

  /**
   * Leave tournament with atomic slot release and refund.
   */
  async leaveParticipant(tournamentId: string, userId: string): Promise<{ success: boolean; newBalance: number }> {
    return withTransaction(async (client) => {
      const tRes = await client.query<DbTournament>(
        'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
        [tournamentId]
      );
      if (tRes.rows.length === 0) throw new Error('Tournament not found');

      const t = tRes.rows[0];
      if (['live', 'completed', 'cancelled'].includes(t.status)) {
        throw new Error('Cannot leave a tournament that has already started or ended');
      }

      // Delete registration
      const regRes = await client.query<DbRegistration>(
        'DELETE FROM tournament_registrations WHERE tournament_id = $1 AND user_id = $2 RETURNING *',
        [tournamentId, userId]
      );
      if (regRes.rows.length === 0) throw new Error('Not registered for this tournament');

      // Refund entry fee
      let newBalance = 0;
      if (t.entry_fee > 0) {
        const refund = await WalletRepository.refundTournamentEntry(
          userId,
          Number(t.entry_fee),
          t.id,
          t.title
        );
        newBalance = refund.newBalance;
      }

      // Decrement slot count
      await client.query(
        `UPDATE tournaments SET
          filled_slots = GREATEST(0, filled_slots - 1),
          current_players = GREATEST(0, current_players - 1),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [tournamentId]
      );

      return { success: true, newBalance };
    });
  },
};
