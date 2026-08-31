import { useEffect } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb, auth } from '../config/firebase';

export interface UserPresenceState {
  status: 'online' | 'offline';
  activeTournamentId?: string | null;
  lastSeen: object | number;
}

/**
 * Hook to manage real-time presence lifecycle for the authenticated user.
 * Automatically synchronizes connection state and handles graceful disconnects.
 */
export function useUserPresence(activeTournamentId?: string) {
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) return;

      // Queue offline status on disconnect on the Firebase server
      onDisconnect(userPresenceRef)
        .set({
          status: 'offline',
          lastSeen: serverTimestamp(),
        })
        .then(() => {
          // Set current active online status
          set(userPresenceRef, {
            status: 'online',
            activeTournamentId: activeTournamentId || null,
            lastSeen: serverTimestamp(),
          });
        })
        .catch((err) => {
          console.warn('Could not establish onDisconnect presence hook:', err);
        });
    });

    return () => {
      unsubscribe();
      // On voluntary component unmount, mark as offline if needed
      set(userPresenceRef, {
        status: 'offline',
        lastSeen: Date.now(),
      }).catch(() => {
        // Suppress background unmount disconnect errors
      });
    };
  }, [activeTournamentId]);
}
