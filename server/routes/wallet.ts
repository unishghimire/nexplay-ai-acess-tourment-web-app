import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// WALLET SECURITY
// ponytail: all wallet writes go through server endpoints — clients
// cannot write to transactions collection directly (enforced by Firestore rules)
// Duplicate detection: same transactionCode + same amount within 24h = blocked
// ═══════════════════════════════════════════════════════════════

// POST /api/wallet/deposit — create a pending deposit request
router.post("/api/wallet/deposit",
  authenticateToken,
  rateLimit(5, 15 * 60 * 1000), // 5 deposits per 15 min
  async (req: any, res) => {
    try {
      const { amount, method, senderNumber, transactionCode, proofUrl } = req.body;
      const uid = req.user.userId;

      // --- Validation ---
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
      // Validate URL format
      try {
        const url = new URL(proofUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ success: false, message: "Invalid screenshot URL" });
      }

      // --- Duplicate detection: same transactionCode + amount within 24h ---
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

      // --- Create pending deposit ---
      const txRef = db.collection('transactions').doc();
      const txData = {
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
      };
      await txRef.set(txData);

      return res.status(201).json({ success: true, message: "Deposit request submitted", transactionId: txRef.id });
    } catch (error: any) {
      console.error("Deposit error:", error);
      return res.status(500).json({ success: false, message: "Failed to submit deposit request" });
    }
  }
);

// POST /api/wallet/withdraw — create a pending withdrawal + lock funds
router.post("/api/wallet/withdraw",
  authenticateToken,
  rateLimit(3, 15 * 60 * 1000), // 3 withdrawals per 15 min
  async (req: any, res) => {
    try {
      const { amount, method, accountDetails } = req.body;
      const uid = req.user.userId;

      // --- Validation ---
      const numAmount = Number(amount);
      if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" });
      }
      if (numAmount > 100000) {
        return res.status(400).json({ success: false, message: "Amount exceeds maximum withdrawal limit (Rs. 100,000)" });
      }
      if (!method || typeof method !== 'string' || method.length > 100) {
        return res.status(400).json({ success: false, message: "Invalid withdrawal method" });
      }
      if (!accountDetails || typeof accountDetails !== 'string' || accountDetails.length > 500) {
        return res.status(400).json({ success: false, message: "Invalid account details" });
      }

      // --- Atomic balance check + debit using Firestore transaction ---
      const userRef = db.collection('users').doc(uid);
      const result = await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const balance = userDoc.data()?.balance || 0;
        if (numAmount > balance) {
          throw new Error("Insufficient balance");
        }

        // Create pending withdrawal
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
        });

        // Debit balance immediately (refunded if admin rejects)
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-numAmount),
        });

        return { transactionId: txRef.id };
      });

      return res.status(201).json({ success: true, message: "Withdrawal request submitted", transactionId: result.transactionId });
    } catch (error: any) {
      if (error.message === "Insufficient balance") {
        return res.status(400).json({ success: false, message: "Insufficient balance" });
      }
      console.error("Withdraw error:", error);
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
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const lastDocId = req.query.lastDoc as string;

      let query = db.collection('transactions')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (lastDocId) {
        const lastDoc = await db.collection('transactions').doc(lastDocId).get();
        if (lastDoc.exists) query = query.startAfter(lastDoc);
      }

      const snap = await query.get();
      const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const hasMore = snap.size === limit;

      return res.json({ success: true, transactions, hasMore });
    } catch (error: any) {
      console.error("Fetch transactions error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
  }
);

export default router;

// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENTRY FEE — server-side atomic deduction
// ponytail: client cannot change balance (firestore rules), so all
// balance-changing operations go through server endpoints
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

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        const tDoc = await tx.get(tRef);
        const uDoc = await tx.get(uRef);
        if (!tDoc.exists) throw new Error("Tournament does not exist");
        if (!uDoc.exists) throw new Error("User not found");

        const tData = tDoc.data()!;
        const uData = uDoc.data()!;

        if (tData.currentPlayers >= tData.slots) throw new Error("Tournament is full");
        if (uData.balance < (tData.entryFee || 0)) throw new Error("Insufficient balance");

        // Check for duplicate registration
        const partSnap = await db.collection('participants')
          .where('tournamentId', '==', tournamentId)
          .where('userId', '==', uid)
          .limit(1)
          .get();
        if (!partSnap.empty) throw new Error("Already registered for this tournament");

        // Deduct entry fee
        const newBalance = uData.balance - (tData.entryFee || 0);
        const currentXP = uData.xp || 0;
        const newXP = currentXP + 50;
        const newLevel = Math.floor(newXP / 500) + 1;

        tx.update(uRef, {
          balance: newBalance,
          xp: newXP,
          level: newLevel
        });

        tx.update(tRef, {
          currentPlayers: (tData.currentPlayers || 0) + 1
        });

        // Create participant record
        const partRef = db.collection('participants').doc();
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

        // Create audit ledger entry
        if ((tData.entryFee || 0) > 0) {
          const txRef = db.collection('transactions').doc();
          tx.set(txRef, {
            userId: uid,
            username: uData.username || '',
            type: 'entry_fee',
            amount: tData.entryFee,
            method: 'Tournament Entry',
            refId: `ENTRY-${tournamentId.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            desc: `Entry fee for ${tData.title}`,
            tournamentId
          });
        }

        return { newBalance, participantId: partRef.id };
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

      const result = await db.runTransaction(async (tx) => {
        const tRef = db.collection('tournaments').doc(tournamentId);
        const uRef = db.collection('users').doc(uid);

        const tDoc = await tx.get(tRef);
        const uDoc = await tx.get(uRef);
        if (!tDoc.exists) throw new Error("Tournament does not exist");
        if (!uDoc.exists) throw new Error("User not found");

        const tData = tDoc.data()!;
        const uData = uDoc.data()!;

        // Find participant record
        const partSnap = await db.collection('participants')
          .where('tournamentId', '==', tournamentId)
          .where('userId', '==', uid)
          .limit(1)
          .get();
        if (partSnap.empty) throw new Error("Not registered for this tournament");
        const partDoc = partSnap.docs[0];
        if (partDoc.data().status === 'refunded') throw new Error("Already refunded");

        const refundAmount = tData.entryFee || 0;

        // Refund balance
        tx.update(uRef, {
          balance: uData.balance + refundAmount
        });

        // Decrement player count
        tx.update(tRef, {
          currentPlayers: Math.max(0, (tData.currentPlayers || 0) - 1)
        });

        // Delete participant
        tx.delete(partDoc.ref);

        // Audit ledger entry
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
            tournamentId
          });
        }

        return { newBalance: uData.balance + refundAmount };
      });

      return res.status(200).json({
        success: true,
        message: "Left tournament successfully",
        newBalance: result.newBalance
      });
    } catch (error: any) {
      const msg = error.message || "Failed to leave tournament";
      return res.status(500).json({ success: false, message: msg });
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

        // Find promo code
        const promoSnap = await db.collection('promocodes')
          .where('code', '==', upperCode)
          .limit(1)
          .get();
        if (promoSnap.empty) throw new Error("Invalid promo code");
        const promoDoc = promoSnap.docs[0];
        const promoData = promoDoc.data()!;

        if (!promoData.isActive) throw new Error("This promo code is no longer active");
        if ((promoData.currentUses || 0) >= (promoData.maxUses || 0)) throw new Error("Promo code has reached maximum uses");

        // Check if user already used this promo
        const usedSnap = await db.collection('transactions')
          .where('userId', '==', uid)
          .where('type', '==', 'promo')
          .where('method', '==', `PROMO:${upperCode}`)
          .limit(1)
          .get();
        if (!usedSnap.empty) throw new Error("You have already used this promo code");

        const uDoc = await tx.get(uRef);
        if (!uDoc.exists) throw new Error("User not found");
        const uData = uDoc.data()!;

        // Credit balance
        tx.update(uRef, {
          balance: admin.firestore.FieldValue.increment(promoData.amount)
        });

        // Increment promo usage
        tx.update(promoDoc.ref, {
          currentUses: admin.firestore.FieldValue.increment(1)
        });

        // Create audit ledger entry
        const txRef = db.collection('transactions').doc();
        tx.set(txRef, {
          userId: uid,
          username: uData.username || 'Unknown',
          userEmail: '',
          type: 'promo',
          amount: promoData.amount,
          method: `PROMO:${upperCode}`,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          accountDetails: 'Promo Code Redemption',
          refId: `PRM-${Date.now()}`
        });

        return { amount: promoData.amount, newBalance: (uData.balance || 0) + promoData.amount };
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
// PRIZE DISTRIBUTION — server-side atomic prize distribution
// ponytail: organizer cannot write to user balances or transactions
// from client (firestore rules), so prize distribution goes through server
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
      // Validate each winner
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
        if (tData.status === 'completed') throw new Error("Tournament already completed");

        // Update tournament status
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

        // Distribute prizes to each winner
        for (const winner of winners) {
          const uRef = db.collection('users').doc(winner.userId);

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

          // Create prize transaction ledger entry
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
              tournamentId
            });
          }
        }

        // Calculate and store revenue split (85/15) — atomic with prize distribution
        const approvedCount = tData.approvedCount || 0;
        const entryFee = tData.entryFee || 0;
        const entryFeeTotal = approvedCount * entryFee;
        const prizePoolTotal = tData.prizePool || 0;
        const profit = entryFeeTotal - prizePoolTotal;
        const orgShare = Math.round(profit * 0.85);
        const nexplayShare = Math.round(profit * 0.15);

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
