import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { Filter, Download, Users, CheckCircle2, XCircle, TrendingDown, Calendar } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import PremiumLoader from '../../../components/PremiumLoader';
import { getUpSwingFunnelHistory } from '../../../api-services/Modules/UpSwingWebhook';

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtPct = (n) => `${Number(n || 0)}%`;

// 'YYYY-MM-DD' → 'Wed, 29 Jul' (parsed at local midnight so the day doesn't shift).
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
};

// ── CSV export — date × stage matrix (Date, Total, then one column per stage) ──
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const exportCsv = (data) => {
  const stages = data.stages || [];
  const header = ['Date', 'Total', ...stages.map((s) => s.label)];
  const lines = [header.map(csvEscape).join(',')];
  (data.matrix || []).forEach((row) => {
    lines.push([row.date, row.total, ...stages.map((s) => row.byStage[s.key] || 0)].map(csvEscape).join(','));
  });
  // Grand-total footer row.
  lines.push(['Total', data.totalLeads, ...stages.map((s) => s.total)].map(csvEscape).join(','));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `upswing_funnel_history_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

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

// Date range for the funnel. All / Today / Yesterday quick chips + a custom range.
const RANGE_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
];

const UpSwingFunnel = () => {
  const [range, setRange] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Resolve the active range → API params. Custom range wins when both dates set.
  const params = useMemo(() => {
    if (range === 'custom' && fromDate && toDate) return { fromDate, toDate };
    if (range === 'today' || range === 'yesterday') return { type: range };
    return {};
  }, [range, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUpSwingFunnelHistory(params);
      if (res?.data?.success) setData(res.data.data);
      else ToastNotification.error('Failed to load funnel');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load funnel');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = data?.summary || {};
  const total = Number(s.totalLeads) || 0;
  const inProgress = Math.max(total - (Number(s.disbursed) || 0) - (Number(s.rejected) || 0), 0);

  return (
    <>
      <Toaster />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-5 py-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow">
            <TrendingDown size={22} />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">UpSwing Funnel</h1>
            <p className="text-[12px] text-gray-500">Journey history — each lead counted in every stage it reached.</p>
          </div>
        </div>
        <button
          onClick={() => data && exportCsv(data)}
          disabled={!data}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 transition"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1 inline-flex items-center gap-1.5">
          <Calendar size={13} /> Period:
        </span>
        {RANGE_CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setRange(c.key); setFromDate(''); setToDate(''); }}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
              range === c.key ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setRange('custom'); }}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-purple-400"
        />
        <span className="text-gray-400 text-xs">to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setRange('custom'); }}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-purple-400"
        />
        <button onClick={fetchData} className="ml-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="py-20"><PremiumLoader size="md" label="Building funnel…" /></div>
      ) : !data || !total ? (
        <div className="py-20 text-center text-gray-400 italic bg-white border border-gray-200 rounded-xl">No journey data for this period.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="flex flex-wrap gap-3 mb-3">
            <Kpi icon={<Users size={14} />} tone="border-purple-100 bg-purple-50/70 text-purple-600" label="Total Leads" value={fmtNum(total)} sub="distinct pci" />
            <Kpi icon={<TrendingDown size={14} />} tone="border-amber-100 bg-amber-50/70 text-amber-600" label="In Progress" value={fmtNum(inProgress)} sub={`${fmtPct((inProgress / (total || 1) * 100).toFixed(1))} still moving`} />
            <Kpi icon={<CheckCircle2 size={14} />} tone="border-emerald-100 bg-emerald-50/70 text-emerald-600" label="Disbursed" value={fmtNum(s.disbursed)} sub={`${fmtPct(s.disbursedPct)} of leads`} />
            <Kpi icon={<XCircle size={14} />} tone="border-rose-100 bg-rose-50/70 text-rose-600" label="Rejected" value={fmtNum(s.rejected)} sub={`${fmtPct(s.rejectedPct)} of leads`} />
          </div>

          {/* Funnel matrix — dates down the left, journey stages across the top. */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Filter size={15} className="text-purple-600" />
              <h3 className="text-[14px] font-bold text-gray-800">Journey History — leads reaching each stage, by date</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-50 text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 min-w-[120px]">Date</th>
                    <th className="sticky left-[120px] z-20 bg-gray-100 text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 min-w-[70px]">Total</th>
                    {data.stages.map((st) => (
                      <th
                        key={st.key}
                        title={st.key}
                        className={`text-right px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide whitespace-nowrap ${st.tone === 'red' ? 'text-rose-600' : st.tone === 'green' ? 'text-emerald-600' : 'text-gray-500'}`}
                      >
                        {st.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((row, i) => {
                    const rowBg = i % 2 ? 'bg-gray-50' : 'bg-white';
                    return (
                      <tr key={row.date} className={`border-b border-gray-50 ${rowBg} hover:bg-purple-50`}>
                        <td className={`sticky left-0 z-10 ${rowBg} px-4 py-2 text-[12.5px] font-semibold text-gray-800 whitespace-nowrap`}>{fmtDate(row.date)}</td>
                        <td className={`sticky left-[120px] z-10 ${rowBg} px-3 py-2 text-right text-[13px] font-extrabold text-gray-900 tabular-nums border-l border-gray-100`}>{fmtNum(row.total)}</td>
                        {data.stages.map((st) => {
                          const v = row.byStage[st.key] || 0;
                          return (
                            <td key={st.key} className={`px-3 py-2 text-right text-[12.5px] tabular-nums ${v ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
                              {v ? fmtNum(v) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-200">
                  <tr className="bg-gray-100">
                    <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-gray-600">Total</td>
                    <td className="sticky left-[120px] z-10 bg-gray-200/70 px-3 py-2.5 text-right text-[13px] font-extrabold text-gray-900 tabular-nums">{fmtNum(total)}</td>
                    {data.stages.map((st) => (
                      <td key={st.key} className="px-3 py-2.5 text-right text-[12.5px] font-bold text-gray-800 tabular-nums">{fmtNum(st.total)}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
              Rows = lead created-date; columns = journey stages. Each cell = distinct leads created that day that
              <b> ever reached</b> that stage (full event history) — a lead counts in every stage it passed through.
              Scroll right for all {data.stages.length} stages. Bottom row = grand totals.
            </p>
          </div>
        </>
      )}

      <ModuleInfoCard
        title="UpSwing Funnel (Journey History)"
        subtitle="Cumulative funnel — each lead counted in every stage it ever reached, from the full webhook event history."
        whatYouSee={[
          'Total Leads at the top, then each journey stage with how many leads EVER reached it.',
          'A single lead appears in every stage it passed through — so the bars step down along the journey.',
          'The red figure on each row is how many leads never reached that stage (drop-off).',
          'Green rows = disbursed, red rows = rejected / cancelled outcomes.',
        ]}
        dataSource={[
          'ClickHouse upswing.webhook_events — the append-only event diary (distinct pci per event type).',
          'Scoped to the same lead universe as the UpSwing list (upswing.pci_latest_event, createdAt filter).',
          'Different from the UpSwing list’s stage funnel, which shows each lead only at its CURRENT stage.',
        ]}
        flow={[
          'UpSwing sends webhooks',
          'Events appended to webhook_events',
          'Count distinct leads per stage (ever reached)',
          'Order along the journey',
          'Cumulative funnel + drop-off',
        ]}
      />
    </>
  );
};

export default UpSwingFunnel;
