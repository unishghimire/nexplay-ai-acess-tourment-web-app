// ═══════════════════════════════════════════════════════════════
// SCRIM PRIZE SETTLEMENT MATH
// Pure, dependency-free. The route in routes/scrims.ts owns Firestore;
// this module owns the money rules so they can be tested without a DB.
// ═══════════════════════════════════════════════════════════════

export interface ScrimFundingInput {
    prizePool?: unknown;
    collectedEntryFees?: unknown;
    lockedMoney?: unknown;
    entryFee?: unknown;
    requirements?: { entryFee?: unknown } | null;
    payoutsReleased?: unknown;
}

export interface HostFundingInput {
    orgTournamentsLockedBalance?: unknown;
    orgPendingEarnings?: unknown;
}

export interface ScrimBudget {
    /** Integer amount that may still be paid out of this scrim. */
    budget: number;
    /** Where the money is coming from. */
    source: 'entry_escrow' | 'host_escrow' | 'none';
    /** Total already released by previous settlements. */
    alreadyPaid: number;
}

const int = (v: unknown): number => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

export function scrimEntryFeeOf(scrim: ScrimFundingInput): number {
    const raw = (scrim as any)?.entryFee ?? (scrim as any)?.requirements?.entryFee ?? (scrim as any)?.fee ?? 0;
    return int(raw);
}

/**
 * SCR-034: nothing in the repo capped a prize payout against money that actually
 * exists. Entry-fee scrims pay from the collected escrow on the scrim doc; free
 * scrims with a declared pool pay from the host's locked balance. Never both —
 * the join route writes the same fee to both places, so summing them double-spends.
 */
export function resolveScrimBudget(scrim: ScrimFundingInput, host: HostFundingInput | null): ScrimBudget {
    const alreadyPaid = int(scrim.payoutsReleased);
    const pool = int(scrim.prizePool);
    const entryFee = scrimEntryFeeOf(scrim);

    if (entryFee > 0) {
        const held = Math.min(int(scrim.collectedEntryFees), int(scrim.lockedMoney));
        const declared = pool > 0 ? Math.min(pool, held) : held;
        return { budget: Math.max(0, declared - alreadyPaid), source: held > 0 ? 'entry_escrow' : 'none', alreadyPaid };
    }

    const hostLocked = int(host?.orgTournamentsLockedBalance);
    const hostPending = int(host?.orgPendingEarnings);
    const held = Math.min(hostLocked, hostPending);
    const declared = pool > 0 ? Math.min(pool, held) : held;
    return { budget: Math.max(0, declared - alreadyPaid), source: held > 0 ? 'host_escrow' : 'none', alreadyPaid };
}

/**
 * R-01: the scrim doc fields feeding resolveScrimBudget are organizer-writable
 * through Firestore rules, so the doc-derived budget is clamped a second time
 * against the join ledger (sum of participants' frozen chargedFee). A host who
 * inflates collectedEntryFees/lockedMoney on the doc gains no extra budget.
 */
export function clampBudgetToLedger(docBudget: number, ledgerCollected: number, alreadyPaid: number): number {
    const remaining = Math.max(0, int(ledgerCollected) - int(alreadyPaid));
    return Math.max(0, Math.min(int(docBudget), remaining));
}

export interface PerKillConfigInput {
    rewardPerKill?: unknown;
    minimumKillsForReward?: unknown;
    maximumRewardPerPlayer?: unknown;
    maximumRewardPerMatch?: unknown;
    capPerPlayer?: unknown;
}

export interface PerKillRewardResult {
    reward: number;
    kills: number;
    capped: boolean;
    belowMinimum: boolean;
}

/**
 * SCR-041: display code multiplied kills x rewardPerKill directly, so the configured
 * minimum-kill threshold and per-player caps were never applied to the number players
 * saw. Same formula as the client perKillEngine, integer money math.
 */
export function computePerKillReward(
    kills: unknown,
    config: PerKillConfigInput,
    alreadyEarnedInScrim = 0
): PerKillRewardResult {
    const safeKills = Math.floor(Number(kills));
    const normalizedKills = Number.isFinite(safeKills) && safeKills > 0 ? safeKills : 0;

    const rate = Math.max(0, Math.round(Number(config.rewardPerKill) || 0));
    const minimum = Math.max(0, Math.floor(Number(config.minimumKillsForReward) || 0));

    if (rate <= 0) return { reward: 0, kills: normalizedKills, capped: false, belowMinimum: false };
    if (normalizedKills < minimum) {
        return { reward: 0, kills: normalizedKills, capped: false, belowMinimum: true };
    }

    let reward = normalizedKills * rate;
    let capped = false;

    const matchCap = int(config.maximumRewardPerMatch);
    if (matchCap > 0 && reward > matchCap) {
        reward = matchCap;
        capped = true;
    }

    const playerCap = int(config.maximumRewardPerPlayer ?? config.capPerPlayer);
    if (playerCap > 0) {
        const prior = Math.max(0, Math.round(Number(alreadyEarnedInScrim) || 0));
        if (prior + reward > playerCap) {
            reward = Math.max(0, playerCap - prior);
            capped = true;
        }
    }

    return { reward, kills: normalizedKills, capped, belowMinimum: false };
}

export interface ResolvedPayout {
    userId: string;
    rank: number;
    amount: number;
    teamId: string | null;
    label: string;
    kind: 'placement' | 'kill';
    /** Position of the source entry, so the ref id stays stable across a re-run. */
    refOrdinal: number;
}

export interface WinnerInput {
    userId?: unknown;
    rank?: unknown;
    prize?: unknown;
    amount?: unknown;
    teamId?: unknown;
    teamName?: unknown;
    name?: unknown;
}

/** One computed bounty per submitted kill entry, aligned with the caller's input order. */
export interface KillLedgerRow {
    userId: string;
    rank: number;
    kills: number;
    reward: number;
    capped: boolean;
    payable: boolean;
}

/**
 * Normalises the two payout shapes a scrim can carry (placement prizes and per-kill
 * bounties) into one ledger, rejecting anything that is not a positive integer amount
 * or a string user id. Duplicate userId+rank is a caller error, not something to pay twice.
 */
export function resolvePayouts(
    winners: unknown,
    killEntries: unknown,
    config: PerKillConfigInput
): { payouts: ResolvedPayout[]; killLedger: KillLedgerRow[]; error: string | null } {
    const payouts: ResolvedPayout[] = [];
    const killLedger: KillLedgerRow[] = [];
    const seen = new Set<string>();
    const fail = (error: string) => ({ payouts: [] as ResolvedPayout[], killLedger: [] as KillLedgerRow[], error });

    if (winners !== undefined && !Array.isArray(winners)) {
        return fail('winners must be an array');
    }

    for (const w of (Array.isArray(winners) ? winners : []) as WinnerInput[]) {
        const userId = typeof w?.userId === 'string' ? w.userId.trim() : '';
        if (!userId) return fail('Every winner needs a userId');
        const rank = Math.floor(Number(w?.rank));
        if (!Number.isInteger(rank) || rank < 1 || rank > 999) {
            return fail(`Invalid rank for winner ${userId}`);
        }
        const rawAmount = w?.prize ?? w?.amount ?? 0;
        const amount = Math.round(Number(rawAmount));
        if (!Number.isFinite(amount) || amount < 0) {
            return fail(`Invalid prize for winner ${userId}`);
        }
        const key = `${userId}:${rank}`;
        if (seen.has(key)) return fail(`Duplicate winner entry for ${userId}`);
        seen.add(key);
        if (amount === 0) continue;
        payouts.push({
            userId,
            rank,
            amount,
            teamId: typeof w?.teamId === 'string' && w.teamId.trim() ? w.teamId.trim() : null,
            label: typeof w?.teamName === 'string' && w.teamName.trim() ? w.teamName.trim()
                : (typeof w?.name === 'string' && w.name.trim() ? w.name.trim() : userId),
            kind: 'placement',
            refOrdinal: 0
        });
    }

    if (killEntries !== undefined && !Array.isArray(killEntries)) {
        return fail('killEntries must be an array');
    }

    const earnedByPlayer = new Map<string, number>();
    const killEntriesArray = Array.isArray(killEntries) ? killEntries : [];
    for (const [i, entry] of (killEntriesArray as any[]).entries()) {
        const userId = typeof entry?.playerId === 'string' ? entry.playerId.trim()
            : (typeof entry?.userId === 'string' ? entry.userId.trim() : '');
        if (!userId) return fail('Every kill entry needs a playerId');

        const rank = Math.floor(Number(entry?.rank)) || 1;
        // One bounty per player per match: fall back to the submission index when the
        // caller did not tag the entry with a match/group id.
        const matchKey = `${userId}:kill:${entry?.matchId ?? entry?.groupId ?? i}:${rank}`;
        if (seen.has(matchKey)) {
            return fail(`Duplicate kill entry for ${userId}`);
        }
        seen.add(matchKey);

        const { reward, kills, capped } = computePerKillReward(
            entry?.kills ?? entry?.verifiedKills,
            config,
            earnedByPlayer.get(userId) ?? 0
        );
        earnedByPlayer.set(userId, (earnedByPlayer.get(userId) ?? 0) + reward);
        killLedger.push({ userId, rank, kills, reward, capped, payable: reward > 0 });
        if (reward <= 0) continue;

        payouts.push({
            userId,
            rank,
            amount: reward,
            teamId: typeof entry?.teamId === 'string' && entry.teamId.trim() ? entry.teamId.trim() : null,
            label: typeof entry?.playerName === 'string' && entry.playerName.trim() ? entry.playerName.trim() : userId,
            kind: 'kill',
            refOrdinal: i
        });
    }

    return { payouts, killLedger, error: null };
}

/**
 * Cap a payout ledger to the available budget, largest-first, so a partial settlement
 * is always a deliberate truncation the route can report instead of a silent overpay.
 */
export function clampToBudget(payouts: ResolvedPayout[], budget: number): { kept: ResolvedPayout[]; dropped: ResolvedPayout[]; total: number } {
    const kept: ResolvedPayout[] = [];
    const dropped: ResolvedPayout[] = [];
    let remaining = Math.max(0, Math.round(budget));
    let total = 0;

    for (const p of payouts) {
        if (p.amount <= remaining) {
            kept.push(p);
            remaining -= p.amount;
            total += p.amount;
        } else {
            dropped.push(p);
        }
    }

    return { kept, dropped, total };
}

const ID_SAFE = /[^a-zA-Z0-9_-]/g;

export function payoutRefId(scrimId: string, userId: string, kind: string, rank: number, ordinal = 0): string {
    return `SCRIM-PAY-${scrimId.replace(ID_SAFE, '').slice(0, 40)}-${userId.replace(ID_SAFE, '').slice(0, 40)}-${kind}-${rank}-${ordinal}`;
}
