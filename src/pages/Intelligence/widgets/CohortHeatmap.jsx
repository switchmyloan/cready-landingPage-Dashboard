import React, { useEffect, useState } from "react";
import { getCohortHeatmap } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Segmented, Note, RampLegend, NValue } from "../components/Shell";
import { RAMP, COHORT_STAGES } from "../lib/constants";
import { clsx, fmtNum, fmtPct, fmtDateShort } from "../lib/format";

// Cohort heatmap.
//
// THE censoring rule: a cell whose day_n exceeds the cohort's observed age has NO
// DATA — that day has not happened yet. It renders EMPTY, never as 0%.
//
// Render it as 0 and the matrix grows a triangular dead zone in the bottom-right
// that looks exactly like catastrophic recent decay, and every reader draws the
// same wrong conclusion: "our newest cohorts are collapsing". It is the most
// common cohort bug in production dashboards and it is completely avoidable.

const CELL_W = 40;
const CELL_H = 26;

const CohortHeatmap = ({ filters, theme = "high" }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stage, setStage] = useState("disbursed");
    const [grain, setGrain] = useState("weekly");
    const [hover, setHover] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getCohortHeatmap({ ...filters, stage, grain, maxDay: 30, signal: controller.signal })
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
    }, [filters, stage, grain]);

    const ramp = RAMP[theme] || RAMP.high;
    const cohorts = data?.cohorts || [];
    const maxDay = data?.maxDay ?? 30;
    const scaleMax = data?.scaleMax || 0;

    // Steps computed against the max of SETTLED, OBSERVED cells only.
    const stepOf = (v) => {
        if (!scaleMax || v == null) return 0;
        return Math.min(4, Math.floor((v / scaleMax) * 5));
    };

    const days = Array.from({ length: maxDay + 1 }, (_, i) => i);

    return (
        <Card
            title="Cohort Progression"
            subtitle={`${grain} cohorts · Day 0–${maxDay} · cumulative · denominator: ${data?.denominatorLabel || "identified users"}`}
            loading={loading}
            error={error}
            empty={!loading && !error && !cohorts.length}
            emptyMessage="No cohorts in the selected range"
            actions={
                <div className="flex items-center gap-1.5">
                    <Segmented
                        options={COHORT_STAGES.map((s) => ({ key: s.key, label: s.label }))}
                        value={stage}
                        onChange={setStage}
                    />
                    <Segmented
                        options={[
                            { key: "weekly", label: "Weekly" },
                            { key: "daily", label: "Daily" },
                            { key: "monthly", label: "Monthly" },
                        ]}
                        value={grain}
                        onChange={setGrain}
                    />
                    <RefreshButton loading={loading} />
                </div>
            }
        >
            <div className="relative overflow-x-auto pb-1">
                <div style={{ minWidth: (maxDay + 1) * (CELL_W + 2) + 130 }}>
                    {/* Day axis */}
                    <div className="mb-1 flex gap-[2px] pl-[128px]">
                        {days.map((d) => (
                            <div key={d} style={{ width: CELL_W }} className="text-center text-[9px] text-gray-400">
                                {d % 5 === 0 ? `D${d}` : ""}
                            </div>
                        ))}
                    </div>

                    {cohorts.map((c) => (
                        <div key={c.cohort} className={clsx("mb-[2px] flex items-center gap-[2px]", c.belowFloor && "opacity-50")}>
                            {/* Row header carries the cohort size — cohort tables are
                                read row-wise, and 4.8% on n=12,000 vs n=40 are
                                different facts. */}
                            <div className="w-[126px] shrink-0 pr-2">
                                <div className="text-[10px] font-medium text-gray-600">{fmtDateShort(c.cohortStart)}</div>
                                <NValue n={c.size} />
                            </div>

                            {c.cells.map((cell) => {
                                if (cell.censored) {
                                    // Not data. Not clickable, not hoverable, no fill.
                                    return (
                                        <div
                                            key={cell.dayN}
                                            style={{ width: CELL_W, height: CELL_H }}
                                            className="rounded-[2px] bg-transparent"
                                        />
                                    );
                                }
                                const step = stepOf(cell.value);
                                const dark = step >= 3;
                                return (
                                    <div
                                        key={cell.dayN}
                                        onMouseEnter={() => setHover({ c, cell })}
                                        onMouseLeave={() => setHover(null)}
                                        style={{
                                            width: CELL_W,
                                            height: CELL_H,
                                            background: ramp[step],
                                            opacity: cell.provisional ? 0.45 : 1,
                                        }}
                                        className={clsx(
                                            "flex cursor-pointer items-center justify-center rounded-[2px] text-[9px] tabular-nums transition",
                                            dark ? "text-white" : "text-gray-700",
                                            hover?.cell === cell && "ring-2 ring-gray-600"
                                        )}
                                    >
                                        {(cell.value * 100).toFixed(1)}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {hover && (
                    <div className="pointer-events-none absolute right-2 top-2 z-30 w-52 rounded-lg border border-[#d6d4cb] bg-white px-3 py-2 text-[11px] shadow-lg">
                        <p className="font-semibold text-gray-900">Cohort {fmtDateShort(hover.c.cohortStart)}</p>
                        <div className="mt-1 space-y-0.5 text-gray-600">
                            <div className="flex justify-between gap-3"><span>Cohort size</span><span className="tabular-nums">{fmtNum(hover.c.size)}</span></div>
                            <div className="flex justify-between gap-3"><span>Day</span><span className="tabular-nums">D{hover.cell.dayN}</span></div>
                            <div className="flex justify-between gap-3"><span>Reached</span><span className="tabular-nums">{fmtNum(hover.cell.n)}</span></div>
                            <div className="flex justify-between gap-3 border-t border-gray-100 pt-1">
                                <span className="font-medium text-gray-700">Cumulative</span>
                                <span className="font-semibold tabular-nums text-gray-900">{fmtPct(hover.cell.value)}</span>
                            </div>
                        </div>
                        {hover.cell.provisional && (
                            <p className="mt-1 text-[10px] text-amber-600">Provisional — still landing</p>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-3">
                <RampLegend
                    ramp={ramp}
                    extra={[
                        // Three special states need three swatches. Users cannot
                        // infer them from a gradient.
                        { label: "Censored (not yet)", className: "border border-dashed border-gray-300", style: { background: "transparent" } },
                        { label: "Provisional", className: "border-gray-300", style: { background: ramp[3], opacity: 0.45 } },
                    ]}
                />
            </div>

            <Note>
                Blank cells are <strong>censored</strong> — that day has not happened for that cohort yet. They are not
                zeros, and the triangular blank corner is the calendar, not a collapse. Cohort membership is fixed at day
                0 and never reassigned. {data?.note}
            </Note>
        </Card>
    );
};

export default CohortHeatmap;
