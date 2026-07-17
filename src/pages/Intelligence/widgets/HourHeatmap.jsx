import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getSlotPerformance } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Segmented, Note, RampLegend } from "../components/Shell";
import { RAMP, METRIC_OPTIONS, DOW_LABELS } from "../lib/constants";
import { binIndex, clsx, fmtNum, fmtPct, fmtValue } from "../lib/format";

// Hour heatmap — 7 days × 24 IST hours = 168 cells.
//
// Below-floor cells are hatched and EXCLUDED FROM THE RAMP SCALE, not merely
// unranked. One n=3 cell at 100% would otherwise stretch the quantile boundaries
// and wash out the other 165 cells.

const CELL = 26;

const Tooltip = ({ c, metricLabel, metricKind }) => (
    <div className="pointer-events-none absolute z-30 w-56 rounded-lg border border-[#d6d4cb] bg-white px-3 py-2 text-[11px] shadow-lg">
        <p className="font-semibold text-gray-900">{c.label}</p>
        {c.belowFloor ? (
            <p className="mt-1 text-[10px] text-amber-600">
                Low volume (n={fmtNum(c.landed)}) — not ranked, and excluded from the colour scale.
            </p>
        ) : (
            <>
                <div className="mt-1.5 space-y-0.5 text-gray-600">
                    <div className="flex justify-between gap-3">
                        <span className="font-medium text-gray-700">{metricLabel}</span>
                        <span className="font-semibold tabular-nums text-gray-900">{fmtValue(c.value, metricKind)}</span>
                    </div>
                    {c.wilsonLb != null && (
                        <div className="flex justify-between gap-3">
                            <span>95% lower bound</span>
                            <span className="tabular-nums">{fmtPct(c.wilsonLb)}</span>
                        </div>
                    )}
                    <div className="flex justify-between gap-3">
                        <span>vs grand mean</span>
                        <span
                            className={clsx("tabular-nums", (c.vsGrandMean || 0) >= 0 ? "text-violet-600" : "text-red-600")}
                        >
                            {c.vsGrandMean == null ? "—" : `${c.vsGrandMean >= 0 ? "+" : ""}${(c.vsGrandMean * 100).toFixed(0)}%`}
                        </span>
                    </div>
                </div>
                <div className="mt-1.5 border-t border-gray-100 pt-1.5 space-y-0.5 text-gray-500">
                    <div className="flex justify-between gap-3">
                        <span>Landed</span><span className="tabular-nums">{fmtNum(c.landed)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                        <span>Disbursed</span><span className="tabular-nums">{fmtNum(c.disbursed)}</span>
                    </div>
                </div>
            </>
        )}
    </div>
);

const HourHeatmap = ({ filters, theme = "high", blocked = [] }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metric, setMetric] = useState("conversion");
    const [hover, setHover] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getSlotPerformance({ ...filters, metric, signal: controller.signal })
            .then((res) => {
                if (!controller.signal.aborted) setData(res?.data?.data || null);
            })
            .catch((e) => {
                if (!controller.signal.aborted) setError(e?.message || "Failed to load");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [filters, metric]);

    const ramp = RAMP[theme] || RAMP.high;
    const cells = data?.cells || [];
    const at = (dow, hod) => cells.find((c) => c.dow === dow && c.hod === hod);

    const metricOptions = METRIC_OPTIONS
        .filter((m) => !m.gated || !blocked.includes(m.gated))
        .map((m) => ({ key: m.key, label: m.label }));

    const subtitle = data
        ? `${data.metricLabel} · ${data.window?.label || ""} · IST · n≥${data.floor} · ${data.eligibleCells}/${data.totalCells} cells eligible`
        : "";

    // Row/column marginals — cheap context that makes the grid readable.
    const rowTotal = (dow) => cells.filter((c) => c.dow === dow).reduce((a, c) => a + c.landed, 0);
    const colTotal = (hod) => cells.filter((c) => c.hod === hod).reduce((a, c) => a + c.landed, 0);

    return (
        <Card
            title="Day × Hour Performance"
            subtitle={subtitle}
            loading={loading}
            error={error}
            empty={!loading && !error && !cells.length}
            emptyMessage="No slots met the minimum volume. Widen the date range."
            actions={<RefreshButton loading={loading} />}
        >
            <div className="mb-3">
                <Segmented options={metricOptions} value={metric} onChange={setMetric} />
            </div>

            <div className="relative overflow-x-auto pb-1">
                <div style={{ minWidth: 24 * (CELL + 2) + 80 }}>
                    {/* Hour axis, every 2h */}
                    <div className="mb-1 flex gap-[2px] pl-9">
                        {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} style={{ width: CELL }} className="text-center text-[9px] text-gray-400">
                                {h % 2 === 0 ? String(h).padStart(2, "0") : ""}
                            </div>
                        ))}
                        <div className="w-10 text-right text-[9px] text-gray-400">Σ</div>
                    </div>

                    {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                        <div
                            key={dow}
                            className={clsx("mb-[2px] flex items-center gap-[2px]", dow >= 6 && "bg-gray-50/60")}
                        >
                            <div className="w-9 shrink-0 text-[10px] font-medium text-gray-500">{DOW_LABELS[dow]}</div>
                            {Array.from({ length: 24 }, (_, hod) => {
                                const c = at(dow, hod);
                                if (!c) return <div key={hod} style={{ width: CELL, height: CELL }} />;

                                const step = binIndex(c.value, data?.bins || []);
                                const isPeak = data?.peak && data.peak.dow === dow && data.peak.hod === hod;

                                return (
                                    <div
                                        key={hod}
                                        onMouseEnter={() => setHover({ c, hod })}
                                        onMouseLeave={() => setHover(null)}
                                        style={{
                                            width: CELL,
                                            height: CELL,
                                            background: c.belowFloor ? undefined : ramp[step],
                                        }}
                                        className={clsx(
                                            "relative rounded-[2px] transition",
                                            c.belowFloor
                                                // Hatched: unknown, not bad. Not clickable.
                                                ? "cursor-default bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_2px,#e5e7eb_2px,#e5e7eb_4px)]"
                                                : "cursor-pointer",
                                            isPeak && "ring-2 ring-amber-400",
                                            hover?.c === c && !c.belowFloor && "ring-2 ring-gray-500"
                                        )}
                                    >
                                        {isPeak && (
                                            <Star className="absolute -right-1 -top-1 h-2.5 w-2.5 fill-amber-400 text-amber-500" />
                                        )}
                                    </div>
                                );
                            })}
                            <div className="w-10 shrink-0 text-right text-[9px] tabular-nums text-gray-400">
                                {fmtNum(rowTotal(dow))}
                            </div>
                        </div>
                    ))}

                    {/* Column marginals */}
                    <div className="mt-1 flex gap-[2px] pl-9">
                        {Array.from({ length: 24 }, (_, h) => (
                            <div
                                key={h}
                                style={{ width: CELL }}
                                className="text-center text-[8px] tabular-nums text-gray-400"
                            >
                                {h % 3 === 0 ? Math.round(colTotal(h) / 1000) + "k" : ""}
                            </div>
                        ))}
                    </div>
                </div>

                {hover && (
                    <div
                        className="absolute z-30"
                        style={{ left: Math.min(hover.hod * (CELL + 2) + 40, 420), top: 0 }}
                    >
                        <Tooltip
                            c={hover.c}
                            metricLabel={data?.metricLabel}
                            metricKind={data?.metricKind}
                        />
                    </div>
                )}
            </div>

            <div className="mt-3">
                <RampLegend
                    ramp={ramp}
                    extra={[
                        {
                            label: `Below floor (n<${data?.floor ?? 30})`,
                            className: "border-gray-200",
                            style: {
                                background:
                                    "repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_2px,#e5e7eb_2px,#e5e7eb_4px)",
                            },
                        },
                        { label: "Peak", className: "border-amber-400 ring-1 ring-amber-400", style: {} },
                    ]}
                />
            </div>

            <Note>
                Cells below {data?.floor ?? 30} landed sessions are hatched: they are <strong>unknown, not bad</strong>,
                and are excluded from both the ranking and the colour scale. Peak is ranked on the 95% lower bound — if no
                cell beats the grand mean with confidence, none is marked.
            </Note>
        </Card>
    );
};

export default HourHeatmap;
