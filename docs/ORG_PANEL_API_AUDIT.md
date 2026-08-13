# NexPlay Org Panel — API Audit

**Date:** 2026-08-13

## Server API Endpoints Used by Org Panel

| # | Endpoint | Method | Auth | Ownership Check | Input Validation | DB Reads | DB Writes | Error Handling | Idempotency | Used By |
|---|----------|--------|------|-----------------|------------------|----------|-----------|-----------------|-------------|---------|
| 1 | `/api/wallet/withdraw` | POST | Firebase token | ✅ Self (uid from token) | amount > 0, ≤ 50K, method string, accountDetails string | `users/{uid}` | `users/{uid}.balance`, `transactions/{auto}` | ✅ 400/409/500 with messages | ✅ Dup check 5 min | WalletPayoutsTab |
| 2 | `/api/wallet/deposit` | POST | Firebase token | ✅ Self | amount > 0, ≤ 100K, method string, screenshot check | `users/{uid}`, `promocodes/{code}` | `users/{uid}.balance`, `transactions/{auto}` | ✅ 400/500 | ✅ Transaction code | WalletPayoutsTab (indirect) |
| 3 | `/api/wallet/transactions` | GET | Firebase token | ✅ Self (uid filter) | Pagination params | `transactions` (where userId) | None | ✅ 500 | N/A | WalletPayoutsTab |
| 4 | `/api/wallet/join-tournament` | POST | Firebase token | ✅ Self + atomic | tournamentId string, teammates array | `tournaments/{id}`, `users/{uid}`, `participants/{id}` | `users/{uid}`, `tournaments/{id}`, `participants/{id}`, `transactions/{auto}` | ✅ 400/500 | ✅ Deterministic doc ID | Player flow |
| 5 | `/api/wallet/leave-tournament` | POST | Firebase token | ✅ Self + atomic | tournamentId string | `tournaments/{id}`, `users/{uid}`, `participants/{id}` | `users/{uid}`, `tournaments/{id}`, `participants/{id}`, `transactions/{auto}` | ✅ 400/500 | N/A | Player flow |
| 6 | `/api/wallet/distribute-prizes` | POST | Firebase token | ✅ Host check + admin bypass | tournamentId, winners array (userId, prize, rank), resultsData | `tournaments/{id}`, `users/{winnerId}` | `tournaments/{id}`, `results/{auto}`, `users/{winnerId}`, `users_public/{winnerId}`, `transactions/{auto}`, `tournamentEarnings/{auto}` | ✅ 400/403/500 | ✅ Status completed blocks | TournamentAdminPanel |
| 7 | `/api/wallet/redeem-promo` | POST | Firebase token | ✅ Self | code string, amount number | `promocodes/{code}`, `users/{uid}` | `users/{uid}`, `transactions/{auto}`, `promocodes/{code}` | ✅ 400/500 | ✅ Code usage tracking | Wallet (player) |
| 8 | `/api/tournaments/:id/groups/generate` | POST | Firebase token | ✅ Host check | tournamentId param, numGroups, teamsPerGroup | `tournaments/{id}`, `participants` | `tournaments/{id}.groups` | ✅ 400/500 | N/A (regenerates) | TournamentAdminPanel |
| 9 | `/api/tournaments/:id/results/upload` | POST | Firebase token | ✅ Host check | tournamentId param, results array | `tournaments/{id}` | `tournaments/{id}.results` | ✅ 400/500 | N/A | TournamentAdminPanel |
| 10 | `/api/tournaments/:id/advance` | POST | Firebase token | ✅ Host check | tournamentId param | `tournaments/{id}`, `participants` | `tournaments/{id}` (groups, currentRound) | ✅ 400/500 | N/A | TournamentAdminPanel |
| 11 | `/api/scrims` | GET | Public | N/A | None | `scrims`, `tournaments` (matchType=scrims) | None | ✅ 500 | N/A | ScrimsHubTab (indirect) |
| 12 | `/api/upload-image` | POST | Firebase token | ✅ Self | file (multipart), category | None | ImgBB API → URL | ✅ 400/500 | N/A | SettingsStreamTab, TournamentCreateModal |
| 13 | `/api/media/delete` | POST | Firebase token | ✅ Self | publicId string | None | ImgBB delete API | ✅ 400/500 | N/A | Image management |
| 14 | `/api/discord/announce` | POST | Firebase token | ❌ No host check | action string, tournament data | None | Discord webhook | ✅ 400/500 | N/A | TournamentAdminPanel |
| 15 | `/api/generate-banner` | POST | Firebase token | ✅ Self | prompt string | None | AI image gen | ✅ 400/500 | N/A | TournamentCreateModal |

## Direct Firestore Operations (no API)

| # | Operation | Collection | Filter | Ownership | Rules Enforce | Used By |
|---|-----------|------------|--------|-----------|---------------|---------|
| 1 | Fetch tournaments | `tournaments` | `where('hostUid', '==', user.uid)` | ✅ Client | ✅ | useOrgData |
| 2 | Delete tournament | `tournaments/{id}` | N/A | ❌ Client doesn't check | Admin only | useOrgData (BUG-001) |
| 3 | Update status | `tournaments/{id}` | N/A | ❌ Client doesn't check | ✅ Host check | useOrgData |
| 4 | Broadcast lobby | `tournaments/{id}` | N/A | ❌ Client doesn't check | ✅ Host check | useOrgData |
| 5 | Update participant | `participants/{id}` | N/A | ❌ Client doesn't check | ✅ Host check | useOrgData |
| 6 | Fetch participants | `participants` | `where('tournamentId', '==', id)` | ❌ No check | `isSignedIn()` | useOrgData |
| 7 | Fetch transactions | `transactions` | `where('userId', '==', uid)` | ✅ Self | ✅ Self | useOrgData |
| 8 | Fetch disputes | `disputes` | `where('tournamentId', 'in', ids)` | ✅ Own tournaments | Owner/admin | useOrgData (fixed) |
| 9 | Toggle scrim slot | `tournaments/{id}` | N/A | ✅ Client checks (fixed) | ✅ Host check | useOrgData (fixed) |
| 10 | Toggle roster lock | `participants/{id}` | N/A | ✅ Client checks (fixed) | ✅ Host check | useOrgData (fixed) |
| 11 | Issue warning | `participants/{id}` | N/A | ✅ Client checks (fixed) | ✅ Host check | useOrgData (fixed) |
| 12 | Toggle ban | `participants/{id}` | N/A | ✅ Client checks (fixed) | ✅ Host check | useOrgData (fixed) |
| 13 | Resolve dispute | `disputes/{id}` | N/A | ✅ Client checks (fixed) | Owner/admin | useOrgData (fixed) |
| 14 | Save settings | `users/{uid}` | N/A | ✅ Self | ✅ Self | useOrgData |
| 15 | ScrimDetailPage edit | `tournaments/{id}` | N/A | ❌ Client doesn't check | ✅ Host check | ScrimDetailPage |
| 16 | ScrimDetailPage slot | `tournaments/{id}` | N/A | ❌ Client doesn't check | ✅ Host check | ScrimDetailPage |

## Issues Found

1. **`/api/discord/announce`** — No tournament ownership check. Any authenticated user can trigger Discord announcements for any tournament. **Severity: MEDIUM** — limited impact (sends Discord message, no data corruption).

2. **Direct Firestore writes without client-side ownership checks** — While Firestore rules enforce ownership server-side, the client code doesn't check before attempting writes, leading to confusing error messages. The rules ARE the security boundary, but better UX would check ownership first. **Severity: LOW** — security is enforced by rules, only UX is affected.

3. **`participants` read rule** — `allow read: if isSignedIn()` exposes all participants to any authenticated user. **Severity: MEDIUM** — PII exposure (inGameId, username, teammates).
