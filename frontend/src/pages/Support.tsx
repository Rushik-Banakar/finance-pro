import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '../services/api';
import { HelpCircle, Plus, Loader2, ShieldAlert, CheckCircle2, ChevronDown, MessageSquare } from 'lucide-react';

export const Support: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [type, setType] = useState<string>('Bug');
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  // Local state for FAQs toggle
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Fetch Tickets
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['supportTickets'],
    queryFn: () => supportApi.getTickets()
  });

  const createTicketMutation = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supportTickets'] });
      setModalOpen(false);
      resetForm();
      setFormSuccess('Support ticket created successfully. Our team will review it.');
      setTimeout(() => setFormSuccess(''), 4000);
    }
  });

  const resetForm = () => {
    setSubject('');
    setDescription('');
    setType('Bug');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) {
      setFormError('Please fill in both subject and description');
      return;
    }
    createTicketMutation.mutate({
      subject,
      description,
      type
    });
  };

  const faqs = [
    {
      q: 'How do I manage and edit my bank accounts in Finance Pro?',
      a: 'You can view all your bank accounts directly on the dashboard. To edit an account\'s name, bank institution, or type, head over to the Accounts tab and click on the \'Edit\' action. Your actual balance will update automatically based on the income and expenses you record.'
    },
    {
      q: 'How do I record and track my daily income and expenses?',
      a: 'Click the \'Add Transaction\' button on the dashboard to log new transactions. You can select the category, amount, account, and date for each entry. Any changes you make will instantly update your account balances and budget charts.'
    },
    {
      q: 'How do monthly category budgets keep my spending on track?',
      a: 'Under the Budgets & Categories tab, you can set a monthly spending limit for different categories like food, rent, or shopping. As you log transactions, the active budget bars on the dashboard will fill up and show your risk level. This helps you visualize whether you are staying within limits or close to overspending.'
    },
    {
      q: 'How does Finance Pro predict my future expenses?',
      a: 'Finance Pro analyzes your past spending patterns over the previous months to estimate how much you are likely to spend next month. If you are new to the app and have less than three months of history, it uses a safe average of your logged expenses. This projection helps you plan ahead and adjust your current budget.'
    },
    {
      q: 'Why am I seeing Frugal, Moderate, and High Spending labels?',
      a: 'The app groups your daily spending patterns to label each day based on your habits. Frugal days represent low-spend times, moderate days show average utility costs, and high spending indicates higher-than-usual dining or shopping. This grouping makes it easy to identify trends, like whether you spend more on weekends.'
    },
    {
      q: 'How does the Security PIN lock keep my financial information safe?',
      a: 'When enabled, the PIN lock protects your screen with a secure keypad overlay to prevent unauthorized access. The app also monitors activity and will automatically lock itself if it detects you have been away from your device for a while.'
    },
    {
      q: 'What is the AI Financial Coach and how does it help me?',
      a: 'The AI Coach is a personalized assistant that reviews your real-time transactions and savings rate. It provides helpful tips, detects outliers in your budget, and answers questions about your habits. Simply click the floating coach button on the screen to ask for guidance.'
    }
  ];

  return (
    <div className="space-y-8 font-inter animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            Support Center & FAQs <HelpCircle className="h-6 w-6 text-amber-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse knowledgebase guides or submit debugging tickets to the helpdesk
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
        >
          <Plus className="h-4 w-4" /> RAISE TICKET
        </button>
      </div>

      {/* Success Banner */}
      {formSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2 items-center">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* FAQs Section */}
      <div className="space-y-4">
        <h2 className="font-outfit font-bold text-lg text-slate-300 tracking-wide">
          Frequently Answered Guides
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div 
                key={idx} 
                className="glass-panel rounded-2xl border border-slate-800/80 bg-slate-900/10 overflow-hidden cursor-pointer"
                onClick={() => setActiveFaq(isOpen ? null : idx)}
              >
                <div className="p-4 flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-amber-500' : ''}`} />
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed pl-6 border-l-2 border-amber-500/30 animate-in slide-in-from-top-2 duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tickets Logs List */}
      <div className="space-y-4">
        <h2 className="font-outfit font-bold text-lg text-slate-300 tracking-wide">
          Your Submitted Tickets
        </h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="glass-panel p-10 rounded-3xl border border-slate-800 text-center">
            <MessageSquare className="h-8 w-8 text-slate-650 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">No active helpdesk tickets logged.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tickets.map((t: any) => (
              <div key={t.id} className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-900/10 space-y-3.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200 truncate">{t.subject}</span>
                  <span className={`px-2 py-0.25 rounded-full text-[9px] font-extrabold uppercase border ${
                    t.status === 'Open' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {t.status}
                  </span>
                </div>
                
                <p className="text-slate-400 leading-relaxed font-medium">
                  {t.description}
                </p>

                <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold tracking-wider pt-2 border-t border-slate-850">
                  <span>CATEGORY: {t.type.toUpperCase()}</span>
                  <span>{new Date(t.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Raise Ticket Modal --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-outfit font-bold text-lg text-slate-100 mb-4">Submit Helpdesk Ticket</h3>
            
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Ticket Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Account linking failed repeatedly"
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Ticket Classification</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                >
                  <option value="Bug" className="bg-slate-950">Bug / Technical Issue</option>
                  <option value="FeatureRequest" className="bg-slate-950">Feature Request</option>
                  <option value="Feedback" className="bg-slate-950">General Feedback</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Detailed Description</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue or feature request in detail..."
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs"
                />
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
                  disabled={createTicketMutation.isPending}
                  className="flex-1 py-3 rounded-xl btn-gold text-xs flex items-center justify-center gap-2"
                >
                  {createTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SUBMIT'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
