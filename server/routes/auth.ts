import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";
import { LEGACY_AUTH_DEPRECATION, isFirebaseUid, isUserRole } from "../authPolicy.js";
import { requireAdmin } from "../authz.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// DEPRECATED: These REST auth endpoints are legacy.
// The React frontend uses Firebase Auth SDK directly (createUserWithEmailAndPassword,
// signInWithEmailAndPassword, sendPasswordResetEmail). These routes remain for
// backward compatibility with any existing API clients but should not be used
// for new authentication flows.
// ponytail: kept for compatibility, not actively used by the React frontend.
// ═══════════════════════════════════════════════════════════════

const legacyAuthEndpoint = (_req: unknown, res: any) =>
  res.status(410).json(LEGACY_AUTH_DEPRECATION);

// Firebase Auth is the sole identity authority. Keeping legacy endpoints as
// explicit 410 responses avoids creating Firestore-only accounts or accepting
// locally-issued JWTs while making the migration state clear to old clients.
router.post("/api/register", rateLimit(5, 15 * 60 * 1000), legacyAuthEndpoint);
router.post("/api/login", rateLimit(10, 15 * 60 * 1000), legacyAuthEndpoint);
router.post("/api/forgot-password", rateLimit(3, 15 * 60 * 1000), legacyAuthEndpoint);
router.post("/api/reset-password", rateLimit(5, 15 * 60 * 1000), legacyAuthEndpoint);

// Verify Token
// [BUG-026] maintenance-only endpoint — no client callers; kept for debugging/token verification.
router.get("/api/me", authenticateToken, async (req: any, res) => {
  try {
    const userSnap = await db.collection("users").doc(req.user.userId).get();
    if (!userSnap.exists) return res.status(404).json({ success: false, message: "User not found" });
    const userData = userSnap.data();
    res.json({ success: true, user: { uid: req.user.userId, email: userData?.email, username: userData?.username, role: userData?.role } });
  } catch (error: any) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

// Admin-only: Set custom claims for a user (called when admin changes role)
router.post("/api/admin/set-claims", authenticateToken, requireAdmin, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { uid, role } = req.body;
    if (!isFirebaseUid(uid) || !isUserRole(role)) {
      return res.status(400).json({ success: false, message: "Valid uid and role required" });
    }
    // Set custom claims on the Firebase Auth user
    await admin.auth().setCustomUserClaims(uid, { role });
    res.json({ success: true, message: `Custom claims set: role=${role} for uid=${uid}` });
  } catch (error: any) {
    console.error("Set claims error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Admin-only: Backfill custom claims for every user whose `users` doc carries a
// non-player role. Custom claims are the single source of truth for authorization
// (BUG-030) — run this ONCE before deploying the claims-only rules/authenticateToken,
// otherwise doc-role admins/orgs would lose access. Safe to re-run at any time.
router.post("/api/admin/sync-claims", authenticateToken, requireAdmin, rateLimit(1, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const snapshot = await db.collection("users").select("role").get();
    const toSync: Array<{ uid: string; role: string }> = [];
    snapshot.forEach((docSnap) => {
      const role = docSnap.data()?.role;
      if (role && role !== "player") toSync.push({ uid: docSnap.id, role });
    });
    let synced = 0;
    for (const { uid, role } of toSync) {
      await admin.auth().setCustomUserClaims(uid, { role });
      synced++;
    }
    res.json({ success: true, synced, message: `Custom claims synced for ${synced} user(s)` });
  } catch (error: any) {
    console.error("Sync claims error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

export default router;
