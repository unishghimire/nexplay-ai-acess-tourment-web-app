import React from 'react';
import { Helmet } from 'react-helmet-async';

// ponytail: One reusable SEO component — covers title, meta, canonical, OG, Twitter, JSON-LD
// No abstraction beyond what every public page needs.

const BASE_URL = 'https://nexplayorg.app';
const SITE_NAME = 'NexPlay';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.jpg`;

interface SeoProps {
    title: string;
    description: string;
    canonicalPath?: string;
    ogType?: string;
    ogImage?: string;
    jsonLd?: object | object[];
    noindex?: boolean;
    children?: React.ReactNode;
}

export const Seo: React.FC<SeoProps> = ({
    title,
    description,
    canonicalPath,
    ogType = 'website',
    ogImage = DEFAULT_OG_IMAGE,
    jsonLd,
    noindex = false,
    children,
}) => {
    const canonicalUrl = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined;
    const robotsContent = noindex ? 'noindex, follow' : 'index, follow';

    return (
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="robots" content={robotsContent} />
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            {/* Open Graph */}
            <meta property="og:type" content={ogType} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={ogImage} />
            {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />

            {/* JSON-LD Structured Data */}
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}

            {children}
        </Helmet>
    );
};

export default Seo;
