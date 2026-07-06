import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Toaster } from 'react-hot-toast';
import ToastNotification from '@components/Notification/ToastNotification';

import { getMvSuccessFromOfferLeads } from '../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../api-services/Modules/Disbursal';
import ExportModal from '../../components/ExportModal';
import ModuleInfoCard from '../../components/ModuleInfoCard';
import SummaryCards from '../../components/Table/SummaryCards';
import MainTable from '../../components/Table/MainTable';
import { mvOfferLeadsColumn } from '../../components/TableHeader';

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Summary card key → status filter value. The "Duplicate (Error)" card shows
// the deduped count, so it maps to the 'dedupted' token (backend maps that to
// mv_apply_status = 'duplicate').
const CARD_STATUS_MAP = { total: '', success: 'success', reject: 'rejected', duplicate: 'dedupted', error: 'error' };

const MVSuccessLeads = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  // High / Short ticket view — swaps the MV Success data source (offerLeads vs
  // shortOfferLeads, both keyed on mv_apply_status).
  const [scope, setScope] = useState('high');

  const [filteredCount, setFilteredCount] = useState(0);
  const [tablePagination, setTablePagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    filter_date: 'today',
    startDate: null,
    endDate: null,
    status: 'success',
    utmMedium: '',
    utmSource: '',
  });

  // Matches the /offer-leads, /kb-lending-page, and /draft-leads-new filters
  // so the same set of traffic sources is available across modules.
  const MEDIUM_OPTIONS = [
    { value: 'moneyview', label: 'moneyview' },
    { value: 'meta', label: 'meta' },
    { value: 'kreditbee', label: 'kreditbee' },
    { value: 'zype', label: 'zype' },
    { value: 'SC', label: 'SC' },
  ];

  // Medium dropdown — merge the hardcoded baseline with the DB's distinct
  // mediums (same source as the Disbursal dashboard) so ALL mediums show.
  const [mediumOptions, setMediumOptions] = useState(MEDIUM_OPTIONS.map((m) => m.value));
  useEffect(() => {
    let cancelled = false;
    const mergeAndSort = (base, api) => {
      const seen = new Set();
      const out = [];
      for (const s of [...base, ...(Array.isArray(api) ? api : [])]) {
        const k = String(s || '').toLowerCase();
        if (!s || seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
      out.sort((a, b) => a.localeCompare(b));
      return out;
    };
    getDisbursalFilterOptions({ scope: 'high' })
      .then((res) => {
        if (cancelled) return;
        const opts = res?.data?.data || {};
        const base = MEDIUM_OPTIONS.map((m) => m.value);
        const merged = mergeAndSort(base, opts.utmMediums).filter(
          (m) => !['quickloans', 'easyloan', 'easyloans'].includes(String(m).toLowerCase())
        );
        setMediumOptions(['QuickLoans', ...merged]);
      })
      .catch((err) => console.error('Failed to load mediums:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Hardcoded source baseline — same approach as Disbursal Dashboard so the
  // dropdown always has at least one option.
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  const [summaryMetrics, setSummaryMetrics] = useState({
    totalLeads: 0,
    successCount: 0,
    rejectCount: 0,
    duplicateCount: 0
  });

  // Fetch backend data
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMvSuccessFromOfferLeads({
        type: query.filter_date || null,
        fromDate: query.startDate,
        toDate: query.endDate,
        perPage: query.limit,
        currentPage: query.page_no,
        status: query.status,
        search: query.search,
        utmMedium: query.utmMedium || undefined,
        utmSource: query.utmSource || undefined,
        scope,
      });

      if (res?.data?.success) {
        setRawData(res?.data?.data?.data || []);
        setFilteredCount(res?.data?.data?.pagination?.total || 0);
        const s = res?.data?.data?.summary || {};
        setSummaryMetrics({
          totalLeads: s.total || 0,
          successCount: s.success || 0,
          rejectCount: s.rejected || 0,
          duplicateCount: s.deduped || 0
        });
      } else {
        ToastNotification.error('Failed to fetch logs');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [query.filter_date, query.startDate, query.endDate, query.limit, query.page_no, query.status, query.search, query.utmMedium, query.utmSource, scope]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onPageChange = useCallback((pageInfo) => {
    setTablePagination({
      pageIndex: pageInfo.pageIndex,
      pageSize: pageInfo.pageSize,
    });
    setQuery((prevQuery) => {
      return {
        ...prevQuery,
        page_no: pageInfo.pageIndex + 1,
        limit: pageInfo.pageSize,
      };
    });
  }, []);

  const handleStatusFilter = useCallback(newStatus => {
    setQuery(prev => ({ ...prev, status: newStatus, page_no: 1 }));
  }, []);

  // Summary card → status filter. Clicking the active card toggles it off.
  const handleCardClick = useCallback(cardKey => {
    const nextStatus = CARD_STATUS_MAP[cardKey] ?? '';
    setQuery(prev => ({
      ...prev,
      status: prev.status === nextStatus ? '' : nextStatus,
      page_no: 1,
    }));
  }, []);

  // Reverse-map current status → card key so the active card is highlighted.
  const activeCardKey = useMemo(() => {
    switch (query.status) {
      case 'success': return 'success';
      case 'rejected': return 'reject';
      case 'dedupted': return 'duplicate';
      case '': return 'total';
      default: return null; // e.g. dropdown 'error' has no card on this page
    }
  }, [query.status]);

  const handleUtmMediumFilter = useCallback(newMedium => {
    setQuery(prev => ({ ...prev, utmMedium: newMedium, page_no: 1 }));
  }, []);

  const handleUtmSourceFilter = useCallback(newSource => {
    setQuery(prev => ({ ...prev, utmSource: newSource, page_no: 1 }));
  }, []);

  const onSearchHandler = useCallback(term => {
    setQuery(prev => ({ ...prev, search: term, page_no: 1 }));
  }, []);

  const debouncedSearch = useMemo(() => debounce(onSearchHandler, 300), [onSearchHandler]);

  const onFilterByDate = useCallback(type => {
    setQuery(prev => ({
      ...prev,
      filter_date: prev.filter_date === type ? '' : type,
      startDate: null,
      endDate: null,
      page_no: 1
    }));
  }, []);

  const onFilterByRange = useCallback(range => {
    setQuery(prev => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
      filter_date: '',
      page_no: 1
    }));
  }, []);

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async ({ startDate, endDate, mode }) => {
    setExportLoading(true);
    let urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    if (mode === "today" || mode === "yesterday") {
      urlParams.append("type", mode);
      downloadFileName = `MV_Success_Leads_${date}_${time}.csv`;
    } else if (mode === "range" && startDate && endDate) {
      urlParams.append("fromDate", startDate);
      urlParams.append("toDate", endDate);
      downloadFileName = `SML_MV_SUCCESS_Leads_${startDate}_to_${endDate}.csv`;
    } else {
      ToastNotification.error("Please select valid export filter.");
      setExportLoading(false);
      return;
    }

    // Apply currently active filters to export so CSV matches what user sees
    if (query.search) urlParams.append("search", query.search);
    if (query.status) urlParams.append("status", query.status);
    if (query.minLoanAmount) urlParams.append("minLoanAmount", query.minLoanAmount);
    if (query.maxLoanAmount) urlParams.append("maxLoanAmount", query.maxLoanAmount);
    if (query.minSalary) urlParams.append("minSalary", query.minSalary);
    if (query.maxSalary) urlParams.append("maxSalary", query.maxSalary);
    if (query.dobFromDate) urlParams.append("dobFromDate", query.dobFromDate);
    if (query.dobToDate) urlParams.append("dobToDate", query.dobToDate);
    if (query.profession) urlParams.append("profession", query.profession);
    if (query.utmMedium) urlParams.append("utmMedium", query.utmMedium);
    if (query.utmSource) urlParams.append("utmSource", query.utmSource);
    if (scope === 'short') urlParams.append("scope", "short");

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/offer-leads/mv-success-track-export?${urlParams.toString()}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      ToastNotification.success("Download started!");
    } catch (err) {
      console.error(err);
      ToastNotification.error("Export failed!");
    } finally {
      setExportLoading(false);
      setExportModalOpen(false);
    }
  };

  const handleEdit = (lead) => {
    navigate(`/mv-success-leads/${lead.id}`, { state: { lead } });
  };

  return (
    <>
      <Toaster />

      {/* High / Short ticket toggle — swaps the MV Success data source. */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">View:</span>
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => { setScope('high'); setQuery((p) => ({ ...p, page_no: 1 })); }}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${scope === 'high' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            High Ticket
          </button>
          <button
            type="button"
            onClick={() => { setScope('short'); setQuery((p) => ({ ...p, page_no: 1 })); }}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${scope === 'short' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Short Ticket
          </button>
        </div>
      </div>

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        isSubmitting={exportLoading}
      />
      <SummaryCards
        totalLeads={Number(summaryMetrics.totalLeads) || 0}
        successCount={Number(summaryMetrics.successCount) || 0}
        rejectCount={Number(summaryMetrics.rejectCount) || 0}
        duplicateCount={Number(summaryMetrics.duplicateCount) || 0}
        loading={loading}
        duplicateCard={true}
        onCardClick={handleCardClick}
        activeKey={activeCardKey}
      />

      {/* Medium filter strip — mirrors /offer-leads, /kb-lending-page, and
          /draft-leads-new so MV apply analysis stays aligned across modules. */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 my-3">
        <label className="text-sm font-semibold text-gray-700">
          Medium:
        </label>
        <select
          value={query.utmMedium}
          onChange={(e) => handleUtmMediumFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
        >
          <option value="">All Mediums</option>
          {mediumOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {query.utmMedium && (
          <button
            onClick={() => handleUtmMediumFilter('')}
            className="text-xs px-3 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
          >
            Clear
          </button>
        )}

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <label className="text-sm font-semibold text-gray-700">
          Source:
        </label>
        <select
          value={query.utmSource}
          onChange={(e) => handleUtmSourceFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
        >
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {query.utmSource && (
          <button
            onClick={() => handleUtmSourceFilter('')}
            className="text-xs px-3 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
          >
            Clear
          </button>
        )}
      </div>

      <MainTable
        columns={mvOfferLeadsColumn({ handleEdit })}
        data={rawData || []}
        totalDataCount={filteredCount || 0}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={handleExport}
        createLabel="Add Lead"
        title="MV SUCCESS LEADS"

        // Filters
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}

        // STATUS FILTER
        onFilterChange={handleStatusFilter}
        activeStatusFilter={query.status}
      />

      <ModuleInfoCard
        title="High MV Success Leads"
        subtitle="Tracks every applicant who pressed Apply on the MoneyView offer card."
        whatYouSee={[
          'Only applicants who clicked Apply on the MoneyView card — categorised as Success, Rejected, Duplicate, or Error.',
          'A status badge per applicant for a quick read; hover shows the original message from MoneyView.',
          'Summary cards: total / success / rejected / duplicate counts for the selected date range.',
          'Export includes the MoneyView Lead ID and the offered loan amount for each applicant.',
        ]}
        dataSource={[
          'Built from the main applicant list, narrowed to applicants who pressed Apply on MoneyView.',
          'The very first outcome is preserved — if an applicant clicks again later, the original result is not overwritten by a downgrade.',
          'Lead ID and offer amount come directly from MoneyView’s response when the apply succeeds.',
        ]}
        flow={[
          'Applicant on offer page',
          'Clicks MoneyView Apply',
          'MoneyView processes',
          'Result captured',
          'Status finalised',
          'Row appears here',
        ]}
      />
    </>
  );
};

export default MVSuccessLeads;
