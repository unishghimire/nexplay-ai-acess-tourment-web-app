// ponytail: Self-contained SEO rules validation runner with assert checks and console output

export interface SeoPageData {
    path: string;
    title?: string;
    description?: string;
    canonicalUrl?: string;
    noindex?: boolean;
}

export interface SeoTestResult {
    path: string;
    passed: boolean;
    errors: string[];
}

const IMPORTANT_PAGES = ['/', '/tournaments', '/scrims', '/games', '/results', '/about'];

export function validateSeoRules(pages: SeoPageData[]): SeoTestResult[] {
    const titleCounts = new Map<string, number>();
    pages.forEach((p) => {
        if (p.title) {
            titleCounts.set(p.title, (titleCounts.get(p.title) || 0) + 1);
        }
    });

    return pages.map((page) => {
        const errors: string[] = [];

        // Title check
        if (!page.title) {
            errors.push('Title is missing');
        } else {
            if (page.title.length < 30 || page.title.length > 60) {
                errors.push(`Title length (${page.title.length}) must be between 30 and 60 characters`);
            }
            if (!page.title.includes('NexPlay')) {
                errors.push('Title must contain "NexPlay" for brand consistency');
            }
            if ((titleCounts.get(page.title) || 0) > 1) {
                errors.push(`Duplicate title found across pages: "${page.title}"`);
            }
        }

        // Description check
        if (!page.description) {
            errors.push('Description is missing');
        } else if (page.description.length < 120 || page.description.length > 160) {
            errors.push(`Description length (${page.description.length}) must be between 120 and 160 characters`);
        }

        // Canonical URL check
        if (!page.canonicalUrl) {
            errors.push('Canonical URL is missing');
        } else if (!page.canonicalUrl.startsWith('https://nexplayorg.app')) {
            errors.push(`Canonical URL "${page.canonicalUrl}" must start with https://nexplayorg.app`);
        }

        // Noindex check on important pages
        if (IMPORTANT_PAGES.includes(page.path) && page.noindex) {
            errors.push(`Accidental noindex set on important page "${page.path}"`);
        }

        return {
            path: page.path,
            passed: errors.length === 0,
            errors,
        };
    });
}

export function runSeoTests(): boolean {
    const samplePages: SeoPageData[] = [
        {
            path: '/',
            title: 'NexPlay - Esports Tournaments & Scrims Nepal',
            description: 'NexPlay is Nepal leading esports platform for PUBG Mobile, Free Fire, and Valorant tournaments, scrims, and competitive gaming leaderboards.',
            canonicalUrl: 'https://nexplayorg.app/',
            noindex: false,
        },
        {
            path: '/tournaments',
            title: 'Esports Tournaments in Nepal | NexPlay Esports',
            description: 'Discover and register for top esports tournaments in Nepal on NexPlay. Compete in PUBG Mobile, Free Fire, and Valorant for cash prize pools.',
            canonicalUrl: 'https://nexplayorg.app/tournaments',
            noindex: false,
        },
        {
            path: '/scrims',
            title: 'Esports Scrims & Practice Matches | NexPlay Nepal',
            description: 'Join daily esports scrims and competitive practice matches in Nepal on NexPlay. Practice PUBG Mobile, Free Fire, and Valorant with top teams.',
            canonicalUrl: 'https://nexplayorg.app/scrims',
            noindex: false,
        },
        {
            path: '/games',
            title: 'Supported Esports Games & Rules | NexPlay Gaming',
            description: 'Explore supported esports titles including PUBG Mobile, Free Fire, and Valorant on NexPlay Nepal. View tournament formats and rules.',
            canonicalUrl: 'https://nexplayorg.app/games',
            noindex: false,
        },
        {
            path: '/results',
            title: 'Esports Tournament Results & Rankings | NexPlay',
            description: 'Check official esports tournament results, match standings, leaderboards, and champion rosters across competitive games on NexPlay.',
            canonicalUrl: 'https://nexplayorg.app/results',
            noindex: false,
        },
        {
            path: '/about',
            title: 'About NexPlay - Nepal Esports Platform & Team',
            description: 'Learn about NexPlay, Nepal premier gaming platform dedicated to empowering esports players, organizers, and competitive communities.',
            canonicalUrl: 'https://nexplayorg.app/about',
            noindex: false,
        },
    ];

    const results = validateSeoRules(samplePages);
    let allPassed = true;

    console.log('--- Running SEO Rule Validation Tests ---');
    results.forEach((res) => {
        if (res.passed) {
            console.log(`[PASS] ${res.path}`);
        } else {
            allPassed = false;
            console.log(`[FAIL] ${res.path}:`);
            res.errors.forEach((err) => console.log(`  - ${err}`));
        }
    });
    console.log(`--- SEO Test Suite ${allPassed ? 'PASSED' : 'FAILED'} ---`);

    return allPassed;
}

// ponytail: Execute self-check immediately on import
runSeoTests();
