import { query, withTransaction } from '../index.js';

export interface DbUser {
  id: string;
  auth_id: string;
  email: string;
  username: string;
  role: 'player' | 'organizer' | 'admin';
  in_game_id?: string | null;
  in_game_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  profile_pic_url?: string | null;
  banner_url?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  status: 'active' | 'suspended' | 'banned';
  created_at: Date;
  updated_at: Date;
}

export const UserRepository = {
  async findById(id: string): Promise<DbUser | null> {
    const res = await query<DbUser>('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByAuthId(authId: string): Promise<DbUser | null> {
    const res = await query<DbUser>('SELECT * FROM users WHERE auth_id = $1', [authId]);
    return res.rows[0] || null;
  },

  async findByEmail(email: string): Promise<DbUser | null> {
    const res = await query<DbUser>('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return res.rows[0] || null;
  },

  async createOrUpdate(data: {
    id: string;
    authId: string;
    email: string;
    username: string;
    role?: 'player' | 'organizer' | 'admin';
    inGameId?: string;
    inGameName?: string;
    teamId?: string;
    teamName?: string;
  }): Promise<DbUser> {
    return withTransaction(async (client) => {
      const sql = `
        INSERT INTO users (id, auth_id, email, username, role, in_game_id, in_game_name, team_id, team_name, updated_at)
        VALUES ($1, $2, $3, $4, COALESCE($5, 'player'), $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (auth_id) DO UPDATE SET
          email = EXCLUDED.email,
          username = EXCLUDED.username,
          in_game_id = COALESCE(EXCLUDED.in_game_id, users.in_game_id),
          in_game_name = COALESCE(EXCLUDED.in_game_name, users.in_game_name),
          team_id = COALESCE(EXCLUDED.team_id, users.team_id),
          team_name = COALESCE(EXCLUDED.team_name, users.team_name),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const res = await client.query<DbUser>(sql, [
        data.id,
        data.authId,
        data.email,
        data.username,
        data.role || 'player',
        data.inGameId || null,
        data.inGameName || null,
        data.teamId || null,
        data.teamName || null,
      ]);

      // Ensure user wallet exists
      await client.query(`
        INSERT INTO wallets (id, owner_id, balance, reserved_balance, org_wallet_balance)
        VALUES ($1, $2, 0.00, 0.00, 0.00)
        ON CONFLICT (owner_id) DO NOTHING;
      `, [`wallet_${data.id}`, res.rows[0].id]);

      return res.rows[0];
    });
  },

  async updateRole(userId: string, role: 'player' | 'organizer' | 'admin'): Promise<DbUser | null> {
    const res = await query<DbUser>(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [role, userId]
    );
    return res.rows[0] || null;
  },

  async updateStatus(userId: string, status: 'active' | 'suspended' | 'banned'): Promise<DbUser | null> {
    const res = await query<DbUser>(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, userId]
    );
    return res.rows[0] || null;
  },
};
