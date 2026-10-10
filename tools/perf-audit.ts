/**
 * Page performance audit — the BEFORE/AFTER measurement instrument for
 * docs/PERFORMANCE-REPORT.md. Measures real browser metrics per route:
 *
 *   TTFB, FCP, LCP, CLS, long tasks, JS heap, request counts (total /
 *   Firestore / static), transfer bytes, and route-transition durations
 *   under two network profiles (no-throttle, Fast 3G).
 *
 * Usage:   npx tsx tools/perf-audit.ts [outFile=scratch/perf-baseline.json]
 * Requires: production server on :3005 (NODE_ENV=production tsx server.ts)
 */
import { chromium, type Browser, type Page, type CDPSession } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3005';
const OUT = resolve(process.argv[2] ?? 'scratch/perf-baseline.json');

const ROUTES = ['/', '/tournaments', '/scrims', '/leaderboard', '/results', '/games', '/news', '/organizations'];

const PROFILES = {
  'no-throttle': { latencyMs: 0, downKbps: -1, upKbps: -1 },
  'fast-3g': { latencyMs: 150, downKbps: 1638, upKbps: 750 },
  'slow-4g': { latencyMs: 20, downKbps: 4096, upKbps: 3072 },
  'regular-2g': { latencyMs: 300, downKbps: 250, upKbps: 50 },
} as const;

type ProfileName = keyof typeof PROFILES;

interface RouteMetrics {
  ttfbMs: number;
  fcpMs: number;
  lcpMs: number;
  cls: number;
  longTasks: number;
  longTaskMs: number;
  heapMB: number;
  requestsTotal: number;
  requestsFirestore: number;
  requestsStatic: number;
  transferKB: number;
  firestoreTransferKB: number;
}

const OBSERVER_INIT = `
window.__perf = { lcp: 0, cls: 0, longTasks: [], ttfb: 0, fcp: 0 };
try {
  new PerformanceObserver((l) => { const e = l.getEntries(); if (e.length) window.__perf.lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 50) window.__perf.longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: true });
} catch (e) {}
`;

async function measureRoute(page: Page, cdp: CDPSession, route: string, profile: ProfileName): Promise<RouteMetrics> {
  const p = PROFILES[profile];
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: p.latencyMs,
    downloadThroughput: p.downKbps < 0 ? -1 : p.downKbps * 125,
    uploadThroughput: p.upKbps < 0 ? -1 : p.upKbps * 125,
  });

  await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => undefined);
  await page.waitForTimeout(800);

  return page.evaluate(() => {
    const w = window as unknown as {
      __perf: { lcp: number; cls: number; longTasks: number[]; ttfb: number; fcp: number };
      chrome?: { loadTimes?: unknown };
    };
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByType('paint');
    const fcpEntry = paint.find((e) => e.name === 'first-contentful-paint');
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const isFirestore = (u: string) => u.includes('firestore.googleapis.com') || u.includes('firebaseio.com');
    const isStatic = (u: string) => u.includes('/assets/') || u.includes('.css') || u.includes('.js');
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const kib = (n: number) => Math.round(n / 1024);
    return {
      ttfbMs: nav ? Math.round(nav.responseStart) : 0,
      fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : Math.round(w.__perf.fcp),
      lcpMs: Math.round(w.__perf.lcp),
      cls: Math.round(w.__perf.cls * 1000) / 1000,
      longTasks: w.__perf.longTasks.length,
      longTaskMs: Math.round(w.__perf.longTasks.reduce((a: number, b: number) => a + b, 0)),
      heapMB: mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : 0,
      requestsTotal: res.length,
      requestsFirestore: res.filter((r) => isFirestore(r.name)).length,
      requestsStatic: res.filter((r) => !isFirestore(r.name) && isStatic(r.name)).length,
      transferKB: kib(res.reduce((a, r) => a + (r.transferSize || 0), 0)),
      firestoreTransferKB: kib(res.filter((r) => isFirestore(r.name)).reduce((a, r) => a + (r.transferSize || 0), 0)),
    };
  });
}

async function measureTransition(browser: Browser, from: string, to: string, waitSelector: string): Promise<number | null> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  try {
    await page.goto(`${BASE}${from}`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => undefined);
    const t0 = Date.now();
    await page.locator(`a[href="${to}"]:visible`).first().click();
    await page.waitForSelector(waitSelector, { timeout: 20_000 });
    return Date.now() - t0;
  } catch (err) {
    console.log(`  [transition ${from}→${to}] failed at ${page.url()}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    return null;
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const results: Record<string, unknown> = { baseUrl: BASE, generatedAt: new Date().toISOString(), routes: {}, transitions: {} };

  for (const profile of Object.keys(PROFILES) as ProfileName[]) {
    results.routes[profile] = {};
    for (const route of ROUTES) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      // tsx/esbuild emits `__name(...)` helper calls inside functions that
      // page.evaluate serializes; provide a no-op fallback in the page.
      await context.addInitScript('window.__name = window.__name || (function (target) { return target; });');
      await context.addInitScript(OBSERVER_INIT);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      try {
        (results.routes[profile] as Record<string, RouteMetrics>)[route] = await measureRoute(page, cdp, route, profile);
      } catch (err) {
        (results.routes[profile] as Record<string, RouteMetrics>)[route] = { error: err instanceof Error ? err.message : String(err) } as unknown as RouteMetrics;
      }
      await context.close();
    }
  }

  // External image hosts (i.ibb.co) have high per-request latency variance;
  // take the median of 3 sequential runs per transition so single outliers
  // don't mislead (parallel runs distort each other's timing).
  const medianOf = (arr: (number | null)[]): number | null => {
    const v = arr.filter((x): x is number => x !== null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  results.transitions = {
    'tournaments->games (median of 3)': medianOf([
      await measureTransition(browser, '/tournaments', '/games', 'a[href^="/games/"]'),
      await measureTransition(browser, '/tournaments', '/games', 'a[href^="/games/"]'),
      await measureTransition(browser, '/tournaments', '/games', 'a[href^="/games/"]'),
    ]),
    'tournaments->organizations (median of 3)': medianOf([
      await measureTransition(browser, '/tournaments', '/organizations', 'a[href^="/organizations/"]'),
      await measureTransition(browser, '/tournaments', '/organizations', 'a[href^="/organizations/"]'),
      await measureTransition(browser, '/tournaments', '/organizations', 'a[href^="/organizations/"]'),
    ]),
  };
  await browser.close();

  mkdirSync(dirname(OUT), { recursive: true });
  const save = () => writeFileSync(OUT, JSON.stringify(results, null, 2));
  save();

  // Console summary
  console.log('\n───────────────────────────────────────────────────────────────────────────────');
  console.log('ROUTE PERF (no-throttle)'.padEnd(46) + 'TTFB'.padStart(6) + 'FCP'.padStart(6) + 'LCP'.padStart(6) + 'CLS'.padStart(7) + 'REQ'.padStart(5) + 'FS'.padStart(4) + 'KB'.padStart(6) + 'HEAP'.padStart(6));
  console.log('───────────────────────────────────────────────────────────────────────────────');
  const noThrottle = results.routes['no-throttle'] as Record<string, RouteMetrics>;
  for (const route of ROUTES) {
    const m = noThrottle[route];
    if (!m || !('ttfbMs' in m) || m.ttfbMs === undefined) { console.log(`${route.padEnd(46)} ERROR`); continue; }
    console.log(
      route.padEnd(46) + String(m.ttfbMs).padStart(6) + String(m.fcpMs).padStart(6) + String(m.lcpMs).padStart(6) + String(m.cls).padStart(7) + String(m.requestsTotal).padStart(5) + String(m.requestsFirestore).padStart(4) + String(m.transferKB).padStart(6) + String(m.heapMB).padStart(6),
    );
  }
  const f3g = results.routes['fast-3g'] as Record<string, RouteMetrics>;
  console.log('\n───────────────────────────────────────────────────────────────────────────────');
  console.log('ROUTE PERF (fast-3g)'.padEnd(46) + 'TTFB'.padStart(6) + 'FCP'.padStart(6) + 'LCP'.padStart(6) + 'CLS'.padStart(7) + 'REQ'.padStart(5) + 'FS'.padStart(4) + 'KB'.padStart(6) + 'LONG'.padStart(6));
  console.log('───────────────────────────────────────────────────────────────────────────────');
  for (const route of ROUTES) {
    const m = f3g[route];
    if (!m || !('ttfbMs' in m) || m.ttfbMs === undefined) { console.log(`${route.padEnd(46)} ERROR`); continue; }
    console.log(
      route.padEnd(46) + String(m.ttfbMs).padStart(6) + String(m.fcpMs).padStart(6) + String(m.lcpMs).padStart(6) + String(m.cls).padStart(7) + String(m.requestsTotal).padStart(5) + String(m.requestsFirestore).padStart(4) + String(m.transferKB).padStart(6) + String(m.longTasks).padStart(6),
    );
  }
  const t = results.transitions as Record<string, number | null>;
  console.log(`\nTransitions: tournaments→games ${t['tournaments->games (median of 3)']}ms, tournaments→organizations ${t['tournaments->organizations (median of 3)']}ms`);
  console.log(`Saved: ${OUT}`);
}

main().catch((err) => {
  console.error('perf-audit error:', err);
  process.exit(1);
});
