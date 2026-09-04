import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { Tournament, UserProfile, Team, TeamMember } from '../../../shared/types/types';
import Modal from '../../../shared/components/Modal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { NotificationService } from '../../../shared/services/NotificationService';
import { useAuth } from '../../../shared/context/AuthContext';
import { ShieldCheck, Users, Trophy, DollarSign, Shield } from 'lucide-react';
import { formatCurrency, formatGameName } from '../../../shared/utils/utils';
import { normalizeScrimSlots, getSlotCount } from '../../../shared/utils/scrimSlots';

interface JoinTournamentModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    profile: UserProfile;
    teamMembers?: any[];
    initialSlotNumber?: number | null;
    onSuccess: (slotNumber?: number, joinData?: any) => void;
}

const JoinTournamentModal: React.FC<JoinTournamentModalProps> = ({
    isOpen,
    onClose,
    tournament,
    profile,
    teamMembers: initialTeamMembers = [],
    initialSlotNumber,
    onSuccess
}) => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();

    const [userTeams, setUserTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [availableMembers, setAvailableMembers] = useState<TeamMember[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<number | ''>(initialSlotNumber || '');

    const effectiveTeamType = (
        tournament.teamType?.toLowerCase() || 
        (tournament as any).format?.toLowerCase() || 
        ((tournament as any).teamSize === 2 ? 'duo' : (tournament as any).teamSize > 2 ? 'squad' : 'solo')
    );
    const isDuo = effectiveTeamType === 'duo';
    const isSquad = effectiveTeamType === 'squad';
    const isTeamEvent = isDuo || isSquad;

    const normalizedSlots = useMemo(() => {
        const total = getSlotCount(tournament);
        return normalizeScrimSlots(tournament.slots, total, undefined, { isTeamEvent });
    }, [tournament, isTeamEvent]);

    const openSlots = useMemo(() => {
        return normalizedSlots.filter(s => s.status === 'open');
    }, [normalizedSlots]);

    const [teammate1, setTeammate1] = useState('');
    const [teammate2, setTeammate2] = useState('');
    const [teammate3, setTeammate3] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialSlotNumber) {
            setSelectedSlot(initialSlotNumber);
        }
    }, [initialSlotNumber, isOpen]);

    useEffect(() => {
        if (isOpen && user) {
            fetchUserPermanentTeams();
        }
    }, [isOpen, user]);

    const fetchUserPermanentTeams = async () => {
        if (!user) return;
        setLoadingTeams(true);
        try {
            const memberQ = query(collection(db, 'team_members'), where('userId', '==', user.uid));
            const memberSnap = await getDocs(memberQ);
            const teamIds = Array.from(new Set(memberSnap.docs.map(d => d.data().teamId)));

            const ownerQ = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
            const ownerSnap = await getDocs(ownerQ);
            const ownedTeams = ownerSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));

            const fetchedTeams = [...ownedTeams];
            for (const tid of teamIds) {
                if (!fetchedTeams.some(t => t.id === tid)) {
                    const tDoc = await getDoc(doc(db, 'teams', tid));
                    if (tDoc.exists()) {
                        fetchedTeams.push({ id: tDoc.id, ...tDoc.data() } as Team);
                    }
                }
            }

            if (profile?.teamId && !fetchedTeams.some(t => t.id === profile.teamId)) {
                try {
                    const tDoc = await getDoc(doc(db, 'teams', profile.teamId));
                    if (tDoc.exists()) {
                        fetchedTeams.push({ id: tDoc.id, ...tDoc.data() } as Team);
                    }
                } catch (e) {
                    console.warn('Error loading profile team doc:', e);
                }
            }

            if (fetchedTeams.length === 0 && profile?.teamName) {
                fetchedTeams.push({
                    id: profile.teamId || user.uid,
                    name: profile.teamName,
                    ownerId: user.uid,
                    description: '',
                    membersCount: 1,
                    createdAt: new Date(),
                } as Team);
            }

            setUserTeams(fetchedTeams);
            if (fetchedTeams.length > 0) {
                setSelectedTeam(fetchedTeams[0]);
                fetchTeamRoster(fetchedTeams[0].id);
            } else if (initialTeamMembers.length > 0) {
                setAvailableMembers(initialTeamMembers);
            }
        } catch (err) {
            console.warn('Error loading user teams:', err);
        } finally {
            setLoadingTeams(false);
        }
    };

    const fetchTeamRoster = async (teamId: string) => {
        try {
            const membersQ = query(collection(db, 'team_members'), where('teamId', '==', teamId));
            const snap = await getDocs(membersQ);
            const members = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as TeamMember))
                .filter(m => m.userId !== user?.uid);
            setAvailableMembers(members);
        } catch (err) {
            console.warn('Error loading team members:', err);
        }
    };

    const handleTeamChange = (teamId: string) => {
        const team = userTeams.find(t => t.id === teamId) || null;
        setSelectedTeam(team);
        setTeammate1('');
        setTeammate2('');
        setTeammate3('');
        if (team) {
            fetchTeamRoster(team.id);
        }
    };

    const handleSubmit = async () => {
        if (!user || !tournament || !profile) return;

        if (isTeamEvent && (!selectedTeam || !selectedTeam.name)) {
            showToast("A team from the Teams feature is required to join Duo or Squad events.", "error");
            return;
        }

        if (isDuo) {
            if (!teammate1) {
                showToast("Please select your teammate for Duo participation.", "warning");
                return;
            }
        }

        if (isSquad) {
            if (!teammate1 || !teammate2 || !teammate3) {
                showToast("Please select 3 teammates for Squad lineup.", "warning");
                return;
            }
            const selectedNames = [teammate1, teammate2, teammate3];
            const uniqueNames = new Set(selectedNames);
            if (uniqueNames.size !== selectedNames.length) {
                showToast("Cannot select the same teammate multiple times.", "error");
                return;
            }
        }

        const teammates = isDuo
            ? [teammate1]
            : isSquad
            ? [teammate1, teammate2, teammate3]
            : [];

        const selectedPlayers = [profile.inGameName || profile.username, ...teammates];
        const registeredTeamName = selectedTeam?.name || profile.teamName || 'Registered Team';
        const registeredTeamId = selectedTeam?.id || profile.teamId || user.uid;

        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Authentication required');

            const res = await fetch('/api/wallet/join-tournament', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    tournamentId: tournament.id,
                    slotNumber: selectedSlot ? Number(selectedSlot) : undefined,
                    teammates,
                    teamId: registeredTeamId,
                    teamName: registeredTeamName,
                    selectedPlayers,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to join tournament');

            const confirmedSlot = data.slotNumber || (selectedSlot ? Number(selectedSlot) : undefined);

            await NotificationService.create(
                user.uid,
                'Tournament Joined!',
                `You have successfully joined ${tournament.title}${confirmedSlot ? ` in Slot #${confirmedSlot}` : ''}. Good luck!`,
                'success',
                `/tournaments/${tournament.id}`
            );
            
            showToast(`Joined Successfully in Slot #${confirmedSlot || 'Confirmed'}!`, 'success');
            onSuccess(confirmedSlot, data);
            onClose();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Join ${effectiveTeamType.toUpperCase()} ${tournament.matchType === 'scrims' || (tournament as any).isScrim ? 'Scrim' : 'Tournament'}`}>
            <div className="space-y-5">
                <div className="bg-brand-600/10 border border-brand-500/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
                            <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-black uppercase tracking-tight">{tournament.title}</h3>
                            <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest">{formatGameName(tournament.game)} • {effectiveTeamType.toUpperCase()}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-dark/50 p-2.5 rounded-xl border border-white/5">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Entry Fee</div>
                            <div className="text-white font-black text-sm">{tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE'}</div>
                        </div>
                        <div className="bg-dark/50 p-2.5 rounded-xl border border-white/5">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Your Balance</div>
                            <div className={`text-sm font-black ${profile.balance < tournament.entryFee ? 'text-red-400' : 'text-emerald-400'}`}>
                                {formatCurrency(profile.balance || 0)}
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2 block">
                        Select Allocated Slot
                    </label>
                    <select
                        value={selectedSlot}
                        onChange={(e) => setSelectedSlot(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                    >
                        <option value="">Auto-Assign First Available Slot</option>
                        {openSlots.map(s => (
                            <option key={s.slotNumber} value={s.slotNumber}>
                                Slot #{s.slotNumber < 10 ? `0${s.slotNumber}` : s.slotNumber} (Available)
                            </option>
                        ))}
                    </select>
                </div>

                {isTeamEvent && !loadingTeams && userTeams.length === 0 && (
                    <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2.5 text-amber-400">
                            <Users className="w-5 h-5 shrink-0" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                Team Required for {effectiveTeamType.toUpperCase()}
                            </h4>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                            Without a team in NexPlay, players cannot register for Duo or Squad tournaments. Create your team and invite your friends in the dedicated Teams feature first, then return here to select your players.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate('/teams');
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl font-black uppercase text-xs tracking-wider transition flex items-center justify-center gap-2 cursor-pointer font-bold"
                        >
                            <Users className="w-4 h-4" />
                            Create Team in Teams Feature
                        </button>
                    </div>
                )}

                {isTeamEvent && userTeams.length > 0 && (
                    <div className="bg-brand-600/10 border border-brand-500/30 p-3.5 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-brand-400 uppercase font-black tracking-wider block flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-brand-400" />
                                Team Details (Auto-Filled)
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    navigate('/teams');
                                }}
                                className="text-[10px] text-gray-400 hover:text-white underline font-bold cursor-pointer"
                            >
                                Manage Team ↗
                            </button>
                        </div>
                        {userTeams.length === 1 ? (
                            <div className="flex items-center justify-between bg-dark/80 px-3 py-2.5 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="text-sm font-black text-white">{selectedTeam?.name}</span>
                                </div>
                                <span className="text-[10px] bg-brand-500/20 text-brand-300 font-bold px-2 py-0.5 rounded uppercase">
                                    {selectedTeam?.tag || 'TEAM'}
                                </span>
                            </div>
                        ) : (
                            <select
                                value={selectedTeam?.id || ''}
                                onChange={(e) => handleTeamChange(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                            >
                                {userTeams.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.tag || 'TEAM'})</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {isDuo && (
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2 block">
                            Select Duo Teammate
                        </label>
                        {availableMembers.length > 0 ? (
                            <select 
                                value={teammate1}
                                onChange={(e) => setTeammate1(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                            >
                                <option value="">Select teammate from roster</option>
                                {availableMembers.map(m => (
                                    <option key={m.id || m.userId} value={m.inGameName || m.username}>
                                        {m.inGameName || m.username} ({m.role || 'Member'})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input 
                                type="text" 
                                value={teammate1}
                                onChange={(e) => setTeammate1(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                placeholder="Enter teammate in-game name"
                            />
                        )}
                    </div>
                )}

                {isSquad && (
                    <div className="space-y-3">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-wider block">
                            Select Squad Lineup (3 Teammates)
                        </label>

                        {[1, 2, 3].map((idx) => (
                            <div key={idx}>
                                <span className="text-[9px] text-gray-400 font-bold block mb-1">Teammate #{idx}</span>
                                {availableMembers.length > 0 ? (
                                    <select 
                                        value={idx === 1 ? teammate1 : idx === 2 ? teammate2 : teammate3}
                                        onChange={(e) => {
                                            if (idx === 1) setTeammate1(e.target.value);
                                            else if (idx === 2) setTeammate2(e.target.value);
                                            else setTeammate3(e.target.value);
                                        }}
                                        className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                    >
                                        <option value="">Select teammate</option>
                                        {availableMembers.map(m => (
                                            <option key={m.id || m.userId} value={m.inGameName || m.username}>
                                                {m.inGameName || m.username} ({m.role || 'Member'})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        value={idx === 1 ? teammate1 : idx === 2 ? teammate2 : teammate3}
                                        onChange={(e) => {
                                            if (idx === 1) setTeammate1(e.target.value);
                                            else if (idx === 2) setTeammate2(e.target.value);
                                            else setTeammate3(e.target.value);
                                        }}
                                        className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                        placeholder={`Enter teammate ${idx} in-game name`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button type="button" 
                        onClick={onClose} 
                        disabled={loading}
                        className="flex-1 bg-surface hover:bg-surface/80 text-white py-3 rounded-xl font-black uppercase text-xs tracking-wider transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button type="button" 
                        onClick={handleSubmit} 
                        disabled={loading || (isTeamEvent && userTeams.length === 0) || profile.balance < (tournament.entryFee || 0)}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-wider transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : 'Confirm Registration'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default JoinTournamentModal;
