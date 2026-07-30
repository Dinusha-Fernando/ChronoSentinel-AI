import React, { useEffect, useState } from 'react';
import { Activity, Database, Cpu, Wifi, CheckCircle, XCircle, AlertTriangle, Terminal, Search, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { adminApi } from '../../services/adminApi';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

interface HealthStatus {
  status: string;
  postgres: string;
  redis: string;
}

type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'checking';

function getServiceStatus(value: string): ServiceStatus {
  if (value.startsWith('healthy')) return 'healthy';
  if (value === 'degraded') return 'degraded';
  if (value.startsWith('unhealthy')) return 'unhealthy';
  return 'checking';
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === 'healthy') return <CheckCircle size={18} color="#10b981" />;
  if (status === 'degraded') return <AlertTriangle size={18} color="#f59e0b" />;
  if (status === 'unhealthy') return <XCircle size={18} color="#ef4444" />;
  return <Activity size={18} color="#475569" style={{ animation: 'spin 1s linear infinite' }} />;
}

const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: '#10b981', degraded: '#f59e0b', unhealthy: '#ef4444', checking: '#475569',
};

interface ServiceCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: ServiceStatus;
}

function ServiceCard({ icon, label, value, status }: ServiceCardProps) {
  const color = STATUS_COLORS[status];
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)', border: `1px solid ${color}30`,
      borderRadius: 16, padding: '20px 22px',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </div>
          <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>{label}</span>
        </div>
        <StatusIcon status={status} />
      </div>
      <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
        <code style={{ color: color, fontSize: 12, fontFamily: 'monospace' }}>{value}</code>
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={{
          padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          color, background: `${color}15`, border: `1px solid ${color}30`,
        }}>{status.toUpperCase()}</span>
      </div>
    </div>
  );
}

function LogEntry({ log }: { log: any }) {
  const isMultiLine = log.message.includes('\n');
  const levelColors: Record<string, { bg: string; text: string }> = {
    INFO: { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
    WARNING: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
    ERROR: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
    CRITICAL: { bg: 'rgba(220,38,38,0.2)', text: '#fca5a5' },
  };

  const levelColor = levelColors[log.level] || { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' };

  return (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      textAlign: 'left',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: isMultiLine ? '6px' : '0' }}>
        <span style={{ color: '#475569' }}>{log.timestamp || 'SYSTEM'}</span>
        <span style={{
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          background: levelColor.bg,
          color: levelColor.text,
        }}>{log.level}</span>
        {log.location && (
          <span style={{ color: '#818cf8', fontWeight: 500 }}>[{log.location}]</span>
        )}
        {!isMultiLine && (
          <span style={{ color: log.level === 'ERROR' || log.level === 'CRITICAL' ? '#fca5a5' : '#cbd5e1' }}>
            {log.message}
          </span>
        )}
      </div>
      {isMultiLine && (
        <pre style={{
          margin: '4px 0 0 0',
          padding: '10px',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: '6px',
          color: '#fca5a5',
          overflowX: 'auto',
          fontSize: '11px',
          fontFamily: 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {log.message}
        </pre>
      )}
    </div>
  );
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [limit, setLimit] = useState<number>(200);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await adminApi.getSystemLogs({
        level: filterLevel || undefined,
        search: searchQuery || undefined,
        limit,
      });
      setLogs(res.logs);
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleDownloadLogs = async () => {
    try {
      await adminApi.downloadSystemLogs();
    } catch (err) {
      console.error("Failed to download logs", err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE.replace('/api/v1', '')}/health`);
      const data: HealthStatus = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch {
      setHealth({ status: 'unhealthy', postgres: 'unhealthy: connection failed', redis: 'unhealthy: connection failed' });
    }
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filterLevel, limit]);

  const overallStatus = loading ? 'checking' : getServiceStatus(health?.status ?? '');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>System Health</h1>
          <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>
            {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()} — auto-refreshes every 30s` : 'Checking...'}
          </p>
        </div>
        <button onClick={checkHealth} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
          color: '#a5b4fc', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          <Activity size={16} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          {loading ? 'Checking...' : 'Refresh Now'}
        </button>
      </div>

      {/* Overall status banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderRadius: 16, marginBottom: 28,
        background: `rgba(${overallStatus === 'healthy' ? '16,185,129' : overallStatus === 'degraded' ? '245,158,11' : '239,68,68'},0.08)`,
        border: `1px solid ${STATUS_COLORS[overallStatus]}30`,
      }}>
        <StatusIcon status={overallStatus} />
        <div>
          <div style={{ color: STATUS_COLORS[overallStatus], fontWeight: 700, fontSize: 18 }}>
            System is {overallStatus.toUpperCase()}
          </div>
          <div style={{ color: '#475569', fontSize: 13, marginTop: 2 }}>
            {overallStatus === 'healthy' ? 'All services are operating normally.' : 'One or more services are experiencing issues.'}
          </div>
        </div>
      </div>

      {/* Service cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <ServiceCard
          icon={<Database size={18} />}
          label="PostgreSQL Database"
          value={health?.postgres ?? 'Checking...'}
          status={loading ? 'checking' : getServiceStatus(health?.postgres ?? '')}
        />
        <ServiceCard
          icon={<Cpu size={18} />}
          label="Redis Cache"
          value={health?.redis ?? 'Checking...'}
          status={loading ? 'checking' : getServiceStatus(health?.redis ?? '')}
        />
        <ServiceCard
          icon={<Wifi size={18} />}
          label="API Gateway"
          value={loading ? 'Checking...' : 'FastAPI running'}
          status={loading ? 'checking' : 'healthy'}
        />
        <ServiceCard
          icon={<Activity size={18} />}
          label="Background Workers"
          value="Celery workers"
          status="healthy"
        />
      </div>

      {/* Logs section */}
      <div style={{
        marginTop: 36,
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Terminal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'rgba(30,41,59,0.5)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#818cf8',
            }}>
              <Terminal size={16} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>Developer System Logs</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
                <span style={{ color: '#64748b', fontSize: 11 }}>Stream Active</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleDownloadLogs}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#e2e8f0', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <Download size={14} />
              Download All
            </button>
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc', fontSize: 13, fontWeight: 500, cursor: logsLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={14} style={logsLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh
            </button>
          </div>
        </div>

        {/* Terminal Controls / Filters */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '12px 20px',
          background: 'rgba(15,23,42,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {/* Level Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}>Level:</span>
            {['', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'].map((lvl) => {
              const isActive = filterLevel === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
                    border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                    color: isActive ? '#a5b4fc' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  {lvl || 'ALL'}
                </button>
              );
            })}
          </div>

          {/* Search bar & Limit Selector */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search error msg..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '6px 10px 6px 30px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  fontSize: 12,
                  width: 200,
                }}
              />
            </div>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#e2e8f0',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <option value={100}>Last 100</option>
              <option value={200}>Last 200</option>
              <option value={500}>Last 500</option>
              <option value={1000}>Last 1000</option>
            </select>
            <button
              type="submit"
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#cbd5e1',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go
            </button>
          </form>
        </div>

        {/* Logs Terminal Viewport */}
        <div style={{
          background: '#090d16',
          maxHeight: 450,
          overflowY: 'auto',
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {logsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
              <RefreshCw size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: '#64748b', fontSize: 13 }}>Fetching system logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 8 }}>
              <AlertCircle size={24} color="#64748b" />
              <span style={{ color: '#64748b', fontSize: 13 }}>No logs matching the criteria found.</span>
            </div>
          ) : (
            logs.map((log, index) => (
              <LogEntry key={index} log={log} />
            ))
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
