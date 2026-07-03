import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  Users,
  UserX,
  ShieldCheck,
  FileCheck,
  MousePointerClick,
  Search,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

import { getShortUserTrack, getShortDistinctMediums, getShortDistinctLenders } from "../../../api-services/Modules/Leads";
import { shortUserTrackColumn } from "../../../components/TableHeader";
import ToastNotification from "../../../components/Notification/ToastNotification";
import ExportModal from "../../../components/ExportModal";
import MainTable from "../../../components/Table/MainTable";
import { FEEDBACK_STATUSES } from "../../../components/LeadFeedback/LeadFeedback";
import PremiumPageLoader from "../../../components/PremiumPageLoader";
const debounce = (fn, delay) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

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
    label: "OTP Verified Pending",
    Icon: ShieldCheck,
    color: "amber",
  },
  {
    key: "form_submitted",
    label: "Form Not Submitted",
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

// Hardcoded source baseline — same approach as the regular User Track /
// Disbursal Dashboard. Mediums come from the DB (getShortDistinctMediums).
const SOURCE_OPTIONS = [
  { value: "google", label: "google" },
  { value: "google_ads", label: "google_ads" },
];

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
      label: "OTP Verified Pending",
      value: otp,
      Icon: ShieldCheck,
      color: "amber",
      pct: pct(otp),
    },
    {
      key: "form_submitted",
      label: "Form Not Submitted",
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
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {cards.map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white rounded-lg border border-gray-200 animate-pulse"
          >
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-7 bg-gray-300 rounded w-2/3" />
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
  feedbackStatus,
  onFeedbackChange,
  onRefresh,
  onClearAll,
  hasFilters,
}) => {
  const [rng, setRng] = useState({
    start: startDate || "",
    end: endDate || "",
  });
  const [searchValue, setSearchValue] = useState(search || "");

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

      {/* Single horizontal filter row — mirrors the high-ticket User Track:
          Search | Date | Custom | Medium | Source | Refresh/Clear. */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Search
          </label>
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Name, phone or email…"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                onSearchChange(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
        </div>

        {/* Quick Date */}
        <div className="shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Date
          </label>
          <div className="flex items-center gap-1 bg-gray-50 rounded-md p-1">
            {[
              { v: "", l: "All" },
              { v: "today", l: "Today" },
              { v: "yesterday", l: "Yest." },
            ].map(({ v, l }) => (
              <button
                key={l}
                type="button"
                onClick={() => onDateTypeChange(v)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  dateType === v
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Range */}
        <div className="shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Custom Range
          </label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={rng.start}
              onChange={(e) =>
                setRng((prev) => ({ ...prev, start: e.target.value }))
              }
              className="px-2 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <span className="text-gray-400 text-xs">→</span>
            <input
              type="date"
              value={rng.end}
              onChange={(e) =>
                setRng((prev) => ({ ...prev, end: e.target.value }))
              }
              className="px-2 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <button
              type="button"
              onClick={applyRange}
              disabled={!rng.start || !rng.end}
              className="px-2.5 py-1.5 text-xs rounded bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-700 transition"
            >
              Go
            </button>
          </div>
        </div>

        {/* Selected Lender select */}
        <div className="basis-[150px] shrink-0">
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
        <div className="basis-[140px] shrink-0">
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
        <div className="basis-[140px] shrink-0">
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
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
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

        {/* Inline actions — Refresh + Clear */}
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

// Persist filters + pagination across navigation (View → detail → back) so the
// user returns to the same filtered list instead of a reset-to-default one.
// sessionStorage scopes this to the current browser tab so it clears on close.
const FILTERS_STORAGE_KEY = "shortUserTrack:filters:v1";

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

const ShortUserTrack = () => {
  const navigate = useNavigate();

  // Hydrate filters / pagination from sessionStorage when returning from a
  // detail page (computed once on first render). Without this, every filter
  // resets to default after View → detail → back.
  const persisted = useMemo(() => loadPersistedState(), []);

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  // Skip the premium first-load animation when returning from a detail page so
  // the user lands straight back on their filtered table.
  const [firstLoad, setFirstLoad] = useState(!persisted);
  const [totalCount, setTotalCount] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const DEFAULT_QUERY = {
    page_no: 1,
    limit: 10,
    search: "",
    filter_date: "",
    startDate: null,
    endDate: null,
    stage: "",
    lender: "",
    medium: "",
    source: "",
    feedbackStatus: "",
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

  const [mediumOptions, setMediumOptions] = useState([]);
  const [lenderOptions, setLenderOptions] = useState([]);

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
      const res = await getShortUserTrack({
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
        feedbackStatus: query.feedbackStatus || undefined,
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
      setFirstLoad(false);
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
    query.feedbackStatus,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Populate the Medium dropdown from short_apply_new_draft_leads (plus the
  // hardcoded baseline that always includes 'rapidmoney').
  useEffect(() => {
    (async () => {
      try {
        const res = await getShortDistinctMediums();
        const list = res?.data?.data || res?.data || [];
        const values = (Array.isArray(list) ? list : [])
          .map((x) => (typeof x === "string" ? x : x?.utm_medium))
          .filter(Boolean);
        setMediumOptions(Array.from(new Set(values)).sort());
      } catch (err) {
        console.error("Failed to load short mediums", err);
      }
    })();
  }, []);

  // Populate the Selected Lender dropdown from shortSelectedLenders.
  useEffect(() => {
    (async () => {
      try {
        const res = await getShortDistinctLenders();
        const list = res?.data?.data || res?.data || [];
        const names = (Array.isArray(list) ? list : [])
          .map((x) => (typeof x === "string" ? x : x?.lenderName || x?.name))
          .filter(Boolean);
        setLenderOptions(Array.from(new Set(names)).sort());
      } catch (err) {
        console.error("Failed to load short lenders", err);
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
  const onFeedbackChange = useCallback(
    (feedbackStatus) => setQuery((prev) => ({ ...prev, feedbackStatus, page_no: 1 })),
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
        feedbackStatus: "",
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
    query.feedbackStatus
  );

  const handleView = (row) => {
    navigate(`/short-user-track/${encodeURIComponent(row.phone)}`, {
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
      downloadFileName = `Short_User_Track_${date}_${time}.csv`;
    } else if (mode === "range" && startDate && endDate) {
      urlParams.append("fromDate", startDate);
      urlParams.append("toDate", endDate);
      downloadFileName = `Short_User_Track_${startDate}_to_${endDate}.csv`;
    } else {
      ToastNotification.error("Please select valid export filter.");
      setExportLoading(false);
      return;
    }

    if (query.search) urlParams.append("search", query.search);
    if (query.stage) urlParams.append("stage", query.stage);
    if (query.medium) urlParams.append("medium", query.medium);
    if (query.source) urlParams.append("source", query.source);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/short-user-track/export?${urlParams.toString()}`;
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
    () => shortUserTrackColumn({ handleEdit: handleView }),
    [],
  );

  if (firstLoad) {
    return (
      <div className="min-w-0 w-full max-w-full overflow-x-hidden">
        <Toaster />
        <PremiumPageLoader
          theme="sky"
          title="Loading Short User Track"
          brandLabel="Live Short User Funnel"
          icon={Users}
          phrases={[
            'Tracking user journeys…',
            'Mapping funnel stages…',
            'Computing conversion rates…',
            'Polishing the table…',
          ]}
          tiles={[
            { label: 'Total users' },
            { label: 'OTP verified Pending' },
            { label: 'Submitted' },
          ]}
          progressLabel="Preparing your funnel"
        />
      </div>
    );
  }

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
        <h1 className="text-xl font-bold text-gray-900">Short User Track</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track every short-ticket user's journey — who landed on the page,
          verified OTP, submitted the form, and clicked a lender. Grouped by
          phone number.
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
        feedbackStatus={query.feedbackStatus}
        onFeedbackChange={onFeedbackChange}
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
        title="Short User Track"
        // Seed page + search from restored state so returning from a detail
        // page keeps the same page/search (without these MainTable resets both
        // to page 1 / empty on mount).
        initialPagination={{ pageIndex: Math.max(0, query.page_no - 1), pageSize: query.limit }}
        initialSearch={query.search}
      />
    </div>
  );
};

export default ShortUserTrack;
