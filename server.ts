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
    const staticUrls = ["", "/tournaments", "/scrims", "/games", "/results", "/organizations", "/teams", "/leaderboard", "/about", "/contact", "/privacy", "/terms"];
    let dynamicUrls: string[] = [];
    try {
      const tournamentsSnap = await db.collection("tournaments").limit(50).get();
      tournamentsSnap.forEach(doc => { dynamicUrls.push(`/details/${doc.id}`); });
    } catch (e) { console.error("Sitemap dynamic fetch failed:", e); }

    const allPaths = [...staticUrls, ...dynamicUrls];
    const baseUrl = "https://nexplay.gg";
    const xmlItems = allPaths.map(p => `
    <url>
      <loc>${baseUrl}${p}</loc>
      <changefreq>daily</changefreq>
      <priority>${p === "" ? "1.0" : p.startsWith("/details") ? "0.8" : "0.6"}</priority>
    </url>`).join("");

    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlItems}\n</urlset>`.trim());
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
