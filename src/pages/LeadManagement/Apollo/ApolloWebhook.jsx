import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { TrendingDown } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { apolloEventsColumn } from '../../../components/TableHeader';
import { getApolloEvents } from '../../../api-services/Modules/ApolloWebhook';

// Filters live in the URL so they survive reload AND a Back from the detail page
// (same pattern as the UpSwing list). See UpSwingWebhook.jsx for the full rationale.
const DEFAULT_LIMIT = 10;

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
  const put = (key, value, isDefault) => { if (isDefault) sp.delete(key); else sp.set(key, String(value)); };
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
    setRef.current(writeQuery(new URLSearchParams(), next), { replace: true });
  }, []);
  return [query, setQuery];
};

// Clickable stage chip — filter the table by that stage, click again to clear.
const StageChip = ({ label, count, active, onClick, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  };
  const activeCls = 'ring-2 ring-purple-400 ring-offset-1';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${tones[tone] || tones.gray} ${active ? activeCls : ''}`}
    >
      <span>{label}</span>
      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-white/70 text-[11px] font-bold">{count}</span>
    </button>
  );
};

const toneForEvent = (s) => {
  const t = String(s || '').toLowerCase();
  if (/disburs|approved|success|complete|active|signed/.test(t)) return 'green';
  if (/reject|declin|fail|cancel|expire|error/.test(t)) return 'red';
  if (/pending|await|progress|review|initiat|process|start|captur|verif|offer|digilocker/.test(t)) return 'amber';
  return 'gray';
};

// ── CSV export helpers ──────────────────────────────────────────────────────
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename, cols, rows) => {
  const head = cols.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((r, i) => cols.map((c) => csvEscape(c.value(r, i))).join(',')).join('\n');
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
const fetchAllEvents = async (baseParams) => {
  const PAGE = 200;
  const rows = [];
  for (let page = 1; page <= 200; page += 1) {
    const res = await getApolloEvents({ ...baseParams, perPage: PAGE, currentPage: page });
    const chunk = res?.data?.data?.data || [];
    rows.push(...chunk);
    const total = res?.data?.data?.pagination?.total ?? rows.length;
    if (chunk.length < PAGE || rows.length >= total) break;
  }
  return rows;
};

const ApolloWebhook = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, byStatus: [] });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useUrlQuery();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApolloEvents({
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
      } else {
        ToastNotification.error('Failed to fetch Apollo leads');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch Apollo leads');
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
  const toggleStatus = useCallback((s) => setQuery((prev) => ({
    ...prev, status: prev.status === s ? '' : s, page_no: 1,
  })), [setQuery]);

  const clearFilters = useCallback(() => {
    setQuery({ page_no: 1, limit: DEFAULT_LIMIT, search: '', type: '', startDate: null, endDate: null, status: '' });
  }, [setQuery]);

  const handleExport = useCallback(async () => {
    try {
      const all = await fetchAllEvents({
        search: query.search,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (!all.length) { ToastNotification.error('No rows to export'); return; }
      downloadCsv(`apollo_leads_${Date.now()}.csv`, [
        { header: 'SN', value: (r, i) => i + 1 },
        { header: 'Loan ID', value: (r) => r.loanId },
        { header: 'User ID', value: (r) => r.userId },
        { header: 'UTM Source', value: (r) => r.utmSource },
        { header: 'UTM Campaign', value: (r) => r.utmCampaign },
        { header: 'Stage', value: (r) => r.stageLabel },
        { header: 'Rejection Reason', value: (r) => r.reason || 'No reason found' },
        { header: 'Disbursed Amount', value: (r) => r.disbursementAmount },
        { header: 'Disbursed Date', value: (r) => r.disbursementDate },
        { header: 'Created At', value: (r) => r.createdAt },
        { header: 'Updated At', value: (r) => r.updatedAt },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (ev) => {
    navigate(`/apollo-webhook/${encodeURIComponent(ev.id)}`, { state: { lead: ev } });
  };

  return (
    <>
      <Toaster />

      {/* Journey-stage chips — leads per current stage. Click to filter. */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Stage:</span>
        <StageChip label="All Leads" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
        {(summary.byStatus || []).map((s) => (
          <StageChip
            key={s.status}
            label={s.label || s.status || 'Unknown'}
            count={s.count}
            active={query.status === s.status}
            onClick={() => toggleStatus(s.status)}
            tone={toneForEvent(s.status)}
          />
        ))}
        {summary.byStatus?.length === 0 && (
          <span className="text-sm text-gray-400 italic">No leads yet</span>
        )}

        {/* Opens the full Apollo Funnel page. ml-auto pins it right however many chips wrap. */}
        <button
          onClick={() => navigate('/apollo-funnel')}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 hover:border-purple-300 transition"
          title="Open the Apollo journey funnel"
        >
          <TrendingDown size={14} />
          Funnel
        </button>
      </div>

      <MainTable
        columns={apolloEventsColumn({ handleEdit, status: query.status })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        onClearAllFilters={clearFilters}
        title="APOLLO · LEADS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />

      <ModuleInfoCard
        title="Apollo Leads"
        subtitle="Apollo journey data — one row per loan_id, showing its current stage + UTM attribution."
        whatYouSee={[
          'One row per loan_id: the lead’s current journey stage, user_id, UTM source/campaign and (if disbursed) the amount.',
          'Stage chips count leads sitting at each journey stage — click one to filter the table to those leads.',
          'Click the eye icon to open the lead’s complete apollo_events timeline + any commission/disbursal rows.',
          'These tables carry no PII (name/phone) — pure journey + attribution data keyed on loan_id / user_id.',
        ]}
        dataSource={[
          'ClickHouse apollo_webhook.apollo_events_latest — ReplacingMergeTree snapshot, one row per loan_id (read with FINAL).',
          'ClickHouse apollo_webhook.apollo_events — append-only event diary, the source for the detail-page timeline + funnel.',
          'ClickHouse apollo_webhook.apollo_commission_events — disbursal / commission rows (disbursed ₹).',
        ]}
        flow={[
          'Apollo sends a webhook',
          'Event appended to apollo_events',
          'apollo_events_latest snapshot updated',
          'Snapshot shown in this list',
          'Eye → full timeline + commission',
        ]}
      />
    </>
  );
};

export default ApolloWebhook;
