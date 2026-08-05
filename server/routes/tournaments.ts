import { Router } from "express";
import { db, admin, authenticateToken } from "../shared.js";

const router = Router();

// Generate Groups
router.post("/api/tournaments/:id/groups/generate", authenticateToken, async (req: any, res) => {
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
    const batch = db.batch();
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
      batch.set(groupRef, groupData);
      groups.push(groupData);
    }
    await batch.commit();
    res.status(201).json({ success: true, message: "Groups generated successfully", groups });
  } catch (error: any) {
    console.error("Group generation error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Upload Result & Calculate Points
router.post("/api/tournaments/:id/results/upload", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { groupId, teamResults, screenshotUrl } = req.body;
    if (!groupId || !teamResults || !Array.isArray(teamResults)) return res.status(400).json({ success: false, message: "Group ID and team results are required" });

    const tourneyRef = db.collection("tournaments").doc(id);
    const tourneySnap = await tourneyRef.get();
    const tourneyData = tourneySnap.data();
    if (!tourneySnap.exists || !tourneyData) return res.status(404).json({ success: false, message: "Tournament not found" });

    const pointSystem = tourneyData.pointSystem || { killPoints: 1, placement: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6 } };
    const processedResults = teamResults.map((r: any) => {
      const pPoints = pointSystem.placement[r.placement] || 0;
      const kPoints = r.kills * (pointSystem.killPoints || 1);
      return { ...r, totalPoints: pPoints + kPoints + (r.bonus || 0) - (r.penalty || 0) };
    });

    const resultRef = db.collection("results").doc();
    const resultData = {
      id: resultRef.id, tournamentId: id, groupId, teamResults: processedResults,
      screenshotUrl, uploadedBy: req.user.userId, verified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await resultRef.set(resultData);
    await db.collection("tournaments").doc(id).collection("groups").doc(groupId).update({ status: "completed", results: processedResults });
    res.status(201).json({ success: true, message: "Result uploaded and points calculated", result: resultData });
  } catch (error: any) {
    console.error("Result upload error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Advance Round
router.post("/api/tournaments/:id/advance", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const tourneyRef = db.collection("tournaments").doc(id);
    const tourneySnap = await tourneyRef.get();
    const tourneyData = tourneySnap.data();
    if (!tourneySnap.exists || !tourneyData) return res.status(404).json({ success: false, message: "Tournament not found" });

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
