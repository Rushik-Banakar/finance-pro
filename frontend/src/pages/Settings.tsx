import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, settingsApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { Settings as SettingsIcon, Shield, Sliders, ToggleLeft, ToggleRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings, updateSettings } = useAuthStore();
  
  // Local state for PIN update
  const [pinEnabled, setPinEnabled] = useState<boolean>(settings?.is_pin_enabled ?? false);
  const [newPin, setNewPin] = useState<string>('');
  const [pinMessage, setPinMessage] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [pinLoading, setPinLoading] = useState<boolean>(false);

  // Settings modification mutation
  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: (updated) => {
      updateSettings(updated);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
  });

  const handleToggleHideBalance = () => {
    updateSettingsMutation.mutate({
      hide_balance: !settings?.hide_balance
    });
  };

  const handleAutoLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettingsMutation.mutate({
      auto_lock_duration: Number(e.target.value)
    });
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettingsMutation.mutate({
      currency: e.target.value
    });
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage('');
    setPinError('');
    setPinLoading(true);

    try {
      await authApi.updatePin(pinEnabled, pinEnabled ? newPin : undefined);
      
      // Update global Zustand store
      updateSettings({
        is_pin_enabled: pinEnabled
      });

      setPinMessage('PIN security preferences updated successfully.');
      setNewPin('');
    } catch (err: any) {
      setPinError(err.response?.data?.detail || 'Failed to update PIN locks');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="space-y-8 font-inter animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
          System Preferences <SettingsIcon className="h-6 w-6 text-amber-400" />
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Customize currency aggregator views, visual theme presets, and robust PIN security overlays
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Security & Locks (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 space-y-5">
            <h3 className="font-outfit font-bold text-base text-slate-200 flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-amber-400" /> PIN Authentication & Session Lock
            </h3>

            {pinMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2 items-center">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                <span>{pinMessage}</span>
              </div>
            )}

            {pinError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePin} className="space-y-5 text-xs">
              {/* Toggle switch */}
              <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-950/40 border border-slate-900">
                <div>
                  <span className="font-bold text-slate-200 block">Enable Security PIN</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-semibold leading-normal">
                    Requires PIN validation when launching or returning to inactive sessions.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPinEnabled(!pinEnabled)}
                  className="text-slate-400 hover:text-amber-500 transition-colors"
                >
                  {pinEnabled ? (
                    <ToggleRight className="h-9 w-9 text-amber-500 gold-glow" />
                  ) : (
                    <ToggleLeft className="h-9 w-9 text-slate-600" />
                  )}
                </button>
              </div>

              {/* PIN input field */}
              {pinEnabled && (
                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-950/40 border border-slate-900 animate-in slide-in-from-top-3 duration-250">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                    Configure 4-Digit numeric PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter new 4-digit PIN"
                    className="w-full px-4 py-2.5 rounded-xl glass-input tracking-widest text-center text-sm max-w-xs font-bold"
                  />
                  <span className="text-[9px] text-slate-600 block mt-1 leading-snug">
                    Provide a secure digit PIN. Demo seeder defaults to <strong>1234</strong>.
                  </span>
                </div>
              )}

              {/* Save security preferences button */}
              <button
                type="submit"
                disabled={pinLoading}
                className="btn-gold flex items-center justify-center gap-2 px-5 py-3 rounded-xl w-full text-xs"
              >
                {pinLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : 'SAVE SECURITY PREFERENCES'}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Aggregator view customizations (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 space-y-5">
            <h3 className="font-outfit font-bold text-base text-slate-200 flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-amber-400" /> Aggregated layout overrides
            </h3>

            <div className="space-y-4.5 text-xs">
              
              {/* Hiding balance */}
              <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-950/40 border border-slate-900">
                <div>
                  <span className="font-bold text-slate-200 block">Conceal Account Balances</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">
                    Replaces all amounts, balances, and flows with a masked bullet view.
                  </span>
                </div>
                <button
                  onClick={handleToggleHideBalance}
                  className="text-slate-400 hover:text-amber-500 transition-colors"
                >
                  {settings?.hide_balance ? (
                    <ToggleRight className="h-8 w-8 text-amber-500 gold-glow" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-slate-600" />
                  )}
                </button>
              </div>

              {/* Auto lock selection */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-900">
                <span className="font-bold text-slate-200 block">Session Inactivity Lockout</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">
                  Lockout application when idle, showing full-screen PIN entry.
                </span>
                <select
                  value={settings?.auto_lock_duration}
                  onChange={handleAutoLockChange}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs mt-2"
                >
                  <option value={30} className="bg-slate-950">30 seconds (for testing)</option>
                  <option value={120} className="bg-slate-950">2 minutes</option>
                  <option value={300} className="bg-slate-950">5 minutes</option>
                  <option value={600} className="bg-slate-950">10 minutes</option>
                </select>
              </div>

              {/* Currency */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-900">
                <span className="font-bold text-slate-200 block">Flagship Currency Format</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">
                  Sets currency formatting for net asset and forecasting metrics.
                </span>
                <select
                  value={settings?.currency}
                  onChange={handleCurrencyChange}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs mt-2"
                >
                  <option value="INR" className="bg-slate-950">Indian Rupee (INR, ₹)</option>
                  <option value="USD" className="bg-slate-950">US Dollar (USD, $)</option>
                  <option value="EUR" className="bg-slate-950">Euro (EUR, €)</option>
                </select>
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
