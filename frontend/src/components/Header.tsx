import { useState, useEffect } from 'react';
import { Activity, Database, Server, LogOut, User } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DragonLogo } from './DragonLogo';

interface SystemStatusState {
  status: string;
  postgres: string;
  redis: string;
}

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Header({ activeTab, setActiveTab }: HeaderProps) {
  const { currentUser, logout } = useAuth();
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    status: 'checking',
    postgres: 'checking',
    redis: 'checking',
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await apiService.getHealth();
        setSystemStatus({
          status: data.status,
          postgres: data.postgres === 'healthy' ? 'online' : 'error',
          redis: data.redis === 'healthy' ? 'online' : 'error',
        });
      } catch (err) {
        setSystemStatus({ status: 'offline', postgres: 'offline', redis: 'offline' });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'healthy' || status === 'online') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'checking') return 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getDotColor = (status: string) => {
    if (status === 'healthy' || status === 'online') return 'bg-emerald-400';
    if (status === 'checking') return 'bg-amber-400 animate-pulse';
    return 'bg-rose-500';
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const tabs = [
    { id: 'scan', label: 'Risk Analyzer' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'batch', label: 'Celery Batch' },
    { id: 'health', label: 'Health Status' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-x-0 border-t-0 rounded-none bg-slate-950/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Top bar */}
        <div className="flex items-center justify-between h-14 md:h-16 gap-3">

          {/* Logo */}
          <div className="flex items-center space-x-2.5 min-w-0 shrink-0">
            <DragonLogo size={36} />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base lg:text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-200 truncate">
                ChronoSentinel AI
              </h1>
              <p className="text-[9px] text-slate-400 tracking-wider uppercase font-semibold hidden sm:block">
                Domain History &amp; Risk Intelligence Platform
              </p>
            </div>
          </div>

          {/* Desktop nav tabs */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-xs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 xl:px-3 py-1.5 rounded-lg border font-bold transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-violet-500/80 bg-violet-600/10 text-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.1)]'
                    : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right: status + hamburger */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* User Profile / Logout Dropdown */}
            {currentUser ? (
              <div className="relative border-r border-slate-800 pr-2 sm:pr-3 mr-0.5">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 border border-slate-800 bg-slate-900/30 hover:bg-slate-900/70 p-1 pr-3 rounded-full transition-all duration-200 cursor-pointer focus:outline-none group"
                  aria-haspopup="true"
                  aria-expanded={userDropdownOpen}
                >
                  <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-[0_0_10px_rgba(139,92,246,0.3)] group-hover:scale-105 transition-transform duration-200">
                    {getInitials(currentUser.full_name || currentUser.username)}
                  </div>
                  <span className="hidden md:inline text-xs font-bold text-slate-300 group-hover:text-white transition-colors capitalize truncate max-w-[120px]">
                    {currentUser.full_name || currentUser.username}
                  </span>
                  <span className="text-[9px] text-slate-500 group-hover:text-slate-300 transition-colors">▼</span>
                </button>

                {userDropdownOpen && (
                  <>
                    {/* Transparent Click-out Overlay */}
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setUserDropdownOpen(false)} />
                    
                    {/* Glassmorphic Dropdown Panel */}
                    <div className="absolute right-0 mt-2.5 w-60 rounded-xl border border-slate-800 bg-slate-950/90 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-800/80">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]">
                          {getInitials(currentUser.full_name || currentUser.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-100 truncate capitalize" title={currentUser.full_name || currentUser.username}>
                            {currentUser.full_name || currentUser.username}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate" title={currentUser.email}>
                            {currentUser.email}
                          </p>
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-md font-semibold capitalize">
                            {currentUser.role === 'super_admin' ? 'Super Admin' : currentUser.role}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 space-y-1">
                        {currentUser.role !== 'user' && (
                          <a
                            href="/admin/dashboard"
                            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors flex items-center space-x-2"
                          >
                            <span>💻</span>
                            <span>Admin Dashboard</span>
                          </a>
                        )}
                        <button
                          onClick={() => { logout(); setUserDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all flex items-center space-x-2"
                        >
                          <LogOut size={13} />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a
                href="/login"
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white hover:border-slate-700 transition-all duration-200 flex items-center space-x-1"
              >
                <User size={12} />
                <span>Login</span>
              </a>
            )}

            {/* Compact status dots — always visible */}
            <div className="flex items-center gap-1.5" title={`PG: ${systemStatus.postgres} | Redis: ${systemStatus.redis} | GW: ${systemStatus.status}`}>
              <span className={`h-2 w-2 rounded-full ${getDotColor(systemStatus.postgres)}`} />
              <span className={`h-2 w-2 rounded-full ${getDotColor(systemStatus.redis)}`} />
              <span className={`h-2 w-2 rounded-full ${getDotColor(systemStatus.status)}`} />
            </div>

            {/* Full labels — xl+ only */}
            <div className="hidden xl:flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md border border-slate-800 bg-slate-900/30 text-slate-400">
                <Database size={11} /><span>PG</span>
                <span className={`h-1.5 w-1.5 rounded-full ${getDotColor(systemStatus.postgres)}`} />
              </div>
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md border border-slate-800 bg-slate-900/30 text-slate-400">
                <Server size={11} /><span>Redis</span>
                <span className={`h-1.5 w-1.5 rounded-full ${getDotColor(systemStatus.redis)}`} />
              </div>
              <div className={`flex items-center space-x-1.5 px-2 py-1 rounded-md border ${getStatusColor(systemStatus.status)}`}>
                <Activity size={11} />
                <span className="font-medium capitalize">{systemStatus.status}</span>
              </div>
            </div>

            {/* Hamburger — mobile / tablet */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white transition-colors"
              aria-label="Toggle navigation"
            >
              <div className="w-4 space-y-1">
                <span className={`block h-0.5 bg-current transition-transform duration-200 origin-center ${mobileMenuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
                <span className={`block h-0.5 bg-current transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 bg-current transition-transform duration-200 origin-center ${mobileMenuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-slate-800/60 py-2 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-violet-600/10 text-violet-400 border border-violet-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {currentUser ? (
              <div className="border-t border-slate-800/40 pt-2 pb-1 px-4 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 truncate max-w-[150px]">
                  👤 {currentUser.full_name || currentUser.username}
                </span>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-rose-500/30 bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 transition-all flex items-center space-x-1"
                >
                  <LogOut size={12} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-800/40 pt-2 pb-1 px-4">
                <a
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white flex items-center justify-center space-x-1.5 text-xs font-bold"
                >
                  <User size={12} />
                  <span>Login</span>
                </a>
              </div>
            )}

            {/* Status row in mobile menu */}
            <div className="flex items-center gap-3 px-4 pt-2 pb-1 text-[11px] text-slate-500 border-t border-slate-800/40 mt-1">
              <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${getDotColor(systemStatus.postgres)}`} />Postgres</span>
              <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${getDotColor(systemStatus.redis)}`} />Redis</span>
              <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${getDotColor(systemStatus.status)}`} />Gateway</span>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
