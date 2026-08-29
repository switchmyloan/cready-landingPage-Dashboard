import Api from "../api";

// RamFinCorp funnel — read-only over the backend /ramfincorp-funnel routes
// (ClickHouse mis_db.raw_ramfincorp daily MIS snapshots, per-lead latest status).

export const getRamFinCorpFunnel = async ({ type, fromDate, toDate, scope } = {}) => {
  return Api().get(`/ramfincorp-funnel/funnel`, {
    params: { type, fromDate, toDate, scope },
    skipAdminAppend: true,
  });
};

export const getRamFinCorpStageLeads = async ({
  stage = "total",
  perPage = 10,
  currentPage = 1,
  search = "",
  type,
  fromDate,
  toDate,
  scope,
} = {}) => {
  return Api().get(`/ramfincorp-funnel/stage-leads`, {
    params: { stage, perPage, currentPage, search, type, fromDate, toDate, scope },
    skipAdminAppend: true,
  });
};

// Day-wise journey history — rows = push day, columns = stages reached
// (cumulative), mirroring the UpSwing funnel's table.
export const getRamFinCorpHistory = async ({ type, fromDate, toDate, scope } = {}) => {
  return Api().get(`/ramfincorp-funnel/history`, {
    params: { type, fromDate, toDate, scope },
    skipAdminAppend: true,
  });
};
