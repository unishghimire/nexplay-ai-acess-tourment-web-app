import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Building2, 
    CheckCircle2, 
    Users, 
    Trophy, 
    Calendar, 
    Globe, 
    Share2, 
    UserPlus, 
    UserMinus, 
    ArrowLeft, 
    Zap, 
    Gamepad2, 
    ExternalLink, 
    Clock, 
    Target, 
    Award,
    Flame,
    Sparkles
} from 'lucide-react';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
    serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import Seo from '../../../shared/components/Seo';
import TournamentCard from '../../tournaments/components/TournamentCard';
import { 
    PublicOrganization, 
    OrganizationPublicStats, 
    Tournament 
} from '../../../shared/types/types';
import { 
    getPublicOrganization, 
    getOrganizationTournaments, 
    getCompletedOrganizationTournaments,
    calculateOrganizationStats,
    sanitizeExternalUrl
} from '../../../shared/services/organizationService';
import { 
    formatCurrency, 
    getLevelProgress, 
    getXPForNextLevel, 
    calculateLevel 
} from '../../../shared/utils/utils';

// Brand icon components for validated social links
function DiscordIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
    );
}

function YouTubeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
    );
}

function TwitterIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
    );
}

function FacebookIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
    );
}

function InstagramIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
    );
}

type TabType = 'overview' | 'running' | 'upcoming' | 'completed' | 'stats';

const OrganizationProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useNotification();

    const [organization, setOrganization] = useState<PublicOrganization | null>(null);
    const [stats, setStats] = useState<OrganizationPublicStats | null>(null);
    const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    
    // Follow state
    const [isFollowing, setIsFollowing] = useState(false);
    const [followDocId, setFollowDocId] = useState<string | null>(null);
    const [followLoading, setFollowLoading] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);

    // Completed tournaments pagination
    const [completedTournaments, setCompletedTournaments] = useState<Tournament[]>([]);
    const [completedLastDoc, setCompletedLastDoc] = useState<any>(null);
    const [completedHasMore, setCompletedHasMore] = useState(false);
    const [loadingMoreCompleted, setLoadingMoreCompleted] = useState(false);

    const loadData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            // 1. Fetch organization details
            const org = await getPublicOrganization(id);
            if (!org) {
                setOrganization(null);
                setLoading(false);
                return;
            }
            setOrganization(org);

            // 2. Fetch all public tournaments to calculate verified stats
            const tournaments = await getOrganizationTournaments(id);
            setAllTournaments(tournaments);
            const computedStats = calculateOrganizationStats(tournaments);
            setStats(computedStats);

            // 3. Initial batch for completed tournaments
            const completedResult = await getCompletedOrganizationTournaments(id, 12);
            setCompletedTournaments(completedResult.tournaments);
            setCompletedLastDoc(completedResult.lastDoc);
            setCompletedHasMore(completedResult.hasMore);

            // 4. Followers check
            const followersSnap = await getDocs(query(
                collection(db, 'follows'),
                where('followingId', '==', id)
            ));
            setFollowersCount(followersSnap.size);

            if (user && user.uid !== id) {
                const userFollowSnap = await getDocs(query(
                    collection(db, 'follows'),
                    where('followerId', '==', user.uid),
                    where('followingId', '==', id)
                ));
                if (!userFollowSnap.empty) {
                    setIsFollowing(true);
                    setFollowDocId(userFollowSnap.docs[0].id);
                } else {
                    setIsFollowing(false);
                    setFollowDocId(null);
                }
            }
        } catch (error) {
            console.error('Error loading organization profile:', error);
            showToast('Failed to load organization data', 'error');
        } finally {
            setLoading(false);
        }
    }, [id, user, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleToggleFollow = async () => {
        if (!user) {
            showToast('Please login to follow organizations', 'warning');
            return;
        }
        if (!id || user.uid === id) return;

        setFollowLoading(true);
        try {
            if (isFollowing && followDocId) {
                await deleteDoc(doc(db, 'follows', followDocId));
                setIsFollowing(false);
                setFollowDocId(null);
                setFollowersCount(prev => Math.max(0, prev - 1));
                showToast(`Unfollowed ${organization?.name || 'organization'}`, 'info');
            } else {
                const docRef = await addDoc(collection(db, 'follows'), {
                    followerId: user.uid,
                    followingId: id,
                    createdAt: serverTimestamp()
                });
                setIsFollowing(true);
                setFollowDocId(docRef.id);
                setFollowersCount(prev => prev + 1);
                showToast(`Now following ${organization?.name || 'organization'}`, 'success');

                // Send notification to organizer
                await addDoc(collection(db, 'notifications'), {
                    userId: id,
                    title: 'New Follower',
                    message: `${user.username || user.email?.split('@')[0] || 'A player'} is now following your organization`,
                    type: 'info',
                    read: false,
                    link: `/organizations/${id}`,
                    createdAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            showToast('Could not update follow status. Try again.', 'error');
        } finally {
            setFollowLoading(false);
        }
    };

    const handleShare = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href);
            showToast('Organization profile link copied to clipboard!', 'success');
        }
    };

    const loadMoreCompleted = async () => {
        if (!id || !completedLastDoc || loadingMoreCompleted || !completedHasMore) return;
        setLoadingMoreCompleted(true);
        try {
            const result = await getCompletedOrganizationTournaments(id, 12, completedLastDoc);
            setCompletedTournaments(prev => [...prev, ...result.tournaments]);
            setCompletedLastDoc(result.lastDoc);
            setCompletedHasMore(result.hasMore);
        } catch (error) {
            console.error('Failed to load more completed tournaments:', error);
        } finally {
            setLoadingMoreCompleted(false);
        }
    };

    // Filter tournaments for current display
    const runningTournaments = allTournaments.filter(t => t.status === 'live');
    const upcomingTournaments = allTournaments.filter(t => t.status === 'upcoming' || t.status === 'published');

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse space-y-6">
                <div className="h-48 sm:h-64 bg-slate-900/80 rounded-3xl border border-slate-800" />
                <div className="flex items-center gap-6 px-4">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-slate-800 border-4 border-slate-900 -mt-12 sm:-mt-16" />
                    <div className="space-y-3 flex-1">
                        <div className="h-6 w-48 bg-slate-800 rounded" />
                        <div className="h-4 w-32 bg-slate-800/60 rounded" />
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-slate-900/60 rounded-2xl border border-slate-800/80" />
                    ))}
                </div>
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6 shadow-xl">
                    <Building2 className="w-10 h-10" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider mb-2">
                    Organization Unavailable
                </h1>
                <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                    The requested organization profile could not be found, has been made private, or is not publicly registered on NexPlay.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 rounded-xl bg-[#131d33] hover:bg-[#1a2642] text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider border border-slate-700/60 transition flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                    <Link
                        to="/organizations"
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-900/30 transition flex items-center gap-2"
                    >
                        <Building2 className="w-4 h-4" /> Browse Organizations
                    </Link>
                </div>
            </div>
        );
    }

    const level = organization.level || calculateLevel(organization.xp || 0);
    const xp = organization.xp || 0;
    const progress = getLevelProgress(xp);
    const xpNext = getXPForNextLevel(level);

    return (
        <>
            <Seo
                title={`${organization.name} — Esports Tournaments | NexPlay`}
                description={organization.description || organization.tagline || `Explore tournaments, scrims, and verified esports statistics hosted by ${organization.name} on NexPlay.`}
                canonicalPath={`/organizations/${organization.id}`}
                ogImage={organization.bannerUrl || organization.logoUrl}
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "SportsOrganization",
                    "name": organization.name,
                    "url": `https://www.nexplayorg.app/organizations/${organization.id}`,
                    "logo": organization.logoUrl,
                    "description": organization.description || organization.tagline || `Esports organization on NexPlay`
                }}
            />

            <div className="max-w-6xl mx-auto px-4 pb-24 animate-fade-in space-y-8">
                {/* Back navigation */}
                <div className="flex items-center justify-between pt-2">
                    <Link
                        to="/organizations"
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-purple-300 uppercase tracking-wider transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> All Organizations
                    </Link>

                    <button
                        onClick={handleShare}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0e1628] hover:bg-[#16223d] border border-slate-800 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition"
                        title="Share Profile"
                    >
                        <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                </div>

                {/* HERO SECTION */}
                <section className="relative rounded-3xl overflow-hidden bg-[#0c1322] border border-slate-800/90 shadow-2xl">
                    {/* Banner Image / Gradient */}
                    <div 
                        className="h-44 sm:h-64 w-full relative bg-cover bg-center overflow-hidden bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950"
                        style={organization.bannerUrl ? { backgroundImage: `url(${organization.bannerUrl})` } : {}}
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1322] via-[#0c1322]/50 to-transparent" />
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:16px_16px]" />
                        
                        {organization.isPowerOrganizer && (
                            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                                <Sparkles className="w-3 h-3 fill-current" /> Power Org
                            </div>
                        )}
                    </div>

                    {/* Profile Header Content */}
                    <div className="px-6 sm:px-8 pb-8 pt-0 relative -mt-16 sm:-mt-20">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            {/* Logo & Identity */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
                                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-[#070c17] border-4 border-[#0c1322] overflow-hidden shadow-2xl shrink-0 flex items-center justify-center relative">
                                    {organization.logoUrl ? (
                                        <img 
                                            src={organization.logoUrl} 
                                            alt={organization.name} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-purple-800 to-indigo-950 flex items-center justify-center text-3xl sm:text-4xl font-black text-white">
                                            {organization.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 pb-1">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide uppercase font-sans">
                                            {organization.name}
                                        </h1>
                                        {organization.isVerified && (
                                            <div title="Verified Esports Organizer">
                                                <CheckCircle2 className="w-6 h-6 text-blue-400 fill-blue-400/20" />
                                            </div>
                                        )}
                                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-purple-400" /> LVL {level}
                                        </span>
                                    </div>

                                    <p className="text-xs font-bold text-slate-400">
                                        @{organization.username}
                                        {organization.region && (
                                            <span className="text-slate-500"> • {organization.region}</span>
                                        )}
                                    </p>

                                    {organization.tagline && (
                                        <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-xl line-clamp-2 pt-0.5">
                                            {organization.tagline}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons: Follow */}
                            <div className="flex items-center gap-3 self-stretch sm:self-auto">
                                {user && user.uid !== organization.id && (
                                    <button
                                        onClick={handleToggleFollow}
                                        disabled={followLoading}
                                        className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                                            isFollowing
                                                ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/40'
                                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/30'
                                        } disabled:opacity-50`}
                                    >
                                        {followLoading ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : isFollowing ? (
                                            <>
                                                <UserMinus className="w-4 h-4" /> Unfollow
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="w-4 h-4" /> Follow
                                            </>
                                        )}
                                    </button>
                                )}

                                <div className="px-4 py-2.5 rounded-xl bg-[#080d1a] border border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-300">
                                    <Users className="w-4 h-4 text-purple-400" />
                                    <span>{followersCount.toLocaleString()}</span>
                                    <span className="text-slate-500 uppercase text-[10px]">Followers</span>
                                </div>
                            </div>
                        </div>

                        {/* Level & XP Bar */}
                        <div className="mt-6 pt-4 border-t border-slate-800/80 max-w-xl space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-purple-400" /> Tier {level} Organizer Progress
                                </span>
                                <span className="text-slate-400 font-mono">
                                    {xp.toLocaleString()} / {xpNext.toLocaleString()} XP
                                </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                                <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-700"
                                    style={{ width: `${Math.max(5, progress)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* QUICK STATS CARDS */}
                {stats && (
                    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="p-4 rounded-2xl bg-[#0c1322] border border-slate-800/90 shadow-sm flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tournaments</p>
                                <p className="text-lg sm:text-xl font-black text-white">{stats.totalTournaments}</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#0c1322] border border-slate-800/90 shadow-sm flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                                <Flame className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live / Running</p>
                                <p className="text-lg sm:text-xl font-black text-white">{stats.runningTournaments}</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#0c1322] border border-slate-800/90 shadow-sm flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upcoming</p>
                                <p className="text-lg sm:text-xl font-black text-white">{stats.upcomingTournaments}</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#0c1322] border border-slate-800/90 shadow-sm flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                <Award className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Prizes</p>
                                <p className="text-lg sm:text-xl font-black text-white">{formatCurrency(stats.totalPrizePool)}</p>
                            </div>
                        </div>
                    </section>
                )}

                {/* NAVIGATION TABS */}
                <div className="border-b border-slate-800/80">
                    <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-2 scrollbar-none">
                        {[
                            { key: 'overview', label: 'Overview' },
                            { key: 'running', label: `Running (${runningTournaments.length})` },
                            { key: 'upcoming', label: `Upcoming (${upcomingTournaments.length})` },
                            { key: 'completed', label: 'Past / Completed' },
                            { key: 'stats', label: 'Esports Stats' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as TabType)}
                                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                                    activeTab === tab.key
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* TAB CONTENT */}
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                        >
                            {/* Left: About & Social Info */}
                            <div className="lg:col-span-1 space-y-6">
                                {/* About Section */}
                                <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 shadow-sm space-y-4">
                                    <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-purple-400" /> About Organization
                                    </h2>
                                    <p className="text-xs sm:text-sm leading-relaxed text-slate-300 font-medium whitespace-pre-line">
                                        {organization.description || 'This organization has not published a detailed bio yet.'}
                                    </p>

                                    <div className="pt-3 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-400">
                                        {organization.country && (
                                            <div className="flex justify-between">
                                                <span className="font-bold text-slate-500 uppercase">Country</span>
                                                <span className="font-semibold text-slate-200">{organization.country}</span>
                                            </div>
                                        )}
                                        {organization.region && (
                                            <div className="flex justify-between">
                                                <span className="font-bold text-slate-500 uppercase">Region</span>
                                                <span className="font-semibold text-slate-200">{organization.region}</span>
                                            </div>
                                        )}
                                        {organization.establishedDate && (
                                            <div className="flex justify-between">
                                                <span className="font-bold text-slate-500 uppercase">Established</span>
                                                <span className="font-semibold text-slate-200">{organization.establishedDate}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-500 uppercase">Verification</span>
                                            <span className={`font-bold ${organization.isVerified ? 'text-blue-400' : 'text-slate-500'}`}>
                                                {organization.isVerified ? 'Verified Partner' : 'Standard Organizer'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Social Links Section */}
                                {organization.socialLinks && Object.values(organization.socialLinks).some(Boolean) && (
                                    <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 shadow-sm space-y-3">
                                        <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-purple-400" /> Connect & Follow
                                        </h2>
                                        <div className="flex flex-col gap-2 pt-1">
                                            {organization.socialLinks.discord && (
                                                <a
                                                    href={organization.socialLinks.discord}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#8ea1e1] hover:text-white text-xs font-bold transition"
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <DiscordIcon className="w-4 h-4" /> Discord Server
                                                    </span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}

                                            {organization.socialLinks.youtube && (
                                                <a
                                                    href={organization.socialLinks.youtube}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#FF0000]/10 hover:bg-[#FF0000]/20 border border-[#FF0000]/30 text-[#ff8080] hover:text-white text-xs font-bold transition"
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <YouTubeIcon className="w-4 h-4" /> YouTube Channel
                                                    </span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}

                                            {organization.socialLinks.twitter && (
                                                <a
                                                    href={organization.socialLinks.twitter}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-bold transition"
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <TwitterIcon className="w-4 h-4" /> X / Twitter
                                                    </span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}

                                            {organization.socialLinks.facebook && (
                                                <a
                                                    href={organization.socialLinks.facebook}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 text-[#82b4ff] hover:text-white text-xs font-bold transition"
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <FacebookIcon className="w-4 h-4" /> Facebook Page
                                                    </span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}

                                            {organization.socialLinks.instagram && (
                                                <a
                                                    href={organization.socialLinks.instagram}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#E4405F]/10 hover:bg-[#E4405F]/20 border border-[#E4405F]/30 text-[#f78ca0] hover:text-white text-xs font-bold transition"
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <InstagramIcon className="w-4 h-4" /> Instagram
                                                    </span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}

                                            {organization.website && (
                                                <a
                                                    href={organization.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-purple-950/20 hover:bg-purple-900/30 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold transition"
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <Globe className="w-4 h-4" /> Official Website
                                                    </span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Active / Upcoming Highlights */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Running Tournaments Spotlight */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                            Live Tournaments ({runningTournaments.length})
                                        </h2>
                                        {runningTournaments.length > 0 && (
                                            <button 
                                                onClick={() => setActiveTab('running')}
                                                className="text-xs font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider transition"
                                            >
                                                View All
                                            </button>
                                        )}
                                    </div>

                                    {runningTournaments.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {runningTournaments.slice(0, 2).map(tournament => (
                                                <TournamentCard key={tournament.id} tournament={tournament} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 rounded-2xl bg-[#0c1322] border border-slate-800/80 text-center">
                                            <Flame className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                No tournaments are currently running.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Upcoming Tournaments Spotlight */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                            Upcoming Tournaments ({upcomingTournaments.length})
                                        </h2>
                                        {upcomingTournaments.length > 0 && (
                                            <button 
                                                onClick={() => setActiveTab('upcoming')}
                                                className="text-xs font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider transition"
                                            >
                                                View All
                                            </button>
                                        )}
                                    </div>

                                    {upcomingTournaments.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {upcomingTournaments.slice(0, 2).map(tournament => (
                                                <TournamentCard key={tournament.id} tournament={tournament} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 rounded-2xl bg-[#0c1322] border border-slate-800/80 text-center">
                                            <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                No upcoming tournaments scheduled.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'running' && (
                        <motion.div
                            key="running"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                                Currently Running Tournaments
                            </h2>
                            {runningTournaments.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {runningTournaments.map(tournament => (
                                        <TournamentCard key={tournament.id} tournament={tournament} />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-16 rounded-3xl bg-[#0c1322] border border-slate-800/90 text-center max-w-md mx-auto">
                                    <Flame className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                    <h3 className="text-base font-black text-white uppercase mb-1">
                                        No Tournaments Currently Running
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Check out the upcoming tournaments tab to register for next events.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'upcoming' && (
                        <motion.div
                            key="upcoming"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                                Upcoming Tournaments & Scrims
                            </h2>
                            {upcomingTournaments.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {upcomingTournaments.map(tournament => (
                                        <TournamentCard key={tournament.id} tournament={tournament} />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-16 rounded-3xl bg-[#0c1322] border border-slate-800/90 text-center max-w-md mx-auto">
                                    <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                    <h3 className="text-base font-black text-white uppercase mb-1">
                                        No Upcoming Tournaments
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Follow this organization to receive notifications when they launch new tournaments.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'completed' && (
                        <motion.div
                            key="completed"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-6"
                        >
                            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                                Past & Completed Tournaments
                            </h2>
                            {completedTournaments.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {completedTournaments.map(tournament => (
                                            <TournamentCard key={tournament.id} tournament={tournament} />
                                        ))}
                                    </div>

                                    {completedHasMore && (
                                        <div className="text-center pt-6">
                                            <button
                                                onClick={loadMoreCompleted}
                                                disabled={loadingMoreCompleted}
                                                className="px-6 py-2.5 rounded-xl bg-[#11192e] hover:bg-[#192545] border border-slate-700/60 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition disabled:opacity-50"
                                            >
                                                {loadingMoreCompleted ? 'Loading...' : 'Load More Completed Tournaments'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-16 rounded-3xl bg-[#0c1322] border border-slate-800/90 text-center max-w-md mx-auto">
                                    <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                    <h3 className="text-base font-black text-white uppercase mb-1">
                                        No Completed Tournaments
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        This organization has not completed any tournaments yet.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'stats' && stats && (
                        <motion.div
                            key="stats"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-6"
                        >
                            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                                Public Esports Statistics
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 space-y-2">
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span className="text-xs font-black uppercase tracking-widest">Total Tournaments</span>
                                        <Trophy className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <p className="text-3xl font-black text-white">{stats.totalTournaments}</p>
                                    <p className="text-[11px] text-slate-400 font-medium">Across all games and formats</p>
                                </div>

                                <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 space-y-2">
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span className="text-xs font-black uppercase tracking-widest">Completed Events</span>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <p className="text-3xl font-black text-white">{stats.completedTournaments}</p>
                                    <p className="text-[11px] text-slate-400 font-medium">Successfully concluded competitions</p>
                                </div>

                                <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 space-y-2">
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span className="text-xs font-black uppercase tracking-widest">Total Prize Pools</span>
                                        <Award className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <p className="text-3xl font-black text-white">{formatCurrency(stats.totalPrizePool)}</p>
                                    <p className="text-[11px] text-slate-400 font-medium">Publicly announced prize pools</p>
                                </div>

                                <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 space-y-2">
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span className="text-xs font-black uppercase tracking-widest">Total Player Slots</span>
                                        <Users className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <p className="text-3xl font-black text-white">{stats.totalSlots.toLocaleString()}</p>
                                    <p className="text-[11px] text-slate-400 font-medium">Capacity across all tournaments</p>
                                </div>

                                <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 space-y-2">
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span className="text-xs font-black uppercase tracking-widest">Filled / Registered Slots</span>
                                        <Target className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <p className="text-3xl font-black text-white">{stats.filledSlots.toLocaleString()}</p>
                                    <p className="text-[11px] text-slate-400 font-medium">Player and team participation</p>
                                </div>

                                <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/90 space-y-2">
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span className="text-xs font-black uppercase tracking-widest">Published Winners</span>
                                        <Trophy className="w-4 h-4 text-yellow-400" />
                                    </div>
                                    <p className="text-3xl font-black text-white">{stats.publishedWinners}</p>
                                    <p className="text-[11px] text-slate-400 font-medium">Champions verified in tournament records</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

export default OrganizationProfile;
