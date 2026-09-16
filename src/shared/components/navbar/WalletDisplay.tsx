import React from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/utils';

interface WalletDisplayProps {
  balance: number;
  onClick?: () => void;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({ balance, onClick }) => {
  return (
    <button type="button" 
      onClick={onClick}
      className="flex items-center justify-center h-8 sm:h-10 gap-1.5 sm:gap-2 bg-[#171330] border border-purple-600/50 hover:border-purple-500 text-purple-300 px-2.5 sm:px-4 rounded-full text-xs sm:text-sm font-bold shadow-sm shadow-purple-950/40 hover:scale-105 active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
      aria-label="View wallet"
    >
      <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0" />
      <span className="font-extrabold tracking-wide">{formatCurrency(balance)}</span>
    </button>
  );
};

export default WalletDisplay;
