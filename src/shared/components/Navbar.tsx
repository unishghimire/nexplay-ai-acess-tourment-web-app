import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileDropdown from './navbar/ProfileDropdown';
import WalletDisplay from './navbar/WalletDisplay';
import NotificationDropdown from './navbar/NotificationDropdown';
import MobileMenu from './navbar/MobileMenu';

const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Games', path: '/games' },
    { name: 'Organizations', path: '/organizations' }
];

// ponytail: secondary links for mobile menu — kept out of the main navbar per hierarchical nav restructure
const secondaryLinks = [
    { name: 'Tournaments', path: '/tournaments' },
    { name: 'Scrims', path: '/scrims' },
    { name: 'Teams', path: '/teams' },
    { name: 'Leaderboard', path: '/leaderboard' },
    { name: 'News', path: '/news' }
];

const Navbar: React.FC = () => {
    const { user, profile, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav aria-label="Main navigation" className="sticky top-0 z-50 bg-dark/90 backdrop-blur-xl border-b border-gray-800 transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
                <div className="grid grid-cols-[auto_1fr_auto] items-center h-14 sm:h-20 gap-1 sm:gap-2">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-1.5 sm:gap-3 shrink-0 group">
                        <div className="relative w-7 h-7 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-[#151c33] p-0.5 border border-purple-500/40 shadow-inner flex items-center justify-center group-hover:border-purple-400 transition-colors">
                            <img src="/logo.png" alt="NexPlay Logo" className="w-full h-full rounded-md shrink-0 object-cover group-hover:scale-105 transition-transform" loading="eager" />
                        </div>
                        <span className="text-base sm:text-2xl font-black tracking-wider sm:tracking-widest text-white leading-none">NEX<span className="text-brand-500">PLAY</span></span>
                    </Link>

                    {/* Desktop nav links — lives in its own grid column, so it can never overlap
                        the logo or right section. Scrolls horizontally if it ever runs out of room
                        instead of spilling over neighboring columns (fix for navbar overlap bug). */}
                    <div className="hidden md:flex min-w-0 items-center justify-center">
                        <div className="flex items-center space-x-1 max-w-full overflow-x-auto no-scrollbar bg-dark/50 backdrop-blur-md px-2 py-1.5 rounded-full border border-gray-800/50 shadow-xl">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`px-3 xl:px-5 py-2.5 rounded-full text-sm font-bold transition-colors duration-200 flex items-center whitespace-nowrap ${isActive(link.path) ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right section */}
                    <div className="flex items-center justify-end gap-1 sm:gap-2.5 md:gap-4 shrink-0">
                        {user ? (
                            <>
                                <NotificationDropdown />
                                <div className="flex items-center">
                                    <WalletDisplay balance={(profile?.balance || 0) + (profile?.orgWalletBalance || 0)} onClick={() => navigate('/wallet')} />
                                </div>
                                <div>
                                    <ProfileDropdown username={profile?.username || 'User'} avatarUrl={profile?.profilePicUrl} onLogout={handleLogout} />
                                </div>
                            </>
                        ) : (
                            <div>
                                <Link to="/login" className="bg-brand-500 hover:bg-brand-600 text-white h-8 sm:h-11 px-3 sm:px-6 flex items-center justify-center rounded-full font-black tracking-wider sm:tracking-widest text-xs sm:text-sm transition-colors shadow-lg hover:shadow-brand-500/25 whitespace-nowrap shrink-0">
                                    LOGIN
                                </Link>
                            </div>
                        )}
                        {/* Mobile menu toggle */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden text-gray-400 hover:text-white transition-colors w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 flex items-center justify-center shrink-0"
                            aria-label="Toggle menu"
                            aria-expanded={isMobileMenuOpen}
                        >
                            {isMobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            <MobileMenu
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                navLinks={navLinks}
                secondaryLinks={secondaryLinks}
            />
        </nav>
    );
};

export default Navbar;
