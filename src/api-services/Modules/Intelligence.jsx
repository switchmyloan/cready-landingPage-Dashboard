import Api from "../api";

// Intelligence module API.
//
// Every call passes `skipAdminAppend: true` — without it the request interceptor
// rewrites /intelligence/time/kpis to /intelligence/time/kpis/admin and the route
// match breaks. Every call accepts `signal` so the caller can abort on filter
// change (stale responses overwriting fresh ones is the classic dashboard bug).

const base = "/intelligence";

// The filter bundle every endpoint shares.
const params = ({
    scope = "high",
    type,
    fromDate,
    toDate,
    utmMedium,
    utmSource,
    utmCampaign,
    metric,
    days,
    excludeLag,
} = {}) => ({
    scope,
    type,
    fromDate,
    toDate,
    utmMedium,
    utmSource,
    utmCampaign,
    metric,
    days,
    excludeLag,
});

const get = (path, p = {}, extra = {}) =>
    Api().get(`${base}${path}`, {
        params: { ...params(p), ...extra },
        skipAdminAppend: true,
        signal: p.signal,
    });

// ── Time Intelligence ────────────────────────────────────────────────────────
export const getTimeKpis = (p) => get("/time/kpis", p);
export const getDailyPerformance = (p) => get("/time/daily", p);
export const getSlotPerformance = (p) => get("/time/slots", p);
export const getBestSlots = (p) => get("/time/best-slots", p);
export const getDayparts = (p) => get("/time/dayparts", p);
export const getWeekdayWeekend = (p) => get("/time/weekday-weekend", p);
export const getSpikes = (p) => get("/time/spikes", p);

// ── Customer Intelligence ────────────────────────────────────────────────────
export const getAgeAnalysis = (p) => get("/customer/age", p);
export const getPyramid = (p) => get("/customer/pyramid", p, { split: p?.split });
export const getLoanAnalysis = (p) => get("/customer/loan", p);
export const getIncomeAnalysis = (p) => get("/customer/income", p);
export const getMediumDisbursal = (p) => get("/customer/medium", p, { dimension: p?.dimension });

// ── Cohort Intelligence ──────────────────────────────────────────────────────
export const getCohortHeatmap = (p) =>
    get("/cohort/heatmap", p, { grain: p?.grain, stage: p?.stage, maxDay: p?.maxDay });
export const getFunnelProgression = (p) => get("/cohort/funnel", p);
export const getLagAnalysis = (p) => get("/cohort/lag", p);
export const getRevisitAnalysis = (p) => get("/cohort/revisit", p);
export const getGraduation = (p) => get("/cohort/graduation", p, { months: p?.months });

// ── Lenders ──────────────────────────────────────────────────────────────────
export const getLenderQuality = (p) => get("/lenders", p);

// ── Recommendations + meta ───────────────────────────────────────────────────
export const getRecommendations = (p) => get("/recommendations", p);
export const getDataQuality = (p) => get("/data-quality", p);
export const getIntelligenceFilterOptions = (p) => get("/filter-options", p);
