// FILE_ID: services/mediaService.ts
// MODULE: Centralized Media Management
// PURPOSE: Handles single-source-of-truth frontend media uploads, validation, replacement, and deletion using Cloudinary proxy
// DEPENDENCIES: firebase.ts

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
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: MediaCategory;
  createdAt: any;
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validates file type and size on client side before upload
 */
export function validateImage(file: File): { isValid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: "Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed."
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File is too large. Maximum size allowed is 10MB (Selected file size: ${(file.size / (1024 * 1024)).toFixed(2)}MB).`
    };
  }

  return { isValid: true };
}

/**
 * Direct secure proxy image upload to Cloudinary backend
 */
export async function uploadImage(
  file: File,
  category: MediaCategory,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url: string; publicId: string; mediaData?: Partial<MediaRecord>; error?: string }> {
  try {
    const check = validateImage(file);
    if (!check.isValid) {
      return { success: false, url: "", publicId: "", error: check.error };
    }

    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      return { success: false, url: "", publicId: "", error: "You must be logged in to upload images." };
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("category", category);

    if (onProgress) {
      onProgress(15);
      setTimeout(() => onProgress(50), 200);
      setTimeout(() => onProgress(80), 450);
    }

    const response = await fetch("/api/upload/image", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (onProgress) {
      onProgress(100);
    }

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        url: "",
        publicId: "",
        error: result.message || "Failed to upload image to Cloudinary proxy backend."
      };
    }

    const userId = auth.currentUser?.uid || "unknown";
    const mediaId = result.media?.id || doc(collection(db, "media")).id;
    const publicId = result.public_id || result.media?.publicId || "";

    const mediaRecord: MediaRecord = {
      id: mediaId,
      userId,
      url: result.url,
      publicId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      category,
      createdAt: new Date().toISOString()
    };

    // Catalog locally in Firestore media collection for easy UI rendering
    try {
      await setDoc(doc(db, "media", mediaId), mediaRecord);
    } catch (dbErr) {
      console.warn("[Media Service] Could not index media record client-side:", dbErr);
    }

    return {
      success: true,
      url: result.url,
      publicId,
      mediaData: mediaRecord
    };
  } catch (err: any) {
    console.error("[Media Service] Upload failed:", err);
    return {
      success: false,
      url: "",
      publicId: "",
      error: err.message || "An unexpected error occurred during image upload."
    };
  }
}

/**
 * Removes an asset from Cloudinary and deletes catalog indexed entry from Firestore
 */
export async function deleteImage(mediaId: string, publicId: string): Promise<boolean> {
  try {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      console.error("[Media Service] Unauthorized deletion attempt");
      return false;
    }

    // Call Cloudinary API proxy delete
    const response = await fetch("/api/media/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ mediaId, publicId })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      console.warn("[Media Service] Server-side Cloudinary delete failed, fallback to client Firestore purge:", result.message);
    }

    // Always attempt local catalog purge as fallback
    if (mediaId) {
      await deleteDoc(doc(db, "media", mediaId));
    }

    return true;
  } catch (err) {
    console.error("[Media Service] Failed to complete media deletion:", err);
    return false;
  }
}

/**
 * Seamless replacement of an old image with a new one
 */
export async function replaceImage(
  oldMediaId: string,
  oldPublicId: string,
  newFile: File,
  category: MediaCategory,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url: string; publicId: string; mediaData?: Partial<MediaRecord>; error?: string }> {
  // 1. Upload new asset
  const uploadResult = await uploadImage(newFile, category, onProgress);
  if (!uploadResult.success) {
    return uploadResult;
  }

  // 2. Safely destroy the old asset in the background to prevent orphan storage
  if (oldPublicId || oldMediaId) {
    deleteImage(oldMediaId, oldPublicId).catch(err => {
      console.warn("[Media Service] Async old image cleanup failed during replacement:", err);
    });
  }

  return uploadResult;
}

/**
 * Returns raw image URL. Accepts full URLs or Cloudinary public IDs.
 */
export function getImageUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return "";
  if (urlOrPublicId.startsWith("http://") || urlOrPublicId.startsWith("https://")) {
    return urlOrPublicId;
  }
  // Public ID only — cannot safely reconstruct without cloud name; return empty
  return "";
}

/**
 * Performs on-the-fly Cloudinary responsive image scaling and transformations via URL modification
 */
export function generateOptimizedUrl(url: string, width?: number, height?: number): string {
  if (!url || !url.includes("cloudinary.com")) {
    return url; // Non-Cloudinary/Fallback placeholder URL
  }

  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;

  let transformations = "f_auto,q_auto"; // Default format and quality optimization
  if (width && height) {
    transformations += `,w_${width},h_${height},c_fill`;
  } else if (width) {
    transformations += `,w_${width},c_scale`;
  } else if (height) {
    transformations += `,h_${height},c_scale`;
  }

  return `${parts[0]}/upload/${transformations}/${parts[1]}`;
}
