import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, RefreshCw } from "lucide-react";
import {
    getIntelligenceFilterOptions,
    getDataQuality,
} from "../../api-services/Modules/Intelligence";
import PremiumPageLoader from "../../components/PremiumPageLoader";
import ModuleInfoCard from "../../components/ModuleInfoCard";
import { Segmented, Note } from "./components/Shell";
import { MODULES, SECTIONS } from "./lib/constants";
// (clsx not needed here — sections use plain class strings)
import { dateForRange, RANGE_TOKENS, isCustomIncomplete } from "../../utils/dateForRange";

import TimeKpis from "./widgets/TimeKpis";
import CalendarHeatmap from "./widgets/CalendarHeatmap";
import HourHeatmap from "./widgets/HourHeatmap";
import BestSlotsTable from "./widgets/BestSlotsTable";
import DailyTrend from "./widgets/DailyTrend";
import PopulationPyramid from "./widgets/PopulationPyramid";
import AgeDecomposition from "./widgets/AgeDecomposition";
import LoanHistogram from "./widgets/LoanHistogram";
import MediumTable from "./widgets/MediumTable";
import CohortHeatmap from "./widgets/CohortHeatmap";
import { FunnelProgression, LagAnalysis } from "./widgets/FunnelAndLag";
import LenderTable from "./widgets/LenderTable";
import Recommendations from "./widgets/Recommendations";

// Intelligence — ONE sidebar tab, four modules switched in-page.
//
// The in-page module toggle is the AllLenders.jsx pattern (the newest code in the
// repo, which chose it over duplicated files). Everything here is additive: no
// existing page, service, or query is touched, so no existing module can regress.

const Intelligence = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [module, setModule] = useState(() => searchParams.get("module") || "high");
    const [section, setSection] = useState(() => searchParams.get("section") || "time");
    const [range, setRange] = useState(() => searchParams.get("range") || "90D");
    const [fromDate, setFromDate] = useState(() => searchParams.get("fromDate") || "");
    const [toDate, setToDate] = useState(() => searchParams.get("toDate") || "");
    const [utmMedium, setUtmMedium] = useState(() => searchParams.get("utmMedium") || "");
    const [utmSource, setUtmSource] = useState(() => searchParams.get("utmSource") || "");

    const [options, setOptions] = useState({ mediums: [], sources: [] });
    const [dq, setDq] = useState(null);
    const [firstLoad, setFirstLoad] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const cfg = useMemo(() => MODULES.find((m) => m.key === module) || MODULES[0], [module]);

    // Resolve the range token into the dates that appear in the URL. The backend
    // computes its own bounds, but keeping the params in sync makes the view
    // shareable — same rationale as DisbursalDashboard.
    useEffect(() => {
        const d = dateForRange(range);
        if (d) {
            setFromDate(d.fromDate);
            setToDate(d.toDate);
        }
    }, [range]);

    const customIncomplete = isCustomIncomplete(range, fromDate, toDate);

    // The single source of truth every widget reads. Widgets never own a copy of a
    // shared filter — the moment two widgets own overlapping state, they disagree
    // and the user cannot tell which is right.
    const filters = useMemo(
        () => ({
            scope: cfg.scope,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            utmMedium: utmMedium || undefined,
            utmSource: utmSource || undefined,
            _k: refreshKey,
        }),
        [cfg.scope, fromDate, toDate, utmMedium, utmSource, refreshKey]
    );

    // Keep the URL shareable.
    useEffect(() => {
        const p = { module, section, range };
        if (range === "Custom") {
            if (fromDate) p.fromDate = fromDate;
            if (toDate) p.toDate = toDate;
        }
        if (utmMedium) p.utmMedium = utmMedium;
        if (utmSource) p.utmSource = utmSource;
        setSearchParams(p, { replace: true });
    }, [module, section, range, fromDate, toDate, utmMedium, utmSource, setSearchParams]);

    useEffect(() => {
        const controller = new AbortController();
        getIntelligenceFilterOptions({ scope: cfg.scope, signal: controller.signal })
            .then((res) => {
                if (!controller.signal.aborted) setOptions(res?.data?.data || { mediums: [], sources: [] });
            })
            .catch(() => { /* filters degrade to free-form; not worth blocking on */ });
        return () => controller.abort();
    }, [cfg.scope]);

    // Data-quality gates drive what every widget is allowed to render.
    useEffect(() => {
        if (customIncomplete) return undefined;
        const controller = new AbortController();
        getDataQuality({ ...filters, signal: controller.signal })
            .then((res) => {
                if (!controller.signal.aborted) setDq(res?.data?.data || null);
            })
            .catch(() => {
                if (!controller.signal.aborted) setDq(null);
            })
            .finally(() => {
                if (!controller.signal.aborted) setFirstLoad(false);
            });
        return () => controller.abort();
    }, [filters, customIncomplete]);

    // The gate BANNERS are not rendered, but the gates themselves still drive the
    // UI: `blocked` is what hides metrics that aren't measurable (approval, age,
    // geography) from the metric selectors and tables, so a widget can't quietly
    // present a near-zero approval rate as a real one.
    const blocked = dq?.blocked || [];

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    // First load only. Subsequent refreshes use in-place skeletons + a spinning
    // icon, never the page loader.
    if (firstLoad) {
        return (
            <PremiumPageLoader
                theme={cfg.theme === "short" ? "sky" : "purple"}
                title="Loading Intelligence"
                brandLabel="Analytics Intelligence"
                icon={Brain}
                phrases={[
                    "Anchoring outcomes to acquisition…",
                    "Applying volume floors…",
                    "Checking data-quality gates…",
                ]}
                tiles={[{ label: "Best Day" }, { label: "Best Hour" }, { label: "Peak Conversion" }]}
                progressLabel="Crunching numbers"
            />
        );
    }

    return (
        <div className="space-y-4 p-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <Brain className="h-5 w-5 text-purple-600" />
                        Intelligence
                    </h1>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                        Acquisition-anchored analytics · outcomes attributed to the slot that acquired the user
                    </p>
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-semibold text-gray-700 transition hover:border-purple-400 hover:bg-purple-50"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                </button>
            </div>

            {/* Module switcher — one tab, four modules */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
                <span className="pl-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Module</span>
                <Segmented
                    size="md"
                    options={MODULES.map((m) => ({ key: m.key, label: m.label }))}
                    value={module}
                    onChange={setModule}
                />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Range</label>
                    <Segmented options={RANGE_TOKENS.map((r) => ({ key: r, label: r }))} value={range} onChange={setRange} />
                </div>

                {range === "Custom" && (
                    <>
                        <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">From</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="h-7 rounded-md border border-gray-300 px-2 text-[12px]"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">To</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="h-7 rounded-md border border-gray-300 px-2 text-[12px]"
                            />
                        </div>
                    </>
                )}

                <div className="basis-[150px]">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Medium</label>
                    <select
                        value={utmMedium}
                        onChange={(e) => setUtmMedium(e.target.value)}
                        className="h-7 w-full rounded-md border border-gray-300 px-1.5 text-[12px]"
                    >
                        <option value="">All</option>
                        {options.mediums.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="basis-[150px]">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Source</label>
                    <select
                        value={utmSource}
                        onChange={(e) => setUtmSource(e.target.value)}
                        className="h-7 w-full rounded-md border border-gray-300 px-1.5 text-[12px]"
                    >
                        <option value="">All</option>
                        {options.sources.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                {(utmMedium || utmSource) && (
                    <button
                        type="button"
                        onClick={() => { setUtmMedium(""); setUtmSource(""); }}
                        className="h-7 rounded-md border border-gray-300 bg-white px-2.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                    >
                        Clear
                    </button>
                )}
            </div>

            {customIncomplete && (
                <Note>Pick both a start and end date to load the custom range.</Note>
            )}

            {/* Data-quality gates. A widget whose gate fails renders a banner, not a
                confident number — a plausible-looking wrong number is worse than an
                honest gap, because it gets acted on. */}
            {/* Sections */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
                <Segmented
                    size="md"
                    options={SECTIONS.map((s) => ({ key: s.key, label: s.label }))}
                    value={section}
                    onChange={setSection}
                />
            </div>

            {customIncomplete ? null : (
                <div className="space-y-4">
                    {section === "time" && (
                        <>
                            <TimeKpis filters={filters} />
                            <CalendarHeatmap filters={filters} theme={cfg.theme} blocked={blocked} />
                            <HourHeatmap filters={filters} theme={cfg.theme} blocked={blocked} />
                            <BestSlotsTable filters={filters} blocked={blocked} />
                            <DailyTrend filters={filters} blocked={blocked} />
                        </>
                    )}

                    {section === "customer" && (
                        <>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <PopulationPyramid filters={filters} />
                                <LoanHistogram filters={filters} />
                            </div>
                            <AgeDecomposition filters={filters} blocked={blocked} />
                            <MediumTable filters={filters} />
                        </>
                    )}

                    {section === "cohort" && (
                        <>
                            <CohortHeatmap filters={filters} theme={cfg.theme} />
                            <div className="grid gap-4 lg:grid-cols-2">
                                <FunnelProgression filters={filters} blocked={blocked} />
                                <LagAnalysis filters={filters} />
                            </div>
                        </>
                    )}

                    {section === "lenders" && <LenderTable filters={filters} />}

                    {section === "recommendations" && <Recommendations filters={filters} />}
                </div>
            )}


            <ModuleInfoCard
                title="Intelligence"
                subtitle="Acquisition-anchored analytics across High Ticket, Short Ticket, Campaigns and Lenders."
                whatYouSee={[
                    "Time — when acquired traffic converts, by day, hour and day-part. Best Day / Best Hour / Peak Conversion are ranked on a 95% Wilson lower bound, so a lucky low-volume slot cannot win.",
                    "Customer — age, loan amount and medium. Age is computed at acquisition, never at now(), so historical charts stay reproducible.",
                    "Cohort — progression, lag and funnel. Blank heatmap cells are censored (that day has not happened yet), never zeros.",
                    "Lenders — the quality table. There is no radar: four of its seven axes have no source data.",
                    "Recommendations — directional, evidence-backed, max 5. Silence is a valid result.",
                ]}
                dataSource={[
                    "apply_new_draft_leads / short_apply_new_draft_leads — the acquisition anchor (first landing per phone).",
                    "offerLeads / shortOfferLeads — form submission, loan amount, income.",
                    "selectedLenders / shortSelectedLenders — lender clicks.",
                    "disbursment_may26_v2 — disbursals, deduped DISTINCT ON (phone10, lender) with the same attribution rule as the Disbursal Dashboard.",
                    "cready_landingpage_misstatus — MIS status. Coverage is low, so approval-based metrics are gated off rather than shown near-zero.",
                ]}
                flow={[
                    "Every metric anchors on the ACQUISITION slot, not the event slot — bucketing a disbursal by its own hour tells you when the lender's batch job ran, which you cannot buy traffic against.",
                    "The trailing MIS-lag window (measured P90 = 23 days) is excluded from every ranking. Without it, the engine recommends against recent traffic — it recommends buying the past.",
                    "Volume floors are applied before ranking AND before colour-scaling. Below-floor cells are hatched: unknown, not bad.",
                    "This module reads only. It shares no state with any other page, and no existing service or query was modified.",
                ]}
            />
        </div>
    );
};

export default Intelligence;
