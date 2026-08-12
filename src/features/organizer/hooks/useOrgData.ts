import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, increment, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament, Participant, Transaction } from '../../../shared/types/types';

export function useOrgData() {
  const { user, profile } = useAuth();
  const [hostedTournaments, setHostedTournaments] = useState<Tournament[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHostedTournaments = useCallback(async () => {
    if (!user) {
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
    } catch (err) {
      console.error("Error fetching hosted tournaments:", err)
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ponytail: derive scrims, matchRooms, teams, activityFeed from hostedTournaments — no extra Firestore reads
  const scrims = useMemo(() =>
    hostedTournaments.filter(t => (t as any).matchType === 'scrims' || (t as any).isScrim === true),
    [hostedTournaments]
  );

  const matchRooms = useMemo(() =>
    hostedTournaments.filter(t => t.status === 'live' && t.roomId),
    [hostedTournaments]
  );

  // ponytail: teams derived from participants already loaded for active tournaments — ceiling: only covers tournaments whose participants were fetched via fetchParticipants. Upgrade: add a dedicated teams query if full roster coverage is needed.
  const teams = useMemo(() => {
    const teamMap: Record<string, { id: string; name: string; logoUrl?: string; players?: string[]; tournamentId?: string }> = {};
    participants.forEach(p => {
      const teamId = p.teamId || p.userId;
      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          id: teamId,
          name: p.teamName || p.username,
          logoUrl: p.logoUrl,
          players: p.teammates ? [p.username, ...p.teammates] : [p.username],
          tournamentId: p.tournamentId,
        };
      }
    });
    return Object.values(teamMap);
  }, [participants]);

  const activityFeed = useMemo(() => {
    // ponytail: derive activity from recent tournaments — no extra reads. Ceiling: only shows tournament events, not participant joins. Upgrade: add onSnapshot listeners for richer feed.
    const iconFor = (status: string) => {
      if (status === 'live') return 'radio';
      if (status === 'completed') return 'trophy';
      if (status === 'published') return 'trophy';
      return 'activity';
    };
    const timeFor = (ts: any) => {
      if (!ts) return '';
      const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    return hostedTournaments
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        icon: iconFor(t.status),
        text: `${t.title} — ${t.status}`,
        time: timeFor(t.createdAt),
        type: 'tournament',
      }));
  }, [hostedTournaments]);

  // Compute KPIs from real tournament data
  const kpis = useMemo(() => {
    const active = hostedTournaments.filter(t => t.status === 'live' || t.status === 'upcoming' || t.status === 'published').length;
    const prizePool = hostedTournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);
    const filledSlots = hostedTournaments.reduce((sum, t) => sum + (t.currentPlayers || 0), 0);
    const totalSlots = hostedTournaments.reduce((sum, t) => sum + (t.slots || 0), 0);
    const pendingPayouts = transactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    return {
      activeTournaments: active,
      liveScrims: scrims.filter(s => s.status === 'live').length,
      totalTeams: teams.length,
      totalSlots,
      filledSlots,
      prizePool,
      monthlyRevenue: 0,
      pendingPayouts,
      orgWalletBalance: profile?.orgWalletBalance || 0,
      escrowBalance: 0,
    };
  }, [hostedTournaments, transactions, profile, scrims, teams]);

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
      console.error("Error fetching participants:", err)
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(txs);
    } catch (err) {
      console.error("Error fetching transactions:", err)
    }
  }, [user]);

  // --- Write operations ---

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
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount, method, accountDetails: details }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Withdrawal failed');
  }, [user]);

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

  // Auto-fetch on mount — fetch both tournaments AND transactions
  useEffect(() => {
    fetchHostedTournaments();
    fetchTransactions();
  }, [fetchHostedTournaments, fetchTransactions]);

  return {
    hostedTournaments,
    participants,
    transactions,
    loading,
    kpis,
    // Derived data (no extra Firestore reads)
    scrims,
    matchRooms,
    teams,
    activityFeed,
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
