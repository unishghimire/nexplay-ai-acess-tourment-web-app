# NexPlay Security Audit

## Controls verified in source

- Server routes verify Firebase ID tokens; legacy JWT fallback was removed.
- Admin-only server operations use a reusable role middleware and endpoint rate limits.
- Prize/refund flows use Firestore transactions, deterministic ledger identifiers, input validation, and idempotency checks.
- Room credentials move to a protected subcollection; public tournament documents are blocked from accepting credential fields.
- Media deletion is authorized from server-created catalogue records, not caller-provided provider IDs.
- AI remote fetches reject internal/reserved addresses, validate redirects, pin validated DNS addresses, and cap response size/time.
- IndexNow validates canonical NexPlay URLs and requires administrator authorization in both local and Vercel API entry points.
- Password users require Firebase email verification for verification-gated Firestore actions; registration requests verification.
- Production dependencies have a clean `pnpm audit` result.

## Residual risk / required verification

1. **Credential migration:** source changes cannot remove legacy credentials from an existing production Firestore database. Run and verify the migration before rule deployment.
2. **Rules test:** Firestore rules are a security boundary. Verify actual allow/deny behavior in an Emulator or staging project.
3. **Rate limiting:** current rate limits are in-memory and not global across serverless instances.
4. **Result lifecycle:** active document-array result flow differs from legacy server subcollection routes; consolidate before relying on server-side result integrity guarantees.
5. **Secrets and deployment:** confirm all server-only variables are configured in Vercel and never prefixed with `VITE_`.

## Secret handling

The Firebase client configuration is expected to be public. No private key, service-account JSON, `.env` value, webhook URL, or provider key was printed or committed by this audit. Server secrets must be provided through the hosting environment only.
