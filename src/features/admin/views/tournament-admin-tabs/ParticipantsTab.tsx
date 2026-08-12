import React from 'react';
import { motion } from 'motion/react';
import { XCircle, CheckCircle2, User } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/config/firebase';
import { TournamentAdminTabProps } from './types';

export const ParticipantsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const { participants, setParticipants, showToast } = props;

    const handleApprove = async (id: string) => {
        try {
            await updateDoc(doc(db, 'participants', id), { status: 'approved' });
            setParticipants(participants.map(p => p.id === id ? { ...p, status: 'approved' } : p));
            showToast('Player approved', 'success');
        } catch { showToast('Failed to approve', 'error'); }
    };

    const handleReject = async (id: string) => {
        if (!window.confirm('Reject this registration?')) return;
        try {
            await updateDoc(doc(db, 'participants', id), { status: 'rejected' });
            setParticipants(participants.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
            showToast('Player rejected', 'info');
        } catch { showToast('Failed to reject', 'error'); }
    };

    return (
        <motion.div
            key="participants"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 space-y-6"
        >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-lg sm:text-xl font-black uppercase tracking-tighter text-white mb-1">Participant Registrations</h2>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium">Review and manage player registrations.</p>
                </div>
                <div className="flex gap-2 sm:gap-4">
                    <div className="bg-dark px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-800 text-center flex-1 sm:flex-none">
                        <div className="text-[10px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Approved</div>
                        <div className="text-lg sm:text-xl font-black text-white">{participants.filter(p => p.status === 'approved').length}</div>
                    </div>
                    <div className="bg-dark px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-800 text-center flex-1 sm:flex-none">
                        <div className="text-[10px] sm:text-[10px] text-yellow-500/50 font-black uppercase tracking-widest mb-1">Pending</div>
                        <div className="text-lg sm:text-xl font-black text-yellow-500">{participants.filter(p => p.status === 'pending').length}</div>
                    </div>
                </div>
            </div>

            {participants.length === 0 ? (
                <div className="py-16 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                    No participants registered yet
                </div>
            ) : (
                <>
                    {/* Mobile card view */}
                    <div className="sm:hidden space-y-3">
                        {participants.map((p) => (
                            <div key={p.id} className="bg-dark rounded-xl border border-gray-800 p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-dark border border-gray-800 overflow-hidden shrink-0">
                                        {p.logoUrl ? (
                                            <img src={p.logoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="w-5 h-5 text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-white truncate">{p.username}</p>
                                        <p className="text-[10px] text-brand-500 font-bold uppercase truncate">{p.teamName || 'Solo'}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest shrink-0 ${
                                        p.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                        p.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                        'bg-yellow-500/10 text-yellow-500'
                                    }`}>
                                        {p.status || 'pending'}
                                    </span>
                                </div>
                                <div className="text-xs space-y-1 pl-13">
                                    <p className="text-white font-bold break-anywhere">{p.inGameName || '—'}</p>
                                    <p className="text-gray-500 font-mono break-anywhere">{p.inGameId || '—'}</p>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    {p.status !== 'approved' && (
                                        <button onClick={() => handleApprove(p.id)}
                                            className="flex-1 py-2.5 border border-green-500/20 text-green-500 hover:bg-green-500/10 rounded-lg transition-all text-xs font-bold uppercase tracking-widest touch-target flex items-center justify-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4" /> Approve
                                        </button>
                                    )}
                                    {p.status !== 'rejected' && (
                                        <button onClick={() => handleReject(p.id)}
                                            className="flex-1 py-2.5 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-lg transition-all text-xs font-bold uppercase tracking-widest touch-target flex items-center justify-center gap-1.5">
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
                            <thead>
                                <tr className="border-b border-gray-800">
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Player / Team</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">In-Game Details</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {participants.map((p) => (
                                    <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-dark border border-gray-800 overflow-hidden shrink-0">
                                                    {p.logoUrl ? (
                                                        <img src={p.logoUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <User className="w-5 h-5 text-gray-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-white truncate">{p.username}</p>
                                                    <p className="text-[10px] text-brand-500 font-bold uppercase truncate">{p.teamName || 'Solo'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <p className="text-xs font-bold text-white break-anywhere">{p.inGameName}</p>
                                            <p className="text-[10px] text-gray-500 font-mono break-anywhere">{p.inGameId}</p>
                                        </td>
                                        <td className="py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                                                p.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                                p.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                                'bg-yellow-500/10 text-yellow-500'
                                            }`}>
                                                {p.status || 'pending'}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {p.status !== 'approved' && (
                                                    <button onClick={() => handleApprove(p.id)}
                                                        className="p-2 border border-green-500/20 text-green-500 hover:bg-green-500/10 rounded-lg transition-all touch-target"
                                                        title="Approve">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {p.status !== 'rejected' && (
                                                    <button onClick={() => handleReject(p.id)}
                                                        className="p-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-lg transition-all touch-target"
                                                        title="Reject">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </motion.div>
    );
};
