import React from "react";
import { RefreshCw, AlertTriangle, Info, Lock } from "lucide-react";
import PremiumLoader from "../../../components/PremiumLoader";
import { clsx } from "../lib/format";

// Shared widget furniture for the Intelligence module.
//
// All defined at MODULE SCOPE, never inline inside a page component — inlining
// remounts them on every refetch, which snaps accordions shut and drops focus.
// (Same reason AllLenders.jsx defines DistributionBanner at module scope.)

/**
 * The standard widget card: title, subtitle, actions, and the four states every
 * widget must handle (loading / error / empty / content).
 *
 * `subtitle` carries the metric, window, and volume floor. Showing the floor is
 * what makes a ranking feel rigorous rather than arbitrary — and it IS rigorous,
 * so it should look it.
 */
export const Card = ({
    title,
    subtitle,
    actions,
    loading,
    error,
    empty,
    emptyMessage = "No data available",
    height,
    children,
    className,
}) => (
    <div className={clsx("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-gray-800 truncate">{title}</h3>
                {subtitle && (
                    <p className="mt-0.5 text-[11px] text-gray-500 truncate" title={subtitle}>
                        {subtitle}
                    </p>
                )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>

        <div className="p-4">
            {loading ? (
                <div style={height ? { height } : undefined} className={height ? "" : "h-44"}>
                    <PremiumLoader fullHeight size="md" />
                </div>
            ) : error ? (
                <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <p className="text-xs text-gray-500">{error}</p>
                </div>
            ) : empty ? (
                <div className="flex h-44 items-center justify-center text-center text-xs text-gray-400">
                    {emptyMessage}
                </div>
            ) : (
                children
            )}
        </div>
    </div>
);

/** Small icon button. Matches the existing filter-strip button sizing. */
export const IconButton = ({ onClick, title, spinning, children }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 transition hover:border-purple-400 hover:bg-purple-50"
    >
        <span className={spinning ? "animate-spin" : ""}>{children}</span>
    </button>
);

export const RefreshButton = ({ onClick, loading }) => (
    <IconButton onClick={onClick} title="Refresh" spinning={loading}>
        <RefreshCw className="h-3.5 w-3.5" />
    </IconButton>
);

/**
 * Segmented control. Used for module switching, metric selection, and grain.
 * Active styling matches the existing filter buttons exactly
 * (bg-purple-600 text-white) so the module doesn't look like a different product.
 */
export const Segmented = ({ options, value, onChange, size = "sm" }) => (
    <div className="inline-flex flex-wrap items-center gap-1">
        {options.map((o) => {
            const active = o.key === value;
            return (
                <button
                    key={o.key}
                    type="button"
                    disabled={o.disabled}
                    title={o.title}
                    onClick={() => onChange(o.key)}
                    className={clsx(
                        "rounded-md border font-semibold transition",
                        size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-[12px]",
                        o.disabled
                            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300"
                            : active
                                ? "border-purple-600 bg-purple-600 text-white"
                                : "border-gray-300 bg-white text-gray-700 hover:border-purple-400 hover:bg-purple-50"
                    )}
                >
                    {o.label}
                </button>
            );
        })}
    </div>
);

/**
 * Data-quality banner.
 *
 * A widget whose gate fails renders THIS instead of a confident number. A
 * dashboard that shows a plausible-looking wrong number is worse than one that
 * says "data quality insufficient" — the first one gets acted on.
 */
export const DqBanner = ({ gate }) => {
    if (!gate) return null;
    const critical = gate.severity === "critical";
    return (
        <div
            className={clsx(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
                critical ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            )}
        >
            <AlertTriangle className={clsx("mt-0.5 h-4 w-4 shrink-0", critical ? "text-red-500" : "text-amber-500")} />
            <div className="min-w-0 text-[11px] leading-relaxed">
                <p className={clsx("font-semibold", critical ? "text-red-800" : "text-amber-800")}>{gate.title}</p>
                <p className={clsx("mt-0.5", critical ? "text-red-700" : "text-amber-700")}>{gate.detail}</p>
                {gate.impact && (
                    <p className={clsx("mt-1", critical ? "text-red-600" : "text-amber-600")}>
                        <span className="font-medium">Impact:</span> {gate.impact}
                    </p>
                )}
                {gate.owner && (
                    <p className={clsx("mt-0.5", critical ? "text-red-600" : "text-amber-600")}>
                        <span className="font-medium">Owner:</span> {gate.owner}
                    </p>
                )}
            </div>
        </div>
    );
};

/** A metric that exists in the spec but has no data. Never renders 0 or "—". */
export const NotInstrumented = ({ label, reason }) => (
    <span
        className="inline-flex items-center gap-1 text-[11px] italic text-gray-400"
        title={reason}
    >
        <Lock className="h-3 w-3" />
        {label || "Not instrumented"}
    </span>
);

/** Amber chip for a metric standing in for one we can't compute. */
export const ProxyChip = ({ title }) => (
    <span
        title={title || "Proxy metric — disbursed amount is loan principal, not our revenue"}
        className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700"
    >
        Proxy
    </span>
);

/** Sample-size display. Every rate shows its denominator — non-negotiable. */
export const NValue = ({ n, className }) => (
    <span className={clsx("text-[10px] tabular-nums text-gray-400", className)}>n={Number(n || 0).toLocaleString("en-IN")}</span>
);

export const Skeleton = ({ className }) => (
    <div
        className={clsx(
            "rounded-md bg-gradient-to-r from-indigo-100 via-purple-200 to-indigo-100 bg-[length:200%_100%] animate-shimmer",
            className
        )}
    />
);

/** Explanatory note. Used for the caveats that keep a chart from being misread. */
export const Note = ({ children }) => (
    <div className="mt-3 flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-[10.5px] leading-relaxed text-gray-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
        <span>{children}</span>
    </div>
);

/** Legend swatch row for the heatmaps. */
export const RampLegend = ({ ramp, labels, extra = [] }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
            <span>Low</span>
            {ramp.map((c) => (
                <span key={c} className="h-3 w-4 rounded-sm" style={{ background: c }} />
            ))}
            <span>High</span>
        </div>
        {labels}
        {/* Censored / provisional / below-floor each need their own swatch —
            users cannot infer three special states from a gradient. */}
        {extra.map((e) => (
            <div key={e.label} className="flex items-center gap-1">
                <span className={clsx("h-3 w-4 rounded-sm border", e.className)} style={e.style} />
                <span>{e.label}</span>
            </div>
        ))}
    </div>
);
