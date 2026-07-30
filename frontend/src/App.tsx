import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import DomainInput from './components/DomainInput';
import RiskSummary from './components/RiskSummary';
import SnapshotTimeline from './components/SnapshotTimeline';
import TimelineView from './components/TimelineView';
import ThreatIntelPanel from './components/ThreatIntelPanel';
import ExplainabilityCard from './components/ExplainabilityCard';
import DetectorSummary from './components/DetectorSummary';
import IntelligencePanel from './components/IntelligencePanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SystemHealth from './components/SystemHealth';
import ReportsPanel from './components/ReportsPanel';
import BatchUpload from './components/BatchUpload';
import UniqueDomainLoader from './components/UniqueDomainLoader';

// Admin Dashboard
import LoginPage from './pages/LoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminRoute from './pages/admin/AdminRoute';
import DashboardHome from './pages/admin/DashboardHome';
import UsersPage from './pages/admin/UsersPage';
import DomainHistoryPage from './pages/admin/DomainHistoryPage';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';
import LoginHistoryPage from './pages/admin/LoginHistoryPage';
import ReportsPage from './pages/admin/ReportsPage';
import SystemHealthPage from './pages/admin/SystemHealthPage';
import SettingsPage from './pages/admin/SettingsPage';

import { useAuth } from './contexts/AuthContext';
import { apiService } from './services/api';
import { DomainAnalysisResponse, GlobalStats, Snapshot } from './types';
import { BarChart3, Database, ShieldAlert, ArrowUpRight, X, Eye, User as UserIcon } from 'lucide-react';

const DEFAULT_STATS: GlobalStats = {
  total_analyzed: 0,
  risk_breakdown: { SAFE: 0, MEDIUM: 0, HIGH: 0 },
  recent_domains: [],
};

/** Existing scan app — wrapped as its own route at / **/
function ScanApp() {
  const [activeTab, setActiveTab] = useState<string>('scan');
  const [activeData, setActiveData] = useState<DomainAnalysisResponse | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [autoLoadedDomain, setAutoLoadedDomain] = useState<string | null>(null);
  const [stats, setStats] = useState<GlobalStats>(DEFAULT_STATS);
  const [timelineModalOpen, setTimelineModalOpen] = useState<boolean>(false);
  const [threatIntelModalOpen, setThreatIntelModalOpen] = useState<boolean>(false);
  const [batchHistory, setBatchHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('dhr_batch_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedBatchJob, setSelectedBatchJob] = useState<any | null>(null);
  const [inspectedBatchDomain, setInspectedBatchDomain] = useState<string | null>(null);
  const [activeScanningDomain, setActiveScanningDomain] = useState<string>('');

  const handleJobCompleted = (newEntry: any) => {
    setBatchHistory(prev => {
      if (prev.some(item => item.id === newEntry.id)) return prev;
      const updated = [newEntry, ...prev].slice(0, 10);
      localStorage.setItem('dhr_batch_history', JSON.stringify(updated));
      return updated;
    });
  };

  const fetchStats = async () => {
    try {
      const data = await apiService.getStats();
      setStats({
        total_analyzed: data?.total_analyzed ?? 0,
        risk_breakdown: {
          ...DEFAULT_STATS.risk_breakdown,
          ...(data?.risk_breakdown ?? {}),
        },
        recent_domains: data?.recent_domains ?? [],
      });
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleScanDomain = async (domain: string, forceRefresh: boolean) => {
    setLoading(true);
    setError('');
    setActiveScanningDomain(domain);
    setActiveSnapshot(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const result = await apiService.analyzeDomain(domain, forceRefresh);
      setActiveData(result);
      setInspectedBatchDomain(result.domain);
      if (result.snapshots && result.snapshots.length > 0) {
        // Default to the first (earliest) snapshot
        setActiveSnapshot(result.snapshots[0]);
      }
      await fetchStats();
    } catch (err: unknown) {
      console.error(err);
      const errMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        'An unexpected error occurred during domain risk scanning. Please check your backend connection.';
      setError(errMsg);
      setActiveData(null);
      setInspectedBatchDomain(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const needsAnalysisData = timelineModalOpen || threatIntelModalOpen;
    const latestDomain = stats.recent_domains?.[0]?.domain;

    if (needsAnalysisData && !activeData && !loading && latestDomain && autoLoadedDomain !== latestDomain) {
      setAutoLoadedDomain(latestDomain);
      handleScanDomain(latestDomain, false);
    }
  }, [timelineModalOpen, threatIntelModalOpen, activeData, autoLoadedDomain, loading, stats.recent_domains]);

  // Smooth scroll to batch inspection dashboard when a target is loaded/selected
  useEffect(() => {
    if (activeTab === 'batch' && inspectedBatchDomain && activeData && activeData.domain.toLowerCase() === inspectedBatchDomain.toLowerCase()) {
      const el = document.getElementById('batch-inspection-section');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [inspectedBatchDomain, activeData, activeTab]);

  const getRiskColor = (level: string): string => {
    if (level === 'HIGH' || level === 'UNSAFE') return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
    if (level === 'MEDIUM') return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    if (level === 'UNKNOWN') return 'text-violet-400 border-violet-500/20 bg-violet-500/5';
    return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
  };

  // Helper to update the selected snapshot detail card.
  const handleSelectSnapshot = (snap: Snapshot) => {
    setActiveSnapshot(snap);
  };

  return (
    <div className="min-h-screen pb-16 flex flex-col bg-slate-950">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className={`flex-1 w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 transition-all duration-300 ${
        activeTab === 'batch' ? 'max-w-[1600px] lg:px-4' : 'max-w-7xl'
      }`}>
        
        {/* Render Tab Contents */}
        {activeTab === 'scan' && (
          <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-8">
              <DomainInput onScan={handleScanDomain} loading={loading} />

              {error && (
                <div className="p-4 border border-rose-500/20 bg-rose-500/5 text-rose-400 rounded-xl text-sm flex items-start space-x-3">
                  <ShieldAlert className="shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="font-bold">Scan Process Interrupted</h4>
                    <p className="mt-1 text-xs text-rose-400/90 leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              {/* Unique Cyber Domain Loader */}
              {loading && (
                <UniqueDomainLoader targetDomain={activeScanningDomain || inspectedBatchDomain || 'Target Domain'} />
              )}

              {/* Active Result View */}
              {activeData && !loading && (
                <div className="space-y-8">
                  <RiskSummary data={activeData} />

                  {/* Quick Navigation Panels */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setTimelineModalOpen(true)}
                      className="flex items-center justify-between p-4 rounded-xl border border-violet-500/20 bg-slate-900/30 hover:bg-violet-950/10 hover:border-violet-500/50 hover:shadow-[0_0_12px_rgba(139,92,246,0.1)] hover:scale-[1.01] transition-all duration-200 group text-left cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-white group-hover:text-violet-300 transition-colors block text-sm">
                          History Timeline
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Inspect chronological archive captures
                        </span>
                      </div>
                      <ArrowUpRight size={18} className="text-violet-400 group-hover:text-white transition-colors" />
                    </button>

                    <button
                      onClick={() => setThreatIntelModalOpen(true)}
                      className="flex items-center justify-between p-4 rounded-xl border border-brand-500/20 bg-slate-900/30 hover:bg-brand-950/10 hover:border-brand-500/50 hover:shadow-[0_0_12px_rgba(124,58,237,0.1)] hover:scale-[1.01] transition-all duration-200 group text-left cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-white group-hover:text-brand-300 transition-colors block text-sm">
                          Reputation Feeds
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Check external threat database listings
                        </span>
                      </div>
                      <ArrowUpRight size={18} className="text-brand-400 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!activeData && !loading && !error && (
                <div className="glass-panel p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="p-4 bg-brand-500/5 border border-brand-500/10 text-brand-400 rounded-full">
                    <Database size={32} className="opacity-80" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-lg font-bold text-white">Awaiting Scan Target</h3>
                    <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                      Enter a target web domain above to inspect historical data points. The engine will retrieve
                      snapshots from the Wayback Archive to run rule-based content audits.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-8 lg:col-span-1">
              {/* Global Statistics Panel */}
              <div className="glass-panel p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <BarChart3 size={16} className="mr-2 text-violet-400" />
                    Global System Stats
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">
                    Live DB
                  </span>
                </div>

                <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl text-center">
                  <span className="text-3xl font-extrabold text-white block">{stats.total_analyzed}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1 block">
                    Domains in Database
                  </span>
                </div>

                <div className="space-y-3.5 pt-2">
                  <h4 className="text-xs font-semibold text-slate-400">Risk Profile Distribution</h4>

                  {(['SAFE', 'MEDIUM', 'HIGH'] as const).map((level) => {
                    const colors: Record<'SAFE' | 'MEDIUM' | 'HIGH', { label: string; bar: string; text: string }> = {
                      SAFE: { label: 'Safe Domains', bar: 'bg-emerald-500', text: 'text-emerald-400' },
                      MEDIUM: { label: 'Medium Risk', bar: 'bg-amber-500', text: 'text-amber-400' },
                      HIGH: { label: 'High Risk', bar: 'bg-rose-500', text: 'text-rose-400' },
                    };
                    const c = colors[level];
                    let count = stats.risk_breakdown?.[level] ?? 0;
                    if (level === 'HIGH') {
                      count += stats.risk_breakdown?.UNSAFE ?? 0;
                    }
                    const totalAnalyzed = stats.total_analyzed ?? 0;
                    const pct = totalAnalyzed ? (count / totalAnalyzed) * 100 : 0;

                    return (
                      <div key={level} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className={c.text}>{c.label}</span>
                          <span className="text-slate-300 font-semibold">{count}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/40">
                          <div className={`${c.bar} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Domain Catalog Panel */}
              <div className="glass-panel p-6 space-y-4 h-[440px] flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Database Domains
                </h3>
                <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                  {Array.isArray(stats?.recent_domains) && stats.recent_domains.length > 0 ? (
                    stats.recent_domains.map((d, index) => (
                      <button
                        key={index}
                        onClick={() => handleScanDomain(d.domain, false)}
                        disabled={loading}
                        className="w-full flex items-center justify-between p-3 border border-slate-800 bg-slate-900/10 hover:bg-slate-900/35 hover:border-slate-700 rounded-xl transition-all text-left text-xs group"
                      >
                        <div className="space-y-1 text-left min-w-0 flex-1 pr-2">
                          <span className="font-bold text-white group-hover:text-brand-300 transition-colors block truncate">
                            {d.domain}
                          </span>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                            <span>Score: {d.risk_score}/100</span>
                            <span>•</span>
                            <span className="flex items-center text-slate-400 space-x-1" title={d.checked_by?.full_name || 'System / Anonymous'}>
                              <UserIcon size={10} className="text-brand-400 shrink-0" />
                              <span className="text-slate-300 truncate max-w-[110px]">
                                {d.checked_by?.username || (d.checked_by?.full_name ? d.checked_by.full_name.split(' ')[0] : 'System')}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-extrabold border ${getRiskColor(d.risk_level)}`}>
                            {d.risk_level}
                          </span>
                          <ArrowUpRight size={14} className="text-slate-500 group-hover:text-white transition-colors" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      No domains found in database
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Full-width analysis details below the grid */}
          {activeData && !loading && (
            <div className="space-y-8 mt-8">
              {activeData.risk_narrative && (
                <ExplainabilityCard data={activeData} />
              )}

              <SnapshotTimeline 
                snapshots={activeData.snapshots} 
                activeSnapshot={activeSnapshot}
                onSelectSnapshot={handleSelectSnapshot}
              />

              {/* Active Snapshot Telemetry Panel */}
              {activeSnapshot && (
                <div id="snapshot-details-section" className="space-y-8 pt-4 scroll-mt-20">
                  <div className="border-b border-slate-800 pb-3 text-left">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      Snapshot Telemetry: {activeSnapshot.timestamp.substring(0, 4)}-{activeSnapshot.timestamp.substring(4, 6)}-{activeSnapshot.timestamp.substring(6, 8)}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Scrutinizing metadata and structural elements for this Wayback Machine capture.
                    </p>
                  </div>

                  <div id="snapshot-intelligence-section" className="grid grid-cols-1 gap-8 scroll-mt-24">
                    <IntelligencePanel snapshot={activeSnapshot} />
                    {activeSnapshot.ai_intelligence?.detectors && (
                      <DetectorSummary
                        detectors={activeSnapshot.ai_intelligence.detectors}
                        detectorBoost={activeSnapshot.ai_intelligence.detector_boost}
                      />
                    )}
                  </div>
                </div>
              )}

              <ReportsPanel data={activeData} />
            </div>
          )}
          </div>
        )}



        {activeTab === 'analytics' && (
          <AnalyticsDashboard 
            stats={stats} 
            onScanDomain={(d) => {
              handleScanDomain(d, false);
              setActiveTab('scan');
            }} 
            loading={loading} 
          />
        )}

        {activeTab === 'batch' && (
          <div className="space-y-8 animate-fade-in">
            {/* TOP ROW: Batch Control Dashboard Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
              {/* Left side: Batch Scan History Column */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-panel p-5 space-y-4 h-[620px] flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Scan History
                    </h3>
                    {batchHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchHistory([]);
                          localStorage.removeItem('dhr_batch_history');
                          setSelectedBatchJob(null);
                        }}
                        className="text-[9px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {Array.isArray(batchHistory) && batchHistory.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                      {batchHistory.map((run, idx) => (
                        <div
                          key={idx}
                          className={`p-3 bg-slate-900/30 hover:bg-slate-900/60 border rounded-xl transition-all cursor-pointer group flex flex-col justify-between gap-2.5 ${
                            selectedBatchJob?.id === run.id ? 'border-brand-500 bg-brand-950/5' : 'border-slate-800/80 hover:border-slate-700'
                          }`}
                          onClick={() => setSelectedBatchJob(run)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[9px] font-bold text-white group-hover:text-brand-300 transition-colors">
                                Job #{run.id.substring(0, 8)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-extrabold border ${
                                run.status === 'SUCCESS' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'
                              }`}>
                                {run.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              {new Date(run.timestamp).toLocaleDateString()} at {new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/50">
                            <span className="font-medium">{run.domains.length} target(s)</span>
                            <span className="text-brand-400 group-hover:text-white font-bold flex items-center gap-1 transition-colors">
                              Load <ArrowUpRight size={10} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs flex-1 flex items-center justify-center">
                      No run history found
                    </div>
                  )}
                </div>
              </div>

              {/* Right side: Batch Upload Form & Active Job */}
              <div className="lg:col-span-3 space-y-6">
                <BatchUpload 
                  onScanDomain={(d) => {
                    handleScanDomain(d, false);
                  }} 
                  loadedJob={selectedBatchJob}
                  onJobCompleted={handleJobCompleted}
                />
              </div>
            </div>

            {/* BOTTOM ROW: Full-Width Target Inspection Dashboard */}
            {loading ? (
              <div id="batch-inspection-section" className="pt-8 border-t border-slate-900 scroll-mt-6">
                <UniqueDomainLoader targetDomain={activeScanningDomain || inspectedBatchDomain || 'Target Domain'} />
              </div>
            ) : (activeData && activeData.domain) ? (
              <div id="batch-inspection-section" className="pt-8 border-t border-slate-900 scroll-mt-6 space-y-8">
                <div className="space-y-8 animate-fade-in text-left">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
                        <span>Inspection Workspace: <span className="text-brand-400">{activeData.domain}</span></span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">Deep risk details loaded from bulk batch scan results</p>
                    </div>
                    {/* Button to quickly go to the main scanner tab */}
                    <button
                      onClick={() => setActiveTab('scan')}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Full View</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                  
                  <RiskSummary data={activeData} />
                  
                  {activeData.risk_narrative && (
                    <ExplainabilityCard data={activeData} />
                  )}

                  <SnapshotTimeline 
                    snapshots={activeData.snapshots} 
                    activeSnapshot={activeSnapshot}
                    onSelectSnapshot={handleSelectSnapshot}
                  />

                  {/* Active Snapshot Telemetry Panel */}
                  {activeSnapshot && (
                    <div className="space-y-6 pt-2">
                      <div className="border-b border-slate-800 pb-2.5">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Snapshot Detail: {activeSnapshot.timestamp.substring(0, 4)}-{activeSnapshot.timestamp.substring(4, 6)}-{activeSnapshot.timestamp.substring(6, 8)}
                        </h4>
                      </div>

                      <div id="snapshot-intelligence-section" className="grid grid-cols-1 gap-6 scroll-mt-24">
                        <IntelligencePanel snapshot={activeSnapshot} />
                        {activeSnapshot.ai_intelligence?.detectors && (
                          <DetectorSummary
                            detectors={activeSnapshot.ai_intelligence.detectors}
                            detectorBoost={activeSnapshot.ai_intelligence.detector_boost}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-8 border-t border-slate-900">
                <div className="glass-panel p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[250px]">
                  <div className="p-4 bg-brand-500/5 border border-brand-500/10 text-brand-400 rounded-full">
                    <Eye size={32} className="opacity-80 animate-pulse" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-base font-bold text-white">Awaiting Target Selection</h3>
                    <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                      Click the <strong className="text-violet-400 font-bold">Deep Scan</strong> button next to any domain in your batch run or history list above to inspect full analytics records.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'health' && (
          <div className="max-w-4xl mx-auto">
            <SystemHealth />
          </div>
        )}

      </main>

      {/* History Timeline Modal */}
      {timelineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl p-6 relative flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">History Timeline Audit</h3>
                <p className="text-xs text-slate-400 mt-0.5">Chronological overview of archive snapshots and risk telemetry</p>
              </div>
              <button
                onClick={() => setTimelineModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeData ? (
                <TimelineView 
                  timeline={activeData.timeline || null} 
                  snapshots={activeData.snapshots}
                  onSelectSnapshot={(snap) => {
                    handleSelectSnapshot(snap);
                    setTimelineModalOpen(false);
                  }}
                />
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No active scan target loaded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reputation Feeds Modal */}
      {threatIntelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl p-6 relative flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Reputation Feeds Panel</h3>
                <p className="text-xs text-slate-400 mt-0.5">Threat intel database entries and historical safety records</p>
              </div>
              <button
                onClick={() => setThreatIntelModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeData ? (
                <ThreatIntelPanel threatIntel={activeData.threat_intel || null} />
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No active scan target loaded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** Root App component with full routing **/
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Admin Dashboard */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="domain-history" element={<DomainHistoryPage />} />
        <Route path="activity-logs" element={<ActivityLogsPage />} />
        <Route path="login-history" element={<LoginHistoryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="system-health" element={<SystemHealthPage />} />
        <Route
          path="settings"
          element={
            <AdminRoute requireSuperAdmin>
              <SettingsPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Protected scan app */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ScanApp />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
