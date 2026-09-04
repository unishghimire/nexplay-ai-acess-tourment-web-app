import { Router } from "express";
import { createHash } from "crypto";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { ChunkProcessingError, commitBatchedWrites } from "../batchedWrites.js";
import { validatePrizeWinners } from "../prizeValidation.js";

const router = Router();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WALLET SECURITY
// All wallet writes go through server endpoints â€” clients cannot write
// to transactions collection directly (enforced by Firestore rules).
// Duplicate detection: same transactionCode + same amount within 24h = blocked
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Revenue split â€” mirrors src/shared/constants/finance.ts
// ponytail: duplicated because server and client are separate build targets
const REVENUE_SPLIT = { ORGANIZER: 0.85, PLATFORM: 0.15 } as const;
const CANCELLATION_PAGE_SIZE = 100;

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
        const orgBalance = Number(userData.orgWalletBalance || 0);
        const totalAvailable = playerBalance + orgBalance;

        if (numAmount > totalAvailable) {
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

        // Allocate deduction across player balance and org wallet balance
        let deductPlayer = 0;
        let deductOrg = 0;
        if (req.body.source === 'org' || (!playerBalance && orgBalance >= numAmount)) {
          deductOrg = Math.min(orgBalance, numAmount);
          deductPlayer = numAmount - deductOrg;
        } else {
          deductPlayer = Math.min(playerBalance, numAmount);
          deductOrg = numAmount - deductPlayer;
        }

        const balanceBefore = totalAvailable;
        const balanceAfter = totalAvailable - numAmount;

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
          deductPlayer,
          deductOrg,
        });

        const updates: any = {};
        if (deductPlayer > 0) {
          updates.balance = admin.firestore.FieldValue.increment(-deductPlayer);
        }
        if (deductOrg > 0) {
          updates.orgWalletBalance = admin.firestore.FieldValue.increment(-deductOrg);
        }
        tx.update(userRef, updates);

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
      const { tournamentId, slotNumber, teammates, teamId, teamName, selectedPlayers } = req.body;
      const uid = req.user.userId;

      if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.length > 128) {
        return res.status(400).json({ success: false, message: "Invalid tournament ID" });
      }

      // Deterministic participant doc ID for atomic duplicate check
      // ponytail: underscore separator is safe â€” Firebase Auth UIDs and Firestore auto-generated doc IDs are alphanumeric-only (no underscores). Ceiling: manually-created tournament doc IDs with underscores could theoretically collide. Upgrade: use '::' separator if user-created IDs are ever allowed.
      const partRef = db.collection('participants').doc(`${tournamentId}_${uid}`);

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const sRef = db.collection('scrims').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
        const [tDoc, sDoc, uDoc, partDoc] = await Promise.all([
          tx.get(tRef),
          tx.get(sRef),
          tx.get(uRef),
          tx.get(partRef),
        ]);

        if (!tDoc.exists && !sDoc.exists) throw new Error("Tournament or scrim does not exist");
        if (!uDoc.exists) throw new Error("User not found");
        if (partDoc.exists) throw new Error("Already registered for this event");

        const primaryDoc = tDoc.exists ? tDoc : sDoc;
        const targetRef = tDoc.exists ? tRef : sRef;
        const tData = primaryDoc.data()!;
        const uData = uDoc.data()!;

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
        
        const isScrim = targetRef.path.startsWith('scrims') || 
                        tData.matchType === 'scrims' || 
                        tData.isScrim === true || 
                        tData.type === 'scrim' || 
                        tData.type === 'scrims';

        const effectiveEntryFee = Math.max(
          0,
          Math.round(Number(tData.entryFee ?? tData.requirements?.entryFee ?? tData.fee ?? 0))
        );

        // Registration Protection:
        // 1. Scrims: Practice matches and daily scrim lobbies do not use the formal tournament escrow pipeline.
        // 2. Paid Tournaments with entryFee (entryFee > 0): Funded via participant entry fees as players register.
        // 3. Free Tournaments with cash prize (entryFee === 0 && prizePool > 0): Host must secure prize funds in escrow before opening.
        if (!isScrim) {
          const prizePool = Math.max(0, Math.round(Number(tData.prizePool || 0)));
          const isExplicitlyPending = tData.status === 'pending_funding' || tData.fundingStatus === 'PENDING_FUNDING';
          const isUnfundedFreePrize = prizePool > 0 && effectiveEntryFee === 0 && tData.fundingStatus !== 'RESERVED';

          if (isExplicitlyPending || isUnfundedFreePrize) {
            throw new Error("Tournament is currently awaiting organizer funding. Registration will open once funding is secured.");
          }
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
        const currentXP = uData.xp || 0;
        const newXP = currentXP + 50;
        const newLevel = Math.floor(newXP / 500) + 1;

        const effectiveTeamName = teamName || uData.teamName || (isTeamEvent ? (uData.username ? `${uData.username}'s Team` : 'Registered Team') : (uData.username || 'Registered Player'));
        const effectiveTeamId = teamId || uData.teamId || uid;

        // Build or normalize slots array
        const formatTotalSlots = isScrim 
          ? (tData.format === 'Solo' ? 48 : tData.format === 'Duo' ? 25 : 12)
          : (totalSlotsCount > 0 ? totalSlotsCount : 12);
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

        currentSlots[assignedSlotIdx] = {
          slotNumber: assignedSlotNumber,
          status: 'filled',
          teamName: effectiveTeamName,
          teamId: effectiveTeamId,
          userId: uid,
          captainUid: uid,
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

        // 2. ALL WRITES AFTER (No tx.get calls allowed past this point)
        tx.update(uRef, { balance: balanceAfter, xp: newXP, level: newLevel });
        tx.update(targetRef, tournamentUpdates);
        if (targetRef === tRef && sDoc.exists) {
          tx.update(sRef, tournamentUpdates);
        } else if (targetRef === sRef && tDoc.exists) {
          tx.update(tRef, tournamentUpdates);
        }

        const participantData: any = {
          userId: uid,
          tournamentId,
          slotNumber: assignedSlotNumber,
          inGameId: uData.inGameId || '',
          inGameName: uData.inGameName || '',
          teamName: effectiveTeamName,
          teamId: effectiveTeamId,
          username: uData.username || '',
          logoUrl: uData.profilePicUrl || '',
          status: tData.registrationType === 'manual' ? 'pending' : 'approved',
          entryFeePaid: entryFee,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        if (Array.isArray(teammates) && teammates.length > 0) {
          participantData.teammates = teammates.slice(0, 4);
        }
        if (Array.isArray(selectedPlayers) && selectedPlayers.length > 0) {
          participantData.selectedPlayers = selectedPlayers.slice(0, 5);
        } else {
          participantData.selectedPlayers = [uData.inGameName || uData.username, ...(teammates || [])];
        }
        tx.set(partRef, participantData);

        if (entryFee > 0) {
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
      const code = ["Insufficient balance", "Tournament is full", "Already registered"].some(m => msg.includes(m)) || msg.includes("Slot") ? 400 : 500;
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
        const sRef = db.collection('scrims').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        // 1. ALL READS FIRST (Firestore rule: all reads must precede all writes)
        const [tDoc, sDoc, uDoc, partDoc] = await Promise.all([
          tx.get(tRef),
          tx.get(sRef),
          tx.get(uRef),
          tx.get(partRef),
        ]);

        if (!tDoc.exists && !sDoc.exists) throw new Error("Tournament or scrim does not exist");
        if (!uDoc.exists) throw new Error("User not found");
        if (!partDoc.exists) throw new Error("Not registered for this event");

        const primaryDoc = tDoc.exists ? tDoc : sDoc;
        const targetRef = tDoc.exists ? tRef : sRef;
        const tData = primaryDoc.data()!;
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
        if (targetRef === tRef && sDoc.exists) {
          tx.update(sRef, tournamentUpdates);
        } else if (targetRef === sRef && tDoc.exists) {
          tx.update(tRef, tournamentUpdates);
        }
        tx.delete(partRef);

        if (refundAmount > 0) {
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

// POST /api/wallet/release-slot — organizer/admin releases a slot & automatically refunds entry fee
router.post("/api/wallet/release-slot",
  authenticateToken,
  rateLimit(30, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { tournamentId, slotNumber, userId } = req.body;
      const callerUid = req.user.userId;

      if (!tournamentId || typeof tournamentId !== 'string') {
        return res.status(400).json({ success: false, message: "Invalid tournament ID" });
      }
      const slotNum = Number(slotNumber);
      if (!Number.isInteger(slotNum) || slotNum < 1) {
        return res.status(400).json({ success: false, message: "Invalid slot number" });
      }

      const tRef = db.collection('tournaments').doc(tournamentId);
      const sRef = db.collection('scrims').doc(tournamentId);

      const result = await db.runTransaction(async (tx) => {
        // 1. ALL READS FIRST
        const [tDoc, sDoc] = await Promise.all([tx.get(tRef), tx.get(sRef)]);
        if (!tDoc.exists && !sDoc.exists) throw new Error("Tournament or scrim does not exist");

        const primaryDoc = tDoc.exists ? tDoc : sDoc;
        const targetRef = tDoc.exists ? tRef : sRef;
        const tData = primaryDoc.data()!;

        // Check caller is organizer/host/admin
        const isHost = tData.hostUid === callerUid || tData.orgId === callerUid || tData.createdBy === callerUid || tData.userId === callerUid;
        if (!isHost && req.user.role !== 'admin' && req.user.role !== 'organizer') {
          throw new Error("Unauthorized: Only organizer or admin can release slots");
        }

        const slots = Array.isArray(tData.slots) ? [...tData.slots] : [];
        const slotIdx = slots.findIndex((s: any) => s.slotNumber === slotNum);
        if (slotIdx === -1) throw new Error("Slot not found");

        const targetSlot = slots[slotIdx];
        let occupantUid = userId || targetSlot.userId || targetSlot.captainUid || targetSlot.reservedBy;

        let occupantUserSnap: any = null;
        let partDocSnap: any = null;
        let uRef: any = null;

        // If occupantUid is missing from targetSlot, look up from participants collection
        if (!occupantUid) {
          const partQuerySnap = await tx.get(
            db.collection('participants')
              .where('tournamentId', '==', tournamentId)
              .where('slotNumber', '==', slotNum)
              .limit(1)
          );
          if (!partQuerySnap.empty) {
            partDocSnap = partQuerySnap.docs[0];
            occupantUid = partDocSnap.data().userId;
          }
        }

        if (occupantUid) {
          uRef = db.collection('users').doc(occupantUid);
          const partRef = db.collection('participants').doc(`${tournamentId}_${occupantUid}`);
          if (!partDocSnap) {
            [occupantUserSnap, partDocSnap] = await Promise.all([tx.get(uRef), tx.get(partRef)]);
          } else {
            occupantUserSnap = await tx.get(uRef);
          }
        }

        // 2. ALL WRITES AFTER
        const partData = partDocSnap && partDocSnap.exists ? partDocSnap.data() : null;
        const entryFee = Math.max(
          0,
          Number(
            partData?.entryFeePaid ??
            tData.entryFee ??
            tData.requirements?.entryFee ??
            tData.fee ??
            0
          )
        );
        let refundProcessed = false;
        let refundAmount = 0;

        slots[slotIdx] = {
          slotNumber: slotNum,
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

        const filledSlots = slots.filter((s: any) => s.status === 'filled').length;
        const tournamentUpdates: any = {
          slots,
          filledSlots,
          currentPlayers: filledSlots,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        tx.update(targetRef, tournamentUpdates);
        if (targetRef === tRef && sDoc.exists) tx.update(sRef, tournamentUpdates);
        else if (targetRef === sRef && tDoc.exists) tx.update(tRef, tournamentUpdates);

        if (partDocSnap && partDocSnap.exists) {
          tx.delete(partDocSnap.ref);
        }

        // Refund entry fee if a registered player paid
        const isRealPlayer = occupantUid && targetSlot.teamName !== 'Reserved' && targetSlot.teamName !== 'Reserved Slot';
        if (entryFee > 0 && isRealPlayer && occupantUserSnap && occupantUserSnap.exists) {
          const uData = occupantUserSnap.data()!;
          const balanceBefore = Number(uData.balance || 0);
          const balanceAfter = balanceBefore + entryFee;
          tx.update(uRef, { balance: balanceAfter });

          const refundTxRef = db.collection('transactions').doc(`SLOT_REFUND_${tournamentId}_${slotNum}_${occupantUid}`);
          tx.set(refundTxRef, {
            id: refundTxRef.id,
            userId: occupantUid,
            username: uData.username || targetSlot.leader || 'Player',
            type: 'refund',
            amount: entryFee,
            method: 'Scrim Entry Refund',
            refId: `RFD-${tournamentId.slice(0, 8)}-${slotNum}-${Date.now().toString().slice(-4)}`,
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            desc: `Refund for released Slot #${slotNum} in ${tData.title || 'Scrim'}`,
            tournamentId,
            slotNumber: slotNum,
            balanceBefore,
            balanceAfter,
          });

          const notifRef = db.collection('notifications').doc();
          tx.set(notifRef, {
            userId: occupantUid,
            title: 'Entry Fee Refunded',
            message: `Your team was released from Slot #${slotNum} in "${tData.title || 'Scrim'}". Your entry fee of Rs. ${entryFee.toLocaleString()} has been refunded to your wallet.`,
            type: 'info',
            read: false,
            link: '/wallet',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          refundProcessed = true;
          refundAmount = entryFee;
        }

        return { refundProcessed, refundAmount };
      });

      return res.status(200).json({
        success: true,
        message: result.refundProcessed
          ? `Slot #${slotNum} released and entry fee refunded`
          : `Slot #${slotNum} released`,
        refunded: result.refundProcessed,
        refundAmount: result.refundAmount,
        slotNumber: slotNum,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Failed to release slot" });
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PRIZE DISTRIBUTION â€” server-side atomic, idempotent via tournament status check
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// POST /api/wallet/distribute-prizes â€” atomically distribute prizes to winners
router.post("/api/wallet/distribute-prizes",
  authenticateToken,
  rateLimit(3, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { tournamentId, winners, resultsData } = req.body;
      const uid = req.user.userId;

      if (!tournamentId || typeof tournamentId !== 'string') {
        return res.status(400).json({ success: false, message: "Invalid tournament ID" });
      }
      const winnerValidationError = validatePrizeWinners(winners);
      if (winnerValidationError) {
        return res.status(400).json({ success: false, message: winnerValidationError });
      }

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const tDoc = await tx.get(tRef);
        if (!tDoc.exists) throw new Error("Tournament not found");
        const tData = tDoc.data()!;
        if (tData.hostUid !== uid && req.user.role !== 'admin') {
          throw new Error("Not authorized â€” only tournament host can distribute prizes");
        }
        // Idempotency: tournament status prevents double distribution
        if (tData.status === 'completed') throw new Error("Tournament already completed");
        // Validate total prizes don't exceed prize pool
        const totalPrizes = winners.reduce((sum: number, w: any) => sum + (w.prize || 0), 0);
        const prizePool = tData.prizePool || 0;
        if (totalPrizes > prizePool) throw new Error(`Total prizes (${totalPrizes}) exceed prize pool (${prizePool})`);

        // Firestore transactions require all reads before writes. Reading every
        // winner up-front also prevents a completed tournament from silently
        // skipping a missing payout recipient.
        const hostRef = db.collection('users').doc(tData.hostUid);
        const hostDoc = await tx.get(hostRef);
        const winnerProfiles = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        for (const winner of winners) {
          const userDoc = await tx.get(db.collection('users').doc(winner.userId));
          if (!userDoc.exists) throw new Error(`Winner not found: ${winner.userId}`);
          winnerProfiles.set(winner.userId, userDoc);

          // A winner must be an approved participant of this tournament â€”
          // prevents hosts from paying arbitrary accounts (or themselves).
          const partDoc = await tx.get(db.collection('participants').doc(`${tournamentId}_${winner.userId}`));
          if (!partDoc.exists) throw new Error(`Winner is not a participant: ${winner.userId}`);
          if ((partDoc.data()?.status ?? 'pending') !== 'approved') {
            throw new Error(`Winner is not an approved participant: ${winner.userId}`);
          }
        }

        // Payout from Organizer Escrow:
        // Deduct prize payout from host's reserved escrow balance and release any unawarded leftover funds back to org wallet
        if (tData.fundingStatus === 'RESERVED' && (tData.reservedFunding || 0) > 0 && hostDoc.exists) {
          const reservedTotal = Number(tData.reservedFunding || 0);
          const leftover = Math.max(0, reservedTotal - totalPrizes);

          const hostUpdates: any = {
            reservedBalance: admin.firestore.FieldValue.increment(-reservedTotal),
          };
          if (leftover > 0) {
            hostUpdates.orgWalletBalance = admin.firestore.FieldValue.increment(leftover);
          }
          tx.update(hostRef, hostUpdates);

          const fundingRef = db.collection('tournament_funding').doc(tournamentId);
          tx.set(fundingRef, {
            tournamentId,
            organizationId: tData.hostUid,
            usedAmount: totalPrizes,
            releasedAmount: leftover,
            status: 'COMPLETED',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        tx.update(tRef, {
          status: 'completed',
          fundingStatus: 'COMPLETED',
          distributedAmount: totalPrizes,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Create results document
        const resultRef = db.collection('results').doc();
        tx.set(resultRef, {
          tournamentId,
          winners: winners.map((w: any) => ({
            userId: w.userId,
            username: w.username || '',
            inGameId: w.inGameId || '',
            inGameName: w.inGameName || '',
            rank: w.rank,
            prize: w.prize,
            teamName: w.teamName || ''
          })),
          manualResults: resultsData?.manualResults || null,
          resultTemplate: resultsData?.resultTemplate || null,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Distribute prizes to each winner â€” read each user's balance for audit
        for (const winner of winners) {
          const uRef = db.collection('users').doc(winner.userId);
          const uDoc = winnerProfiles.get(winner.userId)!;
          const balanceBefore = uDoc.data()?.balance || 0;
          const balanceAfter = balanceBefore + winner.prize;

          tx.update(uRef, {
            balance: admin.firestore.FieldValue.increment(winner.prize),
            totalEarnings: admin.firestore.FieldValue.increment(winner.prize)
          });

          // Update public profile
          const pubRef = db.collection('users_public').doc(winner.userId);
          tx.set(pubRef, {
            totalEarnings: admin.firestore.FieldValue.increment(winner.prize),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          if (winner.prize > 0) {
            const txRef = db.collection('transactions').doc();
            tx.set(txRef, {
              userId: winner.userId,
              username: winner.username || '',
              id: txRef.id,
              type: 'prize',
              amount: winner.prize,
              method: 'Tournament Prize',
              refId: `PRZ-${tournamentId.slice(0, 8)}-${winner.rank}`,
              status: 'success',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              desc: `Prize for Rank ${winner.rank}`,
              tournamentId,
              balanceBefore,
              balanceAfter,
            });
          }
        }

        // Revenue split (85/15) â€” atomic with prize distribution.
        // Use currentPlayers as the authoritative participant count, falling back to
        // winners.length. The denormalized approvedCount field is unreliable â€” it may be
        // 0 for manual-registration tournaments or lag due to async increments (BUG-044).
        const entryFee = tData.entryFee || 0;
        const participantCount = tData.currentPlayers || tData.approvedCount || winners.length || 0;
        const entryFeeTotal = participantCount * entryFee;
        const prizePoolTotal = tData.prizePool || 0;
        const profit = entryFeeTotal - prizePoolTotal;
        const orgShare = Math.round(profit * REVENUE_SPLIT.ORGANIZER);
        const nexplayShare = Math.round(profit * REVENUE_SPLIT.PLATFORM);

        // ponytail: only record earnings when profit > 0 â€” negative profit (organizer loss)
        // would create a record that could debit organizer wallet on release
        if (profit > 0) {
          const earnRef = db.collection('tournamentEarnings').doc();
          tx.set(earnRef, {
            tournamentId,
            tournamentName: tData.title || '',
            orgId: tData.hostUid || '',
            orgName: tData.hostName || '',
            entryFeeTotal,
            prizePoolTotal,
            profit,
            orgShare,
            nexplayShare,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        return { resultId: resultRef.id, winnersCount: winners.length };
      });

      return res.status(200).json({
        success: true,
        message: `Prizes distributed to ${result.winnersCount} winners`,
        resultId: result.resultId
      });
    } catch (error: any) {
      const msg = error.message || "Failed to distribute prizes";
      const code = msg.startsWith("Not authorized") ? 403 : msg.startsWith("Tournament not found") ? 404 : 500;
      return res.status(code).json({ success: false, message: msg });
    }
  }
);

// POST /api/wallet/cancel-tournament â€” admin-only, paginated and idempotent
// Each participant refund gets a deterministic ledger document. Retrying a page
// therefore cannot credit the same registration twice, even after a timeout.
router.post("/api/wallet/cancel-tournament",
  authenticateToken,
  rateLimit(30, 60 * 60 * 1000),
  async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
      const { tournamentId, lastParticipantId } = req.body || {};
      if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.length > 128) {
        return res.status(400).json({ success: false, message: 'Invalid tournament ID' });
      }
      if (lastParticipantId !== undefined && (typeof lastParticipantId !== 'string' || lastParticipantId.length > 256)) {
        return res.status(400).json({ success: false, message: 'Invalid cancellation cursor' });
      }

      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournament = await db.runTransaction(async tx => {
        const snapshot = await tx.get(tournamentRef);
        if (!snapshot.exists) throw new Error('Tournament not found');
        const data = snapshot.data()!;
        if (data.status === 'completed') throw new Error('Completed tournaments cannot be cancelled');
        
        // If tournament had reserved prize funds, release them back to the host's wallet
        if (data.fundingStatus === 'RESERVED' && Number(data.reservedFunding || 0) > 0 && data.hostUid) {
          const hostRef = db.collection('users').doc(data.hostUid);
          const hostDoc = await tx.get(hostRef);
          if (hostDoc.exists) {
            const reservedAmount = Number(data.reservedFunding || 0);
            tx.update(hostRef, {
              orgWalletBalance: admin.firestore.FieldValue.increment(reservedAmount),
              reservedBalance: admin.firestore.FieldValue.increment(-reservedAmount)
            });

            const releaseTxRef = db.collection('transactions').doc();
            tx.set(releaseTxRef, {
              id: releaseTxRef.id,
              userId: data.hostUid,
              type: 'tournament_release',
              amount: reservedAmount,
              method: 'Tournament Escrow Release',
              refId: `REL-${tournamentId.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
              status: 'completed',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              desc: `Released prize pool reserve for cancelled tournament: ${data.title || ''}`,
              tournamentId,
            });

            const fundingRef = db.collection('tournament_funding').doc(tournamentId);
            tx.set(fundingRef, {
              tournamentId,
              organizationId: data.hostUid,
              releasedAmount: reservedAmount,
              status: 'REFUNDED',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }
        }

        if (data.status !== 'cancelled') {
          tx.update(tournamentRef, {
            status: 'cancelled',
            fundingStatus: data.fundingStatus === 'RESERVED' ? 'REFUNDED' : data.fundingStatus || 'CANCELLED',
            reservedFunding: 0,
            cancellationStartedAt: admin.firestore.FieldValue.serverTimestamp(),
            cancelledBy: req.user.userId,
          });
        }
        return data;
      });

      let participantQuery = db.collection('participants')
        .where('tournamentId', '==', tournamentId)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(CANCELLATION_PAGE_SIZE);
      if (lastParticipantId) {
        const cursor = await db.collection('participants').doc(lastParticipantId).get();
        if (!cursor.exists || cursor.data()?.tournamentId !== tournamentId) {
          return res.status(400).json({ success: false, message: 'Invalid cancellation cursor' });
        }
        participantQuery = participantQuery.startAfter(cursor);
      }
      const participants = await participantQuery.get();
      let refunded = 0;
      let alreadyRefunded = 0;
      const entryFee = Number(tournament.entryFee ?? tournament.requirements?.entryFee ?? tournament.fee ?? 0);
      const refundAmount = Number.isFinite(entryFee) && entryFee > 0 ? entryFee : 0;

      for (const participant of participants.docs) {
        const participantData = participant.data();
        const refundRef = db.collection('transactions').doc(`CANCEL_REFUND_${participant.id}`);
        const userRef = db.collection('users').doc(participantData.userId);
        const outcome = await db.runTransaction(async tx => {
          const [currentParticipant, currentRefund, user] = await Promise.all([
            tx.get(participant.ref),
            tx.get(refundRef),
            tx.get(userRef),
          ]);
          if (!currentParticipant.exists || currentRefund.exists) return 'already-refunded' as const;
          if (!user.exists) throw new Error(`Participant account not found: ${participant.id}`);

          const userData = user.data()!;
          const balanceBefore = Number(userData.balance || 0);
          const balanceAfter = balanceBefore + refundAmount;
          tx.update(participant.ref, { status: 'refunded', refundedAt: admin.firestore.FieldValue.serverTimestamp() });
          if (refundAmount > 0) {
            tx.update(userRef, { balance: admin.firestore.FieldValue.increment(refundAmount) });
            tx.set(refundRef, {
              id: refundRef.id,
              userId: participantData.userId,
              username: participantData.username || userData.username || '',
              type: 'refund',
              amount: refundAmount,
              method: 'Tournament Cancellation',
              refId: `CANCEL-${tournamentId}-${participant.id}`,
              status: 'refunded',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              desc: `Refund for cancelled tournament: ${tournament.title || ''}`,
              tournamentId,
              balanceBefore,
              balanceAfter,
              cancelledBy: req.user.userId,
            });
          } else {
            tx.set(refundRef, {
              id: refundRef.id,
              userId: participantData.userId,
              type: 'refund',
              amount: 0,
              status: 'refunded',
              tournamentId,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              desc: 'No-fee cancellation recorded',
            });
          }
          const notificationRef = db.collection('notifications').doc(`CANCELLED_${participant.id}`);
          tx.set(notificationRef, {
            userId: participantData.userId,
            title: 'Tournament Cancelled',
            message: `The tournament "${tournament.title || 'Tournament'}" has been cancelled.${refundAmount > 0 ? ' Your entry fee has been refunded.' : ''}`,
            type: 'info',
            read: false,
            link: '/profile',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          return 'refunded' as const;
        });
        if (outcome === 'refunded') refunded++;
        else alreadyRefunded++;
      }

      const lastParticipant = participants.docs.at(-1);
      const hasMore = participants.size === CANCELLATION_PAGE_SIZE;
      if (!hasMore) {
        await tournamentRef.update({ cancellationCompletedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      return res.json({
        success: true,
        refunded,
        alreadyRefunded,
        processed: participants.size,
        hasMore,
        nextParticipantId: hasMore ? lastParticipant?.id : null,
      });
    } catch (error: any) {
      const message = error.message || 'Tournament cancellation failed';
      const status = message === 'Tournament not found' ? 404 : message.includes('cannot be cancelled') ? 409 : 500;
      return res.status(status).json({ success: false, message: status === 500 ? 'Tournament cancellation failed' : message });
    }
  },
);

// GET /api/migrate-room-creds â€” one-time migration of room creds to subcollection
// ponytail: one-time migration endpoint â€” safe to delete after deployment
router.get("/api/migrate-room-creds", authenticateToken, rateLimit(1, 60 * 60 * 1000), async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin only" });
  }
  try {
    const tSnap = await db.collection('tournaments').get();
    let migrated = 0;
    let skipped = 0;

    const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    for (const tDoc of tSnap.docs) {
      const data = tDoc.data() as any;
      const hasRoomCreds = data.roomId || data.roomPass ||
        (Array.isArray(data.groups) && data.groups.some((group: any) => group?.roomId || group?.roomPass));
      if (!hasRoomCreds) { skipped++; continue; }

      const credRef = db.collection('tournaments').doc(tDoc.id).collection('credentials').doc('main');
      operations.push(batch => batch.set(credRef, {
        roomId: data.roomId || '',
        roomPass: data.roomPass || '',
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      }));

      const legacyGroups = Array.isArray(data.groups) ? data.groups : [];
      const sanitizedGroups = legacyGroups.map((group: any) => {
        const { roomId: _roomId, roomPass: _roomPass, ...publicGroup } = group || {};
        return publicGroup;
      });

      if (Array.isArray(data.groups)) {
        for (const group of data.groups) {
          if (group?.roomId || group?.roomPass) {
            if (typeof group.id !== 'string' || !group.id || group.id.length > 128 || group.id.includes('/')) {
              throw new Error('Invalid legacy group credential identifier');
            }
            const gCredRef = db.collection('tournaments').doc(tDoc.id).collection('credentials').doc(`group_${group.id}`);
            operations.push(batch => batch.set(gCredRef, {
              roomId: group.roomId || '',
              roomPass: group.roomPass || '',
              migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            }));
          }
        }
      }
      operations.push(batch => batch.update(tDoc.ref, {
        roomId: admin.firestore.FieldValue.delete(),
        roomPass: admin.firestore.FieldValue.delete(),
        ...(Array.isArray(data.groups) ? { groups: sanitizedGroups } : {}),
      }));
      migrated++;
    }

    const progress = await commitBatchedWrites(() => db.batch(), operations);
    return res.json({ success: true, migrated, skipped, total: tSnap.size, writes: operations.length, batches: progress.completedChunks });
  } catch (error: any) {
    if (error instanceof ChunkProcessingError) {
      return res.status(500).json({
        success: false,
        message: `Migration stopped after ${error.progress.completedItems} idempotent writes. Retry the migration to continue.`,
      });
    }
    return res.status(500).json({ success: false, message: "Room credential migration failed" });
  }
});

export default router;
