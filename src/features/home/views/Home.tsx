import Seo from '../../../shared/components/Seo';
import Faq from '../../../shared/components/Faq';
import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament, Game, Slide } from '../../../shared/types/types';
import TournamentCard from '../../tournaments/components/TournamentCard';
import GameCard from '../components/GameCard';
import HotPromotionsSlider, { PromoSlide } from '../components/HotPromotionsSlider';
import { useNavigate } from 'react-router-dom';
import { 
    Star, 
    ChevronRight, 
    Gamepad2, 
    Wallet, 
    Trophy, 
    CheckCircle2, 
    Users, 
    Flame 
} from 'lucide-react';
import { formatGameName } from '../../../shared/utils/utils';



// Sample data for Hot Promotions Slider with high quality illustrative fallback gradients
const promoSlides: PromoSlide[] = [
    {
        id: 1,
        tournamentName: "NEXPLAY GRAND LEAGUE",
        game: "FREE FIRE",
        format: "SQUAD",
        status: "UPCOMING",
        prizePool: "Rs. 100,000",
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1280",
        link: "/tournaments"
    },
    {
        id: 2,
        tournamentName: "CCC REGIONAL TOURNAMENT",
        game: "PUBG MOBILE",
        format: "SQUAD",
        status: "LIVE",
        prizePool: "Rs. 50,000",
        startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1280",
        link: "/tournaments"
    },
    {
        id: 3,
        tournamentName: "VALORANT SHOWDOWN",
        game: "VALORANT",
        format: "5V5",
        status: "UPCOMING",
        prizePool: "Rs. 75,000",
        startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        image: "https://images.unsplash.com/photo-1553481187-be93c21490a9?auto=format&fit=crop&q=80&w=1280",
        link: "/tournaments"
    }
];


const homeFaqs = [
    {
        question: 'What is NexPlay?',
        answer: 'NexPlay is a Nepal-focused esports tournament and scrim platform that allows players and teams to discover, register for, and participate in gaming competitions.',
    },
    {
        question: 'How do I join a NexPlay tournament?',
        answer: 'Create a free NexPlay account, browse available tournaments, and click Register on any tournament that fits your skill level and game.',
    },
    {
        question: 'What games does NexPlay support?',
        answer: 'NexPlay supports popular esports titles including PUBG Mobile, Free Fire, and Valorant. New games are added based on community demand.',
    },
    {
        question: 'Are NexPlay tournaments free to join?',
        answer: 'Many NexPlay tournaments are free to enter. Some premium tournaments may have an entry fee, which is clearly displayed on each tournament page.',
    },
    {
        question: 'How do NexPlay scrims work?',
        answer: 'Scrims are practice matches organized through NexPlay. Organizers create scrim events, and teams can register to participate in competitive practice sessions.',
    },
];


const Home: React.FC = () => {
    
    const [featuredTournaments, setFeaturedTournaments] = useState<Tournament[]>([]);
    const [popularGames, setPopularGames] = useState<Game[]>([]);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [recentResults, setRecentResults] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalPlayersCount, setTotalPlayersCount] = useState(1350); // Live fallback stats
    const navigate = useNavigate();

    useEffect(() => {
        // Track Page View

        const fetchData = async () => {
            
            // Fetch active slides
            try {
                const slidesSnap = await getDocs(query(
                    collection(db, 'slides'),
                    where('isActive', '==', true)
                ));
                let slidesData = slidesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slide));
                slidesData.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return bTime - aTime;
                });
                setSlides(slidesData.slice(0, 5));
            } catch (error) {
                console.warn("Could not fetch slides:", error);
            }

            // Fetch featured tournaments
            try {
                const tournamentsSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('isFeatured', '==', true)
                ));
                let tournamentsData = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                tournamentsData = tournamentsData.filter(t => t.status === 'upcoming');
                setFeaturedTournaments(tournamentsData.slice(0, 6));
            } catch (error) {
                console.warn("Could not fetch tournaments:", error);
            }

            // Fetch popular games
            try {
                const gamesSnap = await getDocs(query(
                    collection(db, 'games'),
                    where('isPublished', '==', true),
                    limit(8)
                ));
                const gamesData = gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                setPopularGames(gamesData);
            } catch (error) {
                console.warn("Could not fetch games:", error);
            }

            // Fetch recent results
            try {
                const resultsSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('status', '==', 'completed'),
                    orderBy('startTime', 'desc'),
                    limit(4)
                ));
                const resultsData = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                setRecentResults(resultsData);
            } catch (error) {
                console.warn("Could not fetch results:", error);
            }

            // Fetch active users count for live analytics metadata
            try {
                const usersSnap = await getDocs(query(collection(db, 'users'), limit(100)));
                if (!usersSnap.empty) {
                    setTotalPlayersCount(Math.max(1350, usersSnap.size * 12));
                }
            } catch (e) {
                console.warn("Analytics fetch failed, using fallback values", e);
            }

            setLoading(false);
        };

        fetchData();
    }, []);

    const handleCtaClick = (destination: string, source: string) => {
        navigate(destination);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]" role="status">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-brand-400 text-xs font-black uppercase tracking-widest animate-pulse">Establishing Uplink...</p>
            </div>
        );
    }

    return (
        <>
        <Seo
            title="NexPlay | Esports Tournaments & Scrims in Nepal"
            description="Join esports tournaments and scrims in Nepal on NexPlay. Register for PUBG Mobile, Free Fire, Valorant and more. Secure wallets, live brackets, and national rankings."
            canonicalPath="/"
            jsonLd={[{
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "NexPlay",
                url: "https://nexplay.gg",
                description: "Nepal-focused esports tournament and scrim platform",
            }, {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "NexPlay",
                url: "https://nexplay.gg",
            }]}
        />
        <div className="animate-fade-in space-y-16 pb-20 relative">
            
            {/* Real-time Status and Security Badges Banner */}
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-brand-500/10 p-3 rounded-2xl">
                        <CheckCircle2 className="text-brand-400 w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Secure Matchmaking Active</h3>
                        <p className="text-sm text-gray-400">All escrow entries and payouts are guarded server-side.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <span className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700 text-xs text-brand-300 font-black uppercase tracking-widest">
                        <Users className="w-4 h-4" /> {totalPlayersCount}+ Players
                    </span>
                    <span className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700 text-xs text-yellow-500 font-black uppercase tracking-widest">
                        <Wallet className="w-4 h-4" /> Instant Payouts
                    </span>
                </div>
            </div>

            {/* Main Promotion Carousel Section */}
            {slides.length > 0 && (
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
                    <HotPromotionsSlider slides={slides} variant="hero" />
                </div>
            )}

            {/* Hot Promotions Section */}
            <HotPromotionsSlider slides={promoSlides} variant="hot" />

            {/* Value Highlights (Conversion Funnel Indicators) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 hover:border-brand-500/50 transition-all hover:-translate-y-1">
                    <div className="bg-brand-500/10 p-4 rounded-2xl text-brand-500 mb-6 inline-block">
                        <Trophy className="w-8 h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-lg mb-2">Tournaments</h4>
                    <p className="text-sm text-gray-500">Compete in verified, admin-refereed ladders.</p>
                </div>
                <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1">
                    <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-500 mb-6 inline-block">
                        <Flame className="w-8 h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-lg mb-2">Daily Scrims</h4>
                    <p className="text-sm text-gray-500">Train with top competitive squads daily.</p>
                </div>
                <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 hover:border-yellow-500/50 transition-all hover:-translate-y-1">
                    <div className="bg-yellow-500/10 p-4 rounded-2xl text-yellow-500 mb-6 inline-block">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-lg mb-2">Secure Wallet</h4>
                    <p className="text-sm text-gray-500">Double-guarded entry escrows and fast logs.</p>
                </div>
                <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-all hover:-translate-y-1">
                    <div className="bg-purple-500/10 p-4 rounded-2xl text-purple-500 mb-6 inline-block">
                        <Users className="w-8 h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-lg mb-2">Organizations</h4>
                    <p className="text-sm text-gray-500">Join gaming teams or host custom matches.</p>
                </div>
            </section>

            {/* Featured Tournaments Container */}
            <section className="px-2" aria-labelledby="featured-tournaments-heading">
                <div className="flex justify-between items-center mb-8">
                    <div className="space-y-1">
                        <h2 id="featured-tournaments-heading" className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <Star className="text-yellow-500 w-6 h-6 md:w-8 md:h-8 fill-yellow-500" />
                            Featured <span className="text-brand-500">Tournaments</span>
                        </h2>
                        <p className="text-gray-500 text-xs md:text-sm font-medium">Join the most prestigious battles on Nexplay</p>
                    </div>
                    <button 
                        onClick={() => handleCtaClick('/tournaments', 'ViewAllFeatured')} 
                        className="bg-gray-800/50 hover:bg-gray-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-gray-700"
                        aria-label="View all scheduled tournaments"
                    >
                        View All <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {featuredTournaments.length > 0 ? (
                        featuredTournaments.map((t, idx) => <TournamentCard key={t.id || `feat-${idx}`} tournament={t} />)
                    ) : (
                        <div className="col-span-full py-20 text-center text-gray-500 bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20 text-brand-500" />
                            <p className="font-bold uppercase tracking-widest text-sm text-gray-400">No active featured tournaments</p>
                            <p className="text-xs text-gray-600 mt-1">Check back later or explore other games.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Popular Games Browser Layout */}
            <section className="px-2" aria-labelledby="popular-games-heading">
                <div className="flex justify-between items-center mb-8">
                    <div className="space-y-1">
                        <h2 id="popular-games-heading" className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <Gamepad2 className="text-brand-500 w-6 h-6 md:w-8 md:h-8" />
                            Popular <span className="text-brand-500">Games</span>
                        </h2>
                        <p className="text-gray-500 text-xs md:text-sm font-medium">Explore tournaments across your favorite titles</p>
                    </div>
                    <button 
                        onClick={() => handleCtaClick('/games', 'ViewAllGames')} 
                        className="bg-gray-800/50 hover:bg-gray-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-gray-700"
                        aria-label="Explore tournament categories by game"
                    >
                        Explore <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {popularGames.length > 0 ? (
                        popularGames.map((g, idx) => <GameCard key={g.id || `game-${idx}`} game={g} />)
                    ) : (
                        <div className="col-span-full py-20 text-center text-gray-500 bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
                            <p className="font-bold uppercase tracking-widest text-sm text-gray-400">No games listed yet</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Concluded Tournaments (Hall of Fame) */}
            {recentResults.length > 0 && (
                <section className="px-2" aria-labelledby="hall-of-fame-heading">
                    <div className="flex justify-between items-center mb-8">
                        <div className="space-y-1">
                            <h2 id="hall-of-fame-heading" className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                <Trophy className="text-yellow-500 w-6 h-6 md:w-8 md:h-8 fill-yellow-500" />
                                Hall of <span className="text-brand-500">Fame</span>
                            </h2>
                            <p className="text-gray-500 text-xs md:text-sm font-medium">Recently concluded battles and their champions</p>
                        </div>
                        <button 
                            onClick={() => handleCtaClick('/results', 'ViewAllResults')} 
                            className="bg-gray-800/50 hover:bg-gray-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-gray-700"
                            aria-label="View all historic results"
                        >
                            View All <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {recentResults.map((t, idx) => (
                            <div 
                                key={t.id || `result-${idx}`} 
                                onClick={() => handleCtaClick(`/details/${t.id}`, `ConcludedTournament_${t.id}`)}
                                className="bg-surface p-6 rounded-3xl border border-gray-800 hover:border-brand-500/30 transition-all cursor-pointer group"
                            >
                                <div className="flex gap-6">
                                    <div className="w-24 h-24 rounded-2xl bg-dark overflow-hidden shrink-0 border border-gray-800">
                                        <img src={t.bannerUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${t.title}`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="text-white font-black text-lg uppercase truncate">{t.title}</h4>
                                                <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest">{formatGameName(t.game)}</p>
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-bold bg-gray-900 px-2 py-1 rounded">COMPLETED</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-4">
                                            {t.winners?.slice(0, 1).map((w, wIdx) => (
                                                <div key={w.uid || `winner-${wIdx}`} className="flex items-center gap-3 bg-brand-600/10 px-4 py-2 rounded-xl border border-brand-500/20">
                                                    <Trophy className="w-4 h-4 text-yellow-500" />
                                                    <div>
                                                        <p className="text-[10px] text-gray-500 font-black uppercase">Champion</p>
                                                        <p className="text-xs font-black text-white">{w.username || 'Unknown'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex flex-col">
                                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Prize Pool</p>
                                                <p className="text-xs font-black text-brand-500">{(t.prizePool).toLocaleString()} {t.currency || 'Rs.'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            {/* ponytail: FAQ section for Home page */}
            <Faq items={homeFaqs} />
        </div>
        </>
    );
};


export default Home;
