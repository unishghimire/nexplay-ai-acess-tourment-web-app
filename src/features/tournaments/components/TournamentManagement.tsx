import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Search, Filter, Plus, Edit, Settings, Trash2, Gamepad } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tournament } from '../../../shared/types/types';
import { formatCurrency, formatGameModeLabel, formatGameName } from '../../../shared/utils/utils';
import TournamentCreateModal from './TournamentCreateModal';

interface TournamentManagementProps {
    hostedTournaments: Tournament[];
    onRefresh: () => void;
    onDelete: (t: Tournament) => void;
    defaultMatchType?: 'tournament' | 'scrims';
}

export default function TournamentManagement({ hostedTournaments, onRefresh, onDelete, defaultMatchType = 'tournament' }: TournamentManagementProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

    const filteredTournaments = hostedTournaments.filter(t => 
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.game.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gray-950/50 p-6 rounded-[2rem] border border-gray-800">
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="Search tournaments..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-full py-4 pl-12 pr-6 text-xs font-black text-white focus:border-brand-500 outline-none transition-all placeholder:text-gray-700"
                        />
                    </div>
                </div>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full md:w-auto bg-brand-500 hover:bg-brand-400 text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-brand-500/20"
                >
                    <Plus className="w-5 h-5" /> {defaultMatchType === 'scrims' ? 'Create Scrims' : 'Create Tournament'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredTournaments.length > 0 ? (
                        filteredTournaments.map((t, i) => (
                            <motion.div 
                                key={t.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-gray-950/50 hover:bg-gray-900/50 p-8 rounded-[2rem] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 border border-gray-800 hover:border-brand-500/30 shadow-lg transition-all"
                            >
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full lg:w-auto">
                                    <div className="w-24 h-24 rounded-3xl overflow-hidden bg-black shrink-0 border border-gray-800">
                                        <img 
                                            src={t.bannerUrl || 'https://picsum.photos/seed/esports/200/200'} 
                                            alt={t.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-4 mb-3">
                                            <h3 className="font-black text-white text-2xl tracking-tighter uppercase truncate">{t.title}</h3>
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] uppercase font-black tracking-widest ${
                                                t.status === 'live' ? 'bg-red-500/10 text-red-500' : 
                                                t.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
                                                'bg-brand-500/10 text-brand-400'
                                            }`}>
                                                {t.status}
                                            </span> 
                                        </div>
                                        <div className="flex flex-wrap gap-4 items-center text-xs font-black text-gray-500 uppercase tracking-widest">
                                            <span className="flex items-center gap-2"><Gamepad className="w-4 h-4" /> {formatGameName(t.game)}</span>
                                            <span className="text-gray-700">•</span>
                                            <span className="text-gray-400">{t.teamType}</span>
                                            <span className="text-gray-700">•</span>
                                            <span className="text-gray-400">{formatGameModeLabel(t.type)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full lg:w-auto gap-8 border-t lg:border-t-0 border-gray-800 pt-8 lg:pt-0">
                                    <div className="grid grid-cols-2 gap-12 w-full sm:w-auto">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Participants</span>
                                            <span className="text-xl font-black text-white flex gap-1 font-mono tracking-tighter">
                                                {t.currentPlayers}<span className="text-gray-700">/{t.slots}</span>
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Prize Pool</span>
                                            <span className="text-xl font-black text-brand-400 font-mono tracking-tighter">{formatCurrency(t.prizePool)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 w-full sm:w-auto">
                                        <button 
                                            onClick={() => {
                                                setSelectedTournament(t);
                                                setIsCreateModalOpen(true);
                                            }}
                                            className="flex-1 sm:flex-none flex items-center justify-center p-4 rounded-full bg-black border border-gray-800 text-gray-500 hover:text-white hover:border-brand-500 hover:bg-brand-500/10 transition-all"
                                            title="Edit Info"
                                        >
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        <Link 
                                            to={`/tournament-admin/${t.id}`}
                                            className="flex-[2] sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all"
                                        >
                                            <Settings className="w-5 h-5" /> Manage
                                        </Link>
                                        <button 
                                            onClick={() => onDelete(t)}
                                            className="flex-1 sm:flex-none flex items-center justify-center p-4 rounded-full bg-black border border-gray-800 text-gray-500 hover:text-white hover:border-red-500 hover:bg-red-500/10 transition-all"
                                            title="Delete Tournament"
                                        >
                                            <Trash2 className="w-5 h-5 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center bg-gray-950/50 rounded-[2rem] border border-gray-800">
                            <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-8">
                                <Trophy className="w-12 h-12 text-gray-700" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter">{defaultMatchType === 'scrims' ? 'No Scrims Found' : 'No Tournaments Found'}</h3>
                            <p className="text-gray-500 max-w-sm mb-10 font-bold text-sm tracking-wide uppercase">
                                {searchTerm ? `No results for "${searchTerm}"` : `You haven't created any ${defaultMatchType === 'scrims' ? 'scrims' : 'tournaments'} yet.`}
                            </p>
                            {!searchTerm && (
                                <button 
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="text-white bg-brand-500 px-10 py-4 rounded-full font-black text-xs uppercase tracking-widest hover:bg-brand-400 transition-all hover:scale-105 shadow-lg shadow-brand-500/20"
                                >
                                    {defaultMatchType === 'scrims' ? 'Create Your First Scrim' : 'Create Your First Tournament'}
                                </button>
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <TournamentCreateModal 
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setSelectedTournament(null);
                }}
                onSuccess={onRefresh}
                editTournament={selectedTournament}
                defaultMatchType={defaultMatchType}
            />
        </div>
    );
}
