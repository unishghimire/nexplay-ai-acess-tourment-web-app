/**
 * Engine-aware detail URL for events.
 *
 * Guardrail: Tournaments and Scrims are separate engines. Scrim-flagged
 * events live under /scrims/:id; tournaments stay under /tournaments/:id.
 * Never route a scrim-flagged event to the tournament URL (or vice versa).
 */
export interface EventLike {
    id?: string;
    matchType?: string | null;
    isScrim?: boolean | null;
    type?: string | null;
}

/** Returns true when an event doc is scrim-flagged (belongs to the Scrim engine). */
export function isScrimEvent(event: EventLike | null | undefined): boolean {
    if (!event) return false;
    return (
        event.matchType === 'scrims' ||
        event.isScrim === true ||
        event.type === 'scrim' ||
        event.type === 'scrims'
    );
}

/** Returns the correct detail URL for an event based on its engine flags. */
export function eventDetailUrl(event: EventLike | null | undefined, fallbackId?: string): string {
    const id = event?.id || fallbackId;
    if (!id) return '/tournaments';
    return isScrimEvent(event) ? `/scrims/${id}` : `/tournaments/${id}`;
}
