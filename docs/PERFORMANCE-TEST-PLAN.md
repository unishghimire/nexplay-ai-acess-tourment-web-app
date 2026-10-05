# NEXPLAY Performance & Caching Test Plan

Version: 1.0 · Date: 2026-10-05 · Owner: QA / Frontend Platform
Applies to: nexplay-player portal (React 19 + Vite + Firebase Firestore + Express + PWA)

---

## 1. Purpose & Scope

This plan verifies six quality attributes end to end:

| # | Requirement | ID prefix |
|---|---|---|
| R1 | API/HTTP caching delivers cached responses when appropriate | TC-C |
| R2 | Loading skeletons display during data fetches | TC-S |
| R3 | Database response times meet benchmarks under various conditions | TC-D |
| R4 | Cached data stays consistent with the database and updates on changes | TC-X |
| R5 | End-to-end response time (interaction → data displayed) meets standards | TC-E |
| R6 | Rendering is optimized: no unnecessary re-renders, minimal lag | TC-R |

**In scope:** all public routes (`/`, `/tournaments`, `/scrims`, `/teams`, `/results`, `/games`, `/leaderboard`, `/news`, `/organizations`, `/about`, `/contact`, `/login`, `/register`) plus authenticated routes (`/dashboard`, `/wallet`, `/profile`, `/scrims/:id`, `/tournament/:id`) when test credentials are configured.

**Out of scope:** payment provider latency, Cloud Functions cold starts (covered by the existing `tools/high-concurrency-audit.ts` ledger work), native mobile app.

---

## 2. System Under Test — Actual Cache & Data Layers

Verified against the repository (do not assume other layers exist):

| Layer | Implementation (EXISTS) | Where |
|---|---|---|
| Service worker cache | `nexplay-pwa-v1`; precached app shell (`/`, manifest, icons); **network-first** for same-origin GET with cache fallback; **excludes** `/api/*`, `__/auth/*`, Firebase/Firestore/Cloudinary hosts, non-GET | `public/sw.js` |
| HTTP cache headers | Static assets `public,max-age=31536000,immutable`; `/index.html` `no-cache` (Firebase) / `max-age=0, must-revalidate` (Vercel) | `firebase.json`, `vercel.json` |
| Firestore local cache | IndexedDB persistence via `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` — multi-tab safe | `src/shared/config/firebase.ts` |
| In-memory TTL cache | `withStaticCache(key, loader, ttlMs=5min)` + `invalidateStaticCache()` for near-static reference data (currently games catalog); failed loads are evicted so transient errors retry | `src/shared/utils/staticCache.ts` |
| Data access patterns | 145 one-shot reads (`getDoc`/`getDocs`), 23 real-time listeners (`onSnapshot`) across 12+ feature views | `src/features/**` |
| Server | Express serves the SPA + sitemap; **no server-side data API cache** — client talks to Firestore directly | `server.ts` |

### Gap analysis (updated after repair pass — 2026-10-05)

| Item | Status | Consequence for this plan |
|---|---|---|
| Loading skeletons | **IMPLEMENTED** — shared primitives in `src/shared/components/Skeleton.tsx` (`Skeleton`, `SkeletonText`, `PageHeaderSkeleton`, `CardSkeleton`, `CardGridSkeleton`, `LeaderboardRowSkeleton`, `NewsSkeleton`), integrated into `/tournaments`, `/scrims`, `/results`, `/news`, `/games`, `/organizations`, `/leaderboard`; every skeleton root carries `data-skeleton` for test targeting. Verified 7/7 routes render skeletons while fetches are held (TC-S-01). | TC-S runs as a live regression suite. `/dashboard` still needs a skeleton (authed route). |
| Web Vitals instrumentation | **IMPLEMENTED** — `web-vitals` package; `src/shared/utils/webVitals.ts` collects CLS/FCP/INP/LCP/TTFB into `window.__nexplayWebVitals`, dynamic-imported from `main.tsx` (off critical path). | TC-E reads real measurements via Playwright; RUM-ready. |
| Server-side API cache | **N/A** (no data API) | R1 is satisfied by SW + HTTP headers + Firestore SDK cache + `staticCache`; test those four. |
| Long-list virtualization | **UNVERIFIED** | TC-R-03 determines whether `/leaderboard` etc. need it. |
| Offline-write conflict policy | **UNDECIDED (product)** | TC-X-06 blocked on product decision; do not assume last-write-wins. |

---

## 3. Test Environment & Condition Matrix

### 3.1 Devices & screen sizes

| Profile | Viewport | DPR | Input | Priority |
|---|---|---|---|---|
| Small Android phone | 360×640 | 2 | touch | P0 |
| iPhone SE / mid phone | 375×667 | 2 | touch | P0 |
| Large phone | 390×844 | 3 | touch | P1 |
| Tablet (iPad Mini) | 768×1024 | 2 | touch | P1 |
| Small laptop | 1366×768 | 1 | mouse | P0 |
| Desktop FHD | 1920×1080 | 1 | mouse | P0 |
| Desktop QHD | 2560×1440 | 1 | mouse | P2 |

Real-device spot checks (P0, per release): one low-end Android (≤4 GB RAM), one iOS Safari — Playwright covers geometry, but SW lifecycle and IndexedDB persistence must be confirmed on real devices.

### 3.2 Network conditions (Chrome DevTools / Playwright CDP throttling)

| Profile | Down | Up | RTT | Packet loss | Used by |
|---|---|---|---|---|---|
| No throttle (fiber) | — | — | — | — | baselines |
| Fast 3G | 1.6 Mbps | 750 kbps | 150 ms | 0 | TC-E, TC-S |
| Slow 4G | 4 Mbps | 3 Mbps | 20 ms | 0 | TC-E, TC-S, TC-C |
| Regular 2G | 250 kbps | 50 kbps | 300 ms | 0 | TC-C offline/offline-first, TC-S |
| Flaky 3G | 1.6 Mbps | 750 kbps | 150 ms | 2% | TC-X, TC-E |
| Offline | 0 | 0 | — | — | TC-C, TC-X |

### 3.3 Backends

- **Firebase Local Emulator Suite** (Auth + Firestore): deterministic seed data, latency injection, CI-safe. Used for TC-D, TC-X, TC-S data states.
- **Production/dev Firebase project**: realism validation for TC-D/R3 benchmarks and TC-C SW behavior behind real CDN headers.

### 3.4 Tooling

| Tool | Purpose |
|---|---|
| Playwright (already a devDependency) | scripted multi-viewport/network runs, CDP network emulation, tracing |
| `tools/ui-layout-audit.ts` pattern | harness conventions to copy (tsx-runnable, PASS/FAIL console, JSON report, exit code) |
| `tools/high-concurrency-audit.ts` | concurrency/transaction baseline for TC-D-06 |
| Firebase Emulator Suite | seeded Firestore, forced latency, consistency tests |
| React DevTools Profiler + `Profiler` API in test build | re-render counts (TC-R) |
| Chrome DevTools Performance panel / CDP `Tracing` | INP, long tasks, scripting time |
| Lighthouse CI | FCP/LCP/TBT/CLS budgets per route × device profile |
| `curl` / `Playwright response.headers()` | HTTP cache header verification |

---

## 4. Performance Budgets (pass/fail thresholds)

Measured at Slow 4G unless stated. Any P0 budget breach = release blocker; P1 = must fix within one sprint.

| Metric | Budget | Applies to |
|---|---|---|
| TTFB (HTML, warm CDN) | ≤ 800 ms | all routes |
| FCP | ≤ 2.5 s | all routes |
| LCP | ≤ 4.0 s (P0 routes: `/`, `/tournaments`, `/scrims`) | content pages |
| INP | ≤ 300 ms (warn), ≤ 500 ms (fail) | all interactive routes |
| CLS while loading | ≤ 0.1 | all routes (TC-S-05) |
| Skeleton visible after | ≤ 100 ms from route enter / fetch start | TC-S-01 |
| Skeleton min display | ≥ 300 ms (no flash) and replaced within 50 ms of data | TC-S-03 |
| Firestore single-doc read (p95, emulator, no throttle) | ≤ 150 ms server-side observe; end-to-end p95 ≤ 600 ms incl. render | TC-D-01 |
| Firestore list query p50 / p95 (20 items, indexed) | ≤ 250 ms / ≤ 700 ms | TC-D-02 |
| Leaderboard aggregate (`getCountFromServer`) p95 | ≤ 400 ms | TC-D-03 |
| `onSnapshot` first payload → UI updated | ≤ 500 ms local, ≤ 1.5 s Slow 4G | TC-D-04 |
| Interaction → data displayed (e.g. filter tab switch) | ≤ 1.0 s Fast 3G, ≤ 2.5 s Regular 2G | TC-E-02/03 |
| Cached route load (2nd visit, SW cache) | ≥ 40% faster FCP than cold visit | TC-C-04 |
| Re-render count on unrelated state change | +0 renders of data lists (memoized) | TC-R-02 |
| Script time on route enter | no single long task > 200 ms on 4× CPU throttle | TC-R-05 |

---

## 5. Test Suites

Legend: **Pre** = preconditions · **Steps** = numbered · **Exp** = expected result · **Tool** = primary executor · **P** = priority.

### TC-C — Caching correctness (R1)

**TC-C-01 · App-shell precache (SW install)**
Pre: fresh browser profile, SW not registered. Steps: 1) open `/` → 2) wait `sw.js` `activated` → 3) open Cache Storage. Exp: `nexplay-pwa-v1` contains `/`, `/manifest.json`, `/logo.png`, favicons; install succeeds even if one asset 404s (per `sw.js` catch). Tool: Playwright. P0.

**TC-C-02 · Network-first serving**
Pre: SW active. Steps: 1) load `/tournaments` online → 2) modify the HTML response via CDP interception (marker comment) → 3) reload. Exp: page shows the network version (network-first wins when online); the marker does NOT prove cache-first. Tool: Playwright CDP. P0.

**TC-C-03 · Cache fallback (offline)**
Steps: 1) load `/` online → 2) set offline (CDP `Network.emulateNetworkConditions`) → 3) reload → 4) repeat on `/tournaments` (a route NOT in precache list). Exp: `/` renders from SW cache (app shell); `/tournaments` may fail gracefully — assert the app does not show a broken white screen and the failure is the documented behavior, then file a gap if the UX is unacceptable. Tool: Playwright. P0.

**TC-C-04 · Warm vs cold load benefit**
Steps: 1) cold load `/` (fresh profile, Fast 3G) record FCP → 2) reload (warm SW + HTTP cache) record FCP. Exp: warm FCP ≥ 40% faster; verify via `performance.getEntriesByType('navigation')` transferSize ≈ 0 for cached assets. Tool: Playwright. P0.

**TC-C-05 · HTTP cache headers**
Steps: for `/index.html`, one hashed `/assets/*.js`, one image, one Firebase/Firestore request: assert `Cache-Control` matches the matrix (`no-cache` HTML, `immutable` hashed assets, no store on Firestore/API). Exp: exact header match per `firebase.json`/`vercel.json`; hashed asset returns `200` (first) then `200 (from disk cache)`/`304` (repeat). Tool: Playwright `response.headers()` + `curl -I`. P0.

**TC-C-06 · SW exclusion rules**
Steps: 1) with SW active, fetch `/api/...`, `firestore.googleapis.com`, a Cloudinary URL, and a POST to `__/auth/...`; 2) inspect Cache Storage. Exp: none of these appear in any SW cache (pass-through per `sw.js`); mutations are never served stale. P0.

**TC-C-07 · Cache versioning & purge**
Steps: 1) active SW `v1` with populated cache → 2) deploy build with new `CACHE_NAME` (`v2`) → 3) reload twice. Exp: after activation, `nexplay-pwa-v1` is deleted (activate handler purges old keys); clients claim immediately (`skipWaiting` + `clients.claim`). P1.

**TC-C-08 · Cross-browser/real-device SW**
Steps: repeat TC-C-01/03 on iOS Safari and a real Android Chrome. Exp: same behavior; no `TypeError` from storage quota. P1 (release gate).

### TC-S — Loading skeletons (R2) — regression suite (skeletons implemented 2026-10-05)

> Shared primitives live in `src/shared/components/Skeleton.tsx`; every skeleton root carries `data-skeleton`. A working verification harness exists at `scratch/verify-skeletons.ts` (holds Firestore responses, asserts each route shows its skeleton within 3s of app mount; 7/7 passing). Promote it into the permanent suite.

**TC-S-01 · Skeleton appears immediately**
Steps: 1) throttle to Slow 4G → 2) navigate to each data route (`/tournaments`, `/scrims`, `/leaderboard`, `/results`, `/news`, `/games`, `/organizations`, `/dashboard`) → 3) assert `[data-skeleton]` visible ≤ 100 ms after route enter. Exp: skeleton (not spinner-only, not blank). Reference result: 7/7 public routes pass with held Firestore responses. Tool: Playwright (`scratch/verify-skeletons.ts`). P0.

**TC-S-02 · Skeleton geometry matches content**
Exp: skeleton block count/heights approximate the loaded state (±20% height) so that CLS ≤ 0.1 on swap (cross-check TC-S-05). P1.

**TC-S-03 · No flicker; no premature swap**
Steps: emulate data fetch completing in 80 ms (emulator) and 3 s (throttled). Exp: cached/local-persistence data replaces skeleton without a visible flash (min skeleton display ~300 ms via intentional delay only if UX decides); with 3 s fetch, skeleton persists, no timeout error UI before 10 s. P0.

**TC-S-04 · Error/empty states after skeleton**
Steps: force Firestore error (emulator rules deny) and empty collection. Exp: skeleton → error state with retry (not endless skeleton) / skeleton → empty state; never infinite spin. P0.

**TC-S-05 · Layout stability during swap**
Exp: CLS ≤ 0.1 measured with `PerformanceObserver('layout-shift')` across all data routes on all device profiles. P0.

### TC-D — Database response benchmarks (R3)

**TC-D-01 · Single-document reads**
Steps: harness (tsx, following `tools/*-audit.ts` conventions) reads 50 random docs from `tournaments`, `users_public`, `scrims` via `getDoc` against the emulator; repeat against dev project. Exp: p50/p95 within budget table; record numbers into `scratch/perf-baseline.json` for regression diffing. P0.

**TC-D-02 · List queries with pagination**
Steps: run the app's real queries (per `src/features/*` — e.g. tournaments by `matchType + startTime` per `firestore.indexes.json`) with limit 20, page through 5 pages. Exp: no full-collection scans (check emulator read counts stay ~limit-size); p95 within budget; query latency flat across pages (no degradation). P0.

**TC-D-03 · Aggregations**
Steps: `getCountFromServer` calls used by the Footer/Orgs browser (`users_public` count, organizer-role count). Exp: p95 ≤ 400 ms; confirm counts match seeded truth. P1.

**TC-D-04 · Real-time listener first payload + update push**
Steps: attach `onSnapshot` (as `Scrims.tsx` does) → measure first payload; write a change from a second client → measure propagation → UI update. Conditions: no-throttle and Slow 4G. Exp: within budget; no duplicate listener registration on route revisit (see TC-R-04). P0.

**TC-D-05 · Index coverage**
Steps: run every composite query in the app against the emulator with `verbose` logging. Exp: zero `FAILED_PRECONDITION: requires an index` errors; every query backed by `firestore.indexes.json`. P0.

**TC-D-06 · Concurrency**
Steps: reuse `tools/high-concurrency-audit.ts` (20 concurrent registrations) + add 50 concurrent list reads. Exp: p95 degradation ≤ 2× vs single-user; no transaction errors beyond documented rate limits. P1.

**TC-D-07 · Degraded conditions**
Steps: repeat TC-D-01/02 at Regular 2G + 4× CPU throttle. Exp: graceful pacing (skeletons active), errors/timeouts surface per §TC-S-04, no frozen UI. P1.

### TC-X — Cache ↔ database consistency (R4)

**TC-X-01 · Read-your-writes with Firestore persistence**
Steps: 1) offline-write (enabled by `persistentLocalCache`) e.g. update profile field → 2) read back offline → 3) go online. Exp: local cache reflects the write immediately; after reconnect, server value matches; no ghost/duplicate docs. P0.

**TC-X-02 · Multi-tab consistency**
Steps: open the app in 2 tabs (same profile, `persistentMultipleTabManager`), mutate data in tab A (join a scrim), observe tab B list. Exp: tab B updates via shared persistence/listener without reload; no double-applied writes; no `MultipleTabManager` warnings in console. P0.

**TC-X-03 · Mutation → cache invalidation**
Steps: 1) note `/scrims` list state → 2) join a scrim via `JoinScrimModal` → 3) re-navigate to `/scrims` (full route re-mount, not just listener update). Exp: re-mounted view shows the new state; one-shot `getDocs` reads must reflect the mutation (Firestore server/persistence cache is write-through, so this holds unless a manual cache interferes). P0.

**TC-X-07 · In-memory TTL cache validity (`staticCache`)**
Steps: 1) load `/games` (games catalog cached via `withStaticCache`, TTL 5 min) → 2) in Firestore console/emulator, change a game document → 3) re-navigate `/games` within TTL. Exp: stale-but-bounded data served from memory cache (by design for admin-managed reference data); after TTL expiry or `invalidateStaticCache('games')`, the change appears. Also: a failed load must NOT be cached (retry on next mount — per the `catch` eviction in `staticCache.ts`). P1.

**TC-X-04 · SW cache vs deploy (stale HTML/asset hazard)**
Steps: 1) warm cache on build N → 2) deploy build N+1 (new hashed assets, new HTML) → 3) reload. Exp: `index.html` revalidates (`no-cache`) → new asset URLs load → no mixed-version hydration errors; old SW cache purged (TC-C-07). P0.

**TC-X-05 · No cache poisoning of dynamic data**
Steps: grep-verify at runtime that no Firestore/Firebasestorage/API response ever lands in the SW Cache Storage after full navigation crawl. Exp: Cache Storage contains only same-origin static/app-shell entries (per TC-C-06 rules, but asserted post-crawl). P1.

**TC-X-06 · Offline → online reconciliation**
Steps: offline, queue 3 writes (scrim join attempts) → restore network with 2% loss. Exp: writes replay exactly once (idempotent), UI reflects server truth, conflict policy matches product spec (last-write or rejection — confirm with product, do not assume). P1.

### TC-E — End-to-end response times (R5)

**TC-E-01 · Route-load waterline (cold & warm)**
Steps: Playwright + Lighthouse CI for each route × device profile × {no-throttle, Fast 3G, Slow 4G}: record TTFB, FCP, LCP, TTI. Exp: §4 budgets; store baselines; flag regressions > 15% between runs. P0.

**TC-E-02 · Interaction → display (filters/tabs)**
Steps: on `/tournaments` (status tabs), `/games` (genre chips), `/leaderboard` (segmented toggles): click → measure until list content changes (MutationObserver on list container). Exp: ≤ 1.0 s Fast 3G / ≤ 2.5 s Regular 2G; skeleton or instant local-cache render during wait. P0.

**TC-E-03 · Interaction → display (heavy authed flows)**
Steps: `/dashboard` load, scrim join → modal → confirm → slot count update; wallet page load. Exp: budgets per §4; join confirmation visible ≤ 1.5 s Fast 3G. P0 (needs test credentials).

**TC-E-04 · Perceived speed regression gate**
Steps: wire Lighthouse CI budgets into the pipeline. Exp: build fails on P0 budget breach. P1.

### TC-R — Rendering optimization (R6)

**TC-R-01 · Render census (baseline)**
Steps: wrap `Home`, `Tournaments`, `Scrims`, `Leaderboard`, `Dashboard` lists in React `Profiler` (test build) → record render counts + durations on: initial load, data arrival, filter change, unrelated state change (open/close mobile menu). Exp: numbers recorded as the baseline contract. P0.

**TC-R-02 · No unnecessary re-renders**
Exp: opening an unrelated overlay (menu/modal) re-renders **0** list rows; typing in the games search re-renders only the filtered list, not sibling sections (assert via Profiler commits). Breach = refactor (memo/callback/selector) before release. P0.

**TC-R-03 · Long-list efficiency**
Steps: seed 500 leaderboard rows / 200 tournaments in emulator → scroll the full list on 4× CPU throttle. Exp: no frame > 200 ms scripting; measure scroll FPS ≥ 45; decide virtualization need from data. P0.

**TC-R-04 · Listener/subscription hygiene**
Steps: navigate `/scrims` → leave → re-enter ×5; count active `onSnapshot` connections (Firestore SDK debug logs / emulator UI). Exp: connections do not accumulate (old listeners unsubscribed on unmount); memory stable across 20 navigations (no leak). P0.

**TC-R-05 · Long tasks & INP**
Steps: CDP tracing on route enter + filter interactions, 4× CPU throttle. Exp: no long task > 200 ms (§4); INP within budget; `will-change`/animation compositing verified for the entrance animations (app uses `motion`) — animations run on compositor, not main thread. P1.

**TC-R-06 · Real-device smoothness**
Steps: manual + `chrome://tracing`-equivalent profiling on the low-end Android: scroll leaderboards, open modals, switch tabs. Exp: no visible jank; INP < 500 ms. P1 (release gate).

---

## 6. Execution Plan & Cadence

| Stage | Suites | When |
|---|---|---|
| 0. Harness setup | tsx/Playwright runners, emulator seed script, baseline capture | once, then maintained |
| 1. Baseline | TC-C, TC-D, TC-E, TC-R on all profiles | before skeleton implementation |
| 2. Skeleton acceptance | TC-S (spec) | when skeletons land |
| 3. Regression | full plan | every release; TC-C-05/06, TC-E-01, TC-R-02 nightly on CI |
| 4. Release gate | TC-C-08, TC-R-06, budgets green, no P0 open | per release |

**Entry criteria:** app builds and serves on :3005; emulator seeded; test credentials for authed routes stored in CI secrets (never in repo). **Exit criteria:** all P0 tests pass; budgets met; P1 failures triaged with owners; results (incl. `scratch/perf-baseline.json` diff) attached to the release.

---

## 7. Defect Classification

| Severity | Definition | Example |
|---|---|---|
| S1 | Data corruption/stale financial data, permanent broken state | TC-X-01 ghost docs; wallet shows wrong balance from cache |
| S2 | Budget breach P0, skeleton never appears on a P0 route | LCP > 4 s on `/`; infinite spinner |
| S3 | Budget breach P1, cosmetic jank | uneven skeleton swap, INP warn-level |
| S4 | Polish | skeleton shimmer style mismatch |

Never weaken a security or financial check to make a test pass (per repo rules); performance fixes must not bypass server-side authorization in `firestore.rules`.

---

## 8. Open Items Before Execution

1. ~~Implement skeletons~~ **DONE (2026-10-05)** — `src/shared/components/Skeleton.tsx` + 7 route integrations; verified via `scratch/verify-skeletons.ts` (7/7). Remaining: add a `/dashboard` skeleton (authed route) when test credentials are available.
2. ~~Web Vitals instrumentation~~ **DONE (2026-10-05)** — `web-vitals` → `src/shared/utils/webVitals.ts`, wired in `main.tsx`; metrics land in `window.__nexplayWebVitals`.
3. Provide **test credentials** (low-privilege player account) via CI secret for TC-E-03 and the `/dashboard` skeleton work.
4. Decide **product conflict policy** for TC-X-06 (last-write vs reject) — do not assume.
5. Confirm **seed dataset size** for TC-R-03 (500 rows chosen as default; adjust to production scale `users_public` count from the Footer aggregate).
6. Promote `scratch/verify-skeletons.ts` into the permanent Playwright suite and CI job alongside `tools/ui-layout-audit.ts`.
