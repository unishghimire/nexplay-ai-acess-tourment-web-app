# SERVICES: CORE BUSINESS & UTILITY LOGIC

This document captures the decoupled frontend modules that interact with external APIs, execute system telemetry audits, send user alerts, or coordinate media workflows.

---

## 🖼️ MEDIA & CDN MANAGEMENT SERVICE

### `mediaService.ts`
*   **Location**: `src/services/mediaService.ts`
*   **Responsibility**: Single source of truth for all frontend file uploads, validation, replacement, and deletion.
*   **Key Capabilities**:
    *   **Pre-Upload Verification**: Restricts uploads strictly to WebP, JPEG, PNG, and GIF with a hard boundary of 10MB (`MAX_FILE_SIZE_BYTES`).
    *   **Cloudinary Security Handshake**: Fetches secure session Bearer JWT tokens from Firebase Auth, proxying the request through Express.
    *   **Orphan Cleanups**: When replacing or deleting assets, it automatically invokes `deleteImage` to trigger physical asset destruction in Cloudinary or Firebase Storage.
    *   **Transformations**: Generates responsive, compressed CDN image variants using on-the-fly Cloudinary format optimizations (`generateOptimizedUrl`).

---

## 🔔 REAL-TIME NOTIFICATIONS ENGINE

### `NotificationService.ts`
*   **Location**: `src/services/NotificationService.ts`
*   **Responsibility**: Core transactional alerts and notification dispatch logs.
*   **Key Capabilities**:
    *   **Event Reminders**: Pushes real-time bracket changes, matchmaking logs, and profile role upgrades directly to individual user documents in Firestore.
    *   **Bulk Broadcasting**: Allows organizers to issue general announcements targeting all active participants registered inside a specific tournament collection.

---

## 📈 SYSTEM AUDITING & DIAGNOSTICS

### `TelemetryService.ts`
*   **Location**: `src/services/TelemetryService.ts`
*   **Responsibility**: Client-side monitoring and performance profiling.
*   **Key Capabilities**:
    *   **Load Metrics**: Tracks loading delays, API failures, database connection status, and layout execution delays.
    *   **Error Logging**: Automatically transmits diagnostics data to administrators during client-side crashes, reducing triage times.
