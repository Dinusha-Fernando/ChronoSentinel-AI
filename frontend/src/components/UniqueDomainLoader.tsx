import { useState, useEffect } from 'react';
import { 
  Search, 
  Layers, 
  ShieldAlert, 
  BrainCircuit, 
  Loader2, 
  CheckCircle2, 
  Terminal, 
  Shield, 
  Globe,
  Cpu
} from 'lucide-react';

interface UniqueDomainLoaderProps {
  targetDomain?: string;
  subTitle?: string;
}

const STAGES = [
  {
    id: 0,
    title: 'Archive Indexing',
    label: 'Querying Wayback Machine CDX Index',
    icon: Search,
    color: 'text-sky-400 border-sky-500/30 bg-sky-500/10'
  },
  {
    id: 1,
    title: 'Snapshot Sampling',
    label: 'Sampling & De-duplicating Timeline Captures',
    icon: Layers,
    color: 'text-violet-400 border-violet-500/30 bg-violet-500/10'
  },
  {
    id: 2,
    title: 'Threat Detection',
    label: 'Running Threat Feeds & Structural Audits',
    icon: ShieldAlert,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10'
  },
  {
    id: 3,
    title: 'AI Intelligence',
    label: 'Synthesizing Risk Model & AI Narrative',
    icon: BrainCircuit,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  }
];

export default function UniqueDomainLoader({ targetDomain = 'Target Domain', subTitle }: UniqueDomainLoaderProps) {
  const [progress, setProgress] = useState(14);
  const [activeStage, setActiveStage] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    `[SYS_INIT] Initializing ChronoSentinel AI risk engine for ${targetDomain}...`,
    `[CDX_QUERY] Connecting to Archive.org CDX API endpoints...`
  ]);

  useEffect(() => {
    // Progress increment timer
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 94) return 94;
        const bump = Math.floor(Math.random() * 6) + 3;
        const next = Math.min(prev + bump, 94);

        if (next > 75) setActiveStage(3);
        else if (next > 50) setActiveStage(2);
        else if (next > 25) setActiveStage(1);

        return next;
      });
    }, 400);

    // Terminal log generator
    const logPool = [
      `[CDX_INDEX] Retrieved snapshot metadata headers for ${targetDomain}`,
      `[FILTER] De-duplicating captures via SHA-1 content digests...`,
      `[SAMPLING] Threat-aware sampling selected 15 high-priority snapshots...`,
      `[HTTP_FETCH] Retrieving raw snapshot HTML payload from proxy cluster...`,
      `[PARSER] Parsing DOM structures & script tags for redirect signatures...`,
      `[DETECTOR] Evaluating 5-tier domain repurposing & gambling heuristics...`,
      `[FEEDS] Querying VirusTotal & Google Safe Browsing API feeds...`,
      `[CLASSIFIER] Feeding zero-shot AI classifier with extracted page text...`,
      `[EXPLAINER] Synthesizing human-readable manager risk narrative...`
    ];

    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < logPool.length) {
        setLogs(prev => [...prev.slice(-4), logPool[logIndex]]);
        logIndex++;
      }
    }, 800);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [targetDomain]);

  return (
    <div className="glass-panel p-6 sm:p-10 rounded-2xl border border-violet-500/20 bg-slate-950/80 shadow-[0_0_50px_rgba(139,92,246,0.1)] space-y-8 animate-fade-in relative overflow-hidden text-left">
      {/* Background ambient lighting shimmers */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>Deep Domain Audit in Progress</span>
              <span className="text-[10px] font-mono uppercase bg-violet-500/10 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
                Active Scan
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {subTitle || `Analyzing historical snapshot telemetry & threat feeds for target`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-xl font-mono text-xs text-violet-300 shadow-inner">
          <Globe size={14} className="text-violet-400 animate-pulse shrink-0" />
          <span className="font-bold text-white truncate max-w-[200px]">{targetDomain}</span>
        </div>
      </div>

      {/* Central Visual Showcase: Cyber Radar Scanner + Status Meter */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-2">
        {/* Left Column: Concentric Cyber Radar Animation */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
            {/* Outer Spinning Dashed Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/30 animate-[spin_12s_linear_infinite]" />
            
            {/* Counter-spinning Glowing Ring */}
            <div className="absolute inset-3 rounded-full border border-brand-500/40 border-t-brand-400 border-r-transparent animate-[spin_8s_linear_infinite_reverse]" />

            {/* Inner Radar Grid Circles */}
            <div className="absolute inset-8 rounded-full border border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-center">
              <div className="w-full h-px bg-slate-800/60 absolute" />
              <div className="h-full w-px bg-slate-800/60 absolute" />
              <div className="absolute inset-6 rounded-full border border-slate-800/60" />
              
              {/* Radar Sweep Rotating Beam */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div 
                  className="w-1/2 h-1/2 bg-gradient-to-br from-violet-500/40 via-violet-500/10 to-transparent origin-bottom-right animate-[spin_3s_linear_infinite]"
                  style={{ borderRadius: '100% 0 0 0' }}
                />
              </div>

              {/* Central Glowing Shield Core */}
              <div className="relative z-10 p-4 bg-slate-900 border border-violet-500/40 rounded-2xl shadow-[0_0_20px_rgba(139,92,246,0.3)] flex flex-col items-center">
                <Shield size={28} className="text-violet-400 animate-pulse" />
                <span className="text-[10px] font-mono font-extrabold text-violet-200 mt-1 uppercase tracking-widest">
                  AUDITING
                </span>
              </div>
            </div>

            {/* Orbiting Target Nodes */}
            <div className="absolute top-2 right-8 w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8] animate-ping" />
            <div className="absolute bottom-6 left-6 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-pulse" />
          </div>
        </div>

        {/* Right Column: 4-Stage Security Audit Pipeline */}
        <div className="md:col-span-7 space-y-4">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={14} className="text-violet-400" />
              <span>Inspection Progress</span>
            </span>
            <span className="text-violet-300 font-extrabold text-sm">{progress}%</span>
          </div>

          {/* Progress Bar with Glowing Shimmer */}
          <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-400 transition-all duration-500 relative shadow-[0_0_12px_rgba(139,92,246,0.5)]"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          {/* 4 Pipeline Stages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {STAGES.map((stage) => {
              const isDone = activeStage > stage.id;
              const isCurrent = activeStage === stage.id;
              const IconComp = stage.icon;

              return (
                <div 
                  key={stage.id} 
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isCurrent 
                      ? 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.15)] scale-[1.02]' 
                      : isDone 
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-slate-300'
                      : 'border-slate-800/60 bg-slate-900/30 opacity-40'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg border ${stage.color} shrink-0`}>
                      <IconComp size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{stage.title}</span>
                      <span className="text-[10px] text-slate-400 font-medium truncate block">{stage.label}</span>
                    </div>
                  </div>

                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="animate-spin text-violet-400 shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Live Cyber Matrix Terminal Log Stream */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-2 font-mono text-[11px]">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-850 pb-2">
          <span className="flex items-center gap-1.5 font-bold text-slate-400">
            <Terminal size={12} className="text-violet-400" />
            <span>Live Audit Console Stream</span>
          </span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            STREAMING
          </span>
        </div>

        <div className="space-y-1 text-slate-300 max-h-24 overflow-hidden pt-1">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-center gap-2 truncate">
              <span className="text-violet-500 font-extrabold shrink-0">&gt;</span>
              <span className="truncate">{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
