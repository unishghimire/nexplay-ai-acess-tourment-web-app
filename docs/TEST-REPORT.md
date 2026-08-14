# NexPlay Test Report

**Run date:** 2026-08-14
**Branch:** `release/production-hardening`

## Passed local checks

| Command/check | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | Pass | Lockfile is reproducible. |
| `pnpm run lint` | Pass | Alias for `tsc --noEmit`; no ESLint configuration exists. |
| `pnpm run type-check` | Pass | TypeScript compilation completed without errors. |
| `pnpm test` | Pass | Tournament engine, scoring (45), per-kill (55), SEO, authz (5), prize validation (5), safe URL fetch (12), auth policy (7), batched writes (5), and IndexNow (5). |
| `pnpm run build` | Pass | Vite production build completed; 2,271 modules transformed. |
| `pnpm audit --prod --json` | Pass | Zero reported production vulnerabilities. |

## Browser smoke test

Local runtime (`http://127.0.0.1:3000`) was inspected without authentication.

| Scenario | Result |
|---|---|
| Home page render | Pass — primary heading rendered after initialization. |
| Responsive tournament catalogue | Pass — no document overflow at 320, 375, 768, 1440, and 1920px widths. |
| Mobile navigation | Pass — `Toggle menu` changed `aria-expanded` from `false` to `true`; tournament link became visible. |
| Browser console | Pass — no captured error-level logs. |

## Not executed

- Firestore Emulator rule tests: no emulator/tooling or safe Firebase test project configuration.
- Authenticated flows: no test player, organizer, or admin identities.
- Server HTTP tests against Firebase Admin/Firestore: no isolated credentials/emulator.
- Financial, media deletion, credential migration, and privileged API integration tests.
- Vercel preview and production smoke checks: no deployment access or approved target environment.

These omissions are release blockers, not passes. See [RELEASE-READINESS.md](RELEASE-READINESS.md).
