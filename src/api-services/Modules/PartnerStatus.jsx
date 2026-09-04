import Api from "../api";

// Per-partner lead status — Toofan / RupeeRaftaar / Tejas / F1. All four share
// one ClickHouse schema, so one endpoint serves them via `partner`.

export const getPartnerStatusLeads = async ({
  partner,
  search = "",
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status,
  disbursedOn,
  disbursedFrom,
  disbursedTo,
} = {}) => {
  return Api().get(`/partner-status/leads`, {
    params: { partner, search, perPage, currentPage, type, fromDate, toDate, status,
              disbursedOn, disbursedFrom, disbursedTo },
    skipAdminAppend: true,
  });
};

export const getPartnerStatusPartners = async () => {
  return Api().get(`/partner-status/partners`, { skipAdminAppend: true });
};
