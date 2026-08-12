import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Fetches room credentials for a tournament or specific group.
 * Uses the /tournaments/{id}/credentials subcollection which is protected
 * by Firestore rules — only host + joined participants can read.
 *
 * @param tournamentId The tournament ID
 * @param groupId Optional group ID for per-group credentials
 * @returns { roomId, roomPass } or null if not found / no access
 */
export async function fetchRoomCredentials(
    tournamentId: string,
    groupId?: string,
): Promise<{ roomId?: string; roomPass?: string } | null> {
    try {
        const credId = groupId ? `group_${groupId}` : 'main';
        const credRef = doc(db, 'tournaments', tournamentId, 'credentials', credId);
        const credSnap = await getDoc(credRef);

        if (credSnap.exists()) {
            return credSnap.data() as { roomId?: string; roomPass?: string };
        }
        return null;
    } catch {
        // ponytail: return null on permission error — UI falls back to tournament-level creds
        return null;
    }
}
