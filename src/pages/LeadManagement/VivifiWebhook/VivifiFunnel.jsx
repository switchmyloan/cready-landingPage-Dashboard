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
// Indian money reads badly in a fixed unit: ₹3,50,490 as "₹0.04 Cr" is harder to
// grasp than "₹3.50 L". Pick the unit that fits the number.
const compactInr = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
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


  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, h] = await Promise.all([
        getVivifiFunnel(dateParams),
        getVivifiFunnelHistory(dateParams),
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
  }, [dateParams]);

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

  const totals = data?.totals || {};
  const funnel = data?.funnel || [];
  const rejected = data?.rejected || [];
  const win = data?.window;
  const rows = stageData?.data || [];
  const stageTotal = stageData?.pagination?.total || 0;
  const stageTotalPages = stageData?.pagination?.totalPages || 1;

  const openStage = (f) => { setStage({ status: f.key, label: f.label }); setPage(1); setSearch(""); };

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
            onClick={fetchAll}
            title="Refresh"
            className="p-2 rounded-lg border border-purple-200 bg-white text-gray-500 hover:bg-purple-50 transition"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Worth one line: the obvious alternative reading (each lead's FURTHEST
          stage over its whole history) gives different, also-correct numbers, and
          that version used to disagree with the module beside it. */}
      <p className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-2.5">
        <Info size={12} className="shrink-0 text-purple-400" />
        Each lead counted once, on its current stage — tallies exactly with Vivifi Webhook Leads.
      </p>

      {/* Compact KPI strip: context for the funnel below, not the headline, so no
          more 26px numbers and 16px padding each. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-2.5">
        {[
          { icon: <Users size={11} />, label: "Total Leads", tone: "border-l-indigo-400",
            value: fmtNum(totals.leads), sub: "in this window" },
          { icon: <CheckCircle2 size={11} />, label: "Disbursed", tone: "border-l-emerald-400",
            value: fmtNum(totals.disbursedLeads),
            sub: totals.leads ? `${Math.round((totals.disbursedLeads / totals.leads) * 1000) / 10}% of leads` : "—" },
          { icon: <IndianRupee size={11} />, label: "Disbursed Amt", tone: "border-l-purple-400",
            value: compactInr(totals.disbursedAmount), sub: inr(totals.disbursedAmount) },
          { icon: <IndianRupee size={11} />, label: "Sanctioned", tone: "border-l-amber-400",
            value: compactInr(totals.sanctionedAmount), sub: "approved, not all paid" },
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

      {/* Day by day */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-indigo-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Day by day</h2>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
            {fmtNum(history.length)} DAYS
          </span>
          <span className="text-[11px] text-gray-400">leads touched that day, by current stage</span>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12.5px] min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2.5 font-medium">Date</th>
                {funnel.map((f, i) => (
                  <th
                    key={f.key}
                    onClick={() => openStage(f)}
                    title={`See the ${fmtNum(f.count)} leads currently at ${f.label}`}
                    className={`px-3 py-2.5 font-medium text-right whitespace-nowrap cursor-pointer select-none transition hover:text-purple-700 ${
                      stage?.status === f.key ? "text-purple-700 underline" : ""
                    }`}
                  >
                    {f.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 font-medium text-right">Disb %</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={funnel.length + 2} className="px-5 py-10 text-center text-gray-400">No activity in this window.</td></tr>
              ) : history.map((h) => (
                <tr key={h.date} className="h-[42px] border-b border-gray-50 hover:bg-indigo-50/30">
                  <td className="px-5 font-semibold text-gray-700 whitespace-nowrap">{h.date}</td>
                  {funnel.map((f, i) => (
                    <td key={f.key} className={`px-3 text-right tabular-nums ${i === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                      {fmtNum(h[f.key])}
                    </td>
                  ))}
                  <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">{h.disbursed_pct}%</td>
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
