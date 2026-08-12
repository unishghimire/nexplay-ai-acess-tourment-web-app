import React from 'react';
import SEO from '../../shared/components/Seo';

const News: React.FC = () => (
    <>
        <SEO
            title="Esports News Nepal — Latest Tournament Updates | NexPlay"
            description="Latest Nepal esports news, tournament announcements, match results, and community updates."
        />
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center max-w-2xl">
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white mb-4">
                    Esports News
                </h1>
                <p className="text-gray-400 font-medium">
                    Tournament recaps, announcements, and community news coming soon.
                </p>
            </div>
        </div>
    </>
);

export default News;
