import Api from "../api";

// ---------- Campaign ----------
// Dedicated endpoints for the Campaign team view. Campaign was previously a
// frontend replica of Cready RPM that reused the /cready-rpm endpoints; it now
// has its own /campaign/* backend because the requirements diverge (different
// data source/table, funnel stages, filters, and table/detail columns).
// Shapes mirror cready-rpm so the existing Campaign pages keep working.

const base = `/campaign`;

export const getCampaign = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  stage,
  medium,
  source,
  feedbackStatus,
  lender,
} = {}) => {
    return Api().get(base, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            stage,
            medium,
            source,
            feedbackStatus,
            lender,
        },
        skipAdminAppend: true,
    });
};

export const getCampaignDistinctMediums = async () => {
    return Api().get(`${base}/distinct-mediums`, {
        skipAdminAppend: true,
    });
};

export const getCampaignDetail = async ({ phone } = {}) => {
    return Api().get(`${base}/detail`, {
        params: { phone },
        skipAdminAppend: true,
    });
};

// Drill-down: raw campaignportal_campaigns rows for one (entity, lander) within
// the dashboard's date scope (today / yesterday / custom range / all).
export const getCampaignPortalDetail = async ({ entity, lander, type, fromDate, toDate } = {}) => {
    return Api().get(`${base}/portal-detail`, {
        params: { entity, lander, type, fromDate, toDate },
        skipAdminAppend: true,
    });
};
