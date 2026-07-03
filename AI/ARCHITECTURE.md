# Nexplay eSports Platform: Architectural Topology & Boundaries

This document maps out the system architecture, boundaries, data flow rules, and core layers of the Nexplay eSports application.

---

## 🏗️ SYSTEM FLOW OVERVIEW

```
  [ Client-Side View Layer ] (React 19 / Vite / Tailwind)
              │
              ▼
  [ Shared Context & State ] (Auth, SiteSettings, Notifications)
              │
              ├─────────────────────────────────────────┐
              ▼                                         ▼
   [ Firestore Client SDK ]                  [ Express API Proxies ]
    (Real-time databases, logs)               (Auth validation, media uploading)
              │                                         │
              │                                         ▼
              │                              [ Cloudinary Media CDN ]
              ▼                                         │
      [ Firebase Console / Rules ] <────────────────────┘
```

---

## 🗂️ LOGICAL LAYERING & ARCHITECTURE BOUNDARIES

### 1. Frontend Client Layer (`/src`)
The client app is built on React 19 using Vite as the bundler. It uses responsive Tailwind classes exclusively for visual presentation, and framer-motion/lucide-react for interactive accents.

*   **Views (`/src/views/`)**: Single-responsibility page layouts. No direct backend logic; views consume hooks, contexts, or local state.
*   **Components (`/src/components/`)**: Atomic, modular, and reusable widgets (e.g., `ImageUploader`, `BackButton`, modal sheets).
*   **Contexts (`/src/context/`)**: Centralized providers for Auth, Notifications, and general Site/Maintenance Settings.
*   **Hooks (`/src/hooks/`)**: Isolated lifecycle hooks (e.g., outside click handlers, element viewport intersections, overlay states).

### 2. Service & Business Logic Layer (`/src/services`)
Services coordinate tasks like telemetry reporting, browser-side picture validation, and backend-proxied media manipulation.
*   **mediaService**: Front-end proxy coordinating secure file upload, image compression parameters, clean replacement workflows, and on-the-fly Cloudinary responsive URL generation.

### 3. Server Node Layer (`/server.ts`)
A custom-built Express server. It handles production asset serving, SPA route fallbacks, lazy-configured Cloudinary proxy endpoints, and server-side Firestore operations.
*   **Development Route Mapping**: Mounted behind the Vite development middleware.
*   **Production Route Mapping**: Express serves static assets compiled inside `/dist/` and maps all wildcard URL lookups (`*`) back to `/dist/index.html`.

---

## 🔐 AUTHENTICATION & SECURITY SCHEME

1.  **Firebase Client Authentication**: The user logs in securely using the standard Firebase SDK (`src/context/AuthContext.tsx`).
2.  **Bearer JWT Handshake**: When the client requests sensitive server operations (like uploading assets), it retrieves an ID Token via `auth.currentUser?.getIdToken()` and attaches it to the HTTP headers:
    `Authorization: Bearer <ID_TOKEN>`
3.  **Server Verification**: Express intercepts requests using the `authenticateToken` middleware, parsing and verifying the JWT token with the `firebase-admin` authentication helper before authorizing the controller logic.

---

## 🖼️ MEDIA & UPLOAD ARCHITECTURE

Nexplay leverages a high-fidelity image pipeline with three resilient tiers of operations:

*   **Tier 1: Cloudinary CDN Proxy (Primary)**: Automatically converts uploaded images to efficient Modern WebP format with automated scaling transformations.
*   **Tier 2: Cloud Storage Fallback**: If Cloudinary environment parameters are absent, the Express router falls back automatically to the standard Firebase storage bucket.
*   **Tier 3: Picsum Placeholder Generator**: If both systems are offline, the engine injects unique, deterministic Picsum seed URLs into the client catalog to guarantee uninterrupted user flows.

---

## 📋 STYLING & DESIGN TOKENS

The theme is styled around modern high-contrast aesthetics:
*   **Core Backgrounds**: Slate-charcoals and absolute dark greys (`bg-dark`, `bg-dark-light`, custom border outlines).
*   **Brand Color Accents**: Neon branding tones (`brand-500`, neon emeralds/cyans for highlights).
*   **Visual Rhythm**: Generous margins, uniform padding spacing, unified typography via custom modern heading pairs (sans-serif text matching Inter for body copy, paired with monospace fonts for telemetry elements).
