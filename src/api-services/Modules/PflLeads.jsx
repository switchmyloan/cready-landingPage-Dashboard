import Api from "../api";

// PFL Leads — one row per MRN, read from ClickHouse webhook_data.pfl_webhook_events
// through the backend /pfl-leads routes. Counts-only (PFL has no amount data). Contact
// (phone/name/pan/email) is resolved by MRN from cibil_pi + offerLeads server-side.

export const getPflLeads = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status = '',
} = {}) => {
  return Api().get(`/pfl-leads/leads`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status },
    skipAdminAppend: true,
  });
};

// Per-MRN detail — contact + the full event timeline across the MRN's applications.
export const getPflLeadDetail = async (mrn) => {
  return Api().get(`/pfl-leads/lead/${encodeURIComponent(mrn)}`, {
    skipAdminAppend: true,
  });
};
