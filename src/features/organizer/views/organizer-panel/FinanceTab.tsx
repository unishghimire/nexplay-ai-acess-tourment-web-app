import React from 'react';
import { DollarSign, Send, RefreshCw } from 'lucide-react';
import { Tournament, Transaction } from '../../../../shared/types/types';

interface FinanceTabProps {
    hostedTournaments: Tournament[];
    profile: any;
    withdrawAmount: string;
    setWithdrawAmount: (val: string) => void;
    withdrawMethod: string;
    setWithdrawMethod: (val: string) => void;
    withdrawDetails: string;
    setWithdrawDetails: (val: string) => void;
    onRequestWithdraw: (e: React.FormEvent) => void;
    loadingTx: boolean;
    recentTransactions: Transaction[];
}

export const FinanceTab: React.FC<FinanceTabProps> = ({
    hostedTournaments,
    profile,
    withdrawAmount,
    setWithdrawAmount,
    withdrawMethod,
    setWithdrawMethod,
    withdrawDetails,
    setWithdrawDetails,
    onRequestWithdraw,
    loadingTx,
    recentTransactions
}) => {
    return (
        <div className="space-y-8">
            <div className="border-b border-gray-800 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Finance & Payouts</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Control wallet balance, entry logs, and requested payouts</p>
                </div>
                <div className="bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-500/20 text-emerald-400 font-extrabold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 animate-pulse" /> Available Payout: ${profile?.orgWalletBalance || profile?.balance || 0}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Tournament Revenues lists */}
                <div className="space-y-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Hosted Revenues Distribution</h3>
                    <div className="space-y-4">
                        {hostedTournaments.length === 0 ? (
                            <p className="text-xs text-gray-500 font-black uppercase py-8 text-center bg-black/10 rounded-2xl border border-gray-900">
                                No financial records to display
                            </p>
                        ) : (
                            hostedTournaments.map(t => {
                                const registrationsPool = t.entryFee * t.currentPlayers;
                                const earningsShareOrg = registrationsPool * 0.90; // 90% goes to host after NexPlay commission
                                return (
                                    <div key={t.id} className="bg-black/20 p-6 rounded-3xl border border-gray-800 hover:border-brand-500/30 transition-all flex flex-col justify-between">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="font-extrabold text-white text-base truncate uppercase">{t.title}</h4>
                                            <span className="text-xs text-emerald-400 font-mono font-extrabold">${registrationsPool} Gross</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                                            <div>
                                                <p className="mb-1">Entry Fee</p>
                                                <p className="text-white font-mono text-sm">${t.entryFee}</p>
                                            </div>
                                            <div>
                                                <p className="mb-1">Filled Slots</p>
                                                <p className="text-white font-mono text-sm">{t.currentPlayers}</p>
                                            </div>
                                            <div>
                                                <p className="mb-1">Org Share (90%)</p>
                                                <p className="text-brand-400 font-mono text-sm">${earningsShareOrg}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Withdrawal pipelineform */}
                <div className="space-y-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Send className="w-5 h-5 text-emerald-500" /> Initiate Payout Request
                    </h3>
                    
                    <form onSubmit={onRequestWithdraw} className="bg-black/20 p-8 rounded-3xl border border-gray-800 space-y-4">
                        <div>
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Withdrawal Amount ($)</label>
                            <input 
                                type="number"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                required
                                min="1"
                                placeholder="e.g. 150"
                                className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Payout Channel Method</label>
                            <select
                                value={withdrawMethod}
                                onChange={(e) => setWithdrawMethod(e.target.value)}
                                className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-black text-white outline-none focus:border-emerald-500 uppercase tracking-widest"
                            >
                                <option value="Bank Transfer">Bank Wire Transfer</option>
                                <option value="PayPal">PayPal</option>
                                <option value="eSewa/Bkash/Razorpay">Direct Wallet (Razorpay/eSewa/Bkash)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Account / Credentials Details</label>
                            <textarea 
                                value={withdrawDetails}
                                onChange={(e) => setWithdrawDetails(e.target.value)}
                                required
                                rows={3}
                                placeholder="Enter Bank Info: AC Name, AC Number, Swift/IFSC branch digits, or Wallet ID details completely..."
                                className="w-full bg-black border border-gray-800 rounded-3xl p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                        >
                            Request Funds Release
                        </button>
                    </form>

                    {/* Recent withdrawals list */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Recent Transactions Log</h4>
                        {loadingTx ? (
                            <p className="text-center text-xs text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Verifying tx lines...</p>
                        ) : recentTransactions.length === 0 ? (
                            <p className="text-xs text-gray-600 uppercase tracking-widest text-center">No transaction logs recorded</p>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                                {recentTransactions.map(tx => (
                                    <div key={tx.id} className="bg-black/40 p-4 border border-gray-900 rounded-2xl flex justify-between items-center text-xs">
                                        <div>
                                            <p className="font-extrabold text-white">{tx.desc || tx.type.toUpperCase()}</p>
                                            <p className="text-[10px] text-gray-500 font-mono">{tx.refId}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-extrabold text-emerald-400">${tx.amount}</p>
                                            <span className={`inline-block text-[10px] uppercase font-black tracking-widest ${
                                                tx.status === 'completed' || tx.status === 'success' ? 'text-green-400' : 'text-amber-500 animate-pulse'
                                            }`}>{tx.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceTab;
