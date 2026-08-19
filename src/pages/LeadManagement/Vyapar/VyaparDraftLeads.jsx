
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../../components/Table/MainTable';
import { getVyaparDraftLeadsNew } from '../../../api-services/Modules/Leads';
import { draftLeadsNewColumn } from '../../../components/TableHeader';
import SummaryCards from '../../../components/Table/SummaryCards';
import ExportModal from '../../../components/ExportModal';
import ToastNotification from '../../../components/Notification/ToastNotification';
import PremiumPageLoader from '../../../components/PremiumPageLoader';
import { FileText } from 'lucide-react';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const VyaparDraftLeads = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [filteredCount, setFilteredCount] = useState(0);
  const [tablePagination, setTablePagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [summaryData, setSummaryData] = useState({ totalLeads: 0, distinctProfessions: [] });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    filter_date: 'today',
    startDate: null,
    endDate: null,
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
      const res = await getVyaparDraftLeadsNew({
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        perPage: query.limit,
        currentPage: query.page_no,
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
        const s = res.data.summaryObj || {};
        setSummaryData(prev => ({
          totalLeads: Number(s.total) || 0,
          distinctProfessions: Array.isArray(s.distinctProfessions) && s.distinctProfessions.length > 0
            ? s.distinctProfessions
            : prev.distinctProfessions,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [
    query.filter_date, query.startDate, query.endDate, query.limit, query.page_no, query.search,
    query.dobFromDate, query.dobToDate, query.minLoanAmount, query.maxLoanAmount,
    query.minSalary, query.maxSalary, query.profession,
  ]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const onPageChange = useCallback(p => {
    setTablePagination({ pageIndex: p.pageIndex, pageSize: p.pageSize });
    setQuery(prev => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  }, []);

  const onSearchHandler = useCallback(term => {
    setQuery(prev => ({ ...prev, search: term, page_no: 1 }));
  }, []);

  const debouncedSearch = useMemo(() => debounce(onSearchHandler, 300), [onSearchHandler]);

  const onFilterByDate = useCallback(type => {
    setQuery(prev => ({
      ...prev,
      filter_date: prev.filter_date === type ? '' : type,
      startDate: null, endDate: null, page_no: 1,
    }));
  }, []);

  const onFilterByRange = useCallback(range => {
    setQuery(prev => ({
      ...prev,
      startDate: range.startDate, endDate: range.endDate,
      filter_date: '', page_no: 1,
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

    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
      downloadFileName = `SML_Vyapar_Draft_Leads_${date}_${time}.csv`;
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
      downloadFileName = `SML_Vyapar_Draft_Leads_${query.startDate}_to_${query.endDate}.csv`;
    } else {
      downloadFileName = `SML_Vyapar_Draft_Leads_${date}_${time}.csv`;
    }

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
      const url = `${import.meta.env.VITE_API_URL}/vyapar-draft-leads/export?${urlParams.toString()}`;
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
    navigate(`/vyapar-draft-leads/${lead.id}`, { state: { lead } });
  };

  if (firstLoad) {
    return (
      <>
        <Toaster />
        <PremiumPageLoader
          theme="sky"
          title="Loading Vyapar Draft Leads"
          brandLabel="Live Vyapar Draft Leads"
          icon={FileText}
          phrases={[
            'Fetching draft leads…',
            'Resolving applicant details…',
            'Computing draft summaries…',
            'Polishing the table…',
          ]}
          tiles={[
            { label: 'Total drafts' },
            { label: 'OTP verified' },
            { label: 'Today' },
          ]}
          progressLabel="Preparing your drafts"
        />
      </>
    );
  }

  return (
    <>
      <Toaster />
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        isSubmitting={exportLoading}
      />
      <SummaryCards
        totalLeads={Number(summaryData.totalLeads) || 0}
        loading={loading}
      />
      <MainTable
        columns={draftLeadsNewColumn({ handleEdit })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={handleExport}
        title="Vyapar Draft Leads"
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
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
        professionOptions={summaryData.distinctProfessions}
        onClearAllFilters={handleClearAllFilters}
      />
    </>
  );
};

export default VyaparDraftLeads;
