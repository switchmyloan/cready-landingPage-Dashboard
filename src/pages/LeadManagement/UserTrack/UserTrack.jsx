import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  Users,
  UserX,
  ShieldCheck,
  Sparkles,
  FileCheck,
  MousePointerClick,
  Search,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

import { getUserTrack, getDistinctLenders, getDistinctMediums } from "../../../api-services/Modules/Leads";
import { userTrackColumn } from "../../../components/TableHeader";
import ToastNotification from "../../../components/Notification/ToastNotification";
import ExportModal from "../../../components/ExportModal";
import ModuleInfoCard from "../../../components/ModuleInfoCard";
import MainTable from "../../../components/Table/MainTable";
import { FEEDBACK_STATUSES } from "../../../components/LeadFeedback/LeadFeedback";

const debounce = (fn, delay) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

// Stage definitions — cumulative "reached" semantics for OTP/form/lender
// (clicking a pill shows everyone who crossed that gate, including those who
// went further). `landed_only` is the exception: it isolates users who landed
// but never progressed past OTP.
const STAGES = [
  { key: "", label: "Landed (All Users)", Icon: Users, color: "blue" },
  {
    key: "landed_only",
    label: "Landed Only",
    Icon: UserX,
    color: "slate",
  },
  {
    key: "otp_verified",
    label: "OTP Verified",
    Icon: ShieldCheck,
    color: "amber",
  },
  {
    key: "form_submitted",
    label: "Form Submitted",
    Icon: FileCheck,
    color: "purple",
  },
  {
    key: "lender_clicked",
    label: "Lender Clicked",
    Icon: MousePointerClick,
    color: "green",
  },
];

const COLOR_MAP = {
  blue: {
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    pillActive: "bg-blue-600 text-white",
    pillIdle: "border-blue-200 text-blue-700 hover:bg-blue-50",
  },
  amber: {
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    pillActive: "bg-amber-500 text-white",
    pillIdle: "border-amber-200 text-amber-700 hover:bg-amber-50",
  },
  purple: {
    iconBg: "bg-purple-100",
    iconText: "text-purple-600",
    pillActive: "bg-purple-600 text-white",
    pillIdle: "border-purple-200 text-purple-700 hover:bg-purple-50",
  },
  green: {
    iconBg: "bg-green-100",
    iconText: "text-green-600",
    pillActive: "bg-green-600 text-white",
    pillIdle: "border-green-200 text-green-700 hover:bg-green-50",
  },
  slate: {
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
    pillActive: "bg-slate-600 text-white",
    pillIdle: "border-slate-200 text-slate-700 hover:bg-slate-50",
  },
};

const StatCards = ({ summary, loading }) => {
  const total = summary.total || 0;
  const otp = summary.otp_verified || 0;
  const form = summary.form_submitted || 0;
  const lender = summary.lender_clicked || 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  const cards = [
    {
      key: "total",
      label: "Landed (All Users)",
      value: total,
      Icon: Users,
      color: "blue",
      pct: 100,
    },
    {
      key: "otp",
      label: "OTP Verified",
      value: otp,
      Icon: ShieldCheck,
      color: "amber",
      pct: pct(otp),
    },
    {
      key: "form_submitted",
      label: "Form Submitted",
      value: form,
      Icon: FileCheck,
      color: "purple",
      pct: pct(form),
    },
    {
      key: "lender_clicked",
      label: "Lender Clicked",
      value: lender,
      Icon: MousePointerClick,
      color: "green",
      pct: pct(lender),
    },
  ];

  if (loading) {
    // Sweeping shimmer skeleton (animate-shimmer keyframe in tailwind.config.js)
    // — matches the rest of the High Ticket module loading style.
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {cards.map((_, i) => (
          <div key={i} className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="h-3 w-1/2 rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer mb-3" />
            <div className="h-7 w-2/3 rounded-md bg-gradient-to-r from-indigo-100 via-purple-200 to-indigo-100 bg-[length:200%_100%] animate-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map(({ key, label, Icon, color, value, pct }) => {
        const c = COLOR_MAP[color];
        return (
          <div
            key={key}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {value.toLocaleString()}
              </p>
              {key !== "total" && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  <span
                    className={`font-semibold ${pct >= 50 ? "text-green-600" : pct >= 20 ? "text-amber-600" : "text-red-500"}`}
                  >
                    {pct}%
                  </span>{" "}
                  of landed
                </p>
              )}
            </div>
            <div
              className={`p-2.5 rounded-lg ${c.iconBg} ${c.iconText} shrink-0 ml-2`}
            >
              <Icon size={20} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FilterBar = ({
  search,
  onSearchChange,
  dateType,
  onDateTypeChange,
  startDate,
  endDate,
  onDateRangeChange,
  stage,
  onStageChange,
  stageCounts,
  lender,
  onLenderChange,
  lenderOptions,
  medium,
  onMediumChange,
  mediumOptions,
  source,
  onSourceChange,
  sourceOptions,
  viewAllClicked,
  onViewAllClickedChange,
  feedbackStatus,
  onFeedbackChange,
  trackingEvent,
  onTrackingChange,
  onRefresh,
  onClearAll,
  hasFilters,
}) => {
  const [rng, setRng] = useState({
    start: startDate || "",
    end: endDate || "",
  });
  const [searchValue, setSearchValue] = useState(search || "");
  // Whether the Custom date-range popover is open. Default closed = filter
  // bar stays compact; opens only when user wants a custom window.
  const [customOpen, setCustomOpen] = useState(Boolean(startDate || endDate));

  useEffect(() => {
    setRng({ start: startDate || "", end: endDate || "" });
  }, [startDate, endDate]);
  useEffect(() => {
    setSearchValue(search || "");
  }, [search]);

  const applyRange = () => {
    if (rng.start && rng.end) onDateRangeChange(rng.start, rng.end);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Filter by Stage
        </p>
        <div className="flex flex-wrap gap-2">
          {STAGES.map(({ key, label, Icon, color }) => {
            const c = COLOR_MAP[color];
            const active = stage === key;
            const count = key === "" ? stageCounts.total : stageCounts[key];
            return (
              <button
                key={key || "all"}
                type="button"
                onClick={() => onStageChange(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  active
                    ? `${c.pillActive} border-transparent`
                    : `bg-white ${c.pillIdle}`
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {(Number(count) || 0).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="my-3 border-t border-gray-100" />

      {/* Single-row flex layout — wide screens fit all 8 filters in one line;
          narrower screens wrap gracefully. Each control has a min basis so
          inputs stay legible. */}
      <div className="flex flex-wrap items-end gap-2">

        {/* Search — grows to fill leftover space */}
        <div className="grow basis-[200px]">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Search
          </label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Name, phone or email…"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                onSearchChange(e.target.value);
              }}
              className="w-full pl-8 pr-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
        </div>

        {/* Date Filter — compact pills with "Custom" button that opens a popover
            for date-range selection. Keeps the filter bar single-row by default. */}
        <div className="basis-[230px] shrink-0 relative">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Date
          </label>
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5 border border-gray-200">
            {[
              { v: "", l: "All" },
              { v: "today", l: "Today" },
              { v: "yesterday", l: "Yest." },
            ].map(({ v, l }) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  onDateTypeChange(v);
                  setCustomOpen(false);
                }}
                className={`flex-1 px-2 py-1 rounded text-[11px] font-semibold transition ${
                  dateType === v && !(rng.start && rng.end)
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                {l}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomOpen((o) => !o)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition inline-flex items-center gap-0.5 ${
                rng.start && rng.end
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-white hover:text-gray-900"
              }`}
            >
              Custom
              <span className="text-[9px]">{customOpen ? "▴" : "▾"}</span>
            </button>
          </div>

          {customOpen && (
            <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 flex items-center gap-1 min-w-[280px]">
              <input
                type="date"
                value={rng.start}
                onChange={(e) => setRng((prev) => ({ ...prev, start: e.target.value }))}
                className="flex-1 min-w-0 px-1.5 py-1 text-[11px] rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <span className="text-gray-400 text-[10px]">→</span>
              <input
                type="date"
                value={rng.end}
                onChange={(e) => setRng((prev) => ({ ...prev, end: e.target.value }))}
                className="flex-1 min-w-0 px-1.5 py-1 text-[11px] rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <button
                type="button"
                onClick={() => {
                  applyRange();
                  setCustomOpen(false);
                }}
                disabled={!rng.start || !rng.end}
                className="px-2 py-1 text-[11px] font-semibold rounded bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-700 transition"
              >
                Go
              </button>
            </div>
          )}
        </div>

        {/* Lender select */}
        <div className="basis-[140px] shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Selected Lender
          </label>
          <select
            value={lender || ""}
            onChange={(e) => onLenderChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All Lenders</option>
            {lenderOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Medium select */}
        <div className="basis-[120px] shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Medium
          </label>
          <select
            value={medium || ""}
            onChange={(e) => onMediumChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All Mediums</option>
            {mediumOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Source select */}
        <div className="basis-[120px] shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Source
          </label>
          <select
            value={source || ""}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All Sources</option>
            {sourceOptions.map((s) => (
              <option key={s.value || s} value={s.value || s}>{s.label || s}</option>
            ))}
          </select>
        </div>

        {/* View All Offers select */}
        <div className="basis-[110px] shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            View All
          </label>
          <select
            value={viewAllClicked || ""}
            onChange={(e) => onViewAllClickedChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All</option>
            <option value="yes">Clicked</option>
            <option value="no">Not Clicked</option>
          </select>
        </div>

        {/* Feedback select */}
        <div className="basis-[150px] shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Feedback
          </label>
          <select
            value={feedbackStatus || ""}
            onChange={(e) => onFeedbackChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All Feedback</option>
            <option value="__none__">No feedback yet</option>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Tracking event select */}
        <div className="basis-[160px] shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Tracking
          </label>
          <select
            value={trackingEvent || ""}
            onChange={(e) => onTrackingChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All Tracking</option>
            <option value="incred_pending_modal_shown">Incred Pending Modal Shown</option>
            <option value="incred_pending_modal_apply_clicked">Incred Pending Modal — Apply</option>
            <option value="incred_offer_model_clicked">Incred Offer Model Clicked</option>
          </select>
        </div>

        {/* Inline actions — no label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            title="Refresh data"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
              title="Clear all filters"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SimpleTable = ({
  columns,
  data,
  loading,
  totalCount,
  pageIndex,
  pageSize,
  onPageChange,
}) => {
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
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  Loading users…
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  No users found. Try adjusting the filters above.
                </td>
              </tr>
            )}
            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
        <p className="text-gray-600">
          Showing{" "}
          <span className="font-semibold">
            {data.length === 0 ? 0 : pageIndex * pageSize + 1}
          </span>
          –
          <span className="font-semibold">
            {pageIndex * pageSize + data.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold">{totalCount.toLocaleString()}</span>
        </p>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) =>
              onPageChange({ pageIndex: 0, pageSize: Number(e.target.value) })
            }
            className="px-2 py-1 rounded border border-gray-300 text-xs"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => onPageChange({ pageIndex: 0, pageSize })}
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => onPageChange({ pageIndex: pageIndex - 1, pageSize })}
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 text-xs text-gray-600">
            Page <span className="font-semibold">{pageIndex + 1}</span> of{" "}
            <span className="font-semibold">{totalPages}</span>
          </span>
          <button
            type="button"
            disabled={pageIndex + 1 >= totalPages}
            onClick={() => onPageChange({ pageIndex: pageIndex + 1, pageSize })}
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            disabled={pageIndex + 1 >= totalPages}
            onClick={() =>
              onPageChange({ pageIndex: totalPages - 1, pageSize })
            }
            className="p-1.5 rounded border border-gray-300 bg-white disabled:opacity-40"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Persist filters + pagination across navigation (View → detail → back) so the
// user returns to the same filtered list instead of a reset-to-default one.
// sessionStorage scopes this to the current browser tab so it clears on close.
const FILTERS_STORAGE_KEY = "userTrack:filters:v1";

const loadPersistedState = () => {
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const UserTrack = () => {
  const navigate = useNavigate();

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Hydrate filters / pagination from sessionStorage when returning from a
  // detail page (computed once on first render). Without this, every filter
  // resets to default after View → detail → back.
  const persisted = useMemo(() => loadPersistedState(), []);

  const DEFAULT_QUERY = {
    page_no: 1,
    limit: 10,
    search: "",
    // Default to "All" on landing — user can narrow with Today/Yesterday/Custom.
    filter_date: "",
    startDate: null,
    endDate: null,
    stage: "",
    lender: "",
    medium: "",
    source: "",
    viewAllClicked: "",
    feedbackStatus: "",
    trackingEvent: "",
  };

  const [query, setQuery] = useState(() =>
    persisted?.query && typeof persisted.query === "object"
      ? { ...DEFAULT_QUERY, ...persisted.query }
      : DEFAULT_QUERY
  );

  // Persist filter + pagination state on every change so back-navigation from
  // the detail page restores exactly where the user left off.
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ query }));
    } catch {
      // sessionStorage can throw in private-mode browsers; silently ignore.
    }
  }, [query]);

  const [lenderOptions, setLenderOptions] = useState([]);
  const [mediumOptions, setMediumOptions] = useState([]);

  // Hardcoded source baseline — same approach as Disbursal Dashboard.
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  const [summary, setSummary] = useState({
    total: 0,
    landed_only: 0,
    otp_verified: 0,
    form_submitted: 0,
    lender_clicked: 0,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserTrack({
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        perPage: query.limit,
        currentPage: query.page_no,
        search: query.search,
        stage: query.stage || undefined,
        lender: query.lender || undefined,
        medium: query.medium || undefined,
        source: query.source || undefined,
        viewAllClicked: query.viewAllClicked || undefined,
        feedbackStatus: query.feedbackStatus || undefined,
        trackingEvent: query.trackingEvent || undefined,
      });

      if (res?.data?.success) {
        setRawData(res.data.data || []);
        setTotalCount(res.data.pagination?.total || 0);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else {
        ToastNotification.error("Failed to load users");
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [
    query.filter_date,
    query.startDate,
    query.endDate,
    query.limit,
    query.page_no,
    query.search,
    query.stage,
    query.lender,
    query.medium,
    query.source,
    query.viewAllClicked,
    query.feedbackStatus,
    query.trackingEvent,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDistinctLenders({ success: true });
        const list = res?.data?.data || res?.data || [];
        const names = (Array.isArray(list) ? list : [])
          .map((x) => (typeof x === "string" ? x : x?.lenderName || x?.name))
          .filter(Boolean);
        setLenderOptions(Array.from(new Set(names)).sort());
      } catch (err) {
        console.error("Failed to load lenders", err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDistinctMediums();
        const list = res?.data?.data || res?.data || [];
        const values = (Array.isArray(list) ? list : [])
          .map((x) => (typeof x === "string" ? x : x?.utm_medium))
          .filter(Boolean);
        setMediumOptions(Array.from(new Set(values)).sort());
      } catch (err) {
        console.error("Failed to load mediums", err);
      }
    })();
  }, []);

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (term) =>
          setQuery((prev) =>
            prev.search === term
              ? prev
              : { ...prev, search: term, page_no: 1 },
          ),
        300,
      ),
    [],
  );

  const onDateTypeChange = useCallback(
    (v) =>
      setQuery((prev) => ({
        ...prev,
        filter_date: v,
        startDate: null,
        endDate: null,
        page_no: 1,
      })),
    [],
  );
  const onDateRangeChange = useCallback(
    (s, e) =>
      setQuery((prev) => ({
        ...prev,
        startDate: s,
        endDate: e,
        filter_date: "",
        page_no: 1,
      })),
    [],
  );
  const onStageChange = useCallback(
    (stage) => setQuery((prev) => ({ ...prev, stage, page_no: 1 })),
    [],
  );
  const onLenderChange = useCallback(
    (lender) => setQuery((prev) => ({ ...prev, lender, page_no: 1 })),
    [],
  );
  const onMediumChange = useCallback(
    (medium) => setQuery((prev) => ({ ...prev, medium, page_no: 1 })),
    [],
  );
  const onSourceChange = useCallback(
    (source) => setQuery((prev) => ({ ...prev, source, page_no: 1 })),
    [],
  );
  const onViewAllClickedChange = useCallback(
    (viewAllClicked) => setQuery((prev) => ({ ...prev, viewAllClicked, page_no: 1 })),
    [],
  );
  const onFeedbackChange = useCallback(
    (feedbackStatus) => setQuery((prev) => ({ ...prev, feedbackStatus, page_no: 1 })),
    [],
  );
  const onTrackingChange = useCallback(
    (trackingEvent) => setQuery((prev) => ({ ...prev, trackingEvent, page_no: 1 })),
    [],
  );
  const onPageChange = useCallback(
    (p) =>
      setQuery((prev) => ({
        ...prev,
        page_no: p.pageIndex + 1,
        limit: p.pageSize,
      })),
    [],
  );
  const onClearAll = useCallback(
    () =>
      setQuery((prev) => ({
        ...prev,
        page_no: 1,
        search: "",
        filter_date: "",
        startDate: null,
        endDate: null,
        stage: "",
        lender: "",
        medium: "",
        source: "",
        viewAllClicked: "",
        feedbackStatus: "",
        trackingEvent: "",
      })),
    [],
  );

  const hasFilters = !!(
    query.search ||
    query.filter_date ||
    query.startDate ||
    query.endDate ||
    query.stage ||
    query.lender ||
    query.medium ||
    query.source ||
    query.viewAllClicked ||
    query.feedbackStatus ||
    query.trackingEvent
  );

  const handleView = (row) => {
    navigate(`/user-track/${encodeURIComponent(row.phone)}`, {
      state: { row },
    });
  };

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async ({
    startDate,
    endDate,
    mode,
    otp,
    hashedOtp,
  }) => {
    setExportLoading(true);
    let urlParams = new URLSearchParams({ mode: "download", otp, hashedOtp });
    let downloadFileName;

    const now = new Date();
    const date = now
      .toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
    const time = now
      .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      .replace(/:/g, "-")
      .replace(" ", "");

    if (mode === "today" || mode === "yesterday") {
      urlParams.append("type", mode);
      downloadFileName = `User_Track_${date}_${time}.csv`;
    } else if (mode === "range" && startDate && endDate) {
      urlParams.append("fromDate", startDate);
      urlParams.append("toDate", endDate);
      downloadFileName = `User_Track_${startDate}_to_${endDate}.csv`;
    } else {
      ToastNotification.error("Please select valid export filter.");
      setExportLoading(false);
      return;
    }

    if (query.search) urlParams.append("search", query.search);
    if (query.stage) urlParams.append("stage", query.stage);
    if (query.lender) urlParams.append("lender", query.lender);
    if (query.medium) urlParams.append("medium", query.medium);
    if (query.source) urlParams.append("source", query.source);
    if (query.viewAllClicked) urlParams.append("viewAllClicked", query.viewAllClicked);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/user-track/export?${urlParams.toString()}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      ToastNotification.success("Download started!");
    } catch (err) {
      console.error(err);
      ToastNotification.error("Export failed!");
    } finally {
      setExportLoading(false);
      setExportModalOpen(false);
    }
  };

  const columns = useMemo(
    () => userTrackColumn({ handleEdit: handleView }),
    [],
  );

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden">
      <Toaster />
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        isSubmitting={exportLoading}
      />

      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">User Track</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track every user's journey — who landed on the page, verified OTP,
          submitted the form, and clicked a lender. Grouped by phone number.
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
        medium={query.medium}
        onMediumChange={onMediumChange}
        mediumOptions={mediumOptions}
        source={query.source}
        onSourceChange={onSourceChange}
        sourceOptions={SOURCE_OPTIONS}
        viewAllClicked={query.viewAllClicked}
        onViewAllClickedChange={onViewAllClickedChange}
        feedbackStatus={query.feedbackStatus}
        onFeedbackChange={onFeedbackChange}
        trackingEvent={query.trackingEvent}
        onTrackingChange={onTrackingChange}
        onRefresh={fetchUsers}
        onClearAll={onClearAll}
        hasFilters={hasFilters}
      />

      <MainTable
        columns={columns}
        data={rawData}
        totalDataCount={totalCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchUsers}
        onExport={handleExport}
        title="User Track"
        // Seed page + search from restored state so returning from a detail
        // page keeps the same page/search (without these MainTable resets both
        // to page 1 / empty on mount).
        initialPagination={{ pageIndex: Math.max(0, query.page_no - 1), pageSize: query.limit }}
        initialSearch={query.search}
      />

      <ModuleInfoCard
        title="High User Track"
        subtitle="End-to-end journey of every applicant — from landing on the site to clicking a lender."
        whatYouSee={[
          "Each applicant's progress through the funnel: Landed → OTP Verified → Form Submitted → Lender Clicked.",
          'The list of lenders the applicant pressed Apply on.',
          'The offer cards that were actually shown to the applicant on the offer page.',
          'Filters by traffic source (Medium) and by clicked lender — useful for segment analysis.',
        ]}
        dataSource={[
          'Combines four touchpoints into a single per-applicant view: form submission, OTP verification, offer page visit, and lender clicks.',
          'Applicants are joined together by their phone number.',
          'The funnel stage shown is the furthest step that applicant reached.',
        ]}
        flow={[
          'Applicant lands',
          'Receives OTP',
          'Verifies OTP',
          'Submits form',
          'Reaches offer page',
          'Clicks Apply on a lender',
          'Stage progresses with each step',
        ]}
      />
    </div>
  );
};

export default UserTrack;