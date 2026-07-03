import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Trophy, Users, Shield, Calendar, LogOut, Menu, X, ChevronLeft, CreditCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    backUrl?: string;
}

export default function DashboardLayout({ children, title, description, backUrl }: DashboardLayoutProps) {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isPowerOrg, setIsPowerOrg] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isAuthorized = profile?.role === 'organizer' || profile?.role === 'admin';

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <Shield className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-gray-400 max-w-md">You do not have the necessary permissions to access the Organizer Dashboard.</p>
            </div>
        );
    }

    const menuItems = [
        { name: 'Overview', path: '/organizer', icon: LayoutDashboard },
        // If we wanted sub-pages, we could add more, but for now we'll keep it unified or mapped here.
        // Actually, we can use URL hash or query params if it's a single page app.
    ];

    return (
        <div className="flex flex-col md:flex-row min-h-[90vh] bg-black rounded-[2rem] border border-gray-800 overflow-hidden shadow-2xl relative">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-72 bg-gray-950/50 border-r border-gray-800 p-8 z-10 shrink-0">
                <div className="flex items-center gap-4 mb-16">
                    <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                        <Shield className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">Organizer</h2>
                </div>

                <nav className="flex-1 space-y-3">
                    <NavLink 
                        to={'/organizer'} 
                        end
                        className={({ isActive }) => `flex items-center gap-4 px-6 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all ${isActive && !location.search ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
                    >
                        <LayoutDashboard className="w-5 h-5" /> Overview
                    </NavLink>
                    <NavLink 
                        to={'/organizer?tab=tournaments'} 
                        className={({ isActive }) => `flex items-center gap-4 px-6 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all ${location.search.includes('tab=tournaments') ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
                    >
                        <Trophy className="w-5 h-5" /> Tournaments
                    </NavLink>
                    <NavLink 
                        to={'/organizer?tab=scrims'} 
                        className={({ isActive }) => `flex items-center gap-4 px-6 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all ${location.search.includes('tab=scrims') ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
                    >
                        <Users className="w-5 h-5" /> Scrims
                    </NavLink>
                </nav>

                <div className="pt-8 border-t border-gray-800">
                     <button
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-4 w-full px-6 py-4 rounded-full text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-gray-800 transition-all border border-transparent hover:border-gray-800"
                     >
                         <LogOut className="w-5 h-5" /> Exit Panel
                     </button>
                </div>
            </aside>


            {/* Mobile Header Menu */}
            <div className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-gray-800 sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <Shield className="w-6 h-6 text-cyan-500" />
                    <span className="text-sm font-black text-white uppercase tracking-widest">Org Panel</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-400 hover:text-white">
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="md:hidden bg-gray-950 border-b border-gray-800 overflow-hidden"
                    >
                       <nav className="flex flex-col p-6 gap-3">
                            <NavLink 
                                to={'/organizer'} 
                                end
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) => `flex items-center gap-4 px-6 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all ${isActive && !location.search ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                            >
                                <LayoutDashboard className="w-5 h-5" /> Overview
                            </NavLink>
                            <NavLink 
                                to={'/organizer?tab=tournaments'} 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) => `flex items-center gap-4 px-6 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all ${location.search.includes('tab=tournaments') ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                            >
                                <Trophy className="w-5 h-5" /> Tournaments
                            </NavLink>
                            <NavLink 
                                to={'/organizer?tab=scrims'} 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) => `flex items-center gap-4 px-6 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all ${location.search.includes('tab=scrims') ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                            >
                                <Users className="w-5 h-5" /> Scrims
                            </NavLink>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-black z-0 overflow-y-auto custom-scrollbar h-full lg:h-[90vh]">
                {/* Content Header */}
                <header className="px-8 py-10 md:px-12 border-b border-gray-800 bg-black/80 sticky top-0 backdrop-blur-md z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div>
                        {backUrl && (
                            <button onClick={() => navigate(backUrl)} className="text-brand-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:text-brand-400 mb-4 transition-colors">
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                        )}
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase">{title}</h1>
                        {description && <p className="text-sm text-gray-500 font-bold mt-2 tracking-widest uppercase">{description}</p>}
                    </div>
                </header>

                <div className="p-8 md:p-12 flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}
