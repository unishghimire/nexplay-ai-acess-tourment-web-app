import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, limit, setDoc, serverTimestamp, getDoc, writeBatch, increment, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { Transaction, UserProfile, Slide, PromoCode, Game, PaymentMethod, PaymentCategory, SiteSettings, OrgApplication, Tournament, TournamentEarning, ActivityLog, SubscriptionPlan } from '../../../shared/types/types';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';
import { NotificationService } from '../../../shared/services/NotificationService';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import TournamentCreateModal from '../../tournaments/components/TournamentCreateModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import TransactionHistoryTab from '../components/TransactionHistoryTab';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { ImageUploader } from '../../../shared/components/ImageUploader';
import { MediaCategory, deleteImage } from '../../../shared/services/mediaService';
import { DEFAULT_BANNER, NEXPLAY_LOGO } from '../../../shared/constants/constants';
import { Users, ArrowDown, ArrowUp, Settings, Gift, Layout, Check, X, Download, Search, Trash, Edit, Upload, Image as ImageIcon, CreditCard, Eye, QrCode, Plus, Bell, Megaphone, Trophy, Gamepad2, Tag, Sliders, Info, ExternalLink, CheckCircle, DollarSign, AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { DashboardTab, TournamentsTab, OrgApprovalsTab, OrgTournamentsTab, UsersTab, OrganizersTab, OrgEarningsTab, PendingDepositsTab, PendingWithdrawalsTab, SubscriptionsTab, GamesTab, PaymentsTab, PromoTab, MediaTab, SettingsTab } from './admin-panel-tabs';

// ── Discord Admin Panel — local sub-component ─────────────────────────────────
interface DiscordAdminPanelProps {
    allTournaments: Tournament[];
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DiscordAdminPanel: React.FC<DiscordAdminPanelProps> = ({ allTournaments, showToast }) => {
    const [selectedTournamentId, setSelectedTournamentId] = useState('');
    const [sending, setSending] = useState<string | null>(null);

    const selectedTournament = allTournaments.find(t => t.id === selectedTournamentId) ?? null;

    const handleSend = async (type: string) => {
        if (!selectedTournament) {
            showToast('Select a tournament first', 'warning');
            return;
        }
        setSending(type);
        try {
            const token = await (await import('../../../shared/config/firebase')).auth.currentUser?.getIdToken();
            if (!token) { showToast('Not authenticated', 'error'); return; }

            const isScrim = selectedTournament.matchType === 'scrims';
            const channel = isScrim ? 'scrims' : 'tournaments';

            const dataMap: Record<string, object> = {
                tournament_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    game: selectedTournament.game,
                    teamType: selectedTournament.teamType,
                    type: selectedTournament.type,
                    map: selectedTournament.map,
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    entryFee: selectedTournament.entryFee === 0 ? 'FREE' : `Rs. ${selectedTournament.entryFee}`,
                    currentPlayers: selectedTournament.currentPlayers,
                    slots: selectedTournament.slots,
                    bannerUrl: selectedTournament.bannerUrl,
                },
                tournament_live: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    currentPlayers: selectedTournament.currentPlayers,
                    slots: selectedTournament.slots,
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    map: selectedTournament.map,
                },
                tournament_completed: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    winner: selectedTournament.winners?.[0]?.username,
                },
                group_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groups: (selectedTournament.groups ?? []).map(g =>
                        `${g.name} (${g.teams.length} teams): ${g.teams.map(t => t.name).join(', ')}`
                    ),
                },
                game_start: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groupName: 'All Groups',
                    map: selectedTournament.map ?? 'TBD',
                    roomId: selectedTournament.roomId,
                    roomPass: selectedTournament.roomPass,
                },
                game_time: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groupName: 'All Groups',
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    timeLeft: '30 minutes',
                    map: selectedTournament.map,
                },
                scrim_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    game: selectedTournament.game,
                    teamType: selectedTournament.teamType,
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    entryFee: selectedTournament.entryFee === 0 ? 'FREE' : `Rs. ${selectedTournament.entryFee}`,
                    currentPlayers: selectedTournament.currentPlayers,
                    slots: selectedTournament.slots,
                    bannerUrl: selectedTournament.bannerUrl,
                },
            };

            const data = dataMap[type];
            if (!data) { showToast('Unknown announcement type', 'error'); return; }

            const res = await fetch('/api/discord/announce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ type, data, channel }),
            });
            const json = await res.json();
            showToast(json.message, json.success ? 'success' : 'error');
        } catch (err: any) {
            showToast('Failed to send announcement', 'error');
        } finally {
            setSending(null);
        }
    };

    const announcements = [
        { type: 'tournament_published', label: 'Publish',     color: 'text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/20 hover:bg-[#5865F2]/20' },
        { type: 'tournament_live',      label: '🔴 Live',     color: 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
        { type: 'tournament_completed', label: 'Completed',   color: 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20' },
        { type: 'group_published',      label: 'Group Draw',  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' },
        { type: 'game_start',           label: 'Match Start', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20' },
        { type: 'game_time',            label: 'Reminder',    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' },
        { type: 'scrim_published',      label: 'Scrim Post',  color: 'text-brand-400 bg-brand-500/10 border-brand-500/20 hover:bg-brand-500/20' },
    ];

    return (
        <div className="space-y-8">
            <div className="border-b border-gray-800 pb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <div className="p-2 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl">
                        <Send className="w-5 h-5 text-[#5865F2]" />
                    </div>
                    Discord Announcements
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">
                    Send tournament updates directly to the Nexplay Discord server
                </p>
            </div>

            {/* Tournament selector */}
            <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 space-y-4">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                    Select Tournament or Scrim
                </label>
                <select
                    value={selectedTournamentId}
                    onChange={e => setSelectedTournamentId(e.target.value)}
                    aria-label="Select tournament for Discord announcement"
                    className="w-full bg-black border border-gray-700 rounded-2xl px-5 py-4 text-white text-sm font-bold focus:border-[#5865F2] outline-none transition"
                >
                    <option value="">— Choose a tournament —</option>
                    {allTournaments.map(t => (
                        <option key={t.id} value={t.id}>
                            [{t.status.toUpperCase()}] {t.title} ({t.matchType === 'scrims' ? '#scrims' : '#tournaments'})
                        </option>
                    ))}
                </select>

                {selectedTournament && (
                    <div className="flex items-center gap-3 p-4 bg-black/40 rounded-2xl border border-gray-800">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-900 border border-gray-700 shrink-0">
                            {selectedTournament.bannerUrl && (
                                <img src={selectedTournament.bannerUrl} alt="" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="text-white font-black text-sm truncate">{selectedTournament.title}</div>
                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                {selectedTournament.game} · {selectedTournament.teamType} · Posting to #{selectedTournament.matchType === 'scrims' ? 'scrims' : 'tournaments'}
                            </div>
                        </div>
                        <span className={`ml-auto shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            selectedTournament.status === 'live' ? 'bg-red-500/10 text-red-400' :
                            selectedTournament.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                            'bg-brand-500/10 text-brand-400'
                        }`}>
                            {selectedTournament.status}
                        </span>
                    </div>
                )}
            </div>

            {/* Announce buttons */}
            <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
                    Announcement Type
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {announcements.map(a => (
                        <button
                            key={a.type}
                            onClick={() => handleSend(a.type)}
                            disabled={sending !== null || !selectedTournament}
                            className={`flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${a.color}`}
                        >
                            {sending === a.type ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Setup guide */}
            <div className="bg-[#5865F2]/5 border border-[#5865F2]/15 p-6 rounded-3xl space-y-3">
                <div className="text-[10px] font-black text-[#5865F2] uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-4 h-4" /> Setup Guide
                </div>
                <ol className="text-xs text-gray-400 font-bold space-y-2 list-decimal list-inside">
                    <li>Go to your Discord Server Settings → Integrations → Webhooks</li>
                    <li>Create a webhook for your <span className="text-white">#tournaments</span> channel → copy URL → set <span className="font-mono text-brand-400">DISCORD_WEBHOOK_TOURNAMENTS</span> in <span className="font-mono">.env</span></li>
                    <li>Create a webhook for your <span className="text-white">#scrims</span> channel → copy URL → set <span className="font-mono text-brand-400">DISCORD_WEBHOOK_SCRIMS</span> in <span className="font-mono">.env</span></li>
                    <li>Restart the server — webhooks activate immediately</li>
                </ol>
            </div>
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

// Admin Panel View - Main Management Hub
const AdminPanel: React.FC = () => {
    const { profile } = useAuth();
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState('tab-dashboard');
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
    const [orgApplications, setOrgApplications] = useState<OrgApplication[]>([]);
    const [organizers, setOrganizers] = useState<UserProfile[]>([]);
    const [orgTournaments, setOrgTournaments] = useState<Tournament[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [slides, setSlides] = useState<Slide[]>([]);
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ totalBalance: 0, todayDep: 0, todayWith: 0 });
    const [loading, setLoading] = useState(true);

    // Game Form State
    const [isGameModalOpen, setIsGameModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<Game | null>(null);
    const [gameName, setGameName] = useState('');
    const [gameLogo, setGameLogo] = useState('');
    const [gameModes, setGameModes] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Payment Category Form State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<PaymentCategory | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [categoryActive, setCategoryActive] = useState(true);

    // Payment Method Form State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
    const [paymentCategoryId, setPaymentCategoryId] = useState('');
    const [paymentName, setPaymentName] = useState('');
    const [paymentQr, setPaymentQr] = useState('');
    const [paymentInstructions, setPaymentInstructions] = useState('');
    const [paymentType, setPaymentType] = useState('eSewa');
    const [paymentActive, setPaymentActive] = useState(true);
    const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

    // Promo Form State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState('');
    const [promoMaxUses, setPromoMaxUses] = useState('');
    const [promoActive, setPromoActive] = useState(true);

    // Slide Form State
    const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
    const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
    const [slideTitle, setSlideTitle] = useState('');
    const [slideDescription, setSlideDescription] = useState('');
    const [slideImage, setSlideImage] = useState('');
    const [slideLink, setSlideLink] = useState('');
    const [slideBtnText, setSlideBtnText] = useState('View More');
    const [slideIsActive, setSlideIsActive] = useState(true);

    // Settings State
    const [minWithdrawal, setMinWithdrawal] = useState('');
    const [supportEmail, setSupportEmail] = useState('');
    const [supportPhone, setSupportPhone] = useState('');
    const [notice, setNotice] = useState('');
    const [isNoticeActive, setIsNoticeActive] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [orgFormDescription, setOrgFormDescription] = useState('');

    // New UX State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [txDateFrom, setTxDateFrom] = useState('');
    const [txDateTo, setTxDateTo] = useState('');
    const [banReason, setBanReason] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [userAuditLogs, setUserAuditLogs] = useState<Transaction[]>([]);
    const [isUserAuditDrawerOpen, setIsUserAuditDrawerOpen] = useState(false);
    const [isNotifyUserModalOpen, setIsNotifyUserModalOpen] = useState(false);
    const [notifyUserMessage, setNotifyUserMessage] = useState('');
    const [notifyUserTitle, setNotifyUserTitle] = useState('');

    // Media Library States
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaFilter, setMediaFilter] = useState("ALL");
    const [mediaSearch, setMediaSearch] = useState("");
    const [mockUploadUrl, setMockUploadUrl] = useState("");
    const [selectedMediaCategory, setSelectedMediaCategory] = useState<MediaCategory>(MediaCategory.OTHER);

    const fetchMedia = async () => {
        setMediaLoading(true);
        try {
            const q = query(collection(db, "media"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMediaItems(items);
        } catch (err) {
            console.error("Error fetching media library records:", err);
        } finally {
            setMediaLoading(false);
        }
    };

    const handleDeleteMedia = async (mediaId: string, url: string, publicId?: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Image Reference",
            message: `Are you sure you want to delete this image reference? This action will permanently remove it from Cloudinary and the catalog library. URL: ${url}`,
            isDestructive: true,
            onConfirm: async () => {
                const actualPublicId = publicId || url;
                const success = await deleteImage(mediaId, actualPublicId);
                if (success) {
                    showToast("Media asset deleted successfully from Cloudinary and catalog!", "success");
                    await fetchMedia();
                } else {
                    showToast("Failed to delete media reference.", "error");
                }
                closeConfirmModal();
            }
        });
    };

    useEffect(() => {
        if (activeTab === "tab-media") {
            fetchMedia();
        }
    }, [activeTab]);

    const { handlePaste: handlePasteSlide, handleDrop: handleDropSlide, handleDragOver: handleDragOverSlide, processAndUpload: processAndUploadSlide } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setSlideImage(url),
        onError: (err) => showToast(err, 'error')
    });

    const { handlePaste: handlePasteGame, handleDrop: handleDropGame, handleDragOver: handleDragOverGame, processAndUpload: processAndUploadGame } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setGameLogo(url),
        onError: (err) => showToast(err, 'error')
    });

    const { handlePaste: handlePastePayment, handleDrop: handleDropPayment, handleDragOver: handleDragOverPayment, processAndUpload: processAndUploadPayment } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setPaymentQr(url),
        onError: (err) => showToast(err, 'error')
    });

    // Transaction Review State
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // User Management State
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');

    // Organizer Edit State
    const [isOrgEditModalOpen, setIsOrgEditModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<UserProfile | null>(null);
    const [orgEmail, setOrgEmail] = useState('');
    const [orgDiscord, setOrgDiscord] = useState('');
    const [orgYoutube, setOrgYoutube] = useState('');
    const [orgWhatsapp, setOrgWhatsapp] = useState('');
    const [orgNameEdit, setOrgNameEdit] = useState('');

    // Transaction Filter State
    const [txFilterStatus, setTxFilterStatus] = useState<'all' | 'pending' | 'success' | 'rejected' | 'refunded'>('all');
    const [txFilterType, setTxFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'prize' | 'refund' | 'entry_fee'>('all');
    const [txFilterTournament, setTxFilterTournament] = useState<string>('all');
    const [txSearchUser, setTxSearchUser] = useState('');
    const [tournamentEarnings, setTournamentEarnings] = useState<TournamentEarning[]>([]);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    const getRelativeTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    };

    const logAdminAction = async (action: string, details: string) => {
        if (!profile) return;
        try {
            await setDoc(doc(collection(db, 'activityLogs')), {
                adminId: profile.uid,
                adminEmail: profile.email,
                action,
                details,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to log admin action:", error);
        }
    };

    useEffect(() => {
        if (profile?.role !== 'admin') return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch pending transactions
                const txSnap = await getDocs(query(collection(db, 'transactions'), where('status', '==', 'pending')));
                setPendingTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));

                // Fetch all recent transactions
                const allTxSnap = await getDocs(query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100)));
                setAllTransactions(allTxSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));

                // Fetch all tournaments for filtering
                const tourneySnap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')));
                setAllTournaments(tourneySnap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));

                // Fetch slides
                const slideSnap = await getDocs(query(collection(db, 'slides'), orderBy('createdAt', 'desc')));
                setSlides(slideSnap.docs.map(d => ({ id: d.id, ...d.data() } as Slide)));

                // Fetch promo codes
                const promoSnap = await getDocs(query(collection(db, 'promocodes'), orderBy('createdAt', 'desc')));
                setPromoCodes(promoSnap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode)));

                // Fetch games
                const gameSnap = await getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc')));
                setGames(gameSnap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));

                // Fetch payment categories
                const payCatSnap = await getDocs(query(collection(db, 'paymentCategories'), orderBy('createdAt', 'desc')));
                setPaymentCategories(payCatSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentCategory)));

                // Fetch payment methods
                const paySnap = await getDocs(query(collection(db, 'paymentMethods'), orderBy('createdAt', 'desc')));
                setPaymentMethods(paySnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));

                // Fetch Org Applications
                const orgAppSnap = await getDocs(query(collection(db, 'orgApplications'), where('status', '==', 'pending')));
                let orgApps = orgAppSnap.docs.map(d => ({ id: d.id, ...d.data() } as OrgApplication));
                orgApps.sort((a,b) => {
                    const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                    const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                    return bTime - aTime;
                });
                setOrgApplications(orgApps);

                // Fetch Organizers
                const orgsSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['organizer', 'admin'])));
                setOrganizers(orgsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));

                // Fetch stats
                const usersSnap = await getDocs(collection(db, 'users'));
                const usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
                setUsers(usersData);
                
                let totalBal = 0;
                usersSnap.forEach(d => totalBal += (d.data().balance || 0));

                // Fetch activity logs
                const logsSnap = await getDocs(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(10)));
                setActivityLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                // Fetch tournament earnings
                const earningsSnap = await getDocs(query(collection(db, 'tournamentEarnings'), orderBy('createdAt', 'desc')));
                setTournamentEarnings(earningsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TournamentEarning)));

                // Fetch subscription plans
                const planSnap = await getDocs(query(collection(db, 'subscriptionPlans'), orderBy('isActive', 'desc')));
                setSubscriptionPlans(planSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));

                // Load filters from local storage
                const savedTxStatus = localStorage.getItem('txFilterStatus');
                const savedTxType = localStorage.getItem('txFilterType');
                const savedTxFrom = localStorage.getItem('txDateFrom');
                const savedTxTo = localStorage.getItem('txDateTo');
                if (savedTxStatus) setTxFilterStatus(savedTxStatus as any);
                if (savedTxType) setTxFilterType(savedTxType as any);
                if (savedTxFrom) setTxDateFrom(savedTxFrom);
                if (savedTxTo) setTxDateTo(savedTxTo);

                // Fetch site settings
                const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data() as SiteSettings;
                    setSiteSettings(data);
                    setMinWithdrawal(data.minWithdrawal?.toString() || '');
                    setSupportEmail(data.supportEmail || '');
                    setSupportPhone(data.supportPhone || '');
                    setNotice(data.notice || '');
                    setIsNoticeActive(data.isNoticeActive || false);
                    setMaintenanceMode(data.maintenanceMode || false);
                    setOrgFormDescription(data.orgFormDescription || '');
                }

                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const todayTxSnap = await getDocs(query(collection(db, 'transactions'), where('timestamp', '>=', startOfDay)));
                let dep = 0, withdr = 0;
                todayTxSnap.forEach(d => {
                    const data = d.data();
                    if (data.status === 'success') {
                        if (data.type === 'deposit') dep += data.amount;
                        if (data.type === 'withdrawal') withdr += Math.abs(data.amount);
                    }
                });

                setStats({ totalBalance: totalBal, todayDep: dep, todayWith: withdr });
            } catch (error) {
                console.error("Error fetching admin data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [profile]);

    useEffect(() => {
        setSelectedTx(null);
    }, [activeTab]);

    const handleApproveTx = async (tx: Transaction) => {
        try {
            const batch = writeBatch(db);
            const txRef = doc(db, 'transactions', tx.id);
            const userRef = doc(db, 'users', tx.userId);

            if (tx.type === 'deposit') {
                batch.update(userRef, { balance: increment(tx.amount) });
            }
            batch.update(txRef, { 
                status: 'success',
                confirmedBy: profile?.uid,
                confirmedByUsername: profile?.username
            });
            await batch.commit();

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Approved',
                `Your ${tx.type} of ${formatCurrency(tx.amount)} has been approved.`,
                'success',
                '/profile'
            );

            showToast('Transaction Approved', 'success');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            setAllTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'success', confirmedByUsername: profile?.username } : t));
            
            if (selectedTx && selectedTx.id === tx.id) {
                setSelectedTx({ ...selectedTx, status: 'success', confirmedByUsername: profile?.username });
            }
        } catch (error) {
            console.error("Error approving transaction:", error);
            showToast('Failed to approve transaction', 'error');
        }
    };

    const handleRefundTx = async (tx: Transaction) => {
        if (tx.status === 'refunded') return;
        
        setConfirmModal({
            isOpen: true,
            title: 'Confirm Refund',
            message: `Are you sure you want to refund ${formatCurrency(Math.abs(tx.amount))} to ${tx.username}? This will add the amount back to their wallet balance.`,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const batch = writeBatch(db);
                    const txRef = doc(db, 'transactions', tx.id);
                    const userRef = doc(db, 'users', tx.userId);

                    // 1. Update user balance
                    batch.update(userRef, { balance: increment(Math.abs(tx.amount)) });

                    // 2. Update transaction status
                    batch.update(txRef, { 
                        status: 'refunded',
                        confirmedBy: profile?.uid,
                        confirmedByUsername: profile?.username
                    });

                    // 3. Create a new refund record for clarity if needed, 
                    // but usually updating the original is enough for manual override.
                    
                    await batch.commit();

                    // Send Notification
                    await NotificationService.create(
                        tx.userId,
                        'Transaction Refunded',
                        `Your transaction of ${formatCurrency(Math.abs(tx.amount))} has been manually refunded by an admin.`,
                        'info',
                        '/profile'
                    );

                    showToast('Transaction Refunded', 'success');
                    setAllTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'refunded' } : t));
                    setSelectedTx(null);
                } catch (error) {
                    console.error("Error refunding transaction:", error);
                    showToast('Failed to refund transaction', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const executeRejectTx = async (tx: Transaction, reason: string) => {
        try {
            const batch = writeBatch(db);
            const txRef = doc(db, 'transactions', tx.id);
            const userRef = doc(db, 'users', tx.userId);

            if (tx.type === 'withdrawal') {
                batch.update(userRef, { balance: increment(Math.abs(tx.amount)) });
            }
            batch.update(txRef, { 
                status: 'rejected',
                rejectionReason: reason || 'No reason provided',
                confirmedBy: profile?.uid,
                confirmedByUsername: profile?.username
            });
            await batch.commit();

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Rejected',
                `Your ${tx.type} of ${formatCurrency(tx.amount)} was rejected. Reason: ${reason || 'No reason provided'}`,
                'alert',
                '/profile'
            );

            showToast('Transaction Rejected', 'success');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            setSelectedTx(null);
            setRejectionReason('');
        } catch (error) {
            console.error("Error rejecting transaction:", error);
            showToast('Failed to reject transaction', 'error');
        }
    };

    const handleRejectTx = (tx: Transaction) => {
        if (!rejectionReason) {
            setConfirmModal({
                isOpen: true,
                title: 'Reject without reason?',
                message: 'Are you sure you want to reject this transaction without providing a reason?',
                isDestructive: true,
                onConfirm: () => executeRejectTx(tx, rejectionReason)
            });
            return;
        }
        executeRejectTx(tx, rejectionReason);
    };

    const handleAdjustBalance = async () => {
        if (!selectedUser || !adjustmentAmount) return;
        const amount = parseFloat(adjustmentAmount);
        if (isNaN(amount)) return showToast('Invalid amount', 'error');

        try {
            const finalAmount = adjustmentType === 'add' ? amount : -amount;
            await updateDoc(doc(db, 'users', selectedUser.uid), {
                balance: increment(finalAmount)
            });

            // Create a manual adjustment transaction
            const txRef = doc(collection(db, 'transactions'));
            await setDoc(txRef, {
                userId: selectedUser.uid,
                amount: finalAmount,
                type: 'prize', // Using prize as a generic adjustment type or add 'adjustment'
                method: 'Manual Adjustment',
                status: 'success',
                timestamp: serverTimestamp(),
                desc: `Admin Adjustment: ${adjustmentType === 'add' ? 'Added' : 'Subtracted'} ${amount}`
            });

            showToast('Balance Adjusted', 'success');
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, balance: u.balance + finalAmount } : u));
            setSelectedUser(null);
            setAdjustmentAmount('');
        } catch (error) {
            console.error("Error adjusting balance:", error);
            showToast('Failed to adjust balance', 'error');
        }
    };

    const handleApproveOrg = async (app: OrgApplication) => {
        try {
            const batch = writeBatch(db);
            const appRef = doc(db, 'orgApplications', app.id);
            const userRef = doc(db, 'users', app.userId);

            batch.update(userRef, { 
                role: 'organizer',
                orgStatus: 'approved',
                orgName: app.orgName,
                isOrganizer: true
            });
            batch.update(appRef, { status: 'approved' });
            
            await batch.commit();

            await NotificationService.create(
                app.userId,
                'Organizer Application Approved',
                `Congratulations! Your application for ${app.orgName} has been approved. You can now host tournaments.`,
                'success',
                '/organizer-panel'
            );

            showToast('Application Approved', 'success');
            setOrgApplications(prev => prev.filter(a => a.id !== app.id));
        } catch (error) {
            console.error("Error approving org:", error);
            showToast('Failed to approve application', 'error');
        }
    };

    const handleCancelTournament = async (tournament: Tournament) => {
        setConfirmModal({
            isOpen: true,
            title: 'Cancel Tournament',
            message: `Are you sure you want to cancel "${tournament.title}"? All registered players will be automatically refunded. This action cannot be undone.`,
            isDestructive: true,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const batch = writeBatch(db);
                    
                    // 1. Update tournament status
                    const tournamentRef = doc(db, 'tournaments', tournament.id);
                    batch.update(tournamentRef, { status: 'cancelled' });

                    // 2. Fetch participants and pending transactions related to this tournament
                    const [participantsSnap, pendingTxSnap] = await Promise.all([
                        getDocs(query(collection(db, 'participants'), where('tournamentId', '==', tournament.id))),
                        getDocs(query(collection(db, 'transactions'), where('tournamentId', '==', tournament.id), where('status', '==', 'pending')))
                    ]);

                    const participants = participantsSnap.docs.map(d => d.data());
                    const pendingTxs = pendingTxSnap.docs;

                    // 3. Reject any pending transactions related to this tournament
                    for (const txDoc of pendingTxs) {
                        batch.update(txDoc.ref, { 
                            status: 'rejected', 
                            rejectionReason: 'Tournament Cancelled',
                            confirmedBy: profile?.uid,
                            confirmedByUsername: profile?.username
                        });
                    }

                    // 4. Process refunds for participants
                    for (const participant of participants) {
                        const userRef = doc(db, 'users', participant.userId);
                        const refundAmount = tournament.entryFee;

                        if (refundAmount > 0) {
                            // Update user balance
                            batch.update(userRef, { balance: increment(refundAmount) });

                            // Create refund transaction
                            const txRef = doc(collection(db, 'transactions'));
                            batch.set(txRef, {
                                userId: participant.userId,
                                username: participant.username,
                                type: 'refund',
                                amount: refundAmount,
                                method: 'Wallet Refund',
                                refId: `REFUND-${tournament.id}-${participant.userId.slice(0, 5)}`,
                                status: 'refunded',
                                timestamp: serverTimestamp(),
                                desc: `Refund for cancelled tournament: ${tournament.title}`,
                                tournamentId: tournament.id,
                                confirmedBy: profile?.uid,
                                confirmedByUsername: profile?.username
                            });

                            // Send notification
                            await NotificationService.create(
                                participant.userId,
                                'Tournament Cancelled - Refunded',
                                `The tournament "${tournament.title}" has been cancelled. Your entry fee of ${formatCurrency(refundAmount)} has been refunded to your wallet.`,
                                'info',
                                '/profile'
                            );
                        }
                    }

                    // 4. Create Activity Log
                    const logRef = doc(collection(db, 'activityLogs'));
                    batch.set(logRef, {
                        type: 'tournament_cancellation',
                        adminId: profile?.uid,
                        adminName: profile?.username,
                        tournamentId: tournament.id,
                        tournamentTitle: tournament.title,
                        timestamp: serverTimestamp(),
                        details: `Cancelled tournament and refunded ${participants.length} players.`
                    });

                    await batch.commit();
                    showToast('Tournament cancelled and refunds processed', 'success');
                    
                    // Refresh tournaments if needed
                    if (selectedOrgId) {
                        fetchOrgTournaments(selectedOrgId);
                    }
                } catch (error) {
                    console.error("Error cancelling tournament:", error);
                    showToast('Failed to cancel tournament', 'error');
                } finally {
                    setLoading(false);
                    closeConfirmModal();
                }
            }
        });
    };

    const handleRejectOrg = async (app: OrgApplication) => {
        try {
            const batch = writeBatch(db);
            const appRef = doc(db, 'orgApplications', app.id);
            const userRef = doc(db, 'users', app.userId);

            batch.update(userRef, { orgStatus: 'rejected' });
            batch.update(appRef, { status: 'rejected' });
            
            await batch.commit();

            await NotificationService.create(
                app.userId,
                'Organizer Application Rejected',
                `We regret to inform you that your application for ${app.orgName} was rejected.`,
                'alert',
                '/contact'
            );

            showToast('Application Rejected', 'success');
            setOrgApplications(prev => prev.filter(a => a.id !== app.id));
        } catch (error) {
            console.error("Error rejecting org:", error);
            showToast('Failed to reject application', 'error');
        }
    };

    const fetchOrgTournaments = async (orgId: string) => {
        if (!orgId) return;
        setSelectedOrgId(orgId);
        try {
            const q = query(collection(db, 'tournaments'), where('hostUid', '==', orgId));
            const snap = await getDocs(q);
            let tours = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Tournament));
            tours.sort((a,b) => {
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return bTime - aTime;
            });
            setOrgTournaments(tours);
        } catch (error) {
            console.error("Error fetching org tournaments:", error);
            showToast('Failed to fetch tournaments', 'error');
        }
    };

    const handleSaveCategory = async () => {
        if (!categoryName) return showToast('Please provide a category name', 'warning');
        
        try {
            const catData = {
                name: categoryName,
                description: categoryDescription,
                isActive: categoryActive,
                createdAt: editingCategory ? editingCategory.createdAt : serverTimestamp()
            };

            if (editingCategory) {
                await updateDoc(doc(db, 'paymentCategories', editingCategory.id), catData);
                setPaymentCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, ...catData } : c));
                showToast('Payment Category Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'paymentCategories'));
                await setDoc(newRef, catData);
                setPaymentCategories(prev => [{ id: newRef.id, ...catData }, ...prev]);
                showToast('Payment Category Added', 'success');
            }
            
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
            setCategoryName('');
            setCategoryDescription('');
            setCategoryActive(true);
        } catch (error) {
            console.error("Error saving payment category:", error);
            showToast('Failed to save payment category', 'error');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category?',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'paymentCategories', id));
                    setPaymentCategories(prev => prev.filter(c => c.id !== id));
                    showToast('Category Deleted', 'success');
                    logAdminAction('Deleted Payment Category', `Category ID: ${id}`);
                } catch (error) {
                    console.error("Error deleting category:", error);
                    showToast('Failed to delete category', 'error');
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleSavePayment = async () => {
        if (!paymentName || !paymentQr || !paymentInstructions || !paymentCategoryId) return showToast('Please fill all fields', 'warning');
        
        try {
            const payData = {
                name: paymentName,
                categoryId: paymentCategoryId,
                qrUrl: paymentQr,
                instructions: paymentInstructions,
                type: paymentType,
                isActive: paymentActive,
                createdAt: editingPayment ? editingPayment.createdAt : serverTimestamp()
            };

            if (editingPayment) {
                await updateDoc(doc(db, 'paymentMethods', editingPayment.id), payData);
                setPaymentMethods(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...payData } : p));
                showToast('Payment Method Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'paymentMethods'));
                await setDoc(newRef, payData);
                setPaymentMethods(prev => [{ id: newRef.id, ...payData }, ...prev]);
                showToast('Payment Method Added', 'success');
            }
            
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
            setPaymentName('');
            setPaymentCategoryId('');
            setPaymentQr('');
            setPaymentInstructions('');
        } catch (error) {
            console.error("Error saving payment method:", error);
            showToast('Failed to save payment method', 'error');
        }
    };

    const executeDeletePayment = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'paymentMethods', id));
            setPaymentMethods(prev => prev.filter(p => p.id !== id));
            showToast('Payment method deleted', 'success');
        } catch (error) {
            console.error("Error deleting payment method:", error);
            showToast('Failed to delete payment method', 'error');
        }
    };

    const handleDeletePayment = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Payment Method',
            message: 'Are you sure you want to delete this payment method?',
            isDestructive: true,
            onConfirm: () => executeDeletePayment(id)
        });
    };

    const handleSearchUsers = async () => {
        if (!searchQuery.trim()) {
            const snap = await getDocs(query(collection(db, 'users'), limit(20)));
            setUsers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as UserProfile)));
            return;
        }

        setLoading(true);
        try {
            let q;
            if (searchQuery.includes('@')) {
                q = query(collection(db, 'users'), where('email', '==', searchQuery.trim().toLowerCase()), limit(1));
            } else {
                q = query(collection(db, 'users'), 
                    where('username', '>=', searchQuery), 
                    where('username', '<=', searchQuery + '\uf8ff'), 
                    limit(20)
                );
            }
            const snap = await getDocs(q);
            setUsers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as UserProfile)));
        } catch (error) {
            console.error("Error searching users:", error);
            showToast('Search failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGame = async () => {
        if (!gameName || !gameLogo || !gameModes) return showToast('Please fill all fields', 'warning');
        const modesArray = gameModes.split(',').map(m => m.trim()).filter(m => m !== '');
        
        try {
            const gameData = {
                name: gameName,
                logoUrl: gameLogo,
                modes: modesArray,
                isPublished: isPublished,
                createdAt: editingGame ? editingGame.createdAt : serverTimestamp()
            };

            if (editingGame) {
                await updateDoc(doc(db, 'games', editingGame.id), gameData);
                setGames(prev => prev.map(g => g.id === editingGame.id ? { ...g, ...gameData } : g));
                showToast('Game Updated', 'success');
            } else {
                const newGameRef = doc(collection(db, 'games'));
                await setDoc(newGameRef, gameData);
                setGames(prev => [{ id: newGameRef.id, ...gameData }, ...prev]);
                showToast('Game Added', 'success');
            }
            
            setIsGameModalOpen(false);
            setEditingGame(null);
            setGameName('');
            setGameLogo('');
            setGameModes('');
        } catch (error) {
            console.error("Error saving game:", error);
            showToast('Failed to save game', 'error');
        }
    };

    const handleSavePromo = async () => {
        if (!promoCode || !promoAmount || !promoMaxUses) return showToast('Please fill all fields', 'warning');
        try {
            const promoData = {
                code: promoCode.toUpperCase(),
                amount: parseFloat(promoAmount),
                maxUses: parseInt(promoMaxUses),
                currentUses: editingPromo ? editingPromo.currentUses : 0,
                isActive: promoActive,
                createdAt: editingPromo ? editingPromo.createdAt : serverTimestamp()
            };

            if (editingPromo) {
                await updateDoc(doc(db, 'promocodes', editingPromo.id), promoData);
                setPromoCodes(prev => prev.map(p => p.id === editingPromo.id ? { ...p, ...promoData } : p));
                showToast('Promo Code Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'promocodes'));
                await setDoc(newRef, promoData);
                setPromoCodes(prev => [{ id: newRef.id, ...promoData }, ...prev]);
                showToast('Promo Code Added', 'success');
            }
            setIsPromoModalOpen(false);
            setEditingPromo(null);
            setPromoCode('');
            setPromoAmount('');
            setPromoMaxUses('');
        } catch (error) {
            console.error("Error saving promo:", error);
            showToast('Failed to save promo code', 'error');
        }
    };

    const executeDeletePromo = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'promocodes', id));
            setPromoCodes(prev => prev.filter(p => p.id !== id));
            showToast('Promo code deleted', 'success');
        } catch (error) {
            console.error("Error deleting promo:", error);
            showToast('Failed to delete promo code', 'error');
        }
    };

    const handleDeletePromo = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Promo Code',
            message: 'Are you sure you want to delete this promo code?',
            isDestructive: true,
            onConfirm: () => executeDeletePromo(id)
        });
    };

    const handleSaveSlide = async () => {
        if (!slideTitle || !slideImage || !slideLink) return showToast('Please fill all fields', 'warning');
        try {
            const slideData = {
                title: slideTitle,
                description: slideDescription,
                imageUrl: slideImage,
                link: slideLink,
                buttonText: slideBtnText,
                isActive: slideIsActive,
                createdAt: editingSlide ? editingSlide.createdAt : serverTimestamp()
            };

            if (editingSlide) {
                await updateDoc(doc(db, 'slides', editingSlide.id), slideData);
                setSlides(prev => prev.map(s => s.id === editingSlide.id ? { ...s, ...slideData } : s));
                showToast('Slide Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'slides'));
                await setDoc(newRef, slideData);
                setSlides(prev => [{ id: newRef.id, ...slideData }, ...prev]);
                showToast('Slide Added', 'success');
            }
            setIsSlideModalOpen(false);
            setEditingSlide(null);
            setSlideTitle('');
            setSlideDescription('');
            setSlideImage('');
            setSlideLink('');
            setSlideIsActive(true);
        } catch (error) {
            console.error("Error saving slide:", error);
            showToast('Failed to save slide', 'error');
        }
    };

    const executeDeleteSlide = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'slides', id));
            setSlides(prev => prev.filter(s => s.id !== id));
            showToast('Slide deleted', 'success');
        } catch (error) {
            console.error("Error deleting slide:", error);
            showToast('Failed to delete slide', 'error');
        }
    };

    const handleDeleteSlide = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Slide',
            message: 'Are you sure you want to delete this slide?',
            isDestructive: true,
            onConfirm: () => executeDeleteSlide(id)
        });
    };

    // Tournament Management State
    const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [planName, setPlanName] = useState('');
    const [planPrice, setPlanPrice] = useState('');
    const [planDesc, setPlanDesc] = useState('');
    const [planFeatures, setPlanFeatures] = useState('');
    const [planMaxTournaments, setPlanMaxTournaments] = useState('10');
    const [planIsActive, setPlanIsActive] = useState(true);

    const handleSavePlan = async () => {
        if (!planName || !planPrice) return showToast('Please fill all fields', 'warning');
        try {
            const planData = {
                name: planName,
                price: parseFloat(planPrice),
                description: planDesc,
                features: planFeatures.split(',').map(f => f.trim()).filter(f => f !== ''),
                maxTournamentsPerMonth: parseInt(planMaxTournaments),
                isActive: planIsActive
            };

            if (editingPlan) {
                await updateDoc(doc(db, 'subscriptionPlans', editingPlan.id), planData);
                setSubscriptionPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...planData } : p));
                showToast('Plan Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'subscriptionPlans'));
                await setDoc(newRef, planData);
                setSubscriptionPlans(prev => [{ id: newRef.id, ...planData } as any, ...prev]);
                showToast('Plan Added', 'success');
            }
            setIsPlanModalOpen(false);
            setEditingPlan(null);
            setPlanName('');
            setPlanPrice('');
            setPlanDesc('');
            setPlanFeatures('');
        } catch (error) {
            console.error("Error saving plan:", error);
            showToast('Failed to save subscription plan', 'error');
        }
    };

    const handleUpdateUserSubscription = async (userId: string, planId: string) => {
        try {
            const plan = subscriptionPlans.find(p => p.id === planId);
            if (!plan) return showToast('Plan not found', 'error');

            const subscription = {
                planId: plan.id,
                planName: plan.name,
                status: 'active' as 'active' | 'expired' | 'cancelled',
                startDate: Timestamp.now(),
                endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days
                autoRenew: true
            };

            await updateDoc(doc(db, 'users', userId), { subscription });
            setUsers(prev => prev.map(u => u.uid === userId ? { ...u, subscription } : u));
            if (selectedUser?.uid === userId) {
                setSelectedUser(prev => prev ? { ...prev, subscription } : null);
            }
            showToast(`Subscription updated to ${plan.name}`, 'success');
        } catch (error) {
            console.error("Error updating subscription:", error);
            showToast('Failed to update subscription', 'error');
        }
    };

    const handleDeletePlan = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Subscription Plan',
            message: 'Are you sure you want to delete this plan? This may affect users subscribed to it.',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'subscriptionPlans', id));
                    setSubscriptionPlans(prev => prev.filter(p => p.id !== id));
                    showToast('Plan Deleted', 'success');
                } catch (error) {
                    showToast('Failed to delete plan', 'error');
                }
            }
        });
    };

    const handleEditTournament = (tournament: Tournament) => {
        setSelectedTournament(tournament);
        setIsTournamentModalOpen(true);
    };

    const handleToggleFeatured = async (t: Tournament) => {
        try {
            const newStatus = !t.isFeatured;
            await updateDoc(doc(db, 'tournaments', t.id), { isFeatured: newStatus });
            setOrgTournaments(prev => prev.map(item => item.id === t.id ? { ...item, isFeatured: newStatus } : item));
            setAllTournaments(prev => prev.map(item => item.id === t.id ? { ...item, isFeatured: newStatus } : item));
            showToast(`Tournament ${newStatus ? 'featured' : 'unfeatured'}`, 'success');
        } catch (error) {
            console.error("Error toggling featured:", error);
            showToast('Failed to update featured status', 'error');
        }
    };

    const handleViewParticipants = (tournament: Tournament) => {
        // Redirect to tournament page or show a modal
        window.open(`/tournament/${tournament.id}`, '_blank');
    };

    const handleSaveSettings = async () => {
        try {
            const settingsData = {
                minWithdrawal: parseFloat(minWithdrawal),
                supportEmail,
                supportPhone,
                notice,
                isNoticeActive,
                maintenanceMode,
                isOrgFormOpen: siteSettings?.isOrgFormOpen ?? true,
                orgFormDescription,
                updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'settings', 'site'), settingsData);
            setSiteSettings(settingsData as any);
            showToast('Settings Saved', 'success');
        } catch (error) {
            console.error("Error saving settings:", error);
            showToast('Failed to save settings', 'error');
        }
    };

    const toggleOrgForm = async () => {
        if (!siteSettings) return;
        try {
            const newValue = !siteSettings.isOrgFormOpen;
            await updateDoc(doc(db, 'settings', 'site'), { isOrgFormOpen: newValue });
            setSiteSettings(prev => prev ? { ...prev, isOrgFormOpen: newValue } : null);
            showToast(`Organizer applications ${newValue ? 'opened' : 'closed'}`, 'success');
        } catch (error) {
            console.error("Error toggling org form:", error);
            showToast('Failed to toggle form', 'error');
        }
    };

    const handleUpdateUserRole = async (uid: string, newRole: 'player' | 'organizer' | 'admin') => {
        try {
            await updateDoc(doc(db, 'users', uid), { role: newRole });
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
            setOrganizers(prev => {
                const updated = prev.map(u => u.uid === uid ? { ...u, role: newRole } : u);
                if (newRole === 'player') return updated.filter(u => u.uid !== uid);
                return updated;
            });
            showToast(`User role updated to ${newRole}`, 'success');
        } catch (error) {
            console.error("Error updating user role:", error);
            showToast('Failed to update role', 'error');
        }
    };

    const handleSaveOrgDetails = async () => {
        if (!editingOrg) return;
        try {
            const updateData = {
                email: orgEmail,
                discord: orgDiscord,
                youtube: orgYoutube,
                whatsapp: orgWhatsapp,
                orgName: orgNameEdit
            };
            await updateDoc(doc(db, 'users', editingOrg.uid), updateData);
            setOrganizers(prev => prev.map(o => o.uid === editingOrg.uid ? { ...o, ...updateData } : o));
            showToast('Organizer details updated', 'success');
            setIsOrgEditModalOpen(false);
        } catch (error) {
            console.error("Error saving org details:", error);
            showToast('Failed to save details', 'error');
        }
    };

    const handleSuspendOrg = async (uid: string, isSuspended: boolean) => {
        try {
            await updateDoc(doc(db, 'users', uid), { isBanned: isSuspended });
            setOrganizers(prev => prev.map(o => o.uid === uid ? { ...o, isBanned: isSuspended } : o));
            showToast(`Organizer ${isSuspended ? 'suspended' : 'activated'}`, 'success');
        } catch (error) {
            console.error("Error suspending org:", error);
            showToast('Failed to update status', 'error');
        }
    };

    const togglePowerOrganizer = async (org: UserProfile) => {
        try {
            const newStatus = !org.isPowerOrganizer;
            await updateDoc(doc(db, 'users', org.uid), { isPowerOrganizer: newStatus });
            setOrganizers(prev => prev.map(o => o.uid === org.uid ? { ...o, isPowerOrganizer: newStatus } : o));
            showToast(`Organizer power ${newStatus ? 'granted' : 'revoked'}`, 'success');
        } catch (error) {
            console.error("Error toggling power organizer:", error);
            showToast('Failed to update organizer power', 'error');
        }
    };

    const executeDeleteGame = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'games', id));
            setGames(prev => prev.filter(g => g.id !== id));
            showToast('Game Deleted', 'success');
        } catch (error) {
            console.error("Error deleting game:", error);
            showToast('Failed to delete game', 'error');
        }
    };

    const handleDeleteGame = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Game',
            message: 'Are you sure you want to delete this game?',
            isDestructive: true,
            onConfirm: () => executeDeleteGame(id)
        });
    };

    const openEditGame = (game: Game) => {
        setEditingGame(game);
        setGameName(game.name);
        setGameLogo(game.logoUrl);
        setGameModes(game.modes.join(', '));
        setIsPublished(game.isPublished);
        setIsGameModalOpen(true);
    };

    const handleReleaseEarnings = async (earning: TournamentEarning) => {
        setConfirmModal({
            isOpen: true,
            title: 'Release Earnings',
            message: `Are you sure you want to release ${formatCurrency(earning.orgShare)} to ${earning.orgName}'s wallet?`,
            isDestructive: false,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const batch = writeBatch(db);
                    
                    // Update earning status
                    const earningRef = doc(db, 'tournamentEarnings', earning.id);
                    batch.update(earningRef, {
                        status: 'released',
                        releasedAt: serverTimestamp()
                    });
                    
                    // Update org wallet
                    const orgRef = doc(db, 'users', earning.orgId);
                    batch.update(orgRef, {
                        orgPendingEarnings: increment(-earning.orgShare),
                        orgWalletBalance: increment(earning.orgShare)
                    });
                    
                    // Add transaction record for the org
                    const txRef = doc(collection(db, 'transactions'));
                    batch.set(txRef, {
                        userId: earning.orgId,
                        username: earning.orgName,
                        type: 'prize', // Using prize type for earnings
                        amount: earning.orgShare,
                        method: 'Tournament Earnings',
                        refId: `EARN-${earning.tournamentId.slice(0, 8)}`,
                        status: 'success',
                        timestamp: serverTimestamp(),
                        desc: `Earnings released for tournament: ${earning.tournamentName}`,
                        tournamentId: earning.tournamentId,
                        confirmedBy: profile?.uid,
                        confirmedByUsername: profile?.username
                    });
                    
                    await batch.commit();
                    
                    await NotificationService.create(
                        earning.orgId,
                        'Earnings Released',
                        `${formatCurrency(earning.orgShare)} has been added to your wallet for tournament: ${earning.tournamentName}`,
                        'success',
                        '/wallet'
                    );
                    
                    await logAdminAction('earnings_released', `Released ${formatCurrency(earning.orgShare)} to ${earning.orgName} for tournament ${earning.tournamentName}`);
                    
                    setTournamentEarnings(prev => prev.map(e => e.id === earning.id ? { ...e, status: 'released' } : e));
                    showToast('Earnings released successfully', 'success');
                } catch (error) {
                    console.error("Error releasing earnings:", error);
                    showToast('Failed to release earnings', 'error');
                } finally {
                    setLoading(false);
                    closeConfirmModal();
                }
            }
        });
    };

    if (profile?.role !== 'admin') return <div className="text-center text-red-500 mt-10">Restricted Area</div>;

    const pendingDepositsCount = pendingTransactions.filter(t => t.type === 'deposit').length;
    const pendingWithdrawalsCount = pendingTransactions.filter(t => t.type === 'withdrawal').length;
    const pendingOrgCount = orgApplications.length;

        const tabProps = { paymentQr, processAndUploadPayment, handleDragOverPayment, handleDropPayment, handlePastePayment, processAndUploadGame, handleDragOverGame, handleDropGame, handlePasteGame, processAndUploadSlide, handleDragOverSlide, handleDropSlide, handlePasteSlide, setPaymentType, setEditingOrg, setSelectedUser, setSelectedTx, setConfirmModal, DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users };
    return (
        <div className="animate-fade-in max-w-7xl mx-auto flex flex-col md:flex-row gap-6 relative">
            {/* Mobile Sidebar Toggle */}
            <button 
                className="md:hidden flex items-center justify-between bg-card p-4 rounded-2xl border border-gray-800 w-full"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
                <span className="font-bold text-white">Admin Menu</span>
                {isSidebarOpen ? <X className="w-6 h-6 text-gray-400" /> : <Sliders className="w-6 h-6 text-gray-400" />}
            </button>

            {/* Sidebar Navigation */}
            <div className={`w-full md:w-72 shrink-0 space-y-8 bg-gray-950/50 p-6 rounded-[2rem] border border-gray-800 h-fit md:sticky md:top-24 ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 px-3">Main</div>
                    <div className="space-y-2">
                        <button 
                            onClick={() => { setActiveTab('tab-dashboard'); setIsSidebarOpen(false); }} 
                            className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center gap-4 ${
                                activeTab === 'tab-dashboard' 
                                    ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                            }`}
                        >
                            <Layout className={`w-5 h-5 ${activeTab === 'tab-dashboard' ? 'text-white' : 'text-gray-500'}`} />
                            Dashboard
                        </button>
                        <button 
                            onClick={() => { setActiveTab('tab-users'); setIsSidebarOpen(false); }} 
                            className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center gap-4 ${
                                activeTab === 'tab-users' 
                                    ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                            }`}
                        >
                            <Users className={`w-5 h-5 ${activeTab === 'tab-users' ? 'text-white' : 'text-gray-500'}`} />
                            Manage Users
                        </button>
                        <button 
                            onClick={() => { setActiveTab('tab-subscriptions'); setIsSidebarOpen(false); }} 
                            className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center gap-4 ${
                                activeTab === 'tab-subscriptions' 
                                    ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                            }`}
                        >
                            <CreditCard className={`w-5 h-5 ${activeTab === 'tab-subscriptions' ? 'text-white' : 'text-gray-500'}`} />
                            Sub Plans
                        </button>
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 px-3">Financial</div>
                    <div className="space-y-2">
                        {[
                            { id: 'pending-deposits', icon: ArrowDown, label: 'Pending Deposits', badge: pendingDepositsCount },
                            { id: 'pending-withdrawals', icon: ArrowUp, label: 'Pending Withdrawals', badge: pendingWithdrawalsCount },
                            { id: 'tx-history', icon: CreditCard, label: 'Transaction History' }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === `tab-${tab.id}`;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => { setActiveTab(`tab-${tab.id}`); setIsSidebarOpen(false); }} 
                                    className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between ${
                                        isActive 
                                            ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                        {tab.label}
                                    </div>
                                    {tab.badge ? (
                                        <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full">
                                            {tab.badge}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 px-3">Organizations</div>
                    <div className="space-y-2">
                        {[
                            { id: 'org-approvals', icon: Check, label: 'Org Approvals', badge: pendingOrgCount },
                            { id: 'org-tournaments', icon: Trophy, label: 'Org Tournaments' },
                            { id: 'organizers', icon: Users, label: 'Manage Orgs' },
                            { id: 'org-earnings', icon: DollarSign, label: 'Org Earnings' }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === `tab-${tab.id}`;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => { setActiveTab(`tab-${tab.id}`); setIsSidebarOpen(false); }} 
                                    className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between ${
                                        isActive 
                                            ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                        {tab.label}
                                    </div>
                                    {tab.badge ? (
                                        <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full">
                                            {tab.badge}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 px-3">Management</div>
                    <div className="space-y-2">
                        {[
                            { id: 'tournaments', icon: Trophy, label: 'Tournaments' },
                            { id: 'users', icon: Users, label: 'Users' },
                            { id: 'games', icon: Gamepad2, label: 'Games' },
                            { id: 'payments', icon: QrCode, label: 'Payments' },
                            { id: 'promo', icon: Tag, label: 'Promo Codes' },
                            { id: 'media', icon: ImageIcon, label: 'Media Library' }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === `tab-${tab.id}`;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => { setActiveTab(`tab-${tab.id}`); setIsSidebarOpen(false); }} 
                                    className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center gap-4 ${
                                        isActive 
                                            ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 px-3">System</div>
                    <div className="space-y-2">
                        <button 
                            onClick={() => { setActiveTab('tab-discord'); setIsSidebarOpen(false); }} 
                            className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center gap-4 ${
                                activeTab === 'tab-discord' 
                                    ? 'bg-[#5865F2] text-white shadow-xl shadow-[#5865F2]/20' 
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                            }`}
                        >
                            <Megaphone className={`w-5 h-5 ${activeTab === 'tab-discord' ? 'text-white' : 'text-gray-500'}`} />
                            Discord
                        </button>
                        <button 
                            onClick={() => { setActiveTab('tab-settings'); setIsSidebarOpen(false); }} 
                            className={`w-full text-left px-5 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center gap-4 ${
                                activeTab === 'tab-settings' 
                                    ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                            }`}
                        >
                            <Sliders className={`w-5 h-5 ${activeTab === 'tab-settings' ? 'text-white' : 'text-gray-500'}`} />
                            Settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-gray-950/50 rounded-[2rem] border border-gray-800 p-8 min-h-[600px] w-full overflow-hidden">
                <header className="mb-10 pb-8 border-b border-gray-800">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Admin Panel</h1>
                </header>
                {activeTab === 'tab-dashboard' && <DashboardTab {...tabProps} />}

            {activeTab === 'tab-tournaments' && <TournamentsTab {...tabProps} />}

            {activeTab === 'tab-org-approvals' && <OrgApprovalsTab {...tabProps} />}

            {activeTab === 'tab-org-tournaments' && <OrgTournamentsTab {...tabProps} />}

            {activeTab === 'tab-users' && <UsersTab {...tabProps} />}

            {activeTab === 'tab-organizers' && <OrganizersTab {...tabProps} />}

            {activeTab === 'tab-org-earnings' && <OrgEarningsTab {...tabProps} />}

                {activeTab === 'tab-pending-deposits' && <PendingDepositsTab {...tabProps} />}

                {activeTab === 'tab-pending-withdrawals' && <PendingWithdrawalsTab {...tabProps} />}

                {activeTab === 'tab-tx-history' && (
                    <TransactionHistoryTab 
                        allTransactions={allTransactions}
                        allTournaments={allTournaments}
                        setSelectedTx={setSelectedTx}
                        formatDate={formatDate}
                        getRelativeTime={getRelativeTime}
                        formatCurrency={formatCurrency}
                        txFilterType={txFilterType}
                        setTxFilterType={setTxFilterType}
                        txFilterStatus={txFilterStatus}
                        setTxFilterStatus={setTxFilterStatus}
                        txFilterTournament={txFilterTournament}
                        setTxFilterTournament={setTxFilterTournament}
                        txSearchUser={txSearchUser}
                        setTxSearchUser={setTxSearchUser}
                    />
                )}

            {activeTab === 'tab-subscriptions' && <SubscriptionsTab {...tabProps} />}

            {activeTab === 'tab-games' && <GamesTab {...tabProps} />}

            {activeTab === 'tab-payments' && <PaymentsTab {...tabProps} />}

            {activeTab === 'tab-promo' && <PromoTab {...tabProps} />}

            {activeTab === 'tab-media' && <MediaTab {...tabProps} />}

            {activeTab === 'tab-settings' && <SettingsTab {...tabProps} />}

            {activeTab === 'tab-discord' && (
                <DiscordAdminPanel allTournaments={allTournaments} showToast={showToast} />
            )}
            </div>

            {/* Tournament Edit Modal */}
            <TournamentCreateModal 
                isOpen={isTournamentModalOpen}
                onClose={() => {
                    setIsTournamentModalOpen(false);
                    setSelectedTournament(null);
                }}
                onSuccess={() => {
                    // Refresh tournaments
                    if (selectedOrgId) fetchOrgTournaments(selectedOrgId);
                }}
                editTournament={selectedTournament}
            />

            {selectedUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-widest">Manage User</h3>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white bg-dark p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="bg-dark p-4 rounded-xl border border-gray-800">
                            <div className="text-white font-bold">{selectedUser.username}</div>
                            <div className="text-sm text-gray-400">{selectedUser.email}</div>
                            <div className="text-sm text-brand-400 mt-2 font-mono">Current Balance: {formatCurrency(selectedUser.balance)}</div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs text-gray-500 uppercase font-bold block">Adjust Balance</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setAdjustmentType('add')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase border ${adjustmentType === 'add' ? 'bg-green-600 border-green-500 text-white' : 'bg-dark border-gray-700 text-gray-500'}`}
                                >
                                    Add
                                </button>
                                <button 
                                    onClick={() => setAdjustmentType('subtract')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase border ${adjustmentType === 'subtract' ? 'bg-red-600 border-red-500 text-white' : 'bg-dark border-gray-700 text-gray-500'}`}
                                >
                                    Subtract
                                </button>
                            </div>
                            <input 
                                type="number" 
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="Enter amount..."
                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                            />
                            <button onClick={handleAdjustBalance} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition uppercase text-sm">
                                Confirm Adjustment
                            </button>
                        </div>

                        <div className="space-y-4 border-t border-gray-800 pt-6">
                            <label className="text-xs text-gray-500 uppercase font-bold block">Assigned Subscription Plan</label>
                            <div className="grid grid-cols-1 gap-2">
                                <select 
                                    value={selectedUser.subscription?.planId || ''}
                                    onChange={(e) => handleUpdateUserSubscription(selectedUser.uid, e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-sm"
                                >
                                    <option value="">No Plan / Free</option>
                                    {subscriptionPlans.map(plan => (
                                        <option key={plan.id} value={plan.id}>{plan.name} - {formatCurrency(plan.price)}/mo</option>
                                    ))}
                                </select>
                                {selectedUser.subscription && (
                                    <div className="text-[10px] text-gray-500 flex justify-between items-center px-1">
                                        <span>Expires: {selectedUser.subscription.endDate?.toDate().toLocaleDateString()}</span>
                                        <span className="text-brand-500 font-bold uppercase">{selectedUser.subscription.status}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-gray-800 pt-6">
                            <label className="text-xs text-gray-500 uppercase font-bold block">Update Role</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['player', 'organizer', 'admin'] as const).map(role => (
                                    <button 
                                        key={role}
                                        onClick={() => handleUpdateUserRole(selectedUser.uid, role)}
                                        className={`py-2 rounded-lg font-bold text-[10px] uppercase border transition-all ${selectedUser.role === role ? 'bg-brand-600 border-brand-500 text-white' : 'bg-dark border-gray-700 text-gray-500 hover:border-gray-600'}`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedTx && (
                <TransactionDetailModal 
                    selectedTx={selectedTx}
                    onClose={() => setSelectedTx(null)}
                    onDashboard={() => { setSelectedTx(null); setActiveTab('tab-dashboard'); }}
                    onApprove={handleApproveTx}
                    onReject={handleRejectTx}
                    onRefund={handleRefundTx}
                    rejectionReason={rejectionReason}
                    setRejectionReason={setRejectionReason}
                    getRelativeTime={getRelativeTime}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};

export default AdminPanel;
