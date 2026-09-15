import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Gamepad2, Users, Newspaper, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const pathname = location.pathname;

    const isHomeActive = pathname === '/';
    const isGamesActive = pathname === '/games' || pathname.startsWith('/games/');
    const isOrgsActive = pathname === '/organizations' || pathname.startsWith('/organization/');
    const isNewsActive = pathname === '/news' || pathname.startsWith('/post/');
    const isProfileActive = user
        ? (pathname === '/profile' || pathname === '/dashboard' || pathname === '/wallet' || pathname === '/complete-profile')
        : (pathname === '/login' || pathname === '/register');

    return (
        <nav
            aria-label="Mobile Bottom Navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f172a]/95 backdrop-blur-2xl border-t border-gray-800/90 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] pb-[max(env(safe-area-inset-bottom,0px),6px)]"
        >
            <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-2 relative">
                {/* 1. HOME */}
                <Link
                    to="/"
                    aria-label="Home"
                    title="Home"
                    className={`flex flex-col items-center justify-center py-2 relative transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isHomeActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    <Home
                        className={`w-6 h-6 transition-transform duration-200 ${
                            isHomeActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] text-white' : 'group-hover:scale-105'
                        }`}
                        strokeWidth={isHomeActive ? 2.4 : 1.8}
                    />
                    <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-300 ${
                            isHomeActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] opacity-100 scale-100' : 'opacity-0 scale-50'
                        }`}
                    />
                </Link>

                {/* 2. GAME */}
                <Link
                    to="/games"
                    aria-label="Games"
                    title="Games"
                    className={`flex flex-col items-center justify-center py-2 relative transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isGamesActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    <Gamepad2
                        className={`w-6 h-6 transition-transform duration-200 ${
                            isGamesActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] text-white' : 'group-hover:scale-105'
                        }`}
                        strokeWidth={isGamesActive ? 2.4 : 1.8}
                    />
                    <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-300 ${
                            isGamesActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] opacity-100 scale-100' : 'opacity-0 scale-50'
                        }`}
                    />
                </Link>

                {/* 3. CENTER ELEVATED ACTION BUTTON: ORGANIZATIONS */}
                <div className="flex flex-col items-center justify-center relative">
                    <Link
                        to="/organizations"
                        aria-label="Organizations"
                        title="Organizations"
                        className={`-mt-7 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 select-none ring-4 ring-[#0f172a] group ${
                            isOrgsActive
                                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-[0_0_24px_rgba(16,185,129,0.85)] scale-105'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_4px_16px_rgba(16,185,129,0.45)] hover:scale-105'
                        }`}
                    >
                        <Users className="w-6 h-6 transition-transform group-hover:scale-110" strokeWidth={2.2} />
                    </Link>
                    <span
                        className={`w-1.5 h-1.5 rounded-full mt-1 transition-all duration-300 ${
                            isOrgsActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] opacity-100 scale-100' : 'opacity-0 scale-50'
                        }`}
                    />
                </div>

                {/* 4. NEWS */}
                <Link
                    to="/news"
                    aria-label="News"
                    title="News"
                    className={`flex flex-col items-center justify-center py-2 relative transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isNewsActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    <Newspaper
                        className={`w-6 h-6 transition-transform duration-200 ${
                            isNewsActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] text-white' : 'group-hover:scale-105'
                        }`}
                        strokeWidth={isNewsActive ? 2.4 : 1.8}
                    />
                    <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-300 ${
                            isNewsActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] opacity-100 scale-100' : 'opacity-0 scale-50'
                        }`}
                    />
                </Link>

                {/* 5. PROFILE */}
                <Link
                    to={user ? '/profile' : '/login'}
                    aria-label="Profile"
                    title={user ? 'Profile' : 'Login'}
                    className={`flex flex-col items-center justify-center py-2 relative transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                        isProfileActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    {user && profile?.profilePicUrl ? (
                        <div
                            className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                                isProfileActive
                                    ? 'border-emerald-400 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
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
                            className={`w-6 h-6 transition-transform duration-200 ${
                                isProfileActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] text-white' : 'group-hover:scale-105'
                            }`}
                            strokeWidth={isProfileActive ? 2.4 : 1.8}
                        />
                    )}
                    <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-300 ${
                            isProfileActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] opacity-100 scale-100' : 'opacity-0 scale-50'
                        }`}
                    />
                </Link>
            </div>
        </nav>
    );
};

export default MobileBottomNav;
