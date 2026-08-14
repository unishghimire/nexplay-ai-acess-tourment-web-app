import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { commitBatchedWrites } from "../batchedWrites.js";

const router = Router();

// Generate Groups
router.post("/api/tournaments/:id/groups/generate", authenticateToken, rateLimit(5, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { teamsPerGroup } = req.body;
    if (!teamsPerGroup || teamsPerGroup < 2) return res.status(400).json({ success: false, message: "Invalid teams per group" });

    const tourneyRef = db.collection("tournaments").doc(id);
    const tourneySnap = await tourneyRef.get();
    if (!tourneySnap.exists) return res.status(404).json({ success: false, message: "Tournament not found" });
    const tourneyData = tourneySnap.data();
    if (tourneyData?.hostUid !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Unauthorized" });

    const participantsSnap = await db.collection("participants").where("tournamentId", "==", id).get();
    const participants = participantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (participants.length === 0) return res.status(400).json({ success: false, message: "No participants registered" });

    const shuffled = participants.sort(() => Math.random() - 0.5);
    const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    const groups = [];
    for (let i = 0; i < shuffled.length; i += teamsPerGroup) {
      const groupTeams = shuffled.slice(i, i + teamsPerGroup);
      const groupRef = db.collection("tournaments").doc(id).collection("groups").doc();
      const groupData = {
        id: groupRef.id, tournamentId: id, round: tourneyData?.currentRound || 1,
        name: `Group ${String.fromCharCode(65 + Math.floor(i / teamsPerGroup))}`,
        teams: groupTeams.map((t: any) => ({ id: t.teamId || t.userId, name: t.teamName || t.username, score: 0, rank: 0, isQualified: false })),
        status: "upcoming", createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      operations.push(batch => batch.set(groupRef, groupData));
      groups.push(groupData);
    }
    await commitBatchedWrites(() => db.batch(), operations);
    res.status(201).json({ success: true, message: "Groups generated successfully", groups });
  } catch (error: any) {
    console.error("Group generation error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Upload Result & Calculate Points
router.post("/api/tournaments/:id/results/upload", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { groupId, teamResults, screenshotUrl } = req.body;
    if (!id || id.length > 128 || typeof groupId !== 'string' || !groupId || groupId.length > 128 ||
        !Array.isArray(teamResults) || teamResults.length === 0 || teamResults.length > 200) {
      return res.status(400).json({ success: false, message: "Valid group ID and team results are required" });
    }
    if (screenshotUrl !== undefined && (typeof screenshotUrl !== 'string' || screenshotUrl.length > 2_048 || !/^https?:\/\//i.test(screenshotUrl))) {
      return res.status(400).json({ success: false, message: "Invalid screenshot URL" });
    }

    const tourneyRef = db.collection("tournaments").doc(id);
    const tourneySnap = await tourneyRef.get();
    const tourneyData = tourneySnap.data();
    if (!tourneySnap.exists || !tourneyData) return res.status(404).json({ success: false, message: "Tournament not found" });
    // Authorization: only tournament host or admin can upload results
    if (tourneyData?.hostUid !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized — only tournament host can upload results" });
    }

    const pointSystem = tourneyData.pointSystem || { killPoints: 1, placement: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6 } };
    const processedResults = teamResults.map((result: any) => {
      const placement = Number(result?.placement);
      const kills = Number(result?.kills);
      const bonus = Number(result?.bonus || 0);
      const penalty = Number(result?.penalty || 0);
      if (typeof result?.teamId !== 'string' || !result.teamId || result.teamId.length > 128 ||
          !Number.isInteger(placement) || placement < 1 || placement > 200 ||
          !Number.isInteger(kills) || kills < 0 || kills > 10_000 ||
          !Number.isFinite(bonus) || !Number.isFinite(penalty) || Math.abs(bonus) > 1_000_000 || Math.abs(penalty) > 1_000_000) {
        throw new Error('Invalid team result');
      }
      const pPoints = Number(pointSystem.placement?.[placement] || 0);
      const kPoints = kills * Number(pointSystem.killPoints || 1);
      const totalPoints = pPoints + kPoints + bonus - penalty;
      if (!Number.isFinite(totalPoints)) throw new Error('Invalid calculated score');
      return { ...result, placement, kills, bonus, penalty, totalPoints };
    });

    const resultRef = db.collection("results").doc();
    const resultData = {
      id: resultRef.id, tournamentId: id, groupId, teamResults: processedResults,
      screenshotUrl, uploadedBy: req.user.userId, verified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const groupRef = db.collection("tournaments").doc(id).collection("groups").doc(groupId);
    await db.runTransaction(async transaction => {
      const group = await transaction.get(groupRef);
      if (!group.exists || group.data()?.tournamentId !== id) throw new Error('Group not found');
      if (group.data()?.status === 'completed') throw new Error('Results have already been uploaded for this group');
      transaction.set(resultRef, resultData);
      transaction.update(groupRef, { status: "completed", results: processedResults });
    });
    res.status(201).json({ success: true, message: "Result uploaded and points calculated", result: resultData });
  } catch (error: any) {
    console.error("Result upload error:", error);
    const message = error.message || "Result upload failed";
    const status = ['Invalid team result', 'Invalid calculated score'].includes(message) ? 400 :
      ['Group not found'].includes(message) ? 404 : message.includes('already been uploaded') ? 409 : 500;
    res.status(status).json({ success: false, message: status === 500 ? "Result upload failed" : message });
  }
});

// Advance Round
router.post("/api/tournaments/:id/advance", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { id } = req.params;
    const tourneyRef = db.collection("tournaments").doc(id);
    const tourneySnap = await tourneyRef.get();
    const tourneyData = tourneySnap.data();
    if (!tourneySnap.exists || !tourneyData) return res.status(404).json({ success: false, message: "Tournament not found" });
    // Authorization: only tournament host or admin can advance rounds
    if (tourneyData?.hostUid !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const currentRound = tourneyData.currentRound || 1;
    const roadmap = tourneyData.roadmap || [];
    const currentRoundConfig = roadmap.find((r: any) => r.roundNumber === currentRound);
    if (!currentRoundConfig) return res.status(400).json({ success: false, message: "Round configuration not found" });

    const groupsSnap = await db.collection("tournaments").doc(id).collection("groups").where("round", "==", currentRound).get();
    const allGroups = groupsSnap.docs.map(doc => doc.data());
    if (allGroups.some(g => g.status !== "completed")) return res.status(400).json({ success: false, message: "All groups in the current round must be completed first" });

    const qualifiedTeams: any[] = [];
    allGroups.forEach(group => {
      if (group.results) {
        const sorted = [...group.results].sort((a: any, b: any) => b.totalPoints - a.totalPoints);
        qualifiedTeams.push(...sorted.slice(0, currentRoundConfig.qualificationRule));
      }
    });

    const nextRound = currentRound + 1;
    const nextRoundConfig = roadmap.find((r: any) => r.roundNumber === nextRound);
    if (nextRoundConfig) {
      const numGroups = nextRoundConfig.numGroups || 1;
      const teamsPerGroup = Math.ceil(qualifiedTeams.length / numGroups);
      const shuffled = [...qualifiedTeams].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numGroups; i++) {
        const groupTeams = shuffled.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
        if (groupTeams.length > 0) {
          const groupRef = db.collection("tournaments").doc(id).collection("groups").doc();
          await groupRef.set({
            id: groupRef.id, round: nextRound, name: `Round ${nextRound} - Group ${i + 1}`,
            status: "scheduled", teams: groupTeams.map(t => ({ id: t.teamId || t.userId, name: t.teamName || t.username, logoUrl: t.logoUrl || "" })),
            results: [], matches: [], createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }
    await tourneyRef.update({ currentRound: nextRound, status: nextRoundConfig ? "ongoing" : "completed", stage: nextRoundConfig ? "round_play" : "completed" });
    res.json({ success: true, message: nextRoundConfig ? `Advanced to Round ${nextRound}` : "Tournament Completed", nextRound, qualifiedCount: qualifiedTeams.length, isCompleted: !nextRoundConfig });
  } catch (error: any) {
    console.error("Advance round error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// DELETE /api/tournaments/:id — delete tournament with child cleanup
// Uses Admin SDK (bypasses Firestore rules) after verifying ownership
router.delete("/api/tournaments/:id",
  authenticateToken,
  rateLimit(3, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { id } = req.params;
      if (!id || id.length > 128) return res.status(400).json({ success: false, message: "Invalid tournament ID" });

      const uid = req.user.userId;
      const tourneyRef = db.collection("tournaments").doc(id);
      const tourneySnap = await tourneyRef.get();

      if (!tourneySnap.exists) return res.status(404).json({ success: false, message: "Tournament not found" });

      const tourneyData = tourneySnap.data();
      if (!tourneyData) return res.status(404).json({ success: false, message: "Tournament not found" });

      // Authorization: only tournament host or admin can delete
      if (tourneyData.hostUid !== uid && req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Unauthorized — only the tournament host can delete this tournament" });
      }

      // Block deletion of live tournaments
      if (tourneyData.status === "live") {
        return res.status(400).json({ success: false, message: "Cannot delete a live tournament. End or cancel it first." });
      }

      // Chunked cleanup avoids Firestore's 500-operation batch ceiling. The
      // parent document is deleted last, so a retry can safely resume after a
      // transient failure without exposing a deleted parent with live children.
      const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

      // Delete participants
      const partsSnap = await db.collection("participants").where("tournamentId", "==", id).get();
      partsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

      // Delete results
      const resultsSnap = await db.collection("results").where("tournamentId", "==", id).get();
      resultsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

      // Delete tournament earnings
      const earningsSnap = await db.collection("tournamentEarnings").where("tournamentId", "==", id).get();
      earningsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

      // Delete credentials subcollection
      const credsSnap = await tourneyRef.collection("credentials").get();
      credsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

      // Delete groups subcollection
      const groupsSnap = await tourneyRef.collection("groups").get();
      groupsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

      // Delete the tournament document itself
      operations.push(batch => batch.delete(tourneyRef));

      await commitBatchedWrites(() => db.batch(), operations);
      res.json({ success: true, message: "Tournament deleted successfully", deletedChildren: partsSnap.size + resultsSnap.size + earningsSnap.size + credsSnap.size + groupsSnap.size });
    } catch (error: any) {
      console.error("Tournament delete error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  }
);

// Scrims API
router.get("/api/scrims", async (req, res) => {
  try {
    const scrimsSnap = await db.collection("scrims").where("status", "==", "open").get();
    const tourneyScrimsSnap = await db.collection("tournaments").where("matchType", "==", "scrims").where("status", "==", "upcoming").get();
    const scrims = scrimsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const tourneyScrims = tourneyScrimsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, scrims: [...scrims, ...tourneyScrims] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching scrims" });
  }
});

export default router;
