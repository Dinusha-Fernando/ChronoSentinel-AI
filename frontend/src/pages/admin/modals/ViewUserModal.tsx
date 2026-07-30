import React, { useState, useEffect, useMemo } from 'react';
import type { AdminUser, ActivityLog, LoginHistoryRecord, ScanRecord } from '../../../types/admin';
import { adminApi } from '../../../services/adminApi';
import { 
  X, Mail, User, Shield, Clock, Globe, Building2,
  Monitor, Search, ChevronDown, ChevronRight
} from 'lucide-react';

interface Props { 
  user: AdminUser; 
  onClose: () => void; 
}

interface DayGroup { date: string; count: number; domains: ScanRecord[]; }

const ROLE_COLORS: Record<string, string> = { 
  super_admin: '#f59e0b', 
  admin: '#6366f1', 
  user: '#10b981' 
};

const STATUS_COLORS: Record<string, string> = { 
  active: '#10b981', 
  suspended: '#ef4444', 
  pending: '#f59e0b' 
};

export function ViewUserModal({ user, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'logins'>('profile');
  const [loading, setLoading] = useState<boolean>(true);
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [scanCount, setScanCount] = useState<number>(0);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [scanRes, actRes, logRes] = await Promise.all([
          adminApi.getScanRecords({ page: 1, page_size: 100, user_id: user.id }),
          adminApi.getActivityLogs({ page: 1, page_size: 30, user_id: user.id }),
          adminApi.getLoginHistory({ page: 1, page_size: 25, user_id: user.id }),
        ]);
        setScanRecords(scanRes.records);
        setScanCount(scanRes.total);
        setActivityLogs(actRes.logs);
        setLoginHistory(logRes.records);
      } catch (err) {
        console.error('Failed to load user profile details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user.id]);

  // Group scan records by calendar date (most recent first)
  const domainsByDay = useMemo<DayGroup[]>(() => {
    const map: Record<string, ScanRecord[]> = {};
    for (const rec of scanRecords) {
      const day = new Date(rec.checked_at).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric' 
      });
      if (!map[day]) map[day] = [];
      map[day].push(rec);
    }
    return Object.entries(map)
      .map(([date, domains]) => ({ date, count: domains.length, domains }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [scanRecords]);

  // Max per-day count for progress bar scaling
  const maxDayCount = Math.max(...domainsByDay.map(d => d.count), 1);

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const tabButtonStyle = (tab: typeof activeTab): React.CSSProperties => ({
    padding: '10px 16px',
    background: activeTab === tab ? 'rgba(99,102,241,0.15)' : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
    color: activeTab === tab ? '#e2e8f0' : '#475569',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ 
      position: 'fixed', inset: 0, 
      background: 'rgba(5, 7, 16, 0.88)', 
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 200, padding: 20 
    }}>
      <div style={{ 
        background: 'rgba(10, 14, 26, 0.97)', 
        border: '1px solid rgba(99, 102, 241, 0.22)', 
        borderRadius: 24, 
        width: '100%', 
        maxWidth: 660, 
        height: '92vh',
        maxHeight: 820,
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(0,0,0,0.85), 0 0 48px rgba(99,102,241,0.08)',
        overflow: 'hidden',
        animation: 'modal-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>

        {/* ── Header ── */}
        <div style={{ 
          padding: '22px 28px', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(10,14,26,0) 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ 
              width: 54, height: 54, borderRadius: 15, 
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: 'white', fontSize: 22, fontWeight: 800,
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
              flexShrink: 0
            }}>
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700, margin: 0 }}>
                {user.full_name}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <Badge color={ROLE_COLORS[user.role] ?? '#64748b'} label={user.role.replace(/_/g, ' ').toUpperCase()} />
                <Badge color={STATUS_COLORS[user.status] ?? '#64748b'} label={user.status.toUpperCase()} />
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', 
            borderRadius: 10, cursor: 'pointer', color: '#94a3b8', padding: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0
          }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ 
          display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', 
          background: 'rgba(5,7,16,0.25)', padding: '0 12px', flexShrink: 0
        }}>
          <button onClick={() => setActiveTab('profile')} style={tabButtonStyle('profile')}>Profile</button>
          <button onClick={() => setActiveTab('activity')} style={tabButtonStyle('activity')}>Activity Trail</button>
          <button onClick={() => setActiveTab('logins')} style={tabButtonStyle('logins')}>Login Sessions</button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#475569' }}>
              <div style={{ 
                width: 44, height: 44, borderRadius: '50%', 
                border: '3px solid rgba(99,102,241,0.15)', 
                borderTopColor: '#6366f1',
                animation: 'spin 0.8s linear infinite'
              }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Loading audit intelligence...</span>
            </div>
          ) : (
            <>
              {/* ══ TAB: Profile ══ */}
              {activeTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'tab-fade-in 0.28s ease' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 18, padding: '4px 16px' }}>
                    <InfoField icon={<User size={13} />} label="Username" value={`@${user.username}`} />
                    <InfoField icon={<Mail size={13} />} label="Email" value={user.email} />
                    <InfoField icon={<Building2 size={13} />} label="Department" value={user.department || 'Unassigned'} />
                    <InfoField icon={<Clock size={13} />} label="Registered" value={new Date(user.created_at).toLocaleString()} />
                    <InfoField icon={<Clock size={13} />} label="Last Login" value={user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'} />
                    <InfoField icon={<Shield size={13} />} label="Failed Login Attempts" value={`${user.failed_login_count}`} last />
                  </div>

                  <div style={{ 
                    padding: '12px 16px', borderRadius: 14,
                    background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.14)',
                    fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.6
                  }}>
                    <Globe size={14} style={{ color: '#8b5cf6', marginTop: 1, flexShrink: 0 }} />
                    <span><strong style={{ color: '#a78bfa' }}>30-Day Data Retention:</strong> Activity logs, scanned domains, and login sessions are retained for a 30-day rolling window and automatically pruned by the system.</span>
                  </div>
                </div>
              )}

              {/* ══ TAB: Activity Trail ══ */}
              {activeTab === 'activity' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'tab-fade-in 0.28s ease' }}>

                  {/* ─── User Identity + Domain Scan Card ─── */}
                  <div style={{
                    background: 'rgba(99,102,241,0.03)',
                    border: '1px solid rgba(99,102,241,0.15)',
                    borderRadius: 18,
                    overflow: 'hidden'
                  }}>
                    {/* Mini user identity card */}
                    <div style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid rgba(99,102,241,0.1)',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, transparent 80%)',
                      display: 'flex', alignItems: 'center', gap: 14
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 18, fontWeight: 800,
                        boxShadow: '0 4px 14px rgba(99,102,241,0.3)'
                      }}>
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      {/* User info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>{user.full_name}</span>
                          <span style={{ color: '#64748b', fontSize: 11 }}>@{user.username}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                          <Badge color={ROLE_COLORS[user.role] ?? '#64748b'} label={user.role.replace(/_/g, ' ').toUpperCase()} />
                          <Badge color={STATUS_COLORS[user.status] ?? '#64748b'} label={user.status.toUpperCase()} />
                        </div>
                      </div>
                      {/* Stats strip */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div style={{
                          padding: '4px 12px', borderRadius: 20,
                          background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                          color: '#22d3ee', fontSize: 12, fontWeight: 800
                        }}>
                          {scanCount} domains
                        </div>
                        <span style={{ fontSize: 10, color: '#475569' }}>
                          Since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                  {/* ─ Domain Checks by Day — seamless sub-section ─ */}
                  <div style={{ borderTop: '1px solid rgba(6,182,212,0.1)' }}>
                    {/* Card Header */}
                    <div style={{ 
                      padding: '14px 18px', 
                      borderBottom: '1px solid rgba(6,182,212,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'rgba(6,182,212,0.04)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: 9,
                          background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4'
                        }}>
                          <Search size={15} />
                        </div>
                        <div>
                          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>Domain Checks per Day</span>
                          <span style={{ color: '#475569', fontSize: 11, display: 'block' }}>
                            {scanCount} total scans across {domainsByDay.length} day{domainsByDay.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div style={{ 
                        padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                        color: '#22d3ee', fontSize: 11, fontWeight: 700
                      }}>
                        {scanCount} TOTAL
                      </div>
                    </div>

                    {/* Day-by-day list */}
                    <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {domainsByDay.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
                          No domain scans recorded yet.
                        </div>
                      ) : domainsByDay.map((group) => {
                        const isExpanded = expandedDays.has(group.date);
                        const barWidth = Math.max(6, (group.count / maxDayCount) * 100);
                        return (
                          <div key={group.date}>
                            {/* Day row */}
                            <button
                              onClick={() => toggleDay(group.date)}
                              style={{ 
                                width: '100%', background: 'none', border: 'none', 
                                cursor: 'pointer', padding: 0, textAlign: 'left'
                              }}
                            >
                              <div style={{ 
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 10px', borderRadius: 10,
                                background: isExpanded ? 'rgba(6,182,212,0.05)' : 'transparent',
                                transition: 'background 0.2s',
                              }}>
                                {/* Chevron */}
                                <div style={{ color: '#475569', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </div>

                                {/* Date label */}
                                <span style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 700, width: 100, flexShrink: 0 }}>
                                  {group.date}
                                </span>

                                {/* Progress bar */}
                                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ 
                                    width: `${barWidth}%`, height: '100%',
                                    background: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                                    borderRadius: 3,
                                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                  }} />
                                </div>

                                {/* Count badge */}
                                <span style={{ 
                                  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
                                  color: '#22d3ee', background: 'rgba(6,182,212,0.1)', 
                                  border: '1px solid rgba(6,182,212,0.18)', flexShrink: 0
                                }}>
                                  {group.count} scan{group.count !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </button>

                            {/* Expanded domain list */}
                            {isExpanded && (
                              <div style={{ 
                                marginLeft: 24, marginTop: 4, 
                                display: 'flex', flexDirection: 'column', gap: 4,
                                animation: 'tab-fade-in 0.2s ease'
                              }}>
                                {group.domains.map((rec) => (
                                  <div key={rec.id} style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 12px', borderRadius: 8,
                                    background: 'rgba(255,255,255,0.02)', 
                                    border: '1px solid rgba(255,255,255,0.04)'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#06b6d4', flexShrink: 0 }} />
                                      <span style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace', fontWeight: 500 }}>
                                        {rec.domain_name}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {rec.risk_level && (
                                        <span style={{ 
                                          fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                                          color: rec.risk_level === 'HIGH' ? '#f87171' : rec.risk_level === 'MEDIUM' ? '#fb923c' : '#34d399',
                                          background: rec.risk_level === 'HIGH' ? 'rgba(239,68,68,0.1)' : rec.risk_level === 'MEDIUM' ? 'rgba(251,146,60,0.1)' : 'rgba(16,185,129,0.1)',
                                        }}>
                                          {rec.risk_level}
                                        </span>
                                      )}
                                      <span style={{ color: '#334155', fontSize: 10 }}>
                                        {new Date(rec.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* closing outer user+domain card */}
                  </div>

                  {/* ─ Admin Action Logs ─ */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>System Action Audit</span>
                      <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>Last 30 entries</span>
                    </div>
                    {activityLogs.length === 0 ? (
                      <div style={{ padding: '32px 20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 14, color: '#475569', fontSize: 13 }}>
                        No recorded system actions yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activityLogs.map((log) => (
                          <div key={log.id} style={{ 
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', 
                            borderRadius: 12, padding: '11px 14px',
                            display: 'flex', flexDirection: 'column', gap: 6
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                              <StatusBadge status={log.status} />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 10, color: '#475569' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Globe size={9} /> <span>IP: <strong style={{ color: '#64748b' }}>{log.ip_address || '—'}</strong></span>
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Monitor size={9} /> <span><strong style={{ color: '#64748b' }}>{log.browser || '—'}</strong></span>
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Clock size={9} /> <span>{new Date(log.created_at).toLocaleString()}</span>
                              </span>
                            </div>
                            {log.object_label && (
                              <span style={{ 
                                fontSize: 10, color: '#8b5cf6', background: 'rgba(139,92,246,0.06)', 
                                padding: '3px 8px', borderRadius: 5, alignSelf: 'flex-start',
                                border: '1px solid rgba(139,92,246,0.12)'
                              }}>
                                ↳ {log.object_label} ({log.object_type || 'Object'})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ TAB: Login Sessions ══ */}
              {activeTab === 'logins' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'tab-fade-in 0.28s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Login Session History</span>
                    <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>Last 25 sessions</span>
                  </div>
                  {loginHistory.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 14, color: '#475569', fontSize: 13 }}>
                      No login sessions recorded.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {loginHistory.map((lh) => (
                        <div key={lh.id} style={{ 
                          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', 
                          borderRadius: 12, padding: '11px 14px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{lh.ip_address || 'Unknown IP'}</span>
                              {lh.country && <span style={{ fontSize: 10, color: '#475569' }}>({lh.country})</span>}
                            </div>
                            <span style={{ fontSize: 10, color: '#475569' }}>
                              {lh.browser || 'Unknown Browser'} · {lh.os || 'Unknown OS'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <StatusBadge status={lh.success ? 'success' : 'failed'} />
                            <span style={{ fontSize: 9, color: '#334155' }}>
                              {new Date(lh.login_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ 
          padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(5,7,16,0.4)', display: 'flex', justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button onClick={onClose} style={{ 
            padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#94a3b8',
            transition: 'all 0.15s'
          }}>
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-enter {
          0%   { opacity: 0; transform: translateY(36px) scale(0.95); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes tab-fade-in {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ 
      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, 
      color, background: `${color}14`, border: `1px solid ${color}28`
    }}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'success';
  return (
    <span style={{ 
      padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 800, 
      color: ok ? '#34d399' : '#f87171', 
      background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`
    }}>
      {status.toUpperCase()}
    </span>
  );
}

function InfoField({ icon, label, value, last }: { 
  icon: React.ReactNode; label: string; value?: string | number | null; last?: boolean;
}) {
  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
      padding: '11px 0', 
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
      gap: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ color: '#475569', display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, textAlign: 'right', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}
