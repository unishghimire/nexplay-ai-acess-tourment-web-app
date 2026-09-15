import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Gamepad2, Users, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const pathname = location.pathname;

    const navItems = [
        {
            name: 'Home',
            path: '/',
            icon: Home,
            isActive: pathname === '/'
        },
        {
            name: 'Games',
            path: '/games',
            icon: Gamepad2,
            isActive: pathname === '/games' || pathname.startsWith('/games/')
        },
        {
            name: 'Organizations',
            path: '/organizations',
            icon: Users,
            isActive: pathname === '/organizations' || pathname.startsWith('/organization/')
        },
        {
            name: 'Profile',
            path: user ? '/profile' : '/login',
            icon: User,
            isActive: user 
                ? (pathname === '/profile' || pathname === '/dashboard' || pathname === '/wallet' || pathname === '/complete-profile')
                : (pathname === '/login' || pathname === '/register')
        }
    ];

    return (
        <nav
            aria-label="Mobile Bottom Navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f172a]/95 backdrop-blur-2xl border-t border-gray-800/90 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] pb-[max(env(safe-area-inset-bottom,0px),4px)]"
        >
            <div className="grid grid-cols-4 items-center h-16 max-w-lg mx-auto px-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.isActive;
                    const isProfileItem = item.name === 'Profile';
                    const hasAvatar = isProfileItem && user && Boolean(profile?.profilePicUrl);

                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex flex-col items-center justify-center py-1 relative min-h-[48px] rounded-xl transition-all duration-200 active:scale-95 select-none group ${
                                active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            {/* Active top neon indicator bar */}
                            {active && (
                                <span className="absolute -top-1 w-7 h-1 rounded-full bg-brand-500 shadow-[0_0_10px_#8b5cf6]" />
                            )}

                            {/* Icon or Avatar */}
                            <div className="relative mb-1">
                                {hasAvatar ? (
                                    <div className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-transform duration-200 ${
                                        active ? 'border-brand-500 scale-110 shadow-[0_0_8px_rgba(139,92,246,0.6)]' : 'border-gray-700'
                                    }`}>
                                        <img
                                            src={profile!.profilePicUrl!}
                                            alt={profile?.username || 'User'}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                ) : (
                                    <Icon
                                        className={`w-5 h-5 transition-transform duration-200 ${
                                            active
                                                ? 'text-brand-400 scale-110 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]'
                                                : 'group-hover:scale-105'
                                        }`}
                                    />
                                )}
                            </div>

                            {/* Label */}
                            <span
                                className={`text-[10px] tracking-wider uppercase leading-none transition-colors ${
                                    active ? 'font-black text-white' : 'font-bold text-gray-400 group-hover:text-gray-200'
                                }`}
                            >
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
