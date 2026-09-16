import Seo from '../../../shared/components/Seo';
import React from 'react';
import { Info, Users, Trophy, Zap } from 'lucide-react';
import Faq from '../../../shared/components/Faq';

const aboutFaqs = [
    {
        question: 'Who created NexPlay?',
        answer: 'NexPlay was created to provide a dedicated esports tournament platform for Nepal growing gaming community.',
    },
    {
        question: 'Is NexPlay only for Nepal?',
        answer: 'NexPlay is focused on Nepal esports ecosystem, but players from other regions can also participate in tournaments where permitted.',
    },
];

const About: React.FC = () => {
    return (
        <>
        <Seo
            title="About NexPlay — Nepal Esports Tournament Platform"
            description="NexPlay is a Nepal-focused esports tournament and scrim platform. Learn about our mission to grow Nepal's esports ecosystem."
            canonicalPath="/about"
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: "About NexPlay",
                description: "NexPlay is a Nepal-focused esports tournament and scrim platform.",
                url: "https://www.nexplayorg.app/about",
            }}
        />
        <div className="animate-fade-in max-w-4xl mx-auto space-y-6 px-1 sm:px-0">
            {/* Primary About Us Card */}
            <article className="bg-[#13192B] rounded-2xl p-5 sm:p-7 border border-[#1F293D] shadow-2xl relative overflow-hidden">
                {/* Ambient background glow */}
                <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                {/* Header: Icon + Title */}
                <div className="flex items-center gap-3 pb-4 border-b border-[#1F293D]">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-[#8B5CF6] shrink-0 shadow-inner">
                        <Info className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">About NexPlay</h1>
                        <p className="text-xs text-purple-300 font-medium">Nepal's Premier Esports Hub</p>
                    </div>
                </div>

                {/* Description Paragraphs */}
                <div className="mt-4 space-y-3.5 text-sm sm:text-base leading-relaxed text-slate-300">
                    <p>
                        Welcome to <strong className="text-white font-semibold">NexPlay</strong>, Nepal's premier esports tournament platform designed for gamers, by gamers. We are dedicated to elevating the esports ecosystem in Nepal by providing a professional, secure, and competitive environment for players to showcase their skills.
                    </p>
                    <p>
                        Founded in 2025, our mission is to bridge the gap between casual gaming and professional esports. Whether you play PUBG Mobile, Free Fire, or Mobile Legends, NexPlay offers daily tournaments, scrims, and major leagues with real cash prizes.
                    </p>
                </div>

                {/* Three Core Pillars */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Pillar 1: Community First */}
                    <div className="bg-[#0D1220] rounded-xl p-4 border border-[#1E273C] flex items-center sm:flex-col sm:text-center gap-3.5 hover:border-sky-500/40 transition group">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-white leading-tight">Community First</h2>
                            <p className="text-xs text-slate-400 mt-1 leading-snug">Building a safe and toxic-free environment.</p>
                        </div>
                    </div>

                    {/* Pillar 2: Fair Play */}
                    <div className="bg-[#0D1220] rounded-xl p-4 border border-[#1E273C] flex items-center sm:flex-col sm:text-center gap-3.5 hover:border-amber-500/40 transition group">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-white leading-tight">Fair Play</h2>
                            <p className="text-xs text-slate-400 mt-1 leading-snug">Advanced anti-cheat and strict moderation.</p>
                        </div>
                    </div>

                    {/* Pillar 3: Instant Payouts */}
                    <div className="bg-[#0D1220] rounded-xl p-4 border border-[#1E273C] flex items-center sm:flex-col sm:text-center gap-3.5 hover:border-purple-500/40 transition group">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-white leading-tight">Instant Payouts</h2>
                            <p className="text-xs text-slate-400 mt-1 leading-snug">Fast and secure prize distribution.</p>
                        </div>
                    </div>
                </div>
            </article>

            {/* FAQ section */}
            <Faq items={aboutFaqs} />
        </div>
        </>
    );
};

export default About;
