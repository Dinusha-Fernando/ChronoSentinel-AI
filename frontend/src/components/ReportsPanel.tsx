import { Download, FileJson, FileSpreadsheet, Printer } from 'lucide-react';
import { DomainAnalysisResponse } from '../types';

interface ReportsPanelProps {
  data: DomainAnalysisResponse | null;
}

export default function ReportsPanel({ data }: ReportsPanelProps) {
  if (!data) {
    return (
      <div className="glass-panel p-8 text-center text-slate-500 text-sm">
        Please perform a target scan first to download or compile reports.
      </div>
    );
  }

  // Trigger browser print dialog for direct PDF formatting
  const handlePrint = () => {
    window.print();
  };

  // Build and download raw JSON
  const handleDownloadJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `dhr_report_${data.domain}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Build and download formatted CSV log of snapshots
  const handleDownloadCSV = () => {
    const headers = ['Timestamp', 'URL', 'Status Code', 'MIME Type', 'Risk Score', 'Detected Language', 'Primary Category'];
    const rows = (data.snapshots || []).map(s => [
      s.timestamp,
      s.original_url,
      s.status_code ?? 200,
      s.mime_type ?? 'text/html',
      s.risk_score,
      s.detected_language ?? 'en',
      s.content_category ?? 'safe'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const csvString = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvString);
    downloadAnchor.setAttribute('download', `dhr_history_${data.domain}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-lg font-bold">Report Compilation Ledger</h3>
        <p className="text-slate-400 text-xs mt-0.5 font-medium">
          Export full security assessments, timeline captures, and reputation logs
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* JSON Exporter */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/20 hover:border-slate-700/50 hover:bg-slate-900/10 flex flex-col justify-between space-y-4 group transition-all">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">API Integration</span>
              <FileJson size={16} className="text-indigo-400" />
            </div>
            <h4 className="text-sm font-extrabold text-white mt-2">Export RAW JSON</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              Obtain the full nested schema log including detector flags, confidence arrays, and threat indicators.
            </p>
          </div>
          <button
            onClick={handleDownloadJSON}
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 border border-slate-850 hover:border-slate-700 bg-slate-900/40 text-xs text-white font-extrabold rounded-lg transition-colors group-hover:bg-slate-900"
          >
            <Download size={12} />
            <span>Download JSON</span>
          </button>
        </div>

        {/* CSV Exporter */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/20 hover:border-slate-700/50 hover:bg-slate-900/10 flex flex-col justify-between space-y-4 group transition-all">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">Data Analytics</span>
              <FileSpreadsheet size={16} className="text-emerald-400" />
            </div>
            <h4 className="text-sm font-extrabold text-white mt-2">Export CSV Log</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              A flat tabular output mapping snapshot date stamps, status codes, risk ratings, and language categories.
            </p>
          </div>
          <button
            onClick={handleDownloadCSV}
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 border border-slate-850 hover:border-slate-700 bg-slate-900/40 text-xs text-white font-extrabold rounded-lg transition-colors group-hover:bg-slate-900"
          >
            <Download size={12} />
            <span>Download CSV</span>
          </button>
        </div>

        {/* PDF Guide */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/20 hover:border-slate-700/50 hover:bg-slate-900/10 flex flex-col justify-between space-y-4 group transition-all">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">Executive Summary</span>
              <Printer size={16} className="text-rose-400" />
            </div>
            <h4 className="text-sm font-extrabold text-white mt-2">Save PDF Summary</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              Generate a printable compliance summary report matching clean branding layout and design cards.
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 border border-slate-850 hover:border-slate-700 bg-slate-900/40 text-xs text-white font-extrabold rounded-lg transition-colors group-hover:bg-slate-900"
          >
            <Printer size={12} />
            <span>Open Print Options</span>
          </button>
        </div>

      </div>
    </div>
  );
}
