import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Use service account from env on Vercel/serverless; fall back to ADC for local dev
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
const credential = serviceAccountJson
  ? admin.credential.cert(JSON.parse(serviceAccountJson))
  : undefined;

export const firebaseApp = admin.initializeApp({
  credential,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
});

export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const bucket = admin.storage().bucket();
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing.");
}

export { admin, jwt, bcrypt, Type };

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
    try {
      const decodedIdToken = await admin.auth().verifyIdToken(token);
      if (decodedIdToken) {
        // Prefer custom claims for role (set via admin.auth().setCustomUserClaims)
        // Fall back to Firestore doc only during migration period
        // ponytail: dual-check during migration from doc-based to claims-based roles
        let role = decodedIdToken.role || "player";
        let username = decodedIdToken.name || decodedIdToken.email?.split("@")[0] || "User";
        if (!decodedIdToken.role) {
          try {
            const userDoc = await db.collection("users").doc(decodedIdToken.uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData) { role = userData.role || "player"; username = userData.username || username; }
            }
          } catch (e) { console.error("Firestore user fetch error in auth middleware", e); }
        }
        req.user = { userId: decodedIdToken.uid, email: decodedIdToken.email, username, role };
        return next();
      }
    } catch (firebaseErr) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        req.user = { userId: decoded.uid, email: decoded.email, username: decoded.username, role: decoded.role };
        return next();
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Invalid token" });
      }
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};


// ═══════════════════════════════════════════════════════════════
// RATE LIMITER — simple in-memory, no dependency
// ponytail: single-instance rate limiting; for multi-instance, use Redis-backed limiter
// ═══════════════════════════════════════════════════════════════
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 10, windowMs: number = 15 * 60 * 1000) {
  return (req: any, res: any, next: any) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
    }
    next();
  };
}
