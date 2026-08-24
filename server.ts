import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { db, authenticateToken, rateLimit } from "./server/shared.js";
import { requireAdmin } from "./server/authz.js";

import authRoutes from "./server/routes/auth.js";
import scrimRoutes from "./server/routes/scrims.js";
import tournamentRoutes from "./server/routes/tournaments.js";
import mediaRoutes from "./server/routes/media.js";
import aiRoutes from "./server/routes/ai.js";
import discordRoutes from "./server/routes/discord.js";
import walletRoutes from "./server/routes/wallet.js";
import adminScrimRoutes from "./server/routes/admin-scrims.js";
import adminMoneyRoutes from "./server/routes/admin-money.js";
import disputesRoutes from "./server/routes/disputes.js";
import teamsRoutes from "./server/routes/teams.js";
import healthRoutes from "./server/routes/health.js";
import { generateSitemapXml, handleIndexNow } from "./server/seo.js";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3005;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  // Centralized error handler — mirrors api/index.ts (BUG-047).
  // Must be registered after all routes and before the Vite middleware so that
  // unhandled async errors don't leave requests hanging in development.
  app.use((err: any, req: any, res: any, _next: any) => {
    console.error("Dev server error:", err);
    const status = err.status || err.statusCode || 500;
    if (!res.headersSent) {
      res.status(status).json({
        success: false,
        message: err.message || "Internal server error"
      });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
