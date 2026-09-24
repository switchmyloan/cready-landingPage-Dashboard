import Api from "../api";

// QuickMoney funnel — read-only over the backend /quickmoney-funnel routes, which
// read the separate QuickMoney_internal DB (public.v_total_application_report).
// Flow: UTM lead sent -> Assessment Fee paid -> Disbursed.

export const getQuickMoneyFunnel = async ({ fromDate, toDate, medium } = {}) =>
  Api().get(`/quickmoney-funnel/funnel`, {
    params: { fromDate, toDate, medium },
    skipAdminAppend: true,
  });

// Drill-down: the leads behind a stage tile (sent / af_paid / disbursed / rejected).
export const getQuickMoneyStageLeads = async ({
  stage,
  medium,
  fromDate,
  toDate,
  search = "",
  perPage = 20,
  currentPage = 1,
} = {}) =>
  Api().get(`/quickmoney-funnel/stage-leads`, {
    params: { stage, medium, fromDate, toDate, search, perPage, currentPage },
    skipAdminAppend: true,
  });
