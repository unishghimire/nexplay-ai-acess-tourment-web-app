# COMMON ERRORS, TROUBLESHOOTING & DESIGN WORKAROUNDS

This guide logs recurrent error states, structural patterns, and fallback solutions designed to preserve system durability.

---

## 🖼️ MEDIA UPLOADER & BACKEND FAULTS

### 1. Missing Cloudinary API Credentials
*   **Symptoms**: Image uploads fail or trigger warnings; fallback Picsum images or Storage uploads occur instead.
*   **Root Cause**: `.env` missing `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET`.
*   **Correction Approach**:
    1.  Ensure variables are present in the platform's configuration panel and mapped in `.env.example`.
    2.  Check the server logs; the Express endpoint is designed to catch configuration gaps gracefully without crashing the main application loop, falling back sequentially to Firebase Storage and then Picsum placeholder seeds.

### 2. Multer Limit Exception (File Too Large)
*   **Symptoms**: `MulterError: File too large` on POST requests.
*   **Root Cause**: Attempting to upload files larger than the 10MB limit.
*   **Correction Approach**:
    1.  Compress files locally before submitting.
    2.  `mediaService.validateImage()` will reject uploads on the client side before triggering network transfers, presenting a user-friendly error dialog.

---

## 🔒 SECURITY & DATABASE PERMISSIONS

### 1. Firestore "Missing or insufficient permissions"
*   **Symptoms**: Client operations fail during database writes.
*   **Root Cause**: The user's dynamic role or claims do not match the restrictive security boundaries set in `firestore.rules`.
*   **Correction Approach**:
    1.  Confirm the user is fully logged in and has completed their profile.
    2.  Ensure operations are performed from approved routes (e.g., matching administrative actions to the `/admin` view).

---

## 🔄 FRAMEWORK ERRORS

### 1. WebSocket / Dev Server Staleness
*   **Symptoms**: Visual flickers, browser fails to connect to local websocket, or HMR stale state warnings.
*   **Root Cause**: Hot Module Replacement (HMR) is disabled by the platform Control Plane using `DISABLE_HMR=true`.
*   **Correction Approach**: These console alerts are benign and must be ignored. Simply run `restart_dev_server` if the workspace feels stale.
