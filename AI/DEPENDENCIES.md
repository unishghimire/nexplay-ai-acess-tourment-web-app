# DEPENDENCIES MAP: PLATFORM MODULE RELATIONSHIPS

This map traces the third-party node package footprints, core client-side modules, and front-to-back dependency hierarchies within the Nexplay platform.

---

## 🛠️ EXTERNAL SYSTEM DEPENDENCIES (package.json)

The application depends on a lightweight, production-grade suite of libraries grouped by logical role:

### 1. Core Runtime Framework
*   **`react` & `react-dom` (v19)**: Virtual DOM rendering engine, hooks architecture, and UI state loop.
*   **`react-router-dom`**: Manages client-side Single Page Application (SPA) routing, wildcard fallback pages, and protected session checks.

### 2. Client-Side Database & Auth
*   **`firebase`**: Client SDK to connect directly to Firestore for real-time reads/writes, authentication state updates, and telemetry catalog logs.

### 3. Server Node Layer
*   **`express`**: Standard HTTP middleware router serving production front-end bundles and secure server endpoints.
*   **`firebase-admin`**: Secure backend communication validating client JWT bearer tokens and directly writing to protected collections bypassing client-side rule restrictions.
*   **`cloudinary`**: SDK used server-side to coordinate secure media compression, folder assignments, and physical image destruction.
*   **`multer`**: Handles streaming multi-part forms and binary buffer parsing in memory.

### 4. UI Presentation & Styling
*   **`tailwindcss`**: Atomic utility classes.
*   **`motion` (imported from `motion/react`)**: High-performance, declarative physics-based UI transitions.
*   **`lucide-react`**: The exclusive SVG icon provider.

---

## 🔄 FRONT-TO-BACK DIRECT DEPENDENCIES

The flow chart below illustrates how files depend on one another, moving from client actions to cloud persistence:

```
[UI Trigger / Interaction]
  e.g., ImageUploader.tsx
       │
       ▼
[Client Services API Handlers]
  e.g., mediaService.ts (Enforces file size, MIME limits)
       │
       ▼
[Express Endpoint Route Proxies]
  e.g., server.ts (Verifies Firebase JWT auth token, parses buffer via Multer)
       │
       ▼
[Physical Cloud Infrastructure]
  e.g., Cloudinary (Compresses & converts to WebP) ──► Firestore (Catalog indexed)
```

---

## 🔒 MODULE BOUNDARIES & SECURITY POLICIES

To prevent architectural regression, future coding agents must strictly respect these system boundaries:

1.  **Direct Browser-to-Cloudinary Blocking**: No client-side component or service may import `cloudinary` directly, nor store the `CLOUDINARY_API_SECRET` client-side. All media uploading must pass through the server-side proxy `/api/upload/image`.
2.  **State Separation**: Components do not hold global settings or authenticated credentials in localized state; they must delegate session state queries to `AuthContext` or `SiteSettingsContext`.
3.  **Third-Party Icon Restriction**: No SVGs or other external icon libraries (e.g., FontAwesome, React Icons) are allowed. All visual symbols must use imports from `lucide-react`.
