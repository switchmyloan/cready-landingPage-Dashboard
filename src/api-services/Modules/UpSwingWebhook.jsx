import Api from "../api";

// UpSwing webhook events — reads the Postgres upswing_* tables via the backend
// /upswing-webhook routes. `events` is the append-only webhook diary (enriched with
// the lead MRN); the detail endpoint returns one event + its lead + the pci timeline.

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

// Combined detail (event + lead + full pci timeline + launch sessions) for one event.
export const getUpSwingEventDetail = async (id) => {
  return Api().get(`/upswing-webhook/event/${encodeURIComponent(id)}`, {
    skipAdminAppend: true,
  });
};
