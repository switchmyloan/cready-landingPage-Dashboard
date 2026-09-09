import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, CheckCircle2, MousePointerClick, IndianRupee, Copy, XCircle,
  AlertTriangle, RefreshCw, Download, Search, X, TrendingDown,
} from "lucide-react";
import {
  getSmartCoinFunnel, getSmartCoinFunnelHistory, getSmartCoinStageLeads,
} from "../../../api-services/Modules/SmartCoinFunnel";
import CompactDateFilter from "../../../components/CompactDateFilter";
import TablePagination from "../../../components/TablePagination";
import PremiumPageLoader from "../../../components/PremiumPageLoader";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};

// Funnel stages, in journey order. SmartCoin is deduped for EVERY lead at submit
// time, and only the users who pass then see it as a clickable offer — so the
// push is the top of the funnel, not the click.
const STAGE_META = {
  pushed: { icon: Users, tone: "indigo", hint: "Leads we sent to SmartCoin's dedupe check" },
  passed: { icon: CheckCircle2, tone: "emerald", hint: "Not a duplicate — SmartCoin accepted the lead" },
  selected: { icon: MousePointerClick, tone: "violet", hint: "Of those, users who clicked SmartCoin on the offer page" },
  disbursed: { icon: IndianRupee, tone: "amber", hint: "Loans actually paid out by SmartCoin" },
};

const DROPOFFS = [
  { key: "duplicate", label: "Duplicate", icon: Copy, tone: "amber", hint: "SmartCoin already had this user" },
  { key: "rejected", label: "Rejected", icon: XCircle, tone: "rose", hint: "SmartCoin declined (DND etc.)" },
  { key: "errored", label: "Errors", icon: AlertTriangle, tone: "slate", hint: "Call never got a verdict — rate limits, bad PAN, transport failures" },
];

const TONES = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-gray-200 bg-gray-50 text-gray-600",
};
const BARS = {
  indigo: "bg-indigo-500", emerald: "bg-emerald-500",
  violet: "bg-violet-500", amber: "bg-amber-500",
};

const statusTone = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v === "duplicate") return "bg-amber-50 text-amber-700 border-amber-200";
  if (v === "error") return "bg-gray-100 text-gray-600 border-gray-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

const SmartCoinFunnel = () => {
  // SmartCoin stopped responding after July 2026, so a "Today" default would
  // render an empty funnel and read as broken. All time is the honest default.
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
        getSmartCoinFunnel(dateParams),
        getSmartCoinFunnelHistory(dateParams),
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

  // Stage drill — only fetched once a card is actually clicked.
  const stageParams = useMemo(
    () => ({ ...dateParams, stage, perPage, currentPage: page, search }),
    [dateParams, stage, perPage, page, search],
  );

  useEffect(() => {
    if (!stage) return;
    let alive = true;
    setStageLoading(true);
    getSmartCoinStageLeads(stageParams)
      .then((r) => { if (alive) setStageData(r?.data?.data || null); })
      .catch(() => { if (alive) setStageData(null); })
      .finally(() => { if (alive) setStageLoading(false); });
    return () => { alive = false; };
  }, [stage, stageParams]);

  const openStage = (key) => { setStage(key); setPage(1); setSearch(""); };

  const totals = data?.totals || {};
  const funnel = data?.funnel || [];
  const win = data?.window;
  const rows = stageData?.data || [];
  const stageTotal = stageData?.pagination?.total || 0;
  const stageTotalPages = stageData?.pagination?.totalPages || 1;

  // Export the WHOLE filtered stage, not the page on screen.
  const exportCsv = async () => {
    if (!stage) return;
    setExporting(true);
    let all = rows;
    try {
      const res = await getSmartCoinStageLeads({ ...stageParams, perPage: 100000, currentPage: 1 });
      all = res?.data?.data?.data || rows;
    } catch {
      /* fall back to what is on screen rather than handing back nothing */
    } finally {
      setExporting(false);
    }
    const head = ["Name", "Phone", "Email", "PAN", "Monthly Income", "SmartCoin Status",
      "SmartCoin Message", "UTM Source", "UTM Medium", "Created At"];
    const body = all.map((r) => [
      r.name, r.phone, r.email, r.pan_no, r.monthly_income, r.scStatus,
      r.scMessage, r.utm_source, r.utm_medium, r.createdAt,
    ]);
    const csv = [head, ...body]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartcoin_${stage}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (firstLoad && loading) return <PremiumPageLoader label="Building SmartCoin funnel…" />;

  return (
    <>
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 grid place-items-center text-white shadow-sm">
            <TrendingDown size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-gray-800">SmartCoin Funnel</h1>
            <p className="text-[12.5px] text-gray-500">
              Where SmartCoin leads drop off — from the dedupe push to the disbursal
              {win && <span className="text-gray-400"> · {win.from} → {win.to}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <CompactDateFilter
          range={range}
          onRangeChange={(k) => { setRange(k); setStage(null); }}
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={(v) => { setFromDate(v); setStage(null); }}
          onToChange={(v) => { setToDate(v); setStage(null); }}
          onClearRange={() => { setFromDate(""); setToDate(""); }}
        />
        <button onClick={fetchAll} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Funnel stages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {funnel.map((f) => {
          const meta = STAGE_META[f.key] || STAGE_META.pushed;
          const Icon = meta.icon;
          const isOpen = stage === f.key;
          return (
            <button
              key={f.key}
              onClick={() => openStage(f.key)}
              title={meta.hint}
              className={`text-left rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                isOpen ? "ring-2 ring-indigo-400 border-indigo-300" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <Icon size={13} /> {f.label}
                </span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${TONES[meta.tone]}`}>
                  {f.pct}%
                </span>
              </div>
              <p className="text-[26px] font-bold text-gray-800 leading-none">{fmtNum(f.count)}</p>
              {/* Bar is the share of the TOP of the funnel, so the four bars read
                  as one shrinking sequence rather than four unrelated numbers. */}
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full ${BARS[meta.tone]} transition-all`}
                  style={{ width: `${totals.pushed ? Math.max((f.count / totals.pushed) * 100, f.count ? 1.5 : 0) : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">
                {f.key === "disbursed" && totals.disbursedAmount
                  ? inr(totals.disbursedAmount)
                  : `${f.pct}% of ${f.key === "pushed" ? "all leads" : "the stage above"}`}
              </p>
            </button>
          );
        })}
      </div>

      {/* Drop-off breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {DROPOFFS.map((d) => {
          const Icon = d.icon;
          const isOpen = stage === d.key;
          return (
            <button
              key={d.key}
              onClick={() => openStage(d.key)}
              title={d.hint}
              className={`text-left rounded-xl border bg-white p-3.5 shadow-sm transition hover:shadow-md ${
                isOpen ? "ring-2 ring-indigo-400 border-indigo-300" : "border-gray-200"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon size={13} /> {d.label}
              </span>
              <p className="mt-1 text-[20px] font-bold text-gray-800 leading-none">{fmtNum(totals[d.key])}</p>
              <p className="mt-1 text-[11px] text-gray-400">{d.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Stage drill */}
      {stage && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
            <span className="w-1 h-5 rounded-full bg-indigo-600" />
            <h2 className="text-[15px] font-bold text-gray-800">
              {funnel.find((f) => f.key === stage)?.label
                || DROPOFFS.find((d) => d.key === stage)?.label
                || stage}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
              {fmtNum(stageTotal)} LEADS
            </span>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Name / phone / PAN…"
                  className="pl-8 pr-2 py-1.5 w-[210px] text-[12px] rounded-lg border border-gray-200 text-gray-700"
                />
              </div>
              <button
                onClick={exportCsv}
                disabled={!rows.length || exporting}
                title={`Exports all ${fmtNum(stageTotal)} leads in this stage`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 disabled:opacity-40 shadow-sm"
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
            <table className="w-full text-[12.5px] table-fixed min-w-[900px]">
              <colgroup>
                <col className="w-[200px]" />
                <col className="w-[132px]" />
                <col className="w-[116px]" />
                <col className="w-[110px]" />
                <col className="w-[104px]" />
                <col />
                <col className="w-[128px]" />
              </colgroup>
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">PAN</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Income</th>
                  <th className="px-3 py-2.5 font-medium">SmartCoin Response</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {stageLoading ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No leads in this stage.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="h-[46px] border-b border-gray-50 hover:bg-indigo-50/40">
                    <td className="px-5 max-w-0">
                      <div className="font-semibold text-gray-800 truncate" title={r.name || ""}>{r.name || "—"}</div>
                      <div className="text-[10.5px] text-gray-400 truncate">{r.utm_medium || r.utm_source || "—"}</div>
                    </td>
                    <td className="px-3">
                      <a href={`tel:${r.phone}`} className="font-mono text-indigo-700 hover:underline whitespace-nowrap">{r.phone}</a>
                    </td>
                    <td className="px-3 font-mono text-[11.5px] text-gray-600 truncate">{r.pan_no || "—"}</td>
                    <td className="px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border whitespace-nowrap ${statusTone(r.scStatus)}`}>
                        {r.scStatus || "—"}
                      </span>
                    </td>
                    <td className="px-3 text-right tabular-nums text-gray-600">
                      {r.monthly_income ? inr(r.monthly_income) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 max-w-0 truncate text-gray-500" title={r.scMessage || ""}>
                      {r.scMessage || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 text-gray-500 whitespace-nowrap">{fmtDT(r.createdAt)}</td>
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

      {/* Day-by-day trend */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-violet-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Day by day</h2>
          <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-bold border border-violet-100">
            {fmtNum(history.length)} DAYS
          </span>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12.5px] min-w-[560px]">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium text-right">Pushed</th>
                <th className="px-3 py-2.5 font-medium text-right">Dedupe Passed</th>
                <th className="px-3 py-2.5 font-medium text-right">Duplicate</th>
                <th className="px-3 py-2.5 font-medium text-right">Pass %</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No SmartCoin activity in this window.</td></tr>
              ) : history.map((h) => (
                <tr key={h.date} className="h-[42px] border-b border-gray-50 hover:bg-violet-50/30">
                  <td className="px-5 font-semibold text-gray-700 whitespace-nowrap">{h.date}</td>
                  <td className="px-3 text-right tabular-nums text-gray-700">{fmtNum(h.pushed)}</td>
                  <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">{fmtNum(h.passed)}</td>
                  <td className="px-3 text-right tabular-nums text-amber-700">{fmtNum(h.duplicate)}</td>
                  <td className="px-3 text-right tabular-nums text-gray-500">
                    {h.pushed ? `${Math.round((h.passed / h.pushed) * 1000) / 10}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default SmartCoinFunnel;
