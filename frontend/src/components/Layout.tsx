import React, { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, Wallet, ArrowDownUp, TrendingUp, Tags, 
  HelpCircle, Settings, Menu, X, LogOut, Eye, EyeOff, Lock
} from 'lucide-react';
import { accountsApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, setLocked, updateActivity, checkAutoLock, settings } = useAuthStore();
  const { sidebarOpen, setSidebarOpen, hideBalanceOverride, toggleHideBalance } = useUiStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Inactivity tracking for auto-lock
  useEffect(() => {
    const handleActivity = () => {
      updateActivity();
    };

    // Listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Interval to check inactivity every 5 seconds
    const interval = setInterval(() => {
      checkAutoLock();
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
    };
  }, [updateActivity, checkAutoLock]);

  // Fetch accounts to display live balance selector / net worth
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAccounts(),
    enabled: !!user
  });

  const totalBalance = accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);

  const navigationItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Accounts', path: '/accounts', icon: Wallet },
    { name: 'Transactions', path: '/transactions', icon: ArrowDownUp },
    { name: 'ML Analytics', path: '/analytics', icon: TrendingUp },
    { name: 'Budgets & Categories', path: '/categories', icon: Tags },
    { name: 'Support Tickets', path: '/support', icon: HelpCircle },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isHideBalance = hideBalanceOverride || (settings?.hide_balance ?? false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col md:flex-row">
      
      {/* --- Mobile Header --- */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-900 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-amber-400 gold-glow" />
          <span className="font-outfit font-extrabold text-lg tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
            FINANCE PRO
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleHideBalance}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-500 transition-colors"
          >
            {isHideBalance ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-500 transition-colors"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* --- Mobile Sidebar Overlay drawer --- */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* --- Desktop Sidebar & Mobile Drawer Navigation --- */}
      <aside className={`fixed md:sticky top-0 bottom-0 left-0 z-40 w-64 glass-panel border-r border-slate-800/80 p-5 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0 bg-slate-950/95 backdrop-blur-2xl' : '-translate-x-full'
      }`}>
        <div>
          {/* Logo */}
          <div className="hidden md:flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <TrendingUp className="h-5 w-5 text-slate-950" />
            </div>
            <span className="font-outfit font-extrabold text-xl tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
              FINANCE PRO
            </span>
          </div>

          {/* Quick Info (Net Worth) */}
          <div className="glass-panel rounded-2xl p-4 border border-slate-800/50 mb-6 bg-slate-900/20">
            <span className="text-slate-500 text-xs font-semibold tracking-wider block uppercase">
              Aggregated Balances
            </span>
            <span className="font-outfit font-bold text-xl block mt-1 text-slate-200">
              {isHideBalance ? '••••••' : `${totalBalance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`}
            </span>
          </div>

          {/* Menu */}
          <nav className="space-y-1.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 text-amber-400 shadow-[inset_0_1px_1px_rgba(245,158,11,0.05)]' 
                      : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-amber-400 gold-glow' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Actions */}
        <div className="space-y-3 pt-6 border-t border-slate-800/60">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8.5 w-8.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold font-outfit text-sm text-slate-300">
                {user?.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-sm text-slate-200">{user?.username}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{user?.email?.split('@')[0]}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={toggleHideBalance}
                title="Toggle balance visibility"
                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-900/55 transition-colors"
              >
                {isHideBalance ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
              {settings?.is_pin_enabled && (
                <button 
                  onClick={() => setLocked(true)}
                  title="Lock application session"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-slate-900/55 transition-colors"
                >
                  <Lock className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-800 hover:border-rose-500/20 hover:bg-rose-500/5 text-slate-400 hover:text-rose-400 font-semibold text-xs tracking-wide transition-all"
          >
            <LogOut className="h-4 w-4" />
            LOG OUT
          </button>
        </div>
      </aside>

      {/* --- Main Content Shell --- */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>

    </div>
  );
};
