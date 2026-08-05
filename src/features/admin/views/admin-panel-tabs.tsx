import React from 'react';
import {
    Users, ArrowDown, ArrowUp, Settings, Gift, Layout, Check, X, Download, Search, 
    Trash, Edit, Upload, Image as ImageIcon, CreditCard, Eye, QrCode, Plus, Bell, 
    Megaphone, Trophy, Gamepad2, Tag, Sliders, Info, ExternalLink, CheckCircle, 
    DollarSign, AlertTriangle, RefreshCw, Send
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, setDoc, serverTimestamp, increment, getDoc, writeBatch, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../shared/config/firebase';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';
import { ImageUploader } from '../../../shared/components/ImageUploader';
import { MediaCategory, deleteImage } from '../../../shared/services/mediaService';
import { DEFAULT_BANNER, NEXPLAY_LOGO } from '../../../shared/constants/constants';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';

// ponytail: shared props — typed loosely to avoid 179 individual type declarations
export type AdminPanelTabProps = Record<string, any> & {
    DEFAULT_BANNER?: any;
    ImageUploader?: any;
    MediaCategory?: any;
    NEXPLAY_LOGO?: any;
    activeTab?: any;
    activityLogs?: any;
    allTournaments?: any;
    allTransactions?: any;
    categoryActive?: any;
    categoryDescription?: any;
    categoryName?: any;
    closeConfirmModal?: any;
    editingCategory?: any;
    editingGame?: any;
    editingPayment?: any;
    editingPlan?: any;
    editingPromo?: any;
    editingSlide?: any;
    executeRejectTx?: any;
    fetchMedia?: any;
    fetchOrgTournaments?: any;
    formatCurrency?: any;
    formatDate?: any;
    formatGameName?: any;
    gameLogo?: any;
    gameModes?: any;
    gameName?: any;
    games?: any;
    getRelativeTime?: any;
    handleApproveOrg?: any;
    handleApproveTx?: any;
    handleCancelTournament?: any;
    handleDeleteCategory?: any;
    handleDeleteGame?: any;
    handleDeleteMedia?: any;
    handleDeletePayment?: any;
    handleDeletePlan?: any;
    handleDeletePromo?: any;
    handleDeleteSlide?: any;
    handleEditTournament?: any;
    handleRejectOrg?: any;
    handleReleaseEarnings?: any;
    handleSaveCategory?: any;
    handleSaveGame?: any;
    handleSaveOrgDetails?: any;
    handleSavePayment?: any;
    handleSavePlan?: any;
    handleSavePromo?: any;
    handleSaveSettings?: any;
    handleSaveSlide?: any;
    handleSuspendOrg?: any;
    handleToggleFeatured?: any;
    handleUpdateUserRole?: any;
    handleViewParticipants?: any;
    isCategoryModalOpen?: any;
    isGameModalOpen?: any;
    isNoticeActive?: any;
    isOrgEditModalOpen?: any;
    isPaymentModalOpen?: any;
    isPlanModalOpen?: any;
    isPromoModalOpen?: any;
    isPublished?: any;
    isSlideModalOpen?: any;
    maintenanceMode?: any;
    mediaFilter?: any;
    mediaItems?: any;
    mediaLoading?: any;
    mediaSearch?: any;
    minWithdrawal?: any;
    mockUploadUrl?: any;
    notice?: any;
    openEditGame?: any;
    orgApplications?: any;
    orgDiscord?: any;
    orgEmail?: any;
    orgFormDescription?: any;
    orgNameEdit?: any;
    orgTournaments?: any;
    orgWhatsapp?: any;
    orgYoutube?: any;
    organizers?: any;
    paymentActive?: any;
    paymentCategories?: any;
    paymentCategoryId?: any;
    paymentInstructions?: any;
    paymentMethods?: any;
    paymentName?: any;
    paymentQr?: any;
    pendingTransactions?: any;
    planDesc?: any;
    planFeatures?: any;
    planIsActive?: any;
    planMaxTournaments?: any;
    planName?: any;
    planPrice?: any;
    promoActive?: any;
    promoAmount?: any;
    promoCode?: any;
    promoCodes?: any;
    promoMaxUses?: any;
    searchQuery?: any;
    selectedMediaCategory?: any;
    selectedOrgId?: any;
    setCategoryActive?: any;
    setCategoryDescription?: any;
    setCategoryName?: any;
    setEditingCategory?: any;
    setEditingGame?: any;
    setEditingPayment?: any;
    setEditingPlan?: any;
    setEditingPromo?: any;
    setEditingSlide?: any;
    setGameLogo?: any;
    setGameModes?: any;
    setGameName?: any;
    setIsCategoryModalOpen?: any;
    setIsGameModalOpen?: any;
    setIsNoticeActive?: any;
    setIsOrgEditModalOpen?: any;
    setIsPaymentModalOpen?: any;
    setIsPlanModalOpen?: any;
    setIsPromoModalOpen?: any;
    setIsPublished?: any;
    setIsSlideModalOpen?: any;
    setMaintenanceMode?: any;
    setMediaFilter?: any;
    setMediaSearch?: any;
    setMinWithdrawal?: any;
    setMockUploadUrl?: any;
    setNotice?: any;
    setOrgDiscord?: any;
    setOrgEmail?: any;
    setOrgFormDescription?: any;
    setOrgNameEdit?: any;
    setOrgWhatsapp?: any;
    setOrgYoutube?: any;
    setPaymentActive?: any;
    setPaymentCategoryId?: any;
    setPaymentInstructions?: any;
    setPaymentName?: any;
    setPaymentQr?: any;
    setPlanDesc?: any;
    setPlanFeatures?: any;
    setPlanIsActive?: any;
    setPlanMaxTournaments?: any;
    setPlanName?: any;
    setPlanPrice?: any;
    setPromoActive?: any;
    setPromoAmount?: any;
    setPromoCode?: any;
    setPromoMaxUses?: any;
    setSearchQuery?: any;
    setSelectedMediaCategory?: any;
    setSlideBtnText?: any;
    setSlideDescription?: any;
    setSlideImage?: any;
    setSlideIsActive?: any;
    setSlideLink?: any;
    setSlideTitle?: any;
    setSupportEmail?: any;
    setSupportPhone?: any;
    showToast?: any;
    siteSettings?: any;
    slideBtnText?: any;
    slideDescription?: any;
    slideImage?: any;
    slideIsActive?: any;
    slideLink?: any;
    slideTitle?: any;
    slides?: any;
    stats?: any;
    subscriptionPlans?: any;
    supportEmail?: any;
    supportPhone?: any;
    toggleOrgForm?: any;
    togglePowerOrganizer?: any;
    tournamentEarnings?: any;
    uploading?: any;
    users?: any;
    setConfirmModal?: any;
    setSelectedTx?: any;
    setSelectedUser?: any;
    setEditingOrg?: any;
    setPaymentType?: any;
    handlePasteSlide?: any;
    handleDropSlide?: any;
    handleDragOverSlide?: any;
    processAndUploadSlide?: any;
    handlePasteGame?: any;
    handleDropGame?: any;
    handleDragOverGame?: any;
    processAndUploadGame?: any;
    handlePastePayment?: any;
    handleDropPayment?: any;
    handleDragOverPayment?: any;
    processAndUploadPayment?: any;
};

export const DashboardTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                    <div className="col-span-full grid grid-cols-1 md:grid-cols-4 gap-6 mb-2">
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-900/40 to-blue-900/10 p-6 rounded-2xl border border-blue-500/20 flex items-center gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl border border-blue-500/30 shadow-lg shadow-blue-500/20">
                                <Users className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-blue-200/70 uppercase font-bold tracking-wider mb-1">Total Holdings</div>
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(stats.totalBalance)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-green-900/40 to-green-900/10 p-6 rounded-2xl border border-green-500/20 flex items-center gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
                            <div className="w-14 h-14 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center text-xl border border-green-500/30 shadow-lg shadow-green-500/20">
                                <ArrowDown className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-green-200/70 uppercase font-bold tracking-wider mb-1">Today's Deposits</div>
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(stats.todayDep)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-red-900/40 to-red-900/10 p-6 rounded-2xl border border-red-500/20 flex items-center gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
                            <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-xl border border-red-500/30 shadow-lg shadow-red-500/20">
                                <ArrowUp className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-red-200/70 uppercase font-bold tracking-wider mb-1">Today's Withdrawals</div>
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(stats.todayWith)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-purple-900/40 to-purple-900/10 p-6 rounded-2xl border border-purple-500/20 flex items-center gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl border border-purple-500/30 shadow-lg shadow-purple-500/20">
                                <Users className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-purple-200/70 uppercase font-bold tracking-wider mb-1">Total Users</div>
                                <div className="text-3xl font-black text-white tracking-tight">{users.length}</div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-card p-6 rounded-2xl border border-gray-800 lg:col-span-2 shadow-xl">
                            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                                <h2 className="font-bold text-white text-lg flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-brand-400" /> Pending Transactions
                                </h2>
                                <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                                    {pendingTransactions.length} Pending
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] overflow-y-auto custom-scrollbar content-start pr-2">
                                {pendingTransactions.length > 0 ? (
                                    pendingTransactions.map(t => (
                                        <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all shadow-md group">
                                            <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`font-black tracking-wider ${t.type === 'deposit' ? 'text-green-400' : 'text-red-400'} uppercase text-xs`}>{t.type}</span>
                                                        <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded-full text-gray-300 font-bold tracking-wider">{t.method}</span>
                                                    </div>
                                                    <div className="text-white font-bold text-sm mb-1">{t.username || 'Unknown User'}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{getRelativeTime(t.timestamp)}</div>
                                                </div>
                                                <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                                            </div>
                                            <div className="text-[11px] text-gray-400 mb-5 bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                                <span className="text-gray-600">REF:</span> 
                                                <span className="text-brand-300 select-all">{t.refId}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={() => handleApproveTx(t)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all">
                                                    <Check className="w-4 h-4" /> Approve
                                                </button>
                                                <button onClick={() => {
                                                    setConfirmModal({
                                                        isOpen: true,
                                                        title: 'Reject Transaction',
                                                        message: 'Are you sure you want to reject this transaction?',
                                                        isDestructive: true,
                                                        onConfirm: () => {
                                                            executeRejectTx(t, 'Rejected by Admin');
                                                            closeConfirmModal();
                                                        }
                                                    });
                                                }} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all">
                                                    <X className="w-4 h-4" /> Reject
                                                </button>
                                                <button onClick={() => setSelectedTx(t)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all">
                                                    <Eye className="w-4 h-4" /> Review
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 py-10">
                                        <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-gray-800">
                                            <Check className="text-3xl text-green-500/50" />
                                        </div>
                                        <p className="font-bold uppercase tracking-widest text-sm text-gray-600">All Caught Up!</p>
                                        <p className="text-xs text-gray-700 mt-1">No pending transactions to review.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-xl h-[490px] flex flex-col">
                            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                                <h2 className="font-bold text-white text-lg flex items-center gap-2">
                                    <Info className="w-5 h-5 text-brand-400" /> Activity Feed
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                                {activityLogs.length > 0 ? (
                                    activityLogs.map(log => (
                                        <div key={log.id} className="bg-dark/50 p-4 rounded-xl border border-gray-800">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-brand-400 font-bold text-sm">{log.action}</span>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-gray-500">{formatDate(log.timestamp)}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{getRelativeTime(log.timestamp)}</div>
                                                </div>
                                            </div>
                                            <p className="text-gray-300 text-xs mb-2">{log.details}</p>
                                            <div className="text-[10px] text-gray-500 font-mono">By: {log.adminEmail}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <p className="text-sm">No recent activity.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-card p-4 rounded-xl border border-gray-800">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                <h2 className="font-bold text-white">Promotion Slider</h2>
                                <button 
                                    onClick={() => {
                                        setEditingSlide(null);
                                        setSlideTitle('');
                                        setSlideImage('');
                                        setSlideLink('');
                                        setSlideBtnText('View More');
                                        setIsSlideModalOpen(true);
                                    }}
                                    className="bg-brand-600 px-2 py-1 rounded text-xs text-white"
                                >
                                    Add New
                                </button>
                            </div>
                            <div className="h-48 overflow-y-auto custom-scrollbar">
                                {slides.length > 0 ? (
                                    slides.map(s => (
                                        <div key={s.id} className="flex justify-between items-center bg-dark p-2 rounded mb-2 border border-gray-700">
                                            <div className="flex items-center gap-2">
                                                <img src={s.imageUrl || undefined} className="w-10 h-6 object-cover rounded" alt={s.title} />
                                                <span className="text-white text-sm truncate w-32">{s.title}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => {
                                                    setEditingSlide(s);
                                                    setSlideTitle(s.title);
                                                    setSlideDescription(s.description || '');
                                                    setSlideImage(s.imageUrl);
                                                    setSlideLink(s.link);
                                                    setSlideBtnText(s.buttonText);
                                                    setSlideIsActive(s.isActive);
                                                    setIsSlideModalOpen(true);
                                                }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteSlide(s.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm text-center">No custom slides.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {isSlideModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingSlide ? 'Edit Slide' : 'Add Slide'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Title</label>
                                        <input type="text" value={slideTitle} onChange={e => setSlideTitle(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Description</label>
                                        <textarea value={slideDescription} onChange={e => setSlideDescription(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-20 resize-none" placeholder="Short description for the slide..." />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Image (Paste, Drop or Click to Select)</label>
                                        <div 
                                            onPaste={handlePasteSlide}
                                            onDrop={handleDropSlide}
                                            onDragOver={handleDragOverSlide}
                                            onClick={() => document.getElementById('slide-image-file-input')?.click()}
                                            className={`relative w-full aspect-video rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={slideImage || DEFAULT_BANNER || undefined} 
                                                        alt="Slide Preview" 
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            id="slide-image-file-input"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    processAndUploadSlide(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="mt-2">
                                            <input type="text" value={slideImage} onChange={e => setSlideImage(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-xs" placeholder="Or paste URL..." />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Link</label>
                                        <input type="text" value={slideLink} onChange={e => setSlideLink(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" placeholder="/tournaments or https://..." />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Button Text</label>
                                        <input type="text" value={slideBtnText} onChange={e => setSlideBtnText(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="slideIsActive"
                                            checked={slideIsActive} 
                                            onChange={e => setSlideIsActive(e.target.checked)} 
                                            className="w-4 h-4 rounded border-gray-700 bg-dark text-brand-600 focus:ring-brand-500"
                                        />
                                        <label htmlFor="slideIsActive" className="text-xs text-gray-300 font-bold uppercase cursor-pointer">Active Status</label>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setIsSlideModalOpen(false)} className="flex-1 bg-gray-800 py-3 rounded-xl font-bold">Cancel</button>
                                    <button onClick={handleSaveSlide} className="flex-1 bg-brand-600 py-3 rounded-xl font-bold">Save</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};


export const TournamentsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Trophy className="text-brand-500" /> All Tournaments
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    type="text" 
                                    placeholder="Search tournaments..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-brand-500 outline-none w-64"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allTournaments
                            .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(t => (
                                <div key={t.id} className="bg-dark p-4 rounded-xl border border-gray-800 space-y-3">
                                    <img src={t.bannerUrl || undefined} className="w-full aspect-video object-cover rounded-lg" alt={t.title} />
                                    <div>
                                        <h3 className="font-bold text-white truncate">{t.title}</h3>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">{formatGameName(t.game)}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    t.status === 'upcoming' ? 'bg-blue-600/20 text-blue-400' :
                                                    t.status === 'live' ? 'bg-green-600/20 text-green-400' :
                                                    t.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                                                    'bg-gray-600/20 text-gray-400'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleViewParticipants(t)}
                                                        className="p-1.5 bg-brand-600/20 hover:bg-brand-600 text-brand-500 hover:text-white rounded-lg transition-all border border-brand-500/30"
                                                        title="View Participants"
                                                    >
                                                        <Users className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditTournament(t)}
                                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/30"
                                                        title="Edit Tournament"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleToggleFeatured(t)}
                                                        className={`p-1.5 rounded-lg transition-all border ${
                                                            t.isFeatured 
                                                                ? 'bg-yellow-600/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-600 hover:text-white' 
                                                                : 'bg-gray-600/20 text-gray-400 border-gray-500/30 hover:bg-gray-600 hover:text-white'
                                                        }`}
                                                        title={t.isFeatured ? "Unfeature" : "Feature"}
                                                    >
                                                        <Megaphone className="w-3 h-3" />
                                                    </button>
                                                    {t.status !== 'cancelled' && t.status !== 'completed' && (
                                                        <button 
                                                            onClick={() => handleCancelTournament(t)}
                                                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/30"
                                                            title="Cancel Tournament"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
    );
};


export const OrgApprovalsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-b border-gray-700 pb-2 flex items-center gap-2">
                        <Check className="text-brand-500" /> Organization Approvals
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {orgApplications.length > 0 ? (
                            orgApplications.map(app => (
                                <div key={app.id} className="bg-dark p-6 rounded-2xl border border-gray-800 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{app.orgName}</h3>
                                            <p className="text-xs text-gray-500">Applied by: {app.username}</p>
                                        </div>
                                        <span className="bg-yellow-600/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-yellow-500/30">
                                            Pending
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="bg-black/30 p-3 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 uppercase font-bold text-[9px] mb-1">WhatsApp</div>
                                            <div className="text-white">{app.whatsapp}</div>
                                        </div>
                                        <div className="bg-black/30 p-3 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 uppercase font-bold text-[9px] mb-1">Email</div>
                                            <div className="text-white truncate">{app.email}</div>
                                        </div>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded-xl border border-gray-800">
                                        <div className="text-gray-500 uppercase font-bold text-[9px] mb-1">Proof Link</div>
                                        <a href={app.proofLink} target="_blank" rel="noreferrer" className="text-brand-400 hover:text-brand-300 flex items-center gap-2 truncate">
                                            <ExternalLink className="w-3 h-3" /> {app.proofLink}
                                        </a>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => handleRejectOrg(app)} className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 rounded-xl text-xs font-bold uppercase transition-all">
                                            Reject
                                        </button>
                                        <button onClick={() => handleApproveOrg(app)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase transition-all">
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No pending applications</p>
                            </div>
                        )}
                    </div>
                </div>
    );
};


export const OrgTournamentsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Trophy className="text-brand-500" /> Organization Tournaments
                        </h2>
                        <select 
                            value={selectedOrgId}
                            onChange={(e) => fetchOrgTournaments(e.target.value)}
                            className="bg-dark border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-brand-500 outline-none"
                        >
                            <option value="">Select Organization</option>
                            {organizers.map(org => (
                                <option key={org.uid} value={org.uid}>{org.username}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orgTournaments.length > 0 ? (
                            orgTournaments.map(t => (
                                <div key={t.id} className="bg-dark p-4 rounded-xl border border-gray-800 space-y-3">
                                    <img src={t.bannerUrl || undefined} className="w-full aspect-video object-cover rounded-lg" alt={t.title} />
                                    <div>
                                        <h3 className="font-bold text-white truncate">{t.title}</h3>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">{formatGameName(t.game)}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    t.status === 'upcoming' ? 'bg-blue-600/20 text-blue-400' :
                                                    t.status === 'live' ? 'bg-green-600/20 text-green-400' :
                                                    t.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                                                    'bg-gray-600/20 text-gray-400'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleViewParticipants(t)}
                                                        className="p-1.5 bg-brand-600/20 hover:bg-brand-600 text-brand-500 hover:text-white rounded-lg transition-all border border-brand-500/30"
                                                        title="View Participants"
                                                    >
                                                        <Users className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditTournament(t)}
                                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/30"
                                                        title="Edit Tournament"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleToggleFeatured(t)}
                                                        className={`p-1.5 rounded-lg transition-all border ${
                                                            t.isFeatured 
                                                                ? 'bg-yellow-600/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-600 hover:text-white' 
                                                                : 'bg-gray-600/20 text-gray-400 border-gray-500/30 hover:bg-gray-600 hover:text-white'
                                                        }`}
                                                        title={t.isFeatured ? "Unfeature" : "Feature"}
                                                    >
                                                        <Megaphone className="w-3 h-3" />
                                                    </button>
                                                    {t.status !== 'cancelled' && t.status !== 'completed' && (
                                                        <button 
                                                            onClick={() => handleCancelTournament(t)}
                                                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/30"
                                                            title="Cancel Tournament"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : selectedOrgId ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                                <Trophy className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No tournaments found for this organization</p>
                            </div>
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                                <Users className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">Select an organization to view their tournaments</p>
                            </div>
                        )}
                    </div>
                </div>
    );
};


export const UsersTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Users className="text-brand-500" /> Manage Users
                        </h2>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input 
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-brand-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-gray-800">
                                    <th className="px-4 py-4">User</th>
                                    <th className="px-4 py-4">Role</th>
                                    <th className="px-4 py-4">Balance</th>
                                    <th className="px-4 py-4">Status</th>
                                    <th className="px-4 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {users
                                    .filter(u => 
                                        u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        u.email.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                    .map(u => (
                                    <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center border border-brand-500/30">
                                                    <Users className="text-brand-500 w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">{u.username}</div>
                                                    <div className="text-[10px] text-gray-500">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <select 
                                                value={u.role}
                                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                                                className="bg-dark border border-gray-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-brand-500"
                                            >
                                                <option value="player">Player</option>
                                                <option value="organizer">Organizer</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-mono font-bold text-white">{formatCurrency(u.balance)}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${u.isBanned ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                                                {u.isBanned ? 'Banned' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedUser(u)}
                                                    className="p-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                                    title="Manage Balance & Role"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleSuspendOrg(u.uid, !u.isBanned)}
                                                    className={`p-1.5 rounded-lg border transition-all ${
                                                        u.isBanned 
                                                            ? 'bg-green-600/20 text-green-400 border-green-500/30 hover:bg-green-600 hover:text-white' 
                                                            : 'bg-red-600/20 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white'
                                                    }`}
                                                >
                                                    {u.isBanned ? <CheckCircle className="w-3.5 h-3.5" /> : <Trash className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
    );
};


export const OrganizersTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Users className="text-brand-500" /> Manage Organizers
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {organizers.map(org => (
                            <div key={org.uid} className="bg-dark p-5 rounded-2xl border border-gray-800 space-y-4 relative overflow-hidden group">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-brand-600/20 rounded-full flex items-center justify-center border border-brand-500/30">
                                            <Users className="text-brand-500 w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{org.username}</h3>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold">{org.orgName || 'No Org Name'}</p>
                                                <span className="text-[8px] bg-brand-600/10 text-brand-400 px-1.5 py-0.5 rounded border border-brand-500/20 uppercase font-black">{org.role}</span>
                                            </div>
                                            <button
                                                onClick={() => togglePowerOrganizer(org)}
                                                className={`mt-1 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${org.isPowerOrganizer ? 'bg-green-600/20 text-green-500' : 'bg-gray-600/20 text-gray-500'}`}
                                            >
                                                {org.isPowerOrganizer ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                {org.isPowerOrganizer ? 'Power' : 'Standard'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setEditingOrg(org);
                                                setOrgEmail(org.email || '');
                                                setOrgDiscord(org.discord || '');
                                                setOrgYoutube(org.youtube || '');
                                                setOrgWhatsapp(org.whatsapp || '');
                                                setOrgNameEdit(org.orgName || '');
                                                setIsOrgEditModalOpen(true);
                                            }}
                                            className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/30"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleSuspendOrg(org.uid, !org.isBanned)}
                                            className={`p-2 rounded-xl transition-all border ${
                                                org.isBanned 
                                                    ? 'bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border-green-500/30' 
                                                    : 'bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border-red-500/30'
                                            }`}
                                        >
                                            {org.isBanned ? <CheckCircle className="w-4 h-4" /> : <Trash className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="bg-black/30 p-2 rounded-lg border border-gray-800">
                                        <div className="text-gray-600 uppercase font-bold mb-0.5">Email</div>
                                        <div className="text-gray-300 truncate">{org.email}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded-lg border border-gray-800">
                                        <div className="text-gray-600 uppercase font-bold mb-0.5">Status</div>
                                        <div className={`font-bold ${org.isBanned ? 'text-red-500' : 'text-green-500'}`}>
                                            {org.isBanned ? 'SUSPENDED' : 'ACTIVE'}
                                        </div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded-lg border border-gray-800">
                                        <div className="text-gray-600 uppercase font-bold mb-0.5">Org Wallet</div>
                                        <div className="text-brand-400 font-bold">{formatCurrency(org.orgWalletBalance || 0)}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded-lg border border-gray-800">
                                        <div className="text-gray-600 uppercase font-bold mb-0.5">Pending</div>
                                        <div className="text-yellow-500 font-bold">{formatCurrency(org.orgPendingEarnings || 0)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isOrgEditModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    Edit Organizer Details
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Organization Name</label>
                                        <input type="text" value={orgNameEdit} onChange={e => setOrgNameEdit(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Email</label>
                                        <input type="email" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">WhatsApp</label>
                                        <input type="text" value={orgWhatsapp} onChange={e => setOrgWhatsapp(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Discord</label>
                                        <input type="text" value={orgDiscord} onChange={e => setOrgDiscord(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">YouTube</label>
                                        <input type="text" value={orgYoutube} onChange={e => setOrgYoutube(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setIsOrgEditModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">Cancel</button>
                                    <button onClick={handleSaveOrgDetails} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};


export const OrgEarningsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <DollarSign className="text-brand-500" /> Org Earnings
                            </h2>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Tournament</th>
                                    <th className="p-4 font-medium">Organizer</th>
                                    <th className="p-4 font-medium">Total Prize</th>
                                    <th className="p-4 font-medium">Org Share</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {tournamentEarnings.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            No earnings records found.
                                        </td>
                                    </tr>
                                ) : (
                                    tournamentEarnings.map(earning => (
                                        <tr key={earning.id} className="hover:bg-gray-800/20 transition-colors">
                                            <td className="p-4 text-gray-300">
                                                {earning.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                                            </td>
                                            <td className="p-4 text-white font-medium">
                                                {earning.tournamentName}
                                            </td>
                                            <td className="p-4 text-gray-300">
                                                {earning.orgName}
                                            </td>
                                            <td className="p-4 text-gray-300">
                                                {formatCurrency(earning.prizePoolTotal)}
                                            </td>
                                            <td className="p-4 text-brand-400 font-bold">
                                                {formatCurrency(earning.orgShare)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    earning.status === 'released' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {earning.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {earning.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleReleaseEarnings(earning)}
                                                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                                                    >
                                                        Release
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
    );
};


export const PendingDepositsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                    <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <ArrowDown className="text-green-500" /> Pending Deposits
                                </h2>
                                <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                                    {allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').length} Pending
                                </span>
                            </div>
                            {allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').length > 0 && (
                                <button 
                                    onClick={() => {
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Bulk Approve Deposits',
                                            message: 'Are you sure you want to approve ALL pending deposits?',
                                            onConfirm: async () => {
                                                const pending = allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending');
                                                for (const t of pending) {
                                                    await handleApproveTx(t);
                                                }
                                                closeConfirmModal();
                                            }
                                        });
                                    }}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition"
                                >
                                    Bulk Approve All
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px] overflow-y-auto custom-scrollbar content-start pr-2">
                            {allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').length > 0 ? (
                                allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').map(t => (
                                    <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all shadow-md group">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-black tracking-wider text-green-400 uppercase text-xs">Deposit</span>
                                                    <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded-full text-gray-300 font-bold tracking-wider">{t.method}</span>
                                                </div>
                                                <div className="text-white font-bold text-sm">{t.username || 'Unknown User'}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">{getRelativeTime(t.timestamp)}</div>
                                            </div>
                                            <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                                        </div>
                                        <div className="text-[11px] text-gray-400 mb-5 space-y-2">
                                            <div className="bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                                <span className="text-gray-600">REF:</span> 
                                                <span className="text-brand-300 select-all">{t.refId}</span>
                                            </div>
                                            {t.accountDetails && (
                                                <div className="bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                                    <span className="text-gray-600">ACC:</span> 
                                                    <span className="text-brand-300 select-all">{t.accountDetails}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleApproveTx(t)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Check className="w-4 h-4" /> Approve
                                            </button>
                                            <button onClick={() => setSelectedTx(t)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Eye className="w-4 h-4" /> Review
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 py-20">
                                    <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-gray-800">
                                        <Check className="text-3xl text-green-500/50" />
                                    </div>
                                    <p className="font-bold uppercase tracking-widest text-sm text-gray-600">All Caught Up!</p>
                                    <p className="text-xs text-gray-700 mt-1">No pending deposits to review.</p>
                                </div>
                            )}
                        </div>
                    </div>
    );
};


export const PendingWithdrawalsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                    <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <ArrowUp className="text-red-500" /> Pending Withdrawals
                                </h2>
                                <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                                    {allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').length} Pending
                                </span>
                            </div>
                            {allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').length > 0 && (
                                <button 
                                    onClick={() => {
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Bulk Approve Withdrawals',
                                            message: 'Are you sure you want to approve ALL pending withdrawals?',
                                            onConfirm: async () => {
                                                const pending = allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending');
                                                for (const t of pending) {
                                                    await handleApproveTx(t);
                                                }
                                                closeConfirmModal();
                                            }
                                        });
                                    }}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition"
                                >
                                    Bulk Approve All
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px] overflow-y-auto custom-scrollbar content-start pr-2">
                            {allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').length > 0 ? (
                                allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').map(t => (
                                    <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all shadow-md group">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-black tracking-wider text-red-400 uppercase text-xs">Withdrawal</span>
                                                    <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded-full text-gray-300 font-bold tracking-wider">{t.method}</span>
                                                </div>
                                                <div className="text-white font-bold text-sm">{t.username || 'Unknown User'}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">{getRelativeTime(t.timestamp)}</div>
                                            </div>
                                            <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                                        </div>
                                        <div className="text-[11px] text-gray-400 mb-5 space-y-2">
                                            <div className="bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                                <span className="text-gray-600">REF:</span> 
                                                <span className="text-brand-300 select-all">{t.refId}</span>
                                            </div>
                                            {t.accountDetails && (
                                                <div className="bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                                    <span className="text-gray-600">ACC:</span> 
                                                    <span className="text-brand-300 select-all">{t.accountDetails}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleApproveTx(t)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Check className="w-4 h-4" /> Approve
                                            </button>
                                            <button onClick={() => setSelectedTx(t)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Eye className="w-4 h-4" /> Review
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 py-20">
                                    <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-gray-800">
                                        <Check className="text-3xl text-green-500/50" />
                                    </div>
                                    <p className="font-bold uppercase tracking-widest text-sm text-gray-600">All Caught Up!</p>
                                    <p className="text-xs text-gray-700 mt-1">No pending withdrawals to review.</p>
                                </div>
                            )}
                        </div>
                    </div>
    );
};


export const SubscriptionsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Subscription Plans</h2>
                        <button 
                            onClick={() => {
                                setEditingPlan(null);
                                setPlanName('');
                                setPlanPrice('');
                                setPlanDesc('');
                                setPlanFeatures('');
                                setPlanMaxTournaments('10');
                                setPlanIsActive(true);
                                setIsPlanModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Plan
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subscriptionPlans.map(plan => (
                            <div key={plan.id} className="bg-card p-6 rounded-2xl border border-gray-800 flex flex-col gap-4 relative group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                                        <div className="text-brand-400 font-bold text-2xl mt-1">{formatCurrency(plan.price)}<span className="text-xs text-gray-500">/mo</span></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setEditingPlan(plan);
                                                setPlanName(plan.name);
                                                setPlanPrice(plan.price.toString());
                                                setPlanDesc(plan.description || '');
                                                setPlanFeatures(plan.features.join(', '));
                                                setPlanMaxTournaments(plan.maxTournamentsPerMonth.toString());
                                                setPlanIsActive(plan.isActive);
                                                setIsPlanModalOpen(true);
                                            }}
                                            className="text-blue-400 hover:text-white p-2 bg-blue-600/10 rounded-lg"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeletePlan(plan.id)} className="text-red-400 hover:text-white p-2 bg-red-600/10 rounded-lg">
                                            <Trash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <p className="text-xs text-gray-400 leading-relaxed min-h-[40px]">{plan.description}</p>
                                
                                <div className="space-y-2 border-t border-gray-800 pt-4">
                                    <div className="flex items-center gap-2 text-[10px] text-gray-300">
                                        <CheckCircle className="w-3 h-3 text-brand-500" />
                                        {plan.maxTournamentsPerMonth} Tournaments / month
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-300">
                                        <CheckCircle className={`w-3 h-3 ${plan.isActive ? 'text-brand-500' : 'text-gray-600'}`} />
                                        Status: {plan.isActive ? 'ACTIVE' : 'INACTIVE'}
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Features</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {plan.features.map((f, i) => (
                                            <span key={i} className="text-[9px] bg-dark px-2 py-0.5 rounded-full border border-gray-800 text-gray-400">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isPlanModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingPlan ? 'Edit Plan' : 'Add Plan'}
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Plan Name</label>
                                            <input type="text" value={planName} onChange={e => setPlanName(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" placeholder="e.g. Pro Plan" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Monthly Price</label>
                                            <input type="number" value={planPrice} onChange={e => setPlanPrice(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" placeholder="e.g. 999" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Description</label>
                                        <textarea value={planDesc} onChange={e => setPlanDesc(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-20" placeholder="Plan details..." />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Max Tournaments / Mo</label>
                                        <input type="number" value={planMaxTournaments} onChange={e => setPlanMaxTournaments(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Features (Comma separated)</label>
                                        <textarea value={planFeatures} onChange={e => setPlanFeatures(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-24" placeholder="Feature 1, Feature 2..." />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <label className="flex items-center gap-3 cursor-pointer bg-dark/50 p-3 rounded-xl border border-gray-800">
                                            <input type="checkbox" checked={planIsActive} onChange={e => setPlanIsActive(e.target.checked)} className="accent-brand-500 w-4 h-4" />
                                            <span className="text-xs text-gray-300 font-bold uppercase">Is Active</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setIsPlanModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">Cancel</button>
                                    <button onClick={handleSavePlan} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition">Save Plan</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};


export const GamesTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Game Management</h2>
                        <button 
                            onClick={() => {
                                setEditingGame(null);
                                setGameName('');
                                setGameLogo('');
                                setGameModes('');
                                setIsPublished(true);
                                setIsGameModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Game
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {games.map(game => (
                            <div key={game.id} className="bg-card p-4 rounded-xl border border-gray-800 flex items-center gap-4">
                                <img src={game.logoUrl || undefined} className="w-16 h-16 object-cover rounded-lg border border-gray-700" alt={formatGameName(game.name)} />
                                <div className="flex-grow">
                                    <h3 className="font-bold text-white">{formatGameName(game.name)}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${game.isPublished ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">{game.isPublished ? 'Published' : 'Draft'}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 truncate w-32">
                                        {game.modes.join(', ')}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => openEditGame(game)} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteGame(game.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isGameModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingGame ? 'Edit Game' : 'Add Game'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Game Name</label>
                                        <input 
                                            type="text" 
                                            value={gameName}
                                            onChange={(e) => setGameName(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                            placeholder="e.g. PUBG Mobile"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Logo/Banner (Paste, Drop or Click to Select)</label>
                                        <div 
                                            onPaste={handlePasteGame}
                                            onDrop={handleDropGame}
                                            onDragOver={handleDragOverGame}
                                            onClick={() => document.getElementById('game-logo-file-input')?.click()}
                                            className={`relative w-full aspect-video rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={gameLogo || DEFAULT_BANNER || undefined} 
                                                        alt="Game Logo Preview" 
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            id="game-logo-file-input"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    processAndUploadGame(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="mt-2">
                                            <input 
                                                type="text" 
                                                value={gameLogo}
                                                onChange={(e) => setGameLogo(e.target.value)}
                                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-sm"
                                                placeholder="Or paste image URL..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Game Modes (Comma separated)</label>
                                        <textarea 
                                            value={gameModes}
                                            onChange={(e) => setGameModes(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-24"
                                            placeholder="Battle Royale, Ranked, Arcade..."
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="isPublished"
                                            checked={isPublished}
                                            onChange={(e) => setIsPublished(e.target.checked)}
                                            className="w-4 h-4 accent-brand-500"
                                        />
                                        <label htmlFor="isPublished" className="text-sm text-gray-300 font-bold uppercase">Published (Visible to users)</label>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button 
                                        onClick={() => setIsGameModalOpen(false)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSaveGame}
                                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        {editingGame ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};


export const PaymentsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="space-y-12">
                    {/* Payment Categories Section */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Payment Categories</h2>
                            <button 
                                onClick={() => {
                                    setEditingCategory(null);
                                    setCategoryName('');
                                    setCategoryDescription('');
                                    setCategoryActive(true);
                                    setIsCategoryModalOpen(true);
                                }}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Add Category
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paymentCategories.map(cat => (
                                <div key={cat.id} className="bg-card p-4 rounded-xl border border-gray-800 flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-white">{cat.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`w-2 h-2 rounded-full ${cat.isActive ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                                <span className="text-[10px] text-gray-500 uppercase font-bold">{cat.isActive ? 'Active' : 'Inactive'}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => {
                                                setEditingCategory(cat);
                                                setCategoryName(cat.name);
                                                setCategoryDescription(cat.description);
                                                setCategoryActive(cat.isActive);
                                                setIsCategoryModalOpen(true);
                                            }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-500 bg-dark p-2 rounded border border-gray-700 h-16 overflow-y-auto">
                                        {cat.description || 'No description'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment Methods Section */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Payment Methods (QR Codes)</h2>
                            <button 
                                onClick={() => {
                                    setEditingPayment(null);
                                    setPaymentName('');
                                    setPaymentCategoryId('');
                                    setPaymentQr('');
                                    setPaymentInstructions('');
                                    setPaymentType('eSewa');
                                    setPaymentActive(true);
                                    setIsPaymentModalOpen(true);
                                }}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Add Method
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paymentMethods.map(pm => {
                                const category = paymentCategories.find(c => c.id === pm.categoryId);
                                return (
                                <div key={pm.id} className="bg-card p-4 rounded-xl border border-gray-800 flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-dark rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                                            <img src={pm.qrUrl || undefined} className="w-full h-full object-contain" alt="QR" />
                                        </div>
                                        <div className="flex-grow">
                                            <h3 className="font-bold text-white">{pm.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`w-2 h-2 rounded-full ${pm.isActive ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                                <span className="text-[10px] text-gray-500 uppercase font-bold">{category ? category.name : pm.type} | {pm.isActive ? 'Active' : 'Inactive'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => {
                                                setEditingPayment(pm);
                                                setPaymentName(pm.name);
                                                setPaymentCategoryId(pm.categoryId || '');
                                                setPaymentQr(pm.qrUrl);
                                                setPaymentInstructions(pm.instructions);
                                                setPaymentType(pm.type);
                                                setPaymentActive(pm.isActive);
                                                setIsPaymentModalOpen(true);
                                            }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeletePayment(pm.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-500 bg-dark p-2 rounded border border-gray-700 h-16 overflow-y-auto">
                                        {pm.instructions}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>

                    {isCategoryModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-lg rounded-2xl border border-gray-800 p-8 space-y-6 shadow-2xl">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingCategory ? 'Edit Category' : 'Add Category'}
                                </h3>
                                
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Category Name</label>
                                        <input 
                                            type="text" 
                                            value={categoryName}
                                            onChange={(e) => setCategoryName(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                                            placeholder="e.g. E-Wallet, Bank Transfer"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Description</label>
                                        <textarea 
                                            value={categoryDescription}
                                            onChange={(e) => setCategoryDescription(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition h-24 resize-none"
                                            placeholder="Description of this category..."
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="catActive"
                                            checked={categoryActive}
                                            onChange={(e) => setCategoryActive(e.target.checked)}
                                            className="w-4 h-4 rounded bg-dark border-gray-700 text-brand-500 focus:ring-brand-500"
                                        />
                                        <label htmlFor="catActive" className="text-sm text-white font-bold">Active (Visible to users)</label>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-gray-800">
                                    <button 
                                        onClick={() => setIsCategoryModalOpen(false)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSaveCategory}
                                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        {editingCategory ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isPaymentModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-lg rounded-2xl border border-gray-800 p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingPayment ? 'Edit Payment Method' : 'Add Payment Method'}
                                </h3>
                                
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Category</label>
                                        <select 
                                            value={paymentCategoryId}
                                            onChange={(e) => setPaymentCategoryId(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                                        >
                                            <option value="">Select a category</option>
                                            {paymentCategories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Method Name</label>
                                        <input 
                                            type="text" 
                                            value={paymentName}
                                            onChange={(e) => setPaymentName(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                                            placeholder="e.g. eSewa (Personal)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">QR Code Image (Paste, Drop or Click to Select)</label>
                                        <div 
                                            onPaste={handlePastePayment}
                                            onDrop={handleDropPayment}
                                            onDragOver={handleDragOverPayment}
                                            onClick={() => document.getElementById('payment-qr-file-input')?.click()}
                                            className={`relative w-48 h-48 mx-auto rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={paymentQr || NEXPLAY_LOGO || undefined} 
                                                        alt="QR Preview" 
                                                        className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            id="payment-qr-file-input"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    processAndUploadPayment(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="mt-3">
                                            <input 
                                                type="text" 
                                                value={paymentQr}
                                                onChange={(e) => setPaymentQr(e.target.value)}
                                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-sm transition"
                                                placeholder="Or paste QR URL..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Instructions (Account Name, Number, etc.)</label>
                                        <textarea 
                                            value={paymentInstructions}
                                            onChange={(e) => setPaymentInstructions(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-24 transition"
                                            placeholder="Account Name: John Doe&#10;Number: 98XXXXXXXX"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                                        <input 
                                            type="checkbox" 
                                            id="paymentActive"
                                            checked={paymentActive}
                                            onChange={(e) => setPaymentActive(e.target.checked)}
                                            className="w-5 h-5 accent-brand-500 cursor-pointer"
                                        />
                                        <label htmlFor="paymentActive" className="text-sm text-gray-300 font-bold uppercase cursor-pointer">Active (Visible to users)</label>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <button 
                                        onClick={() => setIsPaymentModalOpen(false)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSavePayment}
                                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        {editingPayment ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};


export const PromoTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Promo Codes</h2>
                        <button 
                            onClick={() => {
                                setEditingPromo(null);
                                setPromoCode('');
                                setPromoAmount('');
                                setPromoMaxUses('');
                                setPromoActive(true);
                                setIsPromoModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Promo
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {promoCodes.map(p => (
                            <div key={p.id} className="bg-card p-4 rounded-xl border border-gray-800">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xl font-black text-brand-400 tracking-tighter">{p.code}</div>
                                        <div className="text-xs text-gray-500 font-bold uppercase">{p.isActive ? 'Active' : 'Inactive'}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            setEditingPromo(p);
                                            setPromoCode(p.code);
                                            setPromoAmount(p.amount.toString());
                                            setPromoMaxUses(p.maxUses.toString());
                                            setPromoActive(p.isActive);
                                            setIsPromoModalOpen(true);
                                        }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeletePromo(p.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="bg-dark p-2 rounded border border-gray-700">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold">Amount</div>
                                        <div className="text-sm text-white font-bold">{formatCurrency(p.amount)}</div>
                                    </div>
                                    <div className="bg-dark p-2 rounded border border-gray-700">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold">Uses</div>
                                        <div className="text-sm text-white font-bold">{p.currentUses} / {p.maxUses}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isPromoModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingPromo ? 'Edit Promo Code' : 'Add Promo Code'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Code</label>
                                        <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none uppercase" placeholder="WELCOME50" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Amount</label>
                                        <input type="number" value={promoAmount} onChange={e => setPromoAmount(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Max Uses</label>
                                        <input type="number" value={promoMaxUses} onChange={e => setPromoMaxUses(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="promoActive" checked={promoActive} onChange={e => setPromoActive(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                                        <label htmlFor="promoActive" className="text-sm text-gray-300 font-bold uppercase">Active</label>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setIsPromoModalOpen(false)} className="flex-1 bg-gray-800 py-3 rounded-xl font-bold">Cancel</button>
                                    <button onClick={handleSavePromo} className="flex-1 bg-brand-600 py-3 rounded-xl font-bold">Save</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};


export const MediaTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-8 animate-fade-in">
                    <div className="border-b border-gray-700 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon className="text-brand-500" /> Media Library Assets
                            </h2>
                            <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Securely browse and manage image assets uploaded through ImgBB proxy.</p>
                        </div>
                        <button
                            onClick={fetchMedia}
                            disabled={mediaLoading}
                            className="bg-gray-800 hover:bg-gray-750 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
                        >
                            <RefreshCw className={`w-4 h-4 ${mediaLoading ? 'animate-spin' : ''}`} />
                            Refresh Library
                        </button>
                    </div>

                    {/* Uploder catalog registration box */}
                    <div className="bg-dark/40 p-5 rounded-xl border border-gray-800/80 space-y-4">
                        <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest pl-3 border-l-2 border-brand-500">Quick Upload to Library</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-wider">Asset Category Group</label>
                                <select
                                    value={selectedMediaCategory}
                                    onChange={(e) => setSelectedMediaCategory(e.target.value as MediaCategory)}
                                    className="w-full bg-surface border border-gray-700 rounded-lg p-3 text-white text-xs font-bold uppercase tracking-wider focus:border-brand-500 outline-none"
                                >
                                    {Object.values(MediaCategory).map((cat: string) => (
                                        <option key={cat} value={cat}>
                                            {cat.replace("_", " ")}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <ImageUploader
                                    category={selectedMediaCategory}
                                    value={mockUploadUrl}
                                    onChange={(url) => {
                                        setMockUploadUrl(url);
                                        if (url) {
                                            showToast("Asset successfully uploaded and registered in library!", "success");
                                            fetchMedia();
                                            setMockUploadUrl(""); // reset uploader slot
                                        }
                                    }}
                                    aspectRatio="video"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filter and Search controls */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-2 border-b border-gray-800">
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setMediaFilter("ALL")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                                    mediaFilter === "ALL"
                                        ? "bg-brand-500 text-white"
                                        : "bg-gray-800/80 text-gray-400 hover:bg-gray-800 hover:text-white"
                                }`}
                            >
                                All Assets
                            </button>
                            {Object.values(MediaCategory).map((cat: string) => {
                                // check if we have items of this type
                                const count = mediaItems.filter(item => item.category === cat).length;
                                if (count === 0 && cat !== MediaCategory.OTHER) return null;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setMediaFilter(cat)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                                            mediaFilter === cat
                                                ? "bg-brand-500 text-white"
                                                : "bg-gray-800/85 text-gray-400 hover:bg-gray-800 hover:text-white"
                                        }`}
                                    >
                                        {cat.replace("_", " ")} <span className="opacity-60">({count})</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search keyword input */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input
                                type="text"
                                value={mediaSearch}
                                onChange={(e) => setMediaSearch(e.target.value)}
                                placeholder="Search by asset name..."
                                className="w-full bg-dark/70 border border-gray-700/80 rounded-lg py-2.5 pl-10 pr-4 text-xs text-white focus:border-brand-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Assets Grid */}
                    {mediaLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 space-y-3">
                            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest animate-pulse">Scanning Media Catalog...</p>
                        </div>
                    ) : (
                        (() => {
                            const filtered = mediaItems.filter((item) => {
                                const matchesFilter = mediaFilter === "ALL" || item.category === mediaFilter;
                                const matchesSearch =
                                    !mediaSearch ||
                                    (item.fileName && item.fileName.toLowerCase().includes(mediaSearch.toLowerCase())) ||
                                    (item.url && item.url.toLowerCase().includes(mediaSearch.toLowerCase()));
                                return matchesFilter && matchesSearch;
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="bg-dark/10 border border-dashed border-gray-800 rounded-xl p-12 text-center text-gray-500">
                                        <ImageIcon className="w-12 h-12 mx-auto text-gray-700 mb-3" />
                                        <p className="text-sm font-bold uppercase tracking-wider text-gray-400">No media assets found</p>
                                        <p className="text-xs uppercase text-gray-600 mt-1 font-semibold">Try changing your filter settings or upload a new asset above.</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {filtered.map((item) => (
                                        <div key={item.id} className="group bg-dark/60 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition duration-150 flex flex-col pt-0 pb-0">
                                            <div className="relative aspect-video bg-slate-950 overflow-hidden border-b border-gray-850">
                                                <img
                                                    src={item.url}
                                                    alt={item.fileName || "Media Asset"}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    referrerPolicy="no-referrer"
                                                />
                                                <div className="absolute top-2 left-2 bg-black/75 px-2.5 py-1 rounded text-[9px] font-bold text-brand-400 uppercase tracking-wider border border-brand-500/10">
                                                    {item.category ? item.category.replace("_", " ") : "OTHER"}
                                                </div>
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-lg bg-gray-850 text-white hover:bg-amber-500 hover:text-black transition shadow"
                                                        title="Open direct image link"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(item.url);
                                                            showToast("Direct link copied to clipboard!", "success");
                                                        }}
                                                        className="p-2 rounded-lg bg-gray-850 text-white hover:bg-brand-500 hover:text-white transition shadow text-xs font-bold uppercase"
                                                        title="Copy URL link"
                                                    >
                                                        Copy URL
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-3 flex-1 flex flex-col justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-200 truncate" title={item.fileName}>
                                                        {item.fileName || "unnamed_asset"}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                                                        {(item.fileSize / 1024).toFixed(1)} KB • {item.mimeType?.replace("image/", "") || "IMG"}
                                                    </p>
                                                </div>
                                                <div className="mt-3 pt-2.5 border-t border-gray-850 flex items-center justify-between text-[10px]">
                                                    <span className="text-gray-600 font-bold uppercase">{getRelativeTime(item.createdAt)}</span>
                                                    <button
                                                        onClick={() => handleDeleteMedia(item.id, item.url, item.publicId || item.public_id)}
                                                        className="text-rose-500 hover:text-rose-400 flex items-center gap-1 font-bold uppercase"
                                                        title="Delete reference"
                                                    >
                                                        <Trash className="w-3 h-3" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </div>
    );
};


export const SettingsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, ImageUploader, MediaCategory, NEXPLAY_LOGO, activeTab, activityLogs, allTournaments, allTransactions, categoryActive, categoryDescription, categoryName, closeConfirmModal, editingCategory, editingGame, editingPayment, editingPlan, editingPromo, editingSlide, executeRejectTx, fetchMedia, fetchOrgTournaments, formatCurrency, formatDate, formatGameName, gameLogo, gameModes, gameName, games, getRelativeTime, handleApproveOrg, handleApproveTx, handleCancelTournament, handleDeleteCategory, handleDeleteGame, handleDeleteMedia, handleDeletePayment, handleDeletePlan, handleDeletePromo, handleDeleteSlide, handleEditTournament, handleRejectOrg, handleReleaseEarnings, handleSaveCategory, handleSaveGame, handleSaveOrgDetails, handleSavePayment, handleSavePlan, handleSavePromo, handleSaveSettings, handleSaveSlide, handleSuspendOrg, handleToggleFeatured, handleUpdateUserRole, handleViewParticipants, isCategoryModalOpen, isGameModalOpen, isNoticeActive, isOrgEditModalOpen, isPaymentModalOpen, isPlanModalOpen, isPromoModalOpen, isPublished, isSlideModalOpen, maintenanceMode, mediaFilter, mediaItems, mediaLoading, mediaSearch, minWithdrawal, mockUploadUrl, notice, openEditGame, orgApplications, orgDiscord, orgEmail, orgFormDescription, orgNameEdit, orgTournaments, orgWhatsapp, orgYoutube, organizers, paymentActive, paymentCategories, paymentCategoryId, paymentInstructions, paymentMethods, paymentName, pendingTransactions, planDesc, planFeatures, planIsActive, planMaxTournaments, planName, planPrice, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, searchQuery, selectedMediaCategory, selectedOrgId, setCategoryActive, setCategoryDescription, setCategoryName, setEditingCategory, setEditingGame, setEditingPayment, setEditingPlan, setEditingPromo, setEditingSlide, setGameLogo, setGameModes, setGameName, setIsCategoryModalOpen, setIsGameModalOpen, setIsNoticeActive, setIsOrgEditModalOpen, setIsPaymentModalOpen, setIsPlanModalOpen, setIsPromoModalOpen, setIsPublished, setIsSlideModalOpen, setMaintenanceMode, setMediaFilter, setMediaSearch, setMinWithdrawal, setMockUploadUrl, setNotice, setOrgDiscord, setOrgEmail, setOrgFormDescription, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, setPaymentActive, setPaymentCategoryId, setPaymentInstructions, setPaymentName, setPaymentQr, setPlanDesc, setPlanFeatures, setPlanIsActive, setPlanMaxTournaments, setPlanName, setPlanPrice, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses, setSearchQuery, setSelectedMediaCategory, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, setSupportEmail, setSupportPhone, showToast, siteSettings, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, subscriptionPlans, supportEmail, supportPhone, toggleOrgForm, togglePowerOrganizer, tournamentEarnings, uploading, users, setConfirmModal, setSelectedTx, setSelectedUser, setEditingOrg, setPaymentType, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, handlePastePayment, handleDropPayment, handleDragOverPayment, processAndUploadPayment , paymentQr } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-8">
                    <div className="border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Settings className="text-brand-500" /> Site Configuration
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Manage global application settings and support info.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Financial Settings</h3>
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Minimum Withdrawal Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                                    <input 
                                        type="number" 
                                        value={minWithdrawal}
                                        onChange={e => setMinWithdrawal(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-brand-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Support Info</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Email</label>
                                    <input 
                                        type="email" 
                                        value={supportEmail}
                                        onChange={e => setSupportEmail(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Phone / WhatsApp</label>
                                    <input 
                                        type="text" 
                                        value={supportPhone}
                                        onChange={e => setSupportPhone(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-full space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Maintenance</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="text-red-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Maintenance Mode</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">When enabled, the entire website will be disabled for normal users. Only Admins can access the site.</p>
                            </div>

                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">System Notice</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Megaphone className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Display Site-wide Notice</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={isNoticeActive} onChange={e => setIsNoticeActive(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <textarea 
                                    value={notice}
                                    onChange={e => setNotice(e.target.value)}
                                    className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 outline-none h-32"
                                    placeholder="Enter notice message here... (e.g. Scheduled maintenance at 10 PM)"
                                />
                            </div>

                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3 pt-4">Organizer Settings</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Open Organizer Applications</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={siteSettings?.isOrgFormOpen || false} onChange={toggleOrgForm} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Toggle whether users can apply to become an organization from the contact page.</p>
                                
                                <div className="pt-4 border-t border-gray-800">
                                    <label className="text-[10px] text-gray-500 uppercase font-black mb-2 block tracking-widest">Organizer Form Description</label>
                                    <textarea 
                                        value={orgFormDescription}
                                        onChange={e => setOrgFormDescription(e.target.value)}
                                        className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 outline-none h-32 text-sm"
                                        placeholder="Explain the requirements for becoming an organizer..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-800 flex justify-end">
                        <button 
                            onClick={handleSaveSettings}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-10 py-3 rounded-xl font-bold transition shadow-lg shadow-brand-600/20 uppercase tracking-widest"
                        >
                            Save All Settings
                        </button>
                    </div>
                </div>
    );
};

