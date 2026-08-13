// FILE_ID: services/mediaService.ts
// MODULE: Centralized Media Management
// PURPOSE: Single-source-of-truth frontend image uploads, validation, replacement, and deletion
// DEPENDENCIES: firebase.ts
// ponytail: all image uploads go through this service — no component does its own upload

import { getAuth } from "firebase/auth";
import { doc, collection, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export enum MediaCategory {
  USER_AVATAR = "USER_AVATAR",
  TEAM_LOGO = "TEAM_LOGO",
  TEAM_BANNER = "TEAM_BANNER",
  ORG_LOGO = "ORG_LOGO",
  ORG_BANNER = "ORG_BANNER",
  TOURNAMENT_BANNER = "TOURNAMENT_BANNER",
  TOURNAMENT_THUMBNAIL = "TOURNAMENT_THUMBNAIL",
  SCRIM_BANNER = "SCRIM_BANNER",
  PRODUCT_IMAGE = "PRODUCT_IMAGE",
  NEWS_IMAGE = "NEWS_IMAGE",
  SPONSOR_LOGO = "SPONSOR_LOGO",
  OVERLAY_GRAPHIC = "OVERLAY_GRAPHIC",
  OTHER = "OTHER"
}

export interface MediaRecord {
  id: string;
  userId: string;
  url: string;
  publicId: string;
  thumbUrl?: string;
  mediumUrl?: string;
  provider?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: MediaCategory;
  createdAt: any;
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Per-category size limits (bytes)
const CATEGORY_SIZE_LIMITS: Partial<Record<MediaCategory, number>> = {
  [MediaCategory.USER_AVATAR]: 5 * 1024 * 1024,       // 5MB
  [MediaCategory.TEAM_LOGO]: 5 * 1024 * 1024,          // 5MB
  [MediaCategory.TEAM_BANNER]: 10 * 1024 * 1024,       // 10MB
  [MediaCategory.ORG_LOGO]: 5 * 1024 * 1024,           // 5MB
  [MediaCategory.ORG_BANNER]: 10 * 1024 * 1024,       // 10MB
  [MediaCategory.TOURNAMENT_BANNER]: 10 * 1024 * 1024, // 10MB
  [MediaCategory.TOURNAMENT_THUMBNAIL]: 5 * 1024 * 1024, // 5MB
  [MediaCategory.SCRIM_BANNER]: 10 * 1024 * 1024,      // 10MB
  [MediaCategory.NEWS_IMAGE]: 10 * 1024 * 1024,       // 10MB
  [MediaCategory.PRODUCT_IMAGE]: 5 * 1024 * 1024,     // 5MB
  [MediaCategory.SPONSOR_LOGO]: 5 * 1024 * 1024,      // 5MB
  [MediaCategory.OVERLAY_GRAPHIC]: 10 * 1024 * 1024,  // 10MB
  [MediaCategory.OTHER]: 10 * 1024 * 1024,            // 10MB
};

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB global default

/**
 * Validates file type, extension, and size based on category
 */
export function validateImage(file: File, category?: MediaCategory): { isValid: boolean; error?: string } {
  if (!file) return { isValid: false, error: "No file selected." };

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type (${file.type}). Only JPEG, PNG, WEBP, and GIF are allowed.`,
    };
  }

  const maxSize = (category && CATEGORY_SIZE_LIMITS[category]) || MAX_FILE_SIZE_BYTES;
  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `File is too large (${fileMB}MB). Maximum for this image type is ${maxMB}MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Upload image via server proxy to ImgBB (primary) with Cloudinary/Storage fallback.
 * API key stays server-side — never exposed to client.
 */
export async function uploadImage(
  file: File,
  category: MediaCategory,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url: string; publicId: string; thumbUrl?: string; mediumUrl?: string; mediaData?: Partial<MediaRecord>; error?: string }> {
  try {
    const check = validateImage(file, category);
    if (!check.isValid) {
      return { success: false, url: "", publicId: "", error: check.error };
    }

    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      return { success: false, url: "", publicId: "", error: "You must be logged in to upload images." };
    }

    if (onProgress) onProgress(15);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("category", category);

    const response = await fetch("/api/upload/image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (onProgress) onProgress(100);

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false, url: "", publicId: "",
        error: result.message || "Failed to upload image.",
      };
    }

    const userId = auth.currentUser?.uid || "unknown";
    const mediaId = result.media?.id || doc(collection(db, "media")).id;

    const mediaRecord: MediaRecord = {
      id: mediaId, userId, url: result.url, publicId: result.public_id || "",
      thumbUrl: result.media?.thumbUrl, mediumUrl: result.media?.mediumUrl,
      provider: result.media?.provider || "imgbb",
      fileName: file.name, fileSize: file.size, mimeType: file.type,
      category, createdAt: new Date().toISOString(),
    };

    try { await setDoc(doc(db, "media", mediaId), mediaRecord); }
    catch (dbErr) { console.warn("[Media Service] Could not index media record client-side:", dbErr); }

    return {
      success: true, url: result.url, publicId: result.public_id || "",
      thumbUrl: mediaRecord.thumbUrl, mediumUrl: mediaRecord.mediumUrl,
      mediaData: mediaRecord,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during image upload.";
    console.error("[Media Service] Upload failed:", msg);
    return { success: false, url: "", publicId: "", error: msg };
  }
}

/**
 * Removes an asset from the provider and deletes the Firestore catalog entry.
 * For ImgBB: uses the delete_url stored as publicId. If the delete_url is expired
 * or invalid, only the Firestore reference is removed (physical file may persist).
 */
export async function deleteImage(mediaId: string, publicId: string): Promise<boolean> {
  try {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) { console.error("[Media Service] Unauthorized deletion attempt"); return false; }

    const response = await fetch("/api/media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mediaId, publicId }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      console.warn("[Media Service] Server-side delete failed, falling back to client Firestore purge:", result.message);
    }

    if (mediaId) { await deleteDoc(doc(db, "media", mediaId)).catch(() => {}); }
    return true;
  } catch (err) {
    console.error("[Media Service] Failed to complete media deletion:", err);
    return false;
  }
}

/**
 * Replace an old image with a new one.
 * Uploads new image first — only deletes old image after new upload succeeds.
 * If new upload fails, old image is preserved.
 */
export async function replaceImage(
  oldMediaId: string,
  oldPublicId: string,
  newFile: File,
  category: MediaCategory,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url: string; publicId: string; thumbUrl?: string; mediumUrl?: string; mediaData?: Partial<MediaRecord>; error?: string }> {
  // 1. Upload new asset first
  const uploadResult = await uploadImage(newFile, category, onProgress);
  if (!uploadResult.success) {
    return uploadResult; // old image preserved
  }

  // 2. Delete old asset in background — new image already confirmed
  if (oldPublicId || oldMediaId) {
    deleteImage(oldMediaId, oldPublicId).catch(err => {
      console.warn("[Media Service] Async old image cleanup failed:", err);
    });
  }

  return uploadResult;
}

/**
 * Returns the best URL for a given display size.
 * Uses ImgBB thumbnail/medium URLs when available for performance.
 * Falls back to the full URL for non-ImgBB images.
 */
export function getDisplayUrl(
  url: string,
  size: "thumb" | "medium" | "full" = "full",
  thumbUrl?: string,
  mediumUrl?: string
): string {
  if (!url) return "";
  if (size === "thumb" && thumbUrl) return thumbUrl;
  if (size === "medium" && mediumUrl) return mediumUrl;
  return url;
}

/**
 * Legacy: generateOptimizedUrl was for Cloudinary URL transforms.
 * ImgBB provides thumb/medium URLs at upload time — use getDisplayUrl instead.
 * Kept for backward compat with existing Cloudinary URLs in the database.
 */
export function generateOptimizedUrl(url: string, width?: number, height?: number): string {
  if (!url || !url.includes("cloudinary.com")) return url;
  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;
  let transformations = "f_auto,q_auto";
  if (width && height) transformations += `,w_${width},h_${height},c_fill`;
  else if (width) transformations += `,w_${width},c_scale`;
  else if (height) transformations += `,h_${height},c_scale`;
  return `${parts[0]}/upload/${transformations}/${parts[1]}`;
}

/**
 * Returns raw image URL. Accepts full URLs.
 */
export function getImageUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return "";
  if (urlOrPublicId.startsWith("http://") || urlOrPublicId.startsWith("https://")) return urlOrPublicId;
  return "";
}
