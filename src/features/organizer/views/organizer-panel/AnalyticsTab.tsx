import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Tournament } from '../../../../shared/types/types';

interface AnalyticsChartData {
    name: string;
    Registered: number;
    Slots: number;
    Revenue: number;
}

interface AnalyticsTabProps {
    hostedTournaments: Tournament[];
    analyticsChartData: AnalyticsChartData[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ hostedTournaments, analyticsChartData }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="border-b border-gray-800 pb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Esports Analytics Center</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Audit slots engagement, fill capacities, and revenue vectors</p>
            </div>

            {hostedTournaments.length === 0 ? (
                <div className="py-24 text-center">
                    <BarChart3 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Awaiting competition registries data to compute insights</p>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-black/30 p-8 rounded-[2rem] border border-gray-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-black text-white uppercase tracking-widest">Tournament Slots Engagement</h3>
                                <div className="flex items-center gap-4 text-xs font-bold">
                                    <span className="flex items-center gap-1.5 text-purple-400">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" /> Participants
                                    </span>
                                    <span className="flex items-center gap-1.5 text-amber-500">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" /> Total Slots
                                    </span>
                                </div>
                            </div>
                            <div className="h-64 pt-4 flex flex-col justify-between">
                                {(() => {
                                    const maxVal = Math.max(...analyticsChartData.map(d => Math.max(d.Slots, d.Registered)), 1);
                                    return (
                                        <div className="w-full h-full flex flex-col justify-end">
                                            <div className="flex-1 flex items-end justify-between gap-2 px-2 border-b border-gray-800/80 pb-1">
                                                {analyticsChartData.map((item, index) => {
                                                    const regPct = Math.max(4, Math.round((item.Registered / maxVal) * 100));
                                                    const slotPct = Math.max(4, Math.round((item.Slots / maxVal) * 100));
                                                    return (
                                                        <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute -top-12 z-20 bg-gray-900 border border-gray-700 text-white text-[10px] font-bold p-2 rounded-xl whitespace-nowrap shadow-xl flex flex-col gap-0.5">
                                                                <span className="text-gray-300">{item.name}</span>
                                                                <span className="text-purple-400">Participants: {item.Registered}</span>
                                                                <span className="text-amber-500">Total Slots: {item.Slots}</span>
                                                            </div>
                                                            <div className="flex items-end gap-1 w-full justify-center h-full">
                                                                <div style={{ height: `${regPct}%` }} className="w-1/2 max-w-[14px] bg-violet-500 hover:bg-violet-400 rounded-t-sm transition-all duration-300" title={`Registered: ${item.Registered}`} />
                                                                <div style={{ height: `${slotPct}%` }} className="w-1/2 max-w-[14px] bg-amber-600 hover:bg-amber-500 rounded-t-sm transition-all duration-300" title={`Slots: ${item.Slots}`} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex justify-between items-center w-full pt-2 gap-2 px-2">
                                                {analyticsChartData.map((item, index) => (
                                                    <span key={index} className="flex-1 text-[10px] font-bold text-gray-400 truncate text-center">{item.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="bg-black/30 p-8 rounded-[2rem] border border-gray-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-black text-white uppercase tracking-widest">Revenue Generation Vector</h3>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Revenue ($)
                                </span>
                            </div>
                            <div className="h-64 pt-4 flex flex-col justify-between">
                                {(() => {
                                    const maxRev = Math.max(...analyticsChartData.map(d => d.Revenue), 1);
                                    return (
                                        <div className="w-full h-full flex flex-col justify-end">
                                            <div className="flex-1 flex items-end justify-between gap-2 px-2 border-b border-gray-800/80 pb-1">
                                                {analyticsChartData.map((item, index) => {
                                                    const revPct = Math.max(4, Math.round((item.Revenue / maxRev) * 100));
                                                    return (
                                                        <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute -top-12 z-20 bg-gray-900 border border-gray-700 text-white text-[10px] font-bold p-2 rounded-xl whitespace-nowrap shadow-xl flex flex-col gap-0.5">
                                                                <span className="text-gray-300">{item.name}</span>
                                                                <span className="text-emerald-400">Revenue: ${item.Revenue.toLocaleString()}</span>
                                                            </div>
                                                            <div style={{ height: `${revPct}%` }} className="w-full max-w-[24px] bg-emerald-500 hover:bg-emerald-400 rounded-t-sm transition-all duration-300" title={`Revenue: $${item.Revenue}`} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex justify-between items-center w-full pt-2 gap-2 px-2">
                                                {analyticsChartData.map((item, index) => (
                                                    <span key={index} className="flex-1 text-[10px] font-bold text-gray-400 truncate text-center">{item.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsTab;
