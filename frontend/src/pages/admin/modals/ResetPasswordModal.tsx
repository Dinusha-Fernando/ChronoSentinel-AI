import React, { useState } from 'react';
import { adminApi } from '../../../services/adminApi';
import type { AdminUser } from '../../../types/admin';
import { X, AlertCircle, Copy, CheckCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface Props { user: AdminUser; onClose: () => void; }

export default function ResetPasswordModal({ user, onClose }: Props) {
  const [mode, setMode] = useState<'generate' | 'manual'>('generate');
  const [manualPwd, setManualPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    setSaving(true); setError('');
    try {
      const res = await adminApi.resetPassword(user.id, {
        new_password: mode === 'manual' ? manualPwd : undefined,
      });
      if (res.temp_password) setTempPassword(res.temp_password);
      else setTempPassword('Password reset successfully!');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.join(' ') : (detail ?? 'Failed to reset password.'));
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
    background: active ? 'rgba(99,102,241,0.2)' : 'rgba(30,41,59,0.4)',
    color: active ? '#a5b4fc' : '#64748b', transition: 'all 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: 'rgba(10,14,26,0.98)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>Reset Password</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><X size={20} /></button>
        </div>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
          Resetting password for <strong style={{ color: '#e2e8f0' }}>{user.username}</strong>. The user will be required to change their password on next login.
        </p>

        {!tempPassword ? (
          <>
            {/* Mode selector */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button style={btnStyle(mode === 'generate')} onClick={() => setMode('generate')}>
                <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Auto-generate
              </button>
              <button style={btnStyle(mode === 'manual')} onClick={() => setMode('manual')}>
                Set Manually
              </button>
            </div>

            {mode === 'manual' && (
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>New Password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={manualPwd}
                  onChange={(e) => setManualPwd(e.target.value)}
                  style={{ width: '100%', padding: '10px 40px 10px 14px', boxSizing: 'border-box', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  placeholder="Enter new password"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, bottom: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}>
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )}

            {error && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
                <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />{error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={handleReset} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={40} color="#10b981" style={{ marginBottom: 12 }} />
            <p style={{ color: '#10b981', fontWeight: 600, marginBottom: 12 }}>Password Reset Successfully!</p>
            {tempPassword !== 'Password reset successfully!' && (
              <>
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>
                  Copy and share this temporary password. It will not be shown again.
                </p>
                <div style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
                  <code style={{ color: '#10b981', fontSize: 15, fontFamily: 'monospace', letterSpacing: '1px' }}>{tempPassword}</code>
                  <button onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#10b981' : '#475569' }}>
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </>
            )}
            <button onClick={onClose} style={{ padding: '11px 32px', borderRadius: 10, border: 'none', background: 'rgba(30,41,59,0.8)', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
