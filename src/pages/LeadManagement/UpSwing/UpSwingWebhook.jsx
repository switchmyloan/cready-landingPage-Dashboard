import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { upSwingEventsColumn } from '../../../components/TableHeader';
import { getUpSwingEvents } from '../../../api-services/Modules/UpSwingWebhook';

// Clickable event-type chip — filter the table by that event_type, click again to clear.
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
  if (/disburs|approved|success|complete|active|created/.test(t)) return 'green';
  if (/reject|declin|fail|cancel|expire|error/.test(t)) return 'red';
  if (/pending|await|progress|review|initiat|process|launch|login|otp|sign/.test(t)) return 'amber';
  return 'gray';
};

// ── CSV export helpers (mirror the Vivifi page) ─────────────────────────────
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
// Backend caps perPage at 200, so page through in 200-row chunks for a full export.
const fetchAllEvents = async (baseParams) => {
  const PAGE = 200;
  const rows = [];
  for (let page = 1; page <= 200; page += 1) {
    const res = await getUpSwingEvents({ ...baseParams, perPage: PAGE, currentPage: page });
    const chunk = res?.data?.data?.data || [];
    rows.push(...chunk);
    const total = res?.data?.data?.pagination?.total ?? rows.length;
    if (chunk.length < PAGE || rows.length >= total) break;
  }
  return rows;
};

const UpSwingWebhook = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, byStatus: [] });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState({
    page_no: 1, limit: 10, search: '', type: '', startDate: null, endDate: null, status: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUpSwingEvents({
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
        ToastNotification.error('Failed to fetch UpSwing events');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch UpSwing events');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onPageChange = useCallback((p) => {
    setQuery((prev) => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  }, []);
  const onSearch = useCallback((term) => setQuery((prev) => ({ ...prev, search: term, page_no: 1 })), []);
  const onFilterByDate = useCallback((type) => setQuery((prev) => ({
    ...prev, type: prev.type === type ? '' : type, startDate: null, endDate: null, page_no: 1,
  })), []);
  const onFilterByRange = useCallback((range) => setQuery((prev) => ({
    ...prev, startDate: range.startDate, endDate: range.endDate, type: '', page_no: 1,
  })), []);
  const toggleStatus = useCallback((s) => setQuery((prev) => ({
    ...prev, status: prev.status === s ? '' : s, page_no: 1,
  })), []);

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
      downloadCsv(`upswing_leads_${Date.now()}.csv`, [
        { header: 'Name', value: (r) => r.name },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Email', value: (r) => r.email },
        { header: 'MRN', value: (r) => r.mrn },
        { header: 'PCI', value: (r) => r.pci },
        { header: 'PAN', value: (r) => r.pan },
        { header: 'Profile', value: (r) => r.profile },
        { header: 'Events', value: (r) => r.eventCount },
        { header: 'Event Types', value: (r) => (Array.isArray(r.eventTypes) ? r.eventTypes.join(' | ') : '') },
        { header: 'Resolved', value: (r) => (r.resolved ? 'Yes' : 'No') },
        { header: 'First Seen', value: (r) => r.firstSeen },
        { header: 'Last Seen', value: (r) => r.lastSeen },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (ev) => {
    navigate(`/upswing-webhook/${encodeURIComponent(ev.id)}`, { state: { lead: ev } });
  };

  return (
    <>
      <Toaster />

      {/* Event-type chips — count of leads that reached each event type. Click to filter. */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Event Type:</span>
        <StageChip label="All Leads" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
        {(summary.byStatus || []).map((s) => (
          <StageChip
            key={s.status}
            label={s.status || 'Unknown'}
            count={s.count}
            active={query.status === s.status}
            onClick={() => toggleStatus(s.status)}
            tone={toneForEvent(s.status)}
          />
        ))}
        {summary.byStatus?.length === 0 && (
          <span className="text-sm text-gray-400 italic">No leads yet</span>
        )}
      </div>

      <MainTable
        columns={upSwingEventsColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        title="UPSWING · LEADS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
      />

      <ModuleInfoCard
        title="UpSwing Leads"
        subtitle="Live UpSwing lead data — one row per lead, aggregated across all its webhook events."
        whatYouSee={[
          'One row per lead pushed to UpSwing (name, phone, MRN, PCI, profile).',
          'Events = how many webhook events UpSwing has recorded for that lead; Event Types shows which stages it reached.',
          'Event-type chips count leads that reached each stage — click one to filter the table to those leads.',
          'Resolved shows whether the lead is fully identity-resolved on UpSwing’s side; click the eye to open the full lead detail.',
        ]}
        dataSource={[
          'External UpSwing admin API — GET /api/admin/events (server-side, x-admin-key).',
          'The backend proxies the call (key stays in .env) and does search / filter / paging in-process.',
          'Data is lead-centric and already aggregated by UpSwing — the CMS does not store it.',
        ]}
        flow={[
          'Lead pushed to UpSwing',
          'UpSwing sends webhooks',
          'UpSwing aggregates events per lead',
          'CMS fetches the admin API',
          'Eye → full lead detail',
        ]}
      />
    </>
  );
};

export default UpSwingWebhook;
