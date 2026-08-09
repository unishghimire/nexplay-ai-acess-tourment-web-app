import React from 'react';
import {Users, X, Search, Edit, Megaphone, Trophy} from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, setDoc, serverTimestamp, increment, getDoc, writeBatch, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../shared/config/firebase';
import {  } from '../../../../shared/utils/utils';
import { } from '../../../../shared/components/ImageUploader';
import {} from '../../../../shared/services/mediaService';

import { AdminPanelTabProps } from './types';

export const TournamentsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { allTournaments, formatGameName, handleCancelTournament, handleEditTournament, handleToggleFeatured, handleViewParticipants, searchQuery, setSearchQuery } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Trophy className="text-brand-500" /> All Tournaments
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    type="text" 
                                    placeholder="Search tournaments..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-brand-500 outline-none w-64"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allTournaments
                            .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(t => (
                                <div key={t.id} className="bg-dark p-4 rounded-xl border border-gray-800 space-y-3">
                                    <img src={t.bannerUrl || undefined} className="w-full aspect-video object-cover rounded-lg" alt={t.title} />
                                    <div>
                                        <h3 className="font-bold text-white truncate">{t.title}</h3>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">{formatGameName(t.game)}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    t.status === 'upcoming' ? 'bg-blue-600/20 text-blue-400' :
                                                    t.status === 'live' ? 'bg-green-600/20 text-green-400' :
                                                    t.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                                                    'bg-gray-600/20 text-gray-400'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleViewParticipants(t)}
                                                        className="p-1.5 bg-brand-600/20 hover:bg-brand-600 text-brand-500 hover:text-white rounded-lg transition-all border border-brand-500/30"
                                                        title="View Participants"
                                                    >
                                                        <Users className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditTournament(t)}
                                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/30"
                                                        title="Edit Tournament"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleToggleFeatured(t)}
                                                        className={`p-1.5 rounded-lg transition-all border ${
                                                            t.isFeatured 
                                                                ? 'bg-yellow-600/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-600 hover:text-white' 
                                                                : 'bg-gray-600/20 text-gray-400 border-gray-500/30 hover:bg-gray-600 hover:text-white'
                                                        }`}
                                                        title={t.isFeatured ? "Unfeature" : "Feature"}
                                                    >
                                                        <Megaphone className="w-3 h-3" />
                                                    </button>
                                                    {t.status !== 'cancelled' && t.status !== 'completed' && (
                                                        <button 
                                                            onClick={() => handleCancelTournament(t)}
                                                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/30"
                                                            title="Cancel Tournament"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
    );
};
