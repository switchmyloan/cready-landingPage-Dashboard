import React, { useEffect, useState } from "react";
import { CalendarDays, Clock, Target } from "lucide-react";
import { getTimeKpis, getSlotPerformance } from "../../../api-services/Modules/Intelligence";
import { Skeleton, NValue } from "../components/Shell";
import { DOW_FULL } from "../lib/constants";
import { clsx, fmtPct, fmtDelta, hourLabel } from "../lib/format";

// The three headline KPIs: Best Day · Best Hour · Peak Conversion.
//
// Each carries its own volume floor and its sample size. A KPI without its
// denominator is not a fact — 100% on 3 leads and 4% on 12,000 both render as a
// number, and only one of them means anything.

const Tile = (props) => {
    // Assigned to a local rather than destructured-and-renamed in the param list:
    // eslint's jsx-uses-vars doesn't mark renamed params as used, so `icon: Icon`
    // trips no-unused-vars even though it renders.
    const Icon = props.icon;
    const { label, value, sub, delta, n, muted, empty } = props;

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
                    <Icon className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
            </div>

            {empty ? (
                // Saying "we don't know yet" is a feature. Naming a lucky cell is not.
                <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{empty}</p>
            ) : (
                <>
                    <p className={clsx("mt-2.5 text-xl font-semibold tabular-nums", muted ? "text-gray-400" : "text-gray-900")}>
                        {value}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-500">{sub}</span>
                        {delta != null && (
                            <span
                                className={clsx(
                                    "text-[11px] font-medium tabular-nums",
                                    delta >= 0 ? "text-violet-600" : "text-red-600"
                                )}
                            >
                                {delta >= 0 ? "▲" : "▼"} {fmtDelta(delta)}
                            </span>
                        )}
                    </div>
                    {n != null && <NValue n={n} className="mt-1 block" />}
                </>
            )}
        </div>
    );
};

const TimeKpis = ({ filters }) => {
    const [kpis, setKpis] = useState(null);
    const [slots, setSlots] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        Promise.all([
            getTimeKpis({ ...filters, metric: "conversion", signal: controller.signal }),
            getSlotPerformance({ ...filters, metric: "conversion", signal: controller.signal }),
        ])
            .then(([k, s]) => {
                if (!controller.signal.aborted) {
                    setKpis(k?.data?.data || null);
                    setSlots(s?.data?.data || null);
                }
            })
            .catch(() => { /* tiles render their own empty state */ })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [filters]);

    if (loading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-3 h-6 w-32" />
                        <Skeleton className="mt-2 h-3 w-20" />
                    </div>
                ))}
            </div>
        );
    }

    const bd = kpis?.bestDay;
    const bh = kpis?.bestHour;
    const peak = slots?.peak;

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile
                icon={CalendarDays}
                label="Best Day"
                value={bd ? DOW_FULL[bd.dow] : "—"}
                sub={bd ? `${fmtPct(bd.value)} disbursal rate` : ""}
                delta={bd?.vsGrandMean}
                n={bd?.n}
                empty={!bd && `No day cleared the ${kpis?.floors?.day ?? 200}-session floor in this window.`}
            />
            <Tile
                icon={Clock}
                label="Best Hour"
                value={bh ? hourLabel(bh.hod) : "—"}
                sub={bh ? `${fmtPct(bh.value)} disbursal rate` : ""}
                delta={bh?.vsGrandMean}
                n={bh?.n}
                empty={!bh && `No hour cleared the ${kpis?.floors?.hour ?? 50}-session floor in this window.`}
            />
            <Tile
                icon={Target}
                label="Peak Conversion"
                value={peak ? peak.label : "—"}
                sub={peak ? `${fmtPct(peak.value)} · LB ${fmtPct(peak.wilsonLb || 0)}` : ""}
                delta={peak?.vsGrandMean}
                n={peak?.landed}
                // With 168 cells the multiple-comparisons risk is severe, so a cell
                // is only named if its 95% lower bound beats the grand mean.
                empty={!peak && "No statistically peak slot in this window — no cell beat the grand mean on its 95% lower bound."}
            />
        </div>
    );
};

export default TimeKpis;
