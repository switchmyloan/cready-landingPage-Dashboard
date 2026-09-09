import Api from "../api";

// Four independent sections so the dashboard loads progressively — the shell and
// KPIs must never wait on the heavier lender/insight analytics.
const base = `/selected-lenders-comparison`;
const call = (path) => async (params = {}) => {
  const { scope, mode, asOf, from, to } = params;
  return Api().get(`${base}${path}`, { params: { scope, mode, asOf, from, to }, skipAdminAppend: true });
};

export const getSLCSummary = call("/summary");   // stage 2 — priority KPIs
export const getSLCTrend = call("/trend");       // stage 3 — chart
export const getSLCLenders = call("/lenders");   // stage 3 — table / share / contribution
export const getSLCInsights = call("/insights"); // stage 4 — insights + anomalies
