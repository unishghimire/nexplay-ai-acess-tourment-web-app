import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import multer from "multer";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { 'User-Agent': "aistudio-build" } }
});

let filename = process.cwd();
let dirname = process.cwd();
try {
  if (import.meta?.url) {
    filename = fileURLToPath(import.meta.url);
    dirname = path.dirname(filename);
  }
} catch {
  // ESM meta resolution fallback for serverless bundlers
}
export const __filename = filename;
export const __dirname = dirname;

let firebaseConfig: any = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "nexplayorg-app",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "nexplayorg-app.firebasestorage.app",
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || undefined,
};

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    firebaseConfig = { ...firebaseConfig, ...fileConfig };
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json from disk, using fallback/env config:", e);
}

// ═══════════════════════════════════════════════════════════════
// FIREBASE ADMIN INITIALIZATION — production-safe credential handling
// Priority: FIREBASE_SERVICE_ACCOUNT env var → service-account.json file → ADC
// ponytail: file fallback covers local dev + Vercel if env var missing
// ═══════════════════════════════════════════════════════════════
function getFirebaseCredential(): admin.credential.Credential | undefined {
  // 1. Env var (Vercel production — JSON string)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      return admin.credential.cert(JSON.parse(serviceAccountJson));
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT env var is set but invalid JSON:", e);
    }
  }

  // 2. Local file (dev environment)
  const saPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(saPath)) {
    try {
      return admin.credential.cert(saPath);
    } catch (e) {
      console.error("service-account.json exists but is invalid:", e);
    }
  }

  // 3. Fall back to Application Default Credentials (if running on GCP)
  console.warn("Firebase Admin: No explicit credential found, using Application Default Credentials");
  return undefined;
}

const credential = getFirebaseCredential();

// Build app options — only include credential if we have one
const appOptions: admin.AppOptions = {
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
};
if (credential) {
  appOptions.credential = credential;
}

export const firebaseApp = admin.initializeApp(appOptions);

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);
export const bucket = admin.storage().bucket();
export { admin, Type };

export function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary configuration keys are missing from environment variables.");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return cloudinary;
}

export const mapCategoryToFolder = (category: string): string => {
  switch (category) {
    case "USER_AVATAR": return "avatars";
    case "TEAM_LOGO": case "TEAM_BANNER": return "teams";
    case "ORG_LOGO": case "ORG_BANNER": return "organizations";
    case "TOURNAMENT_BANNER": case "TOURNAMENT_THUMBNAIL": return "tournaments";
    case "SCRIM_BANNER": return "scrims";
    case "PRODUCT_IMAGE": return "products";
    case "NEWS_IMAGE": return "news";
    case "SPONSOR_LOGO": return "sponsors";
    case "PAYMENT_PROOF": case "payments": return "payments";
    case "OVERLAY_GRAPHIC": return "system";
    default: return "system";
  }
};

export const uploadToCloudinary = (buffer: Buffer, folder: string, originalName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const c = getCloudinary();
      const cleanName = originalName ? originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_") : `img_${Date.now()}`;
      const stream = c.uploader.upload_stream(
        { folder, public_id: `${Date.now()}_${cleanName}`, fetch_format: "webp", quality: "auto" },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(buffer);
    } catch (err) { reject(err); }
  });
};

export const uploadBase64ToCloudinary = (base64String: string, folder: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const c = getCloudinary();
      c.uploader.upload(base64String, { folder, fetch_format: "webp", quality: "auto" },
        (error, result) => { if (error) reject(error); else resolve(result); });
    } catch (err) { reject(err); }
  });
};

// ═══════════════════════════════════════════════════════════════
// IMGBB — primary image hosting provider
// ponytail: Cloudinary stays as fallback for existing data continuity
// ═══════════════════════════════════════════════════════════════

export interface ImgBBResult {
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  deleteUrl: string;
  imageId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Upload a buffer to ImgBB.
 * ImgBB accepts base64-encoded image data via POST to api.imgbb.com/1/upload
 */
export async function uploadToImgBB(buffer: Buffer, originalName: string): Promise<ImgBBResult> {
  const apiKey = process.env.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY || "0d2e0f9e1bb3f4d0e32ff75d14c11d48";
  if (!apiKey) throw new Error("IMGBB_API_KEY is not configured.");

  const base64 = buffer.toString("base64");
  const cleanName = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_") || `img_${Date.now()}`;

  const formData = new FormData();
  formData.append("image", base64);
  formData.append("name", cleanName);

  const uploadUrl = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
    body: formData,
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    let errMsg = errText;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) errMsg = parsed.error.message;
    } catch {}
    throw new Error(`ImgBB upload failed (${resp.status}): ${errMsg}`);
  }

  const json = await resp.json() as any;
  if (!json?.success || !json?.data) {
    throw new Error(json?.error?.message || "ImgBB returned unexpected response format");
  }

  const d = json.data;
  return {
    url: d.url,
    thumbUrl: d.thumb?.url || d.url,
    mediumUrl: d.medium?.url || d.thumb?.url || d.url,
    deleteUrl: d.delete_url || "",
    imageId: d.id || "",
    fileName: d.title || originalName,
    fileSize: d.size || buffer.length,
    mimeType: d.mime || "image/jpeg",
  };
}

/**
 * Upload a base64 data URI to ImgBB.
 * Strips the data:image/...;base64, prefix before sending.
 */
export async function uploadBase64ToImgBB(base64String: string): Promise<ImgBBResult> {
  const apiKey = process.env.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY || "0d2e0f9e1bb3f4d0e32ff75d14c11d48";
  if (!apiKey) throw new Error("IMGBB_API_KEY is not configured.");

  // Strip data URI prefix if present
  const base64Data = base64String.replace(/^data:[^;]+;base64,/, "");

  const formData = new FormData();
  formData.append("image", base64Data);

  const uploadUrl = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    let errMsg = errText;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) errMsg = parsed.error.message;
    } catch {}
    throw new Error(`ImgBB upload failed (${resp.status}): ${errMsg}`);
  }

  const json = await resp.json() as any;
  if (!json?.success || !json?.data) {
    throw new Error(json?.error?.message || "ImgBB returned unexpected response format");
  }

  const d = json.data;
  return {
    url: d.url,
    thumbUrl: d.thumb?.url || d.url,
    mediumUrl: d.medium?.url || d.thumb?.url || d.url,
    deleteUrl: d.delete_url || "",
    imageId: d.id || "",
    fileName: d.title || `img_${Date.now()}`,
    fileSize: d.size || 0,
    mimeType: d.mime || "image/jpeg",
  };
}

/**
 * Delete an image from ImgBB using the delete_url returned at upload time.
 * ImgBB does NOT support deletion by public ID — only via the delete_url.
 * ponytail: if delete_url is missing or expired, we cannot delete the physical file. Document this limitation.
 */
export async function deleteFromImgBB(deleteUrl: string): Promise<boolean> {
  if (!deleteUrl || !deleteUrl.startsWith("http")) return false;
  try {
    const resp = await fetch(deleteUrl, { method: "GET" });
    return resp.ok;
  } catch {
    return false;
  }
}

export const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");

export const sanitizeHexColor = (value: unknown, fallback: string): string => {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
};

export const truncateText = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;

export function buildTournamentBannerSvg(banner: {
  title: string; game: string; subtitle: string; motif: string; headline: string;
  accentColor: string; secondaryColor: string; backgroundColor: string; glowColor: string;
}) {
  const headline = escapeXml(truncateText(banner.headline || banner.title, 40));
  const title = escapeXml(truncateText(banner.title, 56));
  const game = escapeXml(truncateText(banner.game, 42));
  const subtitle = escapeXml(truncateText(banner.subtitle, 88));
  const motif = escapeXml(truncateText(banner.motif, 24));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="534" viewBox="0 0 1600 534" fill="none">
  <defs>
    <linearGradient id="bg" x1="84" y1="22" x2="1522" y2="510" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${banner.backgroundColor}" />
      <stop offset="52%" stop-color="${banner.secondaryColor}" />
      <stop offset="100%" stop-color="${banner.accentColor}" />
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1600" y2="534" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="32" />
    </filter>
  </defs>
  <rect width="1600" height="534" rx="42" fill="${banner.backgroundColor}" />
  <rect x="0" y="0" width="1600" height="534" rx="42" fill="url(#bg)" />
  <circle cx="1320" cy="92" r="160" fill="${banner.glowColor}" opacity="0.28" filter="url(#blur)" />
  <circle cx="310" cy="438" r="198" fill="${banner.accentColor}" opacity="0.22" filter="url(#blur)" />
  <circle cx="1080" cy="338" r="210" fill="${banner.secondaryColor}" opacity="0.18" filter="url(#blur)" />
  <path d="M0 150C196 92 372 80 548 110C696 136 826 196 984 201C1170 208 1328 154 1600 88V0H0V150Z" fill="url(#sheen)" opacity="0.55" />
  <path d="M0 420C220 346 430 328 614 354C808 382 974 468 1148 476C1340 484 1494 438 1600 392V534H0V420Z" fill="rgba(0,0,0,0.18)" />
  <rect x="74" y="78" width="258" height="54" rx="27" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)" />
  <text x="113" y="113" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3.5">AI GENERATED</text>
  <rect x="74" y="156" width="388" height="22" rx="11" fill="rgba(255,255,255,0.18)" />
  <rect x="74" y="188" width="272" height="12" rx="6" fill="rgba(255,255,255,0.18)" />
  <text x="76" y="300" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="82" font-weight="900" letter-spacing="-2.2">${headline}</text>
  <text x="78" y="362" fill="rgba(255,255,255,0.88)" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700">${title}</text>
  <text x="78" y="412" fill="rgba(255,255,255,0.78)" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="500">${game} · ${subtitle}</text>
  <rect x="78" y="452" width="220" height="12" rx="6" fill="${banner.accentColor}" />
  <text x="78" y="494" fill="rgba(255,255,255,0.7)" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="2.6">${motif.toUpperCase()}</text>
</svg>`;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed."));
  },
});

export const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(token);
    // Custom claims are the single source of truth for role (BUG-030).
    // The Firestore-doc fallback has been REMOVED — run /api/admin/sync-claims
    // before deploying so existing doc-role admins/orgs are migrated to claims.
    // ponytail: super-admin email allowlist — see AuthContext for ceiling/upgrade path.
    const role = decodedIdToken.role || (decodedIdToken.email === 'nexplayorg@gmail.com' ? 'admin' : 'player');
    const username = decodedIdToken.name || decodedIdToken.email?.split("@")[0] || "User";
    req.user = { userId: decodedIdToken.uid, email: decodedIdToken.email, username, role };
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ═══════════════════════════════════════════════════════════════
// RATE LIMITER — simple in-memory,
// ponytail: per-instance, not global — on Vercel serverless each
// function invocation gets its own memory. Ceiling: rate limiting is
// per-cold-start, not global. Upgrade: use Vercel KV or Upstash.
// ═══════════════════════════════════════════════════════════════
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_RATE_LIMIT_ENTRIES = 50_000;

function pruneRateLimitEntries(now: number) {
  if (rateLimitMap.size < MAX_RATE_LIMIT_ENTRIES) return;

  for (const [key, entry] of rateLimitMap) {
    if (entry.resetTime <= now) rateLimitMap.delete(key);
  }
}

export function rateLimit(maxRequests: number = 10, windowMs: number = 15 * 60 * 1000) {
  return (req: any, res: any, next: any) => {
    const now = Date.now();
    pruneRateLimitEntries(now);
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const endpoint = `${req.method || 'UNKNOWN'}:${req.baseUrl || ''}${req.path || ''}`;
    const key = `${clientIp}:${endpoint}`;
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
        return res.status(503).json({ success: false, message: 'Request protection is temporarily at capacity. Please try again shortly.' });
      }
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      res.set({
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(maxRequests - 1),
        'X-RateLimit-Reset': String(Math.ceil((now + windowMs) / 1000)),
      });
      return next();
    }

    entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.set({
      'X-RateLimit-Limit': String(maxRequests),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(entry.resetTime / 1000)),
    });

    if (entry.count > maxRequests) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetTime - now) / 1000))));
      return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
    }

    next();
  };
}
