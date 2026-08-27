import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, TrendingDown, Search,
  RefreshCw, ChevronLeft, ChevronRight, Phone, BadgeCheck, MousePointerClick,
} from "lucide-react";
import { getRamFinCorpFunnel, getRamFinCorpStageLeads } from "../../../api-services/Modules/RamFinCorpFunnel";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtInr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const RANGE_CHIPS = [
  { key: "", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
];

// RamFinCorp runs in BOTH flows — scope resolves each MIS lead by which of our
// tables pushed it (offerLeads → High, shortOfferLeads → Short).
const SCOPE_CHIPS = [
  { key: "", label: "All" },
  { key: "high", label: "High Ticket" },
  { key: "short", label: "Short Ticket" },
];

const STATUS_CHIP = (s) => {
  const t = String(s || "").toLowerCase();
  if (/disbursed|closed|part payment|success/.test(t)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (/approved|document|sheet|proceed/.test(t)) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (/reject|not eligible|fail|dedup/.test(t)) return "bg-rose-50 text-rose-700 border-rose-200";
  if (/fresh|incomplete/.test(t)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
};

// Clickable KPI card — the page's only navigation: clicking loads that stage's
// leads into the panel below (replaces the old funnel visualisation).
const Kpi = ({ icon, label, value, sub, tone, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 shadow-sm bg-white text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${tone} ${active ? "ring-2 ring-purple-500 ring-offset-1 shadow-md" : ""}`}
    title={`Show ${label} leads below`}
  >
    <div className="flex items-center gap-1.5 mb-1 opacity-80">
      {icon}
      <span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-[24px] leading-none font-extrabold text-gray-900">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </button>
);

// ── Inline leads panel — the data for whichever KPI card is active ──────────
const LeadsPanel = ({ stage, label, dateParams }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const perPage = 10;

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset paging when the selected card / filters change.
  useEffect(() => { setPage(1); }, [stage, dateParams]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getRamFinCorpStageLeads({ stage, perPage, currentPage: page, search, ...dateParams })
      .then((res) => {
        if (!alive) return;
        setRows(res?.data?.data?.data || []);
        setTotal(res?.data?.data?.pagination?.total || 0);
      })
      .catch(() => { if (alive) { setRows([]); setTotal(0); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [stage, page, search, dateParams]);

  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gradient-to-br from-purple-50/60 to-white">
        <span className="w-1 h-5 rounded-full bg-purple-600" />
        <h2 className="text-[15px] font-bold text-gray-800">{label}</h2>
        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100">
          {fmtNum(total)} LEADS
        </span>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name / mobile / lead id…"
            className="pl-8 pr-2 py-1.5 w-56 text-[12.5px] rounded-lg bg-white border border-gray-200 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[780px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <th className="px-5 py-2.5 font-medium">Lead ID</th>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Mobile</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Approved ₹</th>
              <th className="px-3 py-2.5 font-medium text-right">Disbursed ₹</th>
              <th className="px-3 py-2.5 font-medium">Lead Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No leads found.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={`${r.leadId}-${r.mobile}-${i}`} className="border-b border-gray-50 hover:bg-purple-50/30">
                <td className="px-5 py-2.5 font-mono text-gray-500">{r.leadId}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-800">{r.name || "—"}</td>
                <td className="px-3 py-2.5">
                  {r.mobile ? (
                    <a href={`tel:${r.mobile}`} className="font-mono text-purple-700 hover:underline inline-flex items-center gap-1">
                      <Phone size={11} /> {r.mobile}
                    </a>
                  ) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${STATUS_CHIP(r.status)}`}>{r.status || "—"}</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{r.approveAmount ? fmtInr(r.approveAmount) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{r.disbursalAmount ? fmtInr(r.disbursalAmount) : "—"}</td>
                <td className="px-3 py-2.5 text-gray-500">{fmtDT(r.leadAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
        <p className="text-[12px] text-gray-500">Page {page} / {totalPages}</p>
        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={15} /></button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  );
};

// ── Main page ───────────────────────────────────────────────────────────────
const RamFinCorpFunnel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [scope, setScope] = useState(""); // '' = all, 'high', 'short'
  // Which KPI card is active — its leads render in the panel below.
  const [active, setActive] = useState({ stage: "dedup_success", label: "Dedup Success" });

  const dateParams = {
    ...((!range && fromDate && toDate) ? { fromDate, toDate } : range ? { type: range } : {}),
    ...(scope ? { scope } : {}),
  };
  // Stable key so child effects only refire on real filter changes.
  const dateKey = JSON.stringify(dateParams);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRamFinCorpFunnel(dateParams);
      setData(res?.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = data?.totals || {};
  const pctSel = (v) => (totals.selected ? `${((v / totals.selected) * 100).toFixed(1)}% of selected` : "");

  const CARDS = [
    { stage: "dedup_success", label: "Dedup Success", icon: <BadgeCheck size={13} />, value: fmtNum(totals.dedupSuccess), sub: "distinct phones · RamFinCorp dedupe passed (submit date)", tone: "border-emerald-200" },
    { stage: "selected", label: "Lender Selected", icon: <MousePointerClick size={13} />, value: fmtNum(totals.selected), sub: "clicked RamFinCorp on our site", tone: "border-fuchsia-200" },
    { stage: "bre_approved", label: "BRE Approved", icon: <CheckCircle2 size={13} />, value: fmtNum(totals.breApproved), sub: `${pctSel(totals.breApproved)} · approved at RamFinCorp`, tone: "border-indigo-200" },
  ];

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden px-1 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 via-violet-50 to-white border border-purple-100 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 grid place-items-center text-white shadow">
            <TrendingDown size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">RamFinCorp Funnel</h1>
            <p className="text-[13px] text-gray-500">Switchmyloan-attributed leads from the daily RamFinCorp MIS — click any card to see its leads.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm flex flex-wrap items-center gap-3">
        {/* High/Short scope toggle */}
        <div className="inline-flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Ticket:</span>
          <div className="inline-flex rounded-lg border border-purple-200 overflow-hidden">
            {SCOPE_CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setScope(c.key)}
                className={`px-3 py-2 text-[12.5px] font-semibold transition ${scope === c.key
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                  : "bg-white text-purple-700 hover:bg-purple-50"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <span className="hidden sm:inline-block w-px h-6 bg-gray-200" />

        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {RANGE_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => { setRange(c.key); setFromDate(""); setToDate(""); }}
              className={`px-3 py-2 text-[12.5px] font-medium transition ${!fromDate && !toDate && range === c.key ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1.5">
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setRange(""); }}
            className="px-2 py-2 text-[12.5px] rounded-lg border border-gray-200 text-gray-600" />
          <span className="text-gray-400 text-xs">→</span>
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setRange(""); }}
            className="px-2 py-2 text-[12.5px] rounded-lg border border-gray-200 text-gray-600" />
        </div>
        <button onClick={fetchData} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
        <span className="text-[11px] text-gray-400 ml-auto">Date filter = lender-selection (click) date — other cards show where that cohort stands now</span>
      </div>

      {/* Journey KPI cards — click one to load its leads below */}
      <div className="flex flex-wrap gap-3 mb-4">
        {CARDS.map((c) => (
          <Kpi key={c.stage} {...c} active={active.stage === c.stage} onClick={() => setActive({ stage: c.stage, label: c.label })} />
        ))}
      </div>

      {/* Inline leads panel for the active card */}
      <LeadsPanel key={`${active.stage}-${dateKey}`} stage={active.stage} label={active.label} dateParams={dateParams} />
    </div>
  );
};

export default RamFinCorpFunnel;
