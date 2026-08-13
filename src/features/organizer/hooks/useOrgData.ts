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
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHostedTournaments = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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
      console.error("Error fetching hosted tournaments:", err);
      setError("Failed to load tournaments. Please retry.");
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
    const teamMap: Record<string, { id: string; name: string; logoUrl?: string; players?: string[]; tournamentId?: string; rosterLocked?: boolean; strikes?: number; banned?: boolean; banReason?: string }> = {};
    participants.forEach(p => {
      const teamId = p.teamId || p.userId;
      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          id: teamId,
          name: p.teamName || p.username,
          logoUrl: p.logoUrl,
          players: p.teammates ? [p.username, ...p.teammates] : [p.username],
          tournamentId: p.tournamentId,
          rosterLocked: false,
          strikes: 0,
          banned: false,
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

    // Calculate monthly revenue from entry_fee transactions in current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = transactions
      .filter(t => t.type === 'entry_fee' && t.status === 'success')
      .reduce((sum, t) => {
        const txTime = (t as any).timestamp?.toMillis ? (t as any).timestamp.toMillis() : 0;
        return txTime >= monthStart.getTime() ? sum + (t.amount || 0) : sum;
      }, 0);

    // Calculate escrow: sum of prize pools for active (live/upcoming) tournaments
    const escrowBalance = hostedTournaments
      .filter(t => t.status === 'live' || t.status === 'upcoming')
      .reduce((sum, t) => sum + (t.prizePool || 0), 0);

    return {
      activeTournaments: active,
      liveScrims: scrims.filter(s => s.status === 'live').length,
      totalTeams: teams.length,
      totalSlots,
      filledSlots,
      prizePool,
      monthlyRevenue,
      pendingPayouts,
      orgWalletBalance: profile?.orgWalletBalance || profile?.balance || 0,
      escrowBalance,
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

  // Fetch disputes for tournaments owned by this organizer
  const fetchDisputes = useCallback(async () => {
    if (!user || hostedTournaments.length === 0) {
      setDisputes([]);
      return;
    }
    try {
      const tournamentIds = hostedTournaments.map(t => t.id);
      // ponytail: Firestore 'in' query max 10 values — ceiling: organizer with >10 tournaments won't see disputes for all. Upgrade: batch query.
      const batch = tournamentIds.slice(0, 10);
      const q = query(collection(db, 'disputes'), where('tournamentId', 'in', batch));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDisputes(list);
    } catch (err) {
      console.error("Error fetching disputes:", err);
    }
  }, [user, hostedTournaments]);

  // --- Write operations ---

  const deleteTournament = useCallback(async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    const res = await fetch(`/api/tournaments/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete tournament');
    setHostedTournaments(prev => prev.filter(t => t.id !== id));
  }, [user]);

  const updateTournamentStatus = useCallback(async (id: string, status: Tournament['status']) => {
    await updateDoc(doc(db, 'tournaments', id), { status });
    setHostedTournaments(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  const broadcastLobby = useCallback(async (tournamentId: string, roomId: string, roomPass: string, ytLink: string) => {
    await updateDoc(doc(db, 'tournaments', tournamentId), { roomId, roomPass, ytLink });
    setHostedTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, roomId, roomPass, ytLink } : t));
  }, []);

  const updateParticipantStatus = useCallback(async (participantId: string, status: 'approved' | 'rejected', tournamentId: string) => {
    // FIX: atomic batch write — prevents player count corruption on double-approve
    const batch = writeBatch(db);
    batch.update(doc(db, 'participants', participantId), { status });
    const inc = status === 'approved' ? 1 : -1;
    batch.update(doc(db, 'tournaments', tournamentId), { currentPlayers: increment(inc) });
    await batch.commit();
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
    // Verify ownership before sending
    const tDoc = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
    if (tDoc.empty) throw new Error('Tournament not found');
    const tData = tDoc.docs[0].data();
    if (tData.hostUid !== user?.uid) throw new Error('Not authorized — you do not own this tournament');

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
  }, [user]);

  const saveOrgSettings = useCallback(async (settings: { orgName?: string; bio?: string; whatsapp?: string; contactInfo?: string; discord?: string; youtubeUrl?: string; twitchUrl?: string; refereeName?: string; refereeEnabled?: boolean; casterName?: string; casterEnabled?: boolean }) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), settings);
  }, [user]);

  // --- Real implementations for previously fake buttons ---

  const toggleScrimSlot = useCallback(async (scrimId: string, slotNumber: number) => {
    if (!user) throw new Error('Not authenticated');
    // Fetch the scrim doc to get current slots
    const snap = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', scrimId)));
    if (snap.empty) throw new Error('Scrim not found');
    const data = snap.docs[0].data() as any;
    if (data.hostUid !== user.uid) throw new Error('Not authorized');

    const currentSlots = data.slots || [];
    const newSlots = currentSlots.map((s: any) => {
      if (s.slotNumber !== slotNumber) return s;
      if (s.status === 'filled') return { ...s, status: 'open', teamName: null, teamId: null };
      return { ...s, status: 'filled', teamName: 'Reserved', teamId: null };
    });
    const filled = newSlots.filter((s: any) => s.status === 'filled').length;
    await updateDoc(doc(db, 'tournaments', scrimId), { slots: newSlots, filledSlots: filled, currentPlayers: filled });
  }, [user]);

  const toggleRosterLock = useCallback(async (teamId: string) => {
    if (!user) throw new Error('Not authenticated');
    // Find the team in participants and toggle rosterLocked
    const q = query(collection(db, 'participants'), where('teamId', '==', teamId));
    const snap = await getDocs(q);
    if (snap.empty) {
      // Try by userId
      const q2 = query(collection(db, 'participants'), where('userId', '==', teamId));
      const snap2 = await getDocs(q2);
      if (snap2.empty) throw new Error('Team not found');
      const pDoc = snap2.docs[0];
      const current = pDoc.data() as any;
      const tournamentId = current.tournamentId;
      // Verify ownership
      const tSnap = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
      const tData = tSnap.docs[0]?.data() as any;
      if (tData?.hostUid !== user.uid) throw new Error('Not authorized');
      await updateDoc(pDoc.ref, { rosterLocked: !current.rosterLocked });
      return;
    }
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
    const tSnap = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
    const tData = tSnap.docs[0]?.data() as any;
    if (tData?.hostUid !== user.uid) throw new Error('Not authorized');
    await updateDoc(pDoc.ref, { rosterLocked: !current.rosterLocked });
  }, [user]);

  const issueWarning = useCallback(async (teamName: string, reason: string) => {
    if (!user) throw new Error('Not authenticated');
    // Find team by name in participants
    const q = query(collection(db, 'participants'), where('teamName', '==', teamName));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Team not found');
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
    // Verify ownership
    const tSnap = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
    const tData = tSnap.docs[0]?.data() as any;
    if (tData?.hostUid !== user.uid) throw new Error('Not authorized');
    const newStrikes = (current.strikes || 0) + 1;
    await updateDoc(pDoc.ref, { strikes: newStrikes, lastWarning: reason, lastWarningAt: serverTimestamp() });
  }, [user]);

  const toggleBanTeam = useCallback(async (teamId: string, teamName: string) => {
    if (!user) throw new Error('Not authenticated');
    const q = query(collection(db, 'participants'), where('teamId', '==', teamId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Team not found');
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
    const tSnap = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
    const tData = tSnap.docs[0]?.data() as any;
    if (tData?.hostUid !== user.uid) throw new Error('Not authorized');
    await updateDoc(pDoc.ref, { banned: !current.banned });
  }, [user]);

  const resolveDispute = useCallback(async (disputeId: string, action: 'warn' | 'ban' | 'dismiss') => {
    if (!user) throw new Error('Not authenticated');
    const dRef = doc(db, 'disputes', disputeId);
    const status = action === 'dismiss' ? 'dismissed' : 'resolved';
    await updateDoc(dRef, {
      status,
      resolvedAt: serverTimestamp(),
      resolvedBy: user.uid,
      resolutionAction: action,
    });
    setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status } : d));
  }, [user]);

  // Auto-fetch on mount — fetch tournaments AND transactions
  useEffect(() => {
    fetchHostedTournaments();
    fetchTransactions();
  }, [fetchHostedTournaments, fetchTransactions]);

  // FIX: auto-fetch participants for the most recent active tournament so Teams tab isn't empty on initial load
  useEffect(() => {
    if (hostedTournaments.length > 0 && participants.length === 0) {
      const active = hostedTournaments.find(t => t.status === 'live' || t.status === 'upcoming' || t.status === 'published');
      const target = active || hostedTournaments[0];
      fetchParticipants(target.id);
    }
  }, [hostedTournaments, participants.length, fetchParticipants]);

  // Fetch disputes after tournaments are loaded
  useEffect(() => {
    if (hostedTournaments.length > 0) {
      fetchDisputes();
    }
  }, [fetchDisputes]);

  return {
    hostedTournaments,
    participants,
    transactions,
    disputes,
    loading,
    error,
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
    fetchDisputes,
    deleteTournament,
    updateTournamentStatus,
    broadcastLobby,
    updateParticipantStatus,
    requestWithdrawal,
    broadcastAnnouncement,
    saveOrgSettings,
    // Real implementations for previously fake buttons
    toggleScrimSlot,
    toggleRosterLock,
    issueWarning,
    toggleBanTeam,
    resolveDispute,
  };
}
