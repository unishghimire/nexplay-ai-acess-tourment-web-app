import React from 'react';
import { motion } from 'motion/react';
import { Calendar } from 'lucide-react';
import { TournamentAdminTabProps } from './types';
import Modal from '../../../../shared/components/Modal';
import ResultUploader from '../../../results/components/ResultUploader';
import PerKillResultUploader from '../../../tournaments/components/PerKillResultUploader';

export const MatchesTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, selectedGroup, selectedMatch, matchScore, newMatchData,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setSelectedMatch, setSelectedGroup, setMatchScore, setNewMatchData,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleAddMatch, handleUpdateScore, getTeamName,
    } = props;

    return (
        <>
            <motion.div
                key="matches"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 sm:space-y-6"
            >
                <div className="flex justify-between items-center border-b border-gray-800 pb-3 sm:pb-4">
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-widest text-white">Match Schedule</h2>
                </div>

                {tournament.groups && tournament.groups.some(g => g.matches.length > 0) ? (
                    <div className="space-y-8">
                        {tournament.groups.map(group => group.matches.length > 0 && (
                            <div key={group.id} className="space-y-4">
                                <h3 className="text-sm font-black text-brand-500 uppercase tracking-widest">{group.name} Matches</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                                    {group.matches.map(match => {
                                        const team1 = group.teams.find(t => t.id === match.team1Id);
                                        const team2 = group.teams.find(t => t.id === match.team2Id);
                                        return (
                                            <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-3 sm:p-4 shadow-lg hover:border-brand-500/20 transition-all flex flex-col justify-between">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">R{match.round}</span>
                                                    {match.map && (
                                                        <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest ml-2 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/10">
                                                            {match.map}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-3 mb-4">
                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                        <span className="text-[11px] font-bold text-white truncate max-w-[80px] sm:max-w-[120px] uppercase tracking-tight">{team1?.name || 'TBD'}</span>
                                                        <span className="text-md font-black text-brand-500">{match.score1}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                        <span className="text-[11px] font-bold text-white truncate max-w-[80px] sm:max-w-[120px] uppercase tracking-tight">{team2?.name || 'TBD'}</span>
                                                        <span className="text-md font-black text-brand-500">{match.score2}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-gray-800">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedMatch({ groupId: group.id, match });
                                                            setMatchScore({ score1: match.score1, score2: match.score2, status: match.status, map: match.map || '' });
                                                            setIsUpdateScoreModalOpen(true);
                                                        }}
                                                        className="bg-dark hover:bg-surface text-gray-400 py-2.5 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-gray-800"
                                                    >
                                                        Score
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const g = tournament.groups?.find(gr => gr.id === group.id);
                                                            if (g) {
                                                                setSelectedGroup(g);
                                                                setSelectedMatch({ groupId: group.id, match });
                                                                setIsResultUploaderOpen(true);
                                                            }
                                                        }}
                                                        className="bg-brand-600/10 hover:bg-brand-600 text-brand-500 hover:text-white py-2.5 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-brand-500/20"
                                                    >
                                                        Result
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No matches scheduled.</p>
                        <p className="text-sm text-gray-500 mt-2">Generate matches from the Groups tab.</p>
                    </div>
                )}
            </motion.div>

            {/* Update Score Modal */}
            <Modal isOpen={isUpdateScoreModalOpen} onClose={() => setIsUpdateScoreModalOpen(false)} title="Update Match Score">
                {selectedMatch && (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                    {getTeamName(selectedMatch.match.team1Id || 'TBD')}
                                </p>
                                <input
                                    type="number"
                                    value={matchScore.score1}
                                    onChange={(e) => setMatchScore({...matchScore, score1: parseInt(e.target.value) || 0})}
                                    className="w-full bg-surface border border-gray-700 text-white text-center text-2xl font-black rounded-lg p-2 focus:border-brand-500 outline-none transition"
                                />
                            </div>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                    {getTeamName(selectedMatch.match.team2Id || 'TBD')}
                                </p>
                                <input
                                    type="number"
                                    value={matchScore.score2}
                                    onChange={(e) => setMatchScore({...matchScore, score2: parseInt(e.target.value) || 0})}
                                    className="w-full bg-surface border border-gray-700 text-white text-center text-2xl font-black rounded-lg p-2 focus:border-brand-500 outline-none transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="map-name" className="block text-xs font-bold text-gray-500 uppercase mb-2">Map Name</label>
                            <input
                                type="text"
                                value={matchScore.map || ''}
                                onChange={(e) => setMatchScore({...matchScore, map: e.target.value})}
                                placeholder="e.g., Erangel, Miramar"
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                            />
                        </div>

                        <div>
                            <label htmlFor="match-status" className="block text-xs font-bold text-gray-500 uppercase mb-2">Match Status</label>
                            <select
                                value={matchScore.status}
                                onChange={(e) => setMatchScore({...matchScore, status: e.target.value as any})}
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                            >
                                <option value="scheduled">Scheduled</option>
                                <option value="live">Live</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={() => setIsUpdateScoreModalOpen(false)}
                                className="flex-1 bg-dark hover:bg-surface text-white py-3 rounded-xl font-bold transition border border-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateScore}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                            >
                                Save Score
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Result Uploader */}
            {selectedMatch && selectedGroup && isResultUploaderOpen && (
                (tournament as any).tournamentMode === 'PER_KILL_REWARD' ? (
                    <PerKillResultUploader
                        isOpen={isResultUploaderOpen}
                        onClose={() => setIsResultUploaderOpen(false)}
                        tournament={tournament}
                        group={selectedGroup}
                        match={selectedMatch.match}
                        onSuccess={() => setIsResultUploaderOpen(false)}
                    />
                ) : (
                    <ResultUploader
                        isOpen={isResultUploaderOpen}
                        onClose={() => setIsResultUploaderOpen(false)}
                        tournament={tournament}
                        group={selectedGroup}
                        match={selectedMatch.match}
                        onSuccess={() => setIsResultUploaderOpen(false)}
                    />
                )
            )}

            {/* Add Match Modal */}
            <Modal isOpen={isAddMatchModalOpen} onClose={() => setIsAddMatchModalOpen(false)} title={`Add Match to ${selectedGroup?.name}`}>
                {selectedGroup && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label htmlFor="team-1" className="block text-xs font-bold text-gray-500 uppercase mb-2">Team 1</label>
                                <select
                                    value={newMatchData.team1Id}
                                    onChange={(e) => setNewMatchData({...newMatchData, team1Id: e.target.value})}
                                    className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                                >
                                    <option value="">Select Team</option>
                                    <option value="TBD">TBD</option>
                                    {selectedGroup.teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="team-2" className="block text-xs font-bold text-gray-500 uppercase mb-2">Team 2</label>
                                <select
                                    value={newMatchData.team2Id}
                                    onChange={(e) => setNewMatchData({...newMatchData, team2Id: e.target.value})}
                                    className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                                >
                                    <option value="">Select Team</option>
                                    <option value="TBD">TBD</option>
                                    {selectedGroup.teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label htmlFor="match-round" className="block text-xs font-bold text-gray-500 uppercase mb-2">Round</label>
                                <input
                                    type="number"
                                    value={newMatchData.round}
                                    onChange={(e) => setNewMatchData({...newMatchData, round: parseInt(e.target.value) || 1})}
                                    className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label htmlFor="match-map" className="block text-xs font-bold text-gray-500 uppercase mb-2">Map</label>
                                <input
                                    type="text"
                                    value={newMatchData.map}
                                    onChange={(e) => setNewMatchData({...newMatchData, map: e.target.value})}
                                    placeholder="e.g., Erangel"
                                    className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={() => setIsAddMatchModalOpen(false)}
                                className="flex-1 bg-dark hover:bg-surface text-white py-3 rounded-xl font-bold transition border border-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddMatch}
                                disabled={!newMatchData.team1Id || !newMatchData.team2Id}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition"
                            >
                                Create Match
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};
