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
