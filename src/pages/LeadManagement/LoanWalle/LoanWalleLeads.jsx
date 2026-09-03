import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Landmark, Users, IndianRupee, CheckCircle2, Search, RefreshCw, X,
  Phone, Download, ChevronLeft, ChevronRight, Clock,
} from "lucide-react";
import { getLoanWalleLeads, getLoanWalleTypes, getLoanWalleMediums, getLoanWallePartners } from "../../../api-services/Modules/LoanWalle";
import PremiumPageLoader from "../../../components/PremiumPageLoader";
import CompactDateFilter from "../../../components/CompactDateFilter";
import PartnerStatusLeads from "../PartnerStatus/PartnerStatusLeads";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
// Table cells show a short stamp ("03 Sep, 01:04 pm"); the full one is the cell's
// tooltip and lives in the detail drawer. The year was eating ~40px per row for
// information that is the same on every row.
const fmtDTShort = (v) => {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};
const reasonOf = (r) => r.message || r.rejectionReason || r.ineligibilityReason || "";

const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

// statusBucket is LoanWalle's own coarse grouping. Green = money moved, red =
// the lead is dead, amber = it needs somebody to act, grey = nothing yet.
const statusTone = (s) => {
  const t = String(s || "").toUpperCase();
  if (/DISBURS|APPROVED|SUCCESS/.test(t)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (/REJECT|INELIGIBLE|FAIL|DECLINE/.test(t)) return "bg-rose-50 text-rose-700 border-rose-200";
  if (/DUPLICATE|EXIST|PENDING|PROCESS/.test(t)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (/NOT_FOUND/.test(t)) return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
};

const Kpi = ({ icon, label, value, sub, tone }) => (
  <div className={`flex-1 min-w-[165px] rounded-xl border bg-white px-4 py-3 shadow-sm ${tone}`}>
    <div className="flex items-center gap-1.5 mb-1 text-gray-400">
      {icon}
      <span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-[24px] leading-none font-extrabold text-gray-900 tabular-nums">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

const Chip = ({ label, count, active, onClick, tone }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition ${
      active ? "ring-2 ring-indigo-400 ring-offset-1" : ""
    } ${tone}`}
  >
    {label}
    <span className="px-1.5 py-px rounded-full bg-white/70 text-[10.5px] tabular-nums">{fmtNum(count)}</span>
  </button>
);

// ── Detail drawer — every field the row carries, including the reason text ──
const DetailModal = ({ row, onClose }) => (
  <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white w-full max-w-2xl max-h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="relative px-6 py-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-white border-b border-gray-100">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70">
          <X size={18} />
        </button>
        <h3 className="text-lg font-bold text-gray-900">{row.name || "Unnamed"}</h3>
        <p className="text-[12px] text-gray-500 flex flex-wrap items-center gap-x-3 mt-0.5">
          <span className="inline-flex items-center gap-1"><Phone size={12} /> {row.mobile || "—"}</span>
          <span>PAN {row.pan || "—"}</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusTone(row.statusBucket)}`}>
            {row.statusBucket}
          </span>
        </p>
      </div>

      <div className="overflow-y-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
        {[
          ["Final Status", row.finalStatus],
          ["Raw Status", row.rawStatus],
          ["Ticket Type", row.type],
          ["Partner", row.partnerName],
          ["Email", row.email],
          ["External Loan ID", row.externalLoanId],
          ["Loan Amount", row.loanAmount != null ? inr(row.loanAmount) : null],
          ["Disbursed Amount", row.disbursedAmount != null ? inr(row.disbursedAmount) : null],
          ["Disbursed Date", row.disbursedDate ? fmtDT(row.disbursedDate) : null],
          ["UTM Source", row.utmSource],
          ["UTM Medium", row.utmMedium],
          ["Clicked At", fmtDT(row.clickedAt)],
          ["Status Changed", fmtDT(row.statusChangedAt)],
          ["Last Checked", fmtDT(row.lastCheckedAt)],
          ["Checked", `${row.checkCount} times`],
          ["Final?", row.isFinal ? "Yes" : "No"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{k}</p>
            <p className="text-gray-800 break-words">{v || "—"}</p>
          </div>
        ))}

        {/* The narrative fields — why the lead is where it is */}
        {[["Message", row.message], ["Rejection Reason", row.rejectionReason], ["Ineligibility Reason", row.ineligibilityReason]]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{k}</p>
              <p className="text-gray-800 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mt-1">{v}</p>
            </div>
          ))}
      </div>
    </div>
  </div>
);

const LeadsPanel = () => {
  const [data, setData] = useState(null);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [active, setActive] = useState(null);

  const [range, setRange] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [ticket, setTicket] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [mediums, setMediums] = useState([]);
  const [partnerName, setPartnerName] = useState("");
  const [partners, setPartners] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // An explicit range wins over the preset chips (the backend applies the same
  // precedence), so picking dates clears the active chip.
  const params = useMemo(
    () => ({
      type: (!fromDate || !toDate) && range ? range : undefined,
      fromDate: fromDate && toDate ? fromDate : undefined,
      toDate: fromDate && toDate ? toDate : undefined,
      status: status || undefined,
      ticket: ticket || undefined,
      utmMedium: utmMedium || undefined,
      partnerName: partnerName || undefined,
      search,
      perPage,
      currentPage: page,
    }),
    [range, fromDate, toDate, status, ticket, utmMedium, partnerName, search, page],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLoanWalleLeads(params);
      setData(res?.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getLoanWalleTypes().then((r) => setTypes(r?.data?.data || [])).catch(() => setTypes([]));
    getLoanWalleMediums().then((r) => setMediums(r?.data?.data || [])).catch(() => setMediums([]));
    getLoanWallePartners().then((r) => setPartners(r?.data?.data || [])).catch(() => setPartners([]));
  }, []);

  const rows = data?.data || [];
  const s = data?.summary || {};
  const total = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  const exportCsv = () => {
    const head = ["Name", "Mobile", "PAN", "Email", "Type", "Partner", "Status Bucket", "Final Status",
      "Message", "Rejection Reason", "Ineligibility Reason", "External Loan ID",
      "Loan Amount", "Disbursed Amount", "Disbursed Date", "UTM Source", "UTM Medium",
      "Clicked At", "Status Changed", "Last Checked", "Check Count"];
    const body = rows.map((r) => [
      r.name, r.mobile, r.pan, r.email, r.type, r.partnerName, r.statusBucket, r.finalStatus,
      r.message, r.rejectionReason, r.ineligibilityReason, r.externalLoanId,
      r.loanAmount ?? "", r.disbursedAmount ?? "", r.disbursedDate ?? "",
      r.utmSource, r.utmMedium, r.clickedAt, r.statusChangedAt, r.lastCheckedAt, r.checkCount,
    ]);
    const csv = [head, ...body]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `loanwalle_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (firstLoad) {
    return (
      <PremiumPageLoader
        theme="purple"
        title="Loading LoanWalle"
        brandLabel="Lender Leads"
        icon={Landmark}
        phrases={["Reading the latest statuses…", "Grouping by outcome…", "Totalling disbursals…"]}
        tiles={[{ label: "Leads" }, { label: "Customers" }, { label: "Disbursed" }]}
        progressLabel="Preparing the lead list"
      />
    );
  }

  return (
    <>
      {/* KPIs */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Kpi icon={<Users size={13} />} label="Total Leads" value={fmtNum(s.total)} sub={`${fmtNum(s.customers)} unique customers`} tone="border-indigo-200" />
        <Kpi icon={<CheckCircle2 size={13} />} label="Disbursed" value={fmtNum(s.disbursedCount)} sub="loans disbursed" tone="border-emerald-200" />
        <Kpi icon={<IndianRupee size={13} />} label="Disbursed Amount" value={inr(s.disbursedAmount)} sub="total paid out" tone="border-purple-200" />
        <Kpi icon={<Clock size={13} />} label="Loan Amount" value={inr(s.loanAmount)} sub="approved / offered" tone="border-amber-200" />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3 shadow-sm flex flex-wrap items-center gap-x-4 gap-y-3">
        <CompactDateFilter
          range={range}
          onRangeChange={(k) => { setRange(k); setPage(1); }}
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={(v) => { setFromDate(v); setPage(1); }}
          onToChange={(v) => { setToDate(v); setPage(1); }}
          onClearRange={() => { setFromDate(""); setToDate(""); setPage(1); }}
        />

        <select
          value={ticket}
          onChange={(e) => { setTicket(e.target.value); setPage(1); }}
          className="px-2 py-1.5 text-[12.5px] rounded-lg border border-gray-200 text-gray-600 bg-white"
        >
          <option value="">All ticket types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={utmMedium}
          onChange={(e) => { setUtmMedium(e.target.value); setPage(1); }}
          className="px-2 py-1.5 text-[12.5px] rounded-lg border border-gray-200 text-gray-600 bg-white"
        >
          <option value="">All mediums</option>
          {mediums.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <select
          value={partnerName}
          onChange={(e) => { setPartnerName(e.target.value); setPage(1); }}
          className="px-2 py-1.5 text-[12.5px] rounded-lg border border-gray-200 text-gray-600 bg-white"
        >
          <option value="">All partners</option>
          {partners.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name / mobile / PAN / email…"
            className="pl-8 pr-2 py-1.5 w-64 text-[12.5px] rounded-lg bg-white border border-gray-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <button onClick={fetchData} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>

        <button
          onClick={exportCsv}
          disabled={!rows.length}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 shadow-sm"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wide mr-1">Status:</span>
        <Chip label="All" count={s.total || 0} active={!status} onClick={() => { setStatus(""); setPage(1); }} tone="bg-indigo-50 text-indigo-700 border-indigo-200" />
        {(s.byStatus || []).map((b) => (
          <Chip
            key={b.status}
            label={b.status}
            count={b.count}
            active={status === b.status}
            onClick={() => { setStatus(status === b.status ? "" : b.status); setPage(1); }}
            tone={statusTone(b.status)}
          />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-indigo-600" />
          <h2 className="text-[15px] font-bold text-gray-800">LoanWalle · Leads</h2>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
            {fmtNum(total)} ENTRIES
          </span>
        </div>

        <div className="overflow-x-auto">
          {/* Fixed column grid. On auto layout the browser handed most of the width
              to Reason and starved Name, so names wrapped to two lines and every row
              came out a different height. Widths are declared once here; each cell
              stays on one line and truncates with the full value in its tooltip. */}
          <table className="w-full text-[12.5px] table-fixed min-w-[1060px]">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[132px]" />
              <col className="w-[66px]" />
              <col className="w-[96px]" />
              <col className="w-[104px]" />
              <col className="w-[116px]" />
              <col />
              <col className="w-[100px]" />
              <col className="w-[128px]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-2.5 font-medium">Lead</th>
                <th className="px-3 py-2.5 font-medium">Mobile</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Medium</th>
                <th className="px-3 py-2.5 font-medium">Partner</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Reason</th>
                <th className="px-3 py-2.5 font-medium text-right">Disbursed</th>
                <th className="px-3 py-2.5 font-medium">Clicked</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">No leads found.</td></tr>
              ) : rows.map((r, i) => (
                <tr
                  key={`${r.mobile}-${r.pan}-${i}`}
                  onClick={() => setActive(r)}
                  className="h-[46px] border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer"
                  title="Open full detail"
                >
                  {/* PAN rides under the name — it is identity, not its own column. */}
                  <td className="px-5 max-w-0">
                    <div className="font-semibold text-gray-800 truncate" title={r.name || ""}>{r.name || "—"}</div>
                    <div className="font-mono text-[10.5px] text-gray-400 truncate">{r.pan || "—"}</div>
                  </td>
                  <td className="px-3">
                    <a href={`tel:${r.mobile}`} onClick={(e) => e.stopPropagation()} className="font-mono text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
                      <Phone size={11} /> {r.mobile}
                    </a>
                  </td>
                  <td className="px-3">
                    {r.type ? (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase tracking-wide">{r.type}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 max-w-0 truncate text-gray-600" title={r.utmMedium || ""}>
                    {r.utmMedium || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 max-w-0 truncate text-gray-600" title={r.partnerName || ""}>
                    {r.partnerName || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border whitespace-nowrap ${statusTone(r.statusBucket)}`}>
                      {r.statusBucket || "—"}
                    </span>
                  </td>
                  <td className="px-3 max-w-0 truncate text-gray-500" title={reasonOf(r)}>
                    {reasonOf(r) || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">
                    {r.disbursedAmount ? inr(r.disbursedAmount) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 text-gray-500 whitespace-nowrap" title={fmtDT(r.clickedAt)}>{fmtDTShort(r.clickedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-[12px] text-gray-500">{fmtNum(total)} leads · page {page} / {totalPages}</p>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={15} /></button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {active && <DetailModal row={active} onClose={() => setActive(null)} />}
    </>
  );
};

// LoanWalle is the aggregator; the per-partner status feeds (Toofan /
// RupeeRaftaar / Tejas / F1) describe the SAME leads once they have been passed
// on, so they live here as a second tab rather than as their own module.
// One dropdown drives the whole page: LoanWalle's own lead list, or any single
// downstream partner's status feed. A tab bar plus the partner dropdown was two
// controls doing one job.
const VIEWS = [
  { key: "leads", label: "LoanWalle Leads" },
  { key: "toofan", label: "Toofan" },
  { key: "rupee_raftaar", label: "RupeeRaftaar" },
  { key: "tejas", label: "Tejas" },
  { key: "f1", label: "F1" },
];

const LoanWalleLeads = () => {
  const [view, setView] = useState("leads");

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden px-1 pb-10">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-white border border-indigo-100 p-5 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 grid place-items-center text-white shadow">
            <Landmark size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">LoanWalle</h1>
            <p className="text-[13px] text-gray-500">
              {view === "leads"
                ? "Current status of every lead sent to LoanWalle"
                : "What this partner says about the leads we passed on — one row per status check."}
            </p>
          </div>

          <select
            value={view}
            onChange={(e) => setView(e.target.value)}
            className="ml-auto px-3 py-2 text-[12.5px] font-semibold rounded-lg border border-indigo-200 bg-white text-indigo-700"
          >
            {VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {view === "leads"
        ? <LeadsPanel />
        : <PartnerStatusLeads embedded pinnedPartner={view} key={view} />}
    </div>
  );
};

export default LoanWalleLeads;
