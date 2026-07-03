# ARCHITECTURAL DECISION RECORDS (ADR)

This file catalogs the core technical decisions, platform choices, and architectural policies guiding the engineering of the Nexplay platform.

---

## 🏛️ ADR 1: FULL DEPRECATION OF IMGBB IN FAVOR OF CLOUDINARY

### Context
Nexplay serves heavy media banners, tournament bracket logs, and high-fidelity team emblems. Originally, the codebase leveraged ImgBB for image uploads. However, ImgBB lacked dynamic compression, automated format transformations (like converting JPG to WebP), and directory/folder scoping rules.

### Decision
Fully deprecated the legacy ImgBB integrations on both the client and server. Designed a secure, unified image upload proxy pipeline powered by **Cloudinary**.
*   **Benefits**: On-the-fly transformations, automatic responsive asset scaling, format optimizations (WebP delivery), directory structures for better media classification.

---

## 🏛️ ADR 2: LAZY INITIALIZATION OF SENSITIVE SERVICE SDK CLIENTS

### Context
SDK clients (such as Stripe, Firebase, or Cloudinary) typically crash Node processes at load-time if environment secrets are undefined. This blocks dev servers from starting, showing "Please wait while your application starts..." indefinitely.

### Decision
All third-party SDK configurations are lazy-initialized on demand inside Express.
```typescript
function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  // Validates keys and lazy-initiates on actual usage
}
```
*   **Benefits**: Eradicates start-up crashes, allows graceful fallbacks, and ensures local developer configurations can boot immediately.

---

## 🏛️ ADR 3: COMMONJS BUNDLING OF SERVER CODE VIA ESBUILD

### Context
Running server-side files in ESM (ES Modules) mode requires precise relative file paths and is prone to runtime transpilation errors when importing complex files.

### Decision
Configured the build pipeline to compile the Express backend into a single, self-contained `dist/server.cjs` file using `esbuild`.
*   **Benefits**: Safely bypasses Node's strict runtime ES Module checks, simplifies imports, and decreases filesystem I/O to improve cold-starts on serverless runtimes.

---

## 🏛️ ADR 4: TRANSITION FROM CONST ENUMS TO STANDARD TYPESCRIPT ENUMS

### Context
Vite and Babel transpilers do not always support `const enum` in isolated modules mode, causing bundling failures.

### Decision
Enforced a standard that all TypeScript enums declared in shared modules (like `src/types.ts` or `src/services/mediaService.ts`) must use standard, transpilable `enum` definitions.
