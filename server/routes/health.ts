import { Router } from "express";
import { db, admin } from "../shared.js";

const router = Router();

// GET /api/health — Comprehensive diagnostics for Vercel and local environments
router.get("/api/health", async (req, res) => {
  const startTime = Date.now();
  const checks: Record<string, { status: "ok" | "degraded" | "error"; latencyMs?: number; message?: string }> = {};

  // 1. Firestore connectivity check
  try {
    const fsStart = Date.now();
    await db.collection("settings").doc("site").get();
    checks.firestore = { status: "ok", latencyMs: Date.now() - fsStart };
  } catch (err: any) {
    checks.firestore = { status: "error", message: err.message || "Firestore check failed" };
  }

  // 2. Firebase Admin SDK check
  try {
    const isInitialized = admin.apps.length > 0;
    checks.firebaseAdmin = { status: isInitialized ? "ok" : "degraded", message: `Active apps: ${admin.apps.length}` };
  } catch (err: any) {
    checks.firebaseAdmin = { status: "error", message: err.message };
  }

  // 3. Environment Variables check
  const criticalEnv = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "GEMINI_API_KEY",
  ];
  const missingEnv = criticalEnv.filter((key) => !process.env[key]);
  checks.environment = {
    status: missingEnv.length === 0 ? "ok" : "degraded",
    message: missingEnv.length === 0 ? "All critical environment variables present" : `Missing: ${missingEnv.join(", ")}`,
  };

  const isHealthy = Object.values(checks).every((c) => c.status !== "error");
  const overallLatency = Date.now() - startTime;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? "healthy" : "unhealthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    latencyMs: overallLatency,
    checks,
  });
});

export default router;
