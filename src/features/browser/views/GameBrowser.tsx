import Seo from '../../../shared/components/Seo';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Game } from '../../../shared/types/types';
import GameCard from '../../home/components/GameCard';
import { Search, Gamepad2 } from 'lucide-react';
import { withStaticCache } from '../../../shared/utils/staticCache';

export default function GameBrowser() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchGames = async () => {
            setLoading(true);
            try {
                const snap = await withStaticCache('games_published', () =>
                    getDocs(query(collection(db, 'games'), where('isPublished', '==', true)))
                );
                let gamesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                if (gamesData.length === 0) {
                    const fallbackSnap = await getDocs(collection(db, 'games'));
                    gamesData = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                }
                gamesData.sort((a,b) => {
                    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return bTime - aTime;
                });
                setGames(gamesData);
            } catch (error) {
                console.error("Error fetching games:", error);
                try {
                    const fallbackSnap = await getDocs(collection(db, 'games'));
                    const fallbackData = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                    setGames(fallbackData);
                } catch (fallbackError) {
                    console.error("Fallback fetching games failed:", fallbackError);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
    }, []);

    const [selectedGenre, setSelectedGenre] = useState<string>('all');

    const filteredGames = games.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.modes.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
        
        if (!matchesSearch) return false;
        if (selectedGenre === 'all') return true;
        if (selectedGenre === 'br') return g.modes.some(m => m.toLowerCase().includes('battle') || m.toLowerCase().includes('royale') || m.toLowerCase().includes('classic'));
        if (selectedGenre === 'moba') return g.modes.some(m => m.toLowerCase().includes('moba') || m.toLowerCase().includes('5v5') || g.name.toLowerCase().includes('legends'));
        if (selectedGenre === 'fps') return g.modes.some(m => m.toLowerCase().includes('tdm') || m.toLowerCase().includes('payload') || m.toLowerCase().includes('clash'));
        return true;
    });

    if (loading) {
        return (
        <>
        <Seo
            title="Games | NexPlay — Esports Tournaments in Nepal"
            description="Explore esports games on NexPlay — PUBG Mobile, Free Fire, Valorant and more. Find tournaments and scrims for your favorite games."
            canonicalPath="/games"
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Esports Games on NexPlay",
                "description": "Explore esports games on NexPlay — PUBG Mobile, Free Fire, Valorant and more.",
                "url": `https://www.nexplayorg.app/games`
            }}
        />
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                <p className="text-purple-400 text-xs font-black tracking-widest uppercase">Loading Games...</p>
            </div>
        </>
        );
    }

    return (
        <div className="animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-6">
            <Seo
                title="Games | NexPlay — Esports Tournaments in Nepal"
                description="Explore esports games on NexPlay — PUBG Mobile, Free Fire, Valorant and more. Find tournaments and scrims for your favorite games."
                canonicalPath="/games"
            />
            {/* Catalog Headline & Search */}
            <section className="space-y-4" data-purpose="catalog-headline">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white uppercase font-sans">
                            EXPLORE GAMES
                        </h1>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            {games.length} TITLES
                        </span>
                    </div>
                    <p className="text-slate-400 text-xs sm:text-sm font-medium mt-0.5">
                        Discover your next tournament battlefield
                    </p>
                </div>

                {/* Search Bar with ⌘K Badge */}
                <div className="relative group max-w-2xl" data-purpose="game-search">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-purple-400 transition-colors">
                        <Search className="w-4 h-4" />
                    </div>
                    <input 
                        aria-label="Search games"
                        type="search" 
                        placeholder="Search games, publishers, modes..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0b1120]/90 backdrop-blur-md border border-[#1e2c47] rounded-xl pl-10 pr-12 py-2.5 text-xs sm:text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all shadow-inner"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-[10px] font-bold text-slate-600 border border-slate-700/60 rounded px-1.5 py-0.5">⌘K</span>
                    </div>
                </div>

                {/* Genre Filter Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 no-scrollbar text-xs font-medium" data-purpose="genre-filter-chips">
                    <button 
                        type="button"
                        onClick={() => setSelectedGenre('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                            selectedGenre === 'all' 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-900/50 border border-purple-400/30' 
                            : 'bg-[#0e1628] border border-[#1e2b45] text-slate-300 hover:text-white hover:border-slate-600'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        All ({games.length})
                    </button>
                    <button 
                        type="button"
                        onClick={() => setSelectedGenre('br')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                            selectedGenre === 'br' 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm border border-purple-400/30' 
                            : 'bg-[#0e1628] border border-[#1e2b45] text-slate-300 hover:text-white hover:border-slate-600'
                        }`}
                    >
                        <span className="text-amber-400 text-[11px]">⚔️</span>
                        Battle Royale
                    </button>
                    <button 
                        type="button"
                        onClick={() => setSelectedGenre('moba')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                            selectedGenre === 'moba' 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm border border-purple-400/30' 
                            : 'bg-[#0e1628] border border-[#1e2b45] text-slate-300 hover:text-white hover:border-slate-600'
                        }`}
                    >
                        <span className="text-purple-400 text-[11px]">🛡️</span>
                        MOBA
                    </button>
                    <button 
                        type="button"
                        onClick={() => setSelectedGenre('fps')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                            selectedGenre === 'fps' 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm border border-purple-400/30' 
                            : 'bg-[#0e1628] border border-[#1e2b45] text-slate-300 hover:text-white hover:border-slate-600'
                        }`}
                    >
                        <span className="text-emerald-400 text-[11px]">🎯</span>
                        FPS / Tactical
                    </button>
                </div>
            </section>

            {/* Games Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredGames.length > 0 ? (
                    filteredGames.map(game => (
                        <GameCard key={game.id} game={game} />
                    ))
                ) : (
                    <div className="col-span-full py-20 bg-[#131b2e]/60 rounded-2xl border border-slate-800 text-center">
                        <Gamepad2 className="w-14 h-14 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-white uppercase tracking-widest">No Games Found</h3>
                        <p className="text-slate-500 font-medium text-xs mt-1">Try adjusting your search or filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
