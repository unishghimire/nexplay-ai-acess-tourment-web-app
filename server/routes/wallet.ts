import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";

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

// POST /api/wallet/deposit — create a pending deposit request
router.post("/api/wallet/deposit",
  authenticateToken,
  rateLimit(5, 15 * 60 * 1000),
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
      if (!proofUrl || typeof proofUrl !== 'string') {
        return res.status(400).json({ success: false, message: "Payment screenshot is required" });
      }
      try {
        const url = new URL(proofUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ success: false, message: "Invalid screenshot URL" });
      }

      // Duplicate detection: same transactionCode + amount within 24h
      const dupQuery = db.collection('transactions')
        .where('userId', '==', uid)
        .where('transactionCode', '==', transactionCode)
        .where('amount', '==', numAmount)
        .where('type', '==', 'deposit')
        .limit(1);
      const dupSnap = await dupQuery.get();
      if (!dupSnap.empty) {
        const age = Date.now() - (dupSnap.docs[0].data().timestamp?.toMillis?.() || 0);
        if (age < 24 * 60 * 60 * 1000) {
          return res.status(409).json({ success: false, message: "Duplicate transaction detected. This transaction code was already submitted." });
        }
      }

      // Deposit is pending — balance credited when admin approves (atomic in useAdminData handleApproveTx)
      const txRef = db.collection('transactions').doc();
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
        proofUrl,
        refId: `DEP-${Date.now()}`,
      });

      return res.status(201).json({ success: true, message: "Deposit request submitted", transactionId: txRef.id });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to submit deposit request" });
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

        const balanceBefore = userDoc.data()?.balance || 0;
        if (numAmount > balanceBefore) throw new Error("Insufficient balance");

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

        const balanceAfter = balanceBefore - numAmount;

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
          balance: admin.firestore.FieldValue.increment(-numAmount),
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

// GET /api/wallet/transactions — list own transactions (paginated)
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

export default router;

// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENTRY FEE — server-side atomic deduction
// ═══════════════════════════════════════════════════════════════

// POST /api/wallet/join-tournament — atomic entry fee deduction + participant create + ledger
router.post("/api/wallet/join-tournament",
  authenticateToken,
  rateLimit(10, 15 * 60 * 1000),
  async (req: any, res) => {
    try {
      const { tournamentId, teammates } = req.body;
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
        if (tData.currentPlayers >= tData.slots) throw new Error("Tournament is full");
        if (uData.balance < (tData.entryFee || 0)) throw new Error("Insufficient balance");

        const entryFee = tData.entryFee || 0;
        const balanceBefore = uData.balance;
        const balanceAfter = balanceBefore - entryFee;
        const currentXP = uData.xp || 0;
        const newXP = currentXP + 50;
        const newLevel = Math.floor(newXP / 500) + 1;

        tx.update(uRef, { balance: balanceAfter, xp: newXP, level: newLevel });
        tx.update(tRef, { currentPlayers: (tData.currentPlayers || 0) + 1 });

        const participantData: any = {
          userId: uid,
          tournamentId,
          inGameId: uData.inGameId || '',
          inGameName: uData.inGameName || '',
          teamName: uData.teamName || '',
          teamId: uData.teamId || '',
          username: uData.username || '',
          logoUrl: uData.profilePicUrl || '',
          status: tData.registrationType === 'manual' ? 'pending' : 'approved',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        if (Array.isArray(teammates) && teammates.length > 0) {
          participantData.teammates = teammates.slice(0, 3);
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
        if (['completed', 'cancelled'].includes(tData.status)) throw new Error("Cannot leave a completed tournament");
        const refundAmount = tData.entryFee || 0;
        const balanceBefore = uData.balance;
        const balanceAfter = balanceBefore + refundAmount;

        tx.update(uRef, { balance: balanceAfter });
        tx.update(tRef, { currentPlayers: Math.max(0, (tData.currentPlayers || 0) - 1) });
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
      if (!Array.isArray(winners) || winners.length === 0) {
        return res.status(400).json({ success: false, message: "Winners array is required" });
      }
      for (const w of winners) {
        if (!w.userId || typeof w.userId !== 'string') {
          return res.status(400).json({ success: false, message: "Invalid winner data" });
        }
        if (typeof w.prize !== 'number' || w.prize < 0 || w.prize > 1000000) {
          return res.status(400).json({ success: false, message: "Invalid prize amount" });
        }
        if (typeof w.rank !== 'number' || w.rank < 1 || w.rank > 999) {
          return res.status(400).json({ success: false, message: "Invalid rank" });
        }
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
          const uDoc = await tx.get(uRef);
          if (!uDoc.exists) continue; // skip non-existent users
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

        // Revenue split (85/15) — atomic with prize distribution
        const approvedCount = tData.approvedCount || 0;
        const entryFee = tData.entryFee || 0;
        const entryFeeTotal = approvedCount * entryFee;
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
      const code = ["Not authorized", "already completed"].includes(msg) ? 403 : 500;
      return res.status(code).json({ success: false, message: msg });
    }
  }
);

// GET /api/migrate-room-creds — one-time migration of room creds to subcollection
// ponytail: one-time migration endpoint — safe to delete after deployment
router.get("/api/migrate-room-creds", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin only" });
  }
  try {
    const tSnap = await db.collection('tournaments').get();
    let migrated = 0;
    let skipped = 0;

    const batch = db.batch();
    for (const tDoc of tSnap.docs) {
      const data = tDoc.data() as any;
      const hasRoomCreds = data.roomId || data.roomPass;
      if (!hasRoomCreds) { skipped++; continue; }

      const credRef = db.collection('tournaments').doc(tDoc.id).collection('credentials').doc('main');
      batch.set(credRef, {
        roomId: data.roomId || '',
        roomPass: data.roomPass || '',
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (Array.isArray(data.groups)) {
        for (const group of data.groups) {
          if (group.roomId || group.roomPass) {
            const gCredRef = db.collection('tournaments').doc(tDoc.id).collection('credentials').doc(`group_${group.id}`);
            batch.set(gCredRef, {
              roomId: group.roomId || '',
              roomPass: group.roomPass || '',
              migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }
      migrated++;
    }

    await batch.commit();
    return res.json({ success: true, migrated, skipped, total: tSnap.size });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
