import React from 'react';

/**
 * Shared loading-skeleton primitives.
 *
 * Design contract (see docs/PERFORMANCE-TEST-PLAN.md TC-S):
 * - Geometry must approximate the loaded content (±20%) so the swap causes
 *   minimal layout shift (CLS ≤ 0.1).
 * - Every skeleton root carries `data-skeleton` so tests can target it.
 * - Blocks are aria-hidden; the exported wrapper exposes role="status".
 * - Theme: white/5 shimmer blocks on the app's dark surfaces.
 */

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div aria-hidden="true" data-skeleton className={`animate-pulse bg-white/5 rounded ${className}`} />
);

/** A few shimmering text lines of controlled width. */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
    lines = 2,
    className = '',
}) => (
    <div aria-hidden="true" data-skeleton className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }, (_, i) => (
            <div
                key={i}
                className={`animate-pulse bg-white/5 rounded h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
            />
        ))}
    </div>
);

/** Standard page header: title, subtitle, optional filter-band placeholder. */
export const PageHeaderSkeleton: React.FC<{ filterBand?: boolean }> = ({ filterBand = false }) => (
    <div data-skeleton className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-2.5">
                <div className="animate-pulse bg-white/5 rounded h-9 w-56" />
                <div className="animate-pulse bg-white/5 rounded h-4 w-72 max-w-full" />
            </div>
        </div>
        {filterBand && <div className="animate-pulse bg-white/5 rounded h-10 w-full sm:w-96 mt-5" />}
    </div>
);

/**
 * Card placeholder matching the tournament/scrim/game/org card shape:
 * cover image, badge row, title, meta lines, footer strip.
 */
export const CardSkeleton: React.FC<{ className?: string; coverClassName?: string }> = ({
    className = '',
    coverClassName = 'h-36 sm:h-44',
}) => (
    <div data-skeleton className={`rounded-2xl border border-white/5 bg-card/40 p-3 sm:p-4 ${className}`}>
        <div className={`animate-pulse bg-white/5 rounded-xl ${coverClassName} mb-4`} />
        <div className="flex items-center gap-2 mb-3">
            <div className="animate-pulse bg-white/10 rounded-full h-5 w-16" />
            <div className="animate-pulse bg-white/5 rounded-full h-5 w-12" />
        </div>
        <div className="animate-pulse bg-white/10 rounded h-4 w-3/4 mb-2.5" />
        <div className="animate-pulse bg-white/5 rounded h-3.5 w-full mb-1.5" />
        <div className="animate-pulse bg-white/5 rounded h-3.5 w-2/3 mb-4" />
        <div className="flex items-center justify-between">
            <div className="animate-pulse bg-white/5 rounded-lg h-8 w-24" />
            <div className="animate-pulse bg-brand-500/20 rounded-lg h-8 w-20" />
        </div>
    </div>
);

/** Responsive grid of card skeletons. Grid geometry is supplied by the view so it always matches the real list grid. */
export const CardGridSkeleton: React.FC<{ count?: number; gridClassName: string }> = ({
    count = 6,
    gridClassName,
}) => (
    <div role="status" aria-label="Loading content" className={gridClassName}>
        {Array.from({ length: count }, (_, i) => (
            <CardSkeleton key={i} />
        ))}
    </div>
);

/** Leaderboard row: rank chip, avatar circle, name + meta lines, stat pill. */
export const LeaderboardRowSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div data-skeleton className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-white/5 bg-card/40 ${className}`}>
        <div className="animate-pulse bg-white/10 rounded-lg h-7 w-7 shrink-0" />
        <div className="animate-pulse bg-white/5 rounded-full h-11 w-11 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
            <div className="animate-pulse bg-white/10 rounded h-4 w-32 max-w-full" />
            <div className="animate-pulse bg-white/5 rounded h-3 w-20" />
        </div>
        <div className="animate-pulse bg-white/5 rounded-full h-8 w-16 shrink-0" />
    </div>
);

/** Featured article + supporting article cards, matching the News page layout. */
export const NewsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div data-skeleton>
        <PageHeaderSkeleton />
        <div className="rounded-2xl border border-white/5 bg-card/40 p-4 sm:p-5 mb-8">
            <div className="animate-pulse bg-white/5 rounded-xl h-52 sm:h-64 mb-4" />
            <div className="animate-pulse bg-white/10 rounded h-5 w-2/3 mb-3" />
            <SkeletonText lines={2} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-card/40 p-4">
                    <div className="animate-pulse bg-white/5 rounded-lg h-40 mb-4" />
                    <div className="animate-pulse bg-white/10 rounded h-4 w-3/4 mb-2.5" />
                    <SkeletonText lines={2} />
                </div>
            ))}
        </div>
    </div>
);
