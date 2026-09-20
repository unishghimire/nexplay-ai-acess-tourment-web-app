import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported, Messaging } from 'firebase/messaging';
import { app, db, auth } from '../config/firebase';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

let messagingInstance: Messaging | null = null;
let isForegroundListenerRegistered = false;

/**
 * Checks whether the current browser/environment supports PWA Web Push notifications.
 */
export const isPushSupported = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window
    );
};

/**
 * Returns the current notification permission state.
 */
export const getPushPermissionState = (): PushPermissionState => {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
};

/**
 * Helper to compute a consistent document key from an FCM token string.
 */
const getTokenDocId = (token: string): string => {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash) + token.charCodeAt(i);
        hash |= 0;
    }
    return `device_${Math.abs(hash).toString(36)}`;
};

/**
 * Requests push notification permission and registers the device FCM token.
 */
export const requestPushPermissionAndToken = async (
    userId: string
): Promise<{ success: boolean; token?: string; reason?: string }> => {
    if (!isPushSupported()) {
        return { success: false, reason: 'unsupported' };
    }

    try {
        // 1. Request browser notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return { success: false, reason: permission };
        }

        // 2. Ensure service worker is registered and active
        const registration = await navigator.serviceWorker.ready;
        if (!registration) {
            return { success: false, reason: 'service_worker_not_ready' };
        }

        // 3. Verify Firebase Cloud Messaging support
        const messagingSupported = await isMessagingSupported();
        if (!messagingSupported) {
            return { success: false, reason: 'messaging_unsupported' };
        }

        if (!messagingInstance) {
            messagingInstance = getMessaging(app);
        }

        // 4. Retrieve FCM device token
        const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;
        const currentToken = await getToken(messagingInstance, {
            vapidKey: vapidKey || undefined,
            serviceWorkerRegistration: registration,
        });

        if (!currentToken) {
            return { success: false, reason: 'no_token_received' };
        }

        // 5. Store token in Firestore under users/{userId}/fcm_tokens/{docId}
        const tokenDocId = getTokenDocId(currentToken);
        const tokenRef = doc(db, 'users', userId, 'fcm_tokens', tokenDocId);

        await setDoc(tokenRef, {
            token: currentToken,
            userId,
            platform: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            userAgent: navigator.userAgent.slice(0, 200),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
        }, { merge: true });

        // 6. Register token with backend server
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (idToken) {
                await fetch('/api/notifications/fcm-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        token: currentToken,
                        platform: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                        userAgent: navigator.userAgent.slice(0, 200),
                    }),
                });
            }
        } catch (serverErr) {
            console.warn('Could not sync FCM token to server API (Firestore write succeeded):', serverErr);
        }

        // 7. Setup foreground notification listener once
        if (!isForegroundListenerRegistered && messagingInstance) {
            isForegroundListenerRegistered = true;
            onMessage(messagingInstance, (payload) => {
                const title = payload.notification?.title || 'NexPlay Esports';
                const body = payload.notification?.body || 'New tournament update!';
                // If user is currently focused in the app, display a system notification if permitted
                if (Notification.permission === 'granted') {
                    new Notification(title, {
                        body,
                        icon: '/logo.png',
                        badge: '/favicon-32x32.png',
                    });
                }
            });
        }

        return { success: true, token: currentToken };
    } catch (error: any) {
        console.error('Error requesting push permission / token:', error);
        return { success: false, reason: error?.message || 'unknown_error' };
    }
};

/**
 * Unregisters the current device's FCM token.
 */
export const unregisterPushToken = async (userId: string): Promise<boolean> => {
    try {
        if (!isPushSupported() || !userId) return false;

        const registration = await navigator.serviceWorker.ready;
        if (!messagingInstance && (await isMessagingSupported())) {
            messagingInstance = getMessaging(app);
        }

        if (messagingInstance) {
            const currentToken = await getToken(messagingInstance, {
                serviceWorkerRegistration: registration,
            }).catch(() => null);

            if (currentToken) {
                const tokenDocId = getTokenDocId(currentToken);
                await deleteDoc(doc(db, 'users', userId, 'fcm_tokens', tokenDocId));

                const idToken = await auth.currentUser?.getIdToken();
                if (idToken) {
                    await fetch('/api/notifications/fcm-token', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`,
                        },
                        body: JSON.stringify({ token: currentToken }),
                    }).catch(() => null);
                }
            }
        }
        return true;
    } catch (error) {
        console.error('Error unregistering push token:', error);
        return false;
    }
};

/**
 * Sends a test push notification to the current authenticated user's registered devices.
 */
export const sendTestPushNotification = async (): Promise<{ success: boolean; message: string }> => {
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
            return { success: false, message: 'Please sign in to send a test notification.' };
        }

        const res = await fetch('/api/notifications/send-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                title: '⚡ NexPlay Push Alert',
                body: 'Push notifications are successfully active on your device! You will receive live match credentials and tournament alerts.',
                link: '/dashboard',
            }),
        });

        const data = await res.json();
        return {
            success: res.ok && data.success,
            message: data.message || (res.ok ? 'Test notification sent!' : 'Failed to send test notification.'),
        };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Network error while sending test push.' };
    }
};
