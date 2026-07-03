# API & MIDDLEWARE SYSTEM MAP

This document maps out the backend REST APIs, authentication flows, payload requirements, and security middleware declared within `server.ts`.

---

## 🔐 SECURITY & AUTHENTICATION MIDDLEWARE

### `authenticateToken`
*   **Location**: `server.ts`
*   **Behavior**: Extracts the JWT Bearer token from the `Authorization` request header (`Authorization: Bearer <token>`). Verifies the token using Firebase Admin SDK. If successful, injects the user's details (`userId`, `email`, etc.) into `req.user` and yields control to the next handler; otherwise, blocks the request returning `401 Unauthorized` or `403 Forbidden`.

---

## 🗺️ ENDPOINT DIRECTORY

### 1. User Authentication & Profile
*   **`POST /api/register`**: Creates new accounts with profile mappings.
*   **`POST /api/login`**: Sets up user session credentials.
*   **`POST /api/forgot-password`**: Triggers account password recovery.
*   **`POST /api/reset-password`**: Processes password resets securely.
*   **`GET /api/me`** (Auth required): Retrieves the authenticated user's current record, roles, and ledger balances.

### 2. Tournament & Bracket Engineering
*   **`POST /api/tournaments/:id/groups/generate`** (Auth required): Generates multi-tier tournament matches, group divisions, and initial bracket seeds.
*   **`POST /api/tournaments/:id/results/upload`** (Auth required): Submits match score sheets, game logs, and screenshots.
*   **`POST /api/tournaments/:id/advance`** (Auth required): Advances winning participants to successive bracket nodes.

### 3. Media & File Services
*   **`POST /api/upload/image`** (Auth required): Standardized secure endpoint. Receives binary image data via Multer, maps the designated Category, routes files to the appropriate Cloudinary sub-folders, and index-catalogs metadata into Firestore.
*   **`POST /api/upload-image`** (Auth required): Legacy upload route migrated to Cloudinary fallback pipeline.
*   **`POST /api/process-image`** (Auth required): Decodes, validates format, checks file limits (10MB), and uploads Base64 strings directly to Cloudinary.
*   **`POST /api/media/delete`** (Auth required): Standard secure media purging endpoint. Removes physical files from Cloudinary or Firebase buckets, and deletes local catalogs from Firestore.
*   **`DELETE /api/media/:id`** (Auth required): Deletes individual catalog entries.
*   **`GET /api/media`**: Lists general platform-wide public assets.

### 4. System Diagnostics & Crawlers
*   **`GET /sitemap.xml`**: Dynamically generates metadata for search engine crawlers.
*   **`POST /api/audit`**: Analyzes app states for administrators.
*   **`POST /api/audit/discuss`**: Administrative discussions portal.
