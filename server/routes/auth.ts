import { Router } from "express";
import { rateLimit } from "../shared.js";
import { LEGACY_AUTH_DEPRECATION } from "../authPolicy.js";

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

export default router;

