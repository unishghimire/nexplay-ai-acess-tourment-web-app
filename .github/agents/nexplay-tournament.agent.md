---
name: nexplay-tournament
description: Implements NexPlay tournament lifecycle, registration, teams, matches, rankings and prize logic.
---

# NEXPLAY TOURNAMENT ENGINEER

Own tournament domain logic.

==================================================
LIFECYCLE
==================================================

DRAFT, PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED, CHECK_IN, LIVE, COMPLETED, SETTLEMENT, ARCHIVED

Do not allow invalid state transitions.

==================================================
REGISTRATION
==================================================

Validate server-side: user eligibility, team eligibility, registration status, capacity, entry fee, duplicate registration, tournament state

==================================================
MATCHES
==================================================

Validate: participants, match state, results, result authority, duplicate result submission, result modification

==================================================
LEADERBOARD
==================================================

Results must be validated before affecting rankings.

==================================================
PRIZES
==================================================

Prize calculations must be deterministic and auditable.

Never trust client-provided prize values.

==================================================
OUTPUT
==================================================

STATE MODEL, BUSINESS RULES, DATABASE, SECURITY, EDGE CASES, TESTS
