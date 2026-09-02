import { db, rtdb } from '../config/firebase';
import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';

export interface RoomCredentials {
    roomId?: string;
    roomPass?: string;
    streamUrl?: string;
    updatedAt?: number | string;
}

/**
 * Fetches room credentials for a tournament, scrim, or specific group.
 * Uses the /{collection}/{id}/credentials subcollection which is protected
 * by Firestore rules — only host + joined participants can read.
 *
 * @param id The tournament or scrim ID
 * @param groupId Optional group ID for per-group credentials
 * @param collectionName 'tournaments' (default) or 'scrims'
 * @returns { roomId, roomPass } or null if not found / no access
 */
export async function fetchRoomCredentials(
    id: string,
    groupId?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
): Promise<RoomCredentials | null> {
    try {
        const credId = groupId ? `group_${groupId}` : 'main';
        const credRef = doc(db, collectionName, id, 'credentials', credId);
        const credSnap = await getDoc(credRef);

        if (credSnap.exists()) {
            return credSnap.data() as RoomCredentials;
        }
        return null;
    } catch {
        // ponytail: return null on permission error — UI falls back to tournament-level creds
        return null;
    }
}

/**
 * Subscribes in real-time to room credentials with millisecond low-latency live synchronization.
 * Listens to Realtime Database live_rooms channel (< 30ms) and Firestore credentials subcollection.
 *
 * @param id The tournament or scrim ID
 * @param callback Handler receiving updated credentials or null
 * @param groupId Optional group ID for per-group credentials
 * @param collectionName 'tournaments' (default) or 'scrims'
 * @returns Unsubscribe function to clean up live listeners
 */
export function subscribeRoomCredentials(
    id: string,
    callback: (credentials: RoomCredentials | null) => void,
    groupId?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
): () => void {
    if (!id) {
        callback(null);
        return () => {};
    }

    const credId = groupId ? `group_${groupId}` : 'main';
    let isUnsubscribed = false;
    let latestCreds: RoomCredentials | null = null;

    const emitIfChanged = (newCreds: RoomCredentials | null) => {
        if (isUnsubscribed) return;
        if (!newCreds && !latestCreds) return;
        if (
            newCreds?.roomId === latestCreds?.roomId &&
            newCreds?.roomPass === latestCreds?.roomPass &&
            newCreds?.streamUrl === latestCreds?.streamUrl
        ) {
            return;
        }
        latestCreds = newCreds;
        callback(newCreds);
    };

    // 1. High-speed RTDB WebSocket listener for millisecond transmission (< 30ms)
    let unsubRtdb: (() => void) | null = null;
    try {
        const rtdbRef = ref(rtdb, `live_rooms/${id}/${credId}`);
        unsubRtdb = onValue(rtdbRef, (snapshot) => {
            const val = snapshot.val();
            if (val && (val.roomId || val.roomPass)) {
                emitIfChanged({
                    roomId: val.roomId ? String(val.roomId) : undefined,
                    roomPass: val.roomPass ? String(val.roomPass) : undefined,
                    streamUrl: val.streamUrl ? String(val.streamUrl) : undefined,
                });
            }
        }, () => {
            // RTDB permission fallback to Firestore
        });
    } catch {
        // Fallback gracefully
    }

    // 2. Firestore real-time onSnapshot listener (authoritative subcollection)
    let unsubFirestore: Unsubscribe | null = null;
    try {
        const credRef = doc(db, collectionName, id, 'credentials', credId);
        unsubFirestore = onSnapshot(credRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as RoomCredentials;
                emitIfChanged(data);
            }
        }, () => {
            // Suppress unhandled permission errors if not joined
        });
    } catch {
        // Fallback gracefully
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

