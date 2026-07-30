import { Brain, CheckCircle, Clock } from 'lucide-react';
import { DomainAnalysisResponse } from '../types';

interface ExplainabilityCardProps {
  data: DomainAnalysisResponse;
}

export default function ExplainabilityCard({ data }: ExplainabilityCardProps) {
  const {
    risk_narrative, evidence_bullets, primary_category,
    ai_confidence, risk_period, risk_level, risk_score,
  } = data;

  if (!risk_narrative) return null;

  const THREAT_CATEGORIES = new Set(['gambling', 'adult', 'phishing_scam', 'malware_hacking', 'illegal_pharmaceuticals']);
  const cat = primary_category || 'safe';
  const levelStr = (risk_level || '').toUpperCase();
  const catStr = (cat || '').toLowerCase();
  const score = risk_score ?? 0;

  const isUnsafe = levelStr === 'HIGH' || levelStr === 'UNSAFE' || levelStr === 'CRITICAL' || score >= 50 || THREAT_CATEGORIES.has(catStr);
  const isMedium = !isUnsafe && (levelStr === 'MEDIUM' || levelStr === 'MODERATE' || (score >= 40 && score < 50));
  const isSafe = !isUnsafe && !isMedium;

  const theme = isUnsafe
    ? {
        color: '#f43f5e',
        badgeBg: 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.35)]',
        boxBg: 'bg-rose-950/25 border-rose-500/35',
        containerStyle: 'border-l-4 border-l-rose-500 border-rose-500/40 bg-gradient-to-br from-rose-950/30 via-slate-900/85 to-slate-900/95 shadow-[0_0_40px_rgba(244,63,94,0.18)] relative overflow-hidden',
        glowColor: 'bg-rose-500/15',
        iconColor: '#f43f5e',
        barColor: 'bg-rose-500',
        checkColor: '#f43f5e',
        icon: '⚠️',
      }
    : isSafe
    ? {
        color: '#10b981',
        badgeBg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.35)]',
        boxBg: 'bg-emerald-950/25 border-emerald-500/35',
        containerStyle: 'border-l-4 border-l-emerald-500 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-slate-900/85 to-slate-900/95 shadow-[0_0_40px_rgba(16,185,129,0.18)] relative overflow-hidden',
        glowColor: 'bg-emerald-500/15',
        iconColor: '#10b981',
        barColor: 'bg-emerald-500',
        checkColor: '#10b981',
        icon: '✅',
      }
    : {
        color: '#f59e0b',
        badgeBg: 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.35)]',
        boxBg: 'bg-amber-950/25 border-amber-500/35',
        containerStyle: 'border-l-4 border-l-amber-500 border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-900/85 to-slate-900/95 shadow-[0_0_40px_rgba(245,158,11,0.18)] relative overflow-hidden',
        glowColor: 'bg-amber-500/15',
        iconColor: '#f59e0b',
        barColor: 'bg-amber-500',
        checkColor: '#f59e0b',
        icon: '⚡',
      };

  const confPct = ai_confidence != null ? Math.round(ai_confidence * 100) : (isSafe ? 100 : null);

  return (
    <div className={`glass-panel p-6 sm:p-8 space-y-6 transition-all duration-300 ${theme.containerStyle}`}>
      {/* Background ambient glow blob */}
      <div className={`absolute -top-24 -right-24 w-64 h-64 ${theme.glowColor} rounded-full blur-3xl pointer-events-none`} />

      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border shrink-0 ${theme.badgeBg}`}>
            <Brain size={20} style={{ color: theme.color }} />
          </div>
          <div className="text-left">
            <h3 className="text-base sm:text-lg font-bold text-white">AI Risk Explanation</h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Automatically generated from content analysis and structural signals
            </p>
          </div>
        </div>
        {confPct != null && (
          <span className={`px-3.5 py-1 rounded-full text-xs font-extrabold border shrink-0 uppercase tracking-wider ${theme.badgeBg}`}>
            {confPct}% confidence
          </span>
        )}
      </div>

      {/* Two Column Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch relative z-10">
        
        {/* Left Column: AI explanation narrative & metadata */}
        <div className="flex flex-col justify-between space-y-4">
          <div className="space-y-3 text-left">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Analysis Narrative
            </h4>
            <div className={`p-5 rounded-xl border ${theme.boxBg} relative overflow-hidden min-h-[140px] flex flex-col justify-center`}>
              <div className="absolute top-0 left-0 h-full w-1.5 rounded-l-xl" style={{ backgroundColor: theme.color }} />
              <p className="text-sm text-slate-100 leading-relaxed pl-2 font-medium">
                {risk_narrative}
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Confidence bar indicator */}
            {confPct != null && (
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">{isSafe ? 'AI Safety Confidence' : 'AI Risk Confidence'}</span>
                  <span style={{ color: theme.color }} className="font-extrabold">{confPct}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${confPct}%`, backgroundColor: theme.color }} />
                </div>
              </div>
            )}

            {/* Meta chips row */}
            <div className="flex flex-wrap gap-2">
              {risk_period && risk_period !== 'recently' && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                  <Clock size={12} className="text-slate-400" />
                  <span className="font-semibold">Risk Period:</span>
                  <span className="font-mono text-violet-400">{risk_period}</span>
                </div>
              )}
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-extrabold uppercase tracking-wider ${theme.badgeBg}`}>
                <span>{isSafe && data.content_niche ? data.content_niche.icon : theme.icon}</span>
                <span>{isSafe && data.content_niche ? data.content_niche.title : cat.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-200 font-extrabold uppercase tracking-wider">
                {risk_level}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI detected evidence bullets */}
        <div className="flex flex-col space-y-3 text-left">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Detected Evidence
          </h4>
          <div className="p-5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex-1 flex flex-col justify-start">
            {Array.isArray(evidence_bullets) && evidence_bullets.length > 0 ? (
              <div className="space-y-3 w-full">
                {evidence_bullets.map((bullet, i) => (
                  <div key={i} className={`flex items-start space-x-3 text-xs text-slate-200 p-3 rounded-lg border ${theme.boxBg} transition-colors`}>
                    <CheckCircle size={15} style={{ color: theme.color }} className="mt-0.5 shrink-0" />
                    <span className="leading-relaxed font-medium">{bullet}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500 space-y-2 flex-1 w-full">
                <span className="text-xl">🔍</span>
                <span className="text-xs">No explicit evidence flags triggered. Classification is based on general heuristic evaluation.</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
