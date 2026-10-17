import { resolveEntryFee } from './entryFee';

function assert(cond: boolean, msg: string): void {
    if (!cond) {
        console.error(`FAIL: ${msg}`);
        process.exit(1);
    }
}

assert(resolveEntryFee({ entryFee: 500 }) === 500, 'root entryFee is used');
assert(resolveEntryFee({ requirements: { entryFee: 250 } }) === 250, 'requirements.entryFee is the fallback');
assert(resolveEntryFee({ fee: 100 }) === 100, 'legacy fee is the last fallback');
assert(resolveEntryFee({ entryFee: 0, requirements: { entryFee: 250 } }) === 0, 'explicit zero root fee means free (mirrors server ?? chain)');
assert(resolveEntryFee({ entryFee: 500, requirements: { entryFee: 250 } }) === 500, 'root fee wins over requirements');
assert(resolveEntryFee({}) === 0, 'missing fees resolve to free');
assert(resolveEntryFee(null) === 0, 'null event resolves to free');
assert(resolveEntryFee({ entryFee: 'abc' }) === 0, 'non-numeric fee resolves to free');
assert(resolveEntryFee({ entryFee: -50 }) === 0, 'negative fee resolves to free');
assert(resolveEntryFee({ entryFee: 99.4 }) === 99, 'fees are integer-rounded');

console.log('Entry fee resolution tests: 10 passed, 0 failed');
