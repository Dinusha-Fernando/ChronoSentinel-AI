import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, UserPlus, UserX, ShieldAlert, Wifi, AlertCircle } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import type { AdminNotification } from '../../types/admin';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  new_user:       { icon: <UserPlus size={14} />,     color: '#10b981' },
  user_deleted:   { icon: <UserX size={14} />,        color: '#ef4444' },
  unsafe_domain:  { icon: <ShieldAlert size={14} />,  color: '#f59e0b' },
  failed_logins:  { icon: <AlertTriangle size={14} />,color: '#f59e0b' },
  system_error:   { icon: <AlertCircle size={14} />,  color: '#ef4444' },
  wayback_failure:{ icon: <Wifi size={14} />,         color: '#64748b' },
  api_error:      { icon: <AlertCircle size={14} />,  color: '#ef4444' },
  admin_action:   { icon: <Check size={14} />,        color: '#6366f1' },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAll = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleMarkOne = async (id: number) => {
    try {
      await adminApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id="notification-bell"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        style={{
          position: 'relative', background: 'rgba(30,41,59,0.6)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
          padding: '8px 10px', cursor: 'pointer', color: '#94a3b8',
          display: 'flex', alignItems: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: 'white',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 44, zIndex: 100,
          width: 360, maxHeight: 480,
          background: 'rgba(10,14,26,0.98)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  background: 'rgba(239,68,68,0.2)', color: '#ef4444',
                  fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                }}>{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6366f1', fontSize: 12, fontWeight: 500,
                }}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.notification_type] ?? TYPE_CONFIG.admin_action;
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.05)',
                      cursor: n.is_read ? 'default' : 'pointer',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => !n.is_read && handleMarkOne(n.id)}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: `${cfg.color}20`, color: cfg.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: n.is_read ? '#64748b' : '#e2e8f0',
                        fontSize: 13, fontWeight: n.is_read ? 400 : 600, marginBottom: 3,
                      }}>{n.title}</div>
                      <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.5 }}>{n.message}</div>
                      <div style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.is_read && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#6366f1', flexShrink: 0, marginTop: 4,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
