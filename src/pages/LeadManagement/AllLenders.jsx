import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { Users, CheckCircle2, XCircle, CircleDashed, ChevronDown, Calendar } from 'lucide-react';

import { getAllLendersStats } from '../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../api-services/Modules/Disbursal';
import ModuleInfoCard from '../../components/ModuleInfoCard';
import ToastNotification from '../../components/Notification/ToastNotification';

// Matches the /offer-leads, /kb-lending-page and /sc-response-leads filter strip
// so the same traffic sources are available across the Lenders modules.
const MEDIUM_OPTIONS = ['moneyview', 'meta', 'kreditbee', 'zype', 'SC'];
const SOURCE_OPTIONS = ['google', 'google_ads'];

const num = (n) => (Number(n) || 0).toLocaleString();

// Every bucket on the page, each rendered as a lender-wise distribution banner.
// "Total Selected" leads (it's the denominator the rest are measured against),
// then the three outcome splits. All four read their own key off the same
// /all-lenders/stats rows, so the whole page is still one fetch.
const BUCKETS = [
  { key: 'selected', label: 'Total Selected', Icon: Users, bg: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
  { key: 'successful', label: 'Successful', Icon: CheckCircle2, bg: 'bg-green-50', text: 'text-green-600', badge: 'bg-green-100 text-green-700' },
  { key: 'rejected', label: 'Rejected', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  { key: 'other', label: 'Other', Icon: CircleDashed, bg: 'bg-amber-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
];

// One outcome bucket broken down lender-wise. Lenders with nothing in the bucket
// are tucked behind "View details" so the strip stays scannable without dropping
// them from the roster. Defined at module scope so the accordion keeps its state
// across the parent's re-renders (a refetch would otherwise snap it shut).
const DistributionBanner = ({ bucket, total, lenders, loading }) => {
  const [open, setOpen] = useState(false);
  const { key, label, Icon, bg, text, badge } = bucket;

  const rows = useMemo(
    () =>
      (lenders || [])
        .map((l) => ({ lenderName: l.lenderName, count: Number(l[key]) || 0 }))
        .sort((a, b) => b.count - a.count || String(a.lenderName).localeCompare(String(b.lenderName))),
    [lenders, key]
  );
  const active = useMemo(() => rows.filter((r) => r.count > 0), [rows]);
  const idle = useMemo(() => rows.filter((r) => r.count === 0), [rows]);
  const share = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0');

  const Tile = ({ row }) => {
    const off = row.count === 0;
    return (
      <div className={`rounded-lg border px-3 py-2 ${off ? 'bg-gray-50/60 border-gray-100' : 'bg-gray-50 border-gray-100'}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 truncate" title={row.lenderName}>
          {row.lenderName}
        </p>
        <p className={`mt-0.5 text-base font-bold tabular-nums ${off ? 'text-gray-400' : 'text-gray-900'}`}>
          {num(row.count)}
        </p>
        <p className="text-[10px] text-gray-400">{off ? '—' : `${share(row.count)}%`}</p>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className={`p-1.5 rounded-full ${bg}`}>
            <Icon className={text} size={16} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${badge}`}>
            {active.length} lenders
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-gray-500">Total</p>
          <p className="text-sm font-bold text-gray-900 tabular-nums">{num(total)}</p>
        </div>
      </div>

      {/* Lender-wise distribution */}
      {loading ? (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer"
            />
          ))}
        </div>
      ) : active.length === 0 ? (
        <p className="mt-4 mb-1 text-center text-xs text-gray-400">
          No {label.toLowerCase()} activity for this period.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {active.map((row) => (
            <Tile key={row.lenderName} row={row} />
          ))}
        </div>
      )}

      {/* The rest of the roster — lenders with nothing in this bucket. */}
      {!loading && idle.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-3 w-full inline-flex items-center justify-center gap-1 rounded-lg border border-gray-100 bg-gray-50/70 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition"
          >
            {open ? 'Hide details' : `View details — ${idle.length} lenders with none`}
            <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {idle.map((row) => (
                  <Tile key={row.lenderName} row={row} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Ticket types, matching the /selected-lenders switch so the two Lenders pages
// behave the same. Each scope hits a different pair of tables server-side.
const TICKETS = [
  { key: 'high', label: 'High Ticket' },
  { key: 'short', label: 'Short Ticket' },
];

// Local YYYY-MM-DD. Deliberately NOT toISOString(), which converts to UTC and in
// IST hands back yesterday's date for anything before 05:30.
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 1st of the current month → today. The backend treats fromDate/toDate as an
// inclusive local-day range, so today's partial day is included.
const currentMonthRange = () => {
  const now = new Date();
  return { startDate: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: ymd(now) };
};

const AllLenders = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ lenders: [], totals: {}, lenderCount: 0 });
  const [ticket, setTicket] = useState('high');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftRange, setDraftRange] = useState({ startDate: '', endDate: '' });

  const [query, setQuery] = useState({
    // Default to today, consistent with the other lender modules.
    filter_date: 'today',
    startDate: null,
    endDate: null,
    utmMedium: '',
    utmSource: '',
  });

  // Medium dropdown — merge the hardcoded baseline with the DB's distinct
  // mediums (same source as the Disbursal dashboard) so ALL mediums show.
  const [mediumOptions, setMediumOptions] = useState(MEDIUM_OPTIONS);
  useEffect(() => {
    let cancelled = false;
    getDisbursalFilterOptions({ scope: 'high' })
      .then((res) => {
        if (cancelled) return;
        const apiMediums = res?.data?.data?.utmMediums || [];
        const seen = new Set();
        const merged = [];
        for (const m of [...MEDIUM_OPTIONS, ...apiMediums]) {
          const k = String(m || '').toLowerCase();
          if (!m || seen.has(k)) continue;
          if (['quickloans', 'easyloan', 'easyloans'].includes(k)) continue;
          seen.add(k);
          merged.push(m);
        }
        merged.sort((a, b) => a.localeCompare(b));
        setMediumOptions(['QuickLoans', ...merged]);
      })
      .catch((err) => console.error('Failed to load mediums:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllLendersStats({
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        utmMedium: query.utmMedium || undefined,
        utmSource: query.utmSource || undefined,
        scope: ticket,
      });

      if (res?.data?.success) {
        const s = res?.data?.data || {};
        setStats({
          lenders: s.lenders || [],
          totals: s.totals || {},
          lenderCount: s.lenderCount || 0,
        });
      } else {
        ToastNotification.error('Failed to fetch lender stats');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch lender stats');
    } finally {
      setLoading(false);
    }
  }, [query.filter_date, query.startDate, query.endDate, query.utmMedium, query.utmSource, ticket]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Today/Yesterday and an explicit range are mutually exclusive — the backend
  // lets `type` win over from/to, so leaving a stale range behind would silently
  // do nothing. Clear the other side whenever one is picked.
  const onFilterByDate = (type) => {
    setRangeOpen(false);
    setQuery((p) => ({ ...p, filter_date: p.filter_date === type ? '' : type, startDate: null, endDate: null }));
  };

  const monthRange = currentMonthRange();
  const isCurrentMonth =
    !query.filter_date && query.startDate === monthRange.startDate && query.endDate === monthRange.endDate;
  // A custom range is any explicit range that ISN'T the one-click month preset.
  const isCustomRange = !query.filter_date && !!query.startDate && !isCurrentMonth;

  const applyCurrentMonth = () => {
    setRangeOpen(false);
    setQuery((p) => ({ ...p, filter_date: '', ...currentMonthRange() }));
  };

  const clearDates = () => {
    setRangeOpen(false);
    setQuery((p) => ({ ...p, filter_date: '', startDate: null, endDate: null }));
  };

  // Same rules MainTable's date-range popover enforces, so the two behave alike.
  const applyCustomRange = () => {
    const { startDate, endDate } = draftRange;
    if (!startDate || !endDate) return ToastNotification.error('Please select both start and end date');
    const s = new Date(startDate);
    const e = new Date(endDate);
    const t = new Date();
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);
    if (s > e) return ToastNotification.error('Start date cannot be after end date');
    if (e > t) return ToastNotification.error('End date cannot be in the future');
    setQuery((p) => ({ ...p, filter_date: '', startDate, endDate }));
    setRangeOpen(false);
  };

  const totals = stats.totals || {};

  return (
    <>
      <Toaster />

      {/* Ticket type + date + traffic filters */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 mb-4">
        <div className="inline-flex items-center gap-2">
          {TICKETS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTicket(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                ticket === t.key
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        <div className="inline-flex items-center gap-2">
          {['today', 'yesterday'].map((t) => (
            <button
              key={t}
              onClick={() => onFilterByDate(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                query.filter_date === t
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:text-gray-900'
              }`}
            >
              {t === 'today' ? 'Today' : 'Yesterday'}
            </button>
          ))}

          <button
            onClick={applyCurrentMonth}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
              isCurrentMonth
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:text-gray-900'
            }`}
          >
            This Month
          </button>

          {/* Custom range — native date inputs, same popover shape as MainTable's
              date filter (no date-picker dependency exists in this project). */}
          <div className="relative inline-block">
            <button
              onClick={() => {
                setDraftRange({ startDate: query.startDate || '', endDate: query.endDate || '' });
                setRangeOpen((o) => !o);
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                isCustomRange
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:text-gray-900'
              }`}
            >
              <Calendar size={14} />
              {isCustomRange ? `${query.startDate} → ${query.endDate}` : 'Custom'}
              <ChevronDown size={13} className={`transition-transform ${rangeOpen ? 'rotate-180' : ''}`} />
            </button>

            {rangeOpen && (
              <div className="absolute left-0 mt-2 z-30 p-3 flex flex-col gap-2 bg-white border border-gray-300 rounded-lg shadow-lg w-64">
                <label className="text-xs font-medium text-gray-600">Start Date</label>
                <input
                  type="date"
                  max={ymd(new Date())}
                  value={draftRange.startDate}
                  onChange={(e) => setDraftRange((p) => ({ ...p, startDate: e.target.value }))}
                  className="p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                <label className="text-xs font-medium text-gray-600">End Date</label>
                <input
                  type="date"
                  max={ymd(new Date())}
                  value={draftRange.endDate}
                  onChange={(e) => setDraftRange((p) => ({ ...p, endDate: e.target.value }))}
                  className="p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                <button
                  onClick={applyCustomRange}
                  className="mt-2 w-full px-2 py-1 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700 transition"
                >
                  Apply Filter
                </button>
              </div>
            )}
          </div>

          {/* Must also appear for an active RANGE — otherwise picking a range
              (which clears filter_date) hid this button and left no way back. */}
          {(query.filter_date || query.startDate) && (
            <button
              onClick={clearDates}
              className="text-xs px-3 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
            >
              All Time
            </button>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        <div className="inline-flex items-center gap-2 whitespace-nowrap">
          <label className="text-sm font-semibold text-gray-700">Medium:</label>
          <select
            value={query.utmMedium}
            onChange={(e) => setQuery((p) => ({ ...p, utmMedium: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
          >
            <option value="">All Mediums</option>
            {mediumOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center gap-2 whitespace-nowrap">
          <label className="text-sm font-semibold text-gray-700">Source:</label>
          <select
            value={query.utmSource}
            onChange={(e) => setQuery((p) => ({ ...p, utmSource: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
          >
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchStats}
          className="ml-auto text-sm px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 transition"
        >
          Refresh
        </button>
      </div>

      {/* Total Selected + each outcome bucket, all broken down lender-wise */}
      {BUCKETS.map((bucket) => (
        <DistributionBanner
          key={bucket.key}
          bucket={bucket}
          total={totals[bucket.key]}
          lenders={stats.lenders}
          loading={loading}
        />
      ))}

      {/* The breakdown: one row per lender, counts across the four buckets */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <span className="h-5 w-1 rounded bg-purple-600" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">All Lenders</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase">
            {TICKETS.find((t) => t.key === ticket)?.label}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
            {stats.lenderCount} LENDERS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="text-left font-semibold px-4 py-3">SN</th>
                <th className="text-left font-semibold px-4 py-3">Lender</th>
                <th className="text-right font-semibold px-4 py-3">Selected</th>
                <th className="text-right font-semibold px-4 py-3">Successful</th>
                <th className="text-right font-semibold px-4 py-3">Rejected</th>
                <th className="text-right font-semibold px-4 py-3">Other</th>
                <th className="text-right font-semibold px-4 py-3">Share</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : stats.lenders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No lender activity for this period.</td></tr>
              ) : (
                stats.lenders.map((l, idx) => (
                  <tr key={l.lenderName} className="border-t border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{l.lenderName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{num(l.selected)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex rounded-full bg-green-100 text-green-800 px-2.5 py-0.5 text-xs font-medium">{num(l.successful)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 text-xs font-medium">{num(l.rejected)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-medium">{num(l.other)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{l.share}%</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && stats.lenders.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-900">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right">{num(totals.selected)}</td>
                  <td className="px-4 py-3 text-right">{num(totals.successful)}</td>
                  <td className="px-4 py-3 text-right">{num(totals.rejected)}</td>
                  <td className="px-4 py-3 text-right">{num(totals.other)}</td>
                  <td className="px-4 py-3 text-right">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ModuleInfoCard
        title="All Lenders"
        subtitle="Every lender side by side — how many users picked it, and how those picks turned out."
        whatYouSee={[
          'One row per lender: how many users selected it, and the outcome split across Successful / Rejected / Other.',
          'Share = that lender’s portion of all lender selections in the period.',
          'The lender list is built from the data itself, so a new lender appears here automatically.',
        ]}
        dataSource={[
          'Selected = a row in selectedLenders (one per lender-card click).',
          'Successful = that lender returned a real signal (a lead id / approval) on the user’s offer record.',
          'Rejected = the lender answered, but not with a success.',
          'Other = no lender response was captured — this is where UTM-only lenders (Poonawalla, HeroFinCorp, RapidMoney) sit, since they redirect out instead of returning a response.',
        ]}
        flow={[
          'Applicant sees offers',
          'Clicks a lender card',
          'Selection recorded',
          'Lender response matched',
          'Outcome bucketed',
          'Row appears here',
        ]}
      />
    </>
  );
};

export default AllLenders;
