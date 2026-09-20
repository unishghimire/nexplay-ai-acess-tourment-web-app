import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Gamepad2, LayoutDashboard, Users, Newspaper, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const pathname = location.pathname;

    const isHomeActive = pathname === '/';
    const isGamesActive = pathname === '/games' || pathname.startsWith('/games/');
    const isDashboardActive = pathname === '/dashboard';
    const isNewsActive = pathname === '/news' || pathname.startsWith('/post/');
    const isOrgsActive = pathname === '/organizations' || pathname.startsWith('/organizations/') || pathname.startsWith('/organization/');
    const isProfileActive = user
        ? (pathname === '/profile' || pathname === '/wallet' || pathname === '/complete-profile')
        : (pathname === '/login' || pathname === '/register');

    return (
        <nav
            aria-label="Mobile Bottom Navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e17]/95 backdrop-blur-xl border-t border-slate-800/80 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] pb-[max(env(safe-area-inset-bottom,0px),6px)]"
        >
            <div className="grid grid-cols-6 items-center h-14 max-w-lg mx-auto px-0.5">
                {/* 1. Home */}
                <Link
                    to="/"
                    aria-label="Home"
                    title="Home"
                    className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isHomeActive ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-slate-200 font-medium'
                    }`}
                >
                    <Home
                        className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                            isHomeActive
                                ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                                : 'text-gray-400 group-hover:text-gray-200'
                        }`}
                        strokeWidth={isHomeActive ? 2.4 : 1.9}
                    />
                    <span className={`text-[9px] sm:text-[10px] tracking-tight transition-colors truncate max-w-[48px] text-center ${isHomeActive ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>
                        Home
                    </span>
                </Link>

                {/* 2. Games */}
                <Link
                    to="/games"
                    aria-label="Games"
                    title="Games"
                    className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isGamesActive ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-slate-200 font-medium'
                    }`}
                >
                    <Gamepad2
                        className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                            isGamesActive
                                ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                                : 'text-gray-400 group-hover:text-gray-200'
                        }`}
                        strokeWidth={isGamesActive ? 2.4 : 1.9}
                    />
                    <span className={`text-[9px] sm:text-[10px] tracking-tight transition-colors truncate max-w-[48px] text-center ${isGamesActive ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>
                        Games
                    </span>
                </Link>

                {/* 3. Dashboard */}
                <Link
                    to={user ? '/dashboard' : '/login'}
                    aria-label="Dashboard"
                    title="Dashboard"
                    className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isDashboardActive ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-slate-200 font-medium'
                    }`}
                >
                    <LayoutDashboard
                        className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                            isDashboardActive
                                ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                                : 'text-gray-400 group-hover:text-gray-200'
                        }`}
                        strokeWidth={isDashboardActive ? 2.4 : 1.9}
                    />
                    <span className={`text-[8.5px] sm:text-[10px] tracking-tight transition-colors truncate max-w-[52px] text-center ${isDashboardActive ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>
                        Dashboard
                    </span>
                </Link>

                {/* 4. News */}
                <Link
                    to="/news"
                    aria-label="News"
                    title="News"
                    className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isNewsActive ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-slate-200 font-medium'
                    }`}
                >
                    <Newspaper
                        className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                            isNewsActive
                                ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                                : 'text-gray-400 group-hover:text-gray-200'
                        }`}
                        strokeWidth={isNewsActive ? 2.4 : 1.9}
                    />
                    <span className={`text-[9px] sm:text-[10px] tracking-tight transition-colors truncate max-w-[48px] text-center ${isNewsActive ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>
                        News
                    </span>
                </Link>

                {/* 5. Orgs */}
                <Link
                    to="/organizations"
                    aria-label="Organizations"
                    title="Organizations"
                    className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isOrgsActive ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-slate-200 font-medium'
                    }`}
                >
                    <Users
                        className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                            isOrgsActive
                                ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                                : 'text-gray-400 group-hover:text-gray-200'
                        }`}
                        strokeWidth={isOrgsActive ? 2.4 : 1.9}
                    />
                    <span className={`text-[9px] sm:text-[10px] tracking-tight transition-colors truncate max-w-[48px] text-center ${isOrgsActive ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>
                        Orgs
                    </span>
                </Link>

                {/* 6. Profile */}
                <Link
                    to={user ? '/profile' : '/login'}
                    aria-label={user ? 'Profile' : 'Login'}
                    title={user ? 'Profile' : 'Login'}
                    className={`flex flex-col items-center justify-center py-1 px-0.5 transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isProfileActive ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-slate-200 font-medium'
                    }`}
                >
                    {user && profile?.profilePicUrl ? (
                        <div
                            className={`w-5 h-5 rounded-full overflow-hidden mb-0.5 border transition-all duration-200 ${
                                isProfileActive
                                    ? 'border-brand-400 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                                    : 'border-gray-600 group-hover:border-gray-400'
                            }`}
                        >
                            <img
                                src={profile.profilePicUrl}
                                alt={profile?.username || 'User'}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    ) : (
                        <User
                            className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                                isProfileActive
                                    ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                                    : 'text-gray-400 group-hover:text-gray-200'
                            }`}
                            strokeWidth={isProfileActive ? 2.4 : 1.9}
                        />
                    )}
                    <span className={`text-[9px] sm:text-[10px] tracking-tight transition-colors truncate max-w-[48px] text-center ${isProfileActive ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>
                        {user ? 'Profile' : 'Login'}
                    </span>
                </Link>
            </div>
        </nav>
    );
};

export default MobileBottomNav;

