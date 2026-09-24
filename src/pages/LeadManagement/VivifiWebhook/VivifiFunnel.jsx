import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingDown, RefreshCw, Download, Search, X,
  Users, CheckCircle2, Info, ArrowRight,
} from "lucide-react";
import {
  getVivifiFunnelHistory, getVivifiFunnelHistoryByEvent,
  getVivifiFunnelStageStatus, getVivifiStageLeads,
} from "../../../api-services/Modules/VivifiFunnel";
import CompactDateFilter from "../../../components/CompactDateFilter";
import TablePagination from "../../../components/TablePagination";
import PremiumPageLoader from "../../../components/PremiumPageLoader";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
// Compact money for the KPI sub-line — disbursed totals run into crores.
const compactInr = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};
const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};

const statusTone = (s) => {
  const v = String(s || "").toLowerCase();
  if (v.includes("disburs") && !v.includes("pending")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v.includes("reject") || v.includes("cancel") || v.includes("fail")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (v.includes("await") || v.includes("pending") || v.includes("waiting")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
};

const VivifiFunnel = () => {
  const [range, setRange] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewMode, setViewMode] = useState("create"); // "create" (cohort) | "event"

  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  // Drill "where are they now" — of leads who reached a rung, their current status.
  const [drill, setDrill] = useState(null);        // { key, label, day }
  const [drillData, setDrillData] = useState(null); // { reached, statuses:[...] }
  const [drillLoading, setDrillLoading] = useState(false);

  const [stage, setStage] = useState(null);
  const [stageData, setStageData] = useState(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const dateParams = useMemo(
    () => ({
      type: (!fromDate || !toDate) && range ? range : undefined,
      fromDate: fromDate && toDate ? fromDate : undefined,
      toDate: fromDate && toDate ? toDate : undefined,
    }),
    [range, fromDate, toDate],
  );


  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const histCall = viewMode === "event" ? getVivifiFunnelHistoryByEvent : getVivifiFunnelHistory;
      const h = await histCall(dateParams);
      setHistory(h?.data?.data || null);
    } catch {
      setHistory(null);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [dateParams, viewMode]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stageParams = useMemo(
    () => ({ ...dateParams, status: stage?.status, perPage, currentPage: page, search }),
    [dateParams, stage, perPage, page, search],
  );

  useEffect(() => {
    if (!stage) return undefined;
    let alive = true;
    setStageLoading(true);
    getVivifiStageLeads(stageParams)
      .then((r) => { if (alive) setStageData(r?.data?.data || null); })
      .catch(() => { if (alive) setStageData(null); })
      .finally(() => { if (alive) setStageLoading(false); });
    return () => { alive = false; };
  }, [stage, stageParams]);

  const rows = stageData?.data || [];
  const stageTotal = stageData?.pagination?.total || 0;
  const stageTotalPages = stageData?.pagination?.totalPages || 1;

  // Everything now comes from the history response, so the KPIs, the matrix and
  // the rejected chips all move together when the Create/Event toggle or the date
  // filter changes — one source, one question at a time.
  const cohortStages = history?.stages || [];
  const matrix = history?.matrix || [];
  const cohortTotal = history?.totalLeads || 0;
  const cohortSummary = history?.summary || {};
  const win = history?.window;
  // Rejected chips = the red (terminal) columns of the CURRENT view.
  const rejected = cohortStages
    .filter((s) => s.tone === "red")
    .map((s) => ({ key: s.key, label: s.label, count: s.total }));
  // Event-day is raw per-event counts, NOT a monotonic cohort — so no conversion %
  // and no "where are they now" drill (both only make sense on the reached cohort).
  const byEvent = !!history?.byEvent;

  // Conversion ratio target → the progression rung it converts FROM (the one
  // before it). Red outcomes are not part of the progression chain. These are
  // ≤10-item arrays rebuilt from `history`, so plain consts, not memos.
  const progKeys = cohortStages.filter((s) => s.tone !== "red").map((s) => s.key);
  const ratioFrom = {};
  progKeys.forEach((k, i) => { if (i > 0) ratioFrom[k] = progKeys[i - 1]; });
  const stageTotalByKey = Object.fromEntries(cohortStages.map((s) => [s.key, Number(s.total) || 0]));
  const rpct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
  // The disbursed (green) rung. The money columns — Disb. ₹ amount + ATS(amount/count)
  // — sit immediately AFTER this count column. If no one reached disbursed in the
  // window there is no green column, so they fall back to the far right (see render).
  const greenStage = cohortStages.find((s) => s.tone === "green");
  const greenKey = greenStage?.key || null;
  const atsOf = (amt, cnt) => (cnt > 0 ? Math.round((Number(amt) || 0) / cnt) : 0);

  const openStage = (f) => { setStage({ status: f.key, label: f.label }); setPage(1); setSearch(""); };

  // Drill a rung (whole range, or one first-arrival `day` from a matrix cell).
  // Red outcome columns are raw totals, not a "reached" cohort, so they don't drill.
  const isDrillable = (st) => !!st && st.tone !== "red" && !byEvent;
  const openDrill = useCallback(async (st, day = null) => {
    if (!st || st.tone === "red" || byEvent) return;   // only the reached cohort drills
    setDrill({ key: st.key, label: st.label, day });
    setDrillData(null);
    setDrillLoading(true);
    try {
      const r = await getVivifiFunnelStageStatus({ ...dateParams, stage: st.key, day: day || undefined });
      setDrillData(r?.data?.data || null);
    } catch {
      setDrillData(null);
    } finally {
      setDrillLoading(false);
    }
  }, [dateParams, byEvent]);

  // Export the actual LEADS in the current window (not the count matrix) — one row
  // per lead with its details, the same data the rest of the CMS exports. Pulls
  // every lead in the window (no status filter), so it is a fetch, not client-side.
  const exportLeads = async () => {
    setExporting(true);
    let all = [];
    try {
      const res = await getVivifiStageLeads({ ...dateParams, perPage: 100000, currentPage: 1 });
      all = res?.data?.data?.data || [];
    } catch {
      /* leave empty rather than hand back a broken file */
    } finally {
      setExporting(false);
    }
    if (!all.length) return;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Lead ID", "Name", "Phone", "Current Status", "Rejection Reason", "Eligible Amount", "Created At", "Updated At"];
    const lines = [head.map(esc).join(",")];
    all.forEach((r) => lines.push([
      r.leadId, r.name, r.phone, r.currentStatus, r.rejectionReason,
      r.eligibleAmount ?? "", r.createdAt, r.updatedAt,
    ].map(esc).join(",")));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Vivifi-Funnel-Leads_${win?.from || "all"}_to_${win?.to || "all"}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    if (!stage) return;
    setExporting(true);
    let all = rows;
    try {
      const res = await getVivifiStageLeads({ ...stageParams, perPage: 100000, currentPage: 1 });
      all = res?.data?.data?.data || rows;
    } catch {
      /* fall back to what is on screen rather than handing back nothing */
    } finally {
      setExporting(false);
    }
    const head = ["Lead ID", "Name", "Phone", "Current Status",
      "Rejection Reason", "Eligible Amount", "Created At", "Updated At"];
    const body = all.map((r) => [
      r.leadId, r.name, r.phone, r.currentStatus,
      r.rejectionReason, r.eligibleAmount ?? "", r.createdAt, r.updatedAt,
    ]);
    const csv = [head, ...body]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Vivifi-Funnel_${String(stage.label).replace(/[^\w-]+/g, "-")}_${win?.from || ""}_to_${win?.to || ""}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (firstLoad && loading) {
    return (
      <PremiumPageLoader
        theme="purple"
        title="Loading Vivifi Funnel"
        brandLabel="Lender Journey"
        icon={TrendingDown}
        phrases={["Reading the event history…", "Ranking each lead's furthest stage…", "Reconciling disbursals…"]}
        tiles={[{ label: "Events" }, { label: "Stages" }, { label: "Disbursals" }]}
        progressLabel="Building the funnel"
      />
    );
  }

  return (
    <>
      {/* Header, filter and refresh on ONE line. They were three stacked bands —
          a 100px title card, a filter row, then a two-line note — which is a lot
          of screen for a page whose point is the numbers underneath. The date
          range is not repeated in the title either; the chips already say it. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 px-3 py-2 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow-sm shrink-0">
          <TrendingDown size={16} />
        </div>
        <h1 className="text-[16px] font-bold text-gray-800 leading-none">Vivifi Funnel</h1>

        {/* Count by: Create day (first-arrival cohort, cumulative) vs Event day
            (each event on the day it happened). Same toggle as the UpSwing funnel. */}
        <div className="inline-flex items-center rounded-lg border border-purple-200 bg-white p-0.5 text-[11.5px] font-semibold">
          {[
            { k: "create", label: "Create day" },
            { k: "event", label: "Event day" },
          ].map((m) => (
            <button
              key={m.k}
              onClick={() => { setViewMode(m.k); setStage(null); setDrill(null); }}
              title={m.k === "create"
                ? "Each lead on its create/first-arrival day, in every stage it ever reached (cumulative)"
                : "Each event counted on the day it actually happened (not cumulative)"}
              className={`px-2.5 py-1 rounded-md transition ${
                viewMode === m.k ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <CompactDateFilter
            range={range}
            onRangeChange={(k) => { setRange(k); setStage(null); }}
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={(v) => { setFromDate(v); setStage(null); }}
            onToChange={(v) => { setToDate(v); setStage(null); }}
            onClearRange={() => { setFromDate(""); setToDate(""); }}
            accent="purple"
          />
          <button
            onClick={exportLeads}
            disabled={exporting || !cohortTotal}
            title="Export every lead in this window as CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 disabled:opacity-40 shadow-sm"
          >
            <Download size={14} className={exporting ? "animate-pulse" : ""} /> {exporting ? "Preparing…" : "Export"}
          </button>
          <button
            onClick={fetchAll}
            title="Refresh"
            className="p-2 rounded-lg border border-purple-200 bg-white text-gray-500 hover:bg-purple-50 transition"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* One line: KPIs + matrix both follow the toggle above, so neither is the
          current-status snapshot the Webhook Leads list shows — a different question. */}
      <p className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-2.5">
        <Info size={12} className="shrink-0 text-purple-400" />
        {byEvent
          ? "Event day — each event counted on the day it happened. Totals are distinct leads active in the window; not the current-status Webhook Leads list."
          : "Create day — each lead on its first-arrival day, credited in every stage it reached (cumulative). Not the current-status Webhook Leads list."}
      </p>

      {/* KPI strip — driven by the current view's summary, so it moves with the
          Create/Event toggle and the date filter (matches the matrix below). */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-2.5">
        {[
          { icon: <Users size={11} />, label: "Total Leads", tone: "border-l-indigo-400",
            value: fmtNum(cohortTotal), sub: byEvent ? "active in this window" : "started in this window" },
          { icon: <TrendingDown size={11} />, label: "In Progress", tone: "border-l-amber-400",
            value: fmtNum(cohortSummary.inProgress), sub: `${cohortSummary.inProgressPct ?? 0}% still moving` },
          { icon: <CheckCircle2 size={11} />, label: "Disbursed", tone: "border-l-emerald-400",
            value: fmtNum(cohortSummary.disbursed),
            // After the count: total disbursed amount + ATS (average ticket = amount / count).
            sub: `${compactInr(cohortSummary.disbursedAmount)} · ATS ${compactInr(cohortSummary.ats)}` },
          { icon: <X size={11} />, label: "Rejected", tone: "border-l-rose-400",
            value: fmtNum(cohortSummary.rejected), sub: `${cohortSummary.rejectedPct ?? 0}% of leads` },
        ].map((k) => (
          <div key={k.label} className={`rounded-lg border border-gray-200 border-l-[3px] ${k.tone} bg-white px-2.5 py-2 shadow-sm`}>
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-gray-400">
              {k.icon} {k.label}
            </span>
            <p className="mt-0.5 text-[18px] font-bold text-gray-900 leading-none tabular-nums">{k.value}</p>
            <p className="mt-0.5 text-[10px] text-gray-400 truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Stage drill */}
      {stage && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
            <span className="w-1 h-5 rounded-full bg-purple-600" />
            <h2 className="text-[15px] font-bold text-gray-800">Currently at {stage.label}</h2>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100">
              {fmtNum(stageTotal)} LEADS
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Name / phone / lead id…"
                  className="pl-8 pr-2 py-1.5 w-[210px] text-[12px] rounded-lg border border-gray-200 text-gray-700"
                />
              </div>
              <button
                onClick={exportCsv}
                disabled={!rows.length || exporting}
                title={`Exports all ${fmtNum(stageTotal)} leads at this stage`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 disabled:opacity-40 shadow-sm"
              >
                <Download size={13} className={exporting ? "animate-pulse" : ""} />
                {exporting ? "Preparing…" : `Export CSV (${fmtNum(stageTotal)})`}
              </button>
              <button onClick={() => setStage(null)} title="Close" className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] table-fixed min-w-[980px]">
              <colgroup>
                <col className="w-[190px]" />
                <col className="w-[128px]" />
                <col className="w-[150px]" />
                <col className="w-[110px]" />
                <col />
                <col className="w-[128px]" />
              </colgroup>
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">Current Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Eligible Amt</th>
                  <th className="px-3 py-2.5 font-medium">Rejection Reason</th>
                  <th className="px-3 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {stageLoading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No leads at this stage.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.leadId} className="h-[46px] border-b border-gray-50 hover:bg-purple-50/30">
                    <td className="px-5 max-w-0">
                      <div className="font-semibold text-gray-800 truncate" title={r.name || ""}>{r.name || "—"}</div>
                      <div className="font-mono text-[10.5px] text-gray-400 truncate">{r.leadId}</div>
                    </td>
                    <td className="px-3">
                      {/* Plain text, not a tel: link — agents copy it into a dialer. */}
                      <span className="font-mono text-gray-800 select-all cursor-text">{r.phone || "—"}</span>
                    </td>
                    <td className="px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border whitespace-nowrap ${statusTone(r.currentStatus)}`}>
                        {r.currentStatus || "—"}
                      </span>
                    </td>
                    <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">
                      {r.eligibleAmount ? inr(r.eligibleAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 max-w-0 truncate text-gray-500" title={r.rejectionReason || ""}>
                      {r.rejectionReason || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 text-gray-500 whitespace-nowrap">{fmtDT(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            totalPages={stageTotalPages}
            total={stageTotal}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
            noun="leads"
          />
        </div>
      )}

      {rejected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400">Rejected</span>
          {rejected.map((r) => (
            <button
              key={r.key}
              onClick={() => openStage(r)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[12px] font-semibold hover:bg-rose-100"
            >
              {r.label}
              <span className="tabular-nums">{fmtNum(r.count)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Day by day — COHORT matrix (UpSwing model). Each cell = leads that first
          arrived that day and REACHED that stage (furthest >= rung), so columns are
          cumulative and monotonic. Small % under a cell = conversion from the stage
          before it. Click a stage header (whole range) or a cell (that day) to see
          "where are they now". */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-indigo-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Day by day</h2>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
            {fmtNum(matrix.length)} DAYS
          </span>
          <span className="text-[11px] text-gray-400">
            {byEvent
              ? "events that happened that day — each on its own day, not cumulative"
              : "of leads that started that day, how many reached each stage · click a stage or cell for “where are they now”"}
          </span>
          {win?.liveFrom && (
            <span className="ml-auto text-[10.5px] text-gray-400">from {win.liveFrom} (feed go-live)</span>
          )}
        </div>
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-[12.5px] border-separate border-spacing-0 min-w-[1000px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wider text-gray-400">
                <th className="sticky left-0 z-20 bg-gray-50 px-5 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium text-right">Total</th>
                {cohortStages.map((s) => {
                  const drillable = isDrillable(s);
                  const cells = [(
                    <th
                      key={s.key}
                      onClick={() => drillable && openDrill(s)}
                      title={drillable ? `Where are the ${fmtNum(s.total)} leads that reached ${s.label} now?` : s.label}
                      className={`px-3 py-2.5 font-medium text-right whitespace-nowrap ${
                        s.tone === "red" ? "text-rose-500" : s.tone === "green" ? "text-emerald-600" : ""
                      } ${drillable ? "cursor-pointer select-none hover:text-purple-700 hover:underline underline-offset-2" : ""} ${
                        drill?.key === s.key ? "text-purple-700 underline" : ""
                      }`}
                    >
                      {s.label}
                    </th>
                  )];
                  if (s.key === greenKey) {
                    cells.push(<th key="__disbamt" className="px-3 py-2.5 font-medium text-right whitespace-nowrap text-emerald-600 bg-emerald-50/40">Disb. ₹</th>);
                    cells.push(<th key="__ats" className="px-3 py-2.5 font-medium text-right whitespace-nowrap text-emerald-600 bg-emerald-50/40">ATS</th>);
                  }
                  return cells;
                })}
                {!greenKey && (<>
                  <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap text-emerald-600">Disb. ₹</th>
                  <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap text-emerald-600">ATS</th>
                </>)}
              </tr>
            </thead>
            <tbody>
              {matrix.length === 0 ? (
                <tr><td colSpan={cohortStages.length + 4} className="px-5 py-10 text-center text-gray-400">No activity in this window.</td></tr>
              ) : matrix.map((h) => {
                const dAmt = h.disbursedAmount || 0;
                const dCnt = greenKey ? (h.byStage?.[greenKey] || 0) : 0;
                const moneyCells = (<>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap bg-emerald-50/30">{compactInr(dAmt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700 whitespace-nowrap bg-emerald-50/30">{dCnt > 0 ? compactInr(atsOf(dAmt, dCnt)) : "—"}</td>
                </>);
                return (
                <tr key={h.date} className="border-b border-gray-50 hover:bg-indigo-50/30">
                  <td className="sticky left-0 z-[1] bg-white px-5 py-2 font-semibold text-gray-700 whitespace-nowrap">{h.date}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-800">{fmtNum(h.total)}</td>
                  {cohortStages.map((s, i) => {
                    const v = h.byStage?.[s.key] || 0;
                    const fromKey = ratioFrom[s.key];
                    const r = (!byEvent && fromKey) ? rpct(v, h.byStage?.[fromKey] || 0) : null;
                    const drillable = isDrillable(s) && v > 0;
                    const cells = [(
                      <td key={s.key} className={`px-3 py-2 text-right align-top ${i === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                        <span
                          onClick={() => drillable && openDrill(s, h.date)}
                          className={`tabular-nums ${drillable ? "cursor-pointer hover:text-purple-700 hover:underline underline-offset-2" : ""}`}
                        >
                          {fmtNum(v)}
                        </span>
                        {r != null && <div className="text-[9.5px] text-indigo-400 tabular-nums">{r}%</div>}
                      </td>
                    )];
                    if (s.key === greenKey) cells.push(<Fragment key="__money">{moneyCells}</Fragment>);
                    return cells;
                  })}
                  {!greenKey && moneyCells}
                </tr>
                );
              })}
            </tbody>
            {matrix.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-bold text-gray-700">
                  <td className="sticky left-0 z-[1] bg-gray-100 px-5 py-2.5 text-[11px] uppercase tracking-wide border-t-2 border-gray-200">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums border-t-2 border-gray-200">{fmtNum(cohortTotal)}</td>
                  {cohortStages.map((s) => {
                    const fromKey = ratioFrom[s.key];
                    const r = (!byEvent && fromKey) ? rpct(s.total, stageTotalByKey[fromKey] || 0) : null;
                    const cells = [(
                      <td key={s.key} className={`px-3 py-2.5 text-right align-top tabular-nums border-t-2 border-gray-200 ${
                        s.tone === "red" ? "text-rose-600" : s.tone === "green" ? "text-emerald-700" : ""
                      }`}>
                        {fmtNum(s.total)}
                        <div className="text-[9.5px] font-semibold text-indigo-500 tabular-nums">
                          {r != null ? `${r}%` : `${s.pctOfTotal}%`}
                        </div>
                      </td>
                    )];
                    if (s.key === greenKey) {
                      cells.push(<td key="__disbamt" className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap border-t-2 border-gray-200 bg-emerald-50/50">{compactInr(cohortSummary.disbursedAmount || 0)}</td>);
                      cells.push(<td key="__ats" className="px-3 py-2.5 text-right tabular-nums text-emerald-700 whitespace-nowrap border-t-2 border-gray-200 bg-emerald-50/50">{compactInr(cohortSummary.ats || 0)}</td>);
                    }
                    return cells;
                  })}
                  {!greenKey && (<>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap border-t-2 border-gray-200">{compactInr(cohortSummary.disbursedAmount || 0)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 whitespace-nowrap border-t-2 border-gray-200">{compactInr(cohortSummary.ats || 0)}</td>
                  </>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Drill: of the leads that reached a stage, where are they now */}
      {drill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDrill(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50">
              <span className="w-1 h-5 rounded-full bg-purple-600" />
              <div className="min-w-0">
                <h2 className="text-[14px] font-bold text-gray-800 truncate">Reached {drill.label} — where are they now?</h2>
                <p className="text-[11px] text-gray-500">
                  {drill.day ? `First arrived ${drill.day}` : "All days in the window"}
                  {drillData ? ` · ${fmtNum(drillData.reached)} leads` : ""}
                </p>
              </div>
              <button onClick={() => setDrill(null)} className="ml-auto p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500"><X size={14} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {drillLoading ? (
                <div className="py-10 text-center text-gray-400 text-[13px]">Loading…</div>
              ) : !drillData || !drillData.statuses?.length ? (
                <div className="py-10 text-center text-gray-400 text-[13px]">No leads.</div>
              ) : drillData.statuses.map((s) => (
                <button
                  key={s.key}
                  onClick={() => { openStage({ key: s.key, label: s.label }); setDrill(null); }}
                  title={`See the ${fmtNum(s.leads)} leads now at ${s.label}`}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 text-left group"
                >
                  <span className={`shrink-0 w-2 h-2 rounded-full ${s.tone === "green" ? "bg-emerald-500" : s.tone === "red" ? "bg-rose-500" : "bg-indigo-400"}`} />
                  <span className={`text-[12.5px] font-medium truncate ${s.tone === "green" ? "text-emerald-700" : s.tone === "red" ? "text-rose-600" : "text-gray-700"}`}>{s.label}</span>
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${s.tone === "green" ? "bg-emerald-500" : s.tone === "red" ? "bg-rose-400" : "bg-indigo-400"}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="tabular-nums text-[12px] font-semibold text-gray-800 w-12 text-right">{fmtNum(s.leads)}</span>
                    <span className="tabular-nums text-[11px] text-gray-400 w-10 text-right">{s.pct}%</span>
                    <ArrowRight size={12} className="text-gray-300 group-hover:text-purple-500" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VivifiFunnel;
