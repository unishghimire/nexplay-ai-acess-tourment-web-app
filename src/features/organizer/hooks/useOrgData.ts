import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, increment, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament, Participant, Transaction } from '../../../shared/types/types';
import { fetchRoomCredentials } from '../../../shared/services/roomCredentials';
import { commitFirestoreBatches } from '../../../shared/utils/firestoreBatches';
import { toDateSafe } from '../../../shared/utils/utils';
import { countFilledScrimSlots, normalizeScrimSlots } from '../../../shared/utils/scrimSlots';

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
      const tours = await Promise.all(snap.docs.map(async d => {
        const tournament = { id: d.id, ...d.data() } as Tournament;
        if (tournament.status !== 'live') return tournament;
        const credentials = await fetchRoomCredentials(tournament.id);
        return credentials ? { ...tournament, ...credentials } : tournament;
      }));
      tours.sort((a, b) => {
        const aTime = toDateSafe(a.createdAt)?.getTime() || 0;
        const bTime = toDateSafe(b.createdAt)?.getTime() || 0;
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

  // Derive scrims with comprehensive field matching
  const scrims = useMemo(() =>
    hostedTournaments.filter(t => (t as any).matchType === 'scrims' || (t as any).isScrim === true || (t.title && t.title.toLowerCase().includes('scrim'))),
    [hostedTournaments]
  );

  const matchRooms = useMemo(() =>
    hostedTournaments.filter(t => t.status === 'live'),
    [hostedTournaments]
  );

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
    const iconFor = (status: string) => {
      if (status === 'live') return 'radio';
      if (status === 'completed') return 'trophy';
      if (status === 'published') return 'trophy';
      return 'activity';
    };
    const timeFor = (ts: any) => {
      const d = toDateSafe(ts);
      if (!d) return '';
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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = transactions
      .filter(t => t.type === 'entry_fee' && t.status === 'success')
      .reduce((sum, t) => {
        const txTime = toDateSafe((t as any).timestamp)?.getTime() || 0;
        return txTime >= monthStart.getTime() ? sum + (t.amount || 0) : sum;
      }, 0);

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
        const aTime = toDateSafe(a.timestamp)?.getTime() || 0;
        const bTime = toDateSafe(b.timestamp)?.getTime() || 0;
        return bTime - aTime;
      });
      setParticipants(list);
    } catch (err) {
      console.error("Error fetching participants:", err);
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
      console.error("Error fetching transactions:", err);
    }
  }, [user]);

  // Fetch disputes for tournaments owned by this organizer
  const fetchDisputes = useCallback(async () => {
    if (!user || hostedTournaments.length === 0) {
      setDisputes([]);
      return;
    }
    try {
      const tournamentIds = hostedTournaments.map(t => t.id).filter(Boolean);
      if (tournamentIds.length === 0) {
        setDisputes([]);
        return;
      }

      // Firestore permits at most ten values in an `in` query. Query every
      // organizer tournament batch rather than silently dropping older disputes.
      const batches = Array.from({ length: Math.ceil(tournamentIds.length / 10) }, (_, index) =>
        tournamentIds.slice(index * 10, (index + 1) * 10)
      );
      const snapshots = await Promise.all(
        batches.map(ids => getDocs(query(collection(db, 'disputes'), where('tournamentId', 'in', ids))))
      );
      setDisputes(snapshots.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))));
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
    await Promise.all([
      setDoc(doc(db, 'tournaments', tournamentId, 'credentials', 'main'), { roomId, roomPass }, { merge: true }),
      updateDoc(doc(db, 'tournaments', tournamentId), { ytLink }),
    ]);
    setHostedTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, roomId, roomPass, ytLink } : t));
  }, []);

  const updateParticipantStatus = useCallback(async (participantId: string, status: 'approved' | 'rejected', tournamentId: string) => {
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
    const tDoc = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
    if (tDoc.empty) throw new Error('Tournament not found');
    const tData = tDoc.docs[0].data();
    if (tData.hostUid !== user?.uid) throw new Error('Not authorized — you do not own this tournament');

    const pQuery = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
    const pSnap = await getDocs(pQuery);
    const parts = pSnap.docs.map(d => d.data() as Participant);
    if (parts.length === 0) return 0;
    const notificationOperations = parts.map(p => (batch: any) => {
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
    await commitFirestoreBatches(db, notificationOperations);
    return parts.length;
  }, [user]);

  const saveOrgSettings = useCallback(async (settings: { orgName?: string; bio?: string; whatsapp?: string; contactInfo?: string; discord?: string; youtubeUrl?: string; twitchUrl?: string; refereeName?: string; refereeEnabled?: boolean; casterName?: string; casterEnabled?: boolean }) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), settings);
  }, [user]);

  const toggleScrimSlot = useCallback(async (scrimId: string, slotNumber: number) => {
    if (!user) throw new Error('Not authenticated');
    const snap = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', scrimId)));
    if (snap.empty) throw new Error('Scrim not found');
    const data = snap.docs[0].data() as any;
    if (data.hostUid !== user.uid) throw new Error('Not authorized');

    const currentSlots = normalizeScrimSlots(data.slots, data.totalSlots, data.filledSlots ?? data.currentPlayers);
    const newSlots = currentSlots.map((s: any) => {
      if (s.slotNumber !== slotNumber) return s;
      if (s.status === 'filled') return { ...s, status: 'open', teamName: null, teamId: null };
      return { ...s, status: 'filled', teamName: 'Reserved', teamId: null };
    });
    const filled = countFilledScrimSlots(newSlots);
    await updateDoc(doc(db, 'tournaments', scrimId), { slots: newSlots, filledSlots: filled, currentPlayers: filled });
    setHostedTournaments(prev => prev.map(t => t.id === scrimId
      ? { ...t, slots: newSlots as any, filledSlots: filled, currentPlayers: filled }
      : t
    ));
  }, [user]);

  const toggleRosterLock = useCallback(async (teamId: string) => {
    if (!user) throw new Error('Not authenticated');
    const q = query(collection(db, 'participants'), where('teamId', '==', teamId));
    const snap = await getDocs(q);
    if (snap.empty) {
      const q2 = query(collection(db, 'participants'), where('userId', '==', teamId));
      const snap2 = await getDocs(q2);
      if (snap2.empty) throw new Error('Team not found');
      const pDoc = snap2.docs[0];
      const current = pDoc.data() as any;
      const tournamentId = current.tournamentId;
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
    const q = query(collection(db, 'participants'), where('teamName', '==', teamName));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Team not found');
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
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

  useEffect(() => {
    fetchHostedTournaments();
    fetchTransactions();
  }, [fetchHostedTournaments, fetchTransactions]);

  useEffect(() => {
    if (hostedTournaments.length > 0 && participants.length === 0) {
      const active = hostedTournaments.find(t => t.status === 'live' || t.status === 'upcoming' || t.status === 'published');
      const target = active || hostedTournaments[0];
      fetchParticipants(target.id);
    }
  }, [hostedTournaments, participants.length, fetchParticipants]);

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
    scrims,
    matchRooms,
    teams,
    activityFeed,
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
    toggleScrimSlot,
    toggleRosterLock,
    issueWarning,
    toggleBanTeam,
    resolveDispute,
  };
}
