# Changelog

All notable NexPlay changes are recorded here.

## Unreleased

### Security

- Restricted the admin scrim audit/fix APIs to authenticated administrators and rate-limited their use.
- Made server-created media catalogue records authoritative, preventing forged client media references from targeting unrelated storage objects for deletion.
- Bound media deletion to the authoritative catalogue record and its provider metadata.
- Rejected duplicate payout recipients/ranks and reordered settlement reads before writes so Firestore prize transactions can complete safely.
- Replaced legacy JWT fallback authentication with Firebase ID-token authorization and retired the unsupported legacy auth routes.
- Blocked SSRF in AI page auditing, protected IndexNow in both API entry points, moved new room credentials out of public tournament data, and require email verification for password-account gated actions.

### Quality

- Added reusable admin authorization and prize validation helpers with focused regression tests.
- Added `pnpm run type-check` and `pnpm test` scripts for the current framework-free validation suite.
- Chunked Firestore bulk operations, fixed public-profile/team rule mismatches, added release documentation, and patched production dependency advisories.
