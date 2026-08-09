import React from 'react';
import { motion } from 'motion/react';
import {
    XCircle,
    CheckCircle2,
} from 'lucide-react';
import { Tournament, TournamentGroup, Match, Team, TournamentEarning } from '../../../../shared/types/types';
import { formatCurrency, formatDate } from '../../../../shared/utils/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/config/firebase';
import { TournamentAdminTabProps } from './types';

export const ParticipantsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        participants, setParticipants, showToast,
    } = props;
    return (
                        <motion.div 
                            key="participants"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-surface p-8 rounded-3xl border border-gray-800 space-y-8"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Participant Registrations</h2>
                                    <p className="text-gray-500 text-sm font-medium">Review and manage player registrations for your tournament.</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="bg-dark px-6 py-3 rounded-2xl border border-gray-800 text-center">
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Approved</div>
                                        <div className="text-xl font-black text-white">{participants.filter(p => p.status === 'approved').length}</div>
                                    </div>
                                    <div className="bg-dark px-6 py-3 rounded-2xl border border-gray-800 text-center">
                                        <div className="text-[10px] text-yellow-500/50 font-black uppercase tracking-widest mb-1">Pending</div>
                                        <div className="text-xl font-black text-yellow-500">{participants.filter(p => p.status === 'pending').length}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-800">
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Player / Team</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">In-Game Details</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {participants.length > 0 ? (
                                            participants.map((p) => (
                                                <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-dark border border-gray-800 overflow-hidden">
                                                                <img src={p.logoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-white">{p.username}</p>
                                                                <p className="text-[10px] text-brand-500 font-bold uppercase">{p.teamName || 'Solo'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4">
                                                        <p className="text-xs font-bold text-white">{p.inGameName}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono">{p.inGameId}</p>
                                                    </td>
                                                    <td className="py-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${
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
                                                                <button 
                                                                    onClick={async () => {
                                                                        try {
                                                                            await updateDoc(doc(db, 'participants', p.id), { status: 'approved' });
                                                                            setParticipants(participants.map(part => part.id === p.id ? { ...part, status: 'approved' } : part));
                                                                            showToast('Player approved', 'success');
                                                                        } catch (error) {
                                                                            showToast('Failed to approve', 'error');
                                                                        }
                                                                    }}
                                                                    className="p-2 border border-green-500/20 text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {p.status !== 'rejected' && (
                                                                <button 
                                                                    onClick={async () => {
                                                                        if (!window.confirm('Reject this registration?')) return;
                                                                        try {
                                                                            await updateDoc(doc(db, 'participants', p.id), { status: 'rejected' });
                                                                            setParticipants(participants.map(part => part.id === p.id ? { ...part, status: 'rejected' } : part));
                                                                            showToast('Player rejected', 'info');
                                                                        } catch (error) {
                                                                            showToast('Failed to reject', 'error');
                                                                        }
                                                                    }}
                                                                    className="p-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                                    title="Reject"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                                                    No participants registered yet
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
    );
};

