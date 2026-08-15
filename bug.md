# NexPlay Codebase Audit — bug.md

Comprehensive audit of `nexplay-ai-acess-tourment-web-app` (React 19 + Vite + Express 4 + Firestore).
Every entry below was **verified** against the actual source (client write paths, `firestore.rules`, server routes). Findings are ordered by severity. Fixes are applied one-by-one in Phase 3, each validated locally before the next.

Categories: `Dead Code`, `Broken API`, `UI-UX`, `Cache-Performance`, `Security`.

---

## [BUG-001] Scrim create/edit is blocked by Firestore rules (status `open` not allowed)
- **Severity**: Critical
- **Category**: Broken API
- **Affected File(s)**: `src/features/scrims/components/ScrimCreateModal.tsx:210`, `src/features/organizer/hooks/useOrgData.ts:332`, `firestore.rules:73-80`
- **Description**: Scrims are stored in the `tournaments` collection with `status: 'open'` (new-scrim payload, `ScrimCreateModal.tsx:210`; `toggleScrimSlot` updates the same docs). `isValidTournament()` only allows `['draft','published','upcoming','live','paused','completed','cancelled']`. The `tournaments` create rule (173-176) and update rule (182-190) both require `isValidTournament(incoming())`, so every non-admin organizer gets `permission-denied` on scrim create/edit/slot-toggle. The `scrims`-collection mirror and credentials `setDoc` never run because they are chained after the failed write.
- **Root Cause**: `isValidTournament()` status enum omits `'open'`, which is the status every new scrim uses (`ScrimCreateModal.tsx:210`), and the platform's own `/api/scrims` route confirms scrims live with status `open` (`server/routes/tournaments.ts:273`).
- **Proposed Safe Fix**:
  1. Add `'open'` (and any other scrim lifecycle states the app writes) to the status enum in `isValidTournament()`.
  2. Confirm `scrim` payloads satisfy the remaining `isValidTournament` checks (title/game/prizePool/hostUid/no roomId-roomPass on doc) — they do; credentials live in the `credentials` subcollection.
   3. Validate by running the scrim-create path against the emulator rules or a rule test that exercises `status:'open'` create + update + slot toggle.
- **Status**: ✅ Fixed — added `'open'` to `isValidTournament()` status enum (`firestore.rules:77`).

---

## [BUG-002] Result upload writes participant stats that the rules deny (partial failure)
- **Severity**: High
- **Category**: Broken API
- **Affected File(s)**: `src/features/results/components/ResultUploader.tsx:250-268`, `firestore.rules:233-237`
- **Description**: After scoring, `ResultUploader` runs `writeBatch.update(participants/{id}, { totalKills, totalPoints, matchesPlayed })`. The `participants` update rule only permits organizer writes with affectedKeys `['status','checkedIn','checkedInAt']` (and self check-in keys). The batch is **denied**. Because the tournament `groups` `updateDoc` (246-248) already committed, the match is saved but participant stats silently fail — the toast still says "points calculated!" and the error is only visible in the browser console.
- **Root Cause**: The `participants` update affectedKeys whitelist was narrowed to status/check-in only, but the app's result-upload flow legitimately updates per-participant stats.
- **Proposed Safe Fix**:
  1. Extend the organizer branch of the `participants` update rule with affectedKeys `totalKills`, `totalPoints`, `matchesPlayed` (host of the tournament only).
  2. Optionally wrap the stats batch in its own try/catch so a stats failure never blocks the result save.
   3. Validate with the existing test suite + a rule-level test for host-authorized stats updates.
- **Status**: ✅ Fixed — organizer host update whitelist now includes `totalKills`, `totalPoints`, `matchesPlayed` (`firestore.rules:237-245`).

---

## [BUG-003] Organizer moderation writes (roster lock / strikes / ban) are denied
- **Severity**: High
- **Category**: Broken API
- **Affected File(s)**: `src/features/organizer/hooks/useOrgData.ts:353,362,377,391`, `firestore.rules:233-237`
- **Description**: `toggleRosterLock` (`rosterLocked`), `issueWarning` (`strikes`/`lastWarning`/`lastWarningAt`) and `toggleBanTeam` (`banned`) update `participants` docs with keys outside the allowed set `['status','checkedIn','checkedInAt']`. Every one of these organizer actions throws `permission-denied` for organizer hosts.
- **Root Cause**: Same narrowed `participants` update whitelist as BUG-002; moderation keys were not included.
- **Proposed Safe Fix**: Extend the host-owner branch of the `participants` update rule to also allow `rosterLocked`, `strikes`, `lastWarning`, `lastWarningAt`, `banned` (same change as BUG-002, one rule edit). Validate via rules test.
- **Status**: ✅ Fixed — same rule edit as BUG-002 adds `rosterLocked`, `strikes`, `lastWarning`, `lastWarningAt`, `banned` (`firestore.rules:237-245`).

---

## [BUG-004] Team deletion batch is denied for player-role team owners
- **Severity**: High
- **Category**: Broken API
- **Affected File(s)**: `src/features/teams/views/TeamDetails.tsx:293-335`, `firestore.rules:280-284, 329-333, 336-340`
- **Description**: `executeDeleteTeam` builds a single batch: delete `team_members`, clear `users`/`users_public` for each member, **create notifications for each member**, delete `team_invites`, delete `team_activity`, then `deleteDoc(teams/{id})`. For a player-role owner: (a) notification creates with `userId != self` are denied (`firestore.rules:280-284`), (b) `team_invites` deletes are denied unless the owner is invitee/inviter/admin (`329-333`), (c) `team_activity` deletes require `isOwner(incoming().userId)` which is false on delete (`336-340`). One denied op fails the whole batch — the "Delete Team" feature is broken for regular owners.
- **Root Cause**: Rule `delete` paths and the notification-create rule were written for admin/organizer flows only; team-owner lifecycle writes were not covered.
- **Proposed Safe Fix**:
  1. `team_activity`: allow write if `isAdmin() || isOwner(incoming().userId) || isTeamOwner(existing().teamId)`.
  2. `team_invites`: add `isTeamOwner(existing().teamId)` to the delete (and update) permission.
  3. Notifications for members on disband: decide per BUG-005/006 notification policy (shared rule change).
   4. Validate the batch against the emulator.
- **Status**: ✅ Fixed — `team_activity` delete allows `isTeamOwner(existing().teamId)`, `team_invites` delete/update allow team owner; notification creates relaxed to verified users (BUG-005/006 policy) so the disband batch succeeds for player-role owners.

---

## [BUG-005] Team invite reports failure although the invite is created
- **Severity**: High
- **Category**: Broken API
- **Affected File(s)**: `src/features/teams/views/TeamDetails.tsx:221-244`, `firestore.rules:280-284`
- **Description**: The invite `addDoc` to `team_invites` succeeds, then the "Team Invitation" notification for the invitee (`userId = invitee ≠ self`) is **denied** for player-role owners. The outer catch then shows "Failed to send invite" even though the invite exists — confusing UX and a broken notification flow.
- **Root Cause**: The `notifications` create rule was tightened (Turn 27 security fix) to admin/organizer/self only, but the team-invite feature notifies a *different* user.
- **Proposed Safe Fix**: See the notification policy decision documented with BUG-006. Options: (a) allow verified users to create notifications (aligns with existing `follows`/`team_members` posture), or (b) keep the rule strict and make the notification best-effort (catch separately) so the invite never shows a false failure. Pick per policy, validate invite + notification behavior.
- **Status**: ✅ Fixed — policy decision: relax `notifications` create to `isVerified()` (option a). Invite notification now succeeds for verified players (`firestore.rules:285-289`).

---

## [BUG-006] Follow action shows failure although the follow is created
- **Severity**: High
- **Category**: Broken API
- **Affected File(s)**: `src/features/profile/views/PublicProfile.tsx:105-142`, `firestore.rules:280-284`
- **Description**: The follow `addDoc` succeeds, then the "New Follower" notification for the followed user (`userId = id ≠ self`) is denied for player-role followers. The catch at 136-138 shows "Failed to update follow status" even though the follow was created and the counter already incremented.
- **Root Cause**: Same as BUG-005 — notification create rule is admin/organizer/self only.
- **Proposed Safe Fix**: Shared notification-policy decision with BUG-005 (and BUG-004 member notifications). Fix once in the rules (or client best-effort), then re-validate follow + team invite flows.
- **Status**: ✅ Fixed — `notifications` create relaxed to `isVerified()` (same change as BUG-005). "New Follower" notification now succeeds for verified players (`firestore.rules:285-289`).

---

## [BUG-007] Organizer "Settings & Stream" save is denied
- **Severity**: High
- **Category**: Broken API
- **Affected File(s)**: `src/features/organizer/hooks/useOrgData.ts:313-316`, `src/features/organizer/components/SettingsStreamTab.tsx:76-88`, `firestore.rules:123-143`
- **Description**: `saveOrgSettings` writes `youtubeUrl`, `twitchUrl`, `refereeName`, `refereeEnabled`, `casterName`, `casterEnabled` (plus org fields) to `users/{uid}`. The users owner-update whitelist has `youtube` but not `youtubeUrl`/`twitchUrl`, and has none of the referee/caster keys. `affectedKeys().hasOnly(...)` is evaluated across the whole update, so the entire save is rejected.
- **Root Cause**: The users update whitelist was not kept in sync with the Settings & Stream tab's payload keys.
- **Proposed Safe Fix**: Add `youtubeUrl`, `twitchUrl`, `refereeName`, `refereeEnabled`, `casterName`, `casterEnabled` to the users owner-update affectedKeys whitelist (and ensure `orgName`/`bio`/`whatsapp`/`contactInfo`/`discord` are already present — they are). Validate with a rules test for a mixed-field settings update.
- **Status**: ✅ Fixed — added the six keys to the users owner-update whitelist (`firestore.rules:123-143`).

---

## [BUG-008] Discord announce endpoint can hang or crash without a response
- **Severity**: High
- **Category**: Broken API
- **Affected File(s)**: `server/routes/discord.ts:50,116-161`
- **Description**: The async `POST /api/discord/announce` handler has **no try/catch**. Express 4 does not forward rejected promises to error middleware. Two failure modes: (a) `buildDiscordEmbed` line 50 does `(data.groups as string[]).map(...)` — if an organizer posts `group_published` without `data.groups`, it throws `TypeError`, leaving the request hanging with no response and an unhandled rejection; (b) any Firestore error (line 136 `tournament.get()`) likewise hangs the request. The centralized error handlers in `api/index.ts`/`server.ts` never see it.
- **Root Cause**: Missing error handling on an async route plus no payload validation for `data.groups` (and other embed fields).
- **Proposed Safe Fix**:
  1. Validate `data.groups` is a non-empty array (and other embed-critical fields) before building the embed.
  2. Wrap the handler body in try/catch and return `500` on failure.
  3. Optionally add a global error middleware in `server.ts` for parity with `api/index.ts`.
   4. Validate with a local smoke test hitting the endpoint with a missing-`groups` payload.
- **Status**: ✅ Fixed — handler wrapped in try/catch (500 on failure); `data.title` validated; `data.groups` must be a non-empty string array for `group_published`; 400 returned before any Firestore/Discord call (`server/routes/discord.ts:116-172`).

---

## [BUG-009] Org write handlers lack ownership checks (any organizer can act on other orgs' data)
- **Severity**: High
- **Category**: Security
- **Affected File(s)**: `src/features/organizer/hooks/useOrgData.ts:229-247, 249-256, 258-264, 266-273, 394-405`
- **Description**: `updateTournamentStatus` (249) and `broadcastLobby` (258) write to any `tournaments/{id}` (including room credentials) with no `hostUid` check. `updateParticipantStatus` (266) approves/rejects any participant. `resolveDispute` (394) resolves any dispute. `deleteTournament` (229) falls back to a direct client `deleteDoc` that swallows errors when the `/api/tournaments/:id` DELETE fails. Other helpers in the same file (`broadcastAnnouncement:292`, `toggleScrimSlot:323`, `toggleRosterLock`, `issueWarning`, `toggleBanTeam`) DO check `hostUid` — the pattern exists but was not applied consistently.
- **Root Cause**: Ownership verification is duplicated per-handler instead of centralized, and several handlers were written without it.
- **Proposed Safe Fix**:
  1. Add a small `assertTournamentHost(tournamentId)` guard (getDoc + compare `hostUid` to `user.uid`) and call it in `updateTournamentStatus`, `broadcastLobby`, `updateParticipantStatus`, `resolveDispute`.
  2. Remove the client `deleteDoc` fallback in `deleteTournament` (server route + rules already enforce auth; a silent bypass is worse than surfacing the server error).
   3. Validate with the existing org test coverage (type-check + relevant unit tests).
- **Status**: ✅ Fixed — added `assertTournamentHost()` ownership guard and applied it to `updateTournamentStatus`, `broadcastLobby`, `updateParticipantStatus`, `resolveDispute`; removed the silent client-side `deleteDoc` fallback in `deleteTournament` (`src/features/organizer/hooks/useOrgData.ts`).

---

## [BUG-010] Scrim detail page lets any organizer manage any scrim
- **Severity**: High
- **Category**: Security
- **Affected File(s)**: `src/features/organizer/views/ScrimDetailPage.tsx:54-59, 81-86, 111-116`
- **Description**: `isAuthorized` returns true for any `profile.role === 'organizer'` regardless of `hostUid`, and true for any authenticated user when the scrim has no host id. All write handlers (`handleSaveEdit`, `handleToggleSlot`, `handleBroadcast`, `handleStatusChange`) rely on this gate, so one organizer can edit, broadcast credentials for, or change the status of any other organizer's scrim.
- **Root Cause**: Role check used as a proxy for ownership.
- **Proposed Safe Fix**: Replace `profile?.role === 'organizer'` with an ownership check (`user.uid === scrimHostId`) plus admin; drop the `!scrimHostId` auto-grant. Mirror the pattern in `useTournamentAdmin.ts:71` (`hostUid === user.uid || role === 'admin'`). Validate by walking the read path.
- **Status**: ✅ Fixed — removed the `profile?.role === 'organizer'` grant from all three authorization blocks; only the scrim host, admin, or hostless legacy records can manage a scrim (`src/features/organizer/views/ScrimDetailPage.tsx`).

---

## [BUG-011] Tournament-complete fallback earnings write is denied for organizers (and does client-side revenue math)
- **Severity**: High
- **Category**: Security
- **Affected File(s)**: `src/features/admin/hooks/useTournamentAdmin.ts:121-146`, `firestore.rules:388-394`
- **Description**: On `status === 'completed'`, if no `tournamentEarnings` doc exists, the client computes `profit`, `orgShare`, `nexplayShare` from `approvedParticipants.length * entryFee` and `setDoc`s to `tournamentEarnings`. The rules allow writes only to admins (`firestore.rules:393`), so organizer hosts are denied. Even when allowed (admin), the revenue split is computed on the client, violating the platform's financial-integrity rule (server-side verification).
- **Root Cause**: Fallback path was added client-side instead of server-side; rules intentionally keep earnings admin-writable.
- **Proposed Safe Fix**: Remove the client-side fallback; rely on the server-side `/api/wallet/distribute-prizes` path (already atomic/idempotent per audit) to create the earnings record. If a fallback is required, add a server endpoint that computes the split server-side. Validate wallet server tests.
- **Status**: ✅ Fixed — removed the client-side earnings fallback (and its revenue math) from `handleUpdateStatus`; status completion now relies solely on server-side `/api/wallet/distribute-prizes` (`src/features/admin/hooks/useTournamentAdmin.ts`).

---

## [BUG-012] Home fabricates a "total players" counter from 100 full user documents
- **Severity**: High
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/home/views/Home.tsx:164-166`
- **Description**: On every home mount, `getDocs(query(collection(db,'users'), limit(100)))` downloads up to 100 full user docs (profiles, contact info, wallet/XP data — PII) purely to render `totalPlayersCount = max(1350, size*12)` — a fabricated number. ~100 reads + heavy payload on the most-visited page.
- **Root Cause**: No aggregate/counter source for "total players"; invented multiplier fallback.
- **Proposed Safe Fix**: Replace with a lightweight denormalized counter (e.g., a `settings/stats` doc with a `totalPlayers` counter updated on sign-up, or count `users_public` with a cheap bounded query). At minimum, stop reading full `users` docs — never fetch PII for a cosmetic number. Validate via type-check + build.
- **Status**: ✅ Fixed — home now samples the `users_public` collection (public profiles only) instead of reading PII-bearing `users` docs (`src/features/home/views/Home.tsx`). A true aggregate counter remains a documented future improvement.

---

## [BUG-013] Profile "Activity" tab fetches the user's entire transaction history
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/profile/views/Profile.tsx:126-151`
- **Description**: The activity tab runs `getDocs(where('userId', '==', uid))` with **no `limit`/`orderBy`**, downloads every transaction (entry fees, deposits, withdrawals, prizes, refunds — grows forever), sorts client-side, then shows `slice(0,10)`. Read/latency cost scales with lifetime transactions.
- **Root Cause**: Missing `orderBy('timestamp','desc').limit(10)`; the composite index `userId + timestamp DESC` already exists in `firestore.indexes.json` (46-58).
- **Proposed Safe Fix**: Change the query to `orderBy('timestamp','desc').limit(10)` (index exists). Keep client sorting only as fallback if desired. Validate with type-check.
- **Status**: ✅ Fixed — activity query now `orderBy('timestamp','desc').limit(10)` using the existing composite index (`src/features/profile/views/Profile.tsx`).

---

## [BUG-014] Results page fetches 100 tournaments and filters client-side; stale index comment
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/results/views/Results.tsx:21-27`, `firestore.indexes.json:73-86`
- **Description**: `getDocs(query(tournaments, limit(100)))` then filters `status === 'completed'` and sorts in JS. Any completed tournament beyond the first 100 docs is permanently invisible, and it costs up to 100 reads to render ≤50 rows. The in-code comment claims the composite index is missing, but `firestore.indexes.json` already declares `status ASC + startTime DESC` (73-86).
- **Root Cause**: Defensive code written before the index existed; never updated.
- **Proposed Safe Fix**: Use `where('status','==','completed').orderBy('startTime','desc').limit(50)` (index exists). Validate with a Firestore query smoke test / type-check.
- **Status**: ✅ Fixed — results query now `where('status','==','completed').orderBy('startTime','desc').limit(50)`; stale comment removed (`src/features/results/views/Results.tsx`).

---

## [BUG-015] Scrims hub runs overlapping duplicate collection scans (client and `/api/scrims`)
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/scrims/views/Scrims.tsx:62-66`, `server/routes/tournaments.ts:268-302`
- **Description**: On mount the client runs three parallel queries — full `tournaments where matchType=='scrims'`, full `tournaments where isScrim==true` (reads the same docs twice), and full `scrims` collection — all unbounded and client-filtered. `/api/scrims` repeats the same three overlapping scans per request.
- **Root Cause**: Redundant/legacy data model (scrims mirrored in both `tournaments` and `scrims`) queried defensively.
- **Proposed Safe Fix**: Consolidate to a single indexed query (e.g., `where('matchType','==','scrims')` with limit + `status`/`startTime` order) and drop the duplicate scans; make `/api/scrims` use the same single query with pagination. Validate via scrims service tests.
- **Status**: ✅ Fixed — client runs the authoritative `matchType == 'scrims'` query first; legacy scans run only when it returns nothing (no duplicate reads). `/api/scrims` server-side consolidation documented for follow-up.

---

## [BUG-016] Organizer directory fetches the full `users_public` collection
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/browser/views/OrgBrowser.tsx:28-31`
- **Description**: `getDocs(collection(db,'users_public'))` pulls every public profile (grows with the player base), then filters `role === 'organizer'` in JS.
- **Root Cause**: Missing `where('role','==','organizer')`; no limit.
- **Proposed Safe Fix**: Query `where('role','==','organizer')` (single-field equality, no composite index needed) with pagination. Validate via type-check.
- **Status**: ✅ Fixed — organizer directory now queries `where('role','==','organizer')` with `limit(200)` (`src/features/browser/views/OrgBrowser.tsx`).

---

## [BUG-017] Notification listener is unbounded
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/shared/services/NotificationService.ts:64-84`
- **Description**: `onNotifications` listens to all notifications for a user (`where userId == uid`, `orderBy timestamp desc`) with **no `limit`**. The initial snapshot and every subsequent event transfer the user's full notification history; memory and payload grow without bound.
- **Root Cause**: Missing `limit()` on a long-lived listener.
- **Proposed Safe Fix**: Add `limit(50)` to the query (index `userId + timestamp DESC` exists at `firestore.indexes.json:148-160`) with a "load more" pagination path if needed. Validate via type-check.
- **Status**: ✅ Fixed — listener query now `limit(50)` (`src/shared/services/NotificationService.ts`).

---

## [BUG-018] Leaderboard season selector has no effect
- **Severity**: Medium
- **Category**: UI-UX
- **Affected File(s)**: `src/features/leaderboard/views/Leaderboard.tsx:132,138-162`
- **Description**: `season` state (default "Season 4") is in the effect deps but never used in either query. Changing the season re-runs the identical `users_public`/`teams` query — a visible control that does nothing.
- **Root Cause**: Query filters were never wired to the season state.
- **Proposed Safe Fix**: Either wire `season` into the queries (if a season field exists on the docs) or hide the control. Validate by inspecting the season field usage / type-check.
- **Status**: ✅ Fixed — no season field exists on the docs; removed the no-op selector and the dead `season` state (also fixes pointless query re-runs) (`src/features/leaderboard/views/Leaderboard.tsx`).

---

## [BUG-019] Static reference data is re-fetched on every mount with no cache
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/tournaments/components/TournamentCreateModal.tsx:100-106`, `src/features/wallet/components/WalletModal.tsx`, `src/features/browser/views/GameBrowser.tsx:16-40`, `src/features/news/News.tsx:17`, `src/features/teams/views/Teams.tsx:54`, `src/features/profile/views/Profile.tsx:96` (duplicate `settings/site` read)
- **Description**: Games, payment methods, payment categories, and site settings are near-static but re-read via `getDocs` on every modal open / page mount, despite `persistentLocalCache` being enabled in `firebase.ts`. The settings doc is streamed by `SiteSettingsContext` yet Profile re-reads it.
- **Root Cause**: No caching layer (SWR/React Query/module cache); `getDocs` bypasses the persistent cache and always goes to network.
- **Proposed Safe Fix**: Add a tiny module-level cache (TTL) or a `useCollectionCache` hook for static reference data; reuse `useSiteSettings()` instead of re-reading `settings/site`. Validate via type-check/build.
- **Status**: ✅ Fixed — added `withStaticCache` TTL helper (`src/shared/utils/staticCache.ts`) applied to the published-games queries (TournamentCreateModal, GameBrowser); Profile now uses `useSiteSettings()` instead of re-reading `settings/site`.

---

## [BUG-020] Fetch failures render misleading empty states with no error/retry
- **Severity**: Medium
- **Category**: UI-UX
- **Affected File(s)**: `src/features/dashboard/views/Dashboard.tsx:127-129,278`, `src/features/teams/views/Teams.tsx:67-69,333`, `src/features/teams/views/TeamDetails.tsx:372-380`, `src/features/leaderboard/views/Leaderboard.tsx:170-171`
- **Description**: `fetchAllData`/`fetchTeams`/team-fetch/leaderboard catches are `console.error` only. A rules/network failure renders "No matches found." / "No teams found." / "Team Not Found" — indistinguishable from genuinely empty data, and there is no retry.
- **Root Cause**: Error state not captured; empty state shown for both empty and failed.
- **Proposed Safe Fix**: Add `fetchError` state + a retry button in these views (mirror the pattern already present in `Scrims.tsx:204-215` and `Wallet.tsx`). Validate via type-check/build.
- **Status**: ✅ Fixed — added `fetchError` state + "Try Again" retry UI to Dashboard, Teams, TeamDetails, and Leaderboard (mirrors the Scrims pattern) (`Dashboard.tsx`, `Teams.tsx`, `TeamDetails.tsx`, `Leaderboard.tsx`).

---

## [BUG-021] Dead code: four modules are never imported anywhere
- **Severity**: Medium
- **Category**: Dead Code
- **Affected File(s)**: `src/shared/utils/errorHandler.ts`, `src/shared/services/sitemapGenerator.ts`, `src/shared/components/Toast.tsx`, `src/shared/components/SmartImage.tsx`
- **Description**: Grep across all `*.ts`/`*.tsx` confirms zero importers for `errorHandler`/`logAndToastError`, `generateSitemapXml` (live sitemap is `server/seo.ts`), `Toast`, and `SmartImage`. They compile but ship dead weight.
- **Root Cause**: Superseded by `NotificationContext` toasts, `server/seo.ts`, and inline image handling; never removed.
- **Proposed Safe Fix**: Delete the four files (and confirm no barrel/index re-exports them). Validate with type-check + build.
- **Status**: ✅ Fixed — deleted `errorHandler.ts`, `sitemapGenerator.ts`, `Toast.tsx`, `SmartImage.tsx` after confirming zero importers and no barrel re-exports; type-check clean.

---

## [BUG-022] Dashboard writes state it never reads (and duplicates the settings read)
- **Severity**: Medium
- **Category**: Dead Code
- **Affected File(s)**: `src/features/dashboard/views/Dashboard.tsx:17-18,118,124`
- **Description**: `const [, setMyTeams] = useState<Team[]>([])` and `const [, setSettings] = useState<SiteSettings|null>(null)` — values are never read. The teams query (100-119) and `settings/site` getDoc (122-125) run on every dashboard load for zero UI benefit; settings are already streamed by `SiteSettingsContext`.
- **Root Cause**: Leftover state from an earlier version.
- **Proposed Safe Fix**: Remove both state setters and the corresponding queries (keep `myTournaments` fetch). Validate via type-check/build.
- **Status**: ✅ Fixed — removed the two write-only states and the dead teams query + `settings/site` getDoc (settings still streamed by `SiteSettingsContext`); trimmed now-unused imports (`Dashboard.tsx`).

---

## [BUG-023] Result upload performs N+1 participant queries
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/results/components/ResultUploader.tsx:252-267`
- **Description**: For each scored result, a separate `getDocs(participants where tournamentId==tid, where userId==teamId)` is awaited sequentially. A 16-team group costs 16 sequential round-trips; battle royale can approach 100.
- **Root Cause**: Per-result query instead of batching participant docs by known IDs.
- **Proposed Safe Fix**: Fetch the participants for the tournament once, index by `userId`, and look up in memory. Validate via type-check.
- **Status**: ✅ Fixed — participants fetched once, indexed by `userId`, looked up in memory (N+1 → 1 query) (`src/features/results/components/ResultUploader.tsx`).

---

## [BUG-024] Public profile does N+1 team reads and an unbounded match-history fetch
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/profile/views/PublicProfile.tsx:51-70`
- **Description**: For each team membership a sequential `getDoc(teams/<id>)` runs, and `match_history where userId` is fetched with no `limit`/`orderBy` then sorted client-side. The effect depends on `[id, user]`, so it re-fires whenever the viewer's auth profile identity changes.
- **Root Cause**: No batching (`__name__ in` chunks) and no bounded match-history query.
- **Proposed Safe Fix**: Batch team getDocs in `__name__ in` chunks (pattern exists in `TeamDetails.tsx:104-116`); add `orderBy('timestamp','desc').limit(20)` to match history; stabilize the effect dep. Validate via type-check.
- **Status**: ✅ Fixed — team reads batched in `__name__ in` chunks; match history bounded via `orderBy('timestamp','desc').limit(20)` (composite index added in `firestore.indexes.json`) (`src/features/profile/views/PublicProfile.tsx`).

---

## [BUG-025] Admin dashboard fires ~15 unthrottled queries on mount with unstable deps
- **Severity**: Medium
- **Category**: Cache-Performance
- **Affected File(s)**: `src/features/admin/hooks/useAdminData.ts:238-370`
- **Description**: `Promise.allSettled` runs ~15 Firestore queries (pending transactions, all tournaments, slides, promocodes, games, categories, methods, earnings, today's transactions, users, activity logs, settings). Most have no `limit`. The effect deps are `[profile]`, and `profile` is rebuilt by AuthContext on every user-doc write (wallet/XP/presence), so any profile change re-fires all 15.
- **Root Cause**: Broad unbounded data load + unstable dependency.
- **Proposed Safe Fix**: Add `limit`s; stabilize the effect dependency (e.g., depend on `profile?.uid`/role only, or a `version` ref); consider a shared stats query. Validate via type-check.
- **Status**: ✅ Fixed — effect now depends on `profile?.uid`/`profile?.role` (no more re-firing on every profile write); bounded limits added to tournaments, slides, promocodes, games, categories, methods, earnings, and today's transactions (`src/features/admin/hooks/useAdminData.ts`).

---

## [BUG-026] Server endpoints registered but never called by any client code
- **Severity**: Medium
- **Category**: Dead Code
- **Affected File(s)**: `server/routes/tournaments.ts:8,52,129`, `server/routes/auth.ts:29`, `server/routes/media.ts:140,226,278`, `server/routes/wallet.ts:176`, `server/routes/ai.ts:99,201`, `server/routes/admin-scrims.ts:18,82`
- **Description**: Verified via grep — no client `fetch` targets: `/api/tournaments/:id/groups/generate`, `/api/tournaments/:id/results/upload`, `/api/tournaments/:id/advance`, `/api/me`, `/api/upload-image` (legacy dup of `/api/upload/image`), `GET /api/media`, `DELETE /api/media/:id`, `/api/wallet/transactions`, `/api/audit`, `/api/audit/discuss`, `/api/admin/audit-scrims`, `/api/admin/fix-scrims`.
- **Root Cause**: Client was migrated to direct Firestore writes / newer endpoints; the old routes were never removed.
- **Proposed Safe Fix**: Keep the security-relevant server-only ones (they also serve as admin-maintenance tools) but delete confirmed-duplicate/legacy handlers (e.g., `/api/upload-image`, `/api/audit` chain) — or document them as intentional maintenance APIs. Validate with a server smoke test (routes still boot).
- **Status**: 🔲 Pending

---

## [BUG-027] `lazyWithRetry` never clears its reload flag
- **Severity**: Low
- **Category**: UI-UX
- **Affected File(s)**: `src/App.tsx:17-30`
- **Description**: `chunk-reloaded` is set before `window.location.reload()` and never cleared. A second chunk-hash mismatch later in the same session throws directly to the ErrorBoundary instead of doing the one-reload recovery the helper promises.
- **Root Cause**: Missing `sessionStorage.removeItem` after successful load (or a timestamp-based approach).
- **Proposed Safe Fix**: Clear the flag (or store a timestamp and allow one retry per deployment). Validate with a build.
- **Status**: ✅ Fixed — the `chunk-reloaded` flag is now cleared after a successful chunk load, so a later deployment's mismatch can also perform the one-reload recovery (`src/App.tsx`).

---

## [BUG-028] Admin wallet-balance total only sums the first 50 users
- **Severity**: Low
- **Category**: UI-UX
- **Affected File(s)**: `src/features/admin/hooks/useAdminData.ts:331-334,266`
- **Description**: The "total balance" KPI is computed from `users limit(50)`, so the dashboard's wallet-balance total is consistently undercounted as the user base grows.
- **Root Cause**: Limit applied to a stat that should be aggregate (or paginated-summed).
- **Proposed Safe Fix**: Either remove the limit and use a proper aggregate, or relabel the stat as "top 50 users balance" — do not show a misleading total. Validate via type-check.
- **Status**: ✅ Fixed — relabeled the KPI to "Total Holdings (recent users)" so the partial sum is not presented as a full total; a full-aggregate fix is scheduled with the money-op server migration (`DashboardTab.tsx`).

---

## [BUG-029] Organizer KPIs use personal transactions instead of org-scoped data
- **Severity**: Low
- **Category**: UI-UX
- **Affected File(s)**: `src/features/organizer/hooks/useOrgData.ts:183-198,116-143`
- **Description**: `monthlyRevenue`/`pendingPayouts` are computed from `where('userId','==',user.uid)` — the organizer's **personal** wallet transactions — not org/earnings-scoped records, so org revenue and payout KPIs can be wrong.
- **Root Cause**: Transaction query filters on the user instead of the org/tournament host dimension.
- **Proposed Safe Fix**: Compute KPIs from `tournamentEarnings`/org-hosted tournaments (already fetched) or add a hostUid-filtered query. Validate via type-check.
- **Status**: ✅ Fixed — `monthlyRevenue` and `pendingPayouts` now derive from org-scoped `tournamentEarnings` (queried by `orgId`, `limit(200)`) instead of the organizer's personal wallet transactions (`useOrgData.ts`).

---

## [BUG-030] Role authority is split between custom claims and the Firestore `role` field
- **Severity**: High
- **Category**: Security
- **Affected File(s)**: `firestore.rules:32-46`, `server/shared.ts:338-350`, `src/shared/context/AuthContext.tsx:195-200`, `server/routes/auth.ts:44`
- **Description**: `isAdmin()`/`isOrganizer()` in the rules fall back to `users/{uid}.role`; `authenticateToken` uses `decodedIdToken.role || docRole`; the client reads role from the doc; `/api/admin/set-claims` and `requireAdmin` depend on `req.user.role`, which inherits the doc fallback. The `users.role` document field is therefore a full admin/org authority everywhere except the wildcard rule. No direct escalation path exists today (create requires `role=='player'`, owner update requires `role==existing().role`), but the split-brain is fragile.
- **Root Cause**: Migration from doc-based roles to custom claims left the doc fallback in place in three layers.
- **Proposed Safe Fix**: (Decision required — do not weaken.) Remove the Firestore-doc role fallback after migrating all users to custom claims; make claims the single source of truth in rules + `authenticateToken` + client role derivation. This is a migration, not a quick fix — schedule it.
- **Status**: 🔲 Pending

---

## [BUG-031] Real-money operations run client-side, gated only by `isAdmin()`
- **Severity**: High
- **Category**: Security
- **Affected File(s)**: `src/features/admin/hooks/useAdminData.ts:376-404,428-445,532-547,1280-1311`
- **Description**: Deposit approval (balance credit), refunds, balance adjustments, and earnings release run in browser `runTransaction`s. Combined with the doc-role fallback (BUG-030), the "admin" authority is a single Firestore field, and money moves with no server-side verification or immutable audit beyond client-written `activityLogs`.
- **Root Cause**: Architecture decision to do admin money ops client-side under admin rules; violates the project's own financial-integrity rules (AGENTS.md §6).
- **Proposed Safe Fix**: (Decision required.) Move deposit-approval/refund/adjustment/earnings-release behind server endpoints (Admin SDK) with atomic transactions and server-authored audit records, mirroring `/api/wallet/*`. Larger refactor — schedule after quick wins.
- **Status**: 🔲 Pending

---

## [BUG-032] Prize distribution never verifies winners are registered participants
- **Severity**: High
- **Category**: Security
- **Affected File(s)**: `server/routes/wallet.ts:515-657`, `server/prizeValidation.ts:7-36`
- **Description**: `distribute-prizes` validates winner shape, uniqueness, prize bounds, and `totalPrizes <= prizePool`, but never checks that each winner is an approved participant of the tournament (via the `participants` collection). A host can pay the full prize pool to arbitrary accounts (or themselves), and the doc-role fallback (BUG-030) lets a doc-role admin bypass the host check entirely.
- **Root Cause**: Missing participant membership verification in the server-side prize path.
- **Proposed Safe Fix**: In `distribute-prizes`, load the tournament's approved participants (batched) and reject any winner whose `userId` is not an approved participant; keep idempotency. Validate with `server/prizeValidation.test.ts` + a new test case for non-participant winners.
- **Status**: ✅ Fixed — each winner's `participants/{tournamentId}_{userId}` doc is read in the transaction and must exist with `status === 'approved'`, else the payout is rejected (`server/routes/wallet.ts:549-561`).

---

## [BUG-033] Deposit duplicate-detection is racy
- **Severity**: Medium
- **Category**: Security
- **Affected File(s)**: `server/routes/wallet.ts:56-68`
- **Description**: The duplicate check (same `transactionCode` + `amount` + user within 24h) is a query executed **outside** the write transaction. Two concurrent identical requests can both pass the check and create two pending deposits. Other wallet endpoints use deterministic doc IDs for idempotency; deposit does not.
- **Root Cause**: Check-then-act without a deterministic key or in-transaction guard.
- **Proposed Safe Fix**: Use a deterministic `transactions` doc ID (e.g., `${uid}_DEP_${transactionCode}`) so a retry/replay overwrites instead of duplicating, or move the duplicate check into the write transaction. Validate with wallet server tests.
- **Status**: ✅ Fixed — deposit now uses a deterministic doc ID (`sha1(uid|amount|transactionCode)`) so concurrent double-submits converge on one doc instead of two (`server/routes/wallet.ts:71-75`).

---

## [BUG-034] `team_activity` writes can be forged
- **Severity**: Medium
- **Category**: Security
- **Affected File(s)**: `firestore.rules:336-340`, `src/features/teams/views/TeamDetails.tsx:157-171`
- **Description**: `allow write: if isAdmin() || isOwner(incoming().userId)` applies to create AND update. On **update**, any user can overwrite any team's activity doc by including `userId: self` in the payload (never checked against the existing doc). On **create**, any user can post activity into any `teamId`. Team feeds/audit trails can be spammed or rewritten.
- **Root Cause**: `isOwner` check against the incoming doc rather than the existing doc/team membership.
- **Proposed Safe Fix**: Split create/update. Create: require verified + `incoming().userId == request.auth.uid`; update: require `isOwner(existing().userId)` or `isTeamOwner(existing().teamId)`. Validate with a rules test.
- **Status**: ✅ Fixed — create requires `isVerified() && isOwner(incoming().userId)`; update/delete require `isAdmin() || isOwner(existing().userId) || isTeamOwner(existing().teamId)` (`firestore.rules:336-340`).

---

## [BUG-035] Any verified user can join any team
- **Severity**: Medium
- **Category**: Security
- **Affected File(s)**: `firestore.rules:314-318`
- **Description**: `team_members` create requires only `isVerified() && isOwner(incoming().userId)`. No team-existence check, no owner consent, no invite requirement, no capacity check — a user can inject themselves into any team, gaming team-based eligibility.
- **Root Cause**: Over-permissive create rule.
- **Proposed Safe Fix**: (Decision required — behavior change.) Require an accepted `team_invites` doc (invite-based join) or team-owner approval before `team_members` create, or move joins server-side. This changes UX for the current "join freely" behavior — confirm product intent first.
- **Status**: 🔲 Pending

---

## [BUG-036] `orgApplications` create is not bound to the caller
- **Severity**: Medium
- **Category**: Security
- **Affected File(s)**: `firestore.rules:360-364`, `src/features/profile/views/Profile.tsx:230-241`
- **Description**: `allow create: if isVerified()` — no `incoming().userId == request.auth.uid`. A user can file applications under arbitrary UIDs; on approval, `useAdminData.ts:587-592` promotes `users/{app.userId}.role` to organizer and calls `/api/admin/set-claims` for that UID. Not a direct self-escalation, but enables misdirected approvals and spam (and no rate limit).
- **Root Cause**: Missing caller-binding on create.
- **Proposed Safe Fix**: Add `incoming().userId == request.auth.uid` to the create rule (and mirror in client payload). Validate with a rules test.
- **Status**: ✅ Fixed — create requires `isVerified() && incoming().userId == request.auth.uid` (`firestore.rules:412-416`).

---

## [BUG-037] Participant roster and public profiles readable by every signed-in user
- **Severity**: Medium
- **Category**: Security
- **Affected File(s)**: `firestore.rules:223-224, 146-148`
- **Description**: `participants allow read: if isSignedIn()` exposes every tournament's full roster (userId, inGameId, inGameName, teamName, teammates, status) to any authenticated user; `users_public list: if true` is public by design (acceptable for a leaderboard) but combined they give a broad crawl surface for PII-adjacent data.
- **Root Cause**: Read rules not scoped to tournament viewers/hosts.
- **Proposed Safe Fix**: (Decision required — behavior change.) Scope `participants` reads to the tournament host + that tournament's participants; confirm leaderboard/overlay flows still work. Validate with a rules test.
- **Status**: 🔲 Pending

---

## [BUG-038] Media catalog write failures are swallowed while the upload reports success
- **Severity**: Low
- **Category**: Broken API
- **Affected File(s)**: `src/shared/services/mediaService.ts`, `server/routes/media.ts:156,181,269`
- **Description**: If the post-upload Firestore `media` catalog write fails, the catch logs `[Database Bypass]` and the endpoint still returns success — the file is uploaded to Cloudinary but never tracked, so `/api/media/delete` can't find it (orphaned cloud files, undeletable).
- **Root Cause**: Catalog write treated as best-effort with no reconciliation.
- **Proposed Safe Fix**: Return a failure (or a partial-success flag) when the catalog write fails so the client can surface it; optionally add a cleanup of the just-uploaded cloud asset. Validate with a smoke test of upload + catalog.
- **Status**: 🔲 Pending

---

## Phase 3 Fix Plan (order)
1. **Rules quick wins (unblock broken features, no security regression)**: BUG-001 (scrim `open`), BUG-002+003 (participants stats/moderation keys), BUG-007 (settings keys), BUG-036 (orgApplications caller binding), BUG-034 (team_activity create/update split).
2. **Server robustness**: BUG-008 (discord try/catch + payload validation), BUG-033 (deposit idempotency), BUG-032 (prize participant verification).
3. **Client authorization**: BUG-009 (org ownership guards), BUG-010 (scrim ownership).
4. **Perf/read-reduction**: BUG-012/013/014/016/017/023/024/025 (query limits/orderBy), BUG-019 (static cache), BUG-015 (scrims query consolidation).
5. **UI/UX**: BUG-018 (season selector), BUG-020 (error/retry states), BUG-027/028/029.
6. **Dead code**: BUG-021 (delete 4 modules), BUG-022 (dashboard dead state), BUG-026 (dead endpoints — after confirming no callers).
7. **Notifications policy (BUG-004/005/006)**: shared decision — rules vs client best-effort.
8. **Architecture decisions (schedule, not quick fixes)**: BUG-030 (claims migration), BUG-031 (server-side money), BUG-035 (team join policy), BUG-037 (participant read scoping), BUG-011 (server-side earnings fallback).

Each fix is validated locally (type-check, relevant unit tests, build) before moving to the next.
