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
    const c = await uploadBase64ToCloudinary(base64String, category);
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
router.post("/api/upload-image", authenticateToken, rateLimit(10, 15 * 60 * 1000), upload.single("image"), async (req: any, res) => {
  try {
    const uid = req.user.userId;
    const category = req.body.category || "OTHER";
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const result = await uploadBufferMultiProvider(req.file.buffer, category, req.file.originalname);

    const mediaRef = db.collection("media").doc();
    const mediaData = {
      id: mediaRef.id, userId: uid, url: result.url, publicId: result.publicId,
      thumbUrl: result.thumbUrl, mediumUrl: result.mediumUrl, provider: result.provider,
      fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType,
      category, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    try { await mediaRef.set(mediaData); } catch (dbErr) { console.warn("[Database Bypass]", dbErr); }
    res.status(201).json({ success: true, url: result.url, public_id: result.publicId, media: mediaData });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Dedicated Universal Upload Endpoint
router.post("/api/upload/image", authenticateToken, rateLimit(10, 15 * 60 * 1000), upload.single("image"), async (req: any, res) => {
  try {
    const uid = req.user.userId;
    const category = req.body.category || "OTHER";
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const result = await uploadBufferMultiProvider(req.file.buffer, category, req.file.originalname);

    const mediaRef = db.collection("media").doc();
    const mediaData = {
      id: mediaRef.id, userId: uid, url: result.url, publicId: result.publicId,
      thumbUrl: result.thumbUrl, mediumUrl: result.mediumUrl, provider: result.provider,
      fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType,
      category, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    try { await mediaRef.set(mediaData); } catch (dbErr) { console.warn("[Database Bypass]", dbErr); }
    return res.status(200).json({ success: true, url: result.url, public_id: result.publicId, media: mediaData });
  } catch (error: any) {
    console.error("[Upload API] Upload failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Upload failed" });
  }
});

// Secure Media Deletion
router.post("/api/media/delete", authenticateToken, async (req: any, res) => {
  try {
    const { mediaId, publicId } = req.body;
    if (!publicId && !mediaId) return res.status(400).json({ success: false, message: "Missing mediaId or publicId" });

    // Authorization: admin can delete any, others can only delete their own uploads
    if (req.user.role !== 'admin' && mediaId) {
      const mediaDoc = await db.collection('media').doc(mediaId).get();
      if (mediaDoc.exists && mediaDoc.data()?.userId !== req.user.userId) {
        return res.status(403).json({ success: false, message: "Unauthorized — can only delete your own media" });
      }
    }

    // Try ImgBB deletion first (delete_url stored as publicId for imgbb provider)
    if (publicId && publicId.startsWith("http")) {
      const deleted = await deleteFromImgBB(publicId);
      if (!deleted) console.warn("[Media Purge Warn] ImgBB delete_url may be expired or invalid — removing DB reference only");
    } else if (publicId && publicId.includes("/")) {
      // Firebase Storage path
      try { await bucket.file(publicId).delete(); } catch (e: any) { console.warn("[Media Purge Warn] Firebase Storage delete failed:", e.message); }
    }

    // Always remove the Firestore catalog entry
    if (mediaId) {
      try { await db.collection("media").doc(mediaId).delete(); } catch (e: any) { console.warn("[Media Purge Warn] Firestore delete failed:", e.message); }
    }

    return res.status(200).json({ success: true, message: "Asset reference removed. Physical file deletion depends on provider." });
  } catch (error: any) {
    console.error("[Media Purge Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Deletion failed" });
  }
});

// Get All Media (admin: all, user: own only)
router.get("/api/media", authenticateToken, async (req: any, res) => {
  try {
    let q = db.collection("media").orderBy("createdAt", "desc");
    if (req.user.role !== 'admin') {
      q = db.collection("media").where('userId', '==', req.user.userId).orderBy("createdAt", "desc");
    }
    const mediaSnap = await q.get();
    res.json({ success: true, media: mediaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error: any) {
    console.error("Fetch media error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Process Base64 Image (used by useInvisibleImage hook)
router.post("/api/process-image", authenticateToken, async (req: any, res) => {
  try {
    const { base64, folder = "gallery" } = req.body;
    const uid = req.user.userId;
    if (!base64) return res.status(400).json({ success: false, message: "No image data provided" });

    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return res.status(400).json({ success: false, message: "Invalid base64 format" });

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(mimeType)) return res.status(400).json({ success: false, message: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed." });
    if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ success: false, message: "File size too large. Max 10MB allowed." });

    const result = await uploadBase64MultiProvider(base64, folder);

    const mediaRef = db.collection("media").doc();
    const mediaData = {
      id: mediaRef.id, userId: uid, url: result.url, publicId: result.publicId,
      thumbUrl: result.thumbUrl, mediumUrl: result.mediumUrl, provider: result.provider,
      fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType,
      category: folder, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    try { await mediaRef.set(mediaData); } catch (dbErr) { console.warn("[Database Bypass]", dbErr); }
    return res.status(200).json({ success: true, url: result.url, public_id: result.publicId, media: mediaData });
  } catch (error: any) {
    console.error("Process image error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Delete media by ID
router.delete('/api/media/:id', authenticateToken, async (req: any, res) => {
  try {
    const mediaId = req.params.id;
    const mediaDoc = await db.collection('media').doc(mediaId).get();
    if (!mediaDoc.exists) return res.status(404).json({ success: false, message: 'Media not found' });
    const mediaData = mediaDoc.data();
    if (mediaData?.userId !== req.user.userId) return res.status(403).json({ success: false, message: 'Unauthorized' });

    // Try ImgBB deletion if delete_url is available
    if (mediaData?.publicId && mediaData.publicId.startsWith("http")) {
      await deleteFromImgBB(mediaData.publicId).catch(() => {});
    }

    await db.collection('media').doc(mediaId).delete();
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
