import React from 'react';
import { FileText, Check, X } from 'lucide-react';
import { Tournament, Participant } from '../../../../shared/types/types';

interface RegistrationsTabProps {
    regSelectedTourId: string;
    setRegSelectedTourId: (id: string) => void;
    hostedTournaments: Tournament[];
    loadingRegs: boolean;
    participantsList: Participant[];
    onUpdateParticipantStatus: (pId: string, newStatus: 'approved' | 'rejected') => void;
}

export const RegistrationsTab: React.FC<RegistrationsTabProps> = ({
    regSelectedTourId,
    setRegSelectedTourId,
    hostedTournaments,
    loadingRegs,
    participantsList,
    onUpdateParticipantStatus
}) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Participants Center</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Review, approve, and roster players entries</p>
                </div>
                <div className="w-full sm:w-auto">
                    <select 
                        value={regSelectedTourId}
                        onChange={(e) => setRegSelectedTourId(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-full py-3.5 px-6 text-xs font-black text-white outline-none focus:border-brand-500 transition-all uppercase tracking-widest"
                    >
                        <option value="">-- Choose Competition --</option>
                        {hostedTournaments.map(t => (
                            <option key={t.id} value={t.id}>{t.title} ({t.currentPlayers}/{t.slots})</option>
                        ))}
                    </select>
                </div>
            </div>

            {loadingRegs ? (
                <div className="py-20 text-center flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs text-gray-500 font-black uppercase tracking-widest animate-pulse">Loading registration rolls...</p>
                </div>
            ) : participantsList.length === 0 ? (
                <div className="py-20 text-center bg-black/30 rounded-[2rem] border border-gray-800/50">
                    <FileText className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                    <h3 className="text-white text-lg font-black uppercase tracking-tighter mb-1">No Registrations Submitted</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Select another tournament or share your current link</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-[2rem] border border-gray-800">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800">
                                <th className="p-6">Username / Team Name</th>
                                <th className="p-6">In-Game ID</th>
                                <th className="p-6">Registered Time</th>
                                <th className="p-6 text-center">Status</th>
                                <th className="p-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 bg-black/10">
                            {participantsList.map((p) => (
                                <tr key={p.id} className="hover:bg-white/[0.02] text-sm text-gray-300 font-bold transition-all">
                                    <td className="p-6">
                                        <div className="font-extrabold text-white text-base">{p.username}</div>
                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{p.teamName || 'Solo Player'}</div>
                                    </td>
                                    <td className="p-6 font-mono text-xs">{p.inGameId || 'N/A'}</td>
                                    <td className="p-6 text-xs text-gray-500">
                                        {p.timestamp?.toMillis ? new Date(p.timestamp.toMillis()).toLocaleString() : 'Recent'}
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                            p.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                                            p.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                                            'bg-amber-500/10 text-amber-500 animate-pulse'
                                        }`}>
                                            {p.status || 'pending'}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            {p.status !== 'approved' && (
                                                <button 
                                                    onClick={() => onUpdateParticipantStatus(p.id, 'approved')}
                                                    className="p-2 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white rounded-full transition-all border border-green-500/20"
                                                    title="Approve Entry"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                            )}
                                            {p.status !== 'rejected' && (
                                                <button 
                                                    onClick={() => onUpdateParticipantStatus(p.id, 'rejected')}
                                                    className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-full transition-all border border-red-500/20"
                                                    title="Reject Entry"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default RegistrationsTab;
