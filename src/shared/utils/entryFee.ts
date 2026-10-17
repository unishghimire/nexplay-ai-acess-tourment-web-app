export interface EntryFeeSource {
    entryFee?: unknown;
    fee?: unknown;
    requirements?: { entryFee?: unknown } | null;
}

/**
 * R-10: mirrors the server's join-time fee resolution chain
 * (server/routes/scrims.ts scrimEntryFeeOf): root entryFee, then
 * requirements.entryFee, then fee. Every display surface and balance gate must
 * use this so the UI can never advertise FREE for an event the server charges.
 */
export function resolveEntryFee(event: EntryFeeSource | null | undefined): number {
    const raw = event?.entryFee ?? event?.requirements?.entryFee ?? event?.fee ?? 0;
    const n = Math.round(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : 0;
}
