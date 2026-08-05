import React from 'react';
import {
    Users, ArrowDown, ArrowUp, Settings, Gift, Layout, Check, X, Download, Search, 
    Trash, Edit, Upload, Image as ImageIcon, CreditCard, Eye, QrCode, Plus, Bell, 
    Megaphone, Trophy, Gamepad2, Tag, Sliders, Info, ExternalLink, CheckCircle, 
    DollarSign, AlertTriangle, RefreshCw, Send
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, setDoc, serverTimestamp, increment, getDoc, writeBatch, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../shared/config/firebase';
import { formatCurrency, formatDate, formatGameName } from '../../../../shared/utils/utils';
import { ImageUploader } from '../../../../shared/components/ImageUploader';
import { MediaCategory, deleteImage } from '../../../../shared/services/mediaService';
import { DEFAULT_BANNER, NEXPLAY_LOGO } from '../../../../shared/constants/constants';
import { useInvisibleImage } from '../../../../shared/hooks/useInvisibleImage';

import { AdminPanelTabProps } from './types';

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
