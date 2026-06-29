import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
    Search, Download, RefreshCw, ChevronLeft, ChevronRight,
    Activity, ArrowUpRight, ArrowDownRight, ArrowUpDown, Layers, Wallet,
    Banknote, Timer, Calendar, FileDown, Building2, IndianRupee,
    TrendingUp, Hash, X, Sparkles, ChevronDown, Check,
} from 'lucide-react';
import {
    getDisbursalKpis, getDisbursalTrend, getDisbursalTrendShort,
    getDisbursalLenderStats, getDisbursalLenderStatsShort,
    getDisbursalLenderBreakdown,
    getDisbursalEmploymentMix, getDisbursalEmploymentMixShort,
    getDisbursalTransactions, getDisbursalFilterOptions,
} from '../../api-services/Modules/Disbursal';
import { getLenderMeta, getLenderInitials } from '../../utils/lenderLogos';
import ModuleInfoCard from '../../components/ModuleInfoCard';
import PremiumLoader from '../../components/PremiumLoader';

const LenderAvatar = ({ name, size = 24 }) => {
    const meta = getLenderMeta(name);
    const cls = 'rounded-md grid place-items-center overflow-hidden flex-shrink-0';
    const style = { width: size, height: size };
    if (meta.logo) {
        return (
            <div className={`${cls} bg-white border border-gray-200`} style={style}>
                <img src={meta.logo} alt={name || ''} className="w-full h-full object-contain" />
            </div>
        );
    }
    return (
        <div
            className={`${cls} text-white text-[10px] font-semibold`}
            style={{ ...style, background: meta.color }}
        >
            {getLenderInitials(name)}
        </div>
    );
};

// A single row inside the lender dropdown panel.
const LenderOption = ({ name, active, onClick, showAvatar = true }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition ${
            active ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
        }`}
    >
        {showAvatar ? <LenderAvatar name={name} size={18} /> : <span className="w-[18px] flex-shrink-0" />}
        <span className="truncate flex-1">{name}</span>
        {active && <Check size={13} className="text-purple-600 flex-shrink-0" />}
    </button>
);

// Searchable lender filter. Replaces the native <select> (which couldn't be
// type-filtered) with a combobox: type to narrow the list, lender logos for
// quick visual scanning, click-outside / Escape to close.
const SearchableLenderSelect = ({ value, options = [], onChange }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((l) => String(l).toLowerCase().includes(q));
    }, [options, query]);

    const select = (v) => { onChange(v); setOpen(false); setQuery(''); };
    const label = value && value !== 'All' ? value : 'All Lenders';

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-2 min-w-[150px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12.5px] text-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition"
            >
                {value && value !== 'All' && <LenderAvatar name={value} size={18} />}
                <span className="truncate flex-1 text-left">{label}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-30 mt-1 w-[240px] rounded-lg border border-gray-200 bg-white shadow-lg shadow-gray-200/60 overflow-hidden">
                    <div className="relative p-2 border-b border-gray-100">
                        <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search lender…"
                            className="w-full rounded-md py-1.5 pl-7 pr-2 text-[12.5px] bg-gray-50 border border-gray-200 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        />
                    </div>
                    <div className="max-h-[260px] overflow-y-auto py-1">
                        <LenderOption name="All Lenders" active={!value || value === 'All'} showAvatar={false} onClick={() => select('All')} />
                        {filtered.map((l) => (
                            <LenderOption key={l} name={l} active={value === l} onClick={() => select(l)} />
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-3 py-3 text-center text-[12px] text-gray-400">No lender found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* FORMATTERS */
const fmtINR = (n) => {
    if (n == null || isNaN(n)) return '₹0';
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
    if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
};
const fmtINRFull = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtTimeAgo = (ts) => {
    if (!ts) return '—';
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};
const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtBucketLabel = (bucket, granularity) => {
    if (!bucket) return '';
    const d = new Date(bucket);
    if (granularity === 'monthly') return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (granularity === 'weekly') return `W ${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const COLORS = {
    // Cready brand palette — purple → violet → indigo. Matches the sidebar,
    // navbar, and login. Replaces the older emerald/teal "money" theme.
    brand:  '#7c3aed',   // violet-600
    brand2: '#6366f1',   // indigo-500
    accent: '#a855f7',   // purple-500
    info:   '#3b82f6',   // blue-500
    pos:    '#8b5cf6',   // violet-500
    neg:    '#dc2626',
    warn:   '#b45309',
};

/* Count-up animation hook — ALWAYS starts at 0 and eases toward `target`
   over `duration` ms using requestAnimationFrame + easeOutCubic. Earlier
   version tracked the previous value via a ref so filter changes would
   ease prev→new, but for filter cases where new < prev the count visibly
   ticked downward (looked like negative motion). User asked for 0-start
   on every change, so we drop the ref and always go 0→target. */
const useCountUp = (target, duration = 2000) => {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (target == null || isNaN(target)) {
            setVal(0);
            return;
        }
        if (target === 0) {
            setVal(0);
            return;
        }
        // Snap to 0 immediately so the next paint shows 0 before the
        // animation starts ticking — avoids a flash of the previous value.
        setVal(0);
        const start = performance.now();
        let raf;
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            // easeOutCubic — fast at first, gentle landing
            const eased = 1 - Math.pow(1 - t, 3);
            setVal(target * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return val;
};

/* KPI CARD — premium money-themed card with gradient icon badge, top accent
   stripe, soft hover-lift, and animated count-up on value change.
   API: pass `value` as a number and (optionally) `format` as a formatter
   function — the card animates 0→value (or prev→value) and re-runs the
   formatter on each frame. Legacy string `value` still renders as-is. */
const KpiCard = ({ icon: Icon, label, value, format, sub, delta, deltaPositive, color = COLORS.brand, loading = false }) => {
    const isNumeric = typeof value === 'number' && !isNaN(value);
    const animValue = useCountUp(isNumeric ? value : 0);
    const display = !isNumeric
        ? value
        : format
            ? format(animValue)
            : Math.round(animValue).toLocaleString('en-IN');
    return (
    <div
        className="group relative bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 overflow-hidden hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-0.5 hover:border-purple-300/60 transition-all duration-200"
    >
        {/* Top accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${COLORS.brand2}, ${color})` }} />
        {/* Soft corner glow that brightens on hover */}
        <div
            className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-300"
            style={{ background: `radial-gradient(circle, ${color}33, transparent 70%)` }}
        />

        <div className="relative flex justify-between items-start">
            <div className="flex items-center gap-2.5">
                {/* Gradient icon badge with ₹ sparkle */}
                <div
                    className="relative w-10 h-10 grid place-items-center rounded-xl shadow-md ring-1 ring-white/40"
                    style={{ background: `linear-gradient(135deg, ${color}, ${COLORS.brand2})` }}
                >
                    <Icon size={17} className="text-white drop-shadow" />
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow ring-2 ring-white">
                        <span className="text-[7.5px] font-black text-amber-900 leading-none">₹</span>
                    </div>
                </div>
                <span className="text-[12.5px] font-semibold text-gray-700 tracking-tight">{label}</span>
            </div>
            {!loading && delta != null && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    deltaPositive
                        ? 'bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border-purple-200'
                        : 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-200'
                }`}>
                    {deltaPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {Math.abs(delta).toFixed(1)}%
                </span>
            )}
        </div>
        {loading ? (
            <div className="mt-4 space-y-2">
                <div className="h-8 w-36 rounded-md bg-gradient-to-r from-purple-100 via-violet-200 to-purple-100 bg-[length:200%_100%] animate-shimmer" />
                {sub != null && (
                    <div className="h-3 w-24 rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer" />
                )}
            </div>
        ) : (
            <>
                <div className="text-[30px] font-bold tracking-tight leading-none mt-4 text-gray-900 tabular-nums">{display}</div>
                {sub && <div className="text-[12px] text-gray-500 mt-1.5">{sub}</div>}
            </>
        )}
    </div>
    );
};

/* TREND CHART */
const TrendChart = ({ range, scope, fromDate, toDate, utmSource, utmMedium }) => {
    const [granularity, setGranularity] = useState('daily');
    const [metric, setMetric] = useState('amount');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (range === 'Custom' && (!fromDate || !toDate)) return;
        // Cancel in-flight request when filters change so a slow earlier
        // response can't arrive after a newer one and overwrite the chart.
        const controller = new AbortController();
        setLoading(true);
        // Route to the short-ticket trend endpoint when the dashboard scope
        // is 'short' — it joins shortOfferLeads instead of offerLeads server-
        // side, so the trend chart matches the short-ticket KPI count.
        const trendFn = scope === 'short' ? getDisbursalTrendShort : getDisbursalTrend;
        trendFn({ range, granularity, scope, fromDate, toDate, utmSource, utmMedium, signal: controller.signal })
            .then(res => { if (!controller.signal.aborted) setData(res?.data?.data || []); })
            .catch(e => { if (!controller.signal.aborted) console.error(e); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range, granularity, scope, fromDate, toDate, utmSource, utmMedium]);

    const chartData = useMemo(
        () => data.map(d => ({ ...d, label: fmtBucketLabel(d.bucket, granularity) })),
        [data, granularity]
    );
    const seriesKey = metric === 'amount' ? 'amount' : 'count';
    const total = chartData.reduce((s, d) => s + (d[seriesKey] || 0), 0);
    const avg = chartData.length ? total / chartData.length : 0;
    const peak = chartData.reduce((m, d) => (d[seriesKey] > (m?.[seriesKey] ?? -Infinity) ? d : m), chartData[0]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-[14.5px] font-semibold tracking-tight text-gray-900">Disbursal trend</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            {granularity}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-3 mt-2">
                        <span className="text-[24px] font-semibold leading-none">
                            {/* `total` / `avg` arrive in Cr (toCr = n / 1e7 in
                                getTrend). Multiply back to raw rupees so fmtINR
                                can pick the right unit (Cr / L / K) — avoids
                                ugly "₹0.06 Cr" on small short-ticket totals. */}
                            {metric === 'amount' ? fmtINR(total * 1e7) : fmtNum(total)}
                        </span>
                        <span className="text-[12px] text-gray-500">
                            total · avg <span className="font-mono text-gray-800">
                                {metric === 'amount' ? fmtINR(avg * 1e7) : fmtNum(Math.round(avg))}
                            </span> per {granularity === 'daily' ? 'day' : granularity === 'weekly' ? 'week' : 'month'}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <div className="inline-flex p-[3px] gap-[2px] rounded-lg bg-gray-100 border border-gray-200">
                        {[
                            { v: 'amount', icon: IndianRupee, label: 'Amount' },
                            { v: 'count', icon: Hash, label: 'Count' },
                        ].map(opt => (
                            <button key={opt.v}
                                onClick={() => setMetric(opt.v)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium transition ${
                                    metric === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}>
                                <opt.icon size={11} /> {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="inline-flex p-[3px] gap-[2px] rounded-lg bg-gray-100 border border-gray-200">
                        {['daily', 'weekly', 'monthly'].map(g => (
                            <button key={g}
                                onClick={() => setGranularity(g)}
                                className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition ${
                                    granularity === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}>
                                {g[0].toUpperCase() + g.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-[260px]">
                {loading ? (
                    <PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" />
                ) : chartData.length === 0 ? (
                    <div className="h-full grid place-items-center text-gray-400 text-sm">No data in selected range</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                            <defs>
                                <linearGradient id="grad-trend" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={COLORS.brand} stopOpacity={0.4} />
                                    <stop offset="60%" stopColor={COLORS.brand} stopOpacity={0.1} />
                                    <stop offset="100%" stopColor={COLORS.brand} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#ededea" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: '#8a8f9a', fontSize: 11 }} axisLine={false} tickLine={false} dy={4} />
                            <YAxis tick={{ fill: '#8a8f9a', fontSize: 11 }} axisLine={false} tickLine={false}
                                tickFormatter={(v) => metric === 'amount' ? `₹${Number(v).toFixed(2)}` : fmtNum(v)} />
                            <Tooltip
                                cursor={{ stroke: '#d6d4cb', strokeWidth: 1, strokeDasharray: '3 3' }}
                                contentStyle={{ background: '#fff', border: '1px solid #d6d4cb', borderRadius: 10, fontSize: 12 }}
                                formatter={(v) => [metric === 'amount' ? `₹${Number(v).toFixed(2)} Cr` : fmtNum(v), metric === 'amount' ? 'Amount' : 'Count']}
                            />
                            <Area type="monotone" dataKey={seriesKey}
                                stroke={COLORS.brand} strokeWidth={2.2}
                                fill="url(#grad-trend)" dot={{ r: 0 }}
                                activeDot={{ r: 5, fill: COLORS.brand, stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {peak && (
                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-[12px] flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <div className="w-[10px] h-[10px] rounded-[3px]" style={{ background: `linear-gradient(90deg, ${COLORS.brand}, ${COLORS.brand2})` }} />
                        <span className="text-gray-500">Disbursal {metric}</span>
                    </div>
                    <div className="text-gray-500 ml-auto">
                        Peak: <span className="font-mono text-gray-800">
                            {metric === 'amount' ? `₹${peak.amount} Cr` : fmtNum(peak.count)}
                        </span> · {peak.label}
                    </div>
                </div>
            )}
        </div>
    );
};

/* EMPLOYMENT MIX (replaces Product Mix from PDF — we don't have product column) */
const EmploymentMix = ({ range, scope, fromDate, toDate, utmSource, utmMedium }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    // Cready brand palette for the Employment Mix donut — purple/violet/indigo
    // family for primary segments, with blue/amber/rose accents for variety.
    const palette = ['#7c3aed', '#6366f1', '#a855f7', '#3b82f6', '#b45309', '#dc2626'];

    useEffect(() => {
        if (range === 'Custom' && (!fromDate || !toDate)) return;
        const controller = new AbortController();
        setLoading(true);
        // scope='short' → short employment-mix endpoint (joins shortOfferLeads)
        // so the donut total stays consistent with the short KPI count.
        const empFn = scope === 'short' ? getDisbursalEmploymentMixShort : getDisbursalEmploymentMix;
        empFn({ range, scope, fromDate, toDate, utmSource, utmMedium, signal: controller.signal })
            .then(res => { if (!controller.signal.aborted) setData(res?.data?.data || []); })
            .catch(e => { if (!controller.signal.aborted) console.error(e); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range, scope, fromDate, toDate, utmSource, utmMedium]);

    const total = data.reduce((s, d) => s + d.value, 0);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-full flex flex-col">
            <div>
                <h3 className="text-[14.5px] font-semibold tracking-tight text-gray-900">Employment mix</h3>
                <p className="text-[12.5px] text-gray-500 mt-1">Disbursals by employment type</p>
            </div>

            <div className="relative h-[190px] mt-3">
                {loading ? (
                    <PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" />
                ) : data.length === 0 ? (
                    <div className="h-full grid place-items-center text-gray-400 text-sm">No data</div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="#fff" strokeWidth={3}>
                                    {data.map((d, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#fff', border: '1px solid #d6d4cb', borderRadius: 10, fontSize: 12 }}
                                    formatter={(v, n) => [`${fmtNum(v)} (${((v / total) * 100).toFixed(1)}%)`, n]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[24px] font-semibold leading-none">{fmtNum(total)}</span>
                            <span className="text-[10px] text-gray-400 mt-1 tracking-wider">DISBURSALS</span>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
                {data.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: palette[i % palette.length] }} />
                            <span className="text-[12.5px] truncate max-w-[150px]">{d.name}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[12.5px] font-medium">{fmtNum(d.value)}</span>
                            <span className="font-mono text-[11px] text-gray-400 min-w-[42px] text-right">
                                {total ? ((d.value / total) * 100).toFixed(1) : '0.0'}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* LENDER DATE-WISE BREAKDOWN MODAL */
const LenderBreakdownModal = ({ lender, range, scope, fromDate, toDate, utmSource, utmMedium, onClose }) => {
    const [data, setData] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [sortDir, setSortDir] = useState('desc'); // 'desc' = newest first

    useEffect(() => {
        if (!lender) return;
        const controller = new AbortController();
        setLoading(true);
        getDisbursalLenderBreakdown({ lender, range, scope, fromDate, toDate, utmSource, utmMedium, signal: controller.signal })
            .then(res => {
                if (controller.signal.aborted) return;
                const d = res?.data?.data || {};
                setData(d.data || []);
                setTotalAmount(d.totalAmount || 0);
                setTotalCount(d.totalCount || 0);
            })
            .catch(e => { if (!controller.signal.aborted) console.error(e); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [lender, range, scope, fromDate, toDate, utmSource, utmMedium]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const sortedData = useMemo(
        () => [...data].sort((a, b) =>
            sortDir === 'desc'
                ? new Date(b.bucket) - new Date(a.bucket)
                : new Date(a.bucket) - new Date(b.bucket)
        ),
        [data, sortDir]
    );

    const maxAmount = sortedData.reduce((m, d) => Math.max(m, d.amount), 0) || 1;

    const exportCsv = () => {
        const header = ['Date', 'Amount', 'Count'];
        const rows = sortedData.map(d => [fmtDate(d.bucket), d.amount, d.count]);
        const csv = [header, ...rows]
            .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${lender}-daily-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-[720px] max-h-[88vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-start gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <LenderAvatar name={lender} size={36} />
                            <div>
                                <h3 className="text-[15px] font-semibold tracking-tight text-gray-900">{lender}</h3>
                                <p className="text-[12px] text-gray-500">Date-wise disbursal breakdown · {range}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition">
                        <X size={14} />
                    </button>
                </div>

                {/* Summary */}
                <div className="px-5 py-3 grid grid-cols-3 gap-3 border-b border-gray-100 bg-gray-50/60">
                    <div>
                        <div className="text-[10.5px] text-gray-400 uppercase tracking-wider">Total Amount</div>
                        <div className="font-mono text-[15px] font-semibold text-purple-700 mt-0.5">
                            {fmtINRFull(totalAmount)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10.5px] text-gray-400 uppercase tracking-wider">Total Disbursals</div>
                        <div className="font-mono text-[15px] font-semibold text-gray-900 mt-0.5">{fmtNum(totalCount)}</div>
                    </div>
                    <div>
                        <div className="text-[10.5px] text-gray-400 uppercase tracking-wider">Active Days</div>
                        <div className="font-mono text-[15px] font-semibold text-gray-900 mt-0.5">{fmtNum(sortedData.length)}</div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-5 py-2 flex justify-between items-center border-b border-gray-100">
                    <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition">
                        <ArrowUpDown size={11} />
                        Date: {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
                    </button>
                    <button onClick={exportCsv}
                        disabled={!sortedData.length}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                        <Download size={11} /> Export CSV
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="h-[200px]"><PremiumLoader fullHeight size="md" /></div>
                    ) : sortedData.length === 0 ? (
                        <div className="h-[200px] grid place-items-center text-gray-400 text-sm">No disbursals in selected range</div>
                    ) : (
                        <table className="w-full text-[13px]">
                            <thead className="sticky top-0 bg-white border-b border-gray-200">
                                <tr>
                                    <th className="text-left font-medium text-[11px] tracking-wider uppercase text-gray-400 px-5 py-2.5">Date</th>
                                    <th className="text-left font-medium text-[11px] tracking-wider uppercase text-gray-400 px-5 py-2.5">Share</th>
                                    <th className="text-right font-medium text-[11px] tracking-wider uppercase text-gray-400 px-5 py-2.5">Count</th>
                                    <th className="text-right font-medium text-[11px] tracking-wider uppercase text-gray-400 px-5 py-2.5">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map((d, i) => {
                                    const pct = (d.amount / maxAmount) * 100;
                                    const sharePct = totalAmount ? (d.amount / totalAmount) * 100 : 0;
                                    return (
                                        <tr key={d.bucket || i} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0">
                                            <td className="px-5 py-2.5">
                                                <div className="font-mono text-[12.5px] text-gray-800">{fmtDate(d.bucket)}</div>
                                                <div className="text-[10.5px] text-gray-400 mt-0.5">{fmtTimeAgo(d.bucket)}</div>
                                            </td>
                                            <td className="px-5 py-2.5">
                                                <div className="flex items-center gap-2 min-w-[140px]">
                                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full"
                                                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${COLORS.brand}, ${COLORS.brand2})` }} />
                                                    </div>
                                                    <span className="font-mono text-[10.5px] text-gray-400 min-w-[34px] text-right">
                                                        {sharePct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-2.5 font-mono text-right text-[12.5px] text-gray-700">{fmtNum(d.count)}</td>
                                            <td className="px-5 py-2.5 font-mono text-right text-[13px] font-semibold text-purple-700">
                                                {fmtINRFull(d.amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

// RapidMoney is a SHORT-ticket lender; hide it from the HIGH-ticket disbursal
// view where it should not be itemised. Matches "RPM" / "RapidMoney" defensively.
const isRapidMoneyLender = (name) => {
    const n = String(name || '').toLowerCase().replace(/[\s_-]/g, '');
    return n === 'rpm' || n === 'rapidmoney';
};

/* LENDER LIST (used for both amount & count) */
const LenderChart = ({ kind, data, loading, onLenderClick }) => {
    const isAmount = kind === 'amount';
    const sorted = useMemo(
        () => [...data].sort((a, b) => isAmount ? b.amount - a.amount : b.count - a.count),
        [data, isAmount]
    );
    const max = sorted[0]?.[kind] || 1;
    const total = sorted.reduce((s, d) => s + d[kind], 0);
    const Icon = isAmount ? Wallet : Hash;
    const title = isAmount ? 'Total disbursal amount by lender' : 'Disbursal count by lender';
    const subtitle = isAmount ? 'Ranked by ₹ value' : 'Ranked by transaction volume';
    const accent = isAmount ? COLORS.brand : COLORS.info;
    const accentBg = isAmount ? 'bg-purple-50' : 'bg-blue-50';

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-full">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg grid place-items-center ${accentBg}`}>
                            <Icon size={13} style={{ color: accent }} />
                        </div>
                        <h3 className="text-[14.5px] font-semibold tracking-tight text-gray-900">{title}</h3>
                    </div>
                    <p className="text-[12.5px] text-gray-500 mt-1 ml-9">{subtitle}</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    <Building2 size={11} /> {sorted.length} lenders
                </span>
            </div>

            {loading ? (
                <div className="h-[300px]"><PremiumLoader fullHeight size="lg" sublabel="Crunching numbers…" /></div>
            ) : sorted.length === 0 ? (
                <div className="h-[300px] grid place-items-center text-gray-400 text-sm">No data</div>
            ) : (
                <div className="flex flex-col gap-1">
                    {sorted.map((d, i) => {
                        const v = d[kind];
                        const pct = (v / max) * 100;
                        const sharePct = total ? (v / total) * 100 : 0;
                        return (
                            <div key={d.name + i}
                                onClick={() => onLenderClick && onLenderClick(d.name)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' && onLenderClick) onLenderClick(d.name); }}
                                title="Click to view date-wise breakdown"
                                className="grid grid-cols-[140px_1fr_90px] gap-3 items-center py-2 px-1 rounded-md hover:bg-gray-50 cursor-pointer transition">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-[11px] w-[18px] text-gray-400">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <LenderAvatar name={d.name} size={20} />
                                    <span className="text-[12.5px] font-medium truncate" title={d.name}>{d.name}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, ${COLORS.brand2})` }} />
                                    </div>
                                    <div className="text-[10.5px] text-gray-400">{sharePct.toFixed(1)}% share</div>
                                </div>
                                <div className="font-mono text-[12.5px] font-semibold text-right">
                                    {isAmount ? fmtINRFull(v) : fmtNum(v)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-[12px]">
                <span className="text-gray-400">Total</span>
                <span className="font-mono font-semibold">
                    {isAmount ? fmtINRFull(Math.round(total)) : fmtNum(total)}
                </span>
            </div>
        </div>
    );
};

/* TRANSACTIONS TABLE */
const TransactionsTable = ({ range, scope, fromDate, toDate, utmSource, utmMedium }) => {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [lenderFilter, setLenderFilter] = useState('All');
    const [empFilter, setEmpFilter] = useState('All');
    const [sortKey, setSortKey] = useState('disb_dt');
    const [sortDir, setSortDir] = useState('desc');

    // Local date-range override so the user can narrow the transactions table
    // without disturbing the dashboard-wide KPIs / charts above. Seeded from
    // the parent range each time it changes, then editable in place.
    // `localRange` = 'parent' when synced, 'custom' once the user edits dates.
    const [localFromDate, setLocalFromDate] = useState(fromDate || '');
    const [localToDate, setLocalToDate] = useState(toDate || '');
    const [localRangeMode, setLocalRangeMode] = useState('parent');
    useEffect(() => {
        // When parent range changes, reset local override back to parent.
        setLocalFromDate(fromDate || '');
        setLocalToDate(toDate || '');
        setLocalRangeMode('parent');
    }, [fromDate, toDate, range]);

    // Effective dates sent to the API: local override wins when active.
    const effFromDate = localRangeMode === 'custom' ? localFromDate : fromDate;
    const effToDate = localRangeMode === 'custom' ? localToDate : toDate;
    // When the user has overridden, range token shouldn't drive backend bounds.
    const effRange = localRangeMode === 'custom' ? 'Custom' : range;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [filteredAmount, setFilteredAmount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ lenders: [], employmentTypes: [] });

    useEffect(() => {
        getDisbursalFilterOptions({ scope })
            .then(res => {
                const opts = res?.data?.data || { lenders: [], employmentTypes: [] };
                // Hide RapidMoney (RPM) from the lender filter dropdown in the
                // HIGH-ticket view (short scope keeps it — it's a short lender).
                if (scope !== 'short') {
                    opts.lenders = (opts.lenders || []).filter(l => !isRapidMoneyLender(l));
                }
                setFilterOptions(opts);
            })
            .catch(e => console.error(e));
    }, [scope]);

    // Search is intentionally NOT sent to the backend — the SP behind
    // /transactions doesn't have a search param, so server-side search has
    // no effect. We filter client-side on the rows already loaded.
    // (Trade-off: search only matches within the current page's rows.)
    const fetchData = useCallback((signal) => {
        if (effRange === 'Custom' && (!effFromDate || !effToDate)) return;
        setLoading(true);
        getDisbursalTransactions({
            currentPage: page,
            perPage,
            range: effRange,
            fromDate: effFromDate,
            toDate: effToDate,
            lender: lenderFilter,
            employmentType: empFilter,
            scope,
            utmSource,
            utmMedium,
            signal,
        })
            .then(res => {
                if (signal?.aborted) return;
                const d = res?.data?.data || {};
                let allRows = d.data || [];
                if (scope !== 'short') {
                    // Hide RapidMoney (RPM) from the HIGH-ticket transactions table and
                    // recompute the count + "Total in view" from the RPM-excluded set so
                    // the header numbers stay consistent with the visible rows.
                    allRows = allRows.filter(r => !isRapidMoneyLender(r.lender));
                    setRows(allRows);
                    setTotal(allRows.length);
                    setFilteredAmount(allRows.reduce((s, r) => s + (Number(r.disb_amt) || 0), 0));
                } else {
                    setRows(allRows);
                    setTotal(d.pagination?.total || 0);
                    setFilteredAmount(d.filteredAmount || 0);
                }
            })
            .catch(e => { if (!signal?.aborted) console.error(e); })
            .finally(() => { if (!signal?.aborted) setLoading(false); });
    }, [page, perPage, effRange, effFromDate, effToDate, lenderFilter, empFilter, scope, utmSource, utmMedium]);

    useEffect(() => {
        // Cancel in-flight transactions request when filters / page change.
        // Without this, a slow earlier query can land after a newer one and
        // overwrite the visible rows + filteredAmount with stale data.
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [fetchData]);
    useEffect(() => { setPage(1); }, [lenderFilter, empFilter, effRange, effFromDate, effToDate, utmSource, utmMedium]);

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    // Client-side filter + sort. Search matches against lead_id, customer_name,
    // phone, phone10, lender, external_user_id — case-insensitive substring.
    const displayRows = useMemo(() => {
        let arr = rows;

        const q = String(search || '').trim().toLowerCase();
        if (q) {
            arr = arr.filter(r => {
                const hay = [
                    r.lead_id,
                    r.customer_name,
                    r.phone,
                    r.phone10,
                    r.lender,
                    r.external_user_id,
                ].map(v => v == null ? '' : String(v).toLowerCase()).join(' | ');
                return hay.includes(q);
            });
        }

        arr = [...arr];
        arr.sort((a, b) => {
            let av = a[sortKey], bv = b[sortKey];
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase(); }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return arr;
    }, [rows, search, sortKey, sortDir]);

    const toggleSort = (k) => {
        if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(k); setSortDir('desc'); }
    };

    const SortHead = ({ k, children, align = 'left' }) => (
        <th onClick={() => toggleSort(k)}
            className="text-left font-medium text-[11px] tracking-wider uppercase text-gray-400 px-4 py-3 border-b border-gray-200 bg-gray-50 cursor-pointer select-none hover:text-gray-600"
            style={{ textAlign: align }}>
            <span className="inline-flex items-center gap-1">
                {children}
                <ArrowUpDown size={11} style={{ opacity: sortKey === k ? 1 : 0.35 }} />
            </span>
        </th>
    );

    // Export the FULL filtered set (not just the current page). Uses the
    // same effective dates / lender / employment / utm filters as the table,
    // so what the user sees in the picker is what they get in the CSV.
    // Client-side search box is applied after fetch to mirror the table.
    const exportCsv = async () => {
        if (effRange === 'Custom' && (!effFromDate || !effToDate)) return;
        try {
            const res = await getDisbursalTransactions({
                currentPage: 1,
                perPage: 100000,
                range: effRange,
                fromDate: effFromDate,
                toDate: effToDate,
                lender: lenderFilter,
                employmentType: empFilter,
                scope,
                utmSource,
                utmMedium,
            });
            let allRows = res?.data?.data?.data || [];

            const q = String(search || '').trim().toLowerCase();
            if (q) {
                allRows = allRows.filter(r => {
                    const hay = [
                        r.lead_id, r.customer_name, r.phone, r.phone10,
                        r.lender, r.external_user_id,
                    ].map(v => v == null ? '' : String(v).toLowerCase()).join(' | ');
                    return hay.includes(q);
                });
            }

            const header = ['LeadID', 'Customer', 'Phone', 'Lender', 'Entity', 'DisbAmount', 'DisbDate', 'LeadCreatedDate', 'SanctionAmount', 'EmploymentType', 'MISStatus', 'ClientStatus'];
            const rowsCsv = allRows.map(t => [
                t.lead_id, t.customer_name, t.phone, t.lender, t.entity,
                t.disb_amt, t.disb_dt ? new Date(t.disb_dt).toISOString() : '',
                t.lead_created_dt ? new Date(t.lead_created_dt).toISOString() : '',
                t.sanction_amt, t.employment_type, t.mis_status, t.client_status,
            ]);
            const csv = [header, ...rowsCsv]
                .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
                .join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const fromTag = effFromDate || 'all';
            const toTag = effToDate || 'all';
            a.href = url; a.download = `disbursals_${fromTag}_to_${toTag}.csv`;
            a.click(); URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    // Status pill — small helper so the badge gets a richer money-themed
    // gradient look (green for success, rose for failure, slate for unknown).
    const StatusPill = ({ status }) => {
        const s = String(status || '').trim();
        const isSuccess = /(disbur|success|approved)/i.test(s);
        const isFailure = /(reject|fail|cancel)/i.test(s);
        if (!s) return <span className="text-gray-300 text-[12px]">—</span>;
        const cls = isSuccess
            ? 'bg-gradient-to-r from-green-50 to-green-50 text-green-700 border-green-200 shadow-sm shadow-green-100'
            : isFailure
                ? 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-200 shadow-sm shadow-rose-100'
                : 'bg-gradient-to-r from-slate-50 to-gray-50 text-slate-600 border-slate-200';
        const dot = isSuccess ? 'bg-green-500' : isFailure ? 'bg-rose-500' : 'bg-slate-400';
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
                <span className={`relative flex w-1.5 h-1.5`}>
                    {isSuccess && <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75 animate-ping" />}
                    <span className={`relative inline-flex rounded-full w-1.5 h-1.5 ${dot}`} />
                </span>
                {s}
            </span>
        );
    };

    return (
        <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Top accent stripe — Cready brand gradient (purple→violet) */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500" />

            {/* HEADER — premium card-style with money-icon badge */}
            <div className="px-5 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-br from-white via-purple-50/30 to-violet-50/20">
                <div className="flex justify-between items-start flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        {/* Icon badge */}
                        <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 flex items-center justify-center shadow-md shadow-purple-500/30 ring-1 ring-white/40">
                            <Banknote size={20} className="text-white drop-shadow" />
                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow ring-2 ring-white">
                                <span className="text-[7.5px] font-black text-amber-900 leading-none">₹</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-[15.5px] font-bold tracking-tight bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 bg-clip-text text-transparent">
                                    Disbursal monitoring
                                </h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border border-purple-200/60">
                                    <span className="relative flex w-1.5 h-1.5">
                                        <span className="absolute inline-flex w-full h-full rounded-full bg-purple-400 opacity-75 animate-ping" />
                                        <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-purple-500" />
                                    </span>
                                    {fmtNum(total)} disbursals
                                </span>
                            </div>
                            <p className="text-[12.5px] text-gray-500 mt-1 flex items-center gap-1.5">
                                <IndianRupee size={11} className="text-purple-600" />
                                Total in view: <span className="font-mono text-purple-700 font-bold text-[13px]">{fmtINR(filteredAmount)}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => fetchData()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[12.5px] font-medium text-gray-600 hover:text-purple-700 hover:border-purple-300 hover:bg-purple-50/50 transition">
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-white text-[12.5px] font-semibold shadow-sm shadow-purple-500/30 hover:shadow-md hover:shadow-purple-500/40 hover:from-purple-700 hover:to-violet-700 transition">
                            <FileDown size={13} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <div className="relative min-w-[260px] flex-1 max-w-[360px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input className="w-full rounded-lg py-2 pr-8 pl-9 text-[13px] bg-white border border-gray-200 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition"
                            placeholder="Search lead, customer, phone, lender, UID…"
                            value={search} onChange={e => setSearch(e.target.value)} />
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 grid place-items-center rounded text-gray-400 hover:text-gray-700">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <SearchableLenderSelect
                        value={lenderFilter}
                        options={filterOptions.lenders}
                        onChange={setLenderFilter}
                    />
                    <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition">
                        <option value="All">All Employment</option>
                        {filterOptions.employmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    {/* Table-local date-range override. Defaults to the parent
                        dashboard's dates; editing either input narrows the
                        transactions table only — KPIs/charts above stay tied
                        to the dashboard-wide range. */}
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 bg-white">
                        <Calendar size={13} className="text-purple-600" />
                        <input type="date"
                            value={localFromDate}
                            max={localToDate || todayISO()}
                            onChange={e => { setLocalFromDate(e.target.value); setLocalRangeMode('custom'); }}
                            className="px-1 py-0.5 text-[12px] outline-none bg-transparent" />
                        <span className="text-[12px] text-gray-400">to</span>
                        <input type="date"
                            value={localToDate}
                            min={localFromDate}
                            max={todayISO()}
                            onChange={e => { setLocalToDate(e.target.value); setLocalRangeMode('custom'); }}
                            className="px-1 py-0.5 text-[12px] outline-none bg-transparent" />
                        {localRangeMode === 'custom' && (
                            <button
                                onClick={() => {
                                    setLocalFromDate(fromDate || '');
                                    setLocalToDate(toDate || '');
                                    setLocalRangeMode('parent');
                                }}
                                title="Reset to dashboard range"
                                className="ml-0.5 p-0.5 grid place-items-center rounded text-gray-400 hover:text-purple-700"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                    <thead>
                        <tr className="bg-gradient-to-r from-gray-50 via-purple-50/30 to-gray-50">
                            <SortHead k="lead_id">Lead ID</SortHead>
                            <SortHead k="customer_name">Customer</SortHead>
                            <SortHead k="lender">Lender</SortHead>
                            <SortHead k="disb_amt" align="right">Disb Amount</SortHead>
                            <SortHead k="employment_type">Employment</SortHead>
                            <SortHead k="disb_dt">Disb Date</SortHead>
                            <SortHead k="mis_status">Status</SortHead>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rows.length === 0 && (
                            <tr><td colSpan={8} className="py-10"><PremiumLoader size="md" label="Loading transactions…" /></td></tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-12 text-gray-400">No disbursals match your filters.</td></tr>
                        )}
                        {displayRows.map((t, idx) => (
                            <tr
                                key={`${t.lead_id || idx}-${idx}`}
                                className={`group transition-all border-b border-gray-100 last:border-b-0 ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                } hover:bg-gradient-to-r hover:from-purple-50/60 hover:to-violet-50/40 hover:shadow-[inset_3px_0_0_0_#a855f7]`}
                            >
                                <td className="px-4 py-3.5 font-mono text-[12px] font-semibold text-gray-700 group-hover:text-purple-700 transition">
                                    {t.lead_id || <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="text-[13px] font-medium text-gray-800">{t.customer_name || '—'}</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5 font-mono">{t.phone10 || t.phone || ''}</div>
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-50 group-hover:bg-white border border-gray-200/60 transition">
                                        <LenderAvatar name={t.lender} size={22} />
                                        <span className="text-[12.5px] font-medium text-gray-800">{t.lender || '—'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                    <div className="inline-flex items-baseline gap-0.5 font-mono text-[14px] font-bold tabular-nums bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
                                        {fmtINRFull(t.disb_amt)}
                                    </div>
                                </td>
                                <td className="px-4 py-3.5 text-[12.5px] text-gray-700">
                                    {t.employment_type
                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11.5px] font-medium border border-slate-200/60">{t.employment_type}</span>
                                        : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-1.5 text-[12px] text-gray-700 font-medium">
                                        <Calendar size={11} className="text-purple-600/70" />
                                        {fmtDate(t.disb_dt)}
                                    </div>
                                    <div className="text-[10.5px] text-gray-400 mt-0.5 ml-[18px]">{fmtTimeAgo(t.disb_dt)}</div>
                                </td>
                                <td className="px-4 py-3.5">
                                    <StatusPill status={t.mis_status} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="px-5 py-3 flex justify-between items-center border-t border-gray-100 bg-gradient-to-r from-gray-50/60 via-white to-purple-50/40">
                <div className="flex items-center gap-3">
                    <span className="text-[12px] text-gray-500">
                        Showing <span className="font-semibold text-gray-700">{total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)}</span> of <span className="font-semibold text-purple-700">{fmtNum(total)}</span>
                    </span>
                    <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] outline-none focus:border-purple-500">
                        {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-1.5">
                    <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="p-1.5 rounded-md border border-gray-200 bg-white disabled:opacity-40 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition">
                        <ChevronLeft size={14} />
                    </button>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200/60 font-mono text-[12px] font-semibold text-purple-800">
                        {page} <span className="text-purple-400">/</span> {totalPages}
                    </span>
                    <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="p-1.5 rounded-md border border-gray-200 bg-white disabled:opacity-40 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

/* MAIN DASHBOARD
 * scope: 'mv'    -> only phones present in offerLeads
 *        'short' -> only phones present in shortOfferLeads
 *        undef   -> all disbursements (super-admin view)
 */
const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Format any Date as YYYY-MM-DD in local timezone (matches todayISO()).
const fmtISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Resolve a range token into the {fromDate, toDate} that should appear in the
// API URL. Backend computes its own bounds from the range token, but keeping
// the URL params in sync makes the dashboard URL shareable and matches what
// the date picker shows. 'Custom' returns null so the caller preserves the
// user-edited dates; 'All' clears them.
const dateForRange = (r) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fmt = fmtISO;
    if (r === 'All')       return { fromDate: '',                                                            toDate: '' };
    if (r === 'Today')     return { fromDate: fmt(today),                                                    toDate: fmt(today) };
    if (r === 'Yesterday') {
        const y = new Date(today); y.setDate(y.getDate() - 1);
        return { fromDate: fmt(y), toDate: fmt(y) };
    }
    if (r === 'Custom')    return null;
    const days = { '24H': 1, '7D': 7, '30D': 30, '90D': 90 }[r] ?? 0;
    const from = new Date(today); from.setDate(from.getDate() - days);
    return { fromDate: fmt(from), toDate: fmt(today) };
};

export default function DisbursalDashboard({ scope, title, subtitle }) {
    // Default landing state: 'All' range with no date bounds. Initial dates
    // are derived from dateForRange('All') so the URL/API see empty fromDate
    // and toDate on first paint — matching backend's "no filter" semantics.
    const _initialDates = dateForRange('All') || { fromDate: '', toDate: '' };
    const [range, setRange] = useState('All');
    const [fromDate, setFromDate] = useState(_initialDates.fromDate);
    const [toDate, setToDate] = useState(_initialDates.toDate);
    const [utmSource, setUtmSource] = useState('');
    const [utmSourceOptions, setUtmSourceOptions] = useState([]);
    const [utmMedium, setUtmMedium] = useState('');
    const [utmMediumOptions, setUtmMediumOptions] = useState([]);
    const [kpis, setKpis] = useState({ totalAmount: 0, count: 0, avgTicket: 0, avgProcMin: 0 });
    const [lenderStats, setLenderStats] = useState([]);
    const [kpiLoading, setKpiLoading] = useState(true);
    const [lenderLoading, setLenderLoading] = useState(true);
    const [selectedLender, setSelectedLender] = useState(null);
    // "Updated X ago" pill — lastRefreshedAt is stamped when the KPI payload
    // lands; nowTick re-renders the relative label every 30s so it counts up on
    // its own (tells users how fresh the data is, so they don't keep refreshing).
    const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
    const [nowTick, setNowTick] = useState(() => Date.now());
    // First-load premium loader gate — shown once until the first KPI payload
    // arrives, then drops to in-place card-level skeletons.
    const [firstLoad, setFirstLoad] = useState(true);
    const [loaderPhrase, setLoaderPhrase] = useState(0);
    // Fake progress percentage — eases toward 95% so the bar always looks
    // alive without overpromising completion. Snaps to 100 when firstLoad
    // flips false (right before unmount).
    const [loaderPct, setLoaderPct] = useState(8);
    const LOADER_PHRASES = [
        'Tallying disbursals…',
        'Computing lender splits…',
        'Building trend curves…',
        'Crunching employment mix…',
        'Polishing the dashboard…',
    ];

    useEffect(() => {
        if (!firstLoad) return;
        const phraseId = setInterval(
            () => setLoaderPhrase((i) => (i + 1) % LOADER_PHRASES.length),
            1400
        );
        // Asymptotic ease toward 95 — classic "always loading" pattern that
        // never quite hits 100, so the bar feels organic until the real data
        // arrives and the whole loader is replaced.
        const pctId = setInterval(
            () => setLoaderPct((p) => Math.min(p + Math.max((95 - p) * 0.12, 0.5), 95)),
            220
        );
        return () => { clearInterval(phraseId); clearInterval(pctId); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firstLoad]);

    // Tick every 30s so the "Updated X ago" pill counts up on its own (no fetch).
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);

    // Relative "X ago" label for the last successful data load.
    const refreshedLabel = useMemo(() => {
        if (!lastRefreshedAt) return null;
        const s = Math.max(0, Math.floor((nowTick - lastRefreshedAt) / 1000));
        if (s < 10) return 'just now';
        if (s < 60) return `${s}s ago`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
        const h = Math.floor(m / 60);
        return `${h} hr${h > 1 ? 's' : ''} ago`;
    }, [lastRefreshedAt, nowTick]);

    // Skip API calls when Custom is selected but dates are missing.
    const customIncomplete = range === 'Custom' && (!fromDate || !toDate);

    // Load utm_source dropdown values once on mount (cached on the server
    // side for 10 minutes). Scoped to the dashboard so the right table
    // (offerLeads vs shortOfferLeads) is queried.
    //
    // Always-show baseline sources — useful when the DB hasn't yet seen any
    // disbursals from a known traffic source but the user still wants to be
    // able to select / filter by it. Merged with the API result (case-insensitive
    // dedupe, sorted alphabetically).
    const KNOWN_UTM_SOURCES = ['google', 'google_ads'];
    // Mediums in this codebase are lender-name-based (campaign-per-lender model),
    // not the conventional 'cpc'/'organic'/etc. Matches the analytics page list.
    const KNOWN_UTM_MEDIUMS = ['kreditbee', 'moneyview', 'zype', 'SC', 'meta'];
    useEffect(() => {
        let cancelled = false;
        // Case-insensitive de-dupe + alphabetical sort, merging a hard-coded
        // baseline list with whatever the API returns.
        const mergeAndSort = (knownList, apiList) => {
            const seen = new Set();
            const merged = [];
            for (const s of [...knownList, ...(Array.isArray(apiList) ? apiList : [])]) {
                const key = String(s).toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                merged.push(s);
            }
            merged.sort((a, b) => a.localeCompare(b));
            return merged;
        };

        getDisbursalFilterOptions({ scope })
            .then(res => {
                if (cancelled) return;
                const opts = res?.data?.data || {};
                setUtmSourceOptions(mergeAndSort(KNOWN_UTM_SOURCES, opts.utmSources));
                // Synthetic "no medium" option = our own landing-page traffic
                // (utm_medium IS NULL/empty). High-ticket dashboard labels it
                // "QuickLoans", short-ticket "EasyLoans". Pin it at the top so it's
                // always selectable, and drop any real duplicate from the API list.
                const syntheticMedium = scope === 'short' ? 'EasyLoans' : 'QuickLoans';
                const mediums = mergeAndSort(KNOWN_UTM_MEDIUMS, opts.utmMediums)
                    .filter(m => !['quickloans', 'easyloan', 'easyloans'].includes(String(m).toLowerCase()));
                setUtmMediumOptions([syntheticMedium, ...mediums]);
            })
            .catch(err => console.error('Failed to load utm options:', err));
        return () => { cancelled = true; };
    }, [scope]);

    useEffect(() => {
        if (customIncomplete) return;
        // Cancel previous KPI request on filter change to avoid stale overwrite.
        const controller = new AbortController();
        setKpiLoading(true);
        getDisbursalKpis({ range, scope, fromDate, toDate, utmSource, utmMedium, signal: controller.signal })
            .then(res => {
                if (!controller.signal.aborted) {
                    setKpis(res?.data?.data || {});
                    setLastRefreshedAt(Date.now()); // stamp "Updated X ago" on success
                }
            })
            .catch(e => { if (!controller.signal.aborted) console.error(e); })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setKpiLoading(false);
                    setFirstLoad(false);  // first KPI fetch done — drop loader
                }
            });
        return () => controller.abort();
    }, [range, scope, fromDate, toDate, utmSource, utmMedium, customIncomplete]);

    useEffect(() => {
        if (customIncomplete) return;
        const controller = new AbortController();
        setLenderLoading(true);
        // Switch to the short-ticket endpoint when scope='short' so the
        // chart joins shortOfferLeads server-side and stays consistent with
        // the short KPI / trend numbers.
        const lenderFn = scope === 'short' ? getDisbursalLenderStatsShort : getDisbursalLenderStats;
        lenderFn({ range, scope, fromDate, toDate, utmSource, utmMedium, signal: controller.signal })
            .then(res => {
                if (controller.signal.aborted) return;
                let rows = res?.data?.data || [];
                // Hide RapidMoney (RPM) from the HIGH-ticket disbursal view — it's a
                // short-ticket lender; the short scope keeps it.
                if (scope !== 'short') rows = rows.filter(d => !isRapidMoneyLender(d.name));
                setLenderStats(rows);
            })
            .catch(e => { if (!controller.signal.aborted) console.error(e); })
            .finally(() => { if (!controller.signal.aborted) setLenderLoading(false); });
        return () => controller.abort();
    }, [range, scope, fromDate, toDate, utmSource, utmMedium, customIncomplete]);

    // Premium first-load loader — purple/violet theme matching the dashboard's
    // brand (Layers icon + "Operations" purple pill). Glassmorphism frosted
    // card, floating ₹ symbols (loan/money theme), SVG gradient progress arc,
    // gold sparkle badge, rotating phrases, and "Secure · Encrypted" footer.
    // Sidebar / topbar stay visible (rendered inside the page container, no
    // fixed inset-0 overlay).
    if (firstLoad) {
        return (
            <div className="max-w-[1440px] mx-auto px-2 pb-10">
                <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden rounded-2xl border border-purple-100/70 shadow-sm">

                    {/* Layered mesh background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-purple-50/40 to-violet-50/50" />

                    {/* Floating ₹ symbols — money / loan-aggregator texture */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        {[
                            { top: '8%',  left: '15%', size: 'text-5xl', op: 0.06, delay: '0s'   },
                            { top: '20%', left: '82%', size: 'text-6xl', op: 0.07, delay: '1s'   },
                            { top: '55%', left: '12%', size: 'text-7xl', op: 0.05, delay: '0.5s' },
                            { top: '72%', left: '85%', size: 'text-5xl', op: 0.06, delay: '1.5s' },
                            { top: '88%', left: '38%', size: 'text-4xl', op: 0.05, delay: '0.8s' },
                            { top: '32%', left: '50%', size: 'text-3xl', op: 0.04, delay: '2s'   },
                        ].map((s, i) => (
                            <span
                                key={i}
                                className={`absolute font-black text-purple-900 ${s.size} animate-pulse`}
                                style={{ top: s.top, left: s.left, opacity: s.op, animationDelay: s.delay, animationDuration: '4s' }}
                            >₹</span>
                        ))}
                    </div>

                    {/* Floating gradient blobs for depth */}
                    <div className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-purple-300/30 blur-3xl animate-pulse" />
                    <div className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-violet-300/30 blur-3xl animate-pulse" style={{ animationDelay: '0.8s' }} />
                    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] rounded-full bg-amber-200/15 blur-3xl" />

                    {/* Card wrapper with rotating conic-gradient glow border */}
                    <div className="relative max-w-md w-full mx-4">

                        {/* Conic glow ring — sits behind the card; visible as a
                            glowing border via the small inset offset + blur. */}
                        <div
                            className="absolute -inset-[1.5px] rounded-3xl opacity-70 blur-[2px]"
                            style={{
                                background: 'conic-gradient(from 0deg, transparent 0%, #a855f7 22%, #6366f1 38%, transparent 55%, transparent 100%)',
                                animation: 'spin 4s linear infinite',
                            }}
                        />

                        {/* Glassmorphism card */}
                        <div className="relative z-10 flex flex-col items-center gap-6 px-10 py-12 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-2xl shadow-purple-500/15">

                            {/* Icon zone with sparkles + rotating arc + counter-ring + gold ₹ + ripple */}
                            <div className="relative w-36 h-36 flex items-center justify-center">

                                {/* Twinkling sparkles around the icon */}
                                <Sparkles size={12} className="absolute top-1  left-3  text-amber-400  animate-pulse" style={{ animationDelay: '0s',   animationDuration: '1.8s' }} />
                                <Sparkles size={10} className="absolute top-4  right-2 text-purple-400 animate-pulse" style={{ animationDelay: '0.6s', animationDuration: '2.2s' }} />
                                <Sparkles size={11} className="absolute bottom-2 left-5 text-violet-400    animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '2s'   }} />
                                <Sparkles size={9}  className="absolute bottom-5 right-4 text-amber-300  animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2.4s' }} />

                                {/* Outer rotating gradient arc */}
                                <svg
                                    className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)]"
                                    viewBox="0 0 100 100"
                                    style={{ animation: 'spin 3.5s linear infinite' }}
                                >
                                    <defs>
                                        <linearGradient id="disbArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%"   stopColor="#a855f7" />
                                            <stop offset="50%"  stopColor="#6366f1" />
                                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx="50" cy="50" r="46" fill="none" stroke="#ede9fe" strokeWidth="2" />
                                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#disbArcGrad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 220" />
                                </svg>

                                {/* Inner counter-rotating ring */}
                                <div
                                    className="absolute inset-5 rounded-full border-[1.5px] border-violet-200/40 border-b-violet-500 border-r-violet-500"
                                    style={{ animation: 'spin 2.2s linear infinite reverse' }}
                                />

                                {/* Expanding ripple ring */}
                                <div className="absolute inset-8 rounded-2xl border-2 border-purple-400/50 animate-ping" style={{ animationDuration: '2.5s' }} />

                                {/* Pulsing inner halo */}
                                <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-500/25 to-violet-500/25 blur-xl animate-pulse" />

                                {/* Icon card with premium gold ₹ sparkle badge */}
                                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 flex items-center justify-center shadow-xl shadow-purple-500/40 ring-1 ring-white/30">
                                    <Layers size={28} className="text-white drop-shadow-md" />
                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md shadow-amber-400/50 ring-2 ring-white">
                                        <span className="text-[9px] font-black text-amber-900 leading-none">₹</span>
                                    </div>
                                </div>
                            </div>

                            {/* Brand pill + title + rotating phrase */}
                            <div className="text-center">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-full bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200/50">
                                    <span className="relative flex w-1.5 h-1.5">
                                        <span className="absolute inline-flex w-full h-full rounded-full bg-purple-400 opacity-75 animate-ping" />
                                        <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-purple-500" />
                                    </span>
                                    <span className="text-[10.5px] font-semibold tracking-[0.12em] text-purple-700 uppercase">Live Disbursal Feed</span>
                                </div>
                                <h2 className="text-[23px] font-bold bg-gradient-to-r from-purple-800 via-violet-700 to-purple-800 bg-clip-text text-transparent tracking-tight leading-tight">
                                    {title || 'Loading Disbursal Dashboard'}
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

                            {/* Mini KPI tile teasers — mirror the 3 KPI cards
                                (Total disbursed · Disbursals · Avg ticket) */}
                            <div className="grid grid-cols-3 gap-2 w-full">
                                {[
                                    { label: 'Total disbursed', tint: 'from-purple-100/80 to-purple-50' },
                                    { label: 'Disbursals',      tint: 'from-violet-100/80    to-violet-50' },
                                    { label: 'Avg ticket',      tint: 'from-cyan-100/80    to-cyan-50' },
                                ].map((t, i) => (
                                    <div
                                        key={i}
                                        className={`relative h-14 rounded-xl bg-gradient-to-br ${t.tint} border border-purple-200/40 p-2 overflow-hidden`}
                                    >
                                        <span className="text-[8.5px] font-semibold text-purple-700/70 tracking-wider uppercase">{t.label}</span>
                                        <div className="mt-1 h-3 w-2/3 rounded bg-gradient-to-r from-purple-200/80 via-violet-300/70 to-purple-200/80 bg-[length:200%_100%] animate-shimmer" />
                                    </div>
                                ))}
                            </div>

                            {/* Premium progress bar — ticking percentage + sliding shine */}
                            <div className="w-full">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10.5px] text-gray-500 font-medium">Preparing your dashboard</span>
                                    <span className="text-[11.5px] font-bold tabular-nums bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
                                        {Math.round(loaderPct)}%
                                    </span>
                                </div>
                                <div className="relative h-1.5 rounded-full bg-purple-100/70 overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500 transition-[width] duration-500 ease-out"
                                        style={{ width: `${loaderPct}%`, boxShadow: '0 0 12px rgba(16,185,129,0.6)' }}
                                    />
                                    {/* Sliding shine over the filled portion */}
                                    <div
                                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer bg-[length:200%_100%]"
                                        style={{ width: `${loaderPct}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-[10px] text-gray-400 font-semibold tracking-[0.14em] uppercase">Secure · Encrypted</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0s' }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500    animate-bounce" style={{ animationDelay: '0.15s' }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500    animate-bounce" style={{ animationDelay: '0.3s' }} />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1440px] mx-auto px-2 pb-10">
            {/* PAGE HEADER — premium banner with money-themed accent bar,
                gradient title text, animated live-dot, and richer pill bg. */}
            <div className="relative overflow-hidden mb-6 rounded-2xl bg-gradient-to-br from-white via-purple-50/40 to-violet-50/30 border border-purple-100/60 shadow-sm">
                {/* Top accent stripe */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500" />
                {/* Soft corner glow */}
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-purple-300/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-violet-300/10 blur-3xl pointer-events-none" />

                <div className="relative flex items-end justify-between p-5 flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                        {/* Hero icon badge */}
                        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30 ring-1 ring-white/40">
                            <Layers size={26} className="text-white drop-shadow" />
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md ring-2 ring-white">
                                <span className="text-[9px] font-black text-amber-900 leading-none">₹</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border border-purple-200">
                                    <span className="relative flex w-1.5 h-1.5">
                                        <span className="absolute inline-flex w-full h-full rounded-full bg-purple-400 opacity-75 animate-ping" />
                                        <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-purple-500" />
                                    </span>
                                    <TrendingUp size={11} /> 
                                </span>
                                {/* <span className="text-[12px] text-gray-500 font-medium">Live disbursal data</span> */}
                            </div>
                            <h1 className="text-[28px] font-bold leading-tight tracking-tight bg-gradient-to-r from-gray-900 via-purple-900 to-violet-900 bg-clip-text text-transparent">
                                {title || 'Disbursal monitoring'}
                            </h1>
                            <p className="text-[13px] text-gray-500 mt-1">
                                {subtitle || 'Real-time view of loan disbursals across all lender partners.'}
                            </p>
                        </div>
                    </div>

                    {/* "Updated X ago" pill — shows how fresh the data is so users
                        don't keep hitting refresh. Counts up on its own (30s tick). */}
                    {refreshedLabel && (
                        <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/70 text-gray-600 border border-gray-200 shadow-sm backdrop-blur-sm"
                            title="Time since the dashboard data was last loaded"
                        >
                            <span className="relative flex w-1.5 h-1.5">
                                <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75 animate-ping" />
                                <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-green-500" />
                            </span>
                            Updated {refreshedLabel}
                        </div>
                    )}
                </div>
            </div>

            {/* FILTER STRIP — its own card so it breathes from the title */}
            <div className="flex items-center gap-2 flex-wrap mb-6 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="inline-flex items-center gap-1.5 text-gray-500 px-2">
                    <Calendar size={13} className="text-purple-600" />
                    <span className="text-[12px] font-semibold">Range:</span>
                </div>
                <div className="inline-flex p-[3px] gap-[2px] rounded-lg bg-gradient-to-r from-gray-100 to-purple-50/60 border border-gray-200 flex-wrap">
                    {['Today', 'Yesterday', '24H', '7D', '30D', '90D', 'All', 'Custom'].map(r => (
                        <button key={r}
                            onClick={() => {
                                setRange(r);
                                const d = dateForRange(r);
                                if (d) {
                                    setFromDate(d.fromDate);
                                    setToDate(d.toDate);
                                }
                            }}
                            className={`px-3 py-1 rounded-md text-[12px] font-semibold transition ${
                                range === r
                                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md shadow-purple-500/30'
                                    : 'text-gray-600 hover:text-purple-700 hover:bg-white'
                            }`}>
                            {r}
                        </button>
                    ))}
                </div>
                    {range === 'Custom' && (
                        <div className="inline-flex items-center gap-1.5">
                            <input type="date"
                                value={fromDate}
                                max={toDate || todayISO()}
                                onChange={e => setFromDate(e.target.value)}
                                className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] outline-none focus:border-purple-500" />
                            <span className="text-[12px] text-gray-400">to</span>
                            <input type="date"
                                value={toDate}
                                min={fromDate}
                                max={todayISO()}
                                onChange={e => setToDate(e.target.value)}
                                className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] outline-none focus:border-purple-500" />
                        </div>
                    )}

                    {/* UTM Source filter — narrows disbursals by the source the
                        applicant came from (resolved via offerLeads phone match). */}
                    <div className="inline-flex items-center gap-1.5 ml-1">
                        <span className="text-[12px] font-medium text-gray-400">Source:</span>
                        <select
                            value={utmSource}
                            onChange={e => setUtmSource(e.target.value)}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] outline-none focus:border-purple-500 bg-white min-w-[140px]"
                        >
                            <option value="">All Sources</option>
                            {utmSourceOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        {utmSource && (
                            <button
                                onClick={() => setUtmSource('')}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
                                title="Clear source filter"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                {/* UTM Medium filter — narrows disbursals by the campaign
                    medium (resolved via offerLeads phone match). */}
                <div className="inline-flex items-center gap-1.5 ml-1">
                    <span className="text-[12px] font-medium text-gray-400">Medium:</span>
                    <select
                        value={utmMedium}
                        onChange={e => setUtmMedium(e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] outline-none focus:border-purple-500 bg-white min-w-[140px]"
                    >
                        <option value="">All Mediums</option>
                        {utmMediumOptions.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    {utmMedium && (
                        <button
                            onClick={() => setUtmMedium('')}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
                            title="Clear medium filter"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Numbers tick up from 0 → target on each reload / filter
                    change via KpiCard's useCountUp hook. `value` is a raw
                    number; `format` runs every animation frame. */}
                <KpiCard icon={Wallet} label="Total disbursed"
                    loading={kpiLoading}
                    value={Math.round(kpis.totalAmount || 0)}
                    format={(n) => fmtINRFull(Math.round(n))}
                    sub={`across ${fmtNum(kpis.count)} disbursals · ${range}`}
                    color={COLORS.pos} />
                <KpiCard icon={Activity} label="Total disbursals"
                    loading={kpiLoading}
                    value={Number(kpis.count) || 0}
                    format={(n) => fmtNum(Math.round(n))}
                    sub={`in last ${range.toLowerCase()}`}
                    color={COLORS.accent} />
                <KpiCard icon={Banknote} label="Avg. ticket size"
                    loading={kpiLoading}
                    value={Math.round(kpis.avgTicket || 0)}
                    format={(n) => fmtINRFull(Math.round(n))}
                    sub="per disbursal"
                    color={COLORS.brand2} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                <div className="lg:col-span-2"><TrendChart range={range} scope={scope} fromDate={fromDate} toDate={toDate} utmSource={utmSource} utmMedium={utmMedium} /></div>
                <div><EmploymentMix range={range} scope={scope} fromDate={fromDate} toDate={toDate} utmSource={utmSource} utmMedium={utmMedium} /></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                <LenderChart kind="amount" data={lenderStats} loading={lenderLoading} onLenderClick={setSelectedLender} />
                <LenderChart kind="count" data={lenderStats} loading={lenderLoading} onLenderClick={setSelectedLender} />
            </div>

            <TransactionsTable range={range} scope={scope} fromDate={fromDate} toDate={toDate} utmSource={utmSource} utmMedium={utmMedium} />

            {selectedLender && (
                <LenderBreakdownModal
                    lender={selectedLender}
                    range={range}
                    scope={scope}
                    fromDate={fromDate}
                    toDate={toDate}
                    utmSource={utmSource}
                    utmMedium={utmMedium}
                    onClose={() => setSelectedLender(null)}
                />
            )}

            <ModuleInfoCard
                title={scope === 'mv' ? 'High Disbursal Dashboard' : 'Disbursal Dashboard'}
                subtitle="Tracks which lenders actually disbursed loans — how much, how often, and to whom."
                whatYouSee={[
                    'Headline numbers: total amount disbursed, number of transactions, average ticket size, and success rate.',
                    'Trend chart showing daily / weekly disbursal volume over the selected date range.',
                    'Per-lender breakdown of disbursed amount and transaction count, with each lender’s share of the total.',
                    'Employment mix (Salaried vs Self-Employed) to understand which segments are converting.',
                    'A paginated list of individual disbursal transactions with applicant, lender, amount, and timestamp.',
                ]}
                dataSource={[
                    'Disbursal records are maintained by the finance team in their own system and synced into the dashboard.',
                    'Only disbursals that match an applicant from our offer leads are shown here — non-applicant disbursals are excluded.',
                    'Filters available: date range, lender, employment type, and amount range.',
                ]}
                flow={[
                    'Lender disburses a loan',
                    'Finance team records the disbursal',
                    'System syncs the data in',
                    'Matched with our applicants by phone',
                    'Aggregated into KPIs and charts',
                    'Dashboard renders',
                ]}
            />
        </div>
    );
}
