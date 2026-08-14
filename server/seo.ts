
export async function generateSitemapXml(db: any): Promise<string> {
  const baseUrl = "https://www.nexplayorg.app";

  interface SitemapUrl {
    loc: string;
    changefreq: string;
    priority: string;
    lastmod?: string;
  }

  // Static URLs
  const staticItems: SitemapUrl[] = [
    { loc: `${baseUrl}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${baseUrl}/tournaments`, changefreq: "daily", priority: "0.9" },
    { loc: `${baseUrl}/scrims`, changefreq: "daily", priority: "0.9" },
    { loc: `${baseUrl}/games`, changefreq: "weekly", priority: "0.9" },
    { loc: `${baseUrl}/organizations`, changefreq: "daily", priority: "0.7" },
    { loc: `${baseUrl}/news`, changefreq: "daily", priority: "0.8" },
    { loc: `${baseUrl}/teams`, changefreq: "daily", priority: "0.7" },
    { loc: `${baseUrl}/leaderboard`, changefreq: "daily", priority: "0.7" },
    { loc: `${baseUrl}/about`, changefreq: "monthly", priority: "0.5" },
    { loc: `${baseUrl}/contact`, changefreq: "monthly", priority: "0.5" },
    { loc: `${baseUrl}/privacy`, changefreq: "monthly", priority: "0.5" },
    { loc: `${baseUrl}/terms`, changefreq: "monthly", priority: "0.5" },
  ];

  const dynamicItems: SitemapUrl[] = [];

  const formatLastMod = (data: any): string => {
    if (!data) return new Date().toISOString();
    const candidate = data.updatedAt || data.created_date || data.createdAt;
    if (candidate) {
      if (typeof candidate.toDate === "function") {
        try { return candidate.toDate().toISOString(); } catch {}
      }
      if (candidate instanceof Date) return candidate.toISOString();
      if (typeof candidate === "string" || typeof candidate === "number") {
        const d = new Date(candidate);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }
    return new Date().toISOString();
  };

  // 1. Tournaments
  try {
    const snap = await db.collection("tournaments").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/tournaments/${doc.id}`,
        changefreq: "daily", priority: "0.9",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e: any) {
    console.error("Sitemap: failed to fetch tournaments:", e);
  }

  // 2. Games
  try {
    const snap = await db.collection("games").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/games/${doc.id}`,
        changefreq: "weekly", priority: "0.9",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e: any) {
    console.error("Sitemap: failed to fetch games:", e);
  }

  // 3. Teams
  try {
    const snap = await db.collection("teams").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/team/${doc.id}`,
        changefreq: "weekly", priority: "0.7",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e: any) {
    console.error("Sitemap: failed to fetch teams:", e);
  }

  // 4. Organizations (users with role === organizer)
  try {
    const snap = await db.collection("users").where("role", "==", "organizer").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/user/${doc.id}`,
        changefreq: "weekly", priority: "0.7",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e: any) {
    console.error("Sitemap: failed to fetch organizations:", e);
  }

  // 5. Posts (org_posts)
  try {
    const snap = await db.collection("org_posts").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/post/${doc.id}`,
        changefreq: "weekly", priority: "0.7",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e: any) {
    console.error("Sitemap: failed to fetch posts:", e);
  }

  const allItems: SitemapUrl[] = [...staticItems, ...dynamicItems];

  const xmlUrls = allItems
    .map((item) => {
      const lastmodTag = item.lastmod ? `\n    <lastmod>${item.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${item.loc}</loc>${lastmodTag}\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlUrls}\n</urlset>`;
}

const INDEXNOW_ORIGIN = 'https://www.nexplayorg.app';

export function isNexplayUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.origin === INDEXNOW_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function handleIndexNow(req: any, res: any): Promise<any> {
  const apiKey = process.env.INDEXNOW_KEY;

  if (!apiKey) {
    console.error("[IndexNow] INDEXNOW_KEY environment variable is not configured.");
    return res.status(503).json({
      error: "IndexNow is not configured."
    });
  }

  const body = (req as any).body || {};
  const { urls } = body;
  if (!urls || !Array.isArray(urls) || urls.length === 0 || urls.length > 100) {
    return res.status(400).json({
      error: "Invalid request body. 'urls' must be a non-empty array of strings."
    });
  }

  const validUrls = urls.filter(isNexplayUrl);

  if (validUrls.length === 0) {
    return res.status(400).json({
      error: "No valid URLs provided. All URLs must start with 'https://www.nexplayorg.app'."
    });
  }

  const payload = {
    host: "nexplayorg.app",
    key: apiKey,
    keyLocation: `https://www.nexplayorg.app/${apiKey}.txt`,
    urlList: validUrls
  };

  try {
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    const status = (response as any).status;
    if (response.ok || status === 200 || status === 202) {
      console.log(`[IndexNow] Successfully submitted ${validUrls.length} URLs. Status: ${status}`);
      return res.status(200).json({
        success: true,
        message: `Successfully submitted ${validUrls.length} URLs to IndexNow`,
        submittedCount: validUrls.length,
        status
      });
    } else {
      console.error(`[IndexNow] Submission failed with status ${status}`);
      return res.status(status >= 400 && status < 600 ? status : 500).json({
        success: false,
        error: `IndexNow API request failed with status ${status}`,
      });
    }
  } catch (err: any) {
    console.error("[IndexNow] Exception during IndexNow request:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to submit URLs to IndexNow API",
      message: "IndexNow submission failed"
    });
  }
}
