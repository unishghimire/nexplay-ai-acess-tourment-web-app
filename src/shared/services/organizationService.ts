import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    limit, 
    getDocs, 
    startAfter, 
    QueryDocumentSnapshot,
    Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PublicOrganization, OrganizationPublicStats, Tournament } from '../types/types';
import { calculateLevel } from '../utils/utils';
import { getSlotCount, getFilledSlotCount } from '../utils/scrimSlots';

/**
 * Validates and sanitizes external URLs to prevent security vulnerabilities
 * (e.g. javascript:, data:, vbscript: injection). Strictly allows https:// and http://.
 */
export function sanitizeExternalUrl(rawUrl?: string | null): string | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    // Check for illegal schemes directly before parsing
    const lower = trimmed.toLowerCase();
    if (
        lower.startsWith('javascript:') || 
        lower.startsWith('data:') || 
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
    ) {
        return null;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            return parsed.href;
        }
        return null;
    } catch {
        // If protocol is missing (e.g. "discord.gg/nexplay"), prepend https:// and validate
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
            try {
                const parsed = new URL(`https://${trimmed}`);
                if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
                    return parsed.href;
                }
            } catch {
                return null;
            }
        }
        return null;
    }
}

/**
 * Maps raw Firestore data from either 'organizations' or 'users_public' collection
 * into a strictly public, safe PublicOrganization structure.
 */
export function mapToPublicOrganization(id: string, data: any): PublicOrganization {
    const rawSocial = data.socialLinks || {
        discord: data.discord,
        youtube: data.youtube || data.youtubeUrl,
        facebook: data.facebook,
        instagram: data.instagram,
        tiktok: data.tiktok,
        twitter: data.twitter || data.xUrl,
        website: data.website
    };

    const sanitizedSocial = {
        discord: sanitizeExternalUrl(rawSocial.discord) || undefined,
        youtube: sanitizeExternalUrl(rawSocial.youtube) || undefined,
        facebook: sanitizeExternalUrl(rawSocial.facebook) || undefined,
        instagram: sanitizeExternalUrl(rawSocial.instagram) || undefined,
        tiktok: sanitizeExternalUrl(rawSocial.tiktok) || undefined,
        twitter: sanitizeExternalUrl(rawSocial.twitter) || undefined,
        website: sanitizeExternalUrl(rawSocial.website || data.website) || undefined,
    };

    const orgName = data.orgName || data.name || data.username || 'Organization';
    const xp = typeof data.xp === 'number' ? data.xp : 0;
    const level = typeof data.level === 'number' ? data.level : calculateLevel(xp);

    return {
        id,
        name: orgName,
        slug: data.slug || data.username?.toLowerCase() || id,
        username: data.username || orgName.toLowerCase().replace(/\s+/g, '_'),
        logoUrl: data.logoUrl || data.profilePicUrl || undefined,
        bannerUrl: data.bannerUrl || undefined,
        description: data.description || data.bio || undefined,
        tagline: data.tagline || data.customActivity || undefined,
        country: data.country || undefined,
        region: data.region || 'Nepal',
        website: sanitizeExternalUrl(data.website) || undefined,
        socialLinks: sanitizedSocial,
        isVerified: Boolean(data.isVerified),
        isPublic: data.isPublic !== false && data.status !== 'suspended' && data.orgStatus !== 'rejected',
        role: data.role === 'admin' ? 'admin' : 'organizer',
        isPowerOrganizer: Boolean(data.isPowerOrganizer || data.isPowerOrg),
        level,
        xp,
        createdAt: data.createdAt,
        establishedDate: data.establishedDate || undefined,
        followersCount: typeof data.followersCount === 'number' ? data.followersCount : undefined
    };
}

/**
 * Calculates public statistics derived strictly from public tournament records.
 * Never computes or touches private financial balances.
 */
export function calculateOrganizationStats(tournaments: Tournament[]): OrganizationPublicStats {
    let runningTournaments = 0;
    let upcomingTournaments = 0;
    let completedTournaments = 0;
    let totalPrizePool = 0;
    let totalSlots = 0;
    let filledSlots = 0;
    let publishedWinners = 0;

    for (const t of tournaments) {
        if (!t || t.status === 'draft' || t.status === 'cancelled' || t.status === 'pending_funding') {
            continue;
        }

        if (t.status === 'live') {
            runningTournaments++;
        } else if (t.status === 'upcoming' || t.status === 'published') {
            upcomingTournaments++;
        } else if (t.status === 'completed') {
            completedTournaments++;
            if (Array.isArray(t.winners) && t.winners.length > 0) {
                publishedWinners += t.winners.length;
            }
        }

        if (typeof t.prizePool === 'number' && t.prizePool > 0) {
            totalPrizePool += t.prizePool;
        }

        const slots = getSlotCount(t);
        const filled = getFilledSlotCount(t);
        totalSlots += slots;
        filledSlots += filled;
    }

    return {
        totalTournaments: runningTournaments + upcomingTournaments + completedTournaments,
        runningTournaments,
        upcomingTournaments,
        completedTournaments,
        totalPrizePool,
        totalSlots,
        filledSlots,
        publishedWinners
    };
}

/**
 * Fetches a single public organization by ID.
 * Resolves from 'organizations' collection first, then falls back to 'users_public'.
 */
export async function getPublicOrganization(orgId: string): Promise<PublicOrganization | null> {
    if (!orgId || typeof orgId !== 'string') return null;

    try {
        // 1. Check 'organizations' collection
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));
        if (orgDoc.exists()) {
            const org = mapToPublicOrganization(orgDoc.id, orgDoc.data());
            if (org.isPublic) return org;
            return null;
        }

        // 2. Fallback to 'users_public' collection
        const userDoc = await getDoc(doc(db, 'users_public', orgId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            // Only allow if role is organizer/admin or has an orgName
            if (data.role === 'organizer' || data.role === 'admin' || (data.orgName && data.orgName.trim() !== '')) {
                const org = mapToPublicOrganization(userDoc.id, data);
                if (org.isPublic) return org;
            }
        }

        return null;
    } catch (error) {
        console.error('getPublicOrganization failed:', error);
        return null;
    }
}

/**
 * Fetches all public tournaments for an organization to compute stats and display.
 */
export async function getOrganizationTournaments(orgId: string, maxLimit = 50): Promise<Tournament[]> {
    if (!orgId) return [];

    try {
        // Query tournaments hosted by this organization (single equality on hostUid is fast and indexed)
        const snap = await getDocs(query(
            collection(db, 'tournaments'),
            where('hostUid', '==', orgId),
            limit(maxLimit)
        ));

        const tournaments = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Tournament))
            .filter(t => t.status && ['upcoming', 'published', 'live', 'completed'].includes(t.status));

        return tournaments;
    } catch (error) {
        console.error('getOrganizationTournaments failed:', error);
        return [];
    }
}

/**
 * Fetches running tournaments for an organization.
 */
export async function getRunningOrganizationTournaments(orgId: string, maxLimit = 12): Promise<Tournament[]> {
    if (!orgId) return [];
    try {
        const snap = await getDocs(query(
            collection(db, 'tournaments'),
            where('hostUid', '==', orgId),
            where('status', '==', 'live'),
            limit(maxLimit)
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
    } catch (error) {
        console.error('getRunningOrganizationTournaments failed:', error);
        return [];
    }
}

/**
 * Fetches upcoming tournaments for an organization.
 */
export async function getUpcomingOrganizationTournaments(orgId: string, maxLimit = 12): Promise<Tournament[]> {
    if (!orgId) return [];
    try {
        const snap = await getDocs(query(
            collection(db, 'tournaments'),
            where('hostUid', '==', orgId),
            where('status', 'in', ['upcoming', 'published']),
            limit(maxLimit)
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
    } catch (error) {
        console.error('getUpcomingOrganizationTournaments failed:', error);
        return [];
    }
}

/**
 * Fetches completed tournaments for an organization with pagination.
 */
export async function getCompletedOrganizationTournaments(
    orgId: string, 
    pageSize = 12, 
    lastDoc?: QueryDocumentSnapshot | null
): Promise<{ tournaments: Tournament[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
    if (!orgId) return { tournaments: [], lastDoc: null, hasMore: false };
    try {
        let q = query(
            collection(db, 'tournaments'),
            where('hostUid', '==', orgId),
            where('status', '==', 'completed'),
            limit(pageSize)
        );

        if (lastDoc) {
            q = query(
                collection(db, 'tournaments'),
                where('hostUid', '==', orgId),
                where('status', '==', 'completed'),
                startAfter(lastDoc),
                limit(pageSize)
            );
        }

        const snap = await getDocs(q);
        const docs = snap.docs;
        const tournaments = docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
        const newLastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
        const hasMore = docs.length === pageSize;

        return { tournaments, lastDoc: newLastDoc, hasMore };
    } catch (error) {
        console.error('getCompletedOrganizationTournaments failed:', error);
        return { tournaments: [], lastDoc: null, hasMore: false };
    }
}
