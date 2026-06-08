import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';
import { DashboardCard } from '../components/DashboardCard';
import { Wallet, Plus, Loader2, ShieldAlert, Trash2, Pencil } from 'lucide-react';

export const Accounts: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings } = useAuthStore();
  const { hideBalanceOverride } = useUiStore();
  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);
  
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [type, setType] = useState<string>('Savings');
  const [balance, setBalance] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [formError, setFormError] = useState<string>('');

  // Edit Account States
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [editName, setEditName] = useState<string>('');
  const [editBankName, setEditBankName] = useState<string>('');
  const [editType, setEditType] = useState<string>('Savings');
  const [editCurrency, setEditCurrency] = useState<string>('INR');
  const [editError, setEditError] = useState<string>('');

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAccounts()
  });

  const createAccountMutation = useMutation({
    mutationFn: accountsApi.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || 'Failed to register account');
    }
  });

  const archiveAccountMutation = useMutation({
    mutationFn: accountsApi.deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    }
  });

  const editAccountMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => accountsApi.updateAccount(id, payload),
    onSuccess: () => {
      setEditingAccount(null);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.detail || 'Failed to update account details');
    }
  });

  const handleEditStart = (acc: any) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditBankName(acc.bank_name);
    setEditType(acc.type);
    setEditCurrency(acc.currency);
    setEditError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    if (!editName || !editBankName) {
      setEditError('Please fill in all mandatory fields');
      return;
    }
    editAccountMutation.mutate({
      id: editingAccount.id,
      payload: {
        name: editName,
        bank_name: editBankName,
        type: editType,
        currency: editCurrency
      }
    });
  };

  const resetForm = () => {
    setName('');
    setBankName('');
    setType('Savings');
    setBalance('');
    setCurrency('INR');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !bankName || !balance) {
      setFormError('Please fill all mandatory fields');
      return;
    }
    createAccountMutation.mutate({
      name,
      bank_name: bankName,
      type,
      balance: Number(balance),
      currency
    });
  };

  const handleArchive = (id: number) => {
    if (window.confirm('Are you sure you want to archive this account? Historical transactions will be preserved but the account will be hidden.')) {
      archiveAccountMutation.mutate(id);
    }
  };

  const totalBalance = accounts.reduce((sum: number, a: any) => sum + a.balance, 0);

  return (
    <div className="space-y-8 font-inter animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            Accounts & Wallets <Wallet className="h-6 w-6 text-amber-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregate savings, credit card lines, wallets, and liquid cash balances
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
        >
          <Plus className="h-4 w-4" /> ADD ACCOUNT
        </button>
      </div>

      {/* Net Worth Summary Panel */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Total Net Asset Value</span>
          <span className="font-outfit font-extrabold text-3xl text-slate-100 block mt-1">
            {isHideBalance ? '••••••' : `${totalBalance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`}
          </span>
        </div>
        <div className="flex gap-4.5 text-xs text-slate-400 font-semibold tracking-wide">
          <div>
            <span className="text-slate-500 text-[10px] block font-bold uppercase">Savings Pools</span>
            <span className="text-slate-200 font-bold block mt-0.5">
              {accounts.filter((a: any) => a.type === 'Savings').length} accounts
            </span>
          </div>
          <div className="border-l border-slate-850 h-8" />
          <div>
            <span className="text-slate-500 text-[10px] block font-bold uppercase">Credit Liabilities</span>
            <span className="text-rose-400 font-bold block mt-0.5">
              {accounts.filter((a: any) => a.type === 'CreditCard').length} active lines
            </span>
          </div>
        </div>
      </div>

      {/* Accounts Cards List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc: any) => (
            <div key={acc.id} className="relative group">
              <DashboardCard account={acc} />
              
              {/* Edit absolute button */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Avoid triggering toggle
                  handleEditStart(acc);
                }}
                className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-400 hover:text-amber-500 hover:border-slate-700 hover:bg-slate-900 transition-all z-20 cursor-pointer"
                title="Edit account details"
              >
                <Pencil className="h-4 w-4" />
              </button>

              {/* Archive absolute button */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Avoid triggering toggle
                  handleArchive(acc.id);
                }}
                className="absolute top-6 right-17 opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-400 hover:text-rose-500 hover:border-slate-700 hover:bg-slate-900 transition-all z-20 cursor-pointer"
                title="Archive account"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --- Add Account Modal --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-4">Register Bank Account</h3>
            
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Account Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ICICI Salary Account"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Bank Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Bank Code</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. ICICI, HDFC, SBI, Cash"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Account Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  <option value="Savings" className="bg-slate-950">Savings Account</option>
                  <option value="Current" className="bg-slate-950">Current Account</option>
                  <option value="CreditCard" className="bg-slate-950">Credit Card Line</option>
                  <option value="Cash" className="bg-slate-950">Cash Wallet</option>
                  <option value="Wallet" className="bg-slate-950">Digital Wallet (Paytm/GPay)</option>
                </select>
              </div>

              {/* Initial Balance */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Opening Balance (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Currency */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  <option value="INR" className="bg-slate-950">INR (₹)</option>
                  <option value="USD" className="bg-slate-950">USD ($)</option>
                  <option value="EUR" className="bg-slate-950">EUR (€)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                >
                  {createAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SAVE'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- Edit Account Modal --- */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-4">Edit Bank Account</h3>
            
            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              {/* Account Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. ICICI Salary Account"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Bank Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Bank Code</label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  placeholder="e.g. ICICI, HDFC, SBI, Cash"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Account Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  <option value="Savings" className="bg-slate-950">Savings Account</option>
                  <option value="Current" className="bg-slate-950">Current Account</option>
                  <option value="CreditCard" className="bg-slate-950">Credit Card Line</option>
                  <option value="Cash" className="bg-slate-950">Cash Wallet</option>
                  <option value="Wallet" className="bg-slate-950">Digital Wallet (Paytm/GPay)</option>
                </select>
              </div>

              {/* Currency */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Currency</label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  <option value="INR" className="bg-slate-950">INR (₹)</option>
                  <option value="USD" className="bg-slate-950">USD ($)</option>
                  <option value="EUR" className="bg-slate-950">EUR (€)</option>
                </select>
              </div>

              {/* Read-Only Balance Info */}
              <div className="space-y-1.5 opacity-70">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Current Balance (Read-Only)</label>
                <input
                  type="text"
                  disabled
                  value={isHideBalance ? '••••••' : editingAccount.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs bg-slate-950/40 border-slate-900 cursor-not-allowed select-none"
                />
                <span className="text-[9px] text-slate-500 block leading-snug">
                  Balances are dynamically calculated from income, expense, and transfer history to maintain audit trail integrity.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={editAccountMutation.isPending}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {editAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SAVE'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
