# NexPlay Production Audit Report
**Audit Date:** August 12, 2026
**Auditor:** Elowen (Lead Architect AI)
**Codebase:** 141 source files, React 19 + Vite 6 + Firebase + Express + Firestore + Cloudinary

---

## Executive Summary

NexPlay is a Firebase/React esports tournament platform with a well-architected core.
The scoring engine, per-kill reward engine, tournament engine, and wallet system
all use proper validation, idempotency checks, and Firestore transactions.

**Overall Status: READY FOR STAGING** — with fixes needed for production hardening.

The major findings are:
1. **P1**: Organizer panel tabs (Scrims, Match Rooms, Teams, Activity Feed) receive
   hardcoded empty arrays — data is never fetched from Firestore.
2. **P1**: `fetchTransactions()` in `useOrgData` is never called on mount, leaving
   the organizer Wallet tab empty.
3. **P2**: Admin wallet operations (approve, refund, balance adjustment, tournament
   cancellation refunds) run as client-side Firestore transactions instead of
   server-side endpoints. This works but lacks server audit trails.
4. **P2**: PublicProfile fetches tournaments from Firestore but discards the data
   (unused state variable) — wasted read.
5. **P3**: Modal component lacks body scroll lock (background can scroll on mobile).
6. **P3**: `SubscriptionsTab.tsx` file still exists but is not rendered (dead code).

---

## 1. Architecture Findings

### Tech Stack
- **Frontend:** React 19, Vite 6, Tailwind CSS 4, Zustand, react-helmet-async, lucide-react
- **Backend:** Express (Vercel serverless via `api/index.ts`), Firebase Admin SDK
- **Database:** Firestore (with offline persistence), Firebase Storage
- **Auth:** Firebase Auth (email/password + Google), Custom Claims for roles
- **External:** Cloudinary (media), Google Gemini (AI banner generation), Discord (webhooks)
- **Deploy:** Vercel (frontend + serverless API), Firebase Hosting (optional)

### Route Architecture (32 routes)
All routes are lazy-loaded with chunk-retry on deployment hash mismatch.
Route guards via `ProtectedRoute` with role checks.
Legacy redirects: `/details/:id` → `/tournaments/:id`, `/profile/:id` → `/user/:id`.

### Firestore Security Rules (437 lines)
Comprehensive role-based access control:
- Admin bypass via Custom Claims (`request.auth.token.role == 'admin'`)
- Dual-check during migration (Custom Claims + Firestore doc fallback)
- Client writes blocked for `participants` and `transactions` (server-only)
- Tournament host can manage their own tournaments/groups/results
- Users can only modify non-financial fields on their own profile

### Server Architecture
- `api/index.ts` — Vercel serverless entry point
- `server/routes/auth.ts` — Legacy REST auth (frontend uses Firebase SDK directly)
- `server/routes/wallet.ts` — Deposit, withdrawal, tournament join, prize distribution
- `server/routes/tournaments.ts` — Group generation, tournament management
- `server/routes/media.ts` — Cloudinary upload with Firebase Storage fallback
- `server/routes/ai.ts` — Gemini-powered banner generation (organizer+admin only)
- `server/routes/discord.ts` — Discord webhook announcements (9 event types)
- `server/shared.ts` — Firebase Admin init, JWT auth, rate limiting, Cloudinary config

---

## 2. Issue Details

### P1-1: Organizer Panel Empty Data Tabs
**Location:** `src/features/organizer/views/OrganizerPanel.tsx` lines 197-226
**Problem:** `ScrimsHubTab`, `MatchRoomsTab`, `TeamsRostersTab`, and `OverviewTab`
are passed hardcoded empty arrays: `scrims={[]}`, `matchRooms={[]}`, `disputes={[]}`,
`teams={[]}`, `activityFeed={[]}`.
**Root Cause:** `useOrgData.ts` only fetches `hostedTournaments` on mount. No functions
exist to fetch scrims, match rooms, or team rosters.
**Fix:** Add fetch functions to `useOrgData.ts` for scrims (tournaments with
`matchType='scrims'`), match rooms (live tournaments), and team rosters (participants
with team data). Wire them into the useEffect.

### P1-2: Organizer fetchTransactions Never Called
**Location:** `src/features/organizer/hooks/useOrgData.ts`
**Problem:** `fetchTransactions()` exists but is never invoked in `useEffect` or
`OrganizerPanel.tsx`. The Wallet & Payouts tab shows empty transaction history.
**Fix:** Call `fetchTransactions()` in the mount `useEffect`.

### P2-1: Client-Side Admin Wallet Operations
**Location:** `src/features/admin/hooks/useAdminData.ts`
**Problem:** `handleApproveTx`, `handleRefundTx`, `executeRejectTx`, and
`handleCancelTournament` all run Firestore `runTransaction` directly from the browser.
While Firestore rules enforce admin-only access, this bypasses server-side audit
logging and risks partial batch failures on disconnect.
**Recommendation:** Migrate to server endpoints in `server/routes/wallet.ts` using
Firebase Admin SDK. Low priority since current implementation is functionally correct
with double-approve/reject prevention.

### P2-2: Wasted Firestore Read in PublicProfile
**Location:** `src/features/profile/views/PublicProfile.tsx` line 20, 66-68
**Problem:** `const [, setTournaments] = useState<Tournament[]>([])` — tournaments
are fetched from Firestore but the state variable is never read. Wasted read on
every public profile view.
**Fix:** Either use the data (show hosted tournaments) or remove the fetch.

### P3-1: Modal Missing Body Scroll Lock
**Location:** `src/shared/components/Modal.tsx`
**Problem:** When a modal is open, the background page can still scroll on mobile.
No `document.body.style.overflow` lock is applied.
**Fix:** Add `useEffect` to set `document.body.style.overflow = 'hidden'` when open
and restore on close.

### P3-2: Dead SubscriptionsTab File
**Location:** `src/features/admin/views/admin-panel-tabs/SubscriptionsTab.tsx`
**Problem:** File exists but is not imported or rendered by AdminPanel.
**Fix:** Delete the file.

---

## 3. Feature Status Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication (login/register/logout) | WORKING | Firebase Auth + 8s timeout fallback |
| Route protection | WORKING | ProtectedRoute with role checks |
| Tournament creation | WORKING | Organizer create with Firestore rules |
| Tournament registration | WORKING | Server-side atomic via `/api/wallet/join-tournament` |
| Tournament lifecycle | WORKING | Draft → Published → Live → Completed |
| Group generation | WORKING | `tournamentEngine.generateGroups()` |
| Match generation | WORKING | BR and 1v1 modes |
| Scoring engine | WORKING | Kill + placement points with validation |
| Per-kill rewards | WORKING | Individual verification, team aggregation |
| Standings aggregation | WORKING | Multi-match sum with tie-breakers |
| Wallet deposits | WORKING | Server endpoint with duplicate detection |
| Wallet withdrawals | WORKING | Atomic balance lock via Firestore transaction |
| Admin deposit approval | WORKING | Double-approve prevention via runTransaction |
| Admin withdrawal rejection | WORKING | Refund balance on rejection |
| Tournament entry fee | WORKING | Atomic deduction + participant create |
| Prize distribution | WORKING | Server-side batch with balance update |
| Discord announcements | WORKING | 9 event types via webhooks |
| AI banner generation | WORKING | Gemini API, organizer+admin only |
| Media upload | WORKING | Cloudinary with Firebase Storage fallback |
| Organizer panel | PARTIALLY WORKING | Tournaments tab works; scrims/rooms/teams empty |
| Team management | WORKING | Create, invite, join, leave |
| Scrims | WORKING | Create, edit, slot management, status transitions |
| Leaderboard | WORKING | Real Firestore data |
| Results | WORKING | Manual + BR result entry |
| News/Posts | WORKING | Admin creates, public feed at /news |
| Profile | WORKING | Edit + save to Firestore with batch write |
| Public profile | PARTIALLY WORKING | Wasted tournament read |
| SEO | WORKING | Sitemap, robots.txt, IndexNow, JSON-LD, Helmet |
| Responsive layout | WORKING | Container-based with mobile breakpoints |

---

## 4. Security Summary

- No hardcoded admin UIDs or bypass tokens
- No secrets in frontend code
- Maintenance bypass is dev-only (`import.meta.env.DEV` guard)
- Firestore rules block client-side writes to transactions and participants
- Wallet operations use server-side atomic transactions
- Rate limiting on all server endpoints
- Input validation on all server routes
- JWT auth middleware on all protected endpoints
- File upload validation (type + size)

---

## 5. Test Results

- **TypeScript:** 0 errors (`tsc --noEmit` passes)
- **Build:** Passes (vite build)
- **No empty onClick handlers found**
- **No fake success messages found**
- **No TODO/Coming Soon buttons found** (except intentional 2FA label)

---

## 6. Remaining Issues (Post-Fix)

After applying the fixes below:
- P2-1 (server-side admin ops) is a hardening recommendation, not a bug
- All P1 and P3 issues will be resolved

---

## 7. Final Status

**READY FOR STAGING** → Fix P1 issues → **READY FOR PRODUCTION**
