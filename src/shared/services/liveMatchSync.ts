import { db, rtdb } from '../config/firebase';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';

export interface LiveMatchTelemetry {
    tournamentId: string;
    status: 'upcoming' | 'live' | 'paused' | 'completed' | 'cancelled';
    currentRound?: number;
    totalRounds?: number;
    aliveTeamsCount?: number;
    totalTeamsCount?: number;
    leaderboard?: Array<{
        teamId: string;
        teamName: string;
        rank?: number;
        kills: number;
        placementPoints?: number;
        totalPoints: number;
        isAlive?: boolean;
    }>;
    stream?: {
        isLive: boolean;
        platform: 'youtube' | 'twitch' | 'custom';
        url?: string;
    };
    lastEvent?: {
        type: 'kill' | 'elimination' | 'zone_shrink' | 'round_end' | 'announcement';
        message: string;
        timestamp: number;
    };
    updatedAt: number;
}

/**
 * Subscribes to high-frequency live match telemetry over Realtime Database (< 30ms latency)
 * with automatic fallback to Firestore document snapshot listeners.
 *
 * @param tournamentId ID of the tournament or scrim
 * @param callback Callback receiving live telemetry updates
 * @returns Clean unsubscribe function
 */
export function subscribeLiveMatchTelemetry(
    tournamentId: string,
    callback: (data: LiveMatchTelemetry | null) => void
): () => void {
    if (!tournamentId) {
        callback(null);
        return () => {};
    }

    let isUnsubscribed = false;
    let latestTimestamp = 0;

    const emitIfNewer = (telemetry: LiveMatchTelemetry | null) => {
        if (isUnsubscribed || !telemetry) return;
        if (telemetry.updatedAt && telemetry.updatedAt < latestTimestamp) return;
        latestTimestamp = telemetry.updatedAt || Date.now();
        callback(telemetry);
    };

    // 1. High-frequency RTDB listener (WebSocket binary pipeline)
    let unsubRtdb: (() => void) | null = null;
    try {
        const liveMatchRef = ref(rtdb, `live_matches/${tournamentId}`);
        unsubRtdb = onValue(liveMatchRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
                emitIfNewer(val as LiveMatchTelemetry);
            }
        }, () => {
            // RTDB permission / network fallback
        });
    } catch {
        // Suppress initial setup errors
    }

    // 2. Firestore Document listener fallback (Authoritative sync)
    let unsubFirestore: Unsubscribe | null = null;
    try {
        const tourRef = doc(db, 'tournaments', tournamentId);
        unsubFirestore = onSnapshot(tourRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.liveTelemetry) {
                    emitIfNewer({
                        tournamentId,
                        status: data.status || 'live',
                        currentRound: data.liveTelemetry.currentRound,
                        totalRounds: data.liveTelemetry.totalRounds,
                        aliveTeamsCount: data.liveTelemetry.aliveTeamsCount,
                        totalTeamsCount: data.liveTelemetry.totalTeamsCount,
                        leaderboard: data.liveTelemetry.leaderboard,
                        stream: data.liveTelemetry.stream,
                        lastEvent: data.liveTelemetry.lastEvent,
                        updatedAt: data.liveTelemetry.updatedAt || Date.now(),
                    });
                }
            }
        }, () => {
            // Suppress fallback listener errors
        });
    } catch {
        // Suppress initial setup errors
    }

    return () => {
        isUnsubscribed = true;
        if (unsubRtdb) {
            try { unsubRtdb(); } catch {}
        }
        if (unsubFirestore) {
            try { unsubFirestore(); } catch {}
        }
    };
}

/**
 * Publishes live match telemetry directly to Realtime Database for millisecond broadcast
 * to all connected player clients and spectator overlays.
 */
export async function broadcastLiveMatchTelemetry(
    tournamentId: string,
    telemetry: Partial<LiveMatchTelemetry>
): Promise<void> {
    if (!tournamentId) return;
    try {
        const liveMatchRef = ref(rtdb, `live_matches/${tournamentId}`);
        const payload: LiveMatchTelemetry = {
            tournamentId,
            status: telemetry.status || 'live',
            currentRound: telemetry.currentRound,
            totalRounds: telemetry.totalRounds,
            aliveTeamsCount: telemetry.aliveTeamsCount,
            totalTeamsCount: telemetry.totalTeamsCount,
            leaderboard: telemetry.leaderboard,
            stream: telemetry.stream,
            lastEvent: telemetry.lastEvent,
            updatedAt: Date.now(),
        };
        await set(liveMatchRef, payload);
    } catch (error) {
        console.warn('Could not broadcast live match telemetry to RTDB:', error);
    }
}
