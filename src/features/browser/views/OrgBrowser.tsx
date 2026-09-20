import Seo from '../../../shared/components/Seo';
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, addDoc, deleteDoc, doc, limit, startAfter, QueryDocumentSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { NotificationService } from '../../../shared/services/NotificationService';
import { Search, UserPlus, UserMinus, Building2, ChevronRight, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { calculateLevel, getLevelProgress, getXPForNextLevel } from '../../../shared/utils/utils';

const OrgBrowser: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const PAGE_SIZE = 18;

    useEffect(() => {
        fetchOrgs();
        if (user) fetchFollowing();
    }, [user]);

    const fetchOrgs = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(
                collection(db, 'users_public'),
                where('role', 'in', ['organizer', 'admin']),
                limit(PAGE_SIZE)
            ));
            const docs = snap.docs;
            setLastDoc(docs.length > 0 ? docs[docs.length - 1] : null);
            setHasMore(docs.length === PAGE_SIZE);

            const orgsData = docs
                .map(d => ({ uid: d.id, ...(d.data() as any) }))
                .filter((d: any) => d.role === 'organizer' || d.role === 'admin' || (d.orgName && d.orgName.trim() !== ''));
            setOrgs(orgsData);
        } catch (error: any) {
            console.error('FetchOrganizersFailed:', error);
            try {
                const fallbackSnap = await getDocs(query(collection(db, 'users_public'), limit(PAGE_SIZE)));
                const docs = fallbackSnap.docs;
                setLastDoc(docs.length > 0 ? docs[docs.length - 1] : null);
                setHasMore(docs.length === PAGE_SIZE);

                const fallbackData = docs
                    .map(d => ({ uid: d.id, ...(d.data() as any) }))
                    .filter((d: any) => d.role === 'organizer' || d.role === 'admin' || (d.orgName && d.orgName.trim() !== ''));
                setOrgs(fallbackData);
            } catch (fbErr) {
                console.error('FallbackFetchOrganizersFailed:', fbErr);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadMoreOrgs = async () => {
        if (!lastDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const snap = await getDocs(query(
                collection(db, 'users_public'),
                where('role', 'in', ['organizer', 'admin']),
                startAfter(lastDoc),
                limit(PAGE_SIZE)
            ));
            const docs = snap.docs;
            setLastDoc(docs.length > 0 ? docs[docs.length - 1] : null);
            setHasMore(docs.length === PAGE_SIZE);

            const newOrgs = docs
                .map(d => ({ uid: d.id, ...(d.data() as any) }))
                .filter((d: any) => d.role === 'organizer' || d.role === 'admin' || (d.orgName && d.orgName.trim() !== ''));

            setOrgs(prev => {
                const combined = [...prev, ...newOrgs];
                const seen = new Set<string>();
                return combined.filter(o => {
                    if (seen.has(o.uid)) return false;
                    seen.add(o.uid);
                    return true;
                });
            });
        } catch (error: any) {
            console.error('LoadMoreOrganizersFailed:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const fetchFollowing = async () => {
        if (!user) return;
        try {
            const snap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', user.uid)));
            setFollowing(new Set(snap.docs.map(d => d.data().followingId)));
        } catch (error: any) {
            console.error('FetchFollowingListFailed:', error);
        }
    };

    const handleToggleFollow = async (orgId: string) => {
        if (!user) {
            showToast('Please login to follow', 'warning');
            return;
        }

        setTogglingId(orgId);
        const isCurrentlyFollowing = following.has(orgId);
        try {
            if (isCurrentlyFollowing) {
                const snap = await getDocs(query(
                    collection(db, 'follows'),
                    where('followerId', '==', user.uid),
                    where('followingId', '==', orgId)
                ));
                if (!snap.empty) {
                    await deleteDoc(doc(db, 'follows', snap.docs[0].id));
                    setFollowing(prev => { const next = new Set(prev); next.delete(orgId); return next; });
                    showToast('Unfollowed', 'success');
                }
            } else {
                await addDoc(collection(db, 'follows'), {
                    followerId: user.uid,
                    followingId: orgId,
                    createdAt: serverTimestamp()
                });
                setFollowing(prev => new Set(prev).add(orgId));
                showToast('Following', 'success');

                // Send notification to the organization
                try {
                    const followerName = profile?.username || user.username || user.email?.split('@')[0] || 'A player';
                    await NotificationService.create(
                        orgId,
                        'New Follower',
                        `${followerName} started following your organization`,
                        'info',
                        `/user/${user.uid}`
                    );
                } catch (notifErr) {
                    console.error('Failed to send follow notification:', notifErr);
                }
            }
        } catch (error: any) {
            console.error('FollowToggleFailed:', error);
            if (error?.code === 'permission-denied') {
                showToast('Permission denied. Please verify your email or sign in again.', 'error');
            } else {
                showToast('Action failed. Try again.', 'error');
            }
        } finally {
            setTogglingId(null);
        }
    };

    const filteredOrgs = orgs.filter(o =>
        (o.username?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.orgName?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const featured = filteredOrgs.slice(0, 3);
    const rest = filteredOrgs.slice(3);

    return (
        <>
        <Seo
            title="Esports Organizers in Nepal | NexPlay"
            description="Browse esports tournament organizers in Nepal on NexPlay."
            canonicalPath="/organizations"
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Esports Organizers in Nepal",
                "description": "Browse esports tournament organizers in Nepal on NexPlay.",
                "url": `https://www.nexplayorg.app/organizations`
            }}
        />
        <div className="max-w-6xl mx-auto animate-fade-in pb-20 space-y-6">
            {/* Header */}
            <section className="space-y-3" data-purpose="title-section">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 shadow-sm shadow-purple-900/30">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white uppercase font-sans">
                                ORGANIZATIONS
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed text-slate-400 font-medium mt-1">
                            Discover and follow tournament organizers to stay ahead of competitions.
                        </p>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10192e] border border-slate-700/60 shadow-inner">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">{orgs.length} ORGANIZERS</span>
                    </div>
                </div>
            </section>

            <div className="border-t border-slate-800/80"></div>

            {/* Search */}
            <section data-purpose="search-box">
                <div className="p-1.5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-sm max-w-2xl">
                    <div className="relative flex items-center bg-[#070c17] rounded-xl border border-slate-800/80 focus-within:border-purple-500/80 focus-within:shadow-[0_0_12px_rgba(168,85,247,0.25)] transition-all">
                        <div className="absolute left-3.5 pointer-events-none text-slate-500">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            aria-label="Search organizations"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name or organization..."
                            className="w-full bg-transparent py-2.5 pl-10 pr-12 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 border-none font-medium"
                        />
                        <div className="absolute right-3 pointer-events-none px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-700/50 text-[10px] font-semibold text-slate-400">
                            ⌘K
                        </div>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-[#0e1628] h-44 rounded-2xl animate-pulse border border-slate-800/90" />
                    ))}
                </div>
            ) : filteredOrgs.length === 0 ? (
                <div className="bg-[#0e1628] p-12 rounded-2xl border border-slate-800/90 text-center">
                    <Building2 className="w-14 h-14 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-white uppercase mb-1">No Organizations Found</h3>
                    <p className="text-slate-500 font-medium text-xs max-w-sm mx-auto mb-6">
                        {searchTerm ? `No results for "${searchTerm}". Try a different search.` : 'No organizers have registered yet. Check back soon.'}
                    </p>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="text-purple-400 font-black uppercase text-xs tracking-widest hover:text-purple-300 transition-colors"
                        >
                            Clear Search
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Featured strip — top 3 */}
                    {!searchTerm && featured.length > 0 && (
                        <section className="space-y-4 pt-1" data-purpose="featured-organizations">
                            <div className="flex items-center gap-2">
                                <span className="w-3.5 h-[2px] bg-purple-500 rounded-full inline-block shadow-[0_0_8px_#a855f7]"></span>
                                <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                                    FEATURED ORGANIZATIONS
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                                {featured.map((org, i) => (
                                    <motion.article
                                        key={org.uid}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                        className="relative overflow-hidden rounded-2xl bg-[#0e1628] border border-slate-800/90 shadow-lg hover:border-purple-500/40 transition-all group flex flex-col justify-between"
                                    >
                                        <div className="h-14 w-full bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900"></div>

                                        <div className="px-4 pb-4 pt-0 relative -mt-7 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-end justify-between mb-3">
                                                    <div className="w-14 h-14 rounded-xl border-2 border-[#0e1628] bg-slate-950 overflow-hidden shadow-lg shrink-0">
                                                        <img
                                                            src={org.profilePicUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${org.username}`}
                                                            alt={org.username}
                                                            className="w-full h-full object-cover" loading="lazy" />
                                                    </div>
                                                    <span className="px-3 py-1 rounded-full bg-[#1b2846] text-blue-300 font-bold text-[10px] tracking-wider uppercase border border-blue-500/20 shadow-sm">
                                                        ORGANIZER
                                                    </span>
                                                </div>

                                                <h3 className="text-base font-extrabold text-white tracking-wide uppercase truncate group-hover:text-purple-300 transition">
                                                    {org.orgName || org.username}
                                                </h3>
                                                <p className="text-xs font-semibold text-slate-400 truncate mb-2.5">@{org.username}</p>

                                                {/* Organization Level & EXP Progress */}
                                                <div className="space-y-1.5 mb-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                                                    <div className="flex items-center justify-between">
                                                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-black text-[10px] tracking-wider uppercase border border-purple-500/40 flex items-center gap-1">
                                                            <Zap className="w-3 h-3 text-purple-400" /> LVL {org.level || calculateLevel(org.xp)}
                                                        </span>
                                                        <span className="text-[10px] text-purple-300/80 font-bold uppercase tracking-wider">
                                                            Tier {org.level || calculateLevel(org.xp)} Organizer
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full"
                                                            style={{ width: `${Math.max(5, getLevelProgress(org.xp || 0))}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                                                        <span>{(org.xp || 0).toLocaleString()} XP</span>
                                                        <span>{getXPForNextLevel(org.level || calculateLevel(org.xp)).toLocaleString()} XP</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                                                <Link
                                                    to={`/organizations/${org.uid}`}
                                                    className="flex-grow flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#243354] to-[#1f2c49] hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-bold tracking-wider uppercase transition-all shadow-sm border border-slate-700/40 hover:border-purple-400"
                                                >
                                                    PROFILE <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                                {user && user.uid !== org.uid && (
                                                    <button
                                                        onClick={() => handleToggleFollow(org.uid)}
                                                        disabled={togglingId === org.uid}
                                                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                                                            following.has(org.uid)
                                                                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                                                                : 'bg-[#1a253e] hover:bg-[#223050] border-slate-700/60 text-slate-300 hover:text-white'
                                                        } disabled:opacity-50`}
                                                        aria-label={following.has(org.uid) ? 'Unfollow' : 'Follow'}
                                                    >
                                                        {togglingId === org.uid ? (
                                                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                        ) : following.has(org.uid) ? (
                                                            <UserMinus className="w-4 h-4" />
                                                        ) : (
                                                            <UserPlus className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.article>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Full list */}
                    <section className="space-y-4 pt-3" data-purpose="all-organizations">
                        <div className="flex items-center gap-2">
                            <span className="w-3.5 h-[2px] bg-purple-500 rounded-full inline-block"></span>
                            <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                                {searchTerm ? `RESULTS FOR "${searchTerm.toUpperCase()}"` : 'ALL ORGANIZATIONS'}
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(searchTerm ? filteredOrgs : rest).map((org, index) => (
                                <motion.article
                                    key={org.uid}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="rounded-2xl bg-[#0c1424] border border-slate-800/90 p-3.5 flex items-center justify-between gap-3 shadow-md hover:border-purple-500/30 transition-all group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                                            <img
                                                src={org.profilePicUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${org.username}`}
                                                alt={org.username}
                                                className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                        <div className="truncate">
                                            <h3 className="text-sm font-extrabold text-white uppercase tracking-wide truncate group-hover:text-purple-300 transition">
                                                {org.orgName || org.username}
                                            </h3>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-xs font-semibold text-slate-400 truncate">@{org.username}</p>
                                                <span className="px-2 py-0.2 rounded bg-purple-500/20 text-purple-300 font-black text-[10px] tracking-wider uppercase border border-purple-500/30 flex items-center gap-0.5">
                                                    <Zap className="w-2.5 h-2.5 text-purple-400" /> LVL {org.level || calculateLevel(org.xp)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <Link
                                            to={`/organizations/${org.uid}`}
                                            className="flex items-center gap-1 py-2 px-3.5 rounded-xl bg-[#243354] hover:bg-[#2c3e66] text-white text-xs font-bold tracking-wider uppercase transition-colors"
                                        >
                                            VIEW <ChevronRight className="w-3 h-3" />
                                        </Link>
                                        {user && user.uid !== org.uid && (
                                            <button
                                                onClick={() => handleToggleFollow(org.uid)}
                                                disabled={togglingId === org.uid}
                                                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
                                                    following.has(org.uid)
                                                        ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                                                        : 'bg-[#1a253e] hover:bg-[#223050] border-slate-700/60 text-slate-300 hover:text-white'
                                                } disabled:opacity-50`}
                                                aria-label={following.has(org.uid) ? 'Unfollow' : 'Follow'}
                                            >
                                                {togglingId === org.uid ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : following.has(org.uid) ? (
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                ) : (
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </motion.article>
                            ))}
                        </div>

                        {/* Pagination Load More Controller */}
                        {hasMore && (searchTerm ? filteredOrgs : rest).length > 0 && (
                            <div className="flex justify-center mt-8 sm:mt-12">
                                <button
                                    type="button"
                                    onClick={loadMoreOrgs}
                                    disabled={loadingMore}
                                    className="px-8 py-3.5 bg-card hover:bg-brand-500/10 border border-gray-800 hover:border-brand-500/50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-brand-500/10"
                                >
                                    {loadingMore ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                            <span>Loading More Organizations...</span>
                                        </>
                                    ) : (
                                        <span>Load More Organizations</span>
                                    )}
                                </button>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
        </>
    );
};

export default OrgBrowser;
