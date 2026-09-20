import { Router } from "express";
import { db, rateLimit } from "../shared.js";

const router = Router();

// Rate limiter: 60 requests per 15 minutes per IP
const orgRateLimiter = rateLimit(60, 15 * 60 * 1000);

/**
 * Validates and sanitizes external URLs to prevent security vulnerabilities
 * (e.g. javascript:, data:, vbscript: injection).
 */
function sanitizeExternalUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
    return null;
  } catch {
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      try {
        const parsed = new URL(`https://${trimmed}`);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          return parsed.href;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * GET /api/organizations/:id
 * Public read-only endpoint returning sanitized organization profile and public stats.
 * Never exposes private fields (email, phone, balance, wallet, secrets).
 */
router.get("/api/organizations/:id", orgRateLimiter, async (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || id.length > 128) {
    return res.status(400).json({ success: false, message: "Invalid organization ID" });
  }

  try {
    // 1. Try 'organizations' collection
    let orgData: any = null;
    const orgDoc = await db.collection("organizations").doc(id).get();
    if (orgDoc.exists) {
      orgData = orgDoc.data();
    } else {
      // 2. Fallback to 'users_public' collection
      const userPublicDoc = await db.collection("users_public").doc(id).get();
      if (userPublicDoc.exists) {
        const data = userPublicDoc.data();
        if (data?.role === "organizer" || data?.role === "admin" || (data?.orgName && data.orgName.trim() !== "")) {
          orgData = data;
        }
      }
    }

    if (!orgData || orgData.isPublic === false || orgData.status === "suspended" || orgData.orgStatus === "rejected") {
      return res.status(404).json({ success: false, message: "Organization not found" });
    }

    // 3. Compute public statistics from public tournaments
    const tourSnap = await db.collection("tournaments")
      .where("hostUid", "==", id)
      .limit(100)
      .get();

    let runningCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;
    let totalPrizePool = 0;
    let totalSlots = 0;
    let filledSlots = 0;
    let publishedWinners = 0;

    for (const doc of tourSnap.docs) {
      const t = doc.data();
      if (!t.status || ["draft", "cancelled", "pending_funding"].includes(t.status)) continue;

      if (t.status === "live") runningCount++;
      else if (t.status === "upcoming" || t.status === "published") upcomingCount++;
      else if (t.status === "completed") {
        completedCount++;
        if (Array.isArray(t.winners)) publishedWinners += t.winners.length;
      }

      if (typeof t.prizePool === "number" && t.prizePool > 0) totalPrizePool += t.prizePool;
      if (typeof t.slots === "number" && t.slots > 0) totalSlots += t.slots;
      if (typeof t.currentPlayers === "number" && t.currentPlayers > 0) filledSlots += t.currentPlayers;
    }

    const rawSocial = orgData.socialLinks || {
      discord: orgData.discord,
      youtube: orgData.youtube || orgData.youtubeUrl,
      facebook: orgData.facebook,
      instagram: orgData.instagram,
      tiktok: orgData.tiktok,
      twitter: orgData.twitter || orgData.xUrl,
      website: orgData.website
    };

    const sanitized = {
      id,
      name: orgData.orgName || orgData.name || orgData.username || "Organization",
      slug: orgData.slug || orgData.username || id,
      username: orgData.username || orgData.slug || id,
      logoUrl: orgData.logoUrl || orgData.profilePicUrl || null,
      bannerUrl: orgData.bannerUrl || null,
      description: orgData.description || orgData.bio || null,
      tagline: orgData.tagline || orgData.customActivity || null,
      country: orgData.country || null,
      region: orgData.region || "Nepal",
      website: sanitizeExternalUrl(orgData.website),
      socialLinks: {
        discord: sanitizeExternalUrl(rawSocial.discord),
        youtube: sanitizeExternalUrl(rawSocial.youtube),
        facebook: sanitizeExternalUrl(rawSocial.facebook),
        instagram: sanitizeExternalUrl(rawSocial.instagram),
        tiktok: sanitizeExternalUrl(rawSocial.tiktok),
        twitter: sanitizeExternalUrl(rawSocial.twitter),
        website: sanitizeExternalUrl(rawSocial.website)
      },
      isVerified: Boolean(orgData.isVerified),
      isPowerOrganizer: Boolean(orgData.isPowerOrganizer || orgData.isPowerOrg),
      level: typeof orgData.level === "number" ? orgData.level : 1,
      xp: typeof orgData.xp === "number" ? orgData.xp : 0,
      createdAt: orgData.createdAt || null,
      establishedDate: orgData.establishedDate || null,
      publicStats: {
        totalTournaments: runningCount + upcomingCount + completedCount,
        runningTournaments: runningCount,
        upcomingTournaments: upcomingCount,
        completedTournaments: completedCount,
        totalPrizePool,
        totalSlots,
        filledSlots,
        publishedWinners
      }
    };

    return res.json({ success: true, data: sanitized });
  } catch (error: any) {
    console.error("GET /api/organizations/:id error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch organization" });
  }
});

/**
 * GET /api/organizations/:id/tournaments
 * Returns public tournaments for an organization.
 */
router.get("/api/organizations/:id/tournaments", orgRateLimiter, async (req, res) => {
  const { id } = req.params;
  const statusFilter = req.query.status as string;

  if (!id || typeof id !== "string" || id.length > 128) {
    return res.status(400).json({ success: false, message: "Invalid organization ID" });
  }

  try {
    let q = db.collection("tournaments").where("hostUid", "==", id);
    if (statusFilter === "running") {
      q = q.where("status", "==", "live");
    } else if (statusFilter === "upcoming") {
      q = q.where("status", "in", ["upcoming", "published"]);
    } else if (statusFilter === "completed") {
      q = q.where("status", "==", "completed");
    }

    const snap = await q.limit(30).get();
    const tournaments = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((t: any) => !t.status || !["draft", "cancelled", "pending_funding"].includes(t.status));

    return res.json({ success: true, data: tournaments });
  } catch (error: any) {
    console.error("GET /api/organizations/:id/tournaments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch organization tournaments" });
  }
});

export default router;
