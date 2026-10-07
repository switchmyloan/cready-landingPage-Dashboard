import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Filter } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { upSwingEventsColumn } from '../../../components/TableHeader';
import { getUpSwingEvents } from '../../../api-services/Modules/UpSwingWebhook';
import UpSwingFunnelModal from './UpSwingFunnelModal';

// ---------------------------------------------------------------------------
// Filter persistence — filters live in the URL query string so they survive both
// a reload AND a Back from the lead-detail page (whose Back button is navigate(-1),
// which restores this exact URL). Writes use replace:true so tweaking a filter
// doesn't pile up history entries to Back through.
// ---------------------------------------------------------------------------
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

// Mirror the query back into the params, dropping defaults so the URL stays short.
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

// Drop-in replacement for useState({...filters}) that reads/writes the URL.
//
// Two subtleties, both learned the hard way from a broken "Clear All":
//  1. `setQuery` is STABLE (ref-held setSearchParams) so it doesn't churn the
//     handlers built on it every URL change — which would re-fire MainTable's
//     onPageChange/onSearch effects.
//  2. Functional updates chain off a `latest` ref, NOT react-router's `prev`.
//     react-router does NOT chain successive setSearchParams(fn) calls within a
//     tick — every fn sees the SAME pre-navigation snapshot — so Clear All followed
//     by MainTable's onSearch('') both read `type=today` and the last write wins,
//     resurrecting it. The ref reflects each write immediately, so calls chain.
const useUrlQuery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const setRef = useRef(setSearchParams);
  setRef.current = setSearchParams;
  const search = searchParams.toString();
  const query = useMemo(() => readQuery(new URLSearchParams(search)), [search]);
  const latest = useRef(query);
  latest.current = query; // resync from the URL on every render
  const setQuery = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(latest.current) : updater;
    latest.current = next; // so a second setQuery in the same tick sees this one
    setRef.current(writeQuery(new URLSearchParams(), next), { replace: true });
  }, []);
  return [query, setQuery];
};

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
    const res = await getUpSwingEvents({ ...baseParams, perPage: PAGE, currentPage: page, enrichAmounts: true });
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
  // Filters live in the URL (?status=…&type=…&page=…) so they survive reload / Back.
  const [query, setQuery] = useUrlQuery();

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

  // Clear every filter — wired to MainTable's built-in "Clear All" button. MainTable's
  // own handler already empties its search box (setGlobalFilter('')); we just reset the
  // URL query. No remount — remounting fires MainTable's mount effects (onPageChange/
  // onSearch) which, running before the URL clear commits, re-injected type=today.
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
      downloadCsv(`upswing_leads_${Date.now()}.csv`, [
        { header: 'PCI', value: (r) => r.pci },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'MRN', value: (r) => r.mrn },
        { header: 'Journey ID', value: (r) => r.journeyId },
        { header: 'FSI', value: (r) => r.fsi },
        { header: 'Stage', value: (r) => r.eventType },
        { header: 'Journey Type', value: (r) => r.journeyType },
        { header: 'Product', value: (r) => r.productVariant },
        { header: 'Offer Available', value: (r) => (r.offerAvailable == null ? '' : r.offerAvailable ? 'Yes' : 'No') },
        { header: 'Bank Offered Amount', value: (r) => r.bankOfferedAmount },
        { header: 'Bank Offered Interest', value: (r) => r.bankOfferedInterest },
        { header: 'User Selected Amount', value: (r) => r.userSelectedLoanAmount },
        { header: 'Disbursed Amount', value: (r) => r.loanDisbursalAmount },
        { header: 'Rejected Reason', value: (r) => r.rejectedReason },
        { header: 'Last Event', value: (r) => r.eventTimestamp },
        { header: 'Updated At', value: (r) => r.updatedAt },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (ev) => {
    navigate(`/upswing-webhook/${encodeURIComponent(ev.id)}`, { state: { lead: ev } });
  };

  // Journey funnel modal — shares the list's active date filter so the funnel
  // matches whatever period the user is looking at.
  const [funnelOpen, setFunnelOpen] = useState(false);
  const funnelDateParams = useMemo(() => ({
    type: query.type || undefined,
    fromDate: query.startDate || undefined,
    toDate: query.endDate || undefined,
  }), [query.type, query.startDate, query.endDate]);

  return (
    <>
      <Toaster />

      {/* Journey-stage chips — leads per current stage (eventType). Click to filter. */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Stage:</span>
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

        {/* Opens the journey funnel. ml-auto pins it right however many chips wrap. */}
        <button
          onClick={() => setFunnelOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 hover:border-purple-300 transition"
          title="View journey funnel"
        >
          <Filter size={14} />
          Funnel
        </button>
      </div>

      <UpSwingFunnelModal
        open={funnelOpen}
        onClose={() => setFunnelOpen(false)}
        dateParams={funnelDateParams}
      />

      <MainTable
        columns={upSwingEventsColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        onClearAllFilters={clearFilters}
        title="UPSWING · LEADS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        // Seed the table's own page/search from the URL so a reload or a Back from
        // the detail page lands on the same page with the same search term.
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />

      <ModuleInfoCard
        title="UpSwing Leads"
        subtitle="UpSwing journey data — one row per lead (pci), showing its current stage and offer / disbursal figures."
        whatYouSee={[
          'One row per pci: the lead’s current journey stage plus product, bank offer, user-selected amount and disbursed amount.',
          'Stage chips count leads sitting at each journey stage — click one to filter the table to those leads.',
          'Click the eye icon to open the full offer/disbursal snapshot and the lead’s complete webhook event timeline.',
          'These tables carry no PII (name/phone) — they are pure journey + offer data keyed on pci.',
        ]}
        dataSource={[
          'ClickHouse upswing.pci_latest_event — ReplacingMergeTree snapshot, one row per pci (read with FINAL).',
          'ClickHouse upswing.webhook_events — append-only event diary, the source for the detail-page timeline.',
          'Timestamps are stored in UTC and shown in IST.',
        ]}
        flow={[
          'UpSwing sends a webhook',
          'Event appended to webhook_events',
          'pci_latest_event snapshot updated',
          'Snapshot shown in this list',
          'Eye → offer snapshot + full timeline',
        ]}
      />
    </>
  );
};

export default UpSwingWebhook;
