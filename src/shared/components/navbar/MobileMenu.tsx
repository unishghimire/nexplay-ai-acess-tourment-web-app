import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Wallet, Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/utils';
import { usePwaInstall } from '../../hooks/usePwaInstall';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    navLinks: { name: string; path: string }[];
    secondaryLinks?: { name: string; path: string }[];
}

/**
 * Slide-down mobile menu for the Navbar. Renders nav links, account section
 * (when logged in), or login CTA (when logged out).
 */
const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, navLinks, secondaryLinks = [] }) => {
    const { user, profile, logout } = useAuth();
    const { isInstalled, promptInstall } = usePwaInstall();
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/');
        onClose();
    };

    const handleInstallClick = () => {
        void promptInstall();
        onClose();
    };

    return (
        <div className={`md:hidden absolute top-[100%] left-0 w-full transition-colors duration-300 ease-in-out bg-dark/95 backdrop-blur-xl border-t border-gray-800 ${isOpen ? 'max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-5rem)] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 pointer-events-none border-t-0 overflow-hidden'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-2" inert={!isOpen}>
                {/* Native App Installation Action Card */}
                <div className="mb-3">
                    {isInstalled ? (
                        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>NexPlay App Installed &amp; Ready</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleInstallClick}
                            className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/40 hover:border-purple-400 text-white transition-all active:scale-[0.98] shadow-lg shadow-purple-950/40 group"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0 group-hover:scale-105 transition-transform">
                                    <Smartphone className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-black uppercase tracking-wider text-white">Install Mobile App</div>
                                    <div className="text-[10px] text-slate-400">Add to Home Screen for native experience</div>
                                </div>
                            </div>
                            <span className="px-3 py-1.5 rounded-xl bg-purple-600 group-hover:bg-purple-500 text-white text-[11px] font-black uppercase tracking-wider shadow-md shadow-purple-900/50 flex items-center gap-1 shrink-0">
                                <Download className="w-3 h-3" />
                                Install
                            </span>
                        </button>
                    )}
                </div>

                {user && (
                    <div className="flex sm:hidden items-center p-4 gap-4 mb-4 bg-surface/20 rounded-xl border border-gray-800/50">
                        <div className="w-12 h-12 shrink-0 bg-brand-700 rounded-full flex items-center justify-center font-bold text-lg ring-2 ring-brand-500 overflow-hidden">
                            {profile?.profilePicUrl ? <img src={profile.profilePicUrl} className="w-full h-full object-cover" alt="Avatar" loading="lazy" /> : (profile?.username || 'U')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="font-bold text-white truncate text-lg">{(profile?.username || 'User')}</div>
                            <div className="text-sm font-black text-brand-400 mt-1 cursor-pointer flex items-center gap-1 w-max px-3 py-2 bg-brand-900/20 touch-target rounded-lg hover:bg-brand-900/40 transition" onClick={() => { navigate('/wallet'); onClose(); }}>
                                <Wallet className="w-4 h-4" />
                                {formatCurrency(profile?.balance || 0)}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Navigation</div>
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            onClick={onClose}
                            className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${isActive(link.path) ? 'text-brand-400 bg-brand-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                {secondaryLinks.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-gray-800 space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Explore</div>
                        {secondaryLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={onClose}
                                className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${isActive(link.path) ? 'text-brand-400 bg-brand-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>
                )}

                {user ? (
                    <div className="pt-4 mt-4 border-t border-gray-800 space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Account</div>
                        <Link to="/dashboard" onClick={onClose} className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                            Dashboard
                        </Link>
                        <Link to="/profile" onClick={onClose} className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                            My Profile
                        </Link>
                        <Link to="/wallet" onClick={onClose} className="block sm:hidden px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                            My Wallet
                        </Link>
                        <button type="button" onClick={handleLogout} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-2">
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <div className="pt-4 mt-4 border-t border-gray-800 sm:hidden">
                        <Link to="/login" onClick={onClose} className="flex items-center justify-center w-full bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-full font-black tracking-widest text-sm transition-colors shadow-lg hover:shadow-brand-500/25">
                            LOGIN / SIGN UP
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileMenu;
