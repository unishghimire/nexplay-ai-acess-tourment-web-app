import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { Transaction } from '../../../shared/types/types';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import { ArrowUpRight, ArrowDownRight, CheckCircle2, Wallet as WalletIcon, Gift, AlertTriangle, X, ShieldCheck, Download, TrendingUp, ChevronRight, ChevronDown, Medal, Trophy, RefreshCw } from 'lucide-react';
import WalletModal from '../components/WalletModal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useInView } from '../../../shared/hooks/useInView';
import { Seo } from '../../../shared/components/Seo';

const Wallet: React.FC = () => {
    const { user, profile, refreshProfile } = useAuth();
    const { showToast } = useNotification();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchTransactions(),
                refreshProfile()
            ]);
            showToast("Balance and transactions updated", "info");
        } catch {
            showToast("Failed to refresh wallet data", "error");
        } finally {
            setIsRefreshing(false);
        }
    };
    
    // Promo Code State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    // Dispute State
    const [disputeModalOpen, setDisputeModalOpen] = useState(false);
    const [selectedTxForDispute, setSelectedTxForDispute] = useState<Transaction | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Chart visibility
    const { ref: chartRef, isInView: isChartInView } = useInView({ threshold: 0.1 });

    useEffect(() => {
        if (user) {
            fetchTransactions();
        }
    }, [user]);

    const fetchTransactions = async (isLoadMore = false) => {
        if (!user) return;
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        
        try {
            let q;
            if (isLoadMore && lastDoc) {
                q = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid),
                    orderBy('timestamp', 'desc'),
                    startAfter(lastDoc),
                    limit(10)
                );
            } else {
                q = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid),
                    orderBy('timestamp', 'desc'),
                    limit(5)
                );
            }
            const snap = await getDocs(q);
            const txs = snap.docs.map((d) => { const data = d.data() as Record<string, unknown>; return { id: d.id, ...data } as Transaction; });
            
            if (isLoadMore) {
                setTransactions(prev => [...prev, ...txs]);
            } else {
                setTransactions(txs);
            }
            
            if (snap.docs.length > 0) {
                setLastDoc(snap.docs[snap.docs.length - 1]);
            }
            setHasMore(snap.docs.length === (isLoadMore ? 10 : 5));
        } catch (error: any) {
            console.error("Error fetching transactions:", error);
            setFetchError("Failed to load transactions. Please check your connection.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Analytics derived from loaded transactions (display-only, not authoritative)
    // ponytail: uses only the paginated subset already fetched — avoids extra reads
    const analytics = useMemo(() => {
        let recentDeposits = 0;
        let recentWithdrawals = 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        transactions.forEach(tx => {
            if (tx.status === 'success' || tx.status === 'completed') {
                if (tx.type === 'deposit' || tx.type === 'promo' || tx.type === 'refund' || tx.type === 'scrim_refund' || tx.type === 'tournament_release') {
                    recentDeposits += Math.abs(Number(tx.amount || 0));
                } else if (tx.type === 'withdrawal' || tx.type === 'withdraw' || tx.type === 'entry_fee' || tx.type === 'scrim_entry' || tx.type === 'tournament_reservation') {
                    recentWithdrawals += Math.abs(Number(tx.amount || 0));
                }
            }
        });

        const chartData = [...transactions].reverse().map(tx => ({
            name: formatDate(tx.timestamp || (tx as any).createdAt).split(',')[0],
            amount: tx.amount,
            type: tx.type,
            status: tx.status
        })).filter(tx => tx.status === 'success' || tx.status === 'completed').slice(-15);

        return { recentDeposits, recentWithdrawals, chartData };
    }, [transactions]);

    const handleRedeemPromo = async () => {
        if (!promoCode.trim() || !user) return;
        setIsRedeeming(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Authentication required');

            const res = await fetch('/api/wallet/redeem-promo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ code: promoCode.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to redeem promo code');

            showToast(`Successfully redeemed ${formatCurrency(data.amount || 0)}!`, 'success');
            setPromoCode('');
            setIsPromoModalOpen(false);
            
            // Re-fetch transactions
            setLastDoc(null);
            fetchTransactions();
        } catch (error: any) {
            showToast(error.message || 'Failed to redeem promo code', 'error');
        } finally {
            setIsRedeeming(false);
        }
    };

    const handleReportDispute = async () => {
        if (!selectedTxForDispute || !disputeReason.trim() || !user) return;
        setIsSubmittingDispute(true);
        try {
            await addDoc(collection(db, 'disputes'), {
                disputeType: 'payment',
                transactionId: selectedTxForDispute.id,
                refId: selectedTxForDispute.refId || selectedTxForDispute.id,
                userId: user.uid,
                reporterUid: user.uid,
                reportedBy: profile?.username || user.email || 'User',
                username: profile?.username || 'Unknown',
                userEmail: user.email || '',
                amount: selectedTxForDispute.amount,
                paymentType: selectedTxForDispute.type,
                type: selectedTxForDispute.type,
                reason: disputeReason.trim(),
                status: 'pending',
                tournamentId: selectedTxForDispute.tournamentId || null,
                createdAt: serverTimestamp(),
                filedAt: new Date().toISOString()
            });
            showToast('Payment dispute reported successfully. Our support team will review your transaction.', 'success');
            setDisputeModalOpen(false);
            setDisputeReason('');
            setSelectedTxForDispute(null);
        } catch (error: any) {
            showToast(error.message || 'Failed to report payment dispute', 'error');
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const handleExportStatement = () => {
        if (!transactions || transactions.length === 0) {
            showToast('No transactions to export yet', 'info');
            return;
        }
        try {
            const headers = ["Transaction ID", "Date", "Type", "Method", "Amount (NPR)", "Status", "Reference ID", "Description"];
            const rows = transactions.map(tx => [
                `"${tx.id || ''}"`,
                `"${formatDate(tx.timestamp || (tx as any).createdAt)}"`,
                `"${tx.type || ''}"`,
                `"${tx.method || 'System'}"`,
                `"${tx.amount || 0}"`,
                `"${tx.status || ''}"`,
                `"${tx.refId || ''}"`,
                `"${(tx.desc || tx.accountDetails || '').replace(/"/g, '""')}"`
            ]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `NexPlay_Statement_${user.uid.slice(0, 6)}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Statement downloaded successfully", "success");
        } catch (err) {
            console.error("Statement download error:", err);
            showToast("Failed to generate statement file", "error");
        }
    };

    if (!user || !profile) return null;

    const isOrg = profile.role === 'organizer' || profile.role === 'admin';

    // Premium UI Render
    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20 px-4 xl:px-0" data-purpose="wallet-screen">
            <Seo title="Wallet | NexPlay" description="Your wallet and transactions" noindex />
            
            {/* Page Header */}
            <section className="space-y-2 pt-1" data-purpose="page-title-section">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">My Wallet</h1>
                        <p className="text-[11px] sm:text-xs font-medium text-slate-400">Manage and view your gaming funds</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-slate-900 border border-slate-800 text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 glow-green-sm animate-pulse"></span>
                        SECURE
                    </span>
                </div>
                <div className="h-px w-full bg-slate-800/80 mt-2"></div>
            </section>

            {/* Balance and Action CTAs */}
            <section className="space-y-3" data-purpose="balance-and-actions">
                <div className="relative overflow-hidden bg-gradient-to-tr from-[#111728] to-[#141C30] border border-purple-500/20 rounded-2xl p-4 sm:p-6 shadow-md flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-slate-400 uppercase">Total Balance</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Active
                            </span>
                        </div>
                        <p className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
                            {formatCurrency(Number(profile.balance || 0) + Number(profile.orgWalletBalance || 0))}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="text-slate-400 hover:text-purple-300 transition p-2 rounded-full hover:bg-white/5 disabled:opacity-50"
                            aria-label="Refresh balance"
                            title="Refresh balance & transactions"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
                            <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                    </div>
                </div>

                {isOrg && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[#111728] border border-[#1C253E] rounded-xl">
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Org Available</span>
                            <span className="text-base sm:text-lg font-black text-emerald-400">{formatCurrency(profile.orgWalletBalance || 0)}</span>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Prize Escrow</span>
                            <span className="text-base sm:text-lg font-black text-amber-400">{formatCurrency(profile.reservedBalance || 0)}</span>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Locked Entry Fees</span>
                            <span className="text-base sm:text-lg font-black text-cyan-400">{formatCurrency((profile as any).orgTournamentsLockedBalance || 0)}</span>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Pending Earnings</span>
                            <span className="text-base sm:text-lg font-black text-white">{formatCurrency(profile.orgPendingEarnings || 0)}</span>
                        </div>
                    </div>
                )}

                {/* 3-Action Quick Buttons Grid (Matching Stitch Screen 14) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button 
                        type="button" 
                        onClick={() => setActiveModal('deposit')}
                        className="bg-gradient-to-r from-[#8253F5] to-indigo-700 hover:from-[#7340ea] active:scale-95 transition-all py-3 px-2 rounded-xl flex flex-col items-center justify-center text-white shadow-md glow-purple border border-purple-400/30 group cursor-pointer"
                    >
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                            <ArrowDownRight className="w-4 h-4 text-white stroke-[2.5]" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold tracking-wider uppercase">Add Money</span>
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setActiveModal('withdraw')}
                        className="bg-[#111728] hover:bg-[#182038] border border-slate-700/80 active:scale-95 transition-all py-3 px-2 rounded-xl flex flex-col items-center justify-center group cursor-pointer"
                    >
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-1 group-hover:scale-110 transition-transform">
                            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold tracking-wider text-slate-200 group-hover:text-white uppercase">Withdraw</span>
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setIsPromoModalOpen(true)}
                        className="bg-[#111728] hover:bg-[#182038] border border-slate-700/80 active:scale-95 transition-all py-3 px-2 rounded-xl flex flex-col items-center justify-center group cursor-pointer"
                    >
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 mb-1 group-hover:scale-110 transition-transform">
                            <Gift className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold tracking-wider text-slate-200 group-hover:text-white uppercase">Redeem</span>
                    </button>
                </div>
            </section>

            {/* Financial Metrics Summary (Stitch Screen 14) */}
            <section className="grid grid-cols-3 gap-2 sm:gap-3" data-purpose="financial-metrics">
                <div className="bg-[#111728] border border-[#1C253E] rounded-xl p-3 flex flex-col justify-between space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-wide text-slate-400 uppercase">Deposits</span>
                        <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                            <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
                        </div>
                    </div>
                    <p className="text-sm sm:text-base font-black text-white">{formatCurrency(analytics.recentDeposits)}</p>
                </div>
                <div className="bg-[#111728] border border-[#1C253E] rounded-xl p-3 flex flex-col justify-between space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-wide text-slate-400 uppercase">Withdrawals</span>
                        <div className="w-5 h-5 rounded bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                            <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                        </div>
                    </div>
                    <p className="text-sm sm:text-base font-black text-white">{formatCurrency(analytics.recentWithdrawals)}</p>
                </div>
                <div className="bg-[#111728] border border-[#1C253E] rounded-xl p-3 flex flex-col justify-between space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-wide text-slate-400 uppercase">Earnings</span>
                        <div className="w-5 h-5 rounded bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-3 h-3" />
                        </div>
                    </div>
                    <p className="text-sm sm:text-base font-black text-white">{formatCurrency(profile.totalEarnings || 0)}</p>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Professional Transactions Ledger (Stitch Screen 14) */}
                <div className="xl:col-span-2 bg-[#111728] border border-[#1C253E] rounded-2xl overflow-hidden p-3.5 sm:p-5">
                    <div className="flex justify-between items-center pb-3 mb-3 border-b border-[#1C253E]">
                        <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Transaction Record</h3>
                        <button type="button" 
                            onClick={handleExportStatement}
                            className="flex items-center space-x-1.5 bg-[#0A0F1D] hover:bg-[#141C30] border border-purple-500/20 hover:border-purple-500/30 rounded-full px-3 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-300 hover:text-white transition-all shadow-md active:scale-95"
                        >
                            <Download size={13} className="text-purple-400" /> 
                            <span>Statement</span>
                        </button>
                    </div>
                    
                    <div>
                        {fetchError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between gap-4">
                                <p className="text-red-400 text-xs font-bold">{fetchError}</p>
                                <button type="button" onClick={() => window.location.reload()} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-2.5 py-1">Retry</button>
                            </div>
                        )}
                        {loading && transactions.length === 0 ? (
                            <div className="flex justify-center py-16">
                                <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : transactions.length > 0 ? (
                            <div className="space-y-2">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-[#090D18] hover:bg-[#0E1526] rounded-xl border border-[#182138] transition-colors gap-3 group relative">
                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                                                tx.type === 'deposit' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 
                                                (tx.type === 'withdrawal' || tx.type === 'withdraw') ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' : 
                                                (tx.type === 'entry_fee' || tx.type === 'scrim_entry') ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                                                (tx.type === 'refund' || tx.type === 'scrim_refund' || tx.type === 'tournament_release') ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                                                (tx.type === 'prize' || tx.type === 'prize_payout' || tx.type === 'scrim_payout') ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400' :
                                                tx.type === 'promo' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' :
                                                'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                            }`}>
                                                {tx.type === 'deposit' ? <ArrowDownRight className="w-4 h-4 stroke-[2.5]" /> : 
                                                (tx.type === 'withdrawal' || tx.type === 'withdraw') ? <ArrowUpRight className="w-4 h-4 stroke-[2.5]" /> : 
                                                tx.type === 'promo' ? <Gift className="w-4 h-4" /> :
                                                (tx.type === 'entry_fee' || tx.type === 'scrim_entry') ? <Medal className="w-4 h-4" /> :
                                                (tx.type === 'refund' || tx.type === 'scrim_refund' || tx.type === 'tournament_release') ? <ArrowDownRight className="w-4 h-4 stroke-[2.5]" /> :
                                                (tx.type === 'prize' || tx.type === 'prize_payout' || tx.type === 'scrim_payout') ? <Trophy className="w-4 h-4" /> :
                                                <WalletIcon className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white uppercase tracking-wide text-[11px] sm:text-xs truncate">
                                                    {tx.type === 'deposit' ? 'Added Funds' : 
                                                    (tx.type === 'withdrawal' || tx.type === 'withdraw') ? 'Withdrawal' : 
                                                    tx.type === 'entry_fee' ? 'Tournament Entry' :
                                                    tx.type === 'scrim_entry' ? 'Scrim Entry' :
                                                    (tx.type === 'refund' || tx.type === 'scrim_refund') ? 'Refund' :
                                                    tx.type === 'tournament_release' ? 'Escrow Release' :
                                                    tx.type === 'tournament_reservation' ? 'Prize Escrow Reserved' :
                                                    (tx.type === 'prize' || tx.type === 'prize_payout' || tx.type === 'scrim_payout') ? 'Prize Winnings' :
                                                    tx.type === 'promo' ? 'Promo Code' : 'Transfer'}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">{formatDate(tx.timestamp || (tx as any).createdAt)}</span>
                                                    <span className="text-[9px] text-slate-600">•</span>
                                                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium uppercase truncate">{tx.method || 'System'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                                            <div className="text-right">
                                                <p className={`font-black text-xs sm:text-sm font-mono ${
                                                    tx.type === 'deposit' || tx.type === 'promo' || tx.type === 'refund' || tx.type === 'scrim_refund' || tx.type === 'tournament_release' || tx.type === 'prize' || tx.type === 'prize_payout' || tx.type === 'scrim_payout' ? 'text-emerald-400' : 
                                                    (tx.type === 'withdrawal' || tx.type === 'withdraw' || tx.type === 'entry_fee' || tx.type === 'scrim_entry' || tx.type === 'tournament_reservation') ? 'text-rose-400' : 
                                                    'text-white'
                                                }`}>
                                                    {(tx.type === 'deposit' || tx.type === 'promo' || tx.type === 'refund' || tx.type === 'scrim_refund' || tx.type === 'tournament_release' || tx.type === 'prize' || tx.type === 'prize_payout' || tx.type === 'scrim_payout') ? '+' : (tx.type === 'entry_fee' || tx.type === 'scrim_entry' || tx.type === 'tournament_reservation' || Number(tx.amount) < 0) ? '-' : ''}{formatCurrency(Math.abs(Number(tx.amount || 0)))}
                                                </p>
                                                <div className="flex items-center justify-end mt-0.5">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${
                                                        tx.status === 'completed' || tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        tx.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    }`}>
                                                        {tx.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {(tx.status === 'pending' || tx.status === 'rejected') && (
                                                <button type="button" 
                                                    onClick={() => {
                                                        setSelectedTxForDispute(tx);
                                                        setDisputeModalOpen(true);
                                                    }}
                                                    className="opacity-80 hover:opacity-100 text-[9px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded-md transition border border-rose-500/20 flex items-center gap-1"
                                                >
                                                    <AlertTriangle className="w-2.5 h-2.5" /> Dispute
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {hasMore && (
                                    <div className="pt-3 text-center">
                                        <button type="button" 
                                            onClick={() => fetchTransactions(true)}
                                            disabled={loadingMore}
                                            className="w-full py-2.5 px-3 bg-[#0A0F1D] hover:bg-[#141C30] border border-[#182138] hover:border-purple-500/30 rounded-lg text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <span>{loadingMore ? 'Loading...' : 'View More Transactions'}</span>
                                            <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-[#090D18] rounded-xl border border-dashed border-[#182138]">
                                <WalletIcon className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-50" />
                                <p className="text-white font-black uppercase tracking-wider text-xs mb-1">No Activity Found</p>
                                <p className="text-slate-400 text-[11px] font-medium max-w-xs mx-auto">Your wallet transaction history will appear here once you start using it.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column Stack */}
                <div className="space-y-4 sm:space-y-6">
                    {/* Spending Overview Profile */}
                    <div ref={chartRef} className="bg-[#111728] border border-[#1C253E] rounded-2xl p-4 sm:p-5">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex justify-between items-center">
                            Activity Overview
                            <span className="text-[9px] bg-[#0A0F1D] px-2.5 py-0.5 rounded-full text-purple-300 border border-purple-500/20">Recent</span>
                        </h3>
                        <div className="h-44 w-full flex flex-col justify-end">
                            {isChartInView && analytics.chartData.length > 0 ? (() => {
                                const maxAmount = Math.max(...analytics.chartData.map(d => d.amount), 1);
                                return (
                                    <div className="w-full h-full flex flex-col justify-end">
                                        <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 px-1">
                                            {analytics.chartData.map((item, index) => {
                                                const heightPct = Math.max(8, Math.round((item.amount / maxAmount) * 100));
                                                const isIncoming = item.type === 'deposit' || item.type === 'promo';
                                                return (
                                                    <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                                        {/* Tooltip */}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute -top-10 z-20 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-xl whitespace-nowrap shadow-xl flex flex-col items-center">
                                                            <span>{formatCurrency(item.amount)}</span>
                                                            <span className="text-[10px] text-gray-400 font-normal">{isIncoming ? 'Incoming' : 'Outgoing'}</span>
                                                        </div>
                                                        {/* Bar */}
                                                        <div
                                                            style={{ height: `${heightPct}%` }}
                                                            className={`w-full max-w-[18px] rounded-t-sm transition-colors duration-300 ${
                                                                isIncoming ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-purple-500 hover:bg-purple-400'
                                                            }`}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between items-center w-full pt-2 border-t border-[#1C253E] mt-2 gap-1 px-1">
                                            {analytics.chartData.map((item, index) => (
                                                <span key={index} className="flex-1 text-[9px] text-slate-500 font-medium truncate text-center">
                                                    {item.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Not enough data</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Security Module (Stitch Screen 14) */}
                    <div className="bg-[#111728] border border-[#1C253E] rounded-xl p-3.5 space-y-2.5" data-purpose="wallet-security">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-emerald-400">
                                <ShieldCheck className="w-4 h-4" />
                                <h2 className="text-xs font-black tracking-wider text-slate-200 uppercase">Wallet Security</h2>
                            </div>
                            <div className="flex items-center space-x-1 text-emerald-400 text-[10px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Protected</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="bg-[#0A0F1D] border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
                                <span className="text-slate-300 font-semibold">SSL Encrypted</span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div className="bg-[#0A0F1D] border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
                                <span className="text-slate-300 font-semibold">2FA Auth</span>
                                <span className="text-[8px] font-black uppercase text-slate-400">Soon</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed pt-1">
                            Your funds are secured with cryptographic escrow and audit logging.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modals remain structurally identical to logic but restyled via their internal components */}
            <WalletModal 
                isOpen={activeModal !== null} 
                onClose={() => {
                    setActiveModal(null);
                }} 
                initialTab={activeModal === 'withdraw' ? 'withdraw' : 'deposit'}
                onSuccess={() => {
                    fetchTransactions();
                    refreshProfile();
                }}
            />

            {/* Promo Code Modal */}
            {isPromoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setIsPromoModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-dark-900 rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <Gift className="w-6 h-6 text-brand-500" /> Promo Code
                                </h3>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Unlock premium rewards</p>
                            </div>
                            <button type="button" onClick={() => setIsPromoModalOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition bg-dark-800 p-2 rounded-full border border-gray-700 hover:border-gray-600 touch-target flex items-center justify-center">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-3 block">Enter your code</label>
                                <input 
                                    type="text" 
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                    className="w-full bg-dark border-2 border-gray-800 rounded-2xl p-5 text-white font-mono text-center text-2xl focus:border-brand-500 focus-visible:outline-none transition uppercase tracking-widest placeholder-gray-700"
                                    placeholder="NEXPLAY-V1"
                                />
                            </div>
                            <button type="button" 
                                onClick={handleRedeemPromo}
                                disabled={isRedeeming || !promoCode.trim()}
                                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2"
                            >
                                {isRedeeming ? 'Validating...' : 'Claim Reward'} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dispute Modal */}
            {disputeModalOpen && selectedTxForDispute && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setDisputeModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-dark-900 rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-red-500" /> Report Issue
                                </h3>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Secure Dispute Resolution</p>
                            </div>
                            <button type="button" onClick={() => setDisputeModalOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition bg-dark-800 p-2 rounded-full border border-gray-700 hover:border-gray-600 touch-target flex items-center justify-center">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-dark p-5 rounded-2xl border border-gray-800 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Transaction Ref</p>
                                    <p className="font-mono text-sm text-brand-400 font-bold">{selectedTxForDispute.refId || selectedTxForDispute.id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{selectedTxForDispute.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</p>
                                    <p className="text-lg font-black text-white">{formatCurrency(selectedTxForDispute.amount)}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-3 block">Describe the issue clearly</label>
                                <textarea 
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    className="w-full bg-dark border-2 border-gray-800 rounded-2xl p-5 text-white focus:border-red-500/50 focus-visible:outline-none transition resize-none h-40 font-medium"
                                    placeholder="I initiated this withdrawal 3 days ago but haven't received it in my account yet..."
                                />
                            </div>
                            <button type="button" 
                                onClick={handleReportDispute}
                                disabled={isSubmittingDispute || !disputeReason.trim()}
                                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors shadow-xl shadow-red-500/25 flex items-center justify-center gap-2"
                            >
                                {isSubmittingDispute ? 'Opening Ticket...' : 'Submit Dispute'} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wallet;