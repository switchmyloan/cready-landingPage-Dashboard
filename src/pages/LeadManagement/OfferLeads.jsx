
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainTable from '../../components/Table/MainTable';
import { getOfferLeads, getOfferLeadsLenderKeys, getOfferLeadsFilterValues } from '../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../api-services/Modules/Disbursal';
import { offerLeadsColumn } from '../../components/TableHeader';
import SummaryCards from '../../components/Table/SummaryCards';
import OfferLeadsLenderStatsChart from '../../components/OfferLeadsLenderStatsChart';
import ExportModal from '../../components/ExportModal';
import ModuleInfoCard from '../../components/ModuleInfoCard';
import ToastNotification from '../../components/Notification/ToastNotification';
import { useAuth } from '../../custom-hooks/useAuth';
import { getSalaryBand, isCallCenterRole } from '../../custom-hooks/callCenterBands';
import { getRoundRobin } from '../../custom-hooks/callCenterPool';
import CallCenterBandBanner from '../../components/CallCenterBandBanner';
import { FEEDBACK_STATUSES } from '../../components/LeadFeedback/LeadFeedback';
import { Link } from 'react-router-dom';
import { BarChart3, ClipboardList, Sparkles } from 'lucide-react';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};


// Persist filters + pagination across navigation (e.g. user clicks the view
// icon, lands on the detail page, then hits browser back). Without this, the
// query state re-initializes to defaults and the user has to re-apply every
// filter. sessionStorage scopes this to the current browser tab/session so
// it clears naturally on tab close.
const FILTERS_STORAGE_KEY = 'offerLeads:filters:v1';

const loadPersistedState = () => {
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const OfferLeads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExport = ["super-admin", "mv-page-admin"].includes(user?.role);
  // Round-robin: when this agent is in the flat call-center pool, leads are
  // split by hash(phone) shard instead of by salary band. So for pooled agents
  // we DROP the band (rr is the sole divider); non-pooled call-center accounts
  // keep their band as a fallback.
  const rr = useMemo(() => getRoundRobin(user), [user]);
  // Non-null only for the two salary-segmented call-center roles NOT in the pool.
  // When set, the income/loan band is forced on every fetch and filters locked.
  const salaryBand = rr ? null : getSalaryBand(user?.role);
  // Call-center agents don't work disbursement, so hide that filter for them.
  const isCallCenter = isCallCenterRole(user?.role);
  // Hydrate filters / pagination from sessionStorage if user is returning from
  // a detail page. Computed once on first render; ignored on subsequent renders.
  const persisted = useMemo(() => loadPersistedState(), []);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);
  // Premium first-load gate — shown once until the first leads payload arrives,
  // then drops to in-place table loading state. Mirrors the pattern used on
  // /disbursal-dashboard and /offer-leads-analytics. Skip the animation entirely
  // when returning from a detail page so the user goes straight back to their
  // filtered table.
  const [firstLoad, setFirstLoad] = useState(!persisted);
  const [loaderPhrase, setLoaderPhrase] = useState(0);
  // Fake progress — asymptotically eases toward 95% so the bar always feels
  // alive without overpromising. Snaps to 100 just before the loader unmounts.
  const [loaderPct, setLoaderPct] = useState(8);
  const LOADER_PHRASES = [
    'Fetching offer leads…',
    'Mapping lender responses…',
    'Computing success rates…',
    'Resolving cities & profiles…',
    'Polishing the table…',
  ];

  useEffect(() => {
    if (!firstLoad) return;
    const phraseId = setInterval(
      () => setLoaderPhrase((i) => (i + 1) % LOADER_PHRASES.length),
      1400
    );
    const pctId = setInterval(
      () => setLoaderPct((p) => Math.min(p + Math.max((95 - p) * 0.12, 0.5), 95)),
      220
    );
    return () => { clearInterval(phraseId); clearInterval(pctId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstLoad]);
  const [tablePagination, setTablePagination] = useState(
    persisted?.tablePagination && typeof persisted.tablePagination === 'object'
      ? { pageIndex: 0, pageSize: 10, ...persisted.tablePagination }
      : { pageIndex: 0, pageSize: 10 }
  );
  const [summaryData, setSummaryData] = useState({
    totalLeads: 0,
    distinctLoanPurposes: [],
  });

  const DEFAULT_QUERY = {
    page_no: 1,
    limit: 10,
    search: '',
    // Default to "" (All) — no date filter on first load so the user sees
    // the full historical leads list. They can pick Today / Yesterday /
    // Custom Range explicitly from the toolbar.
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
    city: '',
    employmentType: '',
    utmMedium: '',
    utmSource: '',
    feedbackStatus: '',
    trackingEvent: '',
    hotLeads: '',
  };

  const [query, setQuery] = useState(() => {
    const base = persisted?.query && typeof persisted.query === 'object'
      ? { ...DEFAULT_QUERY, ...persisted.query }
      : DEFAULT_QUERY;
    // For segmented roles, always seed (and override any persisted value) with
    // the forced band so the locked filters reflect reality from first paint.
    if (salaryBand) {
      return {
        ...base,
        minMonthlyIncome: String(salaryBand.minMonthlyIncome),
        maxMonthlyIncome: salaryBand.maxMonthlyIncome ? String(salaryBand.maxMonthlyIncome) : '',
        minLoanAmount: String(salaryBand.minLoanAmount),
        maxLoanAmount: '',
      };
    }
    return base;
  });

  // Persist filter + pagination state on every change so back-navigation from
  // the detail page restores exactly where the user left off.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ query, tablePagination })
      );
    } catch {
      // sessionStorage can throw in private-mode browsers; silently ignore.
    }
  }, [query, tablePagination]);

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
    { value: 'vivifi', label: 'vivifi' },
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

  // Hardcoded baseline so the dropdown always has at least one option even
  // when the DB has no rows with utm_source set yet. Same approach as the
  // Disbursal Dashboard.
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  // Friendly display labels for known lender keys. Anything missing falls back
  // to the raw key from the DB.
  const LENDER_LABEL_OVERRIDES = {
    SmartCoinHighIntent: 'Smart Coin (High Intent)',
    smartCoin: 'Smart Coin',
    Zype_Dedupe: 'Zype',
    trueBalance: 'TrueBalance',
    poonawalla: 'Poonawalla',
    vivifi: 'Vivifi',
    HeroFinCorp: 'Hero FinCorp',
    'InCred Dedupe': 'InCred (Dedupe)',
    RamFinCorp: 'RamFinCorp',
    AyeFinance: 'Aye Finance',
    FlexiLoans: 'FlexiLoans',
    'IDFC First Bank': 'IDFC First Bank',
  };

  // Lender dropdown options — populated from the DB so it always reflects the
  // actual keys present in offerLeads.lender_response.
  const [lenderOptions, setLenderOptions] = useState([]);
  // City + employment type dropdown values, also from DB. Cities are derived
  // server-side from distinct pincodes via india-pincode-lookup.
  const [cityOptions, setCityOptions] = useState([]);
  const [employmentTypeOptions, setEmploymentTypeOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getOfferLeadsLenderKeys()
      .then(res => {
        if (cancelled) return;
        const keys = res?.data?.data || [];
        const opts = keys.map(k => ({
          value: k,
          label: LENDER_LABEL_OVERRIDES[k] || k,
        }));
        setLenderOptions(opts);
      })
      .catch(err => console.error('Failed to load lender keys:', err));

    getOfferLeadsFilterValues()
      .then(res => {
        if (cancelled) return;
        const d = res?.data?.data || {};
        setCityOptions(d.cities || []);
        setEmploymentTypeOptions(d.employmentTypes || []);
      })
      .catch(err => console.error('Failed to load filter values:', err));

    return () => { cancelled = true; };
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      // "meta" → NO band limit at all: the agent sees ALL meta leads regardless
      // of monthly income / loan amount (the segment band is dropped entirely
      // for meta — no income split, no loan gate).
      const isMeta = String(query.utmMedium || '').toLowerCase() === 'meta';
      const res = await getOfferLeads({
        perPage: query.limit,
        currentPage: query.page_no,
        search: query.search,
        type: query.filter_date || undefined,
        fromDate: query.startDate || undefined,
        toDate: query.endDate || undefined,
        // Segmented call-center roles: force the band — except for "meta" (see above).
        minLoanAmount: isMeta ? undefined : ((salaryBand ? salaryBand.minLoanAmount : query.minLoanAmount) || undefined),
        maxLoanAmount: isMeta ? undefined : (salaryBand ? undefined : (query.maxLoanAmount || undefined)),
        dobFromDate: query.dobFromDate || undefined,
        dobToDate: query.dobToDate || undefined,
        loanPurpose: query.loanPurpose || undefined,
        minMonthlyIncome: isMeta ? undefined : ((salaryBand ? salaryBand.minMonthlyIncome : query.minMonthlyIncome) || undefined),
        maxMonthlyIncome: isMeta ? undefined : (salaryBand ? (salaryBand.maxMonthlyIncome || undefined) : (query.maxMonthlyIncome || undefined)),
        lender: query.lender || undefined,
        disbStatus: query.disbStatus || undefined,
        city: query.city || undefined,
        employmentType: query.employmentType || undefined,
        utmMedium: query.utmMedium || undefined,
        utmSource: query.utmSource || undefined,
        feedbackStatus: query.feedbackStatus || undefined,
        trackingEvent: query.trackingEvent || undefined,
        // Hot Leads: only leads where the selected lender ('all' = any) returned a success.
        hotLeads: query.hotLeads || undefined,
        // Customer-care view: one row per phone (latest by createdAt).
        distinct: isCallCenter ? 'true' : undefined,
        // Round-robin shard for pooled call-center agents.
        rrSlot: rr?.rrSlot,
        rrTotal: rr?.rrTotal,
      });
      if (res?.data?.success) {
        setRawData(res?.data?.data?.data || []);
        setFilteredCount(res?.data?.data?.pagination?.total || 0);
        const s = res?.data?.data?.summaryObj || {};
        setSummaryData(prev => ({
          totalLeads: Number(s.total) || 0,
          // Keep distinctLoanPurposes stable across requests so dropdown doesn't flicker on filter change
          distinctLoanPurposes: Array.isArray(s.distinctLoanPurposes) && s.distinctLoanPurposes.length > 0
            ? s.distinctLoanPurposes
            : prev.distinctLoanPurposes,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setFirstLoad(false);  // first fetch done — drop premium loader
    }
  }, [
    query.limit, query.page_no, query.search, query.filter_date,
    query.startDate, query.endDate, query.minLoanAmount, query.maxLoanAmount,
    query.dobFromDate, query.dobToDate, query.loanPurpose,
    query.minMonthlyIncome, query.maxMonthlyIncome, query.lender,
    query.disbStatus, query.city, query.employmentType, query.utmMedium, query.utmSource,
    query.feedbackStatus, query.trackingEvent, query.hotLeads, salaryBand, isCallCenter, rr,
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
    // Guard: only reset to page 1 when the term actually changed. MainTable
    // re-fires onSearch with the restored term on mount; without this guard
    // that would knock the restored page back to 1 (UI/data mismatch).
    setQuery(prev => (prev.search === term ? prev : { ...prev, search: term, page_no: 1 }));
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
    if (salaryBand) return; // loan floor is locked for segmented call-center roles
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
    if (salaryBand) return; // income band is locked for segmented call-center roles
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
      // Segmented roles keep their forced band on "Clear all".
      minLoanAmount: salaryBand ? String(salaryBand.minLoanAmount) : '',
      maxLoanAmount: '',
      dobFromDate: '',
      dobToDate: '',
      loanPurpose: '',
      minMonthlyIncome: salaryBand ? String(salaryBand.minMonthlyIncome) : '',
      maxMonthlyIncome: salaryBand && salaryBand.maxMonthlyIncome ? String(salaryBand.maxMonthlyIncome) : '',
      lender: '',
      disbStatus: '',
      city: '',
      employmentType: '',
      utmMedium: '',
      utmSource: '',
      trackingEvent: '',
      hotLeads: '',
    }));
  }, [salaryBand]);

  const handleLenderFilter = useCallback((newLender) => {
    setQuery(prev => ({ ...prev, lender: newLender, page_no: 1 }));
  }, []);

  const handleCityFilter = useCallback((newCity) => {
    setQuery(prev => ({ ...prev, city: newCity, page_no: 1 }));
  }, []);

  const handleEmploymentTypeFilter = useCallback((newType) => {
    setQuery(prev => ({ ...prev, employmentType: newType, page_no: 1 }));
  }, []);

  const handleDisbStatusFilter = useCallback((newStatus) => {
    setQuery(prev => ({ ...prev, disbStatus: newStatus, page_no: 1 }));
  }, []);

  const handleUtmMediumFilter = useCallback((newMedium) => {
    setQuery(prev => ({ ...prev, utmMedium: newMedium, page_no: 1 }));
  }, []);

  const handleUtmSourceFilter = useCallback((newSource) => {
    setQuery(prev => ({ ...prev, utmSource: newSource, page_no: 1 }));
  }, []);

  const handleFeedbackFilter = useCallback((newFeedback) => {
    setQuery(prev => ({ ...prev, feedbackStatus: newFeedback, page_no: 1 }));
  }, []);

  const handleTrackingFilter = useCallback((newTracking) => {
    setQuery(prev => ({ ...prev, trackingEvent: newTracking, page_no: 1 }));
  }, []);

  // Hot Leads filter — leads where the selected lender ('all' = any) returned a success.
  const handleHotLeadsFilter = useCallback((value) => {
    setQuery(prev => ({ ...prev, hotLeads: value, page_no: 1 }));
  }, []);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

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
      downloadFileName = `SML_Offer_Leads_${date}_${time}.csv`;
    } else if (mode === "range" && startDate && endDate) {
      urlParams.append("fromDate", startDate);
      urlParams.append("toDate", endDate);
      downloadFileName = `SML_Offer_Leads_${startDate}_to_${endDate}.csv`;
    } else {
      ToastNotification.error("Please select valid export filter.");
      setExportLoading(false);
      return;
    }

    // Apply currently active filters to export so CSV matches what user sees.
    // meta → no income/loan band (mirrors the list fetch): skip those params.
    const isMetaExport = String(query.utmMedium || '').toLowerCase() === 'meta';
    if (query.search) urlParams.append("search", query.search);
    if (!isMetaExport && query.minLoanAmount) urlParams.append("minLoanAmount", query.minLoanAmount);
    if (!isMetaExport && query.maxLoanAmount) urlParams.append("maxLoanAmount", query.maxLoanAmount);
    if (query.dobFromDate) urlParams.append("dobFromDate", query.dobFromDate);
    if (query.dobToDate) urlParams.append("dobToDate", query.dobToDate);
    if (query.loanPurpose) urlParams.append("loanPurpose", query.loanPurpose);
    if (!isMetaExport && query.minMonthlyIncome) urlParams.append("minMonthlyIncome", query.minMonthlyIncome);
    if (!isMetaExport && query.maxMonthlyIncome) urlParams.append("maxMonthlyIncome", query.maxMonthlyIncome);
    if (query.utmMedium) urlParams.append("utmMedium", query.utmMedium);
    if (query.utmSource) urlParams.append("utmSource", query.utmSource);
    if (query.lender) urlParams.append("lender", query.lender);
    if (query.disbStatus) urlParams.append("disbStatus", query.disbStatus);
    if (query.city) urlParams.append("city", query.city);
    if (query.employmentType) urlParams.append("employmentType", query.employmentType);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/offer-leads/export?${urlParams.toString()}`;
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
    navigate(`/offer-leads/${lead.id}`, { state: { lead } });
  };

  // Premium first-load loader — purple/indigo theme matching the High Offer
  // Leads brand. Glassmorphism frosted card, floating ₹ symbols (money theme),
  // conic-gradient glow ring, SVG gradient arc + counter-ring + ripple,
  // sparkles, gold ₹ badge, mini KPI tile teasers, ticking progress %, and
  // "Secure · Encrypted" footer. Sidebar / topbar stay visible (rendered
  // inside the page container, no fixed inset-0 overlay).
  if (firstLoad) {
    return (
      <>
        <Toaster />
        <div className="max-w-[1440px] mx-auto px-2 pb-10">
          <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden rounded-2xl">

            {/* Layered mesh background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-purple-50/40 to-indigo-50/50" />

            {/* Floating ₹ symbols */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {[
                { top: '8%',  left: '10%', size: 'text-5xl', op: 0.06, delay: '0s'   },
                { top: '20%', left: '82%', size: 'text-6xl', op: 0.07, delay: '1s'   },
                { top: '55%', left: '5%',  size: 'text-7xl', op: 0.05, delay: '0.5s' },
                { top: '72%', left: '85%', size: 'text-5xl', op: 0.06, delay: '1.5s' },
                { top: '88%', left: '38%', size: 'text-4xl', op: 0.05, delay: '0.8s' },
                { top: '32%', left: '50%', size: 'text-3xl', op: 0.04, delay: '2s'   },
              ].map((s, i) => (
                <span
                  key={i}
                  className={`absolute font-black text-indigo-900 ${s.size} animate-pulse`}
                  style={{ top: s.top, left: s.left, opacity: s.op, animationDelay: s.delay, animationDuration: '4s' }}
                >₹</span>
              ))}
            </div>

            {/* Floating gradient blobs for depth */}
            <div className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-purple-300/30 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-indigo-300/30 blur-3xl animate-pulse" style={{ animationDelay: '0.8s' }} />
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] rounded-full bg-amber-200/15 blur-3xl" />

            {/* Card wrapper with rotating conic-gradient glow border */}
            <div className="relative max-w-md w-full mx-4">

              <div
                className="absolute -inset-[1.5px] rounded-3xl opacity-70 blur-[2px]"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0%, #a855f7 22%, #6366f1 38%, transparent 55%, transparent 100%)',
                  animation: 'spin 4s linear infinite',
                }}
              />

              {/* Glassmorphism card */}
              <div className="relative z-10 flex flex-col items-center gap-6 px-10 py-12 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-2xl shadow-purple-500/15">

                {/* Icon zone */}
                <div className="relative w-36 h-36 flex items-center justify-center">

                  {/* Twinkling sparkles */}
                  <Sparkles size={12} className="absolute top-1  left-3  text-amber-400  animate-pulse" style={{ animationDelay: '0s',   animationDuration: '1.8s' }} />
                  <Sparkles size={10} className="absolute top-4  right-2 text-purple-400  animate-pulse" style={{ animationDelay: '0.6s', animationDuration: '2.2s' }} />
                  <Sparkles size={11} className="absolute bottom-2 left-5 text-indigo-400 animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '2s'   }} />
                  <Sparkles size={9}  className="absolute bottom-5 right-4 text-amber-300 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2.4s' }} />

                  {/* Outer rotating gradient arc */}
                  <svg
                    className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)]"
                    viewBox="0 0 100 100"
                    style={{ animation: 'spin 3.5s linear infinite' }}
                  >
                    <defs>
                      <linearGradient id="offerArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%"   stopColor="#a855f7" />
                        <stop offset="50%"  stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#ede9fe" strokeWidth="2" />
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#offerArcGrad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 220" />
                  </svg>

                  {/* Inner counter-rotating ring */}
                  <div
                    className="absolute inset-5 rounded-full border-[1.5px] border-indigo-200/40 border-b-indigo-500 border-r-indigo-500"
                    style={{ animation: 'spin 2.2s linear infinite reverse' }}
                  />

                  {/* Expanding ripple ring */}
                  <div className="absolute inset-8 rounded-2xl border-2 border-purple-400/50 animate-ping" style={{ animationDuration: '2.5s' }} />

                  {/* Pulsing inner halo */}
                  <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-500/25 to-indigo-500/25 blur-xl animate-pulse" />

                  {/* Icon card with gold ₹ sparkle badge */}
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-purple-500/40 ring-1 ring-white/30">
                    <ClipboardList size={28} className="text-white drop-shadow-md" />
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md shadow-amber-400/50 ring-2 ring-white">
                      <span className="text-[9px] font-black text-amber-900 leading-none">₹</span>
                    </div>
                  </div>
                </div>

                {/* Brand pill + title + rotating phrase */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/50">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500" />
                    </span>
                    <span className="text-[10.5px] font-semibold tracking-[0.12em] text-purple-700 uppercase">Live Offer Leads</span>
                  </div>
                  <h2 className="text-[23px] font-bold bg-gradient-to-r from-purple-800 via-violet-700 to-indigo-800 bg-clip-text text-transparent tracking-tight leading-tight">
                    Loading High Offer Leads
                  </h2>

                  <div className="mt-3 h-5 overflow-hidden">
                    <p
                      key={loaderPhrase}
                      className="text-[13px] text-gray-600 font-medium"
                      style={{ animation: 'pulse 0.6s ease-out' }}
                    >
                      {LOADER_PHRASES[loaderPhrase]}
                    </p>
                  </div>
                </div>

                {/* Mini KPI tile teasers — mirror the 3 summary tiles */}
                <div className="grid grid-cols-3 gap-2 w-full">
                  {[
                    { label: 'Total leads',  tint: 'from-purple-100/80 to-purple-50' },
                    { label: 'Lenders',      tint: 'from-violet-100/80 to-violet-50' },
                    { label: 'Submissions',  tint: 'from-indigo-100/80 to-indigo-50' },
                  ].map((t, i) => (
                    <div
                      key={i}
                      className={`relative h-14 rounded-xl bg-gradient-to-br ${t.tint} border border-purple-200/40 p-2 overflow-hidden`}
                    >
                      <span className="text-[8.5px] font-semibold text-purple-700/70 tracking-wider uppercase">{t.label}</span>
                      <div className="mt-1 h-3 w-2/3 rounded bg-gradient-to-r from-purple-200/80 via-violet-300/70 to-indigo-200/80 bg-[length:200%_100%] animate-shimmer" />
                    </div>
                  ))}
                </div>

                {/* Premium progress bar */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] text-gray-500 font-medium">Preparing your leads</span>
                    <span className="text-[11.5px] font-bold tabular-nums bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">
                      {Math.round(loaderPct)}%
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-purple-100/70 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 transition-[width] duration-500 ease-out"
                      style={{ width: `${loaderPct}%`, boxShadow: '0 0 12px rgba(139,92,246,0.6)' }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer bg-[length:200%_100%]"
                      style={{ width: `${loaderPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-gray-400 font-semibold tracking-[0.14em] uppercase">Secure · Encrypted</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500  animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500  animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <CallCenterBandBanner band={salaryBand} />
      {/* {canExport && (
        <div className="flex justify-end mb-4">
          <Link
            to="/offer-leads-analytics"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all shadow-sm"
          >
            <BarChart3 size={16} />
            Analytics Dashboard
          </Link>
        </div>
      )} */}
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
      {/* <OfferLeadsLenderStatsChart
        filterType={query.filter_date}
        fromDate={query.startDate}
        toDate={query.endDate}
        utmMedium={query.utmMedium}
      /> */}

      {/* ─── ALIGNED FILTER GRID ───
          Equal-width cells so every filter aligns regardless of label length.
          1 col mobile · 2 cols tablet · 4 cols desktop. Each cell stacks
          its label above the select so heights match exactly. */}
      <div className="relative bg-white border border-purple-100 rounded-xl shadow-sm shadow-purple-500/5 px-4 py-3 my-3 overflow-hidden">
        {/* Subtle left accent stripe */}
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-purple-500 to-indigo-500" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pl-2">
          {/* Lender */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-gray-500">
              Lender
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={query.lender}
                onChange={(e) => handleLenderFilter(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
              >
                <option value="">All Lenders</option>
                {lenderOptions.map((lender) => (
                  <option key={lender.value} value={lender.value}>{lender.label}</option>
                ))}
              </select>
              {query.lender && (
                <button
                  onClick={() => handleLenderFilter('')}
                  className="text-[11px] px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition flex-shrink-0"
                  title="Clear lender filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Disbursement — hidden for call-center agents */}
          {!isCallCenter && (
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-gray-500">
                Disbursement
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={query.disbStatus}
                  onChange={(e) => handleDisbStatusFilter(e.target.value)}
                  className="flex-1 min-w-0 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
                >
                  <option value="">All</option>
                  <option value="disbursed">Disbursed Only</option>
                  <option value="notDisbursed">Not Disbursed</option>
                </select>
                {query.disbStatus && (
                  <button
                    onClick={() => handleDisbStatusFilter('')}
                    className="text-[11px] px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition flex-shrink-0"
                    title="Clear disbursement filter"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Medium */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-gray-500">
              Medium
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={query.utmMedium}
                onChange={(e) => handleUtmMediumFilter(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
              >
                <option value="">All Mediums</option>
                {mediumOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {query.utmMedium && (
                <button
                  onClick={() => handleUtmMediumFilter('')}
                  className="text-[11px] px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition flex-shrink-0"
                  title="Clear medium filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Source */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-gray-500">
              Source
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={query.utmSource}
                onChange={(e) => handleUtmSourceFilter(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
              >
                <option value="">All Sources</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {query.utmSource && (
                <button
                  onClick={() => handleUtmSourceFilter('')}
                  className="text-[11px] px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition flex-shrink-0"
                  title="Clear source filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Tracking event */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-gray-500">
              InCred Activity
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={query.trackingEvent}
                onChange={(e) => handleTrackingFilter(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
              >
                <option value="">All Activity</option>
                <option value="incred_pending_modal_shown">InCred: Pending Offer Shown</option>
                <option value="incred_pending_modal_apply_clicked">InCred: Pending Offer Apply Clicked</option>
                <option value="incred_offer_model_clicked">InCred: Offer Card Clicked</option>
              </select>
              {query.trackingEvent && (
                <button
                  onClick={() => handleTrackingFilter('')}
                  className="text-[11px] px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition flex-shrink-0"
                  title="Clear tracking filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Feedback */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-gray-500">
              Feedback
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={query.feedbackStatus}
                onChange={(e) => handleFeedbackFilter(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
              >
                <option value="">All Feedback</option>
                <option value="__none__">No feedback yet</option>
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {query.feedbackStatus && (
                <button
                  onClick={() => handleFeedbackFilter('')}
                  className="text-[11px] px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition flex-shrink-0"
                  title="Clear feedback filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hot Leads — pick a lender to see leads where THAT lender returned a success
            (or "Any Lender"). Conditions mirror the All Lenders "Successful" card. */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <label className="text-[12.5px] font-bold text-gray-700 inline-flex items-center gap-1 whitespace-nowrap">
            🔥 Hot Leads
          </label>
          <select
            value={query.hotLeads}
            onChange={(e) => handleHotLeadsFilter(e.target.value)}
            className={`border rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-orange-200 transition ${
              query.hotLeads
                ? 'bg-orange-50 border-orange-300 text-orange-700 font-semibold'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            <option value="">Off (all leads)</option>
            {/* <option value="all">Any Lender Success</option> */}
            {/* <option value="HeroFinCorp">HeroFinCorp Success</option> */}
            <option value="InCred">InCred Success</option>
            {/* <option value="RamFinCorp">RamFinCorp Success</option> */}
            {/* <option value="AyeFinance">AyeFinance Success</option> */}
            {/* <option value="KreditBee">KreditBee Success</option> */}
            {/* <option value="MoneyView">MoneyView Success</option> */}
          </select>
          {query.hotLeads && (
            <>
              {/* <span className="text-[11px] text-gray-400 italic">
                Sirf woh leads jinme {query.hotLeads === 'all' ? 'kisi bhi lender' : query.hotLeads} ka success aaya.
              </span> */}
              <button
                onClick={() => handleHotLeadsFilter('')}
                className="text-[11px] px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition"
                title="Clear hot leads filter"
              >
                ×
              </button>
            </>
          )}
        </div>

        {query.lender && (
          <div className="mt-2 pt-2 pl-2 border-t border-purple-100/70">
            <span className="text-[11px] text-gray-500 italic">
              Showing all leads with a response from <b className="text-purple-700 not-italic">{lenderOptions.find(l => l.value == query.lender)?.label || query.lender}</b>
            </span>
          </div>
        )}
      </div>

      <MainTable
        columns={offerLeadsColumn({ handleEdit, showTracking: true })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        // Seed page + search from restored state so returning from a detail
        // page keeps the user on the same page with the same search term
        // (without these, MainTable resets both to page 1 / empty on mount).
        initialPagination={tablePagination}
        initialSearch={query.search}
        onRefresh={fetchLeads}
        onExport={canExport ? handleExport : undefined}
        title="Offer Leads"
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}
        onLoanAmountFilter={handleLoanAmountApply}
        onLoanAmountClear={handleLoanAmountClear}
        activeLoanAmount={String(query.utmMedium || '').toLowerCase() === 'meta' ? { min: '', max: '' } : { min: query.minLoanAmount, max: query.maxLoanAmount }}
        onDobRangeFilter={handleDobRangeFilter}
        activeDobRange={{ startDate: query.dobFromDate, endDate: query.dobToDate }}
        onLoanPurposeFilter={handleLoanPurposeFilter}
        activeLoanPurpose={query.loanPurpose}
        loanPurposeOptions={summaryData.distinctLoanPurposes}
        onMonthlyIncomeFilter={handleMonthlyIncomeApply}
        onMonthlyIncomeClear={handleMonthlyIncomeClear}
        activeMonthlyIncome={(() => {
          // meta → no income limit shown (band dropped for meta).
          const m = String(query.utmMedium || '').toLowerCase() === 'meta';
          return m ? { min: '', max: '' } : { min: query.minMonthlyIncome, max: query.maxMonthlyIncome };
        })()}
        onPincodeFilter={handleCityFilter}
        activePincode={query.city}
        pincodeOptions={cityOptions}
        pincodeFilterPlaceholder="All Cities"
        onEmploymentTypeFilter={handleEmploymentTypeFilter}
        activeEmploymentType={query.employmentType}
        employmentTypeOptions={employmentTypeOptions}
        onClearAllFilters={handleClearAllFilters}
      />

      <ModuleInfoCard
        title="High Offer Leads"
        subtitle="The complete list of every applicant who finished the application form and reached the offer page."
        whatYouSee={[
          "Every applicant's details — name, phone, PAN, salary, profession, city, and the traffic source they came from.",
          'Per-lender response columns showing what each partner lender (KreditBee, MoneyView, Vivifi, SmartCoin, TrueBalance, Zype) returned for that applicant.',
          'A "Lender Success" filter to show only applicants approved by a chosen lender.',
          'Filters for disbursement status (Disbursed / Not Disbursed) and traffic source (moneyview, kreditbee, zype, SC).',
        ]}
        dataSource={[
          'Master list of all applicants who completed the long-form application.',
          'A record is created the moment the offer page loads — at that point we already have each lender’s initial response saved alongside the applicant.',
          'Whether the applicant later clicked Apply on the MoneyView or KreditBee card is tracked here too (one outcome per lender per applicant).',
          'Traffic source (UTM) is captured from the URL when the form is submitted.',
        ]}
        flow={[
          'Applicant fills form',
          'Submits',
          'System fetches all lender offers',
          'Applicant lands on offer page',
          'Clicks Apply on a lender card',
          'Apply outcome recorded',
          'Row visible here',
        ]}
      />
    </>
  );
};

export default OfferLeads;