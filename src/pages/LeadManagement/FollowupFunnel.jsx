import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import {
  Filter, RefreshCw, Users, Headphones, PhoneCall, BadgeCheck,
  Clock, Calendar, Download, ChevronRight, Trophy, Medal,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, AlarmClock, Timer, ShieldAlert } from 'lucide-react';
import { getFollowupFunnel, exportStageLeads } from '../../api-services/Modules/Leads';
import ToastNotification from '../../components/Notification/ToastNotification';
import StageLeadsModal from '../../components/StageLeadsModal/StageLeadsModal';
import ExportModal from '../../components/ExportModal';
import { useAuth } from '../../custom-hooks/useAuth';

const SCOPES = [
  { value: 'all',   label: 'All' },
  { value: 'high',  label: 'High Ticket' },
  { value: 'short', label: 'Short Ticket' },
];

const RANGES = [
  { value: 'all',       label: 'All' },
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d',        label: '7D' },
  { value: '30d',       label: '30D' },
  { value: '90d',       label: '90D' },
  { value: 'custom',    label: 'Custom' },
];

// Disposition colour (hex) for the donut + legend.
const DISPO_HEX = {
  'converted / disbursed':        '#10b981',
  'interested':                   '#8b5cf6',
  'call back later':              '#6366f1',
  'documents pending':            '#3b82f6',
  'not interested':               '#ef4444',
  'not eligible':                 '#f43f5e',
  'already availed loan':         '#f59e0b',
  'language barrier':             '#eab308',
  'not connected':                '#94a3b8',
  'customer disconnected':        '#fb923c',
  'wrong number':                 '#cbd5e1',
  'switched off / not reachable': '#a8a29e',
};
const PALETTE = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const dispoHex = (s, i) => DISPO_HEX[String(s || '').toLowerCase().trim()] || PALETTE[i % PALETTE.length];

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDay = (d) => {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const SlaCard = ({ icon, ring, label, value, loading }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
    <div className={`mx-auto grid place-items-center w-8 h-8 rounded-lg ${ring} mb-1.5`}>{icon}</div>
    <p className="text-[10px] text-gray-400 leading-tight mb-1">{label}</p>
    {loading ? <div className="mx-auto h-5 w-10 rounded bg-gray-200 animate-pulse" /> : <p className="text-lg font-bold text-gray-900">{fmt(value)}</p>}
  </div>
);

// One row of the Total Leads breakdown mini-list: dot · label · value · chevron.
// Rows with an onClick route to their drill-down stage; rows without render static.
const BreakdownRow = ({ dot, label, value, onClick, last }) => {
  const clickable = !!onClick;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`group/row flex w-full items-center gap-2 py-1 px-1 -mx-1 rounded-md text-left ${last ? '' : 'border-b border-gray-100'} ${clickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-[11.5px] font-medium text-gray-600 truncate">{label}</span>
      <span className="ml-auto flex items-center gap-1 shrink-0">
        <span className="text-[12.5px] font-bold text-gray-900 tabular-nums">{fmt(value)}</span>
        {clickable
          ? <ChevronRight size={12} className="text-gray-300 group-hover/row:text-purple-500 transition" />
          : <span className="w-3" />}
      </span>
    </Tag>
  );
};

// Attractive metric card: gradient tint + gradient icon chip · label · delta pill ·
// big number · share bar · caption. h-full + justify-between fills the height nicely.
const MetricCard = ({ span, icon, iconBg, cardBg, barColor, label, value, sub, share, delta, loading, onClick }) => {
  const up = delta != null && delta >= 0;
  const barW = share > 0 ? Math.min(Math.max(share, 4), 100) : 0; // min 4% so a non-zero value still shows
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || !onClick}
      className={`${span} group flex h-full flex-col text-left w-full rounded-2xl border border-gray-100 ${cardBg} p-3.5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 disabled:cursor-default disabled:hover:shadow-sm disabled:hover:translate-y-0`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`grid place-items-center w-10 h-10 rounded-xl text-white shadow-sm ${iconBg}`}>{icon}</div>
        <p className="flex-1 text-[12px] font-semibold text-gray-600 leading-tight">{label}</p>
        {!loading && delta != null && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center">
        {loading
          ? <div className="h-9 w-24 rounded-md bg-gray-200 animate-pulse" />
          : <p className="text-[36px] font-extrabold text-gray-900 leading-none tracking-tight">{fmt(value)}</p>}
      </div>

      <div className="pt-1">
        {loading
          ? <div className="h-1.5 w-full rounded-full bg-gray-100 animate-pulse" />
          : (
            <div className="h-1.5 w-full rounded-full bg-gray-200/60 overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
            </div>
          )}
        {loading
          ? <div className="mt-2 h-2.5 w-24 rounded bg-gray-100 animate-pulse" />
          : <p className="mt-2 text-[11px] font-medium text-gray-400">{sub}</p>}
      </div>
    </button>
  );
};

// utm_medium / utm_source filter options for the call-center funnel (high + short
// traffic). "QuickLoans"/"EasyLoan" = our own traffic (utm_medium IS NULL) for
// high / short respectively.
const FF_MEDIUMS = ['QuickLoans', 'EasyLoan', 'moneyview', 'meta', 'kreditbee', 'zype', 'SC', 'poonawalla', 'IDFC', 'hero', /* 'kisht', */ 'truebalance', 'ramfincorp', 'mpokket', 'creditplus', 'LendingPlate', 'incred', 'rapidmoney'];
const FF_SOURCES = ['google', 'google_ads'];

const FollowupFunnel = ({ embedded = false, agent, minMonthlyIncome, maxMonthlyIncome, minLoanAmount }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super-admin';
  const [scope, setScope] = useState('all');
  const [range, setRange] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(null); // { stage, label } when a card is clicked
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [utmMedium, setUtmMedium] = useState('');
  const [utmSource, setUtmSource] = useState('');

  const fetchFunnel = useCallback(async () => {
    // "meta" → drop the salary/loan band so meta leads aren't income/loan-gated.
    const dropBand = String(utmMedium || '').toLowerCase() === 'meta';
    const params = { scope };
    if (agent) params.agent = agent;
    if (!dropBand && minMonthlyIncome) params.minMonthlyIncome = minMonthlyIncome;
    if (!dropBand && maxMonthlyIncome) params.maxMonthlyIncome = maxMonthlyIncome;
    if (!dropBand && minLoanAmount) params.minLoanAmount = minLoanAmount;
    if (utmMedium) params.utmMedium = utmMedium;
    if (utmSource) params.utmSource = utmSource;
    if (range === 'custom') {
      // Wait for a complete, valid custom range before hitting the API — otherwise
      // it would silently return all-time data while "Custom" looks selected.
      if (!customFrom || !customTo || customFrom > customTo) { setLoading(false); return; }
      params.fromDate = customFrom;
      params.toDate = customTo;
    } else if (range !== 'all') {
      params.type = range;
    }
    setLoading(true);
    try {
      const res = await getFollowupFunnel(params);
      if (res?.data?.success) setData(res.data.data);
      else ToastNotification.error('Could not load the funnel');
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || 'Could not load the funnel');
    } finally {
      setLoading(false);
    }
  }, [scope, range, customFrom, customTo, agent, minMonthlyIncome, maxMonthlyIncome, minLoanAmount, utmMedium, utmSource]);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  const totals = data?.totals || {};
  const funnel = data?.funnel || [];
  const breakdown = data?.statusBreakdown || [];
  const followedUp = funnel[1]?.count || 0;     // donut centre + "% of followed"
  const dispoData = breakdown.map((b, i) => ({ name: b.status, value: b.count, fill: dispoHex(b.status, i) }));
  const agents = data?.agents || [];
  const rankedAgents = [...agents].sort((x, y) => (y.contacted || 0) - (x.contacted || 0));
  const trend = data?.trend || [];
  const sla = data?.sla || {};
  const prev = data?.prev || null;
  const delta = (cur, prv) => (prv && prv > 0) ? ((cur - prv) / prv) * 100 : null;
  // Disposition keys present in the trend → stacked-bar series.
  const trendKeys = [...new Set(trend.flatMap((d) => Object.keys(d).filter((k) => k !== 'day')))];

  // Total-Leads card sub-breakdown.
  const findDispo = (name) => (breakdown.find((b) => String(b.status).toLowerCase().trim() === name) || {}).count || 0;
  const openLeads = Math.max((totals.totalLeads || 0) - (totals.followedUp || 0), 0);
  const callBack = findDispo('call back later');
  const notInterested = findDispo('not interested');
  const totalDelta = delta(totals.totalLeads, prev?.totalLeads);

  // "meta" → drop the band for the stage drill-down / export too (match the funnel).
  const metaDropBand = String(utmMedium || '').toLowerCase() === 'meta';
  // Scope a clicked stage's customer list to match the funnel exactly.
  const stageParams = {
    scope,
    ...(agent ? { agent } : {}),
    ...(!metaDropBand && minMonthlyIncome ? { minMonthlyIncome } : {}),
    ...(!metaDropBand && maxMonthlyIncome ? { maxMonthlyIncome } : {}),
    ...(!metaDropBand && minLoanAmount ? { minLoanAmount } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(range === 'custom'
      ? (customFrom && customTo && customFrom <= customTo ? { fromDate: customFrom, toDate: customTo } : {})
      : (range !== 'all' ? { type: range } : {})),
  };
  const openStage = (stage, label) => setActiveStage({ stage, label });

  // Super-admin: download EVERY lead (Total Leads) in the current funnel scope.
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportStageLeads({ ...stageParams, stage: 'totalLeads' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `total_leads_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      ToastNotification.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // OTP-gated entry: the modal verifies identity, then we run the export (which
  // already uses the funnel's current filters/scope), then close.
  const handleExportSubmit = async () => {
    await handleExport();
    setExportModalOpen(false);
  };

  return (
    <div className="w-full">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />

      {!embedded && (
        <div className="relative overflow-hidden rounded-2xl border border-purple-100 bg-white p-5 shadow-sm mb-4">
          <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500" />
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 text-white shadow-md">
              <Filter size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Follow-up Funnel</h1>
              <p className="text-sm text-gray-400">How many customers the call-center followed up, reached, engaged and converted.</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Filters ─── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setScope(s.value);
                // QuickLoans = high-only, EasyLoan = short-only — clear a now-mismatched pick.
                if ((s.value === 'high' && utmMedium === 'EasyLoan') || (s.value === 'short' && utmMedium === 'QuickLoans')) setUtmMedium('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                scope === s.value
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="hidden sm:inline-block w-px h-6 bg-gray-200" />

        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar size={15} className="text-gray-400" />
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                range === r.value
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200" />
            {(!customFrom || !customTo || customFrom > customTo) && (
              <span className="text-[11px] text-amber-600">Pick both dates (from ≤ to)</span>
            )}
          </div>
        )}

        <span className="hidden sm:inline-block w-px h-6 bg-gray-200" />

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={utmMedium}
            onChange={(e) => setUtmMedium(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-200"
            title="Filter by UTM medium"
          >
            <option value="">All Mediums</option>
            {FF_MEDIUMS
              .filter((m) => (m === 'QuickLoans' ? scope !== 'short' : m === 'EasyLoan' ? scope !== 'high' : true))
              .map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={utmSource}
            onChange={(e) => setUtmSource(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-200"
            title="Filter by UTM source"
          >
            <option value="">All Sources</option>
            {FF_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(utmMedium || utmSource) && (
            <button
              onClick={() => { setUtmMedium(''); setUtmSource(''); }}
              className="text-[11px] px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
            >
              Clear
            </button>
          )}
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setExportModalOpen(true)}
            disabled={exporting}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
            title="Export every lead (Total Leads, current scope) as CSV"
          >
            <Download size={13} /> {exporting ? 'Exporting…' : 'Export Leads'}
          </button>
        )}
        <button
          onClick={fetchFunnel}
          className={`${isSuperAdmin ? '' : 'ml-auto '}inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition`}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ─── KPI cards ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-3 mb-4 items-stretch">
        {/* Total Leads — hero card (3/9); height filled by the breakdown list */}
        <div className="lg:col-span-3 flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <button
            type="button"
            onClick={() => openStage('totalLeads', 'Total Leads')}
            disabled={loading}
            className="flex items-start justify-between gap-2 text-left rounded-lg -mx-1 px-1 py-0.5 transition hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 shrink-0"><Users size={18} /></div>
                <p className="text-[12px] font-semibold text-gray-500">Total Leads</p>
              </div>
              {loading
                ? <div className="mt-2 h-8 w-28 rounded-md bg-gray-200 animate-pulse" />
                : <p className="mt-1.5 text-[30px] font-extrabold text-gray-900 leading-none tracking-tight">{fmt(totals.totalLeads)}</p>}
            </div>
            {!loading && (
              <div className="mt-0.5 flex flex-col items-end gap-1">
                {totalDelta != null && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${totalDelta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`} title="Total leads vs previous period">
                    {totalDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(totalDelta).toFixed(1)}%
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{fmt(totals.followedUp)} followed up</span>
              </div>
            )}
          </button>

          {/* breakdown list — 2 columns to keep the card compact */}
          <div className="mt-2.5 pt-2 border-t border-gray-100 flex-1">
            {loading ? (
              <div className="space-y-2 pt-2">
                {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-5 rounded bg-gray-100 animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5">
                <BreakdownRow dot="bg-slate-400"   label="Open Leads"     value={openLeads} />
                <BreakdownRow dot="bg-indigo-500"  label="Connected"      value={totals.connected}  onClick={() => openStage('connected', 'Connected')} />
                <BreakdownRow dot="bg-amber-500"   label="Call Back"      value={callBack}          onClick={() => openStage('callback', 'Call Back Requested')} />
                <BreakdownRow dot="bg-purple-500"  label="Interested"     value={totals.interested} onClick={() => openStage('interested', 'Interested')} />
                <BreakdownRow dot="bg-emerald-500" label="Converted"      value={totals.converted}  onClick={() => openStage('converted', 'Conversions (Approved)')} last />
                <BreakdownRow dot="bg-rose-400"    label="Not Interested" value={notInterested}     last />
              </div>
            )}
          </div>
        </div>

        {/* Right metric cards — wider (2/9 each → 66% of the row), gradient + share bar */}
        <MetricCard
          span="lg:col-span-2"
          loading={loading}
          onClick={() => openStage('connected', 'Connected')}
          icon={<PhoneCall size={18} />}
          iconBg="bg-gradient-to-br from-emerald-400 to-emerald-600"
          cardBg="bg-gradient-to-br from-emerald-50/70 to-white"
          barColor="bg-emerald-500"
          label="Connected Calls"
          value={totals.connected}
          delta={delta(totals.connected, prev?.connected)}
          share={pct(totals.connected, totals.followedUp)}
          sub={`${pct(totals.connected, totals.followedUp).toFixed(1)}% of followed up`}
        />
        <MetricCard
          span="lg:col-span-2"
          loading={loading}
          onClick={() => openStage('callback', 'Call Back Requested')}
          icon={<Calendar size={18} />}
          iconBg="bg-gradient-to-br from-amber-400 to-orange-500"
          cardBg="bg-gradient-to-br from-amber-50/70 to-white"
          barColor="bg-amber-500"
          label="Call Back Requested"
          value={callBack}
          delta={delta(callBack, prev?.callBack)}
          share={pct(callBack, totals.followedUp)}
          sub={`${pct(callBack, totals.followedUp).toFixed(1)}% of followed up`}
        />
        <MetricCard
          span="lg:col-span-2"
          loading={loading}
          onClick={() => openStage('converted', 'Conversions (Approved)')}
          icon={<BadgeCheck size={18} />}
          iconBg="bg-gradient-to-br from-indigo-400 to-violet-600"
          cardBg="bg-gradient-to-br from-indigo-50/70 to-white"
          barColor="bg-indigo-500"
          label="Conversions (Approved)"
          value={totals.converted}
          delta={delta(totals.converted, prev?.converted)}
          share={pct(totals.converted, totals.followedUp)}
          sub={`${pct(totals.converted, totals.followedUp).toFixed(1)}% of followed up`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Disposition Summary (donut) ─── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Disposition Summary</h3>
          <p className="text-[11px] text-gray-400 mb-4">Followed-up customers by outcome.</p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-36 h-36 rounded-full border-[10px] border-gray-100 border-t-purple-300 animate-spin" />
            </div>
          ) : dispoData.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">No feedback recorded yet.</p>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative shrink-0" style={{ width: 190, height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dispoData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                      {dispoData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-gray-900 leading-none">{fmt(followedUp)}</span>
                  <span className="text-[10px] text-gray-400 mt-1">Followed up</span>
                </div>
              </div>
              <div className="flex-1 min-w-[170px] space-y-1.5">
                {dispoData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-gray-600 truncate pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} /> {d.name}
                    </span>
                    <span className="font-semibold text-gray-800 whitespace-nowrap">{fmt(d.value)} <span className="text-gray-400 text-[10px]">({pct(d.value, followedUp).toFixed(1)}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Feedback Summary table ─── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Feedback Summary</h3>
          <p className="text-[11px] text-gray-400 mb-3">Outcome breakdown with share of followed-up.</p>

          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />)}
            </div>
          ) : dispoData.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No feedback recorded yet.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2 font-semibold">Outcome</th>
                  <th className="py-2 font-semibold text-right">Count</th>
                  <th className="py-2 font-semibold text-right">% Share</th>
                </tr>
              </thead>
              <tbody>
                {dispoData.map((d) => (
                  <tr key={d.name} className="border-b border-gray-50">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-700"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} /> {d.name}</span>
                    </td>
                    <td className="py-2 text-right text-[12px] font-semibold text-gray-800">{fmt(d.value)}</td>
                    <td className="py-2 text-right text-[12px] text-gray-500">{pct(d.value, followedUp).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Outcome Trend + SLA ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Outcome Trend (Daily)</h3>
          <p className="text-[11px] text-gray-400 mb-4">Feedback outcomes over the last 7 days.</p>
          {loading ? (
            <div className="h-[240px] rounded-lg bg-gray-50 animate-pulse" />
          ) : trendKeys.length === 0 ? (
            <p className="text-sm text-gray-400 py-16 text-center">No activity in the last 7 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trend} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
                {trendKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={dispoHex(k, i)} radius={i === trendKeys.length - 1 ? [3, 3, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">SLA &amp; Follow-ups</h3>
          <div className="grid grid-cols-2 gap-3">
            <SlaCard loading={loading} icon={<AlarmClock size={15} />} ring="bg-rose-50 text-rose-600"     label="Overdue Follow-ups" value={sla.overdue} />
            <SlaCard loading={loading} icon={<Timer size={15} />}      ring="bg-amber-50 text-amber-600"   label="Due in Next 1 Hour" value={sla.dueNextHour} />
            <SlaCard loading={loading} icon={<ShieldAlert size={15} />} ring="bg-red-50 text-red-600"      label="SLA Breached"       value={sla.breached} />
            <SlaCard loading={loading} icon={<Clock size={15} />}      ring="bg-indigo-50 text-indigo-600" label="Pending Total"      value={sla.pending} />
          </div>
        </div>
      </div>

      {/* ─── Top Performing Agents (leaderboard) ─── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden mt-4">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"><Trophy size={17} /></div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Top Performing Agents</h3>
            <p className="text-[11px] text-gray-400">Ranked by connected calls this period — with conversions and rate.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-2.5 font-semibold">Agent</th>
                <th className="px-3 py-2.5 font-semibold text-right">Connected Calls</th>
                <th className="px-3 py-2.5 font-semibold text-right">Conversions (Approved)</th>
                <th className="px-5 py-2.5 font-semibold text-right">Conversion %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse shrink-0" />
                        <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3"><div className="h-3 w-10 ml-auto rounded bg-gray-200 animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-8 ml-auto rounded-full bg-gray-100 animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-20 ml-auto rounded bg-gray-100 animate-pulse" /></td>
                  </tr>
                ))
              ) : rankedAgents.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">No agent activity in this period.</td></tr>
              ) : rankedAgents.map((a, i) => {
                const rate = pct(a.converted, a.contacted);
                const medal = ['bg-gradient-to-br from-amber-300 to-yellow-500', 'bg-gradient-to-br from-slate-300 to-slate-400', 'bg-gradient-to-br from-orange-300 to-amber-600'][i];
                return (
                  <tr key={a.agent} className={`border-b border-gray-50 transition hover:bg-amber-50/40 ${i === 0 ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`grid place-items-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0 ${medal ? `${medal} text-white shadow-sm` : 'bg-gray-100 text-gray-500'}`}>
                          {i === 0 ? <Trophy size={13} /> : i < 3 ? <Medal size={13} /> : i + 1}
                        </span>
                        <span className="text-[13px] font-semibold text-gray-800">{a.agent}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-bold text-gray-900 tabular-nums">{fmt(a.contacted)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">{fmt(a.converted)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden sm:block w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500" style={{ width: `${Math.min(rate, 100)}%` }} />
                        </div>
                        <span className="text-[12px] font-semibold text-gray-700 tabular-nums w-12 text-right">{rate.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeStage && (
        <StageLeadsModal
          stage={activeStage.stage}
          label={activeStage.label}
          params={stageParams}
          canExport={isSuperAdmin}
          onClose={() => setActiveStage(null)}
        />
      )}

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        isSubmitting={exporting}
      />
    </div>
  );
};

export default FollowupFunnel;
