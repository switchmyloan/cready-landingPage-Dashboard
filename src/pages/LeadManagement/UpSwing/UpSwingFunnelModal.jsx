import { useEffect, useState, useCallback } from 'react';
import { X, Filter, Download, Users, Clock, CheckCircle2, XCircle } from 'lucide-react';

import { getUpSwingFunnel } from '../../../api-services/Modules/UpSwingWebhook';
import ToastNotification from '@components/Notification/ToastNotification';

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtPct = (n) => `${Number(n || 0)}%`;

// ── CSV export ──────────────────────────────────────────────────────────────
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const exportFunnelCsv = (data) => {
  const cols = ['Section', 'Stage', 'At Stage (now)', '% at Stage', 'Reached', '% Reached'];
  const lines = [cols.join(',')];
  (data.funnel || []).forEach((s) => lines.push([
    'Funnel', s.label, s.atStage, s.pctAtStage, s.reached, s.pctReached,
  ].map(csvEscape).join(',')));
  (data.outcomes || []).forEach((o) => lines.push([
    'Outcome', o.label, o.leads, o.pctOfTop, '', '',
  ].map(csvEscape).join(',')));
  (data.other || []).forEach((o) => lines.push([
    'Other', o.key, o.leads, '', '', '',
  ].map(csvEscape).join(',')));

  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `upswing_funnel_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const Kpi = ({ icon, label, value, sub, tone }) => (
  <div className={`flex-1 min-w-[150px] rounded-xl border px-4 py-3 ${tone}`}>
    <div className="flex items-center gap-1.5 mb-1 opacity-80">
      {icon}
      <span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-[22px] leading-none font-extrabold text-gray-900">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

// One funnel step. The faint bar = share of leads that REACHED this stage (this
// stage or further); the solid bar = leads currently AT this stage. The bold number
// on the right is that "at stage" count — the exact same figure as the list's stage
// chip. "reached" is shown muted beside it.
const FunnelBar = ({ step, peakAtStage }) => (
  <div className="grid grid-cols-[minmax(150px,1.5fr)_minmax(0,4fr)_auto] items-center gap-3 px-1 py-1.5">
    <span className="text-[12.5px] font-semibold text-gray-700 truncate">{step.label}</span>
    <div className="relative h-6 rounded-md bg-gray-100 overflow-hidden">
      {/* faint = reached this stage or further */}
      <div className="absolute inset-y-0 left-0 bg-purple-100" style={{ width: `${Math.min(step.pctReached, 100)}%` }} />
      {/* solid = currently at this stage (scaled to the widest stage so it's visible) */}
      <div
        className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500"
        style={{ width: `${peakAtStage ? Math.min((step.atStage / peakAtStage) * 100, 100) : 0}%` }}
      />
      <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-bold text-gray-600">
        {step.pctReached}% reached
      </span>
    </div>
    <div className="flex items-center gap-2.5 justify-end tabular-nums">
      <span className="text-[14px] font-extrabold text-gray-800 min-w-[46px] text-right" title="Leads currently at this stage (= list chip)">
        {fmtNum(step.atStage)}
      </span>
      <span className="text-[11px] text-gray-400 min-w-[86px] text-right">reached {fmtNum(step.reached)}</span>
    </div>
  </div>
);

const UpSwingFunnelModal = ({ open, onClose, dateParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUpSwingFunnel(dateParams || {});
      if (res?.data?.success) setData(res.data.data);
      else ToastNotification.error('Failed to load funnel');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load funnel');
    } finally {
      setLoading(false);
    }
  }, [dateParams]);

  useEffect(() => {
    if (!open) return undefined;
    fetchFunnel();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, fetchFunnel, onClose]);

  if (!open) return null;

  const s = data?.summary || {};
  // Widest "at stage" count drives the solid-bar scale, so the biggest bucket fills it.
  const peakAtStage = (data?.funnel || []).reduce((m, f) => Math.max(m, f.atStage), 0);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-gray-900/50 backdrop-blur-sm px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="UpSwing journey funnel"
    >
      <div
        className="w-full max-w-4xl max-h-full overflow-y-auto rounded-2xl bg-gray-50 shadow-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-purple-600" />
            <h2 className="text-[14px] font-bold text-gray-800">UpSwing Journey Funnel</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => data && exportFunnelCsv(data)}
              disabled={!data}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 disabled:opacity-40 transition"
            >
              <Download size={14} /> Export
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading && !data ? (
            <p className="py-16 text-center text-sm text-gray-400 italic">Loading funnel…</p>
          ) : !data || !data.totalLeads ? (
            <p className="py-16 text-center text-sm text-gray-400 italic">No journey data for this period.</p>
          ) : (
            <>
              {/* KPIs */}
              <div className="flex flex-wrap gap-3 mb-4">
                <Kpi icon={<Users size={14} />} tone="border-purple-100 bg-purple-50/70 text-purple-600" label="Total Leads" value={fmtNum(s.totalLeads)} sub="distinct pci" />
                <Kpi icon={<Clock size={14} />} tone="border-amber-100 bg-amber-50/70 text-amber-600" label="In Progress" value={fmtNum(s.inProgress)} sub={`${fmtPct(s.inProgressPct)} still moving`} />
                <Kpi icon={<CheckCircle2 size={14} />} tone="border-emerald-100 bg-emerald-50/70 text-emerald-600" label="Disbursed" value={fmtNum(s.disbursed)} sub={`${fmtPct(s.disbursedPct)} of leads`} />
                <Kpi icon={<XCircle size={14} />} tone="border-rose-100 bg-rose-50/70 text-rose-600" label="Rejected" value={fmtNum(s.rejected)} sub={`${fmtPct(s.rejectedPct)} of leads`} />
              </div>

              {/* Funnel */}
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-3 shadow-sm">
                <h3 className="text-[13px] font-bold text-gray-800 mb-2.5">Journey Progression</h3>
                <div className="space-y-1">
                  {data.funnel.map((step) => (
                    <FunnelBar key={step.key} step={step} peakAtStage={peakAtStage} />
                  ))}
                </div>
                <p className="mt-2.5 text-[10.5px] text-gray-400">
                  Bold number = leads currently <b>at</b> that stage — the same figure as the list&apos;s stage
                  chips. Faint bar = leads that <b>reached</b> the stage or further (of all {fmtNum(s.totalLeads)}).
                  Rejected leads are shown only under Outcomes (a snapshot can&apos;t say which stage they reached).
                </p>
              </div>

              {/* Outcomes */}
              {data.outcomes?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-3 shadow-sm">
                  <h3 className="text-[13px] font-bold text-gray-800 mb-2.5">Outcomes</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.outcomes.map((o) => (
                      <div
                        key={o.key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${o.tone === 'green' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
                      >
                        <span className={`text-[12px] font-semibold ${o.tone === 'green' ? 'text-emerald-700' : 'text-rose-700'}`}>{o.label}</span>
                        <span className="text-[13px] font-extrabold text-gray-800 tabular-nums">{fmtNum(o.leads)}</span>
                        <span className="text-[11px] text-gray-500">({fmtPct(o.pctOfTop)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other / unclassified events */}
              {data.other?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                  <h3 className="text-[12px] font-bold text-gray-500 mb-2">Other events</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.other.map((o) => (
                      <span key={o.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                        {o.key} <span className="font-bold text-gray-800">{fmtNum(o.leads)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpSwingFunnelModal;
