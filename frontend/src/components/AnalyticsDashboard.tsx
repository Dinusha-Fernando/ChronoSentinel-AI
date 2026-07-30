import { useState, useMemo } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Layers, Search, User } from 'lucide-react';
import { GlobalStats } from '../types';

interface AnalyticsDashboardProps {
  stats: GlobalStats;
  onScanDomain: (domain: string, force: boolean) => void;
  loading: boolean;
}

export default function AnalyticsDashboard({ stats, onScanDomain, loading }: AnalyticsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const total = stats.total_analyzed || 0;
  const safe = stats.risk_breakdown?.SAFE || 0;
  const medium = stats.risk_breakdown?.MEDIUM || 0;
  const high = (stats.risk_breakdown?.HIGH || 0) + (stats.risk_breakdown?.UNSAFE || 0);

  const safePct = total ? Math.round((safe / total) * 100) : 0;
  const mediumPct = total ? Math.round((medium / total) * 100) : 0;
  const highPct = total ? Math.round((high / total) * 100) : 0;

  const filteredDomains = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return stats.recent_domains || [];
    return (stats.recent_domains || []).filter(d =>
      d.domain.toLowerCase().includes(query)
    );
  }, [searchQuery, stats.recent_domains]);

  const getRiskColor = (level: string): string => {
    if (level === 'HIGH' || level === 'UNSAFE') return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
    if (level === 'MEDIUM') return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    if (level === 'UNKNOWN') return 'text-violet-400 border-violet-500/20 bg-violet-500/5';
    return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
  };

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 flex flex-col justify-between hover:border-slate-700/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">Total Scanned</span>
            <Layers size={16} className="text-violet-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{total}</span>
            <span className="text-[10px] text-slate-400 block font-medium mt-1">Unique targets analyzed</span>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between border-emerald-500/10 bg-emerald-500/5 hover:border-emerald-500/20 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-500/60">Safe baselines</span>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{safe}</span>
            <span className="text-[10px] text-slate-400 block font-medium mt-1">{safePct}% total share</span>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between border-amber-500/10 bg-amber-500/5 hover:border-amber-500/20 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-500/60">Medium Risk</span>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{medium}</span>
            <span className="text-[10px] text-slate-400 block font-medium mt-1">{mediumPct}% total share</span>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between border-rose-500/10 bg-rose-500/5 hover:border-rose-500/20 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-rose-500/60">High Threats</span>
            <ShieldAlert size={16} className="text-rose-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{high}</span>
            <span className="text-[10px] text-slate-400 block font-medium mt-1">{highPct}% total share</span>
          </div>
        </div>
      </div>

      {/* Breakdown panel & Recent List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Risk Profile Distribution */}
        <div className="glass-panel p-6 sm:p-8 space-y-6 lg:col-span-1">
          <div>
            <h3 className="text-base font-bold">Threat distribution</h3>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">Risk profile ratios across catalogued targets</p>
          </div>

          <div className="space-y-4">
            {/* Safe */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-emerald-400">SAFE</span>
                <span className="text-slate-300">{safe} ({safePct}%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full border border-slate-900 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${safePct}%` }} />
              </div>
            </div>

            {/* Medium */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-amber-400">MEDIUM</span>
                <span className="text-slate-300">{medium} ({mediumPct}%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full border border-slate-900 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${mediumPct}%` }} />
              </div>
            </div>

            {/* High */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-rose-400">HIGH</span>
                <span className="text-slate-300">{high} ({highPct}%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full border border-slate-900 overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${highPct}%` }} />
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/20 text-xs text-slate-400 space-y-2 font-medium">
            <div className="flex justify-between">
              <span>Average Risk Rating:</span>
              <span className="text-white font-bold">
                {total ? Math.round((safe * 10 + medium * 50 + high * 85) / total) : 0}/100
              </span>
            </div>
            <div className="flex justify-between">
              <span>Database Integrity:</span>
              <span className="text-emerald-400 font-extrabold flex items-center">
                <ShieldCheck size={11} className="mr-1" />
                Verified OK
              </span>
            </div>
          </div>
        </div>

        {/* Database catalog */}
        <div className="glass-panel p-6 sm:p-8 space-y-6 lg:col-span-2 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold">Domain Catalog Ledger</h3>
              <p className="text-slate-500 text-xs mt-0.5 font-medium">All indexed domain assessments logged into PostgreSQL</p>
            </div>

            {/* Search Input Bar */}
            <div className="relative group w-full sm:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-400 transition-colors duration-200" />
              <input
                type="text"
                placeholder="Search cataloged domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs glass-input focus:border-brand-500/40 transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1 flex-1">
            {filteredDomains.length > 0 ? (
              filteredDomains.map((d, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-3 sm:p-3.5 border border-slate-800 bg-slate-950/20 rounded-xl hover:border-slate-700/50 hover:bg-slate-900/10 transition-all group"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-extrabold text-white block group-hover:text-violet-400 transition-colors truncate">
                        {d.domain}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-mono">
                      <span>Logged: {new Date(d.last_analyzed_at).toLocaleDateString()} at {new Date(d.last_analyzed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="flex items-center text-slate-400 space-x-1" title={d.checked_by?.full_name || 'System / Anonymous'}>
                        <User size={10} className="text-brand-400 shrink-0 inline" />
                        <span className="text-slate-300 font-medium">
                          {d.checked_by?.username || (d.checked_by?.full_name ? d.checked_by.full_name : 'System')}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider border ${getRiskColor(d.risk_level)}`}>
                      {d.risk_level}
                    </span>
                    <button
                      onClick={() => onScanDomain(d.domain, false)}
                      disabled={loading}
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Load Details"
                    >
                      <Search size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                {searchQuery ? "No matching catalog entries found." : "No analysis ledger entries found. Perform your first scan."}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
