import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Trophy, Facebook, Instagram, Twitter, Youtube, Music2 } from 'lucide-react';

const socialLinks = [
    { href: 'https://www.facebook.com/nexplayorg', label: 'Facebook', Icon: Facebook, hoverBg: 'hover:bg-[#1877F2]', hoverBorder: 'hover:border-[#1877F2]' },
    { href: 'https://www.instagram.com/nexplayorg', label: 'Instagram', Icon: Instagram, hoverBg: 'hover:bg-[#E1306C]', hoverBorder: 'hover:border-[#E1306C]' },
    { href: 'https://twitter.com/nexplayorg', label: 'Twitter', Icon: Twitter, hoverBg: 'hover:bg-[#1DA1F2]', hoverBorder: 'hover:border-[#1DA1F2]' },
    { href: 'https://www.youtube.com/@nexplayorg', label: 'YouTube', Icon: Youtube, hoverBg: 'hover:bg-[#FF0000]', hoverBorder: 'hover:border-[#FF0000]' },
    { href: 'https://www.tiktok.com/@nexplayorg', label: 'TikTok', Icon: Music2, hoverBg: 'hover:bg-white', hoverBorder: 'hover:border-white', hoverText: 'group-hover:text-black' },
    { href: 'https://discord.gg/nexplay', label: 'Discord', Icon: MessageCircle, hoverBg: 'hover:bg-[#5865F2]', hoverBorder: 'hover:border-[#5865F2]' },
];

const Footer: React.FC = () => {
    return (
        <footer className="relative bg-dark border-t border-gray-800 py-10 mt-auto overflow-hidden">
            {/* Subtle brand-colored hairline along the very top edge */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent"></div>

            <div className="max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-8">
                    {/* Brand + Description */}
                    <div className="max-w-sm shrink-0">
                        <Link to="/" className="inline-flex items-center gap-2.5 mb-3 group">
                            <span className="bg-brand-500 text-white rounded-lg p-1.5 shrink-0 group-hover:scale-105 transition-transform">
                                <Trophy className="w-4 h-4" aria-hidden="true" />
                            </span>
                            <span className="font-black text-lg tracking-tight text-white">NexPlay</span>
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed">Nepal's esports platform for tournaments, scrims, and competitive gaming.</p>
                    </div>

                    {/* Company */}
                    <nav aria-label="Company links" className="shrink-0">
                        <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">Company</h3>
                        <ul className="space-y-1 text-sm">
                            <li><Link to="/about" className="text-gray-400 hover:text-white transition inline-block py-2">About Us</Link></li>
                            <li><Link to="/contact" className="text-gray-400 hover:text-white transition inline-block py-2">Contact</Link></li>
                            <li><Link to="/terms" className="text-gray-400 hover:text-white transition inline-block py-2">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="text-gray-400 hover:text-white transition inline-block py-2">Privacy Policy</Link></li>
                        </ul>
                    </nav>
                </div>

                {/* Social icons — authentic per-brand hover colors */}
                <div className="flex items-center justify-center gap-3 mb-6">
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

                <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm text-center md:text-left">
                        &copy; {new Date().getFullYear()} NexPlay. All rights reserved.
                    </p>
                    <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                        <a href="mailto:nexplayorg@gmail.com" className="hover:text-white transition flex items-center gap-2 py-1">
                            <Mail className="w-4 h-4" aria-hidden="true" /> nexplayorg@gmail.com
                        </a>
                        <a href="https://wa.me/+9779767783336" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-2 py-1">
                            <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
