import Api from "../api";

// Vivifi (FlexSalary) webhook leads — reads the ClickHouse `webhook_data` DB via
// the backend /vivifi-webhook-leads routes. Applications & Loans are current-state
// snapshots; the detail endpoint returns the full webhook_events history for a lead.

export const getVivifiApplications = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status = '',
} = {}) => {
  return Api().get(`/vivifi-webhook-leads/applications`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status },
    skipAdminAppend: true,
  });
};

export const getVivifiLoans = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status = '',
} = {}) => {
  return Api().get(`/vivifi-webhook-leads/loans`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status },
    skipAdminAppend: true,
  });
};

// Combined detail (application + loan + full event timeline) for one lead.
export const getVivifiLeadDetail = async (leadId) => {
  return Api().get(`/vivifi-webhook-leads/lead/${encodeURIComponent(leadId)}`, {
    skipAdminAppend: true,
  });
};

// Just the webhook_events timeline for one lead.
export const getVivifiLeadEvents = async (leadId) => {
  return Api().get(`/vivifi-webhook-leads/events/${encodeURIComponent(leadId)}`, {
    skipAdminAppend: true,
  });
};

// Live "hot leads" (awaiting VKYC / e-Sign / e-Mandate / loan-chosen) — polled by the
// navbar alert bell. `agentId` scopes it to that call-center agent's OWN assigned
// leads (lead_assignments); omit (Super Admin) for all.
export const getVivifiHotLeadAlerts = async ({ agentId } = {}) => {
  return Api().get(`/vivifi-webhook-leads/hot-alerts`, {
    params: { agentId },
    skipAdminAppend: true,
  });
};
