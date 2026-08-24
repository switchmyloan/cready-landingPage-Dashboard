import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  Users, FileText, ShieldCheck, Sparkles, MousePointerClick,
  Search, RefreshCw, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';

import {
  getLendingUserJourney,
  getDistinctLenders,
} from '../../../api-services/Modules/Leads';
import { lendingUserJourneyColumn } from '../../../components/TableHeader';
import ToastNotification from '../../../components/Notification/ToastNotification';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const debounce = (fn, delay) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

// Stage metadata — keys match the backend `stage` field.
const STAGES = [
  { key: '',               label: 'All Users',      short: 'All',             Icon: Users,             color: 'blue' },
  { key: 'draft',          label: 'Only Drafted',   short: 'Drafted',         Icon: FileText,          color: 'gray' },
  { key: 'otp_verified',   label: 'OTP Verified',   short: 'OTP Verified',    Icon: ShieldCheck,       color: 'amber' },
  { key: 'offers_viewed',  label: 'Form Submitted', short: 'Form Submitted',  Icon: Sparkles,          color: 'purple' },
  { key: 'lender_clicked', label: 'Clicked Lender', short: 'Clicked Lender',  Icon: MousePointerClick, color: 'green' },
];

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   iconBg: 'bg-blue-100',   iconText: 'text-blue-600',   pillActive: 'bg-blue-600 text-white',   pillIdle: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  gray:   { bg: 'bg-gray-50',   text: 'text-gray-700',   iconBg: 'bg-gray-100',   iconText: 'text-gray-600',   pillActive: 'bg-gray-700 text-white',   pillIdle: 'border-gray-300 text-gray-700 hover:bg-gray-50' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  iconBg: 'bg-amber-100',  iconText: 'text-amber-600',  pillActive: 'bg-amber-500 text-white',  pillIdle: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100', iconText: 'text-purple-600', pillActive: 'bg-purple-600 text-white', pillIdle: 'border-purple-200 text-purple-700 hover:bg-purple-50' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  iconBg: 'bg-green-100',  iconText: 'text-green-600',  pillActive: 'bg-green-600 text-white',  pillIdle: 'border-green-200 text-green-700 hover:bg-green-50' },
};

// ─────────────────────────────────────────────────────────────
// Stat cards — funnel view (cumulative).
//
// Backend now returns CUMULATIVE counts directly (each summary field counts
// users who REACHED that stage, regardless of whether they went further):
//   summary.total          → total landed
//   summary.otp_verified   → COUNT(apply_new_draft_leads.otp_verified = true)
//   summary.offers_viewed  → COUNT(offerLeads rows by phone)
//   summary.lender_clicked → COUNT(selectedLenders rows by phone)
// ─────────────────────────────────────────────────────────────
const StatCards = ({ summary, loading }) => {
  const total = summary.total || 0;
  const pct = (n) => total ? Math.round((n / total) * 100) : 0;

  const cards = [
    { key: 'total',  label: 'Total Users (Landed)', value: total,                      Icon: Users,             color: 'blue',   pct: 100 },
    { key: 'otp',    label: 'OTP Verified',         value: summary.otp_verified  || 0, Icon: ShieldCheck,       color: 'amber',  pct: pct(summary.otp_verified  || 0) },
    { key: 'form',   label: 'Form Submitted',       value: summary.offers_viewed || 0, Icon: Sparkles,          color: 'purple', pct: pct(summary.offers_viewed || 0) },
    { key: 'lender', label: 'Clicked Lender',       value: summary.lender_clicked || 0, Icon: MousePointerClick, color: 'green',  pct: pct(summary.lender_clicked || 0) },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {cards.map((_, i) => (
          <div key={i} className="p-4 bg-white rounded-lg border border-gray-200 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-7 bg-gray-300 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map(({ key, label, Icon, color, value, pct }) => {
        const c = COLOR_MAP[color];
        return (
          <div key={key} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
              {key !== 'total' && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  <span className={`font-semibold ${pct >= 50 ? 'text-green-600' : pct >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
                    {pct}%
                  </span>{' '}
                  of landed
                </p>
              )}
            </div>
            <div className={`p-2.5 rounded-lg ${c.iconBg} ${c.iconText} shrink-0 ml-2`}>
              <Icon size={20} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Unified filter bar — everything in one place
// ─────────────────────────────────────────────────────────────
const FilterBar = ({
  search, onSearchChange,
  dateType, onDateTypeChange,
  startDate, endDate, onDateRangeChange,
  stage, onStageChange, stageCounts,
  lender, onLenderChange, lenderOptions,
  onRefresh, onClearAll, hasFilters,
}) => {
  const [rng, setRng] = useState({ start: startDate || '', end: endDate || '' });
  const [searchValue, setSearchValue] = useState(search || '');

  useEffect(() => { setRng({ start: startDate || '', end: endDate || '' }); }, [startDate, endDate]);
  useEffect(() => { setSearchValue(search || ''); }, [search]);

  const applyRange = () => {
    if (rng.start && rng.end) onDateRangeChange(rng.start, rng.end);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      {/* Row 1: Stage pills — primary filter */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Filter by Stage</p>
        <div className="flex flex-wrap gap-2">
          {STAGES.map(({ key, label, Icon, color }) => {
            const c = COLOR_MAP[color];
            const active = stage === key;
            const count = key === '' ? stageCounts.total : stageCounts[key];
            return (
              <button
                key={key || 'all'}
                type="button"
                onClick={() => onStageChange(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  active ? `${c.pillActive} border-transparent` : `bg-white ${c.pillIdle}`
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
                <span className={`inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${
                  active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                  {(Number(count) || 0).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-gray-100" />

      {/* Row 2: Search + date filters + lender — labelled groups so each control's purpose is obvious */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        {/* Search (4 cols on lg) */}
        <div className="lg:col-span-4">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Search</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Name, phone or email…"
              value={searchValue}
              onChange={(e) => { setSearchValue(e.target.value); onSearchChange(e.target.value); }}
              className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
        </div>

        {/* Quick date (3 cols) */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Quick Date</label>
          <div className="flex items-center gap-1 bg-gray-50 rounded-md p-1">
            {[
              { v: '',          l: 'All' },
              { v: 'today',     l: 'Today' },
              { v: 'yesterday', l: 'Yest.' },
            ].map(({ v, l }) => (
              <button
                key={l}
                type="button"
                onClick={() => onDateTypeChange(v)}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
                  dateType === v ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Custom range (3 cols) */}
        <div className="lg:col-span-3">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Custom Range</label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={rng.start}
              onChange={(e) => setRng(prev => ({ ...prev, start: e.target.value }))}
              className="flex-1 min-w-0 px-2 py-2 text-xs rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <span className="text-gray-400 text-xs">→</span>
            <input
              type="date"
              value={rng.end}
              onChange={(e) => setRng(prev => ({ ...prev, end: e.target.value }))}
              className="flex-1 min-w-0 px-2 py-2 text-xs rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <button
              type="button"
              onClick={applyRange}
              disabled={!rng.start || !rng.end}
              className="px-2.5 py-2 text-xs rounded bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-700 transition"
            >
              Go
            </button>
          </div>
        </div>

        {/* Lender (2 cols) */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Lender</label>
          <select
            value={lender}
            onChange={(e) => onLenderChange(e.target.value)}
            className="w-full px-2 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All Lenders</option>
            {lenderOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Actions (1 col) */}
        <div className="lg:col-span-1 flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-600 hover:text-gray-900"
            title="Refresh data"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Clear filters — only when something is active */}
      {hasFilters && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
          >
            <X size={14} /> Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Simple table with pagination
// ─────────────────────────────────────────────────────────────
const SimpleTable = ({ columns, data, loading, totalCount, pageIndex, pageSize, onPageChange }) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize) || 1,
    state: { pagination: { pageIndex, pageSize } },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500">Loading users…</td></tr>
            )}
            {!loading && data.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500">
                No users found. Try adjusting the filters above.
              </td></tr>
            )}
            {!loading && table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 transition">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
        <p className="text-gray-600">
          Showing <span className="font-semibold">{data.length === 0 ? 0 : pageIndex * pageSize + 1}</span>–
          <span className="font-semibold">{pageIndex * pageSize + data.length}</span> of{' '}
          <span className="font-semibold">{totalCount.toLocaleString()}</span>
        </p>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => onPageChange({ pageIndex: 0, pageSize: Number(e.target.value) })}
            className="px-2 py-1 rounded border border-gray-300 text-xs"
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button type="button" disabled={pageIndex === 0} onClick={() => onPageChange({ pageIndex: 0, pageSize })}
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"><ChevronsLeft size={14} /></button>
          <button type="button" disabled={pageIndex === 0} onClick={() => onPageChange({ pageIndex: pageIndex - 1, pageSize })}
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="px-2 text-xs text-gray-600">
            Page <span className="font-semibold">{pageIndex + 1}</span> of <span className="font-semibold">{totalPages}</span>
          </span>
          <button type="button" disabled={pageIndex + 1 >= totalPages} onClick={() => onPageChange({ pageIndex: pageIndex + 1, pageSize })}
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
          <button type="button" disabled={pageIndex + 1 >= totalPages} onClick={() => onPageChange({ pageIndex: totalPages - 1, pageSize })}
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"><ChevronsRight size={14} /></button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
const LendingUserJourney = () => {
  const navigate = useNavigate();

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [lenderOptions, setLenderOptions] = useState([]);

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    filter_date: '',
    startDate: null,
    endDate: null,
    stage: '',
    lender: '',
  });

  const [summary, setSummary] = useState({
    total: 0, draft: 0, otp_verified: 0, offers_viewed: 0, lender_clicked: 0,
  });

  const fetchJourney = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLendingUserJourney({
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        perPage: query.limit,
        currentPage: query.page_no,
        search: query.search,
        stage: query.stage || undefined,
        lender: query.lender || undefined,
      });

      if (res?.data?.success) {
        setRawData(res.data.data?.data || []);
        setTotalCount(res.data.data?.pagination?.total || 0);
        setSummary(prev => res.data.data?.summary || prev);
      } else {
        // ToastNotification.error('Failed to load users');
        console.error(`Failed to load users: ${res?.data?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      // ToastNotification.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [
    query.filter_date, query.startDate, query.endDate,
    query.limit, query.page_no, query.search, query.stage, query.lender,
  ]);

  useEffect(() => { fetchJourney(); }, [fetchJourney]);

  // Load distinct lender names for the dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await getDistinctLenders();
        const list = res?.data?.data || [];
        const names = (Array.isArray(list) ? list : [])
          .map(x => (typeof x === 'string' ? x : (x?.lenderName || x?.name)))
          .filter(Boolean);
        setLenderOptions(Array.from(new Set(names)).sort());
      } catch {}
    })();
  }, []);

  // Handlers — debounced search, all others are immediate.
  const debouncedSearch = useMemo(
    () => debounce((term) => setQuery(prev => ({ ...prev, search: term, page_no: 1 })), 300),
    []
  );

  const onDateTypeChange   = (v)     => setQuery(prev => ({ ...prev, filter_date: v, startDate: null, endDate: null, page_no: 1 }));
  const onDateRangeChange  = (s, e)  => setQuery(prev => ({ ...prev, startDate: s, endDate: e, filter_date: '', page_no: 1 }));
  const onStageChange      = (stage) => setQuery(prev => ({ ...prev, stage, page_no: 1 }));
  const onLenderChange     = (lender)=> setQuery(prev => ({ ...prev, lender, page_no: 1 }));
  const onPageChange       = (p)     => setQuery(prev => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  const onClearAll         = ()      => setQuery(prev => ({
    ...prev, page_no: 1, search: '', filter_date: '',
    startDate: null, endDate: null, stage: '', lender: '',
  }));

  const hasFilters = !!(query.search || query.filter_date || query.startDate || query.endDate || query.stage || query.lender);

  const handleView = (row) => {
    navigate(`/lending-user-journey/${encodeURIComponent(row.phone)}`, { state: { row } });
  };

  const columns = useMemo(() => lendingUserJourneyColumn({ handleEdit: handleView }), []);

  return (
    <>
      <Toaster />

      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Lending User Journey</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track every user from landing page visit to lender click. Click any row to see the full history.
        </p>
      </div>

      <StatCards summary={summary} loading={loading} />

      <FilterBar
        search={query.search}
        onSearchChange={debouncedSearch}
        dateType={query.filter_date}
        onDateTypeChange={onDateTypeChange}
        startDate={query.startDate}
        endDate={query.endDate}
        onDateRangeChange={onDateRangeChange}
        stage={query.stage}
        onStageChange={onStageChange}
        stageCounts={summary}
        lender={query.lender}
        onLenderChange={onLenderChange}
        lenderOptions={lenderOptions}
        onRefresh={fetchJourney}
        onClearAll={onClearAll}
        hasFilters={hasFilters}
      />

      <SimpleTable
        columns={columns}
        data={rawData}
        loading={loading}
        totalCount={totalCount}
        pageIndex={query.page_no - 1}
        pageSize={query.limit}
        onPageChange={onPageChange}
      />
    </>
  );
};

export default LendingUserJourney;
