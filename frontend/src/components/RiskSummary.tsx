import { ShieldCheck, ShieldAlert, Calendar, Layers } from 'lucide-react';
import { DomainAnalysisResponse } from '../types';

interface RiskSummaryProps {
  data: DomainAnalysisResponse;
}

export default function RiskSummary({ data }: RiskSummaryProps) {
  const {
    domain,
    risk_score,
    risk_level,
    snapshots_checked,
    last_updated,
    peak_score,
    avg_score,
    category_confidence
  } = data;

  const THREAT_CATEGORIES = new Set(['gambling', 'adult', 'phishing_scam', 'malware_hacking', 'illegal_pharmaceuticals']);
  
  // Primary category helper
  const activeCategories = category_confidence
    ? Object.entries(category_confidence).filter(([_, score]) => score > 0)
    : [];
  const primaryCat = data.primary_category || (activeCategories.length > 0 ? activeCategories[0][0] : 'safe');

  const levelStr = (risk_level || '').toUpperCase();
  const catStr = (primaryCat || '').toLowerCase();

  const isUnsafe = levelStr === 'HIGH' || levelStr === 'UNSAFE' || levelStr === 'CRITICAL' || risk_score >= 50 || THREAT_CATEGORIES.has(catStr);
  const isMedium = !isUnsafe && (levelStr === 'MEDIUM' || levelStr === 'MODERATE' || (risk_score >= 40 && risk_score < 50));
  const isSafe = !isUnsafe && !isMedium;

  // Configuration for threat colors
  const getRiskDetails = () => {
    if (isUnsafe) {
      return {
        color: 'text-rose-300 border-rose-500/40 bg-rose-500/20 shadow-[0_0_14px_rgba(244,63,94,0.35)]',
        fill: '#f43f5e',
        icon: <ShieldAlert className="text-rose-400" size={28} />,
        bg: 'bg-rose-500',
        desc: 'Threat detected. Historical snapshots contain gambling, adult, or fraudulent/phishing content.',
        containerStyle: 'border-l-4 border-l-rose-500 border-rose-500/40 bg-gradient-to-br from-rose-950/30 via-slate-900/85 to-slate-900/95 shadow-[0_0_40px_rgba(244,63,94,0.18)] relative overflow-hidden',
        glowColor: 'bg-rose-500/15',
        scoreColor: 'text-rose-400',
        boxStyle: 'border-rose-500/30 bg-rose-950/30',
      };
    }
    if (isSafe) {
      return {
        color: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/20 shadow-[0_0_14px_rgba(16,185,129,0.35)]',
        fill: '#10b981',
        icon: <ShieldCheck className="text-emerald-400" size={28} />,
        bg: 'bg-emerald-500',
        desc: 'No significant risk patterns detected. Historical content matches safe category signatures.',
        containerStyle: 'border-l-4 border-l-emerald-500 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-slate-900/85 to-slate-900/95 shadow-[0_0_40px_rgba(16,185,129,0.18)] relative overflow-hidden',
        glowColor: 'bg-emerald-500/15',
        scoreColor: 'text-emerald-400',
        boxStyle: 'border-emerald-500/30 bg-emerald-950/30',
      };
    }
    // Medium / Unknown Risk
    return {
      color: 'text-amber-300 border-amber-500/40 bg-amber-500/20 shadow-[0_0_14px_rgba(245,158,11,0.35)]',
      fill: '#f59e0b',
      icon: <ShieldAlert className="text-amber-400" size={28} />,
      bg: 'bg-amber-500',
      desc: 'Moderate risk. Detected some flagged categories or irregular historical content changes.',
      containerStyle: 'border-l-4 border-l-amber-500 border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-900/85 to-slate-900/95 shadow-[0_0_40px_rgba(245,158,11,0.18)] relative overflow-hidden',
      glowColor: 'bg-amber-500/15',
      scoreColor: 'text-amber-400',
      boxStyle: 'border-amber-500/30 bg-amber-950/30',
    };
  };

  const details = getRiskDetails();

  // SVG circular gauge properties
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (risk_score / 100) * circumference;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'gambling':
        return { label: 'Gambling & Betting', icon: '🎰', style: 'text-purple-300 border-purple-500/30 bg-purple-500/10' };
      case 'adult':
        return { label: 'Adult Content', icon: '🔞', style: 'text-rose-300 border-rose-500/30 bg-rose-500/10' };
      case 'phishing_scam':
        return { label: 'Phishing & Scam', icon: '🎣', style: 'text-amber-300 border-amber-500/30 bg-amber-500/10' };
      case 'malware_hacking':
        return { label: 'Malware & Hacking', icon: '💀', style: 'text-rose-400 border-rose-500/30 bg-rose-500/10' };
      case 'illegal_pharmaceuticals':
        return { label: 'Illegal Pharmaceuticals', icon: '💊', style: 'text-violet-300 border-violet-500/30 bg-violet-500/10' };
      case 'gaming':
        return { label: 'Online Gaming', icon: '🎮', style: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' };
      case 'unknown':
        return { label: 'Unknown / Insufficient Data', icon: '❓', style: 'text-slate-400 border-slate-500/30 bg-slate-500/10' };
      default:
        return { label: 'Safe / Legitimate Domain', icon: '✅', style: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
    }
  };

  // Benign Niche Enrichment for Safe Domains
  const niche = data.content_niche;
  const catMeta = (niche && isSafe)
    ? { label: niche.title, icon: niche.icon, style: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' }
    : getCategoryMeta(primaryCat);

  return (
    <div className={`glass-panel p-5 sm:p-8 flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8 ${details.containerStyle}`}>
      {/* Background ambient glow blob */}
      <div className={`absolute -top-24 -right-24 w-64 h-64 ${details.glowColor} rounded-full blur-3xl pointer-events-none`} />

      {/* Circle Gauge Component */}
      <div className="flex flex-col items-center justify-center w-full md:min-w-[180px] md:w-auto relative z-10">
        <div className="relative">
          <svg className="w-32 h-32 sm:w-36 sm:h-36">
            {/* Background Circle */}
            <circle
              className="text-slate-800/80"
              strokeWidth={strokeWidth}
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="72"
              cy="72"
            />
            {/* Progress Circle */}
            <circle
              className="progress-ring__circle"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke={details.fill}
              fill="transparent"
              r={radius}
              cx="72"
              cy="72"
            />
          </svg>
          {/* Centered Score Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black tracking-tight ${details.scoreColor}`}>{risk_score}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Risk Score</span>
          </div>
        </div>

        {/* Score Composition Sub-panel */}
        <div className={`mt-4 w-full border ${details.boxStyle} p-3 rounded-xl flex flex-col space-y-1.5 text-[11px] font-medium text-slate-300`}>
          <div className="flex justify-between">
            <span>Peak Score ({peak_score >= 65 ? '80%' : '60%'}):</span>
            <span className="font-bold text-white">{peak_score}</span>
          </div>
          <div className="flex justify-between">
            <span>Avg Score ({peak_score >= 65 ? '20%' : '40%'}):</span>
            <span className="font-bold text-white">{avg_score}</span>
          </div>
          <div className="border-t border-slate-700/50 my-1 pt-1 flex justify-between font-bold text-[10px] uppercase text-slate-200">
            <span>Weighted Total:</span>
            <span className={details.scoreColor}>{risk_score}</span>
          </div>
        </div>
      </div>

      {/* Domain Details */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <h2 className="text-2xl font-black tracking-tight text-white">{domain}</h2>
            
            {/* Risk Level Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider flex items-center space-x-1.5 ${details.color}`}>
              {details.icon}
              <span>{risk_level} RISK</span>
            </div>

            {/* Category Classification Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center space-x-1.5 ${catMeta.style}`}>
              <span>{catMeta.icon}</span>
              <span>Category: {catMeta.label}</span>
            </div>
          </div>
          
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {details.desc}
          </p>

          {/* Category Classification & Confidence */}
          <div className="space-y-2.5 mb-6 pt-4 border-t border-slate-800/60">
            <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
              <span>Category Classification & Content Summary</span>
            </h4>

            {activeCategories.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {activeCategories.map(([cat, score]) => {
                  const barColor = cat === 'gambling' ? 'bg-purple-500' :
                                   cat === 'adult' ? 'bg-rose-500' :
                                   cat === 'phishing_scam' ? 'bg-amber-500' :
                                   cat === 'malware_hacking' ? 'bg-rose-600' : 
                                   cat === 'illegal_pharmaceuticals' ? 'bg-violet-500' : 'bg-cyan-500';
                  
                  const catLabel = cat.replace('_', ' ').replace('phishing scam', 'phishing / scam').toUpperCase();
                  
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-300">{catLabel}</span>
                        <span className="text-slate-400">{score}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                        <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-emerald-400 font-extrabold uppercase">
                      {niche ? `${niche.icon} ${niche.title}` : 'SAFE / LEGITIMATE CONTENT'}
                    </span>
                    <span className="text-slate-400 font-mono">100% Safety Confidence</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: '100%' }} />
                  </div>
                  {niche && (
                    <p className="text-xs text-slate-300 font-medium pt-1">
                      {niche.desc}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-4 border-t border-slate-800/60">
          <div className="flex items-center space-x-2 text-slate-400">
            <Layers size={16} className="text-slate-500" />
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Snapshots Sampled</p>
              <p className="text-slate-200 font-medium text-sm">{snapshots_checked} Wayback Captures</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Calendar size={16} className="text-slate-500" />
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Last Analyzed</p>
              <p className="text-slate-200 font-medium text-sm">{formatDate(last_updated)}</p>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
