import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Shield, Crown, Crosshair, AlertCircle } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament } from '../../../shared/types/types';
import { FREE_FIRE_DEFAULT_SCORING } from '../../../shared/types/scoring';
import { formatCurrency } from '../../../shared/utils/utils';

export interface ScrimResultRow {
    sn: number;
    name: string;
    tag?: string;
    logo?: string | null;
    kills: number;
    placementPoints: number;
    totalPoints: number;
    prize?: number;
    isRealPlayer?: boolean;
}

interface ScrimResultsTableProps {
    tournament: Tournament;
    participants?: any[];
    slots?: any[];
    compact?: boolean;
}

/**
 * Resolves how many places receive a prize in this event.
 * If prize distribution is configured, uses the count of paid ranks.
 * Otherwise defaults to top 3 if a prize pool exists, or 1 for winner-takes-all.
 */
export function getPrizeWinnerCount(tournament: Tournament): number {
    // 1. Check prizeDistribution array
    if (Array.isArray(tournament.prizeDistribution) && tournament.prizeDistribution.length > 0) {
        const payingRanks = tournament.prizeDistribution.filter(p => Number(p.amount) > 0);
        if (payingRanks.length > 0) {
            return Math.max(...payingRanks.map(p => Number(p.rank) || 1));
        }
    }

    // 2. Check winners array
    const winners = (Array.isArray(tournament.winners) && tournament.winners.length > 0)
        ? tournament.winners
        : (Array.isArray((tournament as any).results) && (tournament as any).results.length > 0)
        ? (tournament as any).results
        : (Array.isArray((tournament as any).podium) && (tournament as any).podium.length > 0)
        ? (tournament as any).podium
        : [];
    if (winners.length > 0) {
        const payingWinners = winners.filter((w: any) => Number(w.prize || w.amount || 0) > 0);
        if (payingWinners.length > 0) {
            return Math.max(...payingWinners.map((w: any) => Number(w.rank || w.placement) || 1));
        }
    }

    // 3. Fallback based on prizePool
    const pool = Number(tournament.prizePool || (tournament as any).requirements?.entryFee || 0);
    if (pool > 0) {
        return 3; // Default esports standard top 3 payout
    }

    return 1; // Default top 1 (Champion)
}

/**
 * Resolves scoring configuration snapshot for placement & kill points calculation.
 */
function resolveScoring(tournament: Tournament) {
    if (tournament.scoringSnapshot) {
        return {
            killPoints: Number(tournament.scoringSnapshot.killPoints ?? 1),
            placementPoints: tournament.scoringSnapshot.placementPoints ?? FREE_FIRE_DEFAULT_SCORING.placementPoints,
        };
    }
    if (tournament.pointSystem) {
        const placementPoints: Record<string, number> = {};
        if (tournament.pointSystem.placementPoints) {
            for (const p of tournament.pointSystem.placementPoints) {
                placementPoints[String(p.rank)] = p.points;
            }
        }
        return {
            killPoints: Number(tournament.pointSystem.pointsPerKill ?? 1),
            placementPoints: Object.keys(placementPoints).length > 0 ? placementPoints : FREE_FIRE_DEFAULT_SCORING.placementPoints,
        };
    }
    return {
        killPoints: Number(FREE_FIRE_DEFAULT_SCORING.killPoints ?? 1),
        placementPoints: FREE_FIRE_DEFAULT_SCORING.placementPoints,
    };
}

export const ScrimResultsTable: React.FC<ScrimResultsTableProps> = ({ tournament, participants = [], slots }) => {
    const scoring = useMemo(() => resolveScoring(tournament), [tournament]);
    const prizeWinnerCount = useMemo(() => getPrizeWinnerCount(tournament), [tournament]);

    // Dynamic Team Logo cache: maps teamId, normalized teamName, and ownerId -> logoUrl
    const [teamLogos, setTeamLogos] = useState<Record<string, string>>({});
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

    useEffect(() => {
        let isMounted = true;

        async function fetchTeamLogos() {
            if (!tournament) return;
            const logoMap: Record<string, string> = {};
            const teamIdsToFetch = new Set<string>();
            const teamNamesToFetch = new Set<string>();
            const ownerIdsToFetch = new Set<string>();

            // 1. Collect identifiers from slots
            const slotsArray = Array.isArray(slots) ? slots : Array.isArray(tournament.slots) ? (tournament.slots as any[]) : [];
            slotsArray.forEach((s: any) => {
                if (!s) return;
                const rawName = s.teamName || s.inGameName || s.username;
                const normName = rawName ? String(rawName).trim().toLowerCase() : '';
                const logo = s.teamLogo || s.logoUrl || s.logo;

                if (s.teamId) {
                    teamIdsToFetch.add(s.teamId);
                    if (logo) logoMap[s.teamId] = logo;
                }
                if (normName) {
                    teamNamesToFetch.add(normName);
                    if (rawName) teamNamesToFetch.add(String(rawName).trim());
                    if (logo) logoMap[normName] = logo;
                }
                const uid = s.captainUid || s.userId || s.reservedBy;
                if (uid) {
                    ownerIdsToFetch.add(uid);
                    if (logo) logoMap[uid] = logo;
                }
            });

            // 2. Collect identifiers from participants array
            const partArray = Array.isArray(participants) ? participants : [];
            partArray.forEach((p: any) => {
                if (!p) return;
                const rawName = p.teamName || p.inGameName || p.username;
                const normName = rawName ? String(rawName).trim().toLowerCase() : '';
                const logo = p.teamLogo || p.logoUrl || p.logo;

                if (p.teamId) {
                    teamIdsToFetch.add(p.teamId);
                    if (logo) logoMap[p.teamId] = logo;
                }
                if (normName) {
                    teamNamesToFetch.add(normName);
                    if (rawName) teamNamesToFetch.add(String(rawName).trim());
                    if (logo) logoMap[normName] = logo;
                }
                const uid = p.captainUid || p.userId;
                if (uid) {
                    ownerIdsToFetch.add(uid);
                    if (logo) logoMap[uid] = logo;
                }
            });

            // 3. Collect identifiers from manual results
            if (Array.isArray(tournament.manualResults)) {
                tournament.manualResults.forEach((m: any) => {
                    if (!m) return;
                    const rawName = m.team || m.name;
                    const normName = rawName ? String(rawName).trim().toLowerCase() : '';
                    if (normName) {
                        teamNamesToFetch.add(normName);
                        if (rawName) teamNamesToFetch.add(String(rawName).trim());
                        if (m.logo) logoMap[normName] = m.logo;
                    }
                    if (m.teamId) {
                        teamIdsToFetch.add(m.teamId);
                        if (m.logo) logoMap[m.teamId] = m.logo;
                    }
                });
            }

            // 4. Collect identifiers from winners
            const rawWinners: any[] = (Array.isArray(tournament.winners) && tournament.winners.length > 0)
                ? tournament.winners
                : (Array.isArray((tournament as any).results) && (tournament as any).results.length > 0)
                ? (tournament as any).results
                : (Array.isArray((tournament as any).podium) && (tournament as any).podium.length > 0)
                ? (tournament as any).podium
                : [];
            rawWinners.forEach((w: any) => {
                if (!w) return;
                const rawName = w.teamName || w.username || w.name;
                const normName = rawName ? String(rawName).trim().toLowerCase() : '';
                const logo = w.logo || w.teamLogo || w.avatar || w.profilePicUrl;
                if (normName) {
                    teamNamesToFetch.add(normName);
                    if (rawName) teamNamesToFetch.add(String(rawName).trim());
                    if (logo) logoMap[normName] = logo;
                }
                if (w.teamId) {
                    teamIdsToFetch.add(w.teamId);
                    if (logo) logoMap[w.teamId] = logo;
                }
                if (w.userId) {
                    ownerIdsToFetch.add(w.userId);
                    if (logo) logoMap[w.userId] = logo;
                }
            });

            try {
                // 1. Fetch by teamId directly
                const teamIdArr = Array.from(teamIdsToFetch).filter(Boolean);
                for (let i = 0; i < teamIdArr.length; i += 30) {
                    const chunk = teamIdArr.slice(i, i + 30);
                    try {
                        const q = query(collection(db, 'teams'), where('__name__', 'in', chunk));
                        const snap = await getDocs(q);
                        snap.docs.forEach((d) => {
                            const data = d.data();
                            const logo = data.logoUrl || data.logo || null;
                            if (logo) {
                                logoMap[d.id] = logo;
                                if (data.name) {
                                    logoMap[String(data.name).trim().toLowerCase()] = logo;
                                    logoMap[String(data.name).trim()] = logo;
                                }
                                if (data.tag) {
                                    logoMap[String(data.tag).trim().toLowerCase()] = logo;
                                    logoMap[String(data.tag).trim()] = logo;
                                }
                                if (data.ownerId) logoMap[data.ownerId] = logo;
                            }
                        });
                    } catch (err) {
                        // Fallback to individual getDoc if batch query fails
                        for (const tid of chunk) {
                            try {
                                const singleSnap = await getDoc(doc(db, 'teams', tid));
                                if (singleSnap.exists()) {
                                    const data = singleSnap.data();
                                    const logo = data?.logoUrl || data?.logo || null;
                                    if (logo) {
                                        logoMap[singleSnap.id] = logo;
                                        if (data?.name) {
                                            logoMap[String(data.name).trim().toLowerCase()] = logo;
                                            logoMap[String(data.name).trim()] = logo;
                                        }
                                        if (data?.ownerId) logoMap[data.ownerId] = logo;
                                    }
                                }
                            } catch {
                                // ignore individual fetch error
                            }
                        }
                    }
                }

                // 2. Fetch by ownerId for players who created teams
                const missingOwners = Array.from(ownerIdsToFetch).filter(uid => !logoMap[uid]);
                for (let i = 0; i < missingOwners.length; i += 30) {
                    const chunk = missingOwners.slice(i, i + 30);
                    try {
                        const q = query(collection(db, 'teams'), where('ownerId', 'in', chunk));
                        const snap = await getDocs(q);
                        snap.docs.forEach((d) => {
                            const data = d.data();
                            const logo = data.logoUrl || data.logo || null;
                            if (logo) {
                                logoMap[d.id] = logo;
                                if (data.name) {
                                    logoMap[String(data.name).trim().toLowerCase()] = logo;
                                    logoMap[String(data.name).trim()] = logo;
                                }
                                if (data.ownerId) logoMap[data.ownerId] = logo;
                            }
                        });
                    } catch {
                        // Ignore owner query error
                    }
                }

                // 3. Fetch by team name if still unresolved
                const missingNames = Array.from(teamNamesToFetch).filter(name => !logoMap[name]);
                for (let i = 0; i < missingNames.length; i += 30) {
                    const chunk = missingNames.slice(i, i + 30);
                    try {
                        const q = query(collection(db, 'teams'), where('name', 'in', chunk));
                        const snap = await getDocs(q);
                        snap.docs.forEach((d) => {
                            const data = d.data();
                            const logo = data.logoUrl || data.logo || null;
                            if (logo) {
                                logoMap[d.id] = logo;
                                if (data.name) {
                                    logoMap[String(data.name).trim().toLowerCase()] = logo;
                                    logoMap[String(data.name).trim()] = logo;
                                }
                                if (data.ownerId) logoMap[data.ownerId] = logo;
                            }
                        });
                    } catch {
                        // Ignore name query error
                    }
                }

                if (isMounted) {
                    setTeamLogos(prev => ({ ...prev, ...logoMap }));
                }
            } catch (error) {
                console.warn('Could not resolve all team logos:', error);
            }
        }

        fetchTeamLogos();
        return () => { isMounted = false; };
    }, [tournament, participants, slots]);

    // Extract table rows from all possible result sources
    const rows: ScrimResultRow[] = useMemo(() => {
        const slotsArray = Array.isArray(slots) ? slots : Array.isArray(tournament.slots) ? (tournament.slots as any[]) : [];
        const partArray = Array.isArray(participants) ? participants : [];

        // Helper to find slot or participant match for team names
        const findEntityMatch = (normName: string) => {
            const fromSlot = slotsArray.find(
                (s: any) => s && (
                    (s.teamName && String(s.teamName).trim().toLowerCase() === normName) ||
                    (s.inGameName && String(s.inGameName).trim().toLowerCase() === normName) ||
                    (s.username && String(s.username).trim().toLowerCase() === normName)
                )
            );
            if (fromSlot) return fromSlot;

            return partArray.find(
                (p: any) => p && (
                    (p.teamName && String(p.teamName).trim().toLowerCase() === normName) ||
                    (p.inGameName && String(p.inGameName).trim().toLowerCase() === normName) ||
                    (p.username && String(p.username).trim().toLowerCase() === normName)
                )
            );
        };

        // Source 1: manualResults (Official match result entries)
        if (tournament.manualResults && tournament.manualResults.length > 0) {
            return [...tournament.manualResults]
                .sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999))
                .map((m, idx) => {
                    const sn = Number(m.rank) || (idx + 1);
                    const kills = Number(m.kills) || 0;
                    const defaultPlacementPts = scoring.placementPoints[String(sn)] ?? Math.max(0, 12 - (sn - 1));
                    const placementPoints = Number((m as any).placementPoints ?? (m as any).placementPts ?? defaultPlacementPts);
                    const totalPoints = Number((m as any).totalPoints ?? (m as any).points ?? m.score ?? (kills * scoring.killPoints + placementPoints));

                    const prizeItem = tournament.prizeDistribution?.find(p => Number(p.rank) === sn);
                    const winnerItem = tournament.winners?.find((w: any) => Number(w.rank) === sn);
                    let prize = Number(prizeItem?.amount ?? (winnerItem as any)?.prize ?? (winnerItem as any)?.amount ?? 0);

                    const isPerKillMode = tournament.tournamentMode === 'PER_KILL_REWARD' || Number((tournament as any).rewardPerKill) > 0;
                    const rewardPerKill = Number((tournament as any).rewardPerKill || (tournament as any).rewardConfig?.rewardPerKill || 0);
                    if (isPerKillMode && rewardPerKill > 0) {
                        const killBounty = kills * rewardPerKill;
                        if (winnerItem && (winnerItem as any).prize !== undefined) {
                            prize = Number((winnerItem as any).prize);
                        } else {
                            prize = Number(prizeItem?.amount ?? 0) + killBounty;
                        }
                    }

                    const teamNameStr = m.team || (m as any).name || `Team #${sn}`;
                    const normName = teamNameStr.trim().toLowerCase();

                    const entityMatch = findEntityMatch(normName);

                    const resolvedLogo = (m as any).logo
                        || entityMatch?.teamLogo
                        || entityMatch?.logoUrl
                        || (entityMatch?.teamId ? teamLogos[entityMatch.teamId] : null)
                        || (m.teamId ? teamLogos[m.teamId] : null)
                        || teamLogos[normName]
                        || teamLogos[teamNameStr.trim()]
                        || (entityMatch?.captainUid ? teamLogos[entityMatch.captainUid] : null)
                        || (entityMatch?.userId ? teamLogos[entityMatch.userId] : null)
                        || null;

                    return {
                        sn,
                        name: teamNameStr,
                        tag: entityMatch?.slotNumber ? `Slot #${entityMatch.slotNumber}` : undefined,
                        logo: resolvedLogo,
                        kills,
                        placementPoints,
                        totalPoints,
                        prize,
                        isRealPlayer: true,
                    };
                });
        }

        // Source 2: winners / results / podium array
        const rawWinners: any[] = (Array.isArray(tournament.winners) && tournament.winners.length > 0)
            ? tournament.winners
            : (Array.isArray((tournament as any).results) && (tournament as any).results.length > 0)
            ? (tournament as any).results
            : (Array.isArray((tournament as any).podium) && (tournament as any).podium.length > 0)
            ? (tournament as any).podium
            : [];

        if (rawWinners.length > 0) {
            return [...rawWinners]
                .sort((a, b) => (Number(a.rank || a.placement) || 999) - (Number(b.rank || b.placement) || 999))
                .map((w, idx) => {
                    const sn = Number(w.rank || w.placement) || (idx + 1);
                    const kills = Number(w.kills) || 0;
                    const defaultPlacementPts = scoring.placementPoints[String(sn)] ?? Math.max(0, 12 - (sn - 1));
                    const placementPoints = Number(w.placementPoints ?? defaultPlacementPts);
                    const totalPoints = Number(w.totalPoints ?? w.points ?? (kills * scoring.killPoints + placementPoints));
                    let prize = Number(w.prize || w.amount || 0);
                    const isPerKillMode = tournament.tournamentMode === 'PER_KILL_REWARD' || Number((tournament as any).rewardPerKill) > 0;
                    const rewardPerKill = Number((tournament as any).rewardPerKill || (tournament as any).rewardConfig?.rewardPerKill || 0);
                    if (isPerKillMode && rewardPerKill > 0 && prize === 0 && kills > 0) {
                        prize = kills * rewardPerKill;
                    }

                    const teamNameStr = w.teamName || w.username || w.name || `Team #${sn}`;
                    const normName = teamNameStr.trim().toLowerCase();

                    const entityMatch = findEntityMatch(normName);

                    const resolvedLogo = w.logo
                        || w.teamLogo
                        || w.avatar
                        || w.profilePicUrl
                        || (w.teamId ? teamLogos[w.teamId] : null)
                        || (entityMatch?.teamLogo || entityMatch?.logoUrl)
                        || (entityMatch?.teamId ? teamLogos[entityMatch.teamId] : null)
                        || teamLogos[normName]
                        || teamLogos[teamNameStr.trim()]
                        || (w.userId ? teamLogos[w.userId] : null)
                        || (entityMatch?.captainUid ? teamLogos[entityMatch.captainUid] : null)
                        || (entityMatch?.userId ? teamLogos[entityMatch.userId] : null)
                        || null;

                    return {
                        sn,
                        name: teamNameStr,
                        tag: w.slotNumber ? `Slot #${w.slotNumber}` : (entityMatch?.slotNumber ? `Slot #${entityMatch.slotNumber}` : undefined),
                        logo: resolvedLogo,
                        kills,
                        placementPoints,
                        totalPoints,
                        prize,
                        isRealPlayer: true,
                    };
                });
        }

        // Source 3: Pending match state — show roster preview if slots or participants exist
        const bookedSlots = slotsArray.filter((s: any) => s && (s.status === 'filled' || s.teamName || s.userId || s.captainUid));

        if (bookedSlots.length > 0) {
            return bookedSlots.map((s: any, idx: number) => {
                const sn = typeof s.slotNumber === 'number' ? s.slotNumber : (idx + 1);
                const teamNameStr = s.teamName || s.inGameName || s.username || `Slot #${sn} Team`;
                const normName = teamNameStr.trim().toLowerCase();

                const resolvedLogo = s.teamLogo
                    || s.logoUrl
                    || (s.teamId ? teamLogos[s.teamId] : null)
                    || teamLogos[normName]
                    || teamLogos[teamNameStr.trim()]
                    || (s.captainUid ? teamLogos[s.captainUid] : null)
                    || (s.userId ? teamLogos[s.userId] : null)
                    || null;

                return {
                    sn,
                    name: teamNameStr,
                    tag: `Slot #${sn}`,
                    logo: resolvedLogo,
                    kills: 0,
                    placementPoints: 0,
                    totalPoints: 0,
                    prize: 0,
                    isRealPlayer: false,
                };
            });
        }

        // Source 3b: Fallback for tournaments where slots is a number and participants are in participants array
        if (partArray.length > 0) {
            return partArray.map((p: any, idx: number) => {
                const sn = typeof p.slotNumber === 'number' ? p.slotNumber : (idx + 1);
                const teamNameStr = p.teamName || p.inGameName || p.username || `Team #${sn}`;
                const normName = teamNameStr.trim().toLowerCase();

                const resolvedLogo = p.teamLogo
                    || p.logoUrl
                    || (p.teamId ? teamLogos[p.teamId] : null)
                    || teamLogos[normName]
                    || teamLogos[teamNameStr.trim()]
                    || (p.captainUid ? teamLogos[p.captainUid] : null)
                    || (p.userId ? teamLogos[p.userId] : null)
                    || null;

                return {
                    sn,
                    name: teamNameStr,
                    tag: `Slot #${sn}`,
                    logo: resolvedLogo,
                    kills: 0,
                    placementPoints: 0,
                    totalPoints: 0,
                    prize: 0,
                    isRealPlayer: false,
                };
            });
        }

        return [];
    }, [tournament, participants, slots, scoring, teamLogos]);

    const isMatchPending = !tournament.manualResults?.length && !tournament.winners?.length && !(tournament as any).results?.length;

    if (rows.length === 0) {
        return (
            <div className="bg-card/50 border border-gray-800 rounded-3xl p-8 sm:p-12 text-center">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">No Results Available Yet</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                    Official match scoring will be published here as soon as the referee submits the final results.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header / Context Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-black text-base sm:text-xl uppercase tracking-tighter">
                                Official Match Standings
                            </h3>
                            {isMatchPending ? (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Scores Pending
                                </span>
                            ) : (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Official
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {prizeWinnerCount > 0 
                                ? `Top ${prizeWinnerCount} places awarded in Golden Letters with verified wallet payout` 
                                : 'All ranked teams and match scoring'}
                        </p>
                    </div>
                </div>

                {/* Prize Pool & Scoring Quick Pill */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-dark/80 px-3.5 py-2 rounded-xl border border-gray-800 text-center">
                        <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Top Places</span>
                        <span className="text-xs sm:text-sm font-mono font-bold text-amber-400">Top {prizeWinnerCount} Golden</span>
                    </div>
                    <div className="bg-dark/80 px-3.5 py-2 rounded-xl border border-gray-800 text-center">
                        <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Per Kill</span>
                        <span className="text-xs sm:text-sm font-mono font-bold text-red-400">+{scoring.killPoints} Pts</span>
                    </div>
                </div>
            </div>

            {isMatchPending && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-300 font-medium">
                        Match is in progress or awaiting referee score verification. Team slot allocations are shown below; final kills, placement points, and golden winners will update live upon conclusion.
                    </span>
                </div>
            )}

            {/* THE RESULTS TABLE */}
            <div className="bg-card/50 rounded-2xl sm:rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    {(() => {
                        const isPerKillMode = tournament.tournamentMode === 'PER_KILL_REWARD' || Number((tournament as any).rewardPerKill) > 0;
                        const hasPrizes = rows.some(r => r.prize > 0) || Number(tournament.prizePool) > 0 || isPerKillMode;

                        return (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-800/80 bg-gray-950/70 text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 font-black">
                                        <th className="py-3.5 px-3 sm:px-5 text-center w-16 sm:w-20">SN</th>
                                        <th className="py-3.5 px-3 sm:px-5">Name</th>
                                        <th className="py-3.5 px-3 sm:px-5 text-center w-16 sm:w-20">Logo</th>
                                        <th className="py-3.5 px-3 sm:px-5 text-center w-20 sm:w-24">
                                            <div className="flex items-center justify-center gap-1">
                                                <Crosshair className="w-3 h-3 text-red-400" />
                                                <span>Kills</span>
                                            </div>
                                        </th>
                                        <th className="py-3.5 px-3 sm:px-5 text-center w-28 sm:w-36">
                                            Placement Points
                                        </th>
                                        <th className="py-3.5 px-3 sm:px-5 text-center w-24 sm:w-32">
                                            Total Points
                                        </th>
                                        {hasPrizes && (
                                            <th className="py-3.5 px-3 sm:px-5 text-center w-24 sm:w-32">
                                                {isPerKillMode ? 'Bounty' : 'Prize'}
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/40">
                                    {rows.map((row) => {
                                        const isWinner = !isMatchPending && (row.sn <= prizeWinnerCount || (isPerKillMode && row.prize > 0));

                                        return (
                                            <tr 
                                                key={row.sn}
                                                className={`transition-colors duration-200 ${
                                                    isWinner 
                                                        ? 'bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border-amber-500/30' 
                                                        : 'hover:bg-white/[0.02] border-gray-800/60'
                                                }`}
                                            >
                                                {/* 1. SN (Serial Number / Rank) */}
                                                <td className="py-3.5 px-3 sm:px-5 text-center">
                                                    <span className={`inline-flex items-center justify-center min-w-[2.2rem] h-8 px-2 rounded-xl font-black text-xs sm:text-sm font-mono transition-all ${
                                                        isWinner
                                                            ? 'bg-gradient-to-br from-amber-400/20 to-yellow-600/30 text-amber-400 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                                                            : 'bg-dark/60 text-gray-400 border border-gray-800'
                                                    }`}>
                                                        {isWinner ? (
                                                            row.sn === 1 ? '🥇 1' :
                                                            row.sn === 2 ? '🥈 2' :
                                                            row.sn === 3 ? '🥉 3' :
                                                            `#${row.sn}`
                                                        ) : (
                                                            `#${row.sn}`
                                                        )}
                                                    </span>
                                                </td>

                                                {/* 2. Name */}
                                                <td className="py-3.5 px-3 sm:px-5">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-black text-xs sm:text-sm tracking-tight truncate max-w-[140px] sm:max-w-xs ${
                                                                isWinner
                                                                    ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                                                                    : 'text-white'
                                                            }`}>
                                                                {row.name}
                                                            </span>
                                                            {isWinner && row.sn === 1 && (
                                                                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                                                            )}
                                                            {row.prize !== undefined && row.prize > 0 && !hasPrizes && (
                                                                <span className="hidden sm:inline-flex items-center gap-0.5 font-mono font-black text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg shrink-0">
                                                                    +{formatCurrency(row.prize)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {row.tag && (
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                                isWinner ? 'text-amber-400/80 font-mono' : 'text-gray-500 font-mono'
                                                            }`}>
                                                                {row.tag}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 3. Logo */}
                                                <td className="py-3.5 px-3 sm:px-5 text-center">
                                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto rounded-xl overflow-hidden flex items-center justify-center ${
                                                        isWinner
                                                            ? 'ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.35)] bg-amber-500/10'
                                                            : 'border border-gray-800 bg-surface'
                                                    }`}>
                                                        {row.logo && !imageErrors[row.sn] ? (
                                                            <img 
                                                                src={row.logo} 
                                                                alt={row.name} 
                                                                className="w-full h-full object-cover" 
                                                                loading="lazy" 
                                                                referrerPolicy="no-referrer"
                                                                onError={() => setImageErrors(prev => ({ ...prev, [row.sn]: true }))}
                                                            />
                                                        ) : (
                                                            <Shield className={`w-4 h-4 sm:w-5 sm:h-5 ${isWinner ? 'text-amber-400' : 'text-gray-500'}`} />
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 4. Kills */}
                                                <td className={`py-3.5 px-3 sm:px-5 text-center font-mono text-xs sm:text-sm font-bold ${
                                                    isWinner 
                                                        ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]' 
                                                        : 'text-gray-300'
                                                }`}>
                                                    {isMatchPending ? '-' : row.kills}
                                                </td>

                                                {/* 5. Placement Points */}
                                                <td className={`py-3.5 px-3 sm:px-5 text-center font-mono text-xs sm:text-sm font-bold ${
                                                    isWinner 
                                                        ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]' 
                                                        : 'text-gray-300'
                                                }`}>
                                                    {isMatchPending ? '-' : row.placementPoints}
                                                </td>

                                                {/* 6. Total Points */}
                                                <td className={`py-3.5 px-3 sm:px-5 text-center font-mono text-sm sm:text-base font-black ${
                                                    isWinner 
                                                        ? 'text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
                                                        : 'text-white'
                                                }`}>
                                                    {isMatchPending ? '-' : row.totalPoints}
                                                </td>

                                                {/* 7. Prize / Bounty */}
                                                {hasPrizes && (
                                                    <td className="py-3.5 px-3 sm:px-5 text-center font-mono text-xs sm:text-sm">
                                                        {row.prize > 0 ? (
                                                            <span className="font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg inline-block shadow-sm">
                                                                {formatCurrency(row.prize)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">-</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        );
                    })()}
                </div>

                {/* Footer Notes */}
                <div className="bg-gray-950/40 p-4 border-t border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-gray-400">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Winners highlighted in <strong className="text-amber-400 font-black">Golden Letters</strong> (Top {prizeWinnerCount}) receive prize wallet credit.</span>
                    </div>
                    <div className="font-mono text-gray-500">
                        Total Points = Placement Points + (Kills × {scoring.killPoints})
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScrimResultsTable;
