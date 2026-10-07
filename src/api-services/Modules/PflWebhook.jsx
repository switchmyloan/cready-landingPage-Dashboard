import Api from "../api";

// PFL (Poonawalla Fincorp) journey funnel — reads the ClickHouse
// webhook_data.pfl_webhook_events diary through the backend /pfl-funnel routes.
// Mirrors the UpSwing funnel API, minus the Redirected / Medium params (PFL's feed
// carries no phone / utm_medium).

// Journey HISTORY funnel — each lead counted in every stage it ever reached
// (cumulative), bucketed on its first-arrival day.
export const getPflFunnelHistory = async ({ type, fromDate, toDate } = {}) => {
  return Api().get(`/pfl-funnel/funnel-history`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });
};

// The "by event day" funnel — each event counted on the day it happened.
export const getPflFunnelHistoryByEvent = async ({ type, fromDate, toDate } = {}) => {
  return Api().get(`/pfl-funnel/funnel-history-by-event`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });
};

// Drill-down: current status of leads who reached ONE funnel stage. `day` scopes it
// to one matrix cell; omit it for the overall (range).
export const getPflFunnelStageStatus = async ({ stage, type, fromDate, toDate, day } = {}) => {
  return Api().get(`/pfl-funnel/funnel-stage-status`, {
    params: { stage, type, fromDate, toDate, day },
    skipAdminAppend: true,
  });
};

// Deeper drill: the actual leads (reference + application no) behind ONE status of
// that breakdown.
export const getPflFunnelStageLeads = async ({ stage, status, type, fromDate, toDate, day } = {}) => {
  return Api().get(`/pfl-funnel/funnel-stage-status-leads`, {
    params: { stage, status, type, fromDate, toDate, day },
    skipAdminAppend: true,
  });
};

// Drill for the by-event-day matrix: the actual leads who fired ONE event on ONE day.
// Omit `day` for the event's whole range (header/footer click).
export const getPflFunnelEventDayLeads = async ({ event, type, fromDate, toDate, day } = {}) => {
  return Api().get(`/pfl-funnel/funnel-event-day-leads`, {
    params: { event, type, fromDate, toDate, day },
    skipAdminAppend: true,
  });
};
