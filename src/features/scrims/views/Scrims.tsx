import Seo from '../../../shared/components/Seo';
import Faq from '../../../shared/components/Faq';
import React, { useEffect, useState } from 'react';
import { Scrim } from '../../../shared/types/types';
import { Trophy, Search, Filter, Calendar, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useNavigate } from 'react-router-dom';


const scrimFaqs = [
    {
        question: 'What are esports scrims?',
        answer: 'Scrims (scrimmages) are practice matches where teams compete in a competitive but non-tournament setting to improve their skills.',
    },
    {
        question: 'How do I join a scrim in Nepal?',
        answer: 'Browse available scrims on NexPlay Scrims page, find one for your game, and register your team. Most scrims are free to join.',
    },
    {
        question: 'What is the difference between scrims and tournaments?',
        answer: 'Tournaments are formal competitions with prizes and rankings. Scrims are practice matches focused on skill development without the pressure of a tournament bracket.',
    },
];


const Scrims: React.FC = () => {
    const [scrims, setScrims] = useState<Scrim[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGame, setFilterGame] = useState('All');
    const { showToast } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchScrims = async () => {
            setLoading(true);
            try {
                // In production, we'd use a server endpoint for better filtering/security
                const response = await fetch('/api/scrims');
                const result = await response.json();
                if (result.success) {
                    setScrims(result.scrims);
                }
            } catch (error: any) {
                console.error("Error fetching scrims:", error);
                showToast("Failed to fetch scrims", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchScrims();
    }, [showToast]);

    const filteredScrims = scrims.filter(s => {
        const matchesSearch = s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             s.game.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGame = filterGame === 'All' || s.game === filterGame;
        return matchesSearch && matchesGame;
    });

    return (
        <>
        <Seo
            title="Esports Scrims in Nepal | NexPlay"
            description="Find and join esports scrims in Nepal. Practice matches for PUBG Mobile, Free Fire, Valorant and more on NexPlay. Free daily scrims with instant matchmaking."
            canonicalPath="/scrims"
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: [
                    {
                        "@type": "Question",
                        name: "What are esports scrims?",
                        acceptedAnswer: {
                            "@type": "Answer",
                            text: "Scrims are practice matches where teams compete against each other to improve skills without the pressure of a tournament. NexPlay hosts daily scrims for popular esports titles in Nepal."
                        }
                    },
                    {
                        "@type": "Question",
                        name: "Are NexPlay scrims free?",
                        acceptedAnswer: {
                            "@type": "Answer",
                            text: "Yes, NexPlay offers free daily scrims. Simply join a scrim room, connect with your team, and start practicing."
                        }
                    },
                    {
                        "@type": "Question",
                        name: "How do I join a scrim on NexPlay?",
                        acceptedAnswer: {
                            "@type": "Answer",
                            text: "Browse the scrims page, find an open scrim matching your game and skill level, and click Join. You may need a registered team for squad-based scrims."
                        }
                    }
                ]
            }}
        />
        <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
            <header className="mb-12 border-b border-gray-800 pb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none mb-2">Daily Scrims</h1>
                        <p className="text-gray-400 font-bold max-w-lg">
                            Practice like a pro. Join high-tier scrims and test your team strategy.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-card/50 px-6 py-3 rounded-2xl border border-gray-800">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <span className="text-white font-black tracking-widest uppercase text-sm">1,420 ELO</span>
                    </div>
                </div>
            </header>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12 bg-card/50 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800">
                <div className="md:col-span-8 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                        type="text" 
                        aria-label="Search scrims"
                        placeholder="Search by title or game..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:border-brand-500 outline-none transition-all shadow-xl font-bold"
                    />
                </div>
                <div className="md:col-span-4 relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <select 
                        aria-label="Filter scrims by game"
                        value={filterGame}
                        onChange={(e) => {
                            const val = e.target.value;
                            setFilterGame(val);
                        }}
                        className="w-full bg-black border border-gray-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:border-brand-500 outline-none transition-all shadow-xl font-bold appearance-none"
                    >
                        <option value="All">All Games</option>
                        <option value="PUBG Mobile">PUBG Mobile</option>
                        <option value="Free Fire">Free Fire</option>
                        <option value="Mobile Legends">Mobile Legends</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="bg-card/50 h-[400px] rounded-3xl animate-pulse border border-gray-800"></div>
                    ))}
                </div>
            ) : filteredScrims.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredScrims.map((scrim) => (
                        <motion.div 
                            key={scrim.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            onClick={() => {
                                navigate(`/details/${scrim.tournamentId || scrim.id}`);
                            }}
                            className="bg-card/50 rounded-[2rem] border border-gray-800 overflow-hidden cursor-pointer group hover:border-brand-500/50 transition-all hover:bg-card"
                        >
                            <div className="h-48 relative overflow-hidden">
                                <img 
                                    src={scrim.bannerUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80'} 
                                    alt={scrim.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent"></div>
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <span className="bg-brand-500/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-brand-300 border border-brand-500/20">
                                        {formatGameName(scrim.game)}
                                    </span>
                                    <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/10">
                                        {scrim.type}
                                    </span>
                                </div>
                                <div className="absolute bottom-4 left-4 right-4 justify-between items-end">
                                    <div className="text-[10px] text-brand-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {formatDate(scrim.time)}
                                    </div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight line-clamp-1">{scrim.title || 'Official Scrim'}</h3>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div className="bg-black p-3 rounded-2xl border border-gray-800">
                                        <div className="text-[9px] text-gray-500 uppercase font-black mb-1">Entry</div>
                                        <div className="text-white font-black">{scrim.entryFee === 0 ? 'FREE' : formatCurrency(scrim.entryFee || 0)}</div>
                                    </div>
                                    <div className="bg-black p-3 rounded-2xl border border-gray-800">
                                        <div className="text-[9px] text-gray-500 uppercase font-black mb-1">Prize Pool</div>
                                        <div className="text-brand-400 font-black">{formatCurrency(scrim.prizePool || 0)}</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase">{scrim.currentSlots || 0} / {scrim.slots} Joined</span>
                                    <div className="w-24 bg-black rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className="bg-brand-500 h-full rounded-full" 
                                            style={{ width: `${((scrim.currentSlots || 0) / (scrim.slots || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <button className="w-full bg-brand-500/10 group-hover:bg-brand-500 text-brand-300 group-hover:text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-brand-500/20 group-hover:border-brand-500">
                                    Join Scrim
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="bg-card/50 p-12 rounded-3xl border border-gray-800 text-center">
                    <Gamepad2 className="w-16 h-16 text-gray-700 mx-auto mb-6" />
                    <h3 className="text-2xl font-black text-white uppercase mb-2">No Scrims Available</h3>
                    <p className="text-gray-500 font-bold max-w-sm mx-auto mb-8">
                        There are no active scrims at the moment. Check back later or host your own practice match.
                    </p>
                    <button 
                        onClick={() => setFilterGame('All')}
                        className="text-brand-500 font-black uppercase tracking-widest hover:text-brand-400 transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
            )}
            {/* ponytail: FAQ section for Scrims page */}
            <Faq items={scrimFaqs} />
        </div>
        </>
    );

};

export default Scrims;
