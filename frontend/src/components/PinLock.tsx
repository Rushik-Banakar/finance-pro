import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../services/api';
import { Lock, Delete } from 'lucide-react';

export const PinLock: React.FC = () => {
  const { isLocked, setLocked, logout } = useAuthStore();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Reset PIN and error state when lock status changes
    if (isLocked) {
      setPin('');
      setError('');
      setShake(false);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleKeyPress = (digit: string) => {
    setError('');
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      
      // Auto-submit when length matches (demo seeder is 4-digit PIN '1234')
      if (newPin.length === 4) {
        submitPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setError('');
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setPin('');
  };

  const submitPin = async (codeToSubmit: string) => {
    setLoading(true);
    try {
      await authApi.verifyPin(codeToSubmit);
      setLocked(false);
    } catch (err: any) {
      setPin('');
      setError(err.response?.data?.detail || 'Incorrect security PIN');
      setShake(true);
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-2xl transition-all duration-300">
      <div className={`w-full max-w-sm px-6 text-center ${shake ? 'animate-shake' : ''}`}>
        
        {/* Glow indicator */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <Lock className="h-7 w-7 gold-glow" />
        </div>

        <h1 className="font-outfit text-2xl font-bold tracking-tight text-slate-100">
          Application Locked
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter your 4-digit security PIN to access Finance Pro
        </p>

        {/* PIN Indicators */}
        <div className="my-8 flex justify-center gap-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`h-4.5 w-4.5 rounded-full border transition-all duration-200 ${
                index < pin.length
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  : 'bg-slate-900 border-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="mb-4 text-xs font-semibold text-rose-500 tracking-wide animate-pulse">
            {error}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleKeyPress(digit)}
              className="pin-btn flex h-16 items-center justify-center rounded-2xl text-xl font-bold font-outfit"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="pin-btn flex h-16 items-center justify-center rounded-2xl text-sm font-semibold tracking-wider font-outfit text-slate-400"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleKeyPress('0')}
            className="pin-btn flex h-16 items-center justify-center rounded-2xl text-xl font-bold font-outfit"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="pin-btn flex h-16 items-center justify-center rounded-2xl text-slate-400"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>

        {/* Emergency Logout Link */}
        <button
          onClick={logout}
          className="text-xs font-medium text-slate-500 hover:text-amber-500 transition-colors"
        >
          Sign Out of Demo Account
        </button>

      </div>
    </div>
  );
};
