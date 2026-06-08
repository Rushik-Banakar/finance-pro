import React from 'react';
import { useUiStore } from '../store/useUiStore';
import { useAuthStore } from '../store/useAuthStore';
import { CreditCard, Landmark, PiggyBank, CircleDollarSign } from 'lucide-react';

interface Account {
  id: number;
  name: string;
  bank_name: string;
  type: string;
  balance: number;
  currency: string;
}

interface DashboardCardProps {
  account: Account;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ account }) => {
  const { selectedAccountIds, toggleAccountId, hideBalanceOverride } = useUiStore();
  const { settings } = useAuthStore();

  const isSelected = selectedAccountIds.includes(account.id);
  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);

  // Dynamic neomorphic theme generator based on bank names
  const getThemeClasses = (bank: string) => {
    switch (bank.toUpperCase()) {
      case 'ICICI':
        return {
          bg: 'bg-gradient-to-tr from-orange-950 via-slate-900 to-amber-950',
          border: 'border-orange-500/20',
          glow: 'shadow-[0_4px_30px_rgba(249,115,22,0.06)]',
          accent: 'text-orange-400',
          badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
        };
      case 'HDFC':
        return {
          bg: 'bg-gradient-to-tr from-blue-950 via-slate-900 to-indigo-950',
          border: 'border-blue-500/20',
          glow: 'shadow-[0_4px_30px_rgba(59,130,246,0.06)]',
          accent: 'text-blue-400',
          badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        };
      case 'SBI':
        return {
          bg: 'bg-gradient-to-tr from-cyan-950 via-slate-900 to-teal-950',
          border: 'border-cyan-500/20',
          glow: 'shadow-[0_4px_30px_rgba(6,182,212,0.06)]',
          accent: 'text-cyan-400',
          badge: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
        };
      case 'CASH':
        return {
          bg: 'bg-gradient-to-tr from-emerald-950 via-slate-900 to-slate-900',
          border: 'border-emerald-500/20',
          glow: 'shadow-[0_4px_30px_rgba(16,185,129,0.06)]',
          accent: 'text-emerald-400',
          badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        };
      default:
        return {
          bg: 'bg-gradient-to-tr from-slate-900 via-slate-950 to-indigo-950',
          border: 'border-slate-800',
          glow: 'shadow-2xl',
          accent: 'text-amber-400',
          badge: 'bg-slate-800 text-slate-300'
        };
    }
  };

  const theme = getThemeClasses(account.bank_name);

  const getAccountIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'CREDITCARD':
        return <CreditCard className="h-6 w-6" />;
      case 'SAVINGS':
        return <PiggyBank className="h-6 w-6" />;
      case 'CASH':
        return <CircleDollarSign className="h-6 w-6" />;
      default:
        return <Landmark className="h-6 w-6" />;
    }
  };

  return (
    <div
      onClick={() => toggleAccountId(account.id)}
      className={`relative overflow-hidden p-6 rounded-3xl border cursor-pointer select-none transition-all duration-300 transform active:scale-98 ${
        theme.bg
      } ${theme.border} ${theme.glow} ${
        isSelected 
          ? 'ring-2 ring-amber-500/50 scale-[1.02] shadow-[0_0_30px_rgba(245,158,11,0.15)] border-amber-500/40' 
          : 'hover:scale-[1.01] hover:border-slate-700'
      }`}
    >
      {/* Glow highlight inside */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-white/3 rounded-full blur-2xl" />

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl bg-slate-950/40 backdrop-blur-md ${theme.accent}`}>
            {getAccountIcon(account.type)}
          </div>
          <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full ${theme.badge}`}>
            {account.bank_name}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-slate-500 text-xs font-semibold tracking-wide block truncate">
          {account.name}
        </span>
        <span className="font-outfit font-extrabold text-2xl tracking-tight block text-slate-100 mt-1">
          {isHideBalance ? '••••••' : account.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
        </span>
      </div>

      <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-950/20 text-[10px] text-slate-500 font-semibold tracking-wider">
        <span>{account.type.toUpperCase()}</span>
        <span>{account.currency}</span>
      </div>
    </div>
  );
};
