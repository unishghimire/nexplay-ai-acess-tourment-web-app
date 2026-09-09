import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Gamepad2, Facebook, Instagram, Twitter, Youtube, Music2 } from 'lucide-react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-dark border-t border-gray-800 py-10 mt-auto">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-20 mb-8">
                    {/* Brand + Description */}
                    <div className="max-w-sm shrink-0">
                        <Link to="/" className="flex items-center gap-2 mb-3">
                            <span className="font-black text-lg tracking-tight text-white">NexPlay</span>
                        </Link>
                        <p className="text-gray-500 text-sm">Nepal's esports platform for tournaments, scrims, and competitive gaming.</p>
                    </div>

                    {/* Company */}
                    <nav aria-label="Company links" className="shrink-0">
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-1.5"><Gamepad2 className="w-4 h-4" aria-hidden="true" /> Company</h3>
                        <ul className="space-y-1 text-sm">
                            <li><Link to="/about" className="text-gray-400 hover:text-white transition inline-block py-2">About Us</Link></li>
                            <li><Link to="/contact" className="text-gray-400 hover:text-white transition inline-block py-2">Contact</Link></li>
                            <li><Link to="/terms" className="text-gray-400 hover:text-white transition inline-block py-2">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="text-gray-400 hover:text-white transition inline-block py-2">Privacy Policy</Link></li>
                        </ul>
                    </nav>
                </div>

                <div className="flex items-center justify-center gap-3 mb-6">
                    <a href="https://www.facebook.com/nexplayorg" target="_blank" rel="noopener noreferrer" aria-label="NexPlay on Facebook" className="text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 rounded-full p-2.5 transition-colors">
                        <Facebook className="w-4 h-4" aria-hidden="true" />
                    </a>
                    <a href="https://www.instagram.com/nexplayorg" target="_blank" rel="noopener noreferrer" aria-label="NexPlay on Instagram" className="text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 rounded-full p-2.5 transition-colors">
                        <Instagram className="w-4 h-4" aria-hidden="true" />
                    </a>
                    <a href="https://twitter.com/nexplayorg" target="_blank" rel="noopener noreferrer" aria-label="NexPlay on Twitter" className="text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 rounded-full p-2.5 transition-colors">
                        <Twitter className="w-4 h-4" aria-hidden="true" />
                    </a>
                    <a href="https://www.youtube.com/@nexplayorg" target="_blank" rel="noopener noreferrer" aria-label="NexPlay on YouTube" className="text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 rounded-full p-2.5 transition-colors">
                        <Youtube className="w-4 h-4" aria-hidden="true" />
                    </a>
                    <a href="https://www.tiktok.com/@nexplayorg" target="_blank" rel="noopener noreferrer" aria-label="NexPlay on TikTok" className="text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 rounded-full p-2.5 transition-colors">
                        <Music2 className="w-4 h-4" aria-hidden="true" />
                    </a>
                    <a href="https://discord.gg/nexplay" target="_blank" rel="noopener noreferrer" aria-label="NexPlay on Discord" className="text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 rounded-full p-2.5 transition-colors">
                        <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    </a>
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
