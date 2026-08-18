import { useEffect, useState, useCallback, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { getVyaparAnalytics, getVyaparDistinctMediums } from '../../../api-services/Modules/Leads';
import ToastNotification from '../../../components/Notification/ToastNotification';
import PremiumPageLoader from '../../../components/PremiumPageLoader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Calendar, RefreshCw, TrendingUp, Building2,
  Users, FileText,
  Target, Cake, Briefcase, IndianRupee,
  MapPin, Megaphone, Wallet, Trophy,
} from 'lucide-react';

const COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
  '#6366F1', '#14B8A6', '#E11D48', '#A855F7', '#0EA5E9',
];

const VyaparOfferLeadsAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [medium, setMedium] = useState('');
  const [source, setSource] = useState('');
  const [mediumOptions, setMediumOptions] = useState([]);

  // Hardcoded source baseline — same as the other vyapar dashboards.
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
      if (medium) params.medium = medium;
      if (source) params.source = source;

      const res = await getVyaparAnalytics(params);
      if (res?.data?.success) {
        setAnalyticsData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch vyapar analytics data');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [filterType, dateRange.startDate, dateRange.endDate, medium, source]);

  useEffect(() => {
    if (filterType !== 'range') {
      fetchAnalytics();
    }
  }, [filterType]);

  // Re-fetch when the medium/source filter changes (works for any date filter,
  // including an applied custom range). Skips the initial mount so it doesn't
  // double-fire alongside the filterType effect above.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    fetchAnalytics();
  }, [medium, source]);

  // Populate the Medium dropdown (vyapar mediums + rapidmoney baseline).
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
  const loanPurposeData = (analyticsData?.loanPurposeWise || []).map(d => ({ name: d.loanPurpose, count: d.count }));
  const ageRangeData = (analyticsData?.ageRangeWise || []).map(d => ({ name: d.ageRange, count: d.count }));
  const professionData = Object.values(
    (analyticsData?.professionWise || []).reduce((acc, d) => {
      const key = (d.profession || 'UNKNOWN').toUpperCase();
      if (!acc[key]) acc[key] = { name: key, value: 0 };
      acc[key].value += d.count;
      return acc;
    }, {})
  );
  const incomeRangeData = (analyticsData?.incomeRangeWise || []).map(d => ({ name: d.incomeRange, count: d.count }));
  const genderData = Object.values(
    (analyticsData?.genderWise || []).reduce((acc, d) => {
      const key = (d.gender || 'UNKNOWN').toUpperCase();
      if (!acc[key]) acc[key] = { name: key, value: 0 };
      acc[key].value += d.count;
      return acc;
    }, {})
  );
  const utmSourceData = (analyticsData?.utmSourceWise || []).map(d => ({ name: d.utmSource, count: d.count }));
  const pincodeData = (analyticsData?.pincodeWise || []).map(d => ({ name: d.pincode, count: d.count }));
  const loanAmountData = (analyticsData?.loanAmountWise || []).map(d => ({ name: d.loanRange, count: d.count }));

  // Marketing channel leaderboard — ranked by overall conversion (leads → approved),
  // so high-volume-but-low-quality sources sink and efficient channels rise.
  const channelData = [...(analyticsData?.channelPerformance || [])].sort(
    (a, b) => b.conversionRate - a.conversionRate || b.leads - a.leads
  );
  const channelTotals = channelData.reduce(
    (acc, c) => {
      acc.leads += c.leads; acc.applied += c.applied; acc.approved += c.approved;
      return acc;
    },
    { leads: 0, applied: 0, approved: 0 }
  );
  // Colour the conversion badge by health: green = strong, amber = ok, red = weak.
  const convColor = rate =>
    rate >= 15 ? 'bg-green-100 text-green-700'
      : rate >= 5 ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';

  const moduleCards = [
    { title: 'Vyapar Offer Leads', value: summary.offerLeads || 0, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Vyapar Selected Lenders', value: summary.selectedLenders || 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Vyapar Draft Leads', value: summary.draftLeads || 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ];

  const lenderBarData = lenderWiseData.map(item => ({
    name: item.lenderName || 'Unknown',
    count: Number(item.total) || 0,
  }));

  const lenderPieData = lenderWiseData.map(item => ({
    name: item.lenderName || 'Unknown',
    value: Number(item.total) || 0,
  }));

  // Percentage label drawn INSIDE each slice — avoids the name+percent labels
  // overflowing/clipping at the card edges. Lender names come from the legend.
  const renderInnerPercentLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (!percent || percent < 0.03) return null; // hide clutter on tiny slices
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200">
          <p className="font-semibold text-gray-800">{label || payload[0]?.name}</p>
          <p className="text-purple-600 font-medium">
            Count: {payload[0]?.value?.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

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
          title="Loading Vyapar Analytics"
          brandLabel="Live Vyapar Analytics"
          icon={TrendingUp}
          phrases={[
            'Curating vyapar-ticket insights…',
            'Aggregating loan funnel…',
            'Computing disbursal trends…',
            'Decoding success rates…',
            'Polishing the dashboard…',
          ]}
          tiles={[
            { label: 'Total leads' },
            { label: 'Lenders' },
            { label: 'Success' },
          ]}
          progressLabel="Preparing your analytics"
        />
      </>
    );
  }

  return (
    <>
      <Toaster />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-purple-600" size={28} />
            Vyapar Ticket Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Vyapar Ticket Modules Overview & Lender-wise Analytics</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['today', 'yesterday', 'week', 'month'].map(type => (
            <button
              key={type}
              onClick={() => {
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

          {/* Medium filter */}
          <select
            value={medium}
            onChange={e => setMedium(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-600 border border-gray-300 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-400"
            title="Filter by Medium"
          >
            <option value="">All Mediums</option>
            {mediumOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Source filter */}
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-600 border border-gray-300 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-400"
            title="Filter by Source"
          >
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={fetchAnalytics}
            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition-all"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-purple-600" />
            Lender-wise Lead Distribution (Selected Lenders)
          </h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="loading loading-spinner loading-lg text-purple-600"></div>
            </div>
          ) : lenderBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={lenderBarData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
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
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-400">
              No lender data available
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-purple-600" />
            Lender Share (%)
          </h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="loading loading-spinner loading-lg text-purple-600"></div>
            </div>
          ) : lenderPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={lenderPieData}
                  cx="50%"
                  cy="45%"
                  outerRadius={120}
                  dataKey="value"
                  label={renderInnerPercentLabel}
                  labelLine={false}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 size={20} className="text-purple-600" />
          Lender-wise Breakdown (Vyapar Selected Lenders)
        </h2>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded"></div>
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

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="text-purple-600" size={22} />
          Vyapar Offer Leads - Demographic & Loan Insights
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Target size={20} className="text-purple-600" />
              Loan Purpose Distribution
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-purple-600"></div>
              </div>
            ) : loanPurposeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={loanPurposeData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
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
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No loan purpose data available
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Cake size={20} className="text-pink-600" />
              Age Group Distribution
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-pink-600"></div>
              </div>
            ) : ageRangeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ageRangeData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {ageRangeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No age data available
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase size={20} className="text-blue-600" />
              Profession (Salaried / Self-Employed)
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-blue-600"></div>
              </div>
            ) : professionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={professionData}
                    cx="50%"
                    cy="45%"
                    outerRadius={110}
                    innerRadius={55}
                    dataKey="value"
                    label={renderInnerPercentLabel}
                    labelLine={false}
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <IndianRupee size={20} className="text-green-600" />
              Monthly Income Range
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-green-600"></div>
              </div>
            ) : incomeRangeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={incomeRangeData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {incomeRangeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 6) % COLORS.length]} />
                    ))}
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
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Megaphone className="text-purple-600" size={22} />
          Source, Geography & Loan Insights
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              Gender Distribution
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-indigo-600"></div>
              </div>
            ) : genderData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="45%"
                    outerRadius={110}
                    innerRadius={55}
                    dataKey="value"
                    label={renderInnerPercentLabel}
                    labelLine={false}
                  >
                    {genderData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 8) % COLORS.length]} />
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
                No gender data available
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet size={20} className="text-green-600" />
              Requested Loan Amount
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-green-600"></div>
              </div>
            ) : loanAmountData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={loanAmountData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {loanAmountData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No loan amount data available
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin size={20} className="text-red-600" />
              Top Pincodes
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-red-600"></div>
              </div>
            ) : pincodeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={pincodeData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={26}>
                    {pincodeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 10) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No pincode data available
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Megaphone size={20} className="text-amber-600" />
              Top UTM Sources
            </h3>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-amber-600"></div>
              </div>
            ) : utmSourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={utmSourceData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={26}>
                    {utmSourceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No UTM source data available
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            Marketing Channel Performance
          </h2>
          <span className="text-xs text-gray-400">Ranked by conversion (Leads → Approved)</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Har UTM source ka quality funnel — sirf volume nahi, actual conversion. Top channels pe budget badhao, weak channels cut karo.
        </p>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded"></div>
            ))}
          </div>
        ) : channelData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">UTM Source</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Leads</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Applied</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Apply %</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Approved</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {channelData.map((c, index) => (
                  <tr key={c.source} className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                    <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        {c.source}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-800">{c.leads.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{c.applied.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{c.applyRate}%</td>
                    <td className="py-3 px-4 text-right text-gray-700">{c.approved.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${convColor(c.conversionRate)}`}>
                        {c.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 px-4" colSpan={2}>All Channels</td>
                  <td className="py-3 px-4 text-right">{channelTotals.leads.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">{channelTotals.applied.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-500">
                    {channelTotals.leads > 0 ? ((channelTotals.applied / channelTotals.leads) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="py-3 px-4 text-right">{channelTotals.approved.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                      {channelTotals.leads > 0 ? ((channelTotals.approved / channelTotals.leads) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400">
            No channel data available for the selected period
          </div>
        )}
      </div>
    </>
  );
};

export default VyaparOfferLeadsAnalytics;
