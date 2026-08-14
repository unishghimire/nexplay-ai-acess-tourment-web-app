# NexPlay Production Audit Report

**Audit started:** 2026-08-14  
**Branch:** `release/production-hardening`  
**Scope:** production-readiness review of client routes, Express API routes, Firebase integrations, organizer/admin panels, tournament journeys, and build/test tooling.

## Phase 1 — Project map

The repository contains 307 tracked source, configuration, documentation, and tooling files (excluding dependency, build, and Git directories). The application is a Vite + React client with an Express server entry point and Firebase Authentication, Firestore, and Storage integrations.

### Primary areas

| Area | Responsibility |
| --- | --- |
| `src/features` | Feature-specific pages, panels, hooks, and components |
| `src/shared` | App shell, Firebase configuration, contexts, shared UI, services, utilities, and types |
| `server` | Express authentication, authorization, tournament, wallet, media, AI, Discord, and admin routes |
| `api/index.ts` / `server.ts` | Serverless and local Express entry points |
| `firestore.rules` / `firestore.indexes.json` | Firestore access policy and query indexes |
| `docs` | Product, design, technical, deployment, and earlier hardening documentation |

### Client routes and views

| Route | View / access |
| --- | --- |
| `/`, `/tournaments`, `/scrims`, `/games`, `/results`, `/organizations`, `/news`, `/teams`, `/leaderboard` | Public discovery pages |
| `/games/:id`, `/details/:id`, `/tournaments/:id`, `/post/:id`, `/team/:id`, `/user/:id`, `/profile/:id`, `/organization/:id` | Public detail or redirect views |
| `/login`, `/register`, `/complete-profile` | Authentication/profile flow |
| `/dashboard`, `/profile`, `/wallet` | Authenticated user pages |
| `/admin` | Authenticated administrator panel |
| `/organizer`, `/tournament-admin/:id`, `/organizer/scrim/:id` | Authenticated organizer/administrator pages |
| `/about`, `/contact`, `/privacy`, `/terms`, `*` | Informational and not-found pages |

Routes are declared in `src/App.tsx`; the root is protected by the global `ErrorBoundary`, and panel tabs use `TabErrorBoundary` where implemented.

### Server/API route map

| Group | Endpoints |
| --- | --- |
| Public/meta | `GET /sitemap.xml`, `POST /api/indexnow` |
| Authentication | `POST /api/register`, `/api/login`, `/api/forgot-password`, `/api/reset-password`; `GET /api/me`; `POST /api/admin/set-claims` |
| Tournament & scrim | generation, result upload, progression, deletion under `/api/tournaments/:id/*`; `GET /api/scrims` |
| Wallet | deposits, withdrawals, transactions, join/leave, promo redemption, prize distribution, cancellation, credential migration |
| Media | image upload/processing, listing, and deletion under `/api/media/*` and `/api/upload*` |
| AI | banner generation, audit, and discussion endpoints |
| Discord | announcement route |
| Admin scrims | administrative scrim audit and repair routes |

Server-side authorization is shared through `server/authz.ts`; legacy password REST endpoints are intentionally retired in favor of Firebase Identity authentication.

### Firestore real-time subscriptions

| Location | Subscription / safety concern |
| --- | --- |
| `AuthContext` | Firebase auth state and current user profile snapshot |
| `SiteSettingsContext` | Site settings snapshot |
| `NotificationContext` / notification service | User notification snapshots |
| `TournamentDetails` | Tournament, participant, and join-state snapshots |
| `useTournamentAdmin` | Tournament and participant administration snapshots |
| `ScrimDetailPage` | One tournament/scrim document snapshot |

All snapshot callbacks require unsubscribe cleanup, a visible error state, and ID/authentication guards before production sign-off.

## Initial runtime evidence

- The public Scrims page rendered its shell, filters, and FAQ, but local `GET /api/scrims` returned HTTP 500 when Firebase Admin credentials were unavailable. The client currently tries a public Firestore read first, then silently falls back to the API; error communication still needs remediation.
- Public pages `/tournaments`, `/teams`, `/organizations`, `/leaderboard`, `/results`, and `/news` rendered in local browser smoke checks without console errors.
- Organizer and administrator routes require a valid privileged test account. No credentials were supplied, so protected write flows will be statically audited and documented as requiring final production-account verification.

## Phase 2–3 remediation snapshot

- Repaired the Scrims discovery path, including current `matchType`, legacy `isScrim`, and dedicated scrim records; unrecoverable loading failure is now explicit and retryable.
- Repaired the Organizer Scrims Hub callback contract, numeric/array slot compatibility, and locally reflected slot updates.
- Repaired organizer dispute batching and Firestore host authorization for reads and resolutions.
- Added role-aware effect dependencies so administrators are not rejected while their profile loads.
- Hardened error handling with a retryable Scrim detail state, clipboard failure feedback, per-tab boundary resets, and an error boundary around the Discord administration tab.
- Replaced unbounded server scrim scans with field-targeted, partial-success queries and an explicit 503 response when all sources fail.

## Audit limitations and deployment prerequisites

- The local server cannot initialize Firebase Admin without environment-owned credentials. This is expected locally, but `FIREBASE_SERVICE_ACCOUNT` must be set in the production server environment.
- No non-production organizer/admin identity or Firestore emulator is available in this workspace. Privileged UI and rule behavior require the final environment test listed in `DISCOVERED_ERRORS.json`.
- Title-only legacy scrim documents must be migrated with the protected administrator audit/fix endpoints before release.
- Browser-driven regression automation could not start because the local browser connection process is denied access to a host profile directory. Static, test-suite, build, and HTTP-level checks continue to run locally; this is an audit-environment limitation, not evidence of an application browser failure.

## Status

- Phase 1: complete — project, route, API, and subscription map recorded.
- Phase 2: complete — findings and dispositions recorded in `DISCOVERED_ERRORS.json`.
- Phase 3: complete for code-owned findings; two environment/data actions remain external.
- Phase 4: validation results are recorded in `FINAL_SUMMARY.md`.
- Phase 5: pending final validation, commit, and push.
