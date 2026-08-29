import { Router } from "express";
import { db, admin } from "../shared.js";
import fs from "fs";
import path from "path";

const router = Router();

// GET /api/health — Comprehensive diagnostics for Vercel and local environments
router.get("/api/health", async (req, res) => {
  const startTime = Date.now();
  const checks: Record<string, { status: "ok" | "degraded" | "missing" | "error"; latencyMs?: number; message?: string }> = {};

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
    const hasServiceAccount = fs.existsSync(path.join(process.cwd(), "service-account.json")) || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
    checks.firebaseAdmin = {
      status: isInitialized ? "ok" : "degraded",
      message: `Active apps: ${admin.apps.length}, Service Account: ${hasServiceAccount ? "configured" : "using ADC"}`
    };
  } catch (err: any) {
    checks.firebaseAdmin = { status: "error", message: err.message };
  }

  // 3. Firebase Client Config (firebase-applet-config.json)
  const appletConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  const hasAppletConfig = fs.existsSync(appletConfigPath);
  checks.firebaseClientConfig = {
    status: hasAppletConfig ? "ok" : "degraded",
    message: hasAppletConfig ? "firebase-applet-config.json loaded successfully" : "Using fallback environment variables"
  };

  // 4. ImgBB API Key check
  const hasImgBB = Boolean(process.env.IMGBB_API_KEY?.trim());
  checks.imgbb = {
    status: hasImgBB ? "ok" : "missing",
    message: hasImgBB ? "IMGBB_API_KEY is configured" : "IMGBB_API_KEY is missing from environment. Add it in .env or Vercel Environment Variables."
  };


  // 6. Gemini AI check
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  checks.geminiAi = {
    status: hasGemini ? "ok" : "missing",
    message: hasGemini ? "GEMINI_API_KEY is configured" : "GEMINI_API_KEY is missing from environment"
  };

  // 7. Discord Webhook check
  const hasDiscord = Boolean(process.env.DISCORD_WEBHOOK_TOURNAMENTS || process.env.DISCORD_WEBHOOK_SCRIMS);
  checks.discord = {
    status: hasDiscord ? "ok" : "missing",
    message: hasDiscord ? "Discord webhooks configured" : "Discord webhooks not set (optional)"
  };

  // 8. PostgreSQL / Firebase SQL Connect check
  const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.FIREBASE_SQL_CONNECT_URL);
  checks.postgresql = {
    status: hasDbUrl ? "ok" : "degraded",
    message: hasDbUrl ? "PostgreSQL / Firebase SQL Connect configured" : "DATABASE_URL not set in environment (using hybrid/fallback configuration)"
  };

  const isHealthy = checks.firestore?.status === "ok" && checks.firebaseAdmin?.status !== "error";
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
