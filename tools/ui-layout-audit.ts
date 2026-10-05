/**
 * NEXPLAY UI LAYOUT & VIEWPORT BOUNDS AUDIT
 *
 * Browser-based (Playwright/Chromium) audit that verifies, for every real page
 * and across a matrix of screen sizes / resolutions / pixel densities:
 *
 *   1. VIEWPORT BOUNDS     — every visible interactive element (buttons, links,
 *                            inputs, selects, role=button, ...) sits fully inside
 *                            the viewport after scrolling it into view; nothing is
 *                            partially or completely rendered outside the screen.
 *   2. HORIZONTAL OVERFLOW — the document never scrolls sideways and no element
 *                            extends past the viewport edge.
 *   3. OVERLAP             — no two interactive elements are stacked on top of
 *                            each other (excluding ancestor/descendant nesting).
 *                            Content sliding under a fixed bar mid-scroll is
 *                            normal, so fixed-bar overlaps are only judged at the
 *                            bottom resting scroll position, where content can
 *                            no longer scroll out from under the bar.
 *   4. ROW ALIGNMENT       — elements sharing a row and a class signature align
 *                            on their top edges and have consistent heights and
 *                            even spacing.
 *   5. TEXT CLIPPING       — interactive element labels are not clipped by their
 *                            own box.
 *   6. OVERFLOW CLIPPING   — elements are not invisibly cut by an
 *                            `overflow: hidden` ancestor (>50% hidden fails,
 *                            smaller peeks warn because carousels intentionally
 *                            show partial cards).
 *   7. TAP TARGET SIZE     — (mobile only, warning) touch targets meet minimum
 *                            size guidance.
 *   8. RUNTIME ERRORS      — uncaught page errors / console errors are captured,
 *                            since broken JS commonly manifests as layout glitches.
 *
 * Intentionally hidden UI is not reported: closed off-canvas drawers (fully
 * outside the viewport) and elements completely covered by opaque content
 * (verified with document.elementFromPoint hit-testing) are skipped.
 *
 * Full-page and viewport screenshots are written to scratch/ui-audit/ so visual
 * glitches that geometry checks cannot catch can be reviewed by a human.
 *
 * Usage:
 *   npx playwright install chromium        # one-time browser download
 *   npm run dev                            # serve the app on :3005
 *   npx tsx tools/ui-layout-audit.ts
 *
 * Git Bash note: prefix with MSYS2_ENV_CONV_EXCL=AUDIT_ROUTES so MSYS path
 * conversion does not rewrite route values like "/,/tournaments" into Windows
 * paths.
 *
 * Environment overrides:
 *   AUDIT_BASE_URL=http://localhost:3005   target server
 *   AUDIT_ROUTES=/,/tournaments            restrict routes (comma separated)
 *   AUDIT_VIEWPORTS=375x667@2,1920x1080@1  restrict/redefine the viewport matrix
 *   AUDIT_SCREENS=0                        skip screenshot capture
 *
 * Exit code: 0 if no FAIL-severity findings, 1 otherwise. WARNings never fail.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.AUDIT_BASE_URL ?? 'http://localhost:3005';
const CAPTURE_SCREENSHOTS = process.env.AUDIT_SCREENS !== '0';
const OUTPUT_DIR = resolve('scratch/ui-audit');

/** px of sub-pixel tolerance before a measurement counts as a real defect. */
const TOL = 1;
/** Two interactive elements may share this much edge before it is an overlap. */
const OVERLAP_MIN_PX = 3;
/** Overlapping area (as a fraction of the smaller element) that fails. */
const OVERLAP_AREA_RATIO = 0.15;
/** Vertical band (px) within which elements are considered to share a row. */
const ROW_BAND_PX = 3;
/** Allowed deviation (px) of tops/heights inside one aligned row. */
const ALIGN_TOL_PX = 2;
/** Minimum touch-target side (px) below which we warn on mobile viewports. */
const MIN_TAP_TARGET_PX = 32;
/** Safety cap so a pathological page cannot hang the pairwise overlap check. */
const MAX_ELEMENTS_FOR_PAIRWISE = 400;

interface ViewportProfile {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

/**
 * Matrix covering small phones, large phones (high DPR), tablets (touch),
 * small laptops (1366x768 is the most common laptop panel and the classic
 * "fits on my machine" blind spot), full-HD desktop and 1440p high-res desktop.
 */
const DEFAULT_VIEWPORTS: ViewportProfile[] = [
  { name: 'mobile-sm-360x640@2',  width: 360,  height: 640,  deviceScaleFactor: 2, isMobile: true,  hasTouch: true },
  { name: 'mobile-375x667@2',     width: 375,  height: 667,  deviceScaleFactor: 2, isMobile: true,  hasTouch: true },
  { name: 'mobile-lg-390x844@3',  width: 390,  height: 844,  deviceScaleFactor: 3, isMobile: true,  hasTouch: true },
  { name: 'tablet-768x1024@2',    width: 768,  height: 1024, deviceScaleFactor: 2, isMobile: true,  hasTouch: true },
  { name: 'laptop-1366x768@1',    width: 1366, height: 768,  deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'desktop-1920x1080@1',  width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'desktop-2560x1440@1',  width: 2560, height: 1440, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

/**
 * Real static routes from src/App.tsx. Parameterized routes (/tournament/:id,
 * /scrims/:id, /wallet, /dashboard, /profile) need data or authentication and
 * are intentionally out of scope for the unauthenticated geometry pass.
 */
const DEFAULT_ROUTES: string[] = [
  '/',
  '/tournaments',
  '/scrims',
  '/teams',
  '/results',
  '/games',
  '/leaderboard',
  '/news',
  '/organizations',
  '/about',
  '/contact',
  '/login',
  '/register',
  '/privacy',
  '/terms',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Severity = 'FAIL' | 'WARN';

interface Finding {
  severity: Severity;
  rule: string;
  detail: string;
}

/** In-page audit payload produced inside the browser context. */
interface PageAuditResult {
  findings: Finding[];
  horizontalOverflowPx: number;
  interactiveElementCount: number;
  occludedInteractiveCount: number;
  offCanvasInteractiveCount: number;
}

interface RouteRunResult {
  viewport: string;
  route: string;
  url: string;
  ok: boolean;
  navigationError: string | null;
  findings: Finding[];
  interactiveElementCount: number;
  occludedInteractiveCount: number;
  offCanvasInteractiveCount: number;
  horizontalOverflowPx: number;
  screenshots: string[];
}

interface AuditOptions {
  minTapTargetPx: number;
  checkTapTargets: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-page audit (executed via page.evaluate — must stay self-contained)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs inside the browser via page.evaluate(fn, options). Playwright serializes
 * the function source, so this function must not reference any Node-scope
 * variable — everything it needs arrives through `options` or is defined below.
 */
function pageAudit(options: AuditOptions): PageAuditResult {
  const INTERACTIVE_SELECTOR = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="tab"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  const TOL = 1;
  const OVERLAP_MIN_PX = 3;
  const OVERLAP_AREA_RATIO = 0.15;
  const ROW_BAND_PX = 3;
  const ALIGN_TOL_PX = 2;
  const MAX_ELEMENTS_FOR_PAIRWISE = 400;

  const findings: Finding[] = [];
  const seen = new Set<string>();
  const push = (severity: Severity, rule: string, detail: string) => {
    const key = `${rule}|${detail}`;
    if (seen.has(key) || findings.length >= 200) return;
    seen.add(key);
    findings.push({ severity, rule, detail });
  };

  const baseVisible = (el: Element): boolean => {
    if (el.closest('[aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (Number.parseFloat(style.opacity) === 0) return false;
    if (style.pointerEvents === 'none') return false; // dead for interaction — out of scope
    if (el instanceof HTMLElement && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) return false;
    return true;
  };

  const describe = (el: Element, rect: DOMRect) => {
    // Build a short, unique-ish selector path (up to 3 ancestors).
    const parts: string[] = [];
    let node: Element | null = el;
    for (let depth = 0; node && depth < 3; depth++) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += `#${node.id}`;
        parts.unshift(part);
        break;
      }
      const classes = (typeof node.className === 'string' ? node.className : '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
      if (classes.length > 0) part += `.${classes.join('.')}`;
      const parent = node.parentElement;
      if (parent) {
        const current = node;
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return {
      path: parts.join(' > '),
      tag: el.tagName.toLowerCase(),
      id: el.id,
      classes: typeof el.className === 'string' ? el.className.trim().slice(0, 80) : '',
      text,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      position: window.getComputedStyle(el).position,
    };
  };

  const fmt = (e: { tag: string; id: string; text: string; classes: string; rect: { x: number; y: number; width: number; height: number }; path: string }): string =>
    `<${e.tag}${e.id ? `#${e.id}` : ''}> "${e.text || e.classes}" @(${e.rect.x},${e.rect.y} ${e.rect.width}x${e.rect.height}) [${e.path}]`;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.scrollingElement;

  // ── Collect candidates and classify visibility ───────────────────────────
  const candidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR)) as HTMLElement[];

  // True when the element (or a descendant painted at the sample point) is the
  // top-most element at that point — i.e. the user can actually see/click it.
  const isHittable = (el: Element, rect: DOMRect): boolean => {
    const samples: [number, number][] = [[rect.left + rect.width / 2, rect.top + rect.height / 2]];
    if (rect.width > 8 && rect.height > 8) {
      samples.push(
        [rect.left + rect.width * 0.25, rect.top + rect.height * 0.25],
        [rect.left + rect.width * 0.75, rect.top + rect.height * 0.25],
        [rect.left + rect.width * 0.25, rect.top + rect.height * 0.75],
        [rect.left + rect.width * 0.75, rect.top + rect.height * 0.75],
      );
    }
    for (const [x, y] of samples) {
      if (x < 0 || y < 0 || x > vw || y > vh) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) return true;
    }
    return false;
  };

  const inFixedSubtree = (el: Element): boolean => {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const p = window.getComputedStyle(node).position;
      if (p === 'fixed' || p === 'sticky') return true;
      node = node.parentElement;
    }
    return false;
  };

  interface Auditable {
    el: HTMLElement;
    rect: DOMRect;
    fixed: boolean;
  }

  const auditable: Auditable[] = [];
  let occludedCount = 0;
  let offCanvasCount = 0;

  for (const el of candidates) {
    if (!baseVisible(el)) continue;
    const rect = el.getBoundingClientRect();
    // Closed off-canvas UI (drawers translated out of view) can never enter the
    // viewport by scrolling: anything fully above/left/right of the viewport at
    // top rest is hidden by design. Fully BELOW is reachable, so it stays.
    if (rect.bottom <= 0 || rect.right <= 0 || rect.left >= vw) {
      offCanvasCount++;
      continue;
    }
    // Elements visible in the viewport must survive a hit test; those fully
    // below the fold cannot be hit-tested yet and are audited as-is.
    const intersectsViewport = rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0;
    if (intersectsViewport && !isHittable(el, rect)) {
      occludedCount++;
      continue;
    }
    auditable.push({ el, rect, fixed: inFixedSubtree(el) });
  }

  const describeOf = (a: Auditable) => describe(a.el, a.rect);

  // ── 1. Zero-size / unsized interactive elements ──────────────────────────
  for (const a of auditable) {
    if (a.rect.width < 4 || a.rect.height < 4) {
      push('FAIL', 'ZERO_SIZE_INTERACTIVE', `Interactive element is effectively invisible (${Math.round(a.rect.width)}x${Math.round(a.rect.height)}): ${fmt(describeOf(a))}`);
    }
  }

  // ── 2. Horizontal containment (viewport bounds, X axis) ──────────────────
  // A page may scroll vertically by design; it must never scroll or clip
  // horizontally. Any auditable element poking past the left/right viewport
  // edge without a scrollable ancestor is a placement bug.
  const horizontalOverflowPx = doc ? Math.max(0, doc.scrollWidth - doc.clientWidth) : 0;

  const hasScrollableAncestorX = (el: Element): boolean => {
    let node: Element | null = el.parentElement;
    while (node && node !== document.body) {
      const s = window.getComputedStyle(node);
      if (s.overflowX !== 'hidden' && /(auto|scroll)/.test(s.overflowX) && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  };

  for (const a of auditable) {
    if (a.rect.width === 0 && a.rect.height === 0) continue;
    if (a.rect.right > vw + TOL || a.rect.left < -TOL) {
      if (hasScrollableAncestorX(a.el)) continue; // reachable by scrolling the container
      const side = a.rect.right > vw + TOL ? `${Math.ceil(a.rect.right - vw)}px past the right edge` : `${Math.ceil(-a.rect.left)}px past the left edge`;
      push('FAIL', 'OUTSIDE_VIEWPORT_X', `Element extends ${side} of the ${vw}px viewport and cannot be scrolled into view: ${fmt(describeOf(a))}`);
    }
  }
  if (horizontalOverflowPx > TOL) {
    push('FAIL', 'PAGE_HORIZONTAL_OVERFLOW', `Document scrolls horizontally by ${Math.round(horizontalOverflowPx)}px at ${vw}px viewport width (scrollWidth ${doc ? doc.scrollWidth : '?'} vs clientWidth ${doc ? doc.clientWidth : '?'}).`);
  }

  // ── 3. Clipping by overflow:hidden ancestors ─────────────────────────────
  for (const a of auditable) {
    const rect = a.rect;
    if (rect.width === 0 && rect.height === 0) continue;
    // Content inside a horizontally scrollable ancestor is reachable by
    // scrolling that container (tab strips, carousels), so it is not "cut".
    if (hasScrollableAncestorX(a.el)) continue;
    let node: Element | null = a.el.parentElement;
    while (node && node !== document.documentElement) {
      const s = window.getComputedStyle(node);
      const clipsX = s.overflow === 'hidden' || s.overflowX === 'hidden';
      const clipsY = s.overflow === 'hidden' || s.overflowY === 'hidden';
      if (clipsX || clipsY) {
        const box = node.getBoundingClientRect();
        const overLeft = Math.max(0, box.left - rect.left);
        const overRight = Math.max(0, rect.right - box.right);
        const overTop = Math.max(0, box.top - rect.top);
        const overBottom = Math.max(0, rect.bottom - box.bottom);
        const clippedX = (overLeft > 2 || overRight > 2) && clipsX;
        const clippedY = (overTop > 2 || overBottom > 2) && clipsY;
        if (clippedX || clippedY) {
          const clippedWidth = clipsX ? Math.max(0, rect.width - overLeft - overRight) : rect.width;
          const clippedHeight = clipsY ? Math.max(0, rect.height - overTop - overBottom) : rect.height;
          const visibleRatio = (clippedWidth * clippedHeight) / (rect.width * rect.height);
          const detail = `Element is cut by an overflow:hidden ancestor (${node.tagName.toLowerCase()}.${(typeof node.className === 'string' ? node.className : '').split(/\s+/).slice(0, 2).join('.')}), ${Math.round((1 - visibleRatio) * 100)}% of it invisible: ${fmt(describeOf(a))}`;
          push(visibleRatio < 0.5 ? 'FAIL' : 'WARN', visibleRatio < 0.5 ? 'CLIPPED_BY_OVERFLOW_HIDDEN' : 'PARTIALLY_CLIPPED_BY_OVERFLOW', detail);
          break;
        }
      }
      node = node.parentElement;
    }
  }

  // ── 4. Text clipping inside interactive elements ─────────────────────────
  for (const a of auditable) {
    const el = a.el;
    const style = window.getComputedStyle(el);
    const clipsX = style.overflowX !== 'visible';
    const clipsY = style.overflowY !== 'visible';
    if (!clipsX && !clipsY) continue;
    if (clipsX && el.scrollWidth > el.clientWidth + 2 && style.textOverflow !== 'ellipsis') {
      push('FAIL', 'TEXT_CLIPPED_X', `Label is horizontally clipped by ${el.scrollWidth - el.clientWidth}px inside its own box: ${fmt(describeOf(a))}`);
    }
    if (clipsY && el.scrollHeight > el.clientHeight + 2 && style.overflowY !== 'auto' && style.overflowY !== 'scroll') {
      push('FAIL', 'TEXT_CLIPPED_Y', `Label is vertically clipped by ${el.scrollHeight - el.clientHeight}px inside its own box: ${fmt(describeOf(a))}`);
    }
  }

  // ── 5. Pairwise overlap of interactive elements ──────────────────────────
  const pairKey = (i: number, j: number): string => `${Math.min(i, j)}:${Math.max(i, j)}`;
  const measured = auditable.slice(0, MAX_ELEMENTS_FOR_PAIRWISE);

  const overlap = (a: DOMRect, b: DOMRect): { ix: number; iy: number; ratio: number } | null => {
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix <= OVERLAP_MIN_PX || iy <= OVERLAP_MIN_PX) return null;
    const ratio = (ix * iy) / Math.min(a.width * a.height, b.width * b.height);
    return ratio >= OVERLAP_AREA_RATIO ? { ix, iy, ratio } : null;
  };

  const containsRect = (outer: DOMRect, inner: DOMRect): boolean =>
    inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;

  // Pass 1 (top rest): flow↔flow and fixed↔fixed overlaps are geometric facts,
  // independent of scroll position.
  const flowPairs = new Set<string>();
  for (let i = 0; i < measured.length; i++) {
    for (let j = i + 1; j < measured.length; j++) {
      const a = measured[i];
      const b = measured[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue; // nesting is not overlap
      if (containsRect(a.rect, b.rect) || containsRect(b.rect, a.rect)) continue;
      if (overlap(a.rect, b.rect) === null) continue;
      if (a.fixed !== b.fixed) continue; // mixed pairs judged at bottom rest below
      flowPairs.add(pairKey(i, j));
    }
  }

  // Pass 2 (bottom rest): content can no longer scroll out from under a fixed
  // bar, so a flow element still overlapped by one here is genuinely covered.
  // Coverage is measured against the covered flow element. A top-anchored bar
  // (fixed header) over a scrollable page is skipped: content passing under it
  // at max scroll is standard scrolling behavior and escapes as soon as the
  // user scrolls up. Bottom-anchored bars (mobile tab bars) do obscure content
  // at the natural end-of-page position, and on non-scrollable pages coverage
  // is permanent — those are real defects.
  window.scrollTo(0, doc ? doc.scrollHeight : 0);
  const pageScrollable = doc ? doc.scrollHeight - doc.clientHeight > 4 : true;
  const mixedPairs = new Map<string, { ix: number; iy: number; coverage: number }>();
  const flowRects = measured.map((a) => (a.fixed ? a.rect : a.el.getBoundingClientRect()));
  for (let i = 0; i < measured.length; i++) {
    for (let j = i + 1; j < measured.length; j++) {
      const a = measured[i];
      const b = measured[j];
      if (a.fixed === b.fixed) continue;
      const bar = a.fixed ? a : b;
      if (pageScrollable && bar.rect.top + bar.rect.height / 2 <= vh / 2) continue;
      const flowIdx = a.fixed ? j : i;
      const ra = flowRects[i];
      const rb = flowRects[j];
      if (a.el.contains(b.el) || b.el.contains(a.el) || containsRect(ra, rb) || containsRect(rb, ra)) continue;
      const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ix <= OVERLAP_MIN_PX || iy <= OVERLAP_MIN_PX) continue;
      const flowRect = flowRects[flowIdx];
      const coverage = (ix * iy) / (flowRect.width * flowRect.height);
      if (coverage < OVERLAP_AREA_RATIO) continue;
      mixedPairs.set(pairKey(i, j), { ix, iy, coverage });
    }
  }
  window.scrollTo(0, 0);

  for (const [key, o] of mixedPairs) {
    const [iStr, jStr] = key.split(':');
    const a = measured[Number(iStr)];
    const b = measured[Number(jStr)];
    const severity: Severity = o.coverage >= 0.5 ? 'FAIL' : 'WARN';
    push(severity, severity === 'FAIL' ? 'INTERACTIVE_OVERLAP' : 'PARTIALLY_COVERED_BY_FIXED_UI', `Interactive element is ${Math.round(o.coverage * 100)}% covered by fixed UI at the final scroll position (overlap ${Math.round(o.ix)}x${Math.round(o.iy)}px): ${fmt(describeOf(a))} ↔ ${fmt(describeOf(b))}`);
  }

  // ── 6. Row alignment for same-class interactive siblings ─────────────────
  // Group by (tag + class signature), then cluster by vertical band. Within a
  // cluster, tops and heights must match (grid/flex rows render that way).
  // Gap uniformity only applies to same-parent siblings: when other elements
  // are interleaved between group members, uneven gaps are the surrounding
  // layout, not a defect of the grouped elements.
  const parentIds = new WeakMap<Element, number>();
  let nextParentId = 1;
  const parentIdOf = (el: Element): number => {
    const p = el.parentElement;
    if (!p) return 0;
    let id = parentIds.get(p);
    if (id === undefined) {
      id = nextParentId++;
      parentIds.set(p, id);
    }
    return id;
  };

  const groups = new Map<string, { key: string; items: (ReturnType<typeof describe> & { parentId: number })[] }>();
  for (const a of auditable) {
    if (a.rect.width === 0 || a.rect.height === 0) continue;
    const classes = (typeof a.el.className === 'string' ? a.el.className : '').trim().split(/\s+/).filter(Boolean).sort().join(' ');
    if (!classes) continue; // unclassed elements carry no alignment contract
    const key = `${a.el.tagName.toLowerCase()}|${classes}`;
    const list = groups.get(key) ?? { key, items: [] };
    list.items.push({ ...describeOf(a), parentId: parentIdOf(a.el) });
    groups.set(key, list);
  }

  for (const { key, items } of groups.values()) {
    if (items.length < 2) continue;
    const label = key.split('|')[1].slice(0, 50);
    const sorted = [...items].sort((x, y) => x.rect.y - y.rect.y);
    let cluster: (ReturnType<typeof describe> & { parentId: number })[] = [];
    const flushCluster = () => {
      if (cluster.length >= 2) {
        const tops = cluster.map((c) => c.rect.y);
        const heights = cluster.map((c) => c.rect.height);
        const topSpread = Math.max(...tops) - Math.min(...tops);
        const heightSpread = Math.max(...heights) - Math.min(...heights);
        if (topSpread > ALIGN_TOL_PX) {
          push('FAIL', 'ROW_MISALIGNED_TOP', `${cluster.length} "${label}" elements share a row but their top edges differ by ${topSpread}px (max tolerance ${ALIGN_TOL_PX}px): ${cluster.map((c) => `y=${c.rect.y} ${c.path}`).join(' | ')}`);
        }
        if (heightSpread > ALIGN_TOL_PX) {
          push('FAIL', 'ROW_MISALIGNED_HEIGHT', `${cluster.length} "${label}" elements share a row but their heights differ by ${heightSpread}px: ${cluster.map((c) => `h=${c.rect.height} ${c.path}`).join(' | ')}`);
        }
        if (cluster.length >= 3 && new Set(cluster.map((c) => c.parentId)).size === 1) {
          const byLeft = [...cluster].sort((x, y) => x.rect.x - y.rect.x);
          // Only gaps that are genuinely empty count: an "uneven gap" filled by
          // another element (e.g. an active-state sibling with a different class
          // signature) is the surrounding layout, not misplaced spacing.
          const gapOccupied = (start: number, end: number, top: number, bottom: number): boolean =>
            auditable.some((m) => {
              const r = m.rect;
              return r.left < end - 1 && r.right > start + 1 && r.top < bottom - 1 && r.bottom > top + 1;
            });
          const gaps: number[] = [];
          for (let k = 1; k < byLeft.length; k++) {
            const prev = byLeft[k - 1];
            const cur = byLeft[k];
            const gapStart = prev.rect.x + prev.rect.width;
            const gapVal = cur.rect.x - gapStart;
            if (gapVal > ALIGN_TOL_PX * 2 && gapOccupied(gapStart, cur.rect.x, Math.max(prev.rect.y, cur.rect.y), Math.min(prev.rect.y + prev.rect.height, cur.rect.y + cur.rect.height))) continue;
            gaps.push(gapVal);
          }
          if (gaps.length > 1 && Math.min(...gaps) >= 0 && Math.max(...gaps) - Math.min(...gaps) > ALIGN_TOL_PX * 2) {
            push('WARN', 'ROW_UNEVEN_SPACING', `${cluster.length} "${label}" elements in a row have uneven gaps (${gaps.map((g) => Math.round(g)).join(', ')}px): ${byLeft.map((c) => `x=${c.rect.x} ${c.path}`).join(' | ')}`);
          }
        }
      }
      cluster = [];
    };
    for (const info of sorted) {
      if (cluster.length === 0 || info.rect.y - cluster[cluster.length - 1].rect.y <= ROW_BAND_PX) {
        cluster.push(info);
      } else {
        flushCluster();
        cluster = [info];
      }
    }
    flushCluster();
  }

  // ── 7. Vertical containment (viewport bounds, Y axis) ────────────────────
  // Vertical page scroll is legitimate, so scroll each element into view and
  // require it to then fit between the viewport's top and bottom edges.
  for (const a of auditable) {
    const rect = a.rect;
    if (rect.height === 0 || rect.width === 0) continue;
    if (a.fixed) continue; // fixed/sticky elements are always "in view"; overlap rules cover them
    if (rect.height > vh * 1.1) continue; // taller than viewport: cannot fully fit by definition; not a placement bug on its own
    a.el.scrollIntoView({ block: 'center', inline: 'center' });
    const after = a.el.getBoundingClientRect();
    if (after.top < -TOL || after.bottom > vh + TOL) {
      const off = after.top < -TOL ? `${Math.ceil(-after.top)}px above the top` : `${Math.ceil(after.bottom - vh)}px below the bottom`;
      push('FAIL', 'OUTSIDE_VIEWPORT_Y', `Element cannot be scrolled fully into view — renders ${off} edge of the ${vh}px viewport: ${fmt(describe(a.el, after))}`);
    }
  }
  window.scrollTo(0, 0);

  // ── 8. Tap target sizes (mobile only, warning) ───────────────────────────
  if (options.checkTapTargets) {
    for (const a of auditable) {
      if (a.rect.width === 0 || a.rect.height === 0) continue;
      if (a.rect.width < options.minTapTargetPx || a.rect.height < options.minTapTargetPx) {
        push('WARN', 'SMALL_TAP_TARGET', `Touch target is ${Math.round(a.rect.width)}x${Math.round(a.rect.height)}px (minimum guidance ${options.minTapTargetPx}px): ${fmt(describeOf(a))}`);
      }
    }
    if (!document.querySelector('meta[name="viewport"]')) {
      push('WARN', 'NO_VIEWPORT_META', 'Page has no <meta name="viewport"> tag; mobile layout may fall back to a 980px desktop canvas.');
    }
  }

  return {
    findings,
    horizontalOverflowPx,
    interactiveElementCount: auditable.length,
    occludedInteractiveCount: occludedCount,
    offCanvasInteractiveCount: offCanvasCount,
  };
}

/** Runs inside the browser: find the widest elements poking past the viewport. */
function overflowOffenders(): { path: string; tag: string; text: string; overshoot: number; width: number }[] {
  const vw = window.innerWidth;
  const out: { path: string; tag: string; text: string; overshoot: number; width: number }[] = [];
  const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
  for (const el of all) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const overshoot = Math.max(rect.right - vw, -rect.left);
    if (overshoot > 2 && el.children.length < 40) {
      out.push({
        path: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${(typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0, 2).join('.')}`,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30),
        overshoot: Math.round(overshoot),
        width: Math.round(rect.width),
      });
    }
  }
  out.sort((a, b) => b.overshoot - a.overshoot);
  return out.slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────────────────────────

function parseViewports(raw: string | undefined): ViewportProfile[] {
  if (!raw) return DEFAULT_VIEWPORTS;
  return raw.split(',').map((spec) => {
    const m = spec.trim().match(/^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/);
    if (!m) throw new Error(`Invalid AUDIT_VIEWPORTS entry "${spec}" (expected WxH[@DPR], e.g. 375x667@2)`);
    const width = Number(m[1]);
    const isMobile = Math.min(width, Number(m[2])) < 820;
    return {
      name: spec.trim(),
      width,
      height: Number(m[2]),
      deviceScaleFactor: m[3] ? Number(m[3]) : 1,
      isMobile,
      hasTouch: isMobile,
    };
  });
}

function parseRoutes(raw: string | undefined): string[] {
  const routes = (raw ?? DEFAULT_ROUTES.join(',')).split(',').map((r) => r.trim()).filter(Boolean);
  const valid: string[] = [];
  for (const route of routes) {
    if (!/^\/[A-Za-z0-9/_.-]*$/.test(route)) {
      console.warn(`⚠️  Ignoring invalid route "${route}" (expected a path starting with "/"). Git Bash may have path-converted AUDIT_ROUTES — prefix the command with MSYS2_ENV_CONV_EXCL=AUDIT_ROUTES.`);
      continue;
    }
    if (!valid.includes(route)) valid.push(route);
  }
  if (valid.length === 0) throw new Error('No valid routes to audit.');
  return valid;
}

const PASS = '✅ PASS';
const FAILX = '❌ FAIL';
const WARNI = '⚠️  WARN';
const INFO = 'ℹ️  INFO';

function printFinding(f: Finding, context: string): void {
  const icon = f.severity === 'FAIL' ? FAILX : WARNI;
  console.log(`${icon} [${f.rule}] ${context}`);
  console.log(`     ${f.detail}`);
}

function slugRoute(route: string): string {
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '');
}

async function auditRouteOnViewport(browser: Browser, vp: ViewportProfile, route: string): Promise<RouteRunResult> {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
  });
  const page: Page = await context.newPage();
  // tsx/esbuild emits `__name(...)` helper calls inside transformed functions;
  // the helper lives in the Node bundle and is lost when Playwright serializes
  // the audit function into the browser, so install a no-op fallback there.
  await page.addInitScript('window.__name = window.__name || (function (target) { return target; });');
  const screenshots: string[] = [];
  const url = `${BASE_URL}${route}`;

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    if (pageErrors.length < 10) pageErrors.push(`Uncaught exception: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && pageErrors.length < 10) {
      const text = msg.text();
      // Ignore network noise from missing optional assets, and report-only CSP
      // violations (Chrome logs them as errors but explicitly takes no action).
      if (/^Failed to load resource/.test(text) || /report-only Content Security Policy/.test(text)) return;
      pageErrors.push(`console.error: ${text.slice(0, 200)}`);
    }
  });

  const findings: Finding[] = [];
  let navigationError: string | null = null;
  let interactiveCount = 0;
  let occludedCount = 0;
  let offCanvasCount = 0;
  let horizontalOverflowPx = 0;

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    // Let lazy data, fonts and entrance animations (the app uses `motion`)
    // settle so measurements see the resting layout, not a transition frame.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // Freeze animations/transitions for deterministic geometry.
    await page.addStyleTag({
      content: '*, *::before, *::after { animation-duration: 0.01ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; transition-delay: 0ms !important; scroll-behavior: auto !important; caret-color: transparent !important; }',
    });
    await page.waitForTimeout(600);

    const result: PageAuditResult = await page.evaluate(pageAudit, {
      minTapTargetPx: MIN_TAP_TARGET_PX,
      checkTapTargets: vp.isMobile,
    });
    findings.push(...result.findings);
    interactiveCount = result.interactiveElementCount;
    occludedCount = result.occludedInteractiveCount;
    offCanvasCount = result.offCanvasInteractiveCount;
    horizontalOverflowPx = result.horizontalOverflowPx;

    if (result.findings.some((f) => f.rule === 'PAGE_HORIZONTAL_OVERFLOW')) {
      const offenders = await page.evaluate(overflowOffenders);
      for (const o of offenders) {
        console.log(`${INFO}   overflow offender: ${o.path} (width ${o.width}px, overshoots by ${o.overshoot}px) "${o.text}"`);
      }
    }

    if (CAPTURE_SCREENSHOTS) {
      const vpDir = join(OUTPUT_DIR, vp.name);
      mkdirSync(vpDir, { recursive: true });
      const shotPath = join(vpDir, `${slugRoute(route)}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      screenshots.push(shotPath);
      const fullShotPath = join(vpDir, `${slugRoute(route)}-full.png`);
      await page.screenshot({ path: fullShotPath, fullPage: true });
      screenshots.push(fullShotPath);
    }
  } catch (err) {
    navigationError = err instanceof Error ? err.message : String(err);
  }

  for (const e of pageErrors) findings.push({ severity: 'FAIL', rule: 'RUNTIME_ERROR', detail: `${e} (on ${url})` });

  await context.close();
  return {
    viewport: vp.name,
    route,
    url,
    ok: navigationError === null,
    navigationError,
    findings,
    interactiveElementCount: interactiveCount,
    occludedInteractiveCount: occludedCount,
    offCanvasInteractiveCount: offCanvasCount,
    horizontalOverflowPx,
    screenshots,
  };
}

async function main(): Promise<void> {
  const viewports = parseViewports(process.env.AUDIT_VIEWPORTS);
  const routes = parseRoutes(process.env.AUDIT_ROUTES);

  console.log('========================================================================');
  console.log('📐 NEXPLAY UI LAYOUT & VIEWPORT BOUNDS AUDIT 📐');
  console.log('========================================================================');
  console.log(`  Target:      ${BASE_URL}`);
  console.log(`  Routes:      ${routes.length} (${routes.join(', ')})`);
  console.log(`  Viewports:   ${viewports.length} (${viewports.map((v) => v.name).join(', ')})`);
  console.log(`  Screenshots: ${CAPTURE_SCREENSHOTS ? OUTPUT_DIR : 'disabled'}\n`);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });
  const allResults: RouteRunResult[] = [];

  try {
    for (const vp of viewports) {
      console.log(`\n────────────────────────────────────────────────────────────────────────`);
      console.log(`📱 VIEWPORT ${vp.name}  (${vp.width}x${vp.height} @${vp.deviceScaleFactor}x DPR${vp.isMobile ? ', mobile/touch' : ''})`);
      console.log(`────────────────────────────────────────────────────────────────────────`);
      for (const route of routes) {
        const result = await auditRouteOnViewport(browser, vp, route);
        allResults.push(result);

        if (result.navigationError) {
          console.log(`${FAILX} [NAVIGATION] ${route} — ${result.navigationError}`);
          continue;
        }
        const fails = result.findings.filter((f) => f.severity === 'FAIL');
        const warns = result.findings.filter((f) => f.severity === 'WARN');
        if (fails.length === 0 && warns.length === 0) {
          console.log(`${PASS} ${route} — ${result.interactiveElementCount} interactive elements all inside viewport, aligned, no overlaps`);
        } else {
          console.log(`\n  ${route} — ${result.interactiveElementCount} interactive elements, ${fails.length} fail(s), ${warns.length} warning(s):`);
          for (const f of fails) printFinding(f, route);
          for (const w of warns) printFinding(w, route);
        }
        if (result.occludedInteractiveCount > 0 || result.offCanvasInteractiveCount > 0) {
          console.log(`${INFO}   hidden UI skipped (not audited): ${result.occludedInteractiveCount} occluded + ${result.offCanvasInteractiveCount} off-canvas interactive elements (closed drawers etc.)`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalFails = allResults.reduce((acc, r) => acc + r.findings.filter((f) => f.severity === 'FAIL').length, 0);
  const totalWarns = allResults.reduce((acc, r) => acc + r.findings.filter((f) => f.severity === 'WARN').length, 0);
  const navFailures = allResults.filter((r) => r.navigationError);
  const checked = allResults.filter((r) => !r.navigationError);

  console.log('\n========================================================================');
  console.log('📊 UI LAYOUT AUDIT SUMMARY');
  console.log('========================================================================\n');
  console.log(`  Viewport×route checks run:   ${allResults.length}`);
  console.log(`  Navigation failures:         ${navFailures.length}`);
  console.log(`  Pages fully clean:           ${checked.filter((r) => r.findings.length === 0).length}/${checked.length}`);
  console.log(`  FAIL findings:               ${totalFails}`);
  console.log(`  WARN findings:               ${totalWarns}`);

  const byRule = new Map<string, number>();
  for (const r of allResults) for (const f of r.findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
  if (byRule.size > 0) {
    console.log('\n  Findings by rule (most frequent first):');
    [...byRule.entries()].sort((a, b) => b[1] - a[1]).forEach(([rule, n]) => console.log(`    ${rule.padEnd(28)} ${n}`));
  }

  const worst = [...allResults]
    .filter((r) => r.findings.some((f) => f.severity === 'FAIL'))
    .sort((a, b) => b.findings.length - a.findings.length)
    .slice(0, 10);
  if (worst.length > 0) {
    console.log('\n  Worst viewport×route combinations:');
    for (const w of worst) console.log(`    ${w.viewport} ${w.route}: ${w.findings.filter((f) => f.severity === 'FAIL').length} fail(s)`);
  }

  const reportPath = join(OUTPUT_DIR, 'report.json');
  writeFileSync(reportPath, JSON.stringify({ baseUrl: BASE_URL, generatedAt: new Date().toISOString(), results: allResults }, null, 2), 'utf8');
  console.log(`\n  JSON report:      ${reportPath}`);
  if (CAPTURE_SCREENSHOTS) console.log(`  Screenshots dir:  ${OUTPUT_DIR}/<viewport>/<route>.png (viewport + full-page)`);

  console.log('\n========================================================================');
  console.log(totalFails === 0 && navFailures.length === 0 ? '🎉 NEXPLAY UI LAYOUT AUDIT PASSED 🎉' : '❌ NEXPLAY UI LAYOUT AUDIT FOUND LAYOUT DEFECTS ❌');
  console.log('========================================================================\n');

  process.exitCode = totalFails === 0 && navFailures.length === 0 ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error('UI layout audit error:', err);
  process.exit(1);
});
