import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Play, Users, Clock, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { Tournament } from '../../../shared/types/types';

interface DashboardOverviewProps {
    hostedTournaments: Tournament[];
}

export default function DashboardOverview({ hostedTournaments }: DashboardOverviewProps) {
    const stats = {
        total: hostedTournaments.length,
        live: hostedTournaments.filter(t => t.status === 'live').length,
        completed: hostedTournaments.filter(t => t.status === 'completed').length,
        totalTeams: hostedTournaments.reduce((acc, t) => acc + (t.currentPlayers || 0), 0),
        pendingActions: hostedTournaments.filter(t => t.status === 'upcoming').length
    };

    const simulatedActivities = [
        { id: 1, time: '2 mins ago', action: 'Team Liquid registered for ESL Pro League' },
        { id: 2, time: '15 mins ago', action: 'Automated grouping generated for Scrim Block A' },
        { id: 3, time: '1 hour ago', action: 'Match #402 results submitted and verified' },
        { id: 4, time: '3 hours ago', action: 'You created a new tournament: Winter Clash 2026' }
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                    { label: 'Total Hosted', value: stats.total, icon: Trophy, color: 'text-brand-500', bg: 'bg-brand-500/10', border: 'border-brand-500/20', trend: '+12%', isUp: true },
                    { label: 'Live Now', value: stats.live, icon: Play, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', trend: 'Steady', isUp: true },
                    { label: 'Completed', value: stats.completed, icon: Trophy, color: 'text-gray-500', bg: 'bg-gray-800', border: 'border-gray-800', trend: '+1', isUp: true },
                    { label: 'Total Teams', value: stats.totalTeams, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', trend: '+24%', isUp: true },
                    { label: 'Pending Actions', value: stats.pendingActions, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', trend: '-2', isUp: false },
                ].map((stat, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`bg-gray-950/50 p-6 rounded-[2rem] border ${stat.border} hover:border-brand-500/50 transition-all duration-300 group`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300 relative`}>
                                <stat.icon className="w-6 h-6 relative z-10" />
                                {stat.label === 'Live Now' && <div className="absolute inset-0 rounded-2xl bg-green-500/30 animate-pulse"></div>}
                            </div>
                            <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${stat.isUp ? 'text-green-400' : 'text-red-400'}`}>
                                {stat.isUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                                {stat.trend}
                            </div>
                        </div>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</p>
                        <h3 className="text-4xl font-black text-white tracking-tighter font-mono">{stat.value}</h3>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gray-950/50 rounded-[2rem] border border-gray-800 p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Live Activity Feed</h3>
                        <Activity className="w-6 h-6 text-brand-500" />
                    </div>
                    <div className="space-y-6">
                        {simulatedActivities.map(activity => (
                            <div key={activity.id} className="flex gap-6 items-start pb-6 border-b border-gray-800 last:border-0 last:pb-0">
                                <div className="w-3 h-3 mt-1.5 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(var(--brand-500),0.8)]"></div>
                                <div>
                                    <p className="text-sm text-gray-300 font-bold tracking-wide">{activity.action}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-2 font-mono">{activity.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-gray-950/50 rounded-[2rem] border border-gray-800 p-8 flex items-center justify-center text-center">
                    <div>
                        <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-800">
                            <Trophy className="w-12 h-12 text-gray-700" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">System Status</h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">All services operational</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
