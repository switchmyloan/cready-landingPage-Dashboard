import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Download, Users, TrendingDown, CheckCircle2, FileText, Send } from "lucide-react";
import { getUserTrackFunnel, getUserTrackMediums } from "../../../api-services/Modules/UserTrackFunnel";
import PremiumPageLoader from "../../../components/PremiumPageLoader";

// User Track funnel — PFL-style layout. Rows = the IST day each user first landed;
// columns = stages (count, with the % of that day's landed users below).
// Stage logic mirrors the User Track table.

const fmtNum = (n) => (Number(n) || 0).toLocaleString("en-IN");
const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
};
const pctOf = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Quick chips. An all-time window scans the whole landing table (~950k rows) and
// runs past the request timeout, so the chips are Today / Yesterday; any other
// window is picked with the custom date range.
const chips = () => {
  const now = new Date();
  const back = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return isoLocal(d); };
  const today = isoLocal(now);
  const monthStart = isoLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastStart = isoLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastEnd = isoLocal(new Date(now.getFullYear(), now.getMonth(), 0));
  return [
    { key: "today", label: "Today", from: today, to: today },
    { key: "yest", label: "Yesterday", from: back(1), to: back(1) },
    { key: "mtd", label: "This month", from: monthStart, to: today },
    { key: "lastm", label: "Last month", from: lastStart, to: lastEnd },
  ];
};

// Column accents per stage.
const COL = {
  total: "text-gray-800",
  landed_only: "text-rose-600",
  otp_verified: "text-indigo-600",
  form_submitted: "text-sky-600",
  lender_clicked: "text-emerald-600",
};
// KPI card styling per stage (border / text / icon).
const KPI = {
  total: { box: "border-purple-100 bg-purple-50/70", text: "text-purple-700", Icon: Users },
  landed_only: { box: "border-rose-100 bg-rose-50/70", text: "text-rose-600", Icon: TrendingDown },
  otp_verified: { box: "border-indigo-100 bg-indigo-50/70", text: "text-indigo-600", Icon: CheckCircle2 },
  form_submitted: { box: "border-sky-100 bg-sky-50/70", text: "text-sky-600", Icon: FileText },
  lender_clicked: { box: "border-emerald-100 bg-emerald-50/70", text: "text-emerald-600", Icon: Send },
};

const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default function UserTrackFunnel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const quick = chips();
  const [range, setRange] = useState({ key: "today", from: quick[1].from, to: quick[1].to });
  const [medium, setMedium] = useState("");
  const [mediums, setMediums] = useState([]);
  // High Ticket vs Short Ticket — one module, two scopes of the same funnel.
  const [scope, setScope] = useState("high");

  useEffect(() => {
    setMedium("");
    getUserTrackMediums({ scope })
      .then((res) => setMediums(Array.isArray(res?.data?.data) ? res.data.data : []))
      .catch(() => setMediums([]));
  }, [scope]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await getUserTrackFunnel({ fromDate: range.from, toDate: range.to, medium, scope });
      setData(res?.data?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load User Track funnel");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, medium, scope]);

  useEffect(() => { load(); }, [load]);

  // First open: full-page premium loader (same as the other funnels).
  if (loading && !data) {
    return (
      <PremiumPageLoader
        theme="sky"
        title="Loading User Track Funnel"
        brandLabel="User Track"
        phrases={["Pulling landed users…", "Checking OTP and form data…", "Mapping lender clicks…", "Building the day-wise view…"]}
        tiles={[{ label: "Landed" }, { label: "OTP" }, { label: "Form" }, { label: "Lender" }]}
        progressLabel="Preparing your funnel"
      />
    );
  }

  const stages = data?.stages || [];
  const matrix = data?.matrix || [];
  const total = stages.find((s) => s.key === "total")?.count || 0;

  const exportCsv = () => {
    const header = ["Date", ...stages.map((s) => s.label)];
    const lines = [header.map(csvEscape).join(",")];
    matrix.forEach((row) => {
      lines.push([fmtDate(row.date), ...stages.map((s) => row.byStage?.[s.key] || 0)].map(csvEscape).join(","));
    });
    lines.push(["Total", ...stages.map((s) => s.count)].map(csvEscape).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user_track_funnel_${range.from}_${range.to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const chipCls = (active) =>
    `rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
      active ? "bg-purple-600 text-white shadow-sm" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4 md:px-6">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-sm">
            <TrendingDown size={18} />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">User Track Funnel</h1>
            <p className="text-[11.5px] text-gray-500">
              Landed → OTP → form → lender click, each user counted on the day they first landed (IST).
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-gray-200">
            {[
              { key: "high", label: "High Ticket" },
              { key: "short", label: "Short Ticket" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setScope(t.key)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
                  scope === t.key ? "bg-purple-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            disabled={!matrix.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400">Period</span>
        {quick.map((c) => (
          <button
            key={c.key}
            onClick={() => setRange({ key: c.key, from: c.from, to: c.to })}
            className={chipCls(range.key === c.key)}
          >
            {c.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <select
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] font-medium text-gray-700 focus:border-purple-400 focus:outline-none"
        >
          <option value="">All mediums</option>
          {mediums.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <input
          type="date"
          value={range.from}
          onChange={(e) => setRange((r) => ({ key: "custom", from: e.target.value, to: r.to < e.target.value ? e.target.value : r.to }))}
          className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] text-gray-700 focus:border-purple-400 focus:outline-none"
        />
        <span className="text-[12px] text-gray-400">to</span>
        <input
          type="date"
          value={range.to}
          onChange={(e) => setRange((r) => ({ key: "custom", from: r.from > e.target.value ? e.target.value : r.from, to: e.target.value }))}
          className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] text-gray-700 focus:border-purple-400 focus:outline-none"
        />
        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</div>}

      {/* KPI cards */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {stages.map((s) => {
          const k = KPI[s.key] || KPI.total;
          const pct = s.key === "total" ? null : s.pct;
          return (
            <div key={s.key} className={`rounded-xl border px-3.5 py-3 shadow-sm ${k.box}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500">{s.label}</span>
                <k.Icon size={14} className={k.text} />
              </div>
              <div className={`mt-1.5 text-[22px] font-extrabold leading-none tabular-nums ${k.text}`}>
                {loading ? "…" : fmtNum(s.count)}
              </div>
              <div className="mt-1 text-[10.5px] text-gray-500">
                {s.key === "total" ? "users landed in this window" : `${pct}% of landed`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day-by-day matrix */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="sticky left-0 z-20 min-w-[120px] bg-gray-50 px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Date</th>
                {stages.map((s) => (
                  <th key={s.key} className={`whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide ${COL[s.key] || "text-gray-600"}`}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0, 1, 2, 3, 4].map((r) => (
                  <tr key={`sk${r}`} className="border-b border-gray-100">
                    <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer" /></td>
                    {stages.map((s) => (
                      <td key={s.key} className="px-3 py-3 text-right">
                        <div className="ml-auto h-3 w-14 rounded bg-gradient-to-r from-indigo-50 via-purple-100 to-indigo-50 bg-[length:200%_100%] animate-shimmer" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : matrix.length === 0 ? (
                <tr><td colSpan={stages.length + 1} className="px-4 py-10 text-center text-gray-400">No data for this window.</td></tr>
              ) : (
                matrix.map((row, i) => {
                  const rowBg = i % 2 ? "bg-gray-50" : "bg-white";
                  const dayTotal = row.byStage?.total || 0;
                  return (
                    <tr key={row.date} className={`${rowBg} border-b border-gray-100`}>
                      <td className={`sticky left-0 z-10 ${rowBg} whitespace-nowrap px-4 py-2 text-[12.5px] font-semibold text-gray-800`}>{fmtDate(row.date)}</td>
                      {stages.map((s) => {
                        const v = row.byStage?.[s.key] || 0;
                        const p = s.key === "total" ? null : pctOf(v, dayTotal);
                        return (
                          <td key={s.key} className="px-3 py-2 text-right align-top tabular-nums">
                            <div className={`text-[13px] font-bold ${COL[s.key] || "text-gray-700"}`}>{fmtNum(v)}</div>
                            {p != null && <div className="text-[10px] text-gray-400">{p}%</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && matrix.length > 0 && (
              <tfoot className="border-t-2 border-gray-200">
                <tr className="bg-gray-100">
                  <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-gray-600">Total</td>
                  {stages.map((s) => (
                    <td key={s.key} className="px-3 py-2.5 text-right align-top tabular-nums">
                      <div className={`text-[13px] font-extrabold ${COL[s.key] || "text-gray-900"}`}>{fmtNum(s.count)}</div>
                      <div className="text-[10px] font-semibold text-gray-500">{s.key === "total" ? "100%" : `${s.pct}%`}</div>
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        % under a column = share of that day's landed users. OTP, form and lender-click are cumulative
        (a user who clicked a lender also counts as OTP verified and form submitted). "Only landed" = never verified OTP,
        submitted a form or clicked a lender.
      </p>
    </div>
  );
}
