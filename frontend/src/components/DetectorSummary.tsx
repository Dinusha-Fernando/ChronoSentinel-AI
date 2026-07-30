import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { DetectorResult } from '../types';

interface DetectorSummaryProps {
  detectors: DetectorResult[] | null;
  detectorBoost: number | null;
}

const DETECTOR_METADATA: Record<string, { title: string; desc: string }> = {
  external_link_density: {
    title: 'Outbound Link Density',
    desc: 'Percentage of links pointing to external domains (spam indicator).',
  },
  hidden_elements: {
    title: 'Hidden Elements (CSS)',
    desc: 'Elements hidden via display:none or opacity:0 (cloaking indicator).',
  },
  forms: {
    title: 'Login & Form Check',
    desc: 'Presence of collection forms or input fields.',
  },
  phone_numbers: {
    title: 'Contact Pattern Check',
    desc: 'Presence of telephone numbers or contact strings.',
  },
  crypto_wallets: {
    title: 'Crypto Address Scan',
    desc: 'Bitcoin/Ethereum wallet patterns.',
  },
  url_obfuscation: {
    title: 'URL Obfuscation Check',
    desc: 'Suspicious URI structures or percent-encoding.',
  },
  content_length: {
    title: 'Content Size Scan',
    desc: 'Anomalous document length (very short or extremely long).',
  },
  iframe_redirects: {
    title: 'Frame & Redirect Scan',
    desc: 'JS navigation scripts or nested frame scripts.',
  },
};

export default function DetectorSummary({ detectors, detectorBoost }: DetectorSummaryProps) {
  if (!Array.isArray(detectors) || detectors.length === 0) {
    return (
      <div className="glass-panel p-6 text-center text-slate-500 text-xs">
        No structural detectors telemetry found for this snapshot.
      </div>
    );
  }

  const getSignalDetails = (signal: 'low' | 'medium' | 'high') => {
    switch (signal) {
      case 'high':
        return {
          color: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
          icon: <ShieldAlert size={14} className="text-rose-400 shrink-0" />,
          label: 'High Signal',
        };
      case 'medium':
        return {
          color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
          icon: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
          label: 'Medium Signal',
        };
      default:
        return {
          color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
          icon: <ShieldCheck size={14} className="text-emerald-400 shrink-0" />,
          label: 'Low Signal',
        };
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Structural Telemetry Scan</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Static indicators running across structural markers of the document
          </p>
        </div>
        {detectorBoost && detectorBoost > 0 ? (
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
            Risk boosted: +{detectorBoost} points
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {detectors.map((det, index) => {
          const meta = DETECTOR_METADATA[det.detector] || {
            title: det.detector.replace(/_/g, ' ').toUpperCase(),
            desc: 'Custom developer-registered structural signature check.',
          };
          const signal = getSignalDetails(det.signal);

          // Get extra details if any (e.g. counts)
          const extraKeys = Object.keys(det).filter(k => k !== 'detector' && k !== 'signal');
          const extraInfo = extraKeys.map(k => {
            const v = det[k];
            return `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.length : v}`;
          }).join(' • ');

          return (
            <div
              key={index}
              className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between space-y-2 hover:border-slate-700/50 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">{meta.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{meta.desc}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border flex items-center gap-1 shrink-0 ${signal.color}`}>
                  {signal.icon}
                  {signal.label}
                </span>
              </div>
              
              {extraInfo && (
                <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                  {extraInfo}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
