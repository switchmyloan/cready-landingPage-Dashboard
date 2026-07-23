import { useEffect, useMemo, useState } from 'react';
import { Trophy, PartyPopper, X, TrendingUp, Wallet, Sparkles } from 'lucide-react';

// Full-screen milestone celebration — fires when a dashboard crosses a headline
// number (e.g. ₹10 Cr disbursed in the current month). Deliberately dependency
// free: confetti, the count-up and every flourish are plain divs + injected
// keyframes, so nothing extra ships in the bundle.

const CONFETTI_COLORS = ['#a855f7', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6'];
const FALL_COUNT = 70;
const BURST_COUNT = 28;

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

// Falling confetti — each piece gets its own column, delay, fall duration, drift
// and spin so the field never looks tiled.
const useFallConfetti = (open) => useMemo(() => {
    if (!open) return [];
    return Array.from({ length: FALL_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,                       // vw
        delay: Math.random() * 2.2,                      // s
        duration: 2.6 + Math.random() * 2.4,             // s
        drift: `${(Math.random() * 2 - 1) * 120}px`,
        spin: `${(Math.random() * 2 - 1) * 720}deg`,
        size: 6 + Math.random() * 7,                     // px
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.6,
    }));
}, [open]);

// One-shot burst radiating from the card centre the moment the modal opens —
// gives the entrance a "pop" the steady fall alone can't.
const useBurstConfetti = (open) => useMemo(() => {
    if (!open) return [];
    return Array.from({ length: BURST_COUNT }, (_, i) => {
        const angle = (i / BURST_COUNT) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 140 + Math.random() * 190;
        return {
            id: i,
            tx: `${Math.cos(angle) * dist}px`,
            ty: `${Math.sin(angle) * dist}px`,
            spin: `${(Math.random() * 2 - 1) * 540}deg`,
            size: 6 + Math.random() * 6,
            delay: Math.random() * 0.15,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            round: Math.random() > 0.5,
        };
    });
}, [open]);

// Ease-out count-up so the headline number "lands" instead of just appearing.
const useCountUp = (target, open, duration = 1500) => {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!open) { setValue(0); return undefined; }
        let raf;
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            setValue(target * (1 - Math.pow(1 - p, 3)));   // easeOutCubic
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, open, duration]);
    return value;
};

const StatBox = ({ icon, label, value, tone }) => (
    <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
        <div className="flex items-center gap-1.5 mb-1 opacity-80">
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{label}</span>
        </div>
        <p className="text-[19px] leading-none font-extrabold text-gray-900">{value}</p>
    </div>
);

const MilestoneCelebration = ({
    open,
    onClose,
    amount = 0,
    count = 0,
    milestoneLabel = '₹10 Cr',
    periodLabel = '',
}) => {
    const fall = useFallConfetti(open);
    const burst = useBurstConfetti(open);
    const animatedAmount = useCountUp(Number(amount) || 0, open);

    // Esc to dismiss.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const crore = animatedAmount / 1e7;

    return (
        <div
            className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/70 backdrop-blur-[3px] px-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Milestone reached"
        >
            <style>{`
                @keyframes ms-fall {
                    0%   { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 0; }
                    8%   { opacity: 1; }
                    100% { transform: translate3d(var(--drift), 105vh, 0) rotate(var(--spin)); opacity: 0; }
                }
                @keyframes ms-burst {
                    0%   { transform: translate3d(0,0,0) rotate(0deg) scale(0.4); opacity: 1; }
                    100% { transform: translate3d(var(--tx), var(--ty), 0) rotate(var(--spin)) scale(1); opacity: 0; }
                }
                @keyframes ms-pop {
                    0%   { transform: scale(0.82) translateY(22px); opacity: 0; }
                    55%  { transform: scale(1.025) translateY(0);   opacity: 1; }
                    100% { transform: scale(1) translateY(0);       opacity: 1; }
                }
                @keyframes ms-halo {
                    0%   { transform: scale(0.85); opacity: 0.65; }
                    100% { transform: scale(1.9);  opacity: 0; }
                }
                @keyframes ms-aurora {
                    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
                    50%      { transform: translate3d(18px, -12px, 0) scale(1.18); }
                }
                @keyframes ms-shine {
                    0%   { transform: translateX(-130%) skewX(-18deg); }
                    55%  { transform: translateX(230%)  skewX(-18deg); }
                    100% { transform: translateX(230%)  skewX(-18deg); }
                }
                @keyframes ms-rays { to { transform: rotate(360deg); } }
                @keyframes ms-float {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-5px); }
                }
            `}</style>

            {/* Falling confetti — pointer-events-none so it never blocks the card. */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                {fall.map((c) => (
                    <span
                        key={c.id}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: `${c.left}vw`,
                            width: `${c.size}px`,
                            height: `${c.size * (c.round ? 1 : 1.8)}px`,
                            background: c.color,
                            borderRadius: c.round ? '50%' : '2px',
                            '--drift': c.drift,
                            '--spin': c.spin,
                            animation: `ms-fall ${c.duration}s linear ${c.delay}s infinite`,
                        }}
                    />
                ))}
            </div>

            {/* Card */}
            <div
                className="relative w-full max-w-[420px] rounded-[22px] bg-white overflow-hidden ring-1 ring-white/60 shadow-[0_28px_80px_-12px_rgba(88,28,135,0.55)]"
                style={{ animation: 'ms-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* One-shot burst, anchored to the card centre. */}
                <div className="pointer-events-none absolute inset-0 grid place-items-center z-20">
                    {burst.map((b) => (
                        <span
                            key={b.id}
                            style={{
                                position: 'absolute',
                                width: `${b.size}px`,
                                height: `${b.size * (b.round ? 1 : 1.7)}px`,
                                background: b.color,
                                borderRadius: b.round ? '50%' : '2px',
                                '--tx': b.tx,
                                '--ty': b.ty,
                                '--spin': b.spin,
                                animation: `ms-burst 0.95s cubic-bezier(0.16, 0.9, 0.3, 1) ${b.delay}s both`,
                            }}
                        />
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-30 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition"
                    aria-label="Dismiss"
                >
                    <X size={18} />
                </button>

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="relative px-6 pt-9 pb-8 text-center overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600">
                    {/* Aurora blobs */}
                    <div className="pointer-events-none absolute -top-16 -left-10 w-52 h-52 rounded-full bg-fuchsia-400/40 blur-3xl"
                        style={{ animation: 'ms-aurora 7s ease-in-out infinite' }} />
                    <div className="pointer-events-none absolute -bottom-20 -right-8 w-56 h-56 rounded-full bg-indigo-300/35 blur-3xl"
                        style={{ animation: 'ms-aurora 9s ease-in-out infinite reverse' }} />
                    {/* Slow conic rays behind the trophy */}
                    <div
                        className="pointer-events-none absolute left-1/2 top-[52px] w-[320px] h-[320px] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"
                        style={{
                            background: 'repeating-conic-gradient(#fff 0deg 9deg, transparent 9deg 26deg)',
                            maskImage: 'radial-gradient(circle, #000 12%, transparent 62%)',
                            WebkitMaskImage: 'radial-gradient(circle, #000 12%, transparent 62%)',
                            animation: 'ms-rays 26s linear infinite',
                        }}
                    />
                    {/* Shine sweep */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                            style={{ animation: 'ms-shine 3.6s ease-in-out 0.5s infinite' }} />
                    </div>

                    {/* Trophy + halo rings */}
                    <div className="relative mx-auto w-[74px] h-[74px] mb-4" style={{ animation: 'ms-float 3.2s ease-in-out infinite' }}>
                        <span className="absolute inset-0 rounded-full bg-amber-200/70" style={{ animation: 'ms-halo 2.4s ease-out infinite' }} />
                        <span className="absolute inset-0 rounded-full bg-amber-200/50" style={{ animation: 'ms-halo 2.4s ease-out 1.2s infinite' }} />
                        <div className="relative w-full h-full rounded-full grid place-items-center bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 shadow-[0_10px_28px_-6px_rgba(251,191,36,0.85)] ring-4 ring-white/25">
                            <Trophy size={33} className="text-amber-900 drop-shadow" />
                        </div>
                    </div>

                    <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 border border-white/25 backdrop-blur-sm text-white/90 text-[10.5px] font-bold uppercase tracking-[0.2em]">
                        <Sparkles size={11} className="text-amber-300" />
                        Milestone unlocked
                    </span>

                    <h2 className="relative text-white text-[27px] leading-tight font-black mt-3 inline-flex items-center justify-center gap-2 drop-shadow-sm">
                        <PartyPopper size={23} className="text-amber-300" />
                        Congratulations!
                    </h2>

                    <p className="relative text-white/90 text-[13.5px] mt-2 max-w-[300px] mx-auto">
                        We&apos;ve hit <span className="font-bold text-amber-300">{milestoneLabel}</span> in disbursals
                        {periodLabel ? <> this <span className="font-bold">{periodLabel}</span></> : ' this month'}.
                    </p>
                </div>

                {/* ── Numbers ────────────────────────────────────────────── */}
                <div className="relative px-6 py-6 bg-gradient-to-b from-purple-50/50 to-white">
                    <div className="text-center mb-5">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-gray-400">Total disbursed</p>
                        <p className="mt-1.5 text-[40px] leading-none font-black bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent tabular-nums">
                            ₹{crore.toFixed(2)}
                            <span className="text-[20px] font-extrabold text-gray-400 ml-1.5">Cr</span>
                        </p>
                        <p className="text-[12px] text-gray-500 mt-2 tabular-nums">{fmtINR(Math.round(animatedAmount))}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <StatBox
                            icon={<Wallet size={13} />}
                            label="Disbursals"
                            value={fmtNum(count)}
                            tone="border-purple-100 bg-purple-50/70 text-purple-600"
                        />
                        <StatBox
                            icon={<TrendingUp size={13} />}
                            label="Avg. ticket"
                            value={count ? fmtINR(Math.round(amount / count)) : '—'}
                            tone="border-emerald-100 bg-emerald-50/70 text-emerald-600"
                        />
                    </div>

                    <button
                        onClick={onClose}
                        className="group relative mt-5 w-full py-3 rounded-xl overflow-hidden bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white text-[14px] font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                        <span className="relative z-10">Let&apos;s keep going 🚀</span>
                        <span className="absolute inset-y-0 -left-full w-1/2 bg-white/25 skew-x-[-18deg] group-hover:left-[130%] transition-all duration-700" />
                    </button>

                    <p className="text-center text-[10.5px] text-gray-400 mt-3">
                        Shown once a month — next pop-up is the next milestone.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MilestoneCelebration;
