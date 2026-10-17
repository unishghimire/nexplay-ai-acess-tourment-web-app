import { Router } from "express";
import { db, admin, rateLimit } from "../shared.js";
import { commitBatchedWrites, ChunkProcessingError } from "../batchedWrites.js";

const router = Router();

// Automated Match Reminders Dispatcher (Cron / Automated Agent)
router.post("/api/tournaments/cron/match-reminders", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    // R-02: this endpoint scans tournaments and mass-writes notifications, so it
    // must never run unauthenticated. The previous empty-branch fallback let any
    // anonymous caller trigger it (and the old comment-only `if` was a no-op).
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const now = new Date();
    const lookaheadMinutes = 30;
    const futureLimit = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

    const upcomingSnap = await db.collection("tournaments")
      .where("status", "in", ["upcoming", "published"])
      .limit(500)
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
          .limit(500)
          .get();

        const minutesLeft = Math.max(1, Math.round((startTime.getTime() - now.getTime()) / (60 * 1000)));

        // Fan-out writes are independent document creates, so they go through the
        // tested 450-op chunked batches instead of one network round-trip per player.
        const notificationsCol = db.collection("notifications");
        const ops = partsSnap.docs
          .map((pDoc: any) => {
            const p = pDoc.data();
            if (typeof p.userId !== 'string' || !p.userId) return null;
            return (batch: admin.firestore.WriteBatch) => batch.create(notificationsCol.doc(), {
              userId: p.userId,
              title: "Match Starting Soon!",
              message: `Your match in "${data.title}" begins in ${minutesLeft} minutes. Get ready!`,
              type: "info",
              link: `/tournaments/${tournamentId}`,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          })
          .filter((op): op is NonNullable<typeof op> => op !== null);

        try {
          const progress = await commitBatchedWrites(() => db.batch(), ops);
          notifiedCount += progress.completedItems;
        } catch (err) {
          if (err instanceof ChunkProcessingError) {
            notifiedCount += err.progress.completedItems;
            console.error("Match reminders fan-out partially failed:", err.message);
          } else {
            throw err;
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
