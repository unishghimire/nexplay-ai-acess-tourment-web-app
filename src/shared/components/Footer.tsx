import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, ArrowUp, Facebook, Instagram, Twitter, Youtube, Music2 } from 'lucide-react';

const socialLinks = [
    { href: 'https://www.facebook.com/nexplayorg', label: 'Facebook', Icon: Facebook, hoverBg: 'hover:bg-[#1877F2]', hoverBorder: 'hover:border-[#1877F2]' },
    { href: 'https://www.instagram.com/nexplayorg', label: 'Instagram', Icon: Instagram, hoverBg: 'hover:bg-[#E1306C]', hoverBorder: 'hover:border-[#E1306C]' },
    { href: 'https://twitter.com/nexplayorg', label: 'Twitter', Icon: Twitter, hoverBg: 'hover:bg-[#1DA1F2]', hoverBorder: 'hover:border-[#1DA1F2]' },
    { href: 'https://www.youtube.com/@nexplayorg', label: 'YouTube', Icon: Youtube, hoverBg: 'hover:bg-[#FF0000]', hoverBorder: 'hover:border-[#FF0000]' },
    { href: 'https://www.tiktok.com/@nexplayorg', label: 'TikTok', Icon: Music2, hoverBg: 'hover:bg-white', hoverBorder: 'hover:border-white', hoverText: 'group-hover:text-black' },
    { href: 'https://discord.gg/nexplay', label: 'Discord', Icon: MessageCircle, hoverBg: 'hover:bg-[#5865F2]', hoverBorder: 'hover:border-[#5865F2]' },
];

const badges = ["Nepal's #1 Esports Platform", 'Est. 2025'];

const Footer: React.FC = () => {
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    return (
        <footer className="relative bg-dark border-t border-gray-800 pt-10 pb-[52px] sm:pb-[60px] mt-auto overflow-hidden">
            {/* Subtle brand-colored hairline along the very top edge */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent"></div>

            <div className="max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 mb-8">
                    {/* Brand + Description + badges + socials */}
                    <div className="max-w-md shrink-0">
                        <Link to="/" className="inline-flex items-center gap-2.5 mb-3 group">
                            <img src="/logo.png" alt="NexPlay logo" loading="lazy" className="w-9 h-9 rounded-lg shrink-0 object-cover shadow-md group-hover:scale-105 transition-transform" />
                            <span className="font-black text-lg tracking-tight text-white">NexPlay</span>
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed mb-4">Nepal's esports platform for tournaments, scrims, and competitive gaming.</p>

                        <div className="flex flex-wrap items-center gap-2 mb-5">
                            {badges.map((label) => (
                                <span key={label} className="inline-flex items-center gap-1.5 border border-gray-700 rounded-full px-3 py-1.5 text-xs font-bold text-brand-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" aria-hidden="true"></span>
                                    {label}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            {socialLinks.map(({ href, label, Icon, hoverBg, hoverBorder, hoverText }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`NexPlay on ${label}`}
                                    className={`group text-gray-400 hover:text-white ${hoverBg} ${hoverBorder} border border-gray-800 rounded-full p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
                                >
                                    <Icon className={`w-4 h-4 ${hoverText ?? ''}`} aria-hidden="true" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Contact / info panel */}
                    <div className="shrink-0 md:min-w-[220px]">
                        <h3 className="text-brand-400 font-bold text-xs mb-3 uppercase tracking-widest">Contact</h3>
                        <p className="text-white font-bold">NexPlay Esports</p>
                        <p className="text-gray-500 text-sm mt-1">Nepal &bull; Founded 2025</p>
                        <p className="text-gray-500 text-sm">Built by gamers, for gamers</p>

                        <div className="border-t border-gray-800 my-4"></div>

                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Questions or support?</p>
                        <a href="https://wa.me/+9779767783336" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-semibold text-sm transition">
                            <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp: +977 976-7783336
                        </a>
                        <a href="mailto:nexplayorg@gmail.com" className="mt-2 flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
                            <Mail className="w-4 h-4" aria-hidden="true" /> nexplayorg@gmail.com
                        </a>
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={scrollToTop}
                            aria-label="Back to top"
                            className="text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 rounded-full p-2 transition-colors shrink-0"
                        >
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <p className="text-gray-500 text-sm text-center md:text-left">
                            &copy; {new Date().getFullYear()} NexPlay. All rights reserved. Nepal's esports platform.
                        </p>
                    </div>
                    <nav aria-label="Legal links" className="flex flex-wrap gap-4 text-gray-400 text-sm">
                        <Link to="/about" className="hover:text-white transition">About Us</Link>
                        <Link to="/contact" className="hover:text-white transition">Contact</Link>
                        <Link to="/terms" className="hover:text-white transition">Terms of Service</Link>
                        <Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link>
                    </nav>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
