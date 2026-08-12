import React from 'react';
import { Gamepad2, RefreshCw, Clock, DollarSign, Trophy, Plus } from 'lucide-react';

export interface ScrimsHubTabProps {
  scrims: any[];
  onOpenSlotGrid: (scrim: any) => void;
  onToggleSlot: (scrimId: any, slotNumber?: any) => void;
  onViewDetails?: (id: string) => void;
}

export const ScrimsHubTab: React.FC<ScrimsHubTabProps> = ({
  scrims,
  onOpenSlotGrid,
  onToggleSlot,
  onViewDetails,
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
    // Call onToggleSlot safely matching either (scrimId, slotNumber) or (slotNumber) signature
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

        <button
          type="button"
          onClick={() => {
            if (scrims && scrims.length > 0) {
              onOpenSlotGrid(scrims[0]);
            }
          }}
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
        /* Scrim Cards Grid / List */
        <div className="grid grid-cols-1 gap-6">
          {scrims.map((scrim) => {
            const totalSlots = scrim.totalSlots || scrim.slots?.length || 20;
            const filledSlots =
              scrim.filledSlots !== undefined
                ? scrim.filledSlots
                : scrim.slots
                ? scrim.slots.filter((s: any) => s.status === 'filled').length
                : 0;
            const progressPercent = Math.min(100, Math.max(0, (filledSlots / totalSlots) * 100));

            // Generate or normalization of slots for inline grid preview
            const slotList: Array<{ slotNumber: number; status: string; teamName?: string | null }> =
              scrim.slots && scrim.slots.length > 0
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
                {/* Card Top: Title, Format Badge, Status, Action */}
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

                    {/* Recurring Pattern */}
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

                {/* Slot Progress Bar */}
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

                {/* Stats Grid */}
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
                      <div className="text-xs font-bold text-emerald-400">{formatCurrency(scrim.prizePool)}</div>
                    </div>
                  </div>
                </div>

                {/* Inline Slot Preview */}
                <div className="space-y-2 pt-1">
                  <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
                    <span>Inline Slot Grid</span>
                    <span className="text-[11px] text-slate-400">Click slot to toggle reservation</span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                    {slotList.map((slot) => {
                      const isFilled = slot.status === 'filled';
                      return (
                        <button
                          key={slot.slotNumber}
                          type="button"
                          onClick={() => handleSlotClick(scrim.id, slot.slotNumber)}
                          aria-label={`Slot ${slot.slotNumber}, ${isFilled ? `reserved by ${slot.teamName || 'team'}` : 'open for reservation'}`}
        title={`Slot ${slot.slotNumber}: ${isFilled ? slot.teamName || 'Filled' : 'Open'}`}
                          className={`min-h-[44px] min-w-[44px] rounded flex items-center justify-center px-1 text-xs font-mono transition-all cursor-pointer select-none ${
                            isFilled
                              ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                              : 'bg-card border border-slate-800 border-dashed text-slate-400 hover:border-gray-700 hover:text-slate-300'
                          }`}
                        >
                          <span className="truncate max-w-full">
                            {isFilled ? (slot.teamName ? slot.teamName.slice(0, 6) : `#${slot.slotNumber}`) : `#${slot.slotNumber}`}
                          </span>
                        </button>
                      );
                    })}
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
