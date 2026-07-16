import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getLenderQuality } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Note, NValue, NotInstrumented, DqBanner } from "../components/Shell";
import { clsx, fmtNum, fmtPct, fmtINR } from "../lib/format";

// Lender quality — the TABLE, deliberately not a radar.
//
// Four of the seven requested radar axes have no source data (TAT, SLA, uptime,
// revenue). A radar with four collapsed spokes is not a degraded chart, it is a
// MISLEADING one: radars are read holistically, so four zeroed axes make every
// lender look broken in the same way. The spec itself says the table is the source
// of truth and the radar is only the summary — so the table is what ships.

const LenderTable = ({ filters }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getLenderQuality({ ...filters, signal: controller.signal })
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

    const lenders = data?.lenders || [];
    const ranked = lenders.filter((l) => !l.belowFloor);
    const unranked = lenders.filter((l) => l.belowFloor);
    const buckets = data?.bucketsAvailable;

    const Row = ({ l, muted }) => (
        <tr className={clsx("border-b border-gray-100 hover:bg-gray-50", muted && "opacity-60")}>
            <td className="py-2 pr-3">
                <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-800">{l.lenderName}</span>
                    {l.integrationSuspect && (
                        <AlertTriangle
                            className="h-3 w-3 text-amber-500"
                            // Invisible on a radar, because "other" isn't a quality
                            // axis — and often the first thing worth acting on.
                            title={`Integration suspect: ${(l.otherPct * 100).toFixed(0)}% of selections produce no lender response at all.`}
                        />
                    )}
                </div>
            </td>
            <td className="py-2 pr-3">
                {/* Explains a missing metric as "not applicable", not "bad". */}
                <span
                    className={clsx(
                        "rounded border px-1.5 py-0.5 text-[9px] font-semibold",
                        l.type === "Static"
                            ? "border-gray-200 bg-gray-50 text-gray-500"
                            : "border-violet-200 bg-violet-50 text-violet-700"
                    )}
                    title={
                        l.type === "Static"
                            ? "UTM-only lender — no API module, so it never returns a response. TAT/uptime/SLA are not applicable by construction."
                            : "API-integrated lender"
                    }
                >
                    {l.type}
                </span>
            </td>
            <td className="py-2 pr-3 text-right tabular-nums font-medium text-gray-800">{fmtNum(l.selected)}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-green-600">
                {buckets ? fmtNum(l.successful) : <span className="text-gray-300">—</span>}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-red-600">
                {buckets ? fmtNum(l.rejected) : <span className="text-gray-300">—</span>}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-amber-600">
                {buckets ? fmtNum(l.other) : <span className="text-gray-300">—</span>}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-800">{fmtNum(l.disbursed)}</td>
            <td className="py-2 pr-3 text-right">
                <div className="font-semibold tabular-nums text-gray-900">{fmtPct(l.disbursalRate)}</div>
                <NValue n={l.clicked} />
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{fmtINR(l.disbursedAmount)}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-gray-600">
                {l.speedLagDays != null ? `${l.speedLagDays}d` : "—"}
            </td>
            <td className="py-2 text-right">
                <NotInstrumented label="TAT / SLA / uptime" reason={data?.radarBlockedReason} />
            </td>
        </tr>
    );

    return (
        <Card
            title="Lender Quality Comparison"
            subtitle={`${lenders.length} lenders · n≥${data?.floor ?? 100} · speed is a lag proxy, not TAT`}
            loading={loading}
            error={error}
            empty={!loading && !error && !lenders.length}
            emptyMessage="No lender data in the selected range"
            actions={<RefreshButton loading={loading} />}
        >
            {/* When /all-lenders can't answer for this window, say so precisely
                rather than showing blanks the reader has to interpret. */}
            {data && !buckets && (
                <div className="mb-3">
                    <DqBanner
                        gate={{
                            severity: "warning",
                            title: "Success / reject / other buckets unavailable for this window",
                            detail: data.bucketsNote,
                            impact: "Disbursal metrics below are unaffected — they come from this module's own query.",
                            owner: "Narrow to Today/Yesterday to see the buckets.",
                        }}
                    />
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                    <thead>
                        <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                            <th className="py-2 pr-3 font-semibold">Lender</th>
                            <th className="py-2 pr-3 font-semibold">Type</th>
                            <th className="py-2 pr-3 text-right font-semibold">Selected</th>
                            <th className="py-2 pr-3 text-right font-semibold">Success</th>
                            <th className="py-2 pr-3 text-right font-semibold">Reject</th>
                            <th className="py-2 pr-3 text-right font-semibold">Other</th>
                            <th className="py-2 pr-3 text-right font-semibold">Disbursed</th>
                            <th className="py-2 pr-3 text-right font-semibold">Disbursal %</th>
                            <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                            <th className="py-2 pr-3 text-right font-semibold">Speed</th>
                            <th className="py-2 text-right font-semibold">Quality axes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ranked.map((l) => <Row key={l.lenderName} l={l} />)}
                        {unranked.length > 0 && (
                            <tr className="bg-gray-50">
                                <td colSpan={11} className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Insufficient data ({unranked.length}) — unknown, not bad
                                </td>
                            </tr>
                        )}
                        {unranked.map((l) => <Row key={l.lenderName} l={l} muted />)}
                    </tbody>
                    {buckets && data?.totals && (
                        <tfoot>
                            <tr className="border-t-2 border-gray-200 font-semibold text-gray-800">
                                <td className="py-2 pr-3" colSpan={2}>Total</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(data.totals.selected)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(data.totals.successful)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(data.totals.rejected)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(data.totals.other)}</td>
                                <td colSpan={5} className="py-2" />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            <Note>
                <strong>No radar chart</strong>, deliberately: {data?.radarBlockedReason} Buckets are reused from{" "}
                <code className="rounded bg-gray-100 px-1">/all-lenders</code> (including its KreditBee exception) so the
                two pages reconcile rather than quietly disagree.
            </Note>
        </Card>
    );
};

export default LenderTable;
