import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament, TournamentGroup, Match, Team, TournamentEarning } from '../../../shared/types/types';
import { formatDate } from '../../../shared/utils/utils';
import { calculateRevenueSplit } from '../../../shared/constants/finance';
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
import {
    generateGroups,
    generateMatchesForRound,
    calculateGroupStandings,
    generateQualificationPreview,
    getQualifiedTeams,
    createNextRound,
    isBRTournament,
    isRoundComplete,
    computeRoadmap,
    computeTournamentProgress,
    getCurrentStage,
    getNextStage,
    validateGroupAssignment,
} from '../../../shared/services/tournamentEngine';

export function useTournamentAdmin(
    id: string | undefined,
    navigate: (path: string) => void,
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
) {
    const { user, profile } = useAuth();
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
                if (data.hostUid !== user.uid && profile?.role !== 'admin') {
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
        }, (error) => {
            console.error('Tournament snapshot error:', error);
            showToast('Failed to load tournament data.', 'error');
            setLoading(false);
        });

        // Participants Listener
        const q = query(collection(db, 'participants'), where('tournamentId', '==', id));
        const unsubParticipants = onSnapshot(q, (partSnap) => {
            setParticipants(partSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setFetchingParticipants(false);
        }, (error) => {
            console.error('Participants snapshot error:', error);
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

            // ponytail: earnings record is now created server-side by /api/wallet/distribute-prizes
            // Admin just updates status — earnings already created atomically with prize distribution
            if (status === 'completed') {
                const existingEarnings = await getDocs(
                    query(collection(db, 'tournamentEarnings'), where('tournamentId', '==', tournament.id))
                );
                if (existingEarnings.empty) {
                    // Fallback: organizer hasn't distributed prizes yet, create earnings record
                    const approvedParticipants = participants.filter(p => p.status === 'approved');
                    const entryFeeTotal = approvedParticipants.length * (tournament.entryFee || 0);
                    const prizePoolTotal = tournament.prizePool || 0;
                    const profit = entryFeeTotal - prizePoolTotal;
                    const { orgShare, nexplayShare } = calculateRevenueSplit(profit);

                    await setDoc(doc(collection(db, 'tournamentEarnings')), {
                        tournamentId: tournament.id,
                        tournamentName: tournament.title,
                        orgId: tournament.hostUid,
                        orgName: tournament.hostName || '',
                        entryFeeTotal,
                        prizePoolTotal,
                        profit,
                        orgShare,
                        nexplayShare,
                        status: 'pending',
                        createdAt: serverTimestamp(),
                    });
                    showToast('Tournament completed. Earnings record created.', 'success');
                } else {
                    showToast(`Tournament status updated to ${status}`, 'success');
                }
            } else {
                showToast(`Tournament status updated to ${status}`, 'success');
            }
        } catch (error) {
            showToast('Failed to update status', 'error');
            console.error('Status update error:', error);
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

        // ponytail: validate before generating
        if (!window.confirm(`Auto-generate groups for ${approvedParticipants.length} participants? This will reset existing groups.`)) return;

        try {
            setLoading(true);
            const round1Config = tournament.roadmap?.[0];
            const numGroups = round1Config?.numGroups || Math.ceil(approvedParticipants.length / 12);
            const teamsPerGroup = round1Config?.teamsPerGroup || Math.ceil(approvedParticipants.length / numGroups);
            const namingStyle = (round1Config as any)?.groupNamingStyle || 'alpha';
            const distributionMethod = (round1Config as any)?.distributionMethod || 'random';

            // Use the engine — single source of truth for group generation
            const result = generateGroups({
                participants: approvedParticipants,
                numGroups,
                teamsPerGroup,
                distributionMethod,
                namingStyle,
                roundNumber: 1,
                maps: round1Config?.maps,
            });

            // Validate no duplicates
            const validation = validateGroupAssignment(result.groups as TournamentGroup[]);
            if (!validation.valid) {
                showToast(`Group validation failed: ${validation.errors.join(', ')}`, 'error');
                return;
            }

            // Auto-generate matches for each group
            const isBR = isBRTournament(tournament);
            const matchesPerGroup = round1Config?.matchesPerGroup || (isBR ? 3 : 0);
            const groupsWithMatches = generateMatchesForRound({
                groups: result.groups as TournamentGroup[],
                matchesPerGroup,
                isBR,
                roundNumber: 1,
                maps: round1Config?.maps,
            });

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: groupsWithMatches,
                stage: 'group_stage',
                currentRound: 1
            });

            showToast(`Groups generated: ${result.groups.length} groups, ${result.totalAssigned} teams assigned`, 'success');
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

                // ponytail: use the engine — single source of truth for standings + qualification
                // CRITICAL FIX: was using m.score1/score2 (1v1) instead of m.results[] (BR)
                const roundStatus = isRoundComplete({ groups: tournament.groups, tournament });
                if (!roundStatus.complete) {
                    throw new Error(`Cannot advance: ${roundStatus.completedMatches}/${roundStatus.totalMatches} matches completed.`);
                }

                // Generate qualification preview using the scoring engine
                const qualificationCount = currentRoundConfig?.qualificationRule || 2;
                const preview = generateQualificationPreview({
                    groups: tournament.groups,
                    tournament,
                    roundNumber: tournament.currentRound || 1,
                    qualificationCount,
                    qualificationType: (currentRoundConfig as any)?.qualificationType || 'top_n_per_group',
                });

                // Check for ties requiring review
                if (preview.tiesRequiringReview.length > 0) {
                    const tieNames = preview.tiesRequiringReview.map(t => t.teamName).join(', ');
                    throw new Error(`Tie at qualification cutoff requires admin review: ${tieNames}`);
                }

                const qualifiers = getQualifiedTeams(preview);
                if (qualifiers.length < 2) {
                    throw new Error("Not enough teams qualified for the next stage.");
                }

                if (nextRoundConfig) {
                    // Build qualifiersByGroup for cross-group distribution
                    const qualifiersByGroup = preview.groups.map(g => ({
                        groupName: g.groupName,
                        teams: g.standings
                            .filter(s => s.qualificationStatus === 'qualified')
                            .map(s => ({ id: s.teamId, name: s.teamName, logoUrl: s.logoUrl } as Team)),
                    }));

                    // Use the engine to create the next round with cross-group distribution
                    const nextRound = createNextRound({
                        qualifiedTeams: qualifiers,
                        qualifiersByGroup,
                        nextRoundConfig: nextRoundConfig as any,
                        tournament,
                    });

                    await updateDoc(doc(db, 'tournaments', tournament.id), {
                        groups: nextRound.groups,
                        currentRound: nextRound.roundNumber,
                    });
                    showToast(`Advanced to ${nextRoundConfig.stageName || 'Round ' + nextRound.roundNumber}! ${qualifiers.length} teams qualified, ${preview.totalEliminated} eliminated.`, 'success');
                } else {
                    // No more rounds in roadmap — generate knockout bracket from qualifiers
                    const bracketSize = Math.pow(2, Math.ceil(Math.log2(qualifiers.length)));
                    const bracketMatches: Match[] = [];
                    
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
            // ponytail: use the engine — no more ALL_TEAMS hack
            const isBR = isBRTournament(tournament);
            const roundConfig = tournament.roadmap?.[((tournament.currentRound || 1) - 1)];
            const matchesPerGroup = roundConfig?.matchesPerGroup || (isBR ? (mode === 'single' ? 1 : 3) : 0);
            const maps = roundConfig?.maps || (tournament.map ? [tournament.map] : []);

            const matches = generateMatchesForRound({
                groups: [group],
                matchesPerGroup: isBR ? matchesPerGroup : 0, // 0 = round-robin for 1v1
                isBR,
                roundNumber: tournament.currentRound || 1,
                maps,
            })[0].matches;

            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === groupId) {
                    return { ...g, matches: [...(g.matches || []), ...matches] };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            showToast(`${matches.length} ${isBR ? 'lobby' : 'round-robin'} match(es) generated`, 'success');
        } catch (error) {
            console.error("Error generating matches:", error);
            showToast('Failed to generate matches', 'error');
        }
    };



    // ponytail: shared props object — spread to all tabs, each destructures what it needs
    return { activeTab, discordSending, fetchingParticipants, gameStartGroupId, handleAdvanceRound, handleAssignTeam, handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup, handleDiscord, handleRemoveTeam, handleUpdateStage, handleUpdateStatus, isAddMatchModalOpen, isCreateGroupModalOpen, isManageTeamsModalOpen, isResultUploaderOpen, isUpdateScoreModalOpen, loading, matchScore, newGroup, newMatchData, participants, selectedGroup, selectedMatch, setActiveTab, setGameStartGroupId, setIsAddMatchModalOpen, setIsCreateGroupModalOpen, setIsManageTeamsModalOpen, setIsResultUploaderOpen, setIsUpdateScoreModalOpen, setMatchScore, setNewGroup, setNewMatchData, setParticipants, setSelectedGroup, setSelectedMatch, tournamentEarning, tournament, setTournament, handleAddMatch, handleUpdateScore, handleGenerateBracket, handleGenerateGroupMatches, getTeamName };
}
