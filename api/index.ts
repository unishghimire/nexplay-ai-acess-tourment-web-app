import express from "express";
import { authenticateToken, db, rateLimit } from "../server/shared.js";
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
