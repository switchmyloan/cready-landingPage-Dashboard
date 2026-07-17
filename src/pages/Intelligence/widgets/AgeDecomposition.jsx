import React, { useEffect, useState } from "react";
import { getAgeAnalysis } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Note, NValue, NotInstrumented } from "../components/Shell";
import { clsx, fmtNum, fmtPct } from "../lib/format";

// Age-wise disbursal conversion, WITH the 4-way decomposition.
//
// "18-24 disburses at 1.2% vs 25-34 at 3.8%" is a fact nobody can act on. The
// decomposition tells you WHICH OF FOUR TEAMS OWNS IT — that is the whole point of
// this widget, and the reason it is a table rather than a bar chart.

const STEPS = [
    {
        key: "submit_rate",
        label: "Form submit",
        of: "landed",
        owner: "Product",
        low: "UX friction — they landed but wouldn't apply.",
    },
    {
        key: "click_rate",
        label: "Lender click",
        of: "form submitted",
        owner: "BD",
        low: "SUPPLY gap — they applied and we had no offer to show. More traffic makes this worse.",
    },
    {
        key: "approval_rate",
        label: "Approval",
        of: "lender clicked",
        owner: "Risk",
        gated: "approval_rate",
        low: "The lender rejected them.",
    },
    {
        key: "disbursal_from_click",
        label: "Disbursal",
        of: "lender clicked",
        owner: "Ops",
        low: "They had an offer and dropped anyway — usually the most fixable.",
    },
];

// Colour the cell by how far it is from the column mean, so the reader's eye lands
// on the outlier rather than on the biggest number.
const cellTone = (v, mean) => {
    if (!mean || v == null) return "text-gray-700";
    const r = v / mean;
    if (r < 0.7) return "text-red-600 font-semibold";
    if (r < 0.9) return "text-amber-600";
    if (r > 1.15) return "text-violet-600 font-semibold";
    return "text-gray-700";
};

const AgeDecomposition = ({ filters, blocked = [] }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getAgeAnalysis({ ...filters, signal: controller.signal })
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

    const buckets = (data?.buckets || []).filter((b) => b.landed > 0);
    const eligible = buckets.filter((b) => !b.belowFloor);

    const meanOf = (key) =>
        eligible.length ? eligible.reduce((a, b) => a + (b.decomposition[key] || 0), 0) / eligible.length : 0;

    return (
        <Card
            title="Age-wise Disbursal Conversion"
            subtitle={`Decomposed by funnel step · n≥${data?.floor ?? 200} · grand mean ${fmtPct(data?.grandMean || 0)}`}
            loading={loading}
            error={error}
            empty={!loading && !error && !buckets.length}
            emptyMessage="No age data available"
            actions={<RefreshButton loading={loading} />}
        >
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                    <thead>
                        <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                            <th className="py-2 pr-3 font-semibold">Age</th>
                            <th className="py-2 pr-3 text-right font-semibold">Landed</th>
                            <th className="py-2 pr-3 text-right font-semibold">Disbursal %</th>
                            {STEPS.map((s) => (
                                <th key={s.key} className="py-2 pr-3 text-right font-semibold" title={`Owner: ${s.owner}`}>
                                    {s.label}
                                    <span className="ml-1 font-normal normal-case text-gray-400">({s.owner})</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {buckets.map((b) => (
                            <tr key={b.bucket} className={clsx("border-b border-gray-100 hover:bg-gray-50", b.belowFloor && "opacity-50")}>
                                <td className="py-2 pr-3 font-medium text-gray-800">
                                    {b.bucket}
                                    {b.belowFloor && <span className="ml-1 text-[9px] italic text-gray-400">below floor</span>}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{fmtNum(b.landed)}</td>
                                <td className="py-2 pr-3 text-right">
                                    <span
                                        className={clsx(
                                            "font-semibold tabular-nums",
                                            (b.vsGrandMean || 0) >= 0 ? "text-violet-600" : "text-red-600"
                                        )}
                                    >
                                        {fmtPct(b.conversion)}
                                    </span>
                                </td>
                                {STEPS.map((s) => {
                                    const gatedOff = s.gated && blocked.includes(s.gated);
                                    if (gatedOff) {
                                        return (
                                            <td key={s.key} className="py-2 pr-3 text-right">
                                                <NotInstrumented
                                                    label="n/a"
                                                    reason="The approval signal is not present in the MIS feed — approve_flag='Yes' appears on 58 of 94,802 rows."
                                                />
                                            </td>
                                        );
                                    }
                                    const v = b.decomposition[s.key];
                                    return (
                                        <td
                                            key={s.key}
                                            className={clsx("py-2 pr-3 text-right tabular-nums", cellTone(v, meanOf(s.key)))}
                                        >
                                            {fmtPct(v, 1)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {(data?.excluded || []).length > 0 && (
                <p className="mt-2 text-[10.5px] text-gray-400">
                    Excluded from rates (shown separately, never dropped):{" "}
                    {data.excluded.map((e) => `${e.bucket} (${fmtNum(e.landed)})`).join(" · ")}
                </p>
            )}

            <Note>
                Read <strong>across</strong> a row, not down the column: a low <em>Lender click</em> is a{" "}
                <strong>supply</strong> problem (BD — we had no offer), while a low <em>Disbursal</em> is an{" "}
                <strong>Ops</strong> problem (we had an offer and lost them). {data?.note}
            </Note>
        </Card>
    );
};

export default AgeDecomposition;
