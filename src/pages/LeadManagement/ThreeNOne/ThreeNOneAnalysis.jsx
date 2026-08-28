import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { Calendar, Layers, MousePointerClick, LogIn, ArrowRightCircle, Users, Filter, Download, Loader2 } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import PremiumLoader from '../../../components/PremiumLoader';
import { getThreeNOneAnalysis, getThreeNOneExport } from '../../../api-services/Modules/ThreeNOne';

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtPct = (n) => `${Number(n || 0)}%`;
const pctOf = (num, den) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');

// 'YYYY-MM-DD' → 'Fri, 28 Aug' (parsed at local midnight so the day doesn't shift).
const fmtDay = (v) => {
  if (!v) return '—';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
};

// Short display names for the per-lender Selected columns (owner's labels).
const LENDER_SHORT = { 'Poonawalla Fincorp': 'Poonawalla', 'Hero FinCorp': 'Hero', 'LNT': 'L&T' };
const shortLender = (l) => LENDER_SHORT[l] || l;

// ── CSV export — one row per event, with the user's PI (from cibil_pi) ──
const EXPORT_COLUMNS = [
  { key: 'occurred_at', label: 'Occurred At' },
  { key: 'day', label: 'Day' },
  { key: 'stage', label: 'Stage' },
  { key: 'event', label: 'Event' },
  { key: 'source', label: 'Source' },
  { key: 'lender_name', label: 'Lender' },
  { key: 'utm_source', label: 'UTM Source' },
  { key: 'mrn', label: 'MRN' },
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'pan', label: 'PAN' },
  { key: 'dob', label: 'DOB' },
  { key: 'gender', label: 'Gender' },
  { key: 'job_type', label: 'Job Type' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'salary', label: 'Salary' },
];
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (rows) => {
  const lines = [EXPORT_COLUMNS.map((c) => csvEscape(c.label)).join(',')];
  rows.forEach((r) => lines.push(EXPORT_COLUMNS.map((c) => csvEscape(r[c.key])).join(',')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `3n1_export_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const RANGE_CHIPS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_month', label: 'This Month' },
];

const SOURCE_CHIPS = [
  { key: 'all', label: 'All Sources' },
  { key: 'compare', label: 'Compare' },
  { key: 'campaign', label: 'Campaign' },
];

// The three funnel stages, with an icon + tint each.
const STAGE_META = [
  { key: 'landed', label: 'Landed', icon: <LogIn size={15} />, tint: 'from-sky-500 to-blue-600', bar: 'bg-sky-500' },
  { key: 'selected', label: 'Selected', icon: <MousePointerClick size={15} />, tint: 'from-violet-500 to-indigo-600', bar: 'bg-violet-500' },
  { key: 'continued', label: 'Continued', icon: <ArrowRightCircle size={15} />, tint: 'from-emerald-500 to-green-600', bar: 'bg-emerald-500' },
];

const Kpi = ({ icon, label, value, sub, tone }) => (
  <div className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 shadow-sm ${tone}`}>
    <div className="flex items-center gap-1.5 mb-1 opacity-80">
      {icon}
      <span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-[24px] leading-none font-extrabold text-gray-900">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

const TABS = ['3N1 Analysis'];

const ThreeNOneAnalysis = () => {
  const [activeTab, setActiveTab] = useState('3N1 Analysis');
  const [range, setRange] = useState('all');
  const [source, setSource] = useState('all');
  const [utmSource, setUtmSource] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const p = {};
    if (range === 'custom' && fromDate && toDate) { p.fromDate = fromDate; p.toDate = toDate; }
    else if (range !== 'all') p.type = range;
    if (source !== 'all') p.source = source;
    // utm_source only applies within campaign.
    if (source === 'campaign' && utmSource !== 'all') p.utmSource = utmSource;
    return p;
  }, [range, source, utmSource, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getThreeNOneAnalysis(params);
      if (res?.data?.success) setData(res.data.data);
      else ToastNotification.error('Failed to load 3N1 analysis');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load 3N1 analysis');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await getThreeNOneExport(params);
      const rows = res?.data?.data?.rows || [];
      if (!rows.length) { ToastNotification.error('No rows to export for this filter.'); return; }
      downloadCsv(rows);
      ToastNotification.success(`Exported ${rows.length} rows.`);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed.');
    } finally {
      setExporting(false);
    }
  }, [params]);

  const s = data?.summary || {};
  const maxStage = Math.max(Number(s.landed) || 0, Number(s.selected) || 0, Number(s.continued) || 0, 1);
  const hasData = data && ((Number(s.landed) || 0) + (Number(s.selected) || 0) + (Number(s.continued) || 0)) > 0;

  // Analyst matrix: per-day rows + per-lender Selected columns, plus a totals row.
  const matrix = data?.matrix || [];
  const lenderColumns = data?.lenderColumns || [];
  const totals = matrix.reduce((a, r) => {
    a.landed += r.landed; a.selected += r.selected; a.continued += r.continued;
    lenderColumns.forEach((l) => { a.byLender[l] = (a.byLender[l] || 0) + (r.selByLender?.[l] || 0); });
    return a;
  }, { landed: 0, selected: 0, continued: 0, byLender: {} });

  return (
    <>
      <Toaster />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-xl px-5 py-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-white shadow">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">3N1 page</h1>
            <p className="text-[12px] text-gray-500">Land → Select → Continue funnel from <code className="text-[11px]">lender_events</code>.</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200 px-1 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative pb-2 text-sm font-semibold transition-colors ${activeTab === tab ? 'text-violet-600' : 'text-gray-500 hover:text-violet-600'}`}
          >
            {tab}
            {activeTab === tab && <span className="absolute left-0 -bottom-[1px] h-0.5 w-full bg-violet-600 rounded" />}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1 inline-flex items-center gap-1.5">
          <Calendar size={13} /> Period:
        </span>
        {RANGE_CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setRange(c.key); setFromDate(''); setToDate(''); }}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
              range === c.key ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setRange('custom'); }}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-violet-400" />
        <span className="text-gray-400 text-xs">to</span>
        <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setRange('custom'); }}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-violet-400" />

        <span className="mx-2 h-5 w-px bg-gray-200" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Source:</span>
        {SOURCE_CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setSource(c.key); if (c.key !== 'campaign') setUtmSource('all'); }}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
              source === c.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
            }`}
          >
            {c.label}
          </button>
        ))}

        {/* utm_source dropdown — campaign only */}
        {source === 'campaign' && (
          <>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">UTM Source:</span>
            <select
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 outline-none focus:border-indigo-400 capitalize"
            >
              <option value="all">All UTM Sources</option>
              {(data?.utmSources || []).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </>
        )}

        <button onClick={fetchData} className="ml-auto px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="py-20"><PremiumLoader size="md" label="Building 3N1 funnel…" /></div>
      ) : !hasData ? (
        <div className="py-20 text-center text-gray-400 italic bg-white border border-gray-200 rounded-xl">No events for this period.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="flex flex-wrap gap-3 mb-3">
            <Kpi icon={<LogIn size={14} />} tone="border-sky-100 bg-sky-50/70 text-sky-600" label="Landed" value={fmtNum(s.landed)} sub="land events" />
            <Kpi icon={<Users size={14} />} tone="border-indigo-100 bg-indigo-50/70 text-indigo-600" label="Distinct Users" value={fmtNum(s.distinctUsers)} sub="unique MRNs" />
            <Kpi icon={<MousePointerClick size={14} />} tone="border-violet-100 bg-violet-50/70 text-violet-600" label="Selected" value={fmtNum(s.selected)} sub={`${fmtPct(s.selectRate)} of landed`} />
            <Kpi icon={<ArrowRightCircle size={14} />} tone="border-emerald-100 bg-emerald-50/70 text-emerald-600" label="Continued" value={fmtNum(s.continued)} sub={`${fmtPct(s.continueRate)} of selected`} />
          </div>

          {/* Analyst note — how the funnel is defined + how to read it */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 text-[12px] text-amber-900 leading-relaxed">
            <b>How to read this funnel.</b> The <b>Compare / 3-in-1</b> page is the full 3-step funnel
            (<b>Landed → Selected → Continued</b>). <b>Direct campaigns</b> (PFL / Hero / L&T direct) drop the user
            straight onto one lender, so they have <b>no Select step</b> (Landed → Continued). Choose a <b>Source</b> above
            to isolate a clean funnel — on <i>All Sources</i>, <b>Selection %</b> is diluted by direct-campaign landings that
            never select. The per-lender columns are <b>Selected</b> counts and always sum to the <b>Selected</b> total.
          </div>

          {/* Journey History — date × stage matrix (the analyst view) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Filter size={15} className="text-violet-600" />
              <h3 className="text-[14px] font-bold text-gray-800">Journey History — by day</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-50 text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 min-w-[110px]">Date</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-sky-600">Landed</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600">Users</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-violet-600">Selected</th>
                    {lenderColumns.map((l) => (
                      <th key={l} className="text-right px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">{shortLender(l)} Sel.</th>
                    ))}
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600">Continue</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => {
                    const rowBg = i % 2 ? 'bg-gray-50' : 'bg-white';
                    return (
                      <tr key={row.day} className={`border-b border-gray-50 ${rowBg} hover:bg-violet-50`}>
                        <td className={`sticky left-0 z-10 ${rowBg} px-4 py-2 text-[12.5px] font-semibold text-gray-800 whitespace-nowrap`}>{fmtDay(row.day)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-800 font-medium">{fmtNum(row.landed)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-700">{fmtNum(row.distinctUsers)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-semibold">{fmtNum(row.selected)}</td>
                        {lenderColumns.map((l) => (
                          <td key={l} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${row.selByLender?.[l] ? 'text-gray-700' : 'text-gray-300'}`}>
                            {row.selByLender?.[l]
                              ? <>{fmtNum(row.selByLender[l])} <span className="text-[10px] font-semibold text-gray-400">{pctOf(row.selByLender[l], row.selected)}</span></>
                              : '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-semibold whitespace-nowrap">{fmtNum(row.continued)} <span className="text-[10px] font-semibold text-emerald-500">{fmtPct(row.continuePct)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-200">
                  <tr className="bg-gray-100 font-bold">
                    <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2.5 text-[12px] uppercase tracking-wide text-gray-600">Total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmtNum(totals.landed)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-indigo-700">{fmtNum(s.distinctUsers)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmtNum(totals.selected)}</td>
                    {lenderColumns.map((l) => (
                      <td key={l} className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">{fmtNum(totals.byLender[l] || 0)} <span className="text-[10px] font-semibold text-gray-400">{pctOf(totals.byLender[l] || 0, totals.selected)}</span></td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{fmtNum(totals.continued)} <span className="text-[10px] font-semibold text-emerald-600">{pctOf(totals.continued, Number(s.distinctUsers) || 0)}</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
              Rows = the day each event happened (IST). <b>Users</b> = distinct MRNs. The % beside each lender <i>Sel.</i> = that lender's
              share of <b>Selected</b> that day (they sum to 100%). The % beside <b>Continue</b> = Continued ÷ Users. The Total row's
              Users is the overall distinct count (users active on multiple days are counted once). Honours the date / source / UTM filters above.
            </p>
          </div>
        </>
      )}
    </>
  );
};

export default ThreeNOneAnalysis;
