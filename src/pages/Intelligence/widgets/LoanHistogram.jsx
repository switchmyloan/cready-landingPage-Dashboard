import React, { useEffect, useState } from "react";
import {
    ResponsiveContainer, ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend, LabelList,
} from "recharts";
import { getLoanAnalysis } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Note, NValue } from "../components/Shell";
import { COLORS } from "../lib/constants";
import { clsx, fmtNum, fmtPct, fmtINR } from "../lib/format";

// Loan amount histogram on CANONICAL slabs.
//
// Canonical slabs, not equal-width bins: equal-width bins over round-number-
// clustered data produce half-empty/half-spike bins AND would not match the
// filter presets, so clicking a bar would filter to a different set than the bar
// displayed.
//
// Also surfaces the FULFILMENT RATIO (disbursed ÷ requested) — commercially
// useful and currently computed nowhere else in the product.

const FULFILMENT_TONE = {
    healthy: { cls: "text-violet-600", label: "Healthy" },
    under_serving: { cls: "text-amber-600", label: "Under-serving" },
    mismatch: { cls: "text-red-600", label: "Mismatch" },
};

const HistTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="rounded-lg border border-[#d6d4cb] bg-white px-3 py-2 text-[11px] shadow-lg">
            <p className="font-semibold text-gray-900">{d.slab}</p>
            <div className="mt-1 space-y-0.5 text-gray-600">
                <div className="flex justify-between gap-4"><span>Landed</span><span className="tabular-nums">{fmtNum(d.landed)}</span></div>
                <div className="flex justify-between gap-4"><span>Disbursed</span><span className="tabular-nums">{fmtNum(d.disbursed)}</span></div>
                <div className="flex justify-between gap-4"><span>Conversion</span><span className="tabular-nums">{fmtPct(d.conversion)}</span></div>
                {d.medianRequested != null && (
                    <div className="flex justify-between gap-4"><span>Median requested</span><span className="tabular-nums">{fmtINR(d.medianRequested)}</span></div>
                )}
                {d.meanDisbursed != null && (
                    <div className="flex justify-between gap-4"><span>Mean disbursed</span><span className="tabular-nums">{fmtINR(d.meanDisbursed)}</span></div>
                )}
                {d.fulfilmentRatio != null && (
                    <div className="mt-1 flex justify-between gap-4 border-t border-gray-100 pt-1">
                        <span className="font-medium text-gray-700">Fulfilment</span>
                        <span className={clsx("font-semibold tabular-nums", FULFILMENT_TONE[d.fulfilmentReading]?.cls)}>
                            {(d.fulfilmentRatio * 100).toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const LoanHistogram = ({ filters }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getLoanAnalysis({ ...filters, signal: controller.signal })
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
    }, [filters]);

    const slabs = (data?.slabs || []).filter((s) => s.landed > 0);
    const withFulfilment = slabs.filter((s) => s.fulfilmentRatio != null);

    return (
        <Card
            title="Loan Amount Distribution"
            subtitle="Requested amount, canonical slabs · conversion overlay"
            loading={loading}
            error={error}
            empty={!loading && !error && !slabs.length}
            emptyMessage="No loan amount data available"
            actions={<RefreshButton loading={loading} />}
        >
            <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={slabs} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
                        <CartesianGrid stroke="#ededea" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="slab" tick={{ fill: "#8a8f9a", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                            yAxisId="left"
                            tick={{ fill: "#8a8f9a", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={fmtNum}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: "#8a8f9a", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                        />
                        <Tooltip content={<HistTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                        <Bar yAxisId="left" dataKey="landed" name="Landed" fill={COLORS.brand} radius={[3, 3, 0, 0]} barCategoryGap={1} />
                        {/* The overlay: where conversion actually sits within the
                            distribution. Bars alone only show where demand is. */}
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="conversion"
                            name="Conversion %"
                            stroke={COLORS.neg}
                            strokeWidth={2}
                            dot={{ r: 3, fill: COLORS.neg }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {withFulfilment.length > 0 && (
                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Fulfilment ratio — disbursed ÷ requested
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {withFulfilment.map((s) => (
                            <div key={s.slab} className="flex-1 rounded-md bg-white p-1.5 text-center">
                                <p className="text-[10px] text-gray-500">{s.slab}</p>
                                <p className={clsx("text-[12px] font-semibold tabular-nums", FULFILMENT_TONE[s.fulfilmentReading]?.cls)}>
                                    {(s.fulfilmentRatio * 100).toFixed(0)}%
                                </p>
                                <p className="text-[9px] text-gray-400">{FULFILMENT_TONE[s.fulfilmentReading]?.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Note>
                <strong>Requested ≠ disbursed</strong> — these never share an axis. Round-number spikes at ₹50K/₹1L are a
                slider artefact, not demand. A fulfilment ratio below 50% means we are attracting demand we cannot serve:
                add a lender for that slab, or stop advertising it.
            </Note>
        </Card>
    );
};

export default LoanHistogram;
