import React, { useState } from 'react';
import { X, Key, Lock, Tv, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth } from '../../../shared/config/firebase';
import { useNotification } from '../../../shared/context/NotificationContext';

interface DispatchRoomModalProps {
  scrimId: string;
  scrimTitle: string;
  initialRoomId?: string;
  initialRoomPass?: string;
  initialStreamUrl?: string;
  onClose: () => void;
  onSuccess: (roomId: string, roomPass: string, streamUrl: string) => void;
}

export const DispatchRoomModal: React.FC<DispatchRoomModalProps> = ({
  scrimId,
  scrimTitle,
  initialRoomId = '',
  initialRoomPass = '',
  initialStreamUrl = '',
  onClose,
  onSuccess,
}) => {
  const { showToast } = useNotification();
  const [roomId, setRoomId] = useState(initialRoomId);
  const [roomPass, setRoomPass] = useState(initialRoomPass);
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !roomPass.trim()) {
      setError('Both Room ID and Room Password are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/scrims/${scrimId}/dispatch-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: roomId.trim(),
          roomPass: roomPass.trim(),
          streamUrl: streamUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to dispatch room credentials');
      }

      showToast('Room credentials dispatched to participants!', 'success');
      onSuccess(roomId.trim(), roomPass.trim(), streamUrl.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-surface/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Dispatch Room Credentials
              </h3>
              <p className="text-xs text-gray-400 font-medium truncate max-w-[240px]">
                {scrimTitle}
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
        <form onSubmit={handleDispatch} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Custom Room ID
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. 8493021"
                className="w-full bg-surface border border-gray-800 rounded-xl px-4 py-3 pl-11 text-sm font-mono font-bold text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              />
              <Key className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Room Password
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={roomPass}
                onChange={(e) => setRoomPass(e.target.value)}
                placeholder="e.g. 1234"
                className="w-full bg-surface border border-gray-800 rounded-xl px-4 py-3 pl-11 text-sm font-mono font-bold text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              />
              <Lock className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              YouTube Stream URL (Optional)
            </label>
            <div className="relative">
              <input
                type="url"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://youtube.com/live/..."
                className="w-full bg-surface border border-gray-800 rounded-xl px-4 py-3 pl-11 text-sm font-medium text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              />
              <Tv className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Credentials to Lobby</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
