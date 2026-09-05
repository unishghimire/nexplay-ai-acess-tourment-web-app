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

    // Strict segregation: exclude documents that are tournaments or not scrims
    scrims = scrims.filter(s => {
      if (s.matchType === 'tournament' || s.isTournament === true || s.type === 'tournament' || s.isScrim === false) return false;
      const formatLower = typeof s.format === 'string' ? s.format.toLowerCase() : '';
      if (
        formatLower === 'single_elimination' ||
        formatLower === 'double_elimination' ||
        formatLower === 'round_robin' ||
        formatLower === 'swiss' ||
        formatLower === 'bracket'
      ) {
        return false;
      }
      const titleLower = typeof s.title === 'string' ? s.title.toLowerCase() : '';
      if (
        (titleLower.includes('tournament') || titleLower.includes('league') || titleLower.includes('leauge') || titleLower.includes('championship')) &&
        !titleLower.includes('scrim')
      ) {
        return false;
      }
      return true;
    });

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
      matchType: "scrims",
      isScrim: true,
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
      const tourneyRef = db.collection("tournaments").doc(id);
      const userRef = db.collection("users").doc(userId);

      // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
      const [scrimSnap, tourneySnap, userSnap] = await Promise.all([
        transaction.get(scrimRef),
        transaction.get(tourneyRef),
        transaction.get(userRef)
      ]);

      if (!scrimSnap.exists && !tourneySnap.exists) {
        throw new Error("Scrim not found");
      }

      const activeDoc = scrimSnap.exists ? scrimSnap : tourneySnap;
      const targetRef = scrimSnap.exists ? scrimRef : tourneyRef;
      const scrim = activeDoc.data()!;

      if (scrim.status !== "open") {
        throw new Error(`Scrim is currently ${scrim.status} and not open for registration.`);
      }

      const totalSlots = scrim.totalSlots || getScrimFormatSlots(scrim.format);
      const targetSlot = Number(slotNumber);

      if (!Number.isInteger(targetSlot) || targetSlot < 1 || targetSlot > totalSlots) {
        throw new Error(`Invalid slot number. Must be between 1 and ${totalSlots}.`);
      }

      const slots = Array.isArray(scrim.slots) ? [...scrim.slots] : [];
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

      const entryFee = Number(scrim.entryFee) || 0;
      if (entryFee > 0) {
        const userBalance = Number(userSnap.data()?.balance) || 0;
        if (userBalance < entryFee) {
          throw new Error(`Insufficient wallet balance (Required: NPR ${entryFee}, Available: NPR ${userBalance}).`);
        }
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

      // 2. ALL WRITES AFTER (Strictly no transaction.get allowed past this point)
      if (entryFee > 0) {
        transaction.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-entryFee),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const txRef = db.collection("transactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: "scrim_entry",
          amount: entryFee,
          scrimId: id,
          status: "completed",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

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

      const scrimUpdates = {
        slots,
        filledSlots,
        currentPlayers: filledSlots,
        status: isNowFull ? "full" : "open",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.update(targetRef, scrimUpdates);
      if (targetRef === scrimRef && tourneySnap.exists) {
        transaction.update(tourneyRef, scrimUpdates);
      } else if (targetRef === tourneyRef && scrimSnap.exists) {
        transaction.update(scrimRef, scrimUpdates);
      }

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

    let scrimRef = db.collection("scrims").doc(id);
    let scrimSnap = await scrimRef.get();
    if (!scrimSnap.exists) {
      scrimRef = db.collection("tournaments").doc(id);
      scrimSnap = await scrimRef.get();
    }
    if (!scrimSnap.exists) return res.status(404).json({ success: false, message: "Scrim not found" });

    const scrim = scrimSnap.data()!;
    const hostId = scrim.hostUid || scrim.orgId || scrim.hostId || scrim.userId || scrim.organizerId || scrim.createdBy;
    const isOwner = hostId === uid || req.user.role === "admin";
    if (!isOwner) return res.status(403).json({ success: false, message: "Unauthorized" });

    if (scrim.payoutStatus === "paid") {
      return res.status(400).json({ success: false, message: "Prizes have already been distributed for this scrim." });
    }

    // Validate winners sum and structure
    const valError = validatePrizeWinners(winners);
    if (valError) {
      return res.status(400).json({ success: false, message: valError });
    }

    const totalAllocated = winners.reduce((sum, w) => sum + (Number(w.prize) || 0), 0);
    const expectedPool = Number(scrim.prizePool) || 0;
    if (expectedPool > 0 && Math.abs(totalAllocated - expectedPool) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Distributed prize sum (NPR ${totalAllocated}) must equal scrim prize pool (NPR ${expectedPool}).`
      });
    }

    await db.runTransaction(async (transaction) => {
      // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
      const payoutTargets: Array<{
        winner: any;
        targetUserId: string;
        prizeAmount: number;
        userRef: FirebaseFirestore.DocumentReference;
      }> = [];

      for (const winner of winners) {
        const targetUserId = winner.userId || winner.captainId || winner.leaderId;
        const prizeAmount = Number(winner.prize) || 0;

        if (targetUserId && prizeAmount > 0) {
          const userRef = db.collection("users").doc(targetUserId);
          payoutTargets.push({ winner, targetUserId, prizeAmount, userRef });
        }
      }

      const settingsRef = db.collection("settings").doc("site");
      const settingsDoc = await transaction.get(settingsRef);
      let platformRate = 0.15;
      if (settingsDoc.exists) {
        const sData = settingsDoc.data();
        if (typeof sData?.platformCommission === "number" && sData.platformCommission >= 0 && sData.platformCommission <= 100) {
          platformRate = sData.platformCommission / 100;
        }
      }
      const organizerRate = 1 - platformRate;

      // Fetch all winner user profiles upfront before ANY writes
      const userSnaps = await Promise.all(payoutTargets.map(t => transaction.get(t.userRef)));

      // 2. ALL WRITES AFTER (No transaction.get allowed after this point)
      for (let i = 0; i < payoutTargets.length; i++) {
        const { winner, targetUserId, prizeAmount, userRef } = payoutTargets[i];
        const userDoc = userSnaps[i];
        if (userDoc.exists) {
          transaction.update(userRef, {
            balance: admin.firestore.FieldValue.increment(prizeAmount),
            totalEarnings: admin.firestore.FieldValue.increment(prizeAmount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Sync public profile earnings
          const pubRef = db.collection("users_public").doc(targetUserId);
          transaction.set(pubRef, {
            totalEarnings: admin.firestore.FieldValue.increment(prizeAmount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }

        const txRef = db.collection("transactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId: targetUserId,
          username: winner.teamName || winner.username || "Winner",
          type: "prize",
          amount: prizeAmount,
          method: "Scrim Prize",
          scrimId: id,
          tournamentId: id,
          rank: winner.rank || 1,
          desc: `Prize payout for Rank #${winner.rank || 1} in ${scrim.title || 'Scrim'}`,
          status: "success",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send instant in-app notification to the winner
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          userId: targetUserId,
          title: 'Prize Won! 🏆',
          message: `Congratulations! You placed #${winner.rank || 1} in "${scrim.title || 'Scrim'}" and won Rs. ${prizeAmount.toLocaleString()}! The prize has been credited to your wallet balance.`,
          type: 'success',
          link: '/wallet',
          read: false,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      transaction.update(scrimRef, {
        status: "completed",
        payoutStatus: "paid",
        winners,
        results: winners.map((w: any) => ({
          rank: w.rank,
          teamName: w.teamName || `Rank ${w.rank}`,
          teamId: w.teamId || w.userId || '',
          prize: w.prize || 0,
          kills: w.kills || 0,
          points: w.points || 0,
          userId: w.userId || '',
        })),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 3. Revenue split calculation for paid scrims (85% Organizer / 15% Platform Commission)
      const entryFee = Number(scrim.entryFee || scrim.requirements?.entryFee || scrim.price || 0);
      const slots = Array.isArray(scrim.slots) ? scrim.slots : [];
      const filledSlotsCount = slots.filter((s: any) => s.status === 'filled' || s.status === 'reserved' || Boolean(s.userId)).length;
      const participantCount = filledSlotsCount || Number(scrim.currentPlayers) || Number(scrim.filledSlots) || winners.length || 0;
      const entryFeeTotal = participantCount * entryFee;
      const prizePoolTotal = Number(scrim.prizePool) || totalAllocated || 0;
      const profit = entryFeeTotal - prizePoolTotal;

      if (profit > 0) {
        const REVENUE_SPLIT = { ORGANIZER: 0.85, PLATFORM: 0.15 } as const;
        const orgShare = Math.round(profit * REVENUE_SPLIT.ORGANIZER);
        const nexplayShare = Math.round(profit * REVENUE_SPLIT.PLATFORM);

        const earnRef = db.collection("tournamentEarnings").doc();
        transaction.set(earnRef, {
          tournamentId: id,
          tournamentName: scrim.title || 'Scrim',
          orgId: scrim.hostUid || scrim.orgId || req.user.userId,
          orgName: scrim.hostName || req.user.username || 'Organizer',
          entryFeeTotal,
          prizePoolTotal,
          profit,
          orgShare,
          nexplayShare,
          status: 'pending',
          isScrim: true,
          type: 'scrim',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    return res.json({ success: true, message: `Multi-tier prizes successfully distributed (Total: NPR ${totalAllocated}).`, winners });
  } catch (error: any) {
    console.error("Payout error:", error);
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
