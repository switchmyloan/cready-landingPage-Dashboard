import { useEffect, useMemo, useState } from 'react';
import { Trophy, PartyPopper, X, TrendingUp, Wallet, Sparkles } from 'lucide-react';

// Full-screen milestone celebration — fires when a dashboard crosses a headline
// number (e.g. ₹10 Cr disbursed in the current month). Deliberately dependency
// free: confetti, the count-up and every flourish are plain divs + injected
// keyframes, so nothing extra ships in the bundle.

const CONFETTI_COLORS = ['#a855f7', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#facc15'];
const FALL_COUNT = 130;
const BURST_COUNT = 48;
const EMOJIS = ['🎉', '💰', '🚀', '✨', '🏆', '⭐', '🥳', '💸', '🔥', '🤑'];
const EMOJI_COUNT = 22;
const ROCKET_COUNT = 6;
const ROCKET_HUES = ['#facc15', '#22d3ee', '#f472b6', '#a855f7', '#34d399', '#fb923c'];

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

// Emoji rain — big celebratory emojis raining down alongside the paper confetti,
// each in its own column with a random delay / speed / spin for extra hype.
const useEmojiRain = (open) => useMemo(() => {
    if (!open) return [];
    return Array.from({ length: EMOJI_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,                       // vw
        delay: Math.random() * 3,                        // s
        duration: 3.4 + Math.random() * 3,               // s
        spin: `${(Math.random() * 2 - 1) * 540}deg`,
        size: 18 + Math.random() * 16,                   // px
        emoji: EMOJIS[i % EMOJIS.length],
    }));
}, [open]);

// Rockets — 🚀 streaking diagonally across the backdrop (bottom-left → top-right)
// on a loop, each with its own lane, speed, size and coloured exhaust trail.
const useRockets = (open) => useMemo(() => {
    if (!open) return [];
    return Array.from({ length: ROCKET_COUNT }, (_, i) => ({
        id: i,
        left: 2 + Math.random() * 62,                    // vw start (lower-left band)
        delay: Math.random() * 6,                        // s (stagger over time)
        duration: 3.6 + Math.random() * 3,               // s
        size: 24 + Math.random() * 20,                   // px
        hue: ROCKET_HUES[i % ROCKET_HUES.length],
    }));
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

// Dark-glass stat tile. `tone` is kept in the signature for call-site
// compatibility but the dark celebration card renders a uniform frosted look.
const StatBox = ({ icon, label, value }) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 mb-1 text-white/60">
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{label}</span>
        </div>
        <p className="text-[19px] leading-none font-extrabold text-white">{value}</p>
    </div>
);

const MilestoneCelebration = ({
    open,
    onClose,
    amount = 0,
    count = 0,
    milestoneLabel = '₹10 Cr',
    periodLabel = '',
    // Optional overrides — defaults reproduce the ₹10 Cr disbursal celebration.
    subtitle = null,                 // replaces the "We've hit X in disbursals" sentence
    primaryLabel = 'Total disbursed',
    unit = 'Cr',                     // big-number unit: 'Cr' | 'L' | 'raw'
    stats = null,                    // [{ icon, label, value, tone }] — replaces the 2 default boxes
    ctaText = "Let's keep going 🚀",
    footNote = 'Shown once a month — next pop-up is the next milestone.',
}) => {
    const fall = useFallConfetti(open);
    const burst = useBurstConfetti(open);
    const emojis = useEmojiRain(open);
    const rockets = useRockets(open);
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
    // Big headline number in the requested unit (Cr for the ₹10 Cr disbursal milestone,
    // L for the ₹90 L profit milestone, raw ₹ otherwise).
    const big = unit === 'L'
        ? { n: (animatedAmount / 1e5).toFixed(2), u: 'L' }
        : unit === 'raw'
            ? { n: Math.round(animatedAmount).toLocaleString('en-IN'), u: '' }
            : { n: crore.toFixed(2), u: 'Cr' };
    const defaultStats = [
        { icon: <Wallet size={13} />, label: 'Disbursals', value: fmtNum(count), tone: 'border-purple-100 bg-purple-50/70 text-purple-600' },
        { icon: <TrendingUp size={13} />, label: 'Avg. ticket', value: count ? fmtINR(Math.round(amount / count)) : '—', tone: 'border-emerald-100 bg-emerald-50/70 text-emerald-600' },
    ];
    const statBoxes = Array.isArray(stats) && stats.length ? stats : defaultStats;

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
                @keyframes ms-emojifall {
                    0%   { transform: translate3d(0, -14vh, 0) rotate(0deg); opacity: 0; }
                    10%  { opacity: 1; }
                    100% { transform: translate3d(0, 112vh, 0) rotate(var(--spin)); opacity: 0.9; }
                }
                /* Animated sweeping gradient for the big headline number. */
                @keyframes ms-gradient { to { background-position: 200% center; } }
                /* One-shot "tada" wobble for the Congratulations! headline. */
                @keyframes ms-tada {
                    0%          { transform: scale(1) rotate(0); }
                    10%, 20%    { transform: scale(0.9) rotate(-3deg); }
                    30%,50%,70% { transform: scale(1.12) rotate(3deg); }
                    40%,60%,80% { transform: scale(1.12) rotate(-3deg); }
                    90%         { transform: scale(1.06) rotate(2deg); }
                    100%        { transform: scale(1) rotate(0); }
                }
                /* Breathing glow behind the trophy / number. */
                @keyframes ms-glowpulse {
                    0%,100% { opacity: 0.45; transform: scale(1); }
                    50%     { opacity: 0.9;  transform: scale(1.12); }
                }
                @keyframes ms-flash {
                    0%   { opacity: 0.55; }
                    100% { opacity: 0; }
                }
                /* Rotating conic gradient — the glowing card border. */
                @keyframes ms-spin { to { transform: rotate(360deg); } }
                /* Disco spotlight — swings like a searchlight. */
                @keyframes ms-swing {
                    from { transform: rotate(-40deg); }
                    to   { transform: rotate(40deg); }
                }
                /* Colour-cycling disco floor wash. */
                @keyframes ms-discohue {
                    to { filter: hue-rotate(360deg); }
                }
                /* Expanding firework ring. */
                @keyframes ms-firework {
                    0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0.95; }
                    100% { transform: translate(-50%, -50%) scale(2.9); opacity: 0; }
                }
                /* Rocket streaking bottom-left → top-right across the backdrop. */
                @keyframes ms-rocket {
                    0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
                    8%   { opacity: 1; }
                    88%  { opacity: 1; }
                    100% { transform: translate(96vw, -112vh) scale(1.15); opacity: 0; }
                }
            `}</style>

            {/* Rockets — 🚀 streaking diagonally across the backdrop with a glowing trail. */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                {rockets.map((r) => (
                    <div
                        key={`r${r.id}`}
                        style={{
                            position: 'absolute',
                            left: `${r.left}vw`,
                            bottom: '-10vh',
                            animation: `ms-rocket ${r.duration}s cubic-bezier(0.4, 0, 0.7, 1) ${r.delay}s infinite`,
                        }}
                    >
                        {/* Exhaust trail — streaks down-left from the rocket's tail. */}
                        <span
                            style={{
                                position: 'absolute',
                                right: '35%',
                                top: '55%',
                                width: `${r.size * 3.4}px`,
                                height: '3px',
                                borderRadius: '9999px',
                                transformOrigin: 'right center',
                                transform: 'rotate(-45deg)',
                                background: `linear-gradient(to left, ${r.hue}, transparent)`,
                                filter: 'blur(2px)',
                                opacity: 0.85,
                            }}
                        />
                        <span style={{ fontSize: `${r.size}px`, lineHeight: 1, filter: `drop-shadow(0 0 9px ${r.hue})` }}>🚀</span>
                    </div>
                ))}
            </div>

            {/* Opening white flash — a quick "pop" the instant the modal appears. */}
            <div className="pointer-events-none fixed inset-0 bg-white z-[210]" style={{ animation: 'ms-flash 0.5s ease-out both' }} />

            {/* Emoji rain — big celebratory emojis falling behind the card. */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                {emojis.map((e) => (
                    <span
                        key={`e${e.id}`}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: `${e.left}vw`,
                            fontSize: `${e.size}px`,
                            lineHeight: 1,
                            '--spin': e.spin,
                            animation: `ms-emojifall ${e.duration}s linear ${e.delay}s infinite`,
                        }}
                    >
                        {e.emoji}
                    </span>
                ))}
            </div>

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

            {/* Card — dark premium with a static gradient border. */}
            <div
                className="relative w-full max-w-[430px] rounded-[26px] p-[2px] bg-gradient-to-br from-purple-500 via-fuchsia-500 to-amber-400 shadow-[0_30px_90px_-15px_rgba(0,0,0,0.8)]"
                style={{ animation: 'ms-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative rounded-[24px] overflow-hidden bg-gradient-to-b from-slate-900 via-[#1a1030] to-slate-950">
                    {/* Disco spotlight beams — sweep from the top like a stage. */}
                    {[
                        { color: '168,85,247', dur: '3.2s', delay: '0s' },
                        { color: '34,211,238', dur: '4s', delay: '0.5s' },
                        { color: '251,191,36', dur: '3.6s', delay: '0.9s' },
                        { color: '236,72,153', dur: '4.4s', delay: '0.3s' },
                    ].map((b, i) => (
                        <div
                            key={i}
                            className="pointer-events-none absolute top-0 left-1/2 z-0"
                            style={{
                                width: '72px',
                                height: '500px',
                                marginLeft: '-36px',
                                background: `linear-gradient(to bottom, rgba(${b.color},0.55), rgba(${b.color},0.06) 55%, transparent)`,
                                filter: 'blur(9px)',
                                transformOrigin: 'top center',
                                mixBlendMode: 'screen',
                                animation: `ms-swing ${b.dur} ease-in-out ${b.delay} infinite alternate`,
                            }}
                        />
                    ))}
                    {/* Colour-cycling disco floor wash. */}
                    <div
                        className="pointer-events-none absolute -bottom-16 left-1/2 -translate-x-1/2 w-[120%] h-40 z-0 rounded-full blur-3xl"
                        style={{
                            background: 'linear-gradient(90deg, #a855f7, #22d3ee, #facc15, #ec4899)',
                            opacity: 0.35,
                            mixBlendMode: 'screen',
                            animation: 'ms-discohue 6s linear infinite',
                        }}
                    />

                    {/* Ambient glow blobs */}
                    <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-purple-600/25 blur-3xl"
                        style={{ animation: 'ms-glowpulse 3.2s ease-in-out infinite' }} />
                    <div className="pointer-events-none absolute -bottom-24 -right-12 w-56 h-56 rounded-full bg-cyan-500/15 blur-3xl"
                        style={{ animation: 'ms-aurora 9s ease-in-out infinite' }} />
                    <div className="pointer-events-none absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-fuchsia-500/15 blur-3xl"
                        style={{ animation: 'ms-aurora 11s ease-in-out infinite reverse' }} />

                    {/* Repeating firework rings. */}
                    {[
                        { top: '16%', left: '22%', color: '#facc15', delay: '0s' },
                        { top: '24%', left: '80%', color: '#22d3ee', delay: '0.6s' },
                        { top: '58%', left: '16%', color: '#ec4899', delay: '1.2s' },
                        { top: '66%', left: '84%', color: '#a855f7', delay: '1.8s' },
                        { top: '40%', left: '92%', color: '#34d399', delay: '2.4s' },
                    ].map((f, i) => (
                        <span
                            key={i}
                            className="pointer-events-none absolute w-9 h-9 rounded-full z-10"
                            style={{
                                top: f.top,
                                left: f.left,
                                border: `2px solid ${f.color}`,
                                boxShadow: `0 0 14px ${f.color}, inset 0 0 8px ${f.color}`,
                                animation: `ms-firework 2s ease-out ${f.delay} infinite`,
                            }}
                        />
                    ))}

                    {/* Slow conic rays behind the trophy. */}
                    <div
                        className="pointer-events-none absolute left-1/2 top-[92px] w-[340px] h-[340px] -translate-x-1/2 -translate-y-1/2 opacity-[0.14] z-10"
                        style={{
                            background: 'repeating-conic-gradient(#fff 0deg 8deg, transparent 8deg 24deg)',
                            maskImage: 'radial-gradient(circle, #000 10%, transparent 60%)',
                            WebkitMaskImage: 'radial-gradient(circle, #000 10%, transparent 60%)',
                            animation: 'ms-rays 26s linear infinite',
                        }}
                    />

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
                        className="absolute top-3 right-3 z-30 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
                        aria-label="Dismiss"
                    >
                        <X size={18} />
                    </button>

                    {/* ── Content ────────────────────────────────────────────── */}
                    <div className="relative z-20 px-7 pt-9 pb-7 text-center">
                        {/* Trophy + glowing halo rings */}
                        <div className="relative mx-auto w-[82px] h-[82px] mb-4" style={{ animation: 'ms-float 3.2s ease-in-out infinite' }}>
                            <span className="absolute inset-0 rounded-full bg-amber-300/40" style={{ animation: 'ms-halo 2.4s ease-out infinite' }} />
                            <span className="absolute inset-0 rounded-full bg-amber-300/30" style={{ animation: 'ms-halo 2.4s ease-out 1.2s infinite' }} />
                            <div className="relative w-full h-full rounded-full grid place-items-center bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 shadow-[0_0_36px_-2px_rgba(251,191,36,0.9)] ring-[5px] ring-amber-400/20">
                                <Trophy size={36} className="text-amber-900 drop-shadow" />
                            </div>
                        </div>

                        <span className="relative inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/8 border border-white/15 backdrop-blur-sm text-amber-200/90 text-[10.5px] font-bold uppercase tracking-[0.22em]">
                            <Sparkles size={11} className="text-amber-300" />
                            Milestone unlocked
                        </span>

                        <h2
                            className="relative text-[30px] leading-tight font-black mt-3 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent"
                            style={{ animation: 'ms-tada 1.6s ease-in-out 0.45s 2 both', filter: 'drop-shadow(0 2px 12px rgba(251,191,36,0.35))' }}
                        >
                            <PartyPopper size={26} className="text-amber-300" style={{ WebkitTextFillColor: 'initial' }} />
                            Congratulations!
                        </h2>

                        <p className="relative text-white/70 text-[13.5px] mt-2.5 max-w-[320px] mx-auto">
                            {subtitle || (<>
                                We&apos;ve hit <span className="font-bold text-amber-300">{milestoneLabel}</span> in disbursals
                                {periodLabel ? <> this <span className="font-bold text-white">{periodLabel}</span></> : ' this month'}.
                            </>)}
                        </p>

                        {/* Big glowing number */}
                        <div className="mt-6 mb-5">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/40">{primaryLabel}</p>
                            <p
                                className="mt-1.5 text-[52px] leading-none font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent tabular-nums"
                                style={{ backgroundSize: '200% auto', animation: 'ms-gradient 2.5s linear infinite', filter: 'drop-shadow(0 3px 20px rgba(251,191,36,0.4))' }}
                            >
                                ₹{big.n}
                                {big.u && <span className="text-[26px] font-extrabold text-white/50 ml-1.5">{big.u}</span>}
                            </p>
                            <p className="text-[12px] text-white/45 mt-2 tabular-nums">{fmtINR(Math.round(animatedAmount))}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {statBoxes.map((s, i) => (
                                <StatBox key={i} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
                            ))}
                        </div>

                        <button
                            onClick={onClose}
                            className="group relative mt-5 w-full py-3 rounded-xl overflow-hidden bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 text-[14px] font-black shadow-[0_10px_30px_-6px_rgba(251,191,36,0.6)] hover:shadow-[0_14px_38px_-6px_rgba(251,191,36,0.75)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
                        >
                            <span className="relative z-10">{ctaText}</span>
                            <span className="absolute inset-y-0 -left-full w-1/2 bg-white/40 skew-x-[-18deg] group-hover:left-[130%] transition-all duration-700" />
                        </button>

                        <p className="text-center text-[10.5px] text-white/35 mt-3">
                            {footNote}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MilestoneCelebration;
