import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { IndianRupee, CheckCircle2, Clock, TrendingUp, Users, XCircle, Filter, BarChart3, X } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { vivifiApplicationsColumn, vivifiLoansColumn } from '../../../components/TableHeader';
import { getVivifiApplications, getVivifiLoans } from '../../../api-services/Modules/VivifiWebhook';

const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// ---------------------------------------------------------------------------
// Filter persistence
//
// Every panel keeps its filters in the URL query string, so they survive both a
// page reload AND a Back from the lead-detail page (the detail's Back button is
// navigate(-1), which restores this exact URL). Each panel namespaces its params
// with a prefix, so the Applications and Loans tabs never inherit each other's
// status — their status vocabularies are different.
//
// Writes use replace:true so tweaking a filter doesn't pile up history entries
// the user would then have to Back through one by one; the list page keeps a
// single entry holding the latest filters.
// ---------------------------------------------------------------------------
const DEFAULT_LIMIT = 10;

const readQuery = (sp, prefix) => ({
  page_no: Math.max(parseInt(sp.get(`${prefix}page`), 10) || 1, 1),
  limit: Math.max(parseInt(sp.get(`${prefix}size`), 10) || DEFAULT_LIMIT, 1),
  search: sp.get(`${prefix}q`) || '',
  type: sp.get(`${prefix}type`) || '',
  startDate: sp.get(`${prefix}from`) || null,
  endDate: sp.get(`${prefix}to`) || null,
  status: sp.get(`${prefix}status`) || '',
});

// Mirror a query object back into the params, dropping anything still at its
// default so the URL stays short and readable.
const writeQuery = (sp, prefix, q) => {
  const put = (key, value, isDefault) => {
    const k = `${prefix}${key}`;
    if (isDefault) sp.delete(k); else sp.set(k, String(value));
  };
  put('page', q.page_no, !q.page_no || q.page_no === 1);
  put('size', q.limit, !q.limit || q.limit === DEFAULT_LIMIT);
  put('q', q.search, !q.search);
  put('type', q.type, !q.type);
  put('from', q.startDate, !q.startDate);
  put('to', q.endDate, !q.endDate);
  put('status', q.status, !q.status);
  return sp;
};

// Drop-in replacement for useState({...filters}) that reads/writes the URL.
// Memoized on the param STRING (not the URLSearchParams object) so `query` keeps
// a stable identity between renders — otherwise the fetch effect would loop.
const useUrlQuery = (prefix) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const query = useMemo(() => readQuery(new URLSearchParams(search), prefix), [search, prefix]);
  const setQuery = useCallback((updater) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      const next = typeof updater === 'function' ? updater(readQuery(sp, prefix)) : updater;
      return writeQuery(sp, prefix, next);
    }, { replace: true });
  }, [setSearchParams, prefix]);
  return [query, setQuery];
};

// CSV export helpers. Every value is quoted/escaped so commas, quotes and newlines in
// the data (e.g. a multi-line rejection reason) can't break the column layout; a BOM
// is prepended so Excel opens it as UTF-8. Each column is { header, value: (row) => … }.
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename, cols, rows) => {
  const head = cols.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((r) => cols.map((c) => csvEscape(c.value(r))).join(',')).join('\n');
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// The backend caps perPage at 200 (clampPaging), so a single fetch would SILENTLY
// truncate a large export. Page through in 200-row chunks until we've pulled `total`
// (or a chunk comes back short). The 200-page backstop (40k rows) only guards a bad
// total — Vivifi's webhook data is far smaller. `fetcher` is getVivifiApplications /
// getVivifiLoans; `baseParams` carries the active filters (no perPage/currentPage).
const fetchAllVivifi = async (fetcher, baseParams) => {
  const PAGE = 200;
  const rows = [];
  for (let page = 1; page <= 200; page += 1) {
    const res = await fetcher({ ...baseParams, perPage: PAGE, currentPage: page });
    const chunk = res?.data?.data?.data || [];
    rows.push(...chunk);
    const total = res?.data?.data?.pagination?.total ?? rows.length;
    if (chunk.length < PAGE || rows.length >= total) break;
  }
  return rows;
};

// Clickable stage chip — click to filter the table by that status, click again to clear.
const StageChip = ({ label, count, active, onClick, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  };
  const activeCls = 'ring-2 ring-purple-400 ring-offset-1';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${tones[tone] || tones.gray} ${active ? activeCls : ''}`}
    >
      <span>{label}</span>
      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-white/70 text-[11px] font-bold">{count}</span>
    </button>
  );
};

const toneForStatus = (s) => {
  const t = String(s || '').toLowerCase();
  if (/disburs|approved|success|complete|active/.test(t)) return 'green';
  if (/reject|declin|fail|cancel|expire/.test(t)) return 'red';
  if (/pending|await|progress|review|initiat|process|vkyc|esign|sign/.test(t)) return 'amber';
  return 'gray';
};

// ---------------------------------------------------------------------------
// Application pipeline analytics
//
// The Applications view is a CURRENT-STATE snapshot: every lead sits in exactly
// one status. Ordering those statuses along Vivifi's real journey turns that flat
// list into a pipeline, and reading it cumulatively from the end ("how many are at
// this stage or past it") gives a genuine conversion funnel with drop-off.
//
// That cumulative reading assumes leads only move FORWARD through the journey —
// true for this flow, but it's an inference from the snapshot, not something the
// webhook tells us directly, so the UI labels it as "reached".
// ---------------------------------------------------------------------------
const PIPELINE_ORDER = [
  'Waiting for documents',
  'Documents under review',
  'Awaiting VKYC',
  'Awaiting Esign',
  'Awaiting EMandate',
  'Pending For Disbursal',
  'Disbursed',
];

const isTerminalReject = (s) => /reject|declin|cancel|expire|fail/i.test(String(s || ''));

// Position a status on the journey. Anything unrecognised lands just before
// Disbursed rather than after it, so a new Vivifi status can't silently inflate
// the disbursed figure.
const stageRank = (s) => {
  const i = PIPELINE_ORDER.findIndex((x) => x.toLowerCase() === String(s || '').toLowerCase());
  return i >= 0 ? i : PIPELINE_ORDER.length - 1.5;
};

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (n, d) => `${pct(n, d).toFixed(1)}%`;

// Build the ordered pipeline + the cumulative "reached" figure for each stage.
const buildPipeline = (byStatus = []) => {
  const rows = byStatus
    .filter((s) => !isTerminalReject(s.status))
    .map((s) => ({ status: s.status || 'Unknown', count: Number(s.count) || 0 }))
    .sort((a, b) => stageRank(a.status) - stageRank(b.status));

  // Walk backwards accumulating, so `reached` = this stage + everything after it.
  let running = 0;
  const withReached = [...rows].reverse().map((r) => {
    running += r.count;
    return { ...r, reached: running };
  }).reverse();

  return { rows: withReached, inPipeline: running };
};

const ApplicationsAnalytics = ({ summary, activeStatus, onPick }) => {
  const byStatus = useMemo(() => summary?.byStatus || [], [summary]);
  const total = Number(summary?.total) || 0;

  const { rows, inPipeline } = useMemo(() => buildPipeline(byStatus), [byStatus]);

  const disbursed = byStatus.find((s) => /disburs/i.test(s.status) && !/pending/i.test(s.status));
  const disbursedCount = Number(disbursed?.count) || 0;
  const rejectedCount = byStatus
    .filter((s) => isTerminalReject(s.status))
    .reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  const inProgress = Math.max(inPipeline - disbursedCount, 0);

  // Widest stage drives the bar scale, so the biggest bucket fills the track.
  const peak = rows.reduce((m, r) => Math.max(m, r.count), 0);

  if (!total) return null;

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-3">
        <KpiCard icon={Users} tone="purple" label="Total Applications" value={total.toLocaleString('en-IN')} sub="all leads received" />
        <KpiCard icon={Clock} tone="amber" label="In Progress" value={inProgress.toLocaleString('en-IN')} sub={`${fmtPct(inProgress, total)} still moving`} />
        <KpiCard icon={CheckCircle2} tone="green" label="Disbursed" value={disbursedCount.toLocaleString('en-IN')} sub={`${fmtPct(disbursedCount, total)} conversion`} />
        <KpiCard icon={XCircle} tone="blue" label="Rejected" value={rejectedCount.toLocaleString('en-IN')} sub={`${fmtPct(rejectedCount, total)} of all leads`} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-3 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-purple-600" />
            <h3 className="text-[13px] font-bold text-gray-800">Application Pipeline</h3>
          </div>
          <p className="text-[11.5px] text-gray-500">
            <span className="font-semibold text-gray-700">{inPipeline.toLocaleString('en-IN')}</span> in pipeline ·{' '}
            <span className="font-semibold text-emerald-600">{fmtPct(disbursedCount, inPipeline)}</span> reach disbursal
          </p>
        </div>

        <div className="space-y-1.5">
          {rows.map((r) => {
            const active = activeStatus === r.status;
            return (
              <button
                key={r.status}
                onClick={() => onPick(r.status)}
                className={`w-full grid grid-cols-[minmax(140px,1.4fr)_minmax(0,3fr)_auto] items-center gap-3 px-2 py-1.5 rounded-lg text-left transition ${active ? 'bg-purple-50 ring-1 ring-purple-200' : 'hover:bg-gray-50'}`}
                title={`Filter by ${r.status}`}
              >
                <span className={`text-[12px] font-semibold truncate ${active ? 'text-purple-700' : 'text-gray-700'}`}>
                  {r.status}
                </span>

                <span className="relative h-[18px] rounded-md bg-gray-100 overflow-hidden">
                  {/* Faint track = how many reached this stage; solid = still sitting here. */}
                  <span
                    className="absolute inset-y-0 left-0 bg-purple-100"
                    style={{ width: `${pct(r.reached, inPipeline)}%` }}
                  />
                  <span
                    className={`absolute inset-y-0 left-0 rounded-md ${/disburs/i.test(r.status) ? 'bg-emerald-500' : 'bg-purple-500'}`}
                    style={{ width: `${peak ? pct(r.count, peak) : 0}%` }}
                  />
                </span>

                <span className="flex items-center gap-2.5 justify-end tabular-nums">
                  <span className="text-[12.5px] font-bold text-gray-800 min-w-[38px] text-right">
                    {r.count.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-gray-400 min-w-[42px] text-right">{fmtPct(r.count, inPipeline)}</span>
                  <span className="text-[11px] text-gray-500 min-w-[74px] text-right">
                    reached <span className="font-semibold text-gray-700">{r.reached.toLocaleString('en-IN')}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 text-[10.5px] text-gray-400">
          Solid bar = leads currently at that stage. Faint bar = leads that reached it or moved past
          (inferred from the snapshot, assuming forward-only progression). Click a row to filter the table.
        </p>
      </div>
    </>
  );
};

// The analysis sits behind a button rather than on the page: it's a stop-and-read
// view, not something you need while scanning the table. Picking a stage inside it
// filters the table and closes, so the click lands you back on the data.
const AnalyticsModal = ({ open, onClose, summary, activeStatus, onPick }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const hasData = Number(summary?.total) > 0;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-gray-900/50 backdrop-blur-sm px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Application analysis"
    >
      <div
        className="w-full max-w-4xl max-h-full overflow-y-auto rounded-2xl bg-gray-50 shadow-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <BarChart3 size={17} className="text-purple-600" />
            <h2 className="text-[14px] font-bold text-gray-800">Application Analysis</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {hasData ? (
            <ApplicationsAnalytics summary={summary} activeStatus={activeStatus} onPick={onPick} />
          ) : (
            <p className="py-12 text-center text-sm text-gray-400 italic">No applications to analyse yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub, tone = 'purple' }) => {
  const tones = {
    purple: 'from-purple-500 to-indigo-500',
    green: 'from-emerald-500 to-green-500',
    amber: 'from-amber-500 to-orange-500',
    blue: 'from-sky-500 to-blue-500',
  };
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200/80 rounded-xl px-4 py-3 shadow-sm min-w-[180px]">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tones[tone]} grid place-items-center text-white shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
        {sub ? <p className="text-[11px] text-gray-400 truncate">{sub}</p> : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Applications panel — current-state snapshot (one row per lead).
// ---------------------------------------------------------------------------
const ApplicationsPanel = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, byStatus: [] });
  const [loading, setLoading] = useState(false);
  // Filters live in the URL (?a_status=…&a_page=…) so they survive reload / Back.
  const [query, setQuery] = useUrlQuery('a_');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVivifiApplications({
        search: query.search,
        perPage: query.limit,
        currentPage: query.page_no,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (res?.data?.success) {
        setRows(res.data.data?.data || []);
        setTotal(res.data.data?.pagination?.total || 0);
        setSummary(res.data.data?.summary || { total: 0, byStatus: [] });
      } else {
        ToastNotification.error('Failed to fetch applications');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onPageChange = useCallback((p) => {
    setQuery((prev) => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  }, [setQuery]);
  const onSearch = useCallback((term) => setQuery((prev) => ({ ...prev, search: term, page_no: 1 })), [setQuery]);
  const onFilterByDate = useCallback((type) => setQuery((prev) => ({
    ...prev, type: prev.type === type ? '' : type, startDate: null, endDate: null, page_no: 1,
  })), [setQuery]);
  const onFilterByRange = useCallback((range) => setQuery((prev) => ({
    ...prev, startDate: range.startDate, endDate: range.endDate, type: '', page_no: 1,
  })), [setQuery]);
  const toggleStatus = useCallback((s) => setQuery((prev) => ({
    ...prev, status: prev.status === s ? '' : s, page_no: 1,
  })), [setQuery]);

  // Pipeline analysis lives in a modal — see AnalyticsModal.
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Export ALL rows matching the current filters (not just the visible page):
  // re-run the same query with perPage = total, then build the CSV client-side.
  const handleExport = useCallback(async () => {
    try {
      const all = await fetchAllVivifi(getVivifiApplications, {
        search: query.search,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (!all.length) { ToastNotification.error('No rows to export'); return; }
      downloadCsv(`vivifi_applications_${Date.now()}.csv`, [
        { header: 'Lead ID', value: (r) => r.leadId },
        { header: 'Name', value: (r) => r.name },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Status', value: (r) => r.status },
        { header: 'Rejection Reason', value: (r) => r.rejectionReason },
        { header: 'Updated At', value: (r) => r.updatedAt },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (lead) => {
    navigate(`/vivifi-webhook-leads/${encodeURIComponent(lead.leadId)}`, { state: { lead, kind: 'application' } });
  };

  return (
    <>
      {/* Stage chips (dynamic statuses) — click to filter */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Stages:</span>
        <StageChip label="All" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
        {(summary.byStatus || []).map((s) => (
          <StageChip
            key={s.status}
            label={s.status || 'Unknown'}
            count={s.count}
            active={query.status === s.status}
            onClick={() => toggleStatus(s.status)}
            tone={toneForStatus(s.status)}
          />
        ))}
        {summary.byStatus?.length === 0 && (
          <span className="text-sm text-gray-400 italic">No applications yet</span>
        )}

        {/* Opens the pipeline analysis. ml-auto keeps it pinned right however
            many stage chips wrap onto the row. */}
        <button
          onClick={() => setAnalyticsOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 hover:border-purple-300 transition"
          title="View pipeline analysis"
        >
          <BarChart3 size={14} />
          Analysis
        </button>
      </div>

      <AnalyticsModal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        summary={summary}
        activeStatus={query.status}
        // Picking a stage filters the table, then closes so the result is visible.
        onPick={(s) => { toggleStatus(s); setAnalyticsOpen(false); }}
      />

      <MainTable
        columns={vivifiApplicationsColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        title="VIVIFI · APPLICATIONS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        // Seed the table's own page/search from the URL so a reload or a Back
        // from the detail page lands on the same page with the same search term.
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Loans panel — current-state disbursal snapshot + KPIs.
// ---------------------------------------------------------------------------
const LoansPanel = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  // Filters live in the URL (?l_status=…&l_page=…) so they survive reload / Back.
  const [query, setQuery] = useUrlQuery('l_');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVivifiLoans({
        search: query.search,
        perPage: query.limit,
        currentPage: query.page_no,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (res?.data?.success) {
        setRows(res.data.data?.data || []);
        setTotal(res.data.data?.pagination?.total || 0);
        setSummary(res.data.data?.summary || {});
      } else {
        ToastNotification.error('Failed to fetch loans');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch loans');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onPageChange = useCallback((p) => {
    setQuery((prev) => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  }, [setQuery]);
  const onSearch = useCallback((term) => setQuery((prev) => ({ ...prev, search: term, page_no: 1 })), [setQuery]);
  const onFilterByDate = useCallback((type) => setQuery((prev) => ({
    ...prev, type: prev.type === type ? '' : type, startDate: null, endDate: null, page_no: 1,
  })), [setQuery]);
  const onFilterByRange = useCallback((range) => setQuery((prev) => ({
    ...prev, startDate: range.startDate, endDate: range.endDate, type: '', page_no: 1,
  })), [setQuery]);
  const toggleStatus = useCallback((s) => setQuery((prev) => ({
    ...prev, status: prev.status === s ? '' : s, page_no: 1,
  })), [setQuery]);

  // Export ALL loan rows matching the current filters (see ApplicationsPanel note).
  const handleExport = useCallback(async () => {
    try {
      const all = await fetchAllVivifi(getVivifiLoans, {
        search: query.search,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (!all.length) { ToastNotification.error('No rows to export'); return; }
      downloadCsv(`vivifi_loans_${Date.now()}.csv`, [
        { header: 'Lead ID', value: (r) => r.leadId },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Status', value: (r) => r.status },
        { header: 'Amount', value: (r) => r.amount },
        { header: 'Disbursed', value: (r) => r.disbursalAmount },
        { header: 'Disbursal Date', value: (r) => r.disbursalDate },
        { header: 'Updated At', value: (r) => r.updatedAt },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (lead) => {
    navigate(`/vivifi-webhook-leads/${encodeURIComponent(lead.leadId)}`, { state: { lead, kind: 'loan' } });
  };

  return (
    <>
      {/* KPI cards */}
      <div className="flex flex-wrap gap-3 mb-3">
        <KpiCard icon={IndianRupee} tone="green" label="Disbursed (This Month)" value={inr(summary.disbursedAmountThisMonth)} sub={`${summary.disbursedCountThisMonth || 0} loans`} />
        <KpiCard icon={TrendingUp} tone="purple" label="Total Disbursed" value={inr(summary.disbursedAmount)} sub={`${summary.disbursedCount || 0} loans`} />
        <KpiCard icon={Clock} tone="amber" label="Pending Disbursal" value={summary.pendingCount || 0} sub="not yet disbursed" />
        <KpiCard icon={CheckCircle2} tone="blue" label="Avg Ticket" value={inr(Math.round(summary.avgTicket || 0))} sub="per disbursed loan" />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Status:</span>
        <StageChip label="All" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
        {(summary.byStatus || []).map((s) => (
          <StageChip
            key={s.status}
            label={s.status || 'Unknown'}
            count={s.count}
            active={query.status === s.status}
            onClick={() => toggleStatus(s.status)}
            tone={toneForStatus(s.status)}
          />
        ))}
        {(!summary.byStatus || summary.byStatus.length === 0) && (
          <span className="text-sm text-gray-400 italic">No loans yet</span>
        )}
      </div>

      <MainTable
        columns={vivifiLoansColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        title="VIVIFI · LOANS (DISBURSAL)"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        // Seed the table's own page/search from the URL so a reload or a Back
        // from the detail page lands on the same page with the same search term.
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Module shell — tab switcher.
// ---------------------------------------------------------------------------
const VivifiWebhookLeads = () => {
  const tabs = [
    { key: 'applications', label: 'Applications' },
    { key: 'loans', label: 'Loans (Disbursal)' },
  ];

  // The open tab rides in the URL too — otherwise a reload (or Back from a loan's
  // detail page) would drop the user on Applications with their Loans filters
  // still in the URL but invisible. 'applications' is the default, so it's the
  // absence of the param rather than a value.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'loans' ? 'loans' : 'applications';
  const setActiveTab = useCallback((key) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (key === 'loans') sp.set('tab', 'loans'); else sp.delete('tab');
      return sp;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <>
      <Toaster />

      <div className="rounded-lg px-1 mb-3">
        <div className="flex space-x-8 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative pb-2 text-sm font-semibold transition-colors ${activeTab === tab.key ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'}`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute left-0 -bottom-[1px] h-0.5 w-full bg-indigo-600 rounded" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'applications' ? <ApplicationsPanel /> : <LoansPanel />}

      <ModuleInfoCard
        title="Vivifi Webhook Leads"
        subtitle="Live FlexSalary (Vivifi) webhook data — current application & loan state, with the full event history per lead."
        whatYouSee={[
          'Applications tab: the current status of every lead (one row each), plus a rejection reason where rejected.',
          'Loans tab: disbursal view — amount, disbursal date/amount, and KPIs (disbursed this month, total disbursed, pending, avg ticket).',
          'Click the eye icon on any lead to open its full webhook event timeline (what FlexSalary sent and when).',
          'Stage/status chips are clickable — click one to filter the table to that status.',
        ]}
        dataSource={[
          'ClickHouse webhook_data DB. Applications/Loans are ReplacingMergeTree snapshots (read with FINAL = latest row per lead).',
          'The lead timeline reads webhook_events — an append-only diary of every event received (never overwritten).',
          'Amounts and dates are stored in IST; disbursal figures come straight from the LOAN_STATUS events.',
        ]}
        flow={[
          'FlexSalary sends a webhook',
          'Event appended to webhook_events',
          'Applications / Loans snapshot updated',
          'Snapshot shown in the tabs',
          'Eye → full event timeline',
        ]}
      />
    </>
  );
};

export default VivifiWebhookLeads;
