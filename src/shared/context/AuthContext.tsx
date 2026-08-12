import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { UserProfile } from '../types/types';

interface AuthContextType {
    user: { uid: string; email: string; username: string; role: string } | null;
    profile: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    profile: null, 
    loading: true,
    logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

// ponytail: 8s timeout — if onAuthStateChanged never fires (network issue, Firebase down),
// unblock the UI and render as logged-out. Prevents infinite loading screen.
const AUTH_TIMEOUT_MS = 8000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<{ uid: string; email: string; username: string; role: string } | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const logout = async () => {
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    status: 'offline',
                    lastActive: serverTimestamp()
                });
            } catch (e) {
                // Failed to update status on logout
            }
        }
        await signOut(auth);
        setUser(null);
        setProfile(null);
    };

    useEffect(() => {
        let settled = false;

        const markDone = () => {
            if (!settled) {
                settled = true;
                setLoading(false);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    let userSnap;
                    try {
                        userSnap = await getDoc(userRef);
                    } catch (e) {
                        // [AUTH] Failed to getDoc userRef
                        throw e;
                    }
                    
                    if (!userSnap.exists()) {
                        // Create user document if it doesn't exist (e.g., first Google Sign-In)
                        const newUser = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                            role: 'player',
                            balance: 0,
                            totalEarnings: 0,
                            inGameId: '',
                            inGameName: '',
                            teamName: '',
                            phone: '',
                            isBanned: false,
                            createdAt: serverTimestamp(),
                            isOrganizer: false,
                        };
                        try {
                            await setDoc(userRef, newUser);
                        } catch (e) {
                            // [AUTH] Failed to setDoc userRef
                            throw e;
                        }
                        
                        // Create public profile
                        try {
                            await setDoc(doc(db, 'users_public', firebaseUser.uid), {
                                uid: firebaseUser.uid,
                                username: newUser.username,
                                totalEarnings: 0,
                                inGameId: '',
                                inGameName: '',
                                role: newUser.role,
                                updatedAt: serverTimestamp(),
                            });
                        } catch (e) {
                            // [AUTH] Failed to setDoc users_public
                            throw e;
                        }
                        
                        setUser({ uid: newUser.uid, email: newUser.email, username: newUser.username, role: newUser.role });
                        setProfile(newUser as UserProfile);
                    } else {
                        const data = userSnap.data() as UserProfile;
                        setUser({ uid: data.uid, email: data.email, username: data.username, role: data.role || 'player' });
                        setProfile(data);
                    }
                } else {
                    setUser(null);
                    setProfile(null);
                }
            } catch (error) {
                // Error in auth state change
                // If there's an error (e.g., permission denied), we should still stop loading
                // and potentially clear the user state to prevent infinite loading
                setUser(null);
                setProfile(null);
            } finally {
                markDone();
            }
        });

        // Timeout fallback — if onAuthStateChanged never fires, unblock the UI
        const timeoutId = setTimeout(() => {
            console.warn("Auth: Firebase auth timed out after 8s, rendering as logged-out");
            markDone();
        }, AUTH_TIMEOUT_MS);

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    const statusRef = React.useRef<string | undefined>(profile?.status);
    useEffect(() => {
        statusRef.current = profile?.status;
    }, [profile?.status]);

    useEffect(() => {
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            const unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as UserProfile;
                    setProfile(data);
                    // Update user role if it changes in profile
                    setUser(prev => (prev && prev.role !== data.role) ? { ...prev, role: data.role } : prev);
                }
            }, (error) => {
                // Error in user profile snapshot
            });

            // Presence Management — debounced to avoid excessive Firestore writes
            // ponytail: was writing on every visibilitychange event; now debounced 5s
            let presenceTimer: ReturnType<typeof setTimeout> | null = null;
            const updatePresence = async (status: 'online' | 'idle' | 'offline' | 'dnd') => {
                if (statusRef.current === 'dnd' && status !== 'offline') return;
                
                if (presenceTimer) clearTimeout(presenceTimer);
                presenceTimer = setTimeout(async () => {
                    try {
                        await updateDoc(userRef, {
                            status,
                            lastActive: serverTimestamp()
                        });
                    } catch (e) {
                        // Presence update failed — non-critical
                    }
                }, 5000);
            };

            // Immediate online on mount, but skip the debounce for initial
            updateDoc(userRef, { status: 'online', lastActive: serverTimestamp() }).catch(() => {});

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible') {
                    updatePresence('online');
                } else {
                    updatePresence('idle');
                }
            };

            const handleBeforeUnload = () => {
                // Can't debounce beforeunload — fire immediately
                if (presenceTimer) clearTimeout(presenceTimer);
                updateDoc(userRef, { status: 'offline', lastActive: serverTimestamp() }).catch(() => {});
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
                unsubscribeProfile();
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }
    }, [user?.uid]);

    return (
        <AuthContext.Provider value={{ user, profile, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
