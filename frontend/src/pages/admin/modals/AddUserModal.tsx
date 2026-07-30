import React, { useState } from 'react';
import { adminApi } from '../../../services/adminApi';
import { useAuth } from '../../../contexts/AuthContext';
import type { UserCreatePayload, UserRole, UserStatus } from '../../../types/admin';
import { X, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

export default function AddUserModal({ onClose, onSaved }: Props) {
  const { currentUser } = useAuth();
  const [form, setForm] = useState<UserCreatePayload>({
    full_name: '', username: '', email: '', password: '',
    role: 'user', department: '', status: 'active',
  });
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: keyof UserCreatePayload, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== confirmPwd) { setError('Passwords do not match.'); return; }
    setSaving(true); setError('');
    try {
      await adminApi.createUser(form);
      onSaved(); onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.join(' ') : (detail ?? 'Failed to create user.'));
    }
    setSaving(false);
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14, outline: 'none',
    fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: 'rgba(10,14,26,0.98)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>Add New User</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, color: '#fca5a5', fontSize: 13 }}>
            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={labelStyle}>Full Name *</label><input required style={fieldStyle} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="John Doe" /></div>
            <div><label style={labelStyle}>Username *</label><input required style={fieldStyle} value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="johndoe" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Email *</label><input required type="email" style={fieldStyle} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="john@example.com" /></div>
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Password *</label>
              <input required type={showPwd ? 'text' : 'password'} style={{ ...fieldStyle, paddingRight: 40 }} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Enter password" />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, bottom: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}>
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div><label style={labelStyle}>Confirm Password *</label><input required type={showPwd ? 'text' : 'password'} style={fieldStyle} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repeat password" /></div>
            <div>
              <label style={labelStyle}>Role *</label>
              <select required style={{ ...fieldStyle, cursor: 'pointer' }} value={form.role} onChange={(e) => set('role', e.target.value as UserRole)}>
                <option value="user">User</option>
                {currentUser?.role === 'super_admin' && <><option value="admin">Admin</option><option value="super_admin">Super Admin</option></>}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status *</label>
              <select required style={{ ...fieldStyle, cursor: 'pointer' }} value={form.status} onChange={(e) => set('status', e.target.value as UserStatus)}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Department (Optional)</label>
              <input style={fieldStyle} value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Security, IT, Operations" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
