import React from 'react';
import { motion } from 'motion/react';
import { Tournament } from '../../../shared/types/types';
import { CheckCircle2, Circle, ArrowRight, Flag, Layers3, MapPinned } from 'lucide-react';
import { formatDate } from '../../../shared/utils/utils';

interface RoadmapViewProps {
    tournament: Tournament;
}

const RoadmapView: React.FC<RoadmapViewProps> = ({ tournament }) => {
    const currentRound = Number(tournament.currentRound || 0);

    // If roadmap doesn't exist, generate a default one based on status
    const roadmap = tournament.roadmap?.length ? tournament.roadmap.map((step, idx) => ({
        id: `step-${idx}`,
        label: step.stageName || `Round ${step.roundNumber}`,
        status: step.status || (currentRound === step.roundNumber ? 'current' : (currentRound > step.roundNumber ? 'completed' : 'upcoming')),
        date: step.date,
        description: step.description || `${step.numGroups} Groups • Top ${step.qualificationRule} Qualify`,
        maps: step.maps || []
    })) : [
        { id: 'reg', label: 'Registration', status: tournament.status === 'upcoming' ? 'current' : 'completed', date: tournament.startTime, description: 'Open for all eligible players', maps: [] },
        { id: 'group', label: 'Group Stage', status: tournament.status === 'live' ? 'current' : (tournament.status === 'completed' ? 'completed' : 'upcoming'), description: 'Qualifying matches for knockout', maps: [] },
        { id: 'final', label: 'Grand Finals', status: tournament.status === 'completed' ? 'completed' : 'upcoming', description: 'The battle for the championship', maps: [] },
    ];

    const totalSteps = roadmap.length;
    const completedSteps = roadmap.filter(step => step.status === 'completed').length;
    const currentStep = roadmap.find(step => step.status === 'current');
    const nextStep = roadmap.find(step => step.status === 'upcoming');
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return (
        <div className="py-8 space-y-8">
            <div className="rounded-[2rem] border border-gray-800 bg-surface p-6 md:p-8 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-brand-200">
                            <MapPinned className="h-4 w-4" /> Tournament Roadmap
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">
                            Stage progression and public timeline
                        </h3>
                        <p className="max-w-2xl text-sm md:text-base text-gray-400 font-medium leading-7">
                            Track how the tournament moves from registration to the final stage using the roadmap configured by the organizer.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 w-full lg:w-auto lg:min-w-[34rem]">
                        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Stages</div>
                            <div className="mt-2 text-2xl font-black text-white">{totalSteps}</div>
                        </div>
                        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Completed</div>
                            <div className="mt-2 text-2xl font-black text-green-400">{completedSteps}</div>
                        </div>
                        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Current</div>
                            <div className="mt-2 text-sm font-black text-brand-400 uppercase tracking-widest line-clamp-1">{currentStep?.label || 'Pending'}</div>
                        </div>
                        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Next</div>
                            <div className="mt-2 text-sm font-black text-white uppercase tracking-widest line-clamp-1">{nextStep?.label || 'None'}</div>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">
                        <span>Roadmap Progress</span>
                        <span>{progressPercent}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-card overflow-hidden border border-gray-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 via-amber-400 to-green-400 transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                </div>
            </div>

            <div className="relative">
                {/* Connector Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-500/70 via-gray-800 to-gray-800"></div>

                <div className="space-y-10">
                    {roadmap.map((step, i) => (
                        <motion.div 
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="relative pl-16"
                        >
                            {/* Step Indicator */}
                            <div className={`absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center border-2 z-10 transition-colors ${
                                step.status === 'completed' ? 'bg-green-600/20 border-green-500 text-green-500' :
                                step.status === 'current' ? 'bg-brand-600/20 border-brand-500 text-brand-500 animate-pulse' :
                                'bg-card border-gray-800 text-gray-700'
                            }`}>
                                {step.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : 
                                 step.status === 'current' ? <ArrowRight className="w-6 h-6" /> : 
                                 <Circle className="w-6 h-6" />}
                            </div>

                            <div className={`p-6 rounded-3xl border transition-all shadow-lg ${
                                step.status === 'current' ? 'bg-brand-600/5 border-brand-500/30' : 
                                'bg-surface border-gray-800'
                            }`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                                step.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                                step.status === 'current' ? 'bg-brand-500/20 text-brand-500' :
                                                'bg-surface text-gray-500'
                                            }`}>
                                                {step.status}
                                            </span>
                                            {step.date && (
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    {formatDate(step.date)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <h4 className={`text-xl font-black uppercase tracking-tight ${
                                            step.status === 'upcoming' ? 'text-gray-600' : 'text-white'
                                            }`}>
                                                {step.label}
                                            </h4>
                                            {step.status === 'current' && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-brand-200">
                                                    <Flag className="h-3.5 w-3.5" /> Live Now
                                                </span>
                                            )}
                                        </div>
                                        {step.description && (
                                            <p className="text-gray-500 text-sm mt-1 max-w-lg">{step.description}</p>
                                        )}
                                        {step.maps && step.maps.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {step.maps.map((mapName) => (
                                                    <span key={mapName} className="rounded-full border border-gray-800 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                        {mapName}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {step.status === 'current' && (
                                        <div className="flex items-center gap-3 rounded-2xl border border-brand-500/20 bg-black/25 px-4 py-3">
                                            <Layers3 className="w-5 h-5 text-brand-400" />
                                            <div>
                                                <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Active Stage</div>
                                                <div className="text-sm font-black text-white uppercase tracking-widest">{step.label}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RoadmapView;
