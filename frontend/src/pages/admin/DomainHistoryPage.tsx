import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/adminApi';
import type { ScanRecord, ScanRecordList } from '../../types/admin';
import { Search, Download, Globe } from 'lucide-react';

const RISK_COLORS: Record<string, string> = { SAFE: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

function RiskBar({ score }: { score?: number | null }) {
  if (score === undefined || score === null) return <span style={{ color: '#475569' }}>—</span>;
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
      <span style={{ color, fontSize: 12, fontWeight: 600 }}>{score}</span>
    </div>
  );
}

const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

function getDateRange(filter: string): [string, string] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (filter === 'today') { const t = fmt(now); return [t, t]; }
  if (filter === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); const s = fmt(y); return [s, s]; }
  if (filter === 'week') { const s = new Date(now); s.setDate(s.getDate() - 7); return [fmt(s), fmt(now)]; }
  if (filter === 'month') { const s = new Date(now); s.setDate(1); return [fmt(s), fmt(now)]; }
  return ['', ''];
}

export default function DomainHistoryPage() {
  const [data, setData] = useState<ScanRecordList | null>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ScanRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const [dateFrom, dateTo] = datePreset ? getDateRange(datePreset) : ['', ''];
    try {
      const res = await adminApi.getScanRecords({
        page, page_size: 20,
        domain: domain || undefined,
        risk_level: riskLevel || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, domain, riskLevel, datePreset]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const inputStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14, padding: '9px 14px', outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>Domain Scan History</h1>
          <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{data ? `${data.total} total scans recorded` : 'Loading...'}</p>
        </div>
        <button onClick={() => adminApi.exportCSV('scan_records')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {DATE_FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setDatePreset(datePreset === f.value ? '' : f.value); setPage(1); }} style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              background: datePreset === f.value ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.5)',
              border: datePreset === f.value ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
              color: datePreset === f.value ? '#a5b4fc' : '#64748b',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input style={{ ...inputStyle, paddingLeft: 34, width: '100%', boxSizing: 'border-box' }} placeholder="Search domain..." value={domain} onChange={(e) => { setDomain(e.target.value); setPage(1); }} />
          </div>
          <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} style={{ ...inputStyle, minWidth: 140, cursor: 'pointer' }}>
            <option value="">All Risk Levels</option>
            <option value="SAFE">Safe Only</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">Unsafe Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['ID', 'Domain', 'Checked By', 'Date', 'Time', 'Risk Score', 'Risk Level', 'Source', 'Wayback', 'Duration'].map((h) => (
                  <th key={h} style={{ padding: '13px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>Loading...</td></tr>
              ) : !data?.records.length ? (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>No scan records found.</td></tr>
              ) : data.records.map((rec) => {
                const dt = new Date(rec.checked_at);
                const risk = rec.risk_level;
                return (
                  <tr key={rec.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => setSelected(rec)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6,182,212,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', color: '#475569' }}>#{rec.id}</td>
                    <td style={{ padding: '12px 16px', color: '#06b6d4', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Globe size={12} style={{ flexShrink: 0 }} />{rec.domain_name}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{rec.username ?? 'Anonymous'}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{dt.toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>{dt.toLocaleTimeString()}</td>
                    <td style={{ padding: '12px 16px' }}><RiskBar score={rec.risk_score} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      {risk ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: RISK_COLORS[risk] ?? '#64748b', background: `${RISK_COLORS[risk] ?? '#64748b'}20` }}>{risk}</span> : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{rec.source}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{rec.wayback_status ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{rec.duration_ms ? `${rec.duration_ms}ms` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && data.total_pages > 1 && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#475569', fontSize: 13 }}>Page {data.page} of {data.total_pages} ({data.total} total)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {Array.from({ length: Math.min(data.total_pages, 7) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 13, background: p === page ? 'rgba(6,182,212,0.25)' : 'rgba(30,41,59,0.6)', border: p === page ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(255,255,255,0.06)', color: p === page ? '#67e8f9' : '#475569', cursor: 'pointer' }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 150 }} onClick={() => setSelected(null)}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 420, background: 'rgba(10,14,26,0.99)', border: '1px solid rgba(6,182,212,0.2)', padding: 28, overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{selected.domain_name}</h3>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>Scan #{selected.id} detail</p>
            {[
              ['Checked By', selected.username ?? 'Anonymous'],
              ['Date / Time', new Date(selected.checked_at).toLocaleString()],
              ['Risk Score', selected.risk_score ?? '—'],
              ['Risk Level', selected.risk_level ?? '—'],
              ['Source', selected.source],
              ['Wayback Status', selected.wayback_status ?? '—'],
              ['Duration', selected.duration_ms ? `${selected.duration_ms}ms` : '—'],
              ['Status', selected.status],
            ].map(([k, v]) => (
              <div key={k as string} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{k}</div>
                <div style={{ color: '#e2e8f0', fontSize: 14 }}>{v}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => adminApi.exportCSV('scan_records')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.1)', color: '#67e8f9', cursor: 'pointer', fontSize: 13 }}>
                Export CSV
              </button>
              <button onClick={() => setSelected(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
