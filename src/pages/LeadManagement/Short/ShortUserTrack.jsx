import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  Users,
  UserX,
  ShieldCheck,
  FileCheck,
  FileX,
  MousePointerClick,
  Search,
  RefreshCw,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  IndianRupee,
  Percent,
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
    // Everyone who never submitted, whatever else they did — landed_only plus
    // OTP-verified-pending in one chip. It deliberately OVERLAPS those two rather
    // than being another step between them, because "who do we still need to chase
    // for the form" is the question being asked, and that answer spans both.
    key: "form_not_submitted",
    label: "Form Not Submitted",
    Icon: FileX,
    color: "rose",
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
  rose: {
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
    pillActive: "bg-rose-600 text-white",
    pillIdle: "border-rose-200 text-rose-700 hover:bg-rose-50",
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
  // No landedOnly/notSubmitted pair here by accident: "Form Not Submitted" is a
  // filter, not a funnel step — it spans Landed Only + OTP Pending, so it lives on
  // the chip row (which reads the summary directly) and NOT in the cards, where it
  // would stop the row adding up to Landed.
  const landedOnly = summary.landed_only || 0;
  const lender = summary.lender_clicked || 0;
  const disbursed = summary.disbursed || 0;
  const disbursedAmt = summary.disbursed_amount || 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  // Compact ₹ for the disbursed card's sub-line (₹5.61 L / ₹1.2 Cr).
  const fmtCompactInr = (n) => {
    const v = Number(n) || 0;
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    return `₹${Math.round(v).toLocaleString("en-IN")}`;
  };

  const cards = [
    {
      key: "total",
      label: "Landed",
      value: total,
      Icon: Users,
      color: "blue",
      pct: 100,
    },
    {
      // Funnel order, and a partition: these four add up to Landed exactly.
      // Landed Only had no card at all, which is why the row never reconciled
      // even before Form Not Submitted existed.
      key: "landed_only",
      label: "Landed Only",
      value: landedOnly,
      Icon: UserX,
      color: "slate",
      pct: pct(landedOnly),
    },
    {
      key: "otp",
      label: "OTP Pending",
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
      label: "Click → Disb.",
      value: disbursed,
      display: lender ? `${Math.round((disbursed / lender) * 1000) / 10}%` : "—",
      subText: lender
        ? `${disbursed.toLocaleString("en-IN")} of ${lender.toLocaleString("en-IN")} lender clicks`
        : "no lender clicks yet",
      Icon: Percent,
      color: "teal",
      hint: "Conversion rate — of the users who clicked through to a lender, how many ended up disbursed.",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-4">
        {cards.map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white rounded-xl border border-gray-200/80 animate-pulse"
          >
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-7 bg-gray-300 rounded w-2/3 mb-3" />
            <div className="h-1.5 bg-gray-200 rounded-full w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-4">
      {cards.map(({ key, label, Icon, color, value, pct, note, hint, display, subText }) => {
        const tint = COLOR_MAP[color] || COLOR_MAP.slate;
        return (
          <div
            key={key}
            title={hint || undefined}
            className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Label on a FIXED two-line box.
                Some labels wrap ("Form Submitted") and some don't ("Landed"), so
                without a reserved height every number sat at a different height
                across the row and the whole strip looked crooked. */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-tight min-h-[24px]">
                {label}
                {hint && <span className="ml-1 text-gray-300 cursor-help">ⓘ</span>}
              </p>
              {/* Colour lives here and nowhere else. Every card used to carry a
                  gradient stripe, a gradient icon, a coloured percentage AND a
                  gradient progress bar — seven of those side by side is noise, not
                  information. One tinted icon is enough to tell them apart. */}
              <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${tint.iconBg} ${tint.iconText}`}>
                <Icon size={15} />
              </span>
            </div>

            <p className="text-[22px] font-extrabold text-gray-900 leading-none tabular-nums">
              {display ?? value.toLocaleString("en-IN")}
            </p>

            {/* One footer line, same shape on every card, pinned to the bottom so
                the cards end level however long the label was. */}
            <p className="mt-auto pt-2 text-[10.5px] text-gray-400 truncate" title={subText || undefined}>
              {subText || (key === "total"
                ? "total users landed"
                : (
                  <>
                    <span className="font-semibold text-gray-600 tabular-nums">{pct}%</span>
                    {" of landed"}
                    {note && <span className="text-emerald-600 font-medium"> · {note}</span>}
                  </>
                ))}
            </p>
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
  // How many of the collapsed filters are set — drives the badge, and decides
  // whether the panel starts open so a filter carried in from a previous view is
  // never applied invisibly.
  const advancedCount = [lender, medium, source, feedbackStatus, disbursedOn]
    .filter((v) => v !== "" && v !== null && v !== undefined).length;
  const [moreOpen, setMoreOpen] = useState(advancedCount > 0);

  useEffect(() => {
    setRng({ start: startDate || "", end: endDate || "" });
  }, [startDate, endDate]);
  useEffect(() => {
    setSearchValue(search || "");
  }, [search]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4">
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Filter by Stage
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map(({ key, label, Icon, color }) => {
            const c = COLOR_MAP[color];
            const active = stage === key;
            const count = key === "" ? stageCounts.total : stageCounts[key];
            return (
              <button
                key={key || "all"}
                type="button"
                onClick={() => onStageChange(key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border transition ${
                  active
                    ? `${c.pillActive} border-transparent`
                    : `bg-white ${c.pillIdle}`
                }`}
              >
                <Icon size={12} />
                <span>{label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-[16px] px-1 rounded-full text-[9.5px] font-bold tabular-nums ${
                    active
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 text-gray-600"
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

        {/* Date — presets and the custom range live in ONE control: two labelled
            blocks used to take the width of three filters and still wrapped. The
            range applies as soon as both ends are picked, so the old "Go" button
            (and its dead-until-valid state) is gone. */}
        <div className="shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Date
          </label>
          <div className="inline-flex items-center rounded-md border border-gray-300 bg-white overflow-hidden divide-x divide-gray-200">
            {[
              { v: "", l: "All" },
              { v: "today", l: "Today" },
              { v: "yesterday", l: "Yest." },
            ].map(({ v, l }) => {
              const active = !rng.start && !rng.end && dateType === v;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => { setRng({ start: "", end: "" }); onDateTypeChange(v); }}
                  className={`px-2.5 py-1.5 text-xs font-medium transition ${
                    active ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {l}
                </button>
              );
            })}

            {/* custom range, inline with the presets */}
            <div className={`flex items-center gap-1 px-2 py-1 ${rng.start && rng.end ? "bg-purple-50" : ""}`}>
              <input
                type="date"
                value={rng.start}
                onChange={(e) => {
                  const start = e.target.value;
                  setRng((prev) => ({ ...prev, start }));
                  if (start && rng.end) onDateRangeChange(start, rng.end);
                }}
                className="w-[112px] px-1 py-0.5 text-[11px] text-gray-700 bg-transparent border-0 focus:outline-none"
              />
              <span className="text-gray-300 text-[11px]">→</span>
              <input
                type="date"
                value={rng.end}
                onChange={(e) => {
                  const end = e.target.value;
                  setRng((prev) => ({ ...prev, end }));
                  if (rng.start && end) onDateRangeChange(rng.start, end);
                }}
                className="w-[112px] px-1 py-0.5 text-[11px] text-gray-700 bg-transparent border-0 focus:outline-none"
              />
              {(rng.start || rng.end) && (
                <button
                  type="button"
                  onClick={() => { setRng({ start: "", end: "" }); onDateTypeChange(""); }}
                  title="Clear range"
                  className="text-gray-400 hover:text-rose-500 transition"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ADVANCED FILTERS, collapsed by default.

            Five selects — Selected Lender, Medium, Source, Feedback, Disbursed On —
            sat open permanently under Search and Date, wrapping onto a second row
            and pushing the table further down. Search and Date carry nearly all the
            use; the rest open on demand, and the toggle carries a count so an
            applied filter can never sit hidden behind a closed panel. */}
        {moreOpen && (
          <div className="w-full flex flex-wrap items-end gap-2 pt-2.5 mt-1 border-t border-gray-100">
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

        {/* Inline actions — More filters + Refresh + Clear */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border transition ${
              advancedCount
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            title="Lender, medium, source, feedback and disbursal-date filters"
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

// Persist filters + pagination across navigation (View → detail → back) so the
// user returns to the same filtered list instead of a reset-to-default one.
// sessionStorage scopes this to the current browser tab so it clears on close.
// v2: bumped so previously-persisted sessions (saved under the old "All" date
// default) are discarded and the new "today" default applies on next load.
const FILTERS_STORAGE_KEY = "shortUserTrack:filters:v2";
// Set only while navigating out to a detail page. It is what separates the two
// reasons this page mounts: coming BACK from a detail row (restore everything,
// date included) versus opening the page fresh (start on today).
//
// Without it the date was sticky for the whole tab session: one click on "All"
// and every later visit reopened on the full 270k list, which is why the page
// looked like it defaulted to All when the default was already today.
const RETURN_FLAG_KEY = "shortUserTrack:returning";

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
  // Read AND clear in one go, so a later plain visit is treated as fresh.
  const isReturning = useMemo(() => {
    try {
      const flag = sessionStorage.getItem(RETURN_FLAG_KEY);
      sessionStorage.removeItem(RETURN_FLAG_KEY);
      return flag === "1";
    } catch {
      return false;
    }
  }, []);

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
    filter_date: "today",
    startDate: null,
    endDate: null,
    stage: "",
    lender: "",
    medium: "",
    source: "",
    feedbackStatus: "",
    disbursedOn: "",
  };

  const [query, setQuery] = useState(() => {
    // Restore only when coming back from a detail row — the one case this
    // persistence was built for. Any other way in starts on DEFAULT_QUERY,
    // which is deliberately the exact view the warmer keeps hot. Carrying a
    // leftover filter into a fresh visit is what made warming useless: the page
    // asked for a combination nobody had warmed.
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

  const [mediumOptions, setMediumOptions] = useState([]);
  const [lenderOptions, setLenderOptions] = useState([]);

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
        console.log(`Failed to load users: ${res?.data?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      // ToastNotification.error("Failed to load users");
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
    query.disbursedOn,
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
        feedbackStatus: "",
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
    query.feedbackStatus ||
    query.disbursedOn
  );

  const handleView = (row) => {
    try {
      sessionStorage.setItem(RETURN_FLAG_KEY, "1");
    } catch {
      // Private-mode browsers can throw; losing the flag just means the date
      // resets to today on return, which is the safe direction.
    }
    navigate(`/short-user-track/${encodeURIComponent(row.phone)}`, {
      state: { row },
    });
  };

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async ({ otp, hashedOtp } = {}) => {
    setExportLoading(true);
    let urlParams = new URLSearchParams({ mode: "download", otp, hashedOtp });

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

    // Source the export's date window from the table's own applied filter
    // (mirrors the list fetch's type / fromDate / toDate mapping) instead of
    // the ExportModal, which no longer collects a date range. When neither a
    // preset nor a custom range is set, export the whole current view.
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
    }

    const downloadFileName =
      query.startDate && query.endDate
        ? `Short_User_Track_${query.startDate}_to_${query.endDate}.csv`
        : `Short_User_Track_${date}_${time}.csv`;

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
