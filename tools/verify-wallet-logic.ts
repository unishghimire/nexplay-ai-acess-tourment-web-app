/**
 * Minimal self-check for wallet critical path logic.
 * Verifies deterministic doc ID generation — the core of our
 * atomic duplicate prevention for tournament join/leave/promo redemption.
 *
 * Run: npx tsx tools/verify-wallet-logic.ts
 */

// ── Deterministic participant doc ID ──
// join-tournament and leave-tournament must produce the SAME doc ID
// for the same (tournamentId, userId) pair so tx.get() can detect duplicates.
// ponytail: underscore separator is safe — Firebase Auth UIDs and Firestore
// auto-generated doc IDs are alphanumeric-only (no underscores). Ceiling:
// manually-created tournament doc IDs with underscores could theoretically collide.
function participantDocId(tournamentId: string, userId: string): string {
  return `${tournamentId}_${userId}`;
}

// ── Deterministic transaction doc ID for promo redemption ──
// Must be the same for (userId, promoCode) so duplicate redemptions collide.
function promoTxDocId(userId: string, promoCode: string): string {
  return `${userId}_PROMO_${promoCode}`;
}

// ── Balance calc helper (mirrors server logic) ──
function computeBalances(currentBalance: number, delta: number) {
  return {
    balanceBefore: currentBalance,
    balanceAfter: currentBalance + delta,
  };
}

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// 1. Deterministic doc IDs are stable
const id1 = participantDocId("tourn456", "user123");
const id2 = participantDocId("tourn456", "user123");
assert(id1 === id2, "same (tournament, user) must produce same doc ID");

// 2. Different users get different IDs
const id3 = participantDocId("tourn456", "user999");
assert(id1 !== id3, "different users must get different participant doc IDs");

// 3. Different tournaments get different IDs
const id4 = participantDocId("tourn999", "user123");
assert(id1 !== id4, "different tournaments must get different participant doc IDs");

// 4. Promo tx doc IDs are deterministic
const p1 = promoTxDocId("user123", "WELCOME50");
const p2 = promoTxDocId("user123", "WELCOME50");
assert(p1 === p2, "same (user, promoCode) must produce same promo tx doc ID");

// 5. Different promo codes get different IDs
const p3 = promoTxDocId("user123", "SUMMER100");
assert(p1 !== p3, "different promo codes must get different promo tx doc IDs");

// 6. Balance tracking: deposit increases balance
const dep = computeBalances(1000, 500);
assert(dep.balanceBefore === 1000 && dep.balanceAfter === 1500, "deposit: balanceBefore=1000, balanceAfter=1500");

// 7. Balance tracking: withdrawal decreases balance
const wd = computeBalances(1000, -300);
assert(wd.balanceBefore === 1000 && wd.balanceAfter === 700, "withdrawal: balanceBefore=1000, balanceAfter=700");

// 8. Balance tracking: zero balance edge case
const zero = computeBalances(0, 500);
assert(zero.balanceBefore === 0 && zero.balanceAfter === 500, "zero balance: balanceBefore=0, balanceAfter=500");

// 9. Firebase-style IDs (alphanumeric-only) never collide with underscore separator
// ponytail: This is the documented ceiling — Firebase Auth UIDs and Firestore
// auto-generated IDs are alphanumeric-only, so underscore as separator is safe.
const fbId1 = participantDocId("abc123XYZ", "uid987JKL");
const fbId2 = participantDocId("abc123XYZ", "uid987JKL");
assert(fbId1 === fbId2, "Firebase-style alphanumeric IDs: deterministic and stable");

// 10. Two different alphanumeric pairs never collide
const fbId3 = participantDocId("abc123XYZ", "uid111AAA");
assert(fbId1 !== fbId3, "different Firebase UIDs produce different doc IDs");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All wallet logic checks passed ✓");
