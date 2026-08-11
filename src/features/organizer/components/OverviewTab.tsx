import React from 'react';
import {
  Trophy,
  Users,
  AlertTriangle,
  DollarSign,
  Radio,
  Shield,
  Activity,
} from 'lucide-react';
import { Tournament } from '../../../shared/types/types';

export interface OverviewTabProps {
  kpis: {
    activeTournaments: number;
    liveScrims: number;
    totalTeams: number;
    prizePool: number;
    monthlyRevenue: number;
    pendingPayouts: number;
    orgWalletBalance: number;
    escrowBalance: number;
    filledSlots: number;
    totalSlots: number;
  };
  activityFeed: {
    id: string;
    icon: string;
    text: string;
    time: string;
    type: string;
  }[];
  hostedTournaments: Tournament[] | any[];
}

const formatRupees = (amount: number = 0): string => {
  return `Rs. ${new Intl.NumberFormat('en-IN').format(amount)}`;
};

const renderIcon = (iconName: string) => {
  const normalized = (iconName || '').toLowerCase();
  if (normalized.includes('trophy')) {
    return <Trophy className="w-4 h-4 text-indigo-400 shrink-0" />;
  }
  if (normalized.includes('user')) {
    return <Users className="w-4 h-4 text-indigo-400 shrink-0" />;
  }
  if (normalized.includes('alert') || normalized.includes('warn')) {
    return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  }
  if (normalized.includes('dollar') || normalized.includes('money') || normalized.includes('pay')) {
    return <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />;
  }
  if (normalized.includes('radio') || normalized.includes('broadcast')) {
    return <Radio className="w-4 h-4 text-indigo-400 shrink-0" />;
  }
  if (normalized.includes('shield')) {
    return <Shield className="w-4 h-4 text-indigo-400 shrink-0" />;
  }
  return <Activity className="w-4 h-4 text-indigo-400 shrink-0" />;
};

const renderStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    );
  }
  if (s === 'upcoming' || s === 'published' || s === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-gray-300 border border-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  }
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-gray-500 border border-zinc-800">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-gray-400 border border-zinc-700">
      {status || 'Unknown'}
    </span>
  );
};

const OverviewTab: React.FC<OverviewTabProps> = ({
  kpis = {
    activeTournaments: 0,
    liveScrims: 0,
    totalTeams: 0,
    prizePool: 0,
    monthlyRevenue: 0,
    pendingPayouts: 0,
    orgWalletBalance: 0,
    escrowBalance: 0,
    filledSlots: 0,
    totalSlots: 0,
  },
  activityFeed = [],
  hostedTournaments = [],
}) => {
  return (
    <div className="space-y-6 bg-[#09090b] text-gray-200 text-sm p-2 sm:p-4 rounded-lg">
      {/* Top Bar with Demo Mode Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Key metrics and real-time activity for your esports organization.
          </p>
        </div>
      </div>

      {/* 1. KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Tournaments */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Active Tournaments
          </div>
          <div className="text-2xl font-semibold text-white mt-2">
            {kpis?.activeTournaments ?? 0}
          </div>
        </div>

        {/* Live Scrims with Green Dot */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Scrims</span>
          </div>
          <div className="text-2xl font-semibold text-white mt-2">
            {kpis?.liveScrims ?? 0}
          </div>
        </div>

        {/* Total Teams */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Total Teams
          </div>
          <div className="text-2xl font-semibold text-white mt-2">
            {kpis?.totalTeams ?? 0}
          </div>
        </div>

        {/* Prize Pool */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Prize Pool
          </div>
          <div className="text-2xl font-semibold text-white mt-2">
            {formatRupees(kpis?.prizePool ?? 0)}
          </div>
        </div>
      </div>

      {/* 2. Two-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (lg:col-span-2): Live Tournaments Data Table */}
        <div className="lg:col-span-2 bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Live Tournaments</h3>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="pb-3 font-medium">Tournament</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Teams</th>
                  <th className="pb-3 font-medium text-right">Prize Pool</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {hostedTournaments && hostedTournaments.length > 0 ? (
                  hostedTournaments.map((tournament, idx) => {
                    const current =
                      tournament.currentPlayers ?? tournament.filledSlots ?? 0;
                    const max = tournament.slots ?? tournament.totalSlots ?? 0;
                    return (
                      <tr
                        key={tournament.id || `tournament-${idx}`}
                        className="border-b border-gray-800 hover:bg-gray-900/30 transition-colors"
                      >
                        <td className="py-3.5 pr-4">
                          <div className="font-medium text-white">
                            {tournament.title || 'Untitled Tournament'}
                          </div>
                          {tournament.game && (
                            <div className="text-xs text-gray-500">
                              {tournament.game}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-2 whitespace-nowrap">
                          {renderStatusBadge(tournament.status)}
                        </td>
                        <td className="py-3.5 px-2 text-gray-300 font-mono text-xs whitespace-nowrap">
                          {current}/{max}
                        </td>
                        <td className="py-3.5 pl-2 text-right font-medium text-white whitespace-nowrap">
                          {formatRupees(tournament.prizePool || 0)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-xs text-gray-500"
                    >
                      No tournaments available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Recent Activity</h3>
          </div>

          <div className="divide-y divide-gray-800">
            {activityFeed && activityFeed.length > 0 ? (
              activityFeed.map((item) => (
                <div
                  key={item.id}
                  className="py-3 border-b border-gray-800 last:border-b-0 flex items-start gap-3"
                >
                  <div className="p-1.5 rounded-md bg-gray-900 border border-gray-800 mt-0.5">
                    {renderIcon(item.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug">
                      {item.text}
                    </p>
                    <span className="text-xs text-gray-500 mt-0.5 block">
                      {item.time}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-gray-500">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
