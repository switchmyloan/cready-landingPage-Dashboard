import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingDown, RefreshCw, Download, Search, X, IndianRupee,
  Users, CheckCircle2, Info,
} from "lucide-react";
import {
  getVivifiFunnel, getVivifiFunnelHistory, getVivifiStageLeads,
} from "../../../api-services/Modules/VivifiFunnel";
import CompactDateFilter from "../../../components/CompactDateFilter";
import TablePagination from "../../../components/TablePagination";
import PremiumPageLoader from "../../../components/PremiumPageLoader";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const crore = (n) => `₹${(Number(n || 0) / 10000000).toFixed(2)} Cr`;
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
  // "create" credits every stage to the day the lead ARRIVED; "event" dates each
  // stage on the day it actually happened — the only one that can answer
  // "how many disbursed today".
  const [countBy, setCountBy] = useState("create");
  const [range, setRange] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

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

  const viewParams = useMemo(() => ({ ...dateParams, countBy }), [dateParams, countBy]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, h] = await Promise.all([
        getVivifiFunnel(viewParams),
        getVivifiFunnelHistory(viewParams),
      ]);
      setData(f?.data?.data || null);
      setHistory(h?.data?.data || []);
    } catch {
      setData(null);
      setHistory([]);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [viewParams]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stageParams = useMemo(
    () => ({
      ...dateParams,
      rank: stage?.currentStatus ? undefined : stage?.rank,
      currentStatus: stage?.currentStatus,
      perPage,
      currentPage: page,
      search,
    }),
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

  const totals = data?.totals || {};
  const funnel = data?.funnel || [];
  const current = data?.currentStatus || [];
  const currentMax = current.reduce((m, c) => Math.max(m, c.count), 0);
  const win = data?.window;
  const rows = stageData?.data || [];
  const stageTotal = stageData?.pagination?.total || 0;
  const stageTotalPages = stageData?.pagination?.totalPages || 1;

  const openStage = (f, i) => { setStage({ rank: i, label: f.label }); setPage(1); setSearch(""); };
  const openCurrent = (c) => { setStage({ currentStatus: c.status, label: `Currently at ${c.status}` }); setPage(1); setSearch(""); };

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
    const head = ["Lead ID", "Name", "Phone", "Current Status", "Furthest Stage",
      "Rejection Reason", "Eligible Amount", "Disbursal Amount", "Disbursal Date",
      "Cohort Date", "Created At", "Updated At"];
    const body = all.map((r) => [
      r.leadId, r.name, r.phone, r.currentStatus, r.furthestStage,
      r.rejectionReason, r.eligibleAmount ?? "", r.disbursalAmount ?? "", r.disbursalDate ?? "",
      String(r.cohortDate ?? "").slice(0, 10), r.createdAt, r.updatedAt,
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
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow-sm">
            <TrendingDown size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-gray-800">Vivifi Funnel</h1>
            <p className="text-[12.5px] text-gray-500">
              Every lead's journey through FlexSalary — each % is against the stage before it
              {win && <span className="text-gray-400"> · {win.from} → {win.to}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
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
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 ml-1">Count by</span>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {[
            { key: "create", label: "Create day", hint: "Credit every stage to the day the lead arrived" },
            { key: "event", label: "Event day", hint: "Date each stage on the day it actually happened" },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => { setCountBy(c.key); setStage(null); }}
              title={c.hint}
              className={`px-3 py-1.5 text-[12px] font-semibold transition ${
                countBy === c.key ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button onClick={fetchAll} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* The go-live note is not decoration: before this date the feed was not
          emitting the top-of-funnel statuses, so earlier windows read backwards. */}
      {win?.liveFrom && (
        <p className="flex items-start gap-1.5 text-[11.5px] text-gray-500 mb-4">
          <Info size={13} className="mt-px shrink-0 text-purple-500" />
          {countBy === "event"
            ? "Each stage is dated on the day it HAPPENED — so a lead that arrived last week and disbursed today counts in today's Disbursed. Stages belong to different cohorts, so they do not narrow. "
            : "Every stage is credited to the day the lead ARRIVED, so a row is one cohort's whole journey. "}
          Counted from each lead's own event history, not its current status. Data starts
          {" "}{win.liveFrom} — before that the webhook feed wasn't sending the early stages yet.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <Users size={13} /> Total Leads
          </span>
          <p className="mt-1 text-[26px] font-bold text-gray-800 leading-none">{fmtNum(totals.leads)}</p>
          <p className="mt-1.5 text-[11px] text-gray-400">entered the journey</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <CheckCircle2 size={13} /> Disbursed
          </span>
          <p className="mt-1 text-[26px] font-bold text-gray-800 leading-none">{fmtNum(totals.disbursedLeads)}</p>
          <p className="mt-1.5 text-[11px] text-gray-400">
            {totals.leads ? `${Math.round((totals.disbursedLeads / totals.leads) * 1000) / 10}% of leads` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <IndianRupee size={13} /> Disbursed Amount
          </span>
          <p className="mt-1 text-[26px] font-bold text-gray-800 leading-none">{crore(totals.disbursedAmount)}</p>
          <p className="mt-1.5 text-[11px] text-gray-400">{inr(totals.disbursedAmount)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <IndianRupee size={13} /> Sanctioned
          </span>
          <p className="mt-1 text-[26px] font-bold text-gray-800 leading-none">{crore(totals.sanctionedAmount)}</p>
          <p className="mt-1.5 text-[11px] text-gray-400">approved, not all paid out</p>
        </div>
      </div>

      {/* Stage drill */}
      {stage && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
            <span className="w-1 h-5 rounded-full bg-purple-600" />
            <h2 className="text-[15px] font-bold text-gray-800">Reached {stage.label}</h2>
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
                  <th className="px-3 py-2.5 font-medium">Furthest Stage</th>
                  <th className="px-3 py-2.5 font-medium text-right">Disbursed</th>
                  <th className="px-3 py-2.5 font-medium">Rejection Reason</th>
                  <th className="px-3 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {stageLoading ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No leads at this stage.</td></tr>
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
                    <td className="px-3 max-w-0 truncate text-gray-600" title={r.furthestStage || ""}>
                      {r.furthestStage || "—"}
                    </td>
                    <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">
                      {r.disbursalAmount ? inr(r.disbursalAmount) : <span className="text-gray-300">—</span>}
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

      {/* Current stage — a DIFFERENT question from the funnel, and labelled as
          such. The funnel counts "ever reached"; this counts "parked here now",
          so a lead appears once here but at every rung it passed above. Adding
          the two together, or reading this as conversion, is the trap. */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-purple-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Current stage</h2>
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100">
            {fmtNum(totals.leads)} LEADS
          </span>
          <span className="text-[11px] text-gray-400">where each lead sits today &mdash; click to see them</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          {current.length === 0 ? (
            <p className="px-1 py-6 text-center text-gray-400 text-[12.5px] md:col-span-2">No leads in this window.</p>
          ) : current.map((c) => (
            <button
              key={c.status}
              onClick={() => openCurrent(c)}
              className={`text-left rounded-lg border p-2.5 transition hover:shadow-sm ${
                stage?.currentStatus === c.status
                  ? "ring-2 ring-purple-400 border-purple-300"
                  : "border-gray-200 hover:bg-gray-50/60"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-semibold text-gray-800 truncate" title={c.status}>{c.status}</span>
                <span className="flex items-baseline gap-2 shrink-0">
                  <span className="text-[15px] font-bold text-gray-900 tabular-nums">{fmtNum(c.count)}</span>
                  <span className="text-[10.5px] text-gray-400 tabular-nums">
                    {totals.leads ? `${Math.round((c.count / totals.leads) * 1000) / 10}%` : ""}
                  </span>
                </span>
              </div>
              {/* Scaled to the BIGGEST bucket, not to the cohort — otherwise the
                  small late-stage buckets are invisible slivers. */}
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${currentMax ? Math.max((c.count / currentMax) * 100, c.count ? 2 : 0) : 0}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Day by day */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-indigo-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Day by day</h2>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
            {fmtNum(history.length)} DAYS
          </span>
          <span className="text-[11px] text-gray-400">
            {countBy === "event" ? "each stage on the day it happened" : "leads bucketed on the day they entered"}
          </span>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12.5px] min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2.5 font-medium">Date</th>
                {funnel.map((f, i) => (
                  <th
                    key={f.key}
                    onClick={() => openStage(f, i)}
                    title={`See the ${fmtNum(f.count)} leads that reached ${f.label}`}
                    className={`px-3 py-2.5 font-medium text-right whitespace-nowrap cursor-pointer select-none transition hover:text-purple-700 ${
                      stage?.rank === i ? "text-purple-700 underline" : ""
                    }`}
                  >
                    {f.label}
                  </th>
                ))}
                {countBy !== "event" && <th className="px-3 py-2.5 font-medium text-right">Disb %</th>}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={funnel.length + (countBy === "event" ? 1 : 2)} className="px-5 py-10 text-center text-gray-400">No activity in this window.</td></tr>
              ) : history.map((h) => (
                <tr key={h.date} className="h-[42px] border-b border-gray-50 hover:bg-indigo-50/30">
                  <td className="px-5 font-semibold text-gray-700 whitespace-nowrap">{h.date}</td>
                  {funnel.map((f, i) => (
                    <td key={f.key} className={`px-3 text-right tabular-nums ${i === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                      {fmtNum(h[`rank_${i}`])}
                    </td>
                  ))}
                  {countBy !== "event" && (
                    <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">{h.disbursed_pct}%</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default VivifiFunnel;
