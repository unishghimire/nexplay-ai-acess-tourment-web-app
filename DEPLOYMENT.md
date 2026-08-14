# NexPlay Deployment Guide

This guide is intentionally conservative. Follow [docs/RELEASE-READINESS.md](docs/RELEASE-READINESS.md) before any production push or deployment.

## Required server environment

- `FIREBASE_SERVICE_ACCOUNT` or the hosting platform's Application Default Credentials
- `GEMINI_API_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `IMGBB_API_KEY` when ImgBB is enabled
- `DISCORD_WEBHOOK_TOURNAMENTS`, `DISCORD_WEBHOOK_SCRIMS` when announcements are enabled

`VITE_RECAPTCHA_SITE_KEY` is a public client variable. All other values above are server-only and must never use the `VITE_` prefix. Firebase's web configuration is public client configuration; it is not a server credential.

## Pre-deployment gate

```powershell
pnpm install --frozen-lockfile
pnpm run lint
pnpm run type-check
pnpm test
pnpm run build
pnpm audit --prod --json
```

All commands must pass. Current Firebase deploy scripts require a separately installed, pinned Firebase CLI; do not assume a global CLI version is present.

## Credential migration and Firestore rules

The hardened rule set rejects public `roomId` and `roomPass` tournament fields. Deploy in this order during a maintenance window:

1. Deploy the server code containing the credential migration endpoint.
2. As an authenticated administrator, run the migration until no legacy fields remain.
3. Inspect a sample of migrated documents in the target Firebase project.
4. Deploy the frontend that writes protected credential documents.
5. Deploy Firestore rules and indexes.
6. Run role-based rule tests and authenticated smoke tests in the target environment.

Never deploy the new rules before verifying the migration; legacy documents may then reject ordinary organizer updates.

## Vercel verification

Before production, deploy a preview and confirm:

- `/api/*` is handled by `api/index.ts`;
- `/sitemap.xml` responds correctly;
- Firebase ID-token verification works;
- `POST /api/indexnow` rejects anonymous/non-admin callers;
- authenticated media, wallet, credential migration, and admin flows work;
- homepage/mobile navigation have no console or network errors.

The in-memory limiter is per instance. Apply shared/edge rate limiting before a horizontally scaled production rollout.
