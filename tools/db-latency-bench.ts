/**
 * Firestore latency benchmark — measures the app's real hot-path queries.
 * Establishes the response-time baseline (docs/PERFORMANCE-REPORT.md) and is
 * re-run after optimizations for BEFORE → AFTER comparison.
 *
 * Usage: npx tsx tools/db-latency-bench.ts [samples=20]
 * Output: scratch/db-latency.json + console percentiles. Exit 0 always (report tool).
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SAMPLES = Number(process.argv[2] ?? 20);
const config = JSON.parse(readFileSync(resolve('firebase-applet-config.json'), 'utf8'));

const app = initializeApp(config);
// Node runtime: force long-polling auto-detect (grpc channels can hang behind proxies).
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

interface Sample { name: string; docs: number; ms: number }
const samples: Sample[] = [];

async function bench(name: string, docs: number, fn: () => Promise<unknown>, runs = SAMPLES): Promise<void> {
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    samples.push({ name, docs, ms: Math.round(performance.now() - t0) });
    await new Promise((r) => setTimeout(r, 60));
  }
}

const d = collection(db, 'tournaments');
const up = collection(db, 'users_public');
const g = collection(db, 'games');

console.log(`Firestore latency benchmark — ${SAMPLES} samples per query, project ${config.projectId}\n`);
console.log('warming up channels...');
await getDoc(doc(db, 'settings', 'site')); // cold-start excluded from percentiles below

await bench('settings_doc (app gate getDoc)', 1, () => getDoc(doc(db, 'settings', 'site')));
await bench('tournaments_list (limit 20)', 20, () => getDocs(query(d, limit(20))));
await bench('tournaments_featured (isFeatured==true limit 10)', 10, () => getDocs(query(d, where('isFeatured', '==', true), limit(10))));
await bench('tournaments_results (status==completed orderBy startTime desc limit 4)', 4, () => getDocs(query(d, where('status', '==', 'completed'), orderBy('startTime', 'desc'), limit(4))));
await bench('users_public_leaderboard (limit 100)', 100, () => getDocs(query(up, limit(100))));
await bench('users_public_count (aggregate)', 0, () => getCountFromServer(query(up)));
await bench('games_published (isPublished==true limit 8)', 8, () => getDocs(query(g, where('isPublished', '==', true), limit(8))));
await bench('games_published_UNBOUNDED (scrims/tournaments pattern)', 0, () => getDocs(query(g, where('isPublished', '==', true))));

const byName = new Map<string, number[]>();
for (const s of samples) {
  const arr = byName.get(s.name) ?? [];
  arr.push(s.ms);
  byName.set(s.name, arr);
}

const pct = (arr: number[], p: number): number => {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
};

interface Report { query: string; samples: number; avg: number; p50: number; p75: number; p90: number; p95: number; p99: number; max: number }
const report: Report[] = [];
for (const [name, arr] of byName) {
  report.push({
    query: name,
    samples: arr.length,
    avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    p50: pct(arr, 50),
    p75: pct(arr, 75),
    p90: pct(arr, 90),
    p95: pct(arr, 95),
    p99: pct(arr, 99),
    max: Math.max(...arr),
  });
}
report.sort((a, b) => a.p50 - b.p50);

console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('QUERY'.padEnd(58) + 'AVG'.padStart(6) + 'P50'.padStart(6) + 'P75'.padStart(6) + 'P90'.padStart(6) + 'P95'.padStart(6) + 'P99'.padStart(6));
console.log('──────────────────────────────────────────────────────────────────────');
for (const r of report) {
  console.log(r.query.slice(0, 58).padEnd(58) + String(r.avg).padStart(6) + String(r.p50).padStart(6) + String(r.p75).padStart(6) + String(r.p90).padStart(6) + String(r.p95).padStart(6) + String(r.p99).padStart(6));
}

const overall = samples.map((s) => s.ms);
const overallAvg = Math.round(overall.reduce((a, b) => a + b, 0) / overall.length);
console.log('──────────────────────────────────────────────────────────────────────');
console.log(`OVERALL (all reads): avg=${overallAvg}ms p50=${pct(overall, 50)}ms p95=${pct(overall, 95)}ms p99=${pct(overall, 99)}ms max=${Math.max(...overall)}ms`);

mkdirSync(resolve('scratch'), { recursive: true });
writeFileSync(resolve('scratch/db-latency.json'), JSON.stringify({ generatedAt: new Date().toISOString(), samples: SAMPLES, overall: { avg: overallAvg, p50: pct(overall, 50), p95: pct(overall, 95), p99: pct(overall, 99), max: Math.max(...overall) }, queries: report }, null, 2));
console.log('\nSaved: scratch/db-latency.json');
