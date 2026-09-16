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
    const isNewsActive = pathname === '/news' || pathname.startsWith('/post/');
    const isOrgsActive = pathname === '/organizations' || pathname.startsWith('/organization/');
    const isProfileActive = user
        ? (pathname === '/profile' || pathname === '/dashboard' || pathname === '/wallet' || pathname === '/complete-profile')
        : (pathname === '/login' || pathname === '/register');

    const navItems = [
        {
            name: 'Home',
            path: '/',
            isActive: isHomeActive,
            icon: (active: boolean) => (
                <Home
                    className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                        active
                            ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                            : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                    strokeWidth={active ? 2.4 : 1.9}
                />
            )
        },
        {
            name: 'Games',
            path: '/games',
            isActive: isGamesActive,
            icon: (active: boolean) => (
                <Gamepad2
                    className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                        active
                            ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                            : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                    strokeWidth={active ? 2.4 : 1.9}
                />
            )
        },
        {
            name: 'News',
            path: '/news',
            isActive: isNewsActive,
            icon: (active: boolean) => (
                <Newspaper
                    className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                        active
                            ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                            : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                    strokeWidth={active ? 2.4 : 1.9}
                />
            )
        },
        {
            name: 'Orgs',
            path: '/organizations',
            isActive: isOrgsActive,
            icon: (active: boolean) => (
                <Users
                    className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                        active
                            ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                            : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                    strokeWidth={active ? 2.4 : 1.9}
                />
            )
        },
        {
            name: 'Profile',
            path: user ? '/profile' : '/login',
            isActive: isProfileActive,
            icon: (active: boolean) => (
                user && profile?.profilePicUrl ? (
                    <div
                        className={`w-5 h-5 rounded-full overflow-hidden mb-0.5 border transition-all duration-200 ${
                            active
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
                            active
                                ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110'
                                : 'text-gray-400 group-hover:text-gray-200'
                        }`}
                        strokeWidth={active ? 2.4 : 1.9}
                    />
                )
            )
        }
    ];

    return (
        <nav
            aria-label="Mobile Bottom Navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e17]/95 backdrop-blur-xl border-t border-slate-800/80 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] pb-[max(env(safe-area-inset-bottom,0px),6px)]"
        >
            <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto px-1">
                {navItems.map((item) => (
                    <Link
                        key={item.name}
                        to={item.path}
                        aria-label={item.name}
                        title={item.name}
                        className={`flex flex-col items-center justify-center py-1 px-1 transition-all duration-200 active:scale-90 select-none group min-h-[48px] ${
                            item.isActive ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-slate-200 font-medium'
                        }`}
                    >
                        {item.icon(item.isActive)}
                        <span className={`text-[10px] tracking-tight transition-colors ${item.isActive ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>
                            {item.name}
                        </span>
                    </Link>
                ))}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
