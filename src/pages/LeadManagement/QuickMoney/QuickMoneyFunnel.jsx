import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Search, X, TrendingDown,
  Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import quickmoneyLogo from "../../../assets/quickmoney.png";
import {
  getQuickMoneyFunnel,
  getQuickMoneyStageLeads,
} from "../../../api-services/Modules/QuickMoneyFunnel";

// QuickMoney funnel over the separate QuickMoney_internal DB
// (public.v_total_application_report). Flow: UTM lead sent -> AF paid -> Disbursed.

const fmtNum = (n) => (Number(n) || 0).toLocaleString("en-IN");
const compactInr = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};
const pctOf = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const atsOf = (amt, cnt) => (cnt > 0 ? Math.round((Number(amt) || 0) / cnt) : 0);

// Local (IST for the user) YYYY-MM-DD — signup_day_ist is an IST date, so bucket
// the presets on the browser's local day, not UTC.
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const buildPresets = () => {
  const now = new Date();
  const today = isoLocal(now);
  const back = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return isoLocal(d); };
  const mStart = isoLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  return [
    { key: "all", label: "All time", from: "", to: "" },
    { key: "today", label: "Today", from: today, to: today },
    { key: "7d", label: "7 days", from: back(6), to: today },
    { key: "30d", label: "30 days", from: back(29), to: today },
    { key: "mtd", label: "This month", from: mStart, to: today },
  ];
};

// ---- Fashionable date-range picker (no deps) -------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad2 = (n) => String(n).padStart(2, "0");
const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const fmtChip = (s) => { const d = parseISO(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : "…"; };

function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parseISO(from) || new Date());
  const [hover, setHover] = useState(null); // hovered day while picking the 2nd date
  const [draft, setDraft] = useState({ from, to }); // in-picker selection; committed only on "Done"
  const y = view.getFullYear();
  const mo = view.getMonth();
  const firstWeekday = new Date(y, mo, 1).getDay();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayIso = isoLocal(new Date());
  const hasRange = !!(from || to);

  const openIt = () => { setView(parseISO(from) || parseISO(to) || new Date()); setHover(null); setDraft({ from, to }); setOpen(true); };
  const shift = (delta) => setView(new Date(y, mo + delta, 1));
  // Clicking a day only updates the DRAFT — no API call until "Done".
  const clickDay = (day) => {
    const s = `${y}-${pad2(mo + 1)}-${pad2(day)}`;
    setDraft((d) => (!d.from || (d.from && d.to)) ? { from: s, to: "" } : (s < d.from ? { from: s, to: d.from } : { from: d.from, to: s }));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openIt())}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition ${hasRange ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
      >
        <Calendar size={13} className={hasRange ? "text-emerald-600" : "text-gray-400"} />
        {hasRange ? `${fmtChip(from)} – ${fmtChip(to)}` : "Custom range"}
        {hasRange && (
          <X size={12} onClick={(e) => { e.stopPropagation(); onChange("", ""); }} className="ml-0.5 rounded text-emerald-500 hover:bg-emerald-100" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl ring-1 ring-black/5">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => shift(-1)} className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"><ChevronLeft size={16} /></button>
              <span className="text-[12.5px] font-semibold text-gray-700">{MONTHS_FULL[mo]} {y}</span>
              <button type="button" onClick={() => shift(1)} className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"><ChevronRight size={16} /></button>
            </div>
            <div className="mb-1 grid grid-cols-7 text-center text-[9.5px] font-semibold uppercase tracking-wide text-gray-300">
              {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
              {cells.map((day, i) => {
                if (!day) return <span key={`b${i}`} />;
                const s = `${y}-${pad2(mo + 1)}-${pad2(day)}`;
                // Highlight the DRAFT selection; while picking the 2nd date, preview
                // the band up to the hovered day.
                const end = draft.to || (draft.from && !draft.to ? hover : null);
                let lo = draft.from, hi = end;
                if (draft.from && end && draft.from > end) { lo = end; hi = draft.from; }
                const isStart = !!lo && s === lo;
                const isEnd = !!hi && s === hi;
                const inRange = !!lo && !!hi && s > lo && s < hi;
                const edge = isStart || isEnd;
                const isToday = s === todayIso;
                let cls;
                if (isStart && isEnd) cls = "rounded-lg bg-emerald-600 font-semibold text-white";
                else if (isStart) cls = "rounded-l-lg bg-emerald-600 font-semibold text-white";
                else if (isEnd) cls = "rounded-r-lg bg-emerald-600 font-semibold text-white";
                else if (inRange) cls = "bg-emerald-100 text-emerald-700";
                else cls = "rounded-lg text-gray-600 hover:bg-gray-100";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => clickDay(day)}
                    onMouseEnter={() => setHover(s)}
                    className={`flex h-8 items-center justify-center text-[11.5px] tabular-nums transition-colors ${cls} ${isToday && !edge && !inRange ? "rounded-lg ring-1 ring-inset ring-emerald-300" : ""}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <button type="button" onClick={() => setDraft({ from: "", to: "" })} className="text-[11px] font-medium text-gray-400 transition hover:text-gray-600">Clear</button>
              <button type="button" onClick={() => { onChange(draft.from, draft.to || draft.from); setOpen(false); }} className="rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-gray-800">Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const ACCENT = {
  slate: "text-slate-700", indigo: "text-indigo-600", amber: "text-amber-600",
  emerald: "text-emerald-600", rose: "text-rose-600",
};
const DOT = {
  slate: "bg-slate-400", indigo: "bg-indigo-500", amber: "bg-amber-500",
  emerald: "bg-emerald-500", rose: "bg-rose-500",
};

// Columns shown in the drill modal (the per-lead detail list). `right` right-aligns
// numeric cells; order is left-to-right as rendered.
const DRILL_COLS = [
  { key: "custId", label: "Cust ID", sticky: true },
  { key: "applicationId", label: "App ID" },
  { key: "appDate", label: "App Date" },
  { key: "name", label: "Name", strong: true },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "age", label: "Age", right: true },
  { key: "pan", label: "PAN" },
  { key: "sourcingSource", label: "Sourcing" },
  { key: "medium", label: "External Src", type: "chip" },
  { key: "appStatus", label: "App Status", type: "appstatus" },
  { key: "loanStatus", label: "Loan Status" },
  { key: "afPaid", label: "AF Paid", type: "afpaid" },
  { key: "afDate", label: "AF Fee Date" },
  { key: "processingFee", label: "Proc. Fee", right: true },
  { key: "loanAmount", label: "Loan Amt", right: true },
  { key: "interestRate", label: "Int. Rate", right: true },
  { key: "interestAmount", label: "Int. Amt", right: true },
  { key: "bankName", label: "Bank" },
  { key: "bankAccount", label: "Bank A/C" },
  { key: "lender", label: "Lender" },
  { key: "signupDay", label: "Signup" },
];

export default function QuickMoneyFunnel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastLoaded, setLastLoaded] = useState(null);

  const [medium, setMedium] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Drill modal
  const [drill, setDrill] = useState(null); // { key, label }
  const [drillData, setDrillData] = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillPage, setDrillPage] = useState(1);
  const [drillSearch, setDrillSearch] = useState("");
  const [searchBox, setSearchBox] = useState("");

  const presets = useMemo(buildPresets, []);
  const activePreset = presets.find((p) => p.from === fromDate && p.to === toDate)?.key || "custom";

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await getQuickMoneyFunnel({ medium, fromDate, toDate });
      setData(res?.data?.data || null);
      setLastLoaded(new Date());
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load QuickMoney funnel");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [medium, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const loadDrill = useCallback(async () => {
    if (!drill) return;
    setDrillLoading(true);
    try {
      const res = await getQuickMoneyStageLeads({
        stage: drill.key, medium, fromDate, toDate, search: drillSearch, currentPage: drillPage, perPage: 20,
      });
      setDrillData(res?.data?.data || null);
    } catch {
      setDrillData(null);
    } finally {
      setDrillLoading(false);
    }
  }, [drill, medium, fromDate, toDate, drillSearch, drillPage]);

  useEffect(() => { loadDrill(); }, [loadDrill]);

  const summary = data?.summary || {};
  const matrix = data?.matrix || [];
  const mediums = data?.mediums || [];
  const maxSent = Math.max(1, ...matrix.map((h) => h.sent || 0));

  const applyPreset = (p) => { setFromDate(p.from); setToDate(p.to); };
  const openDrill = (key, label) => {
    setDrill({ key, label });
    setDrillPage(1);
    setDrillSearch("");
    setSearchBox("");
  };

  const totals = matrix.reduce(
    (a, h) => ({
      sent: a.sent + (h.sent || 0),
      afPaid: a.afPaid + (h.afPaid || 0),
      afNotPaid: a.afNotPaid + (h.afNotPaid || 0),
      disbursed: a.disbursed + (h.disbursed || 0),
      rejected: a.rejected + (h.rejected || 0),
      amt: a.amt + (h.disbursedAmount || 0),
    }),
    { sent: 0, afPaid: 0, afNotPaid: 0, disbursed: 0, rejected: 0, amt: 0 }
  );

  // KPI metrics for the divided strip — one clean row, read left-to-right as the
  // funnel (Sent 100% -> AF Paid -> Disbursed). Each drills except the value cell.
  const METRICS = [
    { key: "sent", label: "Sent", value: fmtNum(summary.sent), sub: "leads via UTM", accent: "slate", drill: true },
    { key: "af_paid", label: "AF Paid", value: fmtNum(summary.afPaid), sub: `${summary.afPaidPct ?? 0}% of sent`, accent: "indigo", drill: true },
    { key: "af_not_paid", label: "AF Not Paid", value: fmtNum(summary.afNotPaid), sub: `${summary.afNotPaidPct ?? 0}% of sent`, accent: "amber", drill: true },
    { key: "disbursed", label: "Disbursed", value: fmtNum(summary.disbursed), sub: `${summary.disbursedPct ?? 0}% of sent`, accent: "emerald", drill: true },
    { key: "rejected", label: "Rejected", value: fmtNum(summary.rejected), sub: `${summary.rejectedPct ?? 0}% of sent`, accent: "rose", drill: true },
    { key: "value", label: "Disbursed Value", value: compactInr(summary.disbursedAmount), sub: `ATS ${compactInr(summary.ats)}`, accent: "emerald", drill: false },
  ];

  const pill = (active) =>
    `rounded-lg px-2 py-1 text-[11.5px] font-medium transition-all ${
      active ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/60 px-4 py-2 md:px-6">
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img src={quickmoneyLogo} alt="QuickMoney" className="h-9 w-auto object-contain" />
          <span className="h-6 w-px bg-gray-200" />
          <div>
            <h1 className="text-[14px] font-bold leading-none tracking-tight text-gray-700">Funnel</h1>
            <p className="mt-1 text-[10.5px] text-gray-400">UTM lead sent → AF paid → disbursed</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {lastLoaded && !loading && (
            <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-400 ring-1 ring-gray-200 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Updated {lastLoaded.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter bar — single compact row (wraps only when narrow) */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-gray-200/70 bg-white px-3 py-1.5 shadow-sm">
        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-gray-400">Period</span>
        {presets.map((p) => (
          <button key={p.key} onClick={() => applyPreset(p)} className={pill(activePreset === p.key)}>{p.label}</button>
        ))}
        <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t); }} />
        <span className="mx-0.5 h-4 w-px bg-gray-200" />
        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-gray-400">Source</span>
        <button onClick={() => setMedium("all")} className={pill(medium === "all")}>
          All <span className="tabular-nums opacity-60">{fmtNum(mediums.reduce((a, m) => a + (m.count || 0), 0))}</span>
        </button>
        {mediums.map((m) => (
          <button key={m.medium} onClick={() => setMedium(m.medium)} className={pill(medium === m.medium)}>
            {m.medium} <span className="tabular-nums opacity-60">{fmtNum(m.count)}</span>
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12.5px] text-rose-700">{err}</div>
      )}

      {/* KPI strip — one clean divided row, read left-to-right as the funnel */}
      <div className="mb-2.5 flex flex-wrap overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm divide-x divide-gray-100">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => m.drill && openDrill(m.key, m.label)}
            className={`flex min-w-[128px] flex-1 flex-col gap-1 px-4 py-3 text-left transition ${m.drill ? "hover:bg-gray-50" : "cursor-default"}`}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <span className={`h-1.5 w-1.5 rounded-full ${DOT[m.accent]}`} /> {m.label}
            </span>
            <span className={`text-[21px] font-bold leading-none tabular-nums ${ACCENT[m.accent]}`}>{loading ? "…" : m.value}</span>
            <span className="text-[10.5px] text-gray-400">{loading ? "" : m.sub}</span>
          </button>
        ))}
      </div>

      {/* Analysis — daily breakdown */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
          <TrendingDown size={14} className="text-gray-400" />
          <h2 className="text-[12.5px] font-semibold text-gray-800">By day</h2>
          <span className="ml-auto pr-1 text-[10.5px] text-gray-400">{fmtNum(matrix.length)} days · signup day (IST)</span>
        </div>

          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[12.5px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50/95 text-left text-[10px] uppercase tracking-wider text-gray-400 backdrop-blur">
                  <th className="sticky left-0 z-20 bg-gray-50/95 px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Sent</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-indigo-500">AF Paid</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-amber-500">AF Not Paid</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-emerald-600">Disbursed</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-emerald-600">Disb. ₹</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-emerald-600">ATS</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-rose-500">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">Loading…</td></tr>
                ) : matrix.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">No activity in this window.</td></tr>
                ) : (
                  matrix.map((h) => (
                    <tr key={h.date} className="border-b border-gray-50 transition hover:bg-emerald-50/40">
                      <td className="sticky left-0 z-[1] bg-white px-5 py-2 font-semibold text-gray-700 whitespace-nowrap">
                        <div>{h.date}</div>
                        <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${(h.sent / maxSent) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right align-top font-semibold tabular-nums text-gray-800">{fmtNum(h.sent)}</td>
                      <td className="px-3 py-2 text-right align-top tabular-nums text-gray-600">
                        {fmtNum(h.afPaid)}
                        <div className="text-[9.5px] tabular-nums text-indigo-400">{pctOf(h.afPaid, h.sent)}%</div>
                      </td>
                      <td className="px-3 py-2 text-right align-top tabular-nums text-amber-700">
                        {fmtNum(h.afNotPaid)}
                        <div className="text-[9.5px] tabular-nums text-amber-400">{pctOf(h.afNotPaid, h.sent)}%</div>
                      </td>
                      <td className="px-3 py-2 text-right align-top tabular-nums text-gray-600">
                        {fmtNum(h.disbursed)}
                        <div className="text-[9.5px] tabular-nums text-emerald-500">{pctOf(h.disbursed, h.sent)}%</div>
                      </td>
                      <td className="px-3 py-2 text-right align-top font-semibold tabular-nums text-emerald-700 whitespace-nowrap">{compactInr(h.disbursedAmount)}</td>
                      <td className="px-3 py-2 text-right align-top tabular-nums text-emerald-700 whitespace-nowrap">
                        {h.disbursed > 0 ? compactInr(atsOf(h.disbursedAmount, h.disbursed)) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-top tabular-nums text-gray-600">
                        {fmtNum(h.rejected)}
                        <div className="text-[9.5px] tabular-nums text-rose-400">{pctOf(h.rejected, h.sent)}%</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {matrix.length > 0 && !loading && (
                <tfoot>
                  <tr className="bg-gray-50 font-bold text-gray-700">
                    <td className="sticky left-0 z-[1] border-t-2 border-gray-200 bg-gray-50 px-5 py-2.5 text-[11px] uppercase tracking-wide">Total</td>
                    <td className="border-t-2 border-gray-200 px-3 py-2.5 text-right tabular-nums">{fmtNum(totals.sent)}</td>
                    <td className="border-t-2 border-gray-200 px-3 py-2.5 text-right tabular-nums">
                      {fmtNum(totals.afPaid)}
                      <div className="text-[9.5px] font-semibold tabular-nums text-indigo-500">{pctOf(totals.afPaid, totals.sent)}%</div>
                    </td>
                    <td className="border-t-2 border-gray-200 px-3 py-2.5 text-right tabular-nums text-amber-700">
                      {fmtNum(totals.afNotPaid)}
                      <div className="text-[9.5px] font-semibold tabular-nums text-amber-500">{pctOf(totals.afNotPaid, totals.sent)}%</div>
                    </td>
                    <td className="border-t-2 border-gray-200 px-3 py-2.5 text-right tabular-nums text-emerald-700">
                      {fmtNum(totals.disbursed)}
                      <div className="text-[9.5px] font-semibold tabular-nums text-emerald-600">{pctOf(totals.disbursed, totals.sent)}%</div>
                    </td>
                    <td className="border-t-2 border-gray-200 px-3 py-2.5 text-right tabular-nums text-emerald-700 whitespace-nowrap">{compactInr(totals.amt)}</td>
                    <td className="border-t-2 border-gray-200 px-3 py-2.5 text-right tabular-nums text-emerald-700 whitespace-nowrap">
                      {totals.disbursed > 0 ? compactInr(atsOf(totals.amt, totals.disbursed)) : "—"}
                    </td>
                    <td className="border-t-2 border-gray-200 px-3 py-2.5 text-right tabular-nums text-rose-600">
                      {fmtNum(totals.rejected)}
                      <div className="text-[9.5px] font-semibold tabular-nums text-rose-500">{pctOf(totals.rejected, totals.sent)}%</div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
      </div>

      {/* Drill modal */}
      {drill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setDrill(null)}>
          <div className="flex max-h-[85vh] w-full max-w-[94vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
              <h3 className="text-[14px] font-bold text-gray-800">{drill.label} leads</h3>
              {drillData && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{fmtNum(drillData.total)}</span>}
              {medium !== "all" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">{medium}</span>}
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1">
                  <Search size={13} className="text-gray-400" />
                  <input
                    value={searchBox}
                    onChange={(e) => setSearchBox(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setDrillPage(1); setDrillSearch(searchBox.trim()); } }}
                    placeholder="name / mobile / app id"
                    className="w-44 text-[12px] outline-none"
                  />
                </div>
                <button onClick={() => setDrill(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-max text-[11.5px]">
                <thead className="sticky top-0 z-10 bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    {DRILL_COLS.map((c) => (
                      <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-semibold ${c.right ? "text-right" : ""} ${c.sticky ? "sticky left-0 z-20 border-r border-gray-200 bg-gray-50" : ""}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drillLoading ? (
                    <tr><td colSpan={DRILL_COLS.length} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
                  ) : !drillData || drillData.data.length === 0 ? (
                    <tr><td colSpan={DRILL_COLS.length} className="px-4 py-12 text-center text-gray-400">No leads.</td></tr>
                  ) : (
                    drillData.data.map((r, i) => (
                      <tr key={`${r.applicationId}-${i}`} className={`border-b border-gray-100 transition ${i % 2 ? "bg-gray-50" : "bg-white"} hover:bg-indigo-50`}>
                        {DRILL_COLS.map((c) => {
                          const v = r[c.key];
                          const empty = v === null || v === undefined || v === "";
                          let content;
                          if (empty) content = <span className="text-gray-300">—</span>;
                          else if (c.type === "afpaid")
                            content = <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${v === "Yes" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>{v}</span>;
                          else if (c.type === "appstatus") {
                            const t = v === "Disbursed" ? "bg-emerald-50 text-emerald-700" : v === "Rejected" ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600";
                            content = <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t}`}>{v}</span>;
                          } else if (c.type === "chip")
                            content = <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">{v}</span>;
                          else content = v;
                          return (
                            <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${c.right ? "text-right tabular-nums" : ""} ${c.sticky ? "sticky left-0 z-[1] border-r border-gray-200 bg-inherit font-semibold text-gray-700" : c.strong ? "font-medium text-gray-800" : "text-gray-600"}`}>{content}</td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {drillData && drillData.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5">
                <span className="text-[11px] text-gray-400">Page {drillData.currentPage} of {drillData.totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={drillPage <= 1}
                    onClick={() => setDrillPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={drillPage >= drillData.totalPages}
                    onClick={() => setDrillPage((p) => Math.min(drillData.totalPages, p + 1))}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
