import React, { useEffect, useState } from "react";
import { getMediumDisbursal } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Segmented, Note, NValue, NotInstrumented } from "../components/Shell";
import { clsx, fmtNum, fmtPct, fmtINR, fmtDelta } from "../lib/format";

// Medium-wise disbursal.
//
// Two things this widget must get right or it actively misleads:
//
// 1. A NULL utm_medium is OWN traffic (QuickLoans / EasyLoan), not "unknown". It
//    is the largest and cheapest segment — labelling it unknown would bury it.
//
// 2. CAC renders "Spend not connected", never ₹0. ₹0 would make an unmeasured
//    channel look infinitely efficient and route budget toward exactly what we
//    cannot see. Meta and Google — the two biggest paid channels — have no spend
//    feed at any grain.

const DIMENSIONS = [
    { key: "medium", label: "Medium" },
    { key: "source", label: "Source" },
    { key: "campaign", label: "Campaign" },
    { key: "channel", label: "Channel" },
];

const MediumTable = ({ filters }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dimension, setDimension] = useState("medium");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getMediumDisbursal({ ...filters, dimension, signal: controller.signal })
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
    }, [filters, dimension]);

    const items = data?.items || [];
    const ranked = items.filter((i) => !i.belowFloor);
    const unranked = items.filter((i) => i.belowFloor);

    const Row = ({ i, muted }) => (
        <tr className={clsx("border-b border-gray-100 hover:bg-gray-50", muted && "opacity-60")}>
            <td className="py-2 pr-3">
                <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-800">{i.value}</span>
                    {i.isOwnTraffic && (
                        <span
                            title="Our own landing-page traffic — zero acquisition cost. NULL utm_medium, not unknown."
                            className="rounded border border-violet-200 bg-violet-50 px-1 py-0.5 text-[9px] font-semibold text-violet-700"
                        >
                            OWN
                        </span>
                    )}
                    {i.isPartner && (
                        <span
                            title="Lender partner sending us traffic — rev-share, not a budget lever. Route to BD."
                            className="rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-700"
                        >
                            PARTNER
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-gray-400">{i.channel}</span>
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{fmtNum(i.landed)}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{fmtNum(i.lender_clicked)}</td>
            <td className="py-2 pr-3 text-right tabular-nums font-medium text-gray-800">{fmtNum(i.disbursed)}</td>
            <td className="py-2 pr-3 text-right">
                <div className="font-semibold tabular-nums text-gray-900">{fmtPct(i.conversion)}</div>
                <NValue n={i.landed} />
            </td>
            <td
                className={clsx(
                    "py-2 pr-3 text-right tabular-nums",
                    (i.vsGrandMean || 0) >= 0 ? "text-violet-600" : "text-red-600"
                )}
            >
                {i.vsGrandMean == null ? "—" : fmtDelta(i.vsGrandMean, 0)}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{fmtINR(i.disbursed_amount)}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{i.avgTicket ? fmtINR(i.avgTicket) : "—"}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{i.share}%</td>
            <td className="py-2 text-right">
                {/* Never ₹0. Never an em-dash. The gap must stay visible so it gets
                    fixed — a missing column gets forgotten. */}
                {i.spendConnected ? (
                    <span className="tabular-nums text-gray-700">—</span>
                ) : (
                    <NotInstrumented label="No spend" reason={i.cacNote} />
                )}
            </td>
        </tr>
    );

    return (
        <Card
            title="Medium-wise Disbursal"
            subtitle={`Attributed to first-touch acquisition ${dimension} · n≥${data?.floor ?? 500} · ${ranked.length}/${items.length} ranked`}
            loading={loading}
            error={error}
            empty={!loading && !error && !items.length}
            emptyMessage="No disbursals in the selected range"
            actions={
                <div className="flex items-center gap-1.5">
                    <Segmented options={DIMENSIONS} value={dimension} onChange={setDimension} />
                    <RefreshButton loading={loading} />
                </div>
            }
        >
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                    <thead>
                        <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                            <th className="py-2 pr-3 font-semibold">{DIMENSIONS.find((d) => d.key === dimension)?.label}</th>
                            <th className="py-2 pr-3 text-right font-semibold">Landed</th>
                            <th className="py-2 pr-3 text-right font-semibold">Clicked</th>
                            <th className="py-2 pr-3 text-right font-semibold">Disbursed</th>
                            <th className="py-2 pr-3 text-right font-semibold">Conversion</th>
                            <th className="py-2 pr-3 text-right font-semibold">vs mean</th>
                            <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                            <th className="py-2 pr-3 text-right font-semibold">Avg ticket</th>
                            <th className="py-2 pr-3 text-right font-semibold">Share</th>
                            <th className="py-2 text-right font-semibold">CAC</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ranked.map((i) => <Row key={i.value} i={i} />)}
                        {unranked.length > 0 && (
                            <tr className="bg-gray-50">
                                <td colSpan={10} className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Insufficient data ({unranked.length}) — unknown, not bad
                                </td>
                            </tr>
                        )}
                        {unranked.map((i) => <Row key={i.value} i={i} muted />)}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-gray-200 font-semibold text-gray-800">
                            <td className="py-2 pr-3">Total</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(data?.totals?.landed)}</td>
                            <td className="py-2 pr-3" />
                            <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(data?.totals?.disbursed)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{fmtPct(data?.grandMean || 0)}</td>
                            <td colSpan={5} className="py-2" />
                        </tr>
                    </tfoot>
                </table>
            </div>

            {(data?.unmappedMediums || []).length > 0 && (
                <p className="mt-2 text-[10.5px] text-amber-600">
                    Unmapped mediums (fell into "Other" — add to CHANNEL_MAP):{" "}
                    <span className="font-mono">{data.unmappedMediums.join(", ")}</span>
                </p>
            )}

            <Note>{data?.note}</Note>
        </Card>
    );
};

export default MediumTable;
