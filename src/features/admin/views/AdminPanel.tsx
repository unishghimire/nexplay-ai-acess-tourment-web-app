import React from 'react';
import { useNotification } from '../../../shared/context/NotificationContext';
import { Transaction, Tournament } from '../../../shared/types/types';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import TournamentCreateModal from '../../tournaments/components/TournamentCreateModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import TransactionHistoryTab from '../components/TransactionHistoryTab';
import { MediaCategory, deleteImage } from '../../../shared/services/mediaService';
import { DEFAULT_BANNER, NEXPLAY_LOGO } from '../../../shared/constants/constants';
import {Users, ArrowDown, ArrowUp, Layout, Check, X, Image as ImageIcon, CreditCard, QrCode, Megaphone, Trophy, Gamepad2, Tag, Sliders, DollarSign} from 'lucide-react';
import { DashboardTab, TournamentsTab, OrgApprovalsTab, OrgTournamentsTab, UsersTab, OrganizersTab, OrgEarningsTab, PendingDepositsTab, PendingWithdrawalsTab, SubscriptionsTab, GamesTab, PaymentsTab, PromoTab, MediaTab, SettingsTab } from './admin-panel-tabs';
import DiscordAdminPanel from '../components/DiscordAdminPanel';
import { useAdminData } from '../hooks/useAdminData';

// Admin Panel View - Main Management Hub
const AdminPanel: React.FC = () => {
    const { showToast } = useNotification();
    const {
        activeTab, adjustmentAmount, adjustmentType, allTournaments, allTransactions, closeConfirmModal, confirmModal, fetchOrgTournaments, getRelativeTime, handleAdjustBalance, handleApproveTx, handleRefundTx, handleRejectTx, handleUpdateUserRole, handleUpdateUserSubscription, isSidebarOpen, isTournamentModalOpen, pendingDepositsCount, pendingOrgCount, pendingWithdrawalsCount, rejectionReason, selectedOrgId, selectedTournament, selectedTx, selectedUser, setActiveTab, setAdjustmentAmount, setAdjustmentType, setIsSidebarOpen, setIsTournamentModalOpen, setRejectionReason, setSelectedTournament, setSelectedTx, setSelectedUser, setTxFilterStatus, setTxFilterTournament, setTxFilterType, setTxSearchUser, subscriptionPlans, tabProps, txFilterStatus, txFilterTournament, txFilterType, txSearchUser
    } = useAdminData(showToast);

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
            <div className={`w-full md:w-72 shrink-0 space-y-6 sm:space-y-8 bg-gray-950/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-gray-800 h-fit md:sticky md:top-24 ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
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
            <div className="flex-1 bg-gray-950/50 rounded-2xl sm:rounded-[2rem] border border-gray-800 p-4 sm:p-6 lg:p-8 min-h-[500px] sm:min-h-[600px] w-full overflow-hidden">
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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
