import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Tournament, TournamentGroup, Participant } from '../../../shared/types/types';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useAuth } from '../../../shared/context/AuthContext';

interface GroupStandingsViewProps {
    tournament: Tournament;
    participants: Participant[];
}

interface TeamStanding {
    id: string;
    name: string;
    logoUrl?: string;
    wins: number;
    losses: number;
    points: number;
    kills: number;
    isCurrentUser: boolean;
}

function computeStandings(group: TournamentGroup, participants: Participant[], currentTeamId?: string): TeamStanding[] {
    const map: Record<string, TeamStanding> = {};

    group.teams.forEach(t => {
        // Try to resolve logo from participants
        const participant = participants.find(p => p.teamId === t.id || p.userId === t.id);
        map[t.id] = {
            id: t.id,
            name: t.name,
            logoUrl: participant?.logoUrl,
            wins: 0,
            losses: 0,
            points: 0,
            kills: 0,
            isCurrentUser: t.id === currentTeamId,
        };
    });

    (group.matches ?? []).forEach(m => {
        if (m.status !== 'completed') return;
        const s1 = m.score1 ?? 0;
        const s2 = m.score2 ?? 0;

        if (m.team1Id && map[m.team1Id]) {
            map[m.team1Id].points += s1;
            if (s1 > s2) map[m.team1Id].wins++;
            else map[m.team1Id].losses++;
        }
        if (m.team2Id && map[m.team2Id]) {
            map[m.team2Id].points += s2;
            if (s2 > s1) map[m.team2Id].wins++;
            else map[m.team2Id].losses++;
        }
    });

    return Object.values(map).sort((a, b) => b.points - a.points || b.wins - a.wins);
}

function resolveTeamName(id: string, group: TournamentGroup, participants: Participant[]): string {
    if (!id || id === 'TBD' || id === 'ALL_TEAMS') return id;
    const team = group.teams.find(t => t.id === id);
    if (team) return team.name;
    const p = participants.find(p => p.teamId === id || p.userId === id);
    return p?.teamName || p?.username || id;
}

export default function GroupStandingsView({ tournament, participants }: GroupStandingsViewProps) {
    const { profile } = useAuth();
    const { showToast } = useNotification();
    const [showPass, setShowPass] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const groups = tournament.groups ?? [];
    const currentTeamId = profile?.teamId || profile?.uid;

    // Find which group the current player is in
    const myGroup = useMemo(() =>
        groups.find(g => g.teams.some(t => t.id === currentTeamId)) ?? null,
        [groups, currentTeamId]
    );

    const isLive = tournament.status === 'live';
    const showRoom = isLive && (tournament.roomId || tournament.roomPass);

    const copy = (value: string, key: string) => {
        navigator.clipboard.writeText(value);
        setCopied(key);
        showToast('Copied!', 'success');
        setTimeout(() => setCopied(null), 2000);
    };

    if (groups.length === 0) {
        return (
            <div className="text-center py-16 bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
                <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-2">Groups Not Published Yet</h3>
                <p className="text-gray-500 font-bold text-sm max-w-xs mx-auto">
                    The organizer hasn't drawn the groups yet. Check back once registration closes.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── Room credentials strip (live + joined players only) ── */}
            {showRoom && myGroup && (
                <div className="bg-brand-500/10 border border-brand-500/20 p-6 rounded-3xl">
                    <div className="text-brand-400 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Lock className="w-4 h-4" /> Match Credentials — {myGroup.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {tournament.roomId && (
                            <div className="bg-black/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                    <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Room ID</div>
                                    <div className="text-white font-mono font-black text-xl">{tournament.roomId}</div>
                                </div>
                                <button onClick={() => copy(tournament.roomId!, 'roomId')} aria-label="Copy Room ID" className="p-2 hover:bg-white/10 rounded-xl transition">
                                    {copied === 'roomId' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-500" />}
                                </button>
                            </div>
                        )}
                        {tournament.roomPass && (
                            <div className="bg-black/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                    <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Password</div>
                                    <div className="text-white font-mono font-black text-xl">
                                        {showPass ? tournament.roomPass : '••••••'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Hide password' : 'Show password'} className="p-2 hover:bg-white/10 rounded-xl transition">
                                        {showPass ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                                    </button>
                                    <button onClick={() => copy(tournament.roomPass!, 'roomPass')} aria-label="Copy Password" className="p-2 hover:bg-white/10 rounded-xl transition">
                                        {copied === 'roomPass' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-500" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── My group highlighted first ── */}
            {myGroup && (
                <GroupCard
                    group={myGroup}
                    participants={participants}
                    currentTeamId={currentTeamId}
                    isHighlighted
                    label="Your Group"
                />
            )}

            {/* ── All groups ── */}
            <div>
                {myGroup && (
                    <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-3">
                        <span className="inline-block w-6 h-px bg-gray-700" />
                        All Groups
                    </div>
                )}
                <div className="space-y-6">
                    {groups.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            participants={participants}
                            currentTeamId={currentTeamId}
                            isHighlighted={false}
                            label={undefined}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── GroupCard sub-component ──────────────────────────────────────────────────

interface GroupCardProps {
    group: TournamentGroup;
    participants: Participant[];
    currentTeamId?: string;
    isHighlighted: boolean;
    label?: string;
}

function GroupCard({ group, participants, currentTeamId, isHighlighted, label }: GroupCardProps) {
    const [activeView, setActiveView] = useState<'standings' | 'matches' | 'teams'>('standings');
    const standings = computeStandings(group, participants, currentTeamId);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl border overflow-hidden ${isHighlighted ? 'border-brand-500/40 shadow-lg shadow-brand-500/10' : 'border-gray-800'}`}
        >
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between ${isHighlighted ? 'bg-brand-500/10' : 'bg-gray-900/70'}`}>
                <div className="flex items-center gap-3">
                    <Trophy className={`w-5 h-5 ${isHighlighted ? 'text-brand-400' : 'text-gray-600'}`} />
                    <h3 className="text-white font-black text-lg uppercase tracking-tighter">{group.name}</h3>
                    {label && (
                        <span className="bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                            {label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest">
                    <Users className="w-4 h-4" />
                    {group.teams.length} Teams
                </div>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-gray-800 bg-black/20">
                {(['standings', 'teams', 'matches'] as const).map(v => (
                    <button
                        key={v}
                        onClick={() => setActiveView(v)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition ${
                            activeView === v ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-600 hover:text-gray-400'
                        }`}
                    >
                        {v}
                    </button>
                ))}
            </div>

            <div className="p-4 bg-gray-950/50">
                {/* Standings */}
                {activeView === 'standings' && (
                    <div className="space-y-2">
                        {standings.length === 0 && (
                            <p className="text-center text-gray-600 text-sm font-bold py-6">No match data yet.</p>
                        )}
                        {standings.map((team, i) => (
                            <div
                                key={team.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
                                    team.isCurrentUser
                                        ? 'bg-brand-500/10 border border-brand-500/20'
                                        : i % 2 === 0 ? 'bg-gray-900/50' : 'bg-transparent'
                                }`}
                            >
                                <span className={`w-7 text-center font-black text-sm shrink-0 ${
                                    i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-600'
                                }`}>{i + 1}</span>
                                <span className={`flex-1 font-black uppercase tracking-tight truncate text-sm ${team.isCurrentUser ? 'text-brand-300' : 'text-white'}`}>
                                    {team.name}
                                    {team.isCurrentUser && <span className="ml-2 text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded font-black uppercase">You</span>}
                                </span>
                                <div className="flex items-center gap-4 text-right shrink-0">
                                    <div className="hidden sm:block">
                                        <div className="text-[9px] text-gray-600 uppercase font-black">W/L</div>
                                        <div className="text-white font-black text-sm">{team.wins}/{team.losses}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-gray-600 uppercase font-black">Pts</div>
                                        <div className="text-brand-400 font-black text-lg">{team.points}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Teams roster */}
                {activeView === 'teams' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.teams.map(team => {
                            const p = participants.find(pt => pt.teamId === team.id || pt.userId === team.id);
                            const isMe = team.id === currentTeamId;
                            return (
                                <div key={team.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${isMe ? 'border-brand-500/30 bg-brand-500/5' : 'border-gray-800 bg-gray-900/30'}`}>
                                    <div className="w-10 h-10 rounded-xl bg-black border border-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
                                        {team.logoUrl
                                            ? <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                                            : <Users className="w-4 h-4 text-gray-600" />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`font-black text-sm uppercase tracking-tight truncate ${isMe ? 'text-brand-300' : 'text-white'}`}>
                                            {team.name}
                                            {isMe && <span className="ml-2 text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded font-black">You</span>}
                                        </div>
                                        {p?.inGameId && (
                                            <div className="text-[10px] text-gray-500 font-mono">{p.inGameId}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Match schedule */}
                {activeView === 'matches' && (
                    <div className="space-y-3">
                        {(!group.matches || group.matches.length === 0) && (
                            <p className="text-center text-gray-600 text-sm font-bold py-6">No matches scheduled yet.</p>
                        )}
                        {(group.matches ?? []).map(match => {
                            const t1Name = resolveTeamName(match.team1Id || 'TBD', group, participants);
                            const t2Name = resolveTeamName(match.team2Id || 'TBD', group, participants);
                            const isMyMatch = match.team1Id === currentTeamId || match.team2Id === currentTeamId;

                            return (
                                <div key={match.id} className={`p-4 rounded-2xl border ${isMyMatch ? 'border-brand-500/30 bg-brand-500/5' : 'border-gray-800 bg-gray-900/30'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Sword className="w-3.5 h-3.5 text-gray-600" />
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Round {match.round}</span>
                                            {match.map && <span className="text-[10px] text-brand-400 font-black uppercase tracking-widest bg-brand-500/10 px-2 py-0.5 rounded-full">{match.map}</span>}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                                            match.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                            match.status === 'live' ? 'bg-red-500/10 text-red-400 animate-pulse' :
                                            'bg-gray-800 text-gray-500'
                                        }`}>{match.status}</span>
                                    </div>

                                    <div className="grid grid-cols-3 items-center gap-2">
                                        <div className="text-right">
                                            <div className={`font-black text-sm uppercase tracking-tight truncate ${match.team1Id === currentTeamId ? 'text-brand-300' : 'text-white'}`}>{t1Name}</div>
                                        </div>
                                        <div className="text-center">
                                            {match.status === 'completed' || match.status === 'live' ? (
                                                <span className="font-black text-2xl text-white tabular-nums">
                                                    {match.score1 ?? 0} <span className="text-gray-700">:</span> {match.score2 ?? 0}
                                                </span>
                                            ) : (
                                                <span className="font-black text-xs text-gray-600 uppercase tracking-widest">VS</span>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className={`font-black text-sm uppercase tracking-tight truncate ${match.team2Id === currentTeamId ? 'text-brand-300' : 'text-white'}`}>{t2Name}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
