import Api from "../api";

// UpSwing leads — reads the external UpSwing admin API through the backend
// /upswing-webhook routes (the admin key stays server-side). `events` returns one
// row per lead (aggregated across its webhook events); the detail endpoint returns
// a single lead looked up by its pci.

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
