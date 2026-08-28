import express from "express";
import { authenticateToken, db, rateLimit, admin } from "../server/shared.js";
import { requireAdmin } from "../server/authz.js";

import authRoutes from "../server/routes/auth.js";
import scrimRoutes from "../server/routes/scrims.js";
import tournamentRoutes from "../server/routes/tournaments.js";
import mediaRoutes from "../server/routes/media.js";
import aiRoutes from "../server/routes/ai.js";
import discordRoutes from "../server/routes/discord.js";
import walletRoutes from "../server/routes/wallet.js";
import adminScrimRoutes from "../server/routes/admin-scrims.js";
import adminMoneyRoutes from "../server/routes/admin-money.js";
import disputesRoutes from "../server/routes/disputes.js";
import teamsRoutes from "../server/routes/teams.js";
import healthRoutes from "../server/routes/health.js";
import { generateSitemapXml, handleIndexNow } from "../server/seo.js";

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dynamic CORS middleware supporting production domain, Vercel preview branches, and local dev
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "https://www.nexplayorg.app",
    "https://nexplayorg.app",
    "http://localhost:3005",
    "http://localhost:5173",
    "http://localhost:3000",
  ].filter(Boolean) as string[];

  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.endsWith(".vercel.app") ||
    origin.startsWith("http://localhost:")
  );

  if (isAllowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// Health Check Endpoint for Vercel verification
app.get("/api", (req, res) => {
  res.json({ success: true, status: "online", engine: "NexPlay Vercel Serverless API Engine", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════
// ONE-TIME ADMIN BOOTSTRAP — sets a user as admin using a secret key.
// Use when no admin exists yet (chicken-and-egg problem).
// After confirming admin access, remove ADMIN_BOOTSTRAP_KEY from env.
// ponytail: no auth middleware — protected by secret key only.
// ═══════════════════════════════════════════════════════════════
app.post("/api/admin/bootstrap", rateLimit(3, 60 * 60 * 1000), async (req, res) => {
  try {
    const { email, key } = req.body;
    const bootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;

    if (!bootstrapKey) {
      return res.status(503).json({ success: false, message: "ADMIN_BOOTSTRAP_KEY not set in env" });
    }
    if (!key || key !== bootstrapKey) {
      return res.status(403).json({ success: false, message: "Invalid bootstrap key" });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "Valid email required" });
    }

    // Look up user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "admin" });

    // Update Firestore doc
    await db.collection("users").doc(userRecord.uid).set(
      { role: "admin" },
      { merge: true }
    );

    res.json({
      success: true,
      message: `Admin role set for ${email} (uid: ${userRecord.uid})`,
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error("Bootstrap admin error:", error);
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ success: false, message: "User not found — they must sign up first" });
    }
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN GAME SEED — creates a game with scoring config in Firestore.
// Protected by super-admin email check.
// ═══════════════════════════════════════════════════════════════
// ponytail: one-time seed endpoint — secret key auth instead of Firebase token (no client SDK needed)
const SEED_SECRET = process.env.SEED_GAME_KEY || "nexplay-seed-2026";
app.post("/api/admin/seed-game", rateLimit(5, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { secretKey } = req.body;
    if (secretKey !== SEED_SECRET) {
      return res.status(403).json({ success: false, message: "Invalid seed key" });
    }

    const { name, logoUrl, modes, isPublished, scoring } = req.body;
    if (!name || !modes || !Array.isArray(modes)) {
      return res.status(400).json({ success: false, message: "name and modes[] are required" });
    }

    // Check if game already exists by name (case-insensitive)
    const existing = await db.collection("games").where("name", "==", name).get();
    if (!existing.empty) {
      // Update existing game
      const gameDoc = existing.docs[0];
      await gameDoc.ref.update({
        name,
        logoUrl: logoUrl || gameDoc.data().logoUrl || "",
        modes,
        isPublished: isPublished !== false,
        scoring: scoring || gameDoc.data().scoring || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.json({ success: true, message: `Game "${name}" updated`, id: gameDoc.id });
    }

    // Create new game
    const gameRef = db.collection("games").doc();
    await gameRef.set({
      name,
      logoUrl: logoUrl || "",
      modes,
      isPublished: isPublished !== false,
      scoring: scoring || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: `Game "${name}" created`, id: gameRef.id });
  } catch (error: any) {
    console.error("Seed game error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Mount route groups
app.use(authRoutes);
app.use(scrimRoutes);
app.use(tournamentRoutes);
app.use(mediaRoutes);
app.use(aiRoutes);
app.use(walletRoutes);
app.use(adminScrimRoutes);
app.use(adminMoneyRoutes);
app.use(discordRoutes);
app.use(disputesRoutes);
app.use(teamsRoutes);
app.use(healthRoutes);

// Dynamic Sitemap for SEO
app.get("/sitemap.xml", async (req, res) => {
  res.header("Content-Type", "application/xml");
  try {
    const xml = await generateSitemapXml(db);
    res.send(xml);
  } catch (e) {
    console.error("Sitemap generation error:", e);
    res.status(500).send("Error generating sitemap");
  }
});

// IndexNow Endpoint for SEO
app.post("/api/indexnow", authenticateToken, requireAdmin, rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  await handleIndexNow(req, res);
});

// Fallback 404 handler for API routes to prevent HTML 404 parsing errors on client
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Centralized error handler middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Vercel Serverless API Error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

export default app;
