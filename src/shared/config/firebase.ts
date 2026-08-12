import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableNetwork, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize Firebase once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ponytail: use initializeFirestore with offline persistence when available.
// Ceiling: persistentLocalCache uses IndexedDB — not available in SSR/Node.
// Upgrade: none needed, guard handles it.
let db;
if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
    try {
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        }, (firebaseConfig as any).firestoreDatabaseId);
    } catch {
        db = (firebaseConfig as any).firestoreDatabaseId ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) : getFirestore(app);
    }
} else {
    db = (firebaseConfig as any).firestoreDatabaseId ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) : getFirestore(app);
}
export { db };
export const storage = getStorage(app);

export let analytics: any = null;
if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });

    // Reconnect Firestore when network comes back online
    window.addEventListener('online', () => {
        enableNetwork(db).catch((e) => console.error('Failed to re-enable Firestore network:', e));
    });
}

// Error Handling System
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  
  const errorMessage = JSON.stringify(errInfo);
  console.error('Firestore Error:', errorMessage);
  
  // Custom event for global UI error handling
  window.dispatchEvent(new CustomEvent('app-error', { detail: errInfo }));
  
  throw new Error(errorMessage);
}

// Network Management
export const reconnectFirestore = async () => {
    try {
        await enableNetwork(db);
    } catch (e) {
        console.error("Failed to re-enable network", e);
    }
};
