import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { requireAdmin } from "../authz.js";

const router = Router();

// GET /api/teams — Public list of teams with stats
router.get("/api/teams", rateLimit(30, 60 * 1000), async (req, res) => {
  try {
    const { limit: queryLimit, search } = req.query;
    const maxLimit = Math.min(Number(queryLimit) || 50, 100);

    const snapshot = await db.collection("teams").limit(maxLimit).get();
    let teams = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    if (search && typeof search === "string") {
      const s = search.toLowerCase();
      teams = teams.filter(
        (t: any) =>
          (t.name || "").toLowerCase().includes(s) ||
          (t.tag || "").toLowerCase().includes(s)
      );
    }

    res.json({ success: true, count: teams.length, teams });
  } catch (error: any) {
    console.error("Error fetching teams:", error);
    res.status(200).json({ success: true, count: 0, teams: [], warning: "Could not retrieve teams from database" });
  }
});

// GET /api/teams/:id — Get team details, members, and activities
router.get("/api/teams/:id", rateLimit(60, 60 * 1000), async (req, res) => {
  try {
    const { id } = req.params;
    const teamDoc = await db.collection("teams").doc(id).get();

    if (!teamDoc.exists) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    const teamData = { id: teamDoc.id, ...teamDoc.data() };

    // Fetch members and activities in parallel
    const [membersSnap, activitiesSnap] = await Promise.all([
      db.collection("team_members").where("teamId", "==", id).limit(50).get(),
      db.collection("team_activities").where("teamId", "==", id).orderBy("createdAt", "desc").limit(20).get().catch(() => ({ docs: [] })),
    ]);

    const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const activities = activitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.json({
      success: true,
      team: teamData,
      members,
      activities,
    });
  } catch (error: any) {
    console.error("Error fetching team details:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// POST /api/teams/:id/ban — Admin toggle team ban status
router.post(
  "/api/teams/:id/ban",
  authenticateToken,
  requireAdmin,
  rateLimit(10, 60 * 1000),
  async (req: any, res) => {
    try {
      const { id } = req.params;
      const teamRef = db.collection("teams").doc(id);
      const teamDoc = await teamRef.get();

      if (!teamDoc.exists) {
        return res.status(404).json({ success: false, message: "Team not found" });
      }

      const isBanned = !teamDoc.data()?.isBanned;
      await teamRef.update({
        isBanned,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({
        success: true,
        message: `Team ${isBanned ? "banned" : "unbanned"} successfully`,
        teamId: id,
        isBanned,
      });
    } catch (error: any) {
      console.error("Error toggling team ban:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  }
);

export default router;
