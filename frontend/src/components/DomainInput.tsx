import { useState, FormEvent } from 'react';
import { Search, RotateCcw, AlertTriangle, ShieldCheck, Globe } from 'lucide-react';

interface DomainInputProps {
  onScan: (domain: string, forceRefresh: boolean) => void;
  loading: boolean;
}

const THREAT_CATEGORIES = [
  { label: 'Gambling / Betting', icon: '🎰', className: 'border-purple-500/20 bg-purple-500/5 text-purple-200 hover:border-purple-500/40 hover:bg-purple-500/10' },
  { label: 'Adult / Explicit Content', icon: '🔞', className: 'border-pink-500/20 bg-pink-500/5 text-pink-200 hover:border-pink-500/40 hover:bg-pink-500/10' },
  { label: 'Phishing / Scam', icon: '🎣', className: 'border-amber-500/20 bg-amber-500/5 text-amber-200 hover:border-amber-500/40 hover:bg-amber-500/10' },
  { label: 'Malware / Hacking', icon: '💀', className: 'border-rose-500/20 bg-rose-500/5 text-rose-200 hover:border-rose-500/40 hover:bg-rose-500/10' },
  { label: 'Illegal Pharmaceuticals', icon: '💊', className: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200 hover:border-emerald-500/40 hover:bg-emerald-500/10' },
];

export default function DomainInput({ onScan, loading }: DomainInputProps) {
  const [domain, setDomain] = useState<string>('');
  const [forceRefresh] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    let cleanVal = domain.trim().toLowerCase();
    if (!cleanVal) {
      setError('Please enter a valid domain name.');
      return;
    }

    // Automatically strip protocol prefixes (http://, https://), paths, and ports
    cleanVal = cleanVal.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

    // Real domain format validation
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

    if (!domainPattern.test(cleanVal)) {
      setError('Please enter a valid domain format (e.g., domain.com).');
      return;
    }

    setError('');
    onScan(cleanVal, forceRefresh);
  };

  return (
    <div className="glass-panel p-6 sm:p-8 relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/5">
      {/* Decorative background glow */}
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Scan Domain Risk
            </h2>
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" title="System Ready" />
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Perform an active audit of historical web archive signatures and metadata profiles.
          </p>
        </div>

        {/* Global Security Telemetry Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-center border border-slate-800 bg-slate-900/50 rounded-full py-1 px-3 text-[11px] text-slate-400 font-medium">
          <ShieldCheck size={13} className="text-brand-400" />
          <span>Active Risk Engine: v1.0</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input & Search Group */}
        <div className="relative flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
          <div className="relative flex-1 group">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors duration-200" size={18} />
            <input
              type="text"
              placeholder="Enter target domain (e.g. example.com, suspicious-site.net)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e);
                }
              }}
              className="w-full pl-11 pr-4 py-3.5 glass-input text-base font-medium tracking-wide focus:border-blue-500/50 focus:shadow-[0_0_20px_-3px_rgba(59,130,246,0.2)] transition-all duration-200"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full md:w-auto px-8 py-3.5 rounded-lg font-bold transition-all duration-200 flex items-center justify-center space-x-2 text-base ${loading
                ? 'bg-blue-600/50 text-slate-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
              }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Start Analysis</span>
              </>
            )}
          </button>
        </div>

        {/* Telemetry Configuration Banner (Replaces disabled checkbox) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-800/80 bg-slate-900/40 rounded-lg p-3 text-xs text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <RotateCcw size={13} className="text-brand-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Real-time search mode active (fetching fresh scanner findings)</span>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-center text-emerald-400 font-semibold uppercase tracking-wider text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Force Fetch Active</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-rose-400 text-xs border border-rose-500/10 bg-rose-500/5 p-3 rounded-lg">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Threat Categories Footer */}
      <div className="mt-6 border-t border-slate-800/80 pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Target Risk Vectors
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {THREAT_CATEGORIES.map((category) => (
            <div
              key={category.label}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200 scale-100 hover:scale-[1.03] cursor-help ${category.className}`}
            >
              <span aria-hidden="true" className="text-sm leading-none">{category.icon}</span>
              <span>{category.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
