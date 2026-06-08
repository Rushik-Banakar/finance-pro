import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '../store/useUiStore';
import { useAuthStore } from '../store/useAuthStore';
import { 
  accountsApi, transactionsApi, categoriesApi, analyticsApi 
} from '../services/api';
import { DashboardCard } from '../components/DashboardCard';
import { 
  Plus, ArrowDownUp, Sparkles, Loader2, 
  ArrowRightLeft, ShieldAlert, Calendar
} from 'lucide-react';

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTransactionDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${day} ${months[monthIdx]} ${year}`;
};

export const Home: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedAccountIds, clearAccountFilters, hideBalanceOverride } = useUiStore();
  const { settings } = useAuthStore();
  
  // Modal states
  const [txModalOpen, setTxModalOpen] = useState<boolean>(false);
  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false);

  // Form states - Transaction
  const [txType, setTxType] = useState<string>('Expense');
  const [txAccountId, setTxAccountId] = useState<number>(0);
  const [txCategoryId, setTxCategoryId] = useState<number>(0);
  const [txAmount, setTxAmount] = useState<string>('');
  const [txDescription, setTxDescription] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(getTodayDateString());
  const [formError, setFormError] = useState<string>('');

  // Form states - Transfer
  const [trSrcId, setTrSrcId] = useState<number>(0);
  const [trDestId, setTrDestId] = useState<number>(0);
  const [trAmount, setTrAmount] = useState<string>('');
  const [trDescription, setTrDescription] = useState<string>('');

  // Fetch Core Data
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAccounts()
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getCategories()
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => analyticsApi.getKpis()
  });

  // Removed Phase 2 ML Forecast Query

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['recentTransactions', selectedAccountIds],
    queryFn: () => transactionsApi.getTransactions({ 
      accountIds: selectedAccountIds,
      limit: 10 
    })
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['allTransactions', selectedAccountIds],
    queryFn: () => transactionsApi.getTransactions({ 
      accountIds: selectedAccountIds,
      limit: 500 
    })
  });

  // Mutations
  const createTxMutation = useMutation({
    mutationFn: transactionsApi.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
      setTxModalOpen(false);
      resetTxForm();
    }
  });

  const createTransferMutation = useMutation({
    mutationFn: transactionsApi.createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
      setTransferModalOpen(false);
      resetTransferForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || 'Transfer failed');
    }
  });

  const handleTxTypeChange = (newType: string) => {
    setTxType(newType);
    const filteredCats = categories.filter((c: any) => c.type === newType);
    if (filteredCats.length > 0) {
      setTxCategoryId(filteredCats[0].id);
    } else {
      setTxCategoryId(0);
    }
  };

  const resetTxForm = () => {
    setTxType('Expense');
    if (accounts.length > 0) setTxAccountId(accounts[0].id);
    const expenseCats = categories.filter((c: any) => c.type === 'Expense');
    if (expenseCats.length > 0) {
      setTxCategoryId(expenseCats[0].id);
    } else if (categories.length > 0) {
      setTxCategoryId(categories[0].id);
    }
    setTxAmount('');
    setTxDescription('');
    setTxDate(getTodayDateString());
    setFormError('');
  };

  // Removed Phase 2 OCR Upload & Approve Handlers

  const resetTransferForm = () => {
    setTrSrcId(accounts[0]?.id || 0);
    setTrDestId(accounts[1]?.id || 0);
    setTrAmount('');
    setTrDescription('');
    setFormError('');
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAccountId || !txCategoryId || !txAmount || !txDate) {
      setFormError('Please fill all mandatory fields');
      return;
    }
    createTxMutation.mutate({
      account_id: Number(txAccountId),
      category_id: Number(txCategoryId),
      type: txType,
      amount: Number(txAmount),
      description: txDescription,
      date: `${txDate}T00:00:00Z`
    });
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trSrcId || !trDestId || !trAmount) {
      setFormError('Please fill all mandatory fields');
      return;
    }
    if (Number(trSrcId) === Number(trDestId)) {
      setFormError('Source and destination accounts must be different');
      return;
    }
    createTransferMutation.mutate({
      source_account_id: Number(trSrcId),
      destination_account_id: Number(trDestId),
      amount: Number(trAmount),
      description: trDescription
    });
  };

  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);

  // Compute live budget status and risk levels (Deterministic Risk Classifier)
  const getBudgetRiskLevel = (spent: number, budget: number) => {
    if (!budget) return { label: 'No Budget', color: 'text-slate-500 bg-slate-900 border-slate-800' };
    const pct = (spent / budget) * 100;
    if (pct < 70) {
      return { label: 'Low Risk', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    } else if (pct <= 100) {
      return { label: 'Medium Risk', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    } else {
      return { label: 'High Risk / Over', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold' };
    }
  };

  // Pre-fill fields when modal opens
  const openTxModal = () => {
    setTxModalOpen(true);
    if (accounts.length > 0) setTxAccountId(accounts[0].id);
    const expenseCats = categories.filter((c: any) => c.type === 'Expense');
    if (expenseCats.length > 0) {
      setTxCategoryId(expenseCats[0].id);
    } else if (categories.length > 0) {
      setTxCategoryId(categories[0].id);
    }
  };

  const openTransferModal = () => {
    setTransferModalOpen(true);
    if (accounts.length > 1) {
      setTrSrcId(accounts[0].id);
      setTrDestId(accounts[1].id);
    }
  };

  return (
    <div className="space-y-8 font-inter animate-in fade-in duration-300">
      
      {/* --- Top Welcome Banner & KPI cards --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            Workspace Dashboard <Sparkles className="h-5 w-5 text-amber-400 gold-glow animate-pulse" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time ledger updates and active data science modules
          </p>
        </div>

        {/* Global Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={openTxModal}
            className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
          >
            <Plus className="h-4 w-4" /> ADD TRANSACTION
          </button>
          <button
            onClick={openTransferModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold tracking-wide transition-all"
          >
            <ArrowRightLeft className="h-4 w-4 text-amber-500" /> SELF-TRANSFER
          </button>
        </div>
      </div>

      {/* --- KPI Grid --- */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-3xl bg-slate-900/30 border border-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Savings Rate</span>
            <span className="font-outfit font-extrabold text-2xl text-emerald-400 block mt-1.5 emerald-glow">
              {kpis?.savings_rate}%
            </span>
            <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Monthly cycle avg</span>
          </div>

          <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Net Worth</span>
            <span className="font-outfit font-extrabold text-2xl text-amber-500 block mt-1.5 gold-glow">
              {isHideBalance ? '••••••' : `${(kpis?.net_worth || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`}
            </span>
            <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Aggregated Balance</span>
          </div>

          <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Avg Single Spend</span>
            <span className="font-outfit font-extrabold text-2xl text-slate-200 block mt-1.5">
              {isHideBalance ? '••••••' : `${(kpis?.avg_spend || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`}
            </span>
            <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Expense Mean Value</span>
          </div>

          <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Income Stability</span>
            <span className="font-outfit font-extrabold text-2xl text-cyan-400 block mt-1.5 uppercase">
              {kpis?.income_stability}
            </span>
            <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Coeff of Variation</span>
          </div>
        </div>
      )}

      {/* --- Accounts List section --- */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-outfit font-bold text-lg text-slate-300 tracking-wide">
            Your Aggregated Accounts {selectedAccountIds.length > 0 && <span className="text-xs text-amber-500 font-normal">({selectedAccountIds.length} active filter)</span>}
          </h2>
          {selectedAccountIds.length > 0 && (
            <button
              onClick={clearAccountFilters}
              className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider"
            >
              Clear filters
            </button>
          )}
        </div>

        {accountsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 rounded-3xl bg-slate-900/30 border border-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.map((acc: any) => (
              <DashboardCard key={acc.id} account={acc} />
            ))}
          </div>
        )}
      </div>

      {/* --- Budgets & Recent Transactions split layout --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Budget gauges */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <h3 className="font-outfit font-bold text-base text-slate-300 mb-5">
              Active Category Budgets
            </h3>
            
            <div className="space-y-4.5">
              {(() => {
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth();

                const currentMonthExpenses = allTransactions.filter((tx: any) => {
                  if (tx.type !== 'Expense') return false;
                  if (!tx.date) return false;
                  const parts = tx.date.split('T')[0].split('-');
                  if (parts.length !== 3) return false;
                  const [year, month] = parts;
                  return parseInt(year, 10) === currentYear && (parseInt(month, 10) - 1) === currentMonth;
                });

                const activeBudgets = categories.filter((c: any) => c.type === 'Expense' && c.planned_outlay > 0);
                const filteredOut = categories.filter((c: any) => !(c.type === 'Expense' && c.planned_outlay > 0));
                
                console.log("categories returned from API:", categories);
                console.log("categories used by dashboard:", activeBudgets);
                console.log("categories filtered out and why:", filteredOut.map((c: any) => ({
                  name: c.name,
                  reason: c.type !== 'Expense' ? 'Not an Expense category' : 'Planned outlay is 0 or less'
                })));

                return activeBudgets.map((cat: any) => {
                  const actualSpent = currentMonthExpenses
                    .filter((tx: any) => tx.category_id === cat.id || tx.category?.name === cat.name)
                    .reduce((sum: number, tx: any) => sum + tx.amount, 0);
                  const percentage = Math.min(100, (actualSpent / cat.planned_outlay) * 100);
                  const risk = getBudgetRiskLevel(actualSpent, cat.planned_outlay);

                  return (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">{cat.name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border ${risk.color}`}>
                          {risk.label}
                        </span>
                      </div>

                      {/* Slider bar */}
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-950">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            percentage > 100 
                              ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' 
                              : percentage > 75 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                        <span>{isHideBalance ? '••••' : `${actualSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR`} spent</span>
                        <span>Budget: {cat.planned_outlay.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Right Side: Recent Transactions */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <h3 className="font-outfit font-bold text-base text-slate-300 mb-5">
              Recent Activity Ledger
            </h3>

            {txLoading ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16">
                <ArrowDownUp className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-500">No transactions recorded for selected filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="pb-3">Transaction</th>
                      <th className="pb-3">Account</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-xs">
                    {transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-3">
                          <span className="font-bold text-slate-200 block">{tx.description || 'N/A'}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">
                            {formatTransactionDate(tx.date)}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400">{tx.account?.name.split(' ')[0] || 'Unknown'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            tx.type === 'Income' 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}>
                            {tx.category?.name || 'Other'}
                          </span>
                        </td>
                        <td className={`py-3 text-right font-bold ${
                          tx.type === 'Income' ? 'text-emerald-400 emerald-glow' : 'text-slate-300'
                        }`}>
                          {tx.type === 'Income' ? '+' : '-'}
                          {isHideBalance ? '••••' : tx.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- Add Transaction Modal --- */}
      {txModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-4">Add Transaction</h3>
            
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleTxSubmit} className="space-y-4">
              {/* Type Toggle */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900">
                <button
                  type="button"
                  onClick={() => handleTxTypeChange('Expense')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${
                    txType === 'Expense' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  EXPENSE
                </button>
                <button
                  type="button"
                  onClick={() => handleTxTypeChange('Income')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${
                    txType === 'Income' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  INCOME
                </button>
              </div>

              {/* Account selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Account</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id} className="bg-slate-950 text-slate-200">{a.name} ({a.balance} INR)</option>
                  ))}
                </select>
              </div>

              {/* Category selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Category</label>
                <select
                  value={txCategoryId}
                  onChange={(e) => setTxCategoryId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  {categories.filter((c: any) => c.type === txType).map((c: any) => (
                    <option key={c.id} value={c.id} className="bg-slate-950 text-slate-200">{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Description</label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="e.g. Swiggy groceries order"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Date</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                    className="w-full pl-4 pr-10 py-3 rounded-xl glass-input text-xs"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTxModalOpen(false)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={createTxMutation.isPending}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                >
                  {createTxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SAVE'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- Add Self Transfer Modal --- */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-4">Atomic Self-Transfer</h3>
            
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              
              {/* Source Account selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">From Account (Debit)</label>
                <select
                  value={trSrcId}
                  onChange={(e) => setTrSrcId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id} className="bg-slate-950 text-slate-200">{a.name} ({a.balance} INR)</option>
                  ))}
                </select>
              </div>

              {/* Destination Account selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">To Account (Credit)</label>
                <select
                  value={trDestId}
                  onChange={(e) => setTrDestId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id} className="bg-slate-950 text-slate-200">{a.name} ({a.balance} INR)</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Amount to Transfer (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={trAmount}
                  onChange={(e) => setTrAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Transfer Remarks</label>
                <input
                  type="text"
                  value={trDescription}
                  onChange={(e) => setTrDescription(e.target.value)}
                  placeholder="e.g. Monthly savings allocate"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={createTransferMutation.isPending}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                >
                  {createTransferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'EXECUTE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Removed Phase 2 OCR Invoice Scanner Modal */}

    </div>
  );
};
