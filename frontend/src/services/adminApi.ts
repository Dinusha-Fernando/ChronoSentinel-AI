/**
 * Admin API service — typed Axios instance with auto token refresh on 401.
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  UserListResponse, AdminUser, UserCreatePayload, UserUpdatePayload,
  DashboardStats, ScanRecordList, ActivityLogList, SpecificUserActivitySummary, ActiveUserSession, ActivityMetrics, LoginHistoryList,
  NotificationsResponse, SystemSetting, PaginationParams, AuthTokens,
} from '../types/admin';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
const STORAGE_KEYS = { ACCESS: 'cs_access_token', REFRESH: 'cs_refresh_token' };

const _http: AxiosInstance = axios.create({ baseURL: API_BASE });

// ── Request interceptor: attach Bearer token ──────────────────────────────
_http.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh on 401 ─────────────────────────────────
let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

_http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push((token) => {
            if (token) {
              original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
              resolve(_http(original));
            } else {
              reject(error);
            }
          });
        });
      }

      _isRefreshing = true;
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH);
      try {
        const { data } = await axios.post<AuthTokens>(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        localStorage.setItem(STORAGE_KEYS.ACCESS, data.access_token);
        localStorage.setItem(STORAGE_KEYS.REFRESH, data.refresh_token);
        _refreshQueue.forEach((cb) => cb(data.access_token));
        _refreshQueue = [];
        original.headers = { ...original.headers, Authorization: `Bearer ${data.access_token}` };
        return _http(original);
      } catch {
        _refreshQueue.forEach((cb) => cb(null));
        _refreshQueue = [];
        localStorage.removeItem(STORAGE_KEYS.ACCESS);
        localStorage.removeItem(STORAGE_KEYS.REFRESH);
        localStorage.removeItem('cs_current_user');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// ── Helpers ───────────────────────────────────────────────────────────────
type QueryParams = Record<string, string | number | boolean | undefined | null>;

function buildParams(params: QueryParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  }
  return out;
}

// ── Dashboard ─────────────────────────────────────────────────────────────
async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await _http.get<DashboardStats>('/admin/stats');
  return data;
}

// ── Users ─────────────────────────────────────────────────────────────────
async function getUsers(params: PaginationParams & {
  search?: string; role?: string; status?: string;
}): Promise<UserListResponse> {
  const { data } = await _http.get<UserListResponse>('/users', {
    params: buildParams(params as unknown as QueryParams),
  });
  return data;
}

async function createUser(payload: UserCreatePayload): Promise<AdminUser> {
  const { data } = await _http.post<AdminUser>('/users', payload);
  return data;
}

async function getUser(id: number): Promise<AdminUser> {
  const { data } = await _http.get<AdminUser>(`/users/${id}`);
  return data;
}

async function updateUser(id: number, payload: UserUpdatePayload): Promise<AdminUser> {
  const { data } = await _http.put<AdminUser>(`/users/${id}`, payload);
  return data;
}

async function deleteUser(id: number): Promise<void> {
  await _http.delete(`/users/${id}`);
}

async function suspendUser(id: number, reason?: string): Promise<AdminUser> {
  const { data } = await _http.post<AdminUser>(`/users/${id}/suspend`, { reason });
  return data;
}

async function activateUser(id: number): Promise<AdminUser> {
  const { data } = await _http.post<AdminUser>(`/users/${id}/activate`);
  return data;
}

async function resetPassword(id: number, payload: {
  new_password?: string; send_email?: boolean;
}): Promise<{ message: string; temp_password?: string }> {
  const { data } = await _http.post(`/users/${id}/reset-password`, payload);
  return data;
}

// ── Scan Records ──────────────────────────────────────────────────────────
async function getScanRecords(params: PaginationParams & {
  domain?: string; user_id?: number; risk_level?: string;
  date_from?: string; date_to?: string;
}): Promise<ScanRecordList> {
  const { data } = await _http.get<ScanRecordList>('/admin/scan-records', {
    params: buildParams(params as unknown as QueryParams),
  });
  return data;
}

// ── Activity Logs ─────────────────────────────────────────────────────────
async function getActivityLogs(params: PaginationParams & {
  user_id?: number; category?: string; severity?: string; action?: string; status?: string; search?: string; date_from?: string; date_to?: string;
}): Promise<ActivityLogList> {
  const { data } = await _http.get<ActivityLogList>('/admin/activity-logs', {
    params: buildParams(params as unknown as QueryParams),
  });
  return data;
}

async function getUserActivitySummary(userId: number): Promise<SpecificUserActivitySummary> {
  const { data } = await _http.get<SpecificUserActivitySummary>(`/admin/users/${userId}/activity-summary`);
  return data;
}

async function getActiveSessions(): Promise<ActiveUserSession[]> {
  const { data } = await _http.get<ActiveUserSession[]>('/admin/active-sessions');
  return data;
}

async function getActivityMetrics(): Promise<ActivityMetrics> {
  const { data } = await _http.get<ActivityMetrics>('/admin/activity-metrics');
  return data;
}

// ── Login History ─────────────────────────────────────────────────────────
async function getLoginHistory(params: PaginationParams & {
  user_id?: number; success?: boolean; role?: string; date_from?: string; date_to?: string;
}): Promise<LoginHistoryList> {
  const { data } = await _http.get<LoginHistoryList>('/admin/login-history', {
    params: buildParams(params as unknown as QueryParams),
  });
  return data;
}

// ── Notifications ─────────────────────────────────────────────────────────
async function getNotifications(unreadOnly = false): Promise<NotificationsResponse> {
  const { data } = await _http.get<NotificationsResponse>('/admin/notifications', {
    params: unreadOnly ? { unread_only: 'true' } : {},
  });
  return data;
}

async function markNotificationRead(id: number): Promise<void> {
  await _http.patch(`/admin/notifications/${id}/read`);
}

async function markAllNotificationsRead(): Promise<void> {
  await _http.patch('/admin/notifications/mark-all-read');
}

// ── System Settings ───────────────────────────────────────────────────────
async function getSettings(): Promise<SystemSetting[]> {
  const { data } = await _http.get<SystemSetting[]>('/admin/settings');
  return data;
}

async function updateSettings(settings: Record<string, string | null>): Promise<void> {
  await _http.put('/admin/settings', { settings });
}

// ── Export ────────────────────────────────────────────────────────────────
async function exportCSV(reportType: string, dateFrom?: string, dateTo?: string): Promise<void> {
  const params: QueryParams = { report_type: reportType };
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  const res = await _http.get('/admin/export/csv', { params: buildParams(params), responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Change Password ───────────────────────────────────────────────────────
async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
  await _http.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}

// ── System Logs ───────────────────────────────────────────────────────────
async function getSystemLogs(params: { level?: string; search?: string; limit?: number }): Promise<{ logs: any[] }> {
  const { data } = await _http.get<{ logs: any[] }>('/admin/system-logs', {
    params: buildParams(params as unknown as QueryParams),
  });
  return data;
}

async function downloadSystemLogs(): Promise<void> {
  const res = await _http.get('/admin/system-logs/download', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `system_logs_${new Date().toISOString().split('T')[0]}.log`;
  a.click();
  URL.revokeObjectURL(url);
}

export const adminApi = {
  getDashboardStats,
  getUsers, createUser, getUser, updateUser, deleteUser,
  suspendUser, activateUser, resetPassword,
  getScanRecords,
  getActivityLogs,
  getUserActivitySummary,
  getActiveSessions,
  getActivityMetrics,
  getLoginHistory,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getSettings, updateSettings,
  exportCSV,
  changePassword,
  getSystemLogs,
  downloadSystemLogs,
};
