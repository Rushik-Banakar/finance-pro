import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, categoriesApi, transactionsApi } from '../services/api';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';
import { 
  Loader2, Layers, CheckCircle2, TrendingUp, Sparkles, 
  Brain, AlertTriangle, TrendingDown, Activity
} from 'lucide-react';
import { useUiStore } from '../store/useUiStore';
import { useAuthStore } from '../store/useAuthStore';

export const Analytics: React.FC = () => {
  const { hideBalanceOverride } = useUiStore();
  const { settings } = useAuthStore();
  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);

  // Time Range Selector for category distribution
  const [timeRange, setTimeRange] = useState<'monthly' | 'lifetime'>('lifetime');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Fetch Core Analytics KPIs (statistical summaries)
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => analyticsApi.getKpis()
  });

  // Fetch Categories for budget outlay limits
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getCategories()
  });

  // Fetch All Transactions for Live Aggregation
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', 'analytics'], // Automatic invalidation on edits/deletes
    queryFn: () => transactionsApi.getTransactions({ limit: 500 })
  });

  // Fetch Backend Machine Learning (Scikit-Learn) Analytics
  const { data: mlData, isLoading: mlLoading } = useQuery({
    queryKey: ['mlInsights'],
    queryFn: () => analyticsApi.getMl()
  });

  if (kpisLoading || categoriesLoading || txLoading || mlLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 animate-in fade-in duration-200">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
        <span className="text-sm text-slate-400 font-medium font-outfit">Running Scikit-Learn Models...</span>
      </div>
    );
  }

  // --- Process Category Expense Distribution dynamically from Live Transactions ---
  const expenses = transactions.filter((tx: any) => tx.type === 'Expense');
  
  const filteredExpenses = expenses.filter((tx: any) => {
    if (timeRange === 'lifetime') return true;
    if (!tx.date) return false;
    const parts = tx.date.split('T')[0].split('-');
    if (parts.length !== 3) return false;
    const [year, month] = parts;
    const txYear = parseInt(year, 10);
    const txMonth = parseInt(month, 10) - 1;
    return txYear === currentYear && txMonth === currentMonth;
  });

  // Group amounts by Category name
  const categoryTotals: Record<string, number> = {};
  filteredExpenses.forEach((tx: any) => {
    const catName = tx.category?.name || 'Other';
    categoryTotals[catName] = (categoryTotals[catName] || 0) + tx.amount;
  });

  // Map to format required by Recharts
  const pieData = Object.entries(categoryTotals)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    }))
    .sort((a, b) => b.value - a.value);

  const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f43f5e'];

  return (
    <div className="space-y-8 font-inter animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
        <div className="space-y-2">
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            Ledger & Finance Analytics <Layers className="h-6 w-6 text-amber-400 gold-glow animate-pulse" />
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Real-time balance sheets aggregates, monthly savings ratios, and structured expense distributions calculated from double-entry accounting records.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Savings Rate</span>
          <span className="font-outfit font-extrabold text-2xl text-emerald-400 block mt-1.5 emerald-glow">
            {kpis?.savings_rate}%
          </span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Current monthly cycle</span>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Net Worth</span>
          <span className="font-outfit font-extrabold text-2xl text-amber-500 block mt-1.5 gold-glow">
            {isHideBalance ? '••••••' : `${(kpis?.net_worth || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`}
          </span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Aggregated balances</span>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Mean Expenditure</span>
          <span className="font-outfit font-extrabold text-2xl text-slate-200 block mt-1.5">
            {isHideBalance ? '••••••' : `${(kpis?.avg_spend || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`}
          </span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Average Single spend</span>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10">
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Income Stability</span>
          <span className="font-outfit font-extrabold text-2xl text-cyan-400 block mt-1.5 uppercase">
            {kpis?.income_stability}
          </span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-1 uppercase">Stream Coefficient</span>
        </div>
      </div>

      {/* Split Ratios & Budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Category distribution Pie Chart */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between min-h-[380px]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-outfit font-bold text-base text-slate-200 mb-1">
                Category Distribution
              </h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-4">
                {timeRange === 'monthly' ? 'Monthly Expenses' : 'Lifetime (All-Time) Expenses'}
              </span>
            </div>

            {/* Time selector pills */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-900 shrink-0">
              <button
                onClick={() => setTimeRange('monthly')}
                className={`px-3 py-1 text-[10px] font-bold tracking-wide rounded-md transition-all cursor-pointer ${
                  timeRange === 'monthly' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'text-slate-400'
                }`}
              >
                MONTHLY
              </button>
              <button
                onClick={() => setTimeRange('lifetime')}
                className={`px-3 py-1 text-[10px] font-bold tracking-wide rounded-md transition-all cursor-pointer ${
                  timeRange === 'lifetime' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'text-slate-400'
                }`}
              >
                ALL-TIME
              </button>
            </div>
          </div>

          {pieData.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center">
              <Activity className="h-10 w-10 text-slate-700 mb-2" />
              <p className="text-xs text-slate-500 font-medium">No expenses logged for this time range.</p>
            </div>
          ) : (
            <>
              <div className="h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#f8fafc'
                      }}
                      formatter={(val) => val ? val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : ''}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] text-slate-400 font-semibold border-t border-slate-950/20 pt-3">
                {pieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-1.5 truncate" title={`${entry.name}: ${entry.value}`}>
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{entry.name}</span>
                    <span className="text-slate-500 font-normal">({isHideBalance ? '••' : Math.round(entry.value).toLocaleString()})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Categories Outlay Budgets List */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between min-h-[380px]">
          <div>
            <h3 className="font-outfit font-bold text-base text-slate-200 mb-1">
              Monthly Budgets Outlays
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-4">
              Category Limits & Active Allocations
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px] pr-1 mt-2">
            {categories.filter((c: any) => c.type === 'Expense' && c.planned_outlay > 0).length === 0 ? (
              <div className="text-center py-20">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-500 font-semibold">No planned budget limits defined.</p>
              </div>
            ) : (
              categories.filter((c: any) => c.type === 'Expense' && c.planned_outlay > 0).map((cat: any) => (
                <div key={cat.id} className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-900/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-8.5 w-8.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <TrendingUp className="h-4.5 w-4.5 text-amber-500" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-200 block">{cat.name}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Limit: {cat.planned_outlay.toLocaleString('en-IN')} INR</span>
                    </div>
                  </div>
                  <span className="font-bold font-outfit text-amber-400">
                    Active Budget
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* --- Advanced ML Analytics Sections (Scikit-Learn Outputs) --- */}
      <div className="space-y-4">
        <div>
          <h2 className="font-outfit font-bold text-lg text-slate-300 tracking-wide flex items-center gap-2">
            Advanced ML Analytics Engine <Sparkles className="h-5 w-5 text-amber-400" />
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Predictive forecasting, statistical outliers, and daily behavioral spending clusters derived via Scikit-Learn
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Time-Series Forecast */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between h-80">
            <div>
              <h3 className="font-outfit font-bold text-base text-slate-200 flex items-center gap-2 mb-1">
                Bill Forecasting <Brain className="h-4.5 w-4.5 text-amber-400" />
              </h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-4">
                LinearRegression monthly projections
              </span>
            </div>

            {mlData?.forecast?.status === 'insufficient_data' ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <Brain className="h-10 w-10 text-slate-700 mb-2 opacity-50" />
                <p className="text-[11px] text-slate-500 px-4 leading-normal">Requires at least 2 distinct months of expense data to fit the LinearRegression model.</p>
              </div>
            ) : (
              <div className="space-y-5 flex-1 flex flex-col justify-center">
                <div className="p-4.5 rounded-2xl bg-slate-950/60 border border-slate-900/60 text-center shadow-inner">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Projected for {mlData?.forecast?.next_month}</span>
                  <span className="font-outfit font-extrabold text-2xl text-amber-500 block mt-1.5 gold-glow">
                    {isHideBalance ? '••••••' : `${(mlData?.forecast?.predicted_amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs px-2 font-semibold">
                  <span className="text-slate-400">Trend Vector</span>
                  <span className={`flex items-center gap-1 font-extrabold uppercase ${
                    mlData?.forecast?.trend === 'up' ? 'text-rose-400' : mlData?.forecast?.trend === 'down' ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {mlData?.forecast?.trend === 'up' ? (
                      <>UPWARD <TrendingUp className="h-4 w-4 shrink-0" /></>
                    ) : mlData?.forecast?.trend === 'down' ? (
                      <>DOWNWARD <TrendingDown className="h-4 w-4 shrink-0" /></>
                    ) : (
                      <>STABLE</>
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="text-[9px] text-slate-500 font-semibold uppercase leading-snug border-t border-slate-800/60 pt-2 shrink-0">
              Aggregates historical monthly bills via linear fit
            </div>
          </div>

          {/* Outlier Anomalies */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between h-80">
            <div>
              <h3 className="font-outfit font-bold text-base text-slate-200 flex items-center gap-2 mb-1">
                Outlier Anomalies <AlertTriangle className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
              </h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-4">
                IsolationForest outlier flags
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[160px] my-2">
              {!mlData?.anomalies || mlData.anomalies.length === 0 ? (
                <div className="text-center py-10 h-full flex flex-col items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-50" />
                  <p className="text-[11px] text-slate-500">No anomalous spending deviations detected.</p>
                </div>
              ) : (
                mlData.anomalies.map((an: any) => (
                  <div key={an.id} className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-900/60 text-xs">
                    <div className="flex justify-between items-center font-bold text-slate-200">
                      <span className="truncate max-w-[130px]">{an.description}</span>
                      <span className="text-rose-400 shrink-0 font-extrabold">
                        {isHideBalance ? '••••' : an.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-wide">
                      <span>{an.date}</span>
                      <span className="text-rose-500 font-bold shrink-0">{an.reason}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="text-[9px] text-slate-500 font-semibold uppercase leading-snug border-t border-slate-800/60 pt-2 shrink-0">
              Flags single transactions &gt; 2.0&sigma; or IF scores
            </div>
          </div>

          {/* KMeans Clustering */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between h-80">
            <div>
              <h3 className="font-outfit font-bold text-base text-slate-200 flex items-center gap-2 mb-1">
                Behavioral Clustering <Sparkles className="h-4.5 w-4.5 text-cyan-400" />
              </h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-4">
                KMeans spending categorization
              </span>
            </div>

            {mlData?.clustering?.status === 'insufficient_data' ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <Activity className="h-10 w-10 text-slate-700 mb-2 opacity-50 animate-pulse" />
                <p className="text-[11px] text-slate-500 px-4 leading-normal">Requires daily aggregates across at least 3 separate days to initialize KMeans clustering.</p>
              </div>
            ) : (
              <div className="space-y-2 flex-1 flex flex-col justify-center my-2">
                {mlData?.clustering?.clusters.map((c: any) => (
                  <div key={c.label} className="p-2 rounded-xl bg-slate-950/60 border border-slate-900/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-200 block">{c.label}</span>
                      <span className="text-[9px] text-slate-500 mt-0.5 block uppercase">{c.count} days in cluster</span>
                    </div>
                    <span className="font-outfit font-extrabold text-[11px] text-slate-300 shrink-0">
                      {isHideBalance ? '••••' : `~${c.center.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}/day`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[9px] text-slate-500 font-semibold uppercase leading-snug border-t border-slate-800/60 pt-2 shrink-0">
              Groups daily aggregates into frugal/splurge bands
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
