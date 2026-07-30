import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/adminApi';
import type { SystemSetting } from '../../types/admin';
import { Settings, Save, AlertCircle, CheckCircle, Lock, Globe, Mail, Shield, Database } from 'lucide-react';

const CATEGORIES = [
  { key: 'general',  label: 'General',         icon: <Globe size={15} /> },
  { key: 'security', label: 'Security Policy',  icon: <Shield size={15} /> },
  { key: 'smtp',     label: 'SMTP Email',       icon: <Mail size={15} /> },
  { key: 'wayback',  label: 'Wayback Config',   icon: <Database size={15} /> },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
      const vals: Record<string, string> = {};
      data.forEach((s) => { vals[s.key] = s.value ?? ''; });
      setEditValues(vals);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    const visible = settings.filter((s) => s.category === activeCategory);
    const updates: Record<string, string | null> = {};
    visible.forEach((s) => { updates[s.key] = editValues[s.key] ?? null; });
    try {
      await adminApi.updateSettings(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save settings.');
    }
    setSaving(false);
  };

  const categorySettings = settings.filter((s) => s.category === activeCategory);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={22} color="#f59e0b" /> System Settings
        </h1>
        <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>
          Super Admin only — changes take effect immediately.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Category Tabs (vertical) */}
        <div style={{
          width: 200, flexShrink: 0,
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: 12,
        }}>
          {CATEGORIES.map((cat) => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: 'none',
              background: activeCategory === cat.key ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: activeCategory === cat.key ? '#f59e0b' : '#64748b',
              fontSize: 13, fontWeight: activeCategory === cat.key ? 600 : 500,
              marginBottom: 4, transition: 'all 0.15s',
            }}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Settings Panel */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: 28,
          }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {CATEGORIES.find((c) => c.key === activeCategory)?.icon}
              {CATEGORIES.find((c) => c.key === activeCategory)?.label}
            </h3>

            {loading ? (
              <div style={{ color: '#475569', padding: 24, textAlign: 'center' }}>Loading settings...</div>
            ) : categorySettings.length === 0 ? (
              <div style={{ color: '#475569', padding: 24, textAlign: 'center' }}>No settings in this category.</div>
            ) : (
              <div style={{ display: 'grid', gap: 18 }}>
                {categorySettings.map((s) => {
                  const isSensitive = s.key.includes('pass') || s.key.includes('key') || s.key.includes('secret');
                  return (
                    <div key={s.key}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                        {isSensitive && <Lock size={10} />}
                        {s.description ?? s.key}
                      </label>
                      <input
                        type={isSensitive ? 'password' : 'text'}
                        style={inputStyle}
                        value={editValues[s.key] ?? ''}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
                        placeholder={isSensitive ? '••••••••' : `Enter ${s.key}`}
                      />
                      <div style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>Key: {s.key}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Feedback */}
            {error && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginTop: 20, color: '#fca5a5', fontSize: 13 }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}
            {saved && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 14px', marginTop: 20, color: '#6ee7b7', fontSize: 13 }}>
                <CheckCircle size={14} /> Settings saved successfully!
              </div>
            )}

            {/* Save Button */}
            <button onClick={handleSave} disabled={saving || loading} style={{
              marginTop: 24, display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: saving ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white', fontSize: 15, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 20px rgba(245,158,11,0.3)',
            }}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
