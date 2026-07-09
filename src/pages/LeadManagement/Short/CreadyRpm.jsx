import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  Users,
  MousePointerClick,
  ShieldCheck,
  FileCheck,
  Megaphone,
  CalendarDays,
  Wallet,
  IndianRupee,
  Search,
  RefreshCw,
  X,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { getCreadyRpm, getCreadyRpmAfPaidTrend } from "../../../api-services/Modules/Leads";
import { shortUserTrackColumn } from "../../../components/TableHeader";
import ToastNotification from "../../../components/Notification/ToastNotification";
import ExportModal from "../../../components/ExportModal";
import MainTable from "../../../components/Table/MainTable";
import PremiumPageLoader from "../../../components/PremiumPageLoader";
const debounce = (fn, delay) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

// Filter-by-stage pills. Landed / OTP Verified / Form Submitted / Lender Selected
// Click are real backend stages (clickable filters); Application Date and AF Paid
// are placeholders ("soon") — their cards have data but they aren't table stages.
const STAGES = [
  { key: "", label: "Landed", Icon: Users, color: "blue" },
  { key: "otp_verified", label: "OTP Verified", Icon: ShieldCheck, color: "amber" },
  { key: "form_submitted", label: "Form Submitted", Icon: FileCheck, color: "purple" },
  { key: "lender_clicked", label: "Lender Selected", Icon: MousePointerClick, color: "green" },
  { key: "application", label: "Application Date Count", Icon: CalendarDays, color: "amber", placeholder: true },
  { key: "afpaid", label: "AF Paid", Icon: Wallet, color: "purple", placeholder: true },
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

// Short month labels for the AF-trend axis / range header. Parse the ISO
// 'YYYY-MM-DD' by hand so there's no UTC off-by-one from new Date().
const AF_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDay = (iso) => {
  if (!iso) return "";
  const [, m, d] = String(iso).split("-");
  return `${d} ${AF_MONTHS[Number(m) - 1] || ""}`;
};

// Local (browser) ISO date helpers for the modal's date-range presets.
const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const todayISO = () => isoOf(new Date());
const daysAgoISO = (n) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  return isoOf(dt);
};

const AF_PRESETS = [
  { k: "today", label: "Today" },
  { k: "yest", label: "Yesterday" },
  { k: "7d", label: "7 Days" },
  { k: "30d", label: "30 Days" },
  { k: "90d", label: "90 Days" },
];

const AfTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-gray-900">{p.label}</p>
      <p className="mt-0.5 text-gray-600">
        AF Paid: <span className="font-semibold text-purple-600">{p.count}</span>
      </p>
      <p className="text-gray-600">
        Amount:{" "}
        <span className="font-semibold text-green-600">
          ₹{Number(p.amount).toLocaleString("en-IN")}
        </span>
      </p>
    </div>
  );
};

// Date-wise AF Paid trend, shown when the AF Paid / AF Amount card is clicked.
// Fetches its own data (the dashboard's custom range if one is set, else the
// last 30 days). Degrades to an empty state if the RapidMoney replica is down.
const AfPaidTrendModal = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [preset, setPreset] = useState("today"); // 'today' | 'yest' | '7d' | '30d' | '90d' | 'custom'
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Every time the modal opens, default to Today (a fresh AF snapshot). The user
  // can then switch presets or pick a custom range.
  useEffect(() => {
    if (!open) return;
    setPreset("today");
    setCustomFrom("");
    setCustomTo("");
  }, [open]);

  // Effective ISO range sent to the API. A partial custom range (only one date)
  // falls back to null → the backend then uses its own last-30-days window.
  const { effFrom, effTo } = useMemo(() => {
    if (preset === "custom") {
      return { effFrom: customFrom || null, effTo: customTo || null };
    }
    if (preset === "today") {
      const t = todayISO();
      return { effFrom: t, effTo: t };
    }
    if (preset === "yest") {
      const y = daysAgoISO(1);
      return { effFrom: y, effTo: y };
    }
    const n = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    return { effFrom: daysAgoISO(n - 1), effTo: todayISO() };
  }, [preset, customFrom, customTo]);

  // A single-day range (Today / Yesterday / one-day custom) is shown hour-wise
  // so the curve has shape; multi-day ranges stay date-wise.
  const granularity = effFrom && effTo && effFrom === effTo ? "hour" : "day";

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    getCreadyRpmAfPaidTrend({
      fromDate: effFrom || undefined,
      toDate: effTo || undefined,
      granularity,
    })
      .then((res) => {
        if (!cancelled) setData(res?.data || null);
      })
      .catch(() => {
        if (!cancelled) setData({ series: [], totalCount: 0, totalAmount: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, effFrom, effTo, granularity]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const series = data?.series || [];
  const hasData = series.some((d) => (d.count || 0) > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                AF Paid — Date-wise trend
              </h3>
              <p className="text-xs text-gray-500">
                {data?.from
                  ? data.from === data.to
                    ? `${fmtDay(data.from)}${data.granularity === "hour" ? " · hour-wise" : ""}`
                    : `${fmtDay(data.from)} – ${fmtDay(data.to)}`
                  : "Daily AF collected"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Date filter — presets + custom range (independent of the dashboard). */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
          {AF_PRESETS.map((p) => (
            <button
              key={p.k}
              onClick={() => setPreset(p.k)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                preset === p.k
                  ? "border-purple-600 bg-purple-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-purple-300"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              max={customTo || todayISO()}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setPreset("custom");
              }}
              className={`rounded-md border px-2 py-1 text-xs text-gray-700 ${
                preset === "custom" ? "border-purple-300" : "border-gray-200"
              }`}
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={todayISO()}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setPreset("custom");
              }}
              className={`rounded-md border px-2 py-1 text-xs text-gray-700 ${
                preset === "custom" ? "border-purple-300" : "border-gray-200"
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 py-3">
          <div className="rounded-xl bg-purple-50 px-4 py-3">
            <p className="text-[11px] font-medium text-purple-700">Total AF Paid</p>
            <p className="text-xl font-bold text-gray-900">
              {(data?.totalCount || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-green-50 px-4 py-3">
            <p className="text-[11px] font-medium text-green-700">Total AF Amount</p>
            <p className="text-xl font-bold text-gray-900">
              ₹{(data?.totalAmount || 0).toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="px-3 pb-5 pt-1">
          {loading ? (
            <div className="flex h-80 items-center justify-center text-gray-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : hasData ? (
            <ResponsiveContainer width="100%" height={380}>
              {data?.granularity === "hour" ? (
                // Single day (Today / Yesterday) → hour-wise smooth area line.
                <AreaChart data={series} margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="afPaidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} width={32} />
                  <Tooltip content={<AfTooltip />} cursor={{ stroke: "#8b5cf6", strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#afPaidGrad)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              ) : (
                // Multi-day range → date-wise bar graph.
                <BarChart data={series} margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} width={32} />
                  <Tooltip content={<AfTooltip />} cursor={{ fill: "rgba(139,92,246,0.08)" }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex h-80 flex-col items-center justify-center text-gray-400">
              <CalendarDays size={28} className="mb-2 opacity-40" />
              <p className="text-sm">Is period me koi AF Paid nahi mila</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCards = ({ summary, loading }) => {
  const [afOpen, setAfOpen] = useState(false);
  const landed = summary.total || 0;
  const lenderSelected = summary.lender_clicked || 0;
  const campaign = summary.campaign || {};
  const application = summary.application || {};
  const afPaid = summary.afPaid || {};
  const otp = summary.otp_verified || 0;
  const form = summary.form_submitted || 0;
  const pct = (n) => (landed ? Math.round((n / landed) * 100) : 0);

  // 5-step RapidMoney funnel. Only "Landed" and "Lender Selected Click" have real
  // data today; Campaign Click / Application Date / AF Paid are placeholders
  // ("Coming soon") until the backend feeds them.
  const cards = [
    {
      key: "campaign",
      label: "Campaign Click",
      value: campaign.clicked || 0,
      Icon: Megaphone,
      color: "slate",
      breakdown: campaign, // hover → total/sent/delivered/clicked/failed
    },
    {
      key: "landed",
      label: "Landed",
      value: landed,
      Icon: Users,
      color: "blue",
      isBase: true,
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
      key: "form",
      label: "Form Submitted",
      value: form,
      Icon: FileCheck,
      color: "purple",
      pct: pct(form),
    },
    {
      key: "lender",
      label: "Lender Selected",
      value: lenderSelected,
      Icon: MousePointerClick,
      color: "green",
      pct: pct(lenderSelected),
    },
    {
      key: "application",
      label: "Application Date Count",
      value: application.count || 0,
      Icon: CalendarDays,
      color: "amber",
      pct: pct(application.count || 0),
    },
    {
      key: "afpaid",
      label: "AF Paid",
      value: afPaid.count || 0,
      Icon: Wallet,
      color: "purple",
      pct: pct(afPaid.count || 0),
      clickable: true,
      onClick: () => setAfOpen(true),
    },
    {
      key: "afamount",
      label: "AF Amount",
      // AF Amount = AF Paid count × ₹150 (preformatted ₹ string).
      value: `₹${((afPaid.count || 0) * 120).toLocaleString("en-IN")}`,
      Icon: IndianRupee,
      color: "green",
      // clickable: true,
      // onClick: () => setAfOpen(true),
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2.5 mb-4">
        {cards.map((_, i) => (
          <div
            key={i}
            className="p-3 bg-white rounded-lg border border-gray-200 animate-pulse"
          >
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-7 bg-gray-300 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2.5 mb-4">
      {cards.map(({ key, label, Icon, color, value, pct, placeholder, isBase, breakdown, clickable, onClick }) => {
        const c = COLOR_MAP[color];
        return (
          <div
            key={key}
            onClick={clickable ? onClick : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onClick();
                    }
                  }
                : undefined
            }
            className={`group relative flex items-start justify-between p-3 bg-white rounded-lg border transition hover:shadow-md ${
              clickable
                ? "cursor-pointer border-purple-200 ring-1 ring-transparent hover:border-purple-400 hover:ring-purple-100"
                : "border-gray-200"
            }`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-500 leading-tight min-h-[26px] flex items-start">
                {label}
              </p>
              {placeholder ? (
                <>
                  <p className="mt-0.5 text-xl font-bold text-gray-300">—</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Coming soon</p>
                </>
              ) : (
                <>
                  <p className="mt-0.5 text-xl font-bold text-gray-900">
                    {value.toLocaleString()}
                  </p>
                  {!isBase && pct !== undefined && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      <span
                        className={`font-semibold ${pct >= 50 ? "text-green-600" : pct >= 20 ? "text-amber-600" : "text-red-500"}`}
                      >
                        {pct}%
                      </span>{" "}
                      of landed
                    </p>
                  )}
                  {breakdown && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-indigo-600 bg-indigo-50 ring-1 ring-indigo-100 whitespace-nowrap group-hover:bg-indigo-600 group-hover:text-white group-hover:ring-indigo-600 transition-colors">
                      <MousePointerClick size={10} className="shrink-0 animate-pulse group-hover:animate-none" />
                      <span>Hover for details</span>
                    </span>
                  )}
                  {clickable && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-purple-600 bg-purple-50 ring-1 ring-purple-100 whitespace-nowrap group-hover:bg-purple-600 group-hover:text-white group-hover:ring-purple-600 transition-colors">
                      <TrendingUp size={10} className="shrink-0" />
                      <span>View trend</span>
                    </span>
                  )}
                </>
              )}
            </div>
            <div
              className={`p-1.5 rounded-lg ${c.iconBg} ${c.iconText} shrink-0 ml-1.5`}
            >
              <Icon size={16} />
            </div>

            {/* Hover breakdown — Campaign Click card (total/sent/delivered/clicked/failed) */}
            {breakdown && (
              <div className="pointer-events-none absolute left-3 top-full mt-1 z-20 hidden group-hover:block bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
                {[
                  ["Total", "total"],
                  ["Sent", "sent"],
                  ["Delivered", "delivered"],
                  ["Read", "read"],
                  ["Clicked", "clicked"],
                  ["Failed", "failed"],
                ].map(([lbl, k]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-0.5">
                    <span className="text-gray-300">{lbl}</span>
                    <span className="font-semibold tabular-nums">
                      {(Number(breakdown[k]) || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                {/* Price — preformatted ₹ string (wc_credit, in ₹ lakh) */}
                <div className="flex items-center justify-between gap-4 py-0.5 mt-0.5 pt-1 border-t border-white/15">
                  <span className="text-gray-300">Price</span>
                  <span className="font-semibold tabular-nums text-emerald-300">
                    {breakdown.price || "₹0"}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
      <AfPaidTrendModal open={afOpen} onClose={() => setAfOpen(false)} />
    </>
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
  onRefresh,
  onClearAll,
  hasFilters,
}) => {
  const [rng, setRng] = useState({
    start: startDate || "",
    end: endDate || "",
  });
  const [searchValue, setSearchValue] = useState(search || "");
  // Custom-range inputs stay hidden until "Custom" is picked, so the date filter
  // is compact by default. Auto-open when a range is active, close when cleared.
  const [showCustom, setShowCustom] = useState(!!(startDate && endDate));

  useEffect(() => {
    setRng({ start: startDate || "", end: endDate || "" });
    setShowCustom(!!(startDate && endDate));
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
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
          {STAGES.map(({ key, label, Icon, color, placeholder }) => {
            const c = COLOR_MAP[color];
            const active = stage === key;
            const count = key === "" ? stageCounts.total : stageCounts[key];
            // Placeholder steps have no data yet → disabled, "soon" badge.
            if (placeholder) {
              return (
                <button
                  key={key}
                  type="button"
                  disabled
                  title="Coming soon"
                  className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border bg-white border-gray-200 text-gray-400 cursor-not-allowed whitespace-nowrap opacity-70"
                >
                  <Icon size={12} />
                  <span>{label}</span>
                  <span className="inline-flex items-center justify-center h-4 px-1 rounded-full text-[9px] font-bold bg-gray-100 text-gray-400">
                    soon
                  </span>
                </button>
              );
            }
            return (
              <button
                key={key || "all"}
                type="button"
                onClick={() => onStageChange(key)}
                className={`inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border whitespace-nowrap transition ${
                  active
                    ? `${c.pillActive} border-transparent`
                    : `bg-white ${c.pillIdle}`
                }`}
              >
                <Icon size={12} />
                <span>{label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-0 h-4 px-1 rounded-full text-[9px] font-bold ${
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

      {/* Single horizontal filter row — mirrors the Short User Track:
          Search | Date | Custom | Medium | Source | Refresh/Clear. */}
      <div className="flex items-end gap-2.5 overflow-x-auto pb-1">
        {/* Search */}
        <div className="w-[260px] shrink-0">
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

        {/* Date — presets + collapsible custom range (compact by default) */}
        <div className="shrink-0">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Date
          </label>
          <div className="flex items-center gap-2">
            {/* Presets + a "Custom" toggle that reveals the range inputs */}
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-100 p-0.5">
              {[
                { v: "", l: "All" },
                { v: "today", l: "Today" },
                { v: "yesterday", l: "Yest" },
              ].map(({ v, l }) => {
                const active = !showCustom && dateType === v;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => { onDateTypeChange(v); setShowCustom(false); }}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                      active
                        ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-100"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowCustom((s) => !s)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                  showCustom
                    ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-100"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <CalendarDays size={12} /> Custom
              </button>
            </div>

            {/* Range inputs — only when Custom is open */}
            {showCustom && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1 transition focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-400">
                <input
                  type="date"
                  value={rng.start}
                  max={rng.end || undefined}
                  onChange={(e) =>
                    setRng((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="w-[104px] bg-transparent text-xs text-gray-700 outline-none"
                />
                <span className="text-gray-300">→</span>
                <input
                  type="date"
                  value={rng.end}
                  min={rng.start || undefined}
                  onChange={(e) =>
                    setRng((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="w-[104px] bg-transparent text-xs text-gray-700 outline-none"
                />
                <button
                  type="button"
                  onClick={applyRange}
                  disabled={!rng.start || !rng.end}
                  className="ml-0.5 rounded-md bg-gradient-to-r from-purple-600 to-violet-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:from-purple-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Go
                </button>
              </div>
            )}
          </div>
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
const FILTERS_STORAGE_KEY = "creadyRpm:filters:v1";

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

const CreadyRpm = () => {
  const navigate = useNavigate();

  // Hydrate filters / pagination from sessionStorage when returning from a
  // detail page (computed once on first render).
  const persisted = useMemo(() => loadPersistedState(), []);

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
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
      const res = await getCreadyRpm({
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        perPage: query.limit,
        currentPage: query.page_no,
        search: query.search,
        stage: query.stage || undefined,
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
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
      })),
    [],
  );

  const hasFilters = !!(
    query.search ||
    query.filter_date ||
    query.startDate ||
    query.endDate ||
    query.stage
  );

  const handleView = (row) => {
    navigate(`/cready-rpm/${encodeURIComponent(row.phone)}`, {
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
      downloadFileName = `Cready_RPM_${date}_${time}.csv`;
    } else if (mode === "range" && startDate && endDate) {
      urlParams.append("fromDate", startDate);
      urlParams.append("toDate", endDate);
      downloadFileName = `Cready_RPM_${startDate}_to_${endDate}.csv`;
    } else {
      ToastNotification.error("Please select valid export filter.");
      setExportLoading(false);
      return;
    }

    if (query.search) urlParams.append("search", query.search);
    if (query.stage) urlParams.append("stage", query.stage);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/cready-rpm/export?${urlParams.toString()}`;
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
          title="Loading Cready RPM"
          brandLabel="Live RapidMoney Funnel"
          icon={Users}
          phrases={[
            'Tracking user journeys…',
            'Mapping funnel stages…',
            'Computing conversion rates…',
            'Polishing the table…',
          ]}
          tiles={[
            { label: 'Total users' },
            { label: 'OTP verified' },
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
        <h1 className="text-xl font-bold text-gray-900">Cready RPM</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track every RapidMoney short-ticket user's journey — who landed on the
          page, verified OTP, submitted the form, and clicked a lender. Grouped by
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
        headerActionsInline
        title="Cready RPM"
        initialPagination={{ pageIndex: Math.max(0, query.page_no - 1), pageSize: query.limit }}
        initialSearch={query.search}
      />
    </div>
  );
};

export default CreadyRpm;
