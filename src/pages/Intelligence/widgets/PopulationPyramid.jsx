import React, { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer, ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { getPyramid } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Segmented, Note, NValue } from "../components/Shell";
import { COLORS } from "../lib/constants";
import { fmtNum, fmtPct } from "../lib/format";

// Population pyramid with a conversion overlay.
//
// The overlay is what makes this widget earn its space. A pyramid alone shows who
// SHOWS UP — a marketing input, largely already known. The overlay shows who shows
// up AND CONVERTS. The gap between the bars and the line is the entire insight:
// a fat 18-24 bar under a collapsed conversion line says we are buying volume we
// cannot serve.

const PyramidTooltip = ({ active, payload, sides }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="rounded-lg border border-[#d6d4cb] bg-white px-3 py-2 text-[11px] shadow-lg">
            <p className="font-semibold text-gray-900">Age {d.bucket}</p>
            <div className="mt-1 space-y-0.5 text-gray-600">
                {/* Absolute values on BOTH sides. The left series is negated only to
                    mirror the axis — surfacing a negative count would read as a bug. */}
                <div className="flex justify-between gap-4">
                    <span>{sides[0]}</span>
                    <span className="tabular-nums">{fmtNum(Math.abs(d.leftPlot))}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span>{sides[1]}</span>
                    <span className="tabular-nums">{fmtNum(d.right)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-4 border-t border-gray-100 pt-1">
                    <span className="font-medium text-gray-700">Conversion</span>
                    <span className="font-semibold tabular-nums text-gray-900">{fmtPct(d.conversion)}</span>
                </div>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">n={fmtNum(d.landed)}</p>
            {d.belowFloor && <p className="mt-0.5 text-[10px] text-amber-600">Below volume floor — not ranked</p>}
        </div>
    );
};

const PopulationPyramid = ({ filters }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [split, setSplit] = useState("gender");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getPyramid({ ...filters, split, signal: controller.signal })
            .then((res) => {
                if (!controller.signal.aborted) {
                    const d = res?.data?.data || null;
                    setData(d);
                    // >20% unknown gender makes the pyramid mostly one grey bar.
                    // Switch to the disbursed split rather than render something
                    // that looks broken.
                    if (d?.recommendFallback && split === "gender") setSplit("disbursed");
                }
            })
            .catch((e) => {
                if (!controller.signal.aborted) setError(e?.message || "Failed to load");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [filters, split]);

    // Reverse so the youngest bucket sits at the BOTTOM, per pyramid convention.
    const chartData = useMemo(
        () =>
            [...(data?.buckets || [])].reverse().map((b) => ({
                ...b,
                leftPlot: -b.left, // negated purely to mirror the axis
            })),
        [data]
    );

    const sides = data?.sides || ["Male", "Female"];
    const maxAbs = Math.max(1, ...chartData.map((d) => Math.max(d.left, d.right)));

    return (
        <Card
            title="Customer Age Distribution"
            subtitle={`Split by ${split === "gender" ? "gender" : "disbursed"} · conversion overlay · youngest at bottom`}
            loading={loading}
            error={error}
            empty={!loading && !error && !chartData.length}
            emptyMessage="No age data available"
            actions={
                <div className="flex items-center gap-1.5">
                    <Segmented
                        options={[
                            { key: "gender", label: "Gender" },
                            { key: "disbursed", label: "Disbursed" },
                        ]}
                        value={split}
                        onChange={setSplit}
                    />
                    <RefreshButton loading={loading} />
                </div>
            }
        >
            <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 0 }}>
                        <CartesianGrid stroke="#ededea" strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                            type="number"
                            domain={[-maxAbs, maxAbs]}
                            // Math.abs is REQUIRED — without it the left half of the
                            // axis renders negative counts and the chart looks broken.
                            tickFormatter={(v) => fmtNum(Math.abs(v))}
                            tick={{ fill: "#8a8f9a", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            type="category"
                            dataKey="bucket"
                            tick={{ fill: "#6b7280", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={48}
                        />
                        <Tooltip content={<PyramidTooltip sides={sides} />} />
                        <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                        <ReferenceLine x={0} stroke="#d6d4cb" />
                        <Bar dataKey="leftPlot" name={sides[0]} fill={COLORS.brand2} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="right" name={sides[1]} fill={COLORS.accent} radius={[0, 0, 0, 0]} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* The conversion overlay, rendered as an explicit row rather than a
                second axis — at 5 buckets a table row is more readable than a
                secondary-axis line, and it keeps the n visible. */}
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Conversion by age — the gap vs the bars above is the insight
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                    {(data?.buckets || []).map((b) => (
                        <div key={b.bucket} className="rounded-md bg-white p-1.5 text-center">
                            <p className="text-[10px] text-gray-500">{b.bucket}</p>
                            <p className="text-[12px] font-semibold tabular-nums text-gray-900">{fmtPct(b.conversion)}</p>
                            <NValue n={b.landed} />
                        </div>
                    ))}
                </div>
            </div>

            {data?.recommendFallback && (
                <Note>
                    Gender is unknown on {data.genderUnknownPct}% of leads, so the split fell back to
                    disbursed-vs-not — a gender pyramid here would be mostly one grey bar.
                </Note>
            )}
        </Card>
    );
};

export default PopulationPyramid;
