import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CheckCircle2, Clock, TrendingUp, XCircle, Users } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { lwLeadsColumn, lwDisbursalsColumn } from '../../../components/TableHeader';
import { getLwLeads, getLwDisbursals, getLwLeadMediums, getLwDisbursalMediums } from '../../../api-services/Modules/LwAffiliate';
import {
  useUrlQuery,
  StageChip,
  KpiCard,
  toneForStatus,
  downloadCsv,
  fmtDT,
} from '../VivifiWebhook/VivifiWebhookLeads';

const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// Quick-date chips beside the filter button: Today, Yesterday, This month, Last month.
const LW_DATE_CHIPS = ['today', 'yesterday', 'this_month', 'last_month'];
const pctOf = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%');

// The backend caps perPage at 200, so a single fetch would silently truncate a large
// export. Page through in 200-row chunks until `total` is reached.
const fetchAllLw = async (fetcher, baseParams) => {
  const PAGE = 200;
  const rows = [];
  for (let page = 1; page <= 200; page += 1) {
    const res = await fetcher({ ...baseParams, perPage: PAGE, currentPage: page });
    const chunk = res?.data?.data?.data || [];
    rows.push(...chunk);
    const total = res?.data?.data?.pagination?.total ?? rows.length;
    if (chunk.length < PAGE || rows.length >= total) break;
  }
  return rows;
};

// ---------------------------------------------------------------------------
// Leads panel — one row per lead (lw_affiliate_latest).
// ---------------------------------------------------------------------------
const LeadsPanel = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, byStatus: [] });
  const [loading, setLoading] = useState(false);
  const [urlQuery, setQuery] = useUrlQuery('l_');
  // UTM medium rides in the URL (?l_medium=…) next to the other lead filters, and is
  // merged into the query object so fetch and export pick it up.
  const [searchParams, setSearchParams] = useSearchParams();
  const medium = searchParams.get('l_medium') || '';
  // Ticket tab: '' = all, 'high' = high ticket (offerLeads), 'short' = short ticket (shortOfferLeads).
  const ticket = searchParams.get('l_ticket') || '';
  const query = useMemo(() => ({ ...urlQuery, medium, ticket }), [urlQuery, medium, ticket]);
  // [{ value, count }] — count = LoanWalle leads carrying that medium.
  const [mediums, setMediums] = useState([]);
  const [noMediumCount, setNoMediumCount] = useState(0);
  const [ticketCounts, setTicketCounts] = useState({ all: 0, high: 0, short: 0 });

  // The medium list belongs to the open ticket tab, so it reloads when the tab changes.
  useEffect(() => {
    getLwLeadMediums({ ticket: query.ticket })
      .then((res) => {
        const d = res?.data?.data || {};
        setMediums(Array.isArray(d.mediums) ? d.mediums : []);
        setNoMediumCount(Number(d.noMediumCount) || 0);
        setTicketCounts(d.ticketCounts || { all: 0, high: 0, short: 0 });
      })
      .catch(() => { setMediums([]); setNoMediumCount(0); });
  }, [query.ticket]);

  const setTicket = useCallback((t) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (t) sp.set('l_ticket', t); else sp.delete('l_ticket');
      sp.delete('l_medium');   // each ticket has its own medium list
      sp.delete('l_page');
      return sp;
    }, { replace: true });
  }, [setSearchParams]);

  const setMedium = useCallback((v) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (v) sp.set('l_medium', v); else sp.delete('l_medium');
      sp.delete('l_page');
      return sp;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLwLeads({
        medium: query.medium || undefined,
        ticket: query.ticket || undefined,
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
        ToastNotification.error('Failed to fetch leads');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch leads');
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

  const handleExport = useCallback(async () => {
    try {
      const all = await fetchAllLw(getLwLeads, {
        medium: query.medium || undefined,
        ticket: query.ticket || undefined,
        search: query.search,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        status: query.status || undefined,
      });
      if (!all.length) { ToastNotification.error('No rows to export'); return; }
      downloadCsv(`loanwalle_leads_${Date.now()}.csv`, [
        { header: 'SN', value: (r, i) => i + 1 },
        { header: 'Tracking ID', value: (r) => r.trackingId },
        { header: 'User ID', value: (r) => r.userId },
        { header: 'MRN', value: (r) => r.mrn },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Partner', value: (r) => r.partnerCode },
        { header: 'Status', value: (r) => r.latestStatus },
        { header: 'Loan Amount', value: (r) => r.loanAmount },
        { header: 'Disbursed Amount', value: (r) => r.disbursedAmount },
        { header: 'Disbursed Date', value: (r) => r.disbursedDate },
        { header: 'Events', value: (r) => r.eventCount },
        { header: 'Updated At', value: (r) => fmtDT(r.updatedAt) },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (lead) => {
    navigate(`/loanwalle-webhook-leads/${encodeURIComponent(lead.trackingId)}`, { state: { lead } });
  };

  const rejected = (summary.byStatus || []).find((s) => /reject/i.test(s.status || ''));
  const rejectedCount = rejected?.count || 0;
  const totalLeads = summary.total || 0;

  return (
    <>
      {/* Ticket tabs — high-ticket and short-ticket leads, each with its own medium list */}
      <div className="inline-flex items-center gap-1 mb-3 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
        {[
          { key: '', label: 'All', count: ticketCounts.all },
          { key: 'high', label: 'High Ticket', count: ticketCounts.high },
          { key: 'short', label: 'Short Ticket', count: ticketCounts.short },
        ].map((t) => (
          <button
            key={t.key || 'all'}
            onClick={() => setTicket(t.key)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition ${ticket === t.key ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {t.label}
            <span className="ml-1.5 opacity-80 tabular-nums">{(t.count || 0).toLocaleString('en-IN')}</span>
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="flex flex-wrap gap-3 mb-3">
        <KpiCard icon={Users} tone="purple" label="Total Leads" value={totalLeads.toLocaleString('en-IN')} sub="all leads received" />
        <KpiCard icon={CheckCircle2} tone="green" label="Disbursed" value={(summary.disbursedCount || 0).toLocaleString('en-IN')} sub={`${pctOf(summary.disbursedCount, totalLeads)} conversion`} />
        <KpiCard icon={TrendingUp} tone="blue" label="Disbursed Amount" value={inr(summary.disbursedAmount)} sub="across disbursed leads" />
        <KpiCard icon={XCircle} tone="red" label="Rejected" value={rejectedCount.toLocaleString('en-IN')} sub={`${pctOf(rejectedCount, totalLeads)} of all leads`} />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-3 shadow-sm">
        <label className="flex items-center gap-1.5 mr-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">UTM medium:</span>
          <select
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] font-medium text-gray-700 focus:border-purple-400 focus:outline-none"
          >
            <option value="">All</option>
            <option value="__none__">No medium ({noMediumCount.toLocaleString('en-IN')})</option>
            {mediums.map((m) => (
              <option key={m.value} value={m.value}>{m.value} ({m.count.toLocaleString('en-IN')})</option>
            ))}
          </select>
        </label>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-0.5">Status:</span>
        <StageChip label="All" count={totalLeads} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
        {(summary.byStatus || []).map((s) => (
          <StageChip
            key={s.status}
            label={s.status || 'Unknown'}
            count={s.count}
            active={query.status === s.status}
            onClick={() => toggleStatus(s.status)}
            tone={toneForStatus(s.status)}
          />
        ))}
        {(!summary.byStatus || summary.byStatus.length === 0) && (
          <span className="text-sm text-gray-400 italic">No leads yet</span>
        )}
      </div>

      <MainTable
        columns={lwLeadsColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        title="LOANWALLE · LEADS"
        richDateFilter
        dateChips={LW_DATE_CHIPS}
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Disbursals panel — one row per disbursed loan (lw_affiliate_disbursals).
// ---------------------------------------------------------------------------
const DisbursalsPanel = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, byPartner: [] });
  const [loading, setLoading] = useState(false);
  const [urlQuery, setQuery] = useUrlQuery('d_');
  // UTM medium rides in the URL (?d_medium=…), merged into the query like the leads tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const medium = searchParams.get('d_medium') || '';
  const query = useMemo(() => ({ ...urlQuery, medium }), [urlQuery, medium]);
  const [mediums, setMediums] = useState([]);
  const [noMediumCount, setNoMediumCount] = useState(0);

  useEffect(() => {
    getLwDisbursalMediums()
      .then((res) => {
        const d = res?.data?.data || {};
        setMediums(Array.isArray(d.mediums) ? d.mediums : []);
        setNoMediumCount(Number(d.noMediumCount) || 0);
      })
      .catch(() => { setMediums([]); setNoMediumCount(0); });
  }, []);

  const setMedium = useCallback((v) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (v) sp.set('d_medium', v); else sp.delete('d_medium');
      sp.delete('d_page');
      return sp;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLwDisbursals({
        medium: query.medium || undefined,
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
        setSummary(res.data.data?.summary || { total: 0, byPartner: [] });
      } else {
        ToastNotification.error('Failed to fetch disbursals');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch disbursals');
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

  const handleExport = useCallback(async () => {
    try {
      const all = await fetchAllLw(getLwDisbursals, {
        medium: query.medium || undefined,
        search: query.search,
        type: query.type || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
      });
      if (!all.length) { ToastNotification.error('No rows to export'); return; }
      downloadCsv(`loanwalle_disbursals_${Date.now()}.csv`, [
        { header: 'SN', value: (r, i) => i + 1 },
        { header: 'Tracking ID', value: (r) => r.trackingId },
        { header: 'User ID', value: (r) => r.userId },
        { header: 'MRN', value: (r) => r.mrn },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Partner', value: (r) => r.partnerCode },
        { header: 'Loan Amount', value: (r) => r.loanAmount },
        { header: 'Disbursed Date', value: (r) => r.disbursedDate },
        { header: 'Disbursed At', value: (r) => fmtDT(r.disbursedAt) },
      ], all);
    } catch (err) {
      console.error(err);
      ToastNotification.error('Export failed');
    }
  }, [query]);

  const handleEdit = (lead) => {
    navigate(`/loanwalle-webhook-leads/${encodeURIComponent(lead.trackingId)}`, { state: { lead } });
  };

  const top = (summary.byPartner || [])[0];

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-3">
        <KpiCard icon={CheckCircle2} tone="green" label="Disbursals" value={(summary.total || 0).toLocaleString('en-IN')} sub="loans disbursed" />
        <KpiCard icon={TrendingUp} tone="purple" label="Disbursed Amount" value={inr(summary.disbursedAmount)} sub="total disbursed" />
        <KpiCard icon={Clock} tone="blue" label="Avg Ticket" value={inr(Math.round(summary.avgTicket || 0))} sub="per disbursal" />
        <KpiCard icon={Users} tone="amber" label="Top Partner" value={top?.partnerCode || '—'} sub={top ? `${top.count} disbursals` : 'no disbursals yet'} />
      </div>

      {/* Partner chips (counts only — the table is not filtered by partner here) */}
      {/* UTM medium filter — counts are disbursals, one per customer */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-3 shadow-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">UTM medium:</span>
          <select
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] font-medium text-gray-700 focus:border-purple-400 focus:outline-none"
          >
            <option value="">All</option>
            <option value="__none__">No medium ({noMediumCount.toLocaleString('en-IN')})</option>
            {mediums.map((m) => (
              <option key={m.value} value={m.value}>{m.value} ({m.count.toLocaleString('en-IN')})</option>
            ))}
          </select>
        </label>
      </div>

      {(summary.byPartner || []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-3 shadow-sm">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-0.5">Partners:</span>
          {summary.byPartner.map((p) => (
            <span key={p.partnerCode} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-green-200 bg-green-50 text-green-700 text-[11px] font-semibold">
              <span>{p.partnerCode || 'Unknown'}</span>
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/70 text-[10px] font-bold">{p.count}</span>
            </span>
          ))}
        </div>
      )}

      <MainTable
        columns={lwDisbursalsColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        onExport={handleExport}
        title="LOANWALLE · DISBURSALS"
        richDateFilter
        dateChips={LW_DATE_CHIPS}
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        initialPagination={{ pageIndex: query.page_no - 1, pageSize: query.limit }}
        initialSearch={query.search}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Module shell — tab switcher. The open tab rides in the URL (?tab=disbursals) so a
// reload or Back from the detail page lands on the same tab.
// ---------------------------------------------------------------------------
const LoanWalleAffiliateLeads = () => {
  const tabs = [
    { key: 'leads', label: 'Leads' },
    { key: 'disbursals', label: 'Disbursals' },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'disbursals' ? 'disbursals' : 'leads';
  const setActiveTab = useCallback((key) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (key === 'disbursals') sp.set('tab', 'disbursals'); else sp.delete('tab');
      return sp;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <>
      <Toaster />

      <div className="rounded-lg px-1 mb-3">
        <div className="flex space-x-8 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative pb-2 text-sm font-semibold transition-colors ${activeTab === tab.key ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'}`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute left-0 -bottom-[1px] h-0.5 w-full bg-indigo-600 rounded" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'leads' ? <LeadsPanel /> : <DisbursalsPanel />}

      <ModuleInfoCard
        title="LoanWalle Webhook Leads"
        subtitle="Live LoanWalle affiliate webhook data — current lead status and disbursals, with the full event history per lead."
        whatYouSee={[
          'Leads tab: one row per lead with its latest status, partner, loan and disbursed amounts.',
          'Disbursals tab: every disbursed loan with its amount and disbursal date, plus KPIs (total, average ticket, top partner).',
          'Click the eye icon on any row to open its event timeline (every ASSIGNMENT_STATUS event received for that lead).',
          'Status chips are clickable — click one to filter the table to that status.',
        ]}
        dataSource={[
          'ClickHouse webhook_data DB: lw_affiliate_latest (current state per lead), lw_affiliate_disbursals (disbursed loans), lw_affiliate_events (append-only event history).',
          'The timeline reads lw_affiliate_events with FINAL, so a re-delivered event is shown once.',
          'Dates are filtered on the IST calendar day of the last update.',
        ]}
        flow={[
          'LoanWalle sends a webhook',
          'Event appended to lw_affiliate_events',
          'Lead / disbursal snapshot updated',
          'Snapshot shown in the tabs',
          'Eye → full event timeline',
        ]}
      />
    </>
  );
};

export default LoanWalleAffiliateLeads;
