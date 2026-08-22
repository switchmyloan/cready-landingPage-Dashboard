import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';

// Premium first-load page-level loader. Same visual language as the
// /disbursal-dashboard and /offer-leads loaders, but parameterized so each
// page just supplies its own theme + title + phrases + tiles instead of
// duplicating ~200 lines of JSX per file.
//
// Usage:
//   <PremiumPageLoader
//     theme="sky"
//     title="Loading Short Offer Leads"
//     brandLabel="Live Short Offer Leads"
//     icon={ClipboardList}
//     phrases={['...', '...']}
//     tiles={[{ label: 'Total' }, { label: 'Lenders' }, { label: 'Today' }]}
//     progressLabel="Preparing your leads"
//   />
//
// Themes — predefined Tailwind color triplets that get inlined into the
// gradient classes. Add more here if a new section needs its own palette.
const THEMES = {
    purple: {  // High Ticket leads (default)
        bg:       'from-slate-50 via-purple-50/40 to-indigo-50/50',
        floatTxt: 'text-indigo-900',
        blob1:    'bg-purple-300/30',
        blob2:    'bg-indigo-300/30',
        conic:    'conic-gradient(from 0deg, transparent 0%, #a855f7 22%, #6366f1 38%, transparent 55%, transparent 100%)',
        cardShadow: 'shadow-purple-500/15',
        gradFrom: '#a855f7',
        gradMid:  '#6366f1',
        arcTrack: '#ede9fe',
        innerRing: 'border-indigo-200/40 border-b-indigo-500 border-r-indigo-500',
        ripple:   'border-purple-400/50',
        halo:     'from-purple-500/25 to-indigo-500/25',
        iconBg:   'from-purple-600 via-violet-600 to-indigo-700 shadow-purple-500/40',
        pillBg:   'from-purple-50 to-indigo-50 border-purple-200/50',
        pillText: 'text-purple-700',
        titleGrad: 'from-purple-800 via-violet-700 to-indigo-800',
        tileBorder: 'border-purple-200/40',
        tileLabel: 'text-purple-700/70',
        tileBar:  'from-purple-200/80 via-violet-300/70 to-indigo-200/80',
        progressBg: 'bg-purple-100/70',
        progressBar: 'from-purple-500 via-violet-500 to-indigo-500',
        progressShadow: '0 0 12px rgba(139,92,246,0.6)',
        pctGrad:  'from-purple-700 to-indigo-700',
        dot1: 'bg-purple-500',
        dot2: 'bg-violet-500',
        dot3: 'bg-indigo-500',
    },
    sky: {     // Short Ticket
        bg:       'from-slate-50 via-sky-50/40 to-cyan-50/50',
        floatTxt: 'text-sky-900',
        blob1:    'bg-sky-300/30',
        blob2:    'bg-cyan-300/30',
        conic:    'conic-gradient(from 0deg, transparent 0%, #0ea5e9 22%, #06b6d4 38%, transparent 55%, transparent 100%)',
        cardShadow: 'shadow-sky-500/15',
        gradFrom: '#0ea5e9',
        gradMid:  '#06b6d4',
        arcTrack: '#e0f2fe',
        innerRing: 'border-cyan-200/40 border-b-cyan-500 border-r-cyan-500',
        ripple:   'border-sky-400/50',
        halo:     'from-sky-500/25 to-cyan-500/25',
        iconBg:   'from-sky-600 via-cyan-600 to-blue-700 shadow-sky-500/40',
        pillBg:   'from-sky-50 to-cyan-50 border-sky-200/50',
        pillText: 'text-sky-700',
        titleGrad: 'from-sky-800 via-cyan-700 to-blue-800',
        tileBorder: 'border-sky-200/40',
        tileLabel: 'text-sky-700/70',
        tileBar:  'from-sky-200/80 via-cyan-300/70 to-blue-200/80',
        progressBg: 'bg-sky-100/70',
        progressBar: 'from-sky-500 via-cyan-500 to-blue-500',
        progressShadow: '0 0 12px rgba(14,165,233,0.6)',
        pctGrad:  'from-sky-700 to-cyan-700',
        dot1: 'bg-sky-500',
        dot2: 'bg-cyan-500',
        dot3: 'bg-blue-500',
    },
    emerald: { // Disbursal Dashboard
        bg:       'from-slate-50 via-emerald-50/40 to-teal-50/50',
        floatTxt: 'text-emerald-900',
        blob1:    'bg-emerald-300/30',
        blob2:    'bg-teal-300/30',
        conic:    'conic-gradient(from 0deg, transparent 0%, #10b981 22%, #14b8a6 38%, transparent 55%, transparent 100%)',
        cardShadow: 'shadow-emerald-500/15',
        gradFrom: '#10b981',
        gradMid:  '#14b8a6',
        arcTrack: '#d1fae5',
        innerRing: 'border-teal-200/40 border-b-teal-500 border-r-teal-500',
        ripple:   'border-emerald-400/50',
        halo:     'from-emerald-500/25 to-teal-500/25',
        iconBg:   'from-emerald-600 via-teal-600 to-emerald-700 shadow-emerald-500/40',
        pillBg:   'from-emerald-50 to-teal-50 border-emerald-200/50',
        pillText: 'text-emerald-700',
        titleGrad: 'from-emerald-800 via-teal-700 to-emerald-800',
        tileBorder: 'border-emerald-200/40',
        tileLabel: 'text-emerald-700/70',
        tileBar:  'from-emerald-200/80 via-teal-300/70 to-emerald-200/80',
        progressBg: 'bg-emerald-100/70',
        progressBar: 'from-emerald-500 via-teal-500 to-emerald-500',
        progressShadow: '0 0 12px rgba(16,185,129,0.6)',
        pctGrad:  'from-emerald-700 to-teal-700',
        dot1: 'bg-emerald-500',
        dot2: 'bg-teal-500',
        dot3: 'bg-cyan-500',
    },
};

const PremiumPageLoader = ({
    theme = 'sky',
    title = 'Loading…',
    brandLabel = 'Live Feed',
    icon: Icon = ClipboardList,
    phrases = ['Loading data…', 'Crunching numbers…', 'Polishing the view…'],
    tiles = [{ label: 'Total' }, { label: 'Today' }, { label: 'Active' }],
    progressLabel = 'Preparing your dashboard',
}) => {
    const t = THEMES[theme] || THEMES.sky;
    const [phraseIdx, setPhraseIdx] = useState(0);
    const [pct, setPct] = useState(8);

    useEffect(() => {
        const phraseId = setInterval(
            () => setPhraseIdx((i) => (i + 1) % phrases.length),
            1400
        );
        // Asymptotic ease toward 95 — never hits 100 until the loader unmounts.
        const pctId = setInterval(
            () => setPct((p) => Math.min(p + Math.max((95 - p) * 0.12, 0.5), 95)),
            220
        );
        return () => { clearInterval(phraseId); clearInterval(pctId); };
    }, [phrases.length]);

    return (
        <div className="max-w-[1440px] mx-auto px-2 pb-10">
            <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden rounded-2xl">

                {/* Soft mesh background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${t.bg}`} />

                {/* Floating gradient blobs — calm, ambient */}
                <div className={`pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full ${t.blob1} blur-3xl animate-pulse`} />
                <div className={`pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full ${t.blob2} blur-3xl animate-pulse`} style={{ animationDelay: '0.8s' }} />

                {/* Card with a static gradient border (no rotating glow) */}
                <div
                    className="relative w-full max-w-sm mx-4 rounded-[26px] p-[1.5px] shadow-2xl"
                    style={{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradMid})` }}
                >
                    {/* Glassmorphism card */}
                    <div className={`relative flex flex-col items-center gap-7 px-9 py-11 rounded-[24px] bg-white/85 backdrop-blur-xl ${t.cardShadow}`}>

                        {/* Orbit icon zone — dots quietly orbiting the app icon */}
                        <div className="relative w-28 h-28 grid place-items-center">
                            {/* Soft halo */}
                            <div className={`absolute inset-4 rounded-full bg-gradient-to-br ${t.halo} blur-xl animate-pulse`} />

                            {/* Dashed orbit track, slowly turning */}
                            <div
                                className="absolute inset-0 rounded-full border border-dashed border-gray-300/50"
                                style={{ animation: 'spin 18s linear infinite' }}
                            />

                            {/* Three dots orbiting at different speeds / phases */}
                            {[
                                { c: t.dot1, dur: '3s',   delay: '0s'  },
                                { c: t.dot2, dur: '4.5s', delay: '-1s' },
                                { c: t.dot3, dur: '6s',   delay: '-2s' },
                            ].map((d, i) => (
                                <div key={i} className="absolute inset-0" style={{ animation: `spin ${d.dur} linear ${d.delay} infinite` }}>
                                    <span className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${d.c} shadow-lg`} />
                                </div>
                            ))}

                            {/* Center icon card with gold ₹ badge */}
                            <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${t.iconBg} grid place-items-center shadow-xl ring-1 ring-white/30`}>
                                <Icon size={28} className="text-white drop-shadow-md" />
                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 grid place-items-center shadow-md shadow-amber-400/50 ring-2 ring-white">
                                    <span className="text-[9px] font-black text-amber-900 leading-none">₹</span>
                                </div>
                            </div>
                        </div>

                        {/* Brand pill + title + rotating phrase */}
                        <div className="text-center">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-full bg-gradient-to-r ${t.pillBg} border`}>
                                <span className="relative flex w-1.5 h-1.5">
                                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500" />
                                </span>
                                <span className={`text-[10.5px] font-semibold tracking-[0.12em] ${t.pillText} uppercase`}>{brandLabel}</span>
                            </div>
                            <h2 className={`text-[23px] font-bold bg-gradient-to-r ${t.titleGrad} bg-clip-text text-transparent tracking-tight leading-tight`}>
                                {title}
                            </h2>
                            <div className="mt-3 h-5 overflow-hidden">
                                <p
                                    key={phraseIdx}
                                    className="text-[13px] text-gray-600 font-medium"
                                    style={{ animation: 'pulse 0.6s ease-out' }}
                                >
                                    {phrases[phraseIdx]}
                                </p>
                            </div>
                        </div>

                        {/* Mini KPI tile teasers */}
                        <div className="grid grid-cols-3 gap-2 w-full">
                            {tiles.slice(0, 3).map((tile, i) => (
                                <div
                                    key={i}
                                    className={`relative h-14 rounded-xl bg-gradient-to-br from-white/80 to-white/40 border ${t.tileBorder} p-2 overflow-hidden`}
                                >
                                    <span className={`text-[8.5px] font-semibold ${t.tileLabel} tracking-wider uppercase`}>{tile.label}</span>
                                    <div className={`mt-1 h-3 w-2/3 rounded bg-gradient-to-r ${t.tileBar} bg-[length:200%_100%] animate-shimmer`} />
                                </div>
                            ))}
                        </div>

                        {/* Premium progress bar */}
                        <div className="w-full">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10.5px] text-gray-500 font-medium">{progressLabel}</span>
                                <span className={`text-[11.5px] font-bold tabular-nums bg-gradient-to-r ${t.pctGrad} bg-clip-text text-transparent`}>
                                    {Math.round(pct)}%
                                </span>
                            </div>
                            <div className={`relative h-1.5 rounded-full ${t.progressBg} overflow-hidden`}>
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${t.progressBar} transition-[width] duration-500 ease-out`}
                                    style={{ width: `${pct}%`, boxShadow: t.progressShadow }}
                                />
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer bg-[length:200%_100%]"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-[10px] text-gray-400 font-semibold tracking-[0.14em] uppercase">Secure · Encrypted</span>
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${t.dot1} animate-bounce`} style={{ animationDelay: '0s' }} />
                                    <span className={`w-1.5 h-1.5 rounded-full ${t.dot2} animate-bounce`} style={{ animationDelay: '0.15s' }} />
                                    <span className={`w-1.5 h-1.5 rounded-full ${t.dot3} animate-bounce`} style={{ animationDelay: '0.3s' }} />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default PremiumPageLoader;
