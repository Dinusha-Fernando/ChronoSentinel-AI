import { ShieldCheck, ShieldAlert, AlertTriangle, HelpCircle, ExternalLink } from 'lucide-react';
import { ThreatIntel } from '../types';

interface ThreatIntelPanelProps {
  threatIntel: ThreatIntel[] | null;
}

const PROVIDER_METADATA: Record<string, { title: string; desc: string; url: string }> = {
  virustotal: {
    title: 'VirusTotal Intelligence Feed',
    desc: 'Vendor engine detection aggregation for malicious signatures.',
    url: 'https://www.virustotal.com',
  },
  google_safe_browsing: {
    title: 'Google Safe Browsing API',
    desc: 'Google Safe Browsing database for phishing, social engineering, and malware.',
    url: 'https://safebrowsing.google.com',
  },
  urlscan: {
    title: 'URLScan.io Web Scan Engine',
    desc: 'Automated web analysis screenshotting and network activity logging.',
    url: 'https://urlscan.io',
  },
  abuseipdb: {
    title: 'AbuseIPDB IP Reputation database',
    desc: 'Public IP verification feed mapping reporting counts and abuse history.',
    url: 'https://www.abuseipdb.com',
  },
};

export default function ThreatIntelPanel({ threatIntel }: ThreatIntelPanelProps) {
  if (!threatIntel || threatIntel.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-slate-500 text-sm">
        No external threat feeds intelligence has been resolved.
      </div>
    );
  }

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'malicious':
        return {
          color: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
          border: 'border-rose-500/20 bg-rose-500/5',
          icon: <ShieldAlert size={20} className="text-rose-400" />,
          label: 'MALICIOUS',
        };
      case 'suspicious':
        return {
          color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
          border: 'border-amber-500/20 bg-amber-500/5',
          icon: <AlertTriangle size={20} className="text-amber-400" />,
          label: 'SUSPICIOUS',
        };
      case 'safe':
        return {
          color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
          border: 'border-emerald-500/20 bg-emerald-500/5',
          icon: <ShieldCheck size={20} className="text-emerald-400" />,
          label: 'CLEAN / SAFE',
        };
      case 'not_configured':
        return {
          color: 'text-slate-400 border-slate-800 bg-slate-900/10',
          border: 'border-slate-800 bg-slate-900/10',
          icon: <HelpCircle size={20} className="text-slate-500" />,
          label: 'NOT CONFIGURED',
        };
      default:
        return {
          color: 'text-slate-400 border-slate-800 bg-slate-900/10',
          border: 'border-slate-800 bg-slate-900/10',
          icon: <HelpCircle size={20} className="text-slate-500" />,
          label: 'NO RECORDS FOUND',
        };
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-lg font-bold">Reputation Threat Feeds</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-medium">
          Simultaneous real-time analysis aggregation from global security databases
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {threatIntel.map((feed, index) => {
          const meta = PROVIDER_METADATA[feed.provider] || {
            title: feed.provider.replace(/_/g, ' ').toUpperCase(),
            desc: 'Custom reputation threat source resolution.',
            url: '#',
          };
          const status = getStatusDetails(feed.status);

          // Attempt to parse screenshot or special details from raw JSON if URLScan
          let parsedRaw: any = null;
          if (feed.raw_response) {
            try {
              parsedRaw = JSON.parse(feed.raw_response);
            } catch {}
          }
          const screenshotUrl = feed.screenshot_url || parsedRaw?.screenshot;

          return (
            <div
              key={index}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 hover:border-slate-700/50 transition-all duration-200 h-full ${status.border}`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex flex-wrap items-start gap-2">
                    {status.icon}
                    <h4 className="text-sm font-extrabold text-white tracking-wide">{meta.title}</h4>
                  </div>
                  <a
                    href={meta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-slate-500 hover:text-white transition-colors"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  {meta.desc}
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">VERDICT</span>
                <span className={`text-xs font-black tracking-wider ${status.color}`}>
                  {status.label}
                </span>
              </div>

              {/* Description Verdict Detail */}
              {feed.verdict && (
                <p className="text-xs text-slate-300 font-semibold bg-slate-900/30 p-3 border border-slate-900/50 rounded-xl">
                  📄 {feed.verdict}
                </p>
              )}

              {/* URLScan Screenshot display */}
              {feed.provider === 'urlscan' && screenshotUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/60 aspect-video relative group">
                  <img
                    src={screenshotUrl}
                    alt="urlscan preview"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a
                      href={screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white flex items-center space-x-1"
                    >
                      <span>Expand Capture</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
