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

// RF Dashboard — one row per day: dedupe checked -> pass -> lender selected ->
// offer received, each % measured against the stage before it, plus offer money.
// `countBy` picks which day a number lands on ('create' | 'event').
export const getRamFinCorpHistory = async ({ type, fromDate, toDate, scope, countBy, utmMedium } = {}) => {
  return Api().get(`/ramfincorp-funnel/history`, {
    params: { type, fromDate, toDate, scope, countBy, utmMedium },
    skipAdminAppend: true,
  });
};

export const getRamFinCorpUtmMediums = async ({ scope } = {}) => {
  return Api().get(`/ramfincorp-funnel/utm-mediums`, {
    params: { scope },
    skipAdminAppend: true,
  });
};
