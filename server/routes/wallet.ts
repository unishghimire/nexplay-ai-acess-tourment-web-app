import { Router } from "express";
import { createHash } from "crypto";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { applyExpWithSeasonCheck } from "../levelSystem.js";

const router = Router();

// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 



// POST /api/wallet/deposit â€” create a pending deposit request
router.post("/api/wallet/deposit",
  authenticateToken,
  rateLimit(30, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { amount, method, senderNumber, senderName, transactionCode, proofUrl } = req.body;
      const uid = req.user.userId;

      const numAmount = Number(amount);
      if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" });
      }
      if (numAmount > 100000) {
        return res.status(400).json({ success: false, message: "Amount exceeds maximum deposit limit (Rs. 100,000)" });
      }
      if (!method || typeof method !== 'string' || method.length > 100) {
        return res.status(400).json({ success: false, message: "Invalid payment method" });
      }
      if (!senderNumber || typeof senderNumber !== 'string' || senderNumber.length > 20) {
        return res.status(400).json({ success: false, message: "Invalid sender number" });
      }
      if (!transactionCode || typeof transactionCode !== 'string' || transactionCode.length > 50) {
        return res.status(400).json({ success: false, message: "Invalid transaction code" });
      }
      let finalProofUrl = (typeof proofUrl === 'string') ? proofUrl.trim() : '';
      if (finalProofUrl && !finalProofUrl.startsWith("data:image/")) {
        try {
          const url = new URL(finalProofUrl);
          if (!['http:', 'https:'].includes(url.protocol)) finalProofUrl = '';
        } catch {
          finalProofUrl = '';
        }
      }

      // Duplicate detection: same transactionCode + amount within 24h (only if active/pending)
      const dupQuery = db.collection('transactions')
        .where('userId', '==', uid)
        .where('transactionCode', '==', transactionCode)
        .where('amount', '==', numAmount)
        .where('type', '==', 'deposit')
        .limit(1);
      const dupSnap = await dupQuery.get();
      if (!dupSnap.empty) {
        const existingTx = dupSnap.docs[0].data();
        if (existingTx.status !== 'rejected') {
          const age = Date.now() - (existingTx.timestamp?.toMillis?.() || 0);
          if (age < 24 * 60 * 60 * 1000) {
            return res.status(409).json({ success: false, message: "Duplicate transaction detected. This transaction code was already submitted." });
          }
        }
      }

      // Deposit is pending â€” balance credited when admin approves (atomic in useAdminData handleApproveTx)
      // Deterministic ID makes concurrent double-submits converge on a single doc (idempotent replay).
      const depositKey = createHash('sha1').update(`${uid}|${numAmount}|${transactionCode}`).digest('hex').slice(0, 24);
      const txRef = db.collection('transactions').doc(`${uid}_DEP_${depositKey}`);
      await txRef.set({
        id: txRef.id,
        userId: uid,
        type: 'deposit',
        amount: numAmount,
        method,
        status: 'pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        accountDetails: `Sender Name: ${typeof senderName === 'string' && senderName.trim() ? senderName.trim() : 'N/A'}\nSender Number: ${senderNumber}\nTransaction Code/Name: ${transactionCode}`,
        senderName: typeof senderName === 'string' ? senderName.trim() : '',
        transactionCode,
        proofUrl: finalProofUrl,
        refId: `DEP-${Date.now()}`,
      });

      return res.status(201).json({ success: true, message: "Deposit request submitted", transactionId: txRef.id });
    } catch (error: any) {
      console.error("Deposit submission error:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to submit deposit request" });
    }
  }
);

// POST /api/wallet/withdraw â€” create a pending withdrawal + lock funds atomically
router.post("/api/wallet/withdraw",
  authenticateToken,
  rateLimit(3, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { amount, method, accountDetails } = req.body;
      const uid = req.user.userId;

      const numAmount = Number(amount);
      if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" });
      }
      if (numAmount > 50000) {
        return res.status(400).json({ success: false, message: "Amount exceeds maximum withdrawal limit (Rs. 50,000)" });
      }
      if (!method || typeof method !== 'string' || method.length > 100) {
        return res.status(400).json({ success: false, message: "Invalid withdrawal method" });
      }
      if (!accountDetails || typeof accountDetails !== 'string' || accountDetails.length > 500) {
        return res.status(400).json({ success: false, message: "Invalid account details" });
      }

      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data() || {};
        const playerBalance = Number(userData.balance || 0);

        if (numAmount > playerBalance) {
          throw new Error("Insufficient balance");
        }

        // Idempotency: block duplicate pending withdrawals with same amount + method within 5 min
        const dupSnap = await db.collection('transactions')
          .where('userId', '==', uid)
          .where('type', '==', 'withdrawal')
          .where('amount', '==', -numAmount)
          .where('method', '==', method)
          .where('status', '==', 'pending')
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          const age = Date.now() - (dupSnap.docs[0].data().timestamp?.toMillis?.() || 0);
          if (age < 5 * 60 * 1000) throw new Error("Duplicate withdrawal request. Please wait a few minutes before trying again.");
        }

        const balanceBefore = playerBalance;
        const balanceAfter = playerBalance - numAmount;

        const txRef = db.collection('transactions').doc();
        tx.set(txRef, {
          id: txRef.id,
          userId: uid,
          type: 'withdrawal',
          amount: -numAmount,
          method,
          status: 'pending',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          accountDetails,
          refId: `WIT-${Date.now()}`,
          balanceBefore,
          balanceAfter,
        });

        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-numAmount)
        });

        return { transactionId: txRef.id, newBalance: balanceAfter };
      });

      return res.status(201).json({ success: true, message: "Withdrawal request submitted", transactionId: result.transactionId, newBalance: result.newBalance });
    } catch (error: any) {
      if (error.message === "Insufficient balance") {
        return res.status(400).json({ success: false, message: "Insufficient balance" });
      }
      if (error.message?.includes("Duplicate withdrawal")) {
        return res.status(409).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: "Failed to submit withdrawal request" });
    }
  }
);

// GET /api/wallet/transactions â€” list own transactions (paginated)
// [BUG-026] maintenance-only endpoint â€” no client callers; client uses direct Firestore reads.
router.get("/api/wallet/transactions",
  authenticateToken,
  rateLimit(30, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const uid = req.user.userId;
      const pageLimit = Math.min(Number(req.query.limit) || 20, 50);
      const lastDocId = req.query.lastDoc as string;

      let q = db.collection('transactions')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(pageLimit);

      if (lastDocId) {
        const lastDoc = await db.collection('transactions').doc(lastDocId).get();
        if (lastDoc.exists) q = q.startAfter(lastDoc);
      }

      const snap = await q.get();
      const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const hasMore = snap.size === pageLimit;

      return res.json({ success: true, transactions, hasMore });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
  }
);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TOURNAMENT ENTRY FEE â€” server-side atomic deduction
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// POST /api/wallet/join-tournament â€” atomic entry fee deduction + participant create + ledger
router.post("/api/wallet/join-tournament",
  authenticateToken,
  rateLimit(10, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { tournamentId, slotNumber, teammates, teammateUids, teamId, teamName, teamLogo, selectedPlayers, captainUid } = req.body;
      const uid = req.user.userId;

      if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.length > 128) {
        return res.status(400).json({ success: false, message: "Invalid tournament ID" });
      }
      const trimmedCaptainUid = typeof captainUid === 'string' ? captainUid.trim() : '';
      if (captainUid !== undefined && typeof captainUid !== 'string') {
        return res.status(400).json({ success: false, message: "Invalid captain UID" });
      }
      if (trimmedCaptainUid.length > 128) {
        return res.status(400).json({ success: false, message: "Invalid captain UID" });
      }

      // Deterministic participant doc ID for atomic duplicate check
      // ponytail: underscore separator is safe — Firebase Auth UIDs and Firestore auto-generated doc IDs are alphanumeric-only (no underscores). Ceiling: manually-created tournament doc IDs with underscores could theoretically collide. Upgrade: use '::' separator if user-created IDs are ever allowed.
      const partRef = db.collection('participants').doc(`${tournamentId}_${uid}`);

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
        const cRef = trimmedCaptainUid ? db.collection('users').doc(trimmedCaptainUid) : null;
        const [tDoc, uDoc, partDoc, captainDoc] = await Promise.all([
          tx.get(tRef),
          tx.get(uRef),
          tx.get(partRef),
          cRef ? tx.get(cRef) : Promise.resolve(null),
        ]);

        let targetRef = tRef;
        let actualTDoc = tDoc;
        if (!actualTDoc.exists) {
          const sRef = db.collection('scrims').doc(tournamentId);
          const sDoc = await tx.get(sRef);
          if (sDoc.exists) {
            targetRef = sRef;
            actualTDoc = sDoc;
          } else {
            throw new Error("Tournament does not exist");
          }
        }

        if (!uDoc.exists) throw new Error("User not found");
        if (partDoc.exists) throw new Error("Already registered for this event");

        const tData = actualTDoc.data()!;
        const uData = uDoc.data()!;
        const isScrim = Boolean(tData.isScrim === true || tData.matchType === 'scrims' || targetRef.path.startsWith('scrims/'));

        if (!['upcoming', 'published', 'live', 'open', 'active'].includes(tData.status)) throw new Error("Registration is not open for this event");
        
        // Validate teammate count matches tournament team type
        const rawTeamType = tData.teamType || tData.format || (tData.requirements && tData.requirements.teamSize === 2 ? 'duo' : tData.requirements && tData.requirements.teamSize > 2 ? 'squad' : 'solo');
        const teamType = typeof rawTeamType === 'string' ? rawTeamType.toLowerCase() : 'solo';
        const isTeamEvent = teamType === 'duo' || teamType === 'squad';
        const teammateArr = Array.isArray(teammates) ? teammates : [];
        if (teamType === 'duo' && teammateArr.length !== 1) {
          throw new Error("Duo tournaments require exactly 1 teammate");
        }
        if (teamType === 'squad' && teammateArr.length !== 3) {
          throw new Error("Squad tournaments require exactly 3 teammates");
        }

        // SCRIM ENGINE: a genuine, database-verified captain UID is required to reserve a slot
        if (isScrim) {
          if (!trimmedCaptainUid) {
            throw new Error("Captain's Webapp UID is required to reserve a scrim slot.");
          }
          if (!captainDoc || !captainDoc.exists) {
            throw new Error("Captain UID not found. The slot can only be reserved with a real NexPlay account UID.");
          }
        }

        const effectiveTeamId = teamId || uData.teamId || uid;
        const teamRef = (isTeamEvent && effectiveTeamId && effectiveTeamId !== uid)
          ? db.collection('teams').doc(effectiveTeamId)
          : null;

        const validTeammateUids: string[] = (isTeamEvent && Array.isArray(teammateUids))
          ? (teammateUids as any[]).filter(tid => typeof tid === 'string' && tid.trim() && tid !== uid).slice(0, 4)
          : [];

        const [teamDoc, ...teammateDocs] = await Promise.all([
          teamRef ? tx.get(teamRef) : Promise.resolve(null),
          ...validTeammateUids.map(tid => tx.get(db.collection('users').doc(tid)))
        ]);

        const effectiveEntryFee = Math.max(
          0,
          Math.round(Number(tData.entryFee ?? tData.requirements?.entryFee ?? tData.fee ?? 0))
        );

        // Registration Protection:
        // Free Tournaments with cash prize (entryFee === 0 && prizePool > 0): Host must secure prize funds in escrow before opening.
        const prizePool = Math.max(0, Math.round(Number(tData.prizePool || 0)));
        const isExplicitlyPending = tData.status === 'pending_funding' || tData.fundingStatus === 'PENDING_FUNDING';
        const isUnfundedFreePrize = prizePool > 0 && effectiveEntryFee === 0 && tData.fundingStatus !== 'RESERVED';

        if (isExplicitlyPending || isUnfundedFreePrize) {
          throw new Error("Tournament is currently awaiting organizer funding. Registration will open once funding is secured.");
        }

        const totalSlotsCount = typeof tData.totalSlots === 'number' && !isNaN(tData.totalSlots) && tData.totalSlots > 0
          ? tData.totalSlots
          : typeof tData.slots === 'number' && !isNaN(tData.slots) && tData.slots > 0
          ? tData.slots
          : Array.isArray(tData.slots)
          ? tData.slots.length
          : 0;

        if (totalSlotsCount > 0 && (tData.currentPlayers || 0) >= totalSlotsCount) throw new Error("Tournament is full");
        if (uData.balance < effectiveEntryFee) throw new Error("Insufficient balance");

        const entryFee = effectiveEntryFee;
        const balanceBefore = uData.balance;
        const balanceAfter = balanceBefore - entryFee;
        const userExpUpdate = applyExpWithSeasonCheck(uData, 50);

        const effectiveTeamName = teamName || uData.teamName || (isTeamEvent ? (uData.username ? `${uData.username}'s Team` : 'Registered Team') : (uData.username || 'Registered Player'));
        const effectiveTeamLogo = (typeof teamLogo === 'string' && teamLogo.trim()) ? teamLogo.trim() : (uData.teamLogo || null);

        // Build or normalize slots array
        const formatTotalSlots = totalSlotsCount > 0 ? totalSlotsCount : (tData.format === 'Solo' ? 48 : tData.format === 'Duo' ? 25 : 12);
        const resolvedTotalSlots = totalSlotsCount > 0 ? totalSlotsCount : formatTotalSlots;

        let currentSlots: any[] = [];
        if (Array.isArray(tData.slots) && tData.slots.length > 0) {
          currentSlots = tData.slots.map((s: any, idx: number) => {
            const isFilled = s.status === 'filled' || s.status === 'reserved' || s.status === 'booked' || Boolean(s.userId) || Boolean(s.reservedBy) || Boolean(s.captainUid);
            return {
              slotNumber: typeof s.slotNumber === 'number' ? s.slotNumber : idx + 1,
              status: isFilled ? 'filled' : 'open',
              teamName: s.teamName || null,
              teamId: s.teamId || null,
              teamLogo: s.teamLogo || s.logoUrl || null,
              userId: s.userId || s.captainUid || s.reservedBy || null,
              captainUid: s.captainUid || s.userId || s.reservedBy || null,
              reservedBy: s.reservedBy || s.userId || s.captainUid || null,
              inGameId: s.inGameId || null,
              inGameName: s.inGameName || null,
              joinedAt: s.joinedAt || null,
            };
          });
        } else {
          currentSlots = Array.from({ length: resolvedTotalSlots }, (_, i) => ({
            slotNumber: i + 1,
            status: 'open',
            teamName: null,
            teamId: null,
            userId: null,
            captainUid: null,
            reservedBy: null,
            inGameId: null,
            inGameName: null,
            joinedAt: null,
          }));
        }

        let assignedSlotIdx = -1;
        const requestedSlotNum = Number(slotNumber);

        // If user requested a specific valid slot number
        if (Number.isInteger(requestedSlotNum) && requestedSlotNum >= 1 && requestedSlotNum <= currentSlots.length) {
          const targetIdx = currentSlots.findIndex((s: any) => s.slotNumber === requestedSlotNum);
          if (targetIdx !== -1 && currentSlots[targetIdx].status === 'open') {
            assignedSlotIdx = targetIdx;
          } else if (targetIdx !== -1 && currentSlots[targetIdx].status === 'filled') {
            throw new Error(`Slot #${requestedSlotNum} is already taken. Please choose another slot.`);
          }
        }

        // Auto-assign first available slot
        if (assignedSlotIdx === -1) {
          assignedSlotIdx = currentSlots.findIndex((s: any) => s.status === 'open');
        }

        if (assignedSlotIdx === -1) {
          throw new Error("Tournament is full");
        }

        const assignedSlotNumber = currentSlots[assignedSlotIdx].slotNumber || (assignedSlotIdx + 1);

        const validatedCaptainUid = isScrim ? trimmedCaptainUid : uid;
        const captainData = (isScrim && captainDoc && captainDoc.exists ? captainDoc.data() : null) || {};
        currentSlots[assignedSlotIdx] = {
          slotNumber: assignedSlotNumber,
          status: 'filled',
          teamName: effectiveTeamName,
          teamId: effectiveTeamId,
          teamLogo: effectiveTeamLogo,
          userId: uid,
          captainUid: validatedCaptainUid,
          captainName: captainData.username || captainData.inGameName || uData.username || null,
          reservedBy: uid,
          inGameId: uData.inGameId || '',
          inGameName: uData.inGameName || '',
          joinedAt: new Date().toISOString(),
        };

        const filledCount = currentSlots.filter((s: any) => s.status === 'filled').length;
        const tournamentUpdates: any = {
          slots: currentSlots,
          filledSlots: filledCount,
          currentPlayers: filledCount,
        };

        if (resolvedTotalSlots > 0 && filledCount >= resolvedTotalSlots) {
          tournamentUpdates.status = 'full';
        }

        if (entryFee > 0) {
          tournamentUpdates.collectedEntryFees = admin.firestore.FieldValue.increment(entryFee);
          tournamentUpdates.lockedMoney = admin.firestore.FieldValue.increment(entryFee);
          tournamentUpdates.escrowBalance = admin.firestore.FieldValue.increment(entryFee);
        }

        // 2. ALL WRITES AFTER (No tx.get calls allowed past this point)
        const userUpdates: any = {
          balance: balanceAfter,
          xp: userExpUpdate.newXP,
          level: userExpUpdate.newLevel,
          seasonId: userExpUpdate.seasonId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (userExpUpdate.previousSeasonStats) {
          userUpdates.previousSeasonStats = userExpUpdate.previousSeasonStats;
        }
        tx.update(uRef, userUpdates);

        tx.set(db.collection('users_public').doc(uid), {
          xp: userExpUpdate.newXP,
          level: userExpUpdate.newLevel,
          seasonId: userExpUpdate.seasonId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Award +70 EXP to Team in Duo/Squad
        if (teamRef && teamDoc && teamDoc.exists) {
          const teamData = teamDoc.data()!;
          const teamExpUpdate = applyExpWithSeasonCheck(teamData, 70);
          const teamUpdates: any = {
            xp: teamExpUpdate.newXP,
            level: teamExpUpdate.newLevel,
            seasonId: teamExpUpdate.seasonId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          if (teamExpUpdate.previousSeasonStats) {
            teamUpdates.previousSeasonStats = teamExpUpdate.previousSeasonStats;
          }
          tx.update(teamRef, teamUpdates);
        }

        // Award +50 EXP to all participating roster teammates in Duo/Squad
        for (let i = 0; i < validTeammateUids.length; i++) {
          const tmSnap = teammateDocs[i];
          if (tmSnap && tmSnap.exists) {
            const tmId = validTeammateUids[i];
            const tmData = tmSnap.data()!;
            const tmExpUpdate = applyExpWithSeasonCheck(tmData, 50);
            const tmUpdates: any = {
              xp: tmExpUpdate.newXP,
              level: tmExpUpdate.newLevel,
              seasonId: tmExpUpdate.seasonId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (tmExpUpdate.previousSeasonStats) {
              tmUpdates.previousSeasonStats = tmExpUpdate.previousSeasonStats;
            }
            tx.update(db.collection('users').doc(tmId), tmUpdates);
            tx.set(db.collection('users_public').doc(tmId), {
              xp: tmExpUpdate.newXP,
              level: tmExpUpdate.newLevel,
              seasonId: tmExpUpdate.seasonId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }
        }

        tx.update(targetRef, tournamentUpdates);

        const participantData: any = {
          userId: uid,
          tournamentId,
          slotNumber: assignedSlotNumber,
          inGameId: uData.inGameId || '',
          inGameName: uData.inGameName || '',
          teamName: effectiveTeamName,
          teamId: effectiveTeamId,
          teamLogo: effectiveTeamLogo,
          username: uData.username || '',
          logoUrl: effectiveTeamLogo || uData.profilePicUrl || '',
          status: tData.registrationType === 'manual' ? 'pending' : 'approved',
          entryFeePaid: entryFee,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        if (Array.isArray(teammates) && teammates.length > 0) {
          participantData.teammates = teammates.slice(0, 4);
        }
        if (validTeammateUids.length > 0) {
          participantData.teammateUids = validTeammateUids;
        }
        if (isScrim) {
          participantData.captainUid = validatedCaptainUid;
        }
        if (Array.isArray(selectedPlayers) && selectedPlayers.length > 0) {
          participantData.selectedPlayers = selectedPlayers.slice(0, 5);
        } else {
          participantData.selectedPlayers = [uData.inGameName || uData.username, ...(teammates || [])];
        }
        tx.set(partRef, participantData);

        if (entryFee > 0) {
          const fundingRef = db.collection('tournament_funding').doc(tournamentId);
          tx.set(fundingRef, {
            tournamentId,
            organizationId: tData.hostUid || tData.orgId || '',
            collectedEntryFees: admin.firestore.FieldValue.increment(entryFee),
            lockedEntryFees: admin.firestore.FieldValue.increment(entryFee),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          const hostId = tData.hostUid || tData.orgId || tData.hostId;
          if (hostId) {
            const hostRef = db.collection('users').doc(hostId);
            tx.set(hostRef, {
              orgTournamentsLockedBalance: admin.firestore.FieldValue.increment(entryFee),
              orgPendingEarnings: admin.firestore.FieldValue.increment(entryFee),
            }, { merge: true });
          }

          const txRef = db.collection('transactions').doc();
          tx.set(txRef, {
            userId: uid,
            username: uData.username || '',
            type: 'entry_fee',
            amount: entryFee,
            method: 'Tournament Entry',
            refId: `ENTRY-${tournamentId.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            desc: `Entry fee for ${tData.title}`,
            tournamentId,
            balanceBefore,
            balanceAfter,
          });
        }

        return { 
          newBalance: balanceAfter,
          slotNumber: assignedSlotNumber,
          participantId: partRef.id 
        };
      });

      return res.status(200).json({
        success: true,
        message: `Joined tournament successfully in Slot #${result.slotNumber}`,
        slotNumber: result.slotNumber,
        newBalance: result.newBalance
      });
    } catch (error: any) {
      const msg = error.message || "Failed to join tournament";
      const code = ["Insufficient balance", "Tournament is full", "Already registered", "Captain UID", "Captain's Webapp UID"].some(m => msg.includes(m)) || msg.includes("Slot") ? 400 : 500;
      return res.status(code).json({ success: false, message: msg });
    }
  }
);

// POST /api/wallet/leave-tournament â€” atomic refund + participant delete + ledger
router.post("/api/wallet/leave-tournament",
  authenticateToken,
  rateLimit(10, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { tournamentId } = req.body;
      const uid = req.user.userId;

      if (!tournamentId || typeof tournamentId !== 'string') {
        return res.status(400).json({ success: false, message: "Invalid tournament ID" });
      }

      // Deterministic participant doc ID â€” matches join-tournament
      const partRef = db.collection('participants').doc(`${tournamentId}_${uid}`);

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
        const [tDoc, uDoc, partDoc] = await Promise.all([
          tx.get(tRef),
          tx.get(uRef),
          tx.get(partRef),
        ]);

        let targetRef = tRef;
        let actualTDoc = tDoc;
        if (!actualTDoc.exists) {
          const sRef = db.collection('scrims').doc(tournamentId);
          const sDoc = await tx.get(sRef);
          if (sDoc.exists) {
            targetRef = sRef;
            actualTDoc = sDoc;
          } else {
            throw new Error("Tournament does not exist");
          }
        }

        if (!uDoc.exists) throw new Error("User not found");
        if (!partDoc.exists) throw new Error("Not registered for this event");

        const tData = actualTDoc.data()!;
        const uData = uDoc.data()!;

        if (partDoc.data().status === 'refunded') throw new Error("Already refunded");
        if (['live', 'paused', 'completed', 'cancelled'].includes(tData.status)) throw new Error("Cannot leave a tournament that has already started");
        const partData = partDoc.data();
        const refundAmount = Math.max(
          0,
          Number(
            partData?.entryFeePaid ??
            tData.entryFee ??
            tData.requirements?.entryFee ??
            tData.fee ??
            0
          )
        );
        const balanceBefore = uData.balance;
        const balanceAfter = balanceBefore + refundAmount;

        const tournamentUpdates: any = {
          currentPlayers: Math.max(0, (tData.currentPlayers || 0) - 1),
        };

        if (refundAmount > 0) {
          tournamentUpdates.collectedEntryFees = admin.firestore.FieldValue.increment(-refundAmount);
          tournamentUpdates.lockedMoney = admin.firestore.FieldValue.increment(-refundAmount);
          tournamentUpdates.escrowBalance = admin.firestore.FieldValue.increment(-refundAmount);
        }

        if (Array.isArray(tData.slots) && tData.slots.length > 0) {
          const mySlotNum = partDoc.data()?.slotNumber;
          const slotIdx = tData.slots.findIndex((s: any) => 
            (mySlotNum && s.slotNumber === mySlotNum) ||
            s.userId === uid ||
            s.captainUid === uid ||
            s.reservedBy === uid ||
            s.teamId === uid ||
            (uData.teamId && s.teamId === uData.teamId)
          );
          if (slotIdx !== -1) {
            const updatedSlots = [...tData.slots];
            updatedSlots[slotIdx] = {
              slotNumber: updatedSlots[slotIdx].slotNumber || (slotIdx + 1),
              status: 'open',
              teamName: null,
              teamId: null,
              userId: null,
              captainUid: null,
              reservedBy: null,
              inGameId: null,
              inGameName: null,
              joinedAt: null,
            };
            tournamentUpdates.slots = updatedSlots;
            const remainingFilled = updatedSlots.filter((s: any) => s.status === 'filled').length;
            tournamentUpdates.filledSlots = remainingFilled;
            tournamentUpdates.currentPlayers = remainingFilled;
            if (tData.status === 'full') {
              tournamentUpdates.status = 'upcoming';
            }
          }
        }

        // 2. ALL WRITES AFTER (No tx.get calls allowed past this point)
        tx.update(uRef, { balance: balanceAfter });
        tx.update(targetRef, tournamentUpdates);
        tx.delete(partRef);

        if (refundAmount > 0) {
          const fundingRef = db.collection('tournament_funding').doc(tournamentId);
          tx.set(fundingRef, {
            collectedEntryFees: admin.firestore.FieldValue.increment(-refundAmount),
            lockedEntryFees: admin.firestore.FieldValue.increment(-refundAmount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          const hostId = tData.hostUid || tData.orgId || tData.hostId;
          if (hostId) {
            const hostRef = db.collection('users').doc(hostId);
            tx.set(hostRef, {
              orgTournamentsLockedBalance: admin.firestore.FieldValue.increment(-refundAmount),
              orgPendingEarnings: admin.firestore.FieldValue.increment(-refundAmount),
            }, { merge: true });
          }

          const txRef = db.collection('transactions').doc();
          tx.set(txRef, {
            userId: uid,
            username: uData.username || '',
            type: 'refund',
            amount: refundAmount,
            method: 'Tournament Refund',
            refId: `RFD-${tournamentId.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            desc: `Refund for leaving ${tData.title}`,
            tournamentId,
            balanceBefore,
            balanceAfter,
          });
        }

        return { newBalance: balanceAfter };
      });

      return res.status(200).json({
        success: true,
        message: "Left tournament successfully",
        newBalance: result.newBalance
      });
    } catch (error: any) {
      const msg = error.message || "Failed to leave tournament";
      const code = ["Not registered", "Already refunded"].includes(msg) ? 400 : 500;
      return res.status(code).json({ success: false, message: msg });
    }
  }
);


// POST /api/wallet/redeem-promo â€” atomic promo code redemption
router.post("/api/wallet/redeem-promo",
  authenticateToken,
  rateLimit(5, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { code } = req.body;
      const uid = req.user.userId;

      if (!code || typeof code !== 'string' || code.length > 50) {
        return res.status(400).json({ success: false, message: "Invalid promo code" });
      }
      const upperCode = code.toUpperCase().trim();

      const result = await db.runTransaction(async (tx) => {
        const uRef = db.collection('users').doc(uid);

        // Find promo code (untracked query for lookup, then tracked read for atomicity)
        const promoSnap = await db.collection('promocodes')
          .where('code', '==', upperCode)
          .limit(1)
          .get();
        if (promoSnap.empty) throw new Error("Invalid promo code");
        const promoRef = promoSnap.docs[0].ref;
        // Tracked read â€” ensures promo state is locked for the transaction
        const promoDoc = await tx.get(promoRef);
        if (!promoDoc.exists) throw new Error("Invalid promo code");
        const promoData = promoDoc.data()!;

        if (!promoData.isActive) throw new Error("This promo code is no longer active");
        if ((promoData.currentUses || 0) >= (promoData.maxUses || 0)) throw new Error("Promo code has reached maximum uses");

        // Idempotency: deterministic transaction doc ID prevents duplicate redemption
        // Two concurrent requests will conflict on this doc, and the retry will see it exists
        // ponytail: deterministic doc ID â€” same (uid, promoCode) always collides for duplicate prevention. Underscore separator safe for Firebase Auth UIDs (alphanumeric-only). Promo codes are uppercased and may contain underscores, but the _PROMO_ marker disambiguates.
        const promoTxRef = db.collection('transactions').doc(`${uid}_PROMO_${upperCode}`);
        const existingTx = await tx.get(promoTxRef);
        if (existingTx.exists) throw new Error("You have already used this promo code");

        const uDoc = await tx.get(uRef);
        if (!uDoc.exists) throw new Error("User not found");
        const uData = uDoc.data()!;

        const balanceBefore = uData.balance || 0;
        const balanceAfter = balanceBefore + promoData.amount;

        tx.update(uRef, { balance: admin.firestore.FieldValue.increment(promoData.amount) });
        tx.update(promoRef, { currentUses: admin.firestore.FieldValue.increment(1) });

        tx.set(promoTxRef, {
          userId: uid,
          username: uData.username || 'Unknown',
          type: 'promo',
          amount: promoData.amount,
          method: `PROMO:${upperCode}`,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          accountDetails: 'Promo Code Redemption',
          refId: `PRM-${Date.now()}`,
          balanceBefore,
          balanceAfter,
        });

        return { amount: promoData.amount, newBalance: balanceAfter };
      });

      return res.status(200).json({
        success: true,
        message: `Successfully redeemed ${result.amount}`,
        newBalance: result.newBalance
      });
    } catch (error: any) {
      const msg = error.message || "Failed to redeem promo code";
      const code = ["Invalid promo code", "already used", "no longer active", "maximum uses"].some(s => msg.includes(s)) ? 400 : 500;
      return res.status(code).json({ success: false, message: msg });
    }
  }
);

export default router;
