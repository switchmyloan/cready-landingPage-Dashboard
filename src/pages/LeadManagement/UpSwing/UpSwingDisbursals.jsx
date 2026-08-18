import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { IndianRupee, TrendingUp, CheckCircle2, Phone } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { getUpSwingDisbursals } from '../../../api-services/Modules/UpSwingWebhook';

// Filters live in the URL query string so they survive reload + Back (mirrors the
// UpSwing Leads page). Writes use replace:true so tweaking a filter doesn't pile up
// history entries.
const DEFAULT_LIMIT = 10;

const readQuery = (sp) => ({
  page_no: Math.max(parseInt(sp.get('page'), 10) || 1, 1),
  limit: Math.max(parseInt(sp.get('size'), 10) || DEFAULT_LIMIT, 1),
  search: sp.get('q') || '',
  type: sp.get('type') || '',
  startDate: sp.get('from') || null,
  endDate: sp.get('to') || null,
});

const writeQuery = (sp, q) => {
  const put = (key, value, isDefault) => { if (isDefault) sp.delete(key); else sp.set(key, String(value)); };
  put('page', q.page_no, !q.page_no || q.page_no === 1);
  put('size', q.limit, !q.limit || q.limit === DEFAULT_LIMIT);
  put('q', q.search, !q.search);
  put('type', q.type, !q.type);
  put('from', q.startDate, !q.startDate);
  put('to', q.endDate, !q.endDate);
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
    setRef.current(writeQuery(new URLSearchParams(), next), { replace: true });
  }, []);
  return [query, setQuery];
};

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
const fmtDT = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Kpi = ({ icon: Icon, label, value, sub, tone }) => (
  <div className={`flex-1 min-w-[180px] rounded-xl border px-4 py-3 shadow-sm ${tone}`}>
    <div className="flex items-center gap-1.5 mb-1 opacity-80">
      <Icon size={14} />
      <span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-[24px] leading-none font-extrabold text-gray-900">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

// Table columns — pci (→ the shared UpSwing detail page), dialable phone, product,
// disbursed ₹ / tenure / interest, journey type, disbursal time (IST).
const disbursalColumns = ({ onOpen }) => [
  {
    header: 'PCI',
    accessorKey: 'pci',
    cell: ({ row, getValue }) => (
      <button
        type="button"
        onClick={() => onOpen(row.original)}
        className="font-mono text-[12px] text-purple-700 hover:underline truncate max-w-[180px] text-left"
        title="Open lead detail"
      >
        {getValue()}
      </button>
    ),
  },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a href={`tel:${v}`} className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700 transition">
          <Phone size={13} className="text-gray-400" /> {v}
        </a>
      );
    },
  },
  {
    header: 'Product',
    accessorKey: 'productVariant',
    cell: ({ getValue }) => getValue() || <span className="text-gray-400 italic">—</span>,
  },
  {
    header: 'Disbursed Amount',
    accessorKey: 'amount',
    cell: ({ getValue }) => {
      const v = getValue();
      return v == null ? <span className="text-gray-400 italic">—</span> : <span className="font-semibold text-emerald-700">{inr(v)}</span>;
    },
  },
  {
    header: 'Tenure',
    accessorKey: 'tenure',
    cell: ({ getValue }) => {
      const v = getValue();
      return v == null ? <span className="text-gray-400 italic">—</span> : <span>{v} mo</span>;
    },
  },
  {
    header: 'Interest',
    accessorKey: 'interest',
    cell: ({ getValue }) => {
      const v = getValue();
      return v == null ? <span className="text-gray-400 italic">—</span> : <span>{v}%</span>;
    },
  },
  {
    header: 'Journey',
    accessorKey: 'journeyType',
    cell: ({ getValue }) => getValue() || <span className="text-gray-400 italic">—</span>,
  },
  {
    header: 'Disbursed At',
    accessorKey: 'disbursedAt',
    cell: ({ getValue }) => <span className="text-[12.5px] text-gray-600 whitespace-nowrap">{fmtDT(getValue())}</span>,
  },
];

// ── CSV export helpers ──────────────────────────────────────────────────────
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
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
const fetchAllDisbursals = async (baseParams) => {
  const PAGE = 200;
  const rows = [];
  for (let page = 1; page <= 200; page += 1) {
    const res = await getUpSwingDisbursals({ ...baseParams, perPage: PAGE, currentPage: page });
    const chunk = res?.data?.data?.data || [];
    rows.push(...chunk);
    const total = res?.data?.data?.pagination?.total ?? rows.length;
    if (chunk.length < PAGE || rows.length >= total) break;
  }
  return rows;
};

const UpSwingDisbursals = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ count: 0, totalAmount: 0, avgTicket: 0 });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useUrlQuery();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUpSwingDisbursals({
        search: query.search,
        perPage: query.limit,
        currentPage: query.page_no,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
      });
      if (res?.data?.success) {
        setRows(res.data.data?.data || []);
        setTotal(res.data.data?.pagination?.total || 0);
        setSummary(res.data.data?.summary || { count: 0, totalAmount: 0, avgTicket: 0 });
      } else {
        ToastNotification.error('Failed to fetch UpSwing disbursals');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch UpSwing disbursals');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onPageChange = useCallback((p) => {
    setQuery((prev) => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  }, [setQuery]);
  const onSearch = useCallback((term) => setQuery((prev) => ({ ...prev, search: term, page_no: 1 })), [setQuery]);
  const onFilterByDate = useCallback((type) => setQuery((prev) => ({
    ...prev, type: prev.type === type ? '' : type, startDate: null, endDate: null, page_no: 1,
  })), [setQuery]);
  const onFilterByRange = useCallback((range) => setQuery((prev) => ({
    ...prev, startDate: range.startDate, endDate: range.endDate, type: '', page_no: 1,
  })), [setQuery]);
  const clearFilters = useCallback(() => {
    setQuery({ page_no: 1, limit: DEFAULT_LIMIT, search: '', type: '', startDate: null, endDate: null });
  }, [setQuery]);

  const onOpen = useCallback((r) => {
    if (r?.pci) navigate(`/upswing-webhook/${encodeURIComponent(r.pci)}`, { state: { lead: r } });
  }, [navigate]);

  const handleExport = useCallback(async () => {
    try {
      const all = await fetchAllDisbursals({
        search: query.search,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
      });
      if (!all.length) { ToastNotification.error('No rows to export'); return; }
      downloadCsv(`upswing_disbursals_${Date.now()}.csv`, [
        { header: 'PCI', value: (r) => r.pci },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Product', value: (r) => r.productVariant },
        { header: 'Disbursed Amount', value: (r) => r.amount },
        { header: 'Tenure (months)', value: (r) => r.tenure },
        { header: 'Interest (%)', value: (r) => r.interest },
        { header: 'Journey Type', value: (r) => r.journeyType },
        { header: 'Disbursed At', value: (r) => r.disbursedAt },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const columns = useMemo(() => disbursalColumns({ onOpen }), [onOpen]);

  return (
    <>
      <Toaster />

      {/* KPIs */}
      <div className="flex flex-wrap gap-3 mb-3">
        <Kpi icon={CheckCircle2} tone="border-emerald-100 bg-emerald-50/70 text-emerald-600" label="Disbursed" value={fmtNum(summary.count)} sub="leads (in view)" />
        <Kpi icon={IndianRupee} tone="border-purple-100 bg-purple-50/70 text-purple-600" label="Total Disbursed" value={inr(summary.totalAmount)} sub="sum of disbursal amount" />
        <Kpi icon={TrendingUp} tone="border-indigo-100 bg-indigo-50/70 text-indigo-600" label="Avg Ticket" value={inr(summary.avgTicket)} sub="per disbursed lead" />
      </div>

      <MainTable
        columns={columns}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        onClearAllFilters={clearFilters}
        title="UPSWING · DISBURSALS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />

      <ModuleInfoCard
        title="UpSwing Disbursals"
        subtitle="Disbursed L&T (UpSwing) loans — one row per disbursed lead, with the ₹ amount, tenure and interest."
        whatYouSee={[
          'One row per pci that disbursed (latest disbursal record), with the dialable phone resolved from upswing.leads.',
          'KPIs: number of disbursed leads in view, total disbursed ₹, and the average ticket size.',
          'Click a PCI to open the full UpSwing journey + offer/disbursal snapshot for that lead.',
          'Date chips / range filter on the disbursal day (IST); search matches pci / journey id / product / phone.',
        ]}
        dataSource={[
          'ClickHouse upswing.upswing_disbursed — the dedicated disbursal feed (pci-keyed; deduped to the latest record per pci).',
          'ClickHouse upswing.leads — resolves pci → phone (the disbursal feed carries no phone).',
          'Timestamps are stored in UTC and shown in IST.',
        ]}
        flow={[
          'UpSwing disburses a loan',
          'Record lands in upswing_disbursed',
          'Deduped to one row per pci',
          'Phone resolved via upswing.leads',
          'Shown here with ₹ amount + KPIs',
        ]}
      />
    </>
  );
};

export default UpSwingDisbursals;
