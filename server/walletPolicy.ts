/**
 * Pure wallet policy predicates (R-04, R-05). Kept dependency-free so the money
 * guards can be unit-tested without booting Express or Firestore.
 */

/**
 * R-04: a deposit document that already exists in any non-rejected state must
 * never be reset to `pending` by a late resubmit — that erased approvals and
 * enabled double credit. Only a rejected deposit may be resubmitted.
 */
export function isDuplicateDeposit(existingStatus: unknown): boolean {
  if (existingStatus === undefined || existingStatus === null) return false;
  return String(existingStatus) !== 'rejected';
}

export interface FrozenFeeSource {
  entryFeePaid?: unknown;
  chargedFee?: unknown;
}

const frozenFee = (value: unknown): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * R-05: refunds may only ever use the fee frozen on the participant/slot at
 * join time. Falling back to the live event fee let an organizer raise the
 * fee after the fact and refund the inflated amount through a leaving player.
 * Returns 0 when nothing was frozen (legacy docs) — such refunds need a
 * manual operator path instead of a client-triggerable one.
 */
export function resolveFrozenRefundFee(
  participant: FrozenFeeSource | null | undefined,
  slot: FrozenFeeSource | null | undefined
): number {
  const fromParticipant = frozenFee(participant?.entryFeePaid ?? participant?.chargedFee);
  if (fromParticipant > 0) return fromParticipant;
  return frozenFee(slot?.chargedFee);
}
