import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownToLine,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export interface WalletPayoutsTabProps {
  kpis: {
    orgWalletBalance: number;
    escrowBalance: number;
    pendingPayouts: number;
  };
  transactions: any[];
  isDemoMode: boolean;
  onRequestWithdraw: (amount: number, method: string, details: string) => void;
}

// Currency formatter using Intl.NumberFormat for Rs. (no decimals for amounts > 100)
const formatCurrency = (amount: number): string => {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const hasDecimals = num <= 100 && num % 1 !== 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: num > 100 ? 0 : 2,
  }).format(num);
  return `Rs. ${formatted}`;
};

export const WalletPayoutsTab: React.FC<WalletPayoutsTabProps> = ({
  kpis = { orgWalletBalance: 0, escrowBalance: 0, pendingPayouts: 0 },
  transactions = [],
  isDemoMode = false,
  onRequestWithdraw,
}) => {
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawMethod, setWithdrawMethod] = useState<string>('Bank Transfer');
  const [accountDetails, setAccountDetails] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const walletBalance = kpis?.orgWalletBalance ?? 0;
  const escrowBalance = kpis?.escrowBalance ?? 0;
  const pendingPayouts = kpis?.pendingPayouts ?? 0;

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const numAmount = parseFloat(withdrawAmount);

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid withdrawal amount greater than 0.');
      return;
    }

    if (numAmount > walletBalance) {
      setError(`Withdrawal amount cannot exceed available wallet balance (${formatCurrency(walletBalance)}).`);
      return;
    }

    if (!accountDetails.trim()) {
      setError('Please enter your account or wallet details.');
      return;
    }

    if (onRequestWithdraw) {
      onRequestWithdraw(numAmount, withdrawMethod, accountDetails.trim());
    }

    setSuccessMessage(`Withdrawal request for ${formatCurrency(numAmount)} submitted successfully!`);
    setWithdrawAmount('');
    setAccountDetails('');
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'entry_fee':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
            Entry Fee
          </span>
        );
      case 'prize':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
            Prize
          </span>
        );
      case 'withdraw':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/50">
            Withdrawal
          </span>
        );
      case 'sponsor':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
            Sponsor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
            {type ? type.replace('_', ' ') : 'Transaction'}
          </span>
        );
    }
  };

  const getStatusPill = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            {status || 'Unknown'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-gray-100">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Wallet & Payouts</h2>
            {isDemoMode && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Demo Mode
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Escrow balances, prize distribution, and transaction history
          </p>
        </div>
      </div>

      {/* 2. Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Wallet Balance */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Wallet Balance</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mt-2">
            {formatCurrency(walletBalance)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Available for withdrawal</span>
          </div>
        </div>

        {/* In Escrow */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">In Escrow</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mt-2">
            {formatCurrency(escrowBalance)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
            <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
            <span>Locked for active tournament prizes</span>
          </div>
        </div>

        {/* Pending Payouts */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Payouts</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mt-2">
            {formatCurrency(pendingPayouts)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Processing payouts</span>
          </div>
        </div>
      </div>

      {/* 3. Withdrawal form card */}
      <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDownToLine className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Request Withdrawal</h3>
        </div>

        <form onSubmit={handleWithdrawSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Amount Input */}
            <div>
              <label htmlFor="withdraw-amount" className="block text-xs font-medium text-gray-300 mb-1.5">
                Amount (NPR)
              </label>
              <input
                id="withdraw-amount"
                type="number"
                min="1"
                max={walletBalance}
                step="any"
                value={withdrawAmount}
                onChange={(e) => {
                  setWithdrawAmount(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. 5000"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* Method Select */}
            <div>
              <label htmlFor="withdraw-method" className="block text-xs font-medium text-gray-300 mb-1.5">
                Payment Method
              </label>
              <select
                id="withdraw-method"
                value={withdrawMethod}
                onChange={(e) => setWithdrawMethod(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="eSewa">eSewa</option>
                <option value="Khalti">Khalti</option>
                <option value="IME Pay">IME Pay</option>
              </select>
            </div>

            {/* Account Details Input */}
            <div>
              <label htmlFor="account-details" className="block text-xs font-medium text-gray-300 mb-1.5">
                Account Details
              </label>
              <input
                id="account-details"
                type="text"
                value={accountDetails}
                onChange={(e) => {
                  setAccountDetails(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. 9800000000 or Bank Acc No."
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Validation Error Message */}
          {error && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {/* Success Message */}
          {successMessage && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{successMessage}</span>
            </p>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Submit Request
            </button>
          </div>
        </form>
      </div>

      {/* 4. Transaction history table */}
      <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Transaction History</h3>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No transactions found.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Ref ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {transactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-gray-900/40 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getTypeBadge(tx.type)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-semibold text-white">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-300">
                        {tx.method || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-gray-400">
                        {tx.refId || tx.id || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusPill(tx.status)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-400">
                        {tx.timestamp || tx.date || tx.createdAt || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards Layout */}
            <div className="block sm:hidden space-y-3">
              {transactions.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>{getTypeBadge(tx.type)}</div>
                    <div>{getStatusPill(tx.status)}</div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs text-gray-400">Amount</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>

                  {tx.desc && (
                    <p className="text-xs text-gray-300 line-clamp-2">{tx.desc}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-800/60 text-gray-400">
                    <div>
                      <span className="block text-[10px] uppercase text-gray-500 font-medium">Method</span>
                      <span className="text-gray-300">{tx.method || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-gray-500 font-medium">Ref ID</span>
                      <span className="font-mono text-gray-300">{tx.refId || tx.id || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[10px] uppercase text-gray-500 font-medium">Date</span>
                      <span className="text-gray-300">{tx.timestamp || tx.date || tx.createdAt || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletPayoutsTab;
