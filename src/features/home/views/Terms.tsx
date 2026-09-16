import Seo from '../../../shared/components/Seo';
import React from 'react';
import { ShieldCheck, Mail, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';

const Terms: React.FC = () => {
    return (
        <>
        <Seo
            title="Terms of Service | NexPlay"
            description="Read NexPlay's terms of service for using Nepal's esports tournament platform."
            canonicalPath="/terms"
            noindex
        />
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4 px-1 sm:px-0">
            {/* Hero Card */}
            <div className="bg-[#13192B] border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400 shadow-inner">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Terms of Service</h1>
                        <p className="text-xs text-purple-300 font-medium mt-1">Last Updated: October 2025 • Official Competitive Regulations</p>
                    </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-4 pt-3 border-t border-slate-800/80">
                    Welcome to NexPlay Nepal. These Terms govern your access to and use of all NexPlay esports tournament systems, competitive scrims, official matchmaking, and wallet services. Please review them thoroughly before competing.
                </p>
            </div>

            {/* Section 1: Acceptance of Terms */}
            <section className="bg-[#12182b] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg hover:border-purple-500/30 transition duration-200">
                <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-xs border border-indigo-500/30">1</span>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">Acceptance of Terms</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    By registering for or using NexPlay (“we”, “our”, “us”), you agree to be bound by these Terms of Service. If you do not agree, you must not access or use the platform. These terms govern tournaments, scrims, team management, and match participation.
                </p>
            </section>

            {/* Section 2: User Eligibility & Code of Conduct */}
            <section className="bg-[#12182b] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg hover:border-purple-500/30 transition duration-200">
                <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs border border-purple-500/30">2</span>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">User Eligibility &amp; Code of Conduct</h2>
                </div>
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Zero Tolerance
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <CheckCircle2 className="w-3 h-3 text-amber-400" /> Fair Play Enforced
                    </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Users must provide accurate, complete, and current information when creating an account. Any form of cheating, use of unapproved game hacks/modifications, toxic behavior, matches collusion, or identity fraud is strictly prohibited and will result in an immediate permanent ban and forfeiture of wallet funds.
                </p>
            </section>

            {/* Section 3: Wallet, Entries, Escrow & Refunds */}
            <section className="bg-[#12182b] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg hover:border-purple-500/30 transition duration-200">
                <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">3</span>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">Wallet, Entries, Escrow &amp; Refunds</h2>
                </div>
                <div className="mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <Lock className="w-3 h-3 text-emerald-400" /> Protected Under Cryptographic Escrow
                    </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    NexPlay operates a tournament wallet system. Escrowed funds (entry fees) are locked during active tournaments. Refunds are only auto-credited if a tournament is officially cancelled by the tournament organizer or administration. In-game matches, payouts, and balances tracking remain protected under secure cryptographic server-side validation.
                </p>
            </section>

            {/* Section 4: Disclaimers & Limitation of Liability */}
            <section className="bg-[#12182b] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg hover:border-purple-500/30 transition duration-200">
                <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs border border-cyan-500/30">4</span>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">Disclaimers &amp; Limitation of Liability</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    We are not responsible for game server connectivity issues, hardware crashes, or network disconnects during third-party tournament gameplay. We facilitate esports matchmaking/hosting with fairness but are not liable for direct/indirect losses beyond active escrowed tournament funds.
                </p>
            </section>

            {/* Support Prompt Card */}
            <div className="bg-[#111628] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <Mail className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white">Questions about our terms?</h3>
                        <p className="text-[11px] text-slate-400">Contact legal &amp; support anytime</p>
                    </div>
                </div>
                <a
                    href="mailto:support@nexplay.gg"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors shrink-0 shadow-sm"
                >
                    Inquire
                </a>
            </div>
        </div>
        </>
    );
};

export default Terms;
