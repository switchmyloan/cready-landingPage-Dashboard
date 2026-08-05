import Api from "../api";

// Apollo leads — reads the ClickHouse `apollo_webhook` DB through the backend
// /apollo-webhook routes. `events` returns one row per loan_id (current journey stage
// from apollo_events_latest); the detail endpoint returns that loan's snapshot plus its
// full apollo_events timeline + commission/disbursal rows; funnel-history is the
// cumulative journey funnel from apollo_events.

export const getApolloEvents = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status = '',
} = {}) => {
  return Api().get(`/apollo-webhook/events`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status },
    skipAdminAppend: true,
  });
};

// Single lead detail, looked up by its loan_id (the row id).
export const getApolloEventDetail = async (id) => {
  return Api().get(`/apollo-webhook/event/${encodeURIComponent(id)}`, {
    skipAdminAppend: true,
  });
};

// Journey HISTORY funnel — each loan counted in every stage it ever reached
// (cumulative), from apollo_events, plus disbursed ₹. Same date filter as the list.
export const getApolloFunnelHistory = async ({ type, fromDate, toDate } = {}) => {
  return Api().get(`/apollo-webhook/funnel-history`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });
};
