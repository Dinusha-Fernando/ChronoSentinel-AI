import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { BarChart3, Download, FileText, Calendar } from 'lucide-react';

const REPORT_TYPES = [
  { value: 'users',          label: 'Users List',         desc: 'Full export of all user accounts',            color: '#6366f1' },
  { value: 'scan_records',   label: 'Domain Scan History',desc: 'All domain scans with risk levels',           color: '#06b6d4' },
  { value: 'activity_logs',  label: 'Activity Logs',      desc: 'Admin audit trail — all admin actions',       color: '#8b5cf6' },
  { value: 'login_history',  label: 'Login History',      desc: 'All login attempts (success + failed)',       color: '#f59e0b' },
];

const DATE_PRESETS = [
  { label: 'Today',      days: 0 },
  { label: 'Last 7 Days',days: 7 },
  { label: 'Last 30 Days',days: 30 },
  { label: 'All Time',   days: -1 },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState('users');
  const [datePreset, setDatePreset] = useState(-1); // -1 = all time
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const getDateRange = (): [string?, string?] => {
    if (datePreset === -1) return [undefined, undefined];
    if (datePreset === 0) {
      const today = new Date().toISOString().split('T')[0];
      return [today, today];
    }
    const from = new Date();
    from.setDate(from.getDate() - datePreset);
    return [from.toISOString().split('T')[0], new Date().toISOString().split('T')[0]];
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const [from, to] = customFrom || customTo
        ? [customFrom || undefined, customTo || undefined]
        : getDateRange();
      await adminApi.exportCSV(selectedReport, from, to);
    } catch { /* ignore */ }
    setExporting(false);
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14, padding: '9px 14px', outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>Reports & Export</h1>
        <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>Generate and download CSV reports for any module.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, maxWidth: 900 }}>
        {/* Left: Report type selector */}
        <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} color="#6366f1" /> Report Type
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REPORT_TYPES.map((rt) => (
              <button key={rt.value} onClick={() => setSelectedReport(rt.value)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                background: selectedReport === rt.value ? `${rt.color}15` : 'rgba(30,41,59,0.4)',
                border: selectedReport === rt.value ? `1px solid ${rt.color}40` : '1px solid rgba(255,255,255,0.06)',
                textAlign: 'left', transition: 'all 0.15s',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${rt.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: rt.color, flexShrink: 0 }}>
                  <FileText size={16} />
                </div>
                <div>
                  <div style={{ color: selectedReport === rt.value ? '#e2e8f0' : '#94a3b8', fontWeight: 600, fontSize: 14 }}>{rt.label}</div>
                  <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>{rt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Date range + export */}
        <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="#6366f1" /> Date Range
          </h3>

          {/* Quick presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {DATE_PRESETS.map((p) => (
              <button key={p.days} onClick={() => { setDatePreset(p.days); setCustomFrom(''); setCustomTo(''); }} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                background: datePreset === p.days && !customFrom ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.5)',
                border: datePreset === p.days && !customFrom ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                color: datePreset === p.days && !customFrom ? '#a5b4fc' : '#64748b',
              }}>{p.label}</button>
            ))}
          </div>

          <p style={{ color: '#475569', fontSize: 12, marginBottom: 10 }}>— or custom range —</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>From</label>
              <input type="date" style={inputStyle} value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setDatePreset(-99); }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>To</label>
              <input type="date" style={inputStyle} value={customTo} onChange={(e) => { setCustomTo(e.target.value); setDatePreset(-99); }} />
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Export Summary</div>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>
              {REPORT_TYPES.find((r) => r.value === selectedReport)?.label}
            </div>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
              {customFrom || customTo
                ? `${customFrom || '—'} to ${customTo || '—'}`
                : DATE_PRESETS.find((p) => p.days === datePreset)?.label ?? 'All Time'}
            </div>
            <div style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>Format: CSV</div>
          </div>

          <button onClick={handleExport} disabled={exporting} style={{
            width: '100%', padding: '13px', borderRadius: 12,
            background: exporting ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', color: 'white', fontSize: 15, fontWeight: 600,
            cursor: exporting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: exporting ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
          }}>
            <Download size={18} />
            {exporting ? 'Generating...' : 'Download CSV Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
