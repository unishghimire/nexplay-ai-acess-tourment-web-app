import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { applyExpWithSeasonCheck } from "../levelSystem.js";
import { validatePrizeWinners } from "../prizeValidation.js";
import {
  clampBudgetToLedger,
  clampToBudget,
  payoutRefId,
  resolvePayouts,
  resolveScrimBudget,
  type PerKillConfigInput,
} from "../scrimSettlement.js";

const router = Router();

// Slot counts based on format: Squad=12, Duo=25, Solo=48
export function getScrimFormatSlots(format?: string | null): number {
  if (format === 'Solo') return 48;
  if (format === 'Duo') return 25;
  return 12; // Squad & default
}

// Players per registered slot: Solo=1, Duo=2, Squad=4 (requirements.teamSize wins).
export function getScrimRosterLimit(format?: string | null, teamSize?: unknown): number {
  const explicit = Math.floor(Number(teamSize));
  if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 5) return explicit;
  if (format === 'Solo') return 1;
  if (format === 'Duo') return 2;
  return 4;
}

// SCR-021: scrims have historically stored the fee in three different places.
// The tournament path (wallet.ts) already resolves all of them; the scrim path read
// only root entryFee, so a scrim authored with requirements.entryFee was joinable free.
export function resolveScrimEntryFee(scrim: any): number {
  const raw = scrim?.entryFee ?? scrim?.requirements?.entryFee ?? scrim?.fee ?? 0;
  const amount = Math.round(Number(raw));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

const SCRIM_ID_PATTERN = /^[a-zA-Z0-9_\-]{1,128}$/;

function isValidScrimId(id: unknown): id is string {
  return typeof id === 'string' && SCRIM_ID_PATTERN.test(id);
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

  if (!isValidScrimId(id)) {
    return res.status(400).json({ success: false, message: "Invalid scrim ID" });
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      const scrimRef = db.collection("scrims").doc(id);
      const userRef = db.collection("users").doc(userId);
      const cleanTeamId = (teamId && typeof teamId === 'string' && teamId.trim()) ? teamId.trim() : null;
      const teamRef = cleanTeamId ? db.collection("teams").doc(cleanTeamId) : null;

      const requestedTeammateUids: string[] = Array.isArray(teammateUids)
        ? (teammateUids as any[]).filter(tid => typeof tid === 'string' && tid.trim() && tid !== userId)
        : [];

      // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
      const [scrimSnap, userSnap, teamSnap, memberSnap] = await Promise.all([
        transaction.get(scrimRef),
        transaction.get(userRef),
        teamRef ? transaction.get(teamRef) : Promise.resolve(null),
        // SCR-023/024: team roster is verified server-side. teamId and teammateUids are
        // client-supplied, so without this a caller could attach any team to their slot
        // and grant EXP to arbitrary unrelated accounts.
        cleanTeamId
          ? transaction.get(db.collection("team_members").where("teamId", "==", cleanTeamId))
          : Promise.resolve(null)
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
      const alreadyJoined = slots.some((s: any) => s.captainUid === userId || (cleanTeamId && s.teamId === cleanTeamId));
      if (alreadyJoined) {
        throw new Error("You or your team are already registered in this scrim.");
      }

      const rosterLimit = getScrimRosterLimit(scrim.format, scrim.requirements?.teamSize);
      if (requestedTeammateUids.length > rosterLimit - 1) {
        throw new Error(`This scrim allows at most ${rosterLimit - 1} teammate(s) per slot.`);
      }

      const teamMemberUids: string[] = memberSnap
        ? memberSnap.docs.map((d: any) => d.data()?.userId).filter((uid: any) => typeof uid === 'string')
        : [];
      const isTeamMember = Boolean(cleanTeamId) && teamMemberUids.includes(userId);
      const verifiedTeamId = cleanTeamId && isTeamMember ? cleanTeamId : null;
      const validTeammateUids: string[] = verifiedTeamId
        ? requestedTeammateUids.filter(tid => teamMemberUids.includes(tid)).slice(0, rosterLimit - 1)
        : [];

      // SCR-027: server-side eligibility. These requirements are published on the
      // scrim doc and shown to players, but nothing ever enforced them.
      const userData: any = userSnap.exists ? userSnap.data() || {} : {};
      const requirements = scrim.requirements || {};
      const levelRequired = Math.floor(Number(requirements.levelRequired ?? scrim.levelRequired ?? 0));
      if (Number.isFinite(levelRequired) && levelRequired > 0) {
        const playerLevel = Math.floor(Number(userData.level ?? 0)) || 0;
        if (playerLevel < levelRequired) {
          throw new Error(`This scrim requires player level ${levelRequired}. Your level is ${playerLevel}.`);
        }
      }
      if (requirements.discordRequired && !(typeof userData.discord === 'string' && userData.discord.trim())) {
        throw new Error("This scrim requires a Discord tag on your profile. Add one and try again.");
      }

      const entryFee = resolveScrimEntryFee(scrim);
      if (entryFee > 0) {
        if (!userSnap.exists) throw new Error("User profile not found. Complete your profile to register.");
        const userBalance = Number(userData.balance) || 0;
        if (userBalance < entryFee) {
          throw new Error(`Insufficient wallet balance (Required: NPR ${entryFee}, Available: NPR ${userBalance}).`);
        }
      }

      // Update slot reservation. chargedFee is frozen here so the refund on leave can
      // never be influenced by an organizer editing entryFee afterwards (SCR-022).
      slots[slotIndex] = {
        slotNumber: targetSlot,
        status: 'filled',
        teamId: verifiedTeamId,
        teamName: teamName || req.user.name || "Player",
        teamLogo: teamLogo || null,
        captainUid: userId,
        captainDiscord: captainDiscord || null,
        chargedFee: entryFee,
        joinedAt: new Date().toISOString(),
      };

      const filledSlots = slots.filter((s: any) => s.status === 'filled').length;
      const isNowFull = filledSlots >= totalSlots;

      // Remaining reads must still precede every write.
      const scrimHostId = typeof scrim.hostUid === 'string' && scrim.hostUid.trim()
        ? scrim.hostUid.trim()
        : (typeof scrim.orgId === 'string' && scrim.orgId.trim() ? scrim.orgId.trim()
          : (typeof scrim.hostId === 'string' && scrim.hostId.trim() ? scrim.hostId.trim()
            : (typeof scrim.userId === 'string' && scrim.userId.trim() ? scrim.userId.trim() : null)));
      const [teammateSnaps, hostSnap] = await Promise.all([
        Promise.all(validTeammateUids.map(tid => transaction.get(db.collection("users").doc(tid)))),
        scrimHostId ? transaction.get(db.collection("users").doc(scrimHostId)) : Promise.resolve(null)
      ]);

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

      // Award +70 EXP, but only to a team the caller is verifiably a member of.
      if (verifiedTeamId && teamSnap && teamSnap.exists) {
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
        transaction.update(teamRef!, teamUpdates);
      }

      // Award +50 EXP to roster teammates confirmed on the same verified team
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

        // Credit the host only when their user document actually exists; a bare merge-set
        // would otherwise create a partial users doc for a bogus hostUid.
        if (scrimHostId && hostSnap && hostSnap.exists) {
          const hostRef = db.collection("users").doc(scrimHostId);
          transaction.update(hostRef, {
            orgTournamentsLockedBalance: admin.firestore.FieldValue.increment(entryFee),
            orgPendingEarnings: admin.firestore.FieldValue.increment(entryFee),
          });
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
        teamId: verifiedTeamId,
        teamName: teamName || req.user.name || "Player",
        teamLogo: teamLogo || null,
        chargedFee: entryFee,
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

  if (!isValidScrimId(id)) {
    return res.status(400).json({ success: false, message: "Invalid scrim ID" });
  }

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
        status: "open",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // SCR-022: refund the amount actually charged, frozen on the participant/slot
      // record. Falling back to the live entryFee let an organizer edit the fee after
      // registration and have players refund more (or less) than they paid.
      const chargedFee = Number(
        (partSnap.exists ? (partSnap.data() as any)?.chargedFee : undefined)
        ?? (slotIndex !== -1 ? (slots[slotIndex] as any)?.chargedFee : undefined)
      );
      const entryFee = Number.isFinite(chargedFee) && chargedFee > 0
        ? Math.round(chargedFee)
        : resolveScrimEntryFee(scrim);

      if (entryFee > 0 && partSnap.exists) {
        const refundHostId = typeof scrim.hostUid === 'string' && scrim.hostUid.trim()
          ? scrim.hostUid.trim()
          : (typeof scrim.orgId === 'string' && scrim.orgId.trim() ? scrim.orgId.trim()
            : (typeof scrim.hostId === 'string' && scrim.hostId.trim() ? scrim.hostId.trim()
              : (typeof scrim.userId === 'string' && scrim.userId.trim() ? scrim.userId.trim() : null)));
        const refundHostSnap = refundHostId ? await transaction.get(db.collection("users").doc(refundHostId)) : null;
        transaction.update(userRef, {
          balance: admin.firestore.FieldValue.increment(entryFee),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const refundBalanceBefore = Number(userSnap.data()?.balance ?? 0);
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
          balanceBefore: refundBalanceBefore,
          balanceAfter: refundBalanceBefore + entryFee,
        });

        scrimUpdates.collectedEntryFees = admin.firestore.FieldValue.increment(-entryFee);
        scrimUpdates.lockedMoney = admin.firestore.FieldValue.increment(-entryFee);

        // SCR-023: debit the host escrow only when the host user document exists.
        // A merge-set would otherwise silently create a partial users doc.
        if (refundHostId && refundHostSnap && refundHostSnap.exists) {
          transaction.update(db.collection("users").doc(refundHostId), {
            orgTournamentsLockedBalance: admin.firestore.FieldValue.increment(-entryFee),
            orgPendingEarnings: admin.firestore.FieldValue.increment(-entryFee),
          });
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/scrims/:id/results — Finalize results + settle prizes
//    SCR-031: before this route existed, nothing in the platform ever paid a scrim
//    prize. The UI promised wallet credits on finalization while the only writer of
//    results was the organizer client itself. This is the authoritative door.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/scrims/:id/results", authenticateToken, rateLimit(10, 60 * 1000), async (req: any, res) => {
  const { id } = req.params;
  const actorId = req.user.userId;
  const actorRole = req.user.role;

  if (!isValidScrimId(id)) {
    return res.status(400).json({ success: false, message: "Invalid scrim ID" });
  }

  const body = req.body || {};
  const rawWinners = body.winners === undefined ? [] : body.winners;
  const rawKillEntries = body.killEntries === undefined ? [] : body.killEntries;
  if (!Array.isArray(rawWinners) || !Array.isArray(rawKillEntries)) {
    return res.status(400).json({ success: false, message: "winners and killEntries must be arrays" });
  }
  if (rawWinners.length === 0 && rawKillEntries.length === 0 && !Array.isArray(body.manualResults)) {
    return res.status(400).json({ success: false, message: "No results submitted" });
  }

  // Normalise before validating: callers have used both `prize` and `amount`.
  const normalizedWinners = (rawWinners as any[]).map(w => ({
    ...w,
    prize: Math.round(Number(w?.prize ?? w?.amount ?? 0))
  }));

  if (normalizedWinners.length > 0) {
    const winnersError = validatePrizeWinners(normalizedWinners);
    if (winnersError) {
      return res.status(400).json({ success: false, message: winnersError });
    }
  }

  try {
    const outcome = await db.runTransaction(async (transaction) => {
      const scrimRef = db.collection("scrims").doc(id);
      const scrimSnap = await transaction.get(scrimRef);
      if (!scrimSnap.exists) throw new Error("Scrim not found");
      const scrim = scrimSnap.data()!;

      // Host cascade mirrors isScrimHost() in firestore.rules, extended to the legacy
      // hostId/userId writers so existing scrims stay settleable by their real owner.
      const hostIds = [scrim.hostUid, scrim.orgId, scrim.hostId, scrim.userId]
        .filter((v: unknown): v is string => typeof v === 'string' && v.trim() !== '')
        .map((v: string) => v.trim());

      const isAdminActor = actorRole === 'admin';
      if (!isAdminActor && !hostIds.includes(actorId)) {
        throw new Error("ONLY_HOST_CAN_SETTLE");
      }

      if (scrim.resultsFinalized === true) {
        throw new Error("ALREADY_SETTLED");
      }

      const perKillConfig: PerKillConfigInput = {
        rewardPerKill: scrim.rewardConfig?.rewardPerKill ?? scrim.rewardPerKill ?? 0,
        minimumKillsForReward: scrim.rewardConfig?.minimumKillsForReward ?? 0,
        maximumRewardPerPlayer: scrim.rewardConfig?.maximumRewardPerPlayer ?? scrim.rewardConfig?.capPerPlayer ?? 0,
        maximumRewardPerMatch: scrim.rewardConfig?.maximumRewardPerMatch ?? 0
      };

      // 1. ALL READS FIRST
      const hostRef = hostIds.length > 0 ? db.collection("users").doc(hostIds[0]) : null;
      const [partSnap, hostSnap] = await Promise.all([
        transaction.get(db.collection("participants").where("tournamentId", "==", id)),
        hostRef ? transaction.get(hostRef) : Promise.resolve(null)
      ]);

      const registeredUids = new Set<string>();
      for (const p of partSnap.docs) {
        const d = p.data() as any;
        if (typeof d.userId === 'string' && d.userId) registeredUids.add(d.userId);
        if (Array.isArray(d.teammateUids)) {
          d.teammateUids.filter((u: any) => typeof u === 'string' && u).forEach((u: string) => registeredUids.add(u));
        }
      }
      const slots = Array.isArray(scrim.slots) ? scrim.slots as any[] : [];
      for (const s of slots) {
        if (!s) continue;
        if (typeof s.captainUid === 'string' && s.captainUid) registeredUids.add(s.captainUid);
        if (Array.isArray(s.teammateUids)) {
          s.teammateUids.filter((u: any) => typeof u === 'string' && u).forEach((u: string) => registeredUids.add(u));
        }
      }

      const { payouts, killLedger, error: resolveError } = resolvePayouts(normalizedWinners, rawKillEntries, perKillConfig);
      if (resolveError) throw new Error(resolveError);

      const unknown = payouts.filter(p => !registeredUids.has(p.userId)).map(p => p.userId);
      if (unknown.length > 0) {
        throw new Error(`Winners are not registered in this scrim: ${unknown.join(', ')}`);
      }

      const budget = resolveScrimBudget(scrim, hostSnap?.exists ? (hostSnap!.data() as any) : null);
      // R-01: the scrim-doc escrow fields are organizer-writable via rules, so the
      // entry-escrow budget is clamped a second time against the join ledger (the
      // frozen chargedFee summed over participant docs, read above).
      let ledgerCollected = 0;
      for (const p of partSnap.docs) {
        const d = p.data() as any;
        const fee = Math.round(Number(d.chargedFee ?? d.entryFeePaid ?? 0));
        if (Number.isFinite(fee) && fee > 0) ledgerCollected += fee;
      }
      const effectiveBudget = budget.source === 'entry_escrow'
        ? clampBudgetToLedger(budget.budget, ledgerCollected, budget.alreadyPaid)
        : budget.budget;
      const ordered = [...payouts].sort((a, b) => b.amount - a.amount || a.rank - b.rank);
      const { kept, dropped, total } = clampToBudget(ordered, effectiveBudget);

      const payoutIds = kept.map(p => payoutRefId(id, p.userId, p.kind, p.rank, p.refOrdinal));
      const [recipientSnaps, existingPayoutSnaps] = await Promise.all([
        Promise.all(kept.map(p => transaction.get(db.collection("users").doc(p.userId)))),
        Promise.all(payoutIds.map(refId => transaction.get(db.collection("transactions").doc(refId))))
      ]);

      // SCR-035: the deterministic payout document is the idempotency key. A retry of a
      // partially-settled scrim re-pays only the rows that were never credited.
      const payable: typeof kept = [];
      const payableSnaps: typeof recipientSnaps = [];
      const alreadySettled: typeof kept = [];
      for (let i = 0; i < kept.length; i++) {
        if (existingPayoutSnaps[i]?.exists) alreadySettled.push(kept[i]);
        else {
          payable.push(kept[i]);
          payableSnaps.push(recipientSnaps[i]);
        }
      }
      const payableTotal = payable.reduce((sum, p) => sum + p.amount, 0);

      // 2. ALL WRITES AFTER
      const storedWinners = normalizedWinners.map(w => ({ ...w, prize: Number(w.prize) || 0 }));
      // A player can hold a rank prize and a kill bounty in the same settlement; the
      // ledger has to roll forward from the running balance, not re-read the same snapshot.
      const runningBalances = new Map<string, number>();

      if (payableTotal > 0) {
        for (let i = 0; i < payable.length; i++) {
          const p = payable[i];
          const recipientRef = db.collection("users").doc(p.userId);
          const recipientSnap = payableSnaps[i];
          if (!recipientSnap?.exists) throw new Error(`Winner account missing: ${p.userId}`);
          const balanceBefore = runningBalances.has(p.userId)
            ? runningBalances.get(p.userId)!
            : Math.round(Number((recipientSnap.data() as any)?.balance ?? 0));

          runningBalances.set(p.userId, balanceBefore + p.amount);

          transaction.update(recipientRef, {
            balance: admin.firestore.FieldValue.increment(p.amount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          const refId = payoutRefId(id, p.userId, p.kind, p.rank, p.refOrdinal);
          const txRef = db.collection("transactions").doc(refId);
          transaction.set(txRef, {
            id: refId,
            userId: p.userId,
            type: "prize",
            amount: p.amount,
            scrimId: id,
            tournamentId: id,
            method: "Scrim Prize",
            status: "completed",
            rank: p.rank,
            payoutKind: p.kind,
            teamId: p.teamId,
            label: p.label,
            refId,
            settledBy: actorId,
            balanceBefore,
            balanceAfter: balanceBefore + p.amount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          const earningsRef = db.collection("tournamentEarnings").doc(refId);
          transaction.set(earningsRef, {
            id: earningsRef.id,
            scrimId: id,
            tournamentId: id,
            orgId: hostIds[0] ?? null,
            userId: p.userId,
            displayName: p.label,
            rank: p.rank,
            payoutKind: p.kind,
            amount: p.amount,
            currency: "NPR",
            status: "paid",
            refId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        if (hostRef && hostSnap && hostSnap.exists) {
          const hostData = hostSnap.data() as any;
          const hostLocked = Math.max(0, Math.round(Number(hostData.orgTournamentsLockedBalance ?? 0)));
          const hostPending = Math.max(0, Math.round(Number(hostData.orgPendingEarnings ?? 0)));
          // Clamp the mirror debit to what the host ledger actually holds so a
          // partially-drawn host account cannot go negative; the scrim doc stays
          // authoritative via payoutsReleased.
          transaction.update(hostRef, {
            orgTournamentsLockedBalance: admin.firestore.FieldValue.increment(-Math.min(payableTotal, hostLocked)),
            orgPendingEarnings: admin.firestore.FieldValue.increment(-Math.min(payableTotal, hostPending))
          });
        }

        transaction.set(db.collection("tournament_funding").doc(id), {
          tournamentId: id,
          scrimId: id,
          organizationId: hostIds[0] ?? '',
          paidOutPrizes: admin.firestore.FieldValue.increment(payableTotal),
          lockedEntryFees: admin.firestore.FieldValue.increment(budget.source === 'entry_escrow' ? -payableTotal : 0),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const scrimUpdates: any = {
        status: "completed",
        // A settlement that could not pay everything leaves the door open for the host
        // to fund the remainder and re-run; payoutsReleased keeps the budget honest.
        resultsFinalized: dropped.length === 0,
        resultsRecorded: true,
        finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        finalizedBy: actorId,
        payoutStatus: payableTotal === 0 && alreadySettled.length === 0
          ? "unpaid"
          : (dropped.length > 0 ? "partial" : "paid"),
        payoutsReleased: admin.firestore.FieldValue.increment(payableTotal),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (storedWinners.length > 0) scrimUpdates.winners = storedWinners;
      if (Array.isArray(body.manualResults)) scrimUpdates.manualResults = body.manualResults;
      if (Array.isArray(rawKillEntries) && rawKillEntries.length > 0) {
        const paidKeys = new Set(kept.map(k => `${k.kind}|${k.userId}|${k.rank}|${k.amount}`));
        scrimUpdates.killRewards = (rawKillEntries as any[]).map((entry: any, idx: number) => {
          const row = killLedger[idx];
          const wasPaid = row ? paidKeys.has(`kill|${row.userId}|${row.rank}|${row.reward}`) : false;
          return {
            ...entry,
            tournamentId: id,
            playerId: row?.userId ?? entry?.playerId,
            verifiedKills: row?.kills ?? 0,
            rewardPerKill: Number(perKillConfig.rewardPerKill) || 0,
            rewardAmount: wasPaid && row ? row.reward : 0,
            capped: row?.capped ?? false,
            killStatus: 'verified',
            rewardStatus: wasPaid ? 'paid' : 'unpaid',
            resultVersion: 1,
            verifiedBy: actorId,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
          };
        });
      }
      transaction.update(scrimRef, scrimUpdates);

      const auditRef = db.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        action: "scrim.prize_settlement",
        actorId,
        actorRole: actorRole ?? 'host',
        scrimId: id,
        entryFee: resolveScrimEntryFee(scrim),
        prizePool: Math.round(Number(scrim.prizePool || 0)),
        budgetAvailable: effectiveBudget,
        paidTotal: payableTotal,
        requestedTotal: total,
        recipients: payable.map(k => ({ userId: k.userId, rank: k.rank, amount: k.amount, kind: k.kind })),
        previouslySettled: alreadySettled.map(k => ({ userId: k.userId, rank: k.rank, amount: k.amount, kind: k.kind })),
        dropped: dropped.map(k => ({ userId: k.userId, rank: k.rank, requested: k.amount })),
        fundingSource: budget.source,
        alreadyPaid: budget.alreadyPaid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { paid: payableTotal, payable, alreadySettled, dropped, budget, effectiveBudget, requested: total };
    });

    return res.status(200).json({
      success: true,
      message: outcome.paid > 0 ? "Results finalized and prizes credited" : "Results recorded",
      amountPaid: outcome.paid,
      payouts: outcome.payable,
      previouslyPaid: outcome.alreadySettled,
      unpaid: outcome.dropped,
      budgetAvailable: outcome.effectiveBudget
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to finalize scrim results";
    if (msg === "ONLY_HOST_CAN_SETTLE") {
      return res.status(403).json({ success: false, message: "Only the scrim host or an admin can submit final results" });
    }
    if (msg === "ALREADY_SETTLED") {
      return res.status(409).json({ success: false, message: "This scrim has already been settled" });
    }
    console.error("Error finalizing scrim results:", error);
    return res.status(400).json({ success: false, message: msg });
  }
});

export default router;


