import { Router } from "express";
import { db, admin, ai, Type, authenticateToken, sanitizeHexColor, buildTournamentBannerSvg, uploadBase64ToCloudinary } from "../shared.js";

const router = Router();

// Generate Banner
router.post("/api/generate-banner", authenticateToken, async (req: any, res: any) => {
  try {
    const { title, game, type, tournamentType, entryFee, prizePool, theme, mood } = req.body || {};
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanGame = typeof game === "string" ? game.trim() : "";
    if (!cleanTitle || !cleanGame) return res.status(400).json({ success: false, message: "Title and game are required." });

    const prompt = `Create a concise esports banner concept for a tournament.
Return only JSON with: headline, subtitle, motif, accentColor, secondaryColor, backgroundColor, glowColor.
Rules: use short high-impact text only, no markdown, no code fences, no extra commentary.
Context: title=${cleanTitle}; game=${cleanGame}; type=${typeof type === "string" ? type : "Tournament"}; tournamentType=${typeof tournamentType === "string" ? tournamentType : "tournament"}; entryFee=${typeof entryFee === "number" ? entryFee : 0}; prizePool=${typeof prizePool === "number" ? prizePool : 0}; theme=${typeof theme === "string" ? theme : "competitive"}; mood=${typeof mood === "string" ? mood : "high-energy"}.`;

    let aiResult: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["headline", "subtitle", "motif", "accentColor", "secondaryColor", "backgroundColor", "glowColor"],
            properties: {
              headline: { type: Type.STRING }, subtitle: { type: Type.STRING }, motif: { type: Type.STRING },
              accentColor: { type: Type.STRING }, secondaryColor: { type: Type.STRING },
              backgroundColor: { type: Type.STRING }, glowColor: { type: Type.STRING }
            }
          }
        }
      });
      aiResult = JSON.parse(response.text || "{}");
    } catch (aiError: any) {
      console.warn("[Banner Generator] Gemini generation failed, using deterministic fallback:", aiError.message);
    }

    const bannerConfig = {
      title: cleanTitle, game: cleanGame,
      subtitle: typeof aiResult?.subtitle === "string" && aiResult.subtitle.trim() ? aiResult.subtitle.trim() : `Entry fee ${typeof entryFee === "number" ? entryFee : 0} · Prize pool ${typeof prizePool === "number" ? prizePool : 0}`,
      motif: typeof aiResult?.motif === "string" && aiResult.motif.trim() ? aiResult.motif.trim() : typeof mood === "string" && mood.trim() ? mood.trim() : "NEON ARENA",
      headline: typeof aiResult?.headline === "string" && aiResult.headline.trim() ? aiResult.headline.trim() : cleanTitle,
      accentColor: sanitizeHexColor(aiResult?.accentColor, "#ff6b00"),
      secondaryColor: sanitizeHexColor(aiResult?.secondaryColor, "#7c3aed"),
      backgroundColor: sanitizeHexColor(aiResult?.backgroundColor, "#111827"),
      glowColor: sanitizeHexColor(aiResult?.glowColor, "#22d3ee"),
    };

    const svg = buildTournamentBannerSvg(bannerConfig);
    const base64Svg = Buffer.from(svg, "utf-8").toString("base64");
    const result = await uploadBase64ToCloudinary(`data:image/svg+xml;base64,${base64Svg}`, "tournaments");

    const publicUrl = result.secure_url || result.url;
    const publicId = result.public_id || "";
    const mediaRef = db.collection("media").doc();
    const mediaData = {
      id: mediaRef.id, userId: req.user.userId, url: publicUrl, publicId,
      fileName: `${cleanTitle.replace(/[^a-zA-Z0-9]/g, "_") || "tournament"}_banner.svg`,
      fileSize: Buffer.byteLength(svg, "utf-8"), mimeType: "image/svg+xml",
      category: "TOURNAMENT_BANNER", createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    try { await mediaRef.set(mediaData); } catch (dbErr) { console.warn("[Banner Generator] Media catalog write failed:", dbErr); }
    return res.status(200).json({ success: true, url: publicUrl, public_id: publicId, media: mediaData, banner: bannerConfig });
  } catch (error: any) {
    console.error("[Banner Generator] Failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Banner generation failed" });
  }
});

// Web Page Auditor
router.post("/api/audit", async (req: any, res: any) => {
  try {
    const { url, htmlContents } = req.body;
    let finalHtml = "";
    let targetUrl = url || "Direct Paste";

    if (htmlContents && htmlContents.trim().length > 0) {
      finalHtml = htmlContents;
    } else if (url) {
      try { new URL(url); } catch (e) { return res.status(400).json({ success: false, message: "Invalid URL format" }); }
      try {
        const fetchRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          signal: AbortSignal.timeout(10000),
        });
        if (!fetchRes.ok) return res.status(400).json({ success: false, message: `Failed to fetch web page. HTTP Status: ${fetchRes.status} ${fetchRes.statusText}` });
        finalHtml = await fetchRes.text();
      } catch (err: any) {
        return res.status(400).json({ success: false, message: `Network error or timeout trying to fetch "${url}": ${err.message || err}. Please paste the page HTML directly under the Custom HTML option.` });
      }
    } else {
      return res.status(400).json({ success: false, message: "Either a website URL or direct HTML source is required." });
    }

    if (!finalHtml || finalHtml.trim().length === 0) return res.status(400).json({ success: false, message: "No HTML content was extracted to audit." });

    const truncatedHtml = finalHtml.slice(0, 120000);
    const systemPrompt = `You are a world-class Web Development QA & Auditing Engine.
Analyze the provided HTML source code and perform a thorough audit across four critical pillars:
1. SEO (Search Engine Optimization)
2. Accessibility (A11y / WCAG)
3. Security (Web safety and best practices)
4. Performance & Best HTML Practices

You must return a rigorous JSON evaluation object with detailed, specific lines of code references (if identifiable) and practical, step-by-step fix recommendations.
Be direct, detailed, and highly technical. Never generate fake boilerplate findings; find actual issues in the code or highlight compliance if the section is superb.`;

    const userPrompt = `Audit the following HTML content for the resource: ${targetUrl}\n\nHTML CONTENT:\n\`\`\`html\n${truncatedHtml}\n\`\`\`\n\nAnalyze the code and return a JSON response adhering EXACTLY to the specified schema format. Ensure the response is valid parseable JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["score", "metadata", "issues", "recommendations"],
          properties: {
            score: { type: Type.INTEGER, description: "Overall health score from 0 to 100 based on findings (100 being pristine, subtracting 5-15 points per critical error, 2-5 per warning)." },
            metadata: {
              type: Type.OBJECT,
              required: ["title", "description", "h1s", "wordCount", "headingsStructure"],
              properties: {
                title: { type: Type.STRING, description: "Extracted <title> tag text or 'None'" },
                description: { type: Type.STRING, description: "Extracted meta description or 'None'" },
                h1s: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of H1 content found" },
                wordCount: { type: Type.INTEGER, description: "Estimated visible word count" },
                headingsStructure: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Chronological sequence of headings found, with prefix indicating level (e.g. 'H1: Welcome')" },
              },
            },
            issues: {
              type: Type.ARRAY,
              description: "Detailed issues list",
              items: {
                type: Type.OBJECT,
                required: ["category", "severity", "title", "description", "recommendation", "location"],
                properties: {
                  category: { type: Type.STRING, description: "Category of error: 'SEO', 'Accessibility', 'Security', or 'Best Practices'" },
                  severity: { type: Type.STRING, description: "Criticality: 'critical', 'warning', or 'info'" },
                  title: { type: Type.STRING, description: "Short descriptive error title" },
                  description: { type: Type.STRING, description: "Detailed description of the issue found" },
                  recommendation: { type: Type.STRING, description: "Step-by-step fix recommendation" },
                  location: { type: Type.STRING, description: "Line number, element, or CSS selector if identifiable; otherwise 'Global'" },
                },
              },
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "General high-priority recommendations summarizing what to fix first.",
            },
          },
        },
      },
    });

    const auditResult = JSON.parse(response.text || "{}");
    return res.status(200).json({ success: true, audit: auditResult });
  } catch (error: any) {
    console.error("Audit error:", error);
    return res.status(500).json({ success: false, message: error.message || "Audit failed. Please try again." });
  }
});

// Audit Discussion
router.post("/api/audit/discuss", async (req: any, res: any) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ success: false, message: "Message is required." });

    const systemPrompt = `You are a Senior Web Development QA Expert continuing a discussion about a web page audit.
The user previously received an audit report and now has follow-up questions.
Use the audit context provided to give specific, technical, and actionable advice.
Be concise and direct. Reference specific audit findings when relevant.`;

    const userPrompt = `Audit Context: ${JSON.stringify(context)}\n\nUser Question: ${message}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: { systemInstruction: systemPrompt, responseMimeType: "application/json" },
    });

    const result = JSON.parse(response.text || "{}");
    return res.status(200).json({ success: true, response: result });
  } catch (error: any) {
    console.error("Audit discuss error:", error);
    return res.status(500).json({ success: false, message: error.message || "Discussion failed." });
  }
});

export default router;
