import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NotificationDropdown from '../../components/admin/NotificationDropdown';
import { DragonLogo } from '../../components/DragonLogo';
import {
  LayoutDashboard, Users, Globe, BarChart3, ClipboardList,
  LogIn, Activity, Settings, LogOut, ChevronLeft, ChevronRight,
  Menu,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/admin/dashboard',      icon: LayoutDashboard, roles: ['admin', 'super_admin'] },
  { label: 'Users',         path: '/admin/users',          icon: Users,           roles: ['admin', 'super_admin'] },
  { label: 'Domain History',path: '/admin/domain-history', icon: Globe,           roles: ['admin', 'super_admin'] },
  { label: 'Reports',       path: '/admin/reports',        icon: BarChart3,       roles: ['admin', 'super_admin'] },
  { label: 'Activity Logs', path: '/admin/activity-logs',  icon: ClipboardList,   roles: ['admin', 'super_admin'] },
  { label: 'Login History', path: '/admin/login-history',  icon: LogIn,           roles: ['admin', 'super_admin'] },
  { label: 'System Health', path: '/admin/system-health',  icon: Activity,        roles: ['admin', 'super_admin'] },
  { label: 'Settings',      path: '/admin/settings',       icon: Settings,        roles: ['super_admin'] },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#f59e0b',
  admin: '#6366f1',
  user: '#10b981',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'User',
};

export default function AdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = currentUser?.role ?? 'user';
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '0 0 16px 0',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 16px' : '20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
        minHeight: 72,
      }}>
        <DragonLogo size={36} />
        {!collapsed && (
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
              ChronoSentinel
            </div>
            <div style={{ color: '#8b5cf6', fontSize: 11, fontWeight: 600 }}>Admin Panel</div>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {visibleNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: collapsed ? '11px 12px' : '11px 14px',
              borderRadius: 10, marginBottom: 4,
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
              transition: 'all 0.15s',
              color: isActive ? '#e2e8f0' : '#64748b',
              background: isActive
                ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))'
                : 'transparent',
              borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
              justifyContent: collapsed ? 'center' : 'flex-start',
            })}
          >
            <item.icon size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Info + Logout */}
      <div style={{
        padding: '12px 10px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {!collapsed && currentUser && (
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: 12, padding: '12px 14px',
            marginBottom: 8,
          }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {currentUser.full_name}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: `${ROLE_COLORS[role]}20`,
              color: ROLE_COLORS[role],
              border: `1px solid ${ROLE_COLORS[role]}40`,
            }}>
              {ROLE_LABELS[role]}
            </div>
          </div>
        )}

        <button
          id="admin-logout-btn"
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: 12, padding: collapsed ? '11px 12px' : '11px 14px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 10, background: 'none',
            border: 'none', cursor: 'pointer', color: '#64748b',
            fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          <LogOut size={18} />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#060b14',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 40, display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <aside
          className="mobile-sidebar animate-in slide-in-from-left duration-200"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 240,
            height: '100vh',
            background: 'rgba(10,14,26,0.98)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            zIndex: 45,
            display: 'none',
          }}
        >
          <SidebarContent />
        </aside>
      )}

      {/* Desktop Sidebar Container */}
      <div
        className="desktop-sidebar"
        style={{
          width: collapsed ? 64 : 240, flexShrink: 0,
          position: 'sticky', top: 0, height: '100vh',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 30,
        }}
      >
        {/* Actual Sidebar Panel with hidden overflow */}
        <aside
          style={{
            width: '100%', height: '100%',
            background: 'rgba(10,14,26,0.98)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <SidebarContent />
        </aside>

        {/* Collapse toggle */}
        <button
          id="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', right: -12, top: 80,
            width: 24, height: 24, borderRadius: '50%',
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#64748b', zIndex: 50,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1';
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header style={{
          height: 64, padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(10,14,26,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setMobileOpen(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#64748b', display: 'none', padding: 6,
              }}
              className="mobile-menu-btn"
            >
              <Menu size={20} />
            </button>
            <div style={{ color: '#334155', fontSize: 13 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NotificationDropdown />
            {currentUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {currentUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="admin-user-info" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                    {currentUser.username}
                  </span>
                  <span style={{ color: ROLE_COLORS[role], fontSize: 11, fontWeight: 500 }}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }} className="admin-main-content">
          <Outlet />
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .admin-main-content { padding: 24px; }
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .mobile-overlay { display: block !important; }
          .desktop-sidebar { display: none !important; }
          .mobile-sidebar { display: block !important; }
          .admin-main-content { padding: 14px !important; }
          .admin-user-info { display: none !important; }
        }
        @media (max-width: 480px) {
          .admin-main-content { padding: 10px !important; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 3px; }
      `}</style>
    </div>
  );
}
