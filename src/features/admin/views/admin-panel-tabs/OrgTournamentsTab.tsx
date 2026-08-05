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
