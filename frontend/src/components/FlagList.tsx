import { Flag, Eye, CheckSquare } from 'lucide-react';
import { Snapshot } from '../types';

interface FlagListProps {
  snapshots: Snapshot[];
}

interface AggregatedFlag {
  category: string;
  keyword: string;
  weight: number;
  totalMatches: number;
  occurredInDates: Set<string>;
}

interface CategoryStyle {
  badge: string;
  dot: string;
  label: string;
}

export default function FlagList({ snapshots }: FlagListProps) {
  if (!snapshots || snapshots.length === 0) return null;

  // Aggregate unique flags across all snapshots
  const aggregatedFlags: Record<string, AggregatedFlag> = {};

  snapshots.forEach((snap) => {
    const year = snap.timestamp.substring(0, 4);
    const month = snap.timestamp.substring(4, 6);
    const day = snap.timestamp.substring(6, 8);
    const dateStr = `${year}-${month}-${day}`;

    (Array.isArray(snap.flags) ? snap.flags : []).forEach((flag) => {
      const uniqueKey = `${flag.category}:${flag.keyword}`;
      if (!aggregatedFlags[uniqueKey]) {
        aggregatedFlags[uniqueKey] = {
          category: flag.category,
          keyword: flag.keyword,
          weight: flag.weight,
          totalMatches: 0,
          occurredInDates: new Set(),
        };
      }
      aggregatedFlags[uniqueKey].totalMatches += flag.match_count;
      aggregatedFlags[uniqueKey].occurredInDates.add(dateStr);
    });
  });

  const flagsArray = Object.values(aggregatedFlags).sort((a, b) => b.weight - a.weight);

  const getCategoryStyles = (category: string): CategoryStyle => {
    switch (category) {
      case 'gambling':
        return { badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-400', label: 'Gambling Content' };
      case 'adult':
        return { badge: 'text-pink-400 bg-pink-500/10 border-pink-500/20', dot: 'bg-pink-400', label: 'Adult Entertainment' };
      case 'phishing_scam':
        return { badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', label: 'Phishing & Crypto Scam' };
      case 'malware_hacking':
        return { badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20', dot: 'bg-rose-400', label: 'Hacking & Malware' };
      default:
        return { badge: 'text-slate-400 bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-400', label: 'Uncategorized Risk' };
    }
  };

  if (flagsArray.length === 0) {
    return (
      <div className="glass-panel p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
          <CheckSquare size={30} />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">No Risk Flags Triggered</h3>
          <p className="text-slate-400 text-sm max-w-sm mt-1">
            We scanned the sampled HTML snapshots, and no matches were found against our threat signature keywords.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Triggered Content Flags</h3>
        <p className="text-slate-400 text-sm">
          Specific keywords found in the body text of historical captures. Weights are assigned per keyword severity.
        </p>
      </div>

      <div className="space-y-4">
        {flagsArray.map((flag, idx) => {
          const styles = getCategoryStyles(flag.category);
          const datesList = Array.from(flag.occurredInDates).sort();

          return (
            <div
              key={idx}
              className="p-4 border border-slate-800 bg-slate-950/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold text-white font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    "{flag.keyword}"
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border flex items-center space-x-1 ${styles.badge}`}>
                    <span className={`h-1 w-1 rounded-full ${styles.dot} mr-1`} />
                    {styles.label}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="flex items-center space-x-1.5">
                    <Eye size={12} className="text-slate-500" />
                    <span>Matched {flag.totalMatches} times</span>
                  </span>
                  <span>•</span>
                  <span>Seen in: {datesList.join(', ')}</span>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0">
                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold sm:mb-1 block">Threat Weight</span>
                <span className="text-lg font-extrabold text-white bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 flex items-center shadow-inner">
                  <Flag size={14} className="text-violet-400 stroke-[2] mr-1" />
                  <span>+{flag.weight}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
