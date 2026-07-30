import { Hash, Layers } from 'lucide-react';
import { Snapshot } from '../types';

interface IntelligencePanelProps {
  snapshot: Snapshot;
}

const CATEGORY_STYLES: Record<string, { label: string; bar: string; text: string; bg: string }> = {
  gambling: { label: 'Gambling / Betting', bar: 'bg-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  adult: { label: 'Adult / Explicit Content', bar: 'bg-pink-500', text: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  phishing_scam: { label: 'Phishing / Scam', bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  malware_hacking: { label: 'Malware / Hacking', bar: 'bg-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  illegal_pharmaceuticals: { label: 'Illegal Pharmaceuticals', bar: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  gaming: { label: 'Gaming / Betting Like', bar: 'bg-cyan-500', text: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  unavailable: { label: 'Snapshot Unavailable', bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  server_error: { label: 'Server Error Page', bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  error_page: { label: 'Error Page', bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  safe: { label: 'Safe / Benign', bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const highlightKeyword = (text: string | null | undefined, keyword: string) => {
  if (!text) return null;
  if (!keyword) return <span>{text}</span>;
  
  const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-amber-500/30 text-amber-300 px-1 py-0.5 rounded font-extrabold font-mono border border-amber-500/20">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const formatLocationLabel = (rawElement: string | null | undefined): string => {
  if (!rawElement) return "Page Contents";
  
  const clean = rawElement.toLowerCase().trim();
  
  if (clean.includes("meta")) {
    const nameMatch = clean.match(/name="([^"]+)"/) || clean.match(/property="([^"]+)"/);
    if (nameMatch && nameMatch[1]) {
      return `HTML Meta Tag (${nameMatch[1]})`;
    }
    return "HTML Meta Tag (Head Metadata)";
  }
  
  if (clean === "<title>") {
    return "HTML Document Title (<title>)";
  }
  if (clean === "<a>") {
    return "HTML Anchor / Link (<a>)";
  }
  if (clean.match(/^<h[1-6]>$/)) {
    return `HTML Heading (${clean.toUpperCase()})`;
  }
  if (clean === "<p>") {
    return "HTML Body Paragraph (<p>)";
  }
  if (clean === "<div>") {
    return "HTML Content Div (<div>)";
  }
  if (clean === "<span>") {
    return "HTML Inline Text (<span>)";
  }
  if (clean === "<li>") {
    return "HTML List Item (<li>)";
  }
  
  return `HTML Element (${rawElement})`;
};

export default function IntelligencePanel({ snapshot }: IntelligencePanelProps) {
  const ai = snapshot.ai_intelligence;
  
  // Collect categories from scores or list default
  const allScores = ai?.all_scores || {};
  const activeCategories = Object.entries(allScores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-lg font-bold">Snapshot Intelligence Scan</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-medium">
          Captured Content Category Analysis: <span className="text-violet-400 font-bold uppercase">{snapshot.content_category || 'SAFE'}</span>
        </p>
      </div>

      {ai?.summary && (
        <div className="p-3 border border-slate-800 bg-slate-950/40 rounded-xl text-xs font-semibold text-slate-200">
          🔍 AI Verdict: "{ai.summary}"
        </div>
      )}

      {/* Category breakdown */}
      {activeCategories.length > 0 ? (
        <div className="space-y-3.5">
          <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center">
            <Layers size={12} className="mr-1.5 text-violet-400" />
            AI Content Category Scores
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeCategories.map(([cat, score]) => {
              const styles = CATEGORY_STYLES[cat] || CATEGORY_STYLES.safe;
              const pct = Math.round(score * 100);

              return (
                <div key={cat} className="space-y-1 bg-slate-900/10 p-2.5 rounded-xl border border-slate-800/60">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-300">{styles.label}</span>
                    <span className={styles.text}>{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                    <div className={`${styles.bar} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 border border-dashed border-slate-900 rounded-lg text-slate-500 text-xs">
          No significant risk patterns detected by the AI classification engine.
        </div>
      )}

      {/* Flag / Evidence List */}
      <div className="space-y-3">
        <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center">
          <Hash size={12} className="mr-1.5 text-violet-400" />
          Evidence Log ({(Array.isArray(snapshot.flags) ? snapshot.flags : []).length} items)
        </h4>
        {(Array.isArray(snapshot.flags) ? snapshot.flags : []).length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {(Array.isArray(snapshot.flags) ? snapshot.flags : []).map((flag, idx) => {
              return (
                <div key={idx} className="flex flex-col p-3 rounded-lg bg-slate-900/20 border border-slate-800/80 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-extrabold text-white font-mono text-[12px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          "{flag.keyword}"
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {flag.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex items-center space-x-2">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {flag.match_count} match{flag.match_count > 1 ? 'es' : ''}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 font-bold font-mono text-[10px]">
                        +{flag.weight} pts
                      </span>
                    </div>
                  </div>
                  
                  {/* Expanded evidence details */}
                  {(flag.element || flag.snippet) && (
                    <div className="pt-1.5 border-t border-slate-850 space-y-1">
                      {flag.element && (
                        <div className="flex items-center space-x-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                          <span>📍 Location:</span>
                          <span className="text-violet-400 font-semibold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[10px]">
                            {formatLocationLabel(flag.element)}
                          </span>
                        </div>
                      )}
                      {flag.snippet && (
                        <div className="p-2 bg-slate-950/60 rounded-md border border-slate-900 font-mono text-[10px] text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all max-w-full">
                          <span className="text-slate-600 mr-1 select-none">Snippet:</span>
                          {highlightKeyword(flag.snippet, flag.keyword)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 border border-dashed border-slate-900 rounded-lg text-slate-500 text-xs">
            No keyword triggers. Document matches clean baseline signatures.
          </div>
        )}
      </div>
    </div>
  );
}
