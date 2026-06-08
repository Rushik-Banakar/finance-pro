import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, accountsApi, categoriesApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';
import { 
  ArrowDownUp, Search, Trash2, Download, 
  ArrowRightLeft, Loader2, ArrowRight, Pencil, ShieldAlert,
  Calendar
} from 'lucide-react';

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

const formatTransferDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [, month, day] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${day} ${months[monthIdx]}`;
};

const formatToLocalDateString = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

export const Transactions: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings } = useAuthStore();
  const { hideBalanceOverride } = useUiStore();
  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const limit = 100;

  // Edit Transaction States
  const [editingTx, setEditingTx] = useState<any>(null);
  const [editType, setEditType] = useState<string>('Expense');
  const [editAccountId, setEditAccountId] = useState<number>(0);
  const [editCategoryId, setEditCategoryId] = useState<number>(0);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editError, setEditError] = useState<string>('');

  // Fetch Filters Options
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAccounts()
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getCategories()
  });

  // Fetch Transactions List
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', search, type, accountId, categoryId, startDate, endDate, limit],
    queryFn: () => transactionsApi.getTransactions({
      search: search || undefined,
      type: type || undefined,
      accountIds: accountId ? [Number(accountId)] : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      limit
    })
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => transactionsApi.getTransfers()
  });

  // Delete Transaction Mutation
  const deleteTxMutation = useMutation({
    mutationFn: transactionsApi.deleteTransaction,
    onSuccess: (data, id) => {
      setSelectedIds(prev => prev.filter(item => item !== id));
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    }
  });

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction record? Old account balance impacts will be automatically reversed.')) {
      deleteTxMutation.mutate(id);
    }
  };

  // Edit Transaction Mutation
  const editTxMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => transactionsApi.updateTransaction(id, payload),
    onSuccess: () => {
      setEditingTx(null);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.detail || 'Failed to update transaction');
    }
  });

  const handleEditStart = (tx: any) => {
    setEditingTx(tx);
    setEditType(tx.type);
    setEditAccountId(tx.account_id);
    setEditCategoryId(tx.category_id);
    setEditAmount(tx.amount.toString());
    setEditDescription(tx.description || '');
    setEditDate(tx.date ? tx.date.split('T')[0] : '');
    setEditError('');
  };

  const handleEditTypeChange = (newType: string) => {
    setEditType(newType);
    const filteredCats = categories.filter((c: any) => c.type === newType);
    if (filteredCats.length > 0) {
      setEditCategoryId(filteredCats[0].id);
    } else {
      setEditCategoryId(0);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    if (!editAccountId || !editCategoryId || !editAmount || !editDate) {
      setEditError('Please fill in all required fields');
      return;
    }
    const amountNum = Number(editAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setEditError('Amount must be a positive number');
      return;
    }

    editTxMutation.mutate({
      id: editingTx.id,
      payload: {
        account_id: Number(editAccountId),
        category_id: Number(editCategoryId),
        type: editType,
        amount: amountNum,
        description: editDescription,
        date: `${editDate}T00:00:00Z`
      }
    });
  };

  // Bulk Delete Mutation
  const deleteBulkMutation = useMutation({
    mutationFn: transactionsApi.bulkDeleteTransactions,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    }
  });

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const step1 = window.confirm(`Are you sure you want to delete the selected ${count} ${count === 1 ? 'transaction' : 'transactions'}?`);
    if (step1) {
      const step2 = window.confirm(`WARNING: This will permanently delete these ${count} records and automatically reverse their balance impact on the respective bank accounts. This action is irreversible. Proceed?`);
      if (step2) {
        deleteBulkMutation.mutate({ ids: selectedIds });
      }
    }
  };

  const handleDeleteAll = () => {
    const step1 = window.confirm("CRITICAL WARNING: Are you sure you want to delete ALL transactions in the ledger?");
    if (step1) {
      const step2 = window.confirm("DANGER RESET: This will completely wipe all historical ledger transactions and reset all bank account balances back to their starting values. There is NO undo. Are you absolutely certain you want to wipe the ledger?");
      if (step2) {
        deleteBulkMutation.mutate({ all: true });
      }
    }
  };

  // CSV Exporter Logic (Robust tabular exporter)
  const handleExportCSV = () => {
    if (transactions.length === 0) return;

    // Header fields
    const headers = ['Date', 'Description', 'Account', 'Bank', 'Category', 'Type', 'Amount (INR)'];
    
    // Rows
    const rows = transactions.map((t: any) => [
      formatToLocalDateString(t.date),
      `"${t.description || 'No description'}"`,
      t.account?.name || 'N/A',
      t.account?.bank_name || 'N/A',
      t.category?.name || 'N/A',
      t.type,
      t.amount
    ]);

    // CSV format assembly
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    
    // Anchor download trigger
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FinancePro_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 font-inter animate-in fade-in duration-300">
      
      {/* Header & Exporter */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            Ledger & Transactions <ArrowDownUp className="h-6 w-6 text-amber-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete CRUD ledger access with atomic balance logs and filters
          </p>
        </div>

        <div className="flex items-center gap-3">
          {transactions.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deleteBulkMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold tracking-wide transition-all disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> DELETE ALL
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold tracking-wide transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-4 w-4" /> EXPORT CSV
          </button>
        </div>
      </div>

      {/* --- Filters Grid Panel --- */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* Search */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">Search Description</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
            />
          </div>
        </div>

        {/* Type */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl glass-input text-xs"
          >
            <option value="" className="bg-slate-950">All Types</option>
            <option value="Expense" className="bg-slate-950">Expense</option>
            <option value="Income" className="bg-slate-950">Income</option>
          </select>
        </div>

        {/* Account */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl glass-input text-xs"
          >
            <option value="" className="bg-slate-950">All Accounts</option>
            {accounts.map((a: any) => (
              <option key={a.id} value={a.id} className="bg-slate-950">{a.name}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl glass-input text-xs"
          >
            <option value="" className="bg-slate-950">All Categories</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id} className="bg-slate-950">{c.name} ({c.type})</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">Start Date</label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
              className="w-full pl-3 pr-10 py-2.5 rounded-xl glass-input text-xs"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
          </div>
        </div>

        {/* End Date */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">End Date</label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
              className="w-full pl-3 pr-10 py-2.5 rounded-xl glass-input text-xs"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
          </div>
        </div>

      </div>

      {/* --- Transactions Table Split Layout --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: General Transaction Table (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <div className="flex justify-between items-center mb-5 min-h-[40px]">
              <h3 className="font-outfit font-bold text-base text-slate-300">
                Ledger Sheet
              </h3>
              
              {/* Sleek Floating Action Panel when selectedIds.length > 0 */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      {selectedIds.length} selected
                    </span>
                  </div>
                  <div className="h-4 w-px bg-slate-800" />
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleteBulkMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {deleteBulkMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    DELETE SELECTED
                  </button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-20">
                <ArrowDownUp className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                <p className="text-xs text-slate-500">No matching ledger records found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2 w-10">
                        <input
                          type="checkbox"
                          checked={transactions.length > 0 && transactions.every((tx: any) => selectedIds.includes(tx.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const visibleIds = transactions.map((tx: any) => tx.id);
                              setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                            } else {
                              const visibleIds = transactions.map((tx: any) => tx.id);
                              setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-slate-950 cursor-pointer accent-amber-500"
                        />
                      </th>
                      <th className="pb-3">Transaction</th>
                      <th className="pb-3">Account</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3 text-right">Amount</th>
                      <th className="pb-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30 text-xs">
                    {transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-3 pl-2 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(tx.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => [...prev, tx.id]);
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== tx.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-slate-950 cursor-pointer accent-amber-500"
                          />
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-200 block">{tx.description || 'No description'}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">
                            {formatTransactionDate(tx.date)}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400">{tx.account?.name || 'N/A'}</td>
                        <td className="py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            tx.type === 'Income'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}>
                            {tx.category?.name || 'N/A'}
                          </span>
                        </td>
                        <td className={`py-3 text-right font-bold ${
                          tx.type === 'Income' ? 'text-emerald-400' : 'text-slate-300'
                        }`}>
                          {tx.type === 'Income' ? '+' : '-'}
                          {isHideBalance ? '••••' : tx.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditStart(tx)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-900 transition-all cursor-pointer"
                              title="Edit transaction record"
                            >
                              <Pencil className="h-4.5 w-4.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-slate-900 transition-all cursor-pointer"
                              title="Delete transaction record"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Self-Transfers List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10">
            <h3 className="font-outfit font-bold text-base text-slate-300 mb-5">
              Transfers Log
            </h3>

            {transfers.length === 0 ? (
              <div className="text-center py-12">
                <ArrowRightLeft className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No bank transfers logged recently.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                {transfers.map((tr: any) => (
                  <div key={tr.id} className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-2">
                      <span>{formatTransferDate(tr.date)}</span>
                      <span className="text-amber-500 tracking-wide uppercase font-extrabold">BANK TRANSFER</span>
                    </div>

                    <div className="flex items-center justify-between font-bold text-slate-200 mb-2">
                      <span className="truncate">{tr.source_account?.bank_name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500 mx-2" />
                      <span className="truncate">{tr.destination_account?.bank_name}</span>
                    </div>

                    <p className="text-slate-400 leading-snug mb-2 font-medium">
                      {tr.description || 'Self balance allocation'}
                    </p>

                    <div className="text-right font-extrabold text-slate-200">
                      {isHideBalance ? '••••' : tr.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- Edit Transaction Modal --- */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-4">Edit Transaction</h3>
            
            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Type Toggle */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900">
                <button
                  type="button"
                  onClick={() => handleEditTypeChange('Expense')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${
                    editType === 'Expense' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  EXPENSE
                </button>
                <button
                  type="button"
                  onClick={() => handleEditTypeChange('Income')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${
                    editType === 'Income' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  INCOME
                </button>
              </div>

              {/* Account selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Account</label>
                <select
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id} className="bg-slate-950 text-slate-200">
                      {a.name} ({a.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Category</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  {categories.filter((c: any) => c.type === editType).map((c: any) => (
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
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Description</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
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
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
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
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={editTxMutation.isPending}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                >
                  {editTxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SAVE'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
