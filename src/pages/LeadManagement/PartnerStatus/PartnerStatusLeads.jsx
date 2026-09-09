import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, Users, IndianRupee, CheckCircle2, Search, RefreshCw, X, Phone, Download, Clock } from "lucide-react";
import { getPartnerStatusLeads, getPartnerStatusPartners } from "../../../api-services/Modules/PartnerStatus";
import PremiumPageLoader from "../../../components/PremiumPageLoader";
import CompactDateFilter from "../../../components/CompactDateFilter";
import TablePagination from "../../../components/TablePagination";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
// Short stamp for the table; the full one stays in the tooltip and the drawer.
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

const statusTone = (s) => {
  const t = String(s || "").toUpperCase();
  if (/DISBURS|APPROVED|ELIGIBLE|SUCCESS/.test(t) && !/INELIGIBLE/.test(t)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (/REJECT|INELIGIBLE|FAIL|DECLINE/.test(t)) return "bg-rose-50 text-rose-700 border-rose-200";
  if (/DUPLICATE|EXIST|PENDING|PROCESS|ONBOARD/.test(t)) return "bg-amber-50 text-amber-700 border-amber-200";
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
          <span>PAN {row.pan}</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusTone(row.statusBucket)}`}>
            {row.statusBucket}
          </span>
        </p>
      </div>

      <div className="overflow-y-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
        {[
          ["Final Status", row.finalStatus],
          ["Raw Status", row.rawStatus],
          ["Found at partner", row.found ? "Yes" : "No"],
          ["External Loan ID", row.externalLoanId],
          ["Loan Amount", row.loanAmount != null ? inr(row.loanAmount) : null],
          ["Disbursed Amount", row.disbursedAmount != null ? inr(row.disbursedAmount) : null],
          ["Disbursed Date", row.disbursedDate ? fmtDT(row.disbursedDate) : null],
          ["Last Checked", fmtDT(row.checkedAt)],
          ["First Checked", row.firstCheckedAt ? fmtDT(row.firstCheckedAt) : null],
          ["Status Changed", row.statusChangedAt ? fmtDT(row.statusChangedAt) : null],
          ["Times Checked", row.checkCount],
          ["Ticket Type", row.type],
          ["Medium", row.utmMedium],
          ["Clicked At", row.clickedAt ? fmtDT(row.clickedAt) : null],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{k}</p>
            <p className="text-gray-800 break-words">{v || "—"}</p>
          </div>
        ))}

        {/* Why the lead sits where it does */}
        {[["Message", row.message], ["Rejection Reason", row.rejectionReason],
          ["Ineligibility Reason", row.ineligibilityReason], ["Error", row.errorMessage]]
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

const PartnerStatusLeads = ({ embedded = false, pinnedPartner = '' }) => {
  const [data, setData] = useState(null);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [active, setActive] = useState(null);

  const [partner, setPartner] = useState(pinnedPartner);
  const [range, setRange] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [disbursedOn, setDisbursedOn] = useState("");
  const [disbursedFrom, setDisbursedFrom] = useState("");
  const [disbursedTo, setDisbursedTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // When the caller pins a partner (the LoanWalle dropdown does), follow it.
  useEffect(() => { if (pinnedPartner) setPartner(pinnedPartner); }, [pinnedPartner]);

  // Standalone use opens on whichever partner actually has data — two of the four
  // tables are still empty, and landing on an empty one reads as a broken page.
  useEffect(() => {
    getPartnerStatusPartners()
      .then((r) => {
        const list = r?.data?.data || [];
        setPartners(list);
        if (!pinnedPartner) {
          setPartner((p) => p || (list.find((x) => x.rows > 0)?.key ?? list[0]?.key ?? ""));
        }
      })
      .catch(() => setPartners([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useMemo(
    () => ({
      partner,
      type: (!fromDate || !toDate) && range ? range : undefined,
      fromDate: fromDate && toDate ? fromDate : undefined,
      toDate: fromDate && toDate ? toDate : undefined,
      status: status || undefined,
      search,
      disbursedOn: disbursedOn || undefined,
      disbursedFrom: disbursedFrom && disbursedTo ? disbursedFrom : undefined,
      disbursedTo: disbursedFrom && disbursedTo ? disbursedTo : undefined,
      perPage,
      currentPage: page,
    }),
    [partner, range, fromDate, toDate, status, search, page, perPage, disbursedOn, disbursedFrom, disbursedTo],
  );

  const fetchData = useCallback(async () => {
    if (!partner) return;
    setLoading(true);
    try {
      const res = await getPartnerStatusLeads(params);
      setData(res?.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [params, partner]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = data?.data || [];
  const s = data?.summary || {};
  const total = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;
  const partnerLabel = data?.partner?.label || "";

  // Same rule as the Leads tab: export the whole FILTERED set, not the current
  // page. Re-runs the table's own `params` with paging widened to the cap.
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    let all = rows;
    try {
      const res = await getPartnerStatusLeads({ ...params, perPage: 100000, currentPage: 1 });
      all = res?.data?.data?.data || rows;
    } catch {
      /* fall back to what is on screen rather than handing back nothing */
    } finally {
      setExporting(false);
    }

    const head = ["PAN", "Name", "Mobile", "Found", "Status Bucket", "Final Status", "Raw Status",
      "Message", "Rejection Reason", "Ineligibility Reason", "External Loan ID",
      "Loan Amount", "Disbursed Amount", "Disbursed Date", "Last Checked", "First Checked",
      "Status Changed", "Times Checked", "Ticket Type", "Medium"];
    const body = all.map((r) => [
      r.pan, r.name, r.mobile, r.found ? "Yes" : "No", r.statusBucket, r.finalStatus, r.rawStatus,
      r.message, r.rejectionReason, r.ineligibilityReason, r.externalLoanId,
      r.loanAmount ?? "", r.disbursedAmount ?? "", r.disbursedDate ?? "", r.checkedAt,
      r.firstCheckedAt ?? "", r.statusChangedAt ?? "", r.checkCount ?? "", r.type ?? "", r.utmMedium ?? "",
    ]);
    const csv = [head, ...body]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${partner}_status_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (firstLoad && !embedded) {
    return (
      <PremiumPageLoader
        theme="purple"
        title="Loading Partner Status"
        brandLabel="Partner Lead Status"
        icon={Network}
        phrases={["Reading partner verdicts…", "Resolving customers…", "Grouping by outcome…"]}
        tiles={[{ label: "Checks" }, { label: "Found" }, { label: "Disbursed" }]}
        progressLabel="Preparing the status list"
      />
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden px-1 pb-10">
      {/* Own header only when this renders as its own page; inside LoanWalle the
          shell supplies it, so just the export control moves onto the switcher row. */}
      {!embedded && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-white border border-indigo-100 p-5 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 grid place-items-center text-white shadow">
              <Network size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Partner Status</h1>
              <p className="text-[13px] text-gray-500">
                What each partner says about the leads we sent them — the same LoanWalle leads, split by partner.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Partner switcher — row count on each so an empty feed is obvious. Hidden
          when the parent pins the partner (LoanWalle drives it from one dropdown). */}
      {!pinnedPartner && (
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wide mr-1">Partner:</span>
        {partners.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPartner(p.key); setStatus(""); setPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border transition ${
              partner === p.key
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {p.label}
            <span className={`px-1.5 py-px rounded-full text-[10.5px] tabular-nums ${partner === p.key ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>
              {fmtNum(p.rows)}
            </span>
          </button>
        ))}
        <button
          onClick={exportCsv}
          disabled={!rows.length || exporting}
          title={`Exports all ${fmtNum(total)} leads matching the current filters`}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 shadow-sm"
        >
          <Download size={13} className={exporting ? "animate-pulse" : ""} />
          {exporting ? "Preparing…" : `Export CSV (${fmtNum(total)})`}
        </button>
      </div>
      )}

      {/* KPIs */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Kpi icon={<Users size={13} />} label="Total Leads" value={fmtNum(s.total)} sub={`${fmtNum(s.customers)} unique customers`} tone="border-indigo-200" />
        <Kpi icon={<CheckCircle2 size={13} />} label="Disbursed" value={fmtNum(s.disbursedCount)} sub="loans disbursed" tone="border-emerald-200" />
        <Kpi icon={<IndianRupee size={13} />} label="Disbursed Amount" value={inr(s.disbursedAmount)} sub="total paid out" tone="border-purple-200" />
        <Kpi icon={<Clock size={13} />} label="Loan Amount" value={inr(s.loanAmount)} sub="approved / offered" tone="border-amber-200" />
        {/* Partner-only extra: how many of these PANs the partner could actually
            match on their side. It is NOT a funnel stage, so it sits after the
            four shared cards rather than replacing one of them. */}
        <Kpi icon={<Search size={13} />} label="Found at Partner" value={fmtNum(s.foundCount)} sub="matched on their side" tone="border-sky-200" />
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

        {/* Second, independent date control. The one above buckets a lead by
            when it CAME IN; this one by when the money actually went out - a
            lead clicked in August can disburse in September, so neither filter
            can answer the other's question. */}
        <CompactDateFilter
          label="Disbursed"
          range={disbursedOn}
          onRangeChange={(k) => { setDisbursedOn(k); setPage(1); }}
          fromDate={disbursedFrom}
          toDate={disbursedTo}
          onFromChange={(v) => { setDisbursedFrom(v); setPage(1); }}
          onToChange={(v) => { setDisbursedTo(v); setPage(1); }}
          onClearRange={() => { setDisbursedFrom(""); setDisbursedTo(""); setPage(1); }}
        />

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="PAN / name / mobile…"
            className="pl-8 pr-2 py-1.5 w-60 text-[12.5px] rounded-lg bg-white border border-gray-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <button onClick={fetchData} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>

        {pinnedPartner && (
          <button
            onClick={exportCsv}
            disabled={!rows.length || exporting}
            title={`Exports all ${fmtNum(total)} leads matching the current filters`}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 shadow-sm"
          >
            <Download size={13} className={exporting ? "animate-pulse" : ""} />
          {exporting ? "Preparing…" : `Export CSV (${fmtNum(total)})`}
          </button>
        )}
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
          <h2 className="text-[15px] font-bold text-gray-800">{partnerLabel || "Partner"} · Leads</h2>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
            {fmtNum(total)} ENTRIES
          </span>
        </div>

        <div className="overflow-x-auto">
          {/* Same fixed grid as the Leads table — auto layout starved Name and left
              every row a different height. */}
          <table className="w-full text-[12.5px] table-fixed min-w-[980px]">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[132px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
              <col />
              <col className="w-[100px]" />
              <col className="w-[128px]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-2.5 font-medium">Lead</th>
                <th className="px-3 py-2.5 font-medium">Mobile</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Final Status</th>
                <th className="px-3 py-2.5 font-medium">Reason</th>
                <th className="px-3 py-2.5 font-medium text-right">Disbursed</th>
                <th className="px-3 py-2.5 font-medium">Checked</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                  No leads yet for {partnerLabel || "this partner"}.
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={`${r.pan}-${i}`} onClick={() => setActive(r)} className="h-[46px] border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer" title="Open full detail">
                  <td className="px-5 max-w-0">
                    <div className="font-semibold text-gray-800 truncate" title={r.name || ""}>{r.name || "—"}</div>
                    <div className="font-mono text-[10.5px] text-gray-400 truncate">{r.pan || "—"}</div>
                  </td>
                  <td className="px-3">
                    {r.mobile ? (
                      <a href={`tel:${r.mobile}`} onClick={(e) => e.stopPropagation()} className="font-mono text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
                        <Phone size={11} /> {r.mobile}
                      </a>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border whitespace-nowrap ${statusTone(r.statusBucket)}`}>
                      {r.statusBucket || "—"}
                    </span>
                  </td>
                  <td className="px-3 max-w-0 truncate text-gray-600" title={r.finalStatus || ""}>
                    {r.finalStatus || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 max-w-0 truncate text-gray-500" title={reasonOf(r)}>
                    {reasonOf(r) || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">
                    {r.disbursedAmount ? inr(r.disbursedAmount) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 text-gray-500 whitespace-nowrap" title={fmtDT(r.checkedAt)}>{fmtDTShort(r.checkedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
          noun="leads"
        />
      </div>

      {active && <DetailModal row={active} onClose={() => setActive(null)} />}
    </div>
  );
};

export default PartnerStatusLeads;
