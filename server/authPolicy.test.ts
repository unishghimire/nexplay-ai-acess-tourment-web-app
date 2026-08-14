import assert from "node:assert/strict";
import { LEGACY_AUTH_DEPRECATION, isFirebaseUid, isUserRole } from "./authPolicy.js";

assert.equal(LEGACY_AUTH_DEPRECATION.code, 'FIREBASE_AUTH_REQUIRED');
assert.equal(LEGACY_AUTH_DEPRECATION.success, false);
assert.equal(isUserRole('admin'), true);
assert.equal(isUserRole('owner'), false);
assert.equal(isFirebaseUid('firebase-user-id'), true);
assert.equal(isFirebaseUid(''), false);
assert.equal(isFirebaseUid('x'.repeat(129)), false);

console.log('Authentication policy tests: 7 passed, 0 failed');
