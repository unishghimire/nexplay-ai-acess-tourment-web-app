import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { commitBatchedWrites } from "../batchedWrites.js";
import { validatePrizeWinners } from "../prizeValidation.js";

const router = Router();

// Slot counts based on format: Squad=12, Duo=25, Solo=48
export function getScrimFormatSlots(format?: string | null): number {
  if (format === 'Solo') return 48;
  if (format === 'Duo') return 25;
  return 12; // Squad & default
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/scrims — Fetch all active scrims (dual-collection resilient)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/scrims", rateLimit(60, 60 * 1000), async (req, res) => {
  try {
    const { game, format } = req.query;
    const sources = await Promise.allSettled([
      db.collection("scrims").limit(100).get(),
      db.collection("tournaments").where("matchType", "==", "scrims").limit(100).get(),
      db.collection("tournaments").where("isScrim", "==", true).limit(100).get(),
    ]);

    const activeStatuses = new Set(["open", "full", "credentials_sent", "live", "upcoming", "published"]);
    const combinedMap = new Map<string, any>();

    for (const result of sources) {
      if (result.status === 'fulfilled') {
        for (const doc of result.value.docs) {
          const data: any = { id: doc.id, ...doc.data() };
          if (activeStatuses.has(data.status)) {
            combinedMap.set(doc.id, data);
          }
        }
      }
    }

    let scrims = Array.from(combinedMap.values());

    if (typeof game === "string" && game.trim() && game !== "All") {
      const g = game.trim().toLowerCase();
      scrims = scrims.filter(s => s.game && (s.game.toLowerCase() === g || (g === "mlbb" && s.game.toLowerCase().includes("legend"))));
    }

    if (typeof format === "string" && format.trim() && format !== "All") {
      scrims = scrims.filter(s => s.format === format.trim());
    }

    return res.json({ success: true, scrims });
  } catch (error: any) {
    console.error("Error fetching scrims:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch scrims", scrims: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/scrims — Create a new Scrim (Squad:12, Duo:25, Solo:48)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { title, game, format, map, startTime, entryFee, prizePool, rules, ytLink } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
      return res.status(400).json({ success: false, message: "Valid scrim title is required (max 200 characters)." });
    }
    if (!game || typeof game !== "string") {
      return res.status(400).json({ success: false, message: "Game title is required." });
    }

    const validFormat = ['Squad', 'Duo', 'Solo'].includes(format) ? format : 'Squad';
    const totalSlots = getScrimFormatSlots(validFormat);

    const fee = Math.max(0, Number(entryFee) || 0);
    const prize = Math.max(0, Number(prizePool) || 0);

    // Generate clean initial slots array (1..totalSlots)
    const initialSlots = Array.from({ length: totalSlots }, (_, i) => ({
      slotNumber: i + 1,
      status: 'open',
      teamId: null,
      teamName: null,
      captainUid: null,
      captainDiscord: null,
      joinedAt: null,
    }));

    const scrimRef = db.collection("scrims").doc();
    const scrimData = {
      id: scrimRef.id,
      title: title.trim(),
      game: game.trim(),
      format: validFormat,
      map: map || "Bermuda",
      startTime: startTime ? (new Date(startTime).toISOString()) : new Date().toISOString(),
      entryFee: fee,
      prizePool: prize,
      totalSlots,
      filledSlots: 0,
      currentPlayers: 0,
      slots: initialSlots,
      status: "open",
      hostUid: req.user.userId,
      orgId: req.user.userId,
      rules: rules || "",
      ytLink: ytLink || "",
      payoutStatus: prize > 0 ? "unpaid" : "paid",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await scrimRef.set(scrimData);
    return res.status(201).json({ success: true, message: `Scrim created with ${totalSlots} slots for ${validFormat}`, scrim: scrimData });
  } catch (error: any) {
    console.error("Create scrim error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create scrim" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/scrims/:id/join — Atomic slot reservation
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims/:id/join", authenticateToken, rateLimit(15, 60 * 1000), async (req: any, res) => {
  const { id } = req.params;
  const { slotNumber, teamId, teamName, captainDiscord } = req.body;
  const userId = req.user.userId;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const scrimRef = db.collection("scrims").doc(id);
      const scrimSnap = await transaction.get(scrimRef);

      if (!scrimSnap.exists) {
        throw new Error("Scrim not found");
      }

      const scrim = scrimSnap.data()!;
      if (scrim.status !== "open") {
        throw new Error(`Scrim is currently ${scrim.status} and not open for registration.`);
      }

      const totalSlots = scrim.totalSlots || getScrimFormatSlots(scrim.format);
      const targetSlot = Number(slotNumber);

      if (!Number.isInteger(targetSlot) || targetSlot < 1 || targetSlot > totalSlots) {
        throw new Error(`Invalid slot number. Must be between 1 and ${totalSlots}.`);
      }

      const slots = Array.isArray(scrim.slots) ? scrim.slots : [];
      const slotIndex = slots.findIndex((s: any) => s.slotNumber === targetSlot);

      if (slotIndex === -1) {
        throw new Error(`Slot ${targetSlot} does not exist in this scrim.`);
      }

      if (slots[slotIndex].status !== 'open') {
        throw new Error(`Slot ${targetSlot} is already reserved.`);
      }

      // Check duplicate join
      const alreadyJoined = slots.some((s: any) => s.captainUid === userId || (teamId && s.teamId === teamId));
      if (alreadyJoined) {
        throw new Error("You or your team are already registered in this scrim.");
      }

      // Deduct entry fee if required
      if (scrim.entryFee > 0) {
        const userRef = db.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        const userBalance = Number(userSnap.data()?.balance) || 0;

        if (userBalance < scrim.entryFee) {
          throw new Error(`Insufficient wallet balance (Required: NPR ${scrim.entryFee}, Available: NPR ${userBalance}).`);
        }

        transaction.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-scrim.entryFee),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Record ledger entry
        const txRef = db.collection("transactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: "scrim_entry",
          amount: scrim.entryFee,
          scrimId: id,
          status: "completed",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Update slot reservation
      slots[slotIndex] = {
        slotNumber: targetSlot,
        status: 'filled',
        teamId: teamId || null,
        teamName: teamName || req.user.name || "Player",
        captainUid: userId,
        captainDiscord: captainDiscord || null,
        joinedAt: new Date().toISOString(),
      };

      const filledSlots = slots.filter((s: any) => s.status === 'filled').length;
      const isNowFull = filledSlots >= totalSlots;

      // Register participant record
      const partRef = db.collection("participants").doc(`${id}_${userId}`);
      transaction.set(partRef, {
        id: `${id}_${userId}`,
        tournamentId: id,
        scrimId: id,
        userId,
        teamId: teamId || null,
        teamName: teamName || req.user.name || "Player",
        slotNumber: targetSlot,
        status: "approved",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(scrimRef, {
        slots,
        filledSlots,
        currentPlayers: filledSlots,
        status: isNowFull ? "full" : "open",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, slotNumber: targetSlot, filledSlots, totalSlots, isFull: isNowFull };
    });

    return res.status(200).json(result);
  } catch (error: any) {
    const msg = error.message || "Failed to join scrim";
    const status = msg.includes("Insufficient") ? 402 : msg.includes("already") || msg.includes("Invalid") ? 400 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/scrims/:id/slot — Organizer lock / reserve toggle
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims/:id/slot", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { slotNumber } = req.body;
    const uid = req.user.userId;

    const scrimRef = db.collection("scrims").doc(id);
    const scrimSnap = await scrimRef.get();
    if (!scrimSnap.exists) return res.status(404).json({ success: false, message: "Scrim not found" });

    const scrim = scrimSnap.data()!;
    const isOwner = scrim.hostUid === uid || scrim.orgId === uid || req.user.role === "admin";
    if (!isOwner) return res.status(403).json({ success: false, message: "Unauthorized" });

    const targetSlot = Number(slotNumber);
    const slots = Array.isArray(scrim.slots) ? scrim.slots : [];
    const index = slots.findIndex((s: any) => s.slotNumber === targetSlot);
    if (index === -1) return res.status(400).json({ success: false, message: "Slot not found" });

    if (slots[index].status === 'filled') {
      slots[index] = { slotNumber: targetSlot, status: 'open', teamId: null, teamName: null, captainUid: null, captainDiscord: null, joinedAt: null };
    } else {
      slots[index] = { slotNumber: targetSlot, status: 'filled', teamId: null, teamName: "Reserved Slot", captainUid: uid, captainDiscord: null, joinedAt: new Date().toISOString() };
    }

    const filledSlots = slots.filter((s: any) => s.status === 'filled').length;
    await scrimRef.update({
      slots,
      filledSlots,
      currentPlayers: filledSlots,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, slotNumber: targetSlot, newStatus: slots[index].status, filledSlots });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Failed to toggle slot" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/scrims/:id/dispatch-room — Broadcast Room ID & Password
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims/:id/dispatch-room", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { roomId, roomPass, streamUrl } = req.body;
    const uid = req.user.userId;

    if (!roomId || !roomPass) {
      return res.status(400).json({ success: false, message: "Room ID and Password are required." });
    }

    const scrimRef = db.collection("scrims").doc(id);
    const scrimSnap = await scrimRef.get();
    if (!scrimSnap.exists) return res.status(404).json({ success: false, message: "Scrim not found" });

    const scrim = scrimSnap.data()!;
    const isOwner = scrim.hostUid === uid || scrim.orgId === uid || req.user.role === "admin";
    if (!isOwner) return res.status(403).json({ success: false, message: "Unauthorized" });

    // Store private credentials in protected subcollection
    const credRef = scrimRef.collection("credentials").doc("main");
    await credRef.set({
      roomId: String(roomId).trim(),
      roomPass: String(roomPass).trim(),
      streamUrl: streamUrl || scrim.ytLink || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await scrimRef.update({
      status: "credentials_sent",
      ytLink: streamUrl || scrim.ytLink || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: "Room credentials dispatched to participants" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Failed to dispatch credentials" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/scrims/:id/payout — Instant single-session prize payout
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims/:id/payout", authenticateToken, rateLimit(5, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { winners } = req.body;
    const uid = req.user.userId;

    if (!Array.isArray(winners) || winners.length === 0) {
      return res.status(400).json({ success: false, message: "Winners list is required." });
    }

    const scrimRef = db.collection("scrims").doc(id);
    const scrimSnap = await scrimRef.get();
    if (!scrimSnap.exists) return res.status(404).json({ success: false, message: "Scrim not found" });

    const scrim = scrimSnap.data()!;
    const isOwner = scrim.hostUid === uid || scrim.orgId === uid || req.user.role === "admin";
    if (!isOwner) return res.status(403).json({ success: false, message: "Unauthorized" });

    if (scrim.payoutStatus === "paid") {
      return res.status(400).json({ success: false, message: "Prizes have already been distributed for this scrim." });
    }

    // Validate winners sum
    validatePrizeWinners(winners);
    const totalAllocated = winners.reduce((sum, w) => sum + (Number(w.prize) || 0), 0);
    if (scrim.prizePool > 0 && totalAllocated !== scrim.prizePool) {
      return res.status(400).json({
        success: false,
        message: `Distributed prize sum (NPR ${totalAllocated}) must equal scrim prize pool (NPR ${scrim.prizePool}).`
      });
    }

    await db.runTransaction(async (transaction) => {
      for (const winner of winners) {
        if (winner.userId && winner.prize > 0) {
          const userRef = db.collection("users").doc(winner.userId);
          transaction.update(userRef, {
            balance: admin.firestore.FieldValue.increment(winner.prize),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          const txRef = db.collection("transactions").doc();
          transaction.set(txRef, {
            id: txRef.id,
            userId: winner.userId,
            type: "prize_payout",
            amount: winner.prize,
            scrimId: id,
            rank: winner.rank,
            status: "completed",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      transaction.update(scrimRef, {
        status: "completed",
        payoutStatus: "paid",
        winners,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.json({ success: true, message: `Prizes successfully paid (Total: NPR ${totalAllocated}).` });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to payout prizes" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. DELETE /api/scrims/:id — Cascading deletion of Scrim
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/api/scrims/:id", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { id } = req.params;
    if (!id || id.length > 128) return res.status(400).json({ success: false, message: "Invalid scrim ID" });
    const uid = req.user.userId;

    let targetRef = db.collection("scrims").doc(id);
    let targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      targetRef = db.collection("tournaments").doc(id);
      targetSnap = await targetRef.get();
    }

    if (!targetSnap.exists) {
      return res.status(404).json({ success: false, message: "Scrim not found" });
    }

    const scrim = targetSnap.data()!;
    const ownerId = scrim.hostUid || scrim.orgId || scrim.hostId || scrim.userId || scrim.organizerId || scrim.createdBy;
    const isOwner = ownerId === uid || req.user.role === "admin";
    if (!isOwner) return res.status(403).json({ success: false, message: "Unauthorized — only the host/organizer or admin can delete this scrim" });

    if (scrim.status === "live") {
      return res.status(400).json({ success: false, message: "Cannot delete an active live scrim. End or cancel it first." });
    }

    const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

    // 1. Delete participants (both scrimId and tournamentId references)
    const [pScrimSnap, pTournSnap] = await Promise.all([
      db.collection("participants").where("scrimId", "==", id).get(),
      db.collection("participants").where("tournamentId", "==", id).get()
    ]);
    pScrimSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));
    pTournSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

    // 2. Delete credentials subcollections in both locations
    const [sCreds, tCreds] = await Promise.all([
      db.collection("scrims").doc(id).collection("credentials").get(),
      db.collection("tournaments").doc(id).collection("credentials").get()
    ]);
    sCreds.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));
    tCreds.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

    // 3. Delete results and earnings if any
    const [resultsSnap, earningsSnap] = await Promise.all([
      db.collection("results").where("tournamentId", "==", id).get(),
      db.collection("tournamentEarnings").where("tournamentId", "==", id).get()
    ]);
    resultsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));
    earningsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

    // 4. Delete document in both collections
    operations.push(batch => batch.delete(db.collection("scrims").doc(id)));
    operations.push(batch => batch.delete(db.collection("tournaments").doc(id)));

    await commitBatchedWrites(() => db.batch(), operations);
    return res.json({ success: true, message: "Scrim deleted successfully" });
  } catch (error: any) {
    console.error("Delete scrim error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to delete scrim" });
  }
});

export default router;
