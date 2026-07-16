import React, { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer, AreaChart, Area, Line, ComposedChart,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { getDailyPerformance } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Segmented, Note } from "../components/Shell";
import { COLORS, METRIC_OPTIONS } from "../lib/constants";
import { fmtNum, fmtINR, fmtValue, fmtDateShort, fmtDate } from "../lib/format";

// Daily trend. Reuses DisbursalDashboard's TrendChart config exactly — same
// gradient id pattern, strokeWidth, dot/activeDot, and tooltip styling — so the
// module reads as part of the same product.

const movingAverage = (series, key, window = 7) =>
    series.map((d, i) => {
        const from = Math.max(0, i - Math.floor(window / 2));
        const to = Math.min(series.length, i + Math.ceil(window / 2));
        const slice = series.slice(from, to);
        const settled = slice.filter((x) => !x.provisional);
        if (!settled.length) return { ...d, ma: null };
        return { ...d, ma: settled.reduce((a, x) => a + (x[key] || 0), 0) / settled.length };
    });

const ChartTooltip = ({ active, payload, metricKind, metricLabel }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="rounded-lg border border-[#d6d4cb] bg-white px-3 py-2 text-[11px] shadow-lg">
            <p className="font-semibold text-gray-900">{fmtDate(d.date)}</p>
            {d.provisional && (
                <p className="mt-0.5 text-[10px] font-medium text-amber-600">Provisional — disbursals still landing</p>
            )}
            <div className="mt-1 space-y-0.5">
                <div className="flex justify-between gap-4">
                    <span className="text-gray-500">{metricLabel}</span>
                    <span className="font-semibold tabular-nums text-gray-900">{fmtValue(d.value, metricKind)}</span>
                </div>
                {d.ma != null && (
                    <div className="flex justify-between gap-4">
                        <span className="text-gray-500">7-day avg</span>
                        <span className="tabular-nums text-gray-600">{fmtValue(d.ma, metricKind)}</span>
                    </div>
                )}
                <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Landed</span>
                    <span className="tabular-nums text-gray-600">{fmtNum(d.landed)}</span>
                </div>
            </div>
        </div>
    );
};

const DailyTrend = ({ filters, blocked = [] }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metric, setMetric] = useState("disbursed");

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

    const chartData = useMemo(() => movingAverage(data?.series || [], "value"), [data]);

    const metricOptions = METRIC_OPTIONS
        .filter((m) => !m.gated || !blocked.includes(m.gated))
        .map((m) => ({ key: m.key, label: m.label }));

    const kind = data?.metricKind;
    const tickFmt = (v) => (kind === "amount" ? fmtINR(v) : kind === "rate" ? `${(v * 100).toFixed(1)}%` : fmtNum(v));

    return (
        <Card
            title={`${data?.metricLabel || "Disbursed"} Trend`}
            subtitle={`Daily · ${data?.window?.label || ""} · 7-day moving average overlaid`}
            loading={loading}
            error={error}
            empty={!loading && !error && !chartData.length}
            emptyMessage="No data in selected range"
            actions={<RefreshButton loading={loading} />}
        >
            <div className="mb-3">
                <Segmented options={metricOptions} value={metric} onChange={setMetric} />
            </div>

            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                        <defs>
                            <linearGradient id="grad-intel-trend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={COLORS.brand} stopOpacity={0.4} />
                                <stop offset="60%" stopColor={COLORS.brand} stopOpacity={0.1} />
                                <stop offset="100%" stopColor={COLORS.brand} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#ededea" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={fmtDateShort}
                            tick={{ fill: "#8a8f9a", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            dy={4}
                            minTickGap={24}
                        />
                        <YAxis
                            tick={{ fill: "#8a8f9a", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={tickFmt}
                        />
                        <Tooltip
                            cursor={{ stroke: "#d6d4cb", strokeWidth: 1, strokeDasharray: "3 3" }}
                            content={<ChartTooltip metricKind={kind} metricLabel={data?.metricLabel} />}
                        />
                        <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            name={data?.metricLabel || "Value"}
                            stroke={COLORS.brand}
                            strokeWidth={2.2}
                            fill="url(#grad-intel-trend)"
                            dot={{ r: 0 }}
                            activeDot={{ r: 5, fill: COLORS.brand, stroke: "#fff", strokeWidth: 2 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="ma"
                            name="7-day avg"
                            stroke="#9ca3af"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            dot={false}
                            activeDot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <Note>
                The last {data?.misLagDays ?? 23} days are <strong>provisional</strong> — disbursals arrive on a lag, so
                the right edge is incomplete, not falling. The moving average is computed on settled days only, so it does
                not bend downward into the lag window.
            </Note>
        </Card>
    );
};

export default DailyTrend;
