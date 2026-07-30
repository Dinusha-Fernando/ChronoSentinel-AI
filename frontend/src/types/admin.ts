// Admin Dashboard TypeScript type definitions

export type UserRole = 'super_admin' | 'admin' | 'user';
export type UserStatus = 'active' | 'suspended' | 'pending';
export type ScanSource = 'manual' | 'batch' | 'api' | 'anonymous';

// ── Auth ──────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface CurrentUser {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  last_login_at?: string;
  must_change_password: boolean;
}

// ── Users ─────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  failed_login_count: number;
  locked_until?: string;
  must_change_password: boolean;
  is_deleted: boolean;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserCreatePayload {
  full_name: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  status: UserStatus;
}

export interface UserUpdatePayload {
  full_name?: string;
  username?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
}

// ── Dashboard Stats ───────────────────────────────────────────────────────

export interface DayCount {
  date: string;
  count: number;
}

export interface DayLogins {
  date: string;
  logins: number;
}

export interface DomainCount {
  domain: string;
  count: number;
}

export interface DashboardStats {
  total_users: number;
  total_admins: number;
  total_super_admins: number;
  active_users: number;
  suspended_users: number;
  total_domains_checked: number;
  todays_checks: number;
  unsafe_domains: number;
  safe_domains: number;
  pending_checks: number;
  checks_per_day: DayCount[];
  safe_vs_unsafe: Record<string, number>;
  most_checked_domains: DomainCount[];
  users_activity: DayLogins[];
}

// ── Scan Records ──────────────────────────────────────────────────────────

export interface ScanRecord {
  id: number;
  domain_name: string;
  user_id?: number;
  username?: string;
  status: string;
  risk_score?: number;
  risk_level?: string;
  duration_ms?: number;
  source: ScanSource;
  wayback_status?: string;
  checked_at: string;
}

export interface ScanRecordList {
  records: ScanRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Activity Logs ─────────────────────────────────────────────────────────

export interface ActivityLog {
  id: number;
  user_id?: number;
  username_snapshot?: string;
  user_role_snapshot?: string;
  action: string;
  category?: string;
  severity?: string;
  object_type?: string;
  object_id?: string;
  object_label?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  browser?: string;
  os?: string;
  device?: string;
  endpoint?: string;
  execution_time_ms?: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export interface ActivityLogList {
  logs: ActivityLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SpecificUserActivitySummary {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  last_login_at?: string;
  last_active_at?: string;
  total_actions: number;
  total_scans: number;
  safe_domains_count: number;
  medium_domains_count: number;
  unsafe_domains_count: number;
  risk_breakdown: Record<string, number>;
  recent_ips: string[];
  top_categories: Record<string, number>;
  recent_scanned_domains: Array<{
    id: number;
    domain_name: string;
    status: string;
    risk_score?: number;
    risk_level: string;
    source: string;
    checked_at: string;
  }>;
  logs: ActivityLog[];
}

export interface ActiveUserSession {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  last_active_at: string;
  is_online: boolean;
  status_label: string;
  last_action?: string;
  last_endpoint?: string;
  last_ip?: string;
  last_browser?: string;
  total_scans: number;
  safe_scans: number;
  unsafe_scans: number;
}

export interface ActivityMetrics {
  total_events: number;
  success_rate_percent: number;
  categories_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
  top_active_users: Array<{ user_id: number; username: string; count: number }>;
  hourly_trend: Array<{ hour: string; count: number }>;
}

// ── Login History ─────────────────────────────────────────────────────────

export interface LoginHistoryRecord {
  id: number;
  user_id?: number;
  username_attempted: string;
  user_role_snapshot?: string;
  ip_address?: string;
  browser?: string;
  os?: string;
  country?: string;
  success: boolean;
  failure_reason?: string;
  login_at: string;
  logout_at?: string;
}

export interface LoginHistoryList {
  records: LoginHistoryRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Notifications ─────────────────────────────────────────────────────────

export interface AdminNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata_json?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: AdminNotification[];
  unread_count: number;
}

// ── System Settings ───────────────────────────────────────────────────────

export interface SystemSetting {
  id: number;
  key: string;
  value?: string;
  description?: string;
  category?: string;
  updated_at: string;
}

// ── Pagination ────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  page_size: number;
}
