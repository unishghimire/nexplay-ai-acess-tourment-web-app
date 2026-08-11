import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { db } from "./server/shared.js";

import authRoutes from "./server/routes/auth.js";
import tournamentRoutes from "./server/routes/tournaments.js";
import mediaRoutes from "./server/routes/media.js";
import aiRoutes from "./server/routes/ai.js";
import discordRoutes from "./server/routes/discord.js";
import walletRoutes from "./server/routes/wallet.js";
import { generateSitemapXml, handleIndexNow } from "./server/seo.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Mount route groups
  app.use(authRoutes);
  app.use(tournamentRoutes);
  app.use(mediaRoutes);
  app.use(aiRoutes);
  app.use(walletRoutes);
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
  app.post("/api/indexnow", async (req, res) => {
    await handleIndexNow(req, res);
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
