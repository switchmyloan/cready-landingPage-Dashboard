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
      downloadCsv(`upswing_webhook_events_${Date.now()}.csv`, [
        { header: 'Event Type', value: (r) => r.event_type },
        { header: 'MRN', value: (r) => r.mrn },
        { header: 'PCI', value: (r) => r.pci },
        { header: 'Source', value: (r) => r.source },
        { header: 'Event ID', value: (r) => r.event_id },
        { header: 'Received At', value: (r) => r.received_at },
        { header: 'Processed At', value: (r) => r.processed_at },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (ev) => {
    navigate(`/upswing-webhook/${encodeURIComponent(ev.id)}`, { state: { event: ev } });
  };

  return (
    <>
      <Toaster />

      {/* Event-type chips — click to filter */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Event Type:</span>
        <StageChip label="All" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
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
          <span className="text-sm text-gray-400 italic">No events yet</span>
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
        title="UPSWING · WEBHOOK EVENTS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
      />

      <ModuleInfoCard
        title="UpSwing Webhook Events"
        subtitle="Live UpSwing webhook data — every event received per lead, joined to the pushed lead (MRN)."
        whatYouSee={[
          'One row per webhook event UpSwing sent us (event type, source, timestamps).',
          'MRN is joined in from upswing_leads via the event payload’s pci, so you can tie an event back to its lead.',
          'Event-type chips are clickable — click one to filter the table to that event type.',
          'Click the eye icon on any event to open its full payload, the lead it belongs to, and that lead’s complete event timeline.',
        ]}
        dataSource={[
          'Postgres upswing_webhook_events — append-only event diary (never overwritten).',
          'upswing_leads — one row per lead pushed to UpSwing (MRN, pci, consent), joined on pci.',
          'upswing_launch_sessions — launch tokens (jti) issued per pci, shown on the detail page.',
        ]}
        flow={[
          'Lead pushed to UpSwing',
          'Launch session issued',
          'UpSwing sends webhooks',
          'Event appended to upswing_webhook_events',
          'Eye → full payload + lead timeline',
        ]}
      />
    </>
  );
};

export default UpSwingWebhook;
