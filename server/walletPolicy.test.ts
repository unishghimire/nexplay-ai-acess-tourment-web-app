import assert from "node:assert/strict";
import { isDuplicateDeposit, resolveFrozenRefundFee } from "./walletPolicy.js";

// ── R-04 deposit duplicate guard ─────────────────────────────────────────────
assert.equal(isDuplicateDeposit(undefined), false, 'no existing doc is not a duplicate');
assert.equal(isDuplicateDeposit(null), false, 'null status is not a duplicate');
assert.equal(isDuplicateDeposit('pending'), true, 'pending doc blocks resubmit');
assert.equal(isDuplicateDeposit('approved'), true, 'approved doc blocks resubmit at any age');
assert.equal(isDuplicateDeposit('completed'), true, 'completed doc blocks resubmit');
assert.equal(isDuplicateDeposit('rejected'), false, 'rejected doc may be resubmitted');

// ── R-05 frozen refund fee ───────────────────────────────────────────────────
assert.equal(resolveFrozenRefundFee({ entryFeePaid: 100 }, { chargedFee: 5000 }), 100, 'participant entryFeePaid wins');
assert.equal(resolveFrozenRefundFee({ chargedFee: 250 }, null), 250, 'participant chargedFee is used when entryFeePaid absent');
assert.equal(resolveFrozenRefundFee({}, { chargedFee: 300 }), 300, 'slot chargedFee is the last frozen source');
assert.equal(resolveFrozenRefundFee(null, null), 0, 'nothing frozen refunds zero');
assert.equal(resolveFrozenRefundFee({ entryFeePaid: 'abc' }, { chargedFee: -5 }), 0, 'non-numeric and negative fees are ignored');
assert.equal(resolveFrozenRefundFee({ entryFeePaid: 99.4 }, null), 99, 'fees are integer-rounded');

console.log('Wallet policy tests: 12 passed, 0 failed');
