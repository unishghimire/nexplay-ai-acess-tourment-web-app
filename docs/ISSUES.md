# NexPlay Open Issues

This is the live, action-oriented view of unresolved audit findings. IDs map to [AUDIT-REPORT.md](AUDIT-REPORT.md).

| Priority | ID | Owner | Exit criteria |
|---|---|---|---|
| P0 | AUD-013 | Release engineer + Firebase admin | All legacy tournament credential fields are migrated to protected documents, checked in Firebase, and no public tournament record contains room credentials. |
| P0 | AUD-014 | QA + Firebase admin | Emulator or staging tests prove the intended anonymous/player/organizer/admin allow/deny matrix against the deployed rules. |
| P0 | AUD-015 | Release engineer | Vercel preview has every required server variable, `/api/*` works, and authenticated smoke checks pass. |
| P1 | AUD-016 | Product/engineering | Decide on a single group/result storage model, migrate deliberately, and move active result submissions to the authoritative transactional path. |
| P1 | AUD-017 | Platform | Add a shared rate-limit backend or edge policy for production abuse controls. |
| P1 | AUD-018 | Product/engineering | Cursor-paginate high-growth catalogues and admin lists; deploy required Firestore indexes. |
| P1 | AUD-019 | QA | Add Firebase Emulator/HTTP/E2E coverage for roles, money, media, credentials, migration, and results. |
| P2 | AUD-020 | DevOps | Pin and provide `firebase-tools` in CI or package dev dependencies; make deploy scripts reproducible. |

Do not close an issue based only on a code review. Record the executed command, target environment, and result in [TEST-REPORT.md](TEST-REPORT.md).
