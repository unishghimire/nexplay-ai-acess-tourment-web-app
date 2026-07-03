import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { Tournament, TournamentGroup, Match, Team, TournamentEarning } from '../../../shared/types/types';
import { 
    Settings, Users, Calendar, Trophy, ArrowLeft, 
    Plus, Trash2, Edit2, CheckCircle2, AlertCircle,
    Lock, Unlock, Link as LinkIcon, QrCode, Play, Pause,
    DollarSign, TrendingUp, TrendingDown, Save, ShieldCheck, XCircle, Download,
    RotateCcw, Sword, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../../../shared/components/Modal';
import ResultUploader from '../../results/components/ResultUploader';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import {
    announceNewTournament,
    announceTournamentLive,
    announceTournamentCompleted,
    announceGroupDraw,
    announceGameStart,
    announceGameTime,
    announceNewScrim,
    announceScrimLive,
    announceScrimCompleted,
} from '../../../shared/services/DiscordService';

export default function TournamentAdminPanel() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useNotification();
    
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [tournamentEarning, setTournamentEarning] = useState<TournamentEarning | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'matches' | 'brackets' | 'settings' | 'participants'>('overview');

    // Group State
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [newGroup, setNewGroup] = useState({ name: '', teamLimit: 16, isPublic: true, passCode: '' });
    
    // Manage Teams State
    const [isManageTeamsModalOpen, setIsManageTeamsModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<TournamentGroup | null>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [fetchingParticipants, setFetchingParticipants] = useState(false);

    useEffect(() => {
        if (!id || !user) return;

        // Tournament Listener
        const unsubTournament = onSnapshot(doc(db, 'tournaments', id), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Tournament;
                if (data.hostUid !== user.uid) {
                    showToast('Unauthorized access', 'error');
                    navigate('/');
                    return;
                }
                setTournament(data);
                
                // Fetch earnings if completed and not already fetched
                if (data.status === 'completed' && !tournamentEarning) {
                    const earningQuery = query(collection(db, 'tournamentEarnings'), where('tournamentId', '==', id));
                    getDocs(earningQuery).then(earningSnap => {
                        if (!earningSnap.empty) {
                            setTournamentEarning({ id: earningSnap.docs[0].id, ...earningSnap.docs[0].data() } as TournamentEarning);
                        }
                    });
                }
            } else {
                showToast('Tournament not found', 'error');
                navigate('/');
            }
            setLoading(false);
        });

        // Participants Listener
        const q = query(collection(db, 'participants'), where('tournamentId', '==', id));
        const unsubParticipants = onSnapshot(q, (partSnap) => {
            setParticipants(partSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setFetchingParticipants(false);
        });

        return () => {
            unsubTournament();
            unsubParticipants();
        };
    }, [id, user, navigate, showToast]);

    const handleUpdateStatus = async (status: 'upcoming' | 'live' | 'completed' | 'paused') => {
        if (!tournament) return;
        try {
            await updateDoc(doc(db, 'tournaments', tournament.id), { status });
            showToast(`Tournament status updated to ${status}`, 'success');
        } catch (error) {
            showToast('Failed to update status', 'error');
        }
    };

    const handleUpdateStage = async (stage: string) => {
        if (!tournament) return;
        try {
            await updateDoc(doc(db, 'tournaments', tournament.id), { 
                stage,
                status: stage === 'completed' ? 'completed' : 
                        stage === 'registration' ? 'upcoming' : 'live'
            });
            showToast(`Tournament stage updated to ${stage}`, 'success');
        } catch (error) {
            showToast('Failed to update stage', 'error');
        }
    };

    const handleAutoGenerateGroups = async () => {
        if (!tournament) return;
        const approvedParticipants = participants.filter(p => p.status === 'approved');
        if (approvedParticipants.length === 0) {
            showToast('No approved participants to organize into groups', 'error');
            return;
        }

        if (!window.confirm(`Auto-generate groups for ${approvedParticipants.length} players? This will reset existing groups.`)) return;

        try {
            setLoading(true);
            const round1Config = tournament.roadmap?.[0];
            const teamsPerGroup = round1Config?.numGroups ? Math.ceil(approvedParticipants.length / round1Config.numGroups) : 16;
            const numGroups = round1Config?.numGroups || Math.ceil(approvedParticipants.length / teamsPerGroup);
            
            const shuffled = [...approvedParticipants].sort(() => Math.random() - 0.5);
            
            const newGroups: TournamentGroup[] = [];
            for (let i = 0; i < numGroups; i++) {
                const groupParticipants = shuffled.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
                if (groupParticipants.length === 0) continue;

                const teams: Team[] = groupParticipants.map(p => ({
                    id: p.teamId || p.userId,
                    name: p.teamName || p.username,
                    players: p.teammates ? [p.username, ...p.teammates] : [p.username],
                    logoUrl: p.logoUrl
                }));

                newGroups.push({
                    id: `group-${Date.now()}-${i}`,
                    name: `Group ${String.fromCharCode(65 + i)}`,
                    teamLimit: teamsPerGroup,
                    teams: teams,
                    matches: [],
                    isPublic: true
                });
            }

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: newGroups,
                stage: 'group_stage',
                currentRound: 1
            });

            showToast('Groups generated successfully!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to generate groups', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdvanceRound = async () => {
        if (!tournament) return;

        try {
            setLoading(true);
            const currentRoundIdx = (tournament.currentRound || 1) - 1;
            const currentRoundConfig = tournament.roadmap?.[currentRoundIdx];
            const nextRoundConfig = tournament.roadmap?.[currentRoundIdx + 1];
            
            if (tournament.stage === 'group_stage') {
                if (!tournament.groups || tournament.groups.length === 0) {
                    throw new Error("No groups found to advance from.");
                }

                // Calculate qualifiers based on current roadmap rule or default top 2
                const qualificationCount = currentRoundConfig?.qualificationRule || 2;
                const qualifiers: Team[] = [];
                
                tournament.groups.forEach(group => {
                    const groupStandings = group.teams.map(team => {
                        let wins = 0;
                        let points = 0;
                        group.matches.forEach(m => {
                            if (m.status === 'completed') {
                                if (tournament.type.toLowerCase().includes('br') || tournament.game.toLowerCase().includes('bgmi') || tournament.game.toLowerCase().includes('pubg')) {
                                    // For BR, points are usually summed from multi-team matches
                                    // Current Match structure might only store 1v1? 
                                    // Actually, let's stick to the 1v1 logic for now as per Match type
                                    if (m.team1Id === team.id && m.score1 > m.score2) wins++;
                                    if (m.team2Id === team.id && m.score2 > m.score1) wins++;
                                    if (m.team1Id === team.id) points += m.score1;
                                    if (m.team2Id === team.id) points += m.score2;
                                } else {
                                    // Standard 1v1
                                    if (m.team1Id === team.id && m.score1 > m.score2) wins++;
                                    if (m.team2Id === team.id && m.score2 > m.score1) wins++;
                                    if (m.team1Id === team.id) points += m.score1;
                                    if (m.team2Id === team.id) points += m.score2;
                                }
                            }
                        });
                        return { team, wins, points };
                    });

                    // Sort by Points (Primary for BR) then Wins
                    groupStandings.sort((a, b) => b.points - a.points || b.wins - a.wins);
                    qualifiers.push(...groupStandings.slice(0, qualificationCount).map(s => s.team));
                });

                if (qualifiers.length < 2) {
                    throw new Error("Not enough teams qualified for the next stage.");
                }

                if (nextRoundConfig) {
                    // Advance to next group stage round
                    const teamsPerGroup = Math.ceil(qualifiers.length / nextRoundConfig.numGroups);
                    const newGroups: TournamentGroup[] = [];
                    
                    for (let i = 0; i < nextRoundConfig.numGroups; i++) {
                        newGroups.push({
                            id: `group-r${currentRoundIdx + 2}-${i}`,
                            name: `Round ${currentRoundIdx + 2} - Group ${String.fromCharCode(65 + i)}`,
                            teamLimit: teamsPerGroup,
                            teams: qualifiers.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup),
                            matches: [],
                            isPublic: true
                        });
                    }

                    await updateDoc(doc(db, 'tournaments', tournament.id), {
                        groups: newGroups,
                        currentRound: (tournament.currentRound || 1) + 1
                    });
                    showToast(`Advanced to ${nextRoundConfig.stageName || 'Next Round'}!`, 'success');
                } else {
                    // No more rounds in roadmap, generate knockout bracket
                    const bracketSize = Math.pow(2, Math.ceil(Math.log2(qualifiers.length)));
                    const bracketMatches: Match[] = [];
                    
                    // Fill Round 1 of Bracket
                    for (let i = 0; i < bracketSize / 2; i++) {
                        const team1 = qualifiers[i * 2];
                        const team2 = qualifiers[(i * 2) + 1];
                        bracketMatches.push({
                            id: `bracket-1-${i}`,
                            team1Id: team1?.id || 'TBD',
                            team2Id: team2?.id || 'TBD',
                            status: 'scheduled',
                            score1: 0,
                            score2: 0,
                            round: 1
                        });
                    }

                    // Fill dummy rounds for the rest of the bracket
                    let matchesInRound = bracketSize / 2;
                    let roundNum = 2;
                    while (matchesInRound > 1) {
                        matchesInRound /= 2;
                        for (let i = 0; i < matchesInRound; i++) {
                            bracketMatches.push({
                                id: `bracket-${roundNum}-${i}`,
                                team1Id: 'TBD',
                                team2Id: 'TBD',
                                status: 'scheduled',
                                score1: 0,
                                score2: 0,
                                round: roundNum
                            });
                        }
                        roundNum++;
                    }

                    await updateDoc(doc(db, 'tournaments', tournament.id), {
                        bracketMatches,
                        stage: 'knockout'
                    });
                    showToast(`Advanced to Knockout! ${qualifiers.length} teams qualified.`, 'success');
                }
            } else {
                showToast("Advance Stage is only available from Group Stage.", "info");
            }
        } catch (error: any) {
            console.error(error);
            showToast(error.message || "Failed to advance stage", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!tournament || !newGroup.name.trim()) return;
        try {
            const group: any = {
                id: `group-${Date.now()}`,
                name: newGroup.name,
                teamLimit: newGroup.teamLimit,
                teams: [],
                matches: [],
                isPublic: newGroup.isPublic,
            };
            if (newGroup.passCode) {
                group.passCode = newGroup.passCode;
            }
            
            const updatedGroups = [...(tournament.groups || []), group as TournamentGroup];
            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });
            
            setTournament({ ...tournament, groups: updatedGroups });
            setIsCreateGroupModalOpen(false);
            setNewGroup({ name: '', teamLimit: 16, isPublic: true, passCode: '' });
            showToast('Group created successfully', 'success');
        } catch (error) {
            console.error("Error creating group:", error);
            showToast('Failed to create group', 'error');
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!tournament) return;
        if (!window.confirm('Are you sure you want to delete this group?')) return;
        try {
            const updatedGroups = (tournament.groups || []).filter(g => g.id !== groupId);
            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });
            showToast('Group deleted', 'success');
        } catch (error) {
            console.error("Error deleting group:", error);
            showToast('Failed to delete group', 'error');
        }
    };

    const handleAssignTeam = async (participantId: string) => {
        if (!tournament || !selectedGroup) return;
        
        if (selectedGroup.teams.length >= selectedGroup.teamLimit) {
            showToast('Group is full', 'error');
            return;
        }

        const participant = participants.find(p => p.id === participantId);
        if (!participant) return;

        const team: Team = {
            id: participant.teamId || participant.userId,
            name: participant.teamName || participant.username,
            players: participant.teammates ? [participant.username, ...participant.teammates] : [participant.username]
        };
        
        if (participant.logoUrl) {
            team.logoUrl = participant.logoUrl;
        }

        try {
            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === selectedGroup.id) {
                    return { ...g, teams: [...g.teams, team] };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            setSelectedGroup({ ...selectedGroup, teams: [...selectedGroup.teams, team] });
            showToast('Team assigned to group', 'success');
        } catch (error) {
            console.error("Error assigning team:", error);
            showToast('Failed to assign team', 'error');
        }
    };

    const handleRemoveTeam = async (teamId: string) => {
        if (!tournament || !selectedGroup) return;

        try {
            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === selectedGroup.id) {
                    return { ...g, teams: g.teams.filter(t => t.id !== teamId) };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            setSelectedGroup({ ...selectedGroup, teams: selectedGroup.teams.filter(t => t.id !== teamId) });
            showToast('Team removed from group', 'success');
        } catch (error) {
            console.error("Error removing team:", error);
            showToast('Failed to remove team', 'error');
        }
    };

    // Discord state
    const [discordSending, setDiscordSending] = useState<string | null>(null);
    const [gameStartGroupId, setGameStartGroupId] = useState('');

    const handleDiscord = async (action: string) => {
        if (!tournament) return;
        setDiscordSending(action);
        const isScrim = tournament.matchType === 'scrims';
        let result: { success: boolean; message: string };

        try {
            switch (action) {
                case 'publish':
                    result = isScrim
                        ? await announceNewScrim(tournament)
                        : await announceNewTournament(tournament);
                    break;
                case 'live':
                    result = isScrim
                        ? await announceScrimLive(tournament)
                        : await announceTournamentLive(tournament);
                    break;
                case 'completed':
                    result = isScrim
                        ? await announceScrimCompleted(tournament)
                        : await announceTournamentCompleted(tournament, tournament.winners?.[0]?.username);
                    break;
                case 'group_draw':
                    result = await announceGroupDraw(tournament, tournament.groups || []);
                    break;
                case 'game_start': {
                    const group = tournament.groups?.find(g => g.id === gameStartGroupId) || tournament.groups?.[0];
                    result = await announceGameStart(
                        tournament,
                        group?.name || 'All Groups',
                        tournament.map || 'TBD',
                        tournament.roomId,
                        tournament.roomPass
                    );
                    break;
                }
                case 'game_time': {
                    const group = tournament.groups?.find(g => g.id === gameStartGroupId) || tournament.groups?.[0];
                    result = await announceGameTime(
                        tournament,
                        group?.name || 'All Groups',
                        formatDate(tournament.startTime),
                        '30 minutes'
                    );
                    break;
                }
                default:
                    result = { success: false, message: 'Unknown action' };
            }
            showToast(result.message, result.success ? 'success' : 'error');
        } catch (err: any) {
            showToast('Discord announcement failed', 'error');
        } finally {
            setDiscordSending(null);
        }
    };

    // Match Update State
    const [isUpdateScoreModalOpen, setIsUpdateScoreModalOpen] = useState(false);    const [isResultUploaderOpen, setIsResultUploaderOpen] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<{ groupId: string, match: Match } | null>(null);
    const [matchScore, setMatchScore] = useState({ score1: 0, score2: 0, status: 'scheduled' as 'scheduled' | 'live' | 'completed', map: '' });

    // Manual Match State
    const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false);
    const [newMatchData, setNewMatchData] = useState({ 
        team1Id: '', 
        team2Id: '', 
        round: 1, 
        map: '',
        status: 'scheduled' as const
    });

    const handleAddMatch = async () => {
        if (!tournament || !selectedGroup) return;
        
        try {
            const match: Match = {
                id: `match-${Date.now()}`,
                team1Id: newMatchData.team1Id,
                team2Id: newMatchData.team2Id,
                round: newMatchData.round,
                map: newMatchData.map,
                status: newMatchData.status,
                score1: 0,
                score2: 0
            };

            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === selectedGroup.id) {
                    return { ...g, matches: [...(g.matches || []), match] };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            setIsAddMatchModalOpen(false);
            setNewMatchData({ team1Id: '', team2Id: '', round: 1, map: '', status: 'scheduled' });
            showToast('Match added successfully', 'success');
        } catch (error) {
            console.error("Error adding match:", error);
            showToast('Failed to add match', 'error');
        }
    };

    const handleUpdateScore = async () => {
        if (!tournament || !selectedMatch) return;

        try {
            if (selectedMatch.groupId === 'bracket') {
                const updatedBracketMatches = [...(tournament.bracketMatches || [])];
                const matchIndex = updatedBracketMatches.findIndex(m => m.id === selectedMatch.match.id);
                
                if (matchIndex === -1) return;

                const currentMatch = {
                    ...updatedBracketMatches[matchIndex],
                    score1: matchScore.score1,
                    score2: matchScore.score2,
                    status: matchScore.status,
                    map: matchScore.map
                };
                updatedBracketMatches[matchIndex] = currentMatch;

                // Propagate winner if match is completed
                if (currentMatch.status === 'completed') {
                    const winnerId = currentMatch.score1 > currentMatch.score2 ? currentMatch.team1Id : currentMatch.team2Id;
                    
                    // Match ID is bracket-R-P
                    const parts = currentMatch.id.split('-');
                    const round = parseInt(parts[1]);
                    const position = parseInt(parts[2]);
                    
                    const nextRound = round + 1;
                    const nextPosition = Math.floor(position / 2);
                    const isFirstInNextMatch = position % 2 === 0;
                    
                    const nextMatchId = `bracket-${nextRound}-${nextPosition}`;
                    const nextMatchIndex = updatedBracketMatches.findIndex(m => m.id === nextMatchId);
                    
                    if (nextMatchIndex !== -1) {
                        const nextMatch = { ...updatedBracketMatches[nextMatchIndex] };
                        if (isFirstInNextMatch) {
                            nextMatch.team1Id = winnerId || 'TBD';
                        } else {
                            nextMatch.team2Id = winnerId || 'TBD';
                        }
                        updatedBracketMatches[nextMatchIndex] = nextMatch;
                    }
                }

                await updateDoc(doc(db, 'tournaments', tournament.id), {
                    bracketMatches: updatedBracketMatches
                });
            } else {
                const updatedGroups = tournament.groups?.map(g => {
                    if (g.id === selectedMatch.groupId) {
                        return {
                            ...g,
                            matches: g.matches.map(m => {
                                if (m.id === selectedMatch.match.id) {
                                    return {
                                        ...m,
                                        score1: matchScore.score1,
                                        score2: matchScore.score2,
                                        status: matchScore.status,
                                        map: matchScore.map
                                    };
                                }
                                return m;
                            })
                        };
                    }
                    return g;
                }) || [];

                await updateDoc(doc(db, 'tournaments', tournament.id), {
                    groups: updatedGroups
                });
            }
            
            setIsUpdateScoreModalOpen(false);
            showToast('Score updated successfully', 'success');
        } catch (error) {
            console.error("Error updating score:", error);
            showToast('Failed to update score', 'error');
        }
    };
    const getTeamName = (teamId: string) => {
        if (teamId === 'TBD') return 'TBD';
        // Try groups first
        const groupTeam = tournament.groups?.flatMap(g => g.teams).find(t => t.id === teamId);
        if (groupTeam) return groupTeam.name;
        // Try participants
        const participant = participants.find(p => p.teamId === teamId || p.userId === teamId);
        if (participant) return participant.teamName || participant.username;
        return teamId;
    };

    const handleGenerateBracket = async () => {
        if (!tournament) return;
        
        // Collect all teams from all groups
        const allTeams: Team[] = [];
        tournament.groups?.forEach(g => {
            // In a real app, we would sort by points/wins and take top N
            // For now, take all teams that have played matches
            allTeams.push(...g.teams);
        });

        if (allTeams.length < 2) {
            showToast('Need at least 2 teams to generate bracket', 'error');
            return;
        }

        // Determine bracket size (next power of 2)
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(allTeams.length)));
        
        try {
            const bracketMatches: Match[] = [];
            let matchIdCounter = 1;
            
            // Generate first round
            for (let i = 0; i < bracketSize / 2; i++) {
                const team1 = allTeams[i * 2];
                const team2 = allTeams[i * 2 + 1];
                
                bracketMatches.push({
                    id: `bracket-1-${i}`,
                    team1Id: team1?.id || 'TBD',
                    team2Id: team2?.id || 'TBD',
                    status: 'scheduled',
                    score1: 0,
                    score2: 0,
                    round: 1
                });
            }

            // Generate subsequent rounds (empty matches)
            let matchesInRound = bracketSize / 2;
            let round = 2;
            while (matchesInRound > 1) {
                matchesInRound /= 2;
                for (let i = 0; i < matchesInRound; i++) {
                    bracketMatches.push({
                        id: `bracket-${round}-${i}`,
                        team1Id: 'TBD',
                        team2Id: 'TBD',
                        status: 'scheduled',
                        score1: 0,
                        score2: 0,
                        round: round
                    });
                }
                round++;
            }

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                bracketMatches,
                stage: 'knockout'
            });

            showToast('Knockout bracket generated', 'success');
        } catch (error) {
            console.error("Error generating bracket:", error);
            showToast('Failed to generate bracket', 'error');
        }
    };
    const handleGenerateGroupMatches = async (groupId: string, mode: 'round-robin' | 'single' = 'single') => {
        if (!tournament) return;
        const group = tournament.groups?.find(g => g.id === groupId);
        if (!group || group.teams.length < 2) {
            showToast('Need at least 2 teams to generate matches', 'error');
            return;
        }

        try {
            const matches: Match[] = [];
            let matchIdCounter = 1;

            if (mode === 'round-robin') {
                // Simple Round Robin generation
                for (let i = 0; i < group.teams.length; i++) {
                    for (let j = i + 1; j < group.teams.length; j++) {
                        matches.push({
                            id: `match-${Date.now()}-${matchIdCounter++}`,
                            team1Id: group.teams[i].id,
                            team2Id: group.teams[j].id,
                            status: 'scheduled',
                            score1: 0,
                            score2: 0,
                            round: tournament.currentRound || 1
                        });
                    }
                }
            } else {
                // Single match for physical group (everyone plays together - BR/PUBG style)
                // We use dummy team IDs but the ResultUploader handles the full team list
                matches.push({
                    id: `group-match-${Date.now()}`,
                    team1Id: 'ALL_TEAMS',
                    team2Id: 'ALL_TEAMS',
                    status: 'scheduled',
                    score1: 0,
                    score2: 0,
                    round: tournament.currentRound || 1,
                    map: tournament.map || ''
                });
            }

            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === groupId) {
                    return { ...g, matches: [...(g.matches || []), ...matches] };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            showToast(`${mode === 'single' ? 'Group Match' : 'Round Robin'} generated`, 'success');
        } catch (error) {
            console.error("Error generating matches:", error);
            showToast('Failed to generate matches', 'error');
        }
    };

    // Group participants by team for display
    const groupedParticipants = participants.reduce((acc: any, p) => {
        const teamKey = p.teamId || p.userId;
        if (!acc[teamKey]) {
            acc[teamKey] = {
                id: teamKey,
                name: p.teamName || p.username,
                logoUrl: p.logoUrl,
                players: p.teammates ? [p.username, ...p.teammates] : [p.username],
                participantId: p.id
            };
        }
        return acc;
    }, {});
    
    const availableTeams = Object.values(groupedParticipants).filter((team: any) => {
        // Check if team is already in ANY group
        return !tournament?.groups?.some(g => g.teams.some(t => t.id === team.id));
    });

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!tournament) return null;

    return (
        <div className="min-h-screen pt-24 pb-12 px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate(`/details/${tournament.id}`)}
                        className="p-3 bg-gray-950 border border-gray-800 rounded-full text-gray-400 hover:text-white hover:border-brand-500 transition-all hover:bg-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-4">
                            <Settings className="w-8 h-8 text-brand-500" />
                            Admin Panel
                        </h1>
                        <p className="text-sm text-gray-500 font-bold tracking-wide uppercase mt-1">{tournament.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => {
                            const csvContent = "data:text/csv;charset=utf-8," 
                                + ["Team Name,Username,In-Game ID,In-Game Name,Status", 
                                   ...participants.map(p => `"${p.teamName || 'Solo'}","${p.username}","${p.inGameId}","${p.inGameName}","${p.status}"`)
                                ].join("\n");
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `${tournament.title}_participants.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className="bg-gray-950 border border-gray-800 hover:border-brand-500 text-gray-500 hover:text-white p-3 rounded-full transition-all"
                        title="Export Participants"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                    <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        tournament.status === 'live' ? 'bg-green-500/10 text-green-500 border border-green-500/30' :
                        tournament.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30' :
                        'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                    }`}>
                        {tournament.status}
                    </span>
                    <span className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-brand-500/10 text-brand-400 border border-brand-500/30">
                        {tournament.stage || 'registration'}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-3 mb-12 pb-2 custom-scrollbar">
                {[
                    { id: 'overview', label: 'Overview', icon: Settings },
                    { id: 'groups', label: 'Groups & Teams', icon: Users },
                    { id: 'matches', label: 'Match Schedule', icon: Calendar },
                    { id: 'brackets', label: 'Brackets', icon: Trophy },
                    { id: 'settings', label: 'Settings', icon: Settings },
                    { id: 'participants', label: 'Registrations', icon: ShieldCheck },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-3 px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                            activeTab === tab.id 
                                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                                : 'bg-gray-950/50 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-gray-950/50 rounded-[2rem] border border-gray-800 p-8">
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' && (
                        <motion.div 
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                 <h2 className="text-xl font-black uppercase tracking-tighter text-white">Tournament Controls</h2>
                                 <button 
                                     onClick={() => window.location.reload()}
                                     className="px-5 py-2 bg-gray-900 border border-gray-800 text-gray-500 rounded-full hover:text-white hover:border-gray-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                 >
                                     <RotateCcw className="w-3 h-3" /> Refresh
                                 </button>
                             </div>
                             
                             {tournamentEarning && (
                                 <div className="bg-gray-900/50 border border-brand-500/10 rounded-[2rem] p-8 mb-8">
                                     <h3 className="text-xs font-black text-brand-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                                         <DollarSign className="w-4 h-4" /> Tournament Financials
                                     </h3>
                                     <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-8">
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Entry Fees</p>
                                             <p className="text-2xl font-black text-white font-mono">{formatCurrency(tournamentEarning.entryFeeTotal)}</p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Prize Pool</p>
                                             <p className="text-2xl font-black text-white font-mono">{formatCurrency(tournamentEarning.prizePoolTotal)}</p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Net Profit</p>
                                             <p className={`text-2xl font-black ${tournamentEarning.profit > 0 ? 'text-green-500' : 'text-red-500'} flex items-center gap-2 font-mono`}>
                                                 {tournamentEarning.profit > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                 {formatCurrency(tournamentEarning.profit)}
                                             </p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Your Share (85%)</p>
                                             <p className="text-2xl font-black text-brand-400 font-mono">{formatCurrency(tournamentEarning.orgShare)}</p>
                                             <span className={`inline-block mt-2 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                 tournamentEarning.status === 'released' ? 'bg-green-500/10 text-green-500' :
                                                 tournamentEarning.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                                 'bg-gray-800 text-gray-500'
                                             }`}>
                                                 {tournamentEarning.status}
                                             </span>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                 <div className="bg-gray-900/50 p-6 rounded-[2rem] border border-gray-800">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Status Control</h3>
                                     <div className="flex gap-3">
                                         <button 
                                             onClick={() => handleUpdateStatus('live')}
                                             disabled={tournament.status === 'live'}
                                             className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed py-4 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                         >
                                             <Play className="w-3 h-3" /> Start
                                         </button>
                                         <button 
                                             onClick={() => handleUpdateStatus('paused')}
                                             disabled={tournament.status === 'paused'}
                                             className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 disabled:opacity-30 disabled:cursor-not-allowed py-4 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                         >
                                             <Pause className="w-3 h-3" /> Pause
                                         </button>
                                     </div>
                                 </div>
                                 <div className="bg-gray-900/50 p-6 rounded-[2rem] border border-gray-800">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Stage Progression</h3>
                                     <select 
                                         value={tournament.stage || 'registration'}
                                         onChange={(e) => handleUpdateStage(e.target.value)}
                                         className="w-full bg-gray-950 border border-gray-800 rounded-full p-4 text-[10px] text-white font-black uppercase tracking-widest focus:border-brand-500 outline-none cursor-pointer transition-all"
                                     >
                                         <option value="registration">Registration</option>
                                         <option value="group_stage">Group Stage</option>
                                         <option value="knockout">Knockout Stage</option>
                                         <option value="completed">Completed</option>
                                     </select>
                                 </div>
                                 <div className="bg-gray-900/50 p-6 rounded-[2rem] border border-gray-800 sm:col-span-2 lg:col-span-1">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Quick Actions</h3>
                                     <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
                                         <button 
                                             onClick={() => {
                                                 if (tournament.groups && tournament.groups.length > 0) {
                                                     tournament.groups.forEach(g => handleGenerateGroupMatches(g.id));
                                                 } else {
                                                     showToast('No groups to generate matches for', 'info');
                                                 }
                                             }}
                                             className="flex-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                                         >
                                             Generate All Matches
                                         </button>
                                         <button 
                                             onClick={handleAdvanceRound}
                                             className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                                         >
                                             Advance Stage
                                         </button>
                                     </div>
                                 </div>
                             </div>

                             {/* ── Discord Announcements ── */}
                             <div className="bg-gray-900/50 p-8 rounded-[2rem] border border-[#5865F2]/20">
                                 <div className="flex items-center gap-3 mb-6">
                                     <div className="p-2 bg-[#5865F2]/10 rounded-xl border border-[#5865F2]/20">
                                         <Send className="w-4 h-4 text-[#5865F2]" />
                                     </div>
                                     <div>
                                         <h3 className="text-sm font-black text-white uppercase tracking-widest">Discord Announcements</h3>
                                         <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                             Posts to #{tournament.matchType === 'scrims' ? 'scrims' : 'tournaments'} channel
                                         </p>
                                     </div>
                                 </div>

                                 {/* Group selector for match-specific announces */}
                                 {(tournament.groups?.length ?? 0) > 0 && (
                                     <div className="mb-6">
                                         <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2">
                                             Target Group (for Game Start / Reminder)
                                         </label>
                                         <select
                                             value={gameStartGroupId}
                                             onChange={e => setGameStartGroupId(e.target.value)}
                                             aria-label="Select group for Discord announcement"
                                             className="bg-gray-950 border border-gray-800 rounded-full px-5 py-3 text-white text-xs font-black uppercase tracking-widest focus:border-[#5865F2] outline-none transition w-full sm:w-auto"
                                         >
                                             <option value="">All Groups</option>
                                             {tournament.groups?.map(g => (
                                                 <option key={g.id} value={g.id}>{g.name}</option>
                                             ))}
                                         </select>
                                     </div>
                                 )}

                                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                     {[
                                         { action: 'publish',    label: 'Publish',      color: 'text-[#5865F2] border-[#5865F2]/20 bg-[#5865F2]/10 hover:bg-[#5865F2]/20' },
                                         { action: 'live',       label: '🔴 Go Live',   color: 'text-red-400 border-red-500/20 bg-red-500/10 hover:bg-red-500/20' },
                                         { action: 'group_draw', label: 'Group Draw',   color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20' },
                                         { action: 'game_start', label: 'Match Start',  color: 'text-pink-400 border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20' },
                                         { action: 'game_time',  label: 'Time Remind',  color: 'text-purple-400 border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20' },
                                         { action: 'completed',  label: 'Completed',    color: 'text-green-400 border-green-500/20 bg-green-500/10 hover:bg-green-500/20' },
                                     ].map(btn => (
                                         <button
                                             key={btn.action}
                                             onClick={() => handleDiscord(btn.action)}
                                             disabled={discordSending !== null}
                                             className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${btn.color}`}
                                         >
                                             {discordSending === btn.action ? (
                                                 <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                             ) : (
                                                 <Send className="w-4 h-4" />
                                             )}
                                             {btn.label}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        </motion.div>
                    )}

                    {activeTab === 'groups' && (
                        <motion.div 
                            key="groups"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Groups Management</h2>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleAutoGenerateGroups}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Auto Generate Groups
                                    </button>
                                    <button 
                                        onClick={() => setIsCreateGroupModalOpen(true)}
                                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Create Group
                                    </button>
                                </div>
                            </div>
                            
                            {tournament.groups && tournament.groups.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {tournament.groups.map(group => (
                                        <div key={group.id} className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-brand-500/20 transition-all shadow-xl">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-md font-black text-white uppercase tracking-tight">{group.name}</h3>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1 font-bold">
                                                        <Users className="w-3 h-3 text-brand-500" /> {group.teams.length} / {group.teamLimit} TEAMS
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteGroup(group.id)}
                                                    className="p-2 text-gray-600 hover:text-red-500 transition-colors bg-dark rounded-lg border border-gray-800"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-[10px] bg-dark p-2 rounded-lg border border-gray-800 font-bold">
                                                    <span className="text-gray-500 flex items-center gap-1 uppercase">Access</span>
                                                    <span className={group.isPublic ? 'text-green-500' : 'text-yellow-500'}>
                                                        {group.isPublic ? 'PUBLIC' : 'PRIVATE'}
                                                    </span>
                                                </div>
                                                {group.passCode && (
                                                    <div className="flex items-center justify-between text-[10px] bg-dark p-2 rounded-lg border border-gray-800 font-bold">
                                                        <span className="text-gray-500 flex items-center gap-1 uppercase">Passcode</span>
                                                        <span className="text-white font-mono">{group.passCode}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedGroup(group);
                                                        setIsAddMatchModalOpen(true);
                                                    }}
                                                    className="flex-1 min-w-[80px] bg-purple-600/10 hover:bg-purple-600/20 text-purple-500 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-purple-500/10"
                                                >
                                                    Match
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedGroup(group);
                                                        setIsManageTeamsModalOpen(true);
                                                    }}
                                                    className="flex-1 min-w-[80px] bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-brand-500/10"
                                                >
                                                    Teams
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm("Generate a single Match for ALL teams in this group? (BR Style)")) {
                                                            handleGenerateGroupMatches(group.id, 'single');
                                                        } else if (window.confirm("Generate Round Robin matches? (1v1 for every pair)")) {
                                                            handleGenerateGroupMatches(group.id, 'round-robin');
                                                        }
                                                    }}
                                                    disabled={group.teams.length < 2}
                                                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-blue-500/10"
                                                >
                                                    GENERATE MATCHES
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">No groups created yet.</p>
                                    <p className="text-sm text-gray-500 mt-2">Create groups to organize teams for the group stage.</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'matches' && (
                        <motion.div 
                            key="matches"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Match Schedule</h2>
                            </div>
                            
                            {tournament.groups && tournament.groups.some(g => g.matches.length > 0) ? (
                                <div className="space-y-8">
                                    {tournament.groups.map(group => group.matches.length > 0 && (
                                        <div key={group.id} className="space-y-4">
                                            <h3 className="text-md font-black text-brand-500 uppercase tracking-widest">{group.name} Matches</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {group.matches.map(match => {
                                                    const team1 = group.teams.find(t => t.id === match.team1Id);
                                                    const team2 = group.teams.find(t => t.id === match.team2Id);
                                                    return (
                                                        <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-4 shadow-lg hover:border-brand-500/20 transition-all flex flex-col justify-between">
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
                                                                    <span className="text-[11px] font-bold text-white truncate max-w-[120px] uppercase tracking-tight">{team1?.name || 'TBD'}</span>
                                                                    <span className="text-md font-black text-brand-500">{match.score1}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                    <span className="text-[11px] font-bold text-white truncate max-w-[120px] uppercase tracking-tight">{team2?.name || 'TBD'}</span>
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
                                                                    className="bg-dark hover:bg-gray-800 text-gray-400 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-gray-800"
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
                                                                    className="bg-brand-600/10 hover:bg-brand-600 text-brand-500 hover:text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-brand-500/20"
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
                    )}

                    {activeTab === 'brackets' && (
                        <motion.div 
                            key="brackets"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Knockout Brackets</h2>
                                <button 
                                    onClick={handleGenerateBracket}
                                    disabled={tournament.bracketMatches && tournament.bracketMatches.length > 0}
                                    className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Generate Bracket
                                </button>
                            </div>
                            
                            {tournament.bracketMatches && tournament.bracketMatches.length > 0 ? (
                                <div className="overflow-x-auto pb-8 custom-scrollbar">
                                    <div className="flex gap-12 min-w-max">
                                        {/* Group matches by round */}
                                        {Array.from(new Set(tournament.bracketMatches.map(m => m.round))).sort().map(round => {
                                            const roundMatches = tournament.bracketMatches!.filter(m => m.round === round);
                                            return (
                                                <div key={round} className="flex flex-col gap-8 justify-center min-w-[250px]">
                                                    <h3 className="text-center text-sm font-black text-gray-500 uppercase tracking-widest mb-4">
                                                        {round === Math.max(...tournament.bracketMatches!.map(m => m.round)) ? 'Finals' : 
                                                         round === Math.max(...tournament.bracketMatches!.map(m => m.round)) - 1 ? 'Semi-Finals' : 
                                                         `Round ${round}`}
                                                    </h3>
                                                    {roundMatches.map(match => {
                                                        const team1Name = getTeamName(match.team1Id || 'TBD');
                                                        const team2Name = getTeamName(match.team2Id || 'TBD');

                                                        return (
                                                            <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-4 relative">
                                                                {/* Connector lines could be added here using pseudo-elements or SVGs */}
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                        <span className="text-sm font-bold text-white truncate max-w-[150px]">{team1Name}</span>
                                                                        <span className="text-lg font-black text-brand-500">{match.score1}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                        <span className="text-sm font-bold text-white truncate max-w-[150px]">{team2Name}</span>
                                                                        <span className="text-lg font-black text-brand-500">{match.score2}</span>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedMatch({ groupId: 'bracket', match });
                                                                        setMatchScore({ score1: match.score1, score2: match.score2, status: match.status, map: match.map || '' });
                                                                        setIsUpdateScoreModalOpen(true);
                                                                    }}
                                                                    className="w-full mt-3 bg-dark hover:bg-gray-800 text-gray-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-gray-800"
                                                                >
                                                                    Update
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">Bracket not generated.</p>
                                    <p className="text-sm text-gray-500 mt-2">Advance teams from the group stage to generate the knockout bracket.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                    {activeTab === 'settings' && (
                        <motion.div 
                            key="settings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-surface p-8 rounded-3xl border border-gray-800 space-y-8"
                        >
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Automated Point System</h2>
                                <p className="text-gray-500 text-sm font-medium">Configure how points are calculated for uploaded match results.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-500 border-b border-gray-800 pb-2">Scoring Rules</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Points Per Kill</label>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.pointsPerKill ?? 1}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setTournament({...tournament, pointSystem: { ...tournament.pointSystem!, pointsPerKill: val }});
                                                }}
                                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition font-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Placement Scale</label>
                                            <div className="text-[10px] text-gray-400 mb-2 font-bold italic">Configured in placement points list</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest flex justify-between">
                                            Placement Points
                                            <button 
                                                onClick={() => {
                                                    const current = tournament!.pointSystem?.placementPoints || [];
                                                    const nextRank = current.length + 1;
                                                    const newList = [...current, { rank: nextRank, points: 0 }];
                                                    setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                }}
                                                className="text-brand-500 hover:text-brand-400 normal-case"
                                            >
                                                + Add Rank
                                            </button>
                                        </label>
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                            {tournament.pointSystem?.placementPoints?.map((p, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-dark p-2 rounded-xl border border-gray-800 group">
                                                    <span className="w-8 text-center text-xs font-black text-gray-600">#{p.rank}</span>
                                                    <input 
                                                        type="number"
                                                        value={p.points}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            const newList = [...(tournament!.pointSystem?.placementPoints || [])];
                                                            newList[idx].points = val;
                                                            setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                        }}
                                                        className="flex-1 bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm focus:border-brand-500 outline-none font-bold"
                                                    />
                                                    <button 
                                                        onClick={() => {
                                                            const newList = tournament!.pointSystem?.placementPoints?.filter((_, i) => i !== idx);
                                                            setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                        }}
                                                        className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-500 border-b border-gray-800 pb-2">Additional Bonuses</h3>
                                    <div className="bg-dark p-4 rounded-2xl border border-gray-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-white">Winner Bonus</p>
                                                <p className="text-xs text-gray-500">Extra points for #1 placement</p>
                                            </div>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.winnerBonus || 0}
                                                onChange={(e) => setTournament({
                                                    ...tournament,
                                                    pointSystem: { ...tournament.pointSystem, winnerBonus: parseInt(e.target.value) || 0 }
                                                })}
                                                placeholder="0"
                                                className="w-16 bg-surface border border-gray-800 text-white rounded-lg p-2 text-center text-sm font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-white">Consistency Bonus</p>
                                                <p className="text-xs text-gray-500">Points for 3+ consecutive kills</p>
                                            </div>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.consistencyBonus || 0}
                                                onChange={(e) => setTournament({
                                                    ...tournament,
                                                    pointSystem: { ...tournament.pointSystem, consistencyBonus: parseInt(e.target.value) || 0 }
                                                })}
                                                placeholder="0"
                                                className="w-16 bg-surface border border-gray-800 text-white rounded-lg p-2 text-center text-sm font-bold"
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        onClick={async () => {
                                            if (!tournament) return;
                                            try {
                                                const tRef = doc(db, 'tournaments', tournament.id);
                                                await updateDoc(tRef, { pointSystem: tournament.pointSystem });
                                                showToast('Point System saved!', 'success');
                                            } catch (error) {
                                                showToast('Failed to save point system', 'error');
                                            }
                                        }}
                                        className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-5 h-5" /> Save Configuration
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-8 space-y-6">
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-2">Tournament Roadmap</h3>
                                    <p className="text-gray-500 text-sm font-medium">Define the timeline and stages of the tournament for the public roadmap view.</p>
                                </div>
                                
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {(tournament.roadmap || []).map((step, idx) => (
                                        <div key={idx} className="bg-dark p-6 rounded-2xl border border-gray-800 space-y-4 group relative shadow-2xl hover:border-brand-500/30 transition-all">
                                            <button 
                                                onClick={() => {
                                                    const newList = (tournament.roadmap || []).filter((_, i) => i !== idx);
                                                    setTournament({...tournament, roadmap: newList});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-600 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                            >
                                                <XCircle className="w-3 h-3" />
                                            </button>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-brand-500 font-black uppercase tracking-widest">Stage {idx + 1}</span>
                                                <select 
                                                    value={(step as any).status || 'upcoming'}
                                                    onChange={(e) => {
                                                        const newList = [...(tournament.roadmap || [])];
                                                        (newList[idx] as any).status = e.target.value;
                                                        setTournament({...tournament, roadmap: newList});
                                                    }}
                                                    className="bg-black/50 border border-white/10 rounded text-[8px] font-black uppercase text-gray-400 px-1"
                                                >
                                                    <option value="upcoming">Upcoming</option>
                                                    <option value="current">Current</option>
                                                    <option value="completed">Completed</option>
                                                </select>
                                            </div>
                                            <input 
                                                type="text" 
                                                value={(step as any).stageName || `Round ${step.roundNumber}`}
                                                onChange={(e) => {
                                                    const newList = [...(tournament.roadmap || [])];
                                                    (newList[idx] as any).stageName = e.target.value;
                                                    setTournament({...tournament, roadmap: newList});
                                                }}
                                                placeholder="Stage Name"
                                                className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm font-black outline-none focus:border-brand-500"
                                            />
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="block text-[8px] text-gray-600 font-black uppercase mb-1">Qualifiers</label>
                                                    <input 
                                                        type="number"
                                                        value={step.qualificationRule}
                                                        onChange={(e) => {
                                                            const newList = [...(tournament.roadmap || [])];
                                                            newList[idx].qualificationRule = parseInt(e.target.value) || 0;
                                                            setTournament({...tournament, roadmap: newList});
                                                        }}
                                                        className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-xs font-mono"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[8px] text-gray-600 font-black uppercase mb-1">Groups</label>
                                                    <input 
                                                        type="number"
                                                        value={step.numGroups}
                                                        onChange={(e) => {
                                                            const newList = [...(tournament.roadmap || [])];
                                                            newList[idx].numGroups = parseInt(e.target.value) || 1;
                                                            setTournament({...tournament, roadmap: newList});
                                                        }}
                                                        className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-xs font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            const current = tournament.roadmap || [];
                                            const nextRound = current.length + 1;
                                            const newList = [...current, { roundNumber: nextRound, numGroups: 1, qualificationRule: 1, maps: [], status: 'upcoming', stageName: '' } as any];
                                            setTournament({...tournament, roadmap: newList});
                                        }}
                                        className="h-full min-h-[160px] border-2 border-dashed border-gray-800 hover:border-brand-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-brand-500 transition-all group"
                                    >
                                        <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Add Roadmap Stage</span>
                                    </button>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const tRef = doc(db, 'tournaments', tournament.id);
                                                await updateDoc(tRef, { roadmap: tournament.roadmap });
                                                showToast('Roadmap saved successfully!', 'success');
                                            } catch (error) {
                                                showToast('Failed to save roadmap', 'error');
                                            }
                                        }}
                                        className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Save className="w-5 h-5" /> Save Roadmap
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}


                    {activeTab === 'participants' && (
                        <motion.div 
                            key="participants"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-surface p-8 rounded-3xl border border-gray-800 space-y-8"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Participant Registrations</h2>
                                    <p className="text-gray-500 text-sm font-medium">Review and manage player registrations for your tournament.</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="bg-dark px-6 py-3 rounded-2xl border border-gray-800 text-center">
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Approved</div>
                                        <div className="text-xl font-black text-white">{participants.filter(p => p.status === 'approved').length}</div>
                                    </div>
                                    <div className="bg-dark px-6 py-3 rounded-2xl border border-gray-800 text-center">
                                        <div className="text-[10px] text-yellow-500/50 font-black uppercase tracking-widest mb-1">Pending</div>
                                        <div className="text-xl font-black text-yellow-500">{participants.filter(p => p.status === 'pending').length}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-800">
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Player / Team</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">In-Game Details</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {participants.length > 0 ? (
                                            participants.map((p) => (
                                                <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-dark border border-gray-800 overflow-hidden">
                                                                <img src={p.logoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-white">{p.username}</p>
                                                                <p className="text-[10px] text-brand-500 font-bold uppercase">{p.teamName || 'Solo'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4">
                                                        <p className="text-xs font-bold text-white">{p.inGameName}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono">{p.inGameId}</p>
                                                    </td>
                                                    <td className="py-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${
                                                            p.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                                            p.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                                            'bg-yellow-500/10 text-yellow-500'
                                                        }`}>
                                                            {p.status || 'pending'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {p.status !== 'approved' && (
                                                                <button 
                                                                    onClick={async () => {
                                                                        try {
                                                                            await updateDoc(doc(db, 'participants', p.id), { status: 'approved' });
                                                                            setParticipants(participants.map(part => part.id === p.id ? { ...part, status: 'approved' } : part));
                                                                            showToast('Player approved', 'success');
                                                                        } catch (error) {
                                                                            showToast('Failed to approve', 'error');
                                                                        }
                                                                    }}
                                                                    className="p-2 border border-green-500/20 text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {p.status !== 'rejected' && (
                                                                <button 
                                                                    onClick={async () => {
                                                                        if (!window.confirm('Reject this registration?')) return;
                                                                        try {
                                                                            await updateDoc(doc(db, 'participants', p.id), { status: 'rejected' });
                                                                            setParticipants(participants.map(part => part.id === p.id ? { ...part, status: 'rejected' } : part));
                                                                            showToast('Player rejected', 'info');
                                                                        } catch (error) {
                                                                            showToast('Failed to reject', 'error');
                                                                        }
                                                                    }}
                                                                    className="p-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                                    title="Reject"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                                                    No participants registered yet
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Create Group Modal */}
            <Modal isOpen={isCreateGroupModalOpen} onClose={() => setIsCreateGroupModalOpen(false)} title="Create New Group">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Group Name</label>
                        <input 
                            type="text" 
                            value={newGroup.name}
                            onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                            placeholder="e.g., Group A, Region East"
                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Team Limit</label>
                        <input 
                            type="number" 
                            value={newGroup.teamLimit}
                            onChange={(e) => setNewGroup({...newGroup, teamLimit: parseInt(e.target.value) || 0})}
                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                        />
                    </div>
                    <div className="flex items-center justify-between bg-dark p-3 rounded-xl border border-gray-800">
                        <div>
                            <p className="text-sm font-bold text-white">Public Group</p>
                            <p className="text-xs text-gray-500">Anyone can join if they have the link</p>
                        </div>
                        <button 
                            onClick={() => setNewGroup({...newGroup, isPublic: !newGroup.isPublic})}
                            className={`w-12 h-6 rounded-full transition-colors relative ${newGroup.isPublic ? 'bg-brand-500' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${newGroup.isPublic ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {!newGroup.isPublic && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Passcode</label>
                            <input 
                                type="text" 
                                value={newGroup.passCode}
                                onChange={(e) => setNewGroup({...newGroup, passCode: e.target.value})}
                                placeholder="Enter a secure passcode"
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                            />
                        </div>
                    )}
                    <div className="pt-4 flex gap-3">
                        <button 
                            onClick={() => setIsCreateGroupModalOpen(false)}
                            className="flex-1 bg-dark hover:bg-gray-800 text-white py-3 rounded-xl font-bold transition border border-gray-800"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleCreateGroup}
                            disabled={!newGroup.name.trim()}
                            className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition"
                        >
                            Create Group
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Manage Teams Modal */}
            <Modal isOpen={isManageTeamsModalOpen} onClose={() => setIsManageTeamsModalOpen(false)} title={`Manage Teams: ${selectedGroup?.name}`} maxWidth="max-w-4xl">
                {selectedGroup && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[60vh]">
                        {/* Assigned Teams */}
                        <div className="flex flex-col h-full bg-dark rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-surface flex justify-between items-center">
                                <h3 className="font-black text-white uppercase tracking-widest text-sm">Assigned Teams</h3>
                                <span className="text-xs font-bold text-gray-500">{selectedGroup.teams.length} / {selectedGroup.teamLimit}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {selectedGroup.teams.length > 0 ? (
                                    selectedGroup.teams.map(team => (
                                        <div key={team.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-gray-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden">
                                                    {team.logoUrl ? (
                                                        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {team.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{team.name}</p>
                                                    <p className="text-[10px] text-gray-500">{team.players.length} Players</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveTeam(team.id)}
                                                className="text-gray-500 hover:text-red-500 transition-colors p-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <Users className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">No teams assigned yet</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Available Teams */}
                        <div className="flex flex-col h-full bg-dark rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-surface flex justify-between items-center">
                                <h3 className="font-black text-white uppercase tracking-widest text-sm">Available Teams</h3>
                                <span className="text-xs font-bold text-gray-500">{availableTeams.length} Total</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {fetchingParticipants ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
                                    </div>
                                ) : availableTeams.length > 0 ? (
                                    availableTeams.map((team: any) => (
                                        <div key={team.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-gray-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden">
                                                    {team.logoUrl ? (
                                                        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {team.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{team.name}</p>
                                                    <p className="text-[10px] text-gray-500">{team.players.length} Players</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleAssignTeam(team.participantId)}
                                                disabled={selectedGroup.teams.length >= selectedGroup.teamLimit}
                                                className="bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                Assign
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <Users className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm text-center px-4">All registered teams have been assigned to groups.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
            {/* Update Score Modal */}
            <Modal isOpen={isUpdateScoreModalOpen} onClose={() => setIsUpdateScoreModalOpen(false)} title="Update Match Score">
                {selectedMatch && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
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
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Map Name</label>
                            <input 
                                type="text" 
                                value={matchScore.map || ''}
                                onChange={(e) => setMatchScore({...matchScore, map: e.target.value})}
                                placeholder="e.g., Erangel, Miramar"
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Match Status</label>
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
                                className="flex-1 bg-dark hover:bg-gray-800 text-white py-3 rounded-xl font-bold transition border border-gray-800"
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
            {selectedMatch && selectedGroup && isResultUploaderOpen && (
                <ResultUploader 
                    isOpen={isResultUploaderOpen}
                    onClose={() => setIsResultUploaderOpen(false)}
                    tournament={tournament}
                    group={selectedGroup}
                    match={selectedMatch.match}
                    onSuccess={() => setIsResultUploaderOpen(false)}
                />
            )}

            {/* Add Match Modal */}
            <Modal isOpen={isAddMatchModalOpen} onClose={() => setIsAddMatchModalOpen(false)} title={`Add Match to ${selectedGroup?.name}`}>
                {selectedGroup && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Team 1</label>
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
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Team 2</label>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Round</label>
                                <input 
                                    type="number"
                                    value={newMatchData.round}
                                    onChange={(e) => setNewMatchData({...newMatchData, round: parseInt(e.target.value) || 1})}
                                    className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Map</label>
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
                                className="flex-1 bg-dark hover:bg-gray-800 text-white py-3 rounded-xl font-bold transition border border-gray-800"
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
        </div>
    );
}
