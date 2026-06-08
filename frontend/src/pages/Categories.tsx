import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, transactionsApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';
import { Tags, Plus, Save, Loader2, ShieldAlert, Trash2 } from 'lucide-react';

export const Categories: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings } = useAuthStore();
  const { hideBalanceOverride } = useUiStore();
  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<string>('Expense');
  const [outlay, setOutlay] = useState<string>('0');
  const [formError, setFormError] = useState<string>('');
  
  // Local state for editing budgets easily
  const [selectedCategoryForBudget, setSelectedCategoryForBudget] = useState<any>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState<boolean>(false);
  const [editingOutlay, setEditingOutlay] = useState<string>('');

  // Category delete states
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteTargetCategory, setDeleteTargetCategory] = useState<any>(null);
  const [deleteChoice, setDeleteChoice] = useState<'move' | 'delete_all' | null>(null);
  const [moveToCategoryId, setMoveToCategoryId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [dependencyCounts, setDependencyCounts] = useState<{
    transactions: number;
    budgets: number;
    analytics: number;
  } | null>(null);

  // Category Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editCategoryTarget, setEditCategoryTarget] = useState<any>(null);
  const [editName, setEditName] = useState<string>('');

  // Category Split states
  const [isSplitModalOpen, setIsSplitModalOpen] = useState<boolean>(false);
  const [splitTargetCategory, setSplitTargetCategory] = useState<any>(null);
  const [splitNameA, setSplitNameA] = useState<string>('');
  const [splitNameB, setSplitNameB] = useState<string>('');
  const [splitOutlayA, setSplitOutlayA] = useState<string>('0');
  const [splitOutlayB, setSplitOutlayB] = useState<string>('0');
  const [splitMigrationOption, setSplitMigrationOption] = useState<'move_all_a' | 'move_all_b' | 'manual'>('move_all_a');
  const [splitTransactions, setSplitTransactions] = useState<any[]>([]);
  const [splitManualMoves, setSplitManualMoves] = useState<Record<string, 'a' | 'b'>>({});
  const [isSplitting, setIsSplitting] = useState<boolean>(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getCategories()
  });

  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalOpen(false);
      resetForm();
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) => categoriesApi.updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['mlInsights'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
      setIsBudgetModalOpen(false);
      setSelectedCategoryForBudget(null);
    }
  });

  const resetForm = () => {
    setName('');
    setType('Expense');
    setOutlay('0');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setFormError('Category name is required');
      return;
    }
    createCategoryMutation.mutate({
      name,
      type,
      planned_outlay: Number(outlay),
      is_custom: true
    });
  };

  const startEdit = (cat: any) => {
    setSelectedCategoryForBudget(cat);
    setEditingOutlay(cat.planned_outlay.toString());
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = () => {
    if (!selectedCategoryForBudget) return;
    updateCategoryMutation.mutate({
      id: selectedCategoryForBudget.id,
      payload: { planned_outlay: Number(editingOutlay) }
    });
  };

  const handleDeleteBudget = () => {
    if (!selectedCategoryForBudget) return;
    const categoryId = selectedCategoryForBudget.id;
    console.log("Delete Budget clicked", categoryId);
    if (window.confirm(`Are you sure you want to delete the budget for ${selectedCategoryForBudget.name}? This will set the limit outlay to 0.`)) {
      updateCategoryMutation.mutate({
        id: selectedCategoryForBudget.id,
        payload: { planned_outlay: 0 }
      });
    }
  };

  const handleDeleteClick = async (cat: any) => {
    const categoryId = cat.id;
    console.log("Delete Category clicked", categoryId);
    
    try {
      // Fetch dependencies first
      const deps = await categoriesApi.getDependencies(cat.id);
      setDependencyCounts({
        transactions: deps.transactions_count,
        budgets: deps.budgets_count,
        analytics: deps.analytics_count
      });
      setDeleteTargetCategory(cat);
      setDeleteChoice('move');
      const alternatives = categories.filter((c: any) => c.id !== cat.id && c.type === cat.type);
      if (alternatives.length > 0) {
        setMoveToCategoryId(alternatives[0].id.toString());
      } else {
        setMoveToCategoryId('');
      }
      setDeleteModalOpen(true);
    } catch (err: any) {
      alert('Failed to audit category dependencies.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetCategory || !deleteChoice) return;
    
    setIsDeleting(true);
    try {
      if (deleteChoice === 'move') {
        if (!moveToCategoryId) {
          alert('Please select a category to move transactions to.');
          setIsDeleting(false);
          return;
        }
        await categoriesApi.deleteCategory(
          deleteTargetCategory.id, 
          false, 
          Number(moveToCategoryId)
        );
      } else if (deleteChoice === 'delete_all') {
        await categoriesApi.deleteCategory(
          deleteTargetCategory.id, 
          true
        );
      }
      
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
      queryClient.invalidateQueries({ queryKey: ['mlInsights'] });
      
      setDeleteModalOpen(false);
      setDeleteTargetCategory(null);
      setDeleteChoice(null);
    } catch (err: any) {
      alert(err.response?.data?.detail?.message || err.response?.data?.detail || 'Failed to complete category deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditNameClick = (cat: any) => {
    setEditCategoryTarget(cat);
    setEditName(cat.name);
    setIsEditModalOpen(true);
  };

  const handleSaveCategoryName = async () => {
    if (!editCategoryTarget || !editName) return;
    try {
      await categoriesApi.updateCategory(editCategoryTarget.id, {
        name: editName
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
      queryClient.invalidateQueries({ queryKey: ['mlInsights'] });
      setIsEditModalOpen(false);
      setEditCategoryTarget(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update category name');
    }
  };

  const handleSplitClick = async (cat: any) => {
    setSplitTargetCategory(cat);
    
    let defaultA = cat.name;
    let defaultB = 'SplitSub';
    if (cat.name.includes('&')) {
      const parts = cat.name.split('&');
      defaultA = parts[0].trim();
      defaultB = parts[1].trim();
    } else if (cat.name.includes('and')) {
      const parts = cat.name.split('and');
      defaultA = parts[0].trim();
      defaultB = parts[1].trim();
    }
    
    setSplitNameA(defaultA);
    setSplitNameB(defaultB);
    
    const halfBudget = Math.floor(cat.planned_outlay / 2).toString();
    setSplitOutlayA(halfBudget);
    setSplitOutlayB(halfBudget);
    
    setSplitMigrationOption('move_all_a');
    setSplitTransactions([]);
    setSplitManualMoves({});
    
    setIsSplitModalOpen(true);
    
    try {
      const txs = await transactionsApi.getTransactions({ categoryId: cat.id });
      setSplitTransactions(txs);
      
      const initialMoves: Record<string, 'a' | 'b'> = {};
      txs.forEach((tx: any) => {
        initialMoves[tx.id.toString()] = 'a';
      });
      setSplitManualMoves(initialMoves);
    } catch (err) {
      console.error('Failed to load transactions for split options', err);
    }
  };

  const handleConfirmSplit = async () => {
    if (!splitTargetCategory || !splitNameA || !splitNameB) return;
    
    setIsSplitting(true);
    try {
      await categoriesApi.splitCategory(splitTargetCategory.id, {
        name_a: splitNameA,
        planned_outlay_a: Number(splitOutlayA),
        name_b: splitNameB,
        planned_outlay_b: Number(splitOutlayB),
        migration_option: splitMigrationOption,
        manual_moves: splitManualMoves
      });
      
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
      queryClient.invalidateQueries({ queryKey: ['mlInsights'] });
      
      setIsSplitModalOpen(false);
      setSplitTargetCategory(null);
    } catch (err: any) {
      alert(err.response?.data?.detail?.message || err.response?.data?.detail || 'Failed to split category');
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-8 font-inter animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            Budgets & Categories <Tags className="h-6 w-6 text-amber-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Define custom categorizations and configure monthly planned outlay limits
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
        >
          <Plus className="h-4 w-4" /> ADD CATEGORY
        </button>
      </div>

      {/* Grid: Expense and Income lists */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Expense Budgets */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 space-y-5">
            <h3 className="font-outfit font-bold text-base text-slate-200">
              Expense Budgets & planned outlays
            </h3>

            <div className="space-y-4">
              {categories.filter((c: any) => c.type === 'Expense').map((cat: any) => (
                <div key={cat.id} className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 space-y-1.5 text-xs">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{cat.name}</span>
                      {cat.is_custom && (
                        <span className="text-[8px] font-extrabold tracking-wider bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.25 rounded-full uppercase">
                          Custom
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[10px] text-slate-500 font-semibold space-y-1">
                      <div className="flex items-center gap-2 mt-0.5">
                        <span>Monthly Budget:</span>
                        <strong className="text-slate-300">
                          {isHideBalance ? '••••' : `${cat.planned_outlay.toLocaleString('en-IN')} INR`}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-500 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleEditNameClick(cat)}
                          className="hover:text-amber-400 transition-colors uppercase"
                        >
                          Edit Name
                        </button>
                        <span className="text-slate-700 font-normal">|</span>
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          className="hover:text-amber-400 transition-colors uppercase"
                        >
                          Edit Budget
                        </button>
                        <span className="text-slate-700 font-normal">|</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(cat)}
                          className="hover:text-amber-400 transition-colors uppercase"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Income Categories */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 space-y-5">
            <h3 className="font-outfit font-bold text-base text-slate-200">
              Income streams
            </h3>

            <div className="space-y-4">
              {categories.filter((c: any) => c.type === 'Income').map((cat: any) => (
                <div key={cat.id} className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 space-y-1.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{cat.name}</span>
                      {cat.is_custom && (
                        <span className="text-[8px] font-extrabold tracking-wider bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.25 rounded-full uppercase">
                          Custom
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                      Inflow channel
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-500 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleEditNameClick(cat)}
                        className="hover:text-amber-400 transition-colors uppercase"
                      >
                        Edit Name
                      </button>
                      <span className="text-slate-700 font-normal">|</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(cat)}
                        className="hover:text-amber-400 transition-colors uppercase"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* --- Add Category Modal --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-4">Add Custom Category</h3>
            
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Type Toggle */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900">
                <button
                  type="button"
                  onClick={() => setType('Expense')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${
                    type === 'Expense' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  EXPENSE
                </button>
                <button
                  type="button"
                  onClick={() => setType('Income')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${
                    type === 'Income' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  INCOME
                </button>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Category Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Subscriptions, Freelance"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Planned Outlay (Expense only) */}
              {type === 'Expense' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Monthly Budget Limit (INR)</label>
                  <input
                    type="number"
                    value={outlay}
                    onChange={(e) => setOutlay(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                  />
                </div>
              )}

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
                  disabled={createCategoryMutation.isPending}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                >
                  {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SAVE'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- Budget Settings Modal --- */}
      {isBudgetModalOpen && selectedCategoryForBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-1">Budget Settings</h3>
            <p className="text-[11px] text-slate-400 mb-4 uppercase font-semibold tracking-wider">
              Category: {selectedCategoryForBudget.name}
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveBudget(); }} className="space-y-4">
              {/* Budget Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                  Budget Amount (INR)
                </label>
                <input
                  type="number"
                  required
                  value={editingOutlay}
                  onChange={(e) => setEditingOutlay(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBudgetModalOpen(false);
                      setSelectedCategoryForBudget(null);
                    }}
                    className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={updateCategoryMutation.isPending}
                    className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                  >
                    {updateCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SAVE CHANGES'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteBudget}
                  disabled={updateCategoryMutation.isPending}
                  className="w-full py-3 mt-1 border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 font-bold text-xs tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> DELETE BUDGET
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Delete Category Options Modal --- */}
      {deleteModalOpen && deleteTargetCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-4">
            <h3 className="font-outfit font-bold text-lg text-slate-100">Delete Category</h3>
            
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <strong className="text-slate-200 font-bold">{deleteTargetCategory.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Linked Transactions:</span>
                <strong className="text-slate-200">{dependencyCounts?.transactions ?? 0}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Linked Budgets:</span>
                <strong className="text-slate-200">{dependencyCounts?.budgets ?? 0}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Linked Analytics References:</span>
                <strong className="text-slate-200">{dependencyCounts?.analytics ?? 0}</strong>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] leading-relaxed">
              <strong>Warning:</strong> Deleting this category may affect historical financial records.
            </div>

            <div className="space-y-3 pt-2">
              {/* Option 1: Move transactions to another category */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 cursor-pointer hover:border-slate-700/60 transition-all block">
                <input
                  type="radio"
                  name="deleteAction"
                  checked={deleteChoice === 'move'}
                  onChange={() => setDeleteChoice('move')}
                  className="mt-0.5 accent-amber-500"
                />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-200 block">Move transactions to another category</span>
                  <span className="text-[10px] text-slate-500 block">Re-associates all existing records to a category of the same type</span>
                  
                  {deleteChoice === 'move' && (
                    <div className="pt-2 animate-in fade-in duration-200">
                      <select
                        value={moveToCategoryId}
                        onChange={(e) => setMoveToCategoryId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="" disabled className="bg-slate-950">Select category...</option>
                        {categories.filter((c: any) => c.id !== deleteTargetCategory.id && c.type === deleteTargetCategory.type).map((c: any) => (
                          <option key={c.id} value={c.id} className="bg-slate-950 text-slate-200">{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </label>

              {/* Option 2: Delete category and related transactions */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 cursor-pointer hover:border-slate-700/60 transition-all block">
                <input
                  type="radio"
                  name="deleteAction"
                  checked={deleteChoice === 'delete_all'}
                  onChange={() => setDeleteChoice('delete_all')}
                  className="mt-0.5 accent-amber-500"
                />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-rose-400 block">Delete category and all transactions</span>
                  <span className="text-[10px] text-rose-500/70 block">WARNING: This will purge all related ledger records and automatically reverse their balance impact on bank accounts.</span>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-800/50">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteTargetCategory(null);
                  setDeleteChoice(null);
                }}
                className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isDeleting || !deleteChoice || (deleteChoice === 'move' && !moveToCategoryId)}
                onClick={handleConfirmDelete}
                className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Edit Category Name & Icon Modal --- */}
      {isEditModalOpen && editCategoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-1">Edit Category Details</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-4">
              Original: {editCategoryTarget.name}
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Category Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Subscriptions"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>



              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditCategoryTarget(null);
                  }}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleSaveCategoryName}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                >
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Split Category Modal --- */}
      {isSplitModalOpen && splitTargetCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 overflow-y-auto py-8">
          <div className="w-full max-w-lg glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-4 my-auto">
            <div>
              <h3 className="font-outfit font-bold text-lg text-slate-100">Split Category</h3>
              <p className="text-xs text-slate-400 mt-1">
                Split <strong className="text-slate-200">{splitTargetCategory.name}</strong> into two separate categories.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category A (Renamed) */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 space-y-3">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Category A (Renamed)</span>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block">Name</label>
                  <input
                    type="text"
                    required
                    value={splitNameA}
                    onChange={(e) => setSplitNameA(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
                {splitTargetCategory.type === 'Expense' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase block">Budget (INR)</label>
                    <input
                      type="number"
                      value={splitOutlayA}
                      onChange={(e) => setSplitOutlayA(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Category B (New Custom) */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 space-y-3">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Category B (New Custom)</span>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block">Name</label>
                  <input
                    type="text"
                    required
                    value={splitNameB}
                    onChange={(e) => setSplitNameB(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
                {splitTargetCategory.type === 'Expense' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase block">Budget (INR)</label>
                    <input
                      type="number"
                      value={splitOutlayB}
                      onChange={(e) => setSplitOutlayB(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Migration Options */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Transaction Migration</label>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/20 border border-slate-850 cursor-pointer hover:border-slate-800 text-xs">
                  <input
                    type="radio"
                    name="splitMigration"
                    checked={splitMigrationOption === 'move_all_a'}
                    onChange={() => setSplitMigrationOption('move_all_a')}
                    className="accent-amber-500"
                  />
                  <span>Move all transactions to <strong className="text-slate-200">{splitNameA}</strong></span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/20 border border-slate-850 cursor-pointer hover:border-slate-800 text-xs">
                  <input
                    type="radio"
                    name="splitMigration"
                    checked={splitMigrationOption === 'move_all_b'}
                    onChange={() => setSplitMigrationOption('move_all_b')}
                    className="accent-amber-500"
                  />
                  <span>Move all transactions to <strong className="text-slate-200">{splitNameB}</strong></span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/20 border border-slate-850 cursor-pointer hover:border-slate-800 text-xs">
                  <input
                    type="radio"
                    name="splitMigration"
                    checked={splitMigrationOption === 'manual'}
                    onChange={() => setSplitMigrationOption('manual')}
                    className="accent-amber-500"
                  />
                  <span>Manually select transaction allocation</span>
                </label>
              </div>
            </div>

            {/* Manual Transaction Selection List */}
            {splitMigrationOption === 'manual' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                  Select Allocation (Total: {splitTransactions.length} records)
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-850 rounded-2xl bg-slate-950/60 p-2 space-y-1.5 font-sans">
                  {splitTransactions.length === 0 ? (
                    <div className="text-center text-[10px] text-slate-500 py-6">No active transactions in this category.</div>
                  ) : (
                    splitTransactions.map((tx: any) => {
                      const txIdStr = tx.id.toString();
                      const selection = splitManualMoves[txIdStr] || 'a';
                      const txDate = tx.date.split('T')[0];
                      return (
                        <div key={tx.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-900/40 border border-slate-950 text-[11px] gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <span className="font-semibold text-slate-300 truncate">{tx.description || 'Transaction'}</span>
                              <strong className="text-slate-200 whitespace-nowrap">₹{tx.amount.toLocaleString()}</strong>
                            </div>
                            <span className="text-[9px] text-slate-500">{txDate}</span>
                          </div>
                          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSplitManualMoves(prev => ({ ...prev, [txIdStr]: 'a' }))}
                              className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${
                                selection === 'a' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                              }`}
                            >
                              {splitNameA.slice(0, 6)}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitManualMoves(prev => ({ ...prev, [txIdStr]: 'b' }))}
                              className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${
                                selection === 'b' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                              }`}
                            >
                              {splitNameB.slice(0, 6)}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-800/50">
              <button
                type="button"
                disabled={isSplitting}
                onClick={() => {
                  setIsSplitModalOpen(false);
                  setSplitTargetCategory(null);
                }}
                className="flex-1 py-3 border border-slate-800 hover:bg-slate-900/40 text-slate-400 font-bold text-xs tracking-wider rounded-xl transition-all"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isSplitting || (splitMigrationOption === 'manual' && splitTransactions.length > 0 && Object.keys(splitManualMoves).length === 0)}
                onClick={handleConfirmSplit}
                className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
              >
                {isSplitting ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'CONFIRM SPLIT'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
