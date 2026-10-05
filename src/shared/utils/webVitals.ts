import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

/**
 * Web Vitals instrumentation (see docs/PERFORMANCE-TEST-PLAN.md, TC-E).
 *
 * Metrics are buffered on `window.__nexplayWebVitals` so automated audits
 * (Playwright) and the browser console can read real user measurements.
 * Loaded via dynamic import from main.tsx so it never blocks the critical path.
 */

interface WebVitalsEntry {
    name: string;
    value: number;
    rating: string;
    id: string;
}

declare global {
    interface Window {
        __nexplayWebVitals?: WebVitalsEntry[];
    }
}

const report = (metric: Metric): void => {
    const entry: WebVitalsEntry = {
        name: metric.name,
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        rating: metric.rating,
        id: metric.id,
    };
    window.__nexplayWebVitals = window.__nexplayWebVitals ?? [];
    window.__nexplayWebVitals.push(entry);
    if (import.meta.env.DEV) {
        console.debug(`[web-vitals] ${entry.name}=${entry.value} (${entry.rating})`);
    }
};

export function initWebVitals(): void {
    onCLS(report);
    onFCP(report);
    onINP(report);
    onLCP(report);
    onTTFB(report);
}
