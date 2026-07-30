import { useState, useRef, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ExternalLink, Calendar, Shield, AlertTriangle, CheckCircle, Layers, Hash, Eye, Flag } from 'lucide-react';
import { Snapshot } from '../types';

interface SnapshotTimelineProps {
  snapshots: Snapshot[];
  activeSnapshot?: Snapshot | null;
  onSelectSnapshot?: (s: Snapshot) => void;
}

interface ChartDataPoint {
  name: string;
  timestamp: string;
  score: number;
  url: string;
  status: number | null;
  flagsCount: number;
  fullDate: string;
}

/* Colour helpers */
const getRiskPalette = (score: number, category?: string | null) => {
  const cat = (category || '').toLowerCase();
  if (cat === 'unavailable' || cat === 'unarchived' || cat === 'unknown') {
    return {
      accent: '#94a3b8',
      dim: 'rgba(148,163,184,0.12)',
      border: 'rgba(148,163,184,0.28)',
      text: '#cbd5e1',
      glow: '0 0 14px rgba(148,163,184,0.15)',
    };
  }
  const isSafe = !category || category === 'safe';
  if (isSafe && score < 70) {
    return { accent: '#10b981', dim: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#10b981', glow: '0 0 16px rgba(16,185,129,0.2)' };
  }
  // For unsafe categories (gambling, adult, gaming, etc.) or high scores, show red (high risk color)
  return { accent: '#f43f5e', dim: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.25)', text: '#f43f5e', glow: '0 0 16px rgba(244,63,94,0.2)' };
};

const CATEGORY_ICONS: Record<string, string> = {
  gambling: 'GAMBLING', adult: 'ADULT', phishing_scam: 'PHISHING',
  malware_hacking: 'MALWARE', illegal_pharmaceuticals: 'PHARMA', safe: 'SAFE',
  gaming: 'GAMING', unavailable: 'UNARCHIVED', unarchived: 'UNARCHIVED',
};

const formatDate = (timestamp: string) =>
  new Date(`${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)}`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

const formatLocationLabel = (rawElement: string | null | undefined): string => {
  if (!rawElement) return 'Page Contents';
  const clean = rawElement.toLowerCase().trim();
  if (clean.includes('meta')) {
    const m = clean.match(/name="([^"]+)"/) || clean.match(/property="([^"]+)"/);
    if (m?.[1]) return `HTML Meta Tag (${m[1]})`;
    return 'HTML Meta Tag (Head Metadata)';
  }
  if (clean === '<title>') return 'HTML Document Title (<title>)';
  if (clean === '<a>') return 'HTML Anchor / Link (<a>)';
  if (clean.match(/^<h[1-6]>$/)) return `HTML Heading (${clean.toUpperCase()})`;
  if (clean === '<p>') return 'HTML Body Paragraph (<p>)';
  if (clean === '<div>') return 'HTML Content Div (<div>)';
  if (clean === '<span>') return 'HTML Inline Text (<span>)';
  if (clean === '<li>') return 'HTML List Item (<li>)';
  return `HTML Element (${rawElement})`;
};

const highlightKeyword = (text: string | null | undefined, keyword: string) => {
  if (!text) return null;
  if (!keyword) return <span>{text}</span>;
  const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ background: 'rgba(245,158,11,0.3)', color: '#fcd34d', padding: '0 3px', borderRadius: 3, fontWeight: 700, fontFamily: 'monospace', border: '1px solid rgba(245,158,11,0.25)' }}>
            {part}
          </mark>
        ) : part
      )}
    </span>
  );
};

/* Right panel: full snapshot detail */
function SnapshotDetailPanel({ s }: { s: Snapshot }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const pal = getRiskPalette(s.risk_score, s.content_category);
  const apiBase = (import.meta.env.VITE_API_URL as string) || '/api/v1';
  const proxyUrl = `${apiBase}/domains/proxy-snapshot?timestamp=${s.timestamp}&url=${encodeURIComponent(s.original_url)}${s.redirect_url ? `&redirect_url=${encodeURIComponent(s.redirect_url)}` : ''}`;
  const directUrl = `https://web.archive.org/web/${s.timestamp}/${s.original_url}`;
  
  const isUnavailable = s.content_category === 'unavailable' || s.content_category === 'unarchived';
  const catLabel = isUnavailable
    ? 'UNARCHIVED PAYLOAD'
    : (s.content_category || 'safe').replace(/_/g, ' ').toUpperCase();
  const catIcon = isUnavailable ? '📦' : (CATEGORY_ICONS[s.content_category || 'safe'] || 'SAFE');

  // Instant preview loading timer: preview resolves within 400ms for instant pre-cached rendering
  useEffect(() => {
    setIframeLoaded(false);
    const timer = setTimeout(() => setIframeLoaded(true), 400);
    return () => clearTimeout(timer);
  }, [proxyUrl]);

  const getLanguageLabel = (lang: string | null) => {
    if (!lang) return 'EN';
    const l = lang.toLowerCase();
    if (l === 'id') return 'ID'; if (l === 'nl') return 'NL';
    if (l === 'de') return 'DE'; if (l === 'fr') return 'FR';
    if (l === 'es') return 'ES';
    return l.toUpperCase();
  };

  return (
    <div style={{
      background: 'rgba(10,14,26,0.85)',
      border: `1px solid ${pal.border}`,
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: pal.glow,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Panel Header */}
      <div style={{
        padding: '18px 22px 14px',
        background: `linear-gradient(135deg, ${pal.dim} 0%, rgba(10,14,26,0) 60%)`,
        borderBottom: `1px solid ${pal.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Risk score badge */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: pal.dim, border: `2px solid ${pal.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: pal.accent, fontWeight: 800, fontSize: 20, lineHeight: 1 }}>{s.risk_score}</span>
            <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>score</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Calendar size={12} color="#64748b" />
              <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{formatDate(s.timestamp)}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: pal.dim, border: `1px solid ${pal.border}`, color: pal.text,
              }}>{catIcon} {catLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
              <span>HTTP <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{s.status_code ?? 200}</span></span>
              <span>/</span>
              <span>Lang <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{getLanguageLabel(s.detected_language)}</span></span>
              <span>/</span>
              <span><span style={{ color: '#f87171', fontWeight: 700 }}>{s.flags.length}</span> flags</span>
            </div>
          </div>
        </div>
        {/* Quick links */}
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={proxyUrl} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 8, background: pal.dim, border: `1px solid ${pal.border}`,
            color: pal.text, fontSize: 11, fontWeight: 700, textDecoration: 'none',
          }}>
            <Eye size={12} /> Proxy View
          </a>
          <a href={directUrl} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8', fontSize: 11, fontWeight: 700, textDecoration: 'none',
          }}>
            <ExternalLink size={12} /> Wayback
          </a>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Redirect Alert Banner */}
        {(s.is_redirect || s.redirect_detected) && (
          <div style={{
            padding: '14px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(244,63,94,0.14) 0%, rgba(139,92,246,0.12) 100%)',
            border: '1px solid rgba(244,63,94,0.35)',
            color: '#f87171', fontSize: 13, fontWeight: 700,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#f43f5e', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', color: '#fda4af', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Snapshot Redirect Engine
                  </span>
                  <span>Target: <code style={{ color: '#ffffff', fontFamily: 'monospace', background: 'rgba(0,0,0,0.4)', padding: '2px 7px', borderRadius: 5 }}>{s.redirect_target || s.redirect_url || 'External Target Domain'}</code></span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.redirect_confidence !== undefined && (
                  <span style={{ background: '#f43f5e', color: '#ffffff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6 }}>
                    {s.redirect_confidence}% Confidence
                  </span>
                )}
                {s.redirect_verified && (
                  <span style={{ background: '#10b981', color: '#ffffff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6 }}>
                    ✓ Verified Target
                  </span>
                )}
              </div>
            </div>

            {/* Evidence items & Dual risk */}
            {s.redirect_evidence && s.redirect_evidence.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {s.redirect_evidence.map((ev, idx) => (
                  <span key={idx} style={{ fontSize: 10, background: 'rgba(0,0,0,0.4)', color: '#cbd5e1', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                    {ev}
                  </span>
                ))}
              </div>
            )}

            {s.original_category && s.redirect_target_category && (
              <div style={{ fontSize: 11, color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: 6, marginTop: 2 }}>
                <span style={{ color: '#94a3b8' }}>Dual Risk Matrix:</span> Original Snapshot (<strong>{s.original_category.toUpperCase()}</strong>) ➔ Redirect Target (<strong>{s.redirect_target_category.toUpperCase()}</strong>)
              </div>
            )}
          </div>
        )}

        {/* Preview iframe or Creative Unretrieved Payload Card */}
        {isUnavailable ? (
          <div style={{
            borderRadius: 14, border: '1px solid rgba(148,163,184,0.25)',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.6) 100%)',
            padding: '28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: 12, position: 'relative', overflow: 'hidden',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.3)',
              color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layers size={24} />
            </div>
            <div>
              <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
                Historical Payload Unretrieved
              </h4>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0, maxWidth: 440, lineHeight: 1.5 }}>
                This capture timestamp exists in CDX archive records, but its HTML body payload was unavailable during scan. No risk flags were triggered (Score: 0).
              </p>
            </div>
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 15px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.3)',
                color: '#e2e8f0', textDecoration: 'none', marginTop: 4, transition: 'all 0.15s',
              }}
            >
              <ExternalLink size={12} /> Inspect Direct Archive Record
            </a>
          </div>
        ) : (
          <div style={{
            borderRadius: 12, border: `1px solid ${pal.border}`,
            background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid rgba(255,255,255,0.04)`, background: 'rgba(255,255,255,0.02)',
              flexWrap: 'wrap', gap: 6,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: pal.text }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: pal.accent, display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                Visual Evidence Preview
              </span>
              {s.redirect_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(244,63,94,0.2)' }}>
                  <ExternalLink size={10} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 9 }}>Redirect Target:</span>
                  <a href={s.redirect_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.redirect_url}
                  </a>
                </div>
              )}
            </div>
            <div style={{ height: 200, background: '#0a0e1a', position: 'relative', overflow: 'hidden' }}>
              {!iframeLoaded && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                }}>
                  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.6 }}>
                    {[0.08, 0.22, 0.36, 0.5, 0.64, 0.78].map((top, i) => (
                      <div key={i} style={{
                        position: 'absolute', left: '5%',
                        top: `${top * 100}%`, height: 10, borderRadius: 6,
                        width: `${[75, 55, 85, 45, 65, 40][i]}%`,
                        background: 'rgba(148,163,184,0.08)',
                        overflow: 'hidden',
                      }}>
                        <div className="shimmer-bar" />
                      </div>
                    ))}
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div className="preview-spinner" style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: `3px solid ${pal.dim}`,
                      borderTopColor: pal.accent,
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', letterSpacing: '0.05em' }}>Loading Preview…</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: pal.text, opacity: 0.7,
                    }}>Fetching Wayback Snapshot</span>
                  </div>
                </div>
              )}
              <iframe
                src={proxyUrl}
                title={`Preview: ${s.original_url}`}
                sandbox="allow-scripts"
                style={{ width: '100%', height: '100%', border: 'none', opacity: iframeLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={() => setIframeLoaded(true)}
              />
            </div>
          </div>
        )}

        {/* Content summary */}
        {s.content_summary && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.1)',
            fontSize: 12, color: '#94a3b8', lineHeight: 1.6,
          }}>
            <span style={{ color: '#64748b', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Content Summary</span>
            {s.content_summary}
          </div>
        )}

        {/* Flags section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
              <Flag size={11} /> Snapshot Scan Log
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: s.flags.length > 0 ? 'rgba(244,63,94,0.12)' : 'rgba(16,185,129,0.12)',
              color: s.flags.length > 0 ? '#f87171' : '#34d399',
              border: `1px solid ${s.flags.length > 0 ? 'rgba(244,63,94,0.25)' : 'rgba(16,185,129,0.25)'}`,
            }}>
              {s.flags.length} Flagged Terms
            </span>
          </div>

          {s.flags.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.flags.map((f, idx) => (
                <div key={idx} style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <code style={{
                        fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#f1f5f9',
                        background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 5,
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>"{f.keyword}"</code>
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        background: 'rgba(0,0,0,0.3)', color: '#94a3b8',
                        padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
                      }}>{f.category.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{f.match_count} match{f.match_count > 1 ? 'es' : ''}</span>
                      <span style={{
                        padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                        background: 'rgba(244,63,94,0.12)', color: '#f87171', border: '1px solid rgba(244,63,94,0.25)',
                      }}>+{f.weight} pts</span>
                    </div>
                  </div>
                  {(f.element || f.snippet) && (
                    <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {f.element && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                          <span style={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Location:</span>
                          <span style={{
                            color: '#a78bfa', fontWeight: 600, fontFamily: 'monospace',
                            background: 'rgba(0,0,0,0.3)', padding: '1px 7px', borderRadius: 4,
                            border: '1px solid rgba(139,92,246,0.2)', fontSize: 10,
                          }}>{formatLocationLabel(f.element)}</span>
                        </div>
                      )}
                      {f.snippet && (
                        <div style={{
                          padding: '8px 10px', background: 'rgba(0,0,0,0.35)', borderRadius: 7,
                          border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace',
                          fontSize: 10, color: '#94a3b8', lineHeight: 1.6, overflowX: 'auto',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>
                          <span style={{ color: '#475569', marginRight: 6, userSelect: 'none' }}>Snippet:</span>
                          {highlightKeyword(f.snippet, f.keyword)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '28px 20px', borderRadius: 12,
              border: '1px dashed rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.04)',
              gap: 8,
            }}>
              <CheckCircle size={22} color="#10b981" />
              <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>No risk flags triggered</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Content matches clean baseline signatures.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Left panel: compact tab for one snapshot */
interface SnapshotTabProps {
  s: Snapshot;
  index: number;
  isSelected: boolean;
  onSelect: (s: Snapshot) => void;
}

function SnapshotTab({ s, index, isSelected, onSelect }: SnapshotTabProps) {
  const isUnavailable = s.content_category === 'unavailable' || s.content_category === 'unarchived';
  const isUnsafe = !isUnavailable && ((s.content_category && s.content_category !== 'safe') || s.risk_score >= 70);
  const pal = getRiskPalette(s.risk_score, s.content_category);
  const catLabel = isUnavailable ? 'UNARCHIVED' : (s.content_category || 'safe').replace(/_/g, ' ');
  const dateStr = formatDate(s.timestamp);
  const rawDate = `${s.timestamp.slice(0, 4)}/${s.timestamp.slice(4, 6)}/${s.timestamp.slice(6, 8)}`;

  const getCatStyle = (cat: string | null) => {
    switch ((cat || 'safe').toLowerCase()) {
      case 'unavailable':
      case 'unarchived':
        return { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', color: '#94a3b8' };
      case 'adult':
        return { bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.35)', color: '#f87171' };
      case 'gambling':
        return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', color: '#fbbf24' };
      case 'gaming':
        return { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', color: '#60a5fa' };
      case 'phishing_scam':
      case 'malware_hacking':
      case 'illegal_pharmaceuticals':
        return { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.35)', color: '#c084fc' };
      default:
        return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', color: '#34d399' };
    }
  };

  const catStyle = getCatStyle(s.content_category);
  const cardBg = isSelected
    ? `linear-gradient(145deg, rgba(17,24,39,0.98) 0%, rgba(10,14,26,0.95) 100%)`
    : `linear-gradient(145deg, rgba(15,23,42,0.75) 0%, rgba(10,14,26,0.6) 100%)`;

  return (
    <button
      type="button"
      onClick={() => onSelect(s)}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '15px 16px',
        borderRadius: 14,
        background: cardBg,
        border: isSelected ? `1.5px solid ${pal.accent}` : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isSelected ? `0 8px 30px ${pal.dim}, inset 0 0 15px ${pal.dim}` : 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        outline: 'none',
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: 4,
          background: pal.accent,
          borderRadius: '0 4px 4px 0',
          boxShadow: `0 0 10px ${pal.accent}`,
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 800,
          color: 'rgba(148,163,184,0.9)',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '3px 9px',
          borderRadius: 7,
          letterSpacing: '0.04em',
        }}>
          #{String(index + 1).padStart(2, '0')}
        </span>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: pal.dim,
          color: pal.accent,
          border: `1px solid ${pal.border}`,
          boxShadow: isSelected ? `0 0 10px ${pal.accent}50` : 'none',
          flexShrink: 0,
        }}>
          {isUnavailable ? <Layers size={12} /> : isUnsafe ? <AlertTriangle size={12} /> : <Shield size={12} />}
          {isUnavailable ? 'UNARCHIVED' : isUnsafe ? 'UNSAFE' : 'SAFE'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'end',
        gap: 14,
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Calendar size={15} color={pal.accent} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#f8fafc',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {dateStr}
            </span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#64748b',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}>
              {rawDate}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 9px',
              borderRadius: 7,
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: catStyle.bg,
              color: catStyle.color,
              border: `1px solid ${catStyle.border}`,
              flexShrink: 0,
            }}>
              {catLabel}
            </span>

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 7,
              fontSize: 10,
              fontWeight: 700,
              color: s.flags.length > 0 ? '#fca5a5' : '#6ee7b7',
              background: s.flags.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              border: s.flags.length > 0 ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.22)',
            }}>
              {s.flags.length > 0 ? `${s.flags.length} Flag${s.flags.length > 1 ? 's' : ''}` : 'Clean'}
            </span>

            {(s.is_redirect || s.redirect_detected) && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                borderRadius: 7,
                fontSize: 10,
                fontWeight: 800,
                color: '#f87171',
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <AlertTriangle size={11} />
                Redirect {s.redirect_confidence ? `(${s.redirect_confidence}%)` : ''}: {s.redirect_target || s.redirect_url || 'External'}
              </span>
            )}

            <span style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: s.status_code === 200 || !s.status_code ? '#34d399' : s.status_code >= 400 ? '#f87171' : '#fbbf24',
              fontSize: 11,
            }}>
              HTTP {s.status_code ?? 200}
            </span>
          </div>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontSize: 24, lineHeight: 1, fontWeight: 900, fontFamily: 'monospace', color: pal.accent }}>
            {s.risk_score}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>
            risk
          </span>
        </div>
      </div>

      <div style={{ height: 5, width: '100%', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', borderRadius: 999 }}>
        <div style={{
          height: '100%',
          width: `${s.risk_score}%`,
          background: `linear-gradient(90deg, ${pal.accent}55, ${pal.accent})`,
          transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 8px ${pal.accent}90`,
        }} />
      </div>
    </button>
  );
}


/* Main component */
export default function SnapshotTimeline({ snapshots, activeSnapshot, onSelectSnapshot }: SnapshotTimelineProps) {
  const [localSelected, setLocalSelected] = useState<Snapshot | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const prevTimestamp = useRef<string | null>(null);

  if (!snapshots || snapshots.length === 0) return null;

  // Use externally-controlled selection if provided, else local
  const selected = activeSnapshot ?? localSelected ?? snapshots[0];

  const handleSelect = (s: Snapshot) => {
    setLocalSelected(s);
    onSelectSnapshot?.(s);
    // Bump animKey only when a different snapshot is chosen to re-trigger animation
    if (prevTimestamp.current !== s.timestamp) {
      prevTimestamp.current = s.timestamp;
      setAnimKey(k => k + 1);
    }
  };

  const chartData: ChartDataPoint[] = snapshots.map((s) => ({
    name: `${s.timestamp.slice(0, 4)}-${s.timestamp.slice(4, 6)}-${s.timestamp.slice(6, 8)}`,
    timestamp: s.timestamp,
    score: s.risk_score,
    url: s.original_url,
    status: s.status_code,
    flagsCount: s.flags.length,
    fullDate: formatDate(s.timestamp),
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      const rp = getRiskPalette(d.score, undefined);
      return (
        <div style={{
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 14px', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)', fontSize: 12, minWidth: 160,
        }}>
          <p style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 8 }}>{d.fullDate}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>Risk Score</span>
            <span style={{ color: rp.accent, fontWeight: 800 }}>{d.score}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>HTTP Status</span>
            <span style={{ color: '#a5b4fc', fontFamily: 'monospace', fontWeight: 700 }}>{d.status ?? 200}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#64748b' }}>Risk Flags</span>
            <span style={{ color: d.flagsCount > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>{d.flagsCount} triggered</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: 'rgba(139,92,246,0.15)',
            border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Layers size={15} color="#a78bfa" />
          </div>
          <h3 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 17, margin: 0 }}>Historical Snapshot Timeline</h3>
        </div>
        <p style={{ color: '#475569', fontSize: 13, margin: 0, paddingLeft: 42 }}>
          Risk trend across <span style={{ color: '#94a3b8', fontWeight: 600 }}>{snapshots.length}</span> Wayback captures -
          from <span style={{ color: '#94a3b8' }}>{chartData[0].name}</span> to <span style={{ color: '#94a3b8' }}>{chartData[chartData.length - 1].name}</span>.
          Select a snapshot to inspect its evidence.
        </p>
      </div>

      {/* Chart */}
      <div style={{ height: 220, width: '100%' }}>
        <ResponsiveContainer width="100%" height={220} minWidth={1}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
            <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreGradient)" dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#a78bfa', stroke: '#1e1b4b', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Split Panel: Tabs | Detail */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Hash size={13} color="#475569" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>
            Analyzed Snapshot Details
          </span>
          <span style={{
            marginLeft: 4, padding: '1px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
            background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)',
          }}>{snapshots.length} captures</span>
        </div>

        <div className="snapshot-details-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 430px) minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}>
          {/* LEFT: Snapshot selector tabs */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxHeight: 820,
            overflowY: 'auto',
            paddingRight: 10,
          }}>
            {/* Legend strip */}
            <div style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)',
              fontSize: 10, color: '#6366f1', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
            }}>
              <Shield size={11} />
              Click a snapshot to inspect its evidence
            </div>
            {snapshots.map((s, i) => (
              <SnapshotTab
                key={s.timestamp}
                s={s}
                index={i}
                isSelected={selected?.timestamp === s.timestamp}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {/* RIGHT: Detail panel */}
          <div className="snapshot-detail-pane" style={{ minHeight: 680, position: 'sticky', top: 20 }}>
            {selected ? (
              <div key={animKey} className="snapshot-detail-animate">
                <SnapshotDetailPanel s={selected} />
              </div>
            ) : (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 18,
                color: '#334155', fontSize: 13,
              }}>
                <AlertTriangle size={28} color="#334155" />
                <span>Select a snapshot from the left panel</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .snapshot-details-grid { width: 100%; }
        @media (max-width: 1100px) {
          .snapshot-details-grid { grid-template-columns: 1fr !important; }
          .snapshot-detail-pane { position: static !important; min-height: 520px !important; }
        }
        @media (max-width: 640px) {
          .glass-panel { padding: 20px 16px !important; }
          .snapshot-detail-pane { min-height: 440px !important; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes snapshot-card-in {
          0%   { opacity: 0; transform: translateY(22px) scale(0.97); filter: blur(4px); }
          60%  { opacity: 1; filter: blur(0); }
          80%  { transform: translateY(-4px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .snapshot-detail-animate {
          animation: snapshot-card-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transform-origin: top center;
          will-change: transform, opacity;
        }
        @keyframes shimmer-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .shimmer-bar {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(148,163,184,0.18) 50%, transparent 100%);
          animation: shimmer-slide 1.6s ease-in-out infinite;
        }
        @keyframes preview-spin {
          to { transform: rotate(360deg); }
        }
        .preview-spinner {
          animation: preview-spin 0.85s linear infinite;
        }
      `}</style>
    </div>
  );
}

