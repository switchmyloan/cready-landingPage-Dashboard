import Api from "../api";

// SmartCoin funnel — Pushed → Dedupe Passed → Lender Selected → Disbursed,
// reconstructed from offerLeads + selectedLenders + the disbursal table.

export const getSmartCoinFunnel = async ({ type, fromDate, toDate, medium } = {}) =>
  Api().get(`/smartcoin-funnel/funnel`, {
    params: { type, fromDate, toDate, medium },
    skipAdminAppend: true,
  });

export const getSmartCoinFunnelHistory = async ({ type, fromDate, toDate, medium } = {}) =>
  Api().get(`/smartcoin-funnel/history`, {
    params: { type, fromDate, toDate, medium },
    skipAdminAppend: true,
  });

// The utm_medium values present in this era — the filter dropdown's options.
export const getSmartCoinUtmMediums = async () =>
  Api().get(`/smartcoin-funnel/utm-mediums`, { skipAdminAppend: true });

export const getSmartCoinStageLeads = async ({
  stage,
  perPage = 20,
  currentPage = 1,
  search = "",
  type,
  fromDate,
  toDate,
  medium,
} = {}) =>
  Api().get(`/smartcoin-funnel/stage-leads`, {
    params: { stage, perPage, currentPage, search, type, fromDate, toDate, medium },
    skipAdminAppend: true,
  });
