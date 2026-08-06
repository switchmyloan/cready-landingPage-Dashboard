import Api from "../api";

// UpSwing leads — reads the ClickHouse `upswing` DB through the backend
// /upswing-webhook routes. `events` returns one row per pci (current journey stage +
// offer/disbursal figures from pci_latest_event); the detail endpoint returns that
// pci's snapshot plus its full webhook_events timeline.

export const getUpSwingEvents = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status = '',
} = {}) => {
  return Api().get(`/upswing-webhook/events`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status },
    skipAdminAppend: true,
  });
};

// Single lead detail, looked up by its pci (the row id).
export const getUpSwingEventDetail = async (id) => {
  return Api().get(`/upswing-webhook/event/${encodeURIComponent(id)}`, {
    skipAdminAppend: true,
  });
};

// Journey funnel — distinct leads per stage (from webhook_events) + outcomes,
// respecting the same date filter as the list.
export const getUpSwingFunnel = async ({ type, fromDate, toDate } = {}) => {
  return Api().get(`/upswing-webhook/funnel`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });
};

// Journey HISTORY funnel — each lead counted in every stage it ever reached
// (cumulative), from webhook_events. Same date filter as the list.
export const getUpSwingFunnelHistory = async ({ type, fromDate, toDate, medium } = {}) => {
  return Api().get(`/upswing-webhook/funnel-history`, {
    params: { type, fromDate, toDate, medium },
    skipAdminAppend: true,
  });
};

// Recent BANK_OFFER_AVAILABLE leads — polled by the navbar alert bell.
export const getUpSwingBankOfferAlerts = async () => {
  return Api().get(`/upswing-webhook/bank-offer-alerts`, {
    skipAdminAppend: true,
  });
};
