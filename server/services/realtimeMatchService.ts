import { firestoreAdmin, rtdbAdmin } from '../shared.js';
import admin from 'firebase-admin';

export interface LiveScorePayload {
  tournamentId: string;
  roundNumber: number;
  scores: Record<string, { placementPoints: number; kills: number; totalPoints: number }>;
  isFinal?: boolean;
}

export interface LiveTournamentState {
  status: 'draft' | 'registration_open' | 'registration_closed' | 'upcoming' | 'live' | 'completed' | 'cancelled';
  currentRound?: number;
  totalParticipants?: number;
  updatedAt?: number;
}

export interface LiveLobbyState {
  groupId: string;
  tournamentId: string;
  lobbyStatus: 'waiting' | 'room_ready' | 'in_progress' | 'completed';
  assignedTeams?: string[];
  updatedAt?: number;
}

export interface AuditLogEntry {
  actorUid: string;
  actorRole: string;
  action: string;
  targetType: 'tournament' | 'match' | 'team' | 'wallet' | 'user' | 'system';
  targetId: string;
  metadata?: Record<string, any>;
}

/**
 * Dual Database Synchronization Service:
 * 1. Writes permanent canonical records to Cloud Firestore (ACID transactions / batches)
 * 2. Broadcasts instantaneous low-latency state to Firebase Realtime Database (RTDB)
 */

/**
 * Broadcasts match score updates to Firestore permanent subcollection and RTDB live stream.
 */
export async function broadcastLiveMatchScore(payload: LiveScorePayload): Promise<{ success: boolean; timestamp: number }> {
  const { tournamentId, roundNumber, scores, isFinal = false } = payload;
  const timestamp = Date.now();

  // 1. Permanent State Update in Firestore
  const tournamentRef = firestoreAdmin.collection('tournaments').doc(tournamentId);
  const matchRef = tournamentRef.collection('matches').doc(`round_${roundNumber}`);

  const batch = firestoreAdmin.batch();
  batch.set(
    matchRef,
    {
      roundNumber,
      scores,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isFinal,
    },
    { merge: true }
  );

  if (isFinal) {
    batch.update(tournamentRef, {
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  // 2. High-Frequency Realtime Database Broadcast
  const liveRef = rtdbAdmin.ref(`liveMatches/${tournamentId}_r${roundNumber}`);
  await liveRef.update({
    tournamentId,
    currentRound: roundNumber,
    state: isFinal ? 'completed' : 'in_progress',
    liveScores: scores,
    lastUpdated: timestamp,
  });

  return { success: true, timestamp };
}

/**
 * Synchronizes tournament lifecycle status between Firestore and RTDB liveTournaments node.
 */
export async function syncTournamentStatusToRTDB(
  tournamentId: string,
  state: LiveTournamentState
): Promise<{ success: boolean }> {
  const timestamp = Date.now();
  const rtdbRef = rtdbAdmin.ref(`liveTournaments/${tournamentId}`);

  await rtdbRef.update({
    status: state.status,
    currentRound: state.currentRound || 1,
    totalParticipants: state.totalParticipants || 0,
    updatedAt: timestamp,
  });

  return { success: true };
}

/**
 * Synchronizes lobby room status to RTDB for instant participant notification.
 */
export async function syncLobbyStatusToRTDB(
  state: LiveLobbyState
): Promise<{ success: boolean }> {
  const timestamp = Date.now();
  const rtdbRef = rtdbAdmin.ref(`liveTournaments/${state.tournamentId}/groups/${state.groupId}`);

  await rtdbRef.update({
    lobbyStatus: state.lobbyStatus,
    assignedTeams: state.assignedTeams || [],
    updatedAt: timestamp,
  });

  return { success: true };
}

/**
 * Broadcasts live leaderboard projection to RTDB.
 */
export async function broadcastLiveLeaderboard(
  tournamentId: string,
  leaderboard: Array<{ rank: number; teamId: string; teamName: string; totalPoints: number; kills: number }>
): Promise<{ success: boolean }> {
  const timestamp = Date.now();
  const rtdbRef = rtdbAdmin.ref(`liveLeaderboards/${tournamentId}`);

  await rtdbRef.set({
    standings: leaderboard,
    lastUpdated: timestamp,
  });

  return { success: true };
}

/**
 * Records an immutable audit log entry in Cloud Firestore.
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<{ id: string }> {
  const logRef = firestoreAdmin.collection('auditLogs').doc();
  await logRef.set({
    id: logRef.id,
    ...entry,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id: logRef.id };
}
