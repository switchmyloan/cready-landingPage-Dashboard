import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import {
  Scale, TrendingUp, TrendingDown, Calendar, RefreshCw, Download,
  IndianRupee, Layers, Gauge, HelpCircle, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import ToastNotification from "@components/Notification/ToastNotification";
import PremiumLoader from "../../components/PremiumLoader";
import { getComparison } from "../../api-services/Modules/Comparison";

// ── formatting ──────────────────────────────────────────────────────────────
const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtInr = (rs) => {
  const n = Number(rs) || 0;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const SCOPES = [
  { key: "high", label: "High Ticket" },
  { key: "short", label: "Short Ticket" },
  { key: "vyapar", label: "Vyapar" },
];

// A +/- delta chip with semantic color (green up / red down / grey flat).
const Delta = ({ pct, invert = false, suffix = "%" }) => {
  if (pct === null || pct === undefined) return <span className="text-[11px] text-gray-400">n/a</span>;
  const up = pct > 0, down = pct < 0;
  const good = invert ? down : up;
  const tone = pct === 0 ? "text-gray-500 bg-gray-100" : good ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50";
  const Icon = pct === 0 ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${tone}`}>
      <Icon size={11} /> {pct > 0 ? "+" : ""}{pct}{suffix}
    </span>
  );
};

const KpiCard = ({ label, Icon, tone, current, prior, pct, invert }) => (
  <div className={`flex-1 min-w-[190px] rounded-xl border px-4 py-3 shadow-sm bg-white ${tone}`}>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500 inline-flex items-center gap-1.5">{Icon} {label}</span>
      <Delta pct={pct} invert={invert} />
    </div>
    <p className="text-[24px] leading-none font-extrabold text-gray-900">{current}</p>
    <p className="text-[11px] text-gray-500 mt-1">prior: <span className="font-semibold text-gray-700">{prior}</span></p>
  </div>
);

const UnknownPanel = ({ title, reason }) => (
  <div className="flex-1 min-w-[220px] rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-3">
    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
      <HelpCircle size={13} />
      <span className="text-[11px] font-bold uppercase tracking-wide">{title}</span>
      <span className="ml-auto text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">UNKNOWN</span>
    </div>
    <p className="text-[11px] text-gray-500 leading-relaxed">{reason}</p>
  </div>
);

const csvEscape = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const Comparison = () => {
  const [scope, setScope] = useState("high");
  const [asOf, setAsOf] = useState(""); // '' → today (backend default)
  const [includeInProgress, setIncludeInProgress] = useState(false);
  const [metric, setMetric] = useState("amount"); // 'amount' | 'count'
  const [cumulative, setCumulative] = useState(false);
  const [lenderMode, setLenderMode] = useState("pct"); // 'pct' | 'abs'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getComparison({ scope, asOf: asOf || undefined, includeInProgress });
      if (res?.data?.success) { setData(res.data.data); setFetchedAt(new Date()); }
      else ToastNotification.error("Failed to load comparison");
    } catch (err) {
      console.error(err);
      ToastNotification.error("Failed to load comparison");
    } finally {
      setLoading(false);
    }
  }, [scope, asOf, includeInProgress]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const w = data?.windows;
  const chartData = useMemo(() => {
    if (!data?.daily) return [];
    return data.daily.map((d) => ({
      dom: d.dom,
      current: cumulative ? (metric === "amount" ? d.current.cumAmount : d.current.cumCount) : (metric === "amount" ? d.current.amount : d.current.count),
      prior: cumulative ? (metric === "amount" ? d.prior.cumAmount : d.prior.cumCount) : (metric === "amount" ? d.prior.amount : d.prior.count),
    }));
  }, [data, metric, cumulative]);

  const exportLenders = () => {
    if (!data?.byLender?.length) return;
    const head = ["Lender", "Status", "Cur Count", "Cur Amount", "Cur Share %", "Cur Rank", "Prior Count", "Prior Amount", "Prior Share %", "Prior Rank", "Amount Δ", "Amount Δ%", "Share Δpp", "Rank Δ", "Low Base"];
    const lines = [head.map(csvEscape).join(",")];
    data.byLender.forEach((r) => lines.push([
      r.lender, r.status, r.current.count, r.current.amount, r.current.shareAmtPct, r.current.rank,
      r.prior.count, r.prior.amount, r.prior.shareAmtPct, r.prior.rank,
      r.amountAbs, r.amountPct === null ? "" : r.amountPct, r.shareAmtDeltaPp, r.rankDelta === null ? "" : r.rankDelta, r.lowBase,
    ].map(csvEscape).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comparison_${scope}_${w?.asOf || ""}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const statusChip = (s) => {
    const map = { active: "bg-gray-100 text-gray-600", new: "bg-emerald-50 text-emerald-700", churned: "bg-rose-50 text-rose-700" };
    return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${map[s] || map.active}`}>{s}</span>;
  };

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden">
      <Toaster />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl px-5 py-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 grid place-items-center text-white shadow"><Scale size={22} /></div>
          <div>
            <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">Comparison</h1>
            <p className="text-[12px] text-gray-600 font-semibold">{w?.headline || "Month-over-month disbursements"}</p>
            <p className="text-[10.5px] text-gray-400">
              Prior month, same elapsed days · disbursement-date (calendar) view
              {w?.priorTruncated && <span className="text-amber-600 font-semibold"> · prior month shorter, capped to {w.priorMonthLength} days</span>}
              {fetchedAt && <span> · updated {fetchedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>
        </div>
        <button onClick={exportLenders} disabled={!data?.byLender?.length}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 transition">
          <Download size={15} /> Export lenders
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1"><Layers size={13} className="inline mb-0.5" /> Scope:</span>
        {SCOPES.map((s) => (
          <button key={s.key} onClick={() => setScope(s.key)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${scope === s.key ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
            {s.label}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-gray-200" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5"><Calendar size={13} /> As of:</span>
        <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-400" />
        <label className="text-[12px] text-gray-600 inline-flex items-center gap-1.5 ml-1 cursor-pointer select-none">
          <input type="checkbox" checked={includeInProgress} onChange={(e) => setIncludeInProgress(e.target.checked)} className="accent-indigo-600" />
          include in-progress day
        </label>
        <button onClick={fetchData} className="ml-auto px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition inline-flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="py-20"><PremiumLoader size="md" label="Building comparison…" /></div>
      ) : data?.empty ? (
        <div className="py-16 text-center text-gray-400 italic bg-white border border-gray-200 rounded-xl">
          No complete days yet this month — pick an earlier as-of date or enable “include in-progress day”.
        </div>
      ) : !data ? (
        <div className="py-16 text-center text-gray-400 italic bg-white border border-gray-200 rounded-xl">No data.</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="flex flex-wrap gap-3 mb-3">
            <KpiCard label="Disbursals" Icon={<Layers size={13} />} tone="border-indigo-100"
              current={fmtNum(data.kpis.count.current)} prior={fmtNum(data.kpis.count.prior)} pct={data.kpis.count.pct} />
            <KpiCard label="Amount" Icon={<IndianRupee size={13} />} tone="border-emerald-100"
              current={fmtInr(data.kpis.amount.current)} prior={fmtInr(data.kpis.amount.prior)} pct={data.kpis.amount.pct} />
            <KpiCard label="Avg Ticket" Icon={<IndianRupee size={13} />} tone="border-violet-100"
              current={fmtInr(data.kpis.avgTicket.current)} prior={fmtInr(data.kpis.avgTicket.prior)} pct={data.kpis.avgTicket.pct} />
            <div className="flex-1 min-w-[200px] rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-amber-600 inline-flex items-center gap-1.5"><Gauge size={13} /> Pace (proj. full month)</span>
                <Delta pct={data.pace.amountPct} />
              </div>
              <p className="text-[20px] leading-none font-extrabold text-gray-900">{fmtInr(data.pace.projectedAmount)}</p>
              <p className="text-[11px] text-gray-500 mt-1">prior full: <span className="font-semibold text-gray-700">{fmtInr(data.pace.priorFullAmount)}</span> · {fmtNum(data.pace.projectedCount)} vs {fmtNum(data.pace.priorFullCount)}</p>
            </div>
          </div>

          {/* Trend chart */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-[14px] font-bold text-gray-800">Daily comparison — aligned by day of month</h3>
              <div className="flex items-center gap-1.5">
                {[["amount", "Amount"], ["count", "Count"]].map(([k, l]) => (
                  <button key={k} onClick={() => setMetric(k)} className={`px-2.5 py-1 rounded text-[11px] font-semibold ${metric === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
                ))}
                <span className="mx-1 h-4 w-px bg-gray-200" />
                {[["false", "Daily"], ["true", "Cumulative"]].map(([k, l]) => (
                  <button key={k} onClick={() => setCumulative(k === "true")} className={`px-2.5 py-1 rounded text-[11px] font-semibold ${String(cumulative) === k ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="dom" tick={{ fontSize: 11 }} label={{ value: "Day of month", position: "insideBottom", offset: -3, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => metric === "amount" ? (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v) : fmtNum(v)} width={54} />
                  <Tooltip formatter={(v) => metric === "amount" ? fmtInr(v) : fmtNum(v)} labelFormatter={(l) => `Day ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="current" name={w?.current?.label || "Current"} stroke="#6366f1" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="prior" name={w?.prior?.label || "Prior"} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lender comparison table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-[14px] font-bold text-gray-800">Lender breakdown</h3>
              <div className="flex items-center gap-1.5">
                {[["pct", "Δ %"], ["abs", "Δ abs"]].map(([k, l]) => (
                  <button key={k} onClick={() => setLenderMode(k)} className={`px-2.5 py-1 rounded text-[11px] font-semibold ${lenderMode === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Lender</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600">Cur Amount</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Prior</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Δ Amount</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Share (Δpp)</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Rank</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Cur / Prior Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byLender.map((r, i) => (
                    <tr key={r.lender} className={`border-b border-gray-50 ${i % 2 ? "bg-gray-50" : "bg-white"} hover:bg-indigo-50/40`}>
                      <td className="px-4 py-2 text-[12.5px] font-semibold text-gray-800 whitespace-nowrap">{r.lender} {r.status !== "active" && statusChip(r.status)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{fmtInr(r.current.amount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtInr(r.prior.amount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {lenderMode === "pct"
                          ? (r.amountPct === null ? <span className="text-[11px] text-gray-400" title="prior base below minimum">low base</span> : <Delta pct={r.amountPct} />)
                          : <span className={`font-semibold ${r.amountAbs >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{r.amountAbs >= 0 ? "+" : ""}{fmtInr(r.amountAbs)}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 whitespace-nowrap">
                        {r.current.shareAmtPct}% <span className={`text-[10px] font-semibold ${r.shareAmtDeltaPp >= 0 ? "text-emerald-600" : "text-rose-600"}`}>({r.shareAmtDeltaPp >= 0 ? "+" : ""}{r.shareAmtDeltaPp})</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-gray-800">#{r.current.rank ?? "—"}</span>
                        {r.rankDelta !== null && r.rankDelta !== 0 && (
                          <span className={`ml-1 text-[10px] font-bold ${r.rankDelta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.rankDelta > 0 ? `▲${r.rankDelta}` : `▼${Math.abs(r.rankDelta)}`}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtNum(r.current.count)} / {fmtNum(r.prior.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
              Amount = Σ disb_amt (reconciles with the Disbursal Dashboard). Share = of current-window amount; Δpp = share change vs prior.
              Rank by amount (▲ = moved up). <b>low base</b> = prior disbursals below the minimum for a reliable %.
              <span className="text-emerald-700 font-semibold"> new</span>/<span className="text-rose-700 font-semibold">churned</span> = present in only one window.
            </p>
          </div>

          {/* UNKNOWN sections — shown, not hidden, with the reason each is unavailable */}
          <div className="flex flex-wrap gap-3">
            <UnknownPanel title="Clicks & Conversion" reason={data.unavailable?.clicks} />
            <UnknownPanel title="Funnel (impr→appr)" reason={data.unavailable?.funnel} />
            <UnknownPanel title="Forecast" reason={data.unavailable?.forecast} />
            <UnknownPanel title="Anomaly detection" reason={data.unavailable?.anomaly} />
          </div>
        </>
      )}
    </div>
  );
};

export default Comparison;
