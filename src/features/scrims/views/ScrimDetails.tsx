import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { Seo } from '../../../shared/components/Seo';
import { SlotGrid } from '../components/SlotGrid';
import { JoinScrimModal } from '../components/JoinScrimModal';
import { DispatchRoomModal } from '../components/DispatchRoomModal';
import ScrimResultsTable from '../components/ScrimResultsTable';
import PerKillLeaderboard from '../components/PerKillLeaderboard';
import PerKillResultView from '../components/PerKillResultView';
import ScoringInfoCard from '../../tournaments/components/ScoringInfoCard';
import { subscribeRoomCredentials, RoomCredentials } from '../../../shared/services/roomCredentials';
import { formatCurrency, formatDate, formatGameName, toDateSafe } from '../../../shared/utils/utils';
import {
  Trophy,
  Calendar,
  Users,
  Clock,
  Shield,
  Key,
  Copy,
  Check,
  Send,
  Trash2,
  AlertCircle,
  Gamepad2,
  ChevronRight,
  LogOut,
  Sparkles,
  MapPin,
  ExternalLink,
  Target,
} from 'lucide-react';

export default function ScrimDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useNotification();

  const [scrim, setScrim] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<number | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const [roomCreds, setRoomCreds] = useState<RoomCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'pass' | null>(null);

  const isPerKill = Boolean(
    scrim?.tournamentMode === 'PER_KILL_REWARD' ||
    Number(scrim?.rewardPerKill) > 0 ||
    Number(scrim?.rewardConfig?.rewardPerKill) > 0
  );

  // 1. Live subscription to scrim document in 'scrims' collection
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const scrimRef = doc(db, 'scrims', id);
    let isMounted = true;

    // Check if document belongs to tournaments collection and redirect if so
    getDoc(scrimRef).then((snap) => {
      if (!snap.exists() && isMounted) {
        // Fallback: if user visited /scrims/:id for a tournament, redirect to /tournaments/:id
        getDoc(doc(db, 'tournaments', id)).then((tSnap) => {
          if (tSnap.exists() && isMounted) {
            navigate(`/tournaments/${id}`, { replace: true });
          } else if (isMounted) {
            setError('Scrim not found.');
            setLoading(false);
          }
        });
      }
    });

    const unsub = onSnapshot(
      scrimRef,
      (docSnap) => {
        if (!isMounted) return;
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setScrim(data);
          setLoading(false);
        } else {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to scrim:', err);
        if (isMounted) {
          setError('Failed to load scrim details.');
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [id, navigate]);

  // 2. Realtime subscription to room credentials
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeRoomCredentials(
      id,
      (creds) => setRoomCreds(creds),
      undefined,
      'scrims'
    );
    return () => unsub();
  }, [id]);

  // Detect whether current user is joined and find their slot number
  const mySlot = useMemo(() => {
    if (!user || !scrim || !Array.isArray(scrim.slots)) return null;
    const found = scrim.slots.find(
      (s: any) =>
        s.captainUid === user.uid ||
        (profile?.teamId && s.teamId === profile.teamId) ||
        s.userId === user.uid
    );
    return found || null;
  }, [user, scrim, profile?.teamId]);

  const isJoined = Boolean(mySlot);
  const mySlotNumber = mySlot?.slotNumber || null;

  const isHostOrAdmin = Boolean(
    user &&
      scrim &&
      (scrim.hostUid === user.uid ||
        scrim.orgId === user.uid ||
        profile?.role === 'admin')
  );

  const handleCopy = (text: string, field: 'id' | 'pass') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    showToast(`${field === 'id' ? 'Room ID' : 'Password'} copied!`, 'success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleLeaveScrim = async () => {
    if (!id || isLeaving) return;
    if (!window.confirm('Are you sure you want to leave this scrim and release your slot?')) {
      return;
    }

    setIsLeaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/scrims/${id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to leave scrim');

      showToast('Successfully released your slot', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to leave scrim', 'error');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteScrim = async () => {
    if (!id || isDeleting) return;
    setIsDeleting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/scrims/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete scrim');

      showToast('Scrim deleted successfully', 'success');
      navigate('/scrims', { replace: true });
    } catch (err: any) {
      showToast(err.message || 'Failed to delete scrim', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-brand-500 text-xs font-black uppercase tracking-widest animate-pulse">
          Connecting to Scrim Lobby...
        </p>
      </div>
    );
  }

  if (error || !scrim) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 px-4">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-2">
          {error || 'Scrim Not Found'}
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          This scrim may have been removed or does not exist.
        </p>
        <Link
          to="/scrims"
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-black font-black uppercase text-xs tracking-wider rounded-xl hover:bg-brand-400 transition-colors"
        >
          Browse All Scrims
        </Link>
      </div>
    );
  }

  const format = scrim.format || 'Squad';
  const totalSlots = Number(scrim.totalSlots) || (format === 'Solo' ? 48 : format === 'Duo' ? 25 : 12);
  const slots = Array.isArray(scrim.slots) ? scrim.slots : [];
  const filledSlotsCount = slots.filter((s: any) => s.status === 'filled').length;
  const entryFee = Number(scrim.entryFee) || 0;
  const prizePool = Number(scrim.prizePool) || 0;
  const hasResults = Boolean(scrim.results && scrim.results.length > 0) || scrim.status === 'completed';

  const bannerImg =
    scrim.bannerUrl ||
    (scrim.game?.toLowerCase().includes('free fire')
      ? 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=80'
      : scrim.game?.toLowerCase().includes('pubg')
      ? 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80'
      : 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1600&q=80');

  return (
    <div className="animate-fade-in max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
      <Seo
        title={`${scrim.title} | Daily Esports Scrim Nepal`}
        description={`Join ${scrim.title} practice scrim on NexPlay. Map: ${scrim.map || 'Bermuda'}. Format: ${format}. Entry: ${entryFee === 0 ? 'FREE' : 'Rs. ' + entryFee}.`}
        canonicalPath={`/scrims/${scrim.id}`}
      />

      {/* Hero Banner Header */}
      <div className="relative rounded-3xl overflow-hidden border border-gray-800 bg-surface/30 shadow-2xl">
        <div className="h-64 sm:h-80 w-full relative">
          <img
            src={bannerImg}
            alt={scrim.title}
            className="w-full h-full object-cover object-center filter brightness-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent" />

          {/* Badges Top Bar */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-wrap gap-2 z-10">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500 text-black shadow-lg">
              {formatGameName(scrim.game)}
            </span>
            {isPerKill ? (
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500/20 border border-brand-500/40 text-brand-400 backdrop-blur-md flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> Per-Kill Scrim ({formatCurrency(scrim?.rewardPerKill || scrim?.rewardConfig?.rewardPerKill || 10)}/kill)
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-surface/90 border border-gray-700 text-brand-400 backdrop-blur-md">
                🎯 Practice Scrim
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg ${
                scrim.status === 'open'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : scrim.status === 'credentials_sent'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                  : scrim.status === 'live'
                  ? 'bg-red-500 text-white font-black animate-pulse'
                  : scrim.status === 'completed'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
              }`}
            >
              {scrim.status === 'credentials_sent' ? 'Credentials Sent' : scrim.status.toUpperCase()}
            </span>
          </div>

          {/* Hero Content Bottom */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 z-10">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-wider drop-shadow-md">
                {scrim.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-300 mt-2">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand-400" />
                  Format: {format} ({totalSlots} Slots)
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-brand-400" />
                  Map: {scrim.map || 'Bermuda'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-brand-400" />
                  {formatDate(scrim.startTime)}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isJoined && (
                <button
                  onClick={handleLeaveScrim}
                  disabled={isLeaving}
                  className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isLeaving ? 'Leaving...' : 'Leave Scrim'}</span>
                </button>
              )}

              {!isJoined && scrim.status === 'open' && (
                <button
                  onClick={() => {
                    setSelectedSlotForBooking(null);
                    setShowJoinModal(true);
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Reserve Slot Now</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stat Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-800 bg-dark-900 border-t border-gray-800">
          <div className="p-4 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entry Fee</div>
            <div className="text-base font-black text-white mt-0.5">
              {entryFee === 0 ? 'FREE' : formatCurrency(entryFee)}
            </div>
          </div>
          <div className="p-4 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {isPerKill ? 'Per-Kill Reward' : 'Prize Pool'}
            </div>
            <div className="text-base font-black text-amber-400 mt-0.5">
              {isPerKill
                ? `${formatCurrency(scrim?.rewardPerKill || scrim?.rewardConfig?.rewardPerKill || 10)} / Kill`
                : (prizePool === 0 ? 'Practice Match' : formatCurrency(prizePool))}
            </div>
          </div>
          <div className="p-4 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Lobby Slots</div>
            <div className="text-base font-black text-brand-400 font-mono mt-0.5">
              {filledSlotsCount} / {totalSlots} Filled
            </div>
          </div>
          <div className="p-4 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Match Time</div>
            <div className="text-xs font-bold text-gray-300 mt-1 truncate px-2">
              {formatDate(scrim.startTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Host Controls Banner */}
      {isHostOrAdmin && (
        <div className="bg-surface/50 border border-brand-500/30 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                Organizer Control Dashboard
              </h4>
              <p className="text-xs text-gray-400">
                You are the host of this scrim lobby. Dispatch match credentials or manage slots.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowDispatchModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <Key className="w-4 h-4" />
              <span>Dispatch Room ID/Pass</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors"
              title="Delete Scrim"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Room Credentials Box (For Joined Participants & Host) */}
      {(isJoined || isHostOrAdmin) && (
        <div className="bg-gradient-to-r from-brand-950/40 via-dark-900 to-dark-900 border-2 border-brand-500/40 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Custom Match Room Credentials
                </h3>
                <p className="text-xs text-gray-400">
                  {mySlotNumber ? `You are assigned to Slot #${mySlotNumber}. ` : ''}
                  Join the custom room and occupy your designated slot.
                </p>
              </div>
            </div>

            {scrim.ytLink && (
              <a
                href={scrim.ytLink}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Watch Live Stream</span>
              </a>
            )}
          </div>

          {roomCreds?.roomId ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface/60 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Room ID
                  </div>
                  <div className="text-xl font-mono font-black text-white mt-1">
                    {roomCreds.roomId}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(roomCreds.roomId!, 'id')}
                  className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover text-gray-300 hover:text-white transition-colors"
                  title="Copy Room ID"
                >
                  {copiedField === 'id' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="bg-surface/60 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Password
                  </div>
                  <div className="text-xl font-mono font-black text-white mt-1">
                    {roomCreds.roomPass || 'None'}
                  </div>
                </div>
                {roomCreds.roomPass && (
                  <button
                    onClick={() => handleCopy(roomCreds.roomPass!, 'pass')}
                    className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover text-gray-300 hover:text-white transition-colors"
                    title="Copy Password"
                  >
                    {copiedField === 'pass' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface/30 border border-dashed border-gray-800 rounded-2xl p-6 text-center text-gray-400 text-xs font-semibold">
              <Clock className="w-5 h-5 mx-auto mb-2 text-brand-400 animate-pulse" />
              Room credentials will appear here 10-15 minutes before the match start time.
            </div>
          )}
        </div>
      )}

      {/* Scoring Rules Explanation */}
      <ScoringInfoCard tournament={scrim as any} />

      {/* Results / Scorecard Table if Completed */}
      {hasResults && (
        <div className="space-y-6">
          {(isPerKill || (scrim?.killRewards && scrim.killRewards.length > 0)) && (
            <div className="bg-surface/30 border border-brand-500/30 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-black text-white uppercase tracking-wider">
                  Per-Kill Rewards & Leaderboard
                </h3>
              </div>
              <PerKillResultView tournament={scrim as any} />
              <PerKillLeaderboard tournament={scrim as any} />
            </div>
          )}

          <div className="bg-surface/30 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Scrim Standings & Scorecard
              </h3>
            </div>
            <ScrimResultsTable
              tournament={scrim as any}
              slots={slots}
            />
          </div>
        </div>
      )}

      {/* Main Content: Interactive Slot Grid */}
      <div className="bg-surface/30 border border-gray-800 rounded-3xl p-6 shadow-xl">
        <SlotGrid
          slots={slots}
          totalSlots={totalSlots}
          mySlotNumber={mySlotNumber}
          isJoined={isJoined}
          selectedSlotNumber={selectedSlotForBooking}
          onSelectSlot={(slotNum) => {
            if (!isJoined && scrim.status === 'open') {
              setSelectedSlotForBooking(slotNum);
              setShowJoinModal(true);
            }
          }}
          showTitle={true}
          isTeamEvent={format !== 'Solo'}
        />
      </div>

      {/* Rules & Information */}
      {scrim.rules && (
        <div className="bg-surface/30 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-3">
          <h3 className="text-base font-black text-white uppercase tracking-wider">
            Match Rules & Guidelines
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line font-medium">
            {scrim.rules}
          </p>
        </div>
      )}

      {/* Modals */}
      {showJoinModal && (
        <JoinScrimModal
          scrim={scrim}
          selectedSlot={selectedSlotForBooking}
          onClose={() => setShowJoinModal(false)}
          onSuccess={(reservedSlot) => {
            showToast(`Slot #${reservedSlot} confirmed!`, 'success');
          }}
        />
      )}

      {showDispatchModal && (
        <DispatchRoomModal
          scrimId={scrim.id}
          scrimTitle={scrim.title}
          initialRoomId={roomCreds?.roomId || ''}
          initialRoomPass={roomCreds?.roomPass || ''}
          initialStreamUrl={scrim.ytLink || ''}
          onClose={() => setShowDispatchModal(false)}
          onSuccess={(rId, rPass, sUrl) => {
            setRoomCreds({ roomId: rId, roomPass: rPass, streamUrl: sUrl });
          }}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-900 border border-gray-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Delete Scrim?
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                Are you sure you want to delete &quot;{scrim.title}&quot;? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 bg-surface hover:bg-surface-hover text-gray-300 font-black text-xs uppercase tracking-wider rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteScrim}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-500/20 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
