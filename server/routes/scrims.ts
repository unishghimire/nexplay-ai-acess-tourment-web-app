import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { applyExpWithSeasonCheck } from "../levelSystem.js";

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
// 3. POST /api/scrims/:id/join — Atomic slot reservation
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims/:id/join", authenticateToken, rateLimit(15, 60 * 1000), async (req: any, res) => {
  const { id } = req.params;
  const { slotNumber, teamId, teamName, teamLogo, captainDiscord, teammateUids } = req.body;
  const userId = req.user.userId;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const scrimRef = db.collection("scrims").doc(id);
      const userRef = db.collection("users").doc(userId);
      const teamRef = (teamId && typeof teamId === 'string' && teamId.trim())
        ? db.collection("teams").doc(teamId.trim())
        : null;

      const validTeammateUids: string[] = Array.isArray(teammateUids)
        ? (teammateUids as any[]).filter(tid => typeof tid === 'string' && tid.trim() && tid !== userId).slice(0, 4)
        : [];

      // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
      const [scrimSnap, userSnap, teamSnap, ...teammateSnaps] = await Promise.all([
        transaction.get(scrimRef),
        transaction.get(userRef),
        teamRef ? transaction.get(teamRef) : Promise.resolve(null),
        ...validTeammateUids.map(tid => transaction.get(db.collection("users").doc(tid)))
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
      // Award +50 EXP to registering user
      const userExpUpdate = applyExpWithSeasonCheck(userSnap.data() || {}, 50);
      const userUpdates: any = {
        xp: userExpUpdate.newXP,
        level: userExpUpdate.newLevel,
        seasonId: userExpUpdate.seasonId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (userExpUpdate.previousSeasonStats) {
        userUpdates.previousSeasonStats = userExpUpdate.previousSeasonStats;
      }
      if (entryFee > 0) {
        userUpdates.balance = admin.firestore.FieldValue.increment(-entryFee);
      }
      transaction.update(userRef, userUpdates);

      transaction.set(db.collection("users_public").doc(userId), {
        xp: userExpUpdate.newXP,
        level: userExpUpdate.newLevel,
        seasonId: userExpUpdate.seasonId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Award +70 EXP to Team if team is registered
      if (teamRef && teamSnap && teamSnap.exists) {
        const teamData = teamSnap.data()!;
        const teamExpUpdate = applyExpWithSeasonCheck(teamData, 70);
        const teamUpdates: any = {
          xp: teamExpUpdate.newXP,
          level: teamExpUpdate.newLevel,
          seasonId: teamExpUpdate.seasonId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (teamExpUpdate.previousSeasonStats) {
          teamUpdates.previousSeasonStats = teamExpUpdate.previousSeasonStats;
        }
        transaction.update(teamRef, teamUpdates);
      }

      // Award +50 EXP to all participating roster teammates
      for (let i = 0; i < validTeammateUids.length; i++) {
        const tmSnap = teammateSnaps[i];
        if (tmSnap && tmSnap.exists) {
          const tmId = validTeammateUids[i];
          const tmData = tmSnap.data()!;
          const tmExpUpdate = applyExpWithSeasonCheck(tmData, 50);
          const tmUpdates: any = {
            xp: tmExpUpdate.newXP,
            level: tmExpUpdate.newLevel,
            seasonId: tmExpUpdate.seasonId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          if (tmExpUpdate.previousSeasonStats) {
            tmUpdates.previousSeasonStats = tmExpUpdate.previousSeasonStats;
          }
          transaction.update(db.collection("users").doc(tmId), tmUpdates);
          transaction.set(db.collection("users_public").doc(tmId), {
            xp: tmExpUpdate.newXP,
            level: tmExpUpdate.newLevel,
            seasonId: tmExpUpdate.seasonId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }

      if (entryFee > 0) {
        const txRef = db.collection("transactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: "scrim_entry",
          amount: entryFee,
          scrimId: id,
          status: "completed",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          refId: `SCRIM-${id.slice(0, 8)}-${targetSlot}`,
          desc: `Entry fee for ${scrim.title || 'Scrim'} (Slot #${targetSlot})`,
        });

        const scrimHostId = scrim.hostUid || scrim.orgId || scrim.hostId || scrim.userId;
        if (scrimHostId) {
          const hostRef = db.collection("users").doc(scrimHostId);
          transaction.set(hostRef, {
            orgTournamentsLockedBalance: admin.firestore.FieldValue.increment(entryFee),
            orgPendingEarnings: admin.firestore.FieldValue.increment(entryFee),
          }, { merge: true });
        }

        const fundingRef = db.collection("tournament_funding").doc(id);
        transaction.set(fundingRef, {
          tournamentId: id,
          scrimId: id,
          organizationId: scrimHostId || '',
          collectedEntryFees: admin.firestore.FieldValue.increment(entryFee),
          lockedEntryFees: admin.firestore.FieldValue.increment(entryFee),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // Register participant record
      const partRef = db.collection("participants").doc(`${id}_${userId}`);
      const partData: any = {
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
      };
      if (validTeammateUids.length > 0) {
        partData.teammateUids = validTeammateUids;
      }
      transaction.set(partRef, partData);

      const scrimUpdates: any = {
        slots,
        filledSlots,
        currentPlayers: filledSlots,
        status: isNowFull ? "full" : "open",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (entryFee > 0) {
        scrimUpdates.collectedEntryFees = admin.firestore.FieldValue.increment(entryFee);
        scrimUpdates.lockedMoney = admin.firestore.FieldValue.increment(entryFee);
      }

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

      const scrimUpdates: any = {
        slots,
        filledSlots: 0,
        currentPlayers: 0,
        status: "open",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

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
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          refId: `SCRIM-RFD-${id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
          desc: `Refund for leaving ${scrim.title || 'Scrim'}`,
        });

        scrimUpdates.collectedEntryFees = admin.firestore.FieldValue.increment(-entryFee);
        scrimUpdates.lockedMoney = admin.firestore.FieldValue.increment(-entryFee);

        const scrimHostId = scrim.hostUid || scrim.orgId || scrim.hostId || scrim.userId;
        if (scrimHostId) {
          const hostRef = db.collection("users").doc(scrimHostId);
          transaction.set(hostRef, {
            orgTournamentsLockedBalance: admin.firestore.FieldValue.increment(-entryFee),
            orgPendingEarnings: admin.firestore.FieldValue.increment(-entryFee),
          }, { merge: true });
        }

        const fundingRef = db.collection("tournament_funding").doc(id);
        transaction.set(fundingRef, {
          collectedEntryFees: admin.firestore.FieldValue.increment(-entryFee),
          lockedEntryFees: admin.firestore.FieldValue.increment(-entryFee),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
      scrimUpdates.slots = slots;
      scrimUpdates.filledSlots = filledSlots;
      scrimUpdates.currentPlayers = filledSlots;

      transaction.update(scrimRef, scrimUpdates);

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

export default router;

