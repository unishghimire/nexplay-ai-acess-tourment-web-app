import { Request, Response } from "express";

export async function generateSitemapXml(db: any): Promise<string> {
  const baseUrl = "https://nexplayorg.app";

  interface SitemapUrl {
    loc: string;
    changefreq: string;
    priority: string;
    lastmod?: string;
  }

  // Static URLs with appropriate priorities and change frequencies
  const staticItems: SitemapUrl[] = [
    { loc: `${baseUrl}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${baseUrl}/tournaments`, changefreq: "daily", priority: "0.9" },
    { loc: `${baseUrl}/scrims`, changefreq: "daily", priority: "0.9" },
    { loc: `${baseUrl}/games`, changefreq: "weekly", priority: "0.9" },
    { loc: `${baseUrl}/results`, changefreq: "daily", priority: "0.7" },
    { loc: `${baseUrl}/organizations`, changefreq: "daily", priority: "0.7" },
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
        try {
          return candidate.toDate().toISOString();
        } catch {
          // ignore error and try other conversions
        }
      }
      if (candidate instanceof Date) {
        return candidate.toISOString();
      }
      if (typeof candidate === "string" || typeof candidate === "number") {
        const d = new Date(candidate);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }
    return new Date().toISOString();
  };

  // 1. Dynamic tournaments (/details/:id)
  try {
    const snap = await db.collection("tournaments").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/details/${doc.id}`,
        changefreq: "daily",
        priority: "0.9",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e) {
    console.error("Sitemap: failed to fetch tournaments:", e);
  }

  // 2. Dynamic games (/games/:id)
  try {
    const snap = await db.collection("games").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/games/${doc.id}`,
        changefreq: "weekly",
        priority: "0.9",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e) {
    console.error("Sitemap: failed to fetch games:", e);
  }

  // 3. Public teams (/team/:id)
  try {
    const snap = await db.collection("teams").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/team/${doc.id}`,
        changefreq: "weekly",
        priority: "0.7",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e) {
    console.error("Sitemap: failed to fetch teams:", e);
  }

  // 4. Public organizations (/organization/:id) - users with role === organizer
  try {
    const snap = await db.collection("users").where("role", "==", "organizer").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/organization/${doc.id}`,
        changefreq: "weekly",
        priority: "0.7",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e) {
    console.error("Sitemap: failed to fetch organizations:", e);
  }

  // 5. Public posts (/post/:id)
  try {
    const snap = await db.collection("posts").get();
    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      dynamicItems.push({
        loc: `${baseUrl}/post/${doc.id}`,
        changefreq: "weekly",
        priority: "0.7",
        lastmod: formatLastMod(data),
      });
    });
  } catch (e) {
    console.error("Sitemap: failed to fetch posts:", e);
  }

  const allItems: SitemapUrl[] = [...staticItems, ...dynamicItems];

  const xmlUrls = allItems
    .map((item) => {
      const lastmodTag = item.lastmod ? `\n    <lastmod>${item.lastmod}</lastmod>` : "";
      return `  <url>
    <loc>${item.loc}</loc>${lastmodTag}
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlUrls}\n</urlset>`;
}

export async function handleIndexNow(req: Request, res: Response): Promise<any> {
  const apiKey = process.env.INDEXNOW_KEY;

  if (!apiKey) {
    console.error("[IndexNow] INDEXNOW_KEY environment variable is not configured.");
    return res.status(503).json({
      error: "IndexNow key is not configured. Set INDEXNOW_KEY environment variable."
    });
  }

  const { urls } = req.body || {};
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      error: "Invalid request body. 'urls' must be a non-empty array of strings."
    });
  }

  const validUrls = urls.filter(
    (url: any) => typeof url === "string" && url.startsWith("https://nexplayorg.app")
  );

  if (validUrls.length === 0) {
    return res.status(400).json({
      error: "No valid URLs provided. All URLs must start with 'https://nexplayorg.app'."
    });
  }

  const payload = {
    host: "nexplayorg.app",
    key: apiKey,
    keyLocation: `https://nexplayorg.app/${apiKey}.txt`,
    urlList: validUrls
  };

  try {
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (response.ok || response.status === 200 || response.status === 202) {
      console.log(`[IndexNow] Successfully submitted ${validUrls.length} URLs to IndexNow. Status: ${response.status}`);
      return res.status(200).json({
        success: true,
        message: `Successfully submitted ${validUrls.length} URLs to IndexNow`,
        submittedCount: validUrls.length,
        status: response.status
      });
    } else {
      const responseText = await response.text();
      console.error(`[IndexNow] Submission failed with status ${response.status}: ${responseText}`);
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 500).json({
        success: false,
        error: `IndexNow API request failed with status ${response.status}`,
        details: responseText
      });
    }
  } catch (err: any) {
    console.error("[IndexNow] Exception during IndexNow request:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to submit URLs to IndexNow API",
      message: err.message || String(err)
    });
  }
}
