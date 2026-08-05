import React, { useEffect, useState, useCallback } from 'react';
import { 
    collection, query, where, getDocs, doc, deleteDoc, 
    updateDoc, addDoc, serverTimestamp, increment, writeBatch 
} from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament, Participant, Transaction } from '../../../shared/types/types';
import DashboardLayout from '../../../shared/components/layouts/DashboardLayout';
import DashboardOverview from '../../dashboard/components/DashboardOverview';
import TournamentManagement from '../../tournaments/components/TournamentManagement';
import { useNotification } from '../../../shared/context/NotificationContext';
import Modal from '../../../shared/components/Modal';
import { 
    Trash2, Activity, DollarSign, Trophy, Users, 
    LayoutDashboard, FileText, Megaphone, 
    BarChart3, Settings, Bot, Check, X, ShieldAlert,
    Send, Plus, RefreshCw, Key, Link2, AlertTriangle, Play
} from 'lucide-react';
import { CompetitionsTab, RegistrationsTab, OperationsTab, FinanceTab, CommunicationTab, TeamCenterTab, AnalyticsTab, SettingsTab } from './organizer-panel';


const OrganizerPanel: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const location = useLocation();
    const navigate = useNavigate();

    const [hostedTournaments, setHostedTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Deletion state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);

    // Active sub-states
    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || 'overview';

    // 1. Registrations view states
    const [regSelectedTourId, setRegSelectedTourId] = useState<string>('');
    const [participantsList, setParticipantsList] = useState<Participant[]>([]);
    const [loadingRegs, setLoadingRegs] = useState(false);

    // 2. Operations view states
    const [opSelectedTourId, setOpSelectedTourId] = useState<string>('');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [roomPassInput, setRoomPassInput] = useState('');
    const [streamLinkInput, setStreamLinkInput] = useState('');
    const [opLogs, setOpLogs] = useState<Array<{ time: string, text: string, type: 'info' | 'warn' | 'success' }>>([
        { time: '11:45 AM', text: 'Administrative Control Center established.', type: 'success' },
        { time: '12:00 PM', text: 'Interactive match-lobby orchestrators operational.', type: 'info' }
    ]);
    const [customLog, setCustomLog] = useState('');

    // 3. Finance view states
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawMethod, setWithdrawMethod] = useState('Bank Transfer');
    const [withdrawDetails, setWithdrawDetails] = useState('');
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [loadingTx, setLoadingTx] = useState(false);

    // 4. Communication states
    const [commSelectedTourId, setCommSelectedTourId] = useState<string>('');
    const [announcementText, setAnnouncementText] = useState('');
    const [discordWebhook, setDiscordWebhook] = useState(profile?.discord || '');
    const [savingWebhook, setSavingWebhook] = useState(false);

    // 5. Team center states
    const [teamSearch, setTeamSearch] = useState('');
    const [selectedTeamForWarning, setSelectedTeamForWarning] = useState<string | null>(null);
    const [warningReason, setWarningReason] = useState('');
    const [warningStrikeCost, setWarningStrikeCost] = useState(1);
    const [warningsList, setWarningsList] = useState<Array<{ id: string, team: string, reason: string, strikes: number, date: string }>>([
        { id: '1', team: 'Team Crimson', reason: 'Abuse in game lobby chat.', strikes: 1, date: '2 hours ago' },
        { id: '2', team: 'Viper Esports', reason: 'Failed to join lobby within the 15-minute grace period.', strikes: 2, date: '1 day ago' }
    ]);

    // 6. Settings states
    const [settingsOrgName, setSettingsOrgName] = useState(profile?.orgName || '');
    const [settingsBio, setSettingsBio] = useState(profile?.bio || '');
    const [settingsWhatsapp, setSettingsWhatsapp] = useState(profile?.whatsapp || '');
    const [settingsContact, setSettingsContact] = useState(profile?.contactInfo || '');
    const [savingSettings, setSavingSettings] = useState(false);

    // Synchronize current profile state fields when loaded
    useEffect(() => {
        if (profile) {
            setDiscordWebhook(profile.discord || '');
            setSettingsOrgName(profile.orgName || '');
            setSettingsBio(profile.bio || '');
            setSettingsWhatsapp(profile.whatsapp || '');
            setSettingsContact(profile.contactInfo || '');
        }
    }, [profile]);

    const stats = [
        { label: 'Active Tournaments', value: hostedTournaments.filter(t => t.status === 'live').length, icon: Activity, color: 'text-brand-500' },
        { label: 'Total Tournaments', value: hostedTournaments.length, icon: Trophy, color: 'text-white' },
        { label: 'Total Teams', value: hostedTournaments.reduce((acc, t) => acc + (t.currentPlayers || 0), 0), icon: Users, color: 'text-purple-500' },
        { label: 'Total Earnings', value: `$${hostedTournaments.reduce((acc, t) => acc + (t.entryFee * t.currentPlayers), 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
    ];

    const navItems = [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'competitions', label: 'Competitions', icon: Trophy },
        { id: 'registrations', label: 'Registrations', icon: FileText },
        { id: 'operations', label: 'Operations Hub', icon: Bot },
        { id: 'finance', label: 'Finance', icon: DollarSign },
        { id: 'communication', label: 'Communication', icon: Megaphone },
        { id: 'team-center', label: 'Team Center', icon: Users },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'settings', label: 'Org Settings', icon: Settings },
    ];

    const fetchHosted = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, 'tournaments'),
                where('hostUid', '==', user.uid)
            );
            const snap = await getDocs(q);
            const tours = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
            tours.sort((a, b) => {
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return bTime - aTime;
            });
            setHostedTournaments(tours);

            // Automatically set first selected tournament for dropdown tabs
            if (tours.length > 0) {
                if (!regSelectedTourId) setRegSelectedTourId(tours[0].id);
                if (!opSelectedTourId) {
                    setOpSelectedTourId(tours[0].id);
                    setRoomIdInput(tours[0].roomId || '');
                    setRoomPassInput(tours[0].roomPass || '');
                    setStreamLinkInput(tours[0].ytLink || '');
                }
                if (!commSelectedTourId) setCommSelectedTourId(tours[0].id);
            }
        } catch (error) {
            console.error("Error fetching hosted tournaments:", error);
        } finally {
            setLoading(false);
        }
    }, [user, regSelectedTourId, opSelectedTourId, commSelectedTourId]);

    useEffect(() => {
        fetchHosted();
    }, [fetchHosted]);

    // Fetch registrations when the active registration tournament selection changes
    useEffect(() => {
        const fetchParticipants = async () => {
            if (!regSelectedTourId) return;
            setLoadingRegs(true);
            try {
                const q = query(
                    collection(db, 'participants'),
                    where('tournamentId', '==', regSelectedTourId)
                );
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
                list.sort((a, b) => {
                    const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                    const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                    return bTime - aTime;
                });
                setParticipantsList(list);
            } catch (err) {
                console.error("Error fetching participants:", err);
            } finally {
                setLoadingRegs(false);
            }
        };

        if (activeTab === 'registrations') {
            fetchParticipants();
        }
    }, [regSelectedTourId, activeTab]);

    // Fetch transactions inside Finance Tab
    useEffect(() => {
        const fetchTransactions = async () => {
            if (!user) return;
            setLoadingTx(true);
            try {
                const q = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid)
                );
                const snap = await getDocs(q);
                const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
                txs.sort((a, b) => {
                    const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                    const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                    return bTime - aTime;
                });
                setRecentTransactions(txs);
            } catch (err) {
                console.error("Error loading transactions:", err);
            } finally {
                setLoadingTx(false);
            }
        };

        if (activeTab === 'finance') {
            fetchTransactions();
        }
    }, [user, activeTab]);

    const handleDeleteClick = (t: Tournament) => {
        setTournamentToDelete(t);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!tournamentToDelete) return;
        try {
            await deleteDoc(doc(db, 'tournaments', tournamentToDelete.id));
            showToast('Tournament deleted successfully', 'success');
            setIsDeleteModalOpen(false);
            setTournamentToDelete(null);
            fetchHosted();
        } catch (error) {
            console.error("Error deleting tournament:", error);
            showToast('Failed to delete tournament', 'error');
        }
    };

    // 1. REGISTRATION ACTIONS
    const handleUpdateParticipantStatus = async (pId: string, newStatus: 'approved' | 'rejected') => {
        try {
            await updateDoc(doc(db, 'participants', pId), { status: newStatus });
            
            // Adjust current players registration counts on tournaments
            const incrementAmount = newStatus === 'approved' ? 1 : -1;
            await updateDoc(doc(db, 'tournaments', regSelectedTourId), {
                currentPlayers: increment(incrementAmount)
            });

            showToast(`Participant registration ${newStatus}!`, 'success');
            
            // Update local state instantly
            setParticipantsList(prev => prev.map(p => p.id === pId ? { ...p, status: newStatus } : p));
            setHostedTournaments(prev => prev.map(t => t.id === regSelectedTourId ? { ...t, currentPlayers: Math.max(0, t.currentPlayers + incrementAmount) } : t));
        } catch (err) {
            console.error("Error updating registration state:", err);
            showToast("Failed to modify registration status.", "error");
        }
    };

    // 2. OPERATIONS ACTION (Broadcast lobby credentials & update maps/modes)
    const handleBroadcastLobby = async () => {
        if (!opSelectedTourId) return;
        try {
            await updateDoc(doc(db, 'tournaments', opSelectedTourId), {
                roomId: roomIdInput,
                roomPass: roomPassInput,
                ytLink: streamLinkInput
            });
            showToast("Lobby details stored and broadcasted to registrants!", "success");
            setOpLogs(prev => [
                { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Broadcasted Custom Room ID: "${roomIdInput}" & passcode: "${roomPassInput}"`, type: 'success' },
                ...prev
            ]);
            // Refresh hosted collection list to capture changes
            fetchHosted();
        } catch (err) {
            console.error("Error broadcasting lobby parameters:", err);
            showToast("Failed to store lobby details.", "error");
        }
    };

    const handleUpdateTournamentStatus = async (status: 'live' | 'completed' | 'upcoming' | 'paused') => {
        if (!opSelectedTourId) return;
        try {
            await updateDoc(doc(db, 'tournaments', opSelectedTourId), { status });
            showToast(`Competitions status set to "${status.toUpperCase()}"!`, "success");
            setOpLogs(prev => [
                { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Tournament status updated to "${status.toLocaleUpperCase()}"`, type: 'info' },
                ...prev
            ]);
            setHostedTournaments(prev => prev.map(t => t.id === opSelectedTourId ? { ...t, status } : t));
        } catch (err) {
            showToast("Failed to change status", "error");
        }
    };

    const handleAddCustomLog = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customLog.trim()) return;
        setOpLogs(prev => [
            { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: customLog, type: 'info' },
            ...prev
        ]);
        setCustomLog('');
    };

    // 3. FINANCE ACTIONS
    const handleRequestWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(withdrawAmount);
        if (isNaN(amt) || amt <= 0) {
            showToast("Please enter a valid numeric value.", "error");
            return;
        }
        const currentBalance = profile?.orgWalletBalance || profile?.balance || 0;
        if (amt > currentBalance) {
            showToast(`Insufficient core funds! Maximum withdraw count: $${currentBalance}`, "error");
            return;
        }

        try {
            // Write standard Transaction doc
            const txData = {
                userId: user?.uid || 'anonymous',
                username: profile?.username || 'Organizer',
                userEmail: user?.email || '',
                type: 'withdraw',
                amount: amt,
                method: withdrawMethod,
                refId: `WTH-${Date.now().toString().slice(-6)}`,
                status: 'pending',
                accountDetails: withdrawDetails,
                desc: `Withdrawal request of $${amt} via ${withdrawMethod}`,
                timestamp: serverTimestamp()
            };
            
            await addDoc(collection(db, 'transactions'), txData);
            
            // Deduct funds from organizer profile balance
            await updateDoc(doc(db, 'users', user!.uid), {
                orgWalletBalance: increment(-amt)
            });

            showToast("Withdrawal proposal submitted for verification!", "success");
            setWithdrawAmount('');
            setWithdrawDetails('');
            
            // Trigger refresh
            setRecentTransactions(prev => [
                { id: `temp-${Date.now()}`, ...txData, timestamp: new Date() } as any,
                ...prev
            ]);
        } catch (err) {
            console.error("Payout initiation error:", err);
            showToast("Error processing withdrawal pipeline.", "error");
        }
    };

    // 4. COMMUNICATION ANNOUNCEMENTS
    const handleBroadcastAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commSelectedTourId) {
            showToast("Select a tournament to broadcast the message.", "error");
            return;
        }
        if (!announcementText.trim()) return;

        try {
            // Read target tournament
            const targetTour = hostedTournaments.find(t => t.id === commSelectedTourId);
            const title = targetTour ? targetTour.title : "Organizer Broadcast";

            // Query participants of the tournament
            const pQuery = query(
                collection(db, 'participants'),
                where('tournamentId', '==', commSelectedTourId)
            );
            const pSnap = await getDocs(pQuery);
            const parts = pSnap.docs.map(doc => doc.data() as Participant);

            if (parts.length === 0) {
                showToast("No registered players in this tournament to receive the broadcast.", "warning");
                return;
            }

            const batch = writeBatch(db);
            parts.forEach(p => {
                const notifRef = doc(collection(db, 'notifications'));
                batch.set(notifRef, {
                    userId: p.userId,
                    title: `Announcement: ${title}`,
                    message: announcementText,
                    type: 'alert',
                    read: false,
                    timestamp: serverTimestamp()
                });
            });

            await batch.commit();
            showToast(`Broadcast published to ${parts.length} registered players!`, "success");
            setAnnouncementText('');
        } catch (err) {
            console.error("Announcement error:", err);
            showToast("Could not send broadcast messages.", "error");
        }
    };

    const handleSaveWebhook = async () => {
        if (!user) return;
        setSavingWebhook(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                discord: discordWebhook
            });
            showToast("Webhook URL integration configured!", "success");
        } catch (err) {
            showToast("Failed to sync Webhooks details.", "error");
        } finally {
            setSavingWebhook(false);
        }
    };

    // 5. TEAM MANAGER WARNING STRIKES
    const handleIssueWarning = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeamForWarning) return;
        
        const text = warningReason.trim() ? warningReason : "Rules violation and unsportsmanlike conduct.";
        
        // update local list
        const updated = [
            {
                id: Date.now().toString(),
                team: selectedTeamForWarning,
                reason: text,
                strikes: warningStrikeCost,
                date: 'Just now'
            },
            ...warningsList
        ];
        setWarningsList(updated);
        showToast(`Warning strike logged for team ${selectedTeamForWarning}!`, "success");
        
        // reset
        setSelectedTeamForWarning(null);
        setWarningReason('');
        setWarningStrikeCost(1);
    };

    // 6. SAVE SETTINGS
    const handleSaveOrgSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSavingSettings(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                orgName: settingsOrgName,
                bio: settingsBio,
                whatsapp: settingsWhatsapp,
                contactInfo: settingsContact
            });
            showToast("Organization preferences synchronized safely!", "success");
        } catch (err) {
            console.error("Error updates profile settings: ", err);
            showToast("Could not update settings profile.", "error");
        } finally {
            setSavingSettings(false);
        }
    };

    // Process local unique teams list registered to hosted tournaments
    const availableTeams = Array.from(new Set<string>(hostedTournaments.map(t => t.title + " Team A").concat(["Lethal Esports", "Team Crimson", "Viper Esports"])))
        .filter(team => team.toLowerCase().includes(teamSearch.toLowerCase()));

    // Generate analytical metrics
    const analyticsChartData = hostedTournaments.map(t => ({
        name: t.title.slice(0, 10) + '...',
        Registered: t.currentPlayers,
        Slots: t.slots,
        Revenue: t.currentPlayers * t.entryFee
    })).reverse();

    if (loading) {
        return (
            <DashboardLayout title="Loading...">
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-brand-500 text-xs animate-pulse font-black uppercase tracking-widest">Loading Dashboard...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Organizer Panel">
            {/* Main Layout Grid - Sidebar + Content */}
            <div className="flex flex-col lg:flex-row gap-8">
                
                {/* Sidebar Navigation */}
                <aside className="w-full lg:w-64 flex-shrink-0">
                    <nav className="space-y-2 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible py-2 lg:py-0 pr-2 pb-4 scrollbar-thin">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => navigate(`?tab=${item.id}`)}
                                className={`flex items-center gap-3 px-6 py-4 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shrink-0 mr-3 lg:mr-0 ${
                                    activeTab === item.id 
                                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                                        : 'bg-gray-950/50 hover:bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                                }`}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 space-y-8">
                    
                    {/* Stats Summary Panel */}
                    {activeTab === 'overview' && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {stats.map((stat, i) => (
                                <div key={i} className="bg-gray-950/50 p-8 rounded-[2rem] border border-gray-800">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={`p-3 rounded-2xl bg-gray-900 border border-gray-800 ${stat.color}`}>
                                            <stat.icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                    <h3 className="text-4xl font-black text-white font-mono tracking-tighter">{stat.value}</h3>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Content Views */}
                    <div className="bg-gray-950/50 rounded-[2rem] border border-gray-800 p-8">
                        
                        {/* 1. DASHBOARD OVERVIEW */}
                        {activeTab === 'overview' && <DashboardOverview hostedTournaments={hostedTournaments} />}
                        
                        {/* 2. COMPETITIONS / TOURNAMENT MANAGEMENT */}
                        {activeTab === 'competitions' && <CompetitionsTab hostedTournaments={hostedTournaments} onRefresh={fetchHosted} onDelete={handleDeleteClick} />}

                        {/* 3. REGISTRATIONS WORKFLOWS */}
                        {activeTab === 'registrations' && <RegistrationsTab regSelectedTourId={regSelectedTourId} setRegSelectedTourId={setRegSelectedTourId} hostedTournaments={hostedTournaments} loadingRegs={loadingRegs} participantsList={participantsList} onUpdateParticipantStatus={handleUpdateParticipantStatus} />}

                        {/* 4. OPERATIONS CONTROL HUB */}
                        {activeTab === 'operations' && <OperationsTab opSelectedTourId={opSelectedTourId} setOpSelectedTourId={setOpSelectedTourId} hostedTournaments={hostedTournaments} roomIdInput={roomIdInput} setRoomIdInput={setRoomIdInput} roomPassInput={roomPassInput} setRoomPassInput={setRoomPassInput} streamLinkInput={streamLinkInput} setStreamLinkInput={setStreamLinkInput} onBroadcastLobby={handleBroadcastLobby} onUpdateTournamentStatus={handleUpdateTournamentStatus} opLogs={opLogs} customLog={customLog} setCustomLog={setCustomLog} onAddCustomLog={handleAddCustomLog} />}

                        {/* 5. FINANCE MANAGEMENT */}
                        {activeTab === 'finance' && <FinanceTab hostedTournaments={hostedTournaments} profile={profile} withdrawAmount={withdrawAmount} setWithdrawAmount={setWithdrawAmount} withdrawMethod={withdrawMethod} setWithdrawMethod={setWithdrawMethod} withdrawDetails={withdrawDetails} setWithdrawDetails={setWithdrawDetails} onRequestWithdraw={handleRequestWithdraw} loadingTx={loadingTx} recentTransactions={recentTransactions} />}

                        {/* 6. COMMUNICATION ANNOUNCEMENTS & WEBHOOKS */}
                        {activeTab === 'communication' && <CommunicationTab commSelectedTourId={commSelectedTourId} setCommSelectedTourId={setCommSelectedTourId} hostedTournaments={hostedTournaments} announcementText={announcementText} setAnnouncementText={setAnnouncementText} onBroadcastAnnouncement={handleBroadcastAnnouncement} discordWebhook={discordWebhook} setDiscordWebhook={setDiscordWebhook} savingWebhook={savingWebhook} onSaveWebhook={handleSaveWebhook} profile={profile} />}

                        {/* 7. TEAM CENTER SECTION & DISCIPLINARY MODERATION */}
                        {activeTab === 'team-center' && <TeamCenterTab teamSearch={teamSearch} setTeamSearch={setTeamSearch} availableTeams={availableTeams} selectedTeamForWarning={selectedTeamForWarning} setSelectedTeamForWarning={setSelectedTeamForWarning} warningsList={warningsList} />}

                        {/* 8. ANALYTICAL CHARTS & ENGAGEMENT */}
                        {activeTab === 'analytics' && <AnalyticsTab hostedTournaments={hostedTournaments} analyticsChartData={analyticsChartData} />}

                        {/* 9. ORGANIZATION PROFILE SETTINGS */}
                        {activeTab === 'settings' && <SettingsTab handleSaveOrgSettings={handleSaveOrgSettings} settingsOrgName={settingsOrgName} setSettingsOrgName={setSettingsOrgName} settingsWhatsapp={settingsWhatsapp} setSettingsWhatsapp={setSettingsWhatsapp} settingsContact={settingsContact} setSettingsContact={setSettingsContact} settingsBio={settingsBio} setSettingsBio={setSettingsBio} savingSettings={savingSettings} />}
                    </div>
                </main>
            </div>

            {/* Warning discipline Strike Modal */}
            <Modal isOpen={selectedTeamForWarning !== null} onClose={() => setSelectedTeamForWarning(null)} title="Enforce warning regulation Strike">
                <form onSubmit={handleIssueWarning} className="p-8 space-y-4">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                        You are issuing an official disciplinary action against <span className="text-white">"{selectedTeamForWarning}"</span>. Matches administrators logs must state accurate details.
                    </p>
                    
                    <div>
                        <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Violation Description</label>
                        <textarea 
                            value={warningReason}
                            onChange={(e) => setWarningReason(e.target.value)}
                            rows={3}
                            required
                            placeholder="e.g. Failure to submit required game screen-capture within 15-minute grace limit."
                            className="w-full bg-black border border-gray-800 rounded-2xl p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Warning Strikes Severity</label>
                            <select 
                                value={warningStrikeCost}
                                onChange={(e) => setWarningStrikeCost(parseInt(e.target.value))}
                                className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-black text-white outline-none focus:border-brand-500 uppercase tracking-widest"
                            >
                                <option value={1}>1 Strike (Minor)</option>
                                <option value={2}>2 Strikes (Moderate)</option>
                                <option value={3}>3 Strikes (Disqualification proposal)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button 
                            type="button"
                            onClick={() => setSelectedTeamForWarning(null)}
                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all border border-gray-800"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                        >
                            Issue warning Strike
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Tournament">
                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Trash2 className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">Are you sure?</h3>
                    <p className="text-gray-400 mb-8 font-bold text-sm tracking-wide">
                        This action cannot be undone. All data related to <span className="text-white">"{tournamentToDelete?.title}"</span> will be permanently deleted.
                    </p>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all border border-gray-800"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-600/20"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
};

export default OrganizerPanel;
