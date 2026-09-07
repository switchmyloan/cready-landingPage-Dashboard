import Api from "../api";

// Vivifi funnel — cohort journey rebuilt from webhook_data.webhook_events.

export const getVivifiFunnel = async ({ type, fromDate, toDate, countBy } = {}) =>
  Api().get(`/vivifi-funnel/funnel`, {
    params: { type, fromDate, toDate, countBy },
    skipAdminAppend: true,
  });

export const getVivifiFunnelHistory = async ({ type, fromDate, toDate, countBy } = {}) =>
  Api().get(`/vivifi-funnel/history`, {
    params: { type, fromDate, toDate, countBy },
    skipAdminAppend: true,
  });

export const getVivifiStageLeads = async ({
  rank,
  currentStatus,
  perPage = 20,
  currentPage = 1,
  search = "",
  type,
  fromDate,
  toDate,
} = {}) =>
  Api().get(`/vivifi-funnel/stage-leads`, {
    params: { rank, currentStatus, perPage, currentPage, search, type, fromDate, toDate },
    skipAdminAppend: true,
  });
