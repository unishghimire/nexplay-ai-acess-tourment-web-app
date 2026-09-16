import Seo from '../../../shared/components/Seo';
import React from 'react';
import { ShieldCheck, Info, Database, User, CreditCard, Activity, Lock, Settings } from 'lucide-react';

const Privacy: React.FC = () => {
    return (
        <>
        <Seo
            title="Privacy Policy | NexPlay"
            description="Read NexPlay's privacy policy. Learn how we handle your data on Nepal's esports tournament platform."
            canonicalPath="/privacy"
            noindex
        />
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4 px-1 sm:px-0">
            {/* Hero Card */}
            <div className="bg-[#0e1322] border border-[#1a233a] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0 text-violet-400 shadow-inner">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Privacy Policy</h1>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20 mt-1">
                            Last Updated: October 2025
                        </span>
                    </div>
                </div>
                {/* Intro summary tag */}
                <div className="mt-4 px-3.5 py-2 rounded-xl bg-[#090d18] border border-[#1d273f] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-xs font-medium text-slate-300">
                        Your Data &amp; Privacy Protection at <span className="text-white font-semibold">NexPlay</span>
                    </p>
                </div>
            </div>

            {/* Section 1: Introduction */}
            <section className="rounded-2xl bg-[#0e1322] border border-[#1a233a] p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs">
                        <Info className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">1. Introduction</h2>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-300 font-normal">
                    NexPlay (“we”, “our”, “us”) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our platform for hosting and participating in tournaments and scrims.
                </p>
            </section>

            {/* Section 2: Information We Collect */}
            <section className="rounded-2xl bg-[#0e1322] border border-[#1a233a] p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs">
                        <Database className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">2. Information We Collect</h2>
                </div>

                {/* Sub-item: Account Information */}
                <div className="p-3.5 rounded-xl bg-[#090d19] border border-[#172138] flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            Account Information
                        </span>
                        <p className="text-xs sm:text-sm text-slate-300 leading-snug">
                            Username, email address, phone number, and In-Game IDs.
                        </p>
                    </div>
                </div>

                {/* Sub-item: Transaction Data */}
                <div className="p-3.5 rounded-xl bg-[#090d19] border border-[#172138] flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Transaction Data
                        </span>
                        <p className="text-xs sm:text-sm text-slate-300 leading-snug">
                            Details of deposits, tournament escrow reservations, and withdrawals.
                        </p>
                    </div>
                </div>

                {/* Sub-item: Usage Data */}
                <div className="p-3.5 rounded-xl bg-[#090d19] border border-[#172138] flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Usage Data
                        </span>
                        <p className="text-xs sm:text-sm text-slate-300 leading-snug">
                            Information about how you interact with our tournaments, scrims, and matchmaking features.
                        </p>
                    </div>
                </div>
            </section>

            {/* Section 3: How We Use Your Information */}
            <section className="rounded-2xl bg-[#0e1322] border border-[#1a233a] p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs">
                        <Settings className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">3. How We Use Your Information</h2>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-300 font-normal">
                    We use the information we collect to provide, maintain, and improve our services, to process transactions, and to communicate with you about tournaments, scrim slots, and updates.
                </p>
            </section>

            {/* Security Guarantee Callout */}
            <div className="rounded-2xl bg-gradient-to-r from-violet-950/40 via-[#10172a] to-slate-900 border border-violet-500/30 p-4 flex items-center gap-3.5 shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-400/40 flex items-center justify-center text-violet-300 shrink-0">
                    <Lock className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm leading-relaxed text-slate-200">
                    <span className="font-bold text-violet-300 block mb-0.5">End-to-End Encryption</span>
                    Strict Anti-Cheat Data Integrity • Never Sold to Third Parties
                </div>
            </div>
        </div>
        </>
    );
};

export default Privacy;
