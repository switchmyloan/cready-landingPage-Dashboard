import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { getRecommendations } from "../../../api-services/Modules/Intelligence";
import { Card, RefreshButton, Note, ProxyChip, Skeleton } from "../components/Shell";
import { clsx, fmtNum, fmtPct, fmtValue, fmtDelta, tierChip } from "../lib/format";

// Recommendation cards.
//
// Evidence is EXPANDED BY DEFAULT, never behind a click. Hiding it means nobody
// reads it, and an unread recommendation is either ignored or followed blindly.
// The evidence IS the product; the headline is just its index.
//
// Defined at module scope so a refetch doesn't remount and collapse the signals
// panel (the AllLenders.jsx DistributionBanner lesson).

const TYPE_LABEL = {
    BOOST_SLOT: "BOOST_SLOT",
    REMARKETING_PUSH: "REMARKETING_PUSH",
    SHIFT_DAYPART: "SHIFT_DAYPART",
    SHIFT_MEDIUM: "SHIFT_MEDIUM",
    BD_ACTION: "BD_ACTION",
    INVESTIGATE: "INVESTIGATE",
    INVEST_ORGANIC: "INVEST_ORGANIC",
};

// Types that are deliberately NOT budget levers. An engine that answered a supply
// gap, an outage, and a fraud signal all with "reduce spend" would be confidently
// wrong three different ways.
const NON_BUDGET = new Set(["BD_ACTION", "INVESTIGATE", "REMARKETING_PUSH"]);

const EvidenceRow = ({ label, value }) => (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-gray-500">{label}</span>
        <span className="tabular-nums font-medium text-gray-800">{value}</span>
    </div>
);

const RecommendationCard = ({ r }) => {
    const ev = r.evidence || {};
    const sample = ev.sample || {};

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Tier + type */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2">
                <span className={clsx("rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", tierChip(r.tier))}>
                    {r.tier} confidence
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
                    {TYPE_LABEL[r.type] || r.type}
                </span>
            </div>

            <div className="px-4 py-3">
                {/* Verb-first headline. "Increase investment", never "Monday 9 PM is good". */}
                <h4 className="text-[13px] font-semibold leading-snug text-gray-900">{r.headline}</h4>
                <p className="mt-0.5 text-[10px] text-gray-400">
                    {r.signal}
                    {NON_BUDGET.has(r.type) && " · not a budget lever"}
                </p>

                {/* Plain language, numbers inline, no jargon. */}
                <p className="mt-2 text-[11.5px] leading-relaxed text-gray-600">{r.why}</p>

                {/* Corroboration. Several signals agreeing makes a recommendation
                    stronger — showing that beats printing the same slot 3 times. */}
                {(r.corroboratedBy || []).length > 0 && (
                    <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/60 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold text-violet-800">
                            Corroborated by {r.corroboratedBy.length} other signal{r.corroboratedBy.length > 1 ? "s" : ""}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-violet-700">
                            {r.corroboratedBy.map((c) => c.signal).join(" · ")} — independent metrics picked the same slot.
                        </p>
                    </div>
                )}

                {/* Evidence — always expanded. */}
                <div className="mt-2.5 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Evidence</p>
                    <div className="space-y-0.5">
                        {ev.value != null && (
                            <EvidenceRow label={ev.metric || "Value"} value={fmtValue(ev.value, ev.metricKind)} />
                        )}
                        {ev.wilsonLb != null && <EvidenceRow label="95% lower bound" value={fmtPct(ev.wilsonLb)} />}
                        {ev.grandMean != null && <EvidenceRow label="Grand mean" value={fmtValue(ev.grandMean, ev.metricKind)} />}
                        {ev.vsGrandMean != null && (
                            <EvidenceRow
                                label="vs mean"
                                value={
                                    <span className={ev.vsGrandMean >= 0 ? "text-violet-600" : "text-red-600"}>
                                        {fmtDelta(ev.vsGrandMean, 0)}
                                    </span>
                                }
                            />
                        )}
                        {sample.landed != null && <EvidenceRow label="Sample" value={`${fmtNum(sample.landed)} landed · ${fmtNum(sample.disbursed || 0)} disbursed`} />}
                        {ev.confidence?.n != null && sample.landed == null && (
                            <EvidenceRow label="Sample" value={`n=${fmtNum(ev.confidence.n)}`} />
                        )}
                        {ev.window && <EvidenceRow label="Window" value={ev.window} />}
                        {ev.zTraffic != null && <EvidenceRow label="z (traffic)" value={ev.zTraffic} />}
                        {ev.zConversion != null && <EvidenceRow label="z (conversion)" value={ev.zConversion} />}
                        {ev.pValue != null && <EvidenceRow label="p-value" value={ev.pValue} />}
                    </div>
                </div>

                {/* The risk. Never buried. */}
                {r.caveat && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5">
                        <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        <p className="text-[10.5px] leading-relaxed text-amber-800">{r.caveat}</p>
                    </div>
                )}

                {/* The gap, named. More useful than a fabricated rupee figure. */}
                {r.spendNote && (
                    <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-gray-400">
                        <span>⚠️</span>
                        <span>{r.spendNote}</span>
                    </p>
                )}

                {r.proxy && (
                    <div className="mt-2">
                        <ProxyChip title={r.caveat} />
                    </div>
                )}
            </div>
        </div>
    );
};

const Recommendations = ({ filters }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSignals, setShowSignals] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getRecommendations({ ...filters, signal: controller.signal })
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

    const recs = data?.recommendations || [];
    const signals = data?.signals || [];

    if (loading) {
        return (
            <div className="grid gap-3 lg:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="mt-3 h-5 w-3/4" />
                        <Skeleton className="mt-2 h-12 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
                <p className="text-[11px] leading-relaxed text-violet-900">
                    <strong>This is a performance engine, not a budget engine.</strong> {data?.engineNote}
                </p>
            </div>

            {error ? (
                <Card title="Recommendations" error={error} />
            ) : recs.length === 0 ? (
                // A designed, explained empty state. An engine that never says
                // "nothing" is fitting noise — making silence explicit is what makes
                // the non-silent weeks credible.
                <Card title="Recommendations" subtitle="No action recommended this window">
                    <div className="py-6 text-center">
                        <p className="text-[13px] font-medium text-gray-700">No recommendations this window.</p>
                        <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-gray-500">
                            {data?.emptyState || `${data?.evaluated || 0} signals evaluated, none cleared the confidence bar.`}
                        </p>
                        <p className="mt-2 text-[10.5px] italic text-gray-400">This is a normal result.</p>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {recs.map((r, i) => (
                        <RecommendationCard key={`${r.type}-${i}`} r={r} />
                    ))}
                </div>
            )}

            {/* "Why we didn't recommend X" — pre-empts the "this is broken, it
                missed the obvious slot" reaction by showing the engine withholds ON
                PRINCIPLE rather than missing things. */}
            {signals.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowSignals((s) => !s)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                    >
                        <span className="text-[12px] font-semibold text-gray-700">
                            Why we didn't recommend these ({signals.length})
                        </span>
                        {showSignals ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                    </button>
                    {showSignals && (
                        <div className="border-t border-gray-100 px-4 py-2.5">
                            <div className="space-y-1.5">
                                {signals.map((s, i) => (
                                    <div key={i} className="flex items-baseline gap-2 text-[11px]">
                                        <span className="font-mono text-[9px] uppercase text-gray-400">{s.category}</span>
                                        <span className="font-medium text-gray-700">{s.signal}</span>
                                        <span className="text-gray-500">— {s.reason}</span>
                                    </div>
                                ))}
                            </div>
                            <Note>
                                A withheld recommendation is more trustworthy than a hedged one. Low-confidence findings
                                appear here rather than as cards, because surfacing them as recommendations would train
                                you to ignore the confidence chip — at which point "High" would mean nothing either.
                            </Note>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Recommendations;
