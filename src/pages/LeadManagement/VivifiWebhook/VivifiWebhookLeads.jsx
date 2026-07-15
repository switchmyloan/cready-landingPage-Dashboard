import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { IndianRupee, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import MainTable from '../../../components/Table/MainTable';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import { vivifiApplicationsColumn, vivifiLoansColumn } from '../../../components/TableHeader';
import { getVivifiApplications, getVivifiLoans } from '../../../api-services/Modules/VivifiWebhook';

const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// Clickable stage chip — click to filter the table by that status, click again to clear.
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

const toneForStatus = (s) => {
  const t = String(s || '').toLowerCase();
  if (/disburs|approved|success|complete|active/.test(t)) return 'green';
  if (/reject|declin|fail|cancel|expire/.test(t)) return 'red';
  if (/pending|await|progress|review|initiat|process|vkyc|esign|sign/.test(t)) return 'amber';
  return 'gray';
};

const KpiCard = ({ icon: Icon, label, value, sub, tone = 'purple' }) => {
  const tones = {
    purple: 'from-purple-500 to-indigo-500',
    green: 'from-emerald-500 to-green-500',
    amber: 'from-amber-500 to-orange-500',
    blue: 'from-sky-500 to-blue-500',
  };
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200/80 rounded-xl px-4 py-3 shadow-sm min-w-[180px]">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tones[tone]} grid place-items-center text-white shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
        {sub ? <p className="text-[11px] text-gray-400 truncate">{sub}</p> : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Applications panel — current-state snapshot (one row per lead).
// ---------------------------------------------------------------------------
const ApplicationsPanel = () => {
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
      const res = await getVivifiApplications({
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
        ToastNotification.error('Failed to fetch applications');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch applications');
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

  const handleEdit = (lead) => {
    navigate(`/vivifi-webhook-leads/${encodeURIComponent(lead.leadId)}`, { state: { lead, kind: 'application' } });
  };

  return (
    <>
      {/* Stage chips (dynamic statuses) — click to filter */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Stages:</span>
        <StageChip label="All" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
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
        {summary.byStatus?.length === 0 && (
          <span className="text-sm text-gray-400 italic">No applications yet</span>
        )}
      </div>

      <MainTable
        columns={vivifiApplicationsColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        title="VIVIFI · APPLICATIONS"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Loans panel — current-state disbursal snapshot + KPIs.
// ---------------------------------------------------------------------------
const LoansPanel = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState({
    page_no: 1, limit: 10, search: '', type: '', startDate: null, endDate: null, status: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVivifiLoans({
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
        setSummary(res.data.data?.summary || {});
      } else {
        ToastNotification.error('Failed to fetch loans');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch loans');
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

  const handleEdit = (lead) => {
    navigate(`/vivifi-webhook-leads/${encodeURIComponent(lead.leadId)}`, { state: { lead, kind: 'loan' } });
  };

  return (
    <>
      {/* KPI cards */}
      <div className="flex flex-wrap gap-3 mb-3">
        <KpiCard icon={IndianRupee} tone="green" label="Disbursed (This Month)" value={inr(summary.disbursedAmountThisMonth)} sub={`${summary.disbursedCountThisMonth || 0} loans`} />
        <KpiCard icon={TrendingUp} tone="purple" label="Total Disbursed" value={inr(summary.disbursedAmount)} sub={`${summary.disbursedCount || 0} loans`} />
        <KpiCard icon={Clock} tone="amber" label="Pending Disbursal" value={summary.pendingCount || 0} sub="not yet disbursed" />
        <KpiCard icon={CheckCircle2} tone="blue" label="Avg Ticket" value={inr(Math.round(summary.avgTicket || 0))} sub="per disbursed loan" />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Status:</span>
        <StageChip label="All" count={summary.total || 0} active={!query.status} onClick={() => toggleStatus('')} tone="purple" />
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
          <span className="text-sm text-gray-400 italic">No loans yet</span>
        )}
      </div>

      <MainTable
        columns={vivifiLoansColumn({ handleEdit })}
        data={rows}
        totalDataCount={total}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={onSearch}
        onRefresh={fetchData}
        title="VIVIFI · LOANS (DISBURSAL)"
        onFilterByDate={onFilterByDate}
        activeFilter={query.type}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Module shell — tab switcher.
// ---------------------------------------------------------------------------
const VivifiWebhookLeads = () => {
  const [activeTab, setActiveTab] = useState('applications');
  const tabs = [
    { key: 'applications', label: 'Applications' },
    { key: 'loans', label: 'Loans (Disbursal)' },
  ];

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

      {activeTab === 'applications' ? <ApplicationsPanel /> : <LoansPanel />}

      <ModuleInfoCard
        title="Vivifi Webhook Leads"
        subtitle="Live FlexSalary (Vivifi) webhook data — current application & loan state, with the full event history per lead."
        whatYouSee={[
          'Applications tab: the current status of every lead (one row each), plus a rejection reason where rejected.',
          'Loans tab: disbursal view — amount, disbursal date/amount, and KPIs (disbursed this month, total disbursed, pending, avg ticket).',
          'Click the eye icon on any lead to open its full webhook event timeline (what FlexSalary sent and when).',
          'Stage/status chips are clickable — click one to filter the table to that status.',
        ]}
        dataSource={[
          'ClickHouse webhook_data DB. Applications/Loans are ReplacingMergeTree snapshots (read with FINAL = latest row per lead).',
          'The lead timeline reads webhook_events — an append-only diary of every event received (never overwritten).',
          'Amounts and dates are stored in IST; disbursal figures come straight from the LOAN_STATUS events.',
        ]}
        flow={[
          'FlexSalary sends a webhook',
          'Event appended to webhook_events',
          'Applications / Loans snapshot updated',
          'Snapshot shown in the tabs',
          'Eye → full event timeline',
        ]}
      />
    </>
  );
};

export default VivifiWebhookLeads;
