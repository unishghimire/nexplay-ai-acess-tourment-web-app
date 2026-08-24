import { Router } from "express";
import { createHash } from "crypto";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { ChunkProcessingError, commitBatchedWrites } from "../batchedWrites.js";
import { validatePrizeWinners } from "../prizeValidation.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// WALLET SECURITY
// All wallet writes go through server endpoints — clients cannot write
// to transactions collection directly (enforced by Firestore rules).
// Duplicate detection: same transactionCode + same amount within 24h = blocked
// ═══════════════════════════════════════════════════════════════

// Revenue split — mirrors src/shared/constants/finance.ts
// ponytail: duplicated because server and client are separate build targets
const REVENUE_SPLIT = { ORGANIZER: 0.85, PLATFORM: 0.15 } as const;
const CANCELLATION_PAGE_SIZE = 100;

// POST /api/wallet/deposit — create a pending deposit request
router.post("/api/wallet/deposit",
  authenticateToken,
  rateLimit(30, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { amount, method, senderNumber, transactionCode, proofUrl } = req.body;
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

      // Deposit is pending — balance credited when admin approves (atomic in useAdminData handleApproveTx)
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
        accountDetails: `Sender Number: ${senderNumber}\nTransaction Code/Name: ${transactionCode}`,
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

// POST /api/wallet/withdraw — create a pending withdrawal + lock funds atomically
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

// GET /api/wallet/transactions — list own transactions (paginated)
// [BUG-026] maintenance-only endpoint — no client callers; client uses direct Firestore reads.
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

// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENTRY FEE — server-side atomic deduction
// ═══════════════════════════════════════════════════════════════

// POST /api/wallet/join-tournament — atomic entry fee deduction + participant create + ledger
router.post("/api/wallet/join-tournament",
  authenticateToken,
  rateLimit(10, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { tournamentId, teammates, teamId, teamName, selectedPlayers } = req.body;
      const uid = req.user.userId;

      if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.length > 128) {
        return res.status(400).json({ success: false, message: "Invalid tournament ID" });
      }

      // Deterministic participant doc ID for atomic duplicate check
      // ponytail: underscore separator is safe — Firebase Auth UIDs and Firestore auto-generated doc IDs are alphanumeric-only (no underscores). Ceiling: manually-created tournament doc IDs with underscores could theoretically collide. Upgrade: use '::' separator if user-created IDs are ever allowed.
      const partRef = db.collection('participants').doc(`${tournamentId}_${uid}`);

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        const tDoc = await tx.get(tRef);
        const uDoc = await tx.get(uRef);
        const partDoc = await tx.get(partRef);

        if (!tDoc.exists) throw new Error("Tournament does not exist");
        if (!uDoc.exists) throw new Error("User not found");
        if (partDoc.exists) throw new Error("Already registered for this tournament");

        const tData = tDoc.data()!;
        const uData = uDoc.data()!;

        if (!['upcoming', 'published', 'live'].includes(tData.status)) throw new Error("Tournament is not open for registration");
        const totalSlotsCount = typeof tData.totalSlots === 'number' && !isNaN(tData.totalSlots) && tData.totalSlots > 0
          ? tData.totalSlots
          : typeof tData.slots === 'number' && !isNaN(tData.slots) && tData.slots > 0
          ? tData.slots
          : Array.isArray(tData.slots)
          ? tData.slots.length
          : 0;

        if (totalSlotsCount > 0 && (tData.currentPlayers || 0) >= totalSlotsCount) throw new Error("Tournament is full");
        if (uData.balance < (tData.entryFee || 0)) throw new Error("Insufficient balance");

        const entryFee = tData.entryFee || 0;
        const balanceBefore = uData.balance;
        const balanceAfter = balanceBefore - entryFee;
        const currentXP = uData.xp || 0;
        const newXP = currentXP + 50;
        const newLevel = Math.floor(newXP / 500) + 1;

        tx.update(uRef, { balance: balanceAfter, xp: newXP, level: newLevel });

        const effectiveTeamName = teamName || uData.teamName || uData.username || 'Registered Player';
        const effectiveTeamId = teamId || uData.teamId || uid;

        const tournamentUpdates: any = {
          currentPlayers: (tData.currentPlayers || 0) + 1,
        };

        if (Array.isArray(tData.slots) && tData.slots.length > 0) {
          const slotIdx = tData.slots.findIndex((s: any) => s.status === 'open');
          if (slotIdx !== -1) {
            const updatedSlots = [...tData.slots];
            updatedSlots[slotIdx] = {
              ...updatedSlots[slotIdx],
              status: 'filled',
              teamName: effectiveTeamName,
              teamId: effectiveTeamId,
              inGameId: uData.inGameId || '',
            };
            tournamentUpdates.slots = updatedSlots;
            tournamentUpdates.filledSlots = updatedSlots.filter((s: any) => s.status === 'filled').length;
          }
        }
        tx.update(tRef, tournamentUpdates);

        const participantData: any = {
          userId: uid,
          tournamentId,
          inGameId: uData.inGameId || '',
          inGameName: uData.inGameName || '',
          teamName: effectiveTeamName,
          teamId: effectiveTeamId,
          username: uData.username || '',
          logoUrl: uData.profilePicUrl || '',
          status: tData.registrationType === 'manual' ? 'pending' : 'approved',
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

        return { newBalance: balanceAfter, participantId: partRef.id };
      });

      return res.status(200).json({
        success: true,
        message: "Joined tournament successfully",
        newBalance: result.newBalance
      });
    } catch (error: any) {
      const msg = error.message || "Failed to join tournament";
      const code = ["Insufficient balance", "Tournament is full", "Already registered"].includes(msg) ? 400 : 500;
      return res.status(code).json({ success: false, message: msg });
    }
  }
);

// POST /api/wallet/leave-tournament — atomic refund + participant delete + ledger
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

      // Deterministic participant doc ID — matches join-tournament
      const partRef = db.collection('participants').doc(`${tournamentId}_${uid}`);

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        const tDoc = await tx.get(tRef);
        const uDoc = await tx.get(uRef);
        const partDoc = await tx.get(partRef);

        if (!tDoc.exists) throw new Error("Tournament does not exist");
        if (!uDoc.exists) throw new Error("User not found");
        if (!partDoc.exists) throw new Error("Not registered for this tournament");

        const tData = tDoc.data()!;
        const uData = uDoc.data()!;

        if (partDoc.data().status === 'refunded') throw new Error("Already refunded");
        if (['live', 'paused', 'completed', 'cancelled'].includes(tData.status)) throw new Error("Cannot leave a tournament that has already started");
        const refundAmount = tData.entryFee || 0;
        const balanceBefore = uData.balance;
        const balanceAfter = balanceBefore + refundAmount;

        tx.update(uRef, { balance: balanceAfter });

        const tournamentUpdates: any = {
          currentPlayers: Math.max(0, (tData.currentPlayers || 0) - 1),
        };

        if (Array.isArray(tData.slots) && tData.slots.length > 0) {
          const slotIdx = tData.slots.findIndex((s: any) => s.teamId === uid || (uData.teamId && s.teamId === uData.teamId));
          if (slotIdx !== -1) {
            const updatedSlots = [...tData.slots];
            updatedSlots[slotIdx] = {
              slotNumber: updatedSlots[slotIdx].slotNumber,
              status: 'open',
              teamName: null,
              teamId: null,
            };
            tournamentUpdates.slots = updatedSlots;
            tournamentUpdates.filledSlots = updatedSlots.filter((s: any) => s.status === 'filled').length;
          }
        }
        tx.update(tRef, tournamentUpdates);
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

// POST /api/wallet/redeem-promo — atomic promo code redemption
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
        // Tracked read — ensures promo state is locked for the transaction
        const promoDoc = await tx.get(promoRef);
        if (!promoDoc.exists) throw new Error("Invalid promo code");
        const promoData = promoDoc.data()!;

        if (!promoData.isActive) throw new Error("This promo code is no longer active");
        if ((promoData.currentUses || 0) >= (promoData.maxUses || 0)) throw new Error("Promo code has reached maximum uses");

        // Idempotency: deterministic transaction doc ID prevents duplicate redemption
        // Two concurrent requests will conflict on this doc, and the retry will see it exists
        // ponytail: deterministic doc ID — same (uid, promoCode) always collides for duplicate prevention. Underscore separator safe for Firebase Auth UIDs (alphanumeric-only). Promo codes are uppercased and may contain underscores, but the _PROMO_ marker disambiguates.
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

// ═══════════════════════════════════════════════════════════════
// PRIZE DISTRIBUTION — server-side atomic, idempotent via tournament status check
// ═══════════════════════════════════════════════════════════════

// POST /api/wallet/distribute-prizes — atomically distribute prizes to winners
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
          throw new Error("Not authorized — only tournament host can distribute prizes");
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
        const winnerProfiles = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        for (const winner of winners) {
          const userDoc = await tx.get(db.collection('users').doc(winner.userId));
          if (!userDoc.exists) throw new Error(`Winner not found: ${winner.userId}`);
          winnerProfiles.set(winner.userId, userDoc);

          // A winner must be an approved participant of this tournament —
          // prevents hosts from paying arbitrary accounts (or themselves).
          const partDoc = await tx.get(db.collection('participants').doc(`${tournamentId}_${winner.userId}`));
          if (!partDoc.exists) throw new Error(`Winner is not a participant: ${winner.userId}`);
          if ((partDoc.data()?.status ?? 'pending') !== 'approved') {
            throw new Error(`Winner is not an approved participant: ${winner.userId}`);
          }
        }

        tx.update(tRef, { status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });

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

        // Distribute prizes to each winner — read each user's balance for audit
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

        // Revenue split (85/15) — atomic with prize distribution.
        // Use currentPlayers as the authoritative participant count, falling back to
        // winners.length. The denormalized approvedCount field is unreliable — it may be
        // 0 for manual-registration tournaments or lag due to async increments (BUG-044).
        const entryFee = tData.entryFee || 0;
        const participantCount = tData.currentPlayers || tData.approvedCount || winners.length || 0;
        const entryFeeTotal = participantCount * entryFee;
        const prizePoolTotal = tData.prizePool || 0;
        const profit = entryFeeTotal - prizePoolTotal;
        const orgShare = Math.round(profit * REVENUE_SPLIT.ORGANIZER);
        const nexplayShare = Math.round(profit * REVENUE_SPLIT.PLATFORM);

        // ponytail: only record earnings when profit > 0 — negative profit (organizer loss)
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

// POST /api/wallet/cancel-tournament — admin-only, paginated and idempotent
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
        if (data.status !== 'cancelled') {
          tx.update(tournamentRef, {
            status: 'cancelled',
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
      const entryFee = Number(tournament.entryFee || 0);
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

// GET /api/migrate-room-creds — one-time migration of room creds to subcollection
// ponytail: one-time migration endpoint — safe to delete after deployment
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
