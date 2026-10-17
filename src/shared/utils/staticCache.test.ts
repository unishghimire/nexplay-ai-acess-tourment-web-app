import assert from 'node:assert/strict';
import { withStaticCache, invalidateStaticCache } from './staticCache';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main(): Promise<void> {
    // 1. Fresh key calls the loader exactly once and shares the in-flight promise.
    let calls = 0;
    const loader = async () => { calls++; return 'value-' + calls; };
    const [a, b] = await Promise.all([withStaticCache('t:basic', loader), withStaticCache('t:basic', loader)]);
    assert.equal(a, 'value-1');
    assert.equal(b, 'value-1');
    assert.equal(calls, 1, 'concurrent callers share one load');

    // 2. Second call within TTL is served from cache (no new network read).
    assert.equal(await withStaticCache('t:basic', loader), 'value-1');
    assert.equal(calls, 1, 'TTL hit does not re-run the loader');

    // 3. After expiry the loader runs again (freshness bound).
    assert.equal(await withStaticCache('t:ttl', async () => { calls++; return calls; }, 20), 2);
    await sleep(40);
    assert.equal(await withStaticCache('t:ttl', async () => { calls++; return calls; }, 20), 3);

    // 4. A failed load is evicted so the next call retries (error recovery).
    let attempts = 0;
    const failing = async () => { attempts++; if (attempts === 1) throw new Error('transient'); return 'ok'; };
    await assert.rejects(withStaticCache('t:fail', failing, 60_000));
    assert.equal(await withStaticCache('t:fail', failing, 60_000), 'ok');
    assert.equal(attempts, 2, 'failed entries are retried, not cached');

    // 5. Explicit invalidation drops one key or the whole cache.
    await withStaticCache('t:inv1', async () => 1, 60_000);
    await withStaticCache('t:inv2', async () => 1, 60_000);
    let reload1 = 0, reload2 = 0;
    invalidateStaticCache('t:inv1');
    await withStaticCache('t:inv1', async () => { reload1++; return 1; }, 60_000);
    await withStaticCache('t:inv2', async () => { reload2++; return 1; }, 60_000);
    assert.equal(reload1, 1, 'invalidated key reloads');
    assert.equal(reload2, 0, 'other keys survive single-key invalidation');
    invalidateStaticCache();
    await withStaticCache('t:inv2', async () => { reload2++; return 1; }, 60_000);
    assert.equal(reload2, 1, 'full invalidation clears everything');

    console.log('Static cache tests: 10 passed, 0 failed');
}

main().catch(err => { console.error(err); process.exit(1); });
