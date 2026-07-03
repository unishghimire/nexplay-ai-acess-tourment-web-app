# Security Specification - NexPlay

## 1. Data Invariants
- A `Participant` must have a valid `tournamentId` pointing to an existing tournament.
- A `LobbyGroup` must point to a valid `tournamentId`.
- Only a user with `role: 'organizer'` or `role: 'admin'` can create tournaments or scrims.
- `balance` and `totalEarnings` are immutable by the user and can only be updated via server-side admin logic or transactions.
- `status` transitions for tournaments must be sequential (upcoming -> live -> completed).

## 2. The Dirty Dozen Payloads
1. **Identity Spoofing**: Update `users/user1` with `uid: 'admin1'`.
2. **Privilege Escalation**: Update `users/user1` with `role: 'admin'`.
3. **Wallet Injection**: Update `users/user1` with `balance: 999999`.
4. **Foreign Write**: Create a `participant` for `userId: 'otherUser'`.
5. **Orphaned Group**: Create a `LobbyGroup` for a non-existent `tournamentId`.
6. **Shadow Update**: Update a tournament with an added field `isVerified: true`.
7. **Bypass Verification**: Update a user profile with `isBanned: false` when already banned.
8. **Junk ID Poisoning**: Create a tournament with ID `../../../etc/passwd`.
9. **Denial of Wallet**: Create a tournament with a 2MB `title` string.
10. **State Shortcut**: Update an `upcoming` tournament directly to `completed`.
11. **PII Leak**: Non-admin reading another user's `phone` or `email` in the `users` collection.
12. **Result Tampering**: A player uploading a result for a group they are not in.

## 3. Test Runner
(A `firestore.rules.test.ts` will be implemented to verify these locally if a test environment is available, but the focus here is on the rule logic itself).
