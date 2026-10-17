import assert from "node:assert/strict";
import { LEGACY_AUTH_DEPRECATION, isFirebaseUid, isUserRole, resolveRoleFromToken } from "./authPolicy.js";

assert.equal(LEGACY_AUTH_DEPRECATION.code, 'FIREBASE_AUTH_REQUIRED');
assert.equal(LEGACY_AUTH_DEPRECATION.success, false);
assert.equal(isUserRole('admin'), true);
assert.equal(isUserRole('owner'), false);
assert.equal(isFirebaseUid('firebase-user-id'), true);
assert.equal(isFirebaseUid(''), false);
assert.equal(isFirebaseUid('x'.repeat(129)), false);

// R-03: role resolution — claims win; the super-admin mailbox fallback requires
// a verified email claim so an unowned mailbox sign-up cannot self-grant admin.
assert.equal(resolveRoleFromToken({ role: 'admin' }), 'admin');
assert.equal(resolveRoleFromToken({ role: 'organizer' }), 'organizer');
assert.equal(resolveRoleFromToken({ email: 'admin@nexplay.gg', email_verified: false }), 'player');
assert.equal(resolveRoleFromToken({ email: 'admin@nexplay.gg' }), 'player');
assert.equal(resolveRoleFromToken({ email: 'nexplayorg@gmail.com', email_verified: true }), 'admin');
assert.equal(resolveRoleFromToken({ email: 'someone@example.com', email_verified: true }), 'player');
assert.equal(resolveRoleFromToken({}), 'player');

console.log('Authentication policy tests: 14 passed, 0 failed');
