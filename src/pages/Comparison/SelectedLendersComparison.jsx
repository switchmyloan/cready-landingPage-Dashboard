import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUp, ArrowDown, Minus, Info, RefreshCw, Search, AlertTriangle,
  ChevronDown, HelpCircle, Download,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  getSLCSummary, getSLCTrend, getSLCLenders, getSLCInsights,
} from "../../api-services/Modules/SelectedLendersComparison";

/* ────────────────────────────────────────────────────────────────────────────
   Design language: neutral slate base. Colour ONLY carries meaning
   (emerald = positive, rose = negative, amber = warning). Tabular numerals
   everywhere so figures align. Minimal borders, no gradients on data surfaces.
   ──────────────────────────────────────────────────────────────────────────── */

const nf = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN"));
const pctStr = (v) => (v === null || v === undefined ? "N/A" : `${v > 0 ? "+" : ""}${v}%`);
const ppStr = (v) => (v === null || v === undefined ? "N/A" : `${v > 0 ? "+" : ""}${v} pp`);

const MODES = [
  { key: "mtd", label: "MTD" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "prev_month", label: "Previous month" },
  { key: "custom", label: "Custom" },
];
const SCOPES = [
  { key: "high", label: "High Ticket" },
  { key: "short", label: "Short Ticket" },
  { key: "vyapar", label: "Vyapar" },
];

// Direction chip. `invert` flips which direction is "good".
const Trend = ({ value, unit = "%", invert = false, size = "sm" }) => {
  if (value === null || value === undefined)
    return <span className="text-[11px] text-slate-400 tabular-nums">N/A</span>;
  const up = value > 0, flat = value === 0;
  const good = invert ? !up && !flat : up && !flat;
  const tone = flat ? "text-slate-500" : good ? "text-emerald-600" : "text-rose-600";
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${tone} ${size === "lg" ? "text-[13px]" : "text-[11.5px]"}`}>
      <Icon size={size === "lg" ? 13 : 11} strokeWidth={2.5} />
      {value > 0 ? "+" : ""}{value}{unit === "pp" ? " pp" : "%"}
    </span>
  );
};

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded bg-slate-100 ${className}`} />
);

const Section = ({ title, subtitle, right, children, loading, error, onRetry, empty }) => (
  <section className="rounded-lg border border-slate-200 bg-white">
    <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
      <div>
        <h2 className="text-[13px] font-semibold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </header>
    <div className="p-4">
      {loading ? (
        <div className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-24 w-full" /></div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <p className="text-[12px] text-amber-900">{title} couldn’t be loaded. The rest of the dashboard is still available.</p>
          {onRetry && <button onClick={onRetry} className="text-[11px] font-semibold text-amber-800 hover:underline shrink-0">Retry</button>}
        </div>
      ) : empty ? (
        <p className="text-[12px] text-slate-500">{empty}</p>
      ) : children}
    </div>
  </section>
);

// KPI card — value dominant, comparison secondary, colour only on the delta.
const Kpi = ({ label, value, prior, delta, unit = "%", invert, hint, emphasis }) => (
  <div className={`rounded-lg border bg-white px-4 py-3 ${emphasis ? "border-slate-300" : "border-slate-200"}`}>
    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
      {label}
      {hint && <span title={hint}><Info size={11} className="text-slate-300" /></span>}
    </div>
    <div className={`mt-1 tabular-nums font-semibold text-slate-900 ${emphasis ? "text-[26px]" : "text-[22px]"} leading-none`}>{value}</div>
    <div className="mt-1.5 flex items-center gap-2">
      <Trend value={delta} unit={unit} invert={invert} />
      <span className="text-[11px] text-slate-400 tabular-nums">vs {prior}</span>
    </div>
  </div>
);

const SEV = {
  critical: "border-rose-200 bg-rose-50/60 text-rose-900",
  warning: "border-amber-200 bg-amber-50/60 text-amber-900",
  high: "border-amber-200 bg-amber-50/60 text-amber-900",
  medium: "border-slate-200 bg-slate-50 text-slate-700",
  positive: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const SelectedLendersComparison = () => {
  const [scope, setScope] = useState("high");
  const [mode, setMode] = useState("mtd");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metric, setMetric] = useState("clicks");
  const [cumulative, setCumulative] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "curClicks", dir: "desc" });
  const [openLender, setOpenLender] = useState(null);

  // Each section owns its own state so one slow/failed call never blocks another.
  const mk = () => ({ data: null, loading: true, error: false });
  const [summary, setSummary] = useState(mk());
  const [trend, setTrend] = useState(mk());
  const [lenders, setLenders] = useState(mk());
  const [insights, setInsights] = useState(mk());
  const [fetchedAt, setFetchedAt] = useState(null);

  const params = useMemo(() => {
    const p = { scope, mode };
    if (mode === "custom" && from && to) { p.from = from; p.to = to; }
    return p;
  }, [scope, mode, from, to]);

  const load = useCallback((fn, setter) => {
    setter((s) => ({ ...s, loading: true, error: false }));
    fn(params)
      .then((res) => {
        if (res?.data?.success) setter({ data: res.data.data, loading: false, error: false });
        else setter({ data: null, loading: false, error: true });
      })
      .catch(() => setter({ data: null, loading: false, error: true }));
  }, [params]);

  // Staged: priority KPIs first, heavier analytics after — all in parallel, none blocking.
  const loadAll = useCallback(() => {
    setFetchedAt(new Date());
    load(getSLCSummary, setSummary);
    load(getSLCTrend, setTrend);
    load(getSLCLenders, setLenders);
    load(getSLCInsights, setInsights);
  }, [load]);

  useEffect(() => {
    if (mode === "custom" && !(from && to)) return; // wait for a complete range
    loadAll();
  }, [loadAll, mode, from, to]);

  const w = summary.data?.windows || trend.data?.windows || lenders.data?.windows;
  const k = summary.data?.kpis;

  // ── derived: lender table view ──────────────────────────────────────────────
  const rows = useMemo(() => {
    let r = lenders.data?.lenders || [];
    if (q.trim()) r = r.filter((x) => x.lender.toLowerCase().includes(q.trim().toLowerCase()));
    const { key, dir } = sort;
    return [...r].sort((a, b) => {
      const av = a[key] ?? -Infinity, bv = b[key] ?? -Infinity;
      if (av === bv) return a.lender.localeCompare(b.lender);
      return dir === "desc" ? bv - av : av - bv;
    });
  }, [lenders.data, q, sort]);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  // ── derived: growth contribution (who moved the total) ──────────────────────
  const contribution = useMemo(() => {
    const all = lenders.data?.lenders || [];
    const totalAbs = lenders.data?.totals?.abs ?? 0;
    if (!all.length) return null;
    const movers = [...all].filter((x) => x.abs !== 0).sort((a, b) => Math.abs(b.abs) - Math.abs(a.abs));
    const top = movers.slice(0, 6);
    const rest = movers.slice(6).reduce((s, x) => s + x.abs, 0);
    const max = Math.max(...top.map((x) => Math.abs(x.abs)), Math.abs(rest), 1);
    return { totalAbs, top, rest, max };
  }, [lenders.data]);

  // ── derived: share shift (pp movers) ────────────────────────────────────────
  const shareShift = useMemo(() => {
    const all = lenders.data?.lenders || [];
    const moved = all.filter((x) => Math.abs(x.shareDeltaPp) >= 0.1);
    return {
      gainers: [...moved].sort((a, b) => b.shareDeltaPp - a.shareDeltaPp).slice(0, 5),
      losers: [...moved].sort((a, b) => a.shareDeltaPp - b.shareDeltaPp).slice(0, 5),
    };
  }, [lenders.data]);

  // ── derived: opportunities + actions (Observation → Reason → Action) ────────
  // Built ONLY from measured deltas already returned by the API. Every item is
  // labelled so a recommendation is never mistaken for a measured fact.
  const actions = useMemo(() => {
    const intel = lenders.data?.intelligence;
    if (!intel) return [];
    const out = [];
    (intel.atRisk || []).slice(0, 2).forEach((l) => out.push({
      priority: "high",
      observation: `${l.lender} clicks fell ${Math.abs(l.growthPct)}% (${nf(l.priClicks)} → ${nf(l.curClicks)}).`,
      reason: "A decline of this magnitude is outside normal daily variation.",
      action: "Check lender availability, card placement and eligibility rules for this lender.",
      impact: `Recovering prior volume would add ~${nf(Math.abs(l.abs))} clicks.`,
    }));
    (intel.fastestGrowing || []).slice(0, 1).forEach((l) => out.push({
      priority: "medium",
      observation: `${l.lender} grew ${l.growthPct}% on a base of ${nf(l.priClicks)} clicks.`,
      reason: "Growth is off a base large enough to be meaningful, not a small-denominator artefact.",
      action: "Evaluate increased exposure — only if downstream approval/disbursal quality holds.",
      impact: "Potential upside; validate downstream before scaling.",
    }));
    const c = intel.concentration;
    if (c && c.deltaPp >= 3) out.push({
      priority: "medium",
      observation: `Top 3 lenders now hold ${c.top3CurrentSharePct}% of clicks (${ppStr(c.deltaPp)}).`,
      reason: "Engagement is concentrating into fewer lenders.",
      action: "Monitor dependency risk; consider rebalancing card ordering.",
      impact: "Reduces exposure if one lender pauses or degrades.",
    });
    (intel.emerging || []).slice(0, 1).forEach((l) => out.push({
      priority: "low",
      observation: `${l.lender} is emerging (${l.status === "new" ? "no prior baseline" : `${nf(l.priClicks)} → ${nf(l.curClicks)}`}).`,
      reason: "Early acceleration from a small base.",
      action: "Watch for another period before acting — the base is small.",
      impact: "Informational.",
    }));
    return out;
  }, [lenders.data]);

  // ── derived: transparent performance score ─────────────────────────────────
  // Explicit, explainable formula over measured deltas only. Each component is
  // a 0–100 sub-score; the total is their average. Shown with its breakdown so
  // it is never an opaque number.
  const score = useMemo(() => {
    if (!k || !lenders.data) return null;
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
    // 50 = flat vs prior; ±2.5 points per 1% change, capped.
    const fromPct = (p) => (p === null || p === undefined ? null : clamp(50 + p * 2.5));
    const traffic = fromPct(k.customers.pct);
    const engagement = fromPct(k.lenderClicks.pct);
    const quality = k.engagementRate.pp === null ? null : clamp(50 + k.engagementRate.pp * 5);
    const conc = lenders.data.intelligence?.concentration;
    const stability = conc ? clamp(50 - conc.deltaPp * 3) : null; // rising concentration = risk
    const parts = [
      { label: "Traffic", value: traffic, basis: `Customers ${pctStr(k.customers.pct)}` },
      { label: "Engagement", value: engagement, basis: `Lender clicks ${pctStr(k.lenderClicks.pct)}` },
      { label: "Engagement quality", value: quality, basis: `Engagement rate ${ppStr(k.engagementRate.pp)}` },
      { label: "Stability", value: stability, basis: `Top-3 concentration ${ppStr(conc?.deltaPp)}` },
    ].filter((p) => p.value !== null);
    if (!parts.length) return null;
    return { total: Math.round(parts.reduce((s, p) => s + p.value, 0) / parts.length), parts };
  }, [k, lenders.data]);

  const exportLenders = () => {
    if (!rows.length) return;
    const head = ["Lender", "Status", "Current Clicks", "Previous Clicks", "Delta", "Growth %", "Current Users", "Previous Users", "Current Share %", "Previous Share %", "Share Delta pp", "Current Rank", "Previous Rank", "Rank Delta", "Contribution %"];
    const esc = (v) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head.join(",")];
    rows.forEach((r) => lines.push([r.lender, r.status, r.curClicks, r.priClicks, r.abs, r.growthPct ?? r.growthNote, r.curUsers, r.priUsers, r.curShare, r.priShare, r.shareDeltaPp, r.curRank, r.priRank, r.rankDelta, r.contributionPct].map(esc).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
    a.download = `lender_comparison_${scope}_${w?.current?.from || ""}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const chartData = useMemo(() => (trend.data?.series || []).map((d) => ({
    i: d.i, curDate: d.curDate, priorDate: d.priorDate,
    current: cumulative ? d.cumCurrent : (metric === "clicks" ? d.current : d.currentEngaged),
    prior: cumulative ? d.cumPrior : (metric === "clicks" ? d.prior : d.priorEngaged),
    pct: d.pct,
  })), [trend.data, metric, cumulative]);

  return (
    <div className="min-w-0 w-full max-w-full">
      {/* ── EXECUTIVE HEADER ─────────────────────────────────────────────── */}
      <header className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[19px] font-semibold tracking-tight text-slate-900">Performance Overview</h1>
            {w ? (
              <p className="mt-0.5 text-[13px] text-slate-600 tabular-nums">
                <span className="font-medium text-slate-900">{w.current?.label}</span>
                <span className="text-slate-400"> vs </span>
                <span className="font-medium text-slate-700">{w.prior?.label}</span>
                <span className="text-slate-400"> · {w.elapsedDays} {w.elapsedDays === 1 ? "day" : "days"}
                  {w.mode === "mtd" && w.monthLength ? ` of ${w.monthLength}` : ""} elapsed</span>
              </p>
            ) : <Skeleton className="mt-1 h-4 w-72" />}
            <p className="mt-1 text-[11px] text-slate-400">
              Comparing equivalent elapsed periods to ensure a fair month-on-month comparison.
              {w?.note && <span className="text-amber-600"> {w.note}</span>}
              {w?.capped && <span className="text-amber-600"> Previous month is shorter — window capped.</span>}
              {w?.durationMismatch && <span className="text-rose-600"> Durations differ ({w.current?.days} vs {w.prior?.days} days).</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fetchedAt && (
              <span className="text-[11px] text-slate-400 tabular-nums">
                Updated {fetchedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button onClick={loadAll} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 p-0.5">
            {SCOPES.map((s) => (
              <button key={s.key} onClick={() => setScope(s.key)}
                className={`px-2.5 py-1 text-[12px] font-medium rounded ${scope === s.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md border border-slate-200 p-0.5">
            {MODES.map((m) => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`px-2.5 py-1 text-[12px] font-medium rounded ${mode === m.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {m.label}
              </button>
            ))}
          </div>
          {mode === "custom" && (
            <div className="inline-flex items-center gap-1.5">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-700" />
              <span className="text-slate-400 text-[12px]">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-700" />
              <span className="text-[11px] text-slate-400">compared with the same dates one month earlier</span>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-4">
        {/* ── WHAT CHANGED ───────────────────────────────────────────────── */}
        <Section
          title="What changed"
          subtitle="Measured change, its reading, and what to check. Interpretations are derived — no cause is asserted."
          loading={insights.loading} error={insights.error} onRetry={() => load(getSLCInsights, setInsights)}
          empty={!insights.loading && !insights.error && !(insights.data?.insights || []).length ? "No material changes detected for this period." : null}
        >
          <ul className="grid gap-2 md:grid-cols-2">
            {(insights.data?.insights || []).map((it, i) => (
              <li key={i} className={`rounded-md border px-3 py-2.5 ${SEV[it.severity] || SEV.info}`}>
                <p className="text-[12.5px] font-medium leading-snug">{it.fact}</p>
                <p className="mt-1 text-[11.5px] opacity-80 leading-snug">{it.interpretation}</p>
                <p className="mt-1 text-[11px] opacity-60 leading-snug">{it.implication}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── KPI INTELLIGENCE ───────────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold text-slate-900">Key metrics</h2>
            {score && (
              <div className="group relative">
                <span className="cursor-help text-[11px] text-slate-500 tabular-nums">
                  Performance score <span className="font-semibold text-slate-900">{score.total}</span>/100
                  <HelpCircle size={11} className="ml-1 inline text-slate-300" />
                </span>
                <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg group-hover:block">
                  <p className="text-[11px] text-slate-500 mb-2">Average of the components below. 50 = flat vs the previous period; each component is derived only from measured deltas.</p>
                  {score.parts.map((p) => (
                    <div key={p.label} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-[11px] text-slate-600">{p.label} <span className="text-slate-400">· {p.basis}</span></span>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-900">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {summary.loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)}
            </div>
          ) : summary.error ? (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
              <p className="text-[12px] text-amber-900">Key metrics couldn’t be loaded.</p>
              <button onClick={() => load(getSLCSummary, setSummary)} className="text-[11px] font-semibold text-amber-800 hover:underline">Retry</button>
            </div>
          ) : k ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi emphasis label="Customers" value={nf(k.customers.current)} prior={nf(k.customers.prior)} delta={k.customers.pct}
                hint={summary.data?.definitions?.customers} />
              <Kpi emphasis label="Lender clicks" value={nf(k.lenderClicks.current)} prior={nf(k.lenderClicks.prior)} delta={k.lenderClicks.pct}
                hint={summary.data?.definitions?.lenderClicks} />
              <Kpi label="Engaged customers" value={nf(k.engagedCustomers.current)} prior={nf(k.engagedCustomers.prior)} delta={k.engagedCustomers.pct}
                hint={summary.data?.definitions?.engagedCustomers} />
              <Kpi label="Engagement rate" value={k.engagementRate.current === null ? "N/A" : `${k.engagementRate.current}%`}
                prior={k.engagementRate.prior === null ? "N/A" : `${k.engagementRate.prior}%`} delta={k.engagementRate.pp} unit="pp"
                hint={summary.data?.definitions?.engagementRate} />
              <Kpi label="Clicks / engaged customer" value={k.clicksPerEngaged.current ?? "N/A"} prior={k.clicksPerEngaged.prior ?? "N/A"} delta={k.clicksPerEngaged.pct} />
            </div>
          ) : null}
        </div>

        {/* ── PERFORMANCE TREND ──────────────────────────────────────────── */}
        <Section
          title="Performance trend"
          subtitle="Aligned day-by-day against the equivalent day of the previous period."
          loading={trend.loading} error={trend.error} onRetry={() => load(getSLCTrend, setTrend)}
          right={
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-md border border-slate-200 p-0.5">
                {[["clicks", "Clicks"], ["engaged", "Engaged"]].map(([kk, l]) => (
                  <button key={kk} onClick={() => setMetric(kk)} className={`px-2 py-0.5 text-[11px] font-medium rounded ${metric === kk ? "bg-slate-900 text-white" : "text-slate-600"}`}>{l}</button>
                ))}
              </div>
              <div className="inline-flex rounded-md border border-slate-200 p-0.5">
                {[[false, "Daily"], [true, "Cumulative"]].map(([v, l]) => (
                  <button key={String(v)} onClick={() => setCumulative(v)} className={`px-2 py-0.5 text-[11px] font-medium rounded ${cumulative === v ? "bg-slate-900 text-white" : "text-slate-600"}`}>{l}</button>
                ))}
              </div>
            </div>
          }
        >
          {trend.data && (
            <>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="i" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} tickFormatter={nf} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,.06)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const diff = (d.current ?? 0) - (d.prior ?? 0);
                        return (
                          <div className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm">
                            <p className="text-[11px] font-medium text-slate-900 tabular-nums">Day {d.i} · {d.curDate}</p>
                            <p className="text-[11px] text-slate-500 tabular-nums">vs {d.priorDate || "—"}</p>
                            <div className="mt-1.5 space-y-0.5 text-[11.5px] tabular-nums">
                              <p className="text-slate-900">Current <span className="font-semibold">{nf(d.current)}</span></p>
                              <p className="text-slate-500">Previous <span className="font-semibold">{nf(d.prior)}</span></p>
                              <p className={diff >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                {diff >= 0 ? "+" : ""}{nf(diff)} ({pctStr(d.pct)})
                              </p>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
                    <Line type="monotone" dataKey="current" name={w?.current?.label || "Current"} stroke="#0f172a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="prior" name={w?.prior?.label || "Previous"} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {trend.data.stats && (
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
                  <div><p className="text-[11px] text-slate-500">Avg / day (current)</p><p className="text-[14px] font-semibold tabular-nums text-slate-900">{nf(trend.data.stats.avgDailyCurrent)}</p></div>
                  <div><p className="text-[11px] text-slate-500">Avg / day (previous)</p><p className="text-[14px] font-semibold tabular-nums text-slate-900">{nf(trend.data.stats.avgDailyPrior)}</p></div>
                  <div><p className="text-[11px] text-slate-500">Best day</p><p className="text-[14px] font-semibold tabular-nums text-slate-900">{trend.data.stats.bestDay?.date || "—"} <Trend value={trend.data.stats.bestDay?.pct} /></p></div>
                  <div><p className="text-[11px] text-slate-500">Worst day</p><p className="text-[14px] font-semibold tabular-nums text-slate-900">{trend.data.stats.worstDay?.date || "—"} <Trend value={trend.data.stats.worstDay?.pct} /></p></div>
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── FUNNEL ─────────────────────────────────────────────────────── */}
        <Section title="Funnel" subtitle="Stages measurable in this dataset. Unavailable stages are shown, not hidden."
          loading={summary.loading} error={summary.error} onRetry={() => load(getSLCSummary, setSummary)}>
          {k && (
            <div className="space-y-2">
              {[
                { label: "Customers", cur: k.customers.current, pri: k.customers.prior, conv: null },
                { label: "Engaged customers", cur: k.engagedCustomers.current, pri: k.engagedCustomers.prior, conv: k.engagementRate },
                { label: "Lender clicks", cur: k.lenderClicks.current, pri: k.lenderClicks.prior, conv: null, note: "Event count — a customer may click several times." },
              ].map((s) => {
                const width = k.customers.current ? Math.max((s.cur / k.customers.current) * 100, 2) : 0;
                return (
                  <div key={s.label}>
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="font-medium text-slate-800">{s.label}</span>
                      <span className="tabular-nums text-slate-900">
                        {nf(s.cur)} <span className="text-slate-400">vs {nf(s.pri)}</span>
                        {s.conv && <span className="ml-2 text-slate-500">{s.conv.current}% <Trend value={s.conv.pp} unit="pp" /></span>}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-slate-100">
                      <div className="h-full rounded bg-slate-800" style={{ width: `${width}%` }} />
                    </div>
                    {s.note && <p className="mt-0.5 text-[10.5px] text-slate-400">{s.note}</p>}
                  </div>
                );
              })}
              <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5">
                <p className="text-[11.5px] font-medium text-slate-600">Applications · Approvals · Disbursals — <span className="text-amber-600">UNKNOWN</span></p>
                <p className="mt-0.5 text-[11px] text-slate-500">{summary.data?.unavailable?.applications}</p>
              </div>
            </div>
          )}
        </Section>

        {/* ── LENDER PERFORMANCE ─────────────────────────────────────────── */}
        <Section
          title="Lender performance"
          subtitle={lenders.data ? `${rows.length} lenders · growth withheld below ${lenders.data.minBaseClicks} prior clicks` : undefined}
          loading={lenders.loading} error={lenders.error} onRetry={() => load(getSLCLenders, setLenders)}
          right={
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lender"
                  className="w-40 rounded-md border border-slate-200 py-1 pl-6 pr-2 text-[12px] outline-none focus:border-slate-400" />
              </div>
              <button onClick={exportLenders} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                <Download size={11} /> CSV
              </button>
            </div>
          }
        >
          {lenders.data && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">Lender</th>
                    {[["curClicks", "Current"], ["priClicks", "Previous"], ["abs", "Δ"], ["growthPct", "Growth"], ["curShare", "Share"], ["shareDeltaPp", "Share Δ"], ["curRank", "Rank"]].map(([kk, l]) => (
                      <th key={kk} onClick={() => toggleSort(kk)}
                        className="cursor-pointer select-none py-2 px-3 text-right font-medium hover:text-slate-800">
                        {l}{sort.key === kk && <span className="ml-0.5">{sort.dir === "desc" ? "↓" : "↑"}</span>}
                      </th>
                    ))}
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Fragment key={r.lender}>
                      <tr key={r.lender} onClick={() => setOpenLender(openLender === r.lender ? null : r.lender)}
                        className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {r.lender}
                          {r.status === "new" && <span className="ml-1.5 rounded bg-emerald-50 px-1 py-px text-[9px] font-semibold uppercase text-emerald-700">New</span>}
                          {r.status === "inactive" && <span className="ml-1.5 rounded bg-slate-100 px-1 py-px text-[9px] font-semibold uppercase text-slate-500">Inactive</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{nf(r.curClicks)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{nf(r.priClicks)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${r.abs > 0 ? "text-emerald-600" : r.abs < 0 ? "text-rose-600" : "text-slate-400"}`}>{r.abs > 0 ? "+" : ""}{nf(r.abs)}</td>
                        <td className="px-3 py-2 text-right">
                          {r.growthPct === null
                            ? <span className="text-[11px] text-slate-400" title={r.growthNote || ""}>{r.status === "new" ? "New" : "N/A"}</span>
                            : <Trend value={r.growthPct} />}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.curShare}%</td>
                        <td className="px-3 py-2 text-right"><Trend value={r.shareDeltaPp} unit="pp" /></td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {r.curRank ? `#${r.curRank}` : "—"}
                          {r.rankDelta ? <span className={`ml-1 text-[10px] font-semibold ${r.rankDelta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.rankDelta > 0 ? `▲${r.rankDelta}` : `▼${Math.abs(r.rankDelta)}`}</span> : null}
                        </td>
                        <td className="pl-1 text-slate-300"><ChevronDown size={13} className={openLender === r.lender ? "rotate-180 transition" : "transition"} /></td>
                      </tr>
                      {openLender === r.lender && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="grid gap-3 text-[11.5px] sm:grid-cols-4">
                              <div><p className="text-slate-500">Engaged customers</p><p className="tabular-nums font-semibold text-slate-900">{nf(r.curUsers)} <span className="font-normal text-slate-400">vs {nf(r.priUsers)}</span></p></div>
                              <div><p className="text-slate-500">Clicks per customer</p><p className="tabular-nums font-semibold text-slate-900">{r.curUsers ? (r.curClicks / r.curUsers).toFixed(2) : "—"} <span className="font-normal text-slate-400">vs {r.priUsers ? (r.priClicks / r.priUsers).toFixed(2) : "—"}</span></p></div>
                              <div><p className="text-slate-500">Share of total</p><p className="tabular-nums font-semibold text-slate-900">{r.curShare}% <span className="font-normal text-slate-400">vs {r.priShare}%</span></p></div>
                              <div><p className="text-slate-500">Contribution to overall change</p><p className="tabular-nums font-semibold text-slate-900">{r.contributionPct === null ? "—" : `${r.contributionPct}%`}</p></div>
                            </div>
                            {r.growthNote && <p className="mt-2 text-[11px] text-amber-600">{r.growthNote}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {!rows.length && <tr><td colSpan={9} className="py-6 text-center text-[12px] text-slate-400">No lenders match “{q}”.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── GROWTH CONTRIBUTION + SHARE SHIFT ──────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Growth contribution" subtitle="Who moved the total — not who is biggest."
            loading={lenders.loading} error={lenders.error} onRetry={() => load(getSLCLenders, setLenders)}>
            {contribution && (
              <>
                <p className="mb-2 text-[12px] text-slate-600 tabular-nums">
                  Overall change <span className={`font-semibold ${contribution.totalAbs >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {contribution.totalAbs > 0 ? "+" : ""}{nf(contribution.totalAbs)}</span> clicks
                </p>
                <div className="space-y-1.5">
                  {contribution.top.map((x) => (
                    <div key={x.lender} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-[11.5px] text-slate-700">{x.lender}</span>
                      <div className="relative h-4 flex-1 rounded bg-slate-50">
                        <div className={`absolute top-0 h-full rounded ${x.abs >= 0 ? "bg-emerald-500/80 left-1/2" : "bg-rose-500/80 right-1/2"}`}
                          style={{ width: `${(Math.abs(x.abs) / contribution.max) * 50}%` }} />
                        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-200" />
                      </div>
                      <span className={`w-20 shrink-0 text-right text-[11.5px] tabular-nums ${x.abs >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {x.abs > 0 ? "+" : ""}{nf(x.abs)}
                      </span>
                    </div>
                  ))}
                  {contribution.rest !== 0 && (
                    <div className="flex items-center gap-2 pt-1 text-slate-400">
                      <span className="w-28 shrink-0 text-[11.5px]">Others</span>
                      <div className="h-4 flex-1" />
                      <span className="w-20 shrink-0 text-right text-[11.5px] tabular-nums">{contribution.rest > 0 ? "+" : ""}{nf(contribution.rest)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </Section>

          <Section title="Share shift" subtitle="Movement in share of total clicks, in percentage points."
            loading={lenders.loading} error={lenders.error} onRetry={() => load(getSLCLenders, setLenders)}>
            {lenders.data && (
              <div className="grid grid-cols-2 gap-4">
                {[["Gained", shareShift.gainers], ["Lost", shareShift.losers]].map(([title, list]) => (
                  <div key={title}>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{title}</p>
                    <ul className="space-y-1">
                      {list.map((x) => (
                        <li key={x.lender} className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11.5px] text-slate-700">{x.lender}</span>
                          <span className="shrink-0 tabular-nums text-[11.5px] text-slate-500">
                            {x.priShare}% → <span className="font-medium text-slate-900">{x.curShare}%</span> <Trend value={x.shareDeltaPp} unit="pp" />
                          </span>
                        </li>
                      ))}
                      {!list.length && <li className="text-[11.5px] text-slate-400">No material movement.</li>}
                    </ul>
                  </div>
                ))}
                {lenders.data.intelligence?.concentration && (
                  <p className="col-span-2 border-t border-slate-100 pt-2 text-[11.5px] text-slate-600 tabular-nums">
                    Top 3 concentration {lenders.data.intelligence.concentration.top3PriorSharePct}% → <span className="font-semibold text-slate-900">{lenders.data.intelligence.concentration.top3CurrentSharePct}%</span>{" "}
                    <Trend value={lenders.data.intelligence.concentration.deltaPp} unit="pp" invert />
                    <span className="ml-1 text-slate-400">— rising concentration increases dependency on a few lenders.</span>
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* ── ANOMALIES ──────────────────────────────────────────────────── */}
        <Section title="Anomalies" subtitle="Days and lenders diverging sharply from the equivalent previous period. Volume-gated to avoid noise."
          loading={insights.loading} error={insights.error} onRetry={() => load(getSLCInsights, setInsights)}
          empty={!insights.loading && !insights.error && !(insights.data?.anomalies || []).length ? "Nothing unusual detected for this period." : null}>
          <ul className="space-y-1.5">
            {(insights.data?.anomalies || []).map((a, i) => (
              <li key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 ${SEV[a.severity] || SEV.medium}`}>
                <AlertTriangle size={13} className="mt-0.5 shrink-0 opacity-70" />
                <div>
                  <span className="mr-1.5 rounded px-1 py-px text-[9px] font-bold uppercase opacity-70">{a.severity}</span>
                  <span className="text-[12px]">{a.fact}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── RECOMMENDED ACTIONS ────────────────────────────────────────── */}
        <Section title="Recommended actions" subtitle="Derived from the measured changes above. Recommendations, not conclusions."
          loading={lenders.loading} error={lenders.error} onRetry={() => load(getSLCLenders, setLenders)}
          empty={!lenders.loading && !lenders.error && !actions.length ? "No actions suggested for this period." : null}>
          <ul className="space-y-2">
            {actions.map((a, i) => (
              <li key={i} className="rounded-md border border-slate-200 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.priority === "high" ? "bg-rose-500" : a.priority === "medium" ? "bg-amber-500" : "bg-slate-300"}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{a.priority} priority</span>
                </div>
                <p className="mt-1 text-[12.5px] font-medium text-slate-900">{a.observation}</p>
                <p className="mt-0.5 text-[11.5px] text-slate-600">{a.reason}</p>
                <p className="mt-1 text-[11.5px] text-slate-800"><span className="font-medium">Action:</span> {a.action}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{a.impact}</p>
              </li>
            ))}
          </ul>
        </Section>

        <p className="pb-2 text-[10.5px] text-slate-400">
          Timezone {w?.timezone || "Asia/Kolkata"}. {w?.methodology}{" "}
          {insights.data?.disclaimer}
        </p>
      </div>
    </div>
  );
};

export default SelectedLendersComparison;
