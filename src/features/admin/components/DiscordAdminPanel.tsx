import React, { useState } from 'react';
import { Send, Info } from 'lucide-react';
import { Tournament } from '../../../shared/types/types';

interface DiscordAdminPanelProps {
    allTournaments: Tournament[];
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DiscordAdminPanel: React.FC<DiscordAdminPanelProps> = ({ allTournaments, showToast }) => {
    const [selectedTournamentId, setSelectedTournamentId] = useState('');
    const [sending, setSending] = useState<string | null>(null);

    const selectedTournament = allTournaments.find(t => t.id === selectedTournamentId) ?? null;

    const handleSend = async (type: string) => {
        if (!selectedTournament) {
            showToast('Select a tournament first', 'warning');
            return;
        }
        setSending(type);
        try {
            const token = await (await import('../../../shared/config/firebase')).auth.currentUser?.getIdToken();
            if (!token) { showToast('Not authenticated', 'error'); return; }

            const isScrim = selectedTournament.matchType === 'scrims';
            const channel = isScrim ? 'scrims' : 'tournaments';

            const dataMap: Record<string, object> = {
                tournament_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    game: selectedTournament.game,
                    teamType: selectedTournament.teamType,
                    type: selectedTournament.type,
                    map: selectedTournament.map,
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    entryFee: selectedTournament.entryFee === 0 ? 'FREE' : `Rs. ${selectedTournament.entryFee}`,
                    currentPlayers: selectedTournament.currentPlayers,
                    slots: selectedTournament.slots,
                    bannerUrl: selectedTournament.bannerUrl,
                },
                tournament_live: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    currentPlayers: selectedTournament.currentPlayers,
                    slots: selectedTournament.slots,
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    map: selectedTournament.map,
                },
                tournament_completed: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    winner: selectedTournament.winners?.[0]?.username,
                },
                group_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groups: (selectedTournament.groups ?? []).map(g =>
                        `${g.name} (${g.teams.length} teams): ${g.teams.map(t => t.name).join(', ')}`
                    ),
                },
                game_start: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groupName: 'All Groups',
                    map: selectedTournament.map ?? 'TBD',
                    roomId: selectedTournament.roomId,
                    roomPass: selectedTournament.roomPass,
                },
                game_time: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groupName: 'All Groups',
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    timeLeft: '30 minutes',
                    map: selectedTournament.map,
                },
                scrim_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    game: selectedTournament.game,
                    teamType: selectedTournament.teamType,
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    entryFee: selectedTournament.entryFee === 0 ? 'FREE' : `Rs. ${selectedTournament.entryFee}`,
                    currentPlayers: selectedTournament.currentPlayers,
                    slots: selectedTournament.slots,
                    bannerUrl: selectedTournament.bannerUrl,
                },
            };

            const data = dataMap[type];
            if (!data) { showToast('Unknown announcement type', 'error'); return; }

            const res = await fetch('/api/discord/announce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ type, data, channel }),
            });
            const json = await res.json();
            showToast(json.message, json.success ? 'success' : 'error');
        } catch (err: any) {
            showToast('Failed to send announcement', 'error');
        } finally {
            setSending(null);
        }
    };

    const announcements = [
        { type: 'tournament_published', label: 'Publish',     color: 'text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/20 hover:bg-[#5865F2]/20' },
        { type: 'tournament_live',      label: '🔴 Live',     color: 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
        { type: 'tournament_completed', label: 'Completed',   color: 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20' },
        { type: 'group_published',      label: 'Group Draw',  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' },
        { type: 'game_start',           label: 'Match Start', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20' },
        { type: 'game_time',            label: 'Reminder',    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' },
        { type: 'scrim_published',      label: 'Scrim Post',  color: 'text-brand-400 bg-brand-500/10 border-brand-500/20 hover:bg-brand-500/20' },
    ];

    return (
        <div className="space-y-8">
            <div className="border-b border-gray-800 pb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <div className="p-2 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl">
                        <Send className="w-5 h-5 text-[#5865F2]" />
                    </div>
                    Discord Announcements
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">
                    Send tournament updates directly to the Nexplay Discord server
                </p>
            </div>

            {/* Tournament selector */}
            <div className="bg-card/50 p-6 rounded-3xl border border-gray-800 space-y-4">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                    Select Tournament or Scrim
                </label>
                <select
                    value={selectedTournamentId}
                    onChange={e => setSelectedTournamentId(e.target.value)}
                    aria-label="Select tournament for Discord announcement"
                    className="w-full bg-black border border-gray-700 rounded-2xl px-5 py-4 text-white text-sm font-bold focus:border-[#5865F2] outline-none transition"
                >
                    <option value="">— Choose a tournament —</option>
                    {allTournaments.map(t => (
                        <option key={t.id} value={t.id}>
                            [{t.status.toUpperCase()}] {t.title} ({t.matchType === 'scrims' ? '#scrims' : '#tournaments'})
                        </option>
                    ))}
                </select>

                {selectedTournament && (
                    <div className="flex items-center gap-3 p-4 bg-black/40 rounded-2xl border border-gray-800">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-card border border-gray-700 shrink-0">
                            {selectedTournament.bannerUrl && (
                                <img src={selectedTournament.bannerUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="text-white font-black text-sm truncate">{selectedTournament.title}</div>
                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                {selectedTournament.game} · {selectedTournament.teamType} · Posting to #{selectedTournament.matchType === 'scrims' ? 'scrims' : 'tournaments'}
                            </div>
                        </div>
                        <span className={`ml-auto shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            selectedTournament.status === 'live' ? 'bg-red-500/10 text-red-400' :
                            selectedTournament.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                            'bg-brand-500/10 text-brand-400'
                        }`}>
                            {selectedTournament.status}
                        </span>
                    </div>
                )}
            </div>

            {/* Announce buttons */}
            <div className="bg-card/50 p-6 rounded-3xl border border-gray-800">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
                    Announcement Type
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {announcements.map(a => (
                        <button
                            key={a.type}
                            onClick={() => handleSend(a.type)}
                            disabled={sending !== null || !selectedTournament}
                            className={`flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${a.color}`}
                        >
                            {sending === a.type ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Setup guide */}
            <div className="bg-[#5865F2]/5 border border-[#5865F2]/15 p-6 rounded-3xl space-y-3">
                <div className="text-[10px] font-black text-[#5865F2] uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-4 h-4" /> Setup Guide
                </div>
                <ol className="text-xs text-gray-400 font-bold space-y-2 list-decimal list-inside">
                    <li>Go to your Discord Server Settings → Integrations → Webhooks</li>
                    <li>Create a webhook for your <span className="text-white">#tournaments</span> channel → copy URL → set <span className="font-mono text-brand-400">DISCORD_WEBHOOK_TOURNAMENTS</span> in <span className="font-mono">.env</span></li>
                    <li>Create a webhook for your <span className="text-white">#scrims</span> channel → copy URL → set <span className="font-mono text-brand-400">DISCORD_WEBHOOK_SCRIMS</span> in <span className="font-mono">.env</span></li>
                    <li>Restart the server — webhooks activate immediately</li>
                </ol>
            </div>
        </div>
    );
};

export default DiscordAdminPanel;
