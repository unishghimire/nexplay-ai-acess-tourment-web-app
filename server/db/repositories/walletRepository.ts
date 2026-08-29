import { query, withTransaction } from '../index.js';

export interface DbWallet {
  id: string;
  owner_id: string;
  balance: number;
  reserved_balance: number;
  org_wallet_balance: number;
  currency: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbWalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: string;
  amount: number;
  method?: string | null;
  ref_id?: string | null;
  status: string;
  tournament_id?: string | null;
  description?: string | null;
  proof_url?: string | null;
  balance_before?: number | null;
  balance_after?: number | null;
  confirmed_by?: string | null;
  created_at: Date;
}

export const WalletRepository = {
  async getWallet(ownerId: string): Promise<DbWallet | null> {
    const res = await query<DbWallet>(
      'SELECT id, owner_id, balance::float, reserved_balance::float, org_wallet_balance::float, currency, status, created_at, updated_at FROM wallets WHERE owner_id = $1',
      [ownerId]
    );
    return res.rows[0] || null;
  },

  async getTransactions(userId: string, limit = 50): Promise<DbWalletTransaction[]> {
    const res = await query<DbWalletTransaction>(
      'SELECT id, wallet_id, user_id, type, amount::float, method, ref_id, status, tournament_id, description, proof_url, balance_before::float, balance_after::float, confirmed_by, created_at FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return res.rows;
  },

  /**
   * Authoritative fund reservation for tournament prize pool escrow.
   * Ensures available balance (balance - reserved_balance) >= amount with row-level locking (FOR UPDATE).
   */
  async reserveTournamentPrize(
    ownerId: string,
    amount: number,
    tournamentId: string,
    tournamentTitle: string
  ): Promise<{ success: boolean; newReserved: number; available: number }> {
    if (amount <= 0) return { success: true, newReserved: 0, available: 0 };

    return withTransaction(async (client) => {
      // 1. Lock wallet row exclusively
      const walletRes = await client.query<DbWallet>(
        'SELECT id, owner_id, balance::float, reserved_balance::float, org_wallet_balance::float FROM wallets WHERE owner_id = $1 FOR UPDATE',
        [ownerId]
      );
      if (walletRes.rows.length === 0) {
        throw new Error('Wallet not found for owner');
      }

      const wallet = walletRes.rows[0];
      const available = wallet.balance - wallet.reserved_balance;

      if (available < amount) {
        throw new Error(`Insufficient available balance (Available: NPR ${available.toFixed(2)}, Required: NPR ${amount.toFixed(2)})`);
      }

      const newReserved = wallet.reserved_balance + amount;

      // 2. Update reserved balance
      await client.query(
        'UPDATE wallets SET reserved_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newReserved, wallet.id]
      );

      // 3. Record transaction audit
      const txId = `tx_res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await client.query(
        `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, status, tournament_id, description, balance_before, balance_after)
         VALUES ($1, $2, $3, 'tournament_reservation', $4, 'completed', $5, $6, $7, $8)`,
        [
          txId,
          wallet.id,
          ownerId,
          amount,
          tournamentId,
          `Escrow prize reservation for ${tournamentTitle}`,
          wallet.balance,
          wallet.balance,
        ]
      );

      return { success: true, newReserved, available: wallet.balance - newReserved };
    });
  },

  /**
   * Release reserved funds (e.g. tournament cancelled or refunded back).
   */
  async releaseReservedPrize(
    ownerId: string,
    amount: number,
    tournamentId: string,
    reason: string
  ): Promise<void> {
    if (amount <= 0) return;

    await withTransaction(async (client) => {
      const walletRes = await client.query<DbWallet>(
        'SELECT id, owner_id, balance::float, reserved_balance::float FROM wallets WHERE owner_id = $1 FOR UPDATE',
        [ownerId]
      );
      if (walletRes.rows.length === 0) throw new Error('Wallet not found');

      const wallet = walletRes.rows[0];
      const newReserved = Math.max(0, wallet.reserved_balance - amount);

      await client.query(
        'UPDATE wallets SET reserved_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newReserved, wallet.id]
      );

      const txId = `tx_rel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await client.query(
        `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, status, tournament_id, description, balance_before, balance_after)
         VALUES ($1, $2, $3, 'tournament_release', $4, 'completed', $5, $6, $7, $8)`,
        [txId, wallet.id, ownerId, amount, tournamentId, reason, wallet.balance, wallet.balance]
      );
    });
  },

  /**
   * Atomic entry fee deduction for tournament registration.
   */
  async deductTournamentEntry(
    userId: string,
    entryFee: number,
    tournamentId: string,
    tournamentTitle: string
  ): Promise<{ success: boolean; newBalance: number }> {
    if (entryFee <= 0) return { success: true, newBalance: 0 };

    return withTransaction(async (client) => {
      const walletRes = await client.query<DbWallet>(
        'SELECT id, owner_id, balance::float, reserved_balance::float FROM wallets WHERE owner_id = $1 FOR UPDATE',
        [userId]
      );
      if (walletRes.rows.length === 0) throw new Error('Wallet not found');

      const wallet = walletRes.rows[0];
      const available = wallet.balance - wallet.reserved_balance;

      if (available < entryFee) {
        throw new Error(`Insufficient wallet balance for entry fee (Required: NPR ${entryFee}, Available: NPR ${available})`);
      }

      const newBalance = wallet.balance - entryFee;

      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newBalance, wallet.id]
      );

      const txId = `tx_entry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await client.query(
        `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, status, tournament_id, description, balance_before, balance_after)
         VALUES ($1, $2, $3, 'tournament_entry', $4, 'completed', $5, $6, $7, $8)`,
        [
          txId,
          wallet.id,
          userId,
          -entryFee,
          tournamentId,
          `Entry fee for tournament: ${tournamentTitle}`,
          wallet.balance,
          newBalance,
        ]
      );

      return { success: true, newBalance };
    });
  },

  /**
   * Atomic refund for leaving tournament or tournament cancellation.
   */
  async refundTournamentEntry(
    userId: string,
    entryFee: number,
    tournamentId: string,
    tournamentTitle: string
  ): Promise<{ success: boolean; newBalance: number }> {
    if (entryFee <= 0) return { success: true, newBalance: 0 };

    return withTransaction(async (client) => {
      const walletRes = await client.query<DbWallet>(
        'SELECT id, owner_id, balance::float FROM wallets WHERE owner_id = $1 FOR UPDATE',
        [userId]
      );
      if (walletRes.rows.length === 0) throw new Error('Wallet not found');

      const wallet = walletRes.rows[0];
      const newBalance = wallet.balance + entryFee;

      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newBalance, wallet.id]
      );

      const txId = `tx_rfd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await client.query(
        `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, status, tournament_id, description, balance_before, balance_after)
         VALUES ($1, $2, $3, 'refund', $4, 'completed', $5, $6, $7, $8)`,
        [
          txId,
          wallet.id,
          userId,
          entryFee,
          tournamentId,
          `Refund for tournament: ${tournamentTitle}`,
          wallet.balance,
          newBalance,
        ]
      );

      return { success: true, newBalance };
    });
  },
};
