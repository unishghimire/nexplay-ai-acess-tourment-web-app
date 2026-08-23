import { Router } from "express";
import { db, admin, ai, Type, authenticateToken, rateLimit, sanitizeHexColor, buildTournamentBannerSvg, uploadBase64ToCloudinary } from "../shared.js";
import { MAX_AUDIT_HTML_BYTES, SafeUrlFetchError, fetchPublicHtml } from "../safeUrlFetch.js";

const router = Router();
const MAX_BANNER_TITLE_LENGTH = 120;
const MAX_BANNER_GAME_LENGTH = 80;
const MAX_BANNER_CONTEXT_LENGTH = 80;
const MAX_AUDIT_DISCUSSION_LENGTH = 4_000;
const MAX_AUDIT_CONTEXT_BYTES = 60_000;

function optionalText(value: unknown, maxLength: number, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

// Generate Banner
router.post("/api/generate-banner", authenticateToken, rateLimit(5, 15 * 60 * 1000), async (req: any, res: any) => {
  try {
    // ponytail: AI endpoints cost money (Gemini API) — restrict to organizers+admins
    if (req.user.role !== 'admin' && req.user.role !== 'organizer') {
      return res.status(403).json({ success: false, message: "Organizer or admin access required" });
    }
    const { title, game, type, tournamentType, entryFee, prizePool, theme, mood } = req.body || {};
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanGame = typeof game === "string" ? game.trim() : "";
    if (!cleanTitle || !cleanGame) return res.status(400).json({ success: false, message: "Title and game are required." });
    if (cleanTitle.length > MAX_BANNER_TITLE_LENGTH || cleanGame.length > MAX_BANNER_GAME_LENGTH) {
      return res.status(400).json({ success: false, message: "Title or game name is too long." });
    }

    const cleanType = optionalText(type, MAX_BANNER_CONTEXT_LENGTH, "Tournament");
    const cleanTournamentType = optionalText(tournamentType, MAX_BANNER_CONTEXT_LENGTH, "tournament");
    const cleanTheme = optionalText(theme, MAX_BANNER_CONTEXT_LENGTH, "competitive");
    const cleanMood = optionalText(mood, MAX_BANNER_CONTEXT_LENGTH, "high-energy");
    const cleanEntryFee = typeof entryFee === "number" && Number.isFinite(entryFee) ? entryFee : 0;
    const cleanPrizePool = typeof prizePool === "number" && Number.isFinite(prizePool) ? prizePool : 0;

    const prompt = `Create a concise esports banner concept for a tournament.
Return only JSON with: headline, subtitle, motif, accentColor, secondaryColor, backgroundColor, glowColor.
Rules: use short high-impact text only, no markdown, no code fences, no extra commentary.
Context: title=${cleanTitle}; game=${cleanGame}; type=${cleanType}; tournamentType=${cleanTournamentType}; entryFee=${cleanEntryFee}; prizePool=${cleanPrizePool}; theme=${cleanTheme}; mood=${cleanMood}.`;

    let aiResult: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
      subtitle: optionalText(aiResult?.subtitle, 160, `Entry fee ${cleanEntryFee} · Prize pool ${cleanPrizePool}`),
      motif: optionalText(aiResult?.motif, 80, cleanMood || "NEON ARENA"),
      headline: optionalText(aiResult?.headline, 120, cleanTitle),
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
    return res.status(500).json({ success: false, message: "Banner generation failed" });
  }
});

// Web Page Auditor
// [BUG-026] maintenance-only endpoint — no client callers; kept for ops/debugging.
router.post("/api/audit", authenticateToken, rateLimit(3, 15 * 60 * 1000), async (req: any, res: any) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'organizer') {
      return res.status(403).json({ success: false, message: "Organizer or admin access required" });
    }
    const { url, htmlContents } = req.body || {};
    let finalHtml = "";
    let targetUrl = "Direct Paste";

    if (typeof htmlContents === 'string' && htmlContents.trim().length > 0) {
      if (Buffer.byteLength(htmlContents, 'utf8') > MAX_AUDIT_HTML_BYTES) {
        return res.status(413).json({ success: false, message: `HTML source exceeds the ${MAX_AUDIT_HTML_BYTES}-byte audit limit.` });
      }
      finalHtml = htmlContents;
    } else if (typeof url === 'string' && url.trim()) {
      try {
        const fetched = await fetchPublicHtml(url.trim());
        finalHtml = fetched.html;
        targetUrl = fetched.url;
      } catch (error: unknown) {
        const message = error instanceof SafeUrlFetchError ? error.message : "Unable to fetch the requested public website";
        return res.status(error instanceof SafeUrlFetchError ? error.statusCode : 400).json({
          success: false,
          message: `${message}. Please paste the page HTML directly under the Custom HTML option.`,
        });
      }
    } else {
      return res.status(400).json({ success: false, message: "Either a website URL or direct HTML source is required." });
    }

    if (!finalHtml || finalHtml.trim().length === 0) return res.status(400).json({ success: false, message: "No HTML content was extracted to audit." });

    const truncatedHtml = finalHtml;
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
      model: "gemini-2.5-flash",
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
    return res.status(500).json({ success: false, message: "Audit failed. Please try again." });
  }
});

// Audit Discussion
// [BUG-026] maintenance-only endpoint — no client callers; kept for ops/debugging.
router.post("/api/audit/discuss", authenticateToken, rateLimit(5, 15 * 60 * 1000), async (req: any, res: any) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'organizer') {
      return res.status(403).json({ success: false, message: "Organizer or admin access required" });
    }
    const { message, context } = req.body || {};
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ success: false, message: "Message is required." });
    if (message.length > MAX_AUDIT_DISCUSSION_LENGTH) return res.status(400).json({ success: false, message: "Message is too long." });

    const serializedContext = JSON.stringify(context ?? {});
    if (Buffer.byteLength(serializedContext, "utf8") > MAX_AUDIT_CONTEXT_BYTES) {
      return res.status(413).json({ success: false, message: "Audit context is too large." });
    }

    const systemPrompt = `You are a Senior Web Development QA Expert continuing a discussion about a web page audit.
The user previously received an audit report and now has follow-up questions.
Use the audit context provided to give specific, technical, and actionable advice.
Be concise and direct. Reference specific audit findings when relevant.`;

    const userPrompt = `Audit Context: ${serializedContext}\n\nUser Question: ${message.trim()}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: { systemInstruction: systemPrompt, responseMimeType: "application/json" },
    });

    const result = JSON.parse(response.text || "{}");
    return res.status(200).json({ success: true, response: result });
  } catch (error: any) {
    console.error("Audit discuss error:", error);
    return res.status(500).json({ success: false, message: "Discussion failed." });
  }
});

export default router;
