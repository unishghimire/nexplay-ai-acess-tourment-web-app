# NexPlay Organizer Panel — Complete Feature & API Audit Report

## STEP 1: DEEP FEATURE & API AUDIT

---

## A. ORGANIZER PANEL (`src/features/organizer/`)

### File Inventory (12 files, 4,102 lines total)

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 1 | `views/OrganizerPanel.tsx` | 402 | Main panel shell, tab routing, overlay state, all handlers |
| 2 | `views/ScrimDetailPage.tsx` | 398 | Dedicated scrim detail/edit/manage page |
| 3 | `components/OverviewTab.tsx` | 279 | KPI grid, live tournaments table, activity feed |
| 4 | `components/TournamentsTab.tsx` | 383 | Tournament cards, create/edit/manage/delete, bracket viewer |
| 5 | `components/ScrimsHubTab.tsx` | 267 | Scrim cards, slot grid, recurring schedules |
| 6 | `components/MatchRoomsTab.tsx` | 301 | Live room list, copy room ID/pass, dispute resolution |
| 7 | `components/TeamsRostersTab.tsx` | 500 | Team registry, roster lock, IGID display, ban/warn |
| 8 | `components/WalletPayoutsTab.tsx` | 417 | Balance cards, escrow, withdrawal form, transaction log |
| 9 | `components/SettingsStreamTab.tsx` | 386 | Org profile, Discord/YT/Twitch, referee/caster toggles |
| 10 | `components/OrgOverlayManager.tsx` | 236 | Unified overlay system for all 6 popup types |
| 11 | `hooks/useOrgData.ts` | 183 | Custom hook: all Firestore reads/writes, demo mode fallback |
| 12 | `data/orgMockData.ts` | 350 | Realistic esports mock data (teams, scrims, rooms, disputes, KPIs) |

---

### A1. OrganizerPanel.tsx — Main Shell

**Navigation (7 tabs):**
1. Overview (`LayoutDashboard` icon)
2. Tournaments (`Trophy` icon)
3. Scrims Hub (`Gamepad2` icon)
4. Match Rooms (`Radio` icon)
5. Teams & Rosters (`Users` icon)
6. Wallet & Payouts (`Wallet` icon)
7. Settings & Stream (`Settings` icon)

**State Variables (14):**
- `mobileNavOpen` — mobile sidebar toggle
- `activeOverlay` — which popup is open (OverlayType union)
- `deleteTarget` — tournament selected for deletion
- `warningTeam` — team name for warning modal
- `warningReason` — textarea value for warning
- `roomDispatchTarget` — tournament/room selected for room dispatch
- `scrimSlotTarget` — scrim selected for slot grid popup
- `disputeTarget` — dispute ID for resolver
- `roomId`, `roomPass`, `streamUrl` — room dispatch form fields
- `showCreateModal` — TournamentCreateModal visibility
- `editTournament` — tournament being edited (null = create mode)
- `demoScrims` — local state copy of mock scrims (interactive toggling)
- `demoTeams` — local state copy of mock teams (interactive toggling)

**Handlers (15):**
1. `handleTabChange(tabId)` — URL-based tab switching (`?tab=`)
2. `handleDelete(id, title)` — Opens DELETE_CONFIRM overlay
3. `confirmDelete()` — Executes Firestore `deleteDoc`, closes overlay
4. `handleUpdateStatus(id, status)` — Firestore `updateDoc` on tournament status
5. `handleCreateTournament()` — Opens TournamentCreateModal (create mode)
6. `handleManageTournament(id)` — Navigates to `/tournament-admin/:id`
7. `handleEditTournament(tournament)` — Opens TournamentCreateModal (edit mode)
8. `handleViewScrimDetails(scrimId)` — Navigates to `/organizer/scrim/:id`
9. `handleOpenRoomDispatch(target)` — Opens ROOM_DISPATCH overlay
10. `handleBroadcastRoom()` — Firestore `updateDoc` for room credentials
11. `handleOpenSlotGrid(scrim)` — Opens SCRIM_SLOTS overlay
12. `handleToggleSlot(slotNumber)` — Toggles slot open/filled in demo state
13. `handleToggleRosterLock(teamId)` — Toggles roster lock in demo state
14. `handleIssueWarning(teamName)` — Opens TEAM_WARNING overlay
15. `handleBanTeam(teamId, teamName)` — Bans team in demo state (with toast)
16. `handleResolveDispute(action)` — Resolves dispute (warn/ban/dismiss)
17. `handleRequestWithdraw(amount, method, details)` — Firestore withdrawal request
18. `handleSaveSettings(settings)` — Firestore `updateDoc` on user profile

---

### A2. OverviewTab.tsx

**Features:**
- KPI Grid (4 cards): Active Tournaments, Live Scrims (with pulsing dot), Total Teams, Prize Pool
- Live Tournaments Data Table: Tournament name, game, status badge, teams count, prize pool
- Recent Activity Feed: Icon, text, timestamp, type-based icon rendering
- Demo Mode badge
- Status badge renderer: live (green pulse), upcoming/draft/published (gray), completed (dark)

**Props:**
- `kpis` — { activeTournaments, liveScrims, totalTeams, prizePool, monthlyRevenue, pendingPayouts, orgWalletBalance, escrowBalance, filledSlots, totalSlots }
- `activityFeed` — array of { id, icon, text, time, type }
- `hostedTournaments` — Tournament[] or mock array
- `isDemoMode` — boolean

---

### A3. TournamentsTab.tsx

**Features:**
- Create Tournament button (header + empty state)
- Tournament cards with: title, status badge, game, format, team count, prize pool
- Per-card action buttons:
  - **Manage** → navigates to `/tournament-admin/:id`
  - **Edit** → opens TournamentCreateModal in edit mode
  - **Room Details** → opens ROOM_DISPATCH overlay
  - **Go Live** / **Finalize** — status toggle (Firestore `updateDoc`)
  - **Delete** — opens DELETE_CONFIRM overlay
  - **View Bracket** / **Hide Bracket** — expandable inline bracket display
- Inline bracket renderer: rounds (Finals, Semi-Finals, Round N), team names, scores, winner highlighting

**Props:**
- `hostedTournaments`, `isDemoMode`, `onDelete`, `onUpdateStatus`, `onCreateTournament`, `onOpenRoomDispatch`, `onManageTournament?`, `onEditTournament?`

---

### A4. ScrimsHubTab.tsx

**Features:**
- Create Scrim button
- Scrim cards with: title, status badge, game, format, entry fee, prize pool, start time
- Recurring pattern indicator (RefreshCw icon)
- Per-scrim action buttons:
  - **View Details** → navigates to `/organizer/scrim/:id`
  - **View Slot Grid** → opens SCRIM_SLOTS overlay
- Slot progress bar per scrim (filled/total with visual fill)
- Quick slot grid preview (first 8 slots inline)
- Clickable slot buttons to toggle open/filled

**Props:**
- `scrims`, `isDemoMode`, `onOpenSlotGrid`, `onToggleSlot`, `onViewDetails?`

---

### A5. MatchRoomsTab.tsx

**Features:**
- Live Match Rooms section:
  - Room cards: tournament name, map, status badge (live/pending/completed)
  - Room ID & Password display with copy-to-clipboard buttons
  - Stream URL link button (external)
  - Dispatch button → opens ROOM_DISPATCH overlay
- Disputes section:
  - Dispute cards: reported by, tournament name, match room, reason, filed time
  - Dispute status badges (pending/reviewing/resolved)
  - Review Dispute button → opens DISPUTE_RESOLVER overlay

**Props:**
- `matchRooms`, `disputes`, `isDemoMode`, `onOpenRoomDispatch`, `onResolveDispute`

---

### A6. TeamsRostersTab.tsx

**Features:**
- Search bar (filter by team name)
- Team cards with: name, IGID, roster expand/collapse, roster lock toggle, strike count, ban status
- Expanded roster view: player name, IGID, role (leader/member)
- Per-team action buttons:
  - **Expand/Collapse** roster
  - **Lock/Unlock Roster** toggle
  - **Issue Warning** → opens TEAM_WARNING overlay
  - **Ban Team** (with confirmation toast)
- Banned teams section (separate filtered view)
- Stats summary: total teams, locked rosters, banned teams

**Props:**
- `teams`, `isDemoMode`, `onToggleRosterLock`, `onIssueWarning`, `onBanTeam`

---

### A7. WalletPayoutsTab.tsx

**Features:**
- Balance cards: Org Wallet Balance, Escrow Balance, Pending Payouts
- Monthly Revenue summary
- Withdrawal request form:
  - Amount input
  - Method selector (Bank Transfer, eSewa, Khalti)
  - Account details textarea
  - Submit button → calls `onRequestWithdraw`
  - Error/success message display
- Transaction log table: type, amount, method, refId, status, timestamp
- Transaction status badges (pending/completed/rejected)

**Props:**
- `kpis` — { orgWalletBalance, escrowBalance, pendingPayouts }
- `transactions`, `isDemoMode`, `onRequestWithdraw`

---

### A8. SettingsStreamTab.tsx

**Features:**
- Organization Profile section:
  - Org Name input
  - Bio textarea
  - WhatsApp number input
  - Contact info input
  - Discord link input
- Stream & Broadcast section:
  - YouTube URL input (for live stream embed)
  - Twitch URL input
- Referee Management:
  - Referee name input
  - Enable/disable toggle switch
- Caster Management:
  - Caster name input
  - Enable/disable toggle switch
- Save button → calls `onSaveSettings` (Firestore `updateDoc` on users doc)
- Save success indicator

**Props:**
- `profile`, `isDemoMode`, `onSaveSettings`

---

### A9. OrgOverlayManager.tsx — Unified Overlay System

**Overlay Types (6):**
1. `DELETE_CONFIRM` — Delete tournament confirmation with red icon, cancel/delete buttons
2. `TEAM_WARNING` — Issue disciplinary warning with textarea for violation description
3. `ROOM_DISPATCH` — Broadcast room credentials (Room ID, Password, Stream Link) to all players
4. `DISPUTE_RESOLVER` — Match dispute resolution with evidence preview, 3 actions (Warn, Ban, Dismiss)
5. `SCRIM_SLOTS` — Slot grid modal for scrim (click slots to toggle open/filled)
6. `CREATE_TOURNAMENT` — Type exists but handled by separate TournamentCreateModal

**Props:**
- `activeOverlay`, `onClose`, `deleteTarget`, `onConfirmDelete`, `teamName`, `warningReason`, `setWarningReason`, `onIssueWarning`, `roomId`, `setRoomId`, `roomPass`, `setRoomPass`, `streamUrl`, `setStreamUrl`, `onBroadcastRoom`, `disputeId`, `onResolveDispute`, `scrimTitle`, `slotGrid`, `onToggleSlot`

---

### A10. ScrimDetailPage.tsx (`/organizer/scrim/:id`)

**Features:**
- Scrim header with back button, title, game/format, demo mode badge
- Edit mode toggle: inline editing of title, start time, map, entry fee, prize pool, slots
- Status bar with toggle buttons: Open → Go Live → Finalize → Reopen
- Scrim Details panel: start time, map, entry fee, prize pool, slots filled, format
- Room Dispatch panel: Room ID (with copy), Room Password (with copy), Stream Link, Broadcast button
- Slot Management grid: visual progress bar, click-to-toggle slot reservations
- Lock/Unlock icons per slot

**Firestore Operations:**
- `onSnapshot(doc(db, 'tournaments', id))` — real-time scrim listener
- `updateDoc(doc(db, 'tournaments', id), { title, startTime, ... })` — edit scrim
- `updateDoc(doc(db, 'tournaments', id), { slots, filledSlots, currentPlayers })` — toggle slot
- `updateDoc(doc(db, 'tournaments', id), { roomId, roomPass, ytLink })` — broadcast
- `updateDoc(doc(db, 'tournaments', id), { status })` — status change

---

### A11. useOrgData.ts — Custom Hook

**Exported:**
- `useOrgData()` — returns { data, demoData, actions }

**Data (5 state variables):**
- `hostedTournaments` — Tournament[] from Firestore
- `participants` — Participant[] from Firestore
- `transactions` — Transaction[] from Firestore
- `loading` — boolean
- `isDemoMode` — boolean (auto-detected when Firestore returns empty)

**Firestore Reads (3):**
1. `getDocs(query(collection(db, 'tournaments'), where('hostUid', '==', user.uid)))` — fetch hosted tournaments
2. `getDocs(query(collection(db, 'participants'), where('tournamentId', '==', tournamentId)))` — fetch participants
3. `getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid)))` — fetch transactions

**Firestore Writes (10):**
1. `deleteDoc(doc(db, 'tournaments', id))` — delete tournament
2. `updateDoc(doc(db, 'tournaments', id), { status })` — update status
3. `updateDoc(doc(db, 'tournaments', id), { roomId, roomPass, ytLink })` — broadcast lobby
4. `updateDoc(doc(db, 'participants', id), { status })` — approve/reject participant
5. `updateDoc(doc(db, 'tournaments', tournamentId), { currentPlayers: increment(±1) })` — update player count
6. `addDoc(collection(db, 'transactions'), txData)` — create withdrawal request
7. `updateDoc(doc(db, 'users', uid), { orgWalletBalance: increment(-amount) })` — deduct wallet
8. `writeBatch(db)` + batch notifications to all participants — broadcast announcement
9. `updateDoc(doc(db, 'users', uid), settings)` — save org settings

**Demo Data Exposed:**
- `demoTeams`, `demoScrims`, `demoMatchRooms`, `demoDisputes`, `demoKPIs`, `demoActivity`, `demoTransactions`

---

### A12. orgMockData.ts — Mock Data

**Interfaces:**
- `MockTeam` — { id, name, igid, players[], rosterLocked, banned, banReason, strikes, registeredAt }
- `MockScrimSlot` — { slotNumber, teamId, teamName, status }
- `MockScrim` — { id, title, game, format, slots[], totalSlots, filledSlots, startTime, status, entryFee, prizePool, recurring, recurrencePattern }
- `MockMatchRoom` — { id, tournamentId, tournamentName, roomId, roomPass, map, status, streamUrl, createdAt }
- `MockDispute` — { id, tournamentName, matchRoom, reportedBy, reason, screenshotUrl, status, filedAt }
- `MockTransaction` — { id, type, amount, method, refId, status, desc, timestamp }

**Data Arrays:**
- `mockTeams` — 4 teams (Crimson, Viper, Phoenix, Bolt) with full rosters
- `mockScrims` — 4 scrims with slot grids
- `mockMatchRooms` — 3 match rooms (live, pending, completed)
- `mockDisputes` — 2 disputes (pending, reviewing)
- `mockTransactions` — 5 transactions (entry_fee, prize, withdraw, deposit, sponsor)
- `mockKPIs` — full KPI object with all 10 fields
- `mockActivityFeed` — 6 activity items with icons

---

## B. ADMIN PANEL (`src/features/admin/`)

### B1. AdminPanel.tsx — Platform Super-Admin

**16 Tabs:**
1. Dashboard — platform metrics, activity logs, quick actions
2. Tournaments — all tournaments, feature toggle, edit, cancel
3. Org Approvals — pending organizer applications, approve/reject
4. Org Tournaments — filter by organizer, feature toggle, details
5. Users — search, balance adjustments, role changes, ban/unban
6. Organizers — directory, edit contact, power organizer toggle, suspend
7. Org Earnings — revenue split (85%), release payouts
8. Pending Deposits — deposit review queue with proof images
9. Pending Withdrawals — withdrawal review queue with account details
10. Subscriptions — plan management (create/edit/delete)
11. Games — game catalog CRUD with logo upload
12. Payments — payment categories + methods with QR upload
13. Promo Codes — promo CRUD with usage tracking
14. Media Library — Cloudinary asset gallery with delete
15. Settings — maintenance mode, notices, org form toggle, min withdrawal
16. Transaction History — full ledger with multi-filter

**State Variables (35+):**
- Navigation: `activeTab`, `isSidebarOpen`
- Data: `pendingTransactions`, `allTransactions`, `allTournaments`, `orgApplications`, `organizers`, `orgTournaments`, `promoCodes`, `slides`, `subscriptionPlans`, `users`, `games`, `paymentCategories`, `paymentMethods`, `siteSettings`, `activityLogs`, `tournamentEarnings`, `mediaItems`
- Form modals: `isGameModalOpen`, `editingGame`, `gameName`, `gameLogo`, `gameModes`, `isPublished`, `uploading`, `isCategoryModalOpen`, `editingCategory`, `categoryName`, `categoryDescription`, `categoryActive`, `isPaymentModalOpen`, `editingPayment`, `paymentCategoryId`, `paymentName`, `paymentQr`, `paymentInstructions`, `paymentType`, `paymentActive`, `isPromoModalOpen`, `editingPromo`, `promoCode`, `promoAmount`, `promoMaxUses`, `promoActive`, `isSlideModalOpen`, `editingSlide`, `slideTitle`, `slideDescription`, `slideImage`, `slideLink`, `slideBtnText`, `slideIsActive`, `isPlanModalOpen`, `editingPlan`, `planName`, `planPrice`, `planMaxTournaments`, `planDesc`, `planFeatures`, `planIsActive`, `isOrgEditModalOpen`, `editingOrg`, `orgEmail`, `orgDiscord`, `orgYoutube`, `orgWhatsapp`, `orgNameEdit`
- Selection: `selectedTx`, `rejectionReason`, `selectedUser`, `adjustmentAmount`, `adjustmentType`, `selectedOrgId`, `selectedTournament`, `searchQuery`, `stats`, `loading`, `confirmModal`, `userAuditLogs`, `isUserAuditDrawerOpen`, `isNotifyUserModalOpen`, `notifyUserMessage`, `notifyUserTitle`, `mediaLoading`, `mediaFilter`, `mediaSearch`, `selectedMediaCategory`, `txFilterStatus`, `txFilterType`, `txFilterTournament`, `txSearchUser`

**Firestore Collections: 15** — transactions, tournaments, orgApplications, users, promocodes, slides, subscriptionPlans, games, paymentCategories, paymentMethods, settings, media, activityLogs, participants, tournamentEarnings

**API Calls:**
- `fetch('/api/discord/announce', ...)` — Discord webhook announcements
- `firebase.auth.currentUser.getIdToken()` — auth token

---

### B2. TournamentAdminPanel.tsx (`/tournament-admin/:id`)

**6 Tabs:**
1. Overview — financial summary, status/stage controls, quick actions
2. Groups — group grid, auto-generate, create/delete, assign teams, generate matches
3. Matches — match schedule grid, add match, score editor, result uploader
4. Brackets — knockout bracket tree, generate bracket, update scores
5. Participants — registration roster, approve/reject, CSV export
6. Settings — point system editor (placement points, kill points, bonuses)

**Handlers:**
- `handleUpdateStatus`, `handleUpdateStage`, `handleAutoGenerateGroups`, `handleAdvanceRound`, `handleCreateGroup`, `handleDeleteGroup`, `handleAssignTeam`, `handleRemoveTeam`, `handleDiscord`, `handleAddMatch`, `handleUpdateScore`, `handleGenerateBracket`, `handleGenerateGroupMatches`, `getTeamName`, CSV export

**Discord Integration:**
- `announceNewTournament`, `announceTournamentLive`, `announceTournamentCompleted`, `announceGroupDraw`, `announceGameStart`, `announceGameTime`, `announceNewScrim`, `announceScrimLive`, `announceScrimCompleted`

---

## C. SHARED INFRASTRUCTURE

### Services (3)
1. **DiscordService.ts** — 9 exported announce functions, POST to `/api/discord/announce`
2. **NotificationService.ts** — 6 methods: create, markAsRead, markAllAsRead, onUnreadCount, onNotifications, notifyParticipants
3. **mediaService.ts** — 6 functions: validateImage, uploadImage, deleteImage, replaceImage, getImageUrl, generateOptimizedUrl

### Contexts (3)
1. **AuthContext.tsx** — useAuth(), user/profile/loading state, Firestore onSnapshot listener
2. **NotificationContext.tsx** — useNotification(), showToast(), real-time participant status tracking
3. **SiteSettingsContext.tsx** — useSiteSettings(), onSnapshot to settings/site

### Utils (10 functions)
- `formatCurrency`, `toDateSafe`, `formatDate`, `timeAgo`, `getYoutubeId`, `calculateLevel`, `getXPForNextLevel`, `getLevelProgress`, `formatGameModeLabel`, `formatGameName`

### Shared Components (12)
- `Modal.tsx`, `ConfirmModal.tsx`, `DashboardLayout.tsx`, `ProtectedRoute.tsx`, `ImageUploader.tsx`, `Navbar.tsx`, `ProfileDropdown.tsx`, `WalletDisplay.tsx`, `Footer.tsx`, `Toast.tsx`, `Breadcrumbs.tsx`, `BackButton.tsx`, `ScrollToTop.tsx`, `ErrorBoundary.tsx`

### Routes (28 total)
- Public: `/`, `/tournaments`, `/scrims`, `/games`, `/games/:id`, `/results`, `/details/:id`, `/post/:id`, `/user/:id`, `/profile/:id`, `/organization/:id`, `/organizations`, `/teams`, `/team/:id`, `/leaderboard`, `/login`, `/register`, `/about`, `/contact`, `/privacy`, `/terms`, `*`
- Protected: `/dashboard`, `/profile`, `/wallet`, `/complete-profile`
- Admin: `/admin` (admin only)
- Organizer: `/organizer`, `/tournament-admin/:id`, `/organizer/scrim/:id` (organizer + admin)

### Custom Hooks (3)
- `useClickOutside` — click outside ref detection
- `useInView` — Intersection Observer for lazy animations
- `useInvisibleImage` — image compression before upload

---

## D. DEAD CODE / DUPLICATES IDENTIFIED

1. **`tournament-admin-tabs.tsx`** (monolith) — superseded by `tournament-admin-tabs/` directory (6 split files). The old monolith may still be imported in some paths. **Verify before deleting.**
2. **Duplicate modal patterns** — Several inline modal dialogs in `admin-panel-tabs.tsx` could be consolidated through the shared `Modal` component, but they are active feature logic.
3. **No truly dead files found** — All components are actively imported and rendered.

---

## E. FEATURE MAPPING — WHERE EVERYTHING GOES IN THE NEW LAYOUT

### Tab 1: Overview
| Old Feature | New Location | Access |
|---|---|---|
| KPI Grid (4 cards) | Top row, full width | Direct |
| Live Tournaments Table | Left column (2/3 width) | Direct |
| Recent Activity Feed | Right column (1/3 width) | Direct |
| Demo Mode Badge | Header | Direct |

### Tab 2: Tournaments
| Old Feature | New Location | Access |
|---|---|---|
| Create Tournament button | Header | 1 click |
| Tournament cards (stats, status) | Full list | Direct |
| Manage button → /tournament-admin/:id | Per card | 1 click |
| Edit button → TournamentCreateModal | Per card | 1 click |
| Room Details → ROOM_DISPATCH overlay | Per card | 1 click |
| Go Live / Finalize status toggle | Per card | 1 click |
| Delete → DELETE_CONFIRM overlay | Per card | 1 click |
| View Bracket (expand/collapse) | Per card | 1 click |
| Inline bracket renderer | Per card (expanded) | Direct |

### Tab 3: Scrims Hub
| Old Feature | New Location | Access |
|---|---|---|
| Create Scrim button | Header | 1 click |
| Scrim cards (stats, status) | Full list | Direct |
| View Details → /organizer/scrim/:id | Per card | 1 click |
| View Slot Grid → SCRIM_SLOTS overlay | Per card | 1 click |
| Slot progress bar | Per card | Direct |
| Inline slot preview (first 8) | Per card | Direct |
| Clickable slot toggle | Per card | 1 click |
| Recurring pattern indicator | Per card | Direct |

### Tab 4: Match Rooms
| Old Feature | New Location | Access |
|---|---|---|
| Live Match Rooms list | Top section | Direct |
| Room ID & Password display | Per room card | Direct |
| Copy to clipboard buttons | Per room card | 1 click |
| Stream URL link | Per room card | 1 click |
| Dispatch button → ROOM_DISPATCH overlay | Per room card | 1 click |
| Disputes list | Bottom section | Direct |
| Review Dispute → DISPUTE_RESOLVER overlay | Per dispute card | 1 click |

### Tab 5: Teams & Rosters
| Old Feature | New Location | Access |
|---|---|---|
| Search bar | Top, full width | Direct |
| Team cards with IGIDs | Full list | Direct |
| Expand/collapse roster | Per card | 1 click |
| Lock/Unlock Roster toggle | Per card | 1 click |
| Issue Warning → TEAM_WARNING overlay | Per card | 1 click |
| Ban Team | Per card | 1 click |
| Banned teams section | Bottom section | Direct |
| Stats summary | Top row | Direct |

### Tab 6: Wallet & Payouts
| Old Feature | New Location | Access |
|---|---|---|
| Balance cards (3) | Top row | Direct |
| Monthly Revenue | Top row | Direct |
| Withdrawal form | Left column | Direct |
| Transaction log table | Right column | Direct |

### Tab 7: Settings & Stream
| Old Feature | New Location | Access |
|---|---|---|
| Org Profile form (name, bio, WhatsApp, contact, Discord) | Top section | Direct |
| YouTube/Twitch stream URLs | Middle section | Direct |
| Referee enable/disable + name | Bottom-left | Direct |
| Caster enable/disable + name | Bottom-right | Direct |
| Save button | Bottom, full width | 1 click |

### Overlay Manager (6 popup types)
| Overlay | Trigger | Content |
|---|---|---|
| DELETE_CONFIRM | Delete button on tournament card | Red warning, Cancel/Delete |
| TEAM_WARNING | Issue Warning on team card | Textarea for violation, Cancel/Issue |
| ROOM_DISPATCH | Room Details / Dispatch button | Room ID, Password, Stream Link, Broadcast |
| DISPUTE_RESOLVER | Review Dispute button | Evidence preview, Warn/Ban/Dismiss |
| SCRIM_SLOTS | View Slot Grid on scrim card | Slot grid, click to toggle |
| TournamentCreateModal | Create/Edit Tournament button | 5-step wizard (basic info, format, economy, rules, review) |

### ScrimDetailPage (`/organizer/scrim/:id`)
| Feature | Location |
|---|---|
| Scrim header + back button | Top |
| Edit mode toggle | Top-right |
| Status controls (Open/Live/Completed/Reopen) | Below header |
| Scrim details panel (6 fields) | Left column |
| Room dispatch panel (3 inputs + broadcast) | Left column |
| Slot management grid (progress bar + toggle) | Right column |

### TournamentAdminPanel (`/tournament-admin/:id`)
| Tab | Features |
|---|---|
| Overview | Financial summary, status/stage controls, generate matches, advance round |
| Groups | Auto-generate, create/delete groups, assign/remove teams, generate matches |
| Matches | Add match, score editor, result uploader (OCR) |
| Brackets | Generate bracket, update scores, winner progression |
| Participants | Approve/reject, CSV export |
| Settings | Point system editor (placement, kills, bonuses) |

---

## SUMMARY COUNTS

- **Organizer Panel tabs**: 7
- **Admin Panel tabs**: 16
- **Tournament Admin tabs**: 6
- **Total overlay/popup types**: 6 (unified in OrgOverlayManager)
- **Total modal components across codebase**: 10 (dedicated files)
- **Firestore collections**: 15
- **External API calls**: 3 (`/api/discord/announce`, `/api/upload/image`, `/api/generate-banner`)
- **Custom hooks**: 4 (useOrgData, useClickOutside, useInView, useInvisibleImage)
- **Services**: 3 (DiscordService, NotificationService, mediaService)
- **Contexts**: 3 (Auth, Notification, SiteSettings)
- **Utils**: 10 functions
- **Routes**: 28
- **Dead code**: Minimal — old `tournament-admin-tabs.tsx` monolith potentially superseded by split directory
