# NexPlay Technical Stack

**Status:** implementation-derived baseline
**Source of truth:** `package.json`, application/server source, Firebase configuration, rules/indexes, and deployment configuration
**Purpose:** define how NexPlay is currently built so future work preserves its existing architecture.

## 1. System summary

NexPlay is a TypeScript esports tournament web application with:

- a React 19 client built by Vite;
- Tailwind CSS v4 styling;
- Firebase Authentication, Firestore, Storage, Analytics, and Firestore offline persistence;
- an Express/Node server for privileged API routes and development/production SPA serving;
- Firebase Admin SDK for server-side authorization and Firestore transactions;
- Cloudinary and ImgBB image-hosting integrations;
- Gemini integration for controlled AI features;
- Discord webhooks for tournament/scrim announcements;
- Firebase Hosting and Vercel deployment configuration.

## 2. Technology inventory

| Layer | Technology | Current role |
|---|---|---|
| Language | TypeScript | Client, server, tools, domain types |
| Client framework | React 19 | Route views, components, contexts, hooks |
| Routing | `react-router-dom` 7 | Browser-router SPA navigation, route guards, redirects |
| Build/dev | Vite 6, `tsx` | Vite client build; `tsx server.ts` development/runtime command |
| Styling | Tailwind CSS 4 + global CSS | Utility-first responsive dark design system |
| Icons | `lucide-react` | UI iconography |
| Motion | `motion` | Select feature motion/animation |
| Document metadata | `react-helmet-async` | SEO titles, metadata, JSON-LD, noindex on private views |
| Backend | Express 4 | API middleware, privileged routes, SPA/static serving |
| Identity | Firebase Auth | User sessions; email/password and Google provider in client configuration |
| Primary database | Cloud Firestore | Product records, live listeners, indexes, security rules |
| Server database access | Firebase Admin SDK | Token verification, transactional wallet/participant/settlement writes |
| Client persistence | Firestore persistent local cache | Multi-tab IndexedDB cache where browser support exists |
| Object storage | Firebase Storage | Initialized in client; media flow uses external providers/endpoint paths where configured |
| Media processing | `browser-image-compression`, Multer, Cloudinary, ImgBB | Client preparation, server validation, image uploading/categorisation |
| AI | `@google/genai` | Tournament-banner generation and privileged web-page audit/discussion features |
| Captcha | `react-google-recaptcha` | Optional client reCAPTCHA integration, subject to `VITE_RECAPTCHA_SITE_KEY` |
| Drag and drop | `@hello-pangea/dnd` | Existing draggable UI use cases such as prize distribution |
| State helpers | React context/hooks; Zustand dependency | Auth, settings and notifications use contexts. No Zustand store was confirmed in source. |

## 3. Repository structure

```text
src/
  features/              # Product modules: auth, tournaments, wallet, teams, admin, organizer, etc.
  shared/
    components/          # Reusable UI components and application chrome
    config/              # Firebase client configuration
    constants/           # Shared constants, including finance constants
    context/             # Auth, site settings, notifications
    hooks/               # Reusable browser/UI hooks
    services/            # Domain engines and integrations
    types/               # Shared product and tournament/scoring types
server/
  routes/                # Express route modules
  shared.ts              # Firebase Admin, media, AI, authentication/rate-limit helpers
docs/                    # Product and operational documentation
tools/                   # Demo seed and domain validation/utility scripts
public/                  # Static assets, PWA/SEO files
```

Feature modules follow the pattern `features/<domain>/views`, optional `components`, and optional `hooks`. Shared code must not become a dumping ground for domain-specific UI or business logic.

## 4. Client architecture

### Application shell and routing

`src/App.tsx` creates the provider hierarchy:

```text
ErrorBoundary
  HelmetProvider
    AuthProvider
      SiteSettingsProvider
        NotificationProvider
          BrowserRouter
            AppContent
```

`AppContent` owns:

- global auth/settings loading fallback;
- maintenance-mode gate and notice bar;
- Navbar, Breadcrumbs, ScrollToTop, non-home BackButton, main content area, Footer;
- `ProfileCompletionGuard` and lazy-loaded application routes;
- `ProtectedRoute` role enforcement for authenticated/admin/organizer experiences.

Views are lazy-loaded through a retry wrapper that reloads once after a deployment chunk-hash mismatch.

### Context and client state

| Context | Responsibility |
|---|---|
| `AuthContext` | Firebase Auth subscription, private user profile, Firebase sign-out, first-time profile/public-profile initialization, profile loading timeout |
| `SiteSettingsContext` | Site notice, maintenance mode and related global settings |
| `NotificationContext` | Toast feedback and user notification integration |

Local component state manages forms, tab selection, filtered catalogues, modals, loading/error UI, and feature-specific data. Avoid adding a global store until a real cross-feature state problem is demonstrated.

### Firebase client configuration

`src/shared/config/firebase.ts`:

- loads `firebase-applet-config.json`;
- initializes Firebase once;
- creates Auth, Google provider, Firestore, Storage, and Analytics handles;
- uses `initializeFirestore` with `persistentLocalCache` and `persistentMultipleTabManager` when IndexedDB is available;
- falls back to ordinary Firestore initialization if persistent setup is unavailable;
- attempts to re-enable Firestore network on browser `online` events.

The client config is not a substitute for server credentials. Firebase Admin credentials remain server-only.

## 5. Backend architecture

### Express runtime

`server.ts` creates an Express app on port 3000, applies JSON/urlencoded request limits of 10MB, mounts route modules, serves `/sitemap.xml`, and then:

- uses Vite middleware in non-production; or
- serves `dist` and returns `dist/index.html` for SPA routes in production.

### API route modules

| Module | Responsibilities |
|---|---|
| `server/routes/auth.ts` | Authentication-adjacent endpoints, current user query, claim management |
| `server/routes/tournaments.ts` | Group generation, result upload, advancing, deletion, public scrim listing |
| `server/routes/wallet.ts` | Deposits, withdrawals, wallet transactions, tournament join/leave, promo redemption, prize distribution, room credential migration |
| `server/routes/media.ts` | Authenticated image upload, processing, media catalogue/list/delete |
| `server/routes/ai.ts` | Authenticated banner generation and privileged AI audit/discussion |
| `server/routes/discord.ts` | Authenticated organizer/admin Discord announcement delivery and logging |
| `server/routes/admin-scrims.ts` | Authenticated, administrator-only scrim data audit/fix utility |

### Server shared services

`server/shared.ts` centralizes:

- environment variable loading;
- Firebase Admin initialization with `FIREBASE_SERVICE_ACCOUNT`, optional local `service-account.json`, or Application Default Credentials;
- Firestore/Admin Storage access;
- Firebase ID-token verification middleware;
- in-memory route rate limiting;
- Multer memory upload with 10MB JPG/PNG/WebP/GIF restriction;
- Cloudinary and ImgBB upload/delete helpers;
- safe SVG banner helpers;
- Gemini client initialization.

Server mutations that affect money, wallet balance, registration capacity, prizes, or private credentials must run through verified token checks plus authoritative server/Firestore transaction logic.

## 6. Data and domain services

### Firestore

Firestore is the primary persisted store. Current key collections include:

- accounts: `users`, `users_public`;
- competitions: `tournaments`, `participants`, `results`, tournament credential subcollections;
- financial: `transactions`, `tournamentEarnings`, payment configuration, `promocodes`;
- communities: `teams`, `team_members`, `team_invites`, `team_activity`, `follows`, `org_posts`, `orgApplications`;
- operations: `notifications`, `media`, `activityLogs`, `discordLogs`, `audit_reports`, `settings`, `games`, `slides`.

The detailed current schema and product expectations are maintained in [PRD.md](PRD.md). Firestore rules are in `firestore.rules`; deployed composite query dependencies are in `firestore.indexes.json`.

### Domain services and engines

| Service | Purpose |
|---|---|
| `tournamentEngine` | Group, match, standing, qualification, roadmap and tournament lifecycle computations |
| `scoringEngine` | Point/scoring calculation behavior |
| `perKillEngine` | Per-kill reward validation, ledger/aggregation and leaderboard behavior |
| `roomCredentials` | Client access to separately stored tournament/group room credentials |
| `NotificationService` | Create/read/list notification operations |
| `mediaService` | Media upload and URL lifecycle helpers |
| `DiscordService` | Typed browser client for the server-side Discord proxy |
| `sitemapGenerator` | Sitemap generation from public records |

Business logic must be reused from these domain services rather than duplicated in pages or route handlers. Sensitive decisions remain server-side even when a client helper computes a preview.

## 7. Security model

### Authentication and roles

- Firebase Authentication holds client sessions.
- The Express server verifies Firebase ID tokens in `Authorization: Bearer <token>` headers.
- Application roles are `player`, `organizer`, and `admin` in `UserProfile`.
- `ProtectedRoute` controls user-facing access, while Firestore rules and server checks are the actual security boundary.
- Room credentials are deliberately kept under `tournaments/{id}/credentials/*` rather than the public tournament document.

### Firestore security rules

Rules govern public vs authenticated reads and role/ownership constrained writes. Important patterns include:

- server-only creation for player financial transactions and participants;
- organizer ownership/admin controls for tournaments and results;
- own-user access for transactions/notifications/disputes;
- owner/admin controls for teams and organization content;
- admin-only controls for platform configuration and audit logs.

Rules must be deployed with the application; a client UI check never replaces them.

### Security release constraint

The source protections are not a deployed guarantee. Existing public room credentials must be migrated before the updated Firestore rules are deployed, and rule behavior must be verified against an Emulator or staging project. See [RELEASE-READINESS.md](RELEASE-READINESS.md).

## 8. Build, quality, and test commands

| Command | Purpose |
|---|---|
| `pnpm install --frozen-lockfile` | Reproducible dependency installation |
| `pnpm run dev` | Run `tsx server.ts`, which hosts Vite middleware in development |
| `pnpm run build` | Produce Vite production output in `dist` |
| `pnpm run preview` | Preview built Vite client output |
| `pnpm run lint` / `pnpm run type-check` | TypeScript no-emit check (`tsc --noEmit`) |
| `pnpm test` | Run the framework-free domain/security regression suite |
| `pnpm audit --prod --json` | Check production dependency advisories |
| `pnpm run seed:demo` | Seed demo users, games, slides, and tournaments through `tools/seed-demo.ts` |

The repository includes self-contained TypeScript tests beside tournament, scoring, per-kill, SEO, and server security helpers. Before merging functional changes, run the local release gate recorded in [TEST-REPORT.md](TEST-REPORT.md).

## 9. Vite build behavior

`vite.config.ts`:

- uses React and Tailwind Vite plugins;
- defines `@` as a root alias;
- permits HMR to be disabled through `DISABLE_HMR=true`;
- strips `console.log`, `console.debug`, and `debugger` in production builds while retaining warnings/errors;
- splits vendor chunks for React, router, icons, Helmet, reCAPTCHA, Firebase modules, chart libraries, and drag-and-drop libraries.

New dependencies should be evaluated for initial-bundle impact and lazy-load suitability before adding them.

## 10. Environment configuration

The checked-in `.env.example` declares:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini-backed AI features |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary media upload/delete |
| `IMGBB_API_KEY` | ImgBB media upload |
| `DISCORD_WEBHOOK_TOURNAMENTS`, `DISCORD_WEBHOOK_SCRIMS` | Server-held outgoing Discord webhooks |
| `VITE_RECAPTCHA_SITE_KEY` | Browser-exposed reCAPTCHA site key |
| `FIREBASE_SERVICE_ACCOUNT` | Server Admin credential JSON; used in code although not included in `.env.example` |

`firebase-applet-config.json` contains Firebase client/project configuration. `service-account.json` is an optional local development fallback; it must never be committed. All secret values must be set by the deployment environment.

## 11. Deployment

### Firebase Hosting

`firebase.json` deploys `dist`, rewrites every route to `index.html` for SPA routing, deploys rules/indexes, gives hashed static assets a one-year immutable cache policy, and marks `index.html` no-cache.

### Vercel

`vercel.json` identifies Vite build output, includes SPA/API/sitemap rewrites, security headers, static cache headers, and canonical `/details/:id` → `/tournaments/:id` redirect.

### Deployment caveat

The repository contains both Firebase Hosting and Vercel configuration. Actual production hosting, function/server routing, secret provisioning, and Firebase Admin runtime settings are **deployment-environment dependent and unverified** from source alone. A release must validate the selected deployment target end-to-end, including every `/api/*` route.

## 12. Engineering constraints

1. Preserve the feature-first source layout and shared component/service boundaries.
2. Use strict TypeScript and established domain types; do not introduce `any` without a documented boundary justification.
3. Never write financial balances, transactions, prizes, payment status, role, or eligibility directly from untrusted clients.
4. Review Firestore rules, indexes, costs, and migration impact before schema/query changes.
5. Reuse existing scoring, tournament, media, notification and credentials services.
6. Make client operations observable with loading/success/failure states; do not hide user-action failures in console logs only.
7. Add authorization, validation, rate limits, and idempotency to every new sensitive API route.
8. Preserve the route guard and profile-completion architecture unless changing it with a tested migration plan.

## 13. Key implementation references

- App and routing: `src/App.tsx`
- Firebase client: `src/shared/config/firebase.ts`
- Global styling/build: `src/index.css`, `vite.config.ts`, `package.json`
- Shared types/services: `src/shared/types`, `src/shared/services`
- Server entry/shared middleware: `server.ts`, `server/shared.ts`
- APIs: `server/routes/*`
- Access/index configuration: `firestore.rules`, `firestore.indexes.json`
- Deployment: `firebase.json`, `vercel.json`, `docs/deployment/README.md`
