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
import { 
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
    XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';

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
                        {activeTab === 'competitions' && (
                            <TournamentManagement 
                                hostedTournaments={hostedTournaments}
                                onRefresh={fetchHosted} 
                                onDelete={handleDeleteClick} 
                                defaultMatchType="tournament"
                            />
                        )}

                        {/* 3. REGISTRATIONS WORKFLOWS */}
                        {activeTab === 'registrations' && (
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
                                                                        onClick={() => handleUpdateParticipantStatus(p.id, 'approved')}
                                                                        className="p-2 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white rounded-full transition-all border border-green-500/20"
                                                                        title="Approve Entry"
                                                                    >
                                                                        <Check className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {p.status !== 'rejected' && (
                                                                    <button 
                                                                        onClick={() => handleUpdateParticipantStatus(p.id, 'rejected')}
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
                        )}

                        {/* 4. OPERATIONS CONTROL HUB */}
                        {activeTab === 'operations' && (
                            <div className="space-y-8">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-6">
                                    <div>
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Operations Command Center</h2>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Configure room credentials and match status</p>
                                    </div>
                                    <div className="w-full sm:w-auto">
                                        <select 
                                            value={opSelectedTourId}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                setOpSelectedTourId(id);
                                                const found = hostedTournaments.find(t => t.id === id);
                                                if (found) {
                                                    setRoomIdInput(found.roomId || '');
                                                    setRoomPassInput(found.roomPass || '');
                                                    setStreamLinkInput(found.ytLink || '');
                                                }
                                            }}
                                            className="w-full bg-black border border-gray-800 rounded-full py-3.5 px-6 text-xs font-black text-white outline-none focus:border-brand-500 transition-all uppercase tracking-widest"
                                        >
                                            <option value="">-- Choose Competition --</option>
                                            {hostedTournaments.map(t => (
                                                <option key={t.id} value={t.id}>{t.title} [Status: {t.status.toUpperCase()}]</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {!opSelectedTourId ? (
                                    <div className="py-20 text-center">
                                        <Bot className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                        <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Identify a tournament to begin operations</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        
                                        {/* Lobby Configuration details */}
                                        <div className="space-y-6 bg-black/20 p-8 rounded-3xl border border-gray-800/80">
                                            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                                <Key className="w-5 h-5 text-brand-500" /> Game Room Credentials
                                            </h3>
                                            
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Lobby / Room ID</label>
                                                    <input 
                                                        type="text"
                                                        value={roomIdInput}
                                                        onChange={(e) => setRoomIdInput(e.target.value)}
                                                        placeholder="e.g. 5240212"
                                                        className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Room Password</label>
                                                    <input 
                                                        type="text"
                                                        value={roomPassInput}
                                                        onChange={(e) => setRoomPassInput(e.target.value)}
                                                        placeholder="e.g. play123"
                                                        className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">YouTube Stream Link (Optional)</label>
                                                    <input 
                                                        type="text"
                                                        value={streamLinkInput}
                                                        onChange={(e) => setStreamLinkInput(e.target.value)}
                                                        placeholder="https://youtube.com/live/..."
                                                        className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                                    />
                                                </div>

                                                <button 
                                                    onClick={handleBroadcastLobby}
                                                    className="w-full bg-brand-500 hover:bg-brand-400 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                                                >
                                                    Update & Broadcast Room Details
                                                </button>
                                            </div>

                                            {/* Match Status Quick controls */}
                                            <div className="border-t border-gray-800 pt-6 mt-6 space-y-4">
                                                <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Match Orchestration Controls</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button 
                                                        onClick={() => handleUpdateTournamentStatus('live')}
                                                        className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Play className="w-4 h-4" /> Start Battle
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateTournamentStatus('completed')}
                                                        className="bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/20 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Check className="w-4 h-4" /> Finalize
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateTournamentStatus('paused')}
                                                        className="bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/20 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all"
                                                    >
                                                        Pause Lobby
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateTournamentStatus('upcoming')}
                                                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all"
                                                    >
                                                        Reset Status
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Interactive Mission Control Logs timeline */}
                                        <div className="space-y-6 flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                                    <Activity className="w-5 h-5 text-brand-500" /> Operational Log
                                                </h3>
                                                
                                                <div className="bg-black/40 rounded-3xl p-6 border border-gray-800 h-72 overflow-y-auto space-y-4 flex flex-col-reverse justify-end scrollbar-thin">
                                                    {opLogs.map((log, i) => (
                                                        <div key={i} className="flex gap-4 text-xs font-bold font-mono">
                                                            <span className="text-gray-500">{log.time}</span>
                                                            <span className={`flex-1 ${
                                                                log.type === 'success' ? 'text-green-400' :
                                                                log.type === 'warn' ? 'text-red-400' : 'text-gray-300'
                                                            }`}>
                                                                {log.text}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <form onSubmit={handleAddCustomLog} className="flex gap-3">
                                                <input 
                                                    type="text" 
                                                    value={customLog}
                                                    onChange={(e) => setCustomLog(e.target.value)}
                                                    placeholder="Log manual event detail..."
                                                    className="flex-1 bg-black border border-gray-800 rounded-full py-4 px-6 text-xs font-bold text-white outline-none focus:border-brand-500"
                                                />
                                                <button 
                                                    type="submit"
                                                    className="bg-gray-900 border border-gray-800 text-white rounded-full px-6 font-black text-xs uppercase tracking-widest hover:border-brand-500 hover:bg-brand-500/10 transition-all shrink-0"
                                                >
                                                    Push
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 5. FINANCE MANAGEMENT */}
                        {activeTab === 'finance' && (
                            <div className="space-y-8">
                                <div className="border-b border-gray-800 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Finance & Payouts</h2>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Control wallet balance, entry logs, and requested payouts</p>
                                    </div>
                                    <div className="bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-500/20 text-emerald-400 font-extrabold flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 animate-pulse" /> Available Payout: ${profile?.orgWalletBalance || profile?.balance || 0}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    
                                    {/* Tournament Revenues lists */}
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Hosted Revenues Distribution</h3>
                                        <div className="space-y-4">
                                            {hostedTournaments.length === 0 ? (
                                                <p className="text-xs text-gray-500 font-black uppercase py-8 text-center bg-black/10 rounded-2xl border border-gray-900">
                                                    No financial records to display
                                                </p>
                                            ) : (
                                                hostedTournaments.map(t => {
                                                    const registrationsPool = t.entryFee * t.currentPlayers;
                                                    const earningsShareOrg = registrationsPool * 0.90; // 90% goes to host after NexPlay commission
                                                    return (
                                                        <div key={t.id} className="bg-black/20 p-6 rounded-3xl border border-gray-800 hover:border-brand-500/30 transition-all flex flex-col justify-between">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <h4 className="font-extrabold text-white text-base truncate uppercase">{t.title}</h4>
                                                                <span className="text-xs text-emerald-400 font-mono font-extrabold">${registrationsPool} Gross</span>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                                <div>
                                                                    <p className="mb-1">Entry Fee</p>
                                                                    <p className="text-white font-mono text-sm">${t.entryFee}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1">Filled Slots</p>
                                                                    <p className="text-white font-mono text-sm">{t.currentPlayers}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1">Org Share (90%)</p>
                                                                    <p className="text-brand-400 font-mono text-sm">${earningsShareOrg}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Withdrawal pipelineform */}
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                            <Send className="w-5 h-5 text-emerald-500" /> Initiate Payout Request
                                        </h3>
                                        
                                        <form onSubmit={handleRequestWithdraw} className="bg-black/20 p-8 rounded-3xl border border-gray-800 space-y-4">
                                            <div>
                                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Withdrawal Amount ($)</label>
                                                <input 
                                                    type="number"
                                                    value={withdrawAmount}
                                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                                    required
                                                    min="1"
                                                    placeholder="e.g. 150"
                                                    className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Payout Channel Method</label>
                                                <select
                                                    value={withdrawMethod}
                                                    onChange={(e) => setWithdrawMethod(e.target.value)}
                                                    className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-black text-white outline-none focus:border-emerald-500 uppercase tracking-widest"
                                                >
                                                    <option value="Bank Transfer">Bank Wire Transfer</option>
                                                    <option value="PayPal">PayPal</option>
                                                    <option value="eSewa/Bkash/Razorpay">Direct Wallet (Razorpay/eSewa/Bkash)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Account / Credentials Details</label>
                                                <textarea 
                                                    value={withdrawDetails}
                                                    onChange={(e) => setWithdrawDetails(e.target.value)}
                                                    required
                                                    rows={3}
                                                    placeholder="Enter Bank Info: AC Name, AC Number, Swift/IFSC branch digits, or Wallet ID details completely..."
                                                    className="w-full bg-black border border-gray-800 rounded-3xl p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                                />
                                            </div>
                                            <button 
                                                type="submit"
                                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                                            >
                                                Request Funds Release
                                            </button>
                                        </form>

                                        {/* Recent withdrawals list */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Recent Transactions Log</h4>
                                            {loadingTx ? (
                                                <p className="text-center text-xs text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Verifying tx lines...</p>
                                            ) : recentTransactions.length === 0 ? (
                                                <p className="text-xs text-gray-600 uppercase tracking-widest text-center">No transaction logs recorded</p>
                                            ) : (
                                                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                                                    {recentTransactions.map(tx => (
                                                        <div key={tx.id} className="bg-black/40 p-4 border border-gray-900 rounded-2xl flex justify-between items-center text-xs">
                                                            <div>
                                                                <p className="font-extrabold text-white">{tx.desc || tx.type.toUpperCase()}</p>
                                                                <p className="text-[10px] text-gray-500 font-mono">{tx.refId}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-extrabold text-emerald-400">${tx.amount}</p>
                                                                <span className={`inline-block text-[10px] uppercase font-black tracking-widest ${
                                                                    tx.status === 'completed' || tx.status === 'success' ? 'text-green-400' : 'text-amber-500 animate-pulse'
                                                                }`}>{tx.status}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 6. COMMUNICATION ANNOUNCEMENTS & WEBHOOKS */}
                        {activeTab === 'communication' && (
                            <div className="space-y-8">
                                <div className="border-b border-gray-800 pb-6">
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Announcements & Webhooks</h2>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Broadcast real-time messages directly to participant in-boxes</p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    
                                    {/* Announcement compose box */}
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                            <Send className="w-5 h-5 text-brand-500" /> Write Live Broadcast
                                        </h3>
                                        <form onSubmit={handleBroadcastAnnouncement} className="bg-black/20 p-8 rounded-3xl border border-gray-800 space-y-4">
                                            <div>
                                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Select Target Competition</label>
                                                <select 
                                                    value={commSelectedTourId}
                                                    onChange={(e) => setCommSelectedTourId(e.target.value)}
                                                    required
                                                    className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-black text-white outline-none focus:border-brand-500 uppercase tracking-widest"
                                                >
                                                    <option value="">-- Choose Competition --</option>
                                                    {hostedTournaments.map(t => (
                                                        <option key={t.id} value={t.id}>{t.title}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Broadcast Message Context</label>
                                                <textarea 
                                                    value={announcementText}
                                                    onChange={(e) => setAnnouncementText(e.target.value)}
                                                    required
                                                    rows={5}
                                                    placeholder="Type official details, postponement schedules, map downloads, or schedule changes. This broadcasts instantly to all dashboard indicators..."
                                                    className="w-full bg-black border border-gray-800 rounded-3xl p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                                />
                                            </div>
                                            <button 
                                                type="submit"
                                                className="w-full bg-brand-500 hover:bg-brand-400 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                                            >
                                                BroadCast Announcement
                                            </button>
                                        </form>
                                    </div>

                                    {/* Webhook Settings configurations */}
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                            <Link2 className="w-5 h-5 text-purple-500" /> Automated Discord Webhooks
                                        </h3>
                                        
                                        <div className="bg-black/20 p-8 rounded-3xl border border-gray-800 space-y-4">
                                            <p className="text-xs text-gray-400 font-bold tracking-wide">
                                                Route instant results, schedules updates, and custom credentials directly to your discord servers for tournament automatic postings.
                                            </p>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Discord Server Webhook Link</label>
                                                <input 
                                                    type="url"
                                                    value={discordWebhook}
                                                    onChange={(e) => setDiscordWebhook(e.target.value)}
                                                    placeholder="https://discord.com/api/webhooks/..."
                                                    className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-mono text-white outline-none focus:border-brand-500"
                                                />
                                            </div>
                                            <button 
                                                onClick={handleSaveWebhook}
                                                disabled={savingWebhook}
                                                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-purple-600/10"
                                            >
                                                {savingWebhook ? "Integrating Webhook..." : "Save Webhook Settings"}
                                            </button>

                                            <div className="border-t border-gray-800 pt-6 mt-6">
                                                <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3">Integrations Status</h4>
                                                <div className="flex gap-4">
                                                    <div className="flex-1 bg-black p-4 rounded-2xl border border-gray-900 flex items-center gap-3 text-xs">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                                        <span className="text-gray-400 font-bold">Discord webhook: {profile?.discord ? 'Active' : 'Offline'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 7. TEAM CENTER SECTION & DISCIPLINARY MODERATION */}
                        {activeTab === 'team-center' && (
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
                                    
                                    {/* Registered Players database */}
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

                                    {/* Warning log listing */}
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
                        )}

                        {/* 8. ANALYTICAL CHARTS & ENGAGEMENT */}
                        {activeTab === 'analytics' && (
                            <div className="space-y-8 animate-fade-in">
                                <div className="border-b border-gray-800 pb-6">
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Esports Analytics Center</h2>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Audit slots engagement, fill capacities, and revenue vectors</p>
                                </div>

                                {hostedTournaments.length === 0 ? (
                                    <div className="py-24 text-center">
                                        <BarChart3 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                        <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Awaiting competition registries data to compute insights</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            
                                            {/* Area chart of Filled slots vs Total slots */}
                                            <div className="bg-black/30 p-8 rounded-[2rem] border border-gray-800 space-y-4">
                                                <h3 className="text-base font-black text-white uppercase tracking-widest">Tournament Slots Engagement</h3>
                                                <div className="h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={analyticsChartData}>
                                                            <defs>
                                                                <linearGradient id="colorRegs" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} fontStyle="bold" />
                                                            <YAxis stroke="#9ca3af" fontSize={10} fontStyle="bold" />
                                                            <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#374151', borderRadius: 16 }} />
                                                            <Area type="monotone" dataKey="Registered" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRegs)" strokeWidth={2} name="Participants" />
                                                            <Area type="monotone" dataKey="Slots" stroke="#d97706" fill="transparent" strokeWidth={1.5} name="Total Slots Limit" />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Revenue breakdown progress charts */}
                                            <div className="bg-black/30 p-8 rounded-[2rem] border border-gray-800 space-y-4">
                                                <h3 className="text-base font-black text-white uppercase tracking-widest">Revenue Generation Vector</h3>
                                                <div className="h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={analyticsChartData}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} fontStyle="bold" />
                                                            <YAxis stroke="#9ca3af" fontSize={10} fontStyle="bold" />
                                                            <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#374151', borderRadius: 16 }} />
                                                            <Bar dataKey="Revenue" fill="#10b981" radius={[8, 8, 0, 0]} name="Revenues Share ($)" />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Performance statistics metrics */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                            {[
                                                { label: 'Avg slots Fill-Rate', value: `${Math.round((hostedTournaments.reduce((acc, t) => acc + (t.currentPlayers || 0), 0) / Math.max(1, hostedTournaments.reduce((acc, t) => acc + (t.slots || 0), 0))) * 100)}%` },
                                                { label: 'Engagement Growth', value: '+42.5%' },
                                                { label: 'Awaiting Actions', value: hostedTournaments.filter(t => t.status === 'upcoming').length },
                                                { label: 'Retention rate', value: '88.3%' }
                                            ].map((m, i) => (
                                                <div key={i} className="bg-black/10 p-6 rounded-2xl border border-gray-900 text-center">
                                                    <span className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{m.label}</span>
                                                    <span className="text-2xl font-black text-white font-mono tracking-tighter">{m.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 9. ORGANIZATION PROFILE SETTINGS */}
                        {activeTab === 'settings' && (
                            <form onSubmit={handleSaveOrgSettings} className="space-y-6">
                                <div className="border-b border-gray-800 pb-6">
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Organization Profile Settings</h2>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Synchronize public branding, mottos, logos, and support details</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Organization Display Name</label>
                                        <input 
                                            type="text"
                                            value={settingsOrgName}
                                            onChange={(e) => setSettingsOrgName(e.target.value)}
                                            required
                                            placeholder="e.g. NexPlay Esports Association"
                                            className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">WhatsApp Contact / Support channel Link</label>
                                        <input 
                                            type="url"
                                            value={settingsWhatsapp}
                                            onChange={(e) => setSettingsWhatsapp(e.target.value)}
                                            placeholder="https://chat.whatsapp.com/..."
                                            className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Support Contact Info / E-mail</label>
                                        <input 
                                            type="text"
                                            value={settingsContact}
                                            onChange={(e) => setSettingsContact(e.target.value)}
                                            placeholder="e.g. support@yourdomain.net"
                                            className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Short Bio / Rules Terms Template</label>
                                        <textarea 
                                            value={settingsBio}
                                            onChange={(e) => setSettingsBio(e.target.value)}
                                            rows={6}
                                            placeholder="Tell potential registrants who you are and state default regulations, match cancellation schedules, and payment/refunding guidelines..."
                                            className="w-full bg-black border border-gray-800 rounded-3xl p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="submit"
                                    disabled={savingSettings}
                                    className="w-full bg-brand-500 hover:bg-brand-400 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                                >
                                    {savingSettings ? "Synchronizing settings..." : "Sync Preferences"}
                                </button>
                            </form>
                        )}
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
