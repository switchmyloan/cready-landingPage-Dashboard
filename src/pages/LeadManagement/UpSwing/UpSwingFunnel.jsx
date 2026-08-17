import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { Filter, Download, Users, CheckCircle2, XCircle, TrendingDown, Calendar, BookOpen, X, ArrowRight, Megaphone, ChevronLeft, Phone } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import PremiumLoader from '../../../components/PremiumLoader';
import { getUpSwingFunnelHistory, getUpSwingFunnelHistoryByEvent, getUpSwingFunnelStageStatus, getUpSwingFunnelStageLeads, getUpSwingFunnelEventDayLeads } from '../../../api-services/Modules/UpSwingWebhook';

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

// Generic CSV download from a 2D array of rows (first row = header).
const downloadCsv = (rows, filename) => {
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
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

// Official L&T journey order (same as backend HISTORY_ORDER) — shown in the docs.
const DOCS_JOURNEY = [
  'Redirected', 'OTP Login', 'Journey Created', 'PAN Verified', 'Pre-BRE Offer', 'Lender Selected',
  'Bank Offer Available', 'Offer Selected', 'Aadhaar Verified',
  'Demographics (Post-Offer)', 'eNACH Initiated', 'eNACH Success', 'VKYC Initiated',
  'VKYC Success', 'E-Sign Success', 'Loan Disbursed',
];
// The worked example — one lead currently at LOAN_REJECTED, and the stages it passed.
const DOCS_EXAMPLE = ['OTP Login', 'Journey Created', 'PAN Verified', 'Pre-BRE', 'Lender Selected', 'Loan Rejected'];

// Step-to-step conversion ratios shown above the matrix. Each = to.total / from.total,
// keyed on the funnel stage keys (Redirected = Launch Initiated, OTP Verified = OTP
// Login). Computed from the grand-stage totals, so they honour the active date filter.
const RATIO_STEPS = [
  { from: 'REDIRECTED', to: 'MOTP_LOGIN_SUCCESS', label: 'Redirected → OTP Verified' },
  { from: 'MOTP_LOGIN_SUCCESS', to: 'FSI_SELECTED', label: 'OTP Verified → Lender Selected' },
  { from: 'FSI_SELECTED', to: 'BANK_OFFER_AVAILABLE', label: 'Lender Selected → Bank Offer Available' },
  { from: 'BANK_OFFER_AVAILABLE', to: 'OFFER_SELECTED', label: 'Bank Offer Available → Offer Selected' },
  { from: 'OFFER_SELECTED', to: 'LOAN_DISBURSED', label: 'Offer Selected → Disbursed' },
];
// stageKey that the ratio lands ON → the stage it converts FROM. Lets the grand-total
// row print a small conversion % under each of those stage columns.
const RATIO_BY_TO = Object.fromEntries(RATIO_STEPS.map((r) => [r.to, { from: r.from, label: r.label }]));

const DocsSection = ({ n, title, children }) => (
  <div className="mb-5">
    <h3 className="flex items-center gap-2 text-[14px] font-bold text-gray-800 mb-2">
      <span className="grid place-items-center w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold shrink-0">{n}</span>
      {title}
    </h3>
    <div className="text-[13px] text-gray-600 leading-relaxed space-y-2 pl-7">{children}</div>
  </div>
);

const Mono = ({ children }) => (
  <span className="font-mono text-[11.5px] bg-gray-100 text-gray-700 px-1 py-0.5 rounded">{children}</span>
);

// Documentation modal — explains how the funnel numbers are computed so the data team
// can trust/verify the figures. Pure static content (no data fetch).
const FunnelDocsModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow"><BookOpen size={18} /></div>
          <div>
            <h2 className="text-[15px] font-extrabold text-gray-900 leading-tight">How the UpSwing Funnel works</h2>
            <p className="text-[11.5px] text-gray-500">Data logic — how each number is computed</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition" aria-label="Close"><X size={18} /></button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto px-5 py-4">
        <DocsSection n="1" title="Two different views — List vs Funnel">
          <p>This Funnel and the UpSwing <b>List</b> page answer <b>two different questions</b> and will <b>not</b> match — not even the Total. The Funnel counts <b>every</b> lead in the full event log (incl. people who only opened the link); the List shows only the smaller current-snapshot table.</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold w-1/4"> </th>
                  <th className="text-left px-3 py-2 font-semibold">List page</th>
                  <th className="text-left px-3 py-2 font-semibold">This Funnel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="px-3 py-2 font-semibold text-gray-700">Shows</td><td className="px-3 py-2">Current stage (latest event)</td><td className="px-3 py-2">Every stage a lead <b>ever</b> reached</td></tr>
                <tr><td className="px-3 py-2 font-semibold text-gray-700">Source</td><td className="px-3 py-2"><Mono>pci_latest_event</Mono><br /><span className="text-gray-400 text-[11px]">1 row / lead, current snapshot</span></td><td className="px-3 py-2"><Mono>webhook_events</Mono><br /><span className="text-gray-400 text-[11px]">full history, every lead</span></td></tr>
                <tr><td className="px-3 py-2 font-semibold text-gray-700">Bucketed by</td><td className="px-3 py-2">Snapshot date</td><td className="px-3 py-2">Day the lead <b>first arrived</b></td></tr>
                <tr><td className="px-3 py-2 font-semibold text-gray-700">A lead appears in</td><td className="px-3 py-2">Only 1 stage</td><td className="px-3 py-2">Every stage it passed</td></tr>
                <tr><td className="px-3 py-2 font-semibold text-gray-700">Answers</td><td className="px-3 py-2">“Where is each lead <b>now</b>”</td><td className="px-3 py-2">“How <b>far</b> did leads get / drop-off”</td></tr>
              </tbody>
            </table>
          </div>
        </DocsSection>

        <DocsSection n="2" title="Where the data comes from">
          <p>The journey (OTP Login onward) comes from ClickHouse <Mono>upswing.webhook_events</Mono> — L&amp;T's append-only event diary. Universe = leads that reached <b>OTP</b> (real journey leads). Each is placed on the day it <b>first arrived</b> (earliest <Mono>received_at</Mono>, IST), so its whole journey counts on day one.</p>
          <p>The <b>Redirected</b> entry column is NOT a webhook figure — L&amp;T's launch webhook stopped arriving after 24 Jul, so it's taken from Cready's own <Mono>selectedLenders</Mono> (rows where <Mono>lenderName = 'LnT'</Mono> = the customer clicked L&amp;T on the Cready dashboard), counted per IST day. Because it's the pre-journey click count, <b>Redirected can exceed the Total</b> (Total = leads that actually OTP'd).</p>
        </DocsSection>

        <DocsSection n="3" title="How each cell is computed (the “reached” rule)">
          <p>Each cell = <b>distinct leads (pci)</b> that <b>first arrived</b> that day and <b>reached</b> that stage.</p>
          <p><b>“Reached”</b> = fired that stage’s event <b>OR any later</b> journey event (the furthest-stage rule). This keeps the funnel <b>monotonic</b>: if an intermediate event is missing — e.g. the PAN event wasn’t emitted but Pre-BRE was — the lead is still counted as having reached PAN (because reaching Pre-BRE means PAN was passed).</p>
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-amber-800 text-[12px]">
            <b>So:</b> one lead adds +1 to <b>every column it passed through</b>. The big drop from <b>Redirected</b> to <b>OTP Login</b> is people who were sent to L&amp;T but never logged in. Numbers thin out further as leads drop off.
          </div>
        </DocsSection>

        <DocsSection n="4" title="Worked example — one rejected lead">
          <p>In the List this lead shows only <span className="inline-flex px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[11px] font-bold">LOAN_REJECTED</span>. But its full event history is:</p>
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            {DOCS_EXAMPLE.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex px-2 py-1 rounded-md text-[11px] font-semibold ${i === DOCS_EXAMPLE.length - 1 ? 'bg-rose-100 text-rose-700' : 'bg-purple-50 text-purple-700'}`}>{s}</span>
                {i < DOCS_EXAMPLE.length - 1 && <ArrowRight size={12} className="text-gray-300" />}
              </span>
            ))}
          </div>
          <p>So this <b>one</b> lead counts in <b>{DOCS_EXAMPLE.length} columns</b>. That’s why (e.g.) 77 rejected leads together fill the early columns up to ~the day’s total — each rejected lead still passed OTP → Journey → PAN → Pre-BRE first.</p>
        </DocsSection>

        <DocsSection n="5" title="Journey order (official L&T spec)">
          <p>Columns follow L&amp;T’s official event order (with the Cready link-open as the entry):</p>
          <div className="flex flex-wrap gap-1">
            {DOCS_JOURNEY.map((s, i) => (
              <span key={s} className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${i === DOCS_JOURNEY.length - 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}. {s}</span>
            ))}
          </div>
          <p className="text-[12px]"><b>Note:</b> <b>Redirected</b> (Cready <Mono>selectedLenders</Mono> LnT click) is the entry / top — from Postgres, not the webhook. <b>Lender Selected</b> (FSI — “lead gets created in L&amp;T”) fires right after Pre-BRE and <b>before</b> the Bank Offer. Offer-viewed / dashboard-viewed and the NSTP field-investigation branch are not journey steps, so they’re excluded.</p>
        </DocsSection>

        <DocsSection n="6" title="Outcomes (rejected / cancelled)">
          <p>Loan Rejected, Journey Failed, Journey Cancelled and Loan Expired are <b>terminal</b> — not a step everyone passes through. They’re counted <b>raw</b> (leads that ended that way) and shown in <span className="text-rose-600 font-semibold">red</span>, separate from the progression.</p>
        </DocsSection>

        <DocsSection n="7" title="Totals & KPIs">
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Total Leads</b> = distinct pci in the event log (= Launch Initiated). Does <b>not</b> match the List total — the List is a smaller current-snapshot table.</li>
            <li><b>Disbursed</b> = leads that reached Loan Disbursed.</li>
            <li><b>Rejected</b> = raw rejected + cancelled + failed + expired.</li>
            <li><b>In Progress</b> = Total − Disbursed − Rejected. Note: this includes leads that only opened the link and never logged in (not yet rejected), so it over-states “active”.</li>
          </ul>
        </DocsSection>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
        <p className="text-[11px] text-gray-400">Source: ClickHouse <Mono>upswing.webhook_events</Mono> · read-only</p>
        <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-[12.5px] font-bold hover:bg-purple-700 transition">Got it</button>
      </div>
    </div>
  </div>
);

const UpSwingFunnel = () => {
  const [range, setRange] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [medium, setMedium] = useState(''); // utm_medium filter (from upswing.leads)
  // View mode: 'arrival' = each lead on its FIRST-arrival day, cumulative (the
  // original). 'event' = each event counted on the day it HAPPENED (today's OTP
  // logins / disbursals). Toggling just swaps which endpoint we call.
  const [viewMode, setViewMode] = useState('arrival');
  // Stage drill-down: click a stage → where are the leads who reached it NOW?
  const [drill, setDrill] = useState(null);        // { key, label } of the open stage
  const [drillData, setDrillData] = useState(null); // { reached, statuses:[...] }
  const [drillLoading, setDrillLoading] = useState(false);
  // Second-level drill: the actual leads behind ONE status (e.g. WHO is rejected).
  const [statusLeads, setStatusLeads] = useState(null);       // { status, label, tone, count, leads:[...]|null }
  const [statusLeadsLoading, setStatusLeadsLoading] = useState(false);

  // Resolve the active range + medium → API params. Custom range wins when both dates set.
  const params = useMemo(() => {
    const base = medium ? { medium } : {};
    if (range === 'custom' && fromDate && toDate) return { ...base, fromDate, toDate };
    if (range === 'today' || range === 'yesterday') return { ...base, type: range };
    return base;
  }, [range, fromDate, toDate, medium]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fn = viewMode === 'event' ? getUpSwingFunnelHistoryByEvent : getUpSwingFunnelHistory;
      const res = await fn(params);
      if (res?.data?.success) setData(res.data.data);
      else ToastNotification.error('Failed to load funnel');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load funnel');
    } finally {
      setLoading(false);
    }
  }, [params, viewMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Only journey progression stages are drillable — "Redirected" (a Cready count)
  // and the red terminal outcomes have no "where are they now" breakdown.
  // Drill-down ("where are they now?") only makes sense for the first-arrival funnel
  // — the event-day view counts per event, not per reached-stage — so it's disabled there.
  const isDrillable = useCallback((st) => !!st && !data?.byEvent && st.key !== 'REDIRECTED' && st.tone !== 'red', [data]);

  // Event-day matrix cells are drillable too, but into a DIRECT leads list (who
  // fired this event that day) — not a "where are they now" breakdown. Everything
  // except the Cready "Redirected" count (phone-keyed, not a webhook event);
  // red outcomes ARE included here (clicking "Loan Rejected · 22" is exactly the point).
  const isEventDrillable = useCallback((st) => !!st && !!data?.byEvent && st.key !== 'REDIRECTED', [data]);

  const openDrill = useCallback(async (st, day = null) => {
    if (!isDrillable(st)) return;
    setDrill({ key: st.key, label: st.label, day });
    setDrillData(null);
    setStatusLeads(null);   // start on the breakdown view, not a stale leads sub-view
    setDrillLoading(true);
    try {
      const res = await getUpSwingFunnelStageStatus({ stage: st.key, ...params, day });
      if (res?.data?.success) setDrillData(res.data.data);
      else ToastNotification.error('Failed to load stage breakdown');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load stage breakdown');
    } finally {
      setDrillLoading(false);
    }
  }, [params, isDrillable]);

  // Second-level drill: fetch the actual leads (pci + phone) at ONE status of the
  // open stage's breakdown — "who is currently <status>".
  const openStatusLeads = useCallback(async (x) => {
    if (!drill) return;
    setStatusLeads({ status: x.key, label: x.label, tone: x.tone, count: x.leads, leads: null });
    setStatusLeadsLoading(true);
    try {
      const res = await getUpSwingFunnelStageLeads({ stage: drill.key, status: x.key, ...params, day: drill.day || undefined });
      if (res?.data?.success) {
        setStatusLeads((prev) => (prev && prev.status === x.key ? { ...prev, leads: res.data.data.leads || [], count: res.data.data.count } : prev));
      } else ToastNotification.error('Failed to load leads');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load leads');
    } finally {
      setStatusLeadsLoading(false);
    }
  }, [drill, params]);

  // Event-day drill: leads (pci + phone) who fired THIS event on THIS day (or across
  // the whole range when day is null). Goes straight to the modal's leads sub-view —
  // there's no reached-stage breakdown for an event-day count. Reuses statusLeads,
  // flagged byEvent so the modal shows event-day wording and no "back to breakdown".
  const openEventDayLeads = useCallback(async (st, day = null) => {
    if (!isEventDrillable(st)) return;
    setDrill({ key: st.key, label: st.label, day: day || null, byEvent: true });
    setDrillData(null);
    setStatusLeads({ status: st.key, label: st.label, tone: st.tone, count: null, leads: null, byEvent: true });
    setStatusLeadsLoading(true);
    try {
      const res = await getUpSwingFunnelEventDayLeads({ event: st.key, ...params, day: day || undefined });
      if (res?.data?.success) {
        const d = res.data.data || {};
        setStatusLeads((prev) => (prev && prev.status === st.key ? { ...prev, leads: d.leads || [], count: d.count || 0 } : prev));
      } else ToastNotification.error('Failed to load leads');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load leads');
    } finally {
      setStatusLeadsLoading(false);
    }
  }, [params, isEventDrillable]);

  // Export the drill modal as CSV. In the one-status sub-view → just those leads. In
  // the breakdown view → the ACTUAL leads behind EVERY status (the users inside), one
  // row per lead with its status — fetched fresh (no status = all) so the caller gets
  // every underlying phone, not just the status counts.
  const [exporting, setExporting] = useState(false);
  const exportDrill = useCallback(async () => {
    if (!drill) return;
    const slug = (x) => String(x || '').replace(/[^a-zA-Z0-9]+/g, '_');
    if (statusLeads && Array.isArray(statusLeads.leads)) {
      const rows = [['Phone', 'PCI', 'Status', 'When'], ...statusLeads.leads.map((l) => [l.phone || '', l.pci, statusLeads.label, l.at])];
      downloadCsv(rows, `upswing_${slug(drill.key)}_${slug(statusLeads.status)}_leads.csv`);
      return;
    }
    if (!drillData) return;
    try {
      setExporting(true);
      const res = await getUpSwingFunnelStageLeads({ stage: drill.key, ...params, day: drill.day || undefined });
      const leads = res?.data?.data?.leads || [];
      if (!leads.length) { ToastNotification.error('No leads to export'); return; }
      const labelOf = (k) => (drillData.statuses.find((s2) => s2.key === k)?.label) || k;
      const rows = [['Phone', 'PCI', 'Status', 'When'], ...leads.map((l) => [l.phone || '', l.pci, labelOf(l.status), l.at])];
      downloadCsv(rows, `upswing_${slug(drill.key)}_all_leads.csv`);
      if (leads.length >= 5000) ToastNotification.success('Exported first 5000 leads (cap reached).');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [drill, drillData, statusLeads, params]);

  const s = data?.summary || {};
  const total = Number(s.totalLeads) || 0;
  const inProgress = Math.max(total - (Number(s.disbursed) || 0) - (Number(s.rejected) || 0), 0);
  // Grand total per stage key → drives the conversion-ratio tiles.
  const stageTotal = Object.fromEntries((data?.stages || []).map((st) => [st.key, Number(st.total) || 0]));

  return (
    <>
      <Toaster />

      {showDocs && <FunnelDocsModal onClose={() => setShowDocs(false)} />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-5 py-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow">
            <TrendingDown size={22} />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">UpSwing Funnel</h1>
            <p className="text-[12px] text-gray-500">
              {viewMode === 'event'
                ? 'By event day — each event counted on the day it happened (today’s OTP logins, disbursals…).'
                : 'Journey history — each lead counted, on its create day, in every stage it reached.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDocs(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-purple-200 text-purple-700 text-sm font-bold shadow-sm hover:bg-purple-50 transition"
            title="How these numbers are computed"
          >
            <BookOpen size={15} /> Docs
          </button>
          <button
            onClick={() => data && exportCsv(data)}
            disabled={!data}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 transition"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* View toggle — first-arrival (create day) vs event day. Same filters, different anchor. */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Count by:</span>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => setViewMode('arrival')}
            className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition ${viewMode === 'arrival' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Create day
          </button>
          <button
            onClick={() => setViewMode('event')}
            className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition ${viewMode === 'event' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Event day
          </button>
        </div>
        <span className="text-[11px] text-gray-400">
          {viewMode === 'event'
            ? 'Each event on the day it happened — e.g. “how many disbursed today”.'
            : 'Each lead on its create/first-arrival day, in every stage it ever reached (cumulative).'}
        </span>
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
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
          <Megaphone size={13} /> Medium:
        </span>
        <select
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium outline-none focus:border-purple-400 capitalize"
        >
          <option value="">All</option>
          {(data?.mediums || []).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

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
              <h3 className="text-[14px] font-bold text-gray-800">
                {data?.byEvent
                  ? 'Event activity — events that happened on each day'
                  : 'Journey History — leads reaching each stage, by create day'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-50 text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 min-w-[120px]">Date</th>
                    <th className="sticky left-[120px] z-20 bg-gray-100 text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 min-w-[70px]">Total</th>
                    {data.stages.map((st) => {
                      const drillable = data?.byEvent ? isEventDrillable(st) : isDrillable(st);
                      return (
                        <th
                          key={st.key}
                          title={drillable ? (data?.byEvent ? `${st.key} — click to see the leads for this event` : `${st.key} — click to see where these leads are now`) : st.key}
                          onClick={() => drillable && (data?.byEvent ? openEventDayLeads(st) : openDrill(st))}
                          className={`text-right px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide whitespace-nowrap ${st.tone === 'red' ? 'text-rose-600' : st.tone === 'green' ? 'text-emerald-600' : 'text-gray-500'} ${drillable ? 'cursor-pointer hover:text-purple-700 hover:underline underline-offset-2' : ''}`}
                        >
                          {st.label}
                        </th>
                      );
                    })}
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
                          // Per-row conversion % under the ratio-target stages (from this
                          // same row's previous key stage). Shown only where the cell has a value.
                          const step = data?.byEvent ? null : RATIO_BY_TO[st.key];
                          const fromV = step ? (row.byStage[step.from] || 0) : 0;
                          const pct = step && v > 0 && fromV > 0 ? (v / fromV) * 100 : null;
                          // Click a non-zero cell → create-day: that day's leads at this
                          // stage now; event-day: the leads who fired this event that day.
                          const cellDrillable = (data?.byEvent ? isEventDrillable(st) : isDrillable(st)) && v > 0;
                          return (
                            <td key={st.key} className={`px-3 py-2 text-right text-[12.5px] tabular-nums ${v ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
                              {cellDrillable ? (
                                <button
                                  type="button"
                                  onClick={() => (data?.byEvent ? openEventDayLeads(st, row.date) : openDrill(st, row.date))}
                                  title={data?.byEvent ? `${st.label} · ${fmtDate(row.date)} — see the leads` : `${st.label} · ${fmtDate(row.date)} — where are these leads now?`}
                                  className="tabular-nums cursor-pointer hover:text-purple-700 hover:underline underline-offset-2"
                                >
                                  {fmtNum(v)}
                                </button>
                              ) : (v ? fmtNum(v) : '—')}
                              {pct != null && (
                                <span className="block text-[9px] font-semibold text-purple-500 leading-tight" title={`${step.label} conversion`}>
                                  {pct.toFixed(1)}%
                                </span>
                              )}
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
                    {data.stages.map((st) => {
                      // Small conversion % under the stages that are a ratio target
                      // (into = st.total, from = the previous key stage's grand total).
                      const step = data?.byEvent ? null : RATIO_BY_TO[st.key];
                      const fromTotal = step ? (stageTotal[step.from] || 0) : 0;
                      const pct = step && fromTotal > 0 ? (st.total / fromTotal) * 100 : null;
                      const drillable = data?.byEvent ? isEventDrillable(st) : isDrillable(st);
                      return (
                        <td key={st.key} className="px-3 py-2.5 text-right text-[12.5px] font-bold text-gray-800 tabular-nums">
                          {drillable ? (
                            <button
                              type="button"
                              onClick={() => (data?.byEvent ? openEventDayLeads(st) : openDrill(st))}
                              title={data?.byEvent ? 'See the leads for this event' : 'Where are these leads now?'}
                              className="tabular-nums cursor-pointer hover:text-purple-700 hover:underline underline-offset-2"
                            >
                              {fmtNum(st.total)}
                            </button>
                          ) : fmtNum(st.total)}
                          {pct != null && (
                            <span className="block text-[9.5px] font-bold text-purple-600 leading-tight" title={`${step.label} conversion`}>
                              {pct.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
              {data?.byEvent ? (
                <>
                  Rows = the day an <b>event happened</b> (IST). Each cell = <b>distinct leads</b> that fired that event <b>that day</b>
                  (e.g. how many disbursed / OTP-logged that day) — NOT cumulative, a lead appears under each day it acted.
                  A column grand total is distinct leads that fired it anywhere in range (so it can be less than the sum of the days).
                  <b>Redirected</b> = Cready L&amp;T clicks per day. Scroll right for all {data.stages.length} stages.
                </>
              ) : (
                <>
                  Rows = the day each lead <b>first arrived / was created</b> (min event time); columns = journey stages. Each webhook
                  cell = distinct leads that first arrived that day and <b>ever reached</b> that stage. <b>Redirected</b> = Cready
                  L&amp;T clicks (Postgres <code>selectedLenders</code>) — the pre-journey entry, so it can exceed the Total (= leads
                  that OTP’d). Scroll right for all {data.stages.length} stages. Bottom row = grand totals; the small{' '}
                  <span className="text-purple-600 font-semibold">purple %</span> under a stage = conversion into it from the
                  previous key step (Redirected→OTP→Lender→Bank Offer→Offer→Disbursed).{' '}
                  <b className="text-purple-700">Click any stage</b> (its header or grand total) to see where those leads are <b>now</b>.
                </>
              )}
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
          'Journey (OTP onward): ClickHouse upswing.webhook_events — leads that reached OTP, bucketed by first-arrival day (IST).',
          'Redirected entry: Cready Postgres selectedLenders (lenderName = LnT) — the launch webhook stopped after 24 Jul, so this is the reliable redirect count.',
          'Redirected can exceed the Total (Total = leads that OTP’d). Different from the UpSwing list — totals will not match.',
        ]}
        flow={[
          'UpSwing sends webhooks',
          'Events appended to webhook_events',
          'Count distinct leads per stage (ever reached)',
          'Order along the journey',
          'Cumulative funnel + drop-off',
        ]}
      />

      {/* Stage drill-down — click any journey stage to see the CURRENT status of the
          leads who reached it (where they actually are now, not the furthest they got). */}
      {drill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => { setDrill(null); setStatusLeads(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header — breakdown title, or (in the leads sub-view) a back arrow + status title */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-violet-50">
              <div className="flex items-start gap-2 min-w-0">
                {statusLeads && !statusLeads.byEvent && (
                  <button onClick={() => setStatusLeads(null)} className="mt-0.5 p-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-white/70 transition shrink-0" title="Back"><ChevronLeft size={16} /></button>
                )}
                <div className="min-w-0">
                  {statusLeads ? (
                    statusLeads.byEvent ? (
                      <>
                        <h3 className="text-[15px] font-bold text-gray-800 truncate">{statusLeads.label}{drill.day ? <span className="font-semibold text-[13px] text-purple-600"> · {fmtDate(drill.day)}</span> : ''}</h3>
                        <p className="text-[11.5px] text-gray-500 mt-0.5">
                          Leads who fired <b>{statusLeads.label}</b>{drill.day ? <> on <b>{fmtDate(drill.day)}</b></> : <> in this range</>}
                          {statusLeads.count != null ? <> · <span className="font-semibold text-purple-700">{fmtNum(statusLeads.count)}</span></> : ''}
                        </p>
                      </>
                    ) : (
                    <>
                      <h3 className="text-[15px] font-bold text-gray-800 truncate">{drill.label} → {statusLeads.label}</h3>
                      <p className="text-[11.5px] text-gray-500 mt-0.5">
                        Leads currently at <b>{statusLeads.label}</b> · <span className="font-semibold text-purple-700">{fmtNum(statusLeads.count)}</span>
                        {drill.day ? <> · {fmtDate(drill.day)}</> : ''}
                      </p>
                    </>
                    )
                  ) : (
                    <>
                      <h3 className="text-[15px] font-bold text-gray-800">
                        {drill.label} — where are they now?
                        {drill.day ? <span className="font-semibold text-[13px] text-purple-600"> · {fmtDate(drill.day)}</span> : ''}
                      </h3>
                      <p className="text-[11.5px] text-gray-500 mt-0.5">
                        Current status of leads who reached <b>{drill.label}</b>
                        {drill.day ? <> and <b>first arrived on {fmtDate(drill.day)}</b></> : ''}
                        {drillData ? <> · <span className="font-semibold text-purple-700">{fmtNum(drillData.reached)} reached</span></> : ''}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={exportDrill}
                  disabled={exporting || (statusLeads ? !(statusLeads.leads && statusLeads.leads.length) : !(drillData && drillData.statuses && drillData.statuses.length))}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-purple-700 hover:bg-white/70 disabled:opacity-40 transition text-[12px] font-semibold"
                  title={statusLeads ? 'Export these leads as CSV' : 'Export every lead behind this stage as CSV'}
                >
                  <Download size={14} /> {exporting ? 'Exporting…' : 'Export'}
                </button>
                <button onClick={() => { setDrill(null); setStatusLeads(null); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition" aria-label="Close"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {statusLeads ? (
                // ── Leads sub-view: who is at this status ──
                (statusLeadsLoading || statusLeads.leads === null) ? (
                  <div className="py-10 text-center text-[13px] text-gray-400">Loading…</div>
                ) : statusLeads.leads.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-gray-400">No leads.</div>
                ) : (
                  <div className="flex flex-col divide-y divide-gray-100">
                    {statusLeads.leads.map((l) => (
                      <div key={l.pci} className="flex items-center justify-between py-2 gap-3">
                        <div className="min-w-0">
                          {l.phone ? (
                            <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-mono font-bold text-[13px] text-gray-800 hover:text-purple-700 hover:underline" title="Call">
                              <Phone size={11} className="text-indigo-500" /> {l.phone}
                            </a>
                          ) : <span className="text-[12px] text-gray-400">no phone</span>}
                          <div className="text-[10.5px] text-gray-400 font-mono truncate max-w-[240px]" title={l.pci}>{l.pci}</div>
                        </div>
                        <span className="text-[11px] text-gray-500 shrink-0 whitespace-nowrap">{l.at}</span>
                      </div>
                    ))}
                    {statusLeads.count > statusLeads.leads.length && (
                      <div className="py-2 text-[11px] text-gray-400 text-center">Showing first {fmtNum(statusLeads.leads.length)} of {fmtNum(statusLeads.count)}</div>
                    )}
                  </div>
                )
              ) : drillLoading ? (
                <div className="py-10 text-center text-[13px] text-gray-400">Loading…</div>
              ) : !drillData || (drillData.statuses || []).length === 0 ? (
                <div className="py-10 text-center text-[13px] text-gray-400">No data for this stage.</div>
              ) : (
                // ── Breakdown: status rows are clickable → the leads sub-view ──
                <div className="space-y-2.5">
                  {drillData.statuses.map((x) => {
                    const barColor = x.tone === 'green' ? 'bg-emerald-500' : x.tone === 'red' ? 'bg-rose-500' : 'bg-purple-400';
                    const textColor = x.tone === 'green' ? 'text-emerald-700' : x.tone === 'red' ? 'text-rose-700' : 'text-gray-700';
                    return (
                      <button key={x.key} type="button" onClick={() => openStatusLeads(x)} className="w-full text-left group" title={`See who is ${x.label}`}>
                        <div className="flex items-center justify-between text-[12.5px] mb-0.5">
                          <span className={`font-semibold ${textColor} group-hover:underline`} title={x.key}>{x.label}</span>
                          <span className="tabular-nums text-gray-500"><span className="font-bold text-gray-800">{fmtNum(x.leads)}</span> · {x.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(Number(x.pct) || 0, 2)}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              {statusLeads ? (
                statusLeads.byEvent ? (
                  <p className="text-[11px] text-gray-500 leading-relaxed">Tap a phone to call. These leads fired <b>{statusLeads.label}</b>{drill.day ? <> on <b>{fmtDate(drill.day)}</b></> : <> in this range</>} (distinct per lead — latest firing shown).</p>
                ) : (
                  <p className="text-[11px] text-gray-500 leading-relaxed">Tap a phone to call. These leads reached <b>{drill.label}</b> and are currently at <b>{statusLeads.label}</b>.</p>
                )
              ) : (
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  <b>Reached</b> = leads whose furthest journey stage is <b>{drill.label}</b> or later.{' '}
                  <b>Current status</b> = the latest event per lead — where they <i>actually</i> are now,
                  not the furthest they got. A later OTP-login re-visit is skipped, so the lead is shown
                  under the real stage it was last at (offer → OTP → shown under Offer).{' '}
                  <span className="text-purple-600 font-semibold">Click a status</span> to see who's in it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UpSwingFunnel;
