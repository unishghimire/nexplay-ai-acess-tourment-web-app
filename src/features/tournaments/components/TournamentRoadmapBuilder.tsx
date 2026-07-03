import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Plus, Trash2, MapIcon, ChevronRight } from 'lucide-react';
import { Tournament, RoundConfig } from '../../../shared/types/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useNotification } from '../../../shared/context/NotificationContext';

interface TournamentRoadmapBuilderProps {
    tournament: Tournament;
    onUpdate: () => void;
}

export default function TournamentRoadmapBuilder({ tournament, onUpdate }: TournamentRoadmapBuilderProps) {
    const { showToast } = useNotification();
    const [roadmap, setRoadmap] = useState<RoundConfig[]>(tournament.roadmap || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddRound = () => {
        setRoadmap([...roadmap, {
            roundNumber: roadmap.length + 1,
            numGroups: 1,
            qualificationRule: 4,
            maps: []
        }]);
    };

    const handleRemoveRound = (idx: number) => {
        const newRoadmap = [...roadmap];
        newRoadmap.splice(idx, 1);
        // re-index
        const reindexed = newRoadmap.map((r, i) => ({ ...r, roundNumber: i + 1 }));
        setRoadmap(reindexed);
    };

    const handleUpdateRound = (idx: number, updates: Partial<RoundConfig>) => {
        const newRoadmap = [...roadmap];
        newRoadmap[idx] = { ...newRoadmap[idx], ...updates };
        setRoadmap(newRoadmap);
    };

    const handleSaveRoadmap = async () => {
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'tournaments', tournament.id), {
                roadmap
            });
            showToast('Roadmap saved successfully!', 'success');
            onUpdate();
        } catch (error) {
            console.error("Error saving roadmap:", error);
            showToast('Failed to save roadmap', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-surface border border-gray-800 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-brand-500" />
                        Tournament Roadmap
                    </h3>
                    <p className="text-gray-500 text-xs font-medium mt-1">Configure rounds, groups, and progression rules</p>
                </div>
                <button 
                    onClick={handleAddRound}
                    className="flex items-center gap-2 bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 border border-brand-500/20 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                    <Plus className="w-4 h-4" /> Add Round
                </button>
            </div>

            <div className="space-y-4 mb-6">
                {roadmap.length === 0 ? (
                    <div className="text-center py-10 bg-dark rounded-2xl border border-gray-800 border-dashed">
                        <MapIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                        <p className="text-gray-500 font-bold">No roadmap configured yet.</p>
                        <p className="text-xs text-gray-600 mt-1">Add rounds to automate team progression.</p>
                    </div>
                ) : (
                    roadmap.map((round, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-dark p-5 rounded-2xl border border-gray-800 flex flex-col md:flex-row gap-4 items-start md:items-center relative group"
                        >
                            <div className="absolute top-4 right-4 md:static">
                                <button onClick={() => handleRemoveRound(idx)} className="text-gray-600 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="w-10 h-10 bg-gray-800/50 rounded-xl flex items-center justify-center font-black text-brand-500">
                                    R{round.roundNumber}
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest leading-none">Round {round.roundNumber}</h4>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Stage Config</p>
                                </div>
                            </div>
                            
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Num Groups</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={round.numGroups}
                                        onChange={(e) => handleUpdateRound(idx, { numGroups: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-surface border border-gray-700 text-white rounded-lg p-2 text-sm focus:border-brand-500 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Qualify Top X</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={round.qualificationRule}
                                        onChange={(e) => handleUpdateRound(idx, { qualificationRule: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-surface border border-gray-700 text-white rounded-lg p-2 text-sm focus:border-brand-500 outline-none transition"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Maps (Comma Separated)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Erangel, Miramar..."
                                        value={round.maps?.join(', ') || ''}
                                        onChange={(e) => handleUpdateRound(idx, { maps: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                        className="w-full bg-surface border border-gray-700 text-white rounded-lg p-2 text-sm focus:border-brand-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            {idx < roadmap.length - 1 && (
                                <div className="hidden md:flex absolute -bottom-6 left-1/2 -translate-x-1/2 z-10 w-8 h-8 bg-surface rounded-full border border-gray-800 items-center justify-center">
                                    <ChevronRight className="w-4 h-4 text-gray-500 rotate-90" />
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>

            <button 
                onClick={handleSaveRoadmap}
                disabled={isSaving || roadmap.length === 0}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2"
            >
                {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Settings className="w-4 h-4" />}
                {isSaving ? 'Saving Roadmap...' : 'Save Roadmap Configuration'}
            </button>
        </div>
    );
}
