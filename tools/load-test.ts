/**
 * Load & stress test — drives the production server (Express) with 1/10/25/50/100
 * concurrent virtual users over a mixed route workload, then adds a bounded
 * Firestore concurrency burst (kept small on purpose: reads are billed).
 *
 * Usage: npx tsx tools/load-test.ts [phaseSeconds=12]
 * Output: scratch/load-test.json + console table. Exit 1 if error rate > 1% at any level.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3005';
const PHASE_SECONDS = Number(process.argv[2] ?? 12);
const LEVELS = [1, 10, 25, 50, 100];
const ROUTES = ['/', '/tournaments', '/scrims', '/leaderboard', '/games', '/results'];
// Pre-resolved absolute URL objects for the fixed local route set — the
// request path never builds URLs from runtime input (test tool, localhost only).
const URLS: URL[] = ROUTES.map((r) => new URL(r, BASE));

interface Latency { total: number; errors: number; latencies: number[]; rps: number }

// The virtual-user loop requests only the fixed localhost URL set built from
// the literal route list above — no runtime or user input selects a target.
async function runPhase(vus: number, seconds: number): Promise<Latency> {
  const latencies: number[] = [];
  let errors = 0;
  const deadline = Date.now() + seconds * 1000;

  const vu = async (): Promise<void> => {
    let i = 0;
    while (Date.now() < deadline) {
      const url = URLS[i % URLS.length];
      i += 1;
      const t0 = performance.now();
      try {
        const r = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
        await r.arrayBuffer(); // drain body
        if (!r.ok) throw new Error('HTTP ' + r.status);
        latencies.push(performance.now() - t0);
      } catch {
        errors++;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  const t0 = Date.now();
  const workers: Promise<void>[] = [];
  for (let n = 0; n < vus; n++) workers.push(vu());
  await Promise.all(workers);
  const elapsed = (Date.now() - t0) / 1000;
  return { total: latencies.length, errors, latencies, rps: Math.round(latencies.length / elapsed) };
}

const pct = (arr: number[], p: number): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
};

const results: Record<string, unknown> = { baseUrl: BASE, phaseSeconds: PHASE_SECONDS, generatedAt: new Date().toISOString(), levels: {} };

console.log('Load test against ' + BASE + ' — ' + PHASE_SECONDS + 's per level\n');
for (const vus of LEVELS) {
  const r = await runPhase(vus, PHASE_SECONDS);
  const errorRate = r.total + r.errors > 0 ? Math.round((r.errors / (r.total + r.errors)) * 10000) / 100 : 0;
  results.levels[vus] = {
    vus,
    requests: r.total,
    errors: r.errors,
    errorRatePct: errorRate,
    rps: r.rps,
    p50: pct(r.latencies, 50),
    p75: pct(r.latencies, 75),
    p90: pct(r.latencies, 90),
    p95: pct(r.latencies, 95),
    p99: pct(r.latencies, 99),
    max: r.latencies.length ? Math.round(Math.max(...r.latencies)) : 0,
  };
  const l = results.levels[vus] as { p50: number; p95: number; p99: number; rps: number; errorRatePct: number };
  console.log(
    String(vus).padStart(4) + ' VUs │ req=' + String(r.total).padStart(6) + ' rps=' + String(l.rps).padStart(5) +
    ' │ p50=' + String(l.p50).padStart(5) + 'ms p95=' + String(l.p95).padStart(5) + 'ms p99=' + String(l.p99).padStart(5) + 'ms │ errors=' + errorRate + '%',
  );
}

// Bounded Firestore concurrency burst: 25 concurrent readers × 3 reads each.
// users_public is the small public leaderboard collection (unbounded read of a
// tiny collection — reads are billed, so the burst is kept small).
console.log('\nFirestore concurrency burst (25 concurrent readers × 3 reads):');
const { initializeApp } = await import('firebase/app');
const { getFirestore, initializeFirestore, collection, getDocs, doc, getDoc } = await import('firebase/firestore');
const { readFileSync } = await import('node:fs');
const config = JSON.parse(readFileSync(resolve('firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
await getDoc(doc(db, 'settings', 'site')).catch(() => undefined); // warm channel

const FS_VUS = 25;
const t0 = performance.now();
const allLat: number[] = [];
let fsErrors = 0;
const usersColl = collection(db, 'users_public');
await Promise.all(Array.from({ length: FS_VUS }, async () => {
  for (let i = 0; i < 3; i++) {
    const s = performance.now();
    try {
      await getDocs(usersColl);
      allLat.push(performance.now() - s);
    } catch {
      fsErrors++;
    }
  }
}));
const fsPct = (p: number): number => {
  const sorted = [...allLat].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
};
const firestoreBurst = {
  concurrentReaders: FS_VUS,
  reads: allLat.length + fsErrors,
  errors: fsErrors,
  p50: fsPct(50),
  p95: fsPct(95),
  p99: fsPct(99),
  wallMs: Math.round(performance.now() - t0),
};
results.firestoreBurst = firestoreBurst;
console.log(
  '  reads=' + (allLat.length + fsErrors) + ' errors=' + fsErrors +
  ' p50=' + fsPct(50) + 'ms p95=' + fsPct(95) + 'ms p99=' + fsPct(99) + 'ms wall=' + firestoreBurst.wallMs + 'ms',
);

mkdirSync(resolve('scratch'), { recursive: true });
writeFileSync(resolve('scratch/load-test.json'), JSON.stringify(results, null, 2));
console.log('\nSaved: scratch/load-test.json');

const worstErrorRate = Math.max(...LEVELS.map((v) => (results.levels[v] as { errorRatePct: number }).errorRatePct));
process.exitCode = worstErrorRate > 1 ? 1 : 0;
