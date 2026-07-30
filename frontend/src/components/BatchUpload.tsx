import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Play, RefreshCw, Loader2, ArrowUpRight, ShieldAlert, Eye, Tag, FileSearch, RotateCcw } from 'lucide-react';
import { apiService } from '../services/api';

interface BatchUploadProps {
  onScanDomain?: (domain: string) => void;
  loadedJob?: any;
  onJobCompleted?: (run: any) => void;
}

export default function BatchUpload({ onScanDomain, loadedJob, onJobCompleted }: BatchUploadProps) {
  const [inputText, setInputText] = useState('');

  // Persistent state using localStorage to survive tab switching (unmounting)
  const [taskInfo, setTaskInfo] = useState<{ id: string; msg: string } | null>(() => {
    const saved = localStorage.getItem('dhr_batch_task_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [taskStatus, setTaskStatus] = useState<string>(() => {
    return localStorage.getItem('dhr_batch_task_status') || '';
  });
  const [taskResults, setTaskResults] = useState<any[]>(() => {
    const saved = localStorage.getItem('dhr_batch_task_results');
    return saved ? JSON.parse(saved) : [];
  });
  const [submittedDomains, setSubmittedDomains] = useState<string[]>(() => {
    const saved = localStorage.getItem('dhr_batch_submitted_domains');
    return saved ? JSON.parse(saved) : [];
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load selected history run when clicked from parent dashboard
  useEffect(() => {
    if (loadedJob) {
      setTaskInfo({ id: loadedJob.id, msg: 'Loaded from history.' });
      setTaskStatus(loadedJob.status);
      setTaskResults(loadedJob.results);
      setSubmittedDomains(loadedJob.domains);
      setError(loadedJob.error || '');
    }
  }, [loadedJob]);

  const terminalStatuses = useMemo(() => new Set(['SUCCESS', 'FAILURE', 'REVOKED']), []);
  const isBatchRunning = submitting || Boolean(taskInfo?.id && !terminalStatuses.has(taskStatus));
  const showBatchActivity = submitting || Boolean(taskInfo && !terminalStatuses.has(taskStatus));
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (taskStatus === 'SUCCESS') {
      setProgressPercent(100);
      return;
    }

    if (!isBatchRunning) {
      setProgressPercent(0);
      return;
    }

    setProgressPercent(prev => Math.max(prev || 0, submitting ? 8 : 18));
    const progressTimer = window.setInterval(() => {
      setProgressPercent(prev => {
        const next = prev + (prev < 55 ? 7 : prev < 82 ? 3 : 1);
        return Math.min(next, 92);
      });
    }, 900);

    return () => window.clearInterval(progressTimer);
  }, [isBatchRunning, submitting, taskStatus]);

  // Sync state changes with localStorage
  useEffect(() => {
    if (taskInfo) {
      localStorage.setItem('dhr_batch_task_info', JSON.stringify(taskInfo));
    } else {
      localStorage.removeItem('dhr_batch_task_info');
    }
  }, [taskInfo]);

  useEffect(() => {
    if (taskStatus) {
      localStorage.setItem('dhr_batch_task_status', taskStatus);
    } else {
      localStorage.removeItem('dhr_batch_task_status');
    }
  }, [taskStatus]);

  useEffect(() => {
    if (taskResults && taskResults.length > 0) {
      localStorage.setItem('dhr_batch_task_results', JSON.stringify(taskResults));
    } else {
      localStorage.removeItem('dhr_batch_task_results');
    }
  }, [taskResults]);

  useEffect(() => {
    if (submittedDomains && submittedDomains.length > 0) {
      localStorage.setItem('dhr_batch_submitted_domains', JSON.stringify(submittedDomains));
    } else {
      localStorage.removeItem('dhr_batch_submitted_domains');
    }
  }, [submittedDomains]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Clear previous state and localStorage
    setTaskInfo(null);
    setTaskStatus('');
    setTaskResults([]);
    setSubmittedDomains([]);
    localStorage.removeItem('dhr_batch_task_info');
    localStorage.removeItem('dhr_batch_task_status');
    localStorage.removeItem('dhr_batch_task_results');
    localStorage.removeItem('dhr_batch_submitted_domains');

    const domains = inputText
      .split(/[\n,]/)
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);

    if (domains.length === 0) {
      setError('Please list at least one valid target web domain.');
      setSubmitting(false);
      return;
    }

    try {
      setSubmittedDomains(domains);
      const response = await apiService.bulkAnalyze(domains);
      setTaskInfo({
        id: response.task_id,
        msg: response.message || 'Analysis successfully queued.'
      });
      setTaskStatus('PENDING');
      setInputText('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to trigger background Celery batch analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let intervalId: any;

    const checkStatus = async () => {
      if (!taskInfo?.id) return;
      try {
        const response = await apiService.getTaskStatus(taskInfo.id);
        setTaskStatus(response.status);
        if (response.status === 'SUCCESS' && response.result) {
          setTaskResults(response.result);

          // Notify parent on completion to append to history
          onJobCompleted?.({
            id: taskInfo.id,
            timestamp: new Date().toISOString(),
            domains: submittedDomains,
            status: 'SUCCESS',
            results: response.result,
            error: null
          });

          clearInterval(intervalId);
        } else if (response.status === 'FAILURE') {
          const errorMsg = response.error || 'Background task failed.';
          setError(errorMsg);

          // Notify parent on failure to append to history
          onJobCompleted?.({
            id: taskInfo.id,
            timestamp: new Date().toISOString(),
            domains: submittedDomains,
            status: 'FAILURE',
            results: [],
            error: errorMsg
          });

          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Error polling task status:', err);
      }
    };

    if (taskInfo?.id && taskStatus !== 'SUCCESS' && taskStatus !== 'FAILURE') {
      checkStatus();
      intervalId = setInterval(checkStatus, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [taskInfo?.id, taskStatus, submittedDomains]);

  const getRiskColor = (level: string): string => {
    if (level === 'HIGH') return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
    if (level === 'MEDIUM') return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
  };

  const getCategoryColor = (cat: string): string => {
    const cleanCat = (cat || '').toLowerCase().replace(/_/g, ' ');
    if (cleanCat.includes('gambling')) return 'text-purple-300 bg-purple-500/10 border-purple-500/20';
    if (cleanCat.includes('adult')) return 'text-pink-300 bg-pink-500/10 border-pink-500/20';
    if (cleanCat.includes('phishing') || cleanCat.includes('scam')) return 'text-rose-300 bg-rose-500/10 border-rose-500/20';
    if (cleanCat.includes('hacking') || cleanCat.includes('malware')) return 'text-red-300 bg-red-500/10 border-red-500/20';
    if (cleanCat.includes('safe')) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    return 'text-slate-300 bg-slate-700/30 border-slate-600/30';
  };

  // Compute successfully analyzed domains and failed ones
  const successfulResults = taskResults.filter(r => r.status !== 'failed');
  const failedResultsMap = new Map<string, string>(
    taskResults.filter(r => r.status === 'failed').map(r => [r.domain.toLowerCase(), r.error || r.risk_narrative || 'Failed to fetch Wayback CDX or live site'])
  );

  const successfulDomains = new Set(successfulResults.map(r => r.domain.toLowerCase()));
  const failedDomains = submittedDomains.filter(d => !successfulDomains.has(d.toLowerCase()));

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-lg font-bold">Celery Batch Processing</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-medium">
          Queue multiple targets for background workers to scrape Wayback CDX and run audits
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 block mb-2">
            Target Domain List (One per line, or comma-separated)
          </label>
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (taskStatus === 'SUCCESS' || taskStatus === 'FAILURE' || taskInfo) {
                setTaskInfo(null);
                setTaskStatus('');
                setTaskResults([]);
                setSubmittedDomains([]);
                setError('');
              }
            }}
            disabled={isBatchRunning}
            placeholder="example.com&#10;anotherdomain.org&#10;gambling-test-site.net"
            className="w-full h-40 bg-slate-950/60 border border-slate-800 text-xs text-white font-mono rounded-xl p-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 resize-none transition-all placeholder-slate-700"
          />
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-400 bg-rose-500/10 p-3 border border-rose-500/20 rounded-lg">
            ⚠️ {error}
          </p>
        )}

        {showBatchActivity && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-extrabold">
                <Loader2 size={16} className="animate-spin" />
                <span>{submitting ? 'Queueing batch analysis...' : 'Checking domains with Celery workers...'}</span>
              </div>
              <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                {submitting ? 'QUEUEING' : taskStatus || 'QUEUED'}
              </span>
            </div>

            <p className="text-slate-300 font-medium">
              {taskInfo?.msg || 'Submitting targets to the background worker queue.'}
            </p>

            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>Batch progress</span>
                <span>{submittedDomains.length} target{submittedDomains.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {submittedDomains.slice(0, 6).map((domain) => (
                  <div key={domain} className="flex items-center gap-2 rounded-md border border-slate-800/80 bg-slate-900/40 px-2.5 py-2">
                    <Loader2 size={12} className="shrink-0 animate-spin text-emerald-400" />
                    <span className="truncate font-mono text-[10px] text-slate-300">{domain}</span>
                  </div>
                ))}
              </div>
              {submittedDomains.length > 6 && (
                <p className="text-[10px] text-slate-500">
                  {submittedDomains.length - 6} more target{submittedDomains.length - 6 !== 1 ? 's' : ''} still in the batch queue.
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                {submitting
                  ? 'Sending the batch to Celery. The worker check will begin as soon as the task is accepted.'
                  : 'Waiting for the worker to finish the full check. Results will appear here automatically.'}
              </p>
            </div>

            <div className="flex justify-between gap-3 font-mono text-[10px] text-slate-500 pt-1 border-t border-slate-900">
              <span>Celery Task ID:</span>
              <span className="text-slate-400 truncate">{taskInfo?.id || 'Waiting for queue response'}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isBatchRunning || !inputText.trim()}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800/80 text-xs text-white font-bold rounded-xl shadow-lg transition-all"
        >
          {submitting ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Queueing Job...</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>Trigger Background Workers</span>
            </>
          )}
        </button>
      </form>

      {taskStatus === 'SUCCESS' && (
        <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
          <h4 className="text-sm font-bold text-emerald-400 flex items-center">
            <CheckCircle2 size={16} className="mr-2" />
            Batch Analysis Complete
          </h4>

          {successfulResults.length > 0 && (
            <div className="space-y-4">
              {successfulResults.map((result, idx) => {
                const flags: string[] = result.flags || [];
                const categoryConf: Record<string, number> = result.category_confidence || {};
                const primaryCat: string = result.primary_category || '';
                const narrative: string = result.risk_narrative || '';
                const snapshotsChecked: number = result.snapshots_checked || 0;
                const evidence = result.evidence_snapshot;
                const noContent = flags.length === 0 && !primaryCat;

                const apiBase = (import.meta.env.VITE_API_URL as string) || '/api/v1';
                const batchProxyUrl = evidence ? `${apiBase}/domains/proxy-snapshot?timestamp=${evidence.timestamp}&url=${encodeURIComponent(evidence.original_url || result.domain)}` : '';
                const batchDirectUrl = evidence ? `https://web.archive.org/web/${evidence.timestamp}/${evidence.original_url || result.domain}` : '';

                return (
                  <div key={idx} className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 hover:border-slate-700 transition-all">

                    {/* Header row: domain + risk badge + score */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">{result.domain}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Eye size={11} className="text-slate-500 flex-shrink-0" />
                          <span className="text-[10px] text-slate-500 font-mono">
                            {snapshotsChecked} snapshot{snapshotsChecked !== 1 ? 's' : ''} inspected
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono text-xs text-slate-400">{result.risk_score}/100</span>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-extrabold border ${getRiskColor(result.risk_level)}`}>
                          {result.risk_level}
                        </span>
                      </div>
                    </div>

                    {/* Content Category Flags */}
                    {flags.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <ShieldAlert size={11} className="text-slate-500" />
                          <span className="text-[9px] uppercase tracking-widest font-extrabold text-slate-500">Detected Content</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {flags.map((cat, cidx) => (
                            <span key={cidx} className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryColor(cat)}`}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category keyword hit scores */}
                    {Object.keys(categoryConf).length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Tag size={11} className="text-slate-500" />
                          <span className="text-[9px] uppercase tracking-widest font-extrabold text-slate-500">Keyword Hits</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.entries(categoryConf)
                            .filter(([, v]) => v > 0)
                            .sort(([, a], [, b]) => b - a)
                            .map(([cat, score], kidx) => (
                              <div key={kidx} className="flex items-center justify-between bg-slate-950/60 rounded-lg px-2.5 py-1.5 border border-slate-800">
                                <span className="text-[10px] text-slate-400 font-medium truncate">{cat}</span>
                                <span className={`text-[10px] font-extrabold ml-2 ${score > 5 ? 'text-rose-400' : score > 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                                  {score}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Primary AI Category */}
                    {primaryCat && (
                      <div className="flex items-center gap-2">
                        <FileSearch size={11} className="text-slate-500 flex-shrink-0" />
                        <span className="text-[9px] uppercase tracking-widest font-extrabold text-slate-500">AI Classifier:</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryColor(primaryCat)}`}>{primaryCat}</span>
                      </div>
                    )}

                    {/* Safe / no flags */}
                    {noContent && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 size={13} />
                        <span className="text-xs font-semibold">No harmful content detected in historical snapshots</span>
                      </div>
                    )}

                    {/* Visual Evidence */}
                    {evidence && (
                      <div className="space-y-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="block text-[9px] uppercase tracking-widest font-extrabold text-rose-300">Unsafe Snapshot Evidence (Proxied)</span>
                            <span className="text-[10px] text-slate-400 font-mono">Score: {evidence.risk_score}/100</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <a
                              href={batchProxyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-200 hover:text-white"
                            >
                              Open Proxied <ArrowUpRight size={11} />
                            </a>
                            <span className="text-slate-700">|</span>
                            <a
                              href={batchDirectUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white"
                              title="Requires VPN if your network blocks archive.org"
                            >
                              Open Direct <ArrowUpRight size={11} />
                            </a>
                          </div>
                        </div>
                        <div className="h-36 overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                          <iframe
                            src={batchProxyUrl}
                            title={`Evidence preview for ${result.domain}`}
                            sandbox="allow-scripts"
                            className="h-full w-full bg-white"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}

                    {/* AI narrative */}
                    {narrative && (
                      <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                        {narrative}
                      </p>
                    )}

                    {/* View in single scanner */}
                    {onScanDomain && (
                      <div className="flex justify-end border-t border-slate-800/60 pt-3">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); onScanDomain(result.domain); }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-[10px] font-bold rounded-lg border border-violet-500/20 transition-colors"
                        >
                          <span>Deep Scan</span>
                          <ArrowUpRight size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {failedDomains.length > 0 && (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-rose-400 block">⚠️ Failed to Analyze ({failedDomains.length} domain{failedDomains.length !== 1 ? 's' : ''})</span>
                <button
                  type="button"
                  onClick={() => {
                    setInputText(failedDomains.join('\n'));
                    setTaskInfo(null);
                    setTaskStatus('');
                    setTaskResults([]);
                    setSubmittedDomains([]);
                    setError('');
                  }}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Retry Failed Domains</span>
                </button>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                The following domains could not be fetched from the Wayback Machine. This usually happens if the domain has no historical archives, or if the Wayback Machine CDX API is currently rate-limiting queries.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {failedDomains.map((domain, idx) => {
                  const errorReason = failedResultsMap.get(domain.toLowerCase());
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                      <span className="font-mono text-slate-200 text-[11px] font-semibold">{domain}</span>
                      {errorReason && (
                        <span className="text-[10px] text-rose-400/90 font-mono truncate max-w-sm">{errorReason}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
