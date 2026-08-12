import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    if (pathnames.length === 0) return null;

    const breadcrumbNameMap: Record<string, string> = {
        'tournaments': 'Tournaments',
        'games': 'Games',
        'scrims': 'Scrims',
        'results': 'Results',
        'dashboard': 'Dashboard',
        'profile': 'Profile',
        'user': 'User',
        'teams': 'Teams',
        'team': 'Team Details',
        'leaderboard': 'Leaderboard',
        'admin': 'Admin Panel',
        'organizer': 'Organizer Panel',
        'organizations': 'Organizations',
        'news': 'News',
        'post': 'Article',
        'organization': 'Organization',
        'wallet': 'Wallet',
        'login': 'Login',
        'register': 'Register',
        'about': 'About',
        'contact': 'Contact',
        'privacy': 'Privacy',
        'terms': 'Terms',
        'complete-profile': 'Complete Profile',
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
