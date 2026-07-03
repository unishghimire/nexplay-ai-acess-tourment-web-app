# TECHNICAL DEBT & REFACTORING LOGS

This log tracks technical debt eliminations, deprecated module removals, and cleanup operations executed on the Nexplay repository.

---

## 🧹 COMPLETE REMOVAL OF IMGBB & IMAGE_SERVICE DEBT (2026-06-28)

### Problem
The repository held double implementations for media uploads (`imageService.ts` and various raw components). It depended on ImgBB as its primary image service, which lacked physical file deletion APIs, leading to orphan files in storage.

### Action Taken
1.  **Deleted legacy service**: Permanently purged `src/services/imageService.ts`.
2.  **Centralized media pipeline**: Created `src/services/mediaService.ts` as the single source of truth for all media-related actions.
3.  **Refactored consumers**:
    *   Updated `ImageUploader.tsx` to consume `uploadImage` directly from the new `mediaService.ts`.
    *   Refactored `TournamentCreateModal.tsx` to align with the new media namespaces.
    *   Refactored `AdminPanel.tsx` to support the physical destruction of media files on Cloudinary using secure JWT-authenticated endpoints (`deleteImage`).
4.  **Backend Migration**: Fully replaced the ImgBB upload controllers inside `server.ts` with secure, multi-tier Cloudinary controllers supporting automatic format conversions and sub-folder catalogs.

---

## 🧹 REFINED MAX FILE LIMITS (2026-06-28)

### Problem
The codebase was constrained to a restrictive 5MB limit. Banners and high-quality game logo mockups routinely exceed 5MB, causing unexpected form validation failures for tournament hosts.

### Action Taken
Unified and increased the file size boundaries to **10MB** (`MAX_FILE_SIZE_BYTES`) inside both client-side validations and backend Multer configurations. Added format-agnostic support for modern GIF, WebP, and PNG structures.
