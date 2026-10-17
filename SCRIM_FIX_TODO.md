# Scrim engine remediation — tracked TODO

Scope: every finding from the full scrim-engine scan (registration, ID pass / room
credentials, result + prize distribution for STANDARD/POINTS and PER_KILL scrims).
Status column is maintained as each item lands.

Guardrails applied to all items:
- Minimal change. No framework, schema, or architecture replacement.
- No existing player-facing or organizer-facing flow is broken. Where a fix would
  change behaviour for data written by a tool outside this repo, the item is
  marked **DEFERRED — needs confirmation** and the diff is left here, unapplied.
- Money paths stay inside Firestore transactions with idempotency.
- Verification for each block: `npm run lint` (tsc --noEmit) + `npm test` + `npm run build`.

Legend: `open` / `in progress` / `done` / `deferred`

---

## FIX-01 — ID pass (room credentials) leak

| # | Severity | Location | Fix | Status |
|---|---|---|---|---|
| 1.1 | Critical | `firestore.rules:319,322` (scrims), `:109` `isValidTournament` | Credential blocklist only inspects **top-level** keys, so `roomDetails.{roomId,roomPass,roomPassword}` is writable onto the public doc, which is `allow read: if true`. Add a map-aware `hasCredentialFields()` helper and reject create/update when it matches, for both `/scrims/{id}` and `/tournaments/{id}`. | done |
| 1.2 | Critical | `src/shared/services/roomCredentials.ts:36-65,148-167` | Remove the public-doc and cross-collection credential fallbacks in `fetchRoomCredentials` and the third "main doc" listener in `subscribeRoomCredentials`. Credentials resolve only from `{collection}/{id}/credentials/{credId}`. | done |
| 1.3 | High | `src/features/tournaments/views/TournamentDetails.tsx:709-710` | `effectiveRoomId`/`effectiveRoomPass` fall back to `tournament.roomId/roomPass/roomDetails.*` off the public doc. Drop those fallbacks. | done |
| 1.4 | High | `database.rules.json:21-26` `live_rooms` | Read is granted to *every* organizer/admin token, not scoped to their own event, and the subtree holds room credentials. Restrict `.read` to admin token; keep `.write` for organizer+admin so any external broadcaster keeps working. | done |
| 1.5 | Medium | `src/shared/services/roomCredentials.ts:112-130` | RTDB `live_rooms` fast path has no writer anywhere in the repo and participants cannot read it, so it is dead latency. Leave the listener in place (harmless once 1.4 lands) — documented, not removed. | done (no-op, documented) |
| 1.6 | Info | operators | Every `roomId`/`roomPass` already written onto a public scrim/tournament doc stays readable by the public until the rules ship **and** the field is cleared. Rotate the affected room passwords. | **manual follow-up** |

## FIX-02 — Registration integrity

| # | Severity | Location | Fix | Status |
|---|---|---|---|---|
| 2.1 | High | `server/routes/scrims.ts:121` vs `tools/init-scrims.ts:31`, `scrimsService.ts:228` | Join reads only root `entryFee`; real scrim docs store `requirements.entryFee`, so a paid scrim is joinable for free. Use the same resolution chain as `wallet.ts:412-415`: `entryFee ?? requirements.entryFee ?? fee`, integer-clamped at 0. | done |
| 2.2 | High | `server/routes/scrims.ts:331-336` | Refund is recomputed from the **live, organizer-editable** `entryFee`, letting a host raise the fee and have players leave for more than they paid. Persist the amount actually charged on the participant record + slot at join, and refund that value; legacy rows without it fall back to the current behaviour. | done |
| 2.3 | Medium | `server/routes/scrims.ts:64,71-73,169-182` | `teamId` is trusted from the body and grants that team +70 EXP plus a roster entry, with no membership check. Verify the caller belongs to the team (`team_members`, or the team's `ownerId`) before crediting; otherwise join as an individual. | done |
| 2.4 | Medium | `server/routes/scrims.ts:75-77,185-208` | `teammateUids` credits +50 EXP to any 4 arbitrary UIDs with no relation check. Only credit teammates who are actually on the joiner's team roster. | done |
| 2.5 | Medium | `server/routes/scrims.ts:62-127` | Duo/Squad roster-size contract enforced on the tournament path (`wallet.ts:381-386`) is absent here. Validate slot-format consistency and reject oversized rosters. | done |
| 2.6 | Low | `server/routes/scrims.ts:63,294` | No scrim-id shape validation on join/leave (the GET has one at `:49`); a malformed id surfaces as a 500. Reuse the same guard. | done |
| 2.7 | Medium | `firestore.rules:315-323` | Eligibility (`minTier`, `minRank`, `levelRequired`, `discordRequired`) is displayed but enforced nowhere, and email verification is not required to spend money. Server-side eligibility gate added in join; **rule-level** tightening deferred (see 4.6 note). | done |
| 2.8 | Info | `server/shared.ts:358-363` | Rate limiter is per-instance in-memory, already self-documented. Not changed — needs Upstash/KV, out of scope. | **known limitation** |

## FIX-03 — Result submission + prize settlement engine (both modes)

| # | Severity | Location | Fix | Status |
|---|---|---|---|---|
| 3.1 | Critical | none (missing) | No route finalizes results or pays prizes: no Cloud Functions, no `/api/*` results endpoint, `/api/wallet/distribute-prizes` and `/api/admin/earnings/release` referenced by `firestore.rules:492-493` do not exist, and `tournamentEarnings` has zero writers. Add `POST /api/scrims/:id/results` (record + finalize/payout) in `server/routes/scrims.ts`. | done |
| 3.2 | High | `server/prizeValidation.ts:7` | `validatePrizeWinners` exists but is imported only by tests. Wire it into the settlement route. | done |
| 3.3 | High | new route | Recipients must be verified registered participants: cross-check every `userId`/`teamId` against the scrim's filled slots and `participants` docs before any credit. | done |
| 3.4 | High | new route | No total-vs-budget check exists anywhere. Cap payout at `min(prizePool, collectedEntryFees/lockedMoney)` minus already-paid, and reject over-allocation. | done |
| 3.5 | Critical | new route | Payout must be atomic + idempotent: one Firestore transaction per recipient batch, deterministic `refId` (`SCRIM-PAY-{scrim}-{uid}-{rank}`) and duplicate-payout guard, `transactions` + `tournamentEarnings` records, host escrow debit, audit log. | done |
| 3.6 | High | `firestore.rules:320-322` | For the route to be authoritative, organizer clients must stop writing `winners/manualResults/killRewards/payoutStatus` straight onto the scrim doc. **DEFERRED** — an organizer tool outside this repo may rely on that write path. Diff supplied in the PR notes, not applied. | deferred |
| 3.7 | Medium | `src/features/scrims/views/ScrimDetails.tsx:576`, `ScrimResultsTable.tsx:775` | UI promises "payouts are credited directly to your NexPlay wallet upon finalization" while nothing credited wallets. Now true once 3.1 ships; copy left as-is. | done |

## FIX-04 — PER_KILL + scoring display correctness

| # | Severity | Location | Fix | Status |
|---|---|---|---|---|
| 4.1 | High | `src/features/tournaments/components/ScrimResultsTable.tsx:360,421` | Raw `kills × rewardPerKill` bypasses `perKillEngine`, so `minimumKillsForReward` and `capPerPlayer` (`scrim.types.ts:38-43`) are never applied. Route the display calculation through `calculatePlayerReward`. | done |
| 4.2 | High | `ScrimResultsTable.tsx:364` | Rank prize and per-kill bounty are **stacked** with no cap, so a paid rank plus kills silently exceeds the configured pool. Keep stacking optional but clamp to the per-player cap and surface it. | done |
| 4.3 | Medium | `ScrimDetails.tsx:279,368,570` | `rewardPerKill || 10` fabricates an NPR 10/kill rate for a scrim that never set one. Show the configured rate or state that it is unset. | done |
| 4.4 | Medium | `ScrimResultsTable.tsx:58`, `TournamentDetails.tsx:215` | Both treat `requirements.entryFee` as the prize pool, producing a phantom "Top 3 places awarded … wallet credit" promise on fee-only practice scrims. Use the pool only. | done |
| 4.5 | Low | `ScrimResultsTable.tsx:323-340,371` | Prize rows are matched to registered teams by fuzzy lowercased team name, so an unmatched row still renders a prize. Flag unresolved rows in the UI instead of silently trusting them. | done |
| 4.6 | Low | `perKillEngine.ts:230` | `aggregateTeamRewards` seeds `teamName` from `playerName`, mislabelling the first entry of each team. Use a real team name when supplied. | done |

## FIX-05 — Housekeeping

| # | Severity | Location | Fix | Status |
|---|---|---|---|---|
| 5.1 | Medium | `tools/scrim-engines-audit.ts`, existing test suite | Baseline must stay green before and after. Run `npm run lint`, `npm test`, `npm run build`. | done |
| 5.2 | Low | `firestore.rules:158-180` | `isPowerOrganizer`/`isPowerOrg`/`orgTier` are self-writable on a user's own doc. Verified unused for any authorization decision (only read off `organizations` docs in `organizations.ts:143`, `organizationService.ts:105`, `OrganizationProfile.tsx:367`), so not a privilege path. Left alone under minimal-change; flagged for removal from the self-update allowlist. | **known limitation** |

---

## Settlement endpoint contract (FIX-03)

`POST /api/scrims/:id/results` — bearer token required, rate limited 10/min.

```jsonc
{
  "winners":     [{ "userId": "…", "rank": 1, "prize": 2000, "teamId": "…", "teamName": "…" }],
  "killEntries": [{ "playerId": "…", "kills": 7, "teamId": "…", "playerName": "…", "matchId": "…" }],
  "manualResults": [{ "rank": 1, "team": "…", "kills": 12 }]   // stored verbatim for the results table
}
```

Guards, in order: scrim-id shape → array shape → `validatePrizeWinners` → host/admin
ownership (`hostUid`/`orgId`/`hostId`/`userId`, mirroring `isScrimHost()`) → not already
settled → every recipient present in `participants` or a filled slot roster → budget.

Response: `{ success, amountPaid, payouts[], previouslyPaid[], unpaid[], budgetAvailable }`.
`402`-style over-allocation is not an error — unaffordable rows come back in `unpaid`,
`payoutStatus` becomes `"partial"`, and `resultsFinalized` stays false so the host can fund
the rest and re-call. The deterministic `transactions/{SCRIM-PAY-…}` doc is the idempotency
key, so a re-call only credits rows that were never paid.

New server-written fields on `scrims/{id}`: `resultsFinalized`, `resultsRecorded`,
`finalizedAt`, `finalizedBy`, `payoutStatus` (`paid|partial|unpaid`), `payoutsReleased`,
`winners`, `manualResults`, `killRewards`. New on `users/{uid}`: none (only `balance`
increments). New writes: `tournamentEarnings/{refId}`, `auditLogs/{auto}`, deterministic
`transactions/{refId}`, `tournament_funding/{id}.paidOutPrizes`.

Pure math lives in `server/scrimSettlement.ts` with `server/scrimSettlement.test.ts`
wired into `npm test`.


---

## Deliberately NOT changed

- No Cloud Functions added: the Express server is the existing authority; introducing a
  second runtime would be an architecture replacement.
- `/api/wallet/join-tournament` left as-is. It already carries the stricter checks, and
  merging the two join endpoints is a larger refactor than these findings require.
- No UI for result submission added: the organizer panel lives outside this repo
  (`AI/COMPONENT_MAP.md:45-46` references `ResultUploader.tsx`, which does not exist here).
  The new endpoint is the authoritative door that panel will call.
- Rate limiting infrastructure, `users_public` field allowlist, and the admin bypass at
  `firestore.rules:9-11` (custom-claim based, role self-escalation already blocked).

### Deferred diff for 3.6 (not applied — confirm the organizer tool first)

Once `POST /api/scrims/:id/results` is the only writer of results, the organizer client
should no longer be able to write the settlement-bearing fields directly:

```diff
     match /scrims/{scrimId} {
-      allow update: if isAdmin() || ((isOrganizer() && (existing().hostUid == request.auth.uid || existing().orgId == request.auth.uid))
-        && !hasCredentialFields(incoming()));
+      allow update: if isAdmin() || ((isOrganizer() && (existing().hostUid == request.auth.uid || existing().orgId == request.auth.uid))
+        && !hasCredentialFields(incoming())
+        && !incoming().diff(existing()).affectedKeys().hasAny(
+             ['winners', 'manualResults', 'killRewards', 'results', 'podium',
+              'payoutStatus', 'resultsFinalized', 'payoutsReleased',
+              'prizePool', 'prizeDistribution']));
     }
```

Until that lands, a host can still publish those fields from the client; the money stays
safe because only the Admin SDK path credits wallets.
