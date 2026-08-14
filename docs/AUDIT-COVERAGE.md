# NexPlay Audit Coverage

## Reviewed areas

| Area | Coverage |
|---|---|
| Server/API | All route modules, shared middleware, auth, wallet, media, AI, Discord, SEO, batching, and Vercel API entry point. |
| Client | Auth, admin, organizer, dashboard, tournament credentials/results, team/profile, media, and responsive application shell paths touched by the audit. |
| Data/security | Firestore rules, indexes, Firebase/Vercel configuration, environment example, access-control paths, financial transactions, private credentials, and media ownership. |
| Build/release | `package.json`, lockfile, workspace overrides, Vite/Vercel/Firebase config, dependency audit, frozen install, build/type checks, tests, and local browser smoke checks. |
| Documentation | PRD, design/stack docs, prior audit, deployment guide, changelog, and new operational reports. |

## Explicit exclusions

- Generated `dist` output and installed dependencies were not reviewed as authored source.
- Binary/static visual assets were not line-reviewed.
- Production service configuration/data and git-history content unavailable within the repository were not treated as verified.

This is a static/source audit supplemented by local execution. It is not a substitute for an authenticated test against a non-production Firebase/Vercel environment.
