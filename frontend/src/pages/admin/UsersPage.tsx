import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';
import { useAuth } from '../../contexts/AuthContext';
import type { AdminUser, UserListResponse, DashboardStats } from '../../types/admin';
import AddUserModal from './modals/AddUserModal';
import EditUserModal from './modals/EditUserModal';
import ResetPasswordModal from './modals/ResetPasswordModal';

import {
  UserPlus, Search, Edit3, Trash2, Eye, Lock, UserCheck, UserX, RefreshCw,
  Crown, ShieldCheck, User, Users,
} from 'lucide-react';
import { ViewUserModal } from './modals/ViewUserModal';

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  super_admin: { label: 'Super Admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: <Crown size={12} style={{ marginRight: 4 }} /> },
  admin: { label: 'Admin', color: '#6366f1', bg: 'rgba(99,102,241,0.15)', icon: <ShieldCheck size={12} style={{ marginRight: 4 }} /> },
  user: { label: 'User', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: <User size={12} style={{ marginRight: 4 }} /> },
};

const STATUS_BADGE: Record<string, { color: string; bg: string }> = {
  active: { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  suspended: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

function Badge({ text, color, bg, icon }: { text: string; color: string; bg: string; icon?: React.ReactNode }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color, background: bg, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
    }}>
      {icon}
      {text}
    </span>
  );
}

export default function UsersPage() {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<UserListResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const initialRole = searchParams.get('role') || '';
  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [viewTarget, setViewTarget] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  // Sync roleFilter with URL query param
  useEffect(() => {
    const roleParam = searchParams.get('role') || '';
    if (roleParam !== roleFilter) {
      setRoleFilter(roleParam);
    }
  }, [searchParams]);

  const handleRoleTabChange = (role: string) => {
    setRoleFilter(role);
    setPage(1);
    if (role) {
      setSearchParams({ role });
    } else {
      setSearchParams({});
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getDashboardStats();
      setStats(res);
    } catch { /* ignore */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        page, page_size: 20,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const canManage = (target: AdminUser) => {
    if (currentUser?.role === 'super_admin') return true;
    if (currentUser?.role === 'admin') return target.role === 'user';
    return false;
  };

  const handleSuspend = async (user: AdminUser) => {
    try { await adminApi.suspendUser(user.id); fetchUsers(); } catch { /* ignore */ }
  };

  const handleActivate = async (user: AdminUser) => {
    try { await adminApi.activateUser(user.id); fetchUsers(); } catch { /* ignore */ }
  };

  const handleDelete = async (user: AdminUser) => {
    try { await adminApi.deleteUser(user.id); setConfirmDelete(null); fetchUsers(); } catch { /* ignore */ }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14, padding: '9px 14px', outline: 'none',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>User Management</h1>
          <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>
            {data ? `${data.total} users in view` : 'Loading...'}
          </p>
        </div>
        <button
          id="add-user-btn"
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', color: 'white', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
          }}
        >
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {/* Role Summary Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* Standard Users Card */}
        <div
          onClick={() => handleRoleTabChange('user')}
          style={{
            background: roleFilter === 'user' ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.6)',
            border: roleFilter === 'user' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#10b981', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Standard Users</div>
              <div style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 700, marginTop: 4 }}>
                {stats?.total_users ?? '—'}
              </div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={20} />
            </div>
          </div>
        </div>

        {/* Admins Card */}
        <div
          onClick={() => handleRoleTabChange('admin')}
          style={{
            background: roleFilter === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(15,23,42,0.6)',
            border: roleFilter === 'admin' ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#6366f1', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Admins</div>
              <div style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 700, marginTop: 4 }}>
                {stats?.total_admins ?? '—'}
              </div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
        </div>

        {/* Super Admins Card */}
        <div
          onClick={() => handleRoleTabChange('super_admin')}
          style={{
            background: roleFilter === 'super_admin' ? 'rgba(245,158,11,0.15)' : 'rgba(15,23,42,0.6)',
            border: roleFilter === 'super_admin' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Super Admins</div>
              <div style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 700, marginTop: 4 }}>
                {stats?.total_super_admins ?? '—'}
              </div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Role Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12,
      }}>
        {[
          { key: '', label: 'All Accounts', icon: Users, color: '#94a3b8', count: stats ? (stats.total_users + stats.total_admins + stats.total_super_admins) : undefined },
          { key: 'user', label: 'Standard Users', icon: User, color: '#10b981', count: stats?.total_users },
          { key: 'admin', label: 'Admins', icon: ShieldCheck, color: '#6366f1', count: stats?.total_admins },
          { key: 'super_admin', label: 'Super Admins', icon: Crown, color: '#f59e0b', count: stats?.total_super_admins },
        ].map((tab) => {
          const isActive = roleFilter === tab.key;
          const IconComp = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => handleRoleTabChange(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: isActive ? `${tab.color}20` : 'rgba(30,41,59,0.5)',
                color: isActive ? '#f8fafc' : '#94a3b8',
                border: isActive ? `1px solid ${tab.color}50` : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <IconComp size={15} style={{ color: isActive ? tab.color : '#64748b' }} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 12,
                  background: isActive ? `${tab.color}35` : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#ffffff' : '#64748b',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: '16px',
      }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            style={{ ...inputStyle, paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
            placeholder="Search name, username, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select value={roleFilter} onChange={(e) => handleRoleTabChange(e.target.value)}
          style={{ ...inputStyle, minWidth: 140, cursor: 'pointer' }}>
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ ...inputStyle, minWidth: 140, cursor: 'pointer' }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
        <button onClick={() => { fetchUsers(); fetchStats(); }} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['ID', 'Full Name', 'Username', 'Email', 'Role', 'Status', 'Created', 'Last Login', 'Actions'].map((h) => (
                  <th key={h} style={{
                    padding: '13px 16px', textAlign: 'left',
                    color: '#475569', fontWeight: 600, fontSize: 12,
                    textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>Loading...</td></tr>
              ) : !data?.users.length ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>No users found.</td></tr>
              ) : (
                data.users.map((user) => {
                  const roleBadge = ROLE_BADGE[user.role];
                  const statusBadge = STATUS_BADGE[user.status];
                  return (
                    <tr key={user.id} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '13px 16px', color: '#475569' }}>#{user.id}</td>
                      <td style={{ padding: '13px 16px', color: '#e2e8f0', fontWeight: 500 }}>{user.full_name}</td>
                      <td style={{ padding: '13px 16px', color: '#94a3b8' }}>{user.username}</td>
                      <td style={{ padding: '13px 16px', color: '#94a3b8' }}>{user.email}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <Badge
                          text={roleBadge?.label ?? user.role}
                          color={roleBadge?.color ?? '#64748b'}
                          bg={roleBadge?.bg ?? 'transparent'}
                          icon={roleBadge?.icon}
                        />
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <Badge text={user.status} color={statusBadge?.color ?? '#64748b'} bg={statusBadge?.bg ?? 'transparent'} />
                      </td>
                      <td style={{ padding: '13px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '13px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* View */}
                          <ActionBtn icon={<Eye size={13} />} title="View" color="#6366f1" onClick={() => setViewTarget(user)} />
                          {canManage(user) && <>
                            <ActionBtn icon={<Edit3 size={13} />} title="Edit" color="#8b5cf6" onClick={() => setEditTarget(user)} />
                            <ActionBtn icon={<Lock size={13} />} title="Reset Password" color="#f59e0b" onClick={() => setResetTarget(user)} />
                            {user.status === 'active'
                              ? <ActionBtn icon={<UserX size={13} />} title="Suspend" color="#ef4444" onClick={() => handleSuspend(user)} />
                              : <ActionBtn icon={<UserCheck size={13} />} title="Activate" color="#10b981" onClick={() => handleActivate(user)} />
                            }
                            <ActionBtn icon={<Trash2 size={13} />} title="Delete" color="#ef4444" onClick={() => setConfirmDelete(user)} />
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div style={{
            padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#475569', fontSize: 13 }}>
              Page {data.page} of {data.total_pages} ({data.total} total)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {Array.from({ length: Math.min(data.total_pages, 7) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} style={{
                  width: 32, height: 32, borderRadius: 8, fontSize: 13,
                  background: p === page ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.6)',
                  border: p === page ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  color: p === page ? '#e2e8f0' : '#475569', cursor: 'pointer',
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: 32, maxWidth: 400, width: '90%',
          }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 12px', fontSize: 18 }}>Delete User</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24 }}>
              Are you sure you want to delete <strong style={{ color: '#e2e8f0' }}>{confirmDelete.username}</strong>?
              This action is irreversible and will suspend the account.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14,
              }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={fetchUsers} />}
      {editTarget && <EditUserModal user={editTarget} onClose={() => setEditTarget(null)} onSaved={fetchUsers} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
      {viewTarget && <ViewUserModal user={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

function ActionBtn({ icon, title, color, onClick }: { icon: React.ReactNode; title: string; color: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 7,
        background: `${color}15`, border: `1px solid ${color}30`,
        color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = `${color}30`;
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = `${color}15`;
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      {icon}
    </button>
  );
}
