import React from 'react';
import { Link } from 'react-router-dom';
import { Tournament } from '../../../shared/types/types';
import { DEFAULT_BANNER } from '../../../shared/constants/constants';
import { formatCurrency, formatDate, formatDateShort, formatGameName, isScrimEvent } from '../../../shared/utils/utils';
import { Clock, Users, Trophy, ChevronRight, Gamepad2, MapPin, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { ScoringInfoCard } from './ScoringInfoCard';
import { getSlotCount, getFilledSlotCount } from '../../../shared/utils/scrimSlots';

interface TournamentCardProps {
    tournament: Tournament;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
    const bannerUrl = tournament.bannerUrl || DEFAULT_BANNER;
    const isLive = tournament.status === 'live';
    const isCompleted = tournament.status === 'completed';
    const statusLabel = isLive ? 'LIVE' : isCompleted ? 'COMPLETED' : 'UPCOMING';

    return (
        <Link to={isScrimEvent(tournament) ? `/scrims/${tournament.id}` : `/tournaments/${tournament.id}`} className="block h-full">
        <motion.div 
            whileHover={{ y: -6, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group relative bg-[#0e1424] rounded-2xl overflow-hidden border border-white/5 hover:border-purple-500/40 transition-all duration-300 cursor-pointer flex flex-col h-full shadow-xl shadow-black/40 hover:shadow-purple-500/10 w-full min-w-0"
        >
            {/* Banner Section */}
            <div className="h-36 sm:h-48 relative overflow-hidden w-full shrink-0">
                <motion.img 
                    src={bannerUrl || undefined} 
                    alt={tournament.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e1424] via-[#0e1424]/40 to-transparent z-10"></div>
                
                {/* Status & Game Badges */}
                <div className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 z-20 flex flex-wrap gap-1.5 sm:gap-2 max-w-[calc(100%-4rem)]">
                    <div className="bg-purple-600/90 backdrop-blur-md px-2.5 sm:px-3 py-1 text-[9px] sm:text-xs uppercase font-black rounded-full text-white border border-purple-500/30 tracking-widest shadow-xl flex items-center gap-1 sm:gap-1.5 shrink-0 min-h-[24px]">
                        <Gamepad2 className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[100px] sm:max-w-none">{formatGameName(tournament.game)}</span>
                    </div>
                    <div className={`backdrop-blur-md px-2.5 sm:px-3 py-1 text-[9px] sm:text-xs uppercase font-black rounded-full text-white border tracking-widest shadow-xl flex items-center gap-1 sm:gap-1.5 shrink-0 min-h-[24px] ${
                        isLive ? 'bg-red-600/90 border-red-500/30 animate-pulse' : 
                        isCompleted ? 'bg-blue-600/90 border-blue-500/30' : 
                        'bg-emerald-600/90 border-emerald-500/30'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLive ? 'bg-white' : 'bg-current'}`}></span>
                        <span>{statusLabel}</span>
                    </div>
                </div>

                {/* Badges - Floating Right */}
                <div className="absolute top-2.5 sm:top-4 right-2.5 sm:right-4 z-20 flex flex-col gap-1 items-end">
                    <div className="bg-white/10 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-white/10 text-[9px] sm:text-xs font-black text-white uppercase tracking-widest min-h-[24px] flex items-center justify-center">
                        {tournament.teamType}
                    </div>
                    {(tournament as any).tournamentMode === 'PER_KILL_REWARD' && (
                        <div className="bg-purple-500/20 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-purple-500/30 text-[9px] sm:text-xs font-black text-purple-300 uppercase tracking-widest min-h-[24px] flex items-center gap-1">
                            <Target className="w-2.5 h-2.5" /> Per-Kill
                        </div>
                    )}
                </div>

                {/* Prize Pool - Large Overlay */}
                <div className="absolute bottom-2 sm:bottom-3.5 left-2.5 sm:left-4 right-2.5 sm:right-4 z-20">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] sm:text-xs text-slate-400 font-black uppercase tracking-widest mb-0.5">Prize Pool</span>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                            <span className="text-lg sm:text-2xl font-black text-white tracking-tight drop-shadow-lg truncate">
                                {formatCurrency(tournament.prizePool)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4 sm:p-5 flex-grow flex flex-col bg-gradient-to-b from-[#0e1424] to-[#070b14] min-w-0">
                <h3 className="text-base sm:text-lg font-black text-white mb-3 group-hover:text-purple-400 transition-colors line-clamp-1 uppercase tracking-wider leading-tight min-w-0 break-words">
                    {tournament.title}
                </h3>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3.5 sm:mb-4">
                    <div className="bg-[#070b14]/70 p-2.5 rounded-xl border border-white/5 group-hover:border-purple-500/20 transition-colors min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase font-black tracking-widest truncate">Format</span>
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-200 font-bold truncate uppercase tracking-tight">
                            {tournament.teamType} • {tournament.type}
                        </div>
                    </div>
                    <div className="bg-[#070b14]/70 p-2.5 rounded-xl border border-white/5 group-hover:border-purple-500/20 transition-colors min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase font-black tracking-widest truncate">Map</span>
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-200 font-bold truncate uppercase tracking-tight">
                            {tournament.map || 'TBD'}
                        </div>
                    </div>
                </div>

                <ScoringInfoCard tournament={tournament} compact />

                <div className="space-y-3 mt-auto pt-3">
                    {/* Progress Section */}
                    <div className="bg-[#070b14]/60 p-3 rounded-xl border border-white/5">
                        <div className="flex justify-between items-end mb-2 gap-2">
                            <div className="flex flex-col min-w-0">
                                <span className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-widest truncate">Entry Fee</span>
                                <span className={`text-xs sm:text-sm font-black truncate ${tournament.entryFee === 0 ? 'text-emerald-400' : 'text-white'}`}>
                                    {tournament.entryFee === 0 ? 'FREE' : formatCurrency(tournament.entryFee)}
                                </span>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Slots</span>
                                <span className="text-xs sm:text-sm font-black text-purple-400">{getFilledSlotCount(tournament)} / {getSlotCount(tournament)}</span>
                            </div>
                        </div>
                        <div className="w-full bg-[#0e1424] rounded-full h-2 overflow-hidden border border-white/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.max(0, (getFilledSlotCount(tournament) / (getSlotCount(tournament) || 1)) * 100))}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="bg-purple-600 h-full rounded-full relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                            </motion.div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 min-w-0">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0" />
                            <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider truncate">
                                {formatDateShort(tournament.startTime)}
                            </span>
                        </div>
                        <div className="inline-flex items-center justify-center min-h-[40px] gap-1.5 bg-purple-600/10 text-purple-400 border border-purple-500/20 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest group-hover:bg-purple-600 group-hover:text-white transition-all duration-300 shrink-0">
                            <span>View Details</span> <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
        </Link>
    );
};

export default TournamentCard;
