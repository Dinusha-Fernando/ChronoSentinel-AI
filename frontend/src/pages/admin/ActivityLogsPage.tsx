import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/adminApi';
import type {
  ActivityLog, ActivityLogList, ActiveUserSession, ActivityMetrics,
  SpecificUserActivitySummary, AdminUser,
} from '../../types/admin';
import {
  Download, Search, Shield, Activity,
  CheckCircle2, XCircle, Eye, RefreshCw,
  BarChart2, Layers, Globe, X, User as UserIcon,
  ShieldCheck, ShieldAlert, AlertOctagon
} from 'lucide-react';

export default function ActivityLogsPage() {
  // Active Tab
  const [activeTab, setActiveTab] = useState<'all' | 'user_explorer' | 'live_sessions' | 'metrics'>('all');

  // Tab 1: All Logs state
  const [logsData, setLogsData] = useState<ActivityLogList | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Tab 2: User Explorer state
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userSummary, setUserSummary] = useState<SpecificUserActivitySummary | null>(null);
  const [loadingUserSummary, setLoadingUserSummary] = useState(false);

  // Tab 3: Live Active Sessions state
  const [activeSessions, setActiveSessions] = useState<ActiveUserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Tab 4: Metrics state
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);

  // Fetch All Logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await adminApi.getActivityLogs({
        page,
        page_size: 20,
        category: categoryFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setLogsData(res);
    } catch { /* ignore */ }
    setLoadingLogs(false);
  }, [page, categoryFilter, severityFilter, statusFilter, search]);

  // Fetch User List
  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers({ page: 1, page_size: 100 });
      setUsersList(res.users);
      if (res.users.length > 0 && !selectedUserId) {
        setSelectedUserId(res.users[0].id);
      }
    } catch { /* ignore */ }
  }, [selectedUserId]);

  // Fetch Specific User Summary
  const fetchUserSummary = useCallback(async (userId: number) => {
    setLoadingUserSummary(true);
    try {
      const res = await adminApi.getUserActivitySummary(userId);
      setUserSummary(res);
    } catch { /* ignore */ }
    setLoadingUserSummary(false);
  }, []);

  // Fetch Active Sessions
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await adminApi.getActiveSessions();
      setActiveSessions(Array.isArray(res) ? res : []);
    } catch {
      setActiveSessions([]);
    }
    setLoadingSessions(false);
  }, []);

  // Fetch Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await adminApi.getActivityMetrics();
      setMetrics(res && typeof res === 'object' ? res : null);
    } catch {
      setMetrics(null);
    }
  }, []);

  // Effect for Tab 1
  useEffect(() => {
    if (activeTab === 'all') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  // Effect for Auto-refresh on Tab 1
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (activeTab === 'all' && autoRefresh) {
      timer = setInterval(() => {
        fetchLogs();
      }, 5000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeTab, autoRefresh, fetchLogs]);

  // Effect for Tab 2
  useEffect(() => {
    if (activeTab === 'user_explorer') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  useEffect(() => {
    if (activeTab === 'user_explorer' && selectedUserId) {
      fetchUserSummary(selectedUserId);
    }
  }, [activeTab, selectedUserId, fetchUserSummary]);

  // Effect for Tab 3
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (activeTab === 'live_sessions') {
      fetchSessions();
      timer = setInterval(() => {
        fetchSessions();
      }, 8000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeTab, fetchSessions]);

  // Effect for Tab 4
  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetrics();
    }
  }, [activeTab, fetchMetrics]);

  // Styling Helpers
  const inputStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 13,
    padding: '9px 14px',
    outline: 'none',
  };

  const getSeverityBadge = (severity?: string) => {
    const sev = (severity || 'INFO').toUpperCase();
    let bg = 'rgba(59,130,246,0.15)';
    let color = '#60a5fa';
    let border = 'rgba(59,130,246,0.3)';

    if (sev === 'CRITICAL') {
      bg = 'rgba(239,68,68,0.18)';
      color = '#f87171';
      border = 'rgba(239,68,68,0.4)';
    } else if (sev === 'WARNING') {
      bg = 'rgba(245,158,11,0.18)';
      color = '#fbbf24';
      border = 'rgba(245,158,11,0.4)';
    } else if (sev === 'ERROR') {
      bg = 'rgba(239,68,68,0.15)';
      color = '#f87171';
      border = 'rgba(239,68,68,0.3)';
    }

    return (
      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color, border: `1px solid ${border}`, textTransform: 'uppercase' }}>
        {sev}
      </span>
    );
  };

  const getCategoryBadge = (category?: string) => {
    const cat = category || 'GENERAL';
    return (
      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
        {cat.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div style={{ color: '#e2e8f0', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Admin Activity Center</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              <Shield size={13} /> Enterprise Audit Active
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, margin: '6px 0 0' }}>
            Immutable full-coverage audit logs, real-time user surveillance, and per-user activity timelines.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => adminApi.exportCSV('activity_logs')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            <Download size={15} /> Export Audit CSV
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 24, marginBottom: 24 }}>
        {[
          { id: 'all', label: 'All Activity Logs', icon: Layers, badge: logsData?.total },
          { id: 'user_explorer', label: 'User Activity Explorer', icon: UserIcon },
          { id: 'live_sessions', label: 'Real-Time Active Users', icon: Activity, badge: activeSessions.filter(s => s.is_online).length },
          { id: 'metrics', label: 'Analytics & Metrics', icon: BarChart2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 4px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                color: isActive ? '#6366f1' : '#94a3b8',
                fontWeight: isActive ? 600 : 500,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={16} color={isActive ? '#6366f1' : '#64748b'} />
              {tab.label}
              {tab.badge !== undefined && (
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(30,41,59,0.8)', color: isActive ? '#818cf8' : '#64748b' }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ALL ACTIVITY LOGS */}
      {activeTab === 'all' && (
        <div>
          {/* Controls Bar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
                placeholder="Search user, action, IP, endpoint..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <select
              style={inputStyle}
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Categories</option>
              <option value="AUTHENTICATION">Authentication</option>
              <option value="USER_MANAGEMENT">User Management</option>
              <option value="DOMAIN_OPERATIONS">Domain Operations</option>
              <option value="SECURITY_SCAN">Security Scan</option>
              <option value="AI_ANALYSIS">AI Analysis</option>
              <option value="SYSTEM_SETTINGS">System Settings</option>
              <option value="EXPORT">Exports</option>
            </select>

            <select
              style={inputStyle}
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Severities</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
              <option value="ERROR">Error</option>
            </select>

            <select
              style={inputStyle}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
                background: autoRefresh ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.7)',
                border: autoRefresh ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                color: autoRefresh ? '#34d399' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={autoRefresh ? 'spin' : ''} />
              {autoRefresh ? 'Live Stream ON (5s)' : 'Live Stream Off'}
            </button>
          </div>

          {/* Creative Activity Feed List */}
          <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', padding: 20 }}>
            {loadingLogs ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading activity feed...</div>
            ) : !Array.isArray(logsData?.logs) || logsData.logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No activity records match your criteria.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {logsData.logs.map((log) => {
                  const userInitial = (log.username_snapshot || 'S')[0].toUpperCase();
                  const isSuccess = log.status === 'success';

                  return (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '14px 18px',
                        borderRadius: 14,
                        background: 'rgba(30,41,59,0.4)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.06)';
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(30,41,59,0.4)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                      }}
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Left: User Avatar & Basic Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 200 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: 'rgba(99,102,241,0.18)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#a5b4fc',
                            fontWeight: 700,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {userInitial}
                        </div>
                        <div>
                          <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {log.username_snapshot || 'System'}
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(148,163,184,0.12)', color: '#94a3b8', fontWeight: 600 }}>
                              {log.user_role_snapshot || 'USER'}
                            </span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Action Story & Sub-details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.action} {log.object_label ? <span style={{ color: '#818cf8', fontWeight: 500 }}>— {log.object_label}</span> : null}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          {getCategoryBadge(log.category)}
                          {getSeverityBadge(log.severity)}
                          {log.ip_address && (
                            <span style={{ color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>IP: {log.ip_address}</span>
                          )}
                        </div>
                      </div>

                      {/* Right: Status & Inspect Trigger */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: isSuccess ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: isSuccess ? '#34d399' : '#f87171', border: isSuccess ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)' }}>
                          {isSuccess ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {log.status}
                        </span>

                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            color: '#a5b4fc',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Eye size={13} /> Inspect Payload
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {logsData && logsData.total_pages > 1 && (
              <div style={{ padding: '16px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>Page {logsData.page} of {logsData.total_pages} ({logsData.total} total logs)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: Math.min(logsData.total_pages, 7) }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 13, background: p === page ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.6)', border: p === page ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)', color: p === page ? '#a5b4fc' : '#64748b', cursor: 'pointer' }}>{p}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER ACTIVITY EXPLORER */}
      {activeTab === 'user_explorer' && (
        <div>
          <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Select User to Inspect Specific Activity Logs:</label>
            <select
              style={{ ...inputStyle, width: '100%', maxWidth: 400 }}
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
            >
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} (@{u.username}) — [{u.role.toUpperCase()}] ({u.email})
                </option>
              ))}
            </select>
          </div>

          {loadingUserSummary ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading user activity profile...</div>
          ) : userSummary ? (
            <div>
              {/* User Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18 }}>
                  <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Target User</span>
                  <div style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700, marginTop: 4 }}>{userSummary.full_name}</div>
                  <div style={{ color: '#818cf8', fontSize: 13 }}>@{userSummary.username} • {userSummary.role}</div>
                </div>

                <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18 }}>
                  <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Total User Actions</span>
                  <div style={{ color: '#38bdf8', fontSize: 24, fontWeight: 800, marginTop: 4 }}>{userSummary.total_actions}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>Recorded actions in audit trail</div>
                </div>

                <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18 }}>
                  <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Scans Triggered</span>
                  <div style={{ color: '#34d399', fontSize: 24, fontWeight: 800, marginTop: 4 }}>{userSummary.total_scans}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>Domain scans initiated</div>
                </div>

                <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18 }}>
                  <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Last Active</span>
                  <div style={{ color: '#a78bfa', fontSize: 15, fontWeight: 700, marginTop: 6 }}>
                    {userSummary.last_active_at ? new Date(userSummary.last_active_at).toLocaleString() : 'Never'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>Last system interaction</div>
                </div>
              </div>

              {/* Domain Safety Breakdown & Verdicts */}
              <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 14px', color: '#f8fafc', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} color="#34d399" /> Domain Security Checks Breakdown for {userSummary.full_name}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>SAFE DOMAINS</span>
                      <ShieldCheck size={16} color="#34d399" />
                    </div>
                    <div style={{ color: '#34d399', fontSize: 24, fontWeight: 800, marginTop: 4 }}>{userSummary.safe_domains_count}</div>
                    <span style={{ color: '#64748b', fontSize: 11 }}>Clean / Low Risk</span>
                  </div>

                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>MEDIUM / SUSPICIOUS</span>
                      <ShieldAlert size={16} color="#fbbf24" />
                    </div>
                    <div style={{ color: '#fbbf24', fontSize: 24, fontWeight: 800, marginTop: 4 }}>{userSummary.medium_domains_count}</div>
                    <span style={{ color: '#64748b', fontSize: 11 }}>Moderate Risk</span>
                  </div>

                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#f87171', fontSize: 12, fontWeight: 700 }}>UNSAFE / DANGEROUS</span>
                      <AlertOctagon size={16} color="#f87171" />
                    </div>
                    <div style={{ color: '#f87171', fontSize: 24, fontWeight: 800, marginTop: 4 }}>{userSummary.unsafe_domains_count}</div>
                    <span style={{ color: '#64748b', fontSize: 11 }}>High Risk / Malicious</span>
                  </div>
                </div>

                {/* Progress Bar */}
                {userSummary.total_scans > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                      <span>Domain Check Safety Ratio</span>
                      <span>{Math.round((userSummary.safe_domains_count / userSummary.total_scans) * 100)}% Safe</span>
                    </div>
                    <div style={{ height: 10, background: 'rgba(30,41,59,0.8)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${(userSummary.safe_domains_count / userSummary.total_scans) * 100}%`, background: '#10b981' }} />
                      <div style={{ width: `${(userSummary.medium_domains_count / userSummary.total_scans) * 100}%`, background: '#f59e0b' }} />
                      <div style={{ width: `${(userSummary.unsafe_domains_count / userSummary.total_scans) * 100}%`, background: '#ef4444' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* IP History & Category breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18 }}>
                  <h4 style={{ margin: '0 0 12px', color: '#f1f5f9', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={15} color="#38bdf8" /> Recent IP Addresses
                  </h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {userSummary.recent_ips.length === 0 ? (
                      <span style={{ color: '#64748b', fontSize: 13 }}>No IP addresses recorded</span>
                    ) : (
                      userSummary.recent_ips.map((ip) => (
                        <span key={ip} style={{ padding: '4px 10px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12 }}>
                          {ip}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18 }}>
                  <h4 style={{ margin: '0 0 12px', color: '#f1f5f9', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={15} color="#a855f7" /> Activity Category Breakdown
                  </h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(userSummary.top_categories).map(([cat, count]) => (
                      <span key={cat} style={{ padding: '4px 10px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 6, color: '#c084fc', fontSize: 12, fontWeight: 600 }}>
                        {cat.replace('_', ' ')}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* User Recent Scanned Domains */}
              {userSummary.recent_scanned_domains && userSummary.recent_scanned_domains.length > 0 && (
                <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
                  <h4 style={{ margin: '0 0 14px', color: '#f8fafc', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={16} color="#38bdf8" /> Recent Domain Scans by {userSummary.full_name}
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(30,41,59,0.3)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Domain Name</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Risk Level</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Risk Score</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Source</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Checked At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userSummary.recent_scanned_domains.map((dom) => {
                          const rLvl = (dom.risk_level || 'SAFE').toUpperCase();
                          const color = rLvl === 'SAFE' || rLvl === 'LOW' || rLvl === 'CLEAN' ? '#34d399' : rLvl === 'MEDIUM' ? '#fbbf24' : '#f87171';
                          return (
                            <tr key={dom.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600 }}>{dom.domain_name}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}40` }}>
                                  {rLvl}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>{dom.risk_score ?? '—'}</td>
                              <td style={{ padding: '10px 14px', color: '#64748b', textTransform: 'capitalize' }}>{dom.source}</td>
                              <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{new Date(dom.checked_at).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* User Activity Stream Timeline */}
              <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                Activity History Timeline for {userSummary.full_name}
              </h3>
              <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
                {userSummary.logs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>No activity records found for this user.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {userSummary.logs.map((log) => (
                      <div key={log.id} style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 10, background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ marginTop: 2 }}>
                          {log.status === 'success' ? <CheckCircle2 size={16} color="#34d399" /> : <XCircle size={16} color="#f87171" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 14 }}>{log.action}</span>
                            <span style={{ color: '#64748b', fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                            {getCategoryBadge(log.category)}
                            {getSeverityBadge(log.severity)}
                            {log.object_label && <span style={{ color: '#94a3b8', fontSize: 12 }}>Target: {log.object_label}</span>}
                            {log.ip_address && <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>IP: {log.ip_address}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: REAL-TIME ACTIVE USERS */}
      {activeTab === 'live_sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18, fontWeight: 700 }}>Live Active User Presence</h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Real-time view of currently online users and their recent operations.</p>
            </div>
            <button onClick={fetchSessions} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', color: '#a5b4fc', fontSize: 13, cursor: 'pointer' }}>
              <RefreshCw size={14} className={loadingSessions ? 'spin' : ''} /> Refresh Presence
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {activeSessions.map((session) => (
              <div key={session.user_id} style={{ background: 'rgba(15,23,42,0.7)', border: session.is_online ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc', fontWeight: 700 }}>
                      {session.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 15 }}>{session.full_name}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>@{session.username} • {session.role}</div>
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: session.is_online ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', color: session.is_online ? '#34d399' : '#94a3b8', border: session.is_online ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(100,116,139,0.3)' }}>
                    {session.status_label}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Latest Operation:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{session.last_action}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Domain Checks:</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                      {session.total_scans} (<span style={{ color: '#34d399' }}>{session.safe_scans} Safe</span> | <span style={{ color: '#f87171' }}>{session.unsafe_scans} Unsafe</span>)
                    </span>
                  </div>
                  {session.last_endpoint && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Active Endpoint:</span>
                      <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 11 }}>{session.last_endpoint}</span>
                    </div>
                  )}
                  {session.last_ip && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Client IP:</span>
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{session.last_ip}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: '#64748b' }}>Last Activity Timestamp:</span>
                    <span style={{ color: '#64748b', fontSize: 12 }}>{new Date(session.last_active_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: METRICS & ANALYTICS */}
      {activeTab === 'metrics' && metrics && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
              <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Total Audit Events</span>
              <div style={{ color: '#38bdf8', fontSize: 28, fontWeight: 800, marginTop: 4 }}>{metrics.total_events}</div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
              <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>System Success Rate</span>
              <div style={{ color: '#34d399', fontSize: 28, fontWeight: 800, marginTop: 4 }}>{metrics.success_rate_percent}%</div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
              <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Critical Security Events</span>
              <div style={{ color: '#f87171', fontSize: 28, fontWeight: 800, marginTop: 4 }}>{metrics.severity_breakdown['CRITICAL'] || 0}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Category distribution */}
            <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: 16, fontWeight: 700 }}>Activity by Category</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(metrics.categories_breakdown).map(([cat, count]) => {
                  const pct = Math.round((count / (metrics.total_events || 1)) * 100);
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{cat.replace('_', ' ')}</span>
                        <span style={{ color: '#64748b' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(30,41,59,0.8)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Active Users Leaderboard */}
            <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: 16, fontWeight: 700 }}>Most Active Users</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {metrics.top_active_users.map((u, idx) => (
                  <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {idx + 1}
                      </span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>@{u.username}</span>
                    </div>
                    <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: 14 }}>{u.count} actions</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOG INSPECTION MODAL */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, width: '100%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18, fontWeight: 700 }}>Audit Log Details #{selectedLog.id}</h3>
                <span style={{ color: '#64748b', fontSize: 12 }}>{new Date(selectedLog.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 20 }}>
              <div><strong style={{ color: '#64748b' }}>User:</strong> <span style={{ color: '#f1f5f9' }}>{selectedLog.username_snapshot || 'System'}</span></div>
              <div><strong style={{ color: '#64748b' }}>Role:</strong> <span style={{ color: '#f1f5f9' }}>{selectedLog.user_role_snapshot || '—'}</span></div>
              <div><strong style={{ color: '#64748b' }}>Action:</strong> <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{selectedLog.action}</span></div>
              <div><strong style={{ color: '#64748b' }}>Status:</strong> <span style={{ color: selectedLog.status === 'success' ? '#34d399' : '#f87171' }}>{selectedLog.status}</span></div>
              <div><strong style={{ color: '#64748b' }}>IP Address:</strong> <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{selectedLog.ip_address || '—'}</span></div>
              <div><strong style={{ color: '#64748b' }}>Endpoint:</strong> <span style={{ color: '#818cf8', fontFamily: 'monospace' }}>{selectedLog.endpoint || '—'}</span></div>
              <div><strong style={{ color: '#64748b' }}>Browser / OS:</strong> <span style={{ color: '#f1f5f9' }}>{selectedLog.browser} / {selectedLog.os}</span></div>
              <div><strong style={{ color: '#64748b' }}>Execution Time:</strong> <span style={{ color: '#f1f5f9' }}>{selectedLog.execution_time_ms ? `${selectedLog.execution_time_ms}ms` : '—'}</span></div>
            </div>

            {/* Old vs New Value JSON comparison */}
            {(selectedLog.old_value || selectedLog.new_value) && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>State Mutation Payload</h4>
                <div style={{ display: 'grid', gridTemplateColumns: selectedLog.old_value ? '1fr 1fr' : '1fr', gap: 12 }}>
                  {selectedLog.old_value && (
                    <div>
                      <span style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>Previous State:</span>
                      <pre style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 8, color: '#fca5a5', fontSize: 11, overflowX: 'auto' }}>
                        {JSON.stringify(selectedLog.old_value, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.new_value && (
                    <div>
                      <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600 }}>New State:</span>
                      <pre style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', padding: 12, borderRadius: 8, color: '#6ee7b7', fontSize: 11, overflowX: 'auto' }}>
                        {JSON.stringify(selectedLog.new_value, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedLog.error_message && (
              <div>
                <h4 style={{ color: '#f87171', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Error Details</h4>
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: 12, borderRadius: 8, fontSize: 12 }}>
                  {selectedLog.error_message}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
