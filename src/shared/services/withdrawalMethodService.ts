/**
 * Saved Withdrawal Payment Method — client service.
 *
 * Session cache: the method is fetched at most once per session (module-level
 * cache, invalidated on save/remove) so Wallet views never issue per-render,
 * per-tab or per-keystroke reads. The cache is UX-only — the server re-reads
 * the saved method on every withdrawal submission and is the authority for
 * all financial decisions.
 */
import { auth } from '../config/firebase';
import type { WithdrawalMethod, WithdrawalMethodInput } from '../types/types';

interface CacheEntry {
  method: WithdrawalMethod | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: CacheEntry | null = null;
let inflight: Promise<WithdrawalMethod | null> | null = null;

async function authedFetch(path: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required — please sign in again');
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function invalidateWithdrawalMethodCache(): void {
  cache = null;
  inflight = null;
}

/** Loads the caller's saved method (cached for the session; dedupes concurrent calls). */
export async function fetchWithdrawalMethod(): Promise<WithdrawalMethod | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.method;
  if (inflight) return inflight;

  inflight = (async () => {
    const { ok, data } = await authedFetch('/api/wallet/withdrawal-method', 'GET');
    if (!ok) throw new Error(data?.message || 'Failed to load saved payment method');
    const method: WithdrawalMethod | null = data.method ?? null;
    cache = { method, fetchedAt: Date.now() };
    return method;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Adds or replaces the caller's single active withdrawal method. */
export async function saveWithdrawalMethod(input: WithdrawalMethodInput): Promise<WithdrawalMethod> {
  const { ok, data } = await authedFetch('/api/wallet/withdrawal-method', 'PUT', input);
  if (!ok) throw new Error(data?.message || 'Failed to save payment method');
  invalidateWithdrawalMethodCache();
  // Re-fetch once so the cache holds the canonical stored document.
  return fetchWithdrawalMethod() as Promise<WithdrawalMethod>;
}

/** Removes the saved method. Only affects future submissions — historical withdrawal records keep their destination snapshot. */
export async function removeWithdrawalMethod(): Promise<void> {
  const { ok, data } = await authedFetch('/api/wallet/withdrawal-method', 'DELETE');
  if (!ok) throw new Error(data?.message || 'Failed to remove payment method');
  invalidateWithdrawalMethodCache();
}
