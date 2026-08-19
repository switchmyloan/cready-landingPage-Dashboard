
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../../components/Table/MainTable';
import { getVyaparSelectedLenders, getVyaparDistinctLenders, getVyaparDistinctMediums } from '../../../api-services/Modules/Leads';
import { selectedLendersColumn } from '../../../components/TableHeader';
import ExportModal from '../../../components/ExportModal';
import ToastNotification from '../../../components/Notification/ToastNotification';
import { useAuth } from '../../../custom-hooks/useAuth';
import { getSalaryBand } from '../../../custom-hooks/callCenterBands';
import CallCenterBandBanner from '../../../components/CallCenterBandBanner';
import FeedbackStatusFilter from '../../../components/FeedbackStatusFilter';
import { Building2, Users } from 'lucide-react';
import PremiumPageLoader from '../../../components/PremiumPageLoader';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Vyapar-ticket lenders we ALWAYS surface as KPI cards. The vyapar backend stores
// raw lender names (no aliasing), so match case-insensitively.
const PINNED_LENDERS = [
  'RapidMoney', 'RamFinCorp', 'KreditBee', 'TrueBalance', 'CreditPlus',
  'MPokket', 'SmartCoin', 'LendingPlate', 'SpeedoLoan', 'LoanWalle', 'Cashvia',
];
const lenderKey = (s) => String(s || '').toLowerCase().trim();

const VyaparSelectedLenders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExport = ["super-admin", "vyapar-page-admin"].includes(user?.role);
  // Segmented call-center roles: force the lead's income/loan band (matched to
  // vyaparOfferLeads by phone in the backend).
  const salaryBand = getSalaryBand(user?.role);
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
    lenderWise: [],
    distinctStatuses: [],
  });
  const [lenderOptions, setLenderOptions] = useState([]);
  const [mediumOptions, setMediumOptions] = useState([]);

  // Hardcoded source baseline — same as the other vyapar dashboards.
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    filter_date: '',
    startDate: null,
    endDate: null,
    lenderName: '',
    status: '',
    medium: '',
    source: '',
    feedbackStatus: '',
  });

  useEffect(() => {
    const fetchLenders = async () => {
      try {
        const res = await getVyaparDistinctLenders();
        if (res?.data?.success) {
          setLenderOptions(res.data.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchLenders();
  }, []);

  // Medium dropdown options (vyapar mediums + rapidmoney baseline).
  useEffect(() => {
    let cancelled = false;
    getVyaparDistinctMediums()
      .then(res => {
        if (cancelled) return;
        const list = res?.data?.data || res?.data || [];
        const values = (Array.isArray(list) ? list : [])
          .map(x => (typeof x === 'string' ? x : x?.utm_medium))
          .filter(Boolean);
        setMediumOptions(Array.from(new Set(values)).sort());
      })
      .catch(err => console.error('Failed to load vyapar mediums', err));
    return () => { cancelled = true; };
  }, []);

  const fetchSelectedLenders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVyaparSelectedLenders({
        perPage: query.limit,
        currentPage: query.page_no,
        search: query.search,
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        lenderName: query.lenderName || undefined,
        status: query.status || undefined,
        medium: query.medium || undefined,
        source: query.source || undefined,
        // Forced for segmented call-center roles; undefined for everyone else.
        minMonthlyIncome: salaryBand ? salaryBand.minMonthlyIncome : undefined,
        maxMonthlyIncome: salaryBand ? (salaryBand.maxMonthlyIncome || undefined) : undefined,
        minLoanAmount: salaryBand ? salaryBand.minLoanAmount : undefined,
        feedbackStatus: query.feedbackStatus || undefined,
      });

      if (res?.data?.success) {
        setRawData(res?.data?.data || []);
        setFilteredCount(res?.data?.pagination?.total || 0);
        const s = res?.data?.summaryObj || {};
        setSummaryData({
          totalLeads: Number(s.total) || 0,
          lenderWise: Array.isArray(s.lenderWise) ? s.lenderWise : [],
          distinctStatuses: Array.isArray(s.distinctStatuses) ? s.distinctStatuses : [],
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [query.limit, query.page_no, query.search, query.filter_date, query.startDate, query.endDate, query.lenderName, query.status, query.medium, query.source, query.feedbackStatus, salaryBand]);

  useEffect(() => {
    fetchSelectedLenders();
  }, [fetchSelectedLenders]);

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

  const handleLenderFilter = useCallback(newLender => {
    setQuery(prev => ({ ...prev, lenderName: newLender, page_no: 1 }));
  }, []);

  const handleStatusFilter = useCallback(newStatus => {
    setQuery(prev => ({ ...prev, status: newStatus, page_no: 1 }));
  }, []);

  const handleMediumFilter = useCallback(newMedium => {
    setQuery(prev => ({ ...prev, medium: newMedium, page_no: 1 }));
  }, []);

  const handleSourceFilter = useCallback(newSource => {
    setQuery(prev => ({ ...prev, source: newSource, page_no: 1 }));
  }, []);

  const handleFeedbackFilter = useCallback(newFeedback => {
    setQuery(prev => ({ ...prev, feedbackStatus: newFeedback, page_no: 1 }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setQuery(prev => ({
      ...prev,
      page_no: 1,
      search: '',
      filter_date: '',
      startDate: null,
      endDate: null,
      lenderName: '',
      status: '',
      medium: '',
      source: '',
    }));
  }, []);

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async () => {
    setExportLoading(true);
    const urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "vyapar", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    // Date params mirror the table's own applied filter (same mapping as the list fetch).
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
    }
    // else: no date param -> export the whole current view.

    downloadFileName = (query.startDate && query.endDate)
      ? `SML_Vyapar_Selected_Lenders_${query.startDate}_to_${query.endDate}.csv`
      : `SML_Vyapar_Selected_Lenders_${date}_${time}.csv`;

    if (query.lenderName) urlParams.append("lenderName", query.lenderName);
    if (query.status) urlParams.append("status", query.status);
    if (query.medium) urlParams.append("medium", query.medium);
    if (query.source) urlParams.append("source", query.source);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/vyapar-selected-lenders/export?${urlParams.toString()}`;
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
    navigate(`/vyapar-selected-lenders/${lead.id}`, { state: { lead } });
  };

  // Card accent colors — cycled across however many lender cards we render.
  const topLenderColors = [
    { bg: 'bg-purple-50', text: 'text-purple-600' },
    { bg: 'bg-blue-50', text: 'text-blue-600' },
    { bg: 'bg-green-50', text: 'text-green-600' },
    { bg: 'bg-orange-50', text: 'text-orange-600' },
    { bg: 'bg-pink-50', text: 'text-pink-600' },
    { bg: 'bg-teal-50', text: 'text-teal-600' },
    { bg: 'bg-amber-50', text: 'text-amber-600' },
    { bg: 'bg-cyan-50', text: 'text-cyan-600' },
    { bg: 'bg-rose-50', text: 'text-rose-600' },
    { bg: 'bg-indigo-50', text: 'text-indigo-600' },
    { bg: 'bg-lime-50', text: 'text-lime-600' },
    { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600' },
  ];

  // Lender KPI cards = EVERY lender in the summary (their counts sum to Total
  // Leads — so the cards reconcile with the total), PLUS any pinned lender missing
  // from the period (shown as a 0 card so all expected lenders always appear).
  // lenderWise is already sorted by count desc. Deduped case-insensitively.
  const lenderCards = useMemo(() => {
    const lw = summaryData.lenderWise;
    const seen = new Set(lw.map((l) => lenderKey(l.lenderName)));
    const cards = [...lw];
    for (const name of PINNED_LENDERS) {
      const key = lenderKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({ lenderName: name, count: 0 });
    }
    return cards;
  }, [summaryData.lenderWise]);

  const SkeletonCard = () => (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-8 bg-gray-300 rounded w-3/4"></div>
    </div>
  );

  if (firstLoad) {
    return (
      <>
        <Toaster />
        <PremiumPageLoader
          theme="sky"
          title="Loading Vyapar Selected Lenders"
          brandLabel="Live Vyapar Lender Selections"
          icon={Building2}
          phrases={[
            'Fetching lender selections…',
            'Computing per-lender breakdown…',
            'Resolving applicant journeys…',
            'Polishing the table…',
          ]}
          tiles={[
            { label: 'Total clicks' },
            { label: 'Lenders' },
            { label: 'Today' },
          ]}
          progressLabel="Preparing the data"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Leads</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{summaryData.totalLeads.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">{summaryData.lenderWise.length} lenders</p>
              </div>
              <div className="p-3 rounded-full bg-indigo-50">
                <Users className="text-indigo-600" size={24} />
              </div>
            </div>

            {lenderCards.map((lender, idx) => {
              const colors = topLenderColors[idx % topLenderColors.length];
              const share = summaryData.totalLeads > 0
                ? ((lender.count / summaryData.totalLeads) * 100).toFixed(1)
                : '0.0';
              return (
                <div
                  key={lender.lenderName}
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer"
                  onClick={() => handleLenderFilter(lender.lenderName === query.lenderName ? '' : lender.lenderName)}
                  title="Click to filter by this lender"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-500 truncate">{lender.lenderName}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{(lender.count || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">{share}% share</p>
                  </div>
                  <div className={`p-3 rounded-full ${colors.bg} flex-shrink-0 ml-2`}>
                    <Building2 className={colors.text} size={24} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 mb-3">
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
        columns={selectedLendersColumn({ handleEdit })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchSelectedLenders}
        onExport={canExport ? handleExport : undefined}
        title="Vyapar Selected Lenders"
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        onLenderFilter={handleLenderFilter}
        activeLenderFilter={query.lenderName}
        lenderOptions={lenderOptions}
        onStatusFilter={handleStatusFilter}
        activeStatusFilter={query.status}
        statusOptions={summaryData.distinctStatuses}
        onClearAllFilters={handleClearAllFilters}
      />
    </>
  );
};

export default VyaparSelectedLenders;
