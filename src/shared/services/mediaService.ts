// FILE_ID: services/mediaService.ts
// MODULE: Centralized Media Management
// PURPOSE: Single-source-of-truth frontend image uploads, validation, replacement, and deletion
// DEPENDENCIES: firebase.ts
// ponytail: all image uploads go through this service — no component does its own upload

import { getAuth } from "firebase/auth";
import { doc, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";

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
 * Fast client-side image compression fallback to ensure uploads never fail
 */
export function compressImageToDataUrl(file: File, maxWidth = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload image via server proxy to ImgBB (primary) with Cloudinary/Firebase Storage/Client fallback.
 * Guarantees that image upload will NEVER block the user interface.
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

    if (onProgress) onProgress(20);

    // 1. Primary: Try Server Upload Route (ImgBB / Cloudinary proxy)
    if (token) {
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("category", category);

        const response = await fetch("/api/upload/image", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json().catch(() => null);
          if (result && result.success && result.url) {
            if (onProgress) onProgress(100);
            const mediaId = result.media?.id || doc(collection(db, "media")).id;
            const mediaRecord: MediaRecord = {
              id: mediaId,
              userId: auth.currentUser?.uid || "guest",
              url: result.url,
              publicId: result.public_id || "",
              thumbUrl: result.media?.thumbUrl,
              mediumUrl: result.media?.mediumUrl,
              provider: result.media?.provider || "imgbb",
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              category,
              createdAt: new Date().toISOString(),
            };
            return {
              success: true,
              url: result.url,
              publicId: result.public_id || "",
              thumbUrl: mediaRecord.thumbUrl,
              mediumUrl: mediaRecord.mediumUrl,
              mediaData: mediaRecord,
            };
          }
        }
      } catch (serverErr) {
        console.warn("[Media Service] Server upload route failed, attempting Firebase Storage fallback:", serverErr);
      }
    }

    if (onProgress) onProgress(50);

    // 2. Secondary: Client-side Firebase Storage
    try {
      if (storage) {
        const cleanName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const storageRef = ref(storage, `uploads/${category.toLowerCase()}/${cleanName}`);
        const uploadSnap = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(uploadSnap.ref);

        if (onProgress) onProgress(100);
        const mediaId = doc(collection(db, "media")).id;
        const mediaRecord: MediaRecord = {
          id: mediaId,
          userId: auth.currentUser?.uid || "guest",
          url: downloadUrl,
          publicId: uploadSnap.ref.fullPath,
          thumbUrl: downloadUrl,
          mediumUrl: downloadUrl,
          provider: "firebase-storage",
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          category,
          createdAt: new Date().toISOString(),
        };

        return {
          success: true,
          url: downloadUrl,
          publicId: uploadSnap.ref.fullPath,
          thumbUrl: downloadUrl,
          mediumUrl: downloadUrl,
          mediaData: mediaRecord,
        };
      }
    } catch (storageErr) {
      console.warn("[Media Service] Client Firebase Storage failed, attempting local compression fallback:", storageErr);
    }

    if (onProgress) onProgress(80);

    // 3. Resilient Tertiary Fallback: High-quality Compressed WebP/JPEG Data URL
    const compressedDataUrl = await compressImageToDataUrl(file);
    if (onProgress) onProgress(100);

    const fallbackMediaId = doc(collection(db, "media")).id;
    const fallbackMediaRecord: MediaRecord = {
      id: fallbackMediaId,
      userId: auth.currentUser?.uid || "guest",
      url: compressedDataUrl,
      publicId: `data_${Date.now()}`,
      thumbUrl: compressedDataUrl,
      mediumUrl: compressedDataUrl,
      provider: "inline-data",
      fileName: file.name,
      fileSize: compressedDataUrl.length,
      mimeType: "image/jpeg",
      category,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      url: compressedDataUrl,
      publicId: `data_${Date.now()}`,
      thumbUrl: compressedDataUrl,
      mediumUrl: compressedDataUrl,
      mediaData: fallbackMediaRecord,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during image upload.";
    console.error("[Media Service] Upload failed completely:", msg);
    return { success: false, url: "", publicId: "", error: msg };
  }
}

/**
 * Removes an asset from the provider and deletes the Firestore catalog entry.
 */
export async function deleteImage(mediaId: string, _publicId: string): Promise<boolean> {
  try {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) { console.error("[Media Service] Unauthorized deletion attempt"); return false; }

    const response = await fetch("/api/media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mediaId }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      console.warn("[Media Service] Server-side delete failed:", result?.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Media Service] Failed to complete media deletion:", err);
    return false;
  }
}

/**
 * Replace an old image with a new one.
 */
export async function replaceImage(
  oldMediaId: string,
  oldPublicId: string,
  newFile: File,
  category: MediaCategory,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url: string; publicId: string; thumbUrl?: string; mediumUrl?: string; mediaData?: Partial<MediaRecord>; error?: string }> {
  const uploadResult = await uploadImage(newFile, category, onProgress);
  if (!uploadResult.success) {
    return uploadResult;
  }

  if (oldPublicId || oldMediaId) {
    deleteImage(oldMediaId, oldPublicId).catch(err => {
      console.warn("[Media Service] Async old image cleanup failed:", err);
    });
  }

  return uploadResult;
}

/**
 * Returns the best URL for a given display size.
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
 * Returns raw image URL. Accepts full URLs or data URLs.
 */
export function getImageUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return "";
  if (urlOrPublicId.startsWith("http://") || urlOrPublicId.startsWith("https://") || urlOrPublicId.startsWith("data:")) return urlOrPublicId;
  return "";
}
