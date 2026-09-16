import React from 'react';
import { Link } from 'react-router-dom';
import { Game } from '../../../shared/types/types';
import { motion } from 'motion/react';
import { formatGameModeLabel, formatGameName } from '../../../shared/utils/utils';

interface GameCardProps {
    game: Game;
    className?: string;
}

const getGameRibbon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('free fire')) return { label: 'MAX', color: 'bg-[#facc15] text-black' };
    if (lower.includes('pubg')) return { label: 'PRO', color: 'bg-amber-400 text-black' };
    if (lower.includes('legends') || lower.includes('mlbb')) return { label: 'HOT', color: 'bg-purple-600 text-white' };
    return null;
};

const GameCard: React.FC<GameCardProps> = ({ game, className = '' }) => {
    const ribbon = getGameRibbon(game.name);

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className={`bg-[#131b2e]/90 rounded-2xl overflow-hidden border border-slate-800 hover:border-purple-500/50 transition-all duration-300 group shadow-xl relative flex flex-col justify-between ${className}`}
        >
            <Link
                to={`/games/${game.id}`}
                aria-label={`View ${formatGameName(game.name)} details`}
                className="block focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none h-full flex flex-col justify-between"
            >
                {ribbon && (
                    <div className="corner-ribbon font-black z-20" style={{ transform: 'rotate(-45deg)' }}>
                        <span className={`block py-0.5 px-2 text-[9px] font-black uppercase tracking-wider ${ribbon.color} shadow-md`}>
                            {ribbon.label}
                        </span>
                    </div>
                )}

                <div className="relative h-32 sm:h-44 w-full overflow-hidden bg-slate-900 shrink-0">
                    <img
                        src={game.logoUrl || ''}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131b2e] via-[#131b2e]/40 to-transparent"></div>
                    
                    {/* Live status badge */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-[#090e1a]/85 backdrop-blur-md px-2 py-0.5 rounded-full border border-emerald-400/30 z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Active</span>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3 z-10">
                        <h3 className="text-sm sm:text-base font-black text-white drop-shadow-md truncate uppercase tracking-tight">
                            {formatGameName(game.name)}
                        </h3>
                    </div>
                </div>

                <div className="p-3 sm:p-4 space-y-2.5 flex-1 flex flex-col justify-between" aria-hidden="true">
                    <div className="flex flex-wrap gap-1.5">
                        {game.modes.slice(0, 3).map((mode) => (
                            <span
                                key={mode}
                                className="px-2 py-0.5 bg-[#162138] text-slate-200 text-[10px] font-bold uppercase rounded border border-slate-700/60 tracking-wider"
                            >
                                {formatGameModeLabel(mode)}
                            </span>
                        ))}
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center min-w-0">
                        <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider truncate">
                            {game.modes.length} Modes
                        </span>
                        <span className="text-[11px] sm:text-xs font-black text-purple-400 group-hover:text-purple-300 uppercase tracking-wide flex items-center gap-1 transition-transform group-hover:translate-x-0.5 shrink-0">
                            Explore <span aria-hidden="true">→</span>
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
};

export default GameCard;
