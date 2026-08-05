import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface TeamCenterTabProps {
    teamSearch: string;
    setTeamSearch: (v: string) => void;
    availableTeams: string[];
    selectedTeamForWarning: string | null;
    setSelectedTeamForWarning: (v: string | null) => void;
    warningsList: { id: string; team: string; reason: string; strikes: number; date: string }[];
}

export const TeamCenterTab: React.FC<TeamCenterTabProps> = ({
    teamSearch, setTeamSearch, availableTeams, selectedTeamForWarning, setSelectedTeamForWarning, warningsList
}) => {
    return (
        <div className="space-y-8">
            <div className="border-b border-gray-800 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Team Center & Disputes</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Audit team lists, track warnings, and enforce regulations</p>
                </div>
                <div className="relative w-full sm:w-64">
                    <input
                        type="text"
                        placeholder="Search Team Names..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-full py-3.5 px-6 text-xs font-bold text-white focus:border-brand-500 outline-none transition-all placeholder:text-gray-800"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Active Registered Teams</h3>
                    <div className="space-y-3">
                        {availableTeams.length === 0 ? (
                            <p className="text-xs text-gray-500 font-black uppercase text-center py-8">None found</p>
                        ) : (
                            availableTeams.map((team, idx) => (
                                <div key={idx} className="bg-black/20 p-5 rounded-2xl border border-gray-800/80 hover:border-brand-500/30 transition-all flex justify-between items-center">
                                    <div>
                                        <h4 className="font-black text-white uppercase text-base">{team}</h4>
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Roster verified • Platform registered</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedTeamForWarning(team)}
                                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
                                    >
                                        Issue Strike
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-500" /> Active Penalty warnings Strikes
                    </h3>
                    <div className="bg-black/20 p-6 rounded-3xl border border-gray-800 space-y-4">
                        {warningsList.map(warn => (
                            <div key={warn.id} className="p-4 bg-black/60 rounded-2xl border border-gray-900 flex gap-4 text-xs font-bold items-start">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-white font-extrabold uppercase">{warn.team}</h4>
                                        <span className="text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded-full text-[9px] uppercase font-black font-mono tracking-widest">{warn.strikes} Strike{warn.strikes > 1 ? 's' : ''}</span>
                                    </div>
                                    <p className="text-gray-400 tracking-wide">{warn.reason}</p>
                                    <p className="text-[10px] text-gray-500 font-mono mt-3 uppercase tracking-wider">{warn.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamCenterTab;
