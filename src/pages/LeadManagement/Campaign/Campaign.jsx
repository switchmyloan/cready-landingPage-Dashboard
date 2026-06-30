import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  MousePointerClick,
  Megaphone,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  Wallet,
  CalendarDays,
  RefreshCw,
} from "lucide-react";

// Campaign Team page — backed by its own dedicated /campaign endpoints. Focused
// on the campaign-portal breakdown (public.campaignportal_campaigns from leadops)
// grouped by lander & entity, with a per-row drill-down to the raw rows.
import { getCampaign } from "../../../api-services/Modules/Campaign";
import ToastNotification from "../../../components/Notification/ToastNotification";
import PremiumPageLoader from "../../../components/PremiumPageLoader";
import MainTable from "../../../components/Table/MainTable";

const COLOR_MAP = {
  blue: { iconBg: "bg-blue-100", iconText: "text-blue-600" },
  amber: { iconBg: "bg-amber-100", iconText: "text-amber-600" },
  purple: { iconBg: "bg-purple-100", iconText: "text-purple-600" },
  green: { iconBg: "bg-green-100", iconText: "text-green-600" },
  slate: { iconBg: "bg-slate-100", iconText: "text-slate-600" },
  rose: { iconBg: "bg-rose-100", iconText: "text-rose-600" },
};

const fmtNum = (v) => (Number(v) || 0).toLocaleString();

// price is a preformatted "₹<lakhs>" string per row; parse/sum/reformat so the
// cards can be re-aggregated client-side when an entity filter is applied.
const parsePrice = (p) => Number(String(p || "").replace(/[^0-9.]/g, "")) || 0;
const formatPrice = (n) =>
  "₹" + (Math.round(n * 10) / 10).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Roll up a set of breakdown rows into the same shape as summary.campaign so the
// headline cards can reflect the selected entity (or all entities).
const aggregateCampaign = (rows) => {
  const acc = { total: 0, sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
  let priceSum = 0;
  for (const r of rows) {
    acc.total += Number(r.total) || 0;
    acc.sent += Number(r.sent) || 0;
    acc.delivered += Number(r.delivered) || 0;
    acc.read += Number(r.read) || 0;
    acc.clicked += Number(r.clicked) || 0;
    acc.failed += Number(r.failed) || 0;
    priceSum += parsePrice(r.price);
  }
  return { ...acc, price: formatPrice(priceSum) };
};

// Stable, readable badge color per entity (hash → palette).
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

// Headline KPIs = the campaign-portal totals (the same rollup as the breakdown
// grid: Total / Sent / Delivered / Read / Clicked / Failed / Spend), sourced from
// summary.campaign so the cards always match the grid below.
const StatCards = ({ campaign = {}, loading }) => {
  const total = Number(campaign.total) || 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const num = (k) => Number(campaign[k]) || 0;

  const cards = [
    { key: "total", label: "Total", value: total, Icon: Megaphone, color: "slate", isBase: true },
    { key: "sent", label: "Sent", value: num("sent"), Icon: Send, color: "blue", pct: pct(num("sent")) },
    { key: "delivered", label: "Delivered", value: num("delivered"), Icon: CheckCheck, color: "green", pct: pct(num("delivered")) },
    { key: "read", label: "Read", value: num("read"), Icon: Eye, color: "amber", pct: pct(num("read")) },
    { key: "clicked", label: "Clicked", value: num("clicked"), Icon: MousePointerClick, color: "purple", pct: pct(num("clicked")) },
    { key: "failed", label: "Failed", value: num("failed"), Icon: XCircle, color: "rose", pct: pct(num("failed")) },
    { key: "price", label: "Spend", value: campaign.price || "₹0", Icon: Wallet, color: "green", isPrice: true },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-4">
        {cards.map((_, i) => (
          <div key={i} className="p-3 bg-white rounded-lg border border-gray-200 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-7 bg-gray-300 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-4">
      {cards.map((card) => {
        const { key, label, Icon, color, value, pct, isBase, isPrice } = card;
        const c = COLOR_MAP[color];
        return (
          <div
            key={key}
            className="group relative flex items-start justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-500 leading-tight min-h-[26px] flex items-start">{label}</p>
              <p className={`mt-0.5 text-xl font-bold ${isPrice ? "text-emerald-600" : "text-gray-900"}`}>
                {isPrice ? value : value.toLocaleString()}
              </p>
              {!isBase && !isPrice && pct !== undefined && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  <span className={`font-semibold ${pct >= 50 ? "text-green-600" : pct >= 20 ? "text-amber-600" : "text-red-500"}`}>
                    {pct}%
                  </span>{" "}
                  of total
                </p>
              )}
            </div>
            <div className={`p-1.5 rounded-lg ${c.iconBg} ${c.iconText} shrink-0 ml-1.5`}>
              <Icon size={16} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Compact date filter — drives the cards, the breakdown grid and the drill-down
// (the leadops query is date-scoped).
const DateFilter = ({ dateType, onDateTypeChange, startDate, endDate, onDateRangeChange, onRefresh }) => {
  const [rng, setRng] = useState({ start: startDate || "", end: endDate || "" });
  const [showCustom, setShowCustom] = useState(!!(startDate && endDate));

  useEffect(() => {
    setRng({ start: startDate || "", end: endDate || "" });
    setShowCustom(!!(startDate && endDate));
  }, [startDate, endDate]);

  const applyRange = () => {
    if (rng.start && rng.end) onDateRangeChange(rng.start, rng.end);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mr-1">Date</span>
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-100 p-0.5">
        {[
          { v: "", l: "All" },
          { v: "today", l: "Today" },
          { v: "yesterday", l: "Yest" },
        ].map(({ v, l }) => {
          const active = !showCustom && dateType === v;
          return (
            <button
              key={l}
              type="button"
              onClick={() => { onDateTypeChange(v); setShowCustom(false); }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                active ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-100" : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              {l}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
            showCustom ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-100" : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
          }`}
        >
          <CalendarDays size={12} /> Custom
        </button>
      </div>

      {showCustom && (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1 transition focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-400">
          <input
            type="date"
            value={rng.start}
            max={rng.end || undefined}
            onChange={(e) => setRng((p) => ({ ...p, start: e.target.value }))}
            className="w-[104px] bg-transparent text-xs text-gray-700 outline-none"
          />
          <span className="text-gray-300">→</span>
          <input
            type="date"
            value={rng.end}
            min={rng.start || undefined}
            onChange={(e) => setRng((p) => ({ ...p, end: e.target.value }))}
            className="w-[104px] bg-transparent text-xs text-gray-700 outline-none"
          />
          <button
            type="button"
            onClick={applyRange}
            disabled={!rng.start || !rng.end}
            className="ml-0.5 rounded-md bg-gradient-to-r from-purple-600 to-violet-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:from-purple-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Go
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        title="Refresh data"
      >
        <RefreshCw size={12} /> Refresh
      </button>
    </div>
  );
};

// Entity filter — selecting an entity re-scopes both the breakdown grid and the
// headline cards to that entity (client-side; the breakdown already holds rows
// for every entity).
const EntityFilter = ({ value, options, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Entity</span>
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-100 p-0.5 flex-wrap">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
          !value ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-100" : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
        }`}
      >
        All
      </button>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
            value === o ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-100" : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

const Campaign = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [summary, setSummary] = useState({ campaign: { breakdown: [] } });
  // Default the dashboard to today's data (not all-time) on first load.
  const [query, setQuery] = useState({ filter_date: "today", startDate: null, endDate: null });

  // Client-side table state for the breakdown grid (data is already fetched).
  const [table, setTable] = useState({ pageIndex: 0, pageSize: 10, search: "" });
  const [selectedEntity, setSelectedEntity] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCampaign({
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        perPage: 1,
        currentPage: 1,
      });
      if (res?.data?.success && res.data.summary) {
        setSummary(res.data.summary);
      } else {
        ToastNotification.error("Failed to load campaign data");
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error("Failed to load campaign data");
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [query.filter_date, query.startDate, query.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onDateTypeChange = useCallback(
    (v) => setQuery((prev) => ({ ...prev, filter_date: v, startDate: null, endDate: null })),
    []
  );
  const onDateRangeChange = useCallback(
    (s, e) => setQuery((prev) => ({ ...prev, startDate: s, endDate: e, filter_date: "" })),
    []
  );

  // Drill-down: navigate to a dedicated page, carrying the (entity, lander) +
  // current date scope in the URL so the page is refresh-safe.
  const handleView = useCallback(
    (row) => {
      const params = new URLSearchParams();
      if (row.entity) params.set("entity", row.entity);
      if (row.lander) params.set("lander", row.lander);
      if (query.filter_date) params.set("type", query.filter_date);
      if (query.startDate) params.set("fromDate", query.startDate);
      if (query.endDate) params.set("toDate", query.endDate);
      navigate(`/campaign/portal-detail?${params.toString()}`);
    },
    [navigate, query.filter_date, query.startDate, query.endDate]
  );

  // Client-side entity filter + search + pagination over the (small) breakdown set.
  const allRows = useMemo(() => (Array.isArray(summary.campaign?.breakdown) ? summary.campaign.breakdown : []), [summary]);

  const entityOptions = useMemo(() => {
    const set = new Set();
    for (const r of allRows) if (r.entity) set.add(r.entity);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const entityRows = useMemo(
    () => (selectedEntity ? allRows.filter((r) => r.entity === selectedEntity) : allRows),
    [allRows, selectedEntity]
  );

  // Headline cards follow the entity filter (all entities → backend rollup).
  const campaignView = useMemo(
    () => (selectedEntity ? aggregateCampaign(entityRows) : summary.campaign || {}),
    [selectedEntity, entityRows, summary]
  );

  const filteredRows = useMemo(() => {
    const t = table.search.trim().toLowerCase();
    if (!t) return entityRows;
    return entityRows.filter(
      (r) => String(r.entity || "").toLowerCase().includes(t) || String(r.lander || "").toLowerCase().includes(t)
    );
  }, [entityRows, table.search]);

  const onEntityChange = useCallback((e) => {
    setSelectedEntity(e);
    setTable((s) => ({ ...s, pageIndex: 0 }));
  }, []);
  const pageRows = useMemo(() => {
    // Clamp the page so a shrunk result set (e.g. after searching from a later
    // page) never renders an empty slice.
    const lastPage = Math.max(0, Math.ceil(filteredRows.length / table.pageSize) - 1);
    const idx = Math.min(table.pageIndex, lastPage);
    return filteredRows.slice(idx * table.pageSize, (idx + 1) * table.pageSize);
  }, [filteredRows, table.pageIndex, table.pageSize]);

  const onPageChange = useCallback((p) => setTable((s) => ({ ...s, pageIndex: p.pageIndex, pageSize: p.pageSize })), []);
  const onSearch = useCallback((term) => setTable((s) => ({ ...s, search: term || "", pageIndex: 0 })), []);

  const columns = useMemo(
    () => [
      {
        header: "Entity",
        accessorKey: "entity",
        cell: ({ getValue }) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${entityColor(getValue())}`}>
            {getValue() || "—"}
          </span>
        ),
      },
      { header: "Lander", accessorKey: "lander", cell: ({ getValue }) => <span className="font-medium text-gray-800">{getValue() || "—"}</span> },
      { header: "Total", accessorKey: "total", cell: ({ getValue }) => <span className="tabular-nums text-gray-700">{fmtNum(getValue())}</span> },
      { header: "Sent", accessorKey: "sent", cell: ({ getValue }) => <span className="tabular-nums text-gray-700">{fmtNum(getValue())}</span> },
      { header: "Delivered", accessorKey: "delivered", cell: ({ getValue }) => <span className="tabular-nums text-gray-700">{fmtNum(getValue())}</span> },
      { header: "Read", accessorKey: "read", cell: ({ getValue }) => <span className="tabular-nums text-gray-700">{fmtNum(getValue())}</span> },
      { header: "Clicked", accessorKey: "clicked", cell: ({ getValue }) => <span className="tabular-nums font-semibold text-gray-900">{fmtNum(getValue())}</span> },
      { header: "Failed", accessorKey: "failed", cell: ({ getValue }) => <span className="tabular-nums text-gray-700">{fmtNum(getValue())}</span> },
      { header: "Price", accessorKey: "price", cell: ({ getValue }) => <span className="tabular-nums font-semibold text-emerald-600">{getValue() || "₹0"}</span> },
      {
        header: "Actions",
        accessorKey: "actions",
        cell: ({ row }) => (
          <button
            onClick={() => handleView(row.original)}
            className="p-2 rounded-lg hover:bg-purple-100 text-purple-600 transition"
            title="View campaign-portal rows"
          >
            <Eye size={18} />
          </button>
        ),
      },
    ],
    [handleView]
  );

  if (firstLoad) {
    return (
      <div className="min-w-0 w-full max-w-full overflow-x-hidden">
        <Toaster />
        <PremiumPageLoader
          theme="sky"
          title="Loading Campaign"
          brandLabel="Campaign Portal Breakdown"
          icon={Megaphone}
          phrases={["Pulling campaign-portal stats…", "Grouping by lander & entity…", "Crunching delivery numbers…", "Polishing the dashboard…"]}
          tiles={[{ label: "Sent" }, { label: "Delivered" }, { label: "Clicked" }]}
          progressLabel="Preparing your dashboard"
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden">
      <Toaster />

      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Campaign</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Campaign-portal performance broken down by lander &amp; entity — total, sent, delivered, read, clicked,
          failed and spend. Click a row to drill into the raw rows.
        </p>
      </div>

      {selectedEntity && (
        <div className="-mt-1 mb-2 flex items-center gap-1.5 text-[11px] text-gray-500">
          <span>Totals scoped to entity</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ring-1 ${entityColor(selectedEntity)}`}>
            {selectedEntity}
          </span>
          <button type="button" onClick={() => onEntityChange("")} className="text-purple-600 hover:underline font-medium">
            show all
          </button>
        </div>
      )}

      <StatCards campaign={campaignView} loading={loading} />

      <div className="flex items-center gap-x-6 gap-y-2 flex-wrap mb-4">
        <DateFilter
          dateType={query.filter_date}
          onDateTypeChange={onDateTypeChange}
          startDate={query.startDate}
          endDate={query.endDate}
          onDateRangeChange={onDateRangeChange}
          onRefresh={fetchData}
        />
        {entityOptions.length > 0 && (
          <EntityFilter value={selectedEntity} options={entityOptions} onChange={onEntityChange} />
        )}
      </div>

      <MainTable
        columns={columns}
        data={pageRows}
        totalDataCount={filteredRows.length}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        title="Campaign Breakdown"
        initialPagination={{ pageIndex: table.pageIndex, pageSize: table.pageSize }}
      />
    </div>
  );
};

export default Campaign;
