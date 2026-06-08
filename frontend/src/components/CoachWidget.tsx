import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { coachApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';
import { 
  Sparkles, X, Send, MessageSquare, Lightbulb, 
  Activity, ClipboardCheck, Calculator, Target, 
  AlertTriangle, CheckCircle, TrendingUp, HelpCircle, 
  Coins, Sparkle, RefreshCw, Trash2
} from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const CoachWidget: React.FC = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'health' | 'planner' | 'review'>('chat');
  const [plannerSubTab, setPlannerSubTab] = useState<'budget' | 'goal'>('budget');
  const [budgetRule, setBudgetRule] = useState<'rule_50_30_20' | 'rule_60_20_20' | 'rule_aggressive' | 'rule_debt'>('rule_50_30_20');
  
  // Goal Planner Form
  const [goalType, setGoalType] = useState<string>('Emergency Fund');
  const [goalTarget, setGoalTarget] = useState<string>('150000');
  const [goalCurrent, setGoalCurrent] = useState<string>('50000');
  const [goalCalculation, setGoalCalculation] = useState<any>(null);

  // Chat States
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  
  const { settings, user } = useAuthStore();
  const { hideBalanceOverride } = useUiStore();
  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);

  // Key for persistent chat history per user
  const chatHistoryKey = user ? `coach_chat_history_${user.id}` : 'coach_chat_history_guest';
  const defaultInitialMessage: ChatMessage[] = [
    {
      sender: 'assistant',
      text: "Hello! I am your Personal Financial Advisor. I have synchronized with your accounts, category budgets, and transaction history to help you plan your wealth. Ask me a question or explore the diagnostic tabs above.",
      timestamp: new Date().toISOString()
    }
  ];

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(chatHistoryKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultInitialMessage;
      }
    }
    return defaultInitialMessage;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Full Coach Advisor Analysis
  const { data: insights } = useQuery({
    queryKey: ['coachInsights'],
    queryFn: () => coachApi.getInsights(),
    enabled: isOpen
  });

  // Keep chat history stored in localstorage
  useEffect(() => {
    localStorage.setItem(chatHistoryKey, JSON.stringify(chatHistory));
  }, [chatHistory, chatHistoryKey]);

  // Auto-refresh financial diagnostics when panel is opened
  useEffect(() => {
    if (isOpen) {
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    }
  }, [isOpen, queryClient]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
    }
  }, [chatHistory, isOpen, activeTab]);

  // Handle Goal Planning Calculations
  useEffect(() => {
    if (insights) {
      const target = Number(goalTarget) || 0;
      const current = Number(goalCurrent) || 0;
      const needed = Math.max(0, target - current);
      const monthlyIncome = insights.income_baseline || 50000;
      const monthlyExpense = insights.current_month_expense || 20000;
      const currentSurplus = Math.max(1000, monthlyIncome - monthlyExpense);
      
      const suggestedContribution = Math.max(1000, Math.round(currentSurplus * 0.40));
      const estMonths = suggestedContribution > 0 ? Math.ceil(needed / suggestedContribution) : 0;
      
      setGoalCalculation({
        needed,
        suggestedContribution,
        estMonths,
        surplus: currentSurplus
      });
    }
  }, [goalType, goalTarget, goalCurrent, insights]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    // Update history locally first
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setInput('');
    setIsSending(true);

    // Prepare API history in {"role": "user"|"assistant", "content": "..."} format for model memory
    const apiHistory = chatHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    try {
      const res = await coachApi.sendMessage(textToSend, apiHistory);
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        text: "I encountered an error connecting to my diagnostic analysis services. Please verify that the backend server is online.",
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, assistantMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear all conversation history for this session?")) {
      const resetMsg: ChatMessage[] = [
        {
          sender: 'assistant',
          text: "All chat history cleared. Let us start fresh. Ask me about your current budget, emergency timeline, or run a CFO review.",
          timestamp: new Date().toISOString()
        }
      ];
      setChatHistory(resetMsg);
    }
  };

  // Option B: Horizontal scroll chips (Single row only, Max height 60px)
  const quickActions = [
    { text: "How healthy are my finances?", label: "Financial Health" },
    { text: "Give me a CFO Review report", label: "CFO Review" },
    { text: "How much should I save every month?", label: "Budget Advice" },
    { text: "How do I optimize my savings?", label: "Savings Plan" },
    { text: "How long to build a ₹1.5 lakh emergency fund?", label: "Emergency Fund" },
    { text: "Can I afford a bike worth ₹1,20,000?", label: "Affordability Check" }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-inter">
      {/* Floating launcher button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 flex items-center justify-center shadow-[0_4px_25px_rgba(245,158,11,0.4)] border border-amber-300/20 transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer"
          title="Open AI Personal Advisor"
        >
          <Sparkles className="h-6 w-6 animate-pulse" />
        </button>
      )}

      {/* Chat / Advisor Window Panel */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] rounded-3xl glass-panel-gold border border-amber-500/20 shadow-[0_15px_50px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 flex flex-col h-[600px]">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8.5 w-8.5 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                <Sparkles className="h-4.5 w-4.5 text-amber-400 gold-glow animate-pulse" />
              </div>
              <div>
                <span className="font-outfit font-extrabold text-sm tracking-wide block text-slate-100 flex items-center gap-1.5">
                  Advisor Coach <Sparkle className="h-3 w-3 text-emerald-400 inline" />
                </span>
                <span className="text-[9px] text-amber-400 font-semibold block uppercase tracking-widest">
                  Personal Wealth Planner
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === 'chat' && (
                <button
                  onClick={handleClearChat}
                  title="Clear Chat History"
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/25 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Diagnostic Tabs Bar */}
          <div className="flex border-b border-slate-900 bg-slate-950/40 p-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'chat' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="h-3 w-3" /> Chat
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'health' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="h-3 w-3" /> Health
            </button>
            <button
              onClick={() => setActiveTab('planner')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'planner' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator className="h-3 w-3" /> Planner
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'review' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardCheck className="h-3 w-3" /> Review
            </button>
          </div>

          {/* Body Content - Scrollable */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-850">
            
            {/* 1. CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="space-y-4 min-h-full flex flex-col justify-between">
                <div className="space-y-4">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col max-w-[88%] ${
                        msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <div className="p-3.5 rounded-2xl text-xs leading-relaxed bg-amber-500 text-slate-950 font-semibold rounded-tr-none shadow-md">
                          {msg.text}
                        </div>
                      ) : (
                        <div 
                          className="p-3.5 rounded-2xl text-xs leading-relaxed bg-slate-900/70 border border-slate-850 text-slate-200 rounded-tl-none shadow-inner space-y-2.5 overflow-x-auto"
                          dangerouslySetInnerHTML={{ __html: msg.text }}
                        />
                      )}
                      <span className="text-[8px] text-slate-500 mt-1 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex flex-col max-w-[85%] mr-auto items-start">
                      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-850 text-slate-400 text-xs rounded-tl-none shadow-inner flex items-center gap-2">
                        <div className="flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">Advisor calculating...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            {/* 2. HEALTH TAB */}
            {activeTab === 'health' && (
              <div className="space-y-4">
                {!insights ? (
                  <div className="flex flex-col justify-center items-center py-20 space-y-3">
                    <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                    <span className="text-xs text-slate-400 font-semibold">Running Financial Diagnostic...</span>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Score Card */}
                    <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Financial Health</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-outfit font-extrabold text-3xl text-slate-100">{insights.health_score}</span>
                          <span className="text-xs text-slate-500 font-semibold">/ 100</span>
                        </div>
                      </div>
                      
                      {/* Gauge Slider */}
                      <div className="w-32 h-3 rounded-full bg-slate-900 border border-slate-950 overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ${
                            insights.health_score >= 80 ? 'bg-emerald-400' : insights.health_score >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                          style={{ width: `${insights.health_score}%` }}
                        />
                      </div>
                    </div>

                    {/* Explanations checklists */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Advisor Explanations</span>
                      <div className="space-y-2">
                        {insights.explanation?.map((item: any, i: number) => (
                          <div key={i} className="flex gap-2 text-xs items-start">
                            {item.type === 'good' ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${item.type === 'warning' ? 'text-amber-400' : 'text-rose-400'}`} />
                            )}
                            <span className="text-slate-300 font-medium">{item.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Spending Risk detection */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-900">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-rose-400">Spending Risk Warnings</span>
                      <div className="space-y-2">
                        {insights.risks?.map((risk: string, i: number) => (
                          <div key={i} className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs text-rose-300 font-medium">
                            {risk}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Predictive warnings */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-900">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-amber-400">Predictive Warnings</span>
                      <div className="space-y-2">
                        {insights.predictive_warnings?.map((warn: string, i: number) => (
                          <div key={i} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-300 font-medium">
                            {warn}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* 3. PLANNER TAB */}
            {activeTab === 'planner' && (
              <div className="space-y-4">
                {/* Sub-selector */}
                <div className="flex bg-slate-950 p-0.75 rounded-xl border border-slate-900">
                  <button
                    onClick={() => setPlannerSubTab('budget')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                      plannerSubTab === 'budget' ? 'bg-slate-900 text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    BUDGET ALLOCATIONS
                  </button>
                  <button
                    onClick={() => setPlannerSubTab('goal')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                      plannerSubTab === 'goal' ? 'bg-slate-900 text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    GOAL TIMELINE
                  </button>
                </div>

                {!insights ? (
                  <div className="flex flex-col justify-center items-center py-20 space-y-3">
                    <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                    <span className="text-xs text-slate-400 font-semibold">Assembling Budget Matrices...</span>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300">
                    {/* BUDGET SUGGESTIONS */}
                    {plannerSubTab === 'budget' && (
                      <div className="space-y-4">
                        {/* Allocator Mode Selector */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'rule_50_30_20', label: '50/30/20 Standard' },
                            { id: 'rule_60_20_20', label: '60/20/20 Safe' },
                            { id: 'rule_aggressive', label: 'Aggressive Save' },
                            { id: 'rule_debt', label: 'Debt Payoff' }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              onClick={() => setBudgetRule(mode.id as any)}
                              className={`p-2.5 rounded-xl border text-[9px] font-bold text-center transition-all cursor-pointer ${
                                budgetRule === mode.id 
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                  : 'bg-slate-950/40 border-slate-900 text-slate-400'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>

                        {/* Allocations view */}
                        {(() => {
                          const currentRule = insights.budget_suggestions?.[budgetRule];
                          if (!currentRule) return null;

                          return (
                            <div className="space-y-3.5">
                              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-950/30 border border-slate-900 text-center">
                                <div className="space-y-0.5">
                                  <span className="text-[8px] font-bold text-slate-500 block uppercase">Needs</span>
                                  <span className="text-xs font-bold text-slate-200">
                                    {isHideBalance ? '••••' : `₹${Math.round(currentRule.needs).toLocaleString('en-IN')}`}
                                  </span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[8px] font-bold text-slate-500 block uppercase">Wants</span>
                                  <span className="text-xs font-bold text-slate-200">
                                    {isHideBalance ? '••••' : `₹${Math.round(currentRule.wants).toLocaleString('en-IN')}`}
                                  </span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[8px] font-bold text-slate-500 block uppercase">Savings</span>
                                  <span className="text-xs font-bold text-emerald-400">
                                    {isHideBalance ? '••••' : `₹${Math.round(currentRule.savings).toLocaleString('en-IN')}`}
                                  </span>
                                </div>
                              </div>

                              {/* Recommended spending limits */}
                              <div className="space-y-2.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Recommended Limits Per Category</span>
                                <div className="space-y-2">
                                  {Object.entries(currentRule.allocations || {}).map(([cat, amt]: any) => (
                                    <div key={cat} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-900 text-xs">
                                      <span className="font-semibold text-slate-300">{cat}</span>
                                      <span className="font-bold text-slate-200">
                                        {isHideBalance ? '••••' : `₹${Math.round(amt).toLocaleString('en-IN')}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <span className="text-[9px] text-slate-500 font-semibold block text-center uppercase">
                                Suggested allocations are based on monthly baseline income of ₹{Math.round(insights.income_baseline).toLocaleString('en-IN')}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* GOAL PLANNING ASSISTANT */}
                    {plannerSubTab === 'goal' && (
                      <div className="space-y-4">
                        <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-slate-900">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Goal Target Type</label>
                            <select
                              value={goalType}
                              onChange={(e) => setGoalType(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl glass-input text-xs cursor-pointer"
                            >
                              {['Emergency Fund', 'Vacation', 'New Phone', 'Bike', 'Car', 'House Down Payment'].map(g => (
                                <option key={g} value={g} className="bg-slate-950">{g}</option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Target (INR)</label>
                              <input
                                type="number"
                                value={goalTarget}
                                onChange={(e) => setGoalTarget(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl glass-input text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Current (INR)</label>
                              <input
                                type="number"
                                value={goalCurrent}
                                onChange={(e) => setGoalCurrent(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl glass-input text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Goal Analysis Output */}
                        {goalCalculation && (
                          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-3 text-xs leading-relaxed text-slate-300">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                              <span className="font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1">
                                <Target className="h-4 w-4 text-amber-500" /> {goalType} PLAN
                              </span>
                              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                                Active Target
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span>Remaining Deficit:</span>
                              <strong className="text-slate-100">
                                {isHideBalance ? '••••' : `₹${goalCalculation.needed.toLocaleString('en-IN')}`}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span>Suggested Contribution:</span>
                              <strong className="text-emerald-400 font-bold">
                                {isHideBalance ? '••••' : `₹${goalCalculation.suggestedContribution.toLocaleString('en-IN')}`} / mo
                              </strong>
                            </div>

                            <div className="flex justify-between items-baseline pt-1 border-t border-slate-900/60">
                              <span>Estimated Timeline:</span>
                              <strong className="text-amber-400 text-lg font-outfit font-black">
                                {goalCalculation.estMonths} Months
                              </strong>
                            </div>

                            <p className="text-[10px] text-slate-500 font-semibold pt-1 uppercase">
                              * Contribution is calculated as 40% of your current monthly savings surplus (₹{Math.round(goalCalculation.surplus).toLocaleString('en-IN')}).
                            </p>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. REVIEW TAB */}
            {activeTab === 'review' && (
              <div className="space-y-4">
                {!insights ? (
                  <div className="flex flex-col justify-center items-center py-20 space-y-3">
                    <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                    <span className="text-xs text-slate-400 font-semibold">Generating Financial Statement...</span>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Monthly Summary Grade */}
                    {insights.monthly_review && (
                      <div className="p-4 rounded-2xl bg-gradient-to-tr from-slate-950 to-slate-900 border border-slate-850 flex items-center justify-between shadow-lg">
                        <div className="space-y-1 text-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Review Grade</span>
                          <span className="text-slate-300 font-medium block">Savings Rate: **{insights.monthly_review.savings_rate}%**</span>
                          <span className="text-[10px] text-slate-500 font-semibold block uppercase">Month cycle snapshot</span>
                        </div>

                        {/* Grade Badge */}
                        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-outfit text-3xl font-extrabold text-amber-400 gold-glow">
                          {insights.monthly_review.grade}
                        </div>
                      </div>
                    )}

                    {/* Review stats Grid */}
                    {insights.monthly_review && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-900 text-xs">
                          <span className="text-[9px] font-bold text-slate-500 block uppercase">Income</span>
                          <strong className="text-slate-200">
                            {isHideBalance ? '••••' : `₹${Math.round(insights.monthly_review.income).toLocaleString('en-IN')}`}
                          </strong>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-900 text-xs">
                          <span className="text-[9px] font-bold text-slate-500 block uppercase">Expenses</span>
                          <strong className="text-slate-200">
                            {isHideBalance ? '••••' : `₹${Math.round(insights.monthly_review.expense).toLocaleString('en-IN')}`}
                          </strong>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-900 text-xs">
                          <span className="text-[9px] font-bold text-slate-500 block uppercase">Highest Category</span>
                          <strong className="text-slate-300 block truncate">{insights.monthly_review.highest_category}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-900 text-xs">
                          <span className="text-[9px] font-bold text-slate-500 block uppercase">Best Category</span>
                          <strong className="text-emerald-400 block truncate">{insights.monthly_review.best_category}</strong>
                        </div>
                      </div>
                    )}

                    {/* Smart Savings / surplus */}
                    {insights.savings_recommendations && (
                      <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 space-y-3 text-xs">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                          <span className="font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1">
                            <Coins className="h-4 w-4 text-emerald-400 animate-pulse" /> Safe-to-Save Recommendations
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span>Safe Surplus Target:</span>
                          <strong className="text-emerald-400 font-bold">
                            {isHideBalance ? '••••' : `₹${Math.round(insights.savings_recommendations.safe_to_save).toLocaleString('en-IN')}`}
                          </strong>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-900">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">Trimming Opportunities</span>
                          {insights.savings_recommendations.potential_trim?.map((trim: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium">
                              <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span>{trim}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Personalized Insights */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-900">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-amber-500">Personalized Insights</span>
                      <div className="space-y-2">
                        {insights.insights?.map((ins: string, i: number) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-900/50 border border-slate-900 text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>{ins}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

          </div>

          {/* Option B: Single-row horizontal-scrolling suggestion chips (Max height: 60px) */}
          {activeTab === 'chat' && (
            <div className="h-[52px] bg-slate-950/50 border-t border-slate-900 flex gap-2 overflow-x-auto scrollbar-none items-center px-4 whitespace-nowrap shrink-0">
              {quickActions.map((act, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(act.text)}
                  className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/35 text-slate-300 hover:text-amber-400 font-semibold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 hover:scale-103 active:scale-97"
                >
                  <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
                  <span>{act.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input Panel (Only for Chat Tab) */}
          {activeTab === 'chat' && (
            <div className="p-3 bg-slate-950 border-t border-slate-900 flex gap-2 items-center shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend(input);
                }}
                disabled={isSending}
                placeholder="Ask: 'Am I overspending?' or 'CFO review'..."
                className="flex-1 px-4 py-3 rounded-2xl glass-input text-xs text-slate-200 placeholder-slate-500"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={isSending}
                className="h-10 w-10 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 flex items-center justify-center shadow-lg transition-colors shrink-0 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
export default CoachWidget;
