import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, User, Mail, Lock, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  
  // Form states
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Authenticate
        const loginRes = await authApi.login({ username: username || email, password });
        
        // Apply token to client
        const savedToken = loginRes.access_token;
        localStorage.setItem('token', savedToken);
        
        // Fetch current user and settings profile
        const userRes = await authApi.getMe();
        const settingsRes = await authApi.getSettings();
        
        // Save to global state store
        login(savedToken, userRes, settingsRes);
        
        let redirectTo = sessionStorage.getItem('redirect_to') || '/';
        if (redirectTo === '/login') {
          redirectTo = '/';
        }
        sessionStorage.removeItem('redirect_to');
        navigate(redirectTo);
      } else {
        // Sign Up
        await authApi.signup({ username, email, password });
        setUsername('');
        setEmail('');
        setPassword('');
        setIsLogin(true);
        setError('Account created successfully! Please log in.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setError('');
    setLoading(true);
    try {
      const loginRes = await authApi.login({ username: 'demo', password: 'Password123' });
      const savedToken = loginRes.access_token;
      localStorage.setItem('token', savedToken);
      
      const userRes = await authApi.getMe();
      const settingsRes = await authApi.getSettings();
      
      login(savedToken, userRes, settingsRes);
      
      let redirectTo = sessionStorage.getItem('redirect_to') || '/';
      if (redirectTo === '/login') {
        redirectTo = '/';
      }
      sessionStorage.removeItem('redirect_to');
      navigate(redirectTo);
    } catch (err: any) {
      setError('Demo login failed. Verify that database seeding was executed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        
        {/* Logo and Greeting */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] mb-3">
            <TrendingUp className="h-6 w-6 text-slate-950" />
          </div>
          <h1 className="font-outfit font-extrabold text-2xl tracking-wider text-slate-100 uppercase">
            FINANCE PRO
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Data Science & Neomorphic Expense Aggregator
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 mb-6">
          <button
            onClick={() => { 
              setIsLogin(true); 
              setError(''); 
              setUsername('');
              setEmail('');
              setPassword('');
            }}
            className={`flex-1 pb-3 text-sm font-bold tracking-wide border-b-2 transition-all ${
              isLogin ? 'border-amber-500 text-amber-400 font-extrabold' : 'border-transparent text-slate-400'
            }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => { 
              setIsLogin(false); 
              setError(''); 
              setUsername('');
              setEmail('');
              setPassword('');
            }}
            className={`flex-1 pb-3 text-sm font-bold tracking-wide border-b-2 transition-all ${
              !isLogin ? 'border-amber-500 text-amber-400 font-extrabold' : 'border-transparent text-slate-400'
            }`}
          >
            SIGN UP
          </button>
        </div>

        {/* Errors / Messages */}
        {error && (
          <div className={`mb-6 p-4 rounded-xl flex gap-3 items-start border text-xs font-medium leading-normal animate-pulse ${
            error.includes('successfully') 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username (Sign Up or Sign In) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
              Username or Email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. demo"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Email (only on Sign Up) */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@domain.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm"
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
              Security Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm"
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl btn-gold flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
            ) : (
              isLogin ? 'SIGN IN' : 'REGISTER ACCOUNT'
            )}
          </button>
        </form>

        {/* --- Instant Seeder Demo Action --- */}
        {isLogin && (
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <button
              onClick={handleDemoAccess}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-amber-500/20 hover:bg-slate-900/60 text-amber-400 font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="h-4 w-4 text-amber-400 animate-pulse gold-glow" />
              ONE-CLICK DEMO ACCESS
            </button>
            <span className="text-[10px] text-slate-500 text-center block mt-2 font-medium leading-snug">
              Unlocks pre-seeded 6 months data, multiple bank balances, and advanced ML analytics instantly.
            </span>
          </div>
        )}

      </div>
    </div>
  );
};
