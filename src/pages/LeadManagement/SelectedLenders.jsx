
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../components/Table/MainTable';
import { getSelectedLenders, getDistinctLenders } from '../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../api-services/Modules/Disbursal';
import { selectedLendersColumn } from '../../components/TableHeader';
import ExportModal from '../../components/ExportModal';
import ModuleInfoCard from '../../components/ModuleInfoCard';
import ToastNotification from '../../components/Notification/ToastNotification';
import { useAuth } from '../../custom-hooks/useAuth';
import { getSalaryBand } from '../../custom-hooks/callCenterBands';
import CallCenterBandBanner from '../../components/CallCenterBandBanner';
import FeedbackStatusFilter from '../../components/FeedbackStatusFilter';
import { Building2, Users } from 'lucide-react';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Lenders we ALWAYS surface as KPI cards, even when they fall outside the dynamic
// top-by-count set.
const PINNED_LENDERS = ['poonawalla', 'InCred', 'KreditBee', 'MoneyView', 'TrueBalance', 'Zype_Dedupe'];

// Mirror the backend's lender canonicalisation (selectedLenders.services.js) so a
// pinned name matches the summary's lenderWise entry — the raw "Zype_Dedupe" is
// merged into the canonical "Zype", so we must match/display on that.
const LENDER_ALIAS = {
  zype: 'Zype',
  zypededupe: 'Zype',
  poonawalla: 'Poonawalla',
  smartcoinhighintent: 'SmartCoinHighIntent',
  unitysmallfinancebank: 'Unity Small Finance Bank',
};
const canonicalLender = (name) => {
  const key = String(name || '').toLowerCase().replace(/[\s_]+/g, '');
  return LENDER_ALIAS[key] || String(name || '').trim();
};
const lenderKey = (name) => canonicalLender(name).toLowerCase();

// RapidMoney is a short-ticket lender — excluded from the high-ticket summary.
const isRapidMoney = (name) => {
  const k = lenderKey(name);
  return k === 'rapidmoney' || k === 'rpm';
};

const SelectedLenders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExport = ["super-admin", "mv-page-admin"].includes(user?.role);
  // Segmented call-center roles: force the lead's income/loan band on every fetch
  // (the backend matches each selected-lender row to its offerLeads by phone).
  const salaryBand = getSalaryBand(user?.role);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    // Default to "today" so a fresh visit lands on today's data instead of the
    // full historical list (kept consistent with the other high-ticket modules).
    filter_date: 'today',
    startDate: null,
    endDate: null,
    lenderName: '',
    status: '',
    utmMedium: '',
    utmSource: '',
    feedbackStatus: '',
  });

  // Same dropdown options as the other high-ticket pages so the filter UX
  // stays uniform across modules.
  const MEDIUM_OPTIONS = [
    // QuickLoans = our own landing-page traffic (utm_medium is NULL in the DB).
    { value: 'QuickLoans', label: 'QuickLoans' },
    { value: 'moneyview', label: 'moneyview' },
    { value: 'meta', label: 'meta' },
    { value: 'kreditbee', label: 'kreditbee' },
    { value: 'zype', label: 'zype' },
    { value: 'SC', label: 'SC' },
    { value: 'poonawalla', label: 'poonawalla' },
    { value: 'IDFC', label: 'IDFC' },
    { value: 'hero', label: 'hero' },
    // { value: 'kisht', label: 'kisht' },
    { value: 'truebalance', label: 'truebalance' },
    { value: 'ramfincorp', label: 'ramfincorp' },
    { value: 'mpokket', label: 'mpokket' },
    { value: 'creditplus', label: 'creditplus' },
    { value: 'LendingPlate', label: 'LendingPlate' },
    { value: 'incred', label: 'incred' },
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
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  // Fetch distinct lenders for dropdown
  useEffect(() => {
    const fetchLenders = async () => {
      try {
        const res = await getDistinctLenders();
        if (res?.data?.success) {
          setLenderOptions(res.data.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchLenders();
  }, []);

  const fetchSelectedLenders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSelectedLenders({
        perPage: query.limit,
        currentPage: query.page_no,
        search: query.search,
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        lenderName: query.lenderName || undefined,
        status: query.status || undefined,
        utmMedium: query.utmMedium || undefined,
        utmSource: query.utmSource || undefined,
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
    }
  }, [query.limit, query.page_no, query.search, query.filter_date, query.startDate, query.endDate, query.lenderName, query.status, query.utmMedium, query.utmSource, query.feedbackStatus, salaryBand]);

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

  const handleUtmMediumFilter = useCallback(newMedium => {
    setQuery(prev => ({ ...prev, utmMedium: newMedium, page_no: 1 }));
  }, []);

  const handleUtmSourceFilter = useCallback(newSource => {
    setQuery(prev => ({ ...prev, utmSource: newSource, page_no: 1 }));
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
      downloadFileName = `SML_Selected_Lenders_${date}_${time}.csv`;
    } else if (mode === "range" && startDate && endDate) {
      urlParams.append("fromDate", startDate);
      urlParams.append("toDate", endDate);
      downloadFileName = `SML_Selected_Lenders_${startDate}_to_${endDate}.csv`;
    } else {
      ToastNotification.error("Please select valid export filter.");
      setExportLoading(false);
      return;
    }

    if (query.lenderName) {
      urlParams.append("lenderName", query.lenderName);
    }

    if (query.status) {
      urlParams.append("status", query.status);
    }

    if (query.utmMedium) {
      urlParams.append("utmMedium", query.utmMedium);
    }

    if (query.utmSource) {
      urlParams.append("utmSource", query.utmSource);
    }

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/selected-lenders/export?${urlParams.toString()}`;
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
    navigate(`/selected-lenders/${lead.id}`, { state: { lead } });
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
  ];

  // Strip RapidMoney (short-ticket) from the high-ticket summary so BOTH the Total
  // and the cards reflect high-ticket only. rapidMoneyCount is subtracted from the
  // total; displayLenderWise drops the RapidMoney row.
  const rapidMoneyCount = useMemo(
    () => summaryData.lenderWise
      .filter((l) => isRapidMoney(l.lenderName))
      .reduce((s, l) => s + (Number(l.count) || 0), 0),
    [summaryData.lenderWise]
  );
  const displayLenderWise = useMemo(
    () => summaryData.lenderWise.filter((l) => !isRapidMoney(l.lenderName)),
    [summaryData.lenderWise]
  );
  const displayTotal = Math.max(0, (summaryData.totalLeads || 0) - rapidMoneyCount);

  // Lender KPI cards = EVERY (canonical) lender in the summary (RapidMoney removed),
  // so the card counts reconcile with the adjusted Total. PLUS any pinned lender
  // missing from the period, shown as a 0 card. Deduped case-insensitively.
  const lenderCards = useMemo(() => {
    const lw = displayLenderWise;
    const seen = new Set(lw.map((l) => lenderKey(l.lenderName)));
    const cards = [...lw];
    for (const name of PINNED_LENDERS) {
      const key = lenderKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({ lenderName: canonicalLender(name), count: 0 });
    }
    return cards;
  }, [displayLenderWise]);

  // Leads with NO lender attributed = Total − Σ per-lender counts. Rendered as a
  // separate "No Lender" card so the KPI row visibly adds up to Total Leads.
  const attributedTotal = useMemo(
    () => displayLenderWise.reduce((s, l) => s + (Number(l.count) || 0), 0),
    [displayLenderWise]
  );
  const unattributed = Math.max(0, displayTotal - attributedTotal);

  // Shared shimmer pattern (animate-shimmer keyframe in tailwind.config.js) —
  // keeps the loading look uniform with SummaryCards, MainTable and the
  // analytics page.
  const SkeletonCard = () => (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="h-4 w-1/2 rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer mb-3" />
      <div className="h-8 w-3/4 rounded-md bg-gradient-to-r from-indigo-100 via-purple-200 to-indigo-100 bg-[length:200%_100%] animate-shimmer" />
    </div>
  );

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

      {/* Total + Top Lenders Summary Cards */}
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
                <p className="mt-1 text-2xl font-bold text-gray-900">{displayTotal.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">{displayLenderWise.length} lenders</p>
              </div>
              <div className="p-3 rounded-full bg-indigo-50">
                <Users className="text-indigo-600" size={24} />
              </div>
            </div>

            {lenderCards.map((lender, idx) => {
              const colors = topLenderColors[idx % topLenderColors.length];
              const share = displayTotal > 0
                ? ((lender.count / displayTotal) * 100).toFixed(1)
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

            {/* Leads with no lender attributed — makes the row add up to Total. */}
            {unattributed > 0 && (
              <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">No Lender</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{unattributed.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {displayTotal > 0 ? ((unattributed / displayTotal) * 100).toFixed(1) : '0.0'}% · unattributed
                  </p>
                </div>
                <div className="p-3 rounded-full bg-gray-100 flex-shrink-0 ml-2">
                  <Building2 className="text-gray-400" size={24} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Medium + Source filter strip — matches the /offer-leads page so the
          two surfaces can be sliced by the same UTM dimensions. */}
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

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <FeedbackStatusFilter value={query.feedbackStatus} onChange={handleFeedbackFilter} />
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
        title="Selected Lenders"
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

      <ModuleInfoCard
        title="High Selected Lenders"
        subtitle="Tracks every 'Apply' click an applicant makes on a lender card."
        whatYouSee={[
          'One row per applicant-lender click — who clicked which lender.',
          'A summary of which lenders are getting the most clicks.',
          'Status of each click (success / reject / pending, etc.) returned by the lender.',
          'Export includes the lender-specific Lead ID (for KreditBee, MoneyView, etc.) so the finance team can reconcile.',
        ]}
        dataSource={[
          'Records are created the moment an applicant presses Apply on any lender card on the offer page.',
          'At export time, this list is enriched with the lender response from the main applicant record (matched by phone number).',
        ]}
        flow={[
          'Applicant viewing offers',
          'Presses Apply on a lender',
          'Click recorded',
          "Lender's apply API called",
          'Outcome stored',
          'Row appears here',
        ]}
      />
    </>
  );
};

export default SelectedLenders;
