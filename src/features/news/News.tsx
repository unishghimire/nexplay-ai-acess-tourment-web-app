import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../shared/config/firebase';
import { OrgPost } from '../../shared/types/types';
import Seo from '../../shared/components/Seo';
import { formatDate } from '../../shared/utils/utils';
import { Calendar, ArrowLeft, Newspaper } from 'lucide-react';

const News: React.FC = () => {
    const [posts, setPosts] = useState<OrgPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const PAGE_SIZE = 8;

    const fetchNews = useCallback(async () => {
        try {
            // Database-efficient paginated read
            const snap = await getDocs(query(collection(db, 'org_posts'), limit(PAGE_SIZE)));
            const docs = snap.docs;
            setLastDoc(docs.length > 0 ? docs[docs.length - 1] : null);
            setHasMore(docs.length === PAGE_SIZE);

            const all = docs
                .map(d => ({ id: d.id, ...d.data() } as OrgPost))
                .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setPosts(all);
        } catch (e) {
            console.error('News fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMoreNews = async () => {
        if (!lastDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const snap = await getDocs(query(collection(db, 'org_posts'), startAfter(lastDoc), limit(PAGE_SIZE)));
            const docs = snap.docs;
            setLastDoc(docs.length > 0 ? docs[docs.length - 1] : null);
            setHasMore(docs.length === PAGE_SIZE);

            const newPosts = docs.map(d => ({ id: d.id, ...d.data() } as OrgPost));
            setPosts(prev => {
                const combined = [...prev, ...newPosts];
                const seen = new Set<string>();
                return combined.filter(p => {
                    if (seen.has(p.id)) return false;
                    seen.add(p.id);
                    return true;
                }).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            });
        } catch (e) {
            console.error('Load more news error:', e);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => { fetchNews(); }, [fetchNews]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading News...</p>
            </div>
        );
    }

    return (
        <>
            <Seo
                title="Esports News Nepal — Latest Tournament Updates | NexPlay"
                description="Latest Nepal esports news, tournament announcements, match results, and community updates from NexPlay."
                canonicalPath="/news"
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "Blog",
                    "name": "NexPlay Esports News",
                    "description": "Latest Nepal esports news, tournament announcements, match results, and community updates from NexPlay.",
                    "url": `https://www.nexplayorg.app/news`
                }}
            />
            <div className="max-w-4xl mx-auto px-1 sm:px-4 pb-20 space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-4 rounded-full bg-purple-500" />
                            <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                                Esports News
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400">Tournament recaps, announcements, and competitive community updates.</p>
                    </div>
                    <span className="inline-flex items-center self-start sm:self-auto gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-950/60 border border-purple-500/40 text-purple-300 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" /> Live Coverage
                    </span>
                </div>

                {posts.length === 0 ? (
                    <div className="text-center py-20 bg-[#0d1424]/60 rounded-2xl border border-dashed border-slate-800">
                        <Newspaper className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold text-sm">No news published yet. Check back soon!</p>
                        <p className="text-xs text-slate-500 mt-1">Official tournament updates will appear here.</p>
                    </div>
                ) : (
                    <>
                        {/* 1. Featured / Breaking Article (First Post) */}
                        {posts[0] && (
                            <Link
                                to={`/post/${posts[0].id}`}
                                className="block rounded-2xl bg-gradient-to-b from-[#12192e] to-[#0c1220] border border-slate-800/90 hover:border-purple-500/50 p-4 sm:p-5 shadow-2xl transition duration-200 group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                                {posts[0].imageUrl && (
                                    <div className="w-full h-52 sm:h-64 rounded-xl overflow-hidden mb-4 relative bg-slate-900 border border-slate-800/80">
                                        <img
                                            src={posts[0].imageUrl}
                                            alt={posts[0].title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1220] via-transparent to-black/30" />
                                        <div className="absolute top-3 left-3 flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-[10px] font-black tracking-wider text-white uppercase shadow-md flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> BREAKING
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-[#0c1220]/90 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                                                {posts[0].orgName || 'Official'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
                                        <span className="text-[10px] font-bold text-purple-400 tracking-wider uppercase">OFFICIAL ANNOUNCEMENT</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {formatDate(posts[0].createdAt)}</span>
                                    </div>
                                    <h2 className="text-lg sm:text-2xl font-black text-white group-hover:text-purple-300 transition-colors leading-snug tracking-tight mb-2">
                                        {posts[0].title}
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed font-normal">
                                        {posts[0].content}
                                    </p>

                                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-purple-950 border border-purple-500/40 flex items-center justify-center text-[10px]">
                                                🇳🇵
                                            </div>
                                            <span className="text-xs font-semibold text-slate-300">{posts[0].orgName || 'NexPlay Esports Desk'}</span>
                                        </div>
                                        <span className="px-3 py-1 rounded-lg bg-purple-600 group-hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-md shadow-purple-600/30">
                                            Read More ›
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* 2. Trending Feed (Remaining Posts) */}
                        {posts.length > 1 && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2 pt-2">
                                    <div className="w-2 h-4 rounded-full bg-purple-500" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Trending Articles</h3>
                                </div>

                                <div className="space-y-3">
                                    {posts.slice(1).map(post => (
                                        <Link
                                            key={post.id}
                                            to={`/post/${post.id}`}
                                            className="p-3.5 sm:p-4 rounded-xl bg-[#0d1424] border border-slate-800 hover:border-purple-500/40 transition-all flex gap-3.5 group cursor-pointer shadow-md"
                                        >
                                            {post.imageUrl ? (
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                                                    <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-slate-900 border border-slate-800 shrink-0 flex flex-col items-center justify-center text-center p-2">
                                                    <Newspaper className="w-6 h-6 text-purple-400 mb-1" />
                                                    <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider truncate max-w-full">NEWS</span>
                                                </div>
                                            )}

                                            <div className="flex-1 flex flex-col justify-between min-w-0">
                                                <div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-800/90 text-purple-300 font-semibold border border-purple-900/40 truncate max-w-[120px]">
                                                            {post.orgName || 'NEXPLAY'}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="truncate">{formatDate(post.createdAt)}</span>
                                                    </div>
                                                    <h4 className="text-xs sm:text-sm font-bold text-slate-100 leading-snug line-clamp-2 group-hover:text-purple-300 transition-colors">
                                                        {post.title}
                                                    </h4>
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[11px] text-slate-400">
                                                    <span className="text-slate-400 truncate max-w-[160px] line-clamp-1">{post.content?.slice(0, 40)}...</span>
                                                    <span className="text-purple-400 font-semibold shrink-0 group-hover:translate-x-0.5 transition-transform">Read ›</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pagination Load More Controller */}
                        {hasMore && posts.length > 0 && (
                            <div className="flex justify-center mt-8">
                                <button
                                    type="button"
                                    onClick={loadMoreNews}
                                    disabled={loadingMore}
                                    className="px-6 py-3 bg-[#131b2e] hover:bg-purple-900/30 border border-slate-700/80 hover:border-purple-500/50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                >
                                    {loadingMore ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                            <span>Loading More News...</span>
                                        </>
                                    ) : (
                                        <span>Load More News</span>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}

                <div className="pt-6">
                    <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 px-3 py-1.5 rounded-lg transition-all">
                        <ArrowLeft className="w-4 h-4 text-purple-400" /> Back to Home
                    </Link>
                </div>
            </div>
        </>
    );
};

export default News;
