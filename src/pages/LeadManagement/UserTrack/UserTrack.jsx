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
  SlidersHorizontal,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  IndianRupee,
  Percent,
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
  // End of the journey — landed users who have a disbursal on record. Not
  // date-scoped on the disbursal itself (it lags landing by days), so this reads
  // "of the users in this window, how many are disbursed so far".
  {
    key: "disbursed",
    label: "Disbursed",
    Icon: IndianRupee,
    color: "emerald",
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
  emerald: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    pillActive: "bg-emerald-600 text-white",
    pillIdle: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
  },
  teal: {
    iconBg: "bg-teal-100",
    iconText: "text-teal-600",
    pillActive: "bg-teal-600 text-white",
    pillIdle: "border-teal-200 text-teal-700 hover:bg-teal-50",
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
  const disbursed = summary.disbursed || 0;
  const disbursedAmt = summary.disbursed_amount || 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  // Compact ₹ for the disbursed card's sub-line (₹3.96 Cr / ₹34.4 L).
  const fmtCompactInr = (n) => {
    const v = Number(n) || 0;
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    return `₹${Math.round(v).toLocaleString("en-IN")}`;
  };

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
    {
      key: "disbursed",
      label: "Disbursed",
      value: disbursed,
      Icon: IndianRupee,
      color: "emerald",
      pct: pct(disbursed),
      note: fmtCompactInr(disbursedAmt),
      // Spelled out because this reads differently from the Disbursal Dashboard,
      // which counts by DISBURSAL date — here the window is the LANDING date.
      hint: "Of the users who landed in this window, how many have been disbursed so far (disbursal can happen days later). The Disbursal Dashboard counts by disbursal date instead, so the two won't match.",
    },
    {
      // The funnel's real close-rate: of the users who actually clicked through
      // to a lender, how many ended up disbursed. A rate, not a count — so it
      // renders its own value/sub-line instead of the shared "% of landed" one.
      key: "click_to_disbursal",
      label: "Click → Disbursal",
      value: disbursed,
      display: lender ? `${Math.round((disbursed / lender) * 1000) / 10}%` : "—",
      subText: lender
        ? `${disbursed.toLocaleString()} of ${lender.toLocaleString()} lender clicks`
        : "no lender clicks yet",
      Icon: Percent,
      color: "teal",
      hint: "Conversion rate — of the users who clicked through to a lender, how many ended up disbursed.",
    },
  ];

  if (loading) {
    // The skeleton MUST use the same grid as the real cards below.
    //
    // It stopped at lg:grid-cols-3 while the cards go to xl:grid-cols-6, so six
    // placeholders stacked into two tall rows, then collapsed to one row the
    // instant data arrived — the whole page jumped and the skeleton looked like
    // a different screen. The bar heights now match the real label (12px) and
    // value (24px) too, so nothing shifts when the numbers land.
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
        {cards.map((_, i) => (
          <div key={i} className="p-2.5 bg-white rounded-lg border border-gray-200">
            <div className="h-2.5 w-2/3 rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer" />
            <div className="mt-1 h-5 w-1/2 rounded bg-gradient-to-r from-indigo-100 via-purple-200 to-indigo-100 bg-[length:200%_100%] animate-shimmer" />
            <div className="mt-1.5 h-2 w-1/3 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
      {cards.map(({ key, label, Icon, color, value, pct, note, hint, display, subText }) => {
        const c = COLOR_MAP[color];
        return (
          <div
            key={key}
            title={hint || undefined}
            className="p-2.5 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition"
          >
            {/* Icon moved INLINE with the label instead of a 44px badge on the
                right. That badge was eating the label's width, which is why five
                of the six read "Landed (All U…", "Form Submitt…", "Click → Disbu…"
                — the numbers were legible and the thing they measured was not.
                Full width for the label also lets the whole card get shorter. */}
            <p className="flex items-center gap-1 text-[10.5px] font-medium text-gray-500 min-w-0">
              <Icon size={11} className={`shrink-0 ${c.iconText}`} />
              <span className="truncate">{label}</span>
              {hint && <span className="text-gray-300 cursor-help shrink-0">ⓘ</span>}
            </p>
            <p className="mt-0.5 text-[19px] font-bold text-gray-900 leading-none tabular-nums">
              {display ?? value.toLocaleString()}
            </p>
            {subText ? (
              <p className="text-[10px] text-gray-500 mt-1 truncate">{subText}</p>
            ) : key !== "total" ? (
              <p className="text-[10px] text-gray-500 mt-1 truncate">
                <span
                  className={`font-semibold ${pct >= 50 ? "text-green-600" : pct >= 20 ? "text-amber-600" : "text-red-500"}`}
                >
                  {pct}%
                </span>{" "}
                of landed
                {note && <span className="text-emerald-700 font-semibold"> · {note}</span>}
              </p>
            ) : null}
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
  disbursedOn,
  onDisbursedOnChange,
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
  const advancedCount = [lender, medium, source, viewAllClicked, feedbackStatus, trackingEvent, disbursedOn]
    .filter((v) => v !== "" && v !== null && v !== undefined).length;
  // Opens itself when something inside is already set, so a filter carried in
  // from a previous view is never hidden behind a closed panel.
  const [moreOpen, setMoreOpen] = useState(advancedCount > 0);

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
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Filter by Stage
        </p>

        {/* Equal-width cells instead of free-flowing pills.
            As pills these were six different widths in six different colours,
            wrapping onto a second line — "Landed (All Users) 272,272" next to
            "Disbursed 5,592" — so nothing lined up and the eye had no column to
            follow. A fixed grid gives every stage the same box and puts all six
            counts in the same place, which is what makes a funnel readable.
            Colour is now carried by a small dot plus the active fill, not by
            painting every chip a different shade. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5">
          {STAGES.map(({ key, label, Icon, color }) => {
            const c = COLOR_MAP[color];
            const active = stage === key;
            const count = key === "" ? stageCounts.total : stageCounts[key];
            return (
              <button
                key={key || "all"}
                type="button"
                onClick={() => onStageChange(key)}
                title={label}
                className={`text-left rounded-lg border px-2.5 py-2 transition ${
                  active
                    ? `${c.pillActive} border-transparent shadow-sm`
                    : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className={`flex items-center gap-1 text-[10.5px] font-semibold truncate ${
                  active ? "text-white/90" : "text-gray-500"
                }`}>
                  <Icon size={11} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </span>
                <span className={`block mt-0.5 text-[16px] font-bold leading-none tabular-nums ${
                  active ? "text-white" : "text-gray-900"
                }`}>
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

        {/* Search — fixed width, not `grow`.
            With `grow basis-[200px]` it ate every pixel the other controls left
            over, so on a wide screen a box for a phone number stretched half the
            bar. The actions take `ml-auto` below instead, which keeps the row
            balanced without handing the slack to one input. */}
        <div className="basis-[240px] shrink-0">
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

        {/* ADVANCED FILTERS, collapsed by default.

            Ten controls sat in one wrapping grid — Search, Date, Selected Lender,
            Medium, Source, View All, Feedback, Incred Activity, Disbursed On,
            Refresh — every one wearing the same tiny uppercase label, so finding
            the one you wanted meant reading all ten. Search and Date carry almost
            all the use, so they stay out; the rest open on demand, and the toggle
            carries a count so a filter can never sit on unnoticed. */}
        {moreOpen && (
          <div className="w-full flex flex-wrap items-end gap-2 pt-2.5 mt-1 border-t border-gray-100">
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
            InCred Activity
          </label>
          <select
            value={trackingEvent || ""}
            onChange={(e) => onTrackingChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="">All Activity</option>
            <option value="incred_pending_modal_shown">InCred: Pending Offer Shown</option>
            <option value="incred_pending_modal_apply_clicked">InCred: Pending Offer Apply Clicked</option>
            <option value="incred_offer_model_clicked">InCred: Offer Card Clicked</option>
          </select>
        </div>

        {/* Disbursal-date filter — independent of the landing-date filter above:
            this one windows the DISBURSAL itself, so "Disbursed Today" lists the
            people whose money went out today, whenever they first landed. */}
        <div className="basis-[150px] shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Disbursed On
          </label>
          <select
            value={disbursedOn || ""}
            onChange={(e) => onDisbursedOnChange(e.target.value)}
            className="w-full px-1.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
            title="Filters by the DISBURSAL date (not the landing date)"
          >
            <option value="">Any time</option>
            <option value="today">Disbursed Today</option>
            {/* <option value="yesterday">Disbursed Yesterday</option> */}
          </select>
        </div>

          </div>
        )}

        {/* Inline actions — no label */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border transition ${
              advancedCount
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            title="Lender, medium, source, feedback and other filters"
          >
            <SlidersHorizontal size={12} />
            More filters
            {advancedCount > 0 && (
              <span className="ml-0.5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold tabular-nums">
                {advancedCount}
              </span>
            )}
            <ChevronDown size={12} className={`transition ${moreOpen ? "rotate-180" : ""}`} />
          </button>

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
// Set only while navigating out to a detail page, so the two reasons this page
// mounts can be told apart: coming BACK from a row (restore what they had) vs
// opening it fresh (start clean).
//
// This matters for speed, not just tidiness. The cache warmer keeps the DEFAULT
// view hot. A sticky leftover filter — one earlier click on "Today" plus a stage
// chip — means every fresh visit asks for a combination nobody warmed, so the
// page pays the full cold query and the warming does nothing for it.
const RETURN_FLAG_KEY = "userTrack:returning";

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
  // Read AND clear together, so only the very next mount counts as a return.
  const isReturning = useMemo(() => {
    try {
      const flag = sessionStorage.getItem(RETURN_FLAG_KEY);
      sessionStorage.removeItem(RETURN_FLAG_KEY);
      return flag === "1";
    } catch {
      return false;
    }
  }, []);

  const DEFAULT_QUERY = {
    page_no: 1,
    limit: 10,
    search: "",
    // Open on Today — the working view is what came in today, not the 272k
    // all-time list. Widen with All/Yesterday/Custom from the chips.
    filter_date: "today",
    startDate: null,
    endDate: null,
    stage: "",
    lender: "",
    medium: "",
    source: "",
    viewAllClicked: "",
    feedbackStatus: "",
    trackingEvent: "",
    disbursedOn: "",
  };

  const [query, setQuery] = useState(() => {
    // Restore only when coming back from a detail row — the one case this
    // persistence was built for. Any other way in starts on DEFAULT_QUERY,
    // which is deliberately the exact view the warmer keeps hot.
    if (!isReturning) return DEFAULT_QUERY;
    if (!persisted?.query || typeof persisted.query !== "object") return DEFAULT_QUERY;
    return { ...DEFAULT_QUERY, ...persisted.query };
  });

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
    disbursed: 0,
    disbursed_amount: 0,
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
        disbursedOn: query.disbursedOn || undefined,
      });

      if (res?.data?.success) {
        setRawData(res.data.data || []);
        setTotalCount(res.data.pagination?.total || 0);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else {
        // ToastNotification.error("Failed to load users");
        console.log(`Failed to load users`);
      }
    } catch (err) {
      console.error(err);
      // ToastNotification.error("Failed to load users");
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
    query.disbursedOn,
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
  const onDisbursedOnChange = useCallback(
    (disbursedOn) => setQuery((prev) => ({ ...prev, disbursedOn, page_no: 1 })),
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
        disbursedOn: "",
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
    query.trackingEvent ||
    query.disbursedOn
  );

  const handleView = (row) => {
    try {
      sessionStorage.setItem(RETURN_FLAG_KEY, "1");
    } catch {
      // Private-mode browsers throw; losing the flag only means the list comes
      // back on defaults, which is the safe direction.
    }
    navigate(`/user-track/${encodeURIComponent(row.phone)}`, {
      state: { row },
    });
  };

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async ({ otp, hashedOtp } = {}) => {
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

    // Export uses the table's OWN applied date filter (mirrors the list fetch:
    // filter_date -> type, startDate/endDate -> fromDate/toDate). No date filter
    // means export the whole current view — never abort.
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
    }

    downloadFileName =
      query.startDate && query.endDate
        ? `User_Track_${query.startDate}_to_${query.endDate}.csv`
        : `User_Track_${date}_${time}.csv`;

    if (query.search) urlParams.append("search", query.search);
    if (query.stage) urlParams.append("stage", query.stage);
    if (query.lender) urlParams.append("lender", query.lender);
    if (query.medium) urlParams.append("medium", query.medium);
    if (query.source) urlParams.append("source", query.source);
    if (query.viewAllClicked) urlParams.append("viewAllClicked", query.viewAllClicked);
    if (query.disbursedOn) urlParams.append("disbursedOn", query.disbursedOn);

    try {
      // Fetch the CSV as a blob (instead of firing an <a download> and forgetting)
      // so exportLoading stays TRUE for the whole server-side build — the modal's
      // "Export in progress" view holds until the file is actually ready — and a
      // server error surfaces as a clean toast instead of dumping raw JSON in a tab.
      const url = `${import.meta.env.VITE_API_URL}/user-track/export?${urlParams.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch (_) { /* non-JSON error body */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objUrl;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objUrl);
      ToastNotification.success("Export ready — downloaded!");
      setExportModalOpen(false);
    } catch (err) {
      console.error(err);
      ToastNotification.error(err.message || "Export failed!");
    } finally {
      setExportLoading(false);
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
        disbursedOn={query.disbursedOn}
        onDisbursedOnChange={onDisbursedOnChange}
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
        // No onSearch here on purpose. The filter bar above already has a search
        // box wired to this same debouncedSearch, so passing it again rendered a
        // SECOND box driving the identical query — two inputs, one filter, and
        // whichever you typed in last silently won.
        onRefresh={fetchUsers}
        onExport={handleExport}
        title="User Track"
        // This page has its own filter bar above, so MainTable's filter row held
        // nothing but Refresh, Export and Search — a whole band for three
        // controls. Inline mode folds them into the title row instead.
        headerActionsInline
        // Seed page + search from restored state so returning from a detail
        // page keeps the same page/search (without these MainTable resets both
        // to page 1 / empty on mount).
        initialPagination={{ pageIndex: Math.max(0, query.page_no - 1), pageSize: query.limit }}
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