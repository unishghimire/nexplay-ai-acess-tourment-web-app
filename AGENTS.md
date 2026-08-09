# NEXPLAY AI ENGINEERING RULES

You are an AI coding agent working on NexPlay.

NexPlay is a production esports tournament platform.

Core systems include:

- User authentication
- Player profiles
- Organizations
- Tournament creation
- Tournament registration
- Teams
- Matches
- Scoreboards
- Leaderboards
- Payments
- Wallets
- Prize settlement
- Discord integration
- Admin dashboard
- Organization dashboard
- Broadcast/overlay systems
- Firebase/Firestore
- Cloud Functions
- Vercel deployment

==================================================
1. SOURCE OF TRUTH
==================================================

The repository is the source of truth.

Never assume that a feature exists.

Before changing code, inspect:

- repository structure
- package.json
- source files
- Firebase configuration
- Firestore rules
- Cloud Functions
- existing services
- existing types
- existing tests
- environment configuration

Classify findings as:

EXISTS
IMPLEMENTED
PARTIALLY IMPLEMENTED
BROKEN
MISSING
UNUSED
DEPRECATED

Never fabricate missing implementation.

==================================================
2. NO BLIND CODING
==================================================

Never immediately start writing code for a complex request.

First:

1. Understand the request.
2. Inspect the repository.
3. Identify affected systems.
4. Identify dependencies.
5. Identify security implications.
6. Identify database implications.
7. Identify tests required.
8. Produce an implementation plan.

For small safe changes, planning may be brief.

For high-risk changes, planning is mandatory.

==================================================
3. MINIMAL CHANGE PRINCIPLE
==================================================

Modify only what is necessary.

Do not:

- rewrite unrelated components
- rename unrelated files
- replace frameworks
- replace architecture
- remove working features
- change database structures unnecessarily
- add dependencies without justification

==================================================
4. NEVER FABRICATE
==================================================

Never invent:

- APIs
- endpoints
- Firebase collections
- Firestore fields
- environment variables
- payment responses
- webhook payloads
- Discord API behavior
- authentication claims
- database records
- test results

If something is unknown:

STOP and identify it.

==================================================
5. SECURITY
==================================================

Never trust client input for:

- user roles
- admin privileges
- payment status
- wallet balance
- tournament eligibility
- prize amount
- transaction status
- organization permissions

All sensitive operations require server-side authorization and validation.

Never weaken security rules to make functionality work.

Never expose:

- private keys
- service account credentials
- API secrets
- webhook secrets
- passwords
- tokens

==================================================
6. FINANCIAL SYSTEM
==================================================

Payment and wallet operations are HIGH-RISK.

Never allow the client to directly determine:

- wallet balance
- payment success
- prize amount
- transaction status
- withdrawal status

Financial operations must use:

- server-side verification
- idempotency
- immutable transaction records
- audit logs
- atomic operations where required
- reconciliation

Prevent:

- duplicate payments
- duplicate webhooks
- replay attacks
- double spending
- duplicate prize settlement

==================================================
7. DATABASE
==================================================

Before changing Firestore:

Check:

- schema
- security rules
- indexes
- query patterns
- concurrency
- document size
- read/write cost
- migration requirements

Avoid unbounded queries.

Avoid unnecessary real-time listeners.

Use pagination where appropriate.

==================================================
8. TYPESCRIPT
==================================================

Use strict TypeScript.

Avoid `any`.

Avoid unsafe casts.

Prefer:

- explicit types
- discriminated unions
- runtime validation
- typed service boundaries
- reusable domain types

==================================================
9. ERROR HANDLING
==================================================

Every production feature must consider:

- success
- loading
- empty
- validation error
- authorization failure
- network failure
- server failure
- database failure
- timeout
- retry behavior

Never silently swallow errors.

==================================================
10. TESTING
==================================================

Never claim tests passed unless they actually ran.

Relevant changes should run:

- type checking
- lint
- unit tests
- integration tests
- E2E tests where applicable
- production build

==================================================
11. PRODUCTION
==================================================

Do not deploy unreviewed changes.

Production changes require:

- successful CI
- code review
- security review for sensitive changes
- financial review for financial changes
- production build
- deployment verification
- smoke testing

==================================================
12. REPORTING
==================================================

At the end of every task report:

WHAT CHANGED

FILES CHANGED

DATABASE IMPACT

SECURITY IMPACT

TESTS RUN

TEST RESULTS

KNOWN LIMITATIONS

UNVERIFIED ITEMS

Never hide failures.

==================================================
13. CORE PRINCIPLE
==================================================

Evidence beats assumptions.

Existing code beats imagined architecture.

Verified behavior beats AI confidence.

A successful build does NOT prove the application works.
