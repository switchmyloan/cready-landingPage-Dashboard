import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, RefreshCw, Download, Filter, IndianRupee,
} from "lucide-react";
import { getRamFinCorpHistory, getRamFinCorpUtmMediums } from "../../../api-services/Modules/RamFinCorpFunnel";
import PremiumPageLoader from "../../../components/PremiumPageLoader";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtInr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const fmtPct = (n) => `${Number(n) || 0}%`;
const fmtDay = (d) => {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// RamFinCorp went live 20 Aug 2026 — the backend floors every query there, so
// there is no "All time" and the pickers can't reach further back.
const LIVE_FROM = "2026-08-20";
const RANGE_CHIPS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "current_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
];
const SCOPE_CHIPS = [
  { key: "high", label: "High Ticket" },
  { key: "short", label: "Short Ticket" },
];
const SHIMMER = {
  background: "linear-gradient(90deg, #f5f3ff 25%, #e9d5ff 45%, #f5f3ff 65%)",
  backgroundSize: "200% 100%",
  animation: "rfd-shimmer 1.3s linear infinite",
};
const Sk = ({ className = "" }) => <span className={`block rounded ${className}`} style={SHIMMER} />;

// A percentage cell reads against the stage before it, so colour it by how well
// that step converted rather than by an absolute scale.
const pctTone = (p) => (p >= 50 ? "text-emerald-600" : p >= 20 ? "text-amber-600" : "text-gray-400");

const Chips = ({ options, value, onChange, label, icon }) => (
  <div className="flex items-center gap-2">
    {label && (
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">
        {icon} {label}
      </span>
    )}
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 text-[12.5px] font-medium transition ${
            value === o.key ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const Kpi = ({ label, value, sub, tone = "border-gray-200" }) => (
  <div className={`flex-1 min-w-[150px] rounded-xl border ${tone} bg-white px-4 py-3 shadow-sm`}>
    <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-[24px] leading-none font-extrabold text-gray-900 mt-1 tabular-nums">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

const RamFinCorpDashboard = () => {
  const [data, setData] = useState(null);
  const [mediums, setMediums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [scope, setScope] = useState("high");
  const [range, setRange] = useState("current_month");
  const [utmMedium, setUtmMedium] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const dateParams = useMemo(
    () => (fromDate && toDate ? { fromDate, toDate } : range ? { type: range } : {}),
    [range, fromDate, toDate],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRamFinCorpHistory({ scope, utmMedium: utmMedium || undefined, ...dateParams });
      setData(res?.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [scope, utmMedium, dateParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Medium options follow the ticket toggle — the two books run different traffic.
  useEffect(() => {
    let alive = true;
    getRamFinCorpUtmMediums({ scope })
      .then((res) => { if (alive) setMediums(res?.data?.data || []); })
      .catch(() => { if (alive) setMediums([]); });
    return () => { alive = false; };
  }, [scope]);

  const rows = data?.matrix || [];
  const t = data?.totals || {};

  const exportCsv = () => {
    const head = [
      "Date", "Dedupe checked", "Dedupe Pass", "Dedupe pass (%)",
      "Ram Fincorp(lender) selected", "lender selected/dedupe pass %",
      "Offer received", "offer/selected", "Total offer amount", "avg offer amount",
    ];
    const line = (r) => [
      r.date, r.dedupe_checked, r.dedupe_pass, `${r.dedupe_pass_pct}%`,
      r.lender_selected, `${r.lender_selected_pct}%`,
      r.offer_received, `${r.offer_received_pct}%`,
      Math.round(r.total_offer_amount), Math.round(r.avg_offer_amount),
    ];
    const csv = [head, ...rows.map(line), [], ["Grand total", ...line(t).slice(1)]]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ramfincorp_dashboard_${scope}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (firstLoad) {
    return (
      <PremiumPageLoader
        theme="purple"
        title="Loading RamFinCorp Dashboard"
        brandLabel="Lender Reporting"
        icon={LayoutDashboard}
        phrases={["Counting dedupe checks…", "Matching lender selections…", "Totalling offers…"]}
        tiles={[{ label: "Dedupe" }, { label: "Selected" }, { label: "Offers" }]}
        progressLabel="Building the daily report"
      />
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden px-1 pb-10">
      <style>{`@keyframes rfd-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-purple-50 via-violet-50 to-white border border-purple-100 p-5 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow">
            <LayoutDashboard size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">RamFinCorp Dashboard</h1>
            <p className="text-[13px] text-gray-500">
              Daily funnel — dedupe checked to offer received, with offer value. Each % is measured
              against the stage before it.
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={!rows.length}
            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm flex flex-wrap items-center gap-x-5 gap-y-3">
        <Chips options={SCOPE_CHIPS} value={scope} onChange={setScope} label="Ticket" />

        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {RANGE_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => { setRange(c.key); setFromDate(""); setToDate(""); }}
              className={`px-3 py-1.5 text-[12.5px] font-medium transition ${
                !fromDate && !toDate && range === c.key ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1.5">
          <input
            type="date" min={LIVE_FROM} value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setRange(""); }}
            className="px-2 py-1.5 text-[12px] rounded-lg border border-gray-200 text-gray-600"
          />
          <span className="text-gray-400 text-xs">→</span>
          <input
            type="date" min={LIVE_FROM} value={toDate}
            onChange={(e) => { setToDate(e.target.value); setRange(""); }}
            className="px-2 py-1.5 text-[12px] rounded-lg border border-gray-200 text-gray-600"
          />
        </div>

        <div className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">
            <Filter size={11} /> Medium
          </span>
          <select
            value={utmMedium}
            onChange={(e) => setUtmMedium(e.target.value)}
            className="px-2 py-1.5 text-[12.5px] rounded-lg border border-gray-200 text-gray-600 bg-white"
          >
            <option value="">All mediums</option>
            {mediums.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <button onClick={fetchData} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>

        <span className="text-[11px] text-gray-400 basis-full">
          Every stage is credited on the day the lead came in, so a row is one cohort's
          funnel. Data since 20 Aug 2026 (go-live).
        </span>
      </div>

      {/* Totals */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Kpi label="Dedupe checked" value={fmtNum(t.dedupe_checked)} sub="pushed to RamFinCorp" tone="border-blue-200" />
        <Kpi label="Dedupe pass" value={fmtNum(t.dedupe_pass)} sub={`${fmtPct(t.dedupe_pass_pct)} of checked`} tone="border-emerald-200" />
        <Kpi label="Lender selected" value={fmtNum(t.lender_selected)} sub={`${fmtPct(t.lender_selected_pct)} of dedupe pass`} tone="border-violet-200" />
        <Kpi label="Offer received" value={fmtNum(t.offer_received)} sub={`${fmtPct(t.offer_received_pct)} of selected`} tone="border-amber-200" />
        <Kpi label="Offer amount" value={fmtInr(t.total_offer_amount)} sub={`avg ${fmtInr(t.avg_offer_amount)}`} tone="border-purple-200" />
      </div>

      {/* Daily table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gradient-to-br from-purple-50/60 to-white">
          <span className="w-1 h-5 rounded-full bg-purple-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Daily breakdown</h2>
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100">
            {fmtNum(rows.length)} DAYS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[900px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-2.5 font-medium sticky left-0 bg-gray-50/60">Date</th>
                <th className="px-3 py-2.5 font-medium text-right">Dedupe checked</th>
                <th className="px-3 py-2.5 font-medium text-right">Dedupe pass</th>
                <th className="px-3 py-2.5 font-medium text-right">Dedupe pass %</th>
                <th className="px-3 py-2.5 font-medium text-right">Lender selected</th>
                <th className="px-3 py-2.5 font-medium text-right">Selected / pass %</th>
                <th className="px-3 py-2.5 font-medium text-right">Offer received</th>
                <th className="px-3 py-2.5 font-medium text-right">Offer / selected %</th>
                <th className="px-3 py-2.5 font-medium text-right">Total offer amt</th>
                <th className="px-3 py-2.5 font-medium text-right">Avg offer amt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk${i}`} className="border-b border-gray-50">
                    <td className="px-5 py-3"><Sk className="h-3.5 w-24" /></td>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-3 py-3"><Sk className="h-3.5 w-14 ml-auto" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-400">No leads in this period.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.date} className="border-b border-gray-50 hover:bg-purple-50/30">
                  <td className="px-5 py-3 font-semibold text-gray-700 whitespace-nowrap sticky left-0 bg-white">{fmtDay(r.date)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-gray-900">{fmtNum(r.dedupe_checked)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-800">{fmtNum(r.dedupe_pass)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold ${pctTone(r.dedupe_pass_pct)}`}>{fmtPct(r.dedupe_pass_pct)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-800">{fmtNum(r.lender_selected)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold ${pctTone(r.lender_selected_pct)}`}>{fmtPct(r.lender_selected_pct)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-700">{fmtNum(r.offer_received)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold ${pctTone(r.offer_received_pct)}`}>{fmtPct(r.offer_received_pct)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-800">{r.total_offer_amount ? fmtInr(r.total_offer_amount) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">{r.avg_offer_amount ? fmtInr(r.avg_offer_amount) : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/70 font-bold">
                  <td className="px-5 py-3 text-gray-700 sticky left-0 bg-gray-50/70">Grand total</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-900">{fmtNum(t.dedupe_checked)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-900">{fmtNum(t.dedupe_pass)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${pctTone(t.dedupe_pass_pct)}`}>{fmtPct(t.dedupe_pass_pct)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-900">{fmtNum(t.lender_selected)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${pctTone(t.lender_selected_pct)}`}>{fmtPct(t.lender_selected_pct)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{fmtNum(t.offer_received)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${pctTone(t.offer_received_pct)}`}>{fmtPct(t.offer_received_pct)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-900">{fmtInr(t.total_offer_amount)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">{fmtInr(t.avg_offer_amount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100 flex items-center gap-1.5">
          <IndianRupee size={11} />
          Offer amount comes from RamFinCorp's approved offers; the average divides by the offers that
          actually carry a figure, so a "proceed to bank" with no amount doesn't pull it down.
        </p>
      </div>
    </div>
  );
};

export default RamFinCorpDashboard;
