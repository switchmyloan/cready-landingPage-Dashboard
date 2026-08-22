import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { getAnalytics, getDistinctLenders } from '../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../api-services/Modules/Disbursal';
import ToastNotification from '../../components/Notification/ToastNotification';
import OfferLeadsLenderStatsChart from '../../components/OfferLeadsLenderStatsChart';
import ModuleInfoCard from '../../components/ModuleInfoCard';
import PremiumLoader from '../../components/PremiumLoader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import {
  Calendar, RefreshCw, TrendingUp, Building2,
  Users, FileText, ClipboardList, CheckCircle, XCircle, TriangleAlert,
  Target, Cake, Briefcase, IndianRupee, Eye,
} from 'lucide-react';

const COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
  '#6366F1', '#14B8A6', '#E11D48', '#A855F7', '#0EA5E9',
];

const OfferLeadsAnalytics = () => {
  // `loading` starts TRUE so on reload/first mount the skeletons appear
  // immediately — no blank/zero-flash before the useEffect kicks the fetch.
  // `firstLoad` gates the page-wide premium-loader overlay (shown only until
  // the first analytics payload arrives); subsequent refreshes use the
  // in-place skeletons / spinning RefreshCw instead.
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lender, setLender] = useState('');
  const [lenderOptions, setLenderOptions] = useState([]);
  const [utmMedium, setUtmMedium] = useState('');
  const [utmSource, setUtmSource] = useState('');
  // Rotating phrases for the premium first-load loader — cycles every 1.4s
  // while the analytics payload is in flight so the wait feels alive.
  const [loaderPhrase, setLoaderPhrase] = useState(0);
  const LOADER_PHRASES = [
    'Curating lender insights…',
    'Aggregating loan funnel…',
    'Computing disbursal trends…',
    'Decoding MV success rates…',
    'Polishing the dashboard…',
  ];

  useEffect(() => {
    if (!firstLoad) return;
    const id = setInterval(
      () => setLoaderPhrase((i) => (i + 1) % LOADER_PHRASES.length),
      1400
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstLoad]);

  // Same option lists as the other high-ticket pages so the analytics filter
  // dimensions stay consistent across modules.
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
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType === 'range' && dateRange.startDate && dateRange.endDate) {
        params.fromDate = dateRange.startDate;
        params.toDate = dateRange.endDate;
      } else if (filterType) {
        params.type = filterType;
      }
      if (lender) params.lender = lender;
      if (utmMedium) params.utmMedium = utmMedium;
      if (utmSource) params.utmSource = utmSource;

      const res = await getAnalytics(params);
      if (res?.data?.success) {
        setAnalyticsData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      // ToastNotification.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
      setFirstLoad(false);  // first fetch done — switch to in-place skeletons
    }
  }, [filterType, dateRange.startDate, dateRange.endDate, lender, utmMedium, utmSource]);

  useEffect(() => {
    if (filterType !== 'range') {
      fetchAnalytics();
    }
  }, [filterType, lender, utmMedium, utmSource]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDistinctLenders();
        const list = res?.data?.data || res?.data || [];
        const names = (Array.isArray(list) ? list : [])
          .map((x) => (typeof x === 'string' ? x : x?.lenderName || x?.name))
          .filter(Boolean);
        setLenderOptions(Array.from(new Set(names)).sort());
      } catch (err) {
        console.error('Failed to load lenders', err);
      }
    })();
  }, []);

  const handleDateRangeApply = () => {
    if (dateRange.startDate && dateRange.endDate) {
      setFilterType('range');
      setShowDatePicker(false);
      fetchAnalytics();
    } else {
      ToastNotification.error('Please select both start and end dates');
    }
  };

  const summary = analyticsData?.summary || {};
  const lenderWiseData = analyticsData?.lenderWise || [];
  const kbSummary = summary.kbLendingPage || {};
  const withPercent = (rows) => {
    const total = rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0);
    return rows.map(r => ({
      ...r,
      percent: total > 0 ? Number(((r.count / total) * 100).toFixed(1)) : 0,
    }));
  };

  const loanPurposeData = withPercent(
    (analyticsData?.loanPurposeWise || []).map(d => ({ name: d.loanPurpose, count: d.count }))
  );
  const ageRangeData = withPercent(
    (analyticsData?.ageRangeWise || []).map(d => ({ name: d.ageRange, count: d.count }))
  );
  const professionData = Object.values(
    (analyticsData?.professionWise || []).reduce((acc, d) => {
      const key = (d.profession || 'UNKNOWN').toUpperCase();
      if (!acc[key]) acc[key] = { name: key, value: 0 };
      acc[key].value += d.count;
      return acc;
    }, {})
  );
  const incomeRangeData = withPercent(
    (analyticsData?.incomeRangeWise || []).map(d => ({ name: d.incomeRange, count: d.count }))
  );

  // Module-wise overview cards data
  const moduleCards = [
    { title: 'Offer Leads', value: summary.offerLeads || 0, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Selected Lenders', value: summary.selectedLenders || 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    // { title: 'KB Lending Page', value: kbSummary.total || 0, icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Draft Leads', value: summary.draftLeads || 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    // { title: 'MV Success', value: summary.mvSuccess || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    // Engagement metric: how many applicants clicked the "View All Offers"
    // button on the offers page (first-click sticky stamp on offerLeads).
    { title: 'View All Offer Button', value: summary.viewAllClicks || 0, icon: Eye, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  // KB Lending Page status cards
  const kbStatusCards = [
    // { title: 'KB Success', value: kbSummary.success || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    // { title: 'KB Rejected', value: kbSummary.reject || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    // { title: 'KB Duplicate', value: kbSummary.duplicate || 0, icon: TriangleAlert, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  const lenderBarData = withPercent(
    lenderWiseData.map(item => ({
      name: item.lenderName || 'Unknown',
      count: Number(item.total) || 0,
    }))
  );

  const lenderPieData = lenderWiseData.map(item => ({
    name: item.lenderName || 'Unknown',
    value: Number(item.total) || 0,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const pct = payload[0]?.payload?.percent;
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200">
          <p className="font-semibold text-gray-800">{label || payload[0]?.name}</p>
          <p className="text-purple-600 font-medium">
            Count: {payload[0]?.value?.toLocaleString()}
          </p>
          {pct !== undefined && (
            <p className="text-gray-600 text-sm">Share: {pct}%</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Same sweeping shimmer pattern as SummaryCards / MainTable so the analytics
  // page loading state matches the rest of the module.
  const SkeletonCard = () => (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="h-4 w-1/2 rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer mb-3" />
      <div className="h-8 w-3/4 rounded-md bg-gradient-to-r from-indigo-100 via-purple-200 to-indigo-100 bg-[length:200%_100%] animate-shimmer" />
    </div>
  );

  // Premium first-load loader — rendered INSIDE the page container so the
  // sidebar / topbar stay visible. Premium polish:
  //   - Glassmorphism frosted-glass card (backdrop-blur-xl)
  //   - Floating ₹ symbols (money/loan-aggregator theme)
  //   - SVG gradient progress arc + counter-rotating ring + pulsing halo
  //   - Gold sparkle ₹ badge on the icon (premium accent)
  //   - Rotating loading phrase (cycles every 1.4s) for liveness
  //   - "Secure · Encrypted" trust footer with bouncing dots
  // Drops to in-place skeletons for subsequent filter changes after firstLoad
  // flips false.
  if (firstLoad) {
    return (
      <>
        <Toaster />
        <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden rounded-2xl">

          {/* Layered mesh background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-purple-50/40 to-indigo-50/50" />

          {/* Floating ₹ symbols — subtle money-theme texture */}
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

          {/* Glassmorphism card */}
          <div className="relative z-10 flex flex-col items-center gap-7 px-10 py-12 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-2xl shadow-purple-500/10 max-w-md w-full mx-4">

            {/* Icon with rotating SVG arc + counter-ring + gold ₹ sparkle */}
            <div className="relative w-32 h-32 flex items-center justify-center">

              {/* Outer rotating gradient arc (SVG) */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                style={{ animation: 'spin 3.5s linear infinite' }}
              >
                <defs>
                  <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="46" fill="none" stroke="#ede9fe" strokeWidth="2" />
                <circle cx="50" cy="50" r="46" fill="none" stroke="url(#arcGrad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 220" />
              </svg>

              {/* Inner counter-rotating ring */}
              <div
                className="absolute inset-3 rounded-full border-[1.5px] border-indigo-200/40 border-b-indigo-500 border-r-indigo-500"
                style={{ animation: 'spin 2.2s linear infinite reverse' }}
              />

              {/* Pulsing inner halo */}
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 blur-xl animate-pulse" />

              {/* Icon card with premium gold ₹ sparkle badge */}
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-purple-500/40 ring-1 ring-white/30">
                <TrendingUp size={28} className="text-white drop-shadow-md" />
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
                <span className="text-[10.5px] font-semibold tracking-[0.12em] text-purple-700 uppercase">SML Portal</span>
              </div>
              <h2 className="text-[23px] font-bold bg-gradient-to-r from-purple-800 via-violet-700 to-indigo-800 bg-clip-text text-transparent tracking-tight leading-tight">
                Loading Analytics Dashboard
              </h2>

              {/* Rotating phrase — key change re-renders with subtle pulse */}
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

            {/* Premium progress bar + trust footer */}
            <div className="w-full">
              <div className="relative h-1.5 rounded-full bg-purple-100/60 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 animate-shimmer bg-[length:200%_100%]"
                  style={{ boxShadow: '0 0 12px rgba(139,92,246,0.6)' }}
                />
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-gray-400 font-semibold tracking-[0.14em] uppercase">Secure · Encrypted</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-purple-600" size={28} />
            Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">All Modules Overview & Lender-wise Analytics</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {['today', 'yesterday', 'week', 'month'].map(type => (
            <button
              key={type}
              onClick={() => {
                // Toggle: clicking the active button again clears it (back to "All Data")
                setFilterType(prev => (prev === type ? '' : type));
                setDateRange({ startDate: '', endDate: '' });
                setShowDatePicker(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                filterType === type
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}

          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-all duration-200 ${
                filterType === 'range'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <Calendar size={14} />
              Custom
            </button>
            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 w-72">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleDateRangeApply}
                    className="w-full bg-purple-600 text-white rounded-md py-1.5 text-sm font-medium hover:bg-purple-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={fetchAnalytics}
            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition-all"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Module-wise Summary Cards */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          moduleCards.map(card => (
            <div key={card.title} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 transition duration-300 hover:shadow-md">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-full ${card.bg}`}>
                <card.icon className={card.color} size={24} />
              </div>
            </div>
          ))
        )}
      </div> */}

      {/* KB Lending Page Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          kbStatusCards.map(card => (
            <div key={card.title} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 transition duration-300 hover:shadow-md">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-full ${card.bg}`}>
                <card.icon className={card.color} size={24} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lender Response Breakdown (Success / Reject / Dedupe) */}
      {/* <OfferLeadsLenderStatsChart /> */}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Lender-wise Leads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-purple-600" />
            Lender-wise Lead Distribution
          </h2>
          {loading ? (
            <div className="h-80"><PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" /></div>
          ) : lenderBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={lenderBarData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={80}
                />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {lenderBarData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="percent"
                    position="top"
                    formatter={(v) => `${v}%`}
                    style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-400">
              No lender data available
            </div>
          )}
        </div>

        {/* Pie Chart - Lender Share */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-purple-600" />
            Lender Share (%)
          </h2>
          {loading ? (
            <div className="h-80"><PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" /></div>
          ) : lenderPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={lenderPieData}
                  cx="50%"
                  cy="45%"
                  outerRadius={120}
                  dataKey="value"
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    if (!percent || percent < 0.03) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#ffffff"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: 11, fontWeight: 700 }}
                      >
                        {`${(percent * 100).toFixed(1)}%`}
                      </text>
                    );
                  }}
                >
                  {lenderPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-400">
              No lender data available
            </div>
          )}
        </div>
      </div>

      {/* Lender-wise Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 size={20} className="text-purple-600" />
          Lender-wise Breakdown (Selected Lenders)
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-10 rounded-md bg-gradient-to-r from-indigo-100 via-purple-200 to-indigo-100 bg-[length:200%_100%] animate-shimmer"
              />
            ))}
          </div>
        ) : lenderWiseData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Lender Name</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Total Leads</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Share %</th>
                </tr>
              </thead>
              <tbody>
                {lenderWiseData.map((lender, index) => {
                  const total = Number(lender.total) || 0;
                  const grandTotal = lenderWiseData.reduce((sum, l) => sum + (Number(l.total) || 0), 0);
                  const share = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                      <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                      <td className="py-3 px-4 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {lender.lenderName || 'Unknown'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-800">{total.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {share}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 px-4" colSpan={2}>Total</td>
                  <td className="py-3 px-4 text-right">
                    {lenderWiseData.reduce((sum, l) => sum + (Number(l.total) || 0), 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      100%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400">
            No lender data available for the selected period
          </div>
        )}
      </div>

      {/* Offer Leads - Demographic & Loan Insights */}
      <div className="mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-purple-600" size={22} />
            Offer Leads - Demographic & Loan Insights
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border bg-white text-gray-600 border-gray-300 hover:bg-purple-50 hover:text-purple-700"
              title="Filter by lender"
            >
              <option value="">All Lenders</option>
              {lenderOptions.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border bg-white text-gray-600 border-gray-300 hover:bg-purple-50 hover:text-purple-700"
              title="Filter by UTM medium"
            >
              <option value="">All Mediums</option>
              {mediumOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border bg-white text-gray-600 border-gray-300 hover:bg-purple-50 hover:text-purple-700"
              title="Filter by UTM source"
            >
              <option value="">All Sources</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Loan Purpose Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Target size={20} className="text-purple-600" />
              Loan Purpose Distribution
            </h3>
            {loading ? (
              <div className="h-80"><PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" /></div>
            ) : loanPurposeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={loanPurposeData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    {loanPurposeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="percent"
                      position="top"
                      formatter={(v) => `${v}%`}
                      style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No loan purpose data available
              </div>
            )}
          </div>

          {/* Age Range Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Cake size={20} className="text-pink-600" />
              Age Group Distribution
            </h3>
            {loading ? (
              <div className="h-80"><PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" /></div>
            ) : ageRangeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ageRangeData} margin={{ top: 20, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {ageRangeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="percent"
                      position="top"
                      formatter={(v) => `${v}%`}
                      style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No age data available
              </div>
            )}
          </div>

          {/* Profession Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase size={20} className="text-blue-600" />
              Profession (Salaried / Self-Employed)
            </h3>
            {loading ? (
              <div className="h-80"><PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" /></div>
            ) : professionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={professionData}
                    cx="50%"
                    cy="45%"
                    outerRadius={100}
                    innerRadius={55}
                    dataKey="value"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      if (!percent) return null;
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="#ffffff"
                          textAnchor="middle"
                          dominantBaseline="central"
                          style={{ fontSize: 12, fontWeight: 700 }}
                        >
                          {`${(percent * 100).toFixed(1)}%`}
                        </text>
                      );
                    }}
                  >
                    {professionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No profession data available
              </div>
            )}
          </div>

          {/* Income Range Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <IndianRupee size={20} className="text-green-600" />
              Monthly Income Range
            </h3>
            {loading ? (
              <div className="h-80"><PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" /></div>
            ) : incomeRangeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={incomeRangeData} margin={{ top: 20, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {incomeRangeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 6) % COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="percent"
                      position="top"
                      formatter={(v) => `${v}%`}
                      style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No income data available
              </div>
            )}
          </div>
        </div>

        <ModuleInfoCard
          title="High Analytics Dashboard"
          subtitle="High-level charts and metrics summarising the full applicant pool for any selected date range."
          whatYouSee={[
            'Top-line numbers: total applicants, unique phone numbers, and counts for the top-performing lenders.',
            'A per-lender bar chart showing Success / Reject / Duplicate counts at a glance.',
            'Breakdowns by loan purpose, employment type, age, and monthly income.',
            'Date range filter and per-lender filter — every chart re-runs against the same scope.',
          ]}
          dataSource={[
            'Calculated on demand from the same master applicant list that powers the Offer Leads page.',
            'No separate data warehouse — every number you see here is live and reflects the latest state.',
            'The lender filter narrows the view to applicants for whom the chosen lender returned a successful response.',
          ]}
          flow={[
            'User selects date range and lender',
            'System reads the applicant pool',
            'Numbers are aggregated',
            'Charts render with the result',
          ]}
        />
      </div>
    </>
  );
};

export default OfferLeadsAnalytics;
