import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { requireAdmin, requireOrganizer } from "../authz.js";

const router = Router();

// POST /api/disputes — File a dispute for a match/room/tournament
router.post(
  "/api/disputes",
  authenticateToken,
  rateLimit(5, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { tournamentId, matchRoom, reason, reportedTeamId, reportedTeamName } = req.body;
      const uid = req.user.userId;

      if (!tournamentId || typeof tournamentId !== "string") {
        return res.status(400).json({ success: false, message: "Valid tournamentId is required" });
      }
      if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
        return res.status(400).json({ success: false, message: "Dispute reason must be at least 5 characters" });
      }

      // Check tournament existence
      let tSnap = await db.collection("tournaments").doc(tournamentId).get();
      if (!tSnap.exists) {
        tSnap = await db.collection("scrims").doc(tournamentId).get();
      }
      if (!tSnap.exists) {
        return res.status(404).json({ success: false, message: "Tournament/scrim not found" });
      }

      const tData = tSnap.data();
      const disputeRef = db.collection("disputes").doc();
      const disputeData = {
        id: disputeRef.id,
        tournamentId,
        tournamentName: tData?.title || "Tournament",
        organizerId: tData?.hostUid || tData?.orgId || tData?.userId || null,
        reportedBy: req.user.email || uid,
        reporterUid: uid,
        matchRoom: matchRoom || "1",
        reason: reason.trim(),
        reportedTeamId: reportedTeamId || null,
        reportedTeamName: reportedTeamName || null,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        filedAt: new Date().toISOString(),
      };

      await disputeRef.set(disputeData);

      res.status(201).json({
        success: true,
        message: "Dispute report filed successfully",
        disputeId: disputeRef.id,
      });
    } catch (error: any) {
      console.error("Error filing dispute:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  }
);

// GET /api/disputes — List disputes for organizer or admin
router.get(
  "/api/disputes",
  authenticateToken,
  requireOrganizer,
  rateLimit(20, 60 * 1000),
  async (req: any, res) => {
    try {
      const uid = req.user.userId;
      const isAdmin = req.user.role === "admin";
      const { tournamentId, status } = req.query;

      let q: FirebaseFirestore.Query = db.collection("disputes");

      if (tournamentId && typeof tournamentId === "string") {
        q = q.where("tournamentId", "==", tournamentId);
      } else if (!isAdmin) {
        q = q.where("organizerId", "==", uid);
      }

      if (status && typeof status === "string") {
        q = q.where("status", "==", status);
      }

      const snap = await q.limit(50).get();
      const disputes = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

      res.json({ success: true, count: disputes.length, disputes });
    } catch (error: any) {
      console.error("Error fetching disputes:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  }
);

// POST /api/disputes/:id/resolve — Resolve dispute with action ('warn' | 'ban' | 'dismiss')
router.post(
  "/api/disputes/:id/resolve",
  authenticateToken,
  requireOrganizer,
  rateLimit(10, 60 * 1000),
  async (req: any, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const uid = req.user.userId;
      const isAdmin = req.user.role === "admin";

      if (!action || !["warn", "ban", "dismiss"].includes(action)) {
        return res.status(400).json({ success: false, message: "Action must be 'warn', 'ban', or 'dismiss'" });
      }

      const disputeRef = db.collection("disputes").doc(id);
      const disputeSnap = await disputeRef.get();
      if (!disputeSnap.exists) {
        return res.status(404).json({ success: false, message: "Dispute not found" });
      }

      const dispute = disputeSnap.data()!;
      if (!isAdmin && dispute.organizerId !== uid) {
        return res.status(403).json({ success: false, message: "Unauthorized — you do not own this tournament dispute" });
      }

      const resolutionStatus = action === "dismiss" ? "dismissed" : "resolved";
      await disputeRef.update({
        status: resolutionStatus,
        resolutionAction: action,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedBy: uid,
      });

      res.json({
        success: true,
        message: `Dispute ${resolutionStatus} with action: ${action}`,
        disputeId: id,
        status: resolutionStatus,
      });
    } catch (error: any) {
      console.error("Error resolving dispute:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  }
);

export default router;
