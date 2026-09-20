import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, writeBatch, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { updateEmail, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { formatCurrency, formatDate, calculateLevel, getLevelProgress, getXPForNextLevel } from '../../../shared/utils/utils';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import Modal from '../../../shared/components/Modal';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { MediaCategory } from '../../../shared/services/mediaService';
import { DEFAULT_AVATAR, NEXPLAY_LOGO, PRESET_AVATARS, PRESET_PLAYER_BANNERS } from '../../../shared/constants/constants';
import { User, Mail, Phone, Shield, Trophy, Wallet as WalletIcon, Save, Info, Briefcase, Users, Hash, Clock, ArrowDown, ArrowUp, Copy, CheckCircle2, Image as ImageIcon, Settings as SettingsIcon, X, BellRing, Smartphone } from 'lucide-react';
import { Transaction } from '../../../shared/types/types';
import { useSiteSettings } from '../../../shared/context/SiteSettingsContext';
import { Seo } from '../../../shared/components/Seo';
import { isPushSupported, getPushPermissionState, requestPushPermissionAndToken, unregisterPushToken, sendTestPushNotification } from '../../../shared/services/pushNotificationService';

const Profile: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { showToast } = useNotification();

    const [activeTab, setActiveTab] = useState<'settings' | 'activity'>('settings');
    const [recentActivity, setRecentActivity] = useState<Transaction[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    const [inGameId, setInGameId] = useState(profile?.inGameId || '');
    const [inGameName, setInGameName] = useState(profile?.inGameName || '');
    const [teamName, setTeamName] = useState(profile?.teamName || '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [skills, setSkills] = useState<string>(profile?.skills?.join(', ') || '');
    const [status, setStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>(profile?.status || 'online');
    const [customActivity, setCustomActivity] = useState(profile?.customActivity || '');
    const [orgName, setOrgName] = useState(profile?.orgName || '');
    const [orgWhatsapp, setOrgWhatsapp] = useState(profile?.whatsapp || '');
    const [orgDiscord, setOrgDiscord] = useState(profile?.discord || '');
    const [orgYoutube, setOrgYoutube] = useState(profile?.youtube || '');
    const [orgEmail, setOrgEmail] = useState(profile?.email || '');
    const [orgProofLink, setOrgProofLink] = useState('');
    const [isApplying, setIsApplying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [showBannerPresetModal, setShowBannerPresetModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
    const [pushPermission, setPushPermission] = useState(getPushPermissionState());
    const [isTogglingPush, setIsTogglingPush] = useState(false);
    const [isSendingTestPush, setIsSendingTestPush] = useState(false);
    const { settings: siteSettings } = useSiteSettings();

    const { handlePaste, handleDrop, handleDragOver, processAndUpload } = useInvisibleImage({
        folder: `profiles/${user?.uid}`,
        category: MediaCategory.USER_AVATAR,
        onUploadStart: () => {
            setIsUploading(true);
        },
        onUploadEnd: () => setIsUploading(false),
        onUploadSuccess: async (url) => {
            if (!user) return;
            try {
                const batch = writeBatch(db);
                batch.update(doc(db, 'users', user.uid), {
                    profilePicUrl: url
                });
                batch.set(doc(db, 'users_public', user.uid), {
                    profilePicUrl: url,
                    updatedAt: serverTimestamp()
                }, { merge: true });
                await batch.commit();
                showToast('Profile picture updated!', 'success');
            } catch (err: any) {
                showToast('Error updating profile picture', 'error');
            }
        }
    });

    useEffect(() => {
        if (profile) {
            setInGameId(profile.inGameId || '');
            setInGameName(profile.inGameName || '');
            setTeamName(profile.teamName || '');
            setPhone(profile.phone || '');
            setBio(profile.bio || '');
            setSkills(profile.skills?.join(', ') || '');
            setStatus(profile.status || 'online');
            setCustomActivity(profile.customActivity || '');
            setOrgName(profile.orgName || '');
            setOrgWhatsapp(profile.whatsapp || '');
            setOrgDiscord(profile.discord || '');
            setOrgYoutube(profile.youtube || '');
            setOrgEmail(profile.email || '');
        }
    }, [profile]);

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

    useEffect(() => {
        if (user) {
            const fetchFollowCounts = async () => {
                try {
                    const followersQ = query(collection(db, 'follows'), where('followingId', '==', user.uid));
                    const followersSnap = await getDocs(followersQ);
                    setFollowerCount(followersSnap.size);

                    const followingQ = query(collection(db, 'follows'), where('followerId', '==', user.uid));
                    const followingSnap = await getDocs(followingQ);
                    setFollowingCount(followingSnap.size);
                } catch (error) {
                    console.error("Error fetching follow counts:", error);
                }
            };
            fetchFollowCounts();
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'activity' && user) {
            const fetchActivity = async () => {
                setLoadingActivity(true);
                try {
                    const q = query(
                        collection(db, 'transactions'),
                        where('userId', '==', user.uid),
                        orderBy('timestamp', 'desc'),
                        limit(10)
                    );
                    const snap = await getDocs(q);
                    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
                    setRecentActivity(txs);
                } catch (error: any) {
                    console.error("Error fetching activity:", error);
                } finally {
                    setLoadingActivity(false);
                }
            };
            fetchActivity();
        }
    }, [activeTab, user]);

    if (!profile) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Profile...</p>
        </div>
    );

    const isUidLocked = profile.inGameId && profile.inGameId.trim().length > 0;

    const handleSave = async () => {
        if (!user) return;

        if (!inGameId.trim() || !inGameName.trim() || !phone.trim()) {
            showToast('In-Game ID, In-Game Name, and Phone Number are required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const updateData: any = {
                inGameId: inGameId.trim(),
                inGameName: inGameName.trim(),
                teamName: teamName.trim(),
                phone: phone.trim(),
                bio: bio.trim(),
                skills: skills.split(',').map(s => s.trim()).filter(s => s),
                status: status,
                customActivity: customActivity.trim(),
                updatedAt: serverTimestamp()
            };

            if (profile?.role === 'organizer') {
                updateData.orgName = orgName.trim() || null;
                updateData.whatsapp = orgWhatsapp.trim() || null;
                updateData.discord = orgDiscord.trim() || null;
                updateData.youtube = orgYoutube.trim() || null;
            }

            const batch = writeBatch(db);
            const userRef = doc(db, 'users', user.uid);
            const publicRef = doc(db, 'users_public', user.uid);

            batch.update(userRef, updateData);

            batch.set(publicRef, {
                inGameId: inGameId.trim(),
                inGameName: inGameName.trim(),
                username: profile.username,
                profilePicUrl: profile.profilePicUrl || '',
                skills: skills.split(',').map(s => s.trim()).filter(s => s),
                status: status,
                customActivity: customActivity.trim(),
                orgName: profile?.role === 'organizer' ? (orgName.trim() || null) : null,
                updatedAt: serverTimestamp()
            }, { merge: true });

            await batch.commit();
            showToast('Profile updated!', 'success');
            setShowSettingsModal(false);
        } catch (error: any) {
            console.error("Error updating profile:", error);
            showToast(`Error saving profile (${error?.code || 'unknown'})`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOrgApply = async () => {
        if (!user || !orgName || !orgWhatsapp || !orgEmail || !orgProofLink) {
            return showToast('Please fill all fields', 'error');
        }
        
        setIsApplying(true);
        try {
            const batch = writeBatch(db);
            
            // 1. Create Application Record
            const appRef = doc(collection(db, 'orgApplications'));
            batch.set(appRef, {
                userId: user.uid,
                username: profile?.username || 'User',
                name: profile?.username || 'User',
                orgName: orgName,
                whatsapp: orgWhatsapp,
                email: orgEmail,
                proofLink: orgProofLink,
                status: 'pending',
                timestamp: serverTimestamp()
            });

            // 2. Update User Status
            batch.update(doc(db, 'users', user.uid), {
                orgStatus: 'pending'
            });

            await batch.commit();
            showToast('Application sent! Admin will review your request.', 'success');
            
            // Reset form
            setOrgName('');
            setOrgWhatsapp('');
            setOrgProofLink('');
        } catch (error: any) {
            console.error("Error applying for organizer:", error);
            showToast('Failed to send application', 'error');
        } finally {
            setIsApplying(false);
        }
    };

    const handleCopyId = () => {
        if (user?.uid) {
            navigator.clipboard.writeText(user.uid);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
            showToast('User ID copied to clipboard', 'success');
        }
    };

    const handleUpdateEmail = async () => {
        if (!auth.currentUser || !newEmail) return;
        setIsUpdatingEmail(true);
        try {
            await updateEmail(auth.currentUser, newEmail);
            await updateDoc(doc(db, 'users', user!.uid), { email: newEmail });
            showToast('Email updated successfully!', 'success');
            setNewEmail('');
        } catch (error: any) {
            console.error("Error updating email:", error);
            const errMsg = error.message || 'Failed to update email';
            if (error.code === 'auth/requires-recent-login') {
                showToast('Please log out and log back in to change your email.', 'error');
            } else {
                showToast(errMsg, 'error');
            }
        } finally {
            setIsUpdatingEmail(false);
        }
    };

    const handleAvatarSelect = async (url: string) => {
        if (!user) return;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'users', user.uid), {
                profilePicUrl: url
            });
            batch.set(doc(db, 'users_public', user.uid), {
                profilePicUrl: url,
                updatedAt: serverTimestamp()
            }, { merge: true });
            await batch.commit();
            setShowPresetModal(false);
            showToast('Avatar updated!', 'success');
        } catch (error: any) {
            console.error("Error updating avatar:", error);
            showToast('Failed to update avatar', 'error');
        }
    };

    const handleTogglePush = async () => {
        if (!user) return;
        setIsTogglingPush(true);
        try {
            if (pushPermission === 'granted') {
                await unregisterPushToken(user.uid);
                setPushPermission('default');
                showToast('Push notifications disabled on this device.', 'info');
            } else {
                const res = await requestPushPermissionAndToken(user.uid);
                if (res.success) {
                    setPushPermission('granted');
                    showToast('Push notifications enabled! You will receive live match and event alerts.', 'success');
                } else if (res.reason === 'denied') {
                    setPushPermission('denied');
                    showToast('Notifications are blocked in browser settings.', 'warning');
                } else {
                    showToast('Could not enable push notifications.', 'error');
                }
            }
        } catch (e: any) {
            showToast('Error updating notification preferences', 'error');
        } finally {
            setIsTogglingPush(false);
        }
    };

    const handleTestPush = async () => {
        setIsSendingTestPush(true);
        try {
            const res = await sendTestPushNotification();
            if (res.success) {
                showToast('Test push notification sent! Check your device.', 'success');
            } else {
                showToast(res.message, 'error');
            }
        } catch (e: any) {
            showToast('Failed to send test push notification', 'error');
        } finally {
            setIsSendingTestPush(false);
        }
    };

    const handleBannerSelect = async (url: string) => {
        if (!user) return;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'users', user.uid), {
                bannerUrl: url
            });
            batch.set(doc(db, 'users_public', user.uid), {
                bannerUrl: url,
                updatedAt: serverTimestamp()
            }, { merge: true });
            await batch.commit();
            setShowBannerPresetModal(false);
            showToast('Banner updated!', 'success');
        } catch (error: any) {
            console.error("Error updating banner:", error);
            showToast('Failed to update banner', 'error');
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-20 px-2.5 sm:px-4 md:px-6">
            <Seo title="Profile | NexPlay" description="Your profile settings" noindex />

            {/* Header Card */}
            <div 
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="bg-[#0e1424] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl mb-6 relative group"
            >
                <button type="button" 
                    onClick={() => setShowSettingsModal(true)}
                    className="absolute top-3.5 right-3.5 p-2 bg-slate-900/80 hover:bg-slate-800 rounded-full border border-slate-700/80 transition text-slate-300 hover:text-white z-20 backdrop-blur-sm shadow-md"
                    title="Settings"
                >
                    <SettingsIcon className="w-4 h-4" />
                </button>
                <div 
                    className="h-32 sm:h-40 bg-gradient-to-r from-gray-900 via-indigo-950 to-black relative bg-cover bg-center"
                    style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : {}}
                >
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                    <button type="button" 
                        onClick={() => setShowBannerPresetModal(true)}
                        className="absolute bottom-3 right-3 px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition text-slate-300 hover:text-white z-20 backdrop-blur-sm shadow-md flex items-center gap-1.5 text-xs font-semibold"
                        title="Change Banner"
                    >
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                        <span className="hidden xs:inline text-[10px] uppercase font-bold tracking-wider">Banner</span>
                    </button>
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-black uppercase tracking-widest text-white">Processing Image...</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-4 sm:px-8 pb-6 relative">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-16 relative z-10 text-center md:text-left">
                        {/* Avatar */}
                        <div className="relative group flex flex-col items-center gap-2 shrink-0">
                            <div 
                                onClick={() => document.getElementById('profile-avatar-file-input')?.click()}
                                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl border-4 border-[#0e1424] bg-slate-900 overflow-hidden shadow-2xl relative cursor-pointer hover:border-purple-500 transition-colors shadow-purple-950/50"
                            >
                                <img 
                                    src={profile.profilePicUrl || DEFAULT_AVATAR || undefined} 
                                    alt={profile.username} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                    referrerPolicy="no-referrer" loading="lazy" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white text-center px-2">Update</span>
                                </div>
                            </div>
                            <input 
                                id="profile-avatar-file-input"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        processAndUpload(e.target.files[0]);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPresetModal(true)}
                                className="text-[10px] font-bold uppercase tracking-wider text-purple-300 hover:text-white transition bg-purple-950/60 hover:bg-purple-900/60 px-3 py-1 rounded-full border border-purple-500/40 flex items-center gap-1.5 shadow-sm"
                            >
                                <ImageIcon className="w-3 h-3 text-purple-400" /> Change Avatar
                            </button>
                        </div>

                        {/* Player Metadata */}
                        <div className="flex-grow pb-1 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                                        <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight break-words">{profile.username}</h2>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/50 text-[10px] font-bold tracking-wider text-purple-300 uppercase">
                                            <Shield className="w-3 h-3 text-purple-400" /> {profile.role}
                                        </span>
                                    </div>

                                    {/* Sleek ID bar */}
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                        <div className="inline-flex items-center gap-2 bg-[#080d18] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-400">
                                            <span className="text-slate-500 font-bold uppercase text-[10px]">ID:</span>
                                            <span className="font-mono text-slate-300 text-xs truncate max-w-[200px] sm:max-w-[260px]">{user?.uid}</span>
                                            <button type="button" onClick={handleCopyId} aria-label="Copy player ID" className="hover:text-purple-400 transition ml-1">
                                                {copiedId ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                        {profile.customActivity && (
                                            <span className="text-xs text-purple-300 bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-500/30 font-semibold">
                                                {profile.customActivity}
                                            </span>
                                        )}
                                    </div>

                                    {/* Email & Follows */}
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-400 text-xs font-semibold pt-0.5">
                                        <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" /> {profile.email}</div>
                                        {profile.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /> {profile.phone}</div>}
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
                                            <div><span className="text-white font-extrabold">{followerCount}</span> <span className="text-slate-500 text-[11px]">Followers</span></div>
                                            <div><span className="text-white font-extrabold">{followingCount}</span> <span className="text-slate-500 text-[11px]">Following</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="p-2 border-t border-slate-800/80 bg-[#0c101c]/95">
                    <div className="bg-[#080d18] border border-slate-800/90 rounded-xl p-1 flex items-center justify-between gap-1">
                        <button type="button" 
                            onClick={() => {
                                setActiveTab('settings');
                            }}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs tracking-wide uppercase flex items-center justify-center gap-1.5 transition-all ${
                                activeTab === 'settings' 
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            Overview
                        </button>
                        <button type="button" 
                            onClick={() => {
                                setActiveTab('activity');
                            }}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs tracking-wide uppercase flex items-center justify-center gap-1.5 transition-all ${
                                activeTab === 'activity' 
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            Activity
                        </button>
                        <button type="button" 
                            onClick={() => {
                                setShowSettingsModal(true);
                            }}
                            className="flex-1 py-1.5 px-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium text-xs tracking-wide uppercase flex items-center justify-center gap-1.5 transition-all"
                        >
                            <SettingsIcon className="w-3.5 h-3.5 text-slate-400" /> Settings
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'settings' ? (
                <div className="space-y-6">
                    {/* Stats Grid matching Stitch screen 12 */}
                    <div className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Card 1: Wallet Balance */}
                            <div className="rounded-xl bg-[#111728] border border-slate-800/90 p-4 shadow-md flex flex-col justify-between hover:border-emerald-500/40 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                                        <span className="w-6 h-6 rounded-md bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                                            <WalletIcon className="w-3.5 h-3.5" />
                                        </span>
                                        <span>WALLET</span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => navigate('/wallet')}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold hover:bg-emerald-800/40 transition-colors uppercase tracking-tight"
                                    >
                                        TOP UP
                                    </button>
                                </div>
                                <div className="mt-3 font-bold text-xl sm:text-2xl tracking-wide text-white">
                                    {formatCurrency(profile.balance)}
                                </div>
                            </div>

                            {/* Card 2: Total Earnings */}
                            <div className="rounded-xl bg-[#111728] border border-slate-800/90 p-4 shadow-md flex flex-col justify-between hover:border-amber-500/40 transition-all">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                                    <span className="w-6 h-6 rounded-md bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
                                        <Trophy className="w-3.5 h-3.5" />
                                    </span>
                                    <span>EARNINGS</span>
                                </div>
                                <div className="mt-3 font-bold text-xl sm:text-2xl tracking-wide text-white">
                                    {formatCurrency(profile.totalEarnings || 0)}
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Player Level with sleek progress bar */}
                        <div className="rounded-xl bg-[#111728] border border-slate-800/90 p-4 shadow-md space-y-2.5 hover:border-purple-500/40 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                                    <span className="w-6 h-6 rounded-md bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
                                        <Shield className="w-3.5 h-3.5" />
                                    </span>
                                    <span>PLAYER LEVEL</span>
                                </div>
                                <span className="text-xs font-mono font-semibold text-slate-400">
                                    {profile.xp || 0} / {getXPForNextLevel(calculateLevel(profile.xp))} XP
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <div className="font-bold text-xl text-white">
                                    LVL {calculateLevel(profile.xp)}
                                </div>
                                <span className="text-xs text-purple-400 font-semibold">Tier {calculateLevel(profile.xp)} Challenger</span>
                            </div>
                            <div className="w-full bg-[#080d18] h-2 rounded-full overflow-hidden border border-slate-800">
                                <div 
                                    className="bg-gradient-to-r from-purple-600 to-indigo-400 h-full rounded-full transition-all duration-700 shadow-sm" 
                                    style={{ width: `${Math.max(5, getLevelProgress(profile.xp))}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bio & Skills */}
                    <div className="bg-card p-4 sm:p-8 rounded-2xl border border-gray-800 shadow-2xl space-y-6">
                        <div>
                            <h3 className="text-xs text-gray-500 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                                <Info className="w-3 h-3" /> About Me
                            </h3>
                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                {profile.bio || "No bio provided yet."}
                            </p>
                        </div>
                        
                        {profile.skills && profile.skills.length > 0 && (
                            <div className="pt-6 border-t border-gray-800">
                                <h3 className="text-xs text-gray-500 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                                    <Briefcase className="w-3 h-3" /> Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {profile.skills.map((skill, i) => (
                                        <span key={i} className="bg-dark border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-card rounded-2xl border border-gray-800 p-4 sm:p-8 shadow-2xl">
                    <div className="flex items-center gap-2 border-b border-gray-800 pb-4 mb-6">
                        <Clock className="text-brand-500" />
                        <h3 className="font-black text-white uppercase tracking-widest">Recent Activity</h3>
                    </div>

                    {loadingActivity ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Fetching history...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentActivity.length > 0 ? (
                                recentActivity.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-dark/50 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                                item.type === 'deposit' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                                                item.type === 'withdrawal' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                                                'bg-brand-900/20 border-brand-500/30 text-brand-400'
                                            }`}>
                                                {item.type === 'deposit' ? <ArrowDown className="w-5 h-5" /> :
                                                 item.type === 'withdrawal' ? <ArrowUp className="w-5 h-5" /> :
                                                 <Trophy className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white capitalize">{item.type}</div>
                                                <div className="text-xs text-gray-500">{formatDate(item.timestamp)}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-black ${item.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount)}
                                            </div>
                                            <div className="text-xs text-gray-600 uppercase font-bold">{item.status}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20">
                                    <Clock className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                                    <p className="text-gray-600 font-black uppercase tracking-widest text-sm">No recent activity found</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} title="Choose Preset Avatar">
                <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {PRESET_AVATARS.map((url, index) => (
                            <button
                                key={index}
                                onClick={async () => {
                                    if (!user) return;
                                    setShowPresetModal(false);
                                    setIsUploading(true);
                                    try {
                                        await updateDoc(doc(db, 'users', user.uid), {
                                            profilePicUrl: url
                                        });
                                        showToast('Profile picture updated!', 'success');
                                    } catch (error: any) {
                                        console.error("Error updating profile picture:", error);
                                        showToast('Failed to update profile picture', 'error');
                                    } finally {
                                        setIsUploading(false);
                                    }
                                }}
                                className="relative group rounded-2xl overflow-hidden border-2 border-gray-800 hover:border-brand-500 transition-colors aspect-square bg-dark"
                            >
                                <img src={url || undefined} alt={`Avatar preset ${index + 1}`} className="w-full h-full object-cover p-2" loading="lazy" />
                                <div className="absolute inset-0 bg-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-brand-400 drop-shadow-lg" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Account Settings">
                <div className="p-6 max-h-[80vh] overflow-y-auto space-y-8">
                    {/* Edit Profile Form */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-800 pb-4">
                            <User className="text-brand-500" />
                            <h3 className="font-black text-white uppercase tracking-widest">Profile Details</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="profileInGameId" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> In-Game ID (UID) * {isUidLocked && <span className="text-brand-500 font-normal">(Locked)</span>}
                                    </label>
                                    <input 
                                        id="profileInGameId"
                                        type="text"
                                        value={inGameId} 
                                        onChange={(e) => setInGameId(e.target.value)}
                                        placeholder="e.g. 512345678" 
                                        readOnly={isUidLocked}
                                        className={`w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px] ${isUidLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="profileInGameName" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <User className="w-3 h-3" /> In-Game Name
                                    </label>
                                    <input 
                                        id="profileInGameName"
                                        type="text"
                                        value={inGameName} 
                                        onChange={(e) => setInGameName(e.target.value)}
                                        placeholder="Enter In-Game Name" 
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="profileTeamName" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Team Name
                                    </label>
                                    <input 
                                        id="profileTeamName"
                                        type="text"
                                        value={teamName} 
                                        onChange={(e) => setTeamName(e.target.value)}
                                        placeholder="Enter Team Name" 
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                                {profile?.role === 'organizer' && (
                                    <>
                                        <div>
                                            <label htmlFor="profileOrgName" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                                <Briefcase className="w-3 h-3" /> Organization Name
                                            </label>
                                            <input 
                                                id="profileOrgName"
                                                type="text"
                                        value={orgName} 
                                                onChange={(e) => setOrgName(e.target.value)}
                                                placeholder="Enter Org Name" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="profileWhatsApp" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> WhatsApp
                                            </label>
                                            <input 
                                                id="profileWhatsApp"
                                                type="text"
                                        value={orgWhatsapp} 
                                                onChange={(e) => setOrgWhatsapp(e.target.value)}
                                                placeholder="WhatsApp Number" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="profileDiscord" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                                Discord
                                            </label>
                                            <input 
                                                id="profileDiscord"
                                                type="text"
                                        value={orgDiscord} 
                                                onChange={(e) => setOrgDiscord(e.target.value)}
                                                placeholder="Discord Username" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="profileYouTube" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                                YouTube
                                            </label>
                                            <input 
                                                id="profileYouTube"
                                                type="text"
                                        value={orgYoutube} 
                                                onChange={(e) => setOrgYoutube(e.target.value)}
                                                placeholder="YouTube Channel Link" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                            />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label htmlFor="profilePhone" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> Phone Number
                                    </label>
                                    <input 
                                        id="profilePhone"
                                        type="tel"
                                        value={phone} 
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="e.g. 98XXXXXXXX"
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="profileBio" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Info className="w-3 h-3" /> Bio / Description
                                    </label>
                                    <textarea 
                                        value={bio} 
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell us about yourself..." 
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition h-[120px] resize-none text-sm leading-relaxed min-h-[44px]"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="profileSkills" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Briefcase className="w-3 h-3" /> Skills (Comma separated)
                                    </label>
                                    <input 
                                        id="profileSkills"
                                        type="text"
                                        value={skills} 
                                        onChange={(e) => setSkills(e.target.value)}
                                        placeholder="e.g. React, Node.js, UI/UX"
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="profileStatus" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                            Status
                                        </label>
                                        <select 
                                            value={status} 
                                            id="profileStatus"
                                            onChange={(e) => setStatus(e.target.value as any)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold appearance-none min-h-[44px]"
                                        >
                                            <option value="online">🟢 Online</option>
                                            <option value="idle">🟡 Idle</option>
                                            <option value="dnd">🔴 Do Not Disturb</option>
                                            <option value="offline">⚫ Offline</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="profileCustomActivity" className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                            Custom Activity
                                        </label>
                                        <input 
                                            id="profileCustomActivity"
                                            type="text"
                                        value={customActivity} 
                                            onChange={(e) => setCustomActivity(e.target.value)}
                                            placeholder="e.g. Coding..."
                                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold min-h-[44px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button type="button" 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-surface text-white py-4 rounded-xl font-black transition shadow-lg uppercase tracking-widest flex items-center justify-center gap-2 min-h-[44px]"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" /> Save Profile Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {/* Security */}
                    <div className="pt-8 border-t border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <Shield className="text-brand-500" />
                            <h3 className="font-black text-white uppercase tracking-widest">Security & Authentication</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-card/50 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs text-gray-400 mb-4">Update your account password to keep your wallet secure.</p>
                                <button type="button" 
                                    onClick={async () => {
                                        const email = profile.email;
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Reset Password',
                                            message: `Send password reset email to ${email}?`,
                                            onConfirm: async () => {
                                                try {
                                                    await sendPasswordResetEmail(auth, email);
                                                    showToast('Password reset link sent to your email!', 'success');
                                                } catch (e: any) {
                                                    console.error(e);
                                                    showToast(e.message || 'Error sending reset link', 'error');
                                                }
                                            }
                                        });
                                    }}
                                    className="text-xs font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Mail className="w-4 h-4" /> Send Reset Link
                                </button>
                            </div>
                            <div className="bg-card/50 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs text-gray-400 mb-4">Change your account email address.</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="email" 
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder="New Email Address" 
                                        className="bg-dark border border-gray-700 rounded-xl px-3 py-2 text-white flex-grow text-xs focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                    />
                                    <button type="button" 
                                        onClick={handleUpdateEmail} 
                                        disabled={isUpdatingEmail || !newEmail}
                                        className="bg-brand-600 px-4 min-h-[44px] rounded-xl hover:bg-brand-500 disabled:bg-surface text-white text-xs font-black transition uppercase tracking-widest shadow-lg whitespace-nowrap"
                                    >
                                        {isUpdatingEmail ? 'Updating...' : 'Update'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Device Push Notifications (PWA Web Push) */}
                    <div className="pt-8 border-t border-gray-800">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <BellRing className="text-brand-500 w-5 h-5" />
                                <h3 className="font-black text-white uppercase tracking-widest text-sm sm:text-base">Device Push Notifications</h3>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                                pushPermission === 'granted'
                                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                                    : pushPermission === 'denied'
                                    ? 'bg-red-950/60 border-red-500/50 text-red-400'
                                    : 'bg-purple-950/60 border-purple-500/50 text-purple-400'
                            }`}>
                                {pushPermission === 'granted' ? 'Active' : pushPermission === 'denied' ? 'Blocked' : 'Inactive'}
                            </span>
                        </div>
                        <div className="bg-card/50 p-5 rounded-2xl border border-gray-800 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-white font-bold flex items-center gap-2">
                                        <Smartphone className="w-4 h-4 text-brand-400" />
                                        Native Mobile & Desktop Alerts (PWA)
                                    </p>
                                    <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
                                        Receive live match room credentials, tournament schedules, scrim announcements, and team invitations directly on your phone or desktop screen.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {pushPermission === 'granted' && (
                                        <button
                                            type="button"
                                            onClick={handleTestPush}
                                            disabled={isSendingTestPush}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
                                        >
                                            {isSendingTestPush ? 'Sending...' : 'Test Alert'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleTogglePush}
                                        disabled={isTogglingPush || !isPushSupported()}
                                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                                            pushPermission === 'granted'
                                                ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-500/30'
                                                : 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20'
                                        }`}
                                    >
                                        {isTogglingPush
                                            ? 'Updating...'
                                            : pushPermission === 'granted'
                                            ? 'Disable'
                                            : 'Enable Alerts'}
                                    </button>
                                </div>
                            </div>
                            {pushPermission === 'denied' && (
                                <p className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-xl font-medium">
                                    Notifications are blocked in your browser. Please tap the lock/info icon in your browser URL bar to allow notifications for NexPlay.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Organizer Application */}
                    {profile.role === 'player' && (profile.orgStatus === 'pending' || profile.orgStatus === 'rejected' || !profile.orgStatus) && (siteSettings?.isOrgFormOpen ?? true) && (
                        <div className="pt-8 border-t border-gray-800">
                            <div className="bg-brand-500/5 p-6 rounded-2xl border border-brand-500/20">
                                <div className="flex items-center gap-3 mb-4">
                                    <Briefcase className="text-brand-400" />
                                    <h4 className="font-black text-white uppercase tracking-widest text-sm">Become an Organizer</h4>
                                </div>
                                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                                    {siteSettings.orgFormDescription || "Want to host your own tournaments and manage teams? Apply for an organizer account. Our team will review your application within 48 hours."}
                                </p>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-black mb-1 block ml-1">Organization Name</label>
                                            <input 
                                                id="applyOrgName"
                                                type="text"
                                        value={orgName}
                                                onChange={(e) => setOrgName(e.target.value)}
                                                placeholder="Organization / Brand Name" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-black mb-1 block ml-1">Contact Email</label>
                                            <input 
                                                type="email" 
                                                value={orgEmail}
                                                onChange={(e) => setOrgEmail(e.target.value)}
                                                placeholder="Business Email" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-black mb-1 block ml-1">WhatsApp Number</label>
                                            <input 
                                                id="applyWhatsApp"
                                                type="text"
                                        value={orgWhatsapp}
                                                onChange={(e) => setOrgWhatsapp(e.target.value)}
                                                placeholder="+1234567890" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-black mb-1 block ml-1">Portfolio / Proof Link</label>
                                            <input 
                                                type="url" 
                                                value={orgProofLink}
                                                onChange={(e) => setOrgProofLink(e.target.value)}
                                                placeholder="Link to previous work/socials" 
                                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                            />
                                        </div>
                                    </div>
                                    <button type="button" 
                                        onClick={handleOrgApply} 
                                        disabled={isApplying}
                                        className="w-full bg-brand-600 py-4 rounded-xl hover:bg-brand-500 text-white text-xs font-black transition uppercase tracking-widest shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2"
                                    >
                                        {isApplying ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Briefcase className="w-4 h-4" /> Submit Application
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {profile.orgStatus === 'pending' && (
                        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl text-center text-yellow-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <Info className="w-4 h-4" /> Application Pending Review
                        </div>
                    )}
                    {profile.orgStatus === 'rejected' && (
                        <div className="mt-8 p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-center text-red-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <X className="w-4 h-4" /> Application Rejected. You can apply again later.
                        </div>
                    )}
                    {profile.orgStatus === 'rejected' && (siteSettings?.isOrgFormOpen ?? true) && (
                        <button type="button" 
                            onClick={() => {
                                // Reset application state to allow re-applying
                                updateDoc(doc(db, 'users', user.uid), { orgStatus: null });
                            }}
                            className="w-full mt-4 bg-surface hover:bg-surface text-white py-3 rounded-xl font-bold transition uppercase text-xs tracking-widest"
                        >
                            Re-apply as Organizer
                        </button>
                    )}
                </div>
            </Modal>

            <Modal isOpen={showBannerPresetModal} onClose={() => setShowBannerPresetModal(false)} title="Choose Banner Preset">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {PRESET_PLAYER_BANNERS.map((url, index) => (
                        <button
                            key={index}
                            onClick={() => handleBannerSelect(url)}
                            className="relative group rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-500 transition-colors aspect-video"
                        >
                            <img src={url || undefined} alt={`Avatar preset ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-xs font-black uppercase tracking-widest text-white bg-brand-500 px-3 py-1 rounded-full">Select</span>
                            </div>
                        </button>
                    ))}
                </div>
            </Modal>

            <Modal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} title="Choose Avatar Preset">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {PRESET_AVATARS.map((url, index) => (
                        <button
                            key={index}
                            onClick={() => handleAvatarSelect(url)}
                            className="relative group rounded-2xl overflow-hidden border-2 border-transparent hover:border-brand-500 transition-colors aspect-square bg-slate-900"
                        >
                            <img src={url || undefined} alt={`Avatar preset ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-xs font-black uppercase tracking-widest text-white bg-brand-500 px-3 py-1 rounded-full">Select</span>
                            </div>
                        </button>
                    ))}
                </div>
            </Modal>

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

export default Profile;
