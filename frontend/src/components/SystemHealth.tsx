import { useEffect, useState } from 'react';
import { Database, HardDrive, RefreshCw, Activity } from 'lucide-react';
import { apiService } from '../services/api';
import { SystemStatus } from '../types';

export default function SystemHealth() {
  const [health, setHealth] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await apiService.getHealth();
      setHealth(data);
    } catch (err) {
      console.error('Failed to query health logs:', err);
      setHealth({
        status: 'degraded',
        postgres: 'unhealthy: service connection refused',
        redis: 'unhealthy: connection timeout',
      });
    } finally {
      setLoading(false);
      setRefreshedAt(new Date());
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto refresh every 30 seconds
    const iv = setInterval(fetchHealth, 30000);
    return () => clearInterval(iv);
  }, []);

  const getStatusColor = (status: string) => {
    if (status.toLowerCase().includes('healthy') || status.toLowerCase() === 'ok') {
      return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    }
    return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
  };


  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">System Health & Telemetry</h3>
          <p className="text-slate-400 text-xs mt-0.5 font-medium">
            Live environment status checking and infrastructure pipeline telemetry
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-xs text-slate-300 font-bold rounded-lg transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Force Ping</span>
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PostgreSQL */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3.5 ${getStatusColor(health?.postgres || '')}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">PostgreSQL Feed</span>
            <Database size={16} />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">Postgres Database</span>
            <span className="text-[11px] font-mono leading-relaxed block mt-1 break-all">
              {health?.postgres || 'Checking...'}
            </span>
          </div>
        </div>

        {/* Redis cache */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3.5 ${getStatusColor(health?.redis || '')}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Redis Cache</span>
            <HardDrive size={16} />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">Redis Key-Value</span>
            <span className="text-[11px] font-mono leading-relaxed block mt-1 break-all">
              {health?.redis || 'Checking...'}
            </span>
          </div>
        </div>

        {/* Global Cluster state */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3.5 ${getStatusColor(health?.status || '')}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Global Cluster</span>
            <Activity size={16} />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">Overall System State</span>
            <span className="text-[11px] font-mono leading-relaxed block mt-1 uppercase tracking-wider font-extrabold">
              {health?.status || 'Degraded'}
            </span>
          </div>
        </div>
      </div>


      <div className="text-right text-[10px] text-slate-500 font-medium">
        Last queried: {refreshedAt.toLocaleTimeString()}
      </div>
    </div>
  );
}
