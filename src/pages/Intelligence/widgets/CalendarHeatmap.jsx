import React, { useEffect, useMemo, useState } from "react";
import { getDailyPerformance } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Segmented, Note, RampLegend } from "../components/Shell";
import { RAMP, METRIC_OPTIONS } from "../lib/constants";
import { binIndex, clsx, fmtDate, fmtNum, fmtPct, fmtValue, fmtDelta } from "../lib/format";

// Calendar heatmap — GitHub-contribution style.
//
// Hand-rolled SVG/divs rather than Recharts: Recharts has no calendar primitive,
// and a grid of positioned cells is both simpler and lighter than forcing one.

const CELL = 13;
const GAP = 3;

/**
 * Bucket days into ISO weeks (columns) × weekday (rows).
 * Monday-start, matching the ISO grain used server-side.
 */
const toWeeks = (series) => {
    if (!series.length) return [];
    const weeks = [];
    let current = new Array(7).fill(null);

    series.forEach((d) => {
        const row = d.dow - 1; // ISODOW 1=Mon → row 0
        current[row] = d;
        if (row === 6) {
            weeks.push(current);
            current = new Array(7).fill(null);
        }
    });
    if (current.some(Boolean)) weeks.push(current);
    return weeks;
};

const Tooltip = ({ d, metricLabel, metricKind }) => (
    <div className="pointer-events-none absolute z-30 w-60 rounded-lg border border-[#d6d4cb] bg-white px-3 py-2 text-[11px] shadow-lg">
        <p className="font-semibold text-gray-900">{fmtDate(d.date)}</p>
        {d.provisional && (
            <p className="mt-0.5 text-[10px] font-medium text-amber-600">
                Provisional — disbursals still landing
            </p>
        )}
        <div className="mt-1.5 space-y-0.5 text-gray-600">
            <Row label="Landed" value={fmtNum(d.landed)} />
            <Row label="Lender Clicked" value={`${fmtNum(d.lender_clicked)} (${fmtPct(d.landed ? d.lender_clicked / d.landed : 0, 1)})`} />
            <Row label="Disbursed" value={`${fmtNum(d.disbursed)} (${fmtPct(d.conversion, 2)})`} />
            <Row label="Disbursed Amount" value={fmtValue(d.disbursed_amount, "amount")} />
        </div>
        <div className="mt-1.5 border-t border-gray-100 pt-1.5 text-gray-600">
            <Row label={metricLabel} value={fmtValue(d.value, metricKind)} bold />
            {/* Same-weekday baseline. Comparing Monday to Sunday would manufacture
                a fake -40% every week and train people to ignore this tooltip. */}
            {d.deltaVsWeekdayAvg != null && (
                <Row
                    label={`vs 4-wk ${fmtDate(d.date).split(",")[0]} avg`}
                    value={
                        <span className={d.deltaVsWeekdayAvg >= 0 ? "text-violet-600" : "text-red-600"}>
                            {d.deltaVsWeekdayAvg >= 0 ? "▲" : "▼"} {fmtDelta(d.deltaVsWeekdayAvg)}
                        </span>
                    }
                />
            )}
        </div>
    </div>
);

const Row = ({ label, value, bold }) => (
    <div className="flex items-baseline justify-between gap-3">
        <span className={bold ? "font-medium text-gray-700" : ""}>{label}</span>
        <span className={clsx("tabular-nums", bold && "font-semibold text-gray-900")}>{value}</span>
    </div>
);

const CalendarHeatmap = ({ filters, theme = "high", blocked = [] }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metric, setMetric] = useState("disbursed");
    const [hover, setHover] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getDailyPerformance({ ...filters, metric, days: 91, signal: controller.signal })
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

    const weeks = useMemo(() => toWeeks(data?.series || []), [data]);
    const ramp = RAMP[theme] || RAMP.high;

    const metricOptions = METRIC_OPTIONS
        .filter((m) => !m.gated || !blocked.includes(m.gated))
        .map((m) => ({ key: m.key, label: m.label }));

    const subtitle = data
        ? `${data.metricLabel} · ${data.window?.label || ""} · vs same weekday 4-wk avg`
        : "";

    return (
        <Card
            title="Daily Performance"
            subtitle={subtitle}
            loading={loading}
            error={error}
            empty={!loading && !error && !(data?.series || []).length}
            emptyMessage="No data in the selected range."
            actions={<RefreshButton loading={loading} />}
        >
            <div className="mb-3">
                <Segmented options={metricOptions} value={metric} onChange={setMetric} />
            </div>

            <div className="relative overflow-x-auto pb-1">
                <div className="flex gap-[3px]" style={{ minWidth: weeks.length * (CELL + GAP) + 30 }}>
                    {/* Row labels — Mon/Wed/Fri only, the standard convention */}
                    <div className="mr-1 flex flex-col gap-[3px] pt-0">
                        {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                            <div
                                key={r}
                                style={{ height: CELL }}
                                className="flex items-center text-[9px] leading-none text-gray-400"
                            >
                                {r === 0 ? "Mon" : r === 2 ? "Wed" : r === 4 ? "Fri" : ""}
                            </div>
                        ))}
                    </div>

                    {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                            {week.map((d, ri) => {
                                if (!d) {
                                    return <div key={ri} style={{ width: CELL, height: CELL }} />;
                                }
                                const step = binIndex(d.value, data?.bins || []);
                                return (
                                    <div
                                        key={ri}
                                        onMouseEnter={() => setHover({ d, wi })}
                                        onMouseLeave={() => setHover(null)}
                                        style={{
                                            width: CELL,
                                            height: CELL,
                                            background: ramp[step],
                                            // Provisional days are real data but
                                            // incomplete — dimmed, not hidden.
                                            opacity: d.provisional ? 0.45 : 1,
                                        }}
                                        className={clsx(
                                            "cursor-pointer rounded-[3px] transition",
                                            hover?.d?.date === d.date && "ring-2 ring-purple-500"
                                        )}
                                        title=""
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>

                {hover && (
                    <div
                        className="absolute top-0 z-30"
                        style={{
                            left: Math.min(hover.wi * (CELL + GAP) + 30, 380),
                            transform: "translateY(-100%)",
                        }}
                    >
                        <div className="relative">
                            <Tooltip d={hover.d} metricLabel={data?.metricLabel} metricKind={data?.metricKind} />
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-3">
                <RampLegend
                    ramp={ramp}
                    extra={[
                        {
                            label: "Provisional",
                            className: "border-gray-300",
                            style: { background: ramp[3], opacity: 0.45 },
                        },
                    ]}
                />
            </div>

            <Note>
                Days in the last {data?.misLagDays ?? 23} are <strong>provisional</strong> — disbursals arrive on a lag
                (measured P90: 23 days), so the right edge is incomplete rather than falling. Comparison is against the{" "}
                <strong>same weekday's</strong> trailing 4-week average, not the prior day.
            </Note>
        </Card>
    );
};

export default CalendarHeatmap;
