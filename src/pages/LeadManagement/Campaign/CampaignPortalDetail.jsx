import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Megaphone,
  Send,
  CheckCheck,
  Eye,
  MousePointerClick,
  XCircle,
  Wallet,
  CalendarDays,
  Copy,
  ChevronDown,
} from "lucide-react";

// Dedicated drill-down page for one (entity, lander) within a date scope. Reads
// its inputs from the URL (entity / lander / type / fromDate / toDate) so it
// survives a refresh, fetches the raw public.campaignportal_campaigns rows and
// renders them cleanly.
import { getCampaignPortalDetail } from "../../../api-services/Modules/Campaign";
import ToastNotification from "../../../components/Notification/ToastNotification";

const ENTITY_PALETTE = [
  "bg-indigo-100 text-indigo-700 ring-indigo-200",
  "bg-blue-100 text-blue-700 ring-blue-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-amber-100 text-amber-700 ring-amber-200",
  "bg-purple-100 text-purple-700 ring-purple-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-cyan-100 text-cyan-700 ring-cyan-200",
  "bg-teal-100 text-teal-700 ring-teal-200",
];
const entityColor = (entity) => {
  const s = String(entity || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ENTITY_PALETTE[h % ENTITY_PALETTE.length];
};

const formatSpend = (rs) =>
  "₹" + (Number(rs) || 0).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Spend = delivered × rate (same model as the campaign dashboard). The MARKETING
// rate (₹0.87) applies ONLY to genuine marketing blasts — category MARKETING AND
// the campaign name contains 'MARKETING'. Everything else is the ₹0.105 utility rate.
const spendFor = (delivered, category, name) => {
  const isMarketing =
    String(category || "").toUpperCase() === "MARKETING" &&
    /marketing/i.test(String(name || ""));
  return (Number(delivered) || 0) * (isMarketing ? 0.87 : 0.105);
};

// Hide noisy columns from the raw-row table.
const isHiddenCol = (k) => k.replace(/[^a-z]/gi, "").toLowerCase() === "extrajson";
const prettyLabel = (k) => String(k).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const fmtCellValue = (key, val) => {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "number") return val.toLocaleString();
  if (/(^|_)(date|at)$|date|created|updated/i.test(key)) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  if (/^\d+(\.\d+)?$/.test(String(val))) return Number(val).toLocaleString();
  return String(val);
};

// Case-insensitive field accessor (DB columns are snake_case, but be defensive).
const pick = (row, key) => {
  if (row[key] !== undefined) return row[key];
  const found = Object.keys(row).find((rk) => rk.toLowerCase() === key.toLowerCase());
  return found ? row[found] : undefined;
};

const STATUS_STYLES = {
  sent: "bg-green-100 text-green-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  running: "bg-indigo-100 text-indigo-700",
  paused: "bg-amber-100 text-amber-700",
  failed: "bg-rose-100 text-rose-700",
};
const statusStyle = (s) => STATUS_STYLES[String(s || "").toLowerCase()] || "bg-gray-100 text-gray-600";

const CARD_METRICS = [
  ["Total", "total"],
  ["Sent", "sent"],
  ["Delivered", "delivered"],
  ["Read", "read"],
  ["Clicked", "clicked"],
  ["Failed", "failed"],
];
// Columns rendered specially (header / metrics / template), so excluded from the
// generic meta grid. Everything else (id, account, project, dates, template ids…)
// flows into the wrapping grid so nothing is dropped and nothing scrolls sideways.
const META_EXCLUDE = new Set([
  "name", "status", "template_text", "extra_json",
  "total", "sent", "delivered", "read", "clicked", "failed", "wc_credit",
]);

const copyText = async (t) => {
  try {
    await navigator.clipboard.writeText(String(t));
    ToastNotification.success("Copied");
  } catch {
    ToastNotification.error("Copy failed");
  }
};

const CampaignCard = ({ row, cols }) => {
  const [open, setOpen] = useState(false);
  const [showText, setShowText] = useState(false);
  const name = pick(row, "name");
  const status = pick(row, "status");
  const spend = spendFor(pick(row, "delivered"), pick(row, "template_category"), pick(row, "name"));
  const text = pick(row, "template_text");
  const metaCols = cols.filter((c) => !META_EXCLUDE.has(c.toLowerCase()));

  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 break-all">{name || "—"}</h3>
          {status && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusStyle(status)}`}>
              {status}
            </span>
          )}
        </div>
        {spend > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-500">Spend</p>
            <p className="text-sm font-bold text-emerald-600">{formatSpend(spend)}</p>
          </div>
        )}
      </div>

      {/* Metrics strip */}
      <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {CARD_METRICS.map(([label, key]) => (
          <div key={key} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-0.5 text-base font-bold text-gray-900 tabular-nums">{(Number(pick(row, key)) || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Details accordion — keeps each card compact by default */}
      {(metaCols.length > 0 || text) && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-3 w-full inline-flex items-center justify-center gap-1 rounded-lg border border-gray-100 bg-gray-50/70 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition"
          >
            {open ? "Hide details" : "View details"}
            <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {/* Meta grid (everything else, wrapping — no horizontal scroll) */}
              {metaCols.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-3.5">
                  {metaCols.map((c) => {
                    const raw = pick(row, c);
                    const isId = c.toLowerCase() === "id";
                    return (
                      <div key={c} className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{prettyLabel(c)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-sm font-medium text-gray-900 break-all">{fmtCellValue(c, raw)}</p>
                          {isId && raw && (
                            <button type="button" onClick={() => copyText(raw)} className="text-gray-400 hover:text-purple-600 shrink-0">
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Template text */}
              {text && (
                <div className={metaCols.length > 0 ? "mt-4 pt-3 border-t border-gray-100" : ""}>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Template Text</p>
                  <p
                    className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
                    style={showText ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    {text}
                  </p>
                  {String(text).length > 160 && (
                    <button
                      type="button"
                      onClick={() => setShowText((s) => !s)}
                      className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-purple-600 hover:underline"
                    >
                      {showText ? "Show less" : "Show more"}
                      <ChevronDown size={12} className={`transition-transform ${showText ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StatTile = (props) => {
  const { label, value, Icon, color, sub, accent } = props;
  return (
    <div className="p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium text-gray-500">{label}</p>
        <span className={`p-1 rounded-md ${color}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className={`mt-1 text-lg font-bold ${accent || "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
};

const CampaignPortalDetail = () => {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const entity = sp.get("entity") || "";
  const lander = sp.get("lander") || "";
  const type = sp.get("type") || "";
  const fromDate = sp.get("fromDate") || "";
  const toDate = sp.get("toDate") || "";

  const dateLabel = useMemo(() => {
    if (type === "today") return "Today";
    if (type === "yesterday") return "Yesterday";
    if (fromDate && toDate) return `${fromDate} → ${toDate}`;
    return "All dates";
  }, [type, fromDate, toDate]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getCampaignPortalDetail({ entity, lander, type, fromDate, toDate });
        if (!cancelled) {
          if (res?.data?.success) setRows(res.data.data || []);
          else ToastNotification.error("Failed to load detail");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) ToastNotification.error("Failed to load detail");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity, lander, type, fromDate, toDate]);

  // Roll up the raw rows for the summary strip (counts exact; spend = Σ delivered × category rate).
  const totals = useMemo(() => {
    const t = { total: 0, sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0, spend: 0 };
    for (const r of rows) {
      t.total += Number(r.total) || 0;
      t.sent += Number(r.sent) || 0;
      t.delivered += Number(r.delivered) || 0;
      t.read += Number(r.read) || 0;
      t.clicked += Number(r.clicked) || 0;
      t.failed += Number(r.failed) || 0;
      t.spend += spendFor(r.delivered, r.template_category, r.name);
    }
    return t;
  }, [rows]);

  const cols = useMemo(() => (rows.length ? Object.keys(rows[0]).filter((k) => !isHiddenCol(k)) : []), [rows]);
  const pct = (n) => (totals.total ? Math.round((n / totals.total) * 100) : 0);

  const tiles = [
    { label: "Total", value: totals.total.toLocaleString(), Icon: Megaphone, color: "bg-slate-100 text-slate-600" },
    { label: "Sent", value: totals.sent.toLocaleString(), Icon: Send, color: "bg-blue-100 text-blue-600", sub: `${pct(totals.sent)}% of total` },
    { label: "Delivered", value: totals.delivered.toLocaleString(), Icon: CheckCheck, color: "bg-green-100 text-green-600", sub: `${pct(totals.delivered)}% of total` },
    { label: "Read", value: totals.read.toLocaleString(), Icon: Eye, color: "bg-amber-100 text-amber-600", sub: `${pct(totals.read)}% of total` },
    { label: "Clicked", value: totals.clicked.toLocaleString(), Icon: MousePointerClick, color: "bg-purple-100 text-purple-600", sub: `${pct(totals.clicked)}% of total` },
    { label: "Failed", value: totals.failed.toLocaleString(), Icon: XCircle, color: "bg-rose-100 text-rose-600", sub: `${pct(totals.failed)}% of total` },
    { label: "Spend", value: formatSpend(totals.spend), Icon: Wallet, color: "bg-green-100 text-green-600", accent: "text-emerald-600" },
  ];

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden pb-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-3"
      >
        <ArrowLeft size={15} /> Back to Campaign
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Campaign-portal drill-down</p>
            <h1 className="mt-0.5 flex items-center gap-2 text-xl font-bold text-gray-900">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${entityColor(entity)}`}>
                {entity || "—"}
              </span>
              <span className="text-gray-300">/</span>
              <span>{lander || "—"}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              <CalendarDays size={13} /> {dateLabel}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              {loading ? "…" : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`}
            </span>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-4">
        {loading
          ? tiles.map((_, i) => (
              <div key={i} className="p-3 bg-white rounded-lg border border-gray-200 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-6 bg-gray-300 rounded w-2/3" />
              </div>
            ))
          : tiles.map((t) => <StatTile key={t.label} {...t} />)}
      </div>

      {/* Raw rows */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600">
            <Megaphone size={16} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 leading-tight">Campaign-portal rows</h2>
            <p className="text-[11px] text-gray-500 leading-tight">Raw entries from public.campaignportal_campaigns</p>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">Loading rows…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">No campaign-portal rows for this selection.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r, i) => (
                <CampaignCard key={pick(r, "id") || i} row={r} cols={cols} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignPortalDetail;
