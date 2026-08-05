import React from 'react';
import DashboardOverview from '../../../dashboard/components/DashboardOverview';
import { Tournament } from '../../../../shared/types/types';

export interface StatItem {
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
}

interface OverviewTabProps {
    stats: StatItem[];
    hostedTournaments: Tournament[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ stats, hostedTournaments }) => {
    return (
        <>
            {/* Stats Summary Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-gray-950/50 p-8 rounded-[2rem] border border-gray-800">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`p-3 rounded-2xl bg-gray-900 border border-gray-800 ${stat.color}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <h3 className="text-4xl font-black text-white font-mono tracking-tighter">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* Dashboard Overview Box */}
            <div className="bg-gray-950/50 rounded-[2rem] border border-gray-800 p-8">
                <DashboardOverview hostedTournaments={hostedTournaments} />
            </div>
        </>
    );
};

export default OverviewTab;
