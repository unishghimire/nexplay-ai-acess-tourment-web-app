# NexPlay Org Panel — Complete Audit Report

**Date:** 2026-08-13  
**Auditor:** Elowen (Superagent)  
**Scope:** All Organizer/Org Panel routes, components, hooks, services, APIs, Firestore operations, and security rules

---

## 1. Complete Org Panel Route Map

| Route | Component | Auth | Role Guard | Status |
|-------|-----------|------|------------|--------|
| `/organizer` | `OrganizerPanel` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer?tab=overview` | `OverviewTab` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer?tab=tournaments` | `TournamentsTab` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer?tab=scrims` | `ScrimsHubTab` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer?tab=rooms` | `MatchRoomsTab` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer?tab=teams` | `TeamsRostersTab` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer?tab=wallet` | `WalletPayoutsTab` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer?tab=settings` | `SettingsStreamTab` | Required | `organizer`, `admin` | ✅ Working |
| `/tournament-admin/:id` | `TournamentAdminPanel` | Required | `organizer`, `admin` | ✅ Working |
| `/organizer/scrim/:id` | `ScrimDetailPage` | Required | `organizer`, `admin` | ✅ Working |

**Route guard:** `ProtectedRoute` checks `useAuth().profile.role` against `allowedRoles`. Redirects unauthorized users to `/dashboard`. 5s timeout for missing profile docs.

**TournamentAdminPanel ownership:** `useTournamentAdmin` hook checks `data.hostUid !== user.uid && profile?.role !== 'admin'` and redirects to `/` if unauthorized. ✅

**ScrimDetailPage ownership:** Does NOT check ownership. Any organizer can view any scrim by direct URL. ⚠️ MEDIUM — read-only, but should redirect unauthorized users.

---

## 2. Feature Inventory

### OrganizerPanel (`/organizer`)
| Tab | Features | Data Source |
|-----|----------|-------------|
| Overview | KPI cards, activity feed, live tournaments table | `useOrgData` → Firestore `tournaments` collection |
| Tournaments | Create, edit, delete, status change, room dispatch, bracket display | `useOrgData` → Firestore `tournaments` |
| Scrims Hub | Scrim cards, slot grid, view details | Derived from `hostedTournaments` (filter `matchType === 'scrims'`) |
| Match Rooms | Live room cards, copy room ID/pass, broadcast, dispute queue | Derived from `hostedTournaments` (filter `status === 'live' && roomId`) |
| Teams & Rosters | Team list, search, roster lock, issue warning, ban | Derived from `participants` state |
| Wallet & Payouts | Balance cards, withdrawal form, transaction history | `useOrgData` → Firestore `transactions` + `/api/wallet/withdraw` |
| Settings & Stream | Org profile form, stream config, staff config | `useOrgData` → Firestore `users/{uid}` |

### TournamentAdminPanel (`/tournament-admin/:id`)
| Tab | Features | Data Source |
|-----|----------|-------------|
| Overview | Tournament details, status controls, stage controls | `useTournamentAdmin` → Firestore `tournaments/{id}` (onSnapshot) |
| Groups & Teams | Auto-generate groups, create/delete groups, assign/remove teams, set room creds | Firestore `tournaments/{id}.groups` + `credentials` subcollection |
| Match Schedule | Add matches, update scores, generate bracket | Firestore `tournaments/{id}.groups[].matches[]` + `bracketMatches[]` |
| Brackets | Bracket display, generate bracket | Firestore `tournaments/{id}.bracketMatches[]` |
| Settings | Tournament settings, Discord announce, distribute prizes | Firestore + Discord service + `/api/wallet/distribute-prizes` |
| Registrations | Participant list, approve/reject, export CSV | Firestore `participants` (onSnapshot by tournamentId) |

### ScrimDetailPage (`/organizer/scrim/:id`)
| Feature | Data Source |
|---------|-------------|
| Scrim details (title, time, fee, prize, map) | Firestore `tournaments/{id}` (onSnapshot) |
| Edit scrim | `updateDoc` on `tournaments/{id}` |
| Slot grid toggle | `updateDoc` on `tournaments/{id}.slots[]` |
| Room broadcast | `updateDoc` on `tournaments/{id}` (roomId, roomPass, ytLink) |
| Status change (open → live → completed) | `updateDoc` on `tournaments/{id}` |

---

## 3. Bug List

### CRITICAL

#### BUG-001: Tournament delete fails for organizers
- **Feature:** Delete tournament (OrganizerPanel → TournamentsTab)
- **Root Cause:** `useOrgData.deleteTournament()` calls `deleteDoc(doc(db, 'tournaments', id))` directly. Firestore rules say `allow delete: if isAdmin()` — organizers get permission denied.
- **Affected Files:** `src/features/organizer/hooks/useOrgData.ts:150-152`
- **Affected DB:** `tournaments` collection
- **Fix:** Either (a) hide delete button for non-admins, or (b) create a server API endpoint that uses Admin SDK to delete tournaments after verifying ownership.

#### BUG-002: Tournament delete doesn't clean up child data
- **Feature:** Delete tournament
- **Root Cause:** `deleteTournament` only deletes the tournament doc. Participants, results, tournamentEarnings, and credentials subcollection remain as orphans.
- **Affected Files:** `src/features/organizer/hooks/useOrgData.ts:150-152`
- **Affected DB:** `participants`, `results`, `tournamentEarnings`, `tournaments/{id}/credentials`
- **Fix:** Add a server-side delete endpoint that atomically deletes the tournament and all child collections via Admin SDK batch write.

#### BUG-003: Five fake buttons in OrganizerPanel (toast-only, no backend)
- **Feature:** Slot toggle, roster lock, issue warning, ban team, resolve dispute
- **Root Cause:** These handlers only call `showToast()` with no Firestore write or API call:
  - `handleToggleSlot` (OrganizerPanel.tsx:143-145) — `showToast('Slot X toggled', 'info')`
  - `handleToggleRosterLock` (OrganizerPanel.tsx:147-149) — `showToast('Roster lock toggled', 'success')`
  - `confirmWarning` (OrganizerPanel.tsx:155-161) — `showToast('Warning issued', 'success')`
  - `handleBanTeam` (OrganizerPanel.tsx:163-165) — `showToast('Ban toggled', 'success')`
  - `handleResolveDispute` (OrganizerPanel.tsx:167-171) — `showToast('Dispute resolved', 'success')`
- **Affected Files:** `src/features/organizer/views/OrganizerPanel.tsx:143-171`
- **Fix:** Connect each to real Firestore writes (see fix plan below).

### HIGH

#### BUG-004: Hardcoded KPIs show wrong data
- **Feature:** Dashboard overview KPIs
- **Root Cause:** In `useOrgData.ts` kpis calculation:
  - `monthlyRevenue: 0` — always 0, no calculation
  - `escrowBalance: 0` — always 0, no calculation
  - `totalTeams` — derived from `participants` state, but `participants` is only populated when `fetchParticipants(tournamentId)` is called (not auto-called). Always 0 on initial load.
- **Affected Files:** `src/features/organizer/hooks/useOrgData.ts:67-88`
- **Fix:** Calculate `monthlyRevenue` from transactions (sum of `entry_fee` type transactions in current month). Calculate `escrowBalance` from active tournament prize pools. Fetch teams via a dedicated query or auto-call `fetchParticipants` for active tournaments.

#### BUG-005: broadcastAnnouncement has no ownership check
- **Feature:** Broadcast announcement to participants
- **Root Cause:** `broadcastAnnouncement(tournamentId, message, title)` queries participants by `tournamentId` and creates notifications. No check that the caller owns the tournament. Any organizer can send notifications to any tournament's participants.
- **Affected Files:** `src/features/organizer/hooks/useOrgData.ts:185-200`
- **Affected DB:** `notifications` collection (writes), `participants` collection (reads)
- **Note:** Firestore rules allow any organizer to create notifications (`isOrganizer()` check only). The write will succeed even for non-owners.
- **Fix:** Add ownership check before querying participants: verify `tournament.hostUid === user.uid`.

#### BUG-006: Disputes always empty
- **Feature:** Match Rooms → Dispute Queue
- **Root Cause:** `OrganizerPanel` passes `disputes={[]}` to `MatchRoomsTab`. No dispute data is ever fetched.
- **Affected Files:** `src/features/organizer/views/OrganizerPanel.tsx:138`
- **Fix:** Fetch real disputes from Firestore `disputes` collection filtered by tournaments owned by this organizer.

#### BUG-007: ScrimDetailPage has no ownership check
- **Feature:** Scrim detail page
- **Root Cause:** `ScrimDetailPage` loads scrim by `id` via `onSnapshot` with no check that `scrim.hostUid === user.uid`. Any organizer can view/edit any scrim by direct URL.
- **Affected Files:** `src/features/organizer/views/ScrimDetailPage.tsx:37-52`
- **Note:** Firestore rules on tournament update DO check `hostUid`, so edits will fail silently for non-owners. But the page still renders and shows data.
- **Fix:** Add ownership check after data load: if `data.hostUid !== user.uid && profile?.role !== 'admin'`, redirect to `/organizer`.

#### BUG-008: SettingsStreamTab doesn't save stream/staff config
- **Feature:** Settings → Stream & Staff Configuration
- **Root Cause:** `handleSave` only calls `onSaveSettings({ orgName, bio, whatsapp, contactInfo, discord })`. The `youtubeUrl`, `twitchUrl`, `refereeName`, `refereeEnabled`, `casterName`, `casterEnabled` fields are NOT included in the save payload.
- **Affected Files:** `src/features/organizer/components/SettingsStreamTab.tsx:80-92`
- **Fix:** Include all fields in the `onSaveSettings` call.

### MEDIUM

#### BUG-009: OrganizerPanel slot toggle is fake (ScrimDetailPage has real one)
- **Feature:** Scrims Hub → Slot Grid overlay
- **Root Cause:** `handleToggleSlot` in `OrganizerPanel.tsx` only shows a toast. The `ScrimDetailPage` has a REAL `handleToggleSlot` that writes to Firestore. The OrganizerPanel overlay's slot toggle is a dead button.
- **Affected Files:** `src/features/organizer/views/OrganizerPanel.tsx:143-145`
- **Fix:** Route the slot toggle through the same Firestore write as ScrimDetailPage, or navigate to ScrimDetailPage for slot management.

#### BUG-010: ScrimsHubTab "Schedule Scrim" button opens slot grid for first scrim
- **Feature:** Scrims Hub → "Schedule Scrim" button
- **Root Cause:** When clicked with existing scrims, it calls `onOpenSlotGrid(scrims[0])` — opens the slot grid for the FIRST scrim rather than creating a new scrim. When no scrims exist, it does nothing (disabled visually but the button is shown).
- **Affected Files:** `src/features/organizer/components/ScrimsHubTab.tsx:69-75`
- **Fix:** This button should open the Tournament Create Modal with scrim preset, not the slot grid.

#### BUG-011: No error recovery / retry on data load failure
- **Feature:** All tabs
- **Root Cause:** `useOrgData.fetchHostedTournaments` catches errors with `console.error` and sets `loading: false`. No error state is exposed. The UI shows empty state (no tournaments) which is indistinguishable from a load failure.
- **Affected Files:** `src/features/organizer/hooks/useOrgData.ts:27-39`
- **Fix:** Add `error` state, expose it, and show a retry button on failure.

#### BUG-012: No duplicate-submit protection on tournament status changes
- **Feature:** TournamentsTab status buttons
- **Root Cause:** `handleUpdateStatus` calls `org.updateTournamentStatus(id, status)` with no loading/disabled state. Rapid double-clicks can trigger duplicate Firestore writes.
- **Affected Files:** `src/features/organizer/views/OrganizerPanel.tsx:91-98`
- **Fix:** Add `isUpdating` state and disable buttons during update.

### LOW

#### BUG-013: Activity feed is derived from tournaments, not real activity
- **Feature:** Overview → Activity Feed
- **Root Cause:** `activityFeed` is derived from `hostedTournaments.slice(0, 10)` — it just lists tournament names and statuses. No real activity events (registrations, results, payments) are shown.
- **Affected Files:** `src/features/organizer/hooks/useOrgData.ts:66-85`
- **Note:** This is a known ponytail: comment ceiling. Acceptable for MVP but misleading as "activity."

#### BUG-014: MatchRoomsTab copy uses setTimeout
- **Feature:** Match Rooms → Copy Room ID/Password
- **Root Cause:** `handleCopy` uses `setTimeout(() => setCopiedKey(null), 2000)` for visual feedback. This is acceptable UX (not a fake operation) but technically a setTimeout.
- **Affected Files:** `src/features/organizer/components/MatchRoomsTab.tsx:25-30`
- **Note:** Not a bug — legitimate UX pattern.

#### BUG-015: SettingsStreamTab save success uses setTimeout
- **Feature:** Settings → Save button
- **Root Cause:** `setSaveSuccess(true)` followed by `setTimeout(() => setSaveSuccess(false), 3000)`. Legitimate UX feedback.
- **Affected Files:** `src/features/organizer/components/SettingsStreamTab.tsx:87-88`
- **Note:** Not a bug — legitimate UX pattern.

---

## 4. API Audit Summary

### Server APIs used by Org Panel

| Endpoint | Method | Auth | Ownership Check | Status |
|----------|--------|------|-----------------|--------|
| `/api/wallet/withdraw` | POST | ✅ Firebase token | ✅ Self (uid from token) | ✅ Working |
| `/api/wallet/deposit` | POST | ✅ Firebase token | ✅ Self | ✅ Working |
| `/api/wallet/transactions` | GET | ✅ Firebase token | ✅ Self | ✅ Working |
| `/api/wallet/join-tournament` | POST | ✅ Firebase token | ✅ Self + atomic | ✅ Working |
| `/api/wallet/leave-tournament` | POST | ✅ Firebase token | ✅ Self + atomic refund | ✅ Working |
| `/api/wallet/distribute-prizes` | POST | ✅ Firebase token | ✅ Tournament host check + atomic | ✅ Working |
| `/api/wallet/redeem-promo` | POST | ✅ Firebase token | ✅ Self + atomic | ✅ Working |
| `/api/tournaments/:id/groups/generate` | POST | ✅ Firebase token | ✅ Host check | ✅ Working |
| `/api/tournaments/:id/results/upload` | POST | ✅ Firebase token | ✅ Host check | ✅ Working |
| `/api/tournaments/:id/advance` | POST | ✅ Firebase token | ✅ Host check | ✅ Working |
| `/api/scrims` | GET | ❌ Public | N/A | ✅ Working (public by design) |
| `/api/upload-image` | POST | ✅ Firebase token | ✅ Self | ✅ Working |
| `/api/media/delete` | POST | ✅ Firebase token | ✅ Self | ✅ Working |
| `/api/discord/announce` | POST | ✅ Firebase token | ❌ No host check | ⚠️ See below |
| `/api/generate-banner` | POST | ✅ Firebase token | ✅ Self | ✅ Working |

### Direct Firestore operations (no API)

| Operation | Collection | Ownership Check | Status |
|-----------|------------|-----------------|--------|
| Fetch tournaments | `tournaments` | ✅ `where('hostUid', '==', user.uid)` | ✅ |
| Delete tournament | `tournaments` | ❌ Client doesn't check; Firestore rules: admin-only | 🔴 BUG-001 |
| Update tournament status | `tournaments` | ❌ Client doesn't check; Firestore rules: ✅ host check | ⚠️ |
| Broadcast lobby | `tournaments` | ❌ Client doesn't check; Firestore rules: ✅ host check | ⚠️ |
| Update participant status | `participants` | ❌ Client doesn't check; Firestore rules: ✅ host check | ⚠️ |
| Fetch participants | `participants` | ❌ No ownership on read; rules: `isSignedIn()` | ⚠️ |
| Fetch transactions | `transactions` | ✅ `where('userId', '==', user.uid)` | ✅ |
| Broadcast announcement | `notifications` | ❌ No check; rules: `isOrganizer()` only | 🔴 BUG-005 |
| Save org settings | `users/{uid}` | ✅ Writes to own doc | ✅ |
| ScrimDetailPage toggle slot | `tournaments/{id}` | ❌ Client doesn't check; Firestore rules: ✅ host check | ⚠️ |
| ScrimDetailPage update scrim | `tournaments/{id}` | ❌ Client doesn't check; Firestore rules: ✅ host check | ⚠️ |
| TournamentAdminPanel groups/matches | `tournaments/{id}` | ✅ Client checks `hostUid` | ✅ |
| TournamentAdminPanel earnings | `tournamentEarnings` | ✅ Client checks ownership | ✅ |

---

## 5. Firestore Security Rules Audit

### Collections with adequate rules ✅
- `tournaments` — create: `isOrganizer() && hostUid == auth.uid`, update: `hostUid == auth.uid`, delete: `isAdmin()` only
- `participants` — create: blocked (server-only), update: `isTournamentHost()` check, delete: admin or self
- `results` — create/update: `isTournamentHost()` check
- `transactions` — client writes blocked, server-only via Admin SDK
- `tournamentEarnings` — read: admin or org owner, write: admin only
- `notifications` — create: `isOrganizer()` (any organizer — see BUG-005)
- `teams` — read: public, write: owner only
- `org_posts` — create: `isOrganizer() && orgId == auth.uid`

### Collections with security gaps ⚠️
- `participants` — `allow read: if isSignedIn()` — any authenticated user can read ALL participants across all tournaments, not just their own. This leaks participant PII (inGameId, username, teammates).
- `notifications` — `allow create: if isOrganizer()` — any organizer can create notifications for any user, not just their tournament participants.

### Collections with no rules ⚠️
- `scrims` collection (if separate from tournaments) — referenced in `/api/scrims` server endpoint (`db.collection("scrims")`). No rules defined for a `scrims` collection. If scrims are stored as tournaments with `matchType='scrims'`, this is fine. But the server queries both `scrims` and `tournaments` collections.

---

## 6. Scoring Engine Audit

The scoring engine is centralized in `src/shared/services/scoringEngine.ts`. ✅

- `calculateTeamScore()` — pure function, takes position + kills + scoring config
- `getPlacementPoints()` — looks up placement points from config
- `validateResult()` — validates position/kills input
- `aggregateStandings()` — aggregates multi-match results with proper tie-breakers
- No duplicate scoring implementations found

Free Fire default scoring (from game config in Firestore `games` collection):
- Kill: 1 point
- Placement: 1st=12, 2nd=9, 3rd=8, 4th=7, 5th=6, 6th=5, 7th=4, 8th=3, 9th=2, 10th=1, 11th+=0

The scoring engine reads from `TournamentScoringSnapshot` which is created at tournament creation time via `createScoringSnapshot()`. ✅ No hardcoding.

---

## 7. Wallet / Financial Audit

### Withdrawal (`/api/wallet/withdraw`)
- ✅ Uses Firestore transaction (atomic balance check + decrement)
- ✅ Duplicate detection (same amount + method within 5 min blocked)
- ✅ Balance validation (cannot withdraw more than balance)
- ✅ Min/max limits enforced (Rs. 100 min, Rs. 50,000 max)
- ✅ Transaction record with balanceBefore/balanceAfter
- ✅ Rate limited (3 per 15 min)

### Prize Distribution (`/api/wallet/distribute-prizes`)
- ✅ Uses Firestore transaction (atomic)
- ✅ Tournament ownership check (`hostUid !== uid && role !== 'admin'` → error)
- ✅ Idempotency: tournament status `completed` blocks re-distribution
- ✅ Prize total vs prize pool validation
- ✅ Revenue split (85% org / 15% platform) calculated atomically
- ✅ Tournament earnings record created with `status: 'pending'`
- ✅ Transaction records created for each winner with balanceBefore/balanceAfter
- ✅ Rate limited (3 per 15 min)

### Join Tournament (`/api/wallet/join-tournament`)
- ✅ Uses Firestore transaction (atomic)
- ✅ Duplicate registration check (deterministic doc ID `{tournamentId}_{uid}`)
- ✅ Balance check (insufficient balance → error)
- ✅ Capacity check (tournament full → error)
- ✅ Status check (tournament must be upcoming/published/live)
- ✅ Entry fee deduction + transaction record
- ✅ XP/level increment

### Leave Tournament (`/api/wallet/leave-tournament`)
- ✅ Uses Firestore transaction (atomic refund)
- ✅ Participant deletion + balance refund + transaction record

### Org Wallet KPI Issues
- `orgWalletBalance` — reads from `profile.orgWalletBalance` which doesn't appear to be a standard field. Most likely always 0. The withdraw form's max amount check will block any withdrawal. 🔴
- `pendingPayouts` — calculated from user's withdrawal-type transactions, not org-specific payouts. ⚠️

---

## 8. Per-Kill Tournament Audit

Per-Kill tournaments are handled through the same `distribute-prizes` endpoint. The winners array includes `userId`, `prize`, `rank`. The server distributes prizes atomically.

**Issue:** No specific Per-Kill configuration or reward calculation was found in the Org Panel. Per-Kill reward calculation appears to happen in the TournamentAdminPanel's result submission flow, which uses the centralized scoring engine.

**Team leader crediting:** The `distribute-prizes` endpoint credits `winner.userId` — it's the organizer's responsibility to specify the team leader's userId in the winners array. No automatic team-leader detection exists. ⚠️

---

## 9. Button-by-Button Audit

### OrganizerPanel buttons
| Button | Handler | Backend | Status |
|--------|---------|---------|--------|
| Tab navigation | `handleTabChange` | URL update | ✅ |
| Create Tournament | `handleCreateTournament` | Opens modal → Firestore create | ✅ |
| Edit Tournament | `handleEditTournament` | Opens modal with data → Firestore update | ✅ |
| Manage Tournament | `handleManageTournament` | Navigates to `/tournament-admin/:id` | ✅ |
| Delete Tournament | `confirmDelete` → `org.deleteTournament` | `deleteDoc` | 🔴 BUG-001 (fails for non-admin) |
| Status Change | `handleUpdateStatus` → `org.updateTournamentStatus` | `updateDoc` | ✅ (Firestore rules enforce ownership) |
| Broadcast Room | `handleBroadcastRoom` → `org.broadcastLobby` | `updateDoc` | ✅ (Firestore rules enforce ownership) |
| Toggle Slot | `handleToggleSlot` | `showToast` only | 🔴 BUG-003 (fake) |
| Toggle Roster Lock | `handleToggleRosterLock` | `showToast` only | 🔴 BUG-003 (fake) |
| Issue Warning | `confirmWarning` | `showToast` only | 🔴 BUG-003 (fake) |
| Ban Team | `handleBanTeam` | `showToast` only | 🔴 BUG-003 (fake) |
| Resolve Dispute | `handleResolveDispute` | `showToast` only | 🔴 BUG-003 (fake) |
| Request Withdrawal | `handleRequestWithdraw` → `org.requestWithdrawal` | `/api/wallet/withdraw` | ✅ |
| Save Settings | `handleSaveSettings` → `org.saveOrgSettings` | `updateDoc(users/{uid})` | ⚠️ BUG-008 (partial save) |
| View Scrim Details | `handleViewScrimDetails` | Navigates to `/organizer/scrim/:id` | ✅ |
| Schedule Scrim | `onOpenSlotGrid(scrims[0])` | Opens slot grid | ⚠️ BUG-010 (wrong behavior) |

### TournamentAdminPanel buttons
| Button | Handler | Backend | Status |
|--------|---------|---------|--------|
| Update Status | `handleUpdateStatus` | `updateDoc` | ✅ |
| Update Stage | `handleUpdateStage` | `updateDoc` | ✅ |
| Auto-Generate Groups | `handleAutoGenerateGroups` | `updateDoc` with engine-generated groups | ✅ |
| Create Group | `handleCreateGroup` | `updateDoc` | ✅ |
| Delete Group | `handleDeleteGroup` | `updateDoc` | ✅ |
| Assign Team | `handleAssignTeam` | `updateDoc` | ✅ |
| Remove Team | `handleRemoveTeam` | `updateDoc` | ✅ |
| Set Group Room | `handleSetGroupRoom` | `batch.write` (tournament + credentials) | ✅ |
| Advance Round | `handleAdvanceRound` | `updateDoc` with engine-generated next round | ✅ |
| Add Match | `handleAddMatch` | `updateDoc` | ✅ |
| Update Score | `handleUpdateScore` | `updateDoc` | ✅ |
| Generate Bracket | `handleGenerateBracket` | `updateDoc` | ✅ |
| Generate Group Matches | `handleGenerateGroupMatches` | `updateDoc` | ✅ |
| Discord Announce | `handleDiscord` | Discord service | ✅ |
| Distribute Prizes | (in Settings tab) | `/api/wallet/distribute-prizes` | ✅ |
| Export Participants CSV | (inline) | Client-side CSV from participant data | ✅ |

### ScrimDetailPage buttons
| Button | Handler | Backend | Status |
|--------|---------|---------|--------|
| Edit Scrim | `handleSaveEdit` | `updateDoc` | ✅ |
| Toggle Slot | `handleToggleSlot` | `updateDoc` (slots array) | ✅ |
| Broadcast Room | `handleBroadcast` | `updateDoc` (roomId, roomPass, ytLink) | ✅ |
| Go Live | `handleStatusChange('live')` | `updateDoc` | ✅ |
| Finalize | `handleStatusChange('completed')` | `updateDoc` | ✅ |
| Reopen | `handleStatusChange('open')` | `updateDoc` | ✅ |
| Copy Room ID/Pass | `copyToClipboard` | Client-side clipboard | ✅ |

---

## 10. Fake/Demo Data Scan

| Pattern | Found | Location | Verdict |
|---------|-------|----------|---------|
| `mock` | No | — | ✅ Clean |
| `dummy` | No | — | ✅ Clean |
| `fake` | No | — | ✅ Clean |
| `placeholder` | No | — | ✅ Clean |
| `demo` | No | — | ✅ Clean |
| `TODO` | No | — | ✅ Clean |
| `FIXME` | No | — | ✅ Clean |
| `coming soon` | No | — | ✅ Clean |
| `setTimeout` | Yes | MatchRoomsTab (copy feedback), SettingsStreamTab (save feedback) | ✅ Legitimate UX |
| `Math.random` | No | — | ✅ Clean |
| `console.log` | No (console.error only) | useOrgData (error logging) | ✅ Legitimate |
| `onClick={() => {}}` | No | — | ✅ Clean |
| Hardcoded values | Yes | `monthlyRevenue: 0`, `escrowBalance: 0` | 🔴 BUG-004 |
| Fake toast-only buttons | Yes | 5 handlers in OrganizerPanel | 🔴 BUG-003 |
| `disputes: []` | Yes | OrganizerPanel passes empty array | 🔴 BUG-006 |

---

## 11. Loading / Error / Empty State Audit

| Component | Loading | Empty | Error | Retry |
|-----------|---------|-------|-------|-------|
| OverviewTab | ✅ (via org.loading) | ✅ Empty tournaments table | ❌ No error state | ❌ |
| TournamentsTab | ✅ | ✅ "No tournaments yet" | ❌ No error state | ❌ |
| ScrimsHubTab | ✅ | ✅ "No scrims scheduled" | ❌ No error state | ❌ |
| MatchRoomsTab | ✅ | ✅ "No active match rooms" | ❌ No error state | ❌ |
| TeamsRostersTab | ✅ | ✅ "No teams registered" | ❌ No error state | ❌ |
| WalletPayoutsTab | ✅ | ✅ "No transactions yet" | ✅ Form errors | ❌ No retry |
| SettingsStreamTab | ✅ | N/A | ✅ Form errors | ❌ |
| TournamentAdminPanel | ✅ | ✅ "Tournament not found" | ✅ Toast errors | ❌ |
| ScrimDetailPage | ✅ | ✅ "Scrim not found" | ✅ Toast errors | ❌ |

**Summary:** Loading and empty states are handled. Error states are partially handled (toasts on write failures) but load failures are silent — the UI shows empty state with no indication of failure. No retry mechanism exists. 🔴 BUG-011

---

## 12. Responsive Audit

All Org Panel components use responsive Tailwind classes:
- Mobile: `flex-col`, `grid-cols-1`, `sm:hidden`/`sm:block` toggles
- Tablet: `sm:grid-cols-2`, `lg:grid-cols-3`
- Desktop: `lg:flex-row`, `lg:grid-cols-4`
- Sidebar: `hidden lg:block` on desktop, mobile drawer toggle
- Tables: `overflow-x-auto` wrappers
- Buttons: `min-h-[44px]` touch targets

**No horizontal overflow issues detected** — all tables have `overflow-x-auto`, all grids collapse to `grid-cols-1` on mobile.

---

## 13. Production Risks

1. **Organizer wallet balance** — `profile.orgWalletBalance` is likely not populated. Withdrawals will fail. Need to verify the field exists in user profiles or compute from earnings.
2. **Orphaned data on tournament delete** — Even if delete is fixed for organizers, child collections aren't cleaned up.
3. **No real-time listener cleanup race** — `useOrgData` doesn't use `onSnapshot` (uses `getDocs`), so no listener leak. `TournamentAdminPanel` properly cleans up listeners. ✅
4. **No concurrent request protection** — Multiple rapid status changes could cause race conditions (last write wins).
5. **Participant PII exposure** — Any authenticated user can read all participants across all tournaments.

---

## 14. Fix Priority

1. 🔴 BUG-003: Connect 5 fake buttons to real Firestore writes
2. 🔴 BUG-001: Fix tournament delete for organizers (server API or hide button)
3. 🔴 BUG-004: Fix hardcoded KPIs (monthlyRevenue, escrowBalance, totalTeams)
4. 🔴 BUG-006: Fetch real disputes or remove dispute UI
5. 🔴 BUG-002: Add child collection cleanup on tournament delete
6. 🔴 BUG-005: Add ownership check to broadcastAnnouncement
7. 🔴 BUG-008: Save all settings fields (stream config, staff)
8. ⚠️ BUG-007: Add ownership check to ScrimDetailPage
9. ⚠️ BUG-010: Fix "Schedule Scrim" button behavior
10. ⚠️ BUG-011: Add error state + retry to data loading
11. ⚠️ BUG-012: Add duplicate-submit protection on status changes
