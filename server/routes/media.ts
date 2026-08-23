import { Router } from "express";
import {
  db, admin, bucket, authenticateToken, rateLimit, upload,
  mapCategoryToFolder, uploadToCloudinary, uploadBase64ToCloudinary,
  uploadToImgBB, uploadBase64ToImgBB, deleteFromImgBB,
  type ImgBBResult
} from "../shared.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// Helper: try ImgBB → fallback Cloudinary → fallback Firebase Storage
// ponytail: keep Cloudinary/Storage as fallback so existing data stays live during migration
// ═══════════════════════════════════════════════════════════════

interface UploadResult {
  url: string;
  publicId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbUrl: string;
  mediumUrl: string;
  provider: string;
}

const MEDIA_CATEGORIES = new Set([
  "USER_AVATAR", "TEAM_LOGO", "TEAM_BANNER", "ORG_LOGO", "ORG_BANNER",
  "TOURNAMENT_BANNER", "TOURNAMENT_THUMBNAIL", "SCRIM_BANNER", "PRODUCT_IMAGE",
  "NEWS_IMAGE", "SPONSOR_LOGO", "PAYMENT_PROOF", "OVERLAY_GRAPHIC", "OTHER",
]);

function getMediaCategory(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (MEDIA_CATEGORIES.has(upper)) return upper;
  switch (upper) {
    case "AVATARS": case "AVATAR": return "USER_AVATAR";
    case "TEAMS": case "TEAM": return "TEAM_LOGO";
    case "ORGANIZATIONS": case "ORGS": case "ORG": return "ORG_LOGO";
    case "TOURNAMENTS": case "TOURNAMENT": return "TOURNAMENT_BANNER";
    case "SCRIMS": case "SCRIM": return "SCRIM_BANNER";
    case "PRODUCTS": case "PRODUCT": return "PRODUCT_IMAGE";
    case "NEWS": return "NEWS_IMAGE";
    case "SPONSORS": case "SPONSOR": return "SPONSOR_LOGO";
    case "PAYMENTS": case "PAYMENT": return "PAYMENT_PROOF";
    default: return "OTHER";
  }
}

async function uploadBufferMultiProvider(
  buffer: Buffer,
  category: string,
  originalName: string
): Promise<UploadResult> {
  // 1. Try ImgBB (primary)
  try {
    const r: ImgBBResult = await uploadToImgBB(buffer, originalName);
    return {
      url: r.url, publicId: r.deleteUrl, fileName: r.fileName,
      fileSize: r.fileSize, mimeType: r.mimeType,
      thumbUrl: r.thumbUrl, mediumUrl: r.mediumUrl,
      provider: "imgbb",
    };
  } catch (imgbbErr: any) {
    console.warn("[Media] ImgBB upload failed, trying Cloudinary:", imgbbErr.message);
  }

  // 2. Try Cloudinary (fallback)
  try {
    const folder = mapCategoryToFolder(category);
    const c = await uploadToCloudinary(buffer, folder, originalName);
    return {
      url: c.secure_url || c.url, publicId: c.public_id,
      fileName: c.original_filename || originalName,
      fileSize: c.bytes || buffer.length,
      mimeType: c.format ? `image/${c.format}` : "image/jpeg",
      thumbUrl: c.secure_url || c.url,
      mediumUrl: c.secure_url || c.url,
      provider: "cloudinary",
    };
  } catch (cloudErr: any) {
    console.warn("[Media] Cloudinary upload failed, trying Firebase Storage:", cloudErr.message);
  }

  // 3. Firebase Storage (last resort)
  const folder = mapCategoryToFolder(category);
  const fileName = `${Date.now()}_${originalName.replace(/\s+/g, "_")}`;
  const file = bucket.file(`${folder}/${fileName}`);
  await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
  return {
    url: publicUrl, publicId: file.name, fileName, fileSize: buffer.length,
    mimeType: "image/jpeg", thumbUrl: publicUrl, mediumUrl: publicUrl,
    provider: "firebase-storage",
  };
}

async function uploadBase64MultiProvider(
  base64String: string,
  category: string
): Promise<UploadResult> {
  // 1. Try ImgBB (primary)
  try {
    const r: ImgBBResult = await uploadBase64ToImgBB(base64String);
    return {
      url: r.url, publicId: r.deleteUrl, fileName: r.fileName,
      fileSize: r.fileSize, mimeType: r.mimeType,
      thumbUrl: r.thumbUrl, mediumUrl: r.mediumUrl,
      provider: "imgbb",
    };
  } catch (imgbbErr: any) {
    console.warn("[Media] ImgBB base64 upload failed, trying Cloudinary:", imgbbErr.message);
  }

  // 2. Try Cloudinary (fallback)
  try {
    const c = await uploadBase64ToCloudinary(base64String, mapCategoryToFolder(category));
    return {
      url: c.secure_url || c.url, publicId: c.public_id,
      fileName: c.original_filename || `img_${Date.now()}`,
      fileSize: c.bytes || 0,
      mimeType: c.format ? `image/${c.format}` : "image/jpeg",
      thumbUrl: c.secure_url || c.url,
      mediumUrl: c.secure_url || c.url,
      provider: "cloudinary",
    };
  } catch (cloudErr: any) {
    console.warn("[Media] Cloudinary base64 upload failed, trying Firebase Storage:", cloudErr.message);
  }

  // 3. Firebase Storage (last resort)
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const mimeType = matches?.[1] || "image/jpeg";
  const buffer = Buffer.from(matches?.[2] || "", "base64");
  const ext = mimeType.split("/")[1];
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const folder = mapCategoryToFolder(category);
  const file = bucket.file(`${folder}/${fileName}`);
  await file.save(buffer, { metadata: { contentType: mimeType } });
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
  return {
    url: publicUrl, publicId: file.name, fileName, fileSize: buffer.length,
    mimeType, thumbUrl: publicUrl, mediumUrl: publicUrl,
    provider: "firebase-storage",
  };
}

// ═══════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════

// Upload Image (legacy endpoint — kept for backward compat)
// [BUG-026] maintenance-only endpoint — no client callers; kept for legacy/debugging.
router.post("/api/upload-image", authenticateToken, rateLimit(10, 15 * 60 * 1000), upload.single("image"), async (req: any, res) => {
  try {
    const uid = req.user.userId;
    const category = getMediaCategory(req.body.category || "OTHER");
    if (!category) return res.status(400).json({ success: false, message: "Invalid media category" });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const result = await uploadBufferMultiProvider(req.file.buffer, category, req.file.originalname);

    const mediaRef = db.collection("media").doc();
    const mediaData = {
      id: mediaRef.id, userId: uid, url: result.url, publicId: result.publicId,
      thumbUrl: result.thumbUrl, mediumUrl: result.mediumUrl, provider: result.provider,
      fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType,
      category, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // BUG-038: catalog write failure must NOT be swallowed — report it so the
    // client can surface the error instead of showing a success for an
    // untracked (orphaned) cloud asset.
    try {
      await mediaRef.set(mediaData);
    } catch (dbErr: any) {
      console.error("[Database Bypass] media catalog write failed for upload:", dbErr);
      throw new Error("Upload succeeded but media catalog write failed — please retry or contact support");
    }
    res.status(201).json({ success: true, url: result.url, public_id: result.publicId, media: mediaData });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// Dedicated Universal Upload Endpoint
router.post("/api/upload/image", authenticateToken, rateLimit(10, 15 * 60 * 1000), upload.single("image"), async (req: any, res) => {
  try {
    const uid = req.user.userId;
    const category = getMediaCategory(req.body.category || "OTHER");
    if (!category) return res.status(400).json({ success: false, message: "Invalid media category" });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const result = await uploadBufferMultiProvider(req.file.buffer, category, req.file.originalname);

    const mediaRef = db.collection("media").doc();
    const mediaData = {
      id: mediaRef.id, userId: uid, url: result.url, publicId: result.publicId,
      thumbUrl: result.thumbUrl, mediumUrl: result.mediumUrl, provider: result.provider,
      fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType,
      category, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // BUG-038: catalog write failure must NOT be swallowed (see /api/upload-image).
    try {
      await mediaRef.set(mediaData);
    } catch (dbErr: any) {
      console.error("[Database Bypass] media catalog write failed for upload:", dbErr);
      throw new Error("Upload succeeded but media catalog write failed — please retry or contact support");
    }
    return res.status(200).json({ success: true, url: result.url, public_id: result.publicId, media: mediaData });
  } catch (error: any) {
    console.error("[Upload API] Upload failed:", error);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// Secure Media Deletion
async function deleteMediaById(mediaId: string, actor: { userId: string; role: string }) {
  const mediaDoc = await db.collection('media').doc(mediaId).get();
  if (!mediaDoc.exists) throw new Error('MEDIA_NOT_FOUND');

  const mediaData = mediaDoc.data();
  if (actor.role !== 'admin' && mediaData?.userId !== actor.userId) throw new Error('MEDIA_FORBIDDEN');

  const publicId = mediaData?.publicId;
  const provider = mediaData?.provider;
  if (provider === 'imgbb' && typeof publicId === 'string' && publicId.startsWith("http")) {
    const deleted = await deleteFromImgBB(publicId);
    if (!deleted) console.warn("[Media Purge Warn] ImgBB delete_url may be expired or invalid — removing DB reference only");
  } else if (provider === 'firebase-storage' && typeof publicId === 'string') {
    try { await bucket.file(publicId).delete(); } catch (error: any) { console.warn("[Media Purge Warn] Firebase Storage delete failed:", error.message); }
  }

  await mediaDoc.ref.delete();
}

router.post("/api/media/delete", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { mediaId } = req.body;
    if (!mediaId || typeof mediaId !== 'string' || mediaId.length > 128) {
      return res.status(400).json({ success: false, message: "A valid mediaId is required" });
    }
    await deleteMediaById(mediaId, req.user);
    return res.status(200).json({ success: true, message: "Asset reference removed. Physical file deletion depends on provider." });
  } catch (error: any) {
    if (error.message === 'MEDIA_NOT_FOUND') return res.status(404).json({ success: false, message: "Media not found" });
    if (error.message === 'MEDIA_FORBIDDEN') return res.status(403).json({ success: false, message: "Unauthorized — can only delete your own media" });
    console.error("[Media Purge Error]:", error);
    return res.status(500).json({ success: false, message: "Deletion failed" });
  }
});

// Get All Media (admin: all, user: own only)
// [BUG-026] maintenance-only endpoint — no client callers; client uses direct Firestore reads.
router.get("/api/media", authenticateToken, rateLimit(30, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const pageLimit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    let q = db.collection("media").orderBy("createdAt", "desc");
    if (req.user.role !== 'admin') {
      q = db.collection("media").where('userId', '==', req.user.userId).orderBy("createdAt", "desc");
    }
    const mediaSnap = await q.limit(pageLimit + 1).get();
    const docs = mediaSnap.docs.slice(0, pageLimit);
    res.json({ success: true, media: docs.map(doc => ({ id: doc.id, ...doc.data() })), hasMore: mediaSnap.size > pageLimit });
  } catch (error: any) {
    console.error("Fetch media error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Process Base64 Image (used by useInvisibleImage hook)
router.post("/api/process-image", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { base64, folder = "OTHER" } = req.body;
    const uid = req.user.userId;
    const category = getMediaCategory(folder);
    if (!category) return res.status(400).json({ success: false, message: "Invalid media category" });
    if (!base64) return res.status(400).json({ success: false, message: "No image data provided" });

    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return res.status(400).json({ success: false, message: "Invalid base64 format" });

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(mimeType)) return res.status(400).json({ success: false, message: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed." });
    if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ success: false, message: "File size too large. Max 10MB allowed." });

    const result = await uploadBase64MultiProvider(base64, category);

    const mediaRef = db.collection("media").doc();
    const mediaData = {
      id: mediaRef.id, userId: uid, url: result.url, publicId: result.publicId,
      thumbUrl: result.thumbUrl, mediumUrl: result.mediumUrl, provider: result.provider,
      fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType,
      category, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // BUG-038: catalog write failure must NOT be swallowed (see /api/upload-image).
    try {
      await mediaRef.set(mediaData);
    } catch (dbErr: any) {
      console.error("[Database Bypass] media catalog write failed for upload:", dbErr);
      throw new Error("Upload succeeded but media catalog write failed — please retry or contact support");
    }
    return res.status(200).json({ success: true, url: result.url, public_id: result.publicId, media: mediaData });
  } catch (error: any) {
    console.error("Process image error:", error);
    return res.status(500).json({ success: false, message: "Image processing failed" });
  }
});

// Delete media by ID
// [BUG-026] maintenance-only endpoint — no client callers; client uses POST /api/media/delete.
router.delete('/api/media/:id', authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const mediaId = req.params.id;
    if (!mediaId || mediaId.length > 128) return res.status(400).json({ success: false, message: 'Invalid media ID' });
    await deleteMediaById(mediaId, req.user);
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error: any) {
    if (error.message === 'MEDIA_NOT_FOUND') return res.status(404).json({ success: false, message: 'Media not found' });
    if (error.message === 'MEDIA_FORBIDDEN') return res.status(403).json({ success: false, message: 'Unauthorized' });
    console.error('Error deleting media:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
