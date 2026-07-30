import { useState } from 'react';
import { ChevronRight, ChevronDown, Clock } from 'lucide-react';
import { TimelineEntry, Snapshot } from '../types';

interface TimelineViewProps {
  timeline: TimelineEntry[] | null;
  snapshots: Snapshot[];
  onSelectSnapshot?: (snapshot: Snapshot) => void;
}

const CATEGORY_STYLES: Record<string, { label: string; icon: string; bg: string; border: string; text: string }> = {
  gambling: { label: 'Gambling / Betting', icon: 'GB', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  adult: { label: 'Adult Content', icon: 'AD', bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400' },
  phishing_scam: { label: 'Phishing / Scam', icon: 'PH', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  malware_hacking: { label: 'Malware / Hacking', icon: 'MW', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' },
  illegal_pharmaceuticals: { label: 'Pharmaceuticals', icon: 'RX', bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400' },
  gaming: { label: 'Gaming / Betting Like', icon: 'GM', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  safe: { label: 'Safe / Benign', icon: 'OK', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
};

export default function TimelineView({ timeline, snapshots, onSelectSnapshot }: TimelineViewProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-slate-500 text-sm">
        No timeline intelligence generated for this domain.
      </div>
    );
  }

  const handleYearClick = (year: number) => {
    setSelectedYear(selectedYear === year ? null : year);
  };

  const getRiskColor = (score: number) => {
    if (score > 60) return 'text-rose-400';
    if (score > 30) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getRiskBg = (score: number) => {
    if (score > 60) return 'bg-rose-500/10 border-rose-500/20';
    if (score > 30) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-emerald-500/10 border-emerald-500/20';
  };

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-lg font-bold">Historical Domain Timeline</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-medium">
          Year-by-year chronological threat intelligence log and classifications
        </p>
      </div>

      <div className="relative border-l-2 border-slate-800/80 ml-3 sm:ml-4 pl-5 sm:pl-6 space-y-6 sm:space-y-8 py-2">
        {timeline.map((entry) => {
          const isExpanded = selectedYear === entry.year;
          const styles = CATEGORY_STYLES[entry.category] || CATEGORY_STYLES.safe;
          const categoryLabel = entry.category_label || styles.label;
          const categoryIcon = entry.category_icon || styles.icon;
          const yearSnapshots = snapshots.filter((snapshot) => snapshot.timestamp.startsWith(String(entry.year)));

          return (
            <div key={entry.year} className="relative group">
              <div
                onClick={() => handleYearClick(entry.year)}
                className={`absolute -left-[30px] sm:-left-[35px] top-1 h-[22px] w-[22px] sm:h-[26px] sm:w-[26px] rounded-full border-2 bg-slate-950 flex items-center justify-center cursor-pointer transition-all duration-300 group-hover:scale-110 z-10 ${
                  entry.risk_score > 60 ? 'border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]' :
                  entry.risk_score > 30 ? 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]' :
                  'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                }`}
              >
                <span className="text-[10px] font-bold">{categoryIcon}</span>
              </div>

              <div
                className={`p-4 rounded-xl border border-slate-800/60 bg-slate-900/10 hover:bg-slate-900/20 hover:border-slate-700/50 transition-all duration-200 cursor-pointer ${
                  isExpanded ? 'border-slate-700 bg-slate-900/20' : ''
                }`}
                onClick={() => handleYearClick(entry.year)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-base font-extrabold text-white tracking-wide font-mono">
                      {entry.year}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles.bg} ${styles.border} ${styles.text}`}>
                      {categoryLabel}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${getRiskBg(entry.risk_score)} ${getRiskColor(entry.risk_score)}`}>
                      Score: {Math.round(entry.risk_score)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {entry.snapshot_count} capture(s)
                    </span>
                    {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </div>
                </div>

                <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                  {entry.summary}
                </p>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2.5" onClick={(event) => event.stopPropagation()}>
                    <h5 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                      Snapshots from {entry.year}
                    </h5>
                    {yearSnapshots.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {yearSnapshots.map((snap, index) => {
                          const dateObj = new Date(
                            `${snap.timestamp.substring(0, 4)}-${snap.timestamp.substring(4, 6)}-${snap.timestamp.substring(6, 8)}`
                          );
                          const dateLabel = dateObj.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          });

                          return (
                            <div
                              key={index}
                              onClick={() => onSelectSnapshot?.(snap)}
                              className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-900/30 transition-colors flex items-center justify-between text-xs cursor-pointer group/item"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5 text-white font-bold">
                                  <Clock size={11} className="text-slate-500" />
                                  <span>{dateLabel}</span>
                                </div>
                                <span className="text-[9px] text-slate-500 font-mono block truncate max-w-[160px]">
                                  {snap.original_url}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getRiskBg(snap.risk_score)} ${getRiskColor(snap.risk_score)} group-hover/item:scale-105 transition-transform`}>
                                {snap.risk_score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-2 text-slate-600 text-xs">
                        No captures cached for this specific year node.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
