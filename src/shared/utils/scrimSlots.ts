export interface ScrimSlot {
  slotNumber: number;
  status: 'open' | 'filled';
  teamName?: string | null;
  teamId?: string | null;
}

const toPositiveInteger = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

/**
 * Supports both legacy numeric slot counts and the newer per-slot documents.
 * All callers can safely edit the returned representation.
 */
export const normalizeScrimSlots = (
  slots: unknown,
  totalSlots?: unknown,
  filledSlots?: unknown,
): ScrimSlot[] => {
  if (Array.isArray(slots)) {
    return slots.map((slot, index) => {
      const record = slot && typeof slot === 'object' ? slot as Record<string, unknown> : {};
      return {
        slotNumber: toPositiveInteger(record.slotNumber, index + 1),
        status: record.status === 'filled' ? 'filled' : 'open',
        teamName: typeof record.teamName === 'string' ? record.teamName : null,
        teamId: typeof record.teamId === 'string' ? record.teamId : null,
      };
    });
  }

  const count = toPositiveInteger(slots, toPositiveInteger(totalSlots));
  const filled = Math.min(count, Math.max(0, Math.floor(Number(filledSlots) || 0)));
  return Array.from({ length: count }, (_, index) => ({
    slotNumber: index + 1,
    status: index < filled ? 'filled' : 'open',
    teamName: index < filled ? `Team ${index + 1}` : null,
    teamId: null,
  }));
};

export const countFilledScrimSlots = (slots: ScrimSlot[]) =>
  slots.filter(slot => slot.status === 'filled').length;
