import {useParams, useNavigate} from 'react-router-dom';
import { useNotification } from '../../../shared/context/NotificationContext';
import {Settings, Users, Calendar, Trophy, ArrowLeft, ShieldCheck, Download} from 'lucide-react';
import { AnimatePresence } from 'motion/react';

import { OverviewTab, GroupsTab, MatchesTab, BracketsTab, SettingsTab, ParticipantsTab } from './tournament-admin-tabs';
import { useTournamentAdmin } from '../hooks/useTournamentAdmin';

export default function TournamentAdminPanel() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useNotification();
    
    const { activeTab, discordSending, fetchingParticipants, gameStartGroupId, handleAdvanceRound, handleAssignTeam, handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup, handleDiscord, handleRemoveTeam, handleUpdateStage, handleUpdateStatus, isAddMatchModalOpen, isCreateGroupModalOpen, isManageTeamsModalOpen, isResultUploaderOpen, isUpdateScoreModalOpen, loading, matchScore, newGroup, newMatchData, participants, selectedGroup, selectedMatch, setActiveTab, setGameStartGroupId, setIsAddMatchModalOpen, setIsCreateGroupModalOpen, setIsManageTeamsModalOpen, setIsResultUploaderOpen, setIsUpdateScoreModalOpen, setMatchScore, setNewGroup, setNewMatchData, setParticipants, setSelectedGroup, setSelectedMatch, tournamentEarning, tournament, setTournament, handleAddMatch, handleUpdateScore, handleGenerateBracket, handleGenerateGroupMatches, getTeamName } = useTournamentAdmin(id, navigate, showToast);

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!tournament) return null;

    const tabProps = {
        tournament, setTournament, setParticipants, tournamentEarning, participants, fetchingParticipants, selectedGroup, selectedMatch, setSelectedMatch, matchScore, newGroup, newMatchData, gameStartGroupId, discordSending, isCreateGroupModalOpen, isManageTeamsModalOpen, isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData, setIsCreateGroupModalOpen, setIsManageTeamsModalOpen, setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen, handleUpdateStatus, handleUpdateStage, handleAdvanceRound, handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup, handleAssignTeam, handleRemoveTeam, handleDiscord, handleAddMatch, handleUpdateScore, handleGenerateBracket, handleGenerateGroupMatches, getTeamName, showToast
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate(`/details/${tournament.id}`)}
                        className="p-3 bg-gray-950 border border-gray-800 rounded-full text-gray-400 hover:text-white hover:border-brand-500 transition-all hover:bg-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-4">
                            <Settings className="w-8 h-8 text-brand-500" />
                            Admin Panel
                        </h1>
                        <p className="text-sm text-gray-500 font-bold tracking-wide uppercase mt-1">{tournament.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => {
                            const csvContent = "data:text/csv;charset=utf-8," 
                                + ["Team Name,Username,In-Game ID,In-Game Name,Status", 
                                   ...participants.map(p => `"${p.teamName || 'Solo'}","${p.username}","${p.inGameId}","${p.inGameName}","${p.status}"`)
                                ].join("\n");
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `${tournament.title}_participants.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className="bg-gray-950 border border-gray-800 hover:border-brand-500 text-gray-500 hover:text-white p-3 rounded-full transition-all"
                        title="Export Participants"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                    <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        tournament.status === 'live' ? 'bg-green-500/10 text-green-500 border border-green-500/30' :
                        tournament.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30' :
                        'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                    }`}>
                        {tournament.status}
                    </span>
                    <span className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-brand-500/10 text-brand-400 border border-brand-500/30">
                        {tournament.stage || 'registration'}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-3 mb-12 pb-2 custom-scrollbar">
                {[
                    { id: 'overview', label: 'Overview', icon: Settings },
                    { id: 'groups', label: 'Groups & Teams', icon: Users },
                    { id: 'matches', label: 'Match Schedule', icon: Calendar },
                    { id: 'brackets', label: 'Brackets', icon: Trophy },
                    { id: 'settings', label: 'Settings', icon: Settings },
                    { id: 'participants', label: 'Registrations', icon: ShieldCheck },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-3 px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                            activeTab === tab.id 
                                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                                : 'bg-gray-950/50 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ponytail: shared tabProps — built once, spread to each tab */}
            <div className="bg-gray-950/50 rounded-[2rem] border border-gray-800 p-8">
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' && <OverviewTab {...tabProps} />}
                    {activeTab === 'groups' && <GroupsTab {...tabProps} />}
                    {activeTab === 'matches' && <MatchesTab {...tabProps} />}
                    {activeTab === 'brackets' && <BracketsTab {...tabProps} />}
                    {activeTab === 'settings' && <SettingsTab {...tabProps} />}
                    {activeTab === 'participants' && <ParticipantsTab {...tabProps} />}
                </AnimatePresence>
            </div>
        </div>
    );
}
