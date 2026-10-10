import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Users, Clock, CheckCircle2, XCircle, Phone, Eye } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { getPflLeads } from '../../../api-services/Modules/PflLeads';

const DEFAULT_LIMIT = 10;
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

// PFL journey order — used to sort the stage chips / KPI grid meaningfully.
const STAGE_ORDER = [
  'Journey Started', 'PAN Verified', 'User Qualified', 'AA Initiated', 'AA Completed',
  'OFFER', 'KYC Initiated', 'KYC Verified', 'Penny Drop Completed', 'E-sign Completed',
  'Loan Disbursed', 'Rejected', 'User Disqualified',
];
const stageRank = (s) => {
  const i = STAGE_ORDER.findIndex((x) => x.toLowerCase() === String(s || '').toLowerCase());
  return i >= 0 ? i : STAGE_ORDER.length - 1;
};
const toneForStatus = (s) => {
  const t = String(s || '').toLowerCase();
  if (/disburs|success|complete|verified/.test(t)) return 'green';
  if (/reject|disqualif|declin|fail|cancel|expire/.test(t)) return 'red';
  if (/pan|aa |offer|kyc|penny|e-sign|esign|initiat|pending|await/.test(t)) return 'amber';
  return 'gray';
};
const isReject = (s) => /reject|disqualif|declin|cancel|expire|fail/i.test(String(s || ''));

// ── URL-persisted filters (survive reload + Back from the detail page) ──
const readQuery = (sp) => ({
  page_no: Math.max(parseInt(sp.get('page'), 10) || 1, 1),
  limit: Math.max(parseInt(sp.get('size'), 10) || DEFAULT_LIMIT, 1),
  search: sp.get('q') || '',
  type: sp.get('type') || '',
  startDate: sp.get('from') || null,
  endDate: sp.get('to') || null,
  status: sp.get('status') || '',
});
const writeQuery = (sp, q) => {
  const put = (k, v, isDefault) => { if (isDefault) sp.delete(k); else sp.set(k, String(v)); };
  put('page', q.page_no, !q.page_no || q.page_no === 1);
  put('size', q.limit, !q.limit || q.limit === DEFAULT_LIMIT);
  put('q', q.search, !q.search);
  put('type', q.type, !q.type);
  put('from', q.startDate, !q.startDate);
  put('to', q.endDate, !q.endDate);
  put('status', q.status, !q.status);
  return sp;
};
const useUrlQuery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const setRef = useRef(setSearchParams);
  setRef.current = setSearchParams;
  const search = searchParams.toString();
  const query = useMemo(() => readQuery(new URLSearchParams(search)), [search]);
  const latest = useRef(query);
  latest.current = query;
  const setQuery = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(latest.current) : updater;
    latest.current = next;
    setRef.current((prev) => writeQuery(new URLSearchParams(prev), next), { replace: true });
  }, []);
  return [query, setQuery];
};

// ── CSV export (paged — backend caps perPage at 200) ──
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename, cols, rows) => {
  const head = cols.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((r) => cols.map((c) => csvEscape(c.value(r))).join(',')).join('\n');
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};
const fetchAllLeads = async (baseParams) => {
  const PAGE = 200;
  const rows = [];
  for (let page = 1; page <= 200; page += 1) {
    const res = await getPflLeads({ ...baseParams, perPage: PAGE, currentPage: page });
    const chunk = res?.data?.data?.data || [];
    rows.push(...chunk);
    const total = res?.data?.data?.pagination?.total ?? rows.length;
    if (chunk.length < PAGE || rows.length >= total) break;
  }
  return rows;
};

const KPI_TONES = {
  purple: 'border-purple-100 bg-purple-50/70 text-purple-600',
  amber: 'border-amber-100 bg-amber-50/70 text-amber-600',
  green: 'border-emerald-100 bg-emerald-50/70 text-emerald-600',
  rose: 'border-rose-100 bg-rose-50/70 text-rose-600',
};
const Kpi = ({ icon, label, value, sub, tone }) => (
  <div className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 shadow-sm ${KPI_TONES[tone]}`}>
    <div className="flex items-center gap-1.5 mb-1 opacity-80">{icon}<span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span></div>
    <p className="text-[24px] leading-none font-extrabold text-gray-900">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

const CHIP_TONES = {
  gray: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
  green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
};
const StageChip = ({ label, count, active, onClick, tone = 'gray' }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold transition ${CHIP_TONES[tone] || CHIP_TONES.gray} ${active ? 'ring-2 ring-purple-400 ring-offset-1' : ''}`}
  >
    <span>{label}</span>
    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/70 text-[10px] font-bold">{fmtNum(count)}</span>
  </button>
);

const statusBadge = (s) => {
  const tone = toneForStatus(s);
  const cls = { green: 'bg-emerald-50 text-emerald-700', red: 'bg-rose-50 text-rose-700', amber: 'bg-amber-50 text-amber-700', gray: 'bg-gray-100 text-gray-600' }[tone];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{s || '—'}</span>;
};

const PflLeads = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, byStatus: [] });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useUrlQuery();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPflLeads({
        search: query.search,
        perPage: query.limit,
        currentPage: query.page_no,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (res?.data?.success) {
        setRows(res.data.data?.data || []);
        setTotal(res.data.data?.pagination?.total || 0);
        setSummary(res.data.data?.summary || { total: 0, byStatus: [] });
      } else ToastNotification.error('Failed to fetch PFL leads');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch PFL leads');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onPageChange = useCallback((p) => setQuery((prev) => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize })), [setQuery]);
  const onSearch = useCallback((term) => setQuery((prev) => ({ ...prev, search: term, page_no: 1 })), [setQuery]);
  const onFilterByDate = useCallback((type) => setQuery((prev) => ({ ...prev, type: prev.type === type ? '' : type, startDate: null, endDate: null, page_no: 1 })), [setQuery]);
  const onFilterByRange = useCallback((range) => setQuery((prev) => ({ ...prev, startDate: range.startDate, endDate: range.endDate, type: '', page_no: 1 })), [setQuery]);
  const toggleStatus = useCallback((s) => setQuery((prev) => ({ ...prev, status: prev.status === s ? '' : s, page_no: 1 })), [setQuery]);

  const handleEdit = useCallback((row) => navigate(`/pfl-leads/${encodeURIComponent(row.mrn)}`), [navigate]);

  // KPI roll-up from the stage breakdown (counts only — PFL has no amounts).
  const kpis = useMemo(() => {
    const by = summary.byStatus || [];
    const t = summary.total || 0;
    const disbursed = by.filter((s) => /disburs/i.test(s.status)).reduce((a, s) => a + s.count, 0);
    const rejected = by.filter((s) => isReject(s.status)).reduce((a, s) => a + s.count, 0);
    return { total: t, disbursed, rejected, inProgress: Math.max(t - disbursed - rejected, 0) };
  }, [summary]);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const all = await fetchAllLeads({
        search: query.search, type: query.type || undefined,
        fromDate: query.startDate || undefined, toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (!all.length) { ToastNotification.error('No rows to export'); return; }
      downloadCsv(`pfl_leads_${Date.now()}.csv`, [
        { header: 'MRN', value: (r) => r.mrn },
        { header: 'Name', value: (r) => r.name },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'PAN', value: (r) => r.pan },
        { header: 'Email', value: (r) => r.email },
        { header: 'Application No', value: (r) => r.dp },
        { header: 'Reference', value: (r) => r.ref },
        { header: 'Stage', value: (r) => r.status },
        { header: 'Events', value: (r) => r.events },
        { header: 'Created At', value: (r) => r.createdAt },
        { header: 'Updated At', value: (r) => r.updatedAt },
      ], all);
      if (all.length >= 40000) ToastNotification.success('Exported first 40000 rows (cap).');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [query]);

  const columns = useMemo(() => [
    { header: 'SN', id: 'sn', enableSorting: false, maxSize: 50, cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return <span className="text-sm text-gray-500">{pageIndex * pageSize + row.index + 1}</span>;
    } },
    { header: 'MRN', accessorKey: 'mrn', cell: ({ getValue }) => <span className="font-mono text-sm font-semibold text-gray-800">{getValue() || '—'}</span> },
    { header: 'Name', accessorKey: 'name', cell: ({ getValue }) => (getValue() ? <span className="text-sm text-gray-800 capitalize">{String(getValue()).toLowerCase()}</span> : <span className="text-gray-400 italic">—</span>) },
    { header: 'Phone', accessorKey: 'phone', cell: ({ getValue }) => {
      const v = getValue();
      return v
        ? <a href={`tel:${v}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-gray-800 hover:text-purple-700 hover:underline"><Phone size={11} className="text-indigo-500" />{v}</a>
        : <span className="text-gray-400 italic">no phone</span>;
    } },
    { header: 'Application No', accessorKey: 'dp', cell: ({ getValue }) => <span className="font-mono text-[12px] text-gray-500 inline-block max-w-[150px] truncate align-middle" title={getValue()}>{getValue() || '—'}</span> },
    { header: 'Stage', accessorKey: 'status', cell: ({ getValue }) => statusBadge(getValue()) },
    { header: 'Updated At', accessorKey: 'updatedAt', cell: ({ getValue }) => <span className="text-sm text-gray-600">{getValue() || '—'}</span> },
    { header: 'Actions', id: 'actions-pfl', enableSorting: false, cell: ({ row }) => (
      <button onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition" title="View timeline"><Eye size={16} /></button>
    ) },
  ], [handleEdit]);

  const sortedStatuses = useMemo(() => [...(summary.byStatus || [])].sort((a, b) => stageRank(a.status) - stageRank(b.status)), [summary]);

  return (
    <>
      <Toaster />

      {/* KPIs — counts only (PFL has no amount data) */}
      <div className="flex flex-wrap gap-3 mb-3">
        <Kpi icon={<Users size={14} />} tone="purple" label="Total Leads" value={fmtNum(kpis.total)} sub="distinct MRN" />
        <Kpi icon={<Clock size={14} />} tone="amber" label="In Progress" value={fmtNum(kpis.inProgress)} sub={`${kpis.total ? ((kpis.inProgress / kpis.total) * 100).toFixed(1) : 0}% still moving`} />
        <Kpi icon={<CheckCircle2 size={14} />} tone="green" label="Disbursed" value={fmtNum(kpis.disbursed)} sub={`${kpis.total ? ((kpis.disbursed / kpis.total) * 100).toFixed(1) : 0}% of leads`} />
        <Kpi icon={<XCircle size={14} />} tone="rose" label="Rejected" value={fmtNum(kpis.rejected)} sub={`${kpis.total ? ((kpis.rejected / kpis.total) * 100).toFixed(1) : 0}% of leads`} />
      </div>

      {/* Stage chips */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-3 shadow-sm">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-0.5">Stages:</span>
        <StageChip label="All" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
        {sortedStatuses.map((s) => (
          <StageChip key={s.status} label={s.status || 'Unknown'} count={s.count} active={query.status === s.status} onClick={() => toggleStatus(s.status)} tone={toneForStatus(s.status)} />
        ))}
        {sortedStatuses.length === 0 && <span className="text-sm text-gray-400 italic">No leads yet</span>}
      </div>

      <MainTable
        columns={columns}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={exporting ? undefined : handleExport}
        title="PFL · LEADS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />

      <ModuleInfoCard
        title="PFL Leads (one row per MRN)"
        subtitle="Poonawalla Fincorp leads from the webhook journey — current stage + contact. Counts only (PFL sends no amounts)."
        whatYouSee={[
          'One row per MRN (person), its current stage (latest event), and contact (phone/name) resolved from the bureau PI.',
          'KPI tiles and stage chips are COUNTS — PFL has no eligible / disbursal amounts, so there is no ₹ view or Loans tab.',
          'Click the eye to see the full event timeline across all of that MRN’s applications.',
        ]}
        dataSource={[
          'ClickHouse webhook_data.pfl_webhook_events — grouped by MRN (derived from partner_reference_id, after the first ‘001’).',
          'Contact (phone/name/pan/email) by MRN from BRE_data_all.cibil_pi, with public.offerLeads as a phone fallback.',
        ]}
        flow={[
          'PFL sends webhooks',
          'Events stored in pfl_webhook_events',
          'Group by MRN → current stage',
          'Enrich contact by MRN (cibil_pi + offerLeads)',
          'Leads list + per-stage counts',
        ]}
      />
    </>
  );
};

export default PflLeads;
