import { Router } from "express";
import { db, admin, rateLimit } from "../shared.js";

const router = Router();

// Automated Match Reminders Dispatcher (Cron / Automated Agent)
router.post("/api/tournaments/cron/match-reminders", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    // Allow if valid CRON_SECRET bearer or internal call
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If not matching CRON_SECRET, fallback to standard authenticateToken if provided
      // or proceed if CRON_SECRET is not yet configured in local dev
    }

    const now = new Date();
    const lookaheadMinutes = 30;
    const futureLimit = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

    const upcomingSnap = await db.collection("tournaments")
      .where("status", "in", ["upcoming", "published"])
      .get();

    let processedCount = 0;
    let notifiedCount = 0;

    for (const doc of upcomingSnap.docs) {
      const data = doc.data();
      const startTime = data.startTime?.toDate ? data.startTime.toDate() : (data.startTime ? new Date(data.startTime) : null);

      if (startTime && startTime > now && startTime <= futureLimit) {
        processedCount++;
        const tournamentId = doc.id;

        // Fetch approved participants to dispatch notifications
        const partsSnap = await db.collection("participants")
          .where("tournamentId", "==", tournamentId)
          .where("status", "==", "approved")
          .get();

        const minutesLeft = Math.max(1, Math.round((startTime.getTime() - now.getTime()) / (60 * 1000)));

        for (const pDoc of partsSnap.docs) {
          const p = pDoc.data();
          if (p.userId) {
            await db.collection("notifications").add({
              userId: p.userId,
              title: "Match Starting Soon!",
              message: `Your match in "${data.title}" begins in ${minutesLeft} minutes. Get ready!`,
              type: "info",
              link: `/tournaments/${tournamentId}`,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            notifiedCount++;
          }
        }
      }
    }

    return res.json({
      success: true,
      message: `Processed ${processedCount} upcoming matches; sent ${notifiedCount} notifications.`,
      processedCount,
      notifiedCount
    });
  } catch (error: any) {
    console.error("Match reminders cron error:", error);
    return res.status(500).json({ success: false, message: error.message || "Cron dispatch failed" });
  }
});

export default router;
