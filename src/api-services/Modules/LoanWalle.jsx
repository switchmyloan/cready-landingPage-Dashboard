import Api from "../api";

// LoanWalle — read-only over ClickHouse webhook_data.loanwalle_latest
// (one row per lead, carrying its current partner status).

export const getLoanWalleLeads = async ({
  search = "",
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status,
  ticket,
  utmMedium,
  partnerName,
  disbursedOn,
  disbursedFrom,
  disbursedTo,
} = {}) => {
  return Api().get(`/loanwalle/leads`, {
    params: { search, perPage, currentPage, type, fromDate, toDate, status, ticket, utmMedium, partnerName, disbursedOn, disbursedFrom, disbursedTo },
    skipAdminAppend: true,
  });
};

export const getLoanWalleTypes = async () => {
  return Api().get(`/loanwalle/types`, { skipAdminAppend: true });
};

export const getLoanWalleMediums = async () => {
  return Api().get(`/loanwalle/mediums`, { skipAdminAppend: true });
};

export const getLoanWallePartners = async () => {
  return Api().get(`/loanwalle/partners`, { skipAdminAppend: true });
};

export const getLoanWalleLeadDetail = async (mobile) => {
  return Api().get(`/loanwalle/lead/${encodeURIComponent(mobile)}`, { skipAdminAppend: true });
};
