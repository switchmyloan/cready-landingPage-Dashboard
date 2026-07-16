import React, { useEffect, useState } from "react";
import { getBestSlots } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Note, ProxyChip, NValue, Skeleton } from "../components/Shell";
import { clsx, fmtValue, fmtDelta, tierChip } from "../lib/format";

// Best Performing Time Slots — the requested centrepiece.
//
// The five rows are COMPUTED from live data. The seeded table in the spec
// (Monday 9 PM / Tuesday 11 AM / …) is the QA fixture and the action-copy
// template, not measured truth — shipping those literal slots would be asserting
// findings we never made.
//
// Each row is a DISTINCT signal with its own metric and gate. They are not five
// instances of one rule.

const BestSlotsTable = ({ filters, blocked = [] }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getBestSlots({ ...filters, signal: controller.signal })
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

    const slots = data?.slots || [];
    const anyResolved = slots.some((s) => s.slot);

    return (
        <Card
            title="Best Performing Time Slots"
            subtitle={`Ranked on the 95% lower bound · excludes the trailing ${data?.misLagDays ?? 23}-day MIS-lag window`}
            loading={loading}
            error={error}
            actions={<RefreshButton loading={loading} />}
        >
            {loading ? null : !anyResolved ? (
                <div className="py-8 text-center text-xs text-gray-400">
                    No slots cleared the confidence bar in this window. Widen the date range, or lower the volume floor.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                        <thead>
                            <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                                <th className="py-2 pr-3 font-semibold">Day</th>
                                <th className="py-2 pr-3 font-semibold">Hour</th>
                                <th className="py-2 pr-3 font-semibold">Signal</th>
                                <th className="py-2 pr-3 text-right font-semibold">Value</th>
                                <th className="py-2 pr-3 text-right font-semibold">vs mean</th>
                                <th className="py-2 pr-3 font-semibold">Confidence</th>
                                <th className="py-2 font-semibold">Recommended Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {slots.map((s) => {
                                const gatedOff = s.gated && blocked.includes(s.gated);
                                return (
                                    <tr key={s.key} className="border-b border-gray-100 align-top hover:bg-gray-50">
                                        {!s.slot || gatedOff ? (
                                            <td colSpan={7} className="py-2.5 pr-3">
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium text-gray-500">{s.label}</span>
                                                    <span className="text-[11px] italic text-gray-400">
                                                        {gatedOff
                                                            ? "Metric unavailable — the approval signal is not present in the MIS feed."
                                                            : s.reason || "No qualifying slot."}
                                                    </span>
                                                </div>
                                            </td>
                                        ) : (
                                            <>
                                                <td className="py-2.5 pr-3 font-medium text-gray-800">{s.slot.dayLabel}</td>
                                                <td className="py-2.5 pr-3 tabular-nums text-gray-800">{s.slot.hourLabel}</td>
                                                <td className="py-2.5 pr-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-gray-700">{s.label}</span>
                                                        {s.proxy && <ProxyChip title={s.caveat} />}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 pr-3 text-right">
                                                    <div className="font-semibold tabular-nums text-gray-900">
                                                        {fmtValue(s.slot.value, s.metricKind)}
                                                    </div>
                                                    <NValue n={s.slot.landed} />
                                                </td>
                                                <td
                                                    className={clsx(
                                                        "py-2.5 pr-3 text-right tabular-nums",
                                                        (s.slot.vsGrandMean || 0) >= 0 ? "text-violet-600" : "text-red-600"
                                                    )}
                                                >
                                                    {s.slot.vsGrandMean == null ? "—" : fmtDelta(s.slot.vsGrandMean, 0)}
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <span
                                                        className={clsx(
                                                            "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                                                            tierChip(s.confidence?.tier)
                                                        )}
                                                    >
                                                        {s.confidence?.tier || "—"}
                                                    </span>
                                                </td>
                                                <td className="py-2.5">
                                                    <div className="font-medium text-gray-800">{s.action}</div>
                                                    {s.caveat && (
                                                        <p className="mt-0.5 max-w-md text-[10.5px] leading-relaxed text-gray-400">
                                                            {s.caveat}
                                                        </p>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Note>
                Rows are <strong>computed from live data</strong>, not the seeded example slots. A rate signal only
                qualifies if its 95% lower bound beats the grand mean — so an empty row means "not proven", not "no data".
                The trailing {data?.misLagDays ?? 23} days are excluded: their disbursals have not landed, and ranking on
                them would recommend buying the past.
            </Note>
        </Card>
    );
};

export default BestSlotsTable;
