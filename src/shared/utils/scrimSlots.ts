export interface ScrimSlot {
  slotNumber: number;
  status: 'open' | 'filled';
  teamName?: string | null;
  teamId?: string | null;
  userId?: string | null;
  captainUid?: string | null;
  reservedBy?: string | null;
  inGameId?: string | null;
  inGameName?: string | null;
  joinedAt?: string | null;
}

export const SCRIM_FORMAT_SLOTS = {
  Squad: 12,
  Duo: 25,
  Solo: 48,
} as const;

export function getScrimSlotCount(format?: string | null): number {
  if (format === 'Solo' || format === 'solo') return 48;
  if (format === 'Duo' || format === 'duo') return 25;
  return 12; // Squad & default
}

const toPositiveInteger = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

export interface NormalizeSlotExtra {
  mySlotNumber?: number | null;
  myUserId?: string | null;
  myUserName?: string | null;
  myTeamName?: string | null;
  isTeamEvent?: boolean;
  myInGameId?: string | null;
  myInGameName?: string | null;
  participants?: any[];
}

/**
 * Supports both legacy numeric slot counts and the newer per-slot documents.
 * Correctly marks reserved slots and merges registered participant details.
 */
export const normalizeScrimSlots = (
  slots: unknown,
  totalSlots?: unknown,
  filledSlots?: unknown,
  extra?: NormalizeSlotExtra,
): ScrimSlot[] => {
  let result: ScrimSlot[] = [];

  if (Array.isArray(slots) && slots.length > 0) {
    result = slots.map((slot, index) => {
      const record = slot && typeof slot === 'object' ? slot as Record<string, unknown> : {};
      const slotNum = toPositiveInteger(record.slotNumber, index + 1);
      const isMySlot = Boolean(extra?.mySlotNumber && extra.mySlotNumber === slotNum);

      const isFilled = 
        record.status === 'filled' ||
        record.status === 'reserved' ||
        record.status === 'booked' ||
        Boolean(record.userId) ||
        Boolean(record.captainUid) ||
        Boolean(record.reservedBy) ||
        Boolean(record.teamName) ||
        isMySlot;

      const slotUserId = typeof record.userId === 'string' ? record.userId : 
        (typeof record.captainUid === 'string' ? record.captainUid : 
        (typeof record.reservedBy === 'string' ? record.reservedBy : 
        (isMySlot ? extra?.myUserId || null : null)));

      const rawTeamName = typeof record.teamName === 'string' && record.teamName.trim() ? record.teamName.trim() : null;

      const teamName = rawTeamName 
        ? rawTeamName 
        : (isMySlot 
            ? (extra?.isTeamEvent 
                ? (extra?.myTeamName || (extra?.myUserName ? `${extra.myUserName}'s Team` : 'Registered Team'))
                : (extra?.myUserName || 'Registered Player'))
            : (isFilled 
                ? (extra?.isTeamEvent 
                    ? (typeof record.inGameName === 'string' && record.inGameName.trim() ? `${record.inGameName.trim()}'s Team` : `Team #${slotNum}`)
                    : (typeof record.inGameName === 'string' && record.inGameName.trim() ? record.inGameName.trim() : 'Player'))
                : null));

      return {
        slotNumber: slotNum,
        status: isFilled ? 'filled' : 'open',
        teamName,
        teamId: typeof record.teamId === 'string' ? record.teamId : null,
        userId: slotUserId,
        captainUid: slotUserId,
        reservedBy: slotUserId,
        inGameId: typeof record.inGameId === 'string' ? record.inGameId : (isMySlot ? extra?.myInGameId || null : null),
        inGameName: typeof record.inGameName === 'string' ? record.inGameName : (isMySlot ? extra?.myInGameName || null : null),
        joinedAt: typeof record.joinedAt === 'string' ? record.joinedAt : null,
      };
    });
  } else {
    const count = toPositiveInteger(slots, toPositiveInteger(totalSlots, 12));
    const filled = Math.min(count, Math.max(0, Math.floor(Number(filledSlots) || 0)));
    result = Array.from({ length: count }, (_, index) => {
      const slotNum = index + 1;
      const isMySlot = Boolean(extra?.mySlotNumber && extra.mySlotNumber === slotNum);
      const isFilled = index < filled || isMySlot;

      return {
        slotNumber: slotNum,
        status: isFilled ? 'filled' : 'open',
        teamName: isMySlot 
          ? (extra?.isTeamEvent 
              ? (extra?.myTeamName || (extra?.myUserName ? `${extra.myUserName}'s Team` : 'Registered Team'))
              : (extra?.myUserName || 'Registered Player'))
          : (index < filled ? `Team ${slotNum}` : null),
        teamId: null,
        userId: isMySlot ? extra?.myUserId || null : null,
        captainUid: isMySlot ? extra?.myUserId || null : null,
        reservedBy: isMySlot ? extra?.myUserId || null : null,
        inGameId: isMySlot ? extra?.myInGameId || null : null,
        inGameName: isMySlot ? extra?.myInGameName || null : null,
        joinedAt: null,
      };
    });
  }

  // Merge registered participants if provided to guarantee all reservations are visible
  if (Array.isArray(extra?.participants) && extra.participants.length > 0) {
    extra.participants.forEach((p: any) => {
      if (!p) return;
      let targetSlotIdx = -1;
      if (typeof p.slotNumber === 'number' && p.slotNumber >= 1 && p.slotNumber <= result.length) {
        targetSlotIdx = result.findIndex(s => s.slotNumber === p.slotNumber);
      } else if (p.userId) {
        targetSlotIdx = result.findIndex(s => s.userId === p.userId || s.reservedBy === p.userId);
      }

      if (targetSlotIdx !== -1) {
        const pTeamName = typeof p.teamName === 'string' && p.teamName.trim() ? p.teamName.trim() : null;
        const resolvedTeamName = pTeamName 
          ? pTeamName 
          : (extra?.isTeamEvent
              ? (p.username ? `${p.username}'s Team` : result[targetSlotIdx].teamName || `Team #${result[targetSlotIdx].slotNumber}`)
              : (p.username || result[targetSlotIdx].teamName || 'Registered Player'));

        result[targetSlotIdx] = {
          ...result[targetSlotIdx],
          status: 'filled',
          teamName: resolvedTeamName,
          teamId: p.teamId || result[targetSlotIdx].teamId || null,
          userId: p.userId || result[targetSlotIdx].userId || null,
          captainUid: p.userId || result[targetSlotIdx].captainUid || null,
          reservedBy: p.userId || result[targetSlotIdx].reservedBy || null,
          inGameId: p.inGameId || result[targetSlotIdx].inGameId || null,
          inGameName: p.inGameName || result[targetSlotIdx].inGameName || null,
          joinedAt: p.timestamp ? (p.timestamp.toDate?.()?.toISOString?.() || String(p.timestamp)) : result[targetSlotIdx].joinedAt,
        };
      }
    });
  }

  return result;
};

export const countFilledScrimSlots = (slots: ScrimSlot[]) =>
  slots.filter(slot => slot.status === 'filled').length;

export const getSlotCount = (t: any): number => {
  if (!t) return 12;
  if (typeof t.totalSlots === 'number' && !isNaN(t.totalSlots) && t.totalSlots > 0) return t.totalSlots;
  if (typeof t.slots === 'number' && !isNaN(t.slots) && t.slots > 0) return t.slots;
  if (Array.isArray(t.slots) && t.slots.length > 0) return t.slots.length;
  const num = Number(t.totalSlots ?? t.slots);
  if (!isNaN(num) && num > 0) return num;
  const format = t.format || t.teamType;
  if (format === 'Solo' || format === 'solo') return 48;
  if (format === 'Duo' || format === 'duo') return 25;
  return 12;
};

export const getFilledSlotCount = (t: any, participantsCount?: number): number => {
  if (!t) return 0;

  const slotsFilled = Array.isArray(t.slots)
    ? t.slots.filter((s: any) => s && (
        s.status === 'filled' || 
        s.status === 'reserved' || 
        s.status === 'booked' || 
        Boolean(s.userId) || 
        Boolean(s.reservedBy) || 
        Boolean(s.captainUid)
      )).length
    : 0;

  const filledSlotsField = typeof t.filledSlots === 'number' && !isNaN(t.filledSlots) && t.filledSlots > 0 ? t.filledSlots : 0;
  const currentPlayersField = typeof t.currentPlayers === 'number' && !isNaN(t.currentPlayers) && t.currentPlayers > 0 ? t.currentPlayers : 0;
  const directParticipants = typeof participantsCount === 'number' && participantsCount > 0 ? participantsCount : 0;

  return Math.max(slotsFilled, filledSlotsField, currentPlayersField, directParticipants);
};
