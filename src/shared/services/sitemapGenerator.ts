// ═══════════════════════════════════════════════════════════════
import { BASE_URL } from '../constants/constants';
// DYNAMIC SITEMAP GENERATOR
// ponytail: generates sitemap.xml from Firestore data at build time.
// Called by the build script to produce a fresh sitemap before deploy.
// ═══════════════════════════════════════════════════════════════

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';


interface SitemapUrl {
    loc: string;
    lastmod?: string;
    changefreq: 'daily' | 'weekly' | 'monthly';
    priority: number;
}

/** Static pages that always exist */
function getStaticUrls(): SitemapUrl[] {
    return [
        { loc: `${BASE_URL}/`, changefreq: 'daily', priority: 1.0 },
        { loc: `${BASE_URL}/tournaments`, changefreq: 'daily', priority: 0.9 },
        { loc: `${BASE_URL}/scrims`, changefreq: 'daily', priority: 0.9 },
        { loc: `${BASE_URL}/games`, changefreq: 'weekly', priority: 0.9 },
        { loc: `${BASE_URL}/results`, changefreq: 'daily', priority: 0.7 },
        { loc: `${BASE_URL}/organizations`, changefreq: 'daily', priority: 0.7 },
        { loc: `${BASE_URL}/teams`, changefreq: 'daily', priority: 0.7 },
        { loc: `${BASE_URL}/leaderboard`, changefreq: 'daily', priority: 0.7 },
        { loc: `${BASE_URL}/about`, changefreq: 'monthly', priority: 0.5 },
        { loc: `${BASE_URL}/contact`, changefreq: 'monthly', priority: 0.5 },
        { loc: `${BASE_URL}/privacy`, changefreq: 'monthly', priority: 0.5 },
        { loc: `${BASE_URL}/terms`, changefreq: 'monthly', priority: 0.5 },
    ];
}

/** Escape XML special characters */
function escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Generate the full sitemap XML */
export function generateSitemapXml(urls: SitemapUrl[]): string {
    const entries = urls.map(u => {
        let entry = `  <url>\n    <loc>${escapeXml(u.loc)}</loc>`;
        if (u.lastmod) entry += `\n    <lastmod>${u.lastmod}</lastmod>`;
        entry += `\n    <changefreq>${u.changefreq}</changefreq>`;
        entry += `\n    <priority>${u.priority.toFixed(1)}</priority>`;
        entry += `\n  </url>`;
        return entry;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

/**
 * Fetch all dynamic URLs from Firestore and combine with static URLs.
 * Run this at build time to generate a fresh sitemap.
 */
export async function buildFullSitemap(db: any): Promise<string> {
    const urls: SitemapUrl[] = [...getStaticUrls()];

    // Fetch tournaments (upcoming + recent completed)
    try {
        const tournamentsSnap = await getDocs(query(collection(db, 'tournaments'), limit(500)));
        tournamentsSnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = data.updatedAt || data.createdAt;
            urls.push({
                loc: `${BASE_URL}/tournaments/${doc.id}`,
                lastmod: updatedAt?.toDate ? updatedAt.toDate().toISOString().split('T')[0] : undefined,
                changefreq: 'daily',
                priority: 0.8,
            });
        });
    } catch (e) {
        console.warn('Sitemap: could not fetch tournaments', e);
    }

    // Fetch public teams
    try {
        const teamsSnap = await getDocs(query(collection(db, 'teams'), limit(200)));
        teamsSnap.forEach(doc => {
            urls.push({
                loc: `${BASE_URL}/team/${doc.id}`,
                changefreq: 'weekly',
                priority: 0.6,
            });
        });
    } catch (e) {
        console.warn('Sitemap: could not fetch teams', e);
    }

    // Fetch organizations
    try {
        const orgsSnap = await getDocs(query(collection(db, 'users'), limit(200)));
        orgsSnap.forEach(doc => {
            const data = doc.data();
            if (data.role === 'organizer' || data.isOrganization) {
                urls.push({
                    loc: `${BASE_URL}/organization/${doc.id}`,
                    changefreq: 'weekly',
                    priority: 0.6,
                });
            }
        });
    } catch (e) {
        console.warn('Sitemap: could not fetch organizations', e);
    }

    // Deduplicate by loc
    const seen = new Set<string>();
    const deduped = urls.filter(u => {
        if (seen.has(u.loc)) return false;
        seen.add(u.loc);
        return true;
    });

    return generateSitemapXml(deduped);
}
