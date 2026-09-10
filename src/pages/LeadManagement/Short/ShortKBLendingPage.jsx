
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../../components/Table/MainTable';
import { getShortKBLendingPageLeads } from '../../../api-services/Modules/Leads';
import { kbLendingPageColumn } from '../../../components/TableHeader';
import SummaryCards from '../../../components/Table/SummaryCards';
import ExportModal from '../../../components/ExportModal';
import ToastNotification from '../../../components/Notification/ToastNotification';
import { useAuth } from '../../../custom-hooks/useAuth';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Summary card key → status filter value. On the Short page the
// "Duplicate (Error)" card shows the duplicate count, so it maps to the
// 'dedupted' status token (backend maps that to kb_apply_status = 'duplicate').
const CARD_STATUS_MAP = { total: '', success: 'success', reject: 'rejected', duplicate: 'dedupted', error: 'error' };

const ShortKBLendingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExport = ["super-admin", "short-page-admin", "dev"].includes(user?.role);
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
    status: '',
    dobFromDate: '',
    dobToDate: '',
    minLoanAmount: '',
    maxLoanAmount: '',
    minSalary: '',
    maxSalary: '',
    profession: '',
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getShortKBLendingPageLeads({
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
            duplicateCount: Number(summary.duplicate) || 0,
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
    }));
  }, []);

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async () => {
    setExportLoading(true);
    const urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    // Date params come from the table's own applied filter (mirrors the list fetch).
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
    }
    // else: no date param -> export the whole current view

    downloadFileName = query.startDate && query.endDate
      ? `SML_Short_KB_LendingPage_${query.startDate}_to_${query.endDate}.csv`
      : `SML_Short_KB_LendingPage_${date}_${time}.csv`;

    if (query.status) urlParams.append("status", query.status);
    if (query.search) urlParams.append("search", query.search);
    if (query.dobFromDate) urlParams.append("dobFromDate", query.dobFromDate);
    if (query.dobToDate) urlParams.append("dobToDate", query.dobToDate);
    if (query.minLoanAmount) urlParams.append("minLoanAmount", query.minLoanAmount);
    if (query.maxLoanAmount) urlParams.append("maxLoanAmount", query.maxLoanAmount);
    if (query.minSalary) urlParams.append("minSalary", query.minSalary);
    if (query.maxSalary) urlParams.append("maxSalary", query.maxSalary);
    if (query.profession) urlParams.append("profession", query.profession);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/short-kb-lending-page/export?${urlParams.toString()}`;
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
    navigate(`/short-kb-lending-page/${lead.id}`, { state: { lead } });
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
            className="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900 transition"
          >
            High Ticket
          </button>
          <button
            type="button"
            onClick={() => navigate('/short-kb-lending-page')}
            className="px-4 py-1.5 rounded-md text-sm font-semibold bg-purple-600 text-white shadow-sm transition"
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
      <MainTable
        columns={kbLendingPageColumn({ handleEdit })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={canExport ? handleExport : undefined}
        title="Short KB Success Leads (Lending Page)"
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
    </>
  );
};

export default ShortKBLendingPage;
