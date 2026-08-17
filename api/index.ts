import express from "express";
import { authenticateToken, db, rateLimit, admin } from "../server/shared.js";
import { requireAdmin } from "../server/authz.js";

import authRoutes from "../server/routes/auth.js";
import tournamentRoutes from "../server/routes/tournaments.js";
import mediaRoutes from "../server/routes/media.js";
import aiRoutes from "../server/routes/ai.js";
import discordRoutes from "../server/routes/discord.js";
import walletRoutes from "../server/routes/wallet.js";
import adminScrimRoutes from "../server/routes/admin-scrims.js";
import adminMoneyRoutes from "../server/routes/admin-money.js";
import { generateSitemapXml, handleIndexNow } from "../server/seo.js";

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Mount route groups
app.use(authRoutes);
app.use(tournamentRoutes);
app.use(mediaRoutes);
app.use(aiRoutes);
app.use(walletRoutes);
app.use(adminScrimRoutes);
app.use(adminMoneyRoutes);
app.use(discordRoutes);

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
