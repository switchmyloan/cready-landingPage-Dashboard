
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../../components/Table/MainTable';
import { getKBLendingPageLeads } from '../../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../../api-services/Modules/Disbursal';
import { kbLendingPageColumn } from '../../../components/TableHeader';
import SummaryCards from '../../../components/Table/SummaryCards';
import ExportModal from '../../../components/ExportModal';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import ToastNotification from '../../../components/Notification/ToastNotification';
import { useAuth } from '../../../custom-hooks/useAuth';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Summary card key → status filter value. "Duplicate (Error)" card shows the
// Errors count, so it maps to the 'error' status.
const CARD_STATUS_MAP = { total: '', success: 'success', reject: 'rejected', duplicate: 'error', error: 'error' };

const KBLendingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExport = ["super-admin", "mv-page-admin"].includes(user?.role);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);
  const [tablePagination, setTablePagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalLeads: 0,
    successCount: 0,
    rejectCount: 0,
    duplicateCount: 0,
    distinctProfessions: [],
  });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    filter_date: 'today',
    startDate: null,
    endDate: null,
    status: 'success',
    dobFromDate: '',
    dobToDate: '',
    minLoanAmount: '',
    maxLoanAmount: '',
    minSalary: '',
    maxSalary: '',
    profession: '',
    utmMedium: '',
    utmSource: '',
  });

  // Matches the /offer-leads page so both filter UIs stay in sync.
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

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getKBLendingPageLeads({
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        perPage: query.limit,
        currentPage: query.page_no,
        status: query.status,
        search: query.search,
        dobFromDate: query.dobFromDate || undefined,
        dobToDate: query.dobToDate || undefined,
        minLoanAmount: query.minLoanAmount || undefined,
        maxLoanAmount: query.maxLoanAmount || undefined,
        minSalary: query.minSalary || undefined,
        maxSalary: query.maxSalary || undefined,
        profession: query.profession || undefined,
        utmMedium: query.utmMedium || undefined,
        utmSource: query.utmSource || undefined,
      });
      if (res?.data?.success) {
        setRawData(res.data.data || []);
        setFilteredCount(res.data.pagination?.total || 0);
        const summary = res.data.summaryObj;
        if (summary) {
          setSummaryMetrics(prev => ({
            totalLeads: Number(summary.total) || 0,
            successCount: Number(summary.success) || 0,
            rejectCount: Number(summary.reject) || 0,
            duplicateCount: Number(summary.Errors) || 0,
            // Keep distinctProfessions stable across requests so dropdown doesn't flicker
            distinctProfessions: Array.isArray(summary.distinctProfessions) && summary.distinctProfessions.length > 0
              ? summary.distinctProfessions
              : prev.distinctProfessions,
          }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    query.filter_date, query.startDate, query.endDate, query.limit, query.page_no,
    query.status, query.search, query.dobFromDate, query.dobToDate,
    query.minLoanAmount, query.maxLoanAmount, query.minSalary, query.maxSalary, query.profession,
    query.utmMedium, query.utmSource,
  ]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onPageChange = useCallback(p => {
    setTablePagination({ pageIndex: p.pageIndex, pageSize: p.pageSize });
    setQuery(prev => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  }, []);

  const handleStatusFilter = useCallback(newStatus => {
    setQuery(prev => ({ ...prev, status: newStatus, page_no: 1 }));
  }, []);

  // Summary card → status filter. Clicking the currently active card toggles
  // the filter off (back to All).
  const handleCardClick = useCallback(cardKey => {
    const nextStatus = CARD_STATUS_MAP[cardKey] ?? '';
    setQuery(prev => ({
      ...prev,
      status: prev.status === nextStatus ? '' : nextStatus,
      page_no: 1,
    }));
  }, []);

  // Reverse-map current status → card key so the active card is highlighted.
  // The "Duplicate (Error)" card shows the Errors count here, so 'error' → it.
  const activeCardKey = useMemo(() => {
    switch (query.status) {
      case 'success': return 'success';
      case 'rejected': return 'reject';
      case 'error': return 'duplicate';
      case '': return 'total';
      default: return null; // e.g. dropdown 'dedupted' has no matching card here
    }
  }, [query.status]);

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
      page_no: 1,
    }));
  }, []);

  const onFilterByRange = useCallback(range => {
    setQuery(prev => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
      filter_date: '',
      page_no: 1,
    }));
  }, []);

  const handleDobRangeFilter = useCallback(({ startDate, endDate }) => {
    setQuery(prev => ({ ...prev, dobFromDate: startDate || '', dobToDate: endDate || '', page_no: 1 }));
  }, []);

  const handleLoanAmountApply = useCallback(({ min, max }) => {
    setQuery(prev => ({ ...prev, minLoanAmount: min, maxLoanAmount: max, page_no: 1 }));
  }, []);

  const handleLoanAmountClear = useCallback(() => {
    setQuery(prev => ({ ...prev, minLoanAmount: '', maxLoanAmount: '', page_no: 1 }));
  }, []);

  const handleSalaryApply = useCallback(({ min, max }) => {
    setQuery(prev => ({ ...prev, minSalary: min, maxSalary: max, page_no: 1 }));
  }, []);

  const handleSalaryClear = useCallback(() => {
    setQuery(prev => ({ ...prev, minSalary: '', maxSalary: '', page_no: 1 }));
  }, []);

  const handleProfessionFilter = useCallback(newProfession => {
    setQuery(prev => ({ ...prev, profession: newProfession, page_no: 1 }));
  }, []);

  const handleUtmMediumFilter = useCallback(newMedium => {
    setQuery(prev => ({ ...prev, utmMedium: newMedium, page_no: 1 }));
  }, []);

  const handleUtmSourceFilter = useCallback(newSource => {
    setQuery(prev => ({ ...prev, utmSource: newSource, page_no: 1 }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setQuery(prev => ({
      ...prev,
      page_no: 1,
      search: '',
      filter_date: '',
      startDate: null,
      endDate: null,
      status: '',
      dobFromDate: '',
      dobToDate: '',
      minLoanAmount: '',
      maxLoanAmount: '',
      minSalary: '',
      maxSalary: '',
      profession: '',
      utmMedium: '',
      utmSource: '',
    }));
  }, []);

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async ({ startDate, endDate, mode }) => {
    setExportLoading(true);
    const urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    if (mode === "today" || mode === "yesterday") {
      urlParams.append("type", mode);
      downloadFileName = `SML_KB_LendingPage_${date}_${time}.csv`;
    } else if (mode === "range" && startDate && endDate) {
      urlParams.append("fromDate", startDate);
      urlParams.append("toDate", endDate);
      downloadFileName = `SML_KB_LendingPage_${startDate}_to_${endDate}.csv`;
    } else {
      ToastNotification.error("Please select valid export filter.");
      setExportLoading(false);
      return;
    }

    if (query.status) {
      urlParams.append("status", query.status);
    }

    // Apply currently active filters to export so CSV matches what user sees
    if (query.search) urlParams.append("search", query.search);
    if (query.dobFromDate) urlParams.append("dobFromDate", query.dobFromDate);
    if (query.dobToDate) urlParams.append("dobToDate", query.dobToDate);
    if (query.minLoanAmount) urlParams.append("minLoanAmount", query.minLoanAmount);
    if (query.maxLoanAmount) urlParams.append("maxLoanAmount", query.maxLoanAmount);
    if (query.minSalary) urlParams.append("minSalary", query.minSalary);
    if (query.maxSalary) urlParams.append("maxSalary", query.maxSalary);
    if (query.profession) urlParams.append("profession", query.profession);
    if (query.utmMedium) urlParams.append("utmMedium", query.utmMedium);
    if (query.utmSource) urlParams.append("utmSource", query.utmSource);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/kb-lending-page/export?${urlParams.toString()}`;
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
    navigate(`/kb-lending-page/${lead.id}`, { state: { lead } });
  };

  return (
    <>
      <Toaster />

      {/* High / Short ticket toggle — switches between the two KB Success Leads views. */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">View:</span>
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => navigate('/kb-lending-page')}
            className="px-4 py-1.5 rounded-md text-sm font-semibold bg-purple-600 text-white shadow-sm transition"
          >
            High Ticket
          </button>
          <button
            type="button"
            onClick={() => navigate('/short-kb-lending-page')}
            className="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900 transition"
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

      {/* Medium + Source filter strip — each group is wrapped in its own
          inline-flex block so flex-wrap breaks between groups instead of
          inside them (which was clipping labels on narrow viewports). */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 my-3">
        <div className="inline-flex items-center gap-2 whitespace-nowrap">
          <label className="text-sm font-semibold text-gray-700">Medium:</label>
          <select
            value={query.utmMedium}
            onChange={(e) => handleUtmMediumFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
          >
            <option value="">All Mediums</option>
            {mediumOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
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
        </div>

        <div className="inline-flex items-center gap-2 whitespace-nowrap">
          <label className="text-sm font-semibold text-gray-700">Source:</label>
          <select
            value={query.utmSource}
            onChange={(e) => handleUtmSourceFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
          >
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
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
      </div>

      <MainTable
        columns={kbLendingPageColumn({ handleEdit })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={canExport ? handleExport : undefined}
        title="KB Success Leads (Landing Page)"
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        onFilterChange={handleStatusFilter}
        activeStatusFilter={query.status}
        onDobRangeFilter={handleDobRangeFilter}
        activeDobRange={{ startDate: query.dobFromDate, endDate: query.dobToDate }}
        onLoanAmountFilter={handleLoanAmountApply}
        onLoanAmountClear={handleLoanAmountClear}
        activeLoanAmount={{ min: query.minLoanAmount, max: query.maxLoanAmount }}
        onMonthlyIncomeFilter={handleSalaryApply}
        onMonthlyIncomeClear={handleSalaryClear}
        activeMonthlyIncome={{ min: query.minSalary, max: query.maxSalary }}
        monthlyIncomeLabel="Salary"
        onProfessionFilter={handleProfessionFilter}
        activeProfession={query.profession}
        professionOptions={summaryMetrics.distinctProfessions}
        onClearAllFilters={handleClearAllFilters}
      />

      <ModuleInfoCard
        title="High KB Success Leads (Lending Page)"
        subtitle="All applicants who attempted to apply on KreditBee and got a trackable response."
        whatYouSee={[
          'Only applicants who interacted with the KreditBee card — categorised as Success, Rejected, Duplicate, or Error.',
          'Summary cards showing the total count and a breakdown by status.',
          'Filters: status, salary, profession, age (DOB), loan amount, and traffic source (Medium).',
          'A status badge per applicant derived from the message returned by KreditBee.',
        ]}
        dataSource={[
          'Captures every KreditBee apply attempt along with the full lender response.',
          'The status (Success / Rejected / Duplicate / Error) is read directly from the message returned by KreditBee.',
          'Traffic source is pulled from the main applicant record (matched by phone number), so historical applicants are also filterable.',
        ]}
        flow={[
          'Applicant on offer page',
          'Clicks KreditBee Apply',
          'KreditBee processes',
          'Response captured',
          'Categorised by status',
          'Row appears here',
        ]}
      />
    </>
  );
};

export default KBLendingPage;
