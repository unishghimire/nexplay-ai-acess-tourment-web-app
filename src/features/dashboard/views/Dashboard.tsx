import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament } from '../../../shared/types/types';
import { 
    formatCurrency, 
    formatDateShort, 
    formatGameName, 
    toDateSafe, 
    isTournamentEvent, 
    isScrimEvent,
    calculateLevel,
    getLevelProgress,
    getXPForNextLevel,
    getCurrentSeasonId,
    formatSeasonLabel
} from '../../../shared/utils/utils';
import { useNavigate } from 'react-router-dom';
import { Trophy, Eye, BarChart, User, Shield, Users, AlertCircle, Calendar, Clock, Swords, Zap, Award } from 'lucide-react';
import TournamentResultModal from '../../tournaments/components/TournamentResultModal';
import { Seo } from '../../../shared/components/Seo';
import { fetchRoomCredentials } from '../../../shared/services/roomCredentials';

const Dashboard: React.FC = () => {
    const { user, profile } = useAuth();
    const [myTournaments, setMyTournaments] = useState<(Tournament & { registration?: any })[]>([]);
    const [dashboardFilter, setDashboardFilter] = useState<'all' | 'tournaments' | 'scrims'>('all');
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [viewResultTournament, setViewResultTournament] = useState<Tournament | null>(null);
    const navigate = useNavigate();

    const getEventLink = (t: Tournament) => isScrimEvent(t) ? `/scrims/${t.id}` : `/tournaments/${t.id}`;

    const fetchAllData = async () => {
        if (!user) return;
        setFetchError(null);
        try {
            // Fetch Joined Tournaments
            const partSnap = await getDocs(query(
                collection(db, 'participants'),
                where('userId', '==', user.uid)
            ));
            
            const partDocs = partSnap.docs.map(doc => doc.data());
            partDocs.sort((a, b) => {
                const aTime = toDateSafe(a.timestamp)?.getTime() || 0;
                const bTime = toDateSafe(b.timestamp)?.getTime() || 0;
                return bTime - aTime;
            });
            const joinedTours: (Tournament & { role: 'participant' | 'organizer'; registration?: any })[] = [];
            const tournamentIds = partDocs.map(data => data.tournamentId);
            const uniqueTournamentIds = [...new Set(tournamentIds)];
            
            if (uniqueTournamentIds.length > 0) {
                const chunks = [];
                for (let i = 0; i < uniqueTournamentIds.length; i += 10) {
                    chunks.push(uniqueTournamentIds.slice(i, i + 10));
                }
                
                for (const chunk of chunks) {
                    const q = query(collection(db, 'tournaments'), where('__name__', 'in', chunk));
                    const tSnap = await getDocs(q);
                    const foundIds = new Set(tSnap.docs.map(d => d.id));
                    
                    tSnap.docs.forEach(tDoc => {
                        // Find the corresponding participant record
                        const pDoc = partSnap.docs.find(p => p.data().tournamentId === tDoc.id);
                        if (pDoc) {
                            joinedTours.push({ 
                                id: tDoc.id, 
                                ...tDoc.data(), 
                                role: 'participant',
                                registration: pDoc.data() 
                             } as Tournament & { role: 'participant' | 'organizer'; registration?: any });
                        }
                    });

                    const missingIds = chunk.filter(id => !foundIds.has(id));
                    if (missingIds.length > 0) {
                        try {
                            const scrimsQ = query(collection(db, 'scrims'), where('__name__', 'in', missingIds));
                            const sSnap = await getDocs(scrimsQ);
                            sSnap.docs.forEach(sDoc => {
                                const pDoc = partSnap.docs.find(p => p.data().tournamentId === sDoc.id);
                                if (pDoc) {
                                    joinedTours.push({
                                        id: sDoc.id,
                                        ...sDoc.data(),
                                        role: 'participant',
                                        registration: pDoc.data()
                                    } as Tournament & { role: 'participant' | 'organizer'; registration?: any });
                                }
                            });
                        } catch (scrimErr) {
                            console.warn("Scrims collection query fallback:", scrimErr);
                        }
                    }
                }
            }

            // Only joined tournaments are shown in player dashboard
            const uniqueTours = joinedTours.filter((t, index, self) => 
                index === self.findIndex((m) => m.id === t.id)
            );
            
            const tournamentsWithCredentials = await Promise.all(uniqueTours.map(async tournament => {
                if (tournament.status !== 'live' && tournament.status !== 'upcoming') return tournament;
                const credentials = await fetchRoomCredentials(tournament.id);
                return credentials ? { ...tournament, ...credentials } : tournament;
            }));
            setMyTournaments(tournamentsWithCredentials);

        } catch (error: any) {
            console.error("Error fetching dashboard data:", error);
            setFetchError(error?.message || "Something went wrong while loading your dashboard.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [user, profile]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Dashboard...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/30">
                    <AlertCircle className="w-7 h-7" />
                </div>
                <p className="text-sm text-gray-400 font-bold max-w-md">{fetchError}</p>
                <button
                    onClick={fetchAllData}
                    className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-black font-black uppercase tracking-widest rounded-xl transition"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-5xl mx-auto px-1 sm:px-4 pb-20 space-y-6">
            <Seo title="Dashboard | NexPlay" description="Your personal esports dashboard" noindex />

            {/* Dashboard Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4" data-purpose="dashboard-heading">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="inline-block bg-[#162a63] border border-blue-500/40 px-3.5 py-1 rounded-lg shadow-sm">
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase">MY DASHBOARD</h1>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-purple-400" /> {formatSeasonLabel(profile?.seasonId || getCurrentSeasonId())}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">Manage your competitive events and shortcuts</p>
                </div>

                {/* Player/Org Level & EXP Progress Card */}
                {profile && (
                    <div 
                        onClick={() => navigate('/profile')}
                        className="bg-gradient-to-r from-[#11192e] to-[#0d1527] border border-slate-800 hover:border-purple-500/40 p-3 sm:px-4 sm:py-2.5 rounded-2xl shadow-lg flex items-center gap-4 cursor-pointer group transition-all"
                    >
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-purple-500/20 text-purple-300 text-xs font-black px-2 py-0.5 rounded-md border border-purple-500/40 uppercase tracking-widest flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-purple-400" /> LVL {profile.level || calculateLevel(profile.xp)}
                                </span>
                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                    Tier {profile.level || calculateLevel(profile.xp)} Challenger
                                </span>
                            </div>
                            <div className="w-36 sm:w-44 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800 mb-0.5">
                                <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full"
                                    style={{ width: `${Math.max(5, getLevelProgress(profile.xp || 0))}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 font-semibold font-mono">
                                <span>{(profile.xp || 0).toLocaleString()} XP</span>
                                <span>{getXPForNextLevel(profile.level || calculateLevel(profile.xp)).toLocaleString()} XP</span>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Quick Actions Grid (2x2 on mobile, 4-col on md+) */}
            <section data-purpose="quick-actions-grid">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {[
                        { title: 'PROFILE', icon: User, path: '/profile' },
                        { title: 'TEAMS', icon: Users, path: '/teams' },
                        { title: 'TOURNAMENTS', icon: Trophy, path: '/tournaments' },
                        { title: 'LEADERBOARD', icon: BarChart, path: '/leaderboard' },
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => navigate(item.path)}
                            className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl bg-gradient-to-b from-[#11192e] to-[#0c1220] border border-slate-800 hover:border-purple-500/50 active:scale-[0.98] transition cursor-pointer group shadow-xl"
                        >
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#090d18] border border-slate-700/60 flex items-center justify-center mb-3 shadow-inner group-hover:border-purple-500 transition">
                                <item.icon className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400 group-hover:text-purple-300 transition" />
                            </div>
                            <span className="inline-block px-3 py-1 rounded-md bg-[#162758] border border-blue-500/30 text-[10px] sm:text-[11px] font-black tracking-wider text-white uppercase group-hover:border-blue-400 transition">
                                {item.title}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Divider */}
            <div className="h-px w-full bg-slate-800/80" />

            {/* My Events Section */}
            <section className="space-y-4" data-purpose="my-events-container">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="inline-block bg-[#162a63] border border-blue-500/40 px-3 py-1 rounded-lg shadow-sm self-start">
                        <h2 className="text-base sm:text-lg font-black text-white tracking-wider uppercase">MY EVENTS</h2>
                    </div>

                    {/* Filter Tab Buttons */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                            type="button"
                            onClick={() => setDashboardFilter('all')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition whitespace-nowrap ${
                                dashboardFilter === 'all'
                                    ? 'bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 text-white shadow-md shadow-purple-900/30'
                                    : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            ALL ({myTournaments.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDashboardFilter('tournaments')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition whitespace-nowrap ${
                                dashboardFilter === 'tournaments'
                                    ? 'bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 text-white shadow-md shadow-purple-900/30'
                                    : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            TOURNAMENTS ({myTournaments.filter(t => !isScrimEvent(t)).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDashboardFilter('scrims')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition whitespace-nowrap ${
                                dashboardFilter === 'scrims'
                                    ? 'bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 text-white shadow-md shadow-purple-900/30'
                                    : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            SCRIMS ({myTournaments.filter(t => isScrimEvent(t)).length})
                        </button>
                    </div>
                </div>

                {/* Event Cards List */}
                <div className="space-y-4">
                    {(() => {
                        const displayedEvents = myTournaments.filter(t => {
                            if (dashboardFilter === 'tournaments') return !isScrimEvent(t);
                            if (dashboardFilter === 'scrims') return isScrimEvent(t);
                            return true;
                        });

                        if (displayedEvents.length === 0) {
                            return (
                                <div className="bg-[#0c1322]/80 p-8 sm:p-12 rounded-2xl border border-dashed border-slate-800 text-center">
                                    <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-400 font-bold uppercase tracking-wider text-xs sm:text-sm">
                                        No {dashboardFilter === 'all' ? 'events' : dashboardFilter} joined yet.
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">Explore tournaments or daily scrims to compete.</p>
                                </div>
                            );
                        }

                        return displayedEvents.map(t => {
                            const isLive = t.status === 'live';
                            const isCompleted = t.status === 'completed';
                            const isScrim = isScrimEvent(t);
                            const showRoom = isLive || (t.status === 'upcoming' && t.roomId);

                            return (
                                <article
                                    key={t.id}
                                    className="relative rounded-2xl bg-gradient-to-b from-[#0c1322] to-[#080d1a] border border-slate-800 p-4 sm:p-6 shadow-xl hover:border-slate-700 transition"
                                >
                                    {/* Badges Row */}
                                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                            isScrim
                                                ? 'bg-blue-900/60 border-blue-500/50 text-blue-300'
                                                : 'bg-purple-900/60 border-purple-500/50 text-purple-300'
                                        }`}>
                                            {isScrim ? 'SCRIM' : 'TOURNAMENT'}
                                        </span>

                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-semibold text-blue-300">
                                            <User className="w-3 h-3 text-blue-400" /> PARTICIPANT
                                        </span>

                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-bold uppercase text-slate-300">
                                            {formatGameName(t.game)}
                                        </span>

                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-bold uppercase text-slate-300">
                                            {t.teamType || 'SOLO'}
                                        </span>
                                    </div>

                                    {/* Event Title & Prize */}
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2.5">
                                        <h3
                                            onClick={() => navigate(getEventLink(t))}
                                            className="text-base sm:text-lg font-black text-white hover:text-purple-300 transition cursor-pointer tracking-wide leading-snug truncate"
                                        >
                                            {t.title}
                                        </h3>
                                        <div className="text-sm sm:text-base font-black text-emerald-400 shrink-0">
                                            {formatCurrency(t.prizePool)}
                                        </div>
                                    </div>

                                    {/* Participant Metadata */}
                                    {t.registration && (
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-300 mb-3 uppercase tracking-wider">
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400">TEAM:</span>
                                                <span className="text-white font-extrabold">{t.registration.teamName || 'SOLO'}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400">UID:</span>
                                                <span className="text-emerald-400 font-semibold break-all">{t.registration.inGameId || '[Verified]'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Status & Schedule Row */}
                                    <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-300 mb-3">
                                        <span className={`inline-flex items-center gap-1.5 font-black tracking-wider ${
                                            isLive
                                                ? 'text-emerald-400 animate-pulse'
                                                : isCompleted
                                                    ? 'text-slate-500'
                                                    : 'text-cyan-400'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${
                                                isLive ? 'bg-emerald-400 ring-2 ring-emerald-500/30 animate-pulse' : isCompleted ? 'bg-slate-600' : 'bg-cyan-400 ring-2 ring-cyan-500/30'
                                            }`} />
                                            {isLive ? 'LIVE NOW' : isCompleted ? 'ENDED' : 'UPCOMING'}
                                        </span>

                                        {t.startTime && (
                                            <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
                                                <Clock className="w-3.5 h-3.5 text-purple-400" />
                                                <span>{formatDateShort(t.startTime)}</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Room Credentials Box */}
                                    {showRoom && (
                                        <div className="mt-3 bg-[#080d18] p-3 rounded-xl border border-slate-800 flex flex-wrap sm:flex-nowrap gap-4 sm:gap-8 text-xs font-mono items-center justify-center">
                                            <div>
                                                <span className="text-slate-500 uppercase font-black tracking-wider text-[11px]">Room ID:</span>{' '}
                                                <span className="text-white font-bold select-all ml-2">{t.roomId || 'Pending'}</span>
                                            </div>
                                            <div className="hidden sm:block w-px h-4 bg-slate-800" />
                                            <div>
                                                <span className="text-slate-500 uppercase font-black tracking-wider text-[11px]">Password:</span>{' '}
                                                <span className="text-white font-bold select-all ml-2">{t.roomPass || 'Pending'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => navigate(getEventLink(t))}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-200 uppercase tracking-wider transition"
                                        >
                                            <Eye className="w-3.5 h-3.5 text-indigo-400" /> View Details
                                        </button>

                                        {isCompleted && (
                                            <button
                                                type="button"
                                                onClick={() => setViewResultTournament(t)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-950/60 border border-blue-500/40 hover:bg-blue-800/40 text-xs font-bold text-blue-300 uppercase tracking-wider transition"
                                            >
                                                <BarChart className="w-3.5 h-3.5 text-blue-400" /> View Result
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        });
                    })()}
                </div>
            </section>

            {viewResultTournament && (
                <TournamentResultModal
                    isOpen={!!viewResultTournament}
                    onClose={() => setViewResultTournament(null)}
                    tournament={viewResultTournament}
                />
            )}
        </div>
    );
};

export default Dashboard;
