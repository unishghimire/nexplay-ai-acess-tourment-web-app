import React from 'react';
import { motion } from 'motion/react';
import {
    RotateCcw, DollarSign, TrendingUp, TrendingDown, Play, Pause, Send,
    Plus, Trash2, Users, Calendar, Trophy, Save, XCircle,
    CheckCircle2,
} from 'lucide-react';
import { Tournament, TournamentGroup, Match, Team, TournamentEarning } from '../../../shared/types/types';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';

// ponytail: shared props type — all tabs get the full set, each destructures what it needs
export interface TournamentAdminTabProps {
    tournament: Tournament;
    tournamentEarning: TournamentEarning | null;
    participants: any[];
    fetchingParticipants: boolean;
    selectedGroup: TournamentGroup | null;
    selectedMatch: { groupId: string; match: Match } | null;
    matchScore: { score1: number; score2: number; status: 'scheduled' | 'live' | 'completed'; map: string };
    newGroup: { name: string; teamLimit: number; isPublic: boolean; passCode: string };
    newMatchData: any;
    gameStartGroupId: string;
    discordSending: string | null;
    isCreateGroupModalOpen: boolean;
    isManageTeamsModalOpen: boolean;
    isUpdateScoreModalOpen: boolean;
    isResultUploaderOpen: boolean;
    isAddMatchModalOpen: boolean;
    setTournament: (v: any) => void;
    setParticipants: (v: any) => void;
    setSelectedMatch: (v: any) => void;
    setNewGroup: (v: any) => void;
    setSelectedGroup: (v: TournamentGroup | null) => void;
    setGameStartGroupId: (v: string) => void;
    setMatchScore: (v: any) => void;
    setNewMatchData: (v: any) => void;
    setIsCreateGroupModalOpen: (v: boolean) => void;
    setIsManageTeamsModalOpen: (v: boolean) => void;
    setIsUpdateScoreModalOpen: (v: boolean) => void;
    setIsResultUploaderOpen: (v: boolean) => void;
    setIsAddMatchModalOpen: (v: boolean) => void;
    handleUpdateStatus: (status: 'upcoming' | 'live' | 'completed' | 'paused') => void;
    handleUpdateStage: (stage: string) => void;
    handleAdvanceRound: () => void;
    handleAutoGenerateGroups: () => void;
    handleCreateGroup: () => void;
    handleDeleteGroup: (groupId: string) => void;
    handleAssignTeam: (participantId: string) => void;
    handleRemoveTeam: (teamId: string) => void;
    handleDiscord: (action: string) => void;
    handleAddMatch: () => void;
    handleUpdateScore: () => void;
    handleGenerateBracket: () => void;
    handleGenerateGroupMatches: (groupId: string, mode?: 'round-robin' | 'single') => void;
    getTeamName: (teamId: string) => string;
    showToast: (msg: string, type: string) => void;
}

export const OverviewTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, tournamentEarning, participants, fetchingParticipants,
        selectedGroup, selectedMatch, matchScore, newGroup, newMatchData,
        gameStartGroupId, discordSending,
        isCreateGroupModalOpen, isManageTeamsModalOpen,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setTournament, setParticipants, setSelectedMatch, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData,
        setIsCreateGroupModalOpen, setIsManageTeamsModalOpen,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleUpdateStatus, handleUpdateStage, handleAdvanceRound,
        handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup,
        handleAssignTeam, handleRemoveTeam, handleDiscord,
        handleAddMatch, handleUpdateScore, handleGenerateBracket,
        handleGenerateGroupMatches, getTeamName, showToast,
    } = props;
    return (
                        <motion.div 
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                 <h2 className="text-xl font-black uppercase tracking-tighter text-white">Tournament Controls</h2>
                                 <button 
                                     onClick={() => window.location.reload()}
                                     className="px-5 py-2 bg-gray-900 border border-gray-800 text-gray-500 rounded-full hover:text-white hover:border-gray-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                 >
                                     <RotateCcw className="w-3 h-3" /> Refresh
                                 </button>
                             </div>
                             
                             {tournamentEarning && (
                                 <div className="bg-gray-900/50 border border-brand-500/10 rounded-[2rem] p-8 mb-8">
                                     <h3 className="text-xs font-black text-brand-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                                         <DollarSign className="w-4 h-4" /> Tournament Financials
                                     </h3>
                                     <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-8">
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Entry Fees</p>
                                             <p className="text-2xl font-black text-white font-mono">{formatCurrency(tournamentEarning.entryFeeTotal)}</p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Prize Pool</p>
                                             <p className="text-2xl font-black text-white font-mono">{formatCurrency(tournamentEarning.prizePoolTotal)}</p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Net Profit</p>
                                             <p className={`text-2xl font-black ${tournamentEarning.profit > 0 ? 'text-green-500' : 'text-red-500'} flex items-center gap-2 font-mono`}>
                                                 {tournamentEarning.profit > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                 {formatCurrency(tournamentEarning.profit)}
                                             </p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Your Share (85%)</p>
                                             <p className="text-2xl font-black text-brand-400 font-mono">{formatCurrency(tournamentEarning.orgShare)}</p>
                                             <span className={`inline-block mt-2 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                 tournamentEarning.status === 'released' ? 'bg-green-500/10 text-green-500' :
                                                 tournamentEarning.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                                 'bg-gray-800 text-gray-500'
                                             }`}>
                                                 {tournamentEarning.status}
                                             </span>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                 <div className="bg-gray-900/50 p-6 rounded-[2rem] border border-gray-800">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Status Control</h3>
                                     <div className="flex gap-3">
                                         <button 
                                             onClick={() => handleUpdateStatus('live')}
                                             disabled={tournament.status === 'live'}
                                             className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed py-4 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                         >
                                             <Play className="w-3 h-3" /> Start
                                         </button>
                                         <button 
                                             onClick={() => handleUpdateStatus('paused')}
                                             disabled={tournament.status === 'paused'}
                                             className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 disabled:opacity-30 disabled:cursor-not-allowed py-4 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                         >
                                             <Pause className="w-3 h-3" /> Pause
                                         </button>
                                     </div>
                                 </div>
                                 <div className="bg-gray-900/50 p-6 rounded-[2rem] border border-gray-800">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Stage Progression</h3>
                                     <select 
                                         value={tournament.stage || 'registration'}
                                         onChange={(e) => handleUpdateStage(e.target.value)}
                                         className="w-full bg-gray-950 border border-gray-800 rounded-full p-4 text-[10px] text-white font-black uppercase tracking-widest focus:border-brand-500 outline-none cursor-pointer transition-all"
                                     >
                                         <option value="registration">Registration</option>
                                         <option value="group_stage">Group Stage</option>
                                         <option value="knockout">Knockout Stage</option>
                                         <option value="completed">Completed</option>
                                     </select>
                                 </div>
                                 <div className="bg-gray-900/50 p-6 rounded-[2rem] border border-gray-800 sm:col-span-2 lg:col-span-1">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Quick Actions</h3>
                                     <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
                                         <button 
                                             onClick={() => {
                                                 if (tournament.groups && tournament.groups.length > 0) {
                                                     tournament.groups.forEach(g => handleGenerateGroupMatches(g.id));
                                                 } else {
                                                     showToast('No groups to generate matches for', 'info');
                                                 }
                                             }}
                                             className="flex-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                                         >
                                             Generate All Matches
                                         </button>
                                         <button 
                                             onClick={handleAdvanceRound}
                                             className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                                         >
                                             Advance Stage
                                         </button>
                                     </div>
                                 </div>
                             </div>

                             {/* ── Discord Announcements ── */}
                             <div className="bg-gray-900/50 p-8 rounded-[2rem] border border-[#5865F2]/20">
                                 <div className="flex items-center gap-3 mb-6">
                                     <div className="p-2 bg-[#5865F2]/10 rounded-xl border border-[#5865F2]/20">
                                         <Send className="w-4 h-4 text-[#5865F2]" />
                                     </div>
                                     <div>
                                         <h3 className="text-sm font-black text-white uppercase tracking-widest">Discord Announcements</h3>
                                         <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                             Posts to #{tournament.matchType === 'scrims' ? 'scrims' : 'tournaments'} channel
                                         </p>
                                     </div>
                                 </div>

                                 {/* Group selector for match-specific announces */}
                                 {(tournament.groups?.length ?? 0) > 0 && (
                                     <div className="mb-6">
                                         <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2">
                                             Target Group (for Game Start / Reminder)
                                         </label>
                                         <select
                                             value={gameStartGroupId}
                                             onChange={e => setGameStartGroupId(e.target.value)}
                                             aria-label="Select group for Discord announcement"
                                             className="bg-gray-950 border border-gray-800 rounded-full px-5 py-3 text-white text-xs font-black uppercase tracking-widest focus:border-[#5865F2] outline-none transition w-full sm:w-auto"
                                         >
                                             <option value="">All Groups</option>
                                             {tournament.groups?.map(g => (
                                                 <option key={g.id} value={g.id}>{g.name}</option>
                                             ))}
                                         </select>
                                     </div>
                                 )}

                                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                     {[
                                         { action: 'publish',    label: 'Publish',      color: 'text-[#5865F2] border-[#5865F2]/20 bg-[#5865F2]/10 hover:bg-[#5865F2]/20' },
                                         { action: 'live',       label: '🔴 Go Live',   color: 'text-red-400 border-red-500/20 bg-red-500/10 hover:bg-red-500/20' },
                                         { action: 'group_draw', label: 'Group Draw',   color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20' },
                                         { action: 'game_start', label: 'Match Start',  color: 'text-pink-400 border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20' },
                                         { action: 'game_time',  label: 'Time Remind',  color: 'text-purple-400 border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20' },
                                         { action: 'completed',  label: 'Completed',    color: 'text-green-400 border-green-500/20 bg-green-500/10 hover:bg-green-500/20' },
                                     ].map(btn => (
                                         <button
                                             key={btn.action}
                                             onClick={() => handleDiscord(btn.action)}
                                             disabled={discordSending !== null}
                                             className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${btn.color}`}
                                         >
                                             {discordSending === btn.action ? (
                                                 <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                             ) : (
                                                 <Send className="w-4 h-4" />
                                             )}
                                             {btn.label}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        </motion.div>
    );
};


export const GroupsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, tournamentEarning, participants, fetchingParticipants,
        selectedGroup, selectedMatch, matchScore, newGroup, newMatchData,
        gameStartGroupId, discordSending,
        isCreateGroupModalOpen, isManageTeamsModalOpen,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setTournament, setParticipants, setSelectedMatch, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData,
        setIsCreateGroupModalOpen, setIsManageTeamsModalOpen,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleUpdateStatus, handleUpdateStage, handleAdvanceRound,
        handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup,
        handleAssignTeam, handleRemoveTeam, handleDiscord,
        handleAddMatch, handleUpdateScore, handleGenerateBracket,
        handleGenerateGroupMatches, getTeamName, showToast,
    } = props;
    return (
                        <motion.div 
                            key="groups"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Groups Management</h2>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleAutoGenerateGroups}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Auto Generate Groups
                                    </button>
                                    <button 
                                        onClick={() => setIsCreateGroupModalOpen(true)}
                                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Create Group
                                    </button>
                                </div>
                            </div>
                            
                            {tournament.groups && tournament.groups.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {tournament.groups.map(group => (
                                        <div key={group.id} className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-brand-500/20 transition-all shadow-xl">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-md font-black text-white uppercase tracking-tight">{group.name}</h3>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1 font-bold">
                                                        <Users className="w-3 h-3 text-brand-500" /> {group.teams.length} / {group.teamLimit} TEAMS
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteGroup(group.id)}
                                                    className="p-2 text-gray-600 hover:text-red-500 transition-colors bg-dark rounded-lg border border-gray-800"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-[10px] bg-dark p-2 rounded-lg border border-gray-800 font-bold">
                                                    <span className="text-gray-500 flex items-center gap-1 uppercase">Access</span>
                                                    <span className={group.isPublic ? 'text-green-500' : 'text-yellow-500'}>
                                                        {group.isPublic ? 'PUBLIC' : 'PRIVATE'}
                                                    </span>
                                                </div>
                                                {group.passCode && (
                                                    <div className="flex items-center justify-between text-[10px] bg-dark p-2 rounded-lg border border-gray-800 font-bold">
                                                        <span className="text-gray-500 flex items-center gap-1 uppercase">Passcode</span>
                                                        <span className="text-white font-mono">{group.passCode}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedGroup(group);
                                                        setIsAddMatchModalOpen(true);
                                                    }}
                                                    className="flex-1 min-w-[80px] bg-purple-600/10 hover:bg-purple-600/20 text-purple-500 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-purple-500/10"
                                                >
                                                    Match
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedGroup(group);
                                                        setIsManageTeamsModalOpen(true);
                                                    }}
                                                    className="flex-1 min-w-[80px] bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-brand-500/10"
                                                >
                                                    Teams
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm("Generate a single Match for ALL teams in this group? (BR Style)")) {
                                                            handleGenerateGroupMatches(group.id, 'single');
                                                        } else if (window.confirm("Generate Round Robin matches? (1v1 for every pair)")) {
                                                            handleGenerateGroupMatches(group.id, 'round-robin');
                                                        }
                                                    }}
                                                    disabled={group.teams.length < 2}
                                                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-blue-500/10"
                                                >
                                                    GENERATE MATCHES
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">No groups created yet.</p>
                                    <p className="text-sm text-gray-500 mt-2">Create groups to organize teams for the group stage.</p>
                                </div>
                            )}
                        </motion.div>
    );
};


export const MatchesTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, tournamentEarning, participants, fetchingParticipants,
        selectedGroup, selectedMatch, matchScore, newGroup, newMatchData,
        gameStartGroupId, discordSending,
        isCreateGroupModalOpen, isManageTeamsModalOpen,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setTournament, setParticipants, setSelectedMatch, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData,
        setIsCreateGroupModalOpen, setIsManageTeamsModalOpen,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleUpdateStatus, handleUpdateStage, handleAdvanceRound,
        handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup,
        handleAssignTeam, handleRemoveTeam, handleDiscord,
        handleAddMatch, handleUpdateScore, handleGenerateBracket,
        handleGenerateGroupMatches, getTeamName, showToast,
    } = props;
    return (
                        <motion.div 
                            key="matches"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Match Schedule</h2>
                            </div>
                            
                            {tournament.groups && tournament.groups.some(g => g.matches.length > 0) ? (
                                <div className="space-y-8">
                                    {tournament.groups.map(group => group.matches.length > 0 && (
                                        <div key={group.id} className="space-y-4">
                                            <h3 className="text-md font-black text-brand-500 uppercase tracking-widest">{group.name} Matches</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {group.matches.map(match => {
                                                    const team1 = group.teams.find(t => t.id === match.team1Id);
                                                    const team2 = group.teams.find(t => t.id === match.team2Id);
                                                    return (
                                                        <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-4 shadow-lg hover:border-brand-500/20 transition-all flex flex-col justify-between">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">R{match.round}</span>
                                                                {match.map && (
                                                                    <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest ml-2 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/10">
                                                                        {match.map}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="space-y-3 mb-4">
                                                                <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                    <span className="text-[11px] font-bold text-white truncate max-w-[120px] uppercase tracking-tight">{team1?.name || 'TBD'}</span>
                                                                    <span className="text-md font-black text-brand-500">{match.score1}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                    <span className="text-[11px] font-bold text-white truncate max-w-[120px] uppercase tracking-tight">{team2?.name || 'TBD'}</span>
                                                                    <span className="text-md font-black text-brand-500">{match.score2}</span>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-gray-800">
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedMatch({ groupId: group.id, match });
                                                                        setMatchScore({ score1: match.score1, score2: match.score2, status: match.status, map: match.map || '' });
                                                                        setIsUpdateScoreModalOpen(true);
                                                                    }}
                                                                    className="bg-dark hover:bg-gray-800 text-gray-400 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-gray-800"
                                                                >
                                                                    Score
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        const g = tournament.groups?.find(gr => gr.id === group.id);
                                                                        if (g) {
                                                                            setSelectedGroup(g);
                                                                            setSelectedMatch({ groupId: group.id, match });
                                                                            setIsResultUploaderOpen(true);
                                                                        }
                                                                    }}
                                                                    className="bg-brand-600/10 hover:bg-brand-600 text-brand-500 hover:text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-brand-500/20"
                                                                >
                                                                    Result
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">No matches scheduled.</p>
                                    <p className="text-sm text-gray-500 mt-2">Generate matches from the Groups tab.</p>
                                </div>
                            )}
                        </motion.div>
    );
};


export const BracketsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, tournamentEarning, participants, fetchingParticipants,
        selectedGroup, selectedMatch, matchScore, newGroup, newMatchData,
        gameStartGroupId, discordSending,
        isCreateGroupModalOpen, isManageTeamsModalOpen,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setTournament, setParticipants, setSelectedMatch, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData,
        setIsCreateGroupModalOpen, setIsManageTeamsModalOpen,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleUpdateStatus, handleUpdateStage, handleAdvanceRound,
        handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup,
        handleAssignTeam, handleRemoveTeam, handleDiscord,
        handleAddMatch, handleUpdateScore, handleGenerateBracket,
        handleGenerateGroupMatches, getTeamName, showToast,
    } = props;
    return (
                        <motion.div 
                            key="brackets"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Knockout Brackets</h2>
                                <button 
                                    onClick={handleGenerateBracket}
                                    disabled={tournament.bracketMatches && tournament.bracketMatches.length > 0}
                                    className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Generate Bracket
                                </button>
                            </div>
                            
                            {tournament.bracketMatches && tournament.bracketMatches.length > 0 ? (
                                <div className="overflow-x-auto pb-8 custom-scrollbar">
                                    <div className="flex gap-12 min-w-max">
                                        {/* Group matches by round */}
                                        {Array.from(new Set(tournament.bracketMatches.map(m => m.round))).sort().map(round => {
                                            const roundMatches = tournament.bracketMatches!.filter(m => m.round === round);
                                            return (
                                                <div key={round} className="flex flex-col gap-8 justify-center min-w-[250px]">
                                                    <h3 className="text-center text-sm font-black text-gray-500 uppercase tracking-widest mb-4">
                                                        {round === Math.max(...tournament.bracketMatches!.map(m => m.round)) ? 'Finals' : 
                                                         round === Math.max(...tournament.bracketMatches!.map(m => m.round)) - 1 ? 'Semi-Finals' : 
                                                         `Round ${round}`}
                                                    </h3>
                                                    {roundMatches.map(match => {
                                                        const team1Name = getTeamName(match.team1Id || 'TBD');
                                                        const team2Name = getTeamName(match.team2Id || 'TBD');

                                                        return (
                                                            <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-4 relative">
                                                                {/* Connector lines could be added here using pseudo-elements or SVGs */}
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                        <span className="text-sm font-bold text-white truncate max-w-[150px]">{team1Name}</span>
                                                                        <span className="text-lg font-black text-brand-500">{match.score1}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                        <span className="text-sm font-bold text-white truncate max-w-[150px]">{team2Name}</span>
                                                                        <span className="text-lg font-black text-brand-500">{match.score2}</span>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedMatch({ groupId: 'bracket', match });
                                                                        setMatchScore({ score1: match.score1, score2: match.score2, status: match.status, map: match.map || '' });
                                                                        setIsUpdateScoreModalOpen(true);
                                                                    }}
                                                                    className="w-full mt-3 bg-dark hover:bg-gray-800 text-gray-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-gray-800"
                                                                >
                                                                    Update
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">Bracket not generated.</p>
                                    <p className="text-sm text-gray-500 mt-2">Advance teams from the group stage to generate the knockout bracket.</p>
                                </div>
                            )}
                        </motion.div>
    );
};


export const SettingsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, tournamentEarning, participants, fetchingParticipants,
        selectedGroup, selectedMatch, matchScore, newGroup, newMatchData,
        gameStartGroupId, discordSending,
        isCreateGroupModalOpen, isManageTeamsModalOpen,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setTournament, setParticipants, setSelectedMatch, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData,
        setIsCreateGroupModalOpen, setIsManageTeamsModalOpen,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleUpdateStatus, handleUpdateStage, handleAdvanceRound,
        handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup,
        handleAssignTeam, handleRemoveTeam, handleDiscord,
        handleAddMatch, handleUpdateScore, handleGenerateBracket,
        handleGenerateGroupMatches, getTeamName, showToast,
    } = props;
    return (
                        <motion.div 
                            key="settings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-surface p-8 rounded-3xl border border-gray-800 space-y-8"
                        >
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Automated Point System</h2>
                                <p className="text-gray-500 text-sm font-medium">Configure how points are calculated for uploaded match results.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-500 border-b border-gray-800 pb-2">Scoring Rules</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Points Per Kill</label>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.pointsPerKill ?? 1}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setTournament({...tournament, pointSystem: { ...tournament.pointSystem!, pointsPerKill: val }});
                                                }}
                                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition font-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Placement Scale</label>
                                            <div className="text-[10px] text-gray-400 mb-2 font-bold italic">Configured in placement points list</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest flex justify-between">
                                            Placement Points
                                            <button 
                                                onClick={() => {
                                                    const current = tournament!.pointSystem?.placementPoints || [];
                                                    const nextRank = current.length + 1;
                                                    const newList = [...current, { rank: nextRank, points: 0 }];
                                                    setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                }}
                                                className="text-brand-500 hover:text-brand-400 normal-case"
                                            >
                                                + Add Rank
                                            </button>
                                        </label>
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                            {tournament.pointSystem?.placementPoints?.map((p, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-dark p-2 rounded-xl border border-gray-800 group">
                                                    <span className="w-8 text-center text-xs font-black text-gray-600">#{p.rank}</span>
                                                    <input 
                                                        type="number"
                                                        value={p.points}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            const newList = [...(tournament!.pointSystem?.placementPoints || [])];
                                                            newList[idx].points = val;
                                                            setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                        }}
                                                        className="flex-1 bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm focus:border-brand-500 outline-none font-bold"
                                                    />
                                                    <button 
                                                        onClick={() => {
                                                            const newList = tournament!.pointSystem?.placementPoints?.filter((_, i) => i !== idx);
                                                            setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                        }}
                                                        className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-500 border-b border-gray-800 pb-2">Additional Bonuses</h3>
                                    <div className="bg-dark p-4 rounded-2xl border border-gray-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-white">Winner Bonus</p>
                                                <p className="text-xs text-gray-500">Extra points for #1 placement</p>
                                            </div>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.winnerBonus || 0}
                                                onChange={(e) => setTournament({
                                                    ...tournament,
                                                    pointSystem: { ...tournament.pointSystem, winnerBonus: parseInt(e.target.value) || 0 }
                                                })}
                                                placeholder="0"
                                                className="w-16 bg-surface border border-gray-800 text-white rounded-lg p-2 text-center text-sm font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-white">Consistency Bonus</p>
                                                <p className="text-xs text-gray-500">Points for 3+ consecutive kills</p>
                                            </div>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.consistencyBonus || 0}
                                                onChange={(e) => setTournament({
                                                    ...tournament,
                                                    pointSystem: { ...tournament.pointSystem, consistencyBonus: parseInt(e.target.value) || 0 }
                                                })}
                                                placeholder="0"
                                                className="w-16 bg-surface border border-gray-800 text-white rounded-lg p-2 text-center text-sm font-bold"
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        onClick={async () => {
                                            if (!tournament) return;
                                            try {
                                                const tRef = doc(db, 'tournaments', tournament.id);
                                                await updateDoc(tRef, { pointSystem: tournament.pointSystem });
                                                showToast('Point System saved!', 'success');
                                            } catch (error) {
                                                showToast('Failed to save point system', 'error');
                                            }
                                        }}
                                        className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-5 h-5" /> Save Configuration
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-8 space-y-6">
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-2">Tournament Roadmap</h3>
                                    <p className="text-gray-500 text-sm font-medium">Define the timeline and stages of the tournament for the public roadmap view.</p>
                                </div>
                                
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {(tournament.roadmap || []).map((step, idx) => (
                                        <div key={idx} className="bg-dark p-6 rounded-2xl border border-gray-800 space-y-4 group relative shadow-2xl hover:border-brand-500/30 transition-all">
                                            <button 
                                                onClick={() => {
                                                    const newList = (tournament.roadmap || []).filter((_, i) => i !== idx);
                                                    setTournament({...tournament, roadmap: newList});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-600 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                            >
                                                <XCircle className="w-3 h-3" />
                                            </button>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-brand-500 font-black uppercase tracking-widest">Stage {idx + 1}</span>
                                                <select 
                                                    value={(step as any).status || 'upcoming'}
                                                    onChange={(e) => {
                                                        const newList = [...(tournament.roadmap || [])];
                                                        (newList[idx] as any).status = e.target.value;
                                                        setTournament({...tournament, roadmap: newList});
                                                    }}
                                                    className="bg-black/50 border border-white/10 rounded text-[8px] font-black uppercase text-gray-400 px-1"
                                                >
                                                    <option value="upcoming">Upcoming</option>
                                                    <option value="current">Current</option>
                                                    <option value="completed">Completed</option>
                                                </select>
                                            </div>
                                            <input 
                                                type="text" 
                                                value={(step as any).stageName || `Round ${step.roundNumber}`}
                                                onChange={(e) => {
                                                    const newList = [...(tournament.roadmap || [])];
                                                    (newList[idx] as any).stageName = e.target.value;
                                                    setTournament({...tournament, roadmap: newList});
                                                }}
                                                placeholder="Stage Name"
                                                className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm font-black outline-none focus:border-brand-500"
                                            />
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="block text-[8px] text-gray-600 font-black uppercase mb-1">Qualifiers</label>
                                                    <input 
                                                        type="number"
                                                        value={step.qualificationRule}
                                                        onChange={(e) => {
                                                            const newList = [...(tournament.roadmap || [])];
                                                            newList[idx].qualificationRule = parseInt(e.target.value) || 0;
                                                            setTournament({...tournament, roadmap: newList});
                                                        }}
                                                        className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-xs font-mono"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[8px] text-gray-600 font-black uppercase mb-1">Groups</label>
                                                    <input 
                                                        type="number"
                                                        value={step.numGroups}
                                                        onChange={(e) => {
                                                            const newList = [...(tournament.roadmap || [])];
                                                            newList[idx].numGroups = parseInt(e.target.value) || 1;
                                                            setTournament({...tournament, roadmap: newList});
                                                        }}
                                                        className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-xs font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            const current = tournament.roadmap || [];
                                            const nextRound = current.length + 1;
                                            const newList = [...current, { roundNumber: nextRound, numGroups: 1, qualificationRule: 1, maps: [], status: 'upcoming', stageName: '' } as any];
                                            setTournament({...tournament, roadmap: newList});
                                        }}
                                        className="h-full min-h-[160px] border-2 border-dashed border-gray-800 hover:border-brand-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-brand-500 transition-all group"
                                    >
                                        <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Add Roadmap Stage</span>
                                    </button>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const tRef = doc(db, 'tournaments', tournament.id);
                                                await updateDoc(tRef, { roadmap: tournament.roadmap });
                                                showToast('Roadmap saved successfully!', 'success');
                                            } catch (error) {
                                                showToast('Failed to save roadmap', 'error');
                                            }
                                        }}
                                        className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Save className="w-5 h-5" /> Save Roadmap
                                    </button>
                                </div>
                            </div>
                        </motion.div>
    );
};


export const ParticipantsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, tournamentEarning, participants, fetchingParticipants,
        selectedGroup, selectedMatch, matchScore, newGroup, newMatchData,
        gameStartGroupId, discordSending,
        isCreateGroupModalOpen, isManageTeamsModalOpen,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setTournament, setParticipants, setSelectedMatch, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData,
        setIsCreateGroupModalOpen, setIsManageTeamsModalOpen,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleUpdateStatus, handleUpdateStage, handleAdvanceRound,
        handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup,
        handleAssignTeam, handleRemoveTeam, handleDiscord,
        handleAddMatch, handleUpdateScore, handleGenerateBracket,
        handleGenerateGroupMatches, getTeamName, showToast,
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

