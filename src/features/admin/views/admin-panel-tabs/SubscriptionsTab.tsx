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
