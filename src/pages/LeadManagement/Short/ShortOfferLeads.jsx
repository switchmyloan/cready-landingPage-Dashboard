
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../../components/Table/MainTable';
import { getShortOfferLeads, getShortOfferLeadsFilterValues } from '../../../api-services/Modules/Leads';
import { offerLeadsColumn } from '../../../components/TableHeader';
import SummaryCards from '../../../components/Table/SummaryCards';
import ExportModal from '../../../components/ExportModal';
import ToastNotification from '../../../components/Notification/ToastNotification';
import { useAuth } from '../../../custom-hooks/useAuth';
import { getSalaryBand, isCallCenterRole } from '../../../custom-hooks/callCenterBands';
import { getCallCenterAgentId } from '../../../custom-hooks/callCenterPool';
import CallCenterBandBanner from '../../../components/CallCenterBandBanner';
import FeedbackStatusFilter from '../../../components/FeedbackStatusFilter';
import PremiumPageLoader from '../../../components/PremiumPageLoader';
import { ClipboardList } from 'lucide-react';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const ShortOfferLeads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExport = ["super-admin", "short-page-admin"].includes(user?.role);
  // Pooled call-center agent → list filtered to their assigned leads (backend
  // lead_assignments), so drop the salary band. Non-pooled accounts keep it.
  const agentId = useMemo(() => getCallCenterAgentId(user), [user]);
  const salaryBand = agentId ? null : getSalaryBand(user?.role);
  // Call-center agents don't work disbursement, so hide that filter for them.
  const isCallCenter = isCallCenterRole(user?.role);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [filteredCount, setFilteredCount] = useState(0);
  const [tablePagination, setTablePagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [summaryData, setSummaryData] = useState({
    totalLeads: 0,
    distinctLoanPurposes: [],
  });

  const [query, setQuery] = useState(() => {
    const base = {
      page_no: 1,
      limit: 10,
      search: '',
      filter_date: '',
      startDate: null,
      endDate: null,
      minLoanAmount: '',
      maxLoanAmount: '',
      dobFromDate: '',
      dobToDate: '',
      loanPurpose: '',
      minMonthlyIncome: '',
      maxMonthlyIncome: '',
      lender: '',
      disbStatus: '',
      pincode: '',
      employmentType: '',
      medium: '',
      source: '',
      feedbackStatus: '',
    };
    // Seed the locked band for segmented call-center roles.
    if (salaryBand) {
      base.minMonthlyIncome = String(salaryBand.minMonthlyIncome);
      base.maxMonthlyIncome = salaryBand.maxMonthlyIncome ? String(salaryBand.maxMonthlyIncome) : '';
      base.minLoanAmount = String(salaryBand.minLoanAmount);
    }
    return base;
  });

  // Filter dropdown options populated from DB on mount.
  const [pincodeOptions, setPincodeOptions] = useState([]);
  const [employmentTypeOptions, setEmploymentTypeOptions] = useState([]);
  const [mediumOptions, setMediumOptions] = useState([]);

  // Hardcoded source baseline — same approach as the User Track / Disbursal pages.
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  useEffect(() => {
    let cancelled = false;
    getShortOfferLeadsFilterValues()
      .then(res => {
        if (cancelled) return;
        const d = res?.data?.data || {};
        setPincodeOptions(d.pincodes || []);
        setEmploymentTypeOptions(d.employmentTypes || []);
        setMediumOptions(d.mediums || []);
      })
      .catch(err => console.error('Failed to load filter values:', err));
    return () => { cancelled = true; };
  }, []);

  const LENDER_OPTIONS = [
    { value: 'RapidMoney', label: 'RapidMoney' },
    { value: 'RamFinCorp', label: 'RamFinCorp' },
    { value: 'KreditBee', label: 'KreditBee' },
    { value: 'TrueBalance', label: 'TrueBalance' },
    { value: 'MPokket', label: 'MPokket' },
    { value: 'CreditPlus', label: 'CreditPlus' },
    { value: 'Loan112', label: 'Loan112' },
  ];

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      // When the agent picks "meta", drop the forced salary/loan band so meta leads
      // show for BOTH call-center segments regardless of their income/loan window.
      const dropBand = String(query.medium || '').toLowerCase() === 'meta';
      const res = await getShortOfferLeads({
        perPage: query.limit,
        currentPage: query.page_no,
        search: query.search,
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        // Segmented call-center roles: force the band — UNLESS "meta" is picked, then
        // drop it (dropBand) so meta leads aren't gated by the income/loan band.
        minLoanAmount: dropBand ? undefined : ((salaryBand ? salaryBand.minLoanAmount : query.minLoanAmount) || undefined),
        maxLoanAmount: dropBand ? undefined : (salaryBand ? undefined : (query.maxLoanAmount || undefined)),
        dobFromDate: query.dobFromDate || undefined,
        dobToDate: query.dobToDate || undefined,
        loanPurpose: query.loanPurpose || undefined,
        minMonthlyIncome: dropBand ? undefined : ((salaryBand ? salaryBand.minMonthlyIncome : query.minMonthlyIncome) || undefined),
        maxMonthlyIncome: dropBand ? undefined : (salaryBand ? (salaryBand.maxMonthlyIncome || undefined) : (query.maxMonthlyIncome || undefined)),
        lender: query.lender || undefined,
        disbStatus: query.disbStatus || undefined,
        pincode: query.pincode || undefined,
        employmentType: query.employmentType || undefined,
        medium: query.medium || undefined,
        source: query.source || undefined,
        feedbackStatus: query.feedbackStatus || undefined,
        // Customer-care view: one row per phone (latest by createdAt).
        distinct: isCallCenter ? 'true' : undefined,
        // Pooled call-center agent → backend filters to their assigned leads.
        agentId: agentId || undefined,
      });
      if (res?.data?.success) {
        setRawData(res?.data?.data?.data || []);
        setFilteredCount(res?.data?.data?.pagination?.total || 0);
        const s = res?.data?.data?.summaryObj || {};
        setSummaryData(prev => ({
          totalLeads: Number(s.total) || 0,
          distinctLoanPurposes: Array.isArray(s.distinctLoanPurposes) && s.distinctLoanPurposes.length > 0
            ? s.distinctLoanPurposes
            : prev.distinctLoanPurposes,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [
    query.limit, query.page_no, query.search, query.filter_date,
    query.startDate, query.endDate, query.minLoanAmount, query.maxLoanAmount,
    query.dobFromDate, query.dobToDate, query.loanPurpose,
    query.minMonthlyIncome, query.maxMonthlyIncome, query.lender,
    query.disbStatus, query.pincode, query.employmentType,
    query.medium, query.source, query.feedbackStatus, salaryBand, isCallCenter, agentId,
  ]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onPageChange = useCallback((pageInfo) => {
    setTablePagination({
      pageIndex: pageInfo.pageIndex,
      pageSize: pageInfo.pageSize,
    });
    setQuery((prevQuery) => ({
      ...prevQuery,
      page_no: pageInfo.pageIndex + 1,
      limit: pageInfo.pageSize,
    }));
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

  const handleLoanAmountApply = useCallback(({ min, max }) => {
    if (salaryBand) return; // loan floor locked for segmented call-center roles
    setQuery(prev => ({ ...prev, minLoanAmount: min, maxLoanAmount: max, page_no: 1 }));
  }, [salaryBand]);

  const handleLoanAmountClear = useCallback(() => {
    if (salaryBand) return;
    setQuery(prev => ({ ...prev, minLoanAmount: '', maxLoanAmount: '', page_no: 1 }));
  }, [salaryBand]);

  const handleDobRangeFilter = useCallback(({ startDate, endDate }) => {
    setQuery(prev => ({ ...prev, dobFromDate: startDate || '', dobToDate: endDate || '', page_no: 1 }));
  }, []);

  const handleLoanPurposeFilter = useCallback(newPurpose => {
    setQuery(prev => ({ ...prev, loanPurpose: newPurpose, page_no: 1 }));
  }, []);

  const handleMonthlyIncomeApply = useCallback(({ min, max }) => {
    if (salaryBand) return; // income band locked for segmented call-center roles
    setQuery(prev => ({ ...prev, minMonthlyIncome: min, maxMonthlyIncome: max, page_no: 1 }));
  }, [salaryBand]);

  const handleMonthlyIncomeClear = useCallback(() => {
    if (salaryBand) return;
    setQuery(prev => ({ ...prev, minMonthlyIncome: '', maxMonthlyIncome: '', page_no: 1 }));
  }, [salaryBand]);

  const handleClearAllFilters = useCallback(() => {
    setQuery(prev => ({
      ...prev,
      page_no: 1,
      search: '',
      filter_date: '',
      startDate: null,
      endDate: null,
      minLoanAmount: salaryBand ? String(salaryBand.minLoanAmount) : '',
      maxLoanAmount: '',
      dobFromDate: '',
      dobToDate: '',
      loanPurpose: '',
      // Segmented roles keep their forced band on "Clear all".
      minMonthlyIncome: salaryBand ? String(salaryBand.minMonthlyIncome) : '',
      maxMonthlyIncome: salaryBand && salaryBand.maxMonthlyIncome ? String(salaryBand.maxMonthlyIncome) : '',
      lender: '',
      disbStatus: '',
      pincode: '',
      employmentType: '',
      medium: '',
      source: '',
    }));
  }, [salaryBand]);

  const handleLenderFilter = useCallback((newLender) => {
    setQuery(prev => ({ ...prev, lender: newLender, page_no: 1 }));
  }, []);

  const handleMediumFilter = useCallback((newMedium) => {
    setQuery(prev => ({ ...prev, medium: newMedium, page_no: 1 }));
  }, []);

  const handleSourceFilter = useCallback((newSource) => {
    setQuery(prev => ({ ...prev, source: newSource, page_no: 1 }));
  }, []);

  const handleFeedbackFilter = useCallback((newFeedback) => {
    setQuery(prev => ({ ...prev, feedbackStatus: newFeedback, page_no: 1 }));
  }, []);

  const handleDisbStatusFilter = useCallback((newStatus) => {
    setQuery(prev => ({ ...prev, disbStatus: newStatus, page_no: 1 }));
  }, []);

  const handlePincodeFilter = useCallback((newPincode) => {
    setQuery(prev => ({ ...prev, pincode: newPincode, page_no: 1 }));
  }, []);

  const handleEmploymentTypeFilter = useCallback((newType) => {
    setQuery(prev => ({ ...prev, employmentType: newType, page_no: 1 }));
  }, []);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async () => {
    setExportLoading(true);
    const urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    // Date params come from the table's OWN applied filter (mirrors the list fetch):
    // preset type, else a custom range, else no date param (export the whole current view).
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
    }

    downloadFileName = (query.startDate && query.endDate)
      ? `SML_Short_Offer_Leads_${query.startDate}_to_${query.endDate}.csv`
      : `SML_Short_Offer_Leads_${date}_${time}.csv`;

    // meta → no income/loan band (mirrors the list fetch's dropBand): skip those
    // params so the CSV isn't band-limited for meta.
    const isMetaExport = String(query.medium || '').toLowerCase() === 'meta';
    if (query.search) urlParams.append("search", query.search);
    if (!isMetaExport && query.minLoanAmount) urlParams.append("minLoanAmount", query.minLoanAmount);
    if (!isMetaExport && query.maxLoanAmount) urlParams.append("maxLoanAmount", query.maxLoanAmount);
    if (query.dobFromDate) urlParams.append("dobFromDate", query.dobFromDate);
    if (query.dobToDate) urlParams.append("dobToDate", query.dobToDate);
    if (query.loanPurpose) urlParams.append("loanPurpose", query.loanPurpose);
    if (!isMetaExport && query.minMonthlyIncome) urlParams.append("minMonthlyIncome", query.minMonthlyIncome);
    if (!isMetaExport && query.maxMonthlyIncome) urlParams.append("maxMonthlyIncome", query.maxMonthlyIncome);
    if (query.medium) urlParams.append("medium", query.medium);
    if (query.source) urlParams.append("source", query.source);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/short-offer-leads/export?${urlParams.toString()}`;
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
    navigate(`/short-offer-leads/${lead.id}`, { state: { lead } });
  };

  if (firstLoad) {
    return (
      <>
        <Toaster />
        <PremiumPageLoader
          theme="sky"
          title="Loading Short Offer Leads"
          brandLabel="Live Short Offer Leads"
          icon={ClipboardList}
          phrases={[
            'Fetching short-ticket leads…',
            'Mapping lender responses…',
            'Resolving cities & profiles…',
            'Polishing the table…',
          ]}
          tiles={[
            { label: 'Total leads' },
            { label: 'Lenders' },
            { label: 'Submissions' },
          ]}
          progressLabel="Preparing your leads"
        />
      </>
    );
  }

  return (
    <>
      <Toaster />
      <CallCenterBandBanner band={salaryBand} />
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

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 my-3">
        {/* Lender (Success) */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Lender (Success)
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={query.lender}
              onChange={(e) => handleLenderFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
            >
              <option value="">All Lenders</option>
              {LENDER_OPTIONS.map((lender) => (
                <option key={lender.value} value={lender.value}>
                  {lender.label} — Success
                </option>
              ))}
            </select>
            {query.lender && (
              <button
                onClick={() => handleLenderFilter('')}
                title="Clear"
                className="flex items-center justify-center h-7 w-7 rounded-md bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition text-base leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Disbursement — hidden for call-center agents */}
        {!isCallCenter && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Disbursement
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={query.disbStatus}
                onChange={(e) => handleDisbStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
              >
                <option value="">All</option>
                <option value="disbursed">Disbursed Only</option>
                <option value="notDisbursed">Not Disbursed</option>
              </select>
              {query.disbStatus && (
                <button
                  onClick={() => handleDisbStatusFilter('')}
                  title="Clear"
                  className="flex items-center justify-center h-7 w-7 rounded-md bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition text-base leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* Medium */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Medium
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={query.medium}
              onChange={(e) => handleMediumFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[150px]"
            >
              <option value="">All Mediums</option>
              {mediumOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {query.medium && (
              <button
                onClick={() => handleMediumFilter('')}
                title="Clear"
                className="flex items-center justify-center h-7 w-7 rounded-md bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition text-base leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Source */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Source
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={query.source}
              onChange={(e) => handleSourceFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[150px]"
            >
              <option value="">All Sources</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {query.source && (
              <button
                onClick={() => handleSourceFilter('')}
                title="Clear"
                className="flex items-center justify-center h-7 w-7 rounded-md bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition text-base leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Feedback */}
        <div className="pb-0.5">
          <FeedbackStatusFilter value={query.feedbackStatus} onChange={handleFeedbackFilter} />
        </div>
      </div>

      <MainTable
        columns={offerLeadsColumn({ handleEdit })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={canExport ? handleExport : undefined}
        title="Short Offer Leads"
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        onLoanAmountFilter={handleLoanAmountApply}
        onLoanAmountClear={handleLoanAmountClear}
        activeLoanAmount={String(query.medium || '').toLowerCase() === 'meta' ? { min: '', max: '' } : { min: query.minLoanAmount, max: query.maxLoanAmount }}
        onDobRangeFilter={handleDobRangeFilter}
        activeDobRange={{ startDate: query.dobFromDate, endDate: query.dobToDate }}
        onLoanPurposeFilter={handleLoanPurposeFilter}
        activeLoanPurpose={query.loanPurpose}
        loanPurposeOptions={summaryData.distinctLoanPurposes}
        onMonthlyIncomeFilter={handleMonthlyIncomeApply}
        onMonthlyIncomeClear={handleMonthlyIncomeClear}
        activeMonthlyIncome={String(query.medium || '').toLowerCase() === 'meta' ? { min: '', max: '' } : { min: query.minMonthlyIncome, max: query.maxMonthlyIncome }}
        onPincodeFilter={handlePincodeFilter}
        activePincode={query.pincode}
        pincodeOptions={pincodeOptions}
        onEmploymentTypeFilter={handleEmploymentTypeFilter}
        activeEmploymentType={query.employmentType}
        employmentTypeOptions={employmentTypeOptions}
        onClearAllFilters={handleClearAllFilters}
      />
    </>
  );
};

export default ShortOfferLeads;
