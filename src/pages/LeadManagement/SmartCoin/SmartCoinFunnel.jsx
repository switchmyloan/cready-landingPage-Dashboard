import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, CheckCircle2, FileCheck2, IndianRupee, Copy,
  RefreshCw, Download, Search, X, ChevronDown, Info,
} from "lucide-react";
import {
  getSmartCoinFunnel, getSmartCoinFunnelHistory, getSmartCoinStageLeads,
  getSmartCoinUtmMediums,
} from "../../../api-services/Modules/SmartCoinFunnel";
import CompactDateFilter from "../../../components/CompactDateFilter";
import TablePagination from "../../../components/TablePagination";
import PremiumPageLoader from "../../../components/PremiumPageLoader";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const pctOf = (v, base) => (base ? Math.round((v / base) * 1000) / 10 : 0);
const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};
const fmtDay = (v) => {
  if (!v) return "—";
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short",
  });
};

// Funnel stages, in journey order. SmartCoin dedupes EVERY lead at submit time;
// only the users who pass then see it as a clickable offer, and only a click
// creates the actual SmartCoin lead (the SMLI- id). So the push is the top of
// the funnel, not the click.
//
// The click itself ("Lender Selected") is not a tile: it runs 1:1 with Lead
// Created, so it read as an empty step. The backend still tracks it.
const STAGE_META = {
  pushed: {
    icon: Users,
    short: "Pushed",
    hint: "Pushed to SmartCoin — every lead sent to their dedupe check",
  },
  passed: {
    icon: CheckCircle2,
    short: "Dedupe Passed",
    hint: "SmartCoin had not seen this applicant before",
  },
  leadCreated: {
    icon: FileCheck2,
    short: "Lead Created",
    hint: "SmartCoin issued a lead id (SMLI-…) — the lead reached them",
  },
  leadDuplicate: {
    icon: Copy,
    short: "Lead Duplicate",
    hint: "Passed the first dedupe, then rejected as a duplicate at lead creation — no lead id issued",
  },
  disbursed: {
    icon: IndianRupee,
    short: "Disbursed",
    hint: "Payouts matched back to this lead by its SMLI id",
  },
};

const statusTone = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "lead_created") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v === "passed") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
};
const statusLabel = (s) => ({
  lead_created: "Lead created",
  lead_duplicate: "Lead duplicate",
  passed: "Passed",
  duplicate: "Duplicate",
}[String(s || "").toLowerCase()] || "—");

const SmartCoinFunnel = () => {
  // Today by default — it is the window the call-centre actually works in, and
  // it is the cheapest one to build (~1.4s cold, instant warm).
  const [range, setRange] = useState("today");
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
  const [trendOpen, setTrendOpen] = useState(null);
  const [medium, setMedium] = useState("");
  const [mediums, setMediums] = useState([]);
  // High and short ticket are two separate funnels over two separate tables that
  // happen to run the same SmartCoin integration. They also went live on
  // different days, so each carries its own start date.
  const [scope, setScope] = useState("high");

  // Options come from the data itself, so the dropdown can only offer mediums
  // that actually exist in this era — no dead entries to pick and get zeros from.
  useEffect(() => {
    let alive = true;
    getSmartCoinUtmMediums({ scope })
      .then((r) => { if (alive) setMediums(r?.data?.data || []); })
      .catch(() => { if (alive) setMediums([]); });
    return () => { alive = false; };
  }, [scope]);

  // The two funnels carry different traffic sources, so a medium picked on one
  // may not exist on the other — clear it rather than silently showing zeros.
  useEffect(() => { setMedium(""); setStage(null); }, [scope]);

  const dateParams = useMemo(
    () => ({
      type: (!fromDate || !toDate) && range ? range : undefined,
      fromDate: fromDate && toDate ? fromDate : undefined,
      toDate: fromDate && toDate ? toDate : undefined,
      medium: medium || undefined,
      scope,
    }),
    [range, fromDate, toDate, medium, scope],
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

  // Stage drill — only fetched once a stage is actually clicked.
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

  // Clicking the open stage again closes it — one click in, one click out.
  const toggleStage = (key) => {
    setStage((cur) => (cur === key ? null : key));
    setPage(1);
    setSearch("");
  };

  const funnel = data?.funnel || [];
  const win = data?.window;
  const rows = stageData?.data || [];
  const stageTotal = stageData?.pagination?.total || 0;
  const stageTotalPages = stageData?.pagination?.totalPages || 1;
  // Commented out alongside the pre-era banner further down; uncomment both
  // together to bring back the "went live on 2 Sep" notice.
  // const preEra = win?.eraStart && win?.from < win.eraStart;

  // null = follow the data; once clicked, the user's choice wins.
  const showTrend = trendOpen === null ? history.length > 1 : trendOpen;

  const stageLabel = funnel.find((f) => f.key === stage)?.label
    || (stage === "duplicate" ? "Duplicates"
      : stage === "leadDuplicate" ? "Lead Duplicates — rejected at lead creation"
        : stage);

  // The stages themselves, plus Duplicate parked at the end — it is a drop-off,
  // not a step, so it sits outside the sequence rather than inside it. Each tile
  // carries the share of the stage ABOVE it, which is what says where users are
  // actually lost; Pushed has nothing above it, so it shows the head count.
  const tiles = useMemo(() => {
    const fn = data?.funnel || [];
    const tot = data?.totals || {};
    const shortOf = (k) => (STAGE_META[k] || {}).short || k;
    const stages = fn.map((f, i) => ({
      key: f.key,
      label: shortOf(f.key),
      fullLabel: f.label,
      count: f.count,
      icon: (STAGE_META[f.key] || STAGE_META.pushed).icon,
      hint: (STAGE_META[f.key] || STAGE_META.pushed).hint,
      // The top tile is the sum of the two dedupe outcomes. Spelling that out
      // is the whole point: "5,751 leads" next to "2,051 passed" reads as an
      // unexplained gap until you can see the 3,700 duplicates that make up the
      // rest.
      sub: i === 0
        ? `${fmtNum(tot.passed)} passed + ${fmtNum(tot.duplicate)} duplicate`
        : `${f.pct}% of ${shortOf(fn[i - 1].key).toLowerCase()}`,
      users: f.users,
    }));
    const disbursed = stages.find((s) => s.key === "disbursed");
    if (disbursed && tot.disbursedAmount) disbursed.sub = inr(tot.disbursedAmount);
    return [
      ...stages,
      {
        key: "duplicate",
        label: "Duplicate",
        fullLabel: "Duplicate — dropped at dedupe",
        count: tot.duplicate || 0,
        icon: Copy,
        hint: "SmartCoin already had this applicant — dropped at dedupe",
        sub: `${pctOf(tot.duplicate, tot.pushed)}% of pushed`,
        users: tot.duplicateUsers,
      },
      // A SECOND, later duplicate: these cleared the first dedupe but SmartCoin
      // rejected them as a duplicate when we tried to create the lead, so no lead
      // id came back. Its base is Dedupe Passed, not Pushed — that is the pool it
      // was lost from, and it never overlaps Lead Created.
      {
        key: "leadDuplicate",
        label: "Lead Duplicate",
        fullLabel: "Lead Duplicate — rejected at lead creation",
        count: tot.leadDuplicate || 0,
        icon: Copy,
        hint: "Passed the first dedupe, then rejected as a duplicate at lead creation — no lead id issued",
        sub: `${pctOf(tot.leadDuplicate, tot.passed)}% of dedupe passed`,
        users: tot.leadDuplicateUsers,
      },
    ];
  }, [data]);

  // Export the WHOLE filtered stage, not just the page on screen.
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
    const head = ["Name", "Phone", "Email", "PAN", "Monthly Income", "Status",
      "Submissions", "SmartCoin Lead ID", "SmartCoin Message", "UTM Source", "UTM Medium", "Created At"];
    const body = all.map((r) => [
      r.name, r.phone, r.email, r.pan_no, r.monthly_income, statusLabel(r.scStatus),
      r.tries, r.leadId, r.scMessage, r.utm_source, r.utm_medium, r.createdAt,
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
      {/* Title + filters on ONE line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold text-gray-800 leading-tight">SmartCoin Funnel</h1>
          <p className="text-[11.5px] text-gray-400">
            {win ? `${fmtDay(win.from)} — ${fmtDay(win.to)}` : "—"}
            {" · "}
            <span title="Counted in leads, the same as count(*) on offerLeads. Someone who submits five times is five leads here — the ×N badge in a stage list shows how many a phone sent.">
              counted in leads, not users
            </span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {[["high", "High Ticket"], ["short", "Short Ticket"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setScope(k)}
                className={`px-3 py-[7px] text-[12px] font-semibold transition ${
                  scope === k
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <CompactDateFilter
            range={range}
            onRangeChange={(k) => { setRange(k); setStage(null); }}
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={(v) => { setFromDate(v); setStage(null); }}
            onToChange={(v) => { setToDate(v); setStage(null); }}
            onClearRange={() => { setFromDate(""); setToDate(""); }}
          />
          <select
            value={medium}
            onChange={(e) => { setMedium(e.target.value); setPage(1); }}
            title="Filter by traffic source (utm_medium)"
            className={`px-2.5 py-[7px] text-[12px] rounded-lg border bg-white ${
              medium
                ? "border-indigo-300 text-indigo-700 font-semibold"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <option value="">All mediums</option>
            {mediums.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={fetchAll}
            title="Refresh"
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
{/* 
      {preEra && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 mb-4 text-[12px] text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            This SmartCoin integration went live on <b>{fmtDay(win.eraStart)} 2026</b>. Windows before
            that date have no data — pick a later range.
          </span>
        </div>
      )} */}

      {/* The stages, left to right in journey order, with the duplicate drop-off
          parked at the end. Each one opens its own list of leads — which nothing
          on screen used to say, so the cards looked like read-only numbers. */}
      <p className="text-[11.5px] text-gray-400 mb-2">Click any card to see the leads behind it.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          const isOpen = stage === t.key;
          return (
            <button
              key={t.key}
              onClick={() => toggleStage(t.key)}
              title={t.hint}
              className={`text-left rounded-xl border bg-white px-4 py-3 transition hover:shadow-sm ${
                isOpen
                  ? "border-indigo-300 ring-1 ring-indigo-300 bg-indigo-50/50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
                <Icon size={12} className="shrink-0" />
                <span className="truncate">{t.label}</span>
              </p>
              {/* Only the two outcomes are coloured — the win green, the loss
                  amber — so the eye lands on them instead of on four identical
                  grey numbers. */}
              <p className={`mt-1 text-[24px] font-bold leading-none tabular-nums ${
                t.key === "duplicate" || t.key === "leadDuplicate"
                  ? "text-amber-700"
                  : t.key === "leadCreated"
                    ? "text-emerald-700"
                    : "text-gray-800"
              }`}>
                {fmtNum(t.count)}
              </p>
              <p className="mt-1 text-[11px] text-gray-400 truncate">{t.sub}</p>
              {/* The big number counts LEADS, because that is what count(*) on
                  offerLeads returns. About half the people submit more than once,
                  so the number of humans behind it is a different — and equally
                  asked — number. Both, rather than a choice between them. */}
              {t.users > 0 && (
                <p
                  className="text-[11px] text-gray-400 truncate"
                  title={`${fmtNum(t.count)} leads from ${fmtNum(t.users)} unique people`}
                >
                  {fmtNum(t.users)} unique {t.users === 1 ? "user" : "users"}
                  {t.count > t.users && (
                    <span className="text-gray-300"> · {(t.count / t.users).toFixed(1)}× repeat</span>
                  )}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Stage drill */}
      {stage && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
            <span className="w-1 h-5 rounded-full bg-indigo-600" />
            <h2 className="text-[14px] font-bold text-gray-800">{stageLabel}</h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100 tabular-nums">
              {fmtNum(stageTotal)}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Name / phone / PAN…"
                  className="pl-8 pr-2 py-1.5 w-[200px] text-[12px] rounded-lg border border-gray-200 text-gray-700"
                />
              </div>
              <button
                onClick={exportCsv}
                disabled={!rows.length || exporting}
                title={`Exports all ${fmtNum(stageTotal)} leads in this stage`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
              >
                <Download size={13} className={exporting ? "animate-pulse" : ""} />
                {exporting ? "Preparing…" : "Export"}
              </button>
              <button
                onClick={() => setStage(null)}
                title="Close"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] table-fixed min-w-[900px]">
              <colgroup>
                <col className="w-[190px]" />
                <col className="w-[126px]" />
                <col className="w-[112px]" />
                <col className="w-[118px]" />
                <col className="w-[168px]" />
                <col />
                <col className="w-[120px]" />
              </colgroup>
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">PAN</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">SmartCoin Lead ID</th>
                  <th className="px-3 py-2.5 font-medium">Response</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {stageLoading ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No leads in this stage.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="h-[46px] border-b border-gray-50 hover:bg-indigo-50/40">
                    <td className="px-5 max-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-800 truncate" title={r.name || ""}>{r.name || "—"}</span>
                        {/* Half the users submit more than once in a day — one hit
                            13 times. The row shown is their furthest outcome, so
                            this says how many attempts sit behind it. */}
                        {r.tries > 1 && (
                          <span
                            title={`Submitted ${r.tries} times in this window`}
                            className="shrink-0 px-1.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold tabular-nums"
                          >
                            ×{r.tries}
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-gray-400 truncate">{r.utm_medium || r.utm_source || "—"}</div>
                    </td>
                    <td className="px-3">
                      <a href={`tel:${r.phone}`} className="font-mono text-indigo-700 hover:underline whitespace-nowrap">{r.phone}</a>
                    </td>
                    <td className="px-3 font-mono text-[11.5px] text-gray-600 truncate">{r.pan_no || "—"}</td>
                    <td className="px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border whitespace-nowrap ${statusTone(r.scStatus)}`}>
                        {statusLabel(r.scStatus)}
                      </span>
                    </td>
                    <td className="px-3 font-mono text-[10.5px] text-gray-500 truncate" title={r.leadId || ""}>
                      {r.leadId || <span className="text-gray-300">—</span>}
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

      {/* Day-by-day trend — opens on its own when the window spans more than one
          day, stays shut on a single-day view where it would only repeat the cards. */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setTrendOpen(!showTrend)}
          className="w-full flex items-center gap-2 px-5 py-3 hover:bg-gray-50"
        >
          <span className="w-1 h-5 rounded-full bg-violet-600" />
          <h2 className="text-[14px] font-bold text-gray-800">Day by day</h2>
          <span className="text-[11px] text-gray-400 tabular-nums">
            {fmtNum(history.length)} {history.length === 1 ? "day" : "days"}
          </span>
          <ChevronDown
            size={16}
            className={`ml-auto text-gray-400 transition-transform ${showTrend ? "rotate-180" : ""}`}
          />
        </button>

        {showTrend && (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto border-t border-gray-100">
            <table className="w-full text-[12.5px] min-w-[560px]">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium text-right">Pushed</th>
                  {/* Each rate sits next to the count it comes from. Bunched at the end,
                      you have to keep looking back to work out the denominator. */}
                  <th className="px-3 py-2.5 font-medium text-right">Passed</th>
                  <th className="px-3 py-2.5 font-medium text-right" title="Dedupe Passed as a share of Pushed">Passed %</th>
                  <th className="px-3 py-2.5 font-medium text-right">Duplicate</th>
                  <th className="px-3 py-2.5 font-medium text-right" title="Duplicates as a share of Pushed. Passed % and Duplicate % add up to 100 - every dedupe answer is one or the other.">Duplicate %</th>
                  <th className="px-3 py-2.5 font-medium text-right">Leads created</th>
                  <th className="px-3 py-2.5 font-medium text-right" title="Leads Created as a share of Dedupe Passed - the same rate the Lead Created card shows">Lead %</th>
                  <th className="px-3 py-2.5 font-medium text-right" title="Passed the first dedupe, then rejected as a duplicate at lead creation - no lead id issued">Lead dup.</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">No SmartCoin activity in this window.</td></tr>
                ) : history.map((h) => (
                  <tr key={h.date} className="h-[42px] border-b border-gray-50 hover:bg-violet-50/30">
                    <td className="px-5 font-semibold text-gray-700 whitespace-nowrap">{fmtDay(h.date)}</td>
                    <td className="px-3 text-right tabular-nums text-gray-700">{fmtNum(h.pushed)}</td>
                    <td className="px-3 text-right tabular-nums font-semibold text-indigo-700">{fmtNum(h.passed)}</td>
                    <td className="px-3 text-right tabular-nums text-indigo-400">
                      {h.pushed ? `${pctOf(h.passed, h.pushed)}%` : "—"}
                    </td>
                    <td className="px-3 text-right tabular-nums text-amber-700">{fmtNum(h.duplicate)}</td>
                    <td className="px-3 text-right tabular-nums text-amber-400">
                      {h.pushed ? `${pctOf(h.duplicate, h.pushed)}%` : "—"}
                    </td>
                    <td className="px-3 text-right tabular-nums font-semibold text-emerald-700">{fmtNum(h.leadCreated)}</td>
                    <td className="px-3 text-right tabular-nums text-emerald-500">
                      {h.passed ? `${pctOf(h.leadCreated, h.passed)}%` : "—"}
                    </td>
                    <td className="px-3 text-right tabular-nums text-amber-700">{fmtNum(h.leadDuplicate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default SmartCoinFunnel;
