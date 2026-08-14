import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

// ponytail: protected routes that should NOT appear in breadcrumbs or SEO schema.
// Users reach these only by navigating through the app flow, not via direct links.
const HIDDEN_ROUTES = ['admin', 'organizer', 'wallet', 'dashboard', 'complete-profile', 'tournament-admin', 'profile', 'results'];

const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    if (pathnames.length === 0) return null;

    // Don't render breadcrumbs or schema on protected routes
    const isHidden = pathnames.some((p) => HIDDEN_ROUTES.includes(p));
    if (isHidden) return null;

    const breadcrumbNameMap: Record<string, string> = {
        'tournaments': 'Tournaments',
        'games': 'Games',
        'scrims': 'Scrims',
        'teams': 'Teams',
        'team': 'Team Details',
        'leaderboard': 'Leaderboard',
        'organizations': 'Organizations',
        'news': 'News',
        'post': 'Article',
        'user': 'Profile',
        'organization': 'Organization',
        'login': 'Login',
        'register': 'Register',
        'about': 'About',
        'contact': 'Contact',
        'privacy': 'Privacy',
        'terms': 'Terms',
    };

    const baseUrl = 'https://www.nexplayorg.app';

    const schemaItemList = [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${baseUrl}/`,
        },
        ...pathnames.map((value, index) => {
            const to = `/${pathnames.slice(0, index + 1).join('/')}`;
            const label = breadcrumbNameMap[value] || value.replace(/-/g, ' ');
            return {
                '@type': 'ListItem',
                position: index + 2,
                name: label,
                item: `${baseUrl}${to}`,
            };
        }),
    ];

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: schemaItemList,
    };

    return (
        <>
            <Helmet>
                <script type="application/ld+json">
                    {JSON.stringify(breadcrumbSchema)}
                </script>
            </Helmet>
            <nav className="container mx-auto px-4 py-2 text-xs flex items-center gap-2 text-gray-500 font-bold uppercase tracking-widest overflow-x-auto whitespace-nowrap">
                <Link to="/" className="hover:text-brand-400 transition">Home</Link>
                {pathnames.map((value, index) => {
                    const last = index === pathnames.length - 1;
                    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                    const label = breadcrumbNameMap[value] || value.replace(/-/g, ' ');

                    return last ? (
                        <span key={to} className="text-white flex items-center gap-2">
                            <ChevronRight className="w-3 h-3" /> {label}
                        </span>
                    ) : (
                        <span key={to} className="flex items-center gap-2">
                            <ChevronRight className="w-3 h-3" />
                            <Link to={to} className="hover:text-brand-400 transition">{label}</Link>
                        </span>
                    );
                })}
            </nav>
        </>
    );
};

export default Breadcrumbs;
