# NexPlay Audit Report

**Audit date:** 2026-08-14
**Scope:** repository source/configuration, production dependency graph, local build/runtime, Firestore rules review, and public responsive smoke checks.

## Release decision

**Do not deploy or push this release yet.** All local code gates pass and no production dependency advisories remain. Deployment is blocked on the documented Firebase migration, Firestore rule/emulator verification, authenticated integration testing, and Vercel environment verification. See [RELEASE-READINESS.md](RELEASE-READINESS.md).

## Evidence

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm run lint` and `pnpm run type-check` | Passed (`tsc --noEmit`) |
| `pnpm test` | Passed: 10 suites, including 12 SSRF and 5 batch-write cases |
| `pnpm run build` | Passed: 2,271 modules transformed |
| `pnpm audit --prod --json` | Passed: 0 critical/high/moderate/low advisories |
| Browser smoke check | Passed: home render, mobile nav semantics, no console errors, no overflow at 320/375/768/1440/1920px |
| Firestore emulator/rule test | Not run: Firebase CLI/emulator and non-production Firebase credentials are not configured |
| Authenticated API/E2E test | Not run: no safe test identities or integration harness are present |
| Vercel preview/production test | Not run: deployment account/environment access was not provided |

## Remediated issues

| ID | Severity | Files | Problem and remediation |
|---|---|---|---|
| AUD-001 | Critical — fixed | `server/routes/admin-scrims.ts`, `server/authz.ts` | Mutation-capable admin scrim routes had no access control. Firebase-token authentication, admin authorization, rate limits, and authorization tests were added. |
| AUD-002 | Critical — fixed | `server/routes/wallet.ts`, `server/prizeValidation.ts` | Prize settlement could write before all transaction reads and accepted malformed/duplicate winners. Input validation and read-before-write transaction ordering now prevent invalid or duplicate credits. |
| AUD-003 | Critical — fixed | `server/routes/media.ts`, `src/shared/services/mediaService.ts`, `firestore.rules` | A caller could forge a media catalogue record and influence provider deletion. Media catalogue creation/deletion is now server-owned and deletion uses the stored provider metadata only. |
| AUD-004 | High — fixed | `server/routes/ai.ts`, `server/safeUrlFetch.ts` | AI page auditing could fetch private or metadata addresses. The fetcher validates protocol, DNS results and redirects, rejects private/reserved IPv4/IPv6 ranges, pins the validated address, and caps time/response bytes. |
| AUD-005 | High — fixed | `server/routes/auth.ts`, `server/shared.ts`, `server/authPolicy.ts` | Incomplete legacy JWT authentication conflicted with Firebase Auth. Legacy registration/login/reset APIs now return `410`; server authorization accepts verified Firebase ID tokens only. |
| AUD-006 | High — fixed | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Production audit found nine advisories. Compatible direct updates and narrowly scoped transitive overrides yield a clean production audit. Unused JWT/bcrypt packages were removed. |
| AUD-007 | High — fixed | `api/index.ts`, `server.ts`, `server/seo.ts` | IndexNow was protected in the local server but not the Vercel entry point. Both entry points now require an authenticated administrator and validate canonical NexPlay URLs. |
| AUD-008 | High — fixed in code; migration pending | `firestore.rules`, `server/routes/wallet.ts`, credential UI files | Room IDs/passwords were stored on publicly readable tournament documents. New writes use protected credential documents and rules reject public credential fields. Existing production records must still be migrated before the rules are deployed. |
| AUD-009 | Medium — fixed | `server/batchedWrites.ts`, `src/shared/utils/firestoreBatches.ts`, wallet/tournament/team/admin flows | Bulk writes could exceed Firestore's 500-operation limit. Server and relevant client bulk operations are chunked at 450 writes; parent deletion remains last for retry safety. |
| AUD-010 | Medium — fixed | `firestore.rules`, team/profile/admin files | Public-profile rules rejected fields the UI legitimately writes and blocked team-owner cleanup. The rules now explicitly allow intended public fields while locking UID, role, and earnings; team owners can only clear a member's team fields. |
| AUD-011 | Medium — fixed | `src/features/auth/views/Register.tsx`, `firestore.rules` | Password users were treated as verified without email confirmation. Registration sends an email-verification request; protected actions now require `email_verified` (or Google sign-in). |
| AUD-012 | Medium — fixed | `server/shared.ts`, `server/routes/ai.ts` | The limiter combined unrelated endpoints under one IP key and could grow without bound; AI prompt inputs/errors were insufficiently bounded. Limits are endpoint-specific, capped/pruned, return `Retry-After`, and AI inputs/contexts are bounded with generic client errors. |

## Open issues

| ID | Severity | Files | Root cause, risk, and required action |
|---|---|---|---|
| AUD-013 | High — release blocker | `firestore.rules`, `server/routes/wallet.ts` | Existing production tournament documents may still contain public `roomId`/`roomPass`. Deploy the new server, run the authenticated migration in a maintenance window, verify the purge, then deploy the rule change. Without this, new rules can block legacy organizer updates and old credentials remain exposed. |
| AUD-014 | High — release blocker | `firestore.rules`, Firebase configuration | Rules syntax/authorization have not been exercised against a Firebase Emulator or staging project. Run explicit anonymous/player/organizer/admin allow/deny tests before deploying rules. |
| AUD-015 | High — release blocker | `api/index.ts`, Vercel project settings | The repository has Vercel routing but no access to its environment/preview deployment. Confirm required server secrets, Firebase Admin credentials, API routing, and `/api/*` behavior in a preview before production. |
| AUD-016 | Medium | `server/routes/tournaments.ts`, `ResultUploader.tsx`, `useTournamentAdmin.ts` | The active UI stores groups/matches in the tournament document, while several server group/result endpoints use the legacy subcollection model. This creates two lifecycle paths and leaves organizer result updates outside the newer server transaction path. Consolidate after a schema migration; add integration tests first. |
| AUD-017 | Medium | `server/shared.ts` | Rate limiting is process-local. It constrains a single instance but not distributed Vercel traffic. Move abusive/public endpoints to a shared edge/KV limiter before material scale. |
| AUD-018 | Medium | catalogue/admin views | Several Firestore collection reads are unpaginated. Add cursor pagination and indexed queries for large tournaments, teams, news, organizations, and admin lists. |
| AUD-019 | Medium | test infrastructure | There is no Firestore Emulator, HTTP integration, or E2E harness. Add authenticated player/organizer/admin tests for money, rules, media, migrations, and result lifecycle. |
| AUD-020 | Low | `package.json`, deployment scripts | Firebase deploy scripts invoke a CLI that is not installed as a project dependency. Use a pinned `firebase-tools` dev dependency or an explicitly versioned CI tool before relying on those scripts. |

## Scope limitations

No secrets were printed or changed. The current working tree was scanned for credential patterns; the Firebase web configuration is public client configuration, not a secret. Production Firebase, Vercel, Cloudinary, Gemini, Discord, and payment-provider state was not available for inspection. Generated `dist`, `node_modules`, and binary assets were excluded from source review.
