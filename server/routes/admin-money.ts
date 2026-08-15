import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { requireAdmin } from "../authz.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// ADMIN MONEY OPERATIONS — server-side only (BUG-031)
// Deposit approval, rejection, refunds, balance adjustments, and
// earnings release moved out of the browser. Every op runs an atomic
// Admin-SDK transaction, validates current status (no double-approve/
// double-refund/double-release), and writes a server-authored
// activityLogs audit record. Firestore rules block all client writes
// to transactions/tournamentEarnings; the Admin SDK bypasses rules.
// ═══════════════════════════════════════════════════════════════

const AUDITABLE_STATUS_GUARD_MESSAGES = new Set([
  "Transaction not found",
  "Transaction already approved",
  "Transaction already rejected",
  "Transaction already refunded",
  "Only deposits can be approved",
  "Earnings record not found",
  "Earnings already released",
]);

const isStatusGuard = (message: string) => AUDITABLE_STATUS_GUARD_MESSAGES.has(message);

const writeAudit = (tx: any, req: any, action: string, details: string) => {
  const auditRef = db.collection("activityLogs").doc();
  tx.set(auditRef, {
    adminId: req.user.userId,
    adminEmail: req.user.email,
    action,
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
};

// POST /api/admin/transactions/approve — credit deposit, mark success
router.post("/api/admin/transactions/approve",
  authenticateToken, requireAdmin, rateLimit(20, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { transactionId } = req.body;
      if (typeof transactionId !== "string" || !transactionId) {
        return res.status(400).json({ success: false, message: "transactionId required" });
      }

      const result = await db.runTransaction(async (tx) => {
        const txRef = db.collection("transactions").doc(transactionId);
        const txDoc = await tx.get(txRef);
        if (!txDoc.exists) throw new Error("Transaction not found");
        const txData = txDoc.data();
        if (txData.status === "success") throw new Error("Transaction already approved");
        if (txData.status === "rejected") throw new Error("Transaction already rejected");
        if (txData.type !== "deposit") throw new Error("Only deposits can be approved");

        const amount = Number(txData.amount || 0);
        if (!isFinite(amount)) throw new Error("Invalid transaction amount");

        const userRef = db.collection("users").doc(txData.userId);
        const userDoc = await tx.get(userRef);
        const balanceBefore = userDoc.exists ? userDoc.data()?.balance || 0 : 0;
        const balanceAfter = balanceBefore + amount;

        tx.update(userRef, { balance: admin.firestore.FieldValue.increment(amount) });
        tx.update(txRef, {
          status: "success",
          confirmedBy: req.user.userId,
          confirmedByUsername: req.user.username,
          balanceBefore,
          balanceAfter,
        });
        writeAudit(tx, req, "transaction_approved", `Approved deposit of ${amount} for ${txData.userId}`);
        return { balanceAfter };
      });

      return res.json({ success: true, message: "Transaction approved", balanceAfter: result.balanceAfter });
    } catch (error: any) {
      const msg = error.message || "Failed to approve transaction";
      return res.status(isStatusGuard(msg) ? 400 : 500).json({ success: false, message: msg });
    }
  }
);

// POST /api/admin/transactions/reject — reject deposit or withdrawal
router.post("/api/admin/transactions/reject",
  authenticateToken, requireAdmin, rateLimit(20, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { transactionId, reason } = req.body;
      if (typeof transactionId !== "string" || !transactionId) {
        return res.status(400).json({ success: false, message: "transactionId required" });
      }

      await db.runTransaction(async (tx) => {
        const txRef = db.collection("transactions").doc(transactionId);
        const txDoc = await tx.get(txRef);
        if (!txDoc.exists) throw new Error("Transaction not found");
        const txData = txDoc.data();
        if (txData.status === "rejected") throw new Error("Transaction already rejected");
        if (txData.status === "success") throw new Error("Transaction already approved");

        // Withdrawals lock funds at request time — rejection releases them.
        if (txData.type === "withdrawal") {
          const userRef = db.collection("users").doc(txData.userId);
          tx.update(userRef, { balance: admin.firestore.FieldValue.increment(Math.abs(Number(txData.amount || 0))) });
        }
        tx.update(txRef, {
          status: "rejected",
          rejectionReason: typeof reason === "string" && reason ? reason : "No reason provided",
          confirmedBy: req.user.userId,
          confirmedByUsername: req.user.username,
        });
        writeAudit(tx, req, "transaction_rejected", `Rejected ${txData.type} of ${txData.amount} for ${txData.userId}`);
      });

      return res.json({ success: true, message: "Transaction rejected" });
    } catch (error: any) {
      const msg = error.message || "Failed to reject transaction";
      return res.status(isStatusGuard(msg) ? 400 : 500).json({ success: false, message: msg });
    }
  }
);

// POST /api/admin/transactions/refund — refund a settled transaction
router.post("/api/admin/transactions/refund",
  authenticateToken, requireAdmin, rateLimit(20, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { transactionId } = req.body;
      if (typeof transactionId !== "string" || !transactionId) {
        return res.status(400).json({ success: false, message: "transactionId required" });
      }

      await db.runTransaction(async (tx) => {
        const txRef = db.collection("transactions").doc(transactionId);
        const txDoc = await tx.get(txRef);
        if (!txDoc.exists) throw new Error("Transaction not found");
        const txData = txDoc.data();
        if (txData.status === "refunded") throw new Error("Transaction already refunded");

        const userRef = db.collection("users").doc(txData.userId);
        tx.update(userRef, { balance: admin.firestore.FieldValue.increment(Math.abs(Number(txData.amount || 0))) });
        tx.update(txRef, {
          status: "refunded",
          confirmedBy: req.user.userId,
          confirmedByUsername: req.user.username,
        });
        writeAudit(tx, req, "transaction_refunded", `Refunded ${txData.type} of ${txData.amount} for ${txData.userId}`);
      });

      return res.json({ success: true, message: "Transaction refunded" });
    } catch (error: any) {
      const msg = error.message || "Failed to refund transaction";
      return res.status(isStatusGuard(msg) ? 400 : 500).json({ success: false, message: msg });
    }
  }
);

// POST /api/admin/balance/adjust — add/subtract a user's balance with a ledger entry
router.post("/api/admin/balance/adjust",
  authenticateToken, requireAdmin, rateLimit(10, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { userId, amount, type, desc } = req.body;
      if (typeof userId !== "string" || !userId) {
        return res.status(400).json({ success: false, message: "userId required" });
      }
      const numAmount = Number(amount);
      if (!isFinite(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" });
      }
      if (type !== "add" && type !== "subtract") {
        return res.status(400).json({ success: false, message: "type must be 'add' or 'subtract'" });
      }

      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const balanceBefore = userDoc.data()?.balance || 0;
        const finalAmount = type === "subtract" ? -numAmount : numAmount;
        if (type === "subtract" && balanceBefore < numAmount) throw new Error("Insufficient balance");
        const balanceAfter = balanceBefore + finalAmount;

        tx.update(userRef, { balance: admin.firestore.FieldValue.increment(finalAmount) });

        const txRef = db.collection("transactions").doc();
        tx.set(txRef, {
          id: txRef.id,
          userId,
          username: userDoc.data()?.username || "",
          amount: numAmount,
          type: "adjustment",
          method: "Admin Adjustment",
          status: "success",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          desc: typeof desc === "string" && desc ? desc : `Admin Adjustment: ${type === "add" ? "Added" : "Subtracted"} ${numAmount}`,
          confirmedBy: req.user.userId,
          confirmedByUsername: req.user.username,
          balanceBefore,
          balanceAfter,
        });
        writeAudit(tx, req, "balance_adjusted", `${type === "add" ? "Added" : "Subtracted"} ${numAmount} ${type === "add" ? "to" : "from"} ${userId}`);
        return { balanceAfter };
      });

      return res.json({ success: true, message: "Balance adjusted", balanceAfter: result.balanceAfter });
    } catch (error: any) {
      const msg = error.message || "Failed to adjust balance";
      const bad = msg === "User not found" || msg === "Insufficient balance";
      return res.status(bad ? 400 : 500).json({ success: false, message: msg });
    }
  }
);

// POST /api/admin/earnings/release — release org earnings to the org wallet
router.post("/api/admin/earnings/release",
  authenticateToken, requireAdmin, rateLimit(10, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { earningId } = req.body;
      if (typeof earningId !== "string" || !earningId) {
        return res.status(400).json({ success: false, message: "earningId required" });
      }

      await db.runTransaction(async (tx) => {
        const earningRef = db.collection("tournamentEarnings").doc(earningId);
        const earningDoc = await tx.get(earningRef);
        if (!earningDoc.exists) throw new Error("Earnings record not found");
        const earningData = earningDoc.data();
        if (earningData.status === "released") throw new Error("Earnings already released");
        if (earningData.status !== "pending") throw new Error(`Earnings status is ${earningData.status}, cannot release`);

        const orgShare = Number(earningData.orgShare || 0);
        const orgRef = db.collection("users").doc(earningData.orgId);

        tx.update(earningRef, {
          status: "released",
          releasedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(orgRef, {
          orgPendingEarnings: admin.firestore.FieldValue.increment(-orgShare),
          orgWalletBalance: admin.firestore.FieldValue.increment(orgShare),
        });

        const txRef = db.collection("transactions").doc();
        tx.set(txRef, {
          id: txRef.id,
          userId: earningData.orgId,
          username: earningData.orgName || "",
          type: "prize",
          amount: orgShare,
          method: "Tournament Earnings",
          refId: `EARN-${String(earningData.tournamentId || "").slice(0, 8)}`,
          status: "success",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          desc: `Earnings released for tournament: ${earningData.tournamentName || earningData.tournamentId}`,
          tournamentId: earningData.tournamentId,
          confirmedBy: req.user.userId,
          confirmedByUsername: req.user.username,
        });
        writeAudit(tx, req, "earnings_released", `Released ${orgShare} to ${earningData.orgName} for tournament ${earningData.tournamentName}`);
      });

      return res.json({ success: true, message: "Earnings released" });
    } catch (error: any) {
      const msg = error.message || "Failed to release earnings";
      return res.status(isStatusGuard(msg) ? 400 : 500).json({ success: false, message: msg });
    }
  }
);

export default router;
