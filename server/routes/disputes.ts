import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { requireAdmin, requireOrganizer } from "../authz.js";

const router = Router();

// POST /api/disputes — File a dispute for a match/room/tournament or wallet transaction
router.post(
  "/api/disputes",
  authenticateToken,
  rateLimit(5, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { disputeType = "tournament", tournamentId, transactionId, matchRoom, reason, reportedTeamId, reportedTeamName, amount, type, refId } = req.body;
      const uid = req.user.userId;

      if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
        return res.status(400).json({ success: false, message: "Dispute reason must be at least 5 characters" });
      }

      const disputeRef = db.collection("disputes").doc();
      let disputeData: any;

      if (disputeType === "payment" || transactionId) {
        if (!transactionId && !refId) {
          return res.status(400).json({ success: false, message: "Valid transactionId or refId is required for payment dispute" });
        }
        disputeData = {
          id: disputeRef.id,
          disputeType: "payment",
          transactionId: transactionId || null,
          refId: refId || transactionId || null,
          amount: typeof amount === "number" ? amount : null,
          paymentType: type || "transaction",
          reason: reason.trim(),
          reportedBy: req.user.email || uid,
          reporterUid: uid,
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          filedAt: new Date().toISOString(),
        };
      } else {
        if (!tournamentId || typeof tournamentId !== "string") {
          return res.status(400).json({ success: false, message: "Valid tournamentId is required" });
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
        const isScrim = tData?.matchType === "scrims" || tData?.isScrim === true;
        disputeData = {
          id: disputeRef.id,
          disputeType: isScrim ? "scrim" : "tournament",
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
      }

      await disputeRef.set(disputeData);

      res.status(201).json({
        success: true,
        message: `${disputeData.disputeType === 'payment' ? 'Payment' : 'Tournament'} dispute filed successfully`,
        disputeId: disputeRef.id,
        disputeType: disputeData.disputeType,
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
      const { tournamentId, status, disputeType } = req.query;

      let q: FirebaseFirestore.Query = db.collection("disputes");

      if (disputeType && typeof disputeType === "string") {
        q = q.where("disputeType", "==", disputeType);
      }

      if (tournamentId && typeof tournamentId === "string") {
        q = q.where("tournamentId", "==", tournamentId);
      } else if (!isAdmin) {
        // Organizers only see disputes for their own hosted tournaments (never payment disputes)
        q = q.where("organizerId", "==", uid);
      }

      if (status && typeof status === "string") {
        q = q.where("status", "==", status);
      }

      const snap = await q.limit(100).get();
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
      if (dispute.disputeType === "payment" && !isAdmin) {
        return res.status(403).json({ success: false, message: "Only platform administrators can resolve payment disputes" });
      }
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
