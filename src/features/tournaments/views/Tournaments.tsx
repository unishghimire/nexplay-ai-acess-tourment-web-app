import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament, Game } from '../../../shared/types/types';
import TournamentCard from '../components/TournamentCard';
import { Filter, Search } from 'lucide-react';
import { formatGameModeLabel, formatGameName, toDateSafe } from '../../../shared/utils/utils';

const Tournaments: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    
    const [gameFilter, setGameFilter] = useState(searchParams.get('game') || 'all');
    const [modeFilter, setModeFilter] = useState(searchParams.get('mode') || 'all');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
    const [entryFilter, setEntryFilter] = useState(searchParams.get('entry') || 'all');
    const [teamTypeFilter, setTeamTypeFilter] = useState(searchParams.get('teamType') || 'all');
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const startTime = performance.now();
            try {
                const [tournamentsSnap, gamesSnap] = await Promise.all([
                    getDocs(collection(db, 'tournaments')),
                    getDocs(query(collection(db, 'games'), where('isPublished', '==', true)))
                ]);
                
                let tours = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                
                tours.sort((a, b) => {
                    if (a.status === 'live' && b.status !== 'live') return -1;
                    if (b.status === 'live' && a.status !== 'live') return 1;
                    return (toDateSafe(a.startTime)?.getTime() || 0) - (toDateSafe(b.startTime)?.getTime() || 0);
                });

                setTournaments(tours);
                setGames(gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game)));
            } catch (error: any) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        if (gameFilter !== 'all') params.set('game', gameFilter);
        if (modeFilter !== 'all') params.set('mode', modeFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (entryFilter !== 'all') params.set('entry', entryFilter);
        if (teamTypeFilter !== 'all') params.set('teamType', teamTypeFilter);
        setSearchParams(params, { replace: true });
    }, [gameFilter, modeFilter, statusFilter, entryFilter, teamTypeFilter, setSearchParams]);

    const filteredTournaments = tournaments.filter(t => {
        const matchesGame = gameFilter === 'all' || t.game === gameFilter;
        const matchesMode = modeFilter === 'all' || t.type === modeFilter;
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        const matchesEntry = entryFilter === 'all' || (entryFilter === 'free' ? t.entryFee === 0 : t.entryFee > 0);
        const matchesTeamType = teamTypeFilter === 'all' || t.teamType === teamTypeFilter;
        
        return matchesGame && matchesMode && matchesStatus && matchesEntry && matchesTeamType;
    });

    const statusTabs = [
        { id: 'all',       label: 'All',      count: tournaments.length },
        { id: 'upcoming',  label: 'Upcoming', count: tournaments.filter(t => t.status === 'upcoming').length },
        { id: 'live',      label: 'Live Now', count: tournaments.filter(t => t.status === 'live').length },
        { id: 'completed', label: 'Ended',    count: tournaments.filter(t => t.status === 'completed').length }
    ];

    const selectedGameObj = games.find(g => g.name === gameFilter);
    const availableModes = selectedGameObj ? selectedGameObj.modes : Array.from(new Set(games.flatMap(g => g.modes)));

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-brand-500 text-xs font-black uppercase tracking-widest animate-pulse">Establishing Uplink...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-7xl mx-auto p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-gray-800 pb-8">
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Tournament Browser</h1>
                <div className="flex items-center gap-3 text-xs font-black text-gray-500 uppercase tracking-widest">
                    <span>{filteredTournaments.length} tournament{filteredTournaments.length !== 1 ? 's' : ''}</span>
                    {tournaments.filter(t => t.status === 'live').length > 0 && (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />
                            {tournaments.filter(t => t.status === 'live').length} Live
                        </span>
                    )}
                </div>
            </header>

            <div className="flex items-center gap-1 border-b border-gray-800 mb-10 overflow-x-auto">
                {statusTabs.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setStatusFilter(s.id)}
                        className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            statusFilter === s.id
                                ? 'text-white border-b-2 border-brand-500'
                                : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        {s.label}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black tabular-nums ${
                            statusFilter === s.id
                                ? s.id === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-brand-500/20 text-brand-400'
                                : 'bg-gray-800 text-gray-600'
                        }`}>
                            {s.count}
                        </span>
                    </button>
                ))}
            </div>

            <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 mb-12">
                <div className="flex items-center gap-3 mb-8">
                    <Filter className="w-5 h-5 text-brand-500" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Filter Options</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Game</label>
                        <select 
                            aria-label="Filter tournaments by game"
                            value={gameFilter}
                            onChange={(e) => {
                                setGameFilter(e.target.value);
                                setModeFilter('all');
                            }}
                            className="w-full bg-black border border-gray-800 rounded-2xl p-4 text-white focus:border-brand-500 outline-none transition text-sm font-bold"
                        >
                            <option value="all">All Games</option>
                            {games.map(g => <option key={g.id} value={g.name}>{formatGameName(g.name)}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Mode</label>
                        <select 
                            aria-label="Filter tournaments by mode"
                            value={modeFilter}
                            onChange={(e) => setModeFilter(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-2xl p-4 text-white focus:border-brand-500 outline-none transition text-sm font-bold"
                            disabled={gameFilter === 'all' && availableModes.length === 0}
                        >
                            <option value="all">All Modes</option>
                            {availableModes.map(m => <option key={m} value={m}>{formatGameModeLabel(m)}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Entry</label>
                        <select 
                            aria-label="Filter tournaments by entry type"
                            value={entryFilter}
                            onChange={(e) => setEntryFilter(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-2xl p-4 text-white focus:border-brand-500 outline-none transition text-sm font-bold"
                        >
                            <option value="all">All Types</option>
                            <option value="free">Free Entry</option>
                            <option value="paid">Paid Entry</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Player Size</label>
                        <select 
                            aria-label="Filter tournaments by player size"
                            value={teamTypeFilter}
                            onChange={(e) => setTeamTypeFilter(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-2xl p-4 text-white focus:border-brand-500 outline-none transition text-sm font-bold"
                        >
                            <option value="all">All Sizes</option>
                            <option value="solo">Solo</option>
                            <option value="duo">Duo</option>
                            <option value="squad">Squad</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 min-h-[50vh]">
                {filteredTournaments.length > 0 ? (
                    filteredTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)
                ) : (
                    <div className="col-span-full py-20 bg-gray-900/50 rounded-3xl border border-gray-800 text-center">
                        <Search className="w-16 h-16 text-gray-700 mx-auto mb-6" />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">No Matches Found</h3>
                        <p className="text-gray-500 font-bold mt-2">Adjust your filters to see more tournaments.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tournaments;
