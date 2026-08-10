import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, limit, setDoc, serverTimestamp, getDoc, writeBatch, increment, Timestamp, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Transaction, UserProfile, Slide, PromoCode, Game, PaymentMethod, PaymentCategory, SiteSettings, OrgApplication, Tournament, TournamentEarning, SubscriptionPlan } from '../../../shared/types/types';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';
import { NotificationService } from '../../../shared/services/NotificationService';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { ImageUploader } from '../../../shared/components/ImageUploader';
import { MediaCategory, deleteImage } from '../../../shared/services/mediaService';
import { DEFAULT_BANNER, NEXPLAY_LOGO } from '../../../shared/constants/constants';

export function useAdminData(showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void) {
    const { profile } = useAuth();
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
            }
        };

        fetchData();
    }, [profile]);

    useEffect(() => {
        setSelectedTx(null);
    }, [activeTab]);

    const handleApproveTx = async (tx: Transaction) => {
        try {
            const txRef = doc(db, 'transactions', tx.id);
            const userRef = doc(db, 'users', tx.userId);

            // ponytail: runTransaction — checks tx.status to prevent double-approve on retry
            await runTransaction(db, async (transaction) => {
                const txDoc = await transaction.get(txRef);
                if (!txDoc.exists()) throw new Error('Transaction not found');
                const txData = txDoc.data();
                if (txData.status === 'success') throw new Error('Transaction already approved');
                if (txData.status === 'rejected') throw new Error('Transaction already rejected');

                if (tx.type === 'deposit') {
                    transaction.update(userRef, { balance: increment(tx.amount) });
                }
                transaction.update(txRef, { 
                    status: 'success',
                    confirmedBy: profile?.uid,
                    confirmedByUsername: profile?.username
                });
            });

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
        } catch (error: any) {
            console.error("Error approving transaction:", error);
            showToast(error.message || 'Failed to approve transaction', 'error');
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
                    const txRef = doc(db, 'transactions', tx.id);
                    const userRef = doc(db, 'users', tx.userId);

                    // ponytail: runTransaction — checks tx.status to prevent double-refund
                    await runTransaction(db, async (transaction) => {
                        const txDoc = await transaction.get(txRef);
                        if (!txDoc.exists()) throw new Error('Transaction not found');
                        const txData = txDoc.data();
                        if (txData.status === 'refunded') throw new Error('Transaction already refunded');

                        transaction.update(userRef, { balance: increment(Math.abs(tx.amount)) });
                        transaction.update(txRef, { 
                            status: 'refunded',
                            confirmedBy: profile?.uid,
                            confirmedByUsername: profile?.username
                        });
                    });

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
                }
            }
        });
    };

    const executeRejectTx = async (tx: Transaction, reason: string) => {
        try {
            const txRef = doc(db, 'transactions', tx.id);
            const userRef = doc(db, 'users', tx.userId);

            // ponytail: runTransaction — checks tx.status to prevent double-reject
            await runTransaction(db, async (transaction) => {
                const txDoc = await transaction.get(txRef);
                if (!txDoc.exists()) throw new Error('Transaction not found');
                const txData = txDoc.data();
                if (txData.status === 'rejected') throw new Error('Transaction already rejected');
                if (txData.status === 'success') throw new Error('Transaction already approved');

                if (tx.type === 'withdrawal') {
                    transaction.update(userRef, { balance: increment(Math.abs(tx.amount)) });
                }
                transaction.update(txRef, { 
                    status: 'rejected',
                    rejectionReason: reason || 'No reason provided',
                    confirmedBy: profile?.uid,
                    confirmedByUsername: profile?.username
                });
            });

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
        if (isNaN(amount) || amount <= 0) return showToast('Invalid amount', 'error');

        try {
            const finalAmount = adjustmentType === 'add' ? amount : -amount;
            const userRef = doc(db, 'users', selectedUser.uid);

            // ponytail: runTransaction — balance update + ledger entry must be atomic
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error('User not found');
                const currentBalance = userDoc.data()?.balance || 0;
                if (adjustmentType === 'subtract' && currentBalance < amount) {
                    throw new Error('Insufficient balance');
                }

                transaction.update(userRef, { balance: increment(finalAmount) });

                const txRef = doc(collection(db, 'transactions'));
                transaction.set(txRef, {
                    userId: selectedUser.uid,
                    username: selectedUser.username || '',
                    amount: Math.abs(finalAmount),
                    type: 'adjustment',
                    method: 'Admin Adjustment',
                    status: 'success',
                    timestamp: serverTimestamp(),
                    desc: `Admin Adjustment: ${adjustmentType === 'add' ? 'Added' : 'Subtracted'} ${amount}`,
                    confirmedBy: profile?.uid,
                    confirmedByUsername: profile?.username
                });
            });

            showToast('Balance Adjusted', 'success');
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, balance: u.balance + finalAmount } : u));
            setSelectedUser(null);
            setAdjustmentAmount('');
        } catch (error) {
            console.error("Error adjusting balance:", error);
            showToast(error.message || 'Failed to adjust balance', 'error');
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

            // Sync custom claims to Firebase Auth
            try {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                    await fetch('/api/admin/set-claims', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ uid: app.userId, role: 'organizer' }),
                    });
                }
            } catch (claimsErr) {
                console.error('Failed to sync custom claims for org approval:', claimsErr);
            }

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

            // Sync custom claims to Firebase Auth
            try {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                    await fetch('/api/admin/set-claims', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ uid: app.userId, role: 'organizer' }),
                    });
                }
            } catch (claimsErr) {
                console.error('Failed to sync custom claims for org approval:', claimsErr);
            }

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
            // Update Firestore doc
            await updateDoc(doc(db, 'users', uid), { role: newRole });
            // Sync custom claims to Firebase Auth (server-side admin call)
            try {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                    await fetch('/api/admin/set-claims', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ uid, role: newRole }),
                    });
                }
            } catch (claimsErr) {
                console.error('Failed to sync custom claims:', claimsErr);
                // ponytail: Firestore doc is source of truth during migration — claims sync is best-effort
            }
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
                    const earningRef = doc(db, 'tournamentEarnings', earning.id);
                    const orgRef = doc(db, 'users', earning.orgId);
                    const txRef = doc(collection(db, 'transactions'));

                    // ponytail: atomic transaction — reads earning status to prevent double-release on retry
                    await runTransaction(db, async (transaction) => {
                        const earningDoc = await transaction.get(earningRef);
                        if (!earningDoc.exists()) throw new Error('Earnings record not found');
                        const earningData = earningDoc.data();
                        if (earningData.status === 'released') throw new Error('Earnings already released');
                        if (earningData.status !== 'pending') throw new Error(`Earnings status is ${earningData.status}, cannot release`);

                        transaction.update(earningRef, {
                            status: 'released',
                            releasedAt: serverTimestamp()
                        });

                        transaction.update(orgRef, {
                            orgPendingEarnings: increment(-earning.orgShare),
                            orgWalletBalance: increment(earning.orgShare)
                        });

                        transaction.set(txRef, {
                            userId: earning.orgId,
                            username: earning.orgName,
                            type: 'prize',
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
                    });
                    
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
                } catch (error: any) {
                    console.error("Error releasing earnings:", error);
                    showToast(error.message || 'Failed to release earnings', 'error');
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    if (profile?.role !== 'admin') return {} as any;

        const pendingDepositsCount = pendingTransactions.filter(t => t.type === 'deposit').length;
        const pendingWithdrawalsCount = pendingTransactions.filter(t => t.type === 'withdrawal').length;
        const pendingOrgCount = orgApplications.length;

        const tabProps = { paymentQr, processAndUploadPayment, handleDragOverPayment, handleDropPayment, handlePastePayment, processAndUploadGame, handleDragOverGame, handleDropGame, handlePasteGame, processAndUploadSlide, handleDragOverSlide, handleDropSlide, handlePasteSlide, setPaymentType, setEditingOrg, setSelectedUser, setSelectedTx, setConfirmModal, DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users };
    return {
        activeTab,
        activityLogs,
        adjustmentAmount,
        adjustmentType,
        allTournaments,
        allTransactions,
        closeConfirmModal,
        confirmModal,
        editingOrg,
        editingPlan,
        fetchOrgTournaments,
        games,
        getRelativeTime,
        handleAdjustBalance,
        handleApproveTx,
        handleRefundTx,
        handleRejectTx,
        handleUpdateUserRole,
        handleUpdateUserSubscription,
        isOrgEditModalOpen,
        isPlanModalOpen,
        isSidebarOpen,
        isTournamentModalOpen,
        orgNameEdit,
        organizers,
        pendingDepositsCount,
        pendingOrgCount,
        pendingWithdrawalsCount,
        planDesc,
        planFeatures,
        planIsActive,
        planMaxTournaments,
        planName,
        planPrice,
        rejectionReason,
        selectedOrgId,
        selectedTournament,
        selectedTx,
        selectedUser,
        setActiveTab,
        setAdjustmentAmount,
        setAdjustmentType,
        setIsSidebarOpen,
        setIsTournamentModalOpen,
        setRejectionReason,
        setSelectedTournament,
        setSelectedTx,
        setSelectedUser,
        setTxFilterStatus,
        setTxFilterTournament,
        setTxFilterType,
        setTxSearchUser,
        subscriptionPlans,
        tabProps,
        txDateFrom,
        txDateTo,
        txFilterStatus,
        txFilterTournament,
        txFilterType,
        txSearchUser,
        users
    };
}
