# NexPlay Release Readiness

**Status: BLOCKED — do not push/deploy.**

## Local gate

- [x] Release branch created: `release/production-hardening`
- [x] Frozen dependency installation passes
- [x] Type/lint checks pass
- [x] Test suite passes
- [x] Production build passes
- [x] Production dependency audit reports zero vulnerabilities
- [x] Public responsive smoke check passes
- [ ] Firestore rules tested in Emulator/staging
- [ ] Credential migration run and verified in target Firebase project
- [ ] Authenticated player/organizer/admin integration checks pass
- [ ] Vercel preview API/environment smoke check passes
- [ ] Explicit release approval for push/deployment

## Required deployment order

1. Configure a non-production Firebase project and Vercel preview with server-only variables: Firebase Admin credentials, Gemini, Cloudinary, ImgBB, and optional Discord webhooks. Do not expose any of them as `VITE_*` values.
2. Verify the Vercel serverless API entry point can authenticate Firebase ID tokens and serve `/api/*` routes.
3. Enable maintenance mode or pause organizer writes in the target environment.
4. Deploy the server code that contains `POST /api/wallet/migrate-room-creds`.
5. As an authenticated administrator, run the room-credential migration until it reports no remaining legacy fields. Inspect sampled tournament documents and credential documents in Firebase.
6. Deploy the new frontend so new writes use credential subdocuments.
7. Deploy Firestore rules and indexes only after migration success. The new rules intentionally reject public `roomId`/`roomPass` fields.
8. Run anonymous/player/organizer/admin rule tests plus authenticated wallet, media, results, and admin API smoke tests.
9. Deploy the Vercel production target, then repeat homepage, navigation, form, API, mobile, console, and network checks.

## Required environment verification

| Concern | Verify |
|---|---|
| Firebase Admin | Server can verify ID tokens and access the intended project without local credential files. |
| Gemini/media/Discord | Required values exist only in server environment; optional integrations fail safely if unset. |
| Firebase Auth | Password verification email uses an approved auth domain and email template. |
| Firestore | Rules and indexes deploy to the intended database, not a default/incorrect project. |
| Vercel rewrites | `/api/*` and `/sitemap.xml` reach `api/index.ts`; SPA routes reach `index.html`. |
| Rate limiting | Protect the public target with a shared/edge rate limit if multiple instances are expected. |

## Push/commit

No commit, push, or deployment was performed because the unchecked items above are material release gates. Once they are satisfied, commit only the reviewed files with a conventional message and then open a reviewable pull request.
