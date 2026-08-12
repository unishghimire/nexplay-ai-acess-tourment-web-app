// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ROADMAP — Dynamic, data-driven, responsive
// Uses computeRoadmap() from tournamentEngine — no hardcoded stages.
// ponytail: derive from state, never store derived data.
// ═══════════════════════════════════════════════════════════════

import { Tournament } from '../../../shared/types/types';
import { computeRoadmap, computeTournamentProgress, getCurrentStage, getNextStage } from '../../../shared/services/tournamentEngine';

interface Props {
    tournament: Tournament;
    compact?: boolean;
}

export function TournamentRoadmap({ tournament, compact = false }: Props) {
    const stages = computeRoadmap(tournament);
    const progress = computeTournamentProgress(tournament);
    const currentStage = getCurrentStage(tournament);
    const nextStage = getNextStage(tournament);

    if (stages.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 text-sm">
                No roadmap configured yet.
            </div>
        );
    }

    const statusConfig = {
        completed: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Completed', icon: '✓' },
        current: { dot: 'bg-brand-500', text: 'text-brand-400', label: 'Current', icon: '●' },
        active: { dot: 'bg-brand-500', text: 'text-brand-400', label: 'Active', icon: '●' },
        upcoming: { dot: 'bg-gray-600', text: 'text-gray-400', label: 'Upcoming', icon: '○' },
        pending: { dot: 'bg-gray-700', text: 'text-gray-500', label: 'Pending', icon: '○' },
    };

    return (
        <div className="w-full">
            {/* Progress header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tournament Roadmap</h3>
                <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-400">{progress}%</span>
                </div>
            </div>

            {/* Mobile: vertical timeline / Desktop: horizontal flow */}
            <div className="flex flex-col lg:flex-row lg:items-start gap-2 lg:gap-1 overflow-x-auto">
                {stages.map((stage, idx) => {
                    const config = statusConfig[stage.status] || statusConfig.pending;
                    const isLast = idx === stages.length - 1;

                    return (
                        <div key={idx} className="flex lg:flex-col items-start lg:items-center gap-2 lg:gap-1 min-w-0 lg:flex-1">
                            {/* Connector line — desktop only */}
                            {idx > 0 && (
                                <div className={`hidden lg:block h-8 w-0.5 ${stage.status === 'completed' || stage.status === 'current' ? 'bg-brand-500' : 'bg-gray-800'}`} />
                            )}

                            {/* Stage card */}
                            <div className={`flex-1 lg:w-full rounded-lg border p-2.5 lg:p-3 ${
                                stage.status === 'current' || stage.status === 'active'
                                    ? 'bg-card border-brand-500/50'
                                    : stage.status === 'completed'
                                        ? 'bg-card border-emerald-500/30'
                                        : 'bg-card border-gray-800'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${config.text}`}>{config.icon}</span>
                                    <span className={`text-xs font-bold truncate ${stage.status === 'completed' ? 'text-gray-400' : 'text-white'}`}>
                                        {stage.label}
                                    </span>
                                </div>

                                {!compact && (
                                    <div className="mt-1.5 space-y-0.5">
                                        {/* Stats — only show if they have real data */}
                                        {stage.participantCount !== undefined && stage.participantCount > 0 && (
                                            <p className="text-[10px] text-gray-500">{stage.participantCount} participants</p>
                                        )}
                                        {stage.groupCount !== undefined && stage.groupCount > 0 && (
                                            <p className="text-[10px] text-gray-500">{stage.groupCount} groups</p>
                                        )}
                                        {stage.matchCount !== undefined && stage.matchCount > 0 && (
                                            <p className="text-[10px] text-gray-500">{stage.completedMatches || 0}/{stage.matchCount} matches</p>
                                        )}
                                        {stage.qualifiedCount !== undefined && stage.qualifiedCount > 0 && (
                                            <p className="text-[10px] text-emerald-500">{stage.qualifiedCount} qualified</p>
                                        )}
                                        {stage.progressPercent > 0 && stage.status !== 'completed' && (
                                            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
                                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${stage.progressPercent}%` }} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <p className={`text-[10px] mt-1 ${config.text}`}>{config.label}</p>
                            </div>

                            {/* Connector arrow — mobile only */}
                            {!isLast && (
                                <div className="lg:hidden text-gray-700 text-xs pl-3">↓</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Current + Next summary */}
            {!compact && (currentStage || nextStage) && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    {currentStage && (
                        <div className="flex-1 rounded-lg bg-card border border-brand-500/30 p-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Current Stage</p>
                            <p className="text-sm font-bold text-white">{currentStage.label}</p>
                            <p className="text-xs text-gray-400">
                                {currentStage.completedMatches !== undefined && currentStage.matchCount
                                    ? `${currentStage.completedMatches}/${currentStage.matchCount} matches`
                                    : currentStage.status}
                            </p>
                        </div>
                    )}
                    {nextStage && (
                        <div className="flex-1 rounded-lg bg-card border border-gray-800 p-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Next Stage</p>
                            <p className="text-sm font-bold text-gray-300">{nextStage.label}</p>
                            <p className="text-xs text-gray-500">{nextStage.status}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
