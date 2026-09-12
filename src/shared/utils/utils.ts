import { Timestamp } from 'firebase/firestore';

export const formatCurrency = (amount: number | string, prefix: string = 'Rs. ') => {
    const num = Number(amount);
    if (amount === null || amount === undefined || isNaN(num)) return `${prefix}0`;
    return `${num < 0 ? '-' : ''}${prefix}${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(num))}`;
};

type FirestoreTimestamp = { seconds: number; nanoseconds: number; toDate?: () => Date };
type TimestampInput = import('firebase/firestore').Timestamp | FirestoreTimestamp | Date | string | number | null | undefined;

export const toDateSafe = (ts: TimestampInput): Date | null => {
    if (!ts) return null;

    if (ts instanceof Timestamp) return ts.toDate();

    if ((ts as FirestoreTimestamp).seconds !== undefined) {
        return new Timestamp((ts as FirestoreTimestamp).seconds, (ts as FirestoreTimestamp).nanoseconds).toDate();
    }

    const date = new Date(ts as string | number | Date);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (ts: TimestampInput): string => {
    const date = toDateSafe(ts);
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) + ', ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const formatDateShort = (ts: TimestampInput): string => {
    const date = toDateSafe(ts);
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    }) + ' • ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const formatTime = (ts: TimestampInput): string => {
    const date = toDateSafe(ts);
    if (!date) return 'TBD';
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const timeAgo = (ts: TimestampInput): string => {
    const date = toDateSafe(ts);
    if (!date) return 'Just now';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
};

export const getYoutubeId = (url: string | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

export const calculateLevel = (xp: number = 0) => {
    // Simple level formula: Level = floor(XP / 500) + 1
    return Math.floor(xp / 500) + 1;
};

export const getXPForNextLevel = (level: number) => {
    // XP needed for level N+1 is N * 500
    return level * 500;
};

export const getLevelProgress = (xp: number = 0) => {
    const level = calculateLevel(xp);
    const currentLevelXP = (level - 1) * 500;
    const nextLevelXP = level * 500;
    const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return Math.min(100, Math.max(0, progress));
};

const GAME_MODE_LABELS: Record<string, string> = {
    battelroyal: 'Battle Royale',
    battleroyale: 'Battle Royale',
    'battle royale': 'Battle Royale',
    clashsquad: 'Clash Squad',
    'clash squad': 'Clash Squad',
    lionwolf: 'Lone Wolf',
    lonewolf: 'Lone Wolf',
    'lone wolf': 'Lone Wolf',
};

export const formatGameModeLabel = (mode: string) => {
    const normalized = mode.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const compact = normalized.replace(/\s+/g, '');
    const mappedLabel = GAME_MODE_LABELS[normalized] || GAME_MODE_LABELS[compact];

    if (mappedLabel) return mappedLabel;
    if (!normalized) return mode;

    return normalized
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const GAME_NAME_LABELS: Record<string, string> = {
    'free fire': 'Free Fire',
    'pubg mobile': 'PUBG Mobile',
    pubg: 'PUBG',
    'mobile legends': 'Mobile Legends',
};

export const formatGameName = (name: string) => {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const mappedLabel = GAME_NAME_LABELS[normalized];

    if (mappedLabel) return mappedLabel;
    if (!normalized) return name;

    return normalized
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Sanitizes a user-supplied URL to prevent javascript: / data: protocol injection.
 * Only allows http, https, and relative URLs.
 * Returns '#' for anything dangerous or empty.
 */
export function sanitizeUrl(url: string | undefined | null): string {
    if (!url) return '#';
    const trimmed = url.trim();
    // Allow relative URLs
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return trimmed;
        return '#';
    } catch {
        return '#';
    }
}

/**
 * Validates a client-supplied internal redirect target (e.g. the `from`
 * location passed by ProtectedRoute). Only same-app absolute paths are
 * allowed; protocol-relative, backslash, scheme and auth-page targets are
 * rejected to avoid open redirects and redirect loops.
 */
export function isSafeInternalPath(pathname: unknown): pathname is string {
    if (typeof pathname !== 'string' || !pathname) return false;
    if (!pathname.startsWith('/')) return false;
    if (pathname.startsWith('//') || pathname.startsWith('/\\')) return false;
    if (pathname.includes('://')) return false;
    if (pathname === '/login' || pathname === '/register' || pathname === '/complete-profile') return false;
    return true;
}

/**
 * Determines whether an event represents an esports Scrim (practice match).
 * A scrim is NOT a tournament: it must not have explicit tournament markers,
 * and must have explicit or implicit scrim markers.
 */
export function isScrimEvent(item: unknown): boolean {
    if (!item || typeof item !== 'object') return false;
    const ev = item as Record<string, any>;

    // 1. Explicit tournament markers disqualify it immediately
    if (ev.matchType === 'tournament') return false;
    if (ev.isTournament === true) return false;
    if (ev.isScrim === false) return false;
    if (typeof ev.type === 'string' && ev.type.toLowerCase() === 'tournament') return false;

    const formatLower = typeof ev.format === 'string' ? ev.format.toLowerCase() : '';
    if (
        formatLower === 'single_elimination' ||
        formatLower === 'double_elimination' ||
        formatLower === 'round_robin' ||
        formatLower === 'swiss' ||
        formatLower === 'bracket'
    ) {
        return false;
    }

    const titleLower = typeof ev.title === 'string' ? ev.title.toLowerCase() : '';
    const isExplicitPerKill = ev.tournamentMode === 'PER_KILL_REWARD' || Number(ev.rewardPerKill) > 0 || titleLower.includes('per-kill') || titleLower.includes('per kill');

    // If title has tournament/league keywords and does not explicitly say "scrim" or "per-kill"
    if (
        (titleLower.includes('tournament') || titleLower.includes('league') || titleLower.includes('leauge') || titleLower.includes('championship')) &&
        !titleLower.includes('scrim') &&
        !isExplicitPerKill
    ) {
        return false;
    }

    // 2. Positive scrim markers
    if (ev.matchType === 'scrim' || ev.matchType === 'scrims') return true;
    if (ev.isScrim === true) return true;
    if (typeof ev.type === 'string' && (ev.type.toLowerCase() === 'scrim' || ev.type.toLowerCase() === 'scrims')) return true;
    if (formatLower === 'scrim' || formatLower === 'scrims') return true;
    if (titleLower.includes('scrim')) return true;
    // Per-kill is strictly a scrim, never a tournament
    if (isExplicitPerKill) return true;

    // 3. Fallback for documents originating from scrims collection without tournament disqualifiers
    if (ev._sourceCollection === 'scrims') return true;

    return false;
}

/**
 * Determines whether an event represents a Tournament (formal competition with bracket/prizes).
 */
export function isTournamentEvent(item: unknown): boolean {
    if (!item || typeof item !== 'object') return false;
    if (isScrimEvent(item)) return false;

    const ev = item as Record<string, any>;
    // Per-kill is strictly a scrim, never a tournament
    if (ev.tournamentMode === 'PER_KILL_REWARD' || Number(ev.rewardPerKill) > 0) return false;

    if (ev.matchType === 'tournament') return true;
    if (ev.isTournament === true) return true;
    if (ev.isScrim === false) return true;
    if (typeof ev.type === 'string' && ev.type.toLowerCase() === 'tournament') return true;

    const formatLower = typeof ev.format === 'string' ? ev.format.toLowerCase() : '';
    if (
        formatLower === 'single_elimination' ||
        formatLower === 'double_elimination' ||
        formatLower === 'round_robin' ||
        formatLower === 'swiss' ||
        formatLower === 'bracket'
    ) {
        return true;
    }

    const titleLower = typeof ev.title === 'string' ? ev.title.toLowerCase() : '';
    if (titleLower.includes('tournament') || titleLower.includes('league') || titleLower.includes('leauge') || titleLower.includes('championship')) {
        return true;
    }

    // Default for documents originating from tournaments collection that aren't scrims
    if (ev.matchType !== 'scrims' && ev.isScrim !== true) return true;

    return false;
}

