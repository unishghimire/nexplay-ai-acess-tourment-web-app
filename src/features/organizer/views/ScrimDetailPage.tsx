import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { fetchRoomCredentials } from '../../../shared/services/roomCredentials';
import { countFilledScrimSlots, normalizeScrimSlots } from '../../../shared/utils/scrimSlots';
import { toDateSafe } from '../../../shared/utils/utils';
import {
  ChevronLeft, Save, Radio, Users, DollarSign, Calendar,
  Gamepad2, Edit2, Check, X, Lock, Unlock, Copy, Trophy,
  Clock, MapPin, Play, CheckCircle2, RotateCcw,
} from 'lucide-react';

const formatRupees = (n: number = 0) => `Rs. ${new Intl.NumberFormat('en-IN').format(n)}`;
const SCRIM_COLLECTION = 'tournaments'; // scrims stored as tournaments with matchType='scrims'

export default function ScrimDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useNotification();

  const [scrim, setScrim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [scrimCollection, setScrimCollection] = useState<'tournaments' | 'scrims'>('tournaments');
  const [roomId, setRoomId] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // --- Load scrim ---
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError('This scrim link is invalid.');
      return;
    }

    // Real Firestore
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);

    const unsub = onSnapshot(doc(db, 'tournaments', id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        const scrimHostId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
        const isAuthorized = user && (
          user.uid === scrimHostId ||
          profile?.role === 'admin' ||
          !scrimHostId
        );
        if (!isAuthorized) {
          showToast('Unauthorized — you do not own this scrim', 'error');
          navigate('/organizer?tab=scrims');
          return;
        }
        setScrim(data);
        setScrimCollection('tournaments');
        fetchRoomCredentials(id, undefined, 'tournaments').then(credentials => {
          setRoomId(credentials?.roomId || '');
          setRoomPass(credentials?.roomPass || '');
        }).catch(e => {
          console.warn('Room credentials fetch warning:', e);
        });
        setStreamUrl((data as any).ytLink || (data as any).streamUrl || '');
        setLoading(false);
      } else {
        // Fallback: check 'scrims' collection for legacy records
        getDoc(doc(db, 'scrims', id)).then((legacySnap) => {
          if (legacySnap.exists()) {
            const data = { id: legacySnap.id, ...legacySnap.data() } as any;
            const scrimHostId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
            const isAuthorized = user && (
              user.uid === scrimHostId ||
              profile?.role === 'admin' ||
              !scrimHostId
            );
            if (!isAuthorized) {
              showToast('Unauthorized — you do not own this scrim', 'error');
              navigate('/organizer?tab=scrims');
              return;
            }
            setScrim(data);
            setScrimCollection('scrims');
            // AUD-013: fetch credentials from scrims subcollection (not tournaments)
            fetchRoomCredentials(id, undefined, 'scrims').then(credentials => {
                setRoomId(credentials?.roomId || '');
                setRoomPass(credentials?.roomPass || '');
            }).catch(e => {
                console.warn('Room credentials fetch warning:', e);
            });
            setStreamUrl((data as any).ytLink || (data as any).streamUrl || '');
          } else {
            setScrim(null);
          }
          setLoading(false);
        }).catch((e) => {
          console.warn('Fallback scrim load error:', e);
          setLoading(false);
        });
      }
    }, (err) => {
      console.error('Scrim load error:', err);
      // Fallback check on permission or collection error
      getDoc(doc(db, 'scrims', id)).then((legacySnap) => {
        if (legacySnap.exists()) {
          const data = { id: legacySnap.id, ...legacySnap.data() } as any;
          const scrimHostId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
          const isAuthorized = user && (
            user.uid === scrimHostId ||
            profile?.role === 'admin' ||
            !scrimHostId
          );
          if (!isAuthorized) {
            showToast('Unauthorized — you do not own this scrim', 'error');
            navigate('/organizer?tab=scrims');
            return;
          }
          setScrim(data);
          setScrimCollection('scrims');
          setStreamUrl((data as any).ytLink || (data as any).streamUrl || '');
          setLoading(false);
        } else {
          setLoadError('We could not load this scrim. Check your connection and try again.');
          setLoading(false);
        }
      }).catch(() => {
        setLoadError('We could not load this scrim. Check your connection and try again.');
        setLoading(false);
      });
    });

    return () => unsub();
  }, [id, user, profile?.role, navigate, showToast, retryKey]);

  // --- Handlers ---
  const handleSaveEdit = useCallback(async () => {
    const entryFee = Number(editForm.entryFee);
    const prizePool = Number(editForm.prizePool);
    const newSlotCount = Number(editForm.slots);
    if (!id || !editForm.title?.trim() || ![entryFee, prizePool, newSlotCount].every(Number.isFinite) || entryFee < 0 || prizePool < 0 || newSlotCount < 1) {
      showToast('Enter a title, non-negative fees, and at least one slot', 'error');
      return;
    }
    try {
      const currentSlots = normalizeScrimSlots(scrim?.slots, scrim?.totalSlots, scrim?.filledSlots ?? scrim?.currentPlayers);
      let updatedSlots = currentSlots;
      if (newSlotCount < currentSlots.length) {
        updatedSlots = currentSlots.slice(0, newSlotCount);
      } else if (newSlotCount > currentSlots.length) {
        const extra = Array.from({ length: newSlotCount - currentSlots.length }, (_, idx) => ({
          slotNumber: currentSlots.length + idx + 1,
          status: 'open' as const,
          teamName: null,
          teamId: null,
        }));
        updatedSlots = [...currentSlots, ...extra];
      }
      const filled = countFilledScrimSlots(updatedSlots);
      const startDate = toDateSafe(editForm.startTime);

      await updateDoc(doc(db, scrimCollection, id), {
        title: editForm.title.trim(),
        startTime: startDate ? Timestamp.fromDate(startDate) : (editForm.startTime || ''),
        entryFee,
        prizePool,
        slots: updatedSlots,
        totalSlots: newSlotCount,
        filledSlots: filled,
        currentPlayers: filled,
        map: editForm.map || 'Bermuda',
      });
      showToast('Scrim updated', 'success');
      setIsEditing(false);
    } catch {
      showToast('Failed to update scrim', 'error');
    }
  }, [id, scrim, editForm, scrimCollection, showToast]);

  const handleToggleSlot = useCallback(async (slotNumber: number) => {
    if (!scrim) return;

    try {
      const slotsArray = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);

      const newSlots = slotsArray.map((s: any) => {
        if (s.slotNumber !== slotNumber) return s;
        if (s.status === 'filled') return { ...s, status: 'open', teamName: null, teamId: null };
        return { ...s, status: 'filled', teamName: 'Reserved', teamId: null };
      });
      const filled = countFilledScrimSlots(newSlots);
      await updateDoc(doc(db, scrimCollection, id), { slots: newSlots, filledSlots: filled, currentPlayers: filled });
      showToast(`Slot ${slotNumber} toggled`, 'info');
    } catch {
      showToast('Failed to toggle slot', 'error');
    }
  }, [scrim, id, scrimCollection, showToast]);

  const handleBroadcast = useCallback(async () => {
    if (!id) return;
    try {
      await Promise.all([
        setDoc(doc(db, scrimCollection, id, 'credentials', 'main'), { roomId, roomPass }, { merge: true }),
        updateDoc(doc(db, scrimCollection, id), { ytLink: streamUrl }),
      ]);
      showToast('Room credentials broadcasted', 'success');
    } catch {
      showToast('Failed to broadcast', 'error');
    }
  }, [id, roomId, roomPass, streamUrl, scrimCollection, showToast]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    try {
      await updateDoc(doc(db, scrimCollection, id!), { status: newStatus });
      showToast(`Scrim status: ${newStatus.toUpperCase()}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  }, [id, scrimCollection, showToast]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      showToast('Clipboard access is unavailable. Copy the value manually.', 'error');
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="min-h-[100dvh] pt-24 pb-16 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-gray-500 uppercase tracking-widest">Loading Scrim...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="min-h-[100dvh] pt-24 pb-16 flex flex-col items-center justify-center text-center px-4">
        <Gamepad2 className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-gray-300">{loadError}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => setRetryKey(key => key + 1)} className="min-h-[44px] bg-brand-500 hover:bg-brand-400 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors">Try Again</button>
          <button type="button" onClick={() => navigate('/organizer?tab=scrims')} className="min-h-[44px] text-brand-400 hover:text-brand-300 px-5 py-2 text-sm">Back to Scrims</button>
        </div>
      </div>
    );
  }

  if (!scrim) {
    return (
      <div className="min-h-[100dvh] pt-24 pb-16 flex flex-col items-center justify-center">
        <Gamepad2 className="w-16 h-16 text-gray-700 mb-4" />
        <p className="text-gray-400">Scrim not found.</p>
        <button type="button" onClick={() => navigate('/organizer?tab=scrims')} className="mt-4 text-brand-500 text-sm hover:text-brand-400">← Back to Scrims</button>
      </div>
    );
  }

  const slots = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);
  const filledCount = countFilledScrimSlots(slots);
  const totalCount = slots.length;
  const fillPercent = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-[100dvh] pt-20 sm:pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/organizer?tab=scrims')} className="text-gray-400 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{scrim.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {scrim.game || 'Free Fire'} · {scrim.format === '5v5' ? '5v5' : 'Battle Royale'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg bg-surface text-gray-300 text-sm hover:bg-surface flex items-center gap-2 min-h-[44px]">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button type="button" onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-400 flex items-center gap-2 min-h-[44px]">
                <Save className="w-4 h-4" /> Save
              </button>
            </>
          ) : (
            <button type="button" onClick={() => {
              const startDate = toDateSafe(scrim.startTime);
              const startFormatted = startDate ? new Date(startDate.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
              setEditForm({
                title: scrim.title || '',
                startTime: startFormatted,
                entryFee: scrim.entryFee || 0,
                prizePool: scrim.prizePool || 0,
                slots: scrim.totalSlots || (Array.isArray(scrim.slots) ? scrim.slots.length : Number(scrim.slots) || 12),
                map: scrim.map || ''
              });
              setIsEditing(true);
            }} className="px-4 py-2 rounded-lg bg-surface text-white text-sm hover:bg-surface flex items-center gap-2 min-h-[44px]">
              <Edit2 className="w-4 h-4" /> Edit Scrim
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          scrim.status === 'live' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          scrim.status === 'open' ? 'bg-surface text-gray-300 border border-gray-700' :
          'bg-zinc-900 text-gray-500 border border-zinc-800'
        }`}>
          {scrim.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          {(scrim.status || 'open').toUpperCase()}
        </span>
        {/* Status toggle buttons */}
        {scrim.status === 'open' && (
          <button type="button" onClick={() => handleStatusChange('live')} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5" /> Go Live
          </button>
        )}
        {scrim.status === 'live' && (
          <button type="button" onClick={() => handleStatusChange('completed')} className="px-3 py-1.5 rounded-lg bg-surface text-gray-300 border border-gray-700 text-xs font-medium hover:bg-surface flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Finalize
          </button>
        )}
        {scrim.status === 'completed' && (
          <button type="button" onClick={() => handleStatusChange('open')} className="px-3 py-1.5 rounded-lg bg-surface text-gray-300 border border-gray-700 text-xs font-medium hover:bg-surface flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Reopen
          </button>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Scrim info / edit form */}
        <div className="space-y-4">
          <div className="bg-dark/50 border border-gray-800 rounded-lg p-5">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-brand-500" /> Scrim Details
            </h3>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
                  <input value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Start Time</label>
                    <input value={editForm.startTime || ''} onChange={e => setEditForm({ ...editForm, startTime: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Map</label>
                    <input value={editForm.map || ''} onChange={e => setEditForm({ ...editForm, map: e.target.value })} placeholder="Bermuda" className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Entry Fee</label>
                    <input type="number" value={editForm.entryFee || 0} onChange={e => setEditForm({ ...editForm, entryFee: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Prize Pool</label>
                    <input type="number" value={editForm.prizePool || 0} onChange={e => setEditForm({ ...editForm, prizePool: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Slots</label>
                    <input type="number" value={editForm.slots || 0} onChange={e => setEditForm({ ...editForm, slots: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Start Time</p>
                  <p className="text-sm text-white">
                    {toDateSafe(scrim.startTime)?.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) || (typeof scrim.startTime === 'string' ? scrim.startTime : 'TBD')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Map</p>
                  <p className="text-sm text-white">{scrim.map || 'Bermuda'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Entry Fee</p>
                  <p className="text-sm text-white">{formatRupees(scrim.entryFee)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Trophy className="w-3 h-3" /> Prize Pool</p>
                  <p className="text-sm text-white">{formatRupees(scrim.prizePool)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Users className="w-3 h-3" /> Slots</p>
                  <p className="text-sm text-white">{filledCount} / {totalCount} filled</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Format</p>
                  <p className="text-sm text-white">{scrim.format === '5v5' ? '5v5' : 'Battle Royale'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Room dispatch */}
          <div className="bg-dark/50 border border-gray-800 rounded-lg p-5">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-brand-500" /> Room Dispatch
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Room ID</label>
                <div className="flex gap-2">
                  <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="5240212" className="flex-1 bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white font-mono focus-visible:outline-none focus:border-brand-500" />
                  <button type="button" onClick={() => copyToClipboard(roomId, 'roomid')} className="px-3 rounded-lg bg-surface hover:bg-surface text-gray-400">
                    {copied === 'roomid' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Room Password</label>
                <div className="flex gap-2">
                  <input value={roomPass} onChange={e => setRoomPass(e.target.value)} placeholder="ffpro2026" className="flex-1 bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white font-mono focus-visible:outline-none focus:border-brand-500" />
                  <button type="button" onClick={() => copyToClipboard(roomPass, 'roompass')} className="px-3 rounded-lg bg-surface hover:bg-surface text-gray-400">
                    {copied === 'roompass' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Stream Link (Optional)</label>
                <input value={streamUrl} onChange={e => setStreamUrl(e.target.value)} placeholder="https://youtube.com/live/..." className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
              </div>
              <button type="button" onClick={handleBroadcast} className="w-full bg-brand-500 hover:bg-brand-400 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 min-h-[44px]">
                <Radio className="w-4 h-4" /> Broadcast to Players
              </button>
            </div>
          </div>
        </div>

        {/* Right: Slot grid */}
        <div className="bg-dark/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" /> Slot Management
            </h3>
            <span className="text-xs text-gray-500">{filledCount}/{totalCount} filled</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-surface rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-colors" style={{ width: `${fillPercent}%` }} />
          </div>

          <p className="text-xs text-gray-500 mb-3">Click any slot to toggle reservation.</p>

          {/* Slot grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {slots.length > 0 ? slots.map((slot: any) => (
              <button
                key={slot.slotNumber}
                onClick={() => handleToggleSlot(slot.slotNumber)}
                className={`p-3 rounded-lg border text-xs font-medium transition-colors min-h-[60px] flex flex-col items-center justify-center ${
                  slot.status === 'filled'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                    : 'bg-card border-gray-800 border-dashed text-gray-500 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                <span className="text-xs text-gray-500 mb-0.5">Slot {slot.slotNumber}</span>
                {slot.status === 'filled' ? (
                  <span className="flex items-center gap-1 text-[11px]">
                    <Lock className="w-3 h-3" /> {slot.teamName || 'Reserved'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px]">
                    <Unlock className="w-3 h-3" /> Open
                  </span>
                )}
              </button>
            )) : (
              <p className="col-span-full text-center text-xs text-gray-500 py-8">No slots configured.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
