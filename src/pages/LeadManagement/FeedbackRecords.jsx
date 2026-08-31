import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { Toaster } from 'react-hot-toast';
import {
  MessageSquare, Search, RefreshCw, ChevronLeft, ChevronRight, ChevronDown,
  Phone, Clock, UserRound, CalendarClock, PencilLine, Download,
} from 'lucide-react';
import { getFeedbackRecords, exportFeedbackRecords } from '../../api-services/Modules/Leads';
import { FEEDBACK_STATUSES } from '../../components/LeadFeedback/LeadFeedback';
import ToastNotification from '../../components/Notification/ToastNotification';
import ExportModal from '../../components/ExportModal';
import { useAuth } from '../../custom-hooks/useAuth';

const SCOPES = [
  { value: 'all',   label: 'All' },
  { value: 'high',  label: 'High Ticket' },
  { value: 'short', label: 'Short Ticket' },
];

// Medium / source filter options (call-center combines high + short traffic).
// QuickLoans = high-ticket own-traffic, EasyLoan = short-ticket own-traffic (both = NULL medium).
const FF_MEDIUMS = ['QuickLoans', 'EasyLoan', 'moneyview', 'meta', 'kreditbee', 'zype', 'SC', 'poonawalla', 'IDFC', 'hero', /* 'kisht', */ 'truebalance', 'ramfincorp', 'mpokket', 'creditplus', 'LendingPlate', 'incred', 'rapidmoney'];
const FF_SOURCES = ['google', 'google_ads'];

const STATUS_TONE = {
  'converted / disbursed':        'bg-emerald-50 text-emerald-700 border-emerald-200',
  'interested':                   'bg-purple-50 text-purple-700 border-purple-200',
  'call back later':              'bg-indigo-50 text-indigo-700 border-indigo-200',
  'documents pending':            'bg-blue-50 text-blue-700 border-blue-200',
  'not interested':               'bg-rose-50 text-rose-700 border-rose-200',
  'not eligible':                 'bg-rose-50 text-rose-700 border-rose-200',
  'already availed loan':         'bg-amber-50 text-amber-700 border-amber-200',
  'language barrier':             'bg-amber-50 text-amber-700 border-amber-200',
  'not connected':                'bg-gray-100 text-gray-600 border-gray-200',
  'wrong number':                 'bg-gray-100 text-gray-600 border-gray-200',
  'switched off / not reachable': 'bg-gray-100 text-gray-600 border-gray-200',
};
const tone = (s) => STATUS_TONE[String(s || '').toLowerCase().trim()] || 'bg-gray-50 text-gray-500 border-gray-200';

const fmtDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const keyOf = (r) => `${r.scope}:${r.phone}`;

const FeedbackRecords = ({ embedded = false, agent, minMonthlyIncome, maxMonthlyIncome, minLoanAmount }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super-admin';
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  // High ticket is the team's primary book — open on it instead of the blended
  // all-scope view. Both tabs default the same way so switching doesn't reset it.
  const [scope, setScope] = useState('high');
  const [status, setStatus] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const reqIdRef = useRef(0);
  const prevFilterKeyRef = useRef('');

  // page is passed explicitly so a request never races against a pending page reset.
  // The request-id guard drops any stale response, so out-of-order resolutions can't
  // overwrite the current page.
  const doFetch = useCallback(async (pageArg) => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      // "meta" → drop the salary/loan band so meta leads aren't income/loan-gated.
      const dropBand = String(utmMedium || '').toLowerCase() === 'meta';
      const params = { scope, page: pageArg, perPage };
      if (agent) params.agent = agent;
      if (!dropBand && minMonthlyIncome) params.minMonthlyIncome = minMonthlyIncome;
      if (!dropBand && maxMonthlyIncome) params.maxMonthlyIncome = maxMonthlyIncome;
      if (!dropBand && minLoanAmount) params.minLoanAmount = minLoanAmount;
      if (utmMedium) params.utmMedium = utmMedium;
      if (utmSource) params.utmSource = utmSource;
      if (status) params.status = status;
      if (search) params.search = search;
      if (fromDate && toDate && fromDate <= toDate) { params.fromDate = fromDate; params.toDate = toDate; }
      const res = await getFeedbackRecords(params);
      if (myId !== reqIdRef.current) return; // a newer request superseded this one
      if (res?.data?.success) {
        setRows(res.data.data || []);
        setPagination(res.data.pagination || { total: 0, totalPages: 0 });
      } else {
        ToastNotification.error('Could not load feedback records');
      }
    } catch (err) {
      if (myId !== reqIdRef.current) return;
      ToastNotification.error(err?.response?.data?.message || 'Could not load feedback records');
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [scope, status, search, fromDate, toDate, perPage, agent, minMonthlyIncome, maxMonthlyIncome, minLoanAmount, utmMedium, utmSource]);

  // Single source of fetching. A filter change first snaps back to page 1 (the
  // resulting page change re-runs this effect to issue ONE fetch); a page change
  // fetches directly. Avoids the double-fetch + stale-page overwrite.
  useEffect(() => {
    const filterKey = JSON.stringify({ scope, status, search, fromDate, toDate, utmMedium, utmSource });
    if (filterKey !== prevFilterKeyRef.current) {
      prevFilterKeyRef.current = filterKey;
      if (page !== 1) { setPage(1); return; }
    }
    doFetch(page);
  }, [scope, status, search, fromDate, toDate, page, doFetch, utmMedium, utmSource]);

  const submitSearch = () => setSearch(searchInput.trim());

  // Super-admin: download the current filtered feedback list as CSV.
  const handleExport = async () => {
    setExporting(true);
    try {
      const dropBand = String(utmMedium || '').toLowerCase() === 'meta';
      const params = { scope };
      if (agent) params.agent = agent;
      if (!dropBand && minMonthlyIncome) params.minMonthlyIncome = minMonthlyIncome;
      if (!dropBand && maxMonthlyIncome) params.maxMonthlyIncome = maxMonthlyIncome;
      if (!dropBand && minLoanAmount) params.minLoanAmount = minLoanAmount;
      if (utmMedium) params.utmMedium = utmMedium;
      if (utmSource) params.utmSource = utmSource;
      if (status) params.status = status;
      if (search) params.search = search;
      if (fromDate && toDate && fromDate <= toDate) { params.fromDate = fromDate; params.toDate = toDate; }
      const res = await exportFeedbackRecords(params);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `call_center_feedback_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      ToastNotification.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // OTP-gated entry point: the ExportModal verifies identity, then we run the
  // existing export, which already uses the page's current filters (scope, date,
  // medium/source, status, search, bands). No date is asked for again.
  const handleExportSubmit = async () => {
    await handleExport();
    setExportModalOpen(false);
  };

  const total = pagination.total || 0;
  const totalPages = pagination.totalPages || 0;

  return (
    <div className="w-full">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />

      {!embedded && (
        <div className="relative overflow-hidden rounded-2xl border border-purple-100 bg-white p-5 shadow-sm mb-4">
          <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500" />
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 text-white shadow-md">
              <MessageSquare size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Call-Center Feedback</h1>
              <p className="text-sm text-gray-400">Every high &amp; short ticket disposition — status, remark, schedule and full update history.</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Filters ─── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setScope(s.value);
                // QuickLoans = high-only, EasyLoan = short-only — clear a now-mismatched pick.
                if ((s.value === 'high' && utmMedium === 'EasyLoan') || (s.value === 'short' && utmMedium === 'QuickLoans')) setUtmMedium('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                scope === s.value ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          <option value="">All dispositions</option>
          {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__none__">Open (not contacted)</option>
        </select>

        <select
          value={utmMedium}
          onChange={(e) => setUtmMedium(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          <option value="">All Mediums</option>
          {FF_MEDIUMS
            .filter((m) => (m === 'QuickLoans' ? scope !== 'short' : m === 'EasyLoan' ? scope !== 'high' : true))
            .map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={utmSource}
          onChange={(e) => setUtmSource(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          <option value="">All Sources</option>
          {FF_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
            placeholder="Search phone…"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
          <button onClick={submitSearch} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100">
            <Search size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200" />
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setExportModalOpen(true)}
            disabled={exporting}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <Download size={13} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
        <button onClick={() => doFetch(page)} className={`${isSuperAdmin ? '' : 'ml-auto '}inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100`}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ─── Table ─── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-[12px] font-semibold text-gray-500">{total.toLocaleString('en-IN')} record{total === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-3 py-2.5 font-semibold">Ticket</th>
                <th className="px-3 py-2.5 font-semibold">Disposition</th>
                <th className="px-3 py-2.5 font-semibold">Remark</th>
                <th className="px-3 py-2.5 font-semibold">Next Action</th>
                <th className="px-3 py-2.5 font-semibold">Updated By</th>
                <th className="px-3 py-2.5 font-semibold">Last Updated</th>
                <th className="px-3 py-2.5 font-semibold text-center">History</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No feedback records match these filters.</td></tr>
              ) : rows.map((r) => {
                const k = keyOf(r);
                const isOpen = expanded === k;
                const log = Array.isArray(r.log) ? r.log : [];
                return (
                  <Fragment key={k}>
                    <tr className="border-b border-gray-50 hover:bg-purple-50/20 transition">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-gray-800">{r.name || 'Unknown'}</p>
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500"><Phone size={10} /> {r.phone}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold uppercase">{r.scope === 'short' ? 'Short' : 'High'}</span>
                      </td>
                      <td className="px-3 py-3">
                        {r.status
                          ? <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tone(r.status)}`}>{r.status}</span>
                          : <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">Open</span>}
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <p className="text-[12px] text-gray-600 truncate" title={r.remark || ''}>{r.remark || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        {r.next_action ? (
                          <div>
                            <p className="text-[12px] text-purple-700 font-medium inline-flex items-center gap-1"><CalendarClock size={11} /> {r.next_action}</p>
                            {r.next_action_at && <p className="text-[10px] text-gray-400">{fmtDateTime(r.next_action_at)}</p>}
                          </div>
                        ) : <span className="text-[12px] text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[12px] text-gray-600 inline-flex items-center gap-1"><UserRound size={11} className="text-gray-400" /> {r.updated_by || '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[12px] text-gray-500 inline-flex items-center gap-1"><Clock size={11} className="text-gray-400" /> {fmtDateTime(r.updatedAt)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setExpanded(isOpen ? null : k)}
                          disabled={log.length === 0}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {r.updates || 0} <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/40">
                        <td colSpan={8} className="px-6 py-4">
                          <ol className="relative space-y-3">
                            {log.map((e, i) => (
                              <li key={e.id || i} className="flex items-start gap-3">
                                <span className={`mt-0.5 grid place-items-center w-7 h-7 rounded-lg shrink-0 ${i === 0 ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' : 'bg-purple-50 text-purple-600'}`}>
                                  <PencilLine size={13} />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[11px] text-gray-400">{fmtDateTime(e.createdAt)}{i === 0 ? ' · Latest' : ''}</p>
                                  <p className="text-[12px] font-semibold text-gray-800">{e.status || 'Open'}</p>
                                  {e.remark && <p className="text-[11px] text-gray-500">“{e.remark}”</p>}
                                  {e.next_action && <p className="text-[11px] text-purple-600">{e.next_action}{e.next_action_at ? ` · ${fmtDateTime(e.next_action_at)}` : ''}</p>}
                                  <p className="text-[10px] text-gray-400">by {e.updated_by || 'CMS user'}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination ─── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-[12px] text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        isSubmitting={exporting}
      />
    </div>
  );
};

export default FeedbackRecords;
