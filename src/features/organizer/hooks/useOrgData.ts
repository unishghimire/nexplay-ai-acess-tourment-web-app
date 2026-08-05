import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament, Participant, Transaction } from '../../../shared/types/types';
import {
  mockTournaments, mockTeams, mockScrims, mockMatchRooms,
  mockDisputes, mockTransactions, mockKPIs, mockActivityFeed,
} from '../data/orgMockData';

export function useOrgData() {
  const { user, profile } = useAuth();
  const [hostedTournaments, setHostedTournaments] = useState<Tournament[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const fetchHostedTournaments = useCallback(async () => {
    if (!user) {
      setIsDemoMode(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'tournaments'), where('hostUid', '==', user.uid));
      const snap = await getDocs(q);
      const tours = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      tours.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
      setHostedTournaments(tours);
      setIsDemoMode(tours.length === 0);
    } catch (err) {
      console.error('Error fetching hosted tournaments:', err);
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchParticipants = useCallback(async (tournamentId: string) => {
    if (!tournamentId || !user) {
      setParticipants([]);
      return;
    }
    try {
      const q = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
      list.sort((a, b) => {
        const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return bTime - aTime;
      });
      setParticipants(list);
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      txs.sort((a, b) => {
        const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return bTime - aTime;
      });
      setTransactions(txs);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [user]);

  // --- Write operations (Firestore only, no demo mode for writes) ---

  const deleteTournament = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'tournaments', id));
    setHostedTournaments(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateTournamentStatus = useCallback(async (id: string, status: Tournament['status']) => {
    await updateDoc(doc(db, 'tournaments', id), { status });
    setHostedTournaments(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  const broadcastLobby = useCallback(async (tournamentId: string, roomId: string, roomPass: string, ytLink: string) => {
    await updateDoc(doc(db, 'tournaments', tournamentId), { roomId, roomPass, ytLink });
    setHostedTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, roomId, roomPass, ytLink } : t));
  }, []);

  const updateParticipantStatus = useCallback(async (participantId: string, status: 'approved' | 'rejected', tournamentId: string) => {
    await updateDoc(doc(db, 'participants', participantId), { status });
    const inc = status === 'approved' ? 1 : -1;
    await updateDoc(doc(db, 'tournaments', tournamentId), { currentPlayers: increment(inc) });
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, status } : p));
  }, []);

  const requestWithdrawal = useCallback(async (amount: number, method: string, details: string) => {
    if (!user) throw new Error('Not authenticated');
    const txData = {
      userId: user.uid,
      username: profile?.username || 'Organizer',
      userEmail: user.email || '',
      type: 'withdraw',
      amount,
      method,
      refId: `WTH-${Date.now().toString().slice(-6)}`,
      status: 'pending',
      accountDetails: details,
      desc: `Withdrawal of Rs. ${amount} via ${method}`,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'transactions'), txData);
    await updateDoc(doc(db, 'users', user.uid), { orgWalletBalance: increment(-amount) });
  }, [user, profile]);

  const broadcastAnnouncement = useCallback(async (tournamentId: string, message: string, tournamentTitle: string) => {
    const pQuery = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
    const pSnap = await getDocs(pQuery);
    const parts = pSnap.docs.map(d => d.data() as Participant);
    if (parts.length === 0) return 0;
    const batch = writeBatch(db);
    parts.forEach(p => {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: p.userId,
        title: `Announcement: ${tournamentTitle}`,
        message,
        type: 'alert',
        read: false,
        timestamp: serverTimestamp(),
      });
    });
    await batch.commit();
    return parts.length;
  }, []);

  const saveOrgSettings = useCallback(async (settings: { orgName?: string; bio?: string; whatsapp?: string; contactInfo?: string; discord?: string }) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), settings);
  }, [user]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchHostedTournaments();
  }, [fetchHostedTournaments]);

  return {
    // Data
    hostedTournaments: isDemoMode ? mockTournaments as unknown as Tournament[] : hostedTournaments,
    participants,
    transactions: isDemoMode ? mockTransactions as unknown as Transaction[] : transactions,
    loading,
    isDemoMode,
    // Demo data (always available for reference)
    demoTeams: mockTeams,
    demoScrims: mockScrims,
    demoMatchRooms: mockMatchRooms,
    demoDisputes: mockDisputes,
    demoKPIs: mockKPIs,
    demoActivity: mockActivityFeed,
    demoTransactions: mockTransactions,
    // Actions
    fetchHostedTournaments,
    fetchParticipants,
    fetchTransactions,
    deleteTournament,
    updateTournamentStatus,
    broadcastLobby,
    updateParticipantStatus,
    requestWithdrawal,
    broadcastAnnouncement,
    saveOrgSettings,
  };
}
