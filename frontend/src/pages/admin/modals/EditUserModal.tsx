import React, { useState } from 'react';
import { adminApi } from '../../../services/adminApi';
import { useAuth } from '../../../contexts/AuthContext';
import type { AdminUser, UserUpdatePayload, UserRole, UserStatus } from '../../../types/admin';
import { X, AlertCircle } from 'lucide-react';

interface Props { user: AdminUser; onClose: () => void; onSaved: () => void; }

export default function EditUserModal({ user, onClose, onSaved }: Props) {
  const { currentUser } = useAuth();
  const [form, setForm] = useState<UserUpdatePayload>({
    full_name: user.full_name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    department: user.department ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: keyof UserUpdatePayload, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await adminApi.updateUser(user.id, form);
      onSaved(); onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.join(' ') : (detail ?? 'Failed to update user.'));
    }
    setSaving(false);
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: 'rgba(10,14,26,0.98)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>Edit User</h2>
            <p style={{ color: '#475569', fontSize: 12, margin: '4px 0 0' }}>#{user.id} — {user.username}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, color: '#fca5a5', fontSize: 13 }}>
            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={labelStyle}>Full Name</label><input style={fieldStyle} value={form.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} /></div>
            <div><label style={labelStyle}>Username</label><input style={fieldStyle} value={form.username ?? ''} onChange={(e) => set('username', e.target.value)} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Email</label><input type="email" style={fieldStyle} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
            {currentUser?.role === 'super_admin' && (
              <div>
                <label style={labelStyle}>Role</label>
                <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.role ?? ''} onChange={(e) => set('role', e.target.value as UserRole)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Status</label>
              <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.status ?? ''} onChange={(e) => set('status', e.target.value as UserStatus)}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Department</label>
              <input style={fieldStyle} value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
