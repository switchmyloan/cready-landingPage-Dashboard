import React, { useEffect, useState } from "react";
import {
    ResponsiveContainer, ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { getFunnelProgression, getLagAnalysis } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Note, NValue, NotInstrumented } from "../components/Shell";
import { COLORS } from "../lib/constants";
import { clsx, fmtNum, fmtPct } from "../lib/format";

// Funnel progression + lag analysis.
//
// Six stages, not four: otp_verified and lender_clicked are kept SEPARATE.
// Collapsing lender_clicked into "Apply" merges a DEMAND question (did the user
// want it?) with a SUPPLY question (did we have anything to give them?), which
// have different owners and opposite fixes.

export const FunnelProgression = ({ filters, blocked = [] }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getFunnelProgression({ ...filters, signal: controller.signal })
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

    const steps = data?.steps || [];
    const t = data?.timings || {};

    return (
        <Card
            title="Funnel Progression After Acquisition"
            subtitle="Six stages · owner shown per step"
            loading={loading}
            error={error}
            empty={!loading && !error && !steps.length}
            actions={<RefreshButton loading={loading} />}
        >
            <div className="space-y-1.5">
                {steps.map((s, i) => {
                    const gatedOff = s.gated && blocked.includes(s.gated);
                    const width = Math.max(2, (s.cumulativeRate || 0) * 100);
                    const bigDrop = i > 0 && s.dropOff > 0.4;

                    return (
                        <div key={s.key} className="group">
                            <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-gray-700">{s.label}</span>
                                    {s.owner && (
                                        <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] text-gray-500">{s.owner}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {gatedOff ? (
                                        <NotInstrumented
                                            label="not measurable"
                                            reason="The approval signal is not present in the MIS feed."
                                        />
                                    ) : (
                                        <>
                                            <span className="tabular-nums text-gray-500">{fmtNum(s.n)}</span>
                                            <span className="font-semibold tabular-nums text-gray-800">
                                                {fmtPct(s.cumulativeRate, 1)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="h-5 overflow-hidden rounded bg-gray-100">
                                <div
                                    className={clsx("h-full rounded transition-all", gatedOff ? "bg-gray-200" : "")}
                                    style={{
                                        width: `${gatedOff ? 0 : width}%`,
                                        background: gatedOff ? undefined : COLORS.brand,
                                        opacity: 1 - i * 0.1,
                                    }}
                                />
                            </div>

                            {i > 0 && !gatedOff && (
                                <p className={clsx("mt-0.5 text-[10px]", bigDrop ? "text-red-600" : "text-gray-400")}>
                                    {fmtPct(s.stepConversion, 1)} of previous · {fmtPct(s.dropOff, 1)} drop-off
                                    {bigDrop && " ← largest leak"}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Median time-in-stage. Turns "70% drop off at OTP" into "70% drop off
                at OTP and the ones who succeed do so in 40 seconds" — which
                localises the problem to OTP delivery, not user patience. */}
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                <Timing label="Median → submit" value={t.medianMinutesToSubmit != null ? `${t.medianMinutesToSubmit} min` : "—"} />
                <Timing label="Submit → click" value={t.medianMinutesSubmitToClick != null ? `${t.medianMinutesSubmitToClick} min` : "—"} />
                <Timing label="Median → disbursal" value={t.medianDaysToDisburse != null ? `${t.medianDaysToDisburse} days` : "—"} />
            </div>

            <Note>{data?.note}</Note>
        </Card>
    );
};

const Timing = ({ label, value }) => (
    <div className="rounded-md bg-white p-1.5 text-center">
        <p className="text-[9px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-[12px] font-semibold tabular-nums text-gray-800">{value}</p>
    </div>
);

// ── Lag analysis ─────────────────────────────────────────────────────────────
// The ONLY proxy for lender TAT that exists today — nothing times lender API
// calls, and avgProcMin is hardcoded to 0. Coarse (it includes our funnel time and
// the customer's own delays) but real, observed, and directionally correct.
//
// Its P90 is what MIS_LAG_DAYS should be. Measured: 23 days.

export const LagAnalysis = ({ filters }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getLagAnalysis({ ...filters, signal: controller.signal })
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

    const bins = data?.bins || [];

    return (
        <Card
            title="Acquisition → Disbursal Lag"
            subtitle={
                data
                    ? `Median ${data.median ?? "—"}d · P90 ${data.p90 ?? "—"}d · n=${fmtNum(data.total)}`
                    : ""
            }
            loading={loading}
            error={error}
            empty={!loading && !error && !data?.total}
            emptyMessage="No disbursals in the selected range"
            actions={<RefreshButton loading={loading} />}
        >
            <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={bins} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                        <CartesianGrid stroke="#ededea" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: "#8a8f9a", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fill: "#8a8f9a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, 1]}
                            tick={{ fill: "#8a8f9a", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        />
                        <Tooltip
                            contentStyle={{ background: "#fff", border: "1px solid #d6d4cb", borderRadius: 10, fontSize: 12 }}
                            formatter={(v, n) => (n === "Cumulative" ? fmtPct(v, 0) : fmtNum(v))}
                            labelFormatter={(l) => `${l} days`}
                        />
                        <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                        <Bar yAxisId="left" dataKey="n" name="Disbursals" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="cumulativePct"
                            name="Cumulative"
                            stroke={COLORS.warn}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
                <Timing label="Median" value={data?.median != null ? `${data.median}d` : "—"} />
                <Timing label="P90" value={data?.p90 != null ? `${data.p90}d` : "—"} />
                <Timing label="By day 7" value={data?.pctByDay7 != null ? fmtPct(data.pctByDay7, 0) : "—"} />
                <Timing label="By day 30" value={data?.pctByDay30 != null ? fmtPct(data.pctByDay30, 0) : "—"} />
            </div>

            {(data?.byLender || []).length > 0 && (
                <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Speed by lender (lag proxy — not TAT)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {data.byLender.slice(0, 8).map((l) => (
                            <div key={l.lender} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1">
                                <span className="text-[10px] text-gray-600">{l.lender}</span>
                                <span className="ml-1.5 text-[11px] font-semibold tabular-nums text-gray-800">{l.median}d</span>
                                <NValue n={l.n} className="ml-1" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Note>
                <strong>P90 = {data?.p90 ?? "—"} days</strong> — this is what the MIS-lag exclusion should be, and it is
                why every ranking here excludes the trailing {data?.currentMisLagDays ?? 23} days. It also sets the
                correct attribution window: a 7-day window would miss most of the value.{" "}
                {data?.bimodal && <strong className="text-amber-700">{data.note}</strong>}
            </Note>
        </Card>
    );
};
