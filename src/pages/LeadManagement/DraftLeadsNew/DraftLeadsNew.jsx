
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../../components/Table/MainTable';
import { getDraftLeadsNew } from '../../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../../api-services/Modules/Disbursal';
import { draftLeadsNewColumn } from '../../../components/TableHeader';
import SummaryCards from '../../../components/Table/SummaryCards';
import ExportModal from '../../../components/ExportModal';
import ModuleInfoCard from '../../../components/ModuleInfoCard';
import ToastNotification from '../../../components/Notification/ToastNotification';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const DraftLeadsNew = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
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
    utmMedium: '',
    utmSource: '',
  });

  // Matches the /offer-leads and /kb-lending-page filters so the same set of
  // traffic sources is available across modules.
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
      const res = await getDraftLeadsNew({
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
        utmMedium: query.utmMedium || undefined,
        utmSource: query.utmSource || undefined,
      });
      if (res?.data?.success) {
        setRawData(res.data.data || []);
        setFilteredCount(res.data.pagination?.total || 0);
        const s = res.data.summaryObj || {};
        setSummaryData(prev => ({
          totalLeads: Number(s.total) || 0,
          // Keep distinctProfessions stable across requests so dropdown doesn't flicker
          distinctProfessions: Array.isArray(s.distinctProfessions) && s.distinctProfessions.length > 0
            ? s.distinctProfessions
            : prev.distinctProfessions,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    query.filter_date, query.startDate, query.endDate, query.limit, query.page_no, query.search,
    query.dobFromDate, query.dobToDate, query.minLoanAmount, query.maxLoanAmount,
    query.minSalary, query.maxSalary, query.profession, query.utmMedium, query.utmSource,
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

  const handleExportSubmit = async () => {
    setExportLoading(true);
    const urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    // Export the table's current view — mirror how the LIST fetch derives its
    // date params from the applied filter state (type / fromDate / toDate).
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
      downloadFileName = `SML_Draft_Leads_New_${date}_${time}.csv`;
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
      downloadFileName = `SML_Draft_Leads_New_${query.startDate}_to_${query.endDate}.csv`;
    } else {
      // No date filter applied — export the whole current view.
      downloadFileName = `SML_Draft_Leads_New_${date}_${time}.csv`;
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
      const url = `${import.meta.env.VITE_API_URL}/draft-leads-new/export?${urlParams.toString()}`;
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
    navigate(`/draft-leads-new/${lead.id}`, { state: { lead } });
  };

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

      {/* Filter strip — each filter wrapped in its own inline-flex block so
          flex-wrap breaks between groups (not inside one), keeping labels and
          selects together on every viewport. */}
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
        columns={draftLeadsNewColumn({ handleEdit })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={handleExport}
        title="Draft Leads (New)"
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

      <ModuleInfoCard
        title="High Draft Leads"
        subtitle="Applicants who started filling the form but did not complete it — the drop-off list."
        whatYouSee={[
          'Incomplete applications with whatever details the applicant managed to fill in (name, phone, salary, profession, etc.).',
          'Useful for retargeting calls, follow-ups, or identifying where applicants commonly abandon the form.',
          'Filters by age (DOB), loan amount, salary, and profession.',
        ]}
        dataSource={[
          'Each field the applicant fills is saved as they progress through the form.',
          'If they never reach the final Submit, the partial record stays here as a draft.',
          'Once an applicant successfully submits, that record moves to the Offer Leads list and is no longer shown here.',
        ]}
        flow={[
          'Applicant starts form',
          'Each field is auto-saved',
          'Applicant leaves without submitting',
          'Record stays as a draft',
          'Visible here for follow-up',
        ]}
      />
    </>
  );
};

export default DraftLeadsNew;
