import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Trophy, Users, Gamepad2, BarChart3 } from 'lucide-react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-dark border-t border-gray-800 py-10 mt-auto">
            <div className="max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                    {/* Brand + Description */}
                    <div className="col-span-2 md:col-span-1">
                        <Link to="/" className="flex items-center gap-2 mb-3">
                            <span className="font-black text-lg tracking-tight text-white">NexPlay</span>
                        </Link>
                        <p className="text-gray-500 text-sm">Nepal's esports platform for tournaments, scrims, and competitive gaming.</p>
                    </div>

                    {/* Compete */}
                    <div>
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Compete</h3>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/tournaments" className="text-gray-400 hover:text-white transition">Tournaments</Link></li>
                            <li><Link to="/scrims" className="text-gray-400 hover:text-white transition">Scrims</Link></li>
                            <li><Link to="/leaderboard" className="text-gray-400 hover:text-white transition">Leaderboard</Link></li>
                            <li><Link to="/results" className="text-gray-400 hover:text-white transition">Results</Link></li>
                        </ul>
                    </div>

                    {/* Community */}
                    <div>
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-1.5"><Users className="w-4 h-4" /> Community</h3>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/teams" className="text-gray-400 hover:text-white transition">Teams</Link></li>
                            <li><Link to="/organizations" className="text-gray-400 hover:text-white transition">Organizations</Link></li>
                            <li><Link to="/games" className="text-gray-400 hover:text-white transition">Games</Link></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-1.5"><Gamepad2 className="w-4 h-4" /> Company</h3>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/about" className="text-gray-400 hover:text-white transition">About Us</Link></li>
                            <li><Link to="/contact" className="text-gray-400 hover:text-white transition">Contact</Link></li>
                            <li><Link to="/terms" className="text-gray-400 hover:text-white transition">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="text-gray-400 hover:text-white transition">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm text-center md:text-left">
                        &copy; {new Date().getFullYear()} NexPlay. All rights reserved.
                    </p>
                    <div className="flex gap-4 text-gray-400 text-sm">
                        <a href="mailto:nexplayorg@gmail.com" className="hover:text-white transition flex items-center gap-2">
                            <Mail className="w-4 h-4" /> nexplayorg@gmail.com
                        </a>
                        <a href="https://wa.me/+9779767783336" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
