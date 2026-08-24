# NexPlay Codebase — Full Technical Documentation Report

**Generated:** August 12, 2026  
**Author:** Elowen (AI Agent)  
**Repository:** `github.com/unishghimire/nexplay-ai-acess-tourment-web-app`  
**Production URL:** `www.nexplayorg.app`  
**Hosting:** Vercel (Vite SPA framework)  
**Latest Commit:** `4668a28` — Firestore timeout fallback fix

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.0.0 |
| Build Tool | Vite | 6.2.0 |
| Language | TypeScript | ~5.8.2 |
| Styling | Tailwind CSS | 4.1.14 |
| Routing | react-router-dom | 7.13.2 |
| SEO | react-helmet-async | 3.0.0 |
| State (local) | React Context + Zustand | 5.0.13 |
| Backend (BaaS) | Firebase | 12.11.0 |
| Auth | Firebase Auth (Google + Email/Password) | — |
| Database | Cloud Firestore (custom DB ID) | — |
| File Storage | Cloudinary (via server proxy) | 2.10.0 |
| Image Processing | browser-image-compression | 2.0.2 |
| Icons | lucide-react | 0.546.0 |
| Animations | motion (Framer Motion) | 12.23.24 |
| DnD | @hello-pangea/dnd | 18.0.1 |
| Backend Server | Express (dev only, Vite middleware) | 4.21.2 |
| Admin SDK | firebase-admin | 13.7.0 |

### 1.2 Directory Structure (122 source files, ~26,862 lines)

```
src/
├── App.tsx                          # Root: routing, providers, maintenance mode
├── main.tsx                         # Entry point (React 19 createRoot)
├── index.css                        # Global Tailwind + custom CSS
├── features/                        # Feature-based modules
│   ├── admin/                        # Admin panel (12 tabs)
│   │   ├── components/               # DiscordAdminPanel, TransactionDetailModal
│   │   ├── hooks/                    # useAdminData, useTournamentAdmin
│   │   └── views/
│   │       ├── AdminPanel.tsx
│   │       ├── TournamentAdminPanel.tsx
│   │       ├── admin-panel-tabs/     # 12 tab components (Dashboard, Users, Payments, etc.)
│   │       └── tournament-admin-tabs/# 6 tabs (Brackets, Groups, Matches, etc.)
│   ├── auth/                         # Login, Register, CompleteProfile
│   ├── browser/                      # GameBrowser, OrgBrowser, PostDetails, GameModesBrowser
│   ├── dashboard/                    # User dashboard
│   ├── home/                         # Home, About, Contact, Privacy, Terms, NotFound
│   ├── leaderboard/                  # National rankings
│   ├── organizer/                    # Organizer panel (7 tabs), ScrimDetailPage
│   ├── profile/                      # Profile (private), PublicProfile
│   ├── results/                      # Match results upload & display
│   ├── scrims/                       # Scrims listing
│   ├── teams/                        # Teams list, TeamDetails
│   ├── tournaments/                  # Tournaments list, TournamentDetails, modals
│   └── wallet/                       # Wallet, WalletModal
└── shared/
    ├── components/                   # Navbar, Footer, Breadcrumbs, Seo, ErrorBoundary, etc.
    │   ├── layouts/                  # DashboardLayout
    │   └── navbar/                   # MobileMenu, NotificationDropdown, ProfileDropdown, WalletDisplay
    ├── config/                       # firebase.ts (init + error handling)
    ├── constants/                    # constants.ts, finance.ts
    ├── context/                      # AuthContext, NotificationContext, SiteSettingsContext
    ├── hooks/                        # useClickOutside, useInView, useInvisibleImage, useNotifications
    ├── services/                     # NotificationService, DiscordService, mediaService
    ├── types/                        # types.ts (all TypeScript interfaces)
    └── utils/                        # utils.ts (formatCurrency, formatDate, timeAgo, etc.)
```

### 1.3 Application Flow

```
main.tsx
  └── App.tsx
       ├── ErrorBoundary (catches all uncaught React errors)
       └── HelmetProvider (SEO head management)
            └── AuthProvider (Firebase auth state + user profile)
                 └── SiteSettingsProvider (maintenance mode, notices, config)
                      └── NotificationProvider (real-time notifications + toasts)
                           └── Router (BrowserRouter)
                                └── AppContent
                                     ├── authLoading OR settingsLoading → LoadingFallback (spinner)
                                     ├── maintenanceMode (non-admin) → Maintenance screen
                                     └── Normal render:
                                          ├── Navbar (with notification/profile/wallet dropdowns)
                                          ├── Notice banner (if active)
                                          ├── Breadcrumbs (auto from route)
                                          ├── ScrollToTop
                                          ├── BackButton (non-home pages)
                                          ├── ProfileCompletionGuard (redirects to /complete-profile)
                                          ├── Suspense → Routes (lazy-loaded views)
                                          └── Footer
```

---

## 2. FIREBASE CONFIGURATION

### 2.1 Config File (`firebase-applet-config.json`)

```json
{
  "projectId": "gen-lang-client-0077787807",
  "appId": "1:935623640940:web:fa78079f48258173f0d549",
  "apiKey": "AIzaSyDdKdsIkES-GbkJAm7bLqmStH949UuG_v8",
  "authDomain": "gen-lang-client-0077787807.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-26f2d1e6-0f23-429d-bff6-19f4e58cf589",
  "storageBucket": "gen-lang-client-0077787807.firebasestorage.app",
  "messagingSenderId": "935623640940",
  "measurementId": "G-E3412GR6V4"
}
```

**IMPORTANT:** The project uses a **custom Firestore database ID** (`ai-studio-26f2d1e6-0f23-429d-bff6-19f4e58cf589`), not the default database. The `firebase.ts` config handles this:

```typescript
export const db = (firebaseConfig as any).firestoreDatabaseId 
    ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) 
    : getFirestore(app);
```

### 2.2 Firebase Initialization (`src/shared/config/firebase.ts`)

- **App:** `initializeApp` (singleton via `getApps().length === 0` check)
- **Auth:** `getAuth(app)` + `GoogleAuthProvider`
- **Firestore:** `getFirestore(app, customDatabaseId)` — custom database
- **Storage:** `getStorage(app)`
- **Analytics:** Lazy-initialized (browser-only, with `isSupported()` check)
- **Error handling:** `handleFirestoreError()` function with `OperationType` enum, dispatches `app-error` custom event
- **Network:** `reconnectFirestore()` helper using `enableNetwork(db)`

### 2.3 Firestore Collections

| Collection | Purpose | Access |
|-----------|---------|--------|
| `users` | Private user profiles | Owner read, admin read all, owner create (player role only) |
| `users_public` | Public profiles (leaderboard, search) | Public read, owner write |
| `tournaments` | Tournament data | Public read, organizer create/update own |
| `scrims` | Scrim listings | Public read, organizer create/update own |
| `notifications` | User notifications | Owner read/update |
| `transactions` | Financial transactions | Owner create (pending), admin update |
| `settings/site` | Site config (maintenance, notices) | Public read, admin write |
| `teams` | Esports teams | Public read, owner create/update |
| `team_members` | Team membership | Owner read, team captain manage |
| `team_invites` | Team invitations | Owner read, accept/decline |
| `team_activity` | Team activity log | Owner read |
| `games` | Game catalog | Public read, admin write |
| `payment_categories` | Payment category config | Public read, admin write |
| `payment_methods` | Payment method config (QR, instructions) | Public read, admin write |
| `slides` | Home page slider | Public read, admin write |
| `promo_codes` | Promo codes | Owner redeem, admin manage |
| `match_history` | Match results history | Owner read, system write |
| `participants` | Tournament registrations | Public read, organizer manage |
| `media` | Media file metadata | Owner read, system write |

### 2.4 Security Rules (`firestore.rules`)

### 2.5 Scrims vs. Tournaments Decoupled Architecture

The platform strictly decouples **Scrims** (fast-paced daily practice) and **Tournaments** (multi-stage championships) into two isolated data models and controllers:

#### A. Scrims Engine
* **Data Model:** `src/shared/types/scrim.types.ts` (`Scrim`, `ScrimSlot`, `ScrimCredentials`, `ScrimResultEntry`).
* **Backend Controller:** `server/routes/scrims.ts` (`GET /api/scrims`, `POST /api/scrims`, `POST /api/scrims/:id/join`, `POST /api/scrims/:id/slot`, `POST /api/scrims/:id/dispatch-room`, `POST /api/scrims/:id/payout`, `DELETE /api/scrims/:id`).
* **Format Slot Matrix:**
  * **Squad Format:** Strictly fixed at exactly **12 slots** (Slots 1 to 12).
  * **Duo Format:** Strictly fixed at exactly **25 slots** (Slots 1 to 25).
  * **Solo Format:** Strictly fixed at exactly **48 slots** (Slots 1 to 48).
  * Helper: `getScrimSlotCount(format)` in `src/shared/utils/scrimSlots.ts`.
* **Lobby Structure:** Single flat lobby with real-time seat lock/unlock toggling and atomic concurrency locks.
* **Credentials:** Isolated in `/scrims/{id}/credentials/main`.

#### B. Tournaments Engine
* **Data Model:** `src/shared/types/tournament.types.ts` (`Tournament`, `TournamentStageConfig`, `TournamentGroup`, `TournamentGroupTeam`).
* **Backend Controller:** `server/routes/tournaments.ts` (`POST /api/tournaments/:id/groups/generate`, `POST /api/tournaments/:id/advance`, `DELETE /api/tournaments/:id`).
* **Format Structure:** Multi-stage roadmap (Qualifiers $\rightarrow$ Quarterfinals $\rightarrow$ Semifinals $\rightarrow$ Grand Finals) with 12 teams max per group and automated advancement.
* **Dual-Collection Resilience:** All search, read, and delete operations automatically aggregate and reconcile records across both `/scrims` and `/tournaments` collections.

---

## 3. CONTEXT PROVIDERS (State Management)

### 3.1 AuthContext (`src/shared/context/AuthContext.tsx`)

**Behavior:**
- Wraps the entire app. Provides `{ user, profile, loading, logout }`
- `onAuthStateChanged` listener fires on mount:
  - If user exists: `getDoc(users/uid)` → if not found, creates new user doc + public profile (first Google sign-in flow)
  - If no user: clears state
  - **8s timeout fallback** (added in commit `4668a28`): If `onAuthStateChanged` never fires (network/Firebase issue), unblocks UI as logged-out
- Real-time profile sync: `onSnapshot(users/uid)` — profile updates live in navbar/wallet
- Presence management:
  - Debounced 5s (`ponytail:` — was every visibilitychange event)
  - Status: `online` (visible), `idle` (hidden), `offline` (beforeunload)
  - DND status is respected (won't auto-overwrite)
- `logout()`: Sets `status: 'offline'`, calls `signOut(auth)`

**API:**
```typescript
const { user, profile, loading, logout } = useAuth();
// user: { uid, email, username, role } | null
// profile: UserProfile | null (full Firestore document)
// loading: boolean (true during initial auth check)
// logout: () => Promise<void>
```

### 3.2 SiteSettingsContext (`src/shared/context/SiteSettingsContext.tsx`)

**Behavior:**
- Listens to `onSnapshot(doc(db, 'settings', 'site'))` for real-time site config
- **8s timeout fallback** (added in commit `4668a28`): If Firestore never responds, renders with `settings = null` (no maintenance mode, no notice)
- Provides `{ settings, loading }`

**Settings fields:**
```typescript
interface SiteSettings {
    minWithdrawal: number;
    supportEmail: string;
    supportPhone: string;
    notice: string;
    isNoticeActive: boolean;
    isOrgFormOpen: boolean;
    orgFormDescription?: string;
    maintenanceMode?: boolean;
    updatedAt: Timestamp;
}
```

### 3.3 NotificationContext (`src/shared/context/NotificationContext.tsx`)

**Behavior:**
- Provides `showToast(message, type)` for ephemeral UI feedback (auto-dismiss after 5s)
- Real-time `onSnapshot` on `notifications` collection (filtered by `userId`)
- Tracks `notifiedTournamentsRef` to prevent duplicate tournament-live notifications
- Wraps `NotificationService` for create/markAsRead/markAllAsRead

---

## 4. ROUTING (App.tsx)

### 4.1 Route Map

| Path | Component | Access | Lazy |
|------|-----------|--------|------|
| `/` | Home | Public | Yes |
| `/tournaments` | Tournaments | Public | Yes |
| `/scrims` | Scrims | Public | Yes |
| `/games` | GameBrowser | Public | Yes |
| `/results` | Results | Public | Yes |
| `/games/:id` | GameModesBrowser | Public | Yes |
| `/details/:id` | TournamentDetails | Public | Yes |
| `/post/:id` | PostDetails | Public | Yes |
| `/dashboard` | Dashboard | Auth required | Yes |
| `/profile` | Profile | Auth required | Yes |
| `/wallet` | Wallet | Auth required | Yes |
| `/complete-profile` | CompleteProfile | Auth required | Yes |
| `/user/:id` | PublicProfile | Public | Yes |
| `/profile/:id` | PublicProfile | Public | Yes |
| `/organization/:id` | PublicProfile | Public | Yes |
| `/organizations` | OrgBrowser | Public | Yes |
| `/teams` | Teams | Public | Yes |
| `/team/:id` | TeamDetails | Public | Yes |
| `/leaderboard` | Leaderboard | Public | Yes |
| `/admin` | AdminPanel | admin role | Yes |
| `/organizer` | OrganizerPanel | organizer/admin role | Yes |
| `/tournament-admin/:id` | TournamentAdminPanel | organizer/admin role | Yes |
| `/organizer/scrim/:id` | ScrimDetailPage | organizer/admin role | Yes |
| `/login` | Login | Public | Yes |
| `/register` | Register | Public | Yes |
| `/about` | About | Public | Yes |
| `/contact` | Contact | Public | Yes |
| `/privacy` | Privacy | Public | Yes |
| `/terms` | Terms | Public | Yes |
| `*` | NotFound | Public | Yes |

### 4.2 Route Protection

**`ProtectedRoute`** component:
- Checks `loading` → shows spinner
- Checks `user` → redirects to `/login` if not authenticated
- Checks `allowedRoles` → waits for `profile` to load (prevents race condition), then checks role
- Supports `allowedRoles={['admin']}` or `allowedRoles={['organizer', 'admin']}`

**`ProfileCompletionGuard`** component:
- Redirects to `/complete-profile` if user is missing required fields (inGameId, phone)

---

## 5. SEO IMPLEMENTATION

### 5.1 Seo Component (`src/shared/components/Seo.tsx`)

Reusable component wrapping `react-helmet-async`'s `<Helmet>`:

**Props:**
```typescript
interface SeoProps {
    title: string;              // Page <title>
    description: string;        // Meta description
    canonicalPath?: string;     // Builds canonical URL from BASE_URL + path
    ogType?: string;            // Open Graph type (default: 'website')
    ogImage?: string;           // OG/Twitter image (default: /og-default.jpg)
    jsonLd?: object | object[]; // Structured data (JSON-LD)
    noindex?: boolean;          // Set robots to 'noindex, follow' (default: false)
    children?: React.ReactNode; // Additional Helmet content
}
```

**Behavior:**
- Sets `<title>`, meta description, meta robots
- Sets canonical URL (`<link rel="canonical">`)
- Sets Open Graph tags (type, site_name, title, description, image, url)
- Sets Twitter Card tags (summary_large_image)
- Renders JSON-LD structured data via `<script type="application/ld+json">`

**BASE_URL:** `https://www.nexplayorg.app`

### 5.2 Pages with SEO

| Page | noindex | JSON-LD Schema | Canonical |
|------|---------|---------------|-----------|
| Home | No | WebSite + Organization | `/` |
| Tournaments | No |ItemList (upcoming + live) | `/tournaments` |
| Scrims | No | FAQ + ItemList | `/scrims` |
| TournamentDetails | No | SportsEvent | `/details/:id` |
| Teams | No | ItemList | `/teams` |
| TeamDetails | No | (planned: SportsTeam) | `/team/:id` |
| Leaderboard | No | — | `/leaderboard` |
| About | No | — | `/about` |
| Contact | No | — | `/contact` |
| Results | No | — | `/results` |
| Dashboard | Yes | — | — |
| Profile | Yes | — | — |
| Wallet | Yes | — | — |
| CompleteProfile | Yes | — | — |
| OrganizerPanel | Yes | — | — |
| AdminPanel | Yes | — | — |
| Login/Register | Yes | — | — |

### 5.3 robots.txt (`public/robots.txt`)

- Allows all crawlers
- Explicitly allows AI crawlers: GPTBot, Claude-Bot, PerplexityBot, Applebot-Extended, Google-Extended
- Sitemap reference: `https://www.nexplayorg.app/sitemap.xml`
- Host: `https://www.nexplayorg.app`

### 5.4 sitemap.xml (`public/sitemap.xml`)

Static XML with all public routes. Cached for 1 hour (Vercel header config).

### 5.5 Breadcrumbs (`src/shared/components/Breadcrumbs.tsx`)

Auto-generates breadcrumbs from route path. Includes `BreadcrumbList` JSON-LD schema for SEO.

### 5.6 Server-Side SEO (Express, dev only)

The `server.ts` includes:
- Dynamic `/sitemap.xml` generation (fetches tournaments/scrims from Firestore)
- `/api/indexnow` endpoint for IndexNow ping (Bing, Yandex)
- These run in dev mode only; production uses static `public/sitemap.xml`

---

## 6. SERVICES

### 6.1 NotificationService (`src/shared/services/NotificationService.ts`)

**API:**
```typescript
NotificationService.create(userId, title, message, type, link?)
// Creates a notification document in `notifications` collection

NotificationService.markAsRead(notificationId)
// Updates `read: true` on a single notification

NotificationService.markAllAsRead(userId)
// Batch updates all unread notifications for a user
```

**Behavior:** All operations write to Firestore `notifications` collection. Errors are caught and logged (non-throwing).

### 6.2 DiscordService (`src/shared/services/DiscordService.ts`)

**API:**
```typescript
DiscordService.announceTournament(tournament, type)
DiscordService.announceScrim(scrim, type)
```

**Announcement types:**
- `tournament_published`, `tournament_live`, `tournament_completed`
- `group_published`, `game_start`, `game_time`
- `scrim_published`, `scrim_live`, `scrim_completed`

**Behavior:**
- Sends announcements via secure server-side proxy (`/api/discord/announce`)
- Webhook URL is NEVER exposed to the browser
- Requires Firebase auth token (`Bearer` header)
- Two channels: `tournaments` and `scrims`

### 6.3 MediaService (`src/shared/services/mediaService.ts`)

**API:**
```typescript
MediaCategory enum: USER_AVATAR, TEAM_LOGO, TEAM_BANNER, ORG_LOGO, ORG_BANNER,
    TOURNAMENT_BANNER, TOURNAMENT_THUMBNAIL, SCRIM_BANNER, PRODUCT_IMAGE,
    NEWS_IMAGE, SPONSOR_LOGO, OVERLAY_GRAPHIC, OTHER
```

**Behavior:**
- Frontend uploads go through `/api/process-image` proxy (Cloudinary)
- Requires Firebase auth token
- Handles: upload, validation, replacement, deletion
- Tracks media metadata in Firestore `media` collection
- Uses `browser-image-compression` for client-side pre-compression (max 1MB, 1920px)

---

## 7. KEY UTILITIES (`src/shared/utils/utils.ts`)

| Function | Purpose |
|----------|---------|
| `formatCurrency(amount, prefix)` | Formats with compact notation (e.g., "Rs. 1.2K") |
| `toDateSafe(ts)` | Safely converts Firestore Timestamp / Date / string to Date |
| `formatDate(ts)` | Formats timestamp as `en-NP` locale string |
| `timeAgo(ts)` | Human-readable relative time ("3h ago") |
| `getYoutubeId(url)` | Extracts YouTube video ID from various URL formats |
| `calculateLevel(xp)` | Level = floor(XP / 500) + 1 |
| `getXPForNextLevel(level)` | Returns XP needed for next level (level * 500) |
| `getLevelProgress(xp)` | Returns 0-100 progress percentage for current level |
| `formatGameModeLabel(mode)` | Normalizes game mode names (handles typos like "battelroyal") |
| `formatGameName(name)` | Normalizes game names ("free fire" → "Free Fire") |

---

## 8. HOOKS

| Hook | Purpose |
|------|---------|
| `useClickOutside(ref, handler)` | Detects clicks outside a ref element (dropdowns, modals) |
| `useInView(options?)` | IntersectionObserver-based lazy load trigger (returns `{ ref, isInView }`) |
| `useInvisibleImage(options)` | Image upload pipeline: validate → compress → base64 → server proxy |
| `useNotifications()` | Real-time notification stream (wraps NotificationContext) |
| `useAdminData()` | Admin panel data fetching (users, transactions, tournaments) |
| `useTournamentAdmin()` | Tournament admin operations (brackets, groups, matches) |
| `useOrgData()` | Organizer panel data fetching |

---

## 9. SHARED COMPONENTS

| Component | File | Purpose |
|-----------|------|---------|
| `Navbar` | `Navbar.tsx` | Top nav with logo, links, notification dropdown, profile dropdown, wallet display |
| `Footer` | `Footer.tsx` | Site footer with links, social, branding |
| `Breadcrumbs` | `Breadcrumbs.tsx` | Auto breadcrumbs from route + BreadcrumbList JSON-LD |
| `Seo` | `Seo.tsx` | Reusable SEO meta + structured data (see §5.1) |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Catches uncaught React errors, shows "System Malfunction" screen |
| `ProtectedRoute` | `ProtectedRoute.tsx` | Auth + role guard for protected routes |
| `ScrollToTop` | `ScrollToTop.tsx` | Scrolls to top on route change |
| `BackButton` | `BackButton.tsx` | Back navigation button (hidden on home) |
| `Modal` | `Modal.tsx` | Reusable modal component |
| `ConfirmModal` | `ConfirmModal.tsx` | Confirmation dialog |
| `Toast` | `Toast.tsx` | Toast notification UI (auto-dismiss) |
| `Faq` | `Faq.tsx` | FAQ accordion with FAQPage JSON-LD schema |
| `ImageUploader` | `ImageUploader.tsx` | Image upload UI (paste, drop, file picker) |
| `DashboardLayout` | `layouts/DashboardLayout.tsx` | Shared layout for admin/organizer panels |
| `MobileMenu` | `navbar/MobileMenu.tsx` | Mobile slide-out navigation |
| `NotificationDropdown` | `navbar/NotificationDropdown.tsx` | Notification bell dropdown |
| `ProfileDropdown` | `navbar/ProfileDropdown.tsx` | User avatar dropdown (profile, wallet, logout) |
| `WalletDisplay` | `navbar/WalletDisplay.tsx` | Balance display in navbar |

---

## 10. FEATURE MODULES

### 10.1 Admin Panel

**Entry:** `AdminPanel.tsx` → 12 tabs:
1. **DashboardTab** — Site overview stats
2. **UsersTab** — User management (ban, unban, role change)
3. **TournamentsTab** — Tournament management
4. **PaymentsTab** — Payment category/method configuration
5. **PendingDepositsTab** — Approve/reject deposit requests
6. **PendingWithdrawalsTab** — Approve/reject withdrawal requests
7. **SubscriptionsTab** — Subscription plan management
8. **PromoTab** — Promo code creation/management
9. **GamesTab** — Game catalog management
10. **MediaTab** — Media library
11. **OrganizersTab** — Organizer approval workflow
12. **SettingsTab** — Site settings (maintenance, notices, support contacts)
13. **OrgApprovalsTab** — Organization applications
14. **OrgTournamentsTab** — Organization tournaments view
15. **OrgEarningsTab** — Organization earnings view

### 10.2 Tournament Admin Panel

**Entry:** `TournamentAdminPanel.tsx` → 6 tabs:
1. **OverviewTab** — Tournament summary
2. **ParticipantsTab** — Registration management
3. **GroupsTab** — Group stage configuration
4. **BracketsTab** — Bracket generation and management
5. **MatchesTab** — Match scheduling and results
6. **SettingsTab** — Tournament settings (room ID, password, YT link)

### 10.3 Organizer Panel

**Entry:** `OrganizerPanel.tsx` → 7 tabs:
1. **OverviewTab** — Organizer dashboard
2. **TournamentsTab** — Create/manage tournaments
3. **ScrimsHubTab** — Create/manage scrims
4. **TeamsRostersTab** — Team management
5. **WalletPayoutsTab** — Earnings and payouts
6. **SettingsStreamTab** — Stream settings, overlay management
7. **MatchRoomsTab** — Match room configuration

### 10.4 Tournaments

- **Tournaments.tsx** — List page with filters (game, status, type)
- **TournamentDetails.tsx** — Full details: prize pool, rules, participants, roadmap, group standings, brackets, room info, results
- **TournamentCreateModal** — Organizer creates new tournament
- **JoinTournamentModal** — Player joins tournament
- **RegistrationModal** — Registration with in-game ID
- **TournamentCard** — Card component for listings
- **PrizeBoard** — Prize distribution display
- **PrizeDistributionInput** — Drag-and-drop prize configuration
- **RoadmapView** — Tournament stage/round timeline
- **GroupStandingsView** — Group stage standings table

### 10.5 Wallet

- **Wallet.tsx** — Balance, transaction history, deposit/withdraw modals, analytics chart
- **WalletModal.tsx** — Deposit/withdraw flow with QR code, payment method selection
- Uses `finance.ts` constants for transaction types, fee calculations

### 10.6 Profile

- **Profile.tsx** — Edit profile: avatar, banner, in-game details, social links, bio, skills
- **PublicProfile.tsx** — Public view: stats, match history, team info, social links
- **ProfileLink.tsx** — Reusable profile link component

---

## 11. DEPLOYMENT

### 11.1 Vercel Configuration (`vercel.json`)

```json
{
  "framework": "vite",
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api" }],
  "headers": [
    { "source": "/sitemap.xml", "headers": [Content-Type, Cache-Control] },
    { "source": "/robots.txt", "headers": [Content-Type, Cache-Control] }
  ]
}
```

- **Build:** `vite build` → outputs to `dist/`
- **SPA routing:** Vercel rewrites all routes to index.html (client-side routing)
- **API:** `/api/*` routes go to Vercel serverless functions
- **Cache:** sitemap.xml and robots.txt cached for 1 hour

### 11.2 Vite Configuration (`vite.config.ts`)

- React plugin (`@vitejs/plugin-react`)
- Tailwind plugin (`@tailwindcss/vite`)
- Manual chunks for: react-core, react-dom, vendor, helmet, firebase-core, firebase-firestore, firebase-auth, firebase-storage, firebase-analytics, icons, router
- Production build generates hashed filenames

### 11.3 Build Output

Latest build produces:
- `index-[hash].js` (~40KB) — main entry
- `vendor-[hash].js` (~369KB, gzip: 122KB) — third-party libs
- `firebase-firestore-[hash].js` (~331KB, gzip: 75KB) — Firestore SDK
- `react-dom-vendor-[hash].js` (~185KB, gzip: 58KB) — React DOM
- Various feature chunks (lazy-loaded)

### 11.4 Server (Dev Only, `server.ts`)

Express server on port 3000:
- **Routes:** auth, tournaments, media, ai, discord, wallet
- **Vite middleware** (dev mode) — serves React app
- **Production** — serves static `dist/` files
- **SEO endpoints:** `/sitemap.xml` (dynamic), `/api/indexnow`

---

## 12. TYPESCRIPT TYPES (`src/shared/types/types.ts`)

Key interfaces (37 total):

| Interface | Purpose |
|-----------|---------|
| `UserProfile` | Full user document (uid, email, role, balance, stats, social, subscription) |
| `Tournament` | Tournament document (title, game, prize, format, groups, brackets, status) |
| `Scrim` | Scrim listing (title, game, type, slots, status) |
| `Team` | Esports team (name, logo, players, stats, ranking) |
| `TeamMember` | Team membership (role: admin/moderator/member) |
| `Match` | Match data (teams, score, status, scheduled time, replay) |
| `Transaction` | Financial transaction (type, amount, method, status, proof) |
| `Notification` | User notification (title, message, type, read) |
| `SiteSettings` | Site config (maintenance, notices, support contacts) |
| `Game` | Game catalog entry (name, logo, modes) |
| `PromoCode` | Promo code (code, amount, maxUses, isActive) |
| `PaymentMethod` | Payment method (QR, instructions, category) |
| `PrizeDistribution` | Prize rank/amount (drag-and-drop orderable) |
| `RoundConfig` | Tournament round configuration |
| `PointRule` | Points system (placement points, kill points, bonuses) |

---

## 13. BUGS FIXED (This Session)

### 13.1 Misplaced Seo Components (Commit `1023809`)

**Problem:** During the SEO enhancement pass, `<Seo>` components were incorrectly inserted inside `.map()` callbacks in Dashboard.tsx and Wallet.tsx, instead of at the top of the main component return.

**Impact:** Multiple Helmet instances rendering inside loops. Could cause duplicate meta tags and potential rendering issues.

**Fix:** Removed all misplaced `<Seo>` elements. Re-added them as the first child of the main component's root element in all 6 files (Dashboard, Wallet, CompleteProfile, OrganizerPanel, Profile, TeamDetails).

### 13.2 Firestore Loading Hang (Commit `4668a28`)

**Problem:** When Firestore is unreachable (network issue, wrong database ID, security rules), `onAuthStateChanged` and `onSnapshot` never fire. The app hangs on `LoadingFallback` spinner forever — appears as "site can't load."

**Root Cause:** `AuthContext` and `SiteSettingsContext` had no timeout fallback. If Firebase never responds, `loading` stays `true` indefinitely.

**Fix:** Added 8-second timeout to both contexts:
- **AuthContext:** If `onAuthStateChanged` doesn't fire within 8s, set `loading = false` and render as logged-out
- **SiteSettingsContext:** If `onSnapshot` doesn't fire within 8s, set `loading = false` and render with `settings = null` (no maintenance mode, no notice)
- Both use a `settled` flag to prevent race conditions (timeout fires after Firestore responds = no-op)

---

## 14. PONYTAIL REFACTORING NOTES

Deliberate simplifications marked with `ponytail:` comments:

1. **Seo component** — One reusable component covers all public pages. No abstraction beyond what's needed.
2. **Presence management** — Debounced 5s (was every visibilitychange event). Reduces Firestore writes.
3. **Role checks in Firestore rules** — Dual-check (Custom Claims + doc get) during migration. Ceiling: extra `get()` call per request. Upgrade: remove fallback once all users have custom claims.
4. **Sitemap** — Static XML file in production (dynamic generation was broken on Vercel serverless). Ceiling: sitemap doesn't auto-update with new tournaments. Upgrade: scheduled rebuild via cron.
5. **Auth timeout** — 8s hardcoded. Ceiling: if Firebase is just slow (not down), users see logged-out state briefly. Upgrade: exponential backoff retry.

---

## 15. REFERENCES

### 15.1 External Documentation Used

- **Firebase Firestore docs:** Custom database IDs, `onSnapshot` behavior, security rules syntax
- **Firebase Auth docs:** `onAuthStateChanged`, `getIdToken`, Custom Claims
- **Vite docs:** Build configuration, manual chunks, plugin system
- **Vercel docs:** Vite framework deployment, rewrites, headers
- **react-helmet-async:** SSR-compatible head management
- **Tailwind CSS 4:** `@tailwindcss/vite` plugin, shadcn-style CSS variables
- **Cloudinary:** Image upload via server-side proxy
- **Schema.org:** SportsEvent, ItemList, FAQPage, BreadcrumbList, WebSite, Organization types
- **Google Search Central:** robots.txt directives, AI crawler user-agents (GPTBot, Claude-Bot, etc.)
- **IndexNow protocol:** Bing/Yandex instant indexing API

### 15.2 Internal References

- **`firebase-applet-config.json`** — Firebase project configuration
- **`firebase-blueprint.json`** — Firestore data model blueprint (collections, fields, relationships)
- **`firestore.rules`** — Security rules (see §2.4)
- **`firestore.indexes.json`** — Composite index definitions
- **`metadata.json`** — Project metadata

---

## 16. CURRENT STATUS

- **Git:** `main` branch, commit `4668a28`, pushed to origin
- **Build:** 0 TypeScript errors, clean build (~6.64s)
- **Deploy:** Vercel production, HTTP 200 confirmed
- **Domain:** `www.nexplayorg.app` serving latest build
- **JS bundle hash:** `index-A5CuDrmp.js` (latest)

### Remaining Tasks

1. **Sitemap submission:** Verify in Google Search Console and Bing Webmaster Tools
2. **URL architecture audit:** Internal linking structure review
3. **Responsive UI/UX audit:** Tournament and admin page mobile review
4. **TeamDetails schema:** Add `SportsTeam` JSON-LD structured data
5. **Firestore connection:** Verify the custom database ID is accessible from production (the 8s timeout is a safety net, not a fix for a broken connection)

---

*End of report.*
