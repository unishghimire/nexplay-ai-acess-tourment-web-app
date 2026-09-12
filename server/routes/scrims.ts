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
// 1. GET /api/scrims — Fetch all active scrims (strictly from scrims collection)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/scrims", rateLimit(60, 60 * 1000), async (req, res) => {
  try {
    const { game, format } = req.query;
    const snap = await db.collection("scrims").limit(100).get();
    const activeStatuses = new Set(["open", "full", "credentials_sent", "live", "upcoming", "published"]);

    let scrims: any[] = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((s: any) => activeStatuses.has(s.status));

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
// 1b. GET /api/scrims/:id — Fetch single scrim by ID
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/scrims/:id", rateLimit(60, 60 * 1000), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id.length > 128) return res.status(400).json({ success: false, message: "Invalid scrim ID" });
    const snap = await db.collection("scrims").doc(id).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "Scrim not found" });
    return res.json({ success: true, scrim: { id: snap.id, ...snap.data() } });
  } catch (error: any) {
    console.error("Error fetching scrim by ID:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch scrim" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/scrims — Create a new Scrim (Squad:12, Duo:25, Solo:48)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const {
      title,
      game,
      format,
      map,
      startTime,
      entryFee,
      prizePool,
      prizeDistribution,
      rules,
      ytLink,
      tournamentMode,
      rewardPerKill,
      rewardConfig,
      pointSystem,
      scoringSnapshot
    } = req.body;

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

    const isPerKill = tournamentMode === 'PER_KILL_REWARD' || Number(rewardPerKill) > 0;
    const resolvedRewardPerKill = Math.max(0, Number(rewardPerKill) || Number(rewardConfig?.rewardPerKill) || 0);

    const resolvedPrizeDistribution = Array.isArray(prizeDistribution) && prizeDistribution.length > 0
      ? prizeDistribution
      : (!isPerKill && prize > 0
          ? [
              { rank: 1, amount: Math.round(prize * 0.5) },
              { rank: 2, amount: Math.round(prize * 0.3) },
              { rank: 3, amount: prize - Math.round(prize * 0.5) - Math.round(prize * 0.3) },
            ].filter(p => p.amount > 0)
          : null);

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
    const scrimData: any = {
      id: scrimRef.id,
      title: title.trim(),
      game: game.trim(),
      format: validFormat,
      map: map || "Bermuda",
      startTime: startTime ? (new Date(startTime).toISOString()) : new Date().toISOString(),
      entryFee: fee,
      prizePool: prize,
      prizeDistribution: resolvedPrizeDistribution,
      totalSlots,
      filledSlots: 0,
      currentPlayers: 0,
      slots: initialSlots,
      status: "open",
      matchType: "scrims",
      isScrim: true,
      tournamentMode: isPerKill ? 'PER_KILL_REWARD' : 'POINTS',
      rewardPerKill: resolvedRewardPerKill,
      rewardConfig: rewardConfig || (isPerKill ? {
        rewardPerKill: resolvedRewardPerKill,
        minimumKillsForReward: Number(rewardConfig?.minimumKillsForReward) || 0,
        currency: 'NPR',
      } : null),
      pointSystem: pointSystem || null,
      scoringSnapshot: scoringSnapshot || null,
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
  const { slotNumber, teamId, teamName, teamLogo, captainDiscord } = req.body;
  const userId = req.user.userId;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const scrimRef = db.collection("scrims").doc(id);
      const userRef = db.collection("users").doc(userId);

      // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
      const [scrimSnap, userSnap] = await Promise.all([
        transaction.get(scrimRef),
        transaction.get(userRef)
      ]);

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
        teamLogo: teamLogo || null,
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
        teamLogo: teamLogo || null,
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

      transaction.update(scrimRef, scrimUpdates);

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
// 3b. POST /api/scrims/:id/leave — Release slot and refund fee
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims/:id/leave", authenticateToken, rateLimit(15, 60 * 1000), async (req: any, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const scrimRef = db.collection("scrims").doc(id);
      const userRef = db.collection("users").doc(userId);
      const partRef = db.collection("participants").doc(`${id}_${userId}`);

      const [scrimSnap, userSnap, partSnap] = await Promise.all([
        transaction.get(scrimRef),
        transaction.get(userRef),
        transaction.get(partRef),
      ]);

      if (!scrimSnap.exists) throw new Error("Scrim not found");
      const scrim = scrimSnap.data()!;

      if (scrim.status !== "open" && scrim.status !== "full") {
        throw new Error("Cannot leave a scrim that is live or completed");
      }

      const slots = Array.isArray(scrim.slots) ? [...scrim.slots] : [];
      const slotIndex = slots.findIndex((s: any) => s.captainUid === userId);

      if (slotIndex === -1 && !partSnap.exists) {
        throw new Error("You are not registered in this scrim");
      }

      const entryFee = Number(scrim.entryFee) || 0;
      if (entryFee > 0 && partSnap.exists) {
        transaction.update(userRef, {
          balance: admin.firestore.FieldValue.increment(entryFee),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const refundTxRef = db.collection("transactions").doc();
        transaction.set(refundTxRef, {
          id: refundTxRef.id,
          userId,
          type: "refund",
          amount: entryFee,
          scrimId: id,
          method: "Scrim Entry Refund",
          status: "completed",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      if (slotIndex !== -1) {
        const slotNum = slots[slotIndex].slotNumber;
        slots[slotIndex] = {
          slotNumber: slotNum,
          status: 'open',
          teamId: null,
          teamName: null,
          teamLogo: null,
          captainUid: null,
          captainDiscord: null,
          joinedAt: null,
        };
      }

      const filledSlots = slots.filter((s: any) => s.status === 'filled').length;
      transaction.update(scrimRef, {
        slots,
        filledSlots,
        currentPlayers: filledSlots,
        status: "open",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (partSnap.exists) {
        transaction.delete(partRef);
      }

      return { success: true, message: "Successfully left scrim lobby" };
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to leave scrim" });
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

    const isPerKill = scrim.tournamentMode === 'PER_KILL_REWARD' || Number(scrim.rewardPerKill) > 0 || Array.isArray(req.body.killRewards);
    const totalAllocated = winners.reduce((sum, w) => sum + (Number(w.prize) || 0), 0);
    const expectedPool = Number(scrim.prizePool) || 0;

    if (isPerKill) {
      // In Per-Kill Scrims:
      // Reward is allocated dynamically based on verified kills (kills * rewardPerKill) + placement bonuses.
      // Total distributed must not exceed funded maximum pool (if expectedPool > 0).
      if (expectedPool > 0 && totalAllocated > expectedPool + 0.01) {
        return res.status(400).json({
          success: false,
          message: `Distributed kill bounty (NPR ${totalAllocated}) exceeds maximum prize pool (NPR ${expectedPool}).`
        });
      }
    } else {
      // In Standard Scrims:
      // Placement prizes for 1st, 2nd, 3rd, 4th, etc. must match configured prize pool.
      if (expectedPool > 0 && Math.abs(totalAllocated - expectedPool) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Distributed prize sum (NPR ${totalAllocated}) must equal scrim prize pool (NPR ${expectedPool}).`
        });
      }
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

        const isPerKillRecipient = isPerKill && (Number(winner.kills) > 0 || Number(scrim.rewardPerKill) > 0);
        const rewardRate = Number(scrim.rewardPerKill || scrim.rewardConfig?.rewardPerKill || 0);
        const desc = isPerKillRecipient
          ? `Per-kill bounty payout (${winner.kills || 0} kills @ NPR ${rewardRate}/kill) + Rank #${winner.rank || 1} in ${scrim.title || 'Scrim'}`
          : `Prize payout for Rank #${winner.rank || 1} in ${scrim.title || 'Scrim'}`;

        const txRef = db.collection("transactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId: targetUserId,
          username: winner.teamName || winner.username || "Winner",
          type: "prize",
          amount: prizeAmount,
          method: isPerKillRecipient ? "Per-Kill Scrim Bounty" : "Scrim Prize",
          scrimId: id,
          tournamentId: id,
          rank: winner.rank || 1,
          kills: Number(winner.kills) || 0,
          desc,
          status: "success",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send instant in-app notification to the winner
        const notifRef = db.collection("notifications").doc();
        const notifMessage = isPerKillRecipient
          ? `Congratulations! You placed #${winner.rank || 1} with ${winner.kills || 0} kills in "${scrim.title || 'Scrim'}" and earned Rs. ${prizeAmount.toLocaleString()}! The prize has been credited to your wallet.`
          : `Congratulations! You placed #${winner.rank || 1} in "${scrim.title || 'Scrim'}" and won Rs. ${prizeAmount.toLocaleString()}! The prize has been credited to your wallet balance.`;

        transaction.set(notifRef, {
          userId: targetUserId,
          title: isPerKillRecipient ? 'Bounty Won! 🎯' : 'Prize Won! 🏆',
          message: notifMessage,
          type: 'success',
          link: '/wallet',
          read: false,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const scrimUpdates: any = {
        status: "completed",
        payoutStatus: "paid",
        winners,
        results: winners.map((w: any) => ({
          rank: w.rank,
          teamName: w.teamName || w.username || `Rank ${w.rank}`,
          teamId: w.teamId || w.userId || '',
          prize: w.prize || 0,
          kills: w.kills || 0,
          points: w.points || 0,
          userId: w.userId || '',
        })),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (Array.isArray(req.body.manualResults) || Array.isArray(req.body.resultsData?.manualResults)) {
        scrimUpdates.manualResults = req.body.resultsData?.manualResults || req.body.manualResults;
      }
      if (req.body.resultTemplate || req.body.resultsData?.resultTemplate) {
        scrimUpdates.resultTemplate = req.body.resultsData?.resultTemplate || req.body.resultTemplate;
      }
      if (req.body.resultUrl) {
        scrimUpdates.resultUrl = req.body.resultUrl;
      }
      if (Array.isArray(req.body.killRewards)) {
        scrimUpdates.killRewards = req.body.killRewards;
      } else if (isPerKill) {
        scrimUpdates.killRewards = winners.map((w: any) => ({
          userId: w.userId,
          username: w.username || w.teamName,
          rank: w.rank,
          kills: Number(w.kills) || 0,
          rewardAmount: Number(w.prize) || 0,
        }));
      }

      transaction.update(scrimRef, scrimUpdates);

      // 3. Revenue split calculation for paid scrims (dynamic platformCommission from site settings)
      const entryFee = Number(scrim.entryFee || scrim.requirements?.entryFee || scrim.price || 0);
      const slots = Array.isArray(scrim.slots) ? scrim.slots : [];
      const filledSlotsCount = slots.filter((s: any) => s.status === 'filled' || s.status === 'reserved' || Boolean(s.userId)).length;
      const currentPlayersCount = Number(scrim.currentPlayers) || 0;
      const docFilledSlotsCount = Number(scrim.filledSlots) || 0;
      // Precedence: slot array is authoritative; doc counters are fallbacks;
      // winners.length is a last-resort LOWER BOUND — it can understate profit
      // (fewer winners than participants) but never overstate it.
      let participantCount: number;
      let participantCountSource: string;
      if (filledSlotsCount > 0) {
        participantCount = filledSlotsCount;
        participantCountSource = 'slots';
      } else if (currentPlayersCount > 0) {
        participantCount = currentPlayersCount;
        participantCountSource = 'currentPlayers';
      } else if (docFilledSlotsCount > 0) {
        participantCount = docFilledSlotsCount;
        participantCountSource = 'filledSlots';
      } else {
        participantCount = winners.length;
        participantCountSource = 'winners-lower-bound';
      }
      const entryFeeTotal = participantCount * entryFee;
      const prizePoolTotal = Number(scrim.prizePool) || totalAllocated || 0;
      const profit = entryFeeTotal - prizePoolTotal;

      if (profit > 0) {
        // platformRate/organizerRate were read from settings/site above
        // (defaults to 15% platform / 85% organizer when setting is absent or invalid).
        const orgShare = Math.round(profit * organizerRate);
        const nexplayShare = profit - orgShare; // remainder keeps orgShare + nexplayShare === profit

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
          platformCommissionPercent: Math.round(platformRate * 10000) / 100,
          participantCount,
          participantCountSource,
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

    const targetRef = db.collection("scrims").doc(id);
    const targetSnap = await targetRef.get();

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

    // 1. Delete participants (scrimId references)
    const [pScrimSnap, pTournSnap] = await Promise.all([
      db.collection("participants").where("scrimId", "==", id).get(),
      db.collection("participants").where("tournamentId", "==", id).get()
    ]);
    pScrimSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));
    pTournSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

    // 2. Delete credentials subcollection
    const sCreds = await db.collection("scrims").doc(id).collection("credentials").get();
    sCreds.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

    // 3. Delete results and earnings if any
    const [resultsSnap, earningsSnap] = await Promise.all([
      db.collection("results").where("tournamentId", "==", id).get(),
      db.collection("tournamentEarnings").where("tournamentId", "==", id).get()
    ]);
    resultsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));
    earningsSnap.docs.forEach(d => operations.push(batch => batch.delete(d.ref)));

    // 4. Delete document in scrims collection
    operations.push(batch => batch.delete(db.collection("scrims").doc(id)));

    await commitBatchedWrites(() => db.batch(), operations);
    return res.json({ success: true, message: "Scrim deleted successfully" });
  } catch (error: any) {
    console.error("Delete scrim error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to delete scrim" });
  }
});

export default router;
