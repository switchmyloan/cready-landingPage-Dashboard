import Api from "../api";

// LoanWalle affiliate webhook leads — reads the ClickHouse `webhook_data` DB via the
// backend /loanwalle-webhook-leads routes. Leads and disbursals are current-state
// lists; the lead detail returns the snapshot, disbursal and full event timeline.

export const getLwLeads = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status = '',
  medium = '',
  ticket = '',
} = {}) => {
  return Api().get(`/loanwalle-webhook-leads/leads`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status, medium, ticket },
    skipAdminAppend: true,
  });
};

// Medium dropdown + ticket counts for one ticket tab ('high' | 'short' | '' = all).
export const getLwLeadMediums = async ({ ticket = '' } = {}) => {
  return Api().get(`/loanwalle-webhook-leads/mediums`, {
    params: { ticket },
    skipAdminAppend: true,
  });
};

export const getLwDisbursals = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status = '',
  medium = '',
} = {}) => {
  return Api().get(`/loanwalle-webhook-leads/disbursals`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status, medium },
    skipAdminAppend: true,
  });
};

// UTM mediums for the Disbursals tab (counts are disbursals).
export const getLwDisbursalMediums = async () => {
  return Api().get(`/loanwalle-webhook-leads/disbursals/mediums`, {
    skipAdminAppend: true,
  });
};

export const getLwLeadDetail = async (trackingId) => {
  return Api().get(`/loanwalle-webhook-leads/lead/${encodeURIComponent(trackingId)}`, {
    skipAdminAppend: true,
  });
};
