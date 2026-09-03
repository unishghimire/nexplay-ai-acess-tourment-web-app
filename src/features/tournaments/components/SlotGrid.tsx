import React from 'react';
import { ScrimSlot } from '../../../shared/utils/scrimSlots';
import { Users, Shield, CheckCircle2, User, ChevronRight } from 'lucide-react';

interface SlotGridProps {
  slots: ScrimSlot[];
  totalSlots: number;
  mySlotNumber?: number | null;
  isJoined?: boolean;
  onSelectSlot?: (slotNumber: number) => void;
  selectedSlotNumber?: number | null;
  showTitle?: boolean;
}

export const SlotGrid: React.FC<SlotGridProps> = ({
  slots,
  totalSlots,
  mySlotNumber,
  isJoined = false,
  onSelectSlot,
  selectedSlotNumber,
  showTitle = true,
}) => {
  const filledCount = slots.filter(s => s.status === 'filled').length;
  const percentage = Math.min(100, Math.round((filledCount / (totalSlots || 1)) * 100));

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card/60 p-4 rounded-2xl border border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-400" />
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Slot Allocation & Room Seating
              </h3>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Players must sit in their exact allocated slot number in the custom match room.
            </p>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <span className="text-xs font-black text-white font-mono">
                {filledCount} / {totalSlots}
              </span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">
                Booked
              </span>
            </div>
            <div className="w-28 sm:w-36 bg-dark rounded-full h-2 overflow-hidden border border-gray-800">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Legend & My Slot Banner */}
      {isJoined && mySlotNumber && (
        <div className="bg-emerald-500/10 border-2 border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                Your Allocated Slot
              </div>
              <div className="text-sm font-black text-white">
                You are registered in <span className="text-emerald-400 font-mono">SLOT #{mySlotNumber}</span>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider block">
              Custom Room Invariant
            </span>
            <span className="text-xs text-gray-300 font-medium">
              Sit strictly in Slot #{mySlotNumber}
            </span>
          </div>
        </div>
      )}

      {/* Slots Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {slots.map((slot) => {
          const isMySlot = Boolean(mySlotNumber && slot.slotNumber === mySlotNumber);
          const isSelected = Boolean(selectedSlotNumber && slot.slotNumber === selectedSlotNumber);
          const isFilled = slot.status === 'filled';
          const canClick = !isFilled && !isJoined && Boolean(onSelectSlot);

          return (
            <div
              key={slot.slotNumber}
              onClick={() => canClick && onSelectSlot?.(slot.slotNumber)}
              className={`p-3 rounded-2xl border transition-all flex flex-col justify-between min-h-[105px] select-none ${
                isMySlot
                  ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                  : isSelected
                  ? 'bg-brand-500/20 border-brand-500 text-white shadow-lg shadow-brand-500/20 ring-2 ring-brand-500/40 scale-105'
                  : isFilled
                  ? 'bg-card/70 border-gray-800 text-gray-400'
                  : canClick
                  ? 'bg-dark/80 border-gray-800 hover:border-brand-500/60 hover:bg-brand-500/5 text-gray-300 cursor-pointer group hover:scale-[1.02]'
                  : 'bg-dark/40 border-gray-800/60 text-gray-600'
              }`}
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${
                  isMySlot
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                    : isSelected
                    ? 'bg-brand-500/30 text-brand-300 border border-brand-500/40'
                    : isFilled
                    ? 'bg-gray-800 text-gray-400'
                    : 'bg-surface text-gray-400 group-hover:text-white'
                }`}>
                  #{slot.slotNumber < 10 ? `0${slot.slotNumber}` : slot.slotNumber}
                </span>

                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  isMySlot
                    ? 'bg-emerald-500 text-black font-bold'
                    : isFilled
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}>
                  {isMySlot ? 'YOU' : isFilled ? 'FILLED' : 'OPEN'}
                </span>
              </div>

              {/* Slot Body */}
              <div className="my-2">
                {isFilled ? (
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-white truncate flex items-center gap-1">
                      {isMySlot ? <Shield className="w-3 h-3 text-emerald-400 shrink-0" /> : <User className="w-3 h-3 text-gray-500 shrink-0" />}
                      <span className="truncate">{slot.teamName || slot.inGameName || 'Player'}</span>
                    </div>
                    {slot.inGameId && (
                      <div className="text-[9px] text-gray-500 font-mono truncate">
                        ID: {slot.inGameId}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-1">
                    <span className="text-[10px] font-bold text-gray-500 group-hover:text-brand-400 transition-colors uppercase tracking-widest">
                      {canClick ? 'Choose Slot' : 'Available'}
                    </span>
                  </div>
                )}
              </div>

              {/* Slot Footer Action */}
              {canClick && !isFilled && (
                <div className="text-[9px] font-black uppercase tracking-wider text-brand-400 flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  Select <ChevronRight className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
