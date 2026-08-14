import React from 'react';
import { Gamepad2, RefreshCw, Clock, DollarSign, Trophy, Plus } from 'lucide-react';

export interface ScrimsHubTabProps {
  scrims: any[];
  onOpenSlotGrid: (scrim: any) => void;
  onToggleSlot: (scrimId: any, slotNumber?: any) => void;
  onViewDetails?: (id: string) => void;
  onCreateScrim?: () => void;
}

export const ScrimsHubTab: React.FC<ScrimsHubTabProps> = ({
  scrims,
  onOpenSlotGrid,
  onToggleSlot,
  onViewDetails,
  onCreateScrim,
}) => {
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'TBD';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      console.warn('Date formatting failed, using raw value', e);
      return timeStr || 'TBD';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'N/A';
    if (amount === 0) return 'FREE';
    return `Rs. ${amount.toLocaleString()}`;
  };

  const formatMode = (formatStr?: string) => {
    if (!formatStr) return 'Battle Royale';
    if (formatStr.toLowerCase().includes('5v5')) return '5v5';
    if (formatStr.toLowerCase().includes('royale') || formatStr.toLowerCase().includes('br')) return 'Battle Royale';
    return formatStr;
  };

  const handleSlotClick = (scrimId: string, slotNumber: number) => {
    if (typeof onToggleSlot === 'function') {
      onToggleSlot(scrimId, slotNumber);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-tight">Scrims Hub</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage Free Fire scrim schedules and slot reservations
          </p>
        </div>

        {/* BUG-010 FIX: "Schedule Scrim" now opens create modal instead of slot grid */}
        <button
          type="button"
          onClick={() => onCreateScrim?.()}
          className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-brand-500/10 self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Scrim</span>
        </button>
      </div>

      {/* Empty State */}
      {!scrims || scrims.length === 0 ? (
        <div className="bg-dark/50 border border-slate-800 rounded-lg p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-card border border-slate-800 flex items-center justify-center mb-4">
            <Gamepad2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No scrims scheduled.</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            There are no active or upcoming Free Fire scrim sessions available right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {scrims.map((scrim) => {
            const totalSlots =
              typeof scrim.totalSlots === 'number'
                ? scrim.totalSlots
                : typeof scrim.slots === 'number'
                ? scrim.slots
                : Array.isArray(scrim.slots)
                ? scrim.slots.length
                : 20;

            const filledSlots =
              scrim.filledSlots !== undefined
                ? scrim.filledSlots
                : Array.isArray(scrim.slots)
                ? scrim.slots.filter((s: any) => s && s.status === 'filled').length
                : 0;

            const progressPercent = Math.min(100, Math.max(0, (filledSlots / Math.max(1, totalSlots)) * 100));

            const slotList: Array<{ slotNumber: number; status: string; teamName?: string | null }> =
              Array.isArray(scrim.slots) && scrim.slots.length > 0
                ? scrim.slots
                : Array.from({ length: totalSlots }, (_, i) => ({
                    slotNumber: i + 1,
                    status: i < filledSlots ? 'filled' : 'open',
                    teamName: i < filledSlots ? `Team ${i + 1}` : null,
                  }));

            const statusUpper = (scrim.status || 'OPEN').toUpperCase();

            return (
              <div
                key={scrim.id}
                className="bg-dark/50 border border-slate-800 rounded-2xl p-5 space-y-5 transition-colors hover:border-gray-700/80"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-bold text-white">{scrim.title}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {formatMode(scrim.format)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          statusUpper === 'LIVE'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                            : statusUpper === 'COMPLETED'
                            ? 'bg-surface text-slate-400 border-gray-700'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}
                      >
                        {statusUpper}
                      </span>
                    </div>

                    {(scrim.recurring || scrim.recurrencePattern) && (
                      <div className="flex items-center gap-1.5 text-xs text-brand-400/90 font-medium">
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{scrim.recurrencePattern || 'Recurring Scrim Schedule'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {onViewDetails && (
                      <button
                        type="button"
                        onClick={() => onViewDetails(scrim.id)}
                        className="self-start md:self-auto bg-brand-500 hover:bg-brand-400 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 min-h-[44px]"
                      >
                        View Details
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenSlotGrid(scrim)}
                      className="self-start md:self-auto bg-card hover:bg-surface text-slate-200 border border-slate-800 px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer min-h-[44px]"
                    >
                      View Slot Grid
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Slot Reservations</span>
                    <span className="text-slate-200">
                      <span className="text-brand-400">{filledSlots}</span> / {totalSlots} Filled
                    </span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-slate-800/50">
                    <div className="w-8 h-8 rounded-lg bg-surface/80 flex items-center justify-center flex-shrink-0 text-brand-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Start Time</div>
                      <div className="text-xs font-bold text-slate-200">{formatTime(scrim.startTime)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-slate-800/50">
                    <div className="w-8 h-8 rounded-lg bg-surface/80 flex items-center justify-center flex-shrink-0 text-amber-400">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Entry Fee</div>
                      <div className="text-xs font-bold text-slate-200">{formatCurrency(scrim.entryFee)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-slate-800/50">
                    <div className="w-8 h-8 rounded-lg bg-surface/80 flex items-center justify-center flex-shrink-0 text-emerald-400">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Prize Pool</div>
                      <div className="text-xs font-bold text-slate-200">{formatCurrency(scrim.prizePool)}</div>
                    </div>
                  </div>
                </div>

                {/* Inline Slot Grid Preview */}
                <div className="pt-2">
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                    {slotList.slice(0, 20).map((slot) => (
                      <button
                        key={slot.slotNumber}
                        onClick={() => handleSlotClick(scrim.id, slot.slotNumber)}
                        className={`p-2 rounded-lg border text-[10px] font-medium transition-all min-h-[44px] ${
                          slot.status === 'filled'
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'bg-card border-gray-800 text-gray-500 hover:border-gray-600'
                        }`}
                        title={slot.teamName ? `Slot ${slot.slotNumber}: ${slot.teamName}` : `Slot ${slot.slotNumber}: Open`}
                      >
                        {slot.slotNumber}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default ScrimsHubTab;
