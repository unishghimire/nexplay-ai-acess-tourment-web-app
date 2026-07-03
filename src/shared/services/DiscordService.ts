import { auth } from '../config/firebase';
import { Tournament, TournamentGroup } from '../types/types';
import { formatCurrency, formatDate } from '../utils/utils';

export type DiscordAnnouncementType =
    | 'tournament_published'
    | 'tournament_live'
    | 'tournament_completed'
    | 'group_published'
    | 'game_start'
    | 'game_time'
    | 'scrim_published'
    | 'scrim_live'
    | 'scrim_completed';

/**
 * Sends a Discord announcement via the secure server-side proxy.
 * The webhook URL is never exposed to the browser.
 */
async function sendAnnouncement(
    type: DiscordAnnouncementType,
    data: Record<string, any>,
    channel: 'tournaments' | 'scrims'
): Promise<{ success: boolean; message: string }> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
        return { success: false, message: 'Not authenticated.' };
    }

    const res = await fetch('/api/discord/announce', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type, data, channel }),
    });

    const json = await res.json();
    return { success: json.success, message: json.message };
}

// ─── Typed helper methods ─────────────────────────────────────────────────────

/** Announce a newly published tournament to #tournaments */
export const announceNewTournament = (t: Tournament) =>
    sendAnnouncement('tournament_published', {
        tournamentId: t.id,
        title: t.title,
        game: t.game,
        teamType: t.teamType,
        type: t.type,
        map: t.map,
        startTime: formatDate(t.startTime),
        prizePool: formatCurrency(t.prizePool),
        entryFee: t.entryFee === 0 ? 'FREE' : formatCurrency(t.entryFee),
        currentPlayers: t.currentPlayers,
        slots: t.slots,
        bannerUrl: t.bannerUrl,
    }, 'tournaments');

/** Announce tournament going live to #tournaments */
export const announceTournamentLive = (t: Tournament) =>
    sendAnnouncement('tournament_live', {
        tournamentId: t.id,
        title: t.title,
        currentPlayers: t.currentPlayers,
        slots: t.slots,
        prizePool: formatCurrency(t.prizePool),
        map: t.map,
    }, 'tournaments');

/** Announce tournament completion to #tournaments */
export const announceTournamentCompleted = (t: Tournament, winner?: string) =>
    sendAnnouncement('tournament_completed', {
        tournamentId: t.id,
        title: t.title,
        prizePool: formatCurrency(t.prizePool),
        winner,
    }, 'tournaments');

/** Announce group draw / group list to #tournaments */
export const announceGroupDraw = (t: Tournament, groups: TournamentGroup[]) =>
    sendAnnouncement('group_published', {
        tournamentId: t.id,
        title: t.title,
        groups: groups.map(g =>
            `${g.name} (${g.teams.length} teams): ${g.teams.map(team => team.name).join(', ')}`
        ),
    }, 'tournaments');

/** Announce match/game starting now with room credentials to #tournaments */
export const announceGameStart = (
    t: Tournament,
    groupName: string,
    map: string,
    roomId?: string,
    roomPass?: string
) =>
    sendAnnouncement('game_start', {
        tournamentId: t.id,
        title: t.title,
        groupName,
        map,
        roomId,
        roomPass,
    }, 'tournaments');

/** Announce match time reminder to #tournaments */
export const announceGameTime = (
    t: Tournament,
    groupName: string,
    startTime: string,
    timeLeft: string
) =>
    sendAnnouncement('game_time', {
        tournamentId: t.id,
        title: t.title,
        groupName,
        startTime,
        timeLeft,
        map: t.map,
    }, 'tournaments');

/** Announce a new scrim to #scrims */
export const announceNewScrim = (t: Tournament) =>
    sendAnnouncement('scrim_published', {
        tournamentId: t.id,
        title: t.title,
        game: t.game,
        teamType: t.teamType,
        startTime: formatDate(t.startTime),
        prizePool: formatCurrency(t.prizePool),
        entryFee: t.entryFee === 0 ? 'FREE' : formatCurrency(t.entryFee),
        currentPlayers: t.currentPlayers,
        slots: t.slots,
        bannerUrl: t.bannerUrl,
    }, 'scrims');

/** Announce scrim going live to #scrims */
export const announceScrimLive = (t: Tournament) =>
    sendAnnouncement('scrim_live', {
        tournamentId: t.id,
        title: t.title,
        currentPlayers: t.currentPlayers,
        slots: t.slots,
    }, 'scrims');

/** Announce scrim completed to #scrims */
export const announceScrimCompleted = (t: Tournament) =>
    sendAnnouncement('scrim_completed', {
        tournamentId: t.id,
        title: t.title,
    }, 'scrims');
