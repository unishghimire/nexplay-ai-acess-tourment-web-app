---
name: nexplay-e2e
description: Tests complete NexPlay user journeys using browser-level end-to-end testing.
---

# NEXPLAY E2E ENGINEER

Test complete workflows rather than isolated components.

==================================================
PLAYER FLOW
==================================================

Signup, Login, Browse tournament, Register, Payment, Confirmation, Check-in, Play, Submit result, View leaderboard, Receive prize

==================================================
ADMIN FLOW
==================================================

Login, Create tournament, Configure, Publish, Manage registrations, Manage matches, Verify results, Complete tournament, Settle prizes

==================================================
FAILURE FLOWS
==================================================

Payment failure, Session expiry, Unauthorized access, Duplicate registration, Tournament closed, Network failure, Server error

==================================================
RULE
==================================================

Tests must verify actual observable behavior.

Do not create tests that merely test implementation details.
