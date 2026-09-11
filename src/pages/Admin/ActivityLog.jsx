import { useCallback, useEffect, useState } from "react";
import { ScrollText, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Api from "../../api-services/api";
import { useAuth } from "../../custom-hooks/useAuth";
import ToastNotification from "../../components/Notification/ToastNotification";

/* Activity log — who did what.
 *
 * Shows ACTIONS, not traffic: logins (including failed ones), anything that
 * changed something, and exports. Plain GETs are not recorded — the cache warmer
 * alone makes ~60 a cycle, and a table full of page views buries the handful of
 * lines anyone actually needs.
 */

const ACTIONS = [
  { k: "", label: "All activity" },
  { k: "login", label: "Logins" },
  { k: "login_failed", label: "Failed logins" },
  { k: "export", label: "Exports" },
  { k: "create", label: "Created" },
  { k: "update", label: "Updated" },
  { k: "delete", label: "Deleted" },
  { k: "otp_sent", label: "OTP sent" },
];

// Colour carries the meaning at a glance: failures and deletions are the rows you
// scan for, so they are the only ones that stand out.
const TONE = {
  login_failed: "bg-rose-50 text-rose-700 border-rose-200",
  delete: "bg-rose-50 text-rose-700 border-rose-200",
  export: "bg-amber-50 text-amber-700 border-amber-200",
  login: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const PAGE = 50;

const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
};

export default function ActivityLog() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ actor: "", action: "", from: "", to: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Api().get("/activity-log", {
        params: {
          actor: filters.actor || undefined,
          action: filters.action || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          limit: PAGE,
          offset: page * PAGE,
        },
        skipAdminAppend: true,
      });
      setRows(res?.data?.rows || []);
      setTotal(res?.data?.total || 0);
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  if (!["dev", "super-admin"].includes(user?.role)) {
    return <div className="p-8 text-[13px] text-gray-500">This screen is not available for your role.</div>;
  }

  const set = (k) => (e) => { setPage(0); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="max-w-[1440px] mx-auto px-2 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-100 text-purple-600">
            <ScrollText size={18} />
          </span>
          <div>
            <h1 className="text-[18px] font-bold leading-tight text-gray-900">Activity Log</h1>
            <p className="text-[12px] text-gray-500">Logins, changes and exports — not page views.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
        <div className="relative w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filters.actor}
            onChange={set("actor")}
            placeholder="Who (email)…"
            className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-[12.5px] outline-none focus:border-purple-400"
          />
        </div>
        <select
          value={filters.action}
          onChange={set("action")}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-[12.5px] outline-none focus:border-purple-400"
        >
          {ACTIONS.map((a) => <option key={a.k} value={a.k}>{a.label}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={set("from")} className="rounded-lg border border-gray-200 px-2 py-1.5 text-[12.5px] outline-none focus:border-purple-400" />
        <span className="text-[12px] text-gray-400">to</span>
        <input type="date" value={filters.to} onChange={set("to")} className="rounded-lg border border-gray-200 px-2 py-1.5 text-[12.5px] outline-none focus:border-purple-400" />
        {(filters.actor || filters.action || filters.from || filters.to) && (
          <button
            type="button"
            onClick={() => { setPage(0); setFilters({ actor: "", action: "", from: "", to: "" }); }}
            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11.5px] font-medium text-red-600 hover:bg-red-100"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-[12px] text-gray-500 tabular-nums">{total.toLocaleString("en-IN")} entries</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12.5px]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">What</th>
                <th className="px-3 py-2 text-right">Status</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : !rows.length ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Nothing recorded for these filters.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-purple-50/40">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500 tabular-nums">{fmt(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="truncate font-medium text-gray-800">{r.actorEmail || "—"}</div>
                      {r.actorRole && <div className="text-[10.5px] text-gray-400">{r.actorRole}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${TONE[r.action] || "border-gray-200 bg-gray-50 text-gray-600"}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[420px] truncate font-mono text-[11px] text-gray-600" title={r.path}>
                        {r.method} {r.path}
                      </div>
                      {r.meta && (
                        <div className="max-w-[420px] truncate text-[10.5px] text-gray-400" title={JSON.stringify(r.meta)}>
                          {Object.entries(r.meta).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.status >= 400 ? "font-semibold text-rose-600" : "text-gray-500"}`}>
                      {r.status}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-gray-400">{r.ip || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
          <span className="text-[11.5px] text-gray-500 tabular-nums">Page {page + 1} of {pages}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-600 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-600 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
