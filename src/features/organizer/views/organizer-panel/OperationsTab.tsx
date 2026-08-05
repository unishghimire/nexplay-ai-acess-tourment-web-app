import React from 'react';
import { Bot, Key, Play, Check, Activity } from 'lucide-react';
import { Tournament } from '../../../../shared/types/types';

export interface OpLog {
    time: string;
    text: string;
    type: 'info' | 'warn' | 'success';
}

interface OperationsTabProps {
    opSelectedTourId: string;
    setOpSelectedTourId: (id: string) => void;
    hostedTournaments: Tournament[];
    roomIdInput: string;
    setRoomIdInput: (val: string) => void;
    roomPassInput: string;
    setRoomPassInput: (val: string) => void;
    streamLinkInput: string;
    setStreamLinkInput: (val: string) => void;
    onBroadcastLobby: () => void;
    onUpdateTournamentStatus: (status: 'live' | 'completed' | 'upcoming' | 'paused') => void;
    opLogs: OpLog[];
    customLog: string;
    setCustomLog: (val: string) => void;
    onAddCustomLog: (e: React.FormEvent) => void;
}

export const OperationsTab: React.FC<OperationsTabProps> = ({
    opSelectedTourId,
    setOpSelectedTourId,
    hostedTournaments,
    roomIdInput,
    setRoomIdInput,
    roomPassInput,
    setRoomPassInput,
    streamLinkInput,
    setStreamLinkInput,
    onBroadcastLobby,
    onUpdateTournamentStatus,
    opLogs,
    customLog,
    setCustomLog,
    onAddCustomLog
}) => {
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Operations Command Center</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Configure room credentials and match status</p>
                </div>
                <div className="w-full sm:w-auto">
                    <select 
                        value={opSelectedTourId}
                        onChange={(e) => {
                            const id = e.target.value;
                            setOpSelectedTourId(id);
                            const found = hostedTournaments.find(t => t.id === id);
                            if (found) {
                                setRoomIdInput(found.roomId || '');
                                setRoomPassInput(found.roomPass || '');
                                setStreamLinkInput(found.ytLink || '');
                            }
                        }}
                        className="w-full bg-black border border-gray-800 rounded-full py-3.5 px-6 text-xs font-black text-white outline-none focus:border-brand-500 transition-all uppercase tracking-widest"
                    >
                        <option value="">-- Choose Competition --</option>
                        {hostedTournaments.map(t => (
                            <option key={t.id} value={t.id}>{t.title} [Status: {t.status.toUpperCase()}]</option>
                        ))}
                    </select>
                </div>
            </div>

            {!opSelectedTourId ? (
                <div className="py-20 text-center">
                    <Bot className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Identify a tournament to begin operations</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Lobby Configuration details */}
                    <div className="space-y-6 bg-black/20 p-8 rounded-3xl border border-gray-800/80">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                            <Key className="w-5 h-5 text-brand-500" /> Game Room Credentials
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Lobby / Room ID</label>
                                <input 
                                    type="text"
                                    value={roomIdInput}
                                    onChange={(e) => setRoomIdInput(e.target.value)}
                                    placeholder="e.g. 5240212"
                                    className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Room Password</label>
                                <input 
                                    type="text"
                                    value={roomPassInput}
                                    onChange={(e) => setRoomPassInput(e.target.value)}
                                    placeholder="e.g. play123"
                                    className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">YouTube Stream Link (Optional)</label>
                                <input 
                                    type="text"
                                    value={streamLinkInput}
                                    onChange={(e) => setStreamLinkInput(e.target.value)}
                                    placeholder="https://youtube.com/live/..."
                                    className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                                />
                            </div>

                            <button 
                                onClick={onBroadcastLobby}
                                className="w-full bg-brand-500 hover:bg-brand-400 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                            >
                                Update & Broadcast Room Details
                            </button>
                        </div>

                        {/* Match Status Quick controls */}
                        <div className="border-t border-gray-800 pt-6 mt-6 space-y-4">
                            <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Match Orchestration Controls</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => onUpdateTournamentStatus('live')}
                                    className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <Play className="w-4 h-4" /> Start Battle
                                </button>
                                <button 
                                    onClick={() => onUpdateTournamentStatus('completed')}
                                    className="bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/20 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Finalize
                                </button>
                                <button 
                                    onClick={() => onUpdateTournamentStatus('paused')}
                                    className="bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/20 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Pause Lobby
                                </button>
                                <button 
                                    onClick={() => onUpdateTournamentStatus('upcoming')}
                                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Reset Status
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Mission Control Logs timeline */}
                    <div className="space-y-6 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Activity className="w-5 h-5 text-brand-500" /> Operational Log
                            </h3>
                            
                            <div className="bg-black/40 rounded-3xl p-6 border border-gray-800 h-72 overflow-y-auto space-y-4 flex flex-col-reverse justify-end scrollbar-thin">
                                {opLogs.map((log, i) => (
                                    <div key={i} className="flex gap-4 text-xs font-bold font-mono">
                                        <span className="text-gray-500">{log.time}</span>
                                        <span className={`flex-1 ${
                                            log.type === 'success' ? 'text-green-400' :
                                            log.type === 'warn' ? 'text-red-400' : 'text-gray-300'
                                        }`}>
                                            {log.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={onAddCustomLog} className="flex gap-3">
                            <input 
                                type="text" 
                                value={customLog}
                                onChange={(e) => setCustomLog(e.target.value)}
                                placeholder="Log manual event detail..."
                                className="flex-1 bg-black border border-gray-800 rounded-full py-4 px-6 text-xs font-bold text-white outline-none focus:border-brand-500"
                            />
                            <button 
                                type="submit"
                                className="bg-gray-900 border border-gray-800 text-white rounded-full px-6 font-black text-xs uppercase tracking-widest hover:border-brand-500 hover:bg-brand-500/10 transition-all shrink-0"
                            >
                                Push
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OperationsTab;
