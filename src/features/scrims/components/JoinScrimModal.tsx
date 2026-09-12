import React, { useState } from 'react';
import { X, Shield, AlertCircle, CheckCircle2, Trophy, Users, Zap } from 'lucide-react';
import { auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { formatCurrency } from '../../../shared/utils/utils';

interface JoinScrimModalProps {
  scrim: {
    id: string;
    title: string;
    entryFee?: number;
    format?: string;
    game?: string;
    totalSlots?: number;
    slots?: any[];
  };
  selectedSlot?: number | null;
  onClose: () => void;
  onSuccess: (slotNumber: number) => void;
}

export const JoinScrimModal: React.FC<JoinScrimModalProps> = ({
  scrim,
  selectedSlot: initialSelectedSlot,
  onClose,
  onSuccess,
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();

  // Find first available slot if none preselected
  const openSlots = (scrim.slots || []).filter(s => s.status === 'open');
  const [slotNumber, setSlotNumber] = useState<number>(
    initialSelectedSlot || (openSlots.length > 0 ? openSlots[0].slotNumber : 1)
  );
  const [teamName, setTeamName] = useState(profile?.teamName || profile?.username || '');
  const [captainDiscord, setCaptainDiscord] = useState(profile?.discord || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entryFee = Number(scrim.entryFee) || 0;
  const userBalance = Number(profile?.balance) || 0;
  const hasSufficientBalance = entryFee === 0 || userBalance >= entryFee;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Please sign in to join this scrim', 'error');
      return;
    }

    if (!slotNumber || slotNumber < 1) {
      setError('Please select a valid slot number');
      return;
    }

    if (entryFee > 0 && !hasSufficientBalance) {
      setError(`Insufficient balance. You need NPR ${entryFee.toLocaleString()} (Available: NPR ${userBalance.toLocaleString()})`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/scrims/${scrim.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          slotNumber,
          teamName: teamName.trim() || profile?.username || 'Player',
          teamId: profile?.teamId || null,
          teamLogo: profile?.teamLogo || null,
          captainDiscord: captainDiscord.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to book slot');
      }

      showToast(`Slot #${slotNumber} reserved successfully!`, 'success');
      onSuccess(slotNumber);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join scrim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-surface/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Book Scrim Slot
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                {scrim.title} • {scrim.format || 'Squad'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-surface hover:bg-surface-hover text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleJoin} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Slot Selection */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Slot Number
            </label>
            <select
              value={slotNumber}
              onChange={(e) => setSlotNumber(Number(e.target.value))}
              className="w-full bg-surface border border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-brand-500"
            >
              {(scrim.slots || []).map((s) => (
                <option
                  key={s.slotNumber}
                  value={s.slotNumber}
                  disabled={s.status !== 'open' && s.slotNumber !== initialSelectedSlot}
                >
                  Slot #{s.slotNumber} {s.status === 'filled' ? '— (Occupied)' : '— (Available)'}
                </option>
              ))}
            </select>
          </div>

          {/* Team / Captain Name */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Team / Squad Name
            </label>
            <input
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Red Dragons Esports"
              className="w-full bg-surface border border-gray-800 rounded-xl px-4 py-3 text-sm font-semibold text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Discord Tag */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Captain Discord (For Match Room Coordination)
            </label>
            <input
              type="text"
              value={captainDiscord}
              onChange={(e) => setCaptainDiscord(e.target.value)}
              placeholder="e.g. player#1234 or discord username"
              className="w-full bg-surface border border-gray-800 rounded-xl px-4 py-3 text-sm font-semibold text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Financial Summary */}
          <div className="bg-surface/50 border border-gray-800 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 font-semibold">Entry Fee:</span>
              <span className="font-mono font-black text-white">
                {entryFee === 0 ? 'FREE' : formatCurrency(entryFee)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 font-semibold">Wallet Balance:</span>
              <span className={`font-mono font-black ${hasSufficientBalance ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(userBalance)}
              </span>
            </div>
            {entryFee > 0 && !hasSufficientBalance && (
              <p className="text-[11px] text-red-400 font-medium pt-1">
                Please deposit funds into your NexPlay wallet before reserving a slot.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || (entryFee > 0 && !hasSufficientBalance)}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-black uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Reserving Slot...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Reserve Slot #{slotNumber}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
