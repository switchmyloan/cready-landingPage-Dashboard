import Api from "../api";

// Vivifi funnel — cohort journey rebuilt from webhook_data.webhook_events.

export const getVivifiFunnel = async ({ type, fromDate, toDate } = {}) =>
  Api().get(`/vivifi-funnel/funnel`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });

export const getVivifiFunnelHistory = async ({ type, fromDate, toDate } = {}) =>
  Api().get(`/vivifi-funnel/history`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });

// BY EVENT DAY: each event counted on the day it happened (not cumulative).
export const getVivifiFunnelHistoryByEvent = async ({ type, fromDate, toDate } = {}) =>
  Api().get(`/vivifi-funnel/history-by-event`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });

// Drill "where are they now": of the leads that reached one rung (whole range, or
// one first-arrival `day`), their current-status distribution.
export const getVivifiFunnelStageStatus = async ({ stage, day, type, fromDate, toDate } = {}) =>
  Api().get(`/vivifi-funnel/funnel-stage-status`, {
    params: { stage, day, type, fromDate, toDate },
    skipAdminAppend: true,
  });

export const getVivifiStageLeads = async ({
  status,
  perPage = 20,
  currentPage = 1,
  search = "",
  type,
  fromDate,
  toDate,
} = {}) =>
  Api().get(`/vivifi-funnel/stage-leads`, {
    params: { status, perPage, currentPage, search, type, fromDate, toDate },
    skipAdminAppend: true,
  });
