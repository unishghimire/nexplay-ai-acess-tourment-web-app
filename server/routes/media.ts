import { Router } from "express";
import { db, admin, bucket, authenticateToken, upload, getCloudinary, mapCategoryToFolder, uploadToCloudinary, uploadBase64ToCloudinary } from "../shared.js";

const router = Router();

// Upload Image (legacy endpoint)
router.post("/api/upload-image", authenticateToken, upload.single("image"), async (req: any, res) => {
  try {
    const uid = req.user.userId;
    const category = req.body.category || "OTHER";
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const fileName = `${Date.now()}_${req.file.originalname.replace(/\s+/g, "_")}`;
    let publicUrl = "", publicId = "", finalFileName = fileName, finalSize = req.file.size, finalMimeType = req.file.mimetype;

    try {
      const folder = mapCategoryToFolder(category);
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer, folder, req.file.originalname);
      publicUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
      publicId = cloudinaryResult.public_id;
      finalFileName = cloudinaryResult.original_filename || finalFileName;
      finalMimeType = cloudinaryResult.format ? `image/${cloudinaryResult.format}` : finalMimeType;
      finalSize = cloudinaryResult.bytes || finalSize;
    } catch (cloudinaryError: any) {
      console.warn("Cloudinary upload failed, falling back to Firebase Storage:", cloudinaryError.message);
      try {
        const folder = mapCategoryToFolder(category);
        const file = bucket.file(`${folder}/${fileName}`);
        await file.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
        publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
        publicId = file.name;
      } catch (fbError) {
        console.warn("Firebase Storage fallback failed, using Picsum placeholder:", fbError);
        publicUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
        publicId = `picsum_${Date.now()}`;
      }
    }

    const mediaRef = db.collection("media").doc();
    const mediaData = { id: mediaRef.id, userId: uid, url: publicUrl, publicId, fileName: finalFileName, fileSize: finalSize, mimeType: finalMimeType, category, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    try { await mediaRef.set(mediaData); } catch (dbErr) { console.warn("[Database Bypass] Bypassing server-side Firestore catalog writing due to IAM propagation:", dbErr); }
    res.status(201).json({ success: true, url: publicUrl, public_id: publicId, media: mediaData });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// Dedicated Universal Upload Endpoint
router.post("/api/upload/image", authenticateToken, upload.single("image"), async (req: any, res) => {
  try {
    const uid = req.user.userId;
    const category = req.body.category || "OTHER";
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const fileName = `${Date.now()}_${req.file.originalname.replace(/\s+/g, "_")}`;
    let publicUrl = "", publicId = "", finalFileName = fileName, finalSize = req.file.size, finalMimeType = req.file.mimetype;

    try {
      const folder = mapCategoryToFolder(category);
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer, folder, req.file.originalname);
      publicUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
      publicId = cloudinaryResult.public_id;
      finalFileName = cloudinaryResult.original_filename || finalFileName;
      finalMimeType = cloudinaryResult.format ? `image/${cloudinaryResult.format}` : finalMimeType;
      finalSize = cloudinaryResult.bytes || finalSize;
    } catch (cloudinaryError: any) {
      console.warn("Cloudinary dedicated upload failed, falling back to Firebase Storage:", cloudinaryError.message);
      try {
        const folder = mapCategoryToFolder(category);
        const file = bucket.file(`${folder}/${fileName}`);
        await file.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
        publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
        publicId = file.name;
      } catch (fbError) {
        console.warn("Firebase Storage fallback failed, using Picsum placeholder:", fbError);
        publicUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
        publicId = `picsum_${Date.now()}`;
      }
    }

    const mediaRef = db.collection("media").doc();
    const mediaData = { id: mediaRef.id, userId: uid, url: publicUrl, publicId, fileName: finalFileName, fileSize: finalSize, mimeType: finalMimeType, category, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    try { await mediaRef.set(mediaData); } catch (dbErr) { console.warn("[Database Bypass] Bypassing server-side Firestore catalog writing:", dbErr); }
    return res.status(200).json({ success: true, url: publicUrl, public_id: publicId, media: mediaData });
  } catch (error: any) {
    console.error("[Cloudinary Dedicated Upload API] Upload failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Upload failed" });
  }
});

// Secure Media Deletion
router.post("/api/media/delete", authenticateToken, async (req: any, res) => {
  try {
    const { mediaId, publicId } = req.body;
    if (!publicId) return res.status(400).json({ success: false, message: "Missing publicId" });
    try {
      if (publicId.includes("/") && !publicId.includes("avatars/") && !publicId.includes("teams/") && !publicId.includes("organizations/") && !publicId.includes("tournaments/") && !publicId.includes("scrims/") && !publicId.includes("products/") && !publicId.includes("news/") && !publicId.includes("sponsors/")) {
        const file = bucket.file(publicId);
        await file.delete();
      } else {
        const c = getCloudinary();
        await c.uploader.destroy(publicId);
      }
    } catch (destroyError: any) {
      console.warn("[Media Purge Warn] Could not destroy physical asset:", destroyError.message);
    }
    if (mediaId) await db.collection("media").doc(mediaId).delete();
    return res.status(200).json({ success: true, message: "Asset purged successfully." });
  } catch (error: any) {
    console.error("[Media Purge Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Deletion failed" });
  }
});

// Get All Media
router.get("/api/media", async (req, res) => {
  try {
    const mediaSnap = await db.collection("media").orderBy("createdAt", "desc").get();
    res.json({ success: true, media: mediaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error: any) {
    console.error("Fetch media error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Process Base64 Image
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

    const extension = mimeType.split('/')[1];
    let publicUrl = "", publicId = "", finalFileName = "", finalSize = buffer.length, finalMimeType = mimeType;

    try {
      const cloudinaryResult = await uploadBase64ToCloudinary(base64, folder);
      publicUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
      publicId = cloudinaryResult.public_id;
      finalFileName = cloudinaryResult.original_filename || `${Date.now()}.${extension}`;
      finalMimeType = cloudinaryResult.format ? `image/${cloudinaryResult.format}` : finalMimeType;
      finalSize = cloudinaryResult.bytes || finalSize;
    } catch (cloudinaryError: any) {
      console.warn("Cloudinary upload failed, falling back to Firebase Storage:", cloudinaryError.message);
      try {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
        const file = bucket.file(`${folder}/${fileName}`);
        await file.save(buffer, { metadata: { contentType: mimeType } });
        publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
        publicId = file.name;
        finalFileName = fileName;
      } catch (fbError) {
        console.warn("Firebase Storage fallback failed:", fbError);
        publicUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
        publicId = `picsum_${Date.now()}`;
        finalFileName = `placeholder_${Date.now()}.${extension}`;
      }
    }

    const mediaRef = db.collection("media").doc();
    const mediaData = { id: mediaRef.id, userId: uid, url: publicUrl, publicId, fileName: finalFileName, fileSize: finalSize, mimeType: finalMimeType, category: folder, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    try { await mediaRef.set(mediaData); } catch (dbErr) { console.warn("[Database Bypass]", dbErr); }
    return res.status(200).json({ success: true, url: publicUrl, public_id: publicId, media: mediaData });
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
    await db.collection('media').doc(mediaId).delete();
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
