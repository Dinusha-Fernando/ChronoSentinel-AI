import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/adminApi';
import type { LoginHistoryList } from '../../types/admin';
import { Download, CheckCircle, XCircle } from 'lucide-react';

const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
];

function getDateRange(filter: string): [string, string] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (filter === 'today') { const t = fmt(now); return [t, t]; }
  if (filter === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); const s = fmt(y); return [s, s]; }
  if (filter === 'week') { const s = new Date(now); s.setDate(s.getDate() - 7); return [fmt(s), fmt(now)]; }
  return ['', ''];
}

export default function LoginHistoryPage() {
  const [data, setData] = useState<LoginHistoryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [page, setPage] = useState(1);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const [dateFrom, dateTo] = datePreset ? getDateRange(datePreset) : ['', ''];
    try {
      const res = await adminApi.getLoginHistory({
        page, page_size: 20,
        success: successFilter === 'all' ? undefined : successFilter === 'success',
        role: roleFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, successFilter, roleFilter, datePreset]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const inputStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14, padding: '9px 14px', outline: 'none',
  };

  const tabBtn = (val: typeof successFilter, label: string) => (
    <button onClick={() => { setSuccessFilter(val); setPage(1); }} style={{
      padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
      background: successFilter === val ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.5)',
      border: successFilter === val ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
      color: successFilter === val ? '#a5b4fc' : '#64748b',
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>Login History</h1>
          <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>{data?.total ?? 0} total login events recorded</p>
        </div>
        <button onClick={() => adminApi.exportCSV('login_history')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {tabBtn('all', 'All Logins')}
          {tabBtn('success', '✓ Successful')}
          {tabBtn('failed', '✕ Failed')}
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />
          {DATE_FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setDatePreset(datePreset === f.value ? '' : f.value); setPage(1); }} style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              background: datePreset === f.value ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)',
              border: datePreset === f.value ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)',
              color: datePreset === f.value ? '#6ee7b7' : '#64748b',
            }}>{f.label}</button>
          ))}
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, minWidth: 160, cursor: 'pointer' }}>
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Result', 'Username', 'Role', 'IP', 'Browser', 'Country', 'Login Time', 'Logout Time', 'Failure Reason'].map((h) => (
                  <th key={h} style={{ padding: '13px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>Loading...</td></tr>
              ) : !data?.records.length ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>No login records found.</td></tr>
              ) : data.records.map((rec) => (
                <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(${rec.success ? '16,185,129' : '239,68,68'},0.04)`)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    {rec.success
                      ? <CheckCircle size={16} color="#10b981" />
                      : <XCircle size={16} color="#ef4444" />
                    }
                  </td>
                  <td style={{ padding: '12px 16px', color: '#e2e8f0', fontWeight: 500 }}>{rec.username_attempted}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>{rec.user_role_snapshot ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{rec.ip_address ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{rec.browser ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{rec.country ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(rec.login_at).toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap', fontSize: 12 }}>{rec.logout_at ? new Date(rec.logout_at).toLocaleString() : '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#ef4444', fontSize: 12 }}>{rec.failure_reason ?? '—'}</td>
                </tr>
              ))}
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
    </div>
  );
}
