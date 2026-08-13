import Api from "../api";


export const getLeads = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  status = ''
} = {}) => {
    return Api().get(`/leads`, {
        params: {
            currentPage,
            perPage,
            type,
            fromDate,
            toDate,
            status,
            search,
        },
        skipAdminAppend: true,
    });
};
export const getBusinessLoans = async (pageNo, limit, globalFilter) => {
    return Api().get(`/leads/business-loan`,
        {
            skipAdminAppend: true,
        }
    )
};
export const getMviIVRLogs = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  status = ''
}) => {
  return Api().get(`/leads/mv-success-lead`, {
    params: {
      type,
      fromDate,               // optional
      toDate,                 // optional
      search,                 // search term
      perPage,                // number of records per page
      currentPage,            // page number
      status                  // status filter: success, reject, duplicate
    },
    skipAdminAppend: true,
  });
};
export const getKBLogs = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  status = ''
}) => {
  return Api().get(`/leads/kb-success-leads`, {
    params: {
      type,
      fromDate,               // optional
      toDate,                 // optional
      search,                 // search term
      perPage,                // number of records per page
      currentPage,            // page number
      status                  // status filter: success, reject, duplicate
    },
    skipAdminAppend: true,
  });
};
export const getKBMumbaiLogs = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  status = ''
}) => {
  return Api().get(`/leads/kb-success-leads-mumbai`, {
    params: {
      type,
      fromDate,               // optional
      toDate,                 // optional
      search,                 // search term
      perPage,                // number of records per page
      currentPage,            // page number
      status                  // status filter: success, reject, duplicate
    },
    skipAdminAppend: true,
  });
};
export const getKBBangloreLogs = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  status = ''
}) => {
  return Api().get(`/leads/kb-success-leads-banglore`, {
    params: {
      type,
      fromDate,               // optional
      toDate,                 // optional
      search,                 // search term
      perPage,                // number of records per page
      currentPage,            // page number
      status                  // status filter: success, reject, duplicate
    },
    skipAdminAppend: true,
  });
};
export const getCRZypeSuccessLeads = async () => {
    return Api().get(`/leads/cr-zype-success-leads`,
        {
            skipAdminAppend: true,
        }
    )
};
export const getInAppLeads = async (pageNo, limit, globalFilter) => {
    return Api().get(`/leads/admin/in-app-leads?currentPage=${pageNo}&perPage=${limit}&search=${globalFilter}`,
        {
            skipAdminAppend: true,
        }
    )
};

export const getOfferLeads = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  minLoanAmount,
  maxLoanAmount,
  dobFromDate,
  dobToDate,
  loanPurpose,
  minMonthlyIncome,
  maxMonthlyIncome,
  lender,
  disbStatus,
  city,
  employmentType,
  utmMedium,
  utmSource,
  feedbackStatus,
  distinct,
  trackingEvent,
  lntActivity,
  agentId,
  hotLeads,
} = {}) => {
    return Api().get(`/offer-leads`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            minLoanAmount,
            maxLoanAmount,
            dobFromDate,
            dobToDate,
            loanPurpose,
            minMonthlyIncome,
            maxMonthlyIncome,
            lender,
            disbStatus,
            city,
            employmentType,
            utmMedium,
            utmSource,
            feedbackStatus,
            distinct,
            trackingEvent,
            lntActivity,
            // Persisted call-center assignment: agentId filters the list to the
            // leads assigned to this agent (lead_assignments). hotLeads is the
            // hot-leads flag.
            agentId,
            hotLeads,
        },
        skipAdminAppend: true,
    });
};

export const getMvSuccessOfferLeads = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status,
} = {}) => {
    return Api().get(`/offer-leads/mv-success`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            status,
        },
        skipAdminAppend: true,
    });
};

// New: pulls MV-success rows from offerLeads using response_track.MoneyView.
// Used by the MV Success Leads page; old getMvSuccessOfferLeads (mvSuccessLeads
// table) stays available for any other caller that needs it.
export const getMvSuccessFromOfferLeads = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status,
  utmMedium,
  utmSource,
  scope,
} = {}) => {
    return Api().get(`/offer-leads/mv-success-track`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            status,
            utmMedium,
            utmSource,
            scope,
        },
        skipAdminAppend: true,
    });
};

// SC Response Leads — SmartCoin status classified straight from
// lender_response.smartCoin (every SmartCoin response, not just Apply clicks).
// Powers the "SC Response Leads" page under the Lenders menu.
export const getScResponseLeads = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  status,
  utmMedium,
  utmSource,
} = {}) => {
    return Api().get(`/offer-leads/sc-response`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            status,
            utmMedium,
            utmSource,
        },
        skipAdminAppend: true,
    });
};

export const getOfferLeadsLenderKeys = async () => {
    return Api().get(`/offer-leads/lender-keys`, {
        skipAdminAppend: true,
    });
};

export const getOfferLeadsFilterValues = async () => {
    return Api().get(`/offer-leads/filter-values`, {
        skipAdminAppend: true,
    });
};

export const getOfferLeadsLenderStats = async ({
  type,
  fromDate,
  toDate,
  utmMedium,
} = {}) => {
    return Api().get(`/offer-leads/lender-stats`, {
        params: {
            type,
            fromDate,
            toDate,
            utmMedium,
        },
        skipAdminAppend: true,
    });
};

export const getSelectedLenders = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  lenderName,
  status,
  utmMedium,
  utmSource,
  minMonthlyIncome,
  maxMonthlyIncome,
  minLoanAmount,
  feedbackStatus,
} = {}) => {
    return Api().get(`/selected-lenders`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            lenderName,
            status,
            utmMedium,
            utmSource,
            minMonthlyIncome,
            maxMonthlyIncome,
            minLoanAmount,
            feedbackStatus,
        },
        skipAdminAppend: true,
    });
};

export const getHighMisFunnel = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  misStatus,
} = {}) => {
    return Api().get(`/high-mis-funnel`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            misStatus,
        },
        skipAdminAppend: true,
    });
};

export const getDistinctLenders = async () => {
    return Api().get(`/selected-lenders/distinct-lenders`, {
        skipAdminAppend: true,
    });
};

export const getSelectedLendersByPhone = async (phone) => {
    return Api().get(`/selected-lenders/by-phone/${encodeURIComponent(phone)}`, {
        skipAdminAppend: true,
    });
};

// All Lenders — one aggregate row per lender (selected / successful / rejected /
// other). Returns the whole set in one shot; there's no pagination because the
// lender list is small (tens of rows, not thousands).
// scope: 'high' | 'short' — picks the ticket type (selectedLenders+offerLeads vs
// shortSelectedLenders+shortOfferLeads). Omitted → backend defaults to 'high'.
export const getAllLendersStats = async ({
  type,
  fromDate,
  toDate,
  utmMedium,
  utmSource,
  scope,
} = {}) => {
    return Api().get(`/all-lenders`, {
        params: { type, fromDate, toDate, utmMedium, utmSource, scope },
        skipAdminAppend: true,
    });
};

// Cheap membership check (page load) — decides whether to show the BRE tab.
// Matched by phone. Returns { success, eligible }. No BRE call happens here.
export const getBreEligibility = async (phone) => {
    return Api().get(`/offer-leads/bre-eligibility`, {
        params: { phone: phone || undefined },
        skipAdminAppend: true,
    });
};

// Full BRE Offers (lazy, on tab click) — matches pi_dedup by phone, builds the
// payload from tradeline/enquiry and calls the BRE service. Returns
// { success, eligible, data, offersError }.
export const getBreOffers = async (phone) => {
    return Api().get(`/offer-leads/bre-offers`, {
        params: { phone: phone || undefined },
        skipAdminAppend: true,
    });
};

export const getKBLendingPageLeads = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  status = '',
  dobFromDate,
  dobToDate,
  minLoanAmount,
  maxLoanAmount,
  minSalary,
  maxSalary,
  profession,
  utmMedium,
  utmSource,
} = {}) => {
    return Api().get(`/kb-lending-page`, {
        params: {
            type,
            fromDate,
            toDate,
            search,
            perPage,
            currentPage,
            status,
            dobFromDate,
            dobToDate,
            minLoanAmount,
            maxLoanAmount,
            minSalary,
            maxSalary,
            profession,
            utmMedium,
            utmSource,
        },
        skipAdminAppend: true,
    });
};

export const getShortKBLendingPageLeads = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  status = '',
  dobFromDate,
  dobToDate,
  minLoanAmount,
  maxLoanAmount,
  minSalary,
  maxSalary,
  profession,
} = {}) => {
    return Api().get(`/short-kb-lending-page`, {
        params: {
            type,
            fromDate,
            toDate,
            search,
            perPage,
            currentPage,
            status,
            dobFromDate,
            dobToDate,
            minLoanAmount,
            maxLoanAmount,
            minSalary,
            maxSalary,
            profession,
        },
        skipAdminAppend: true,
    });
};

export const getDraftLeadsNew = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  dobFromDate,
  dobToDate,
  minLoanAmount,
  maxLoanAmount,
  minSalary,
  maxSalary,
  profession,
  utmMedium,
  utmSource,
} = {}) => {
    return Api().get(`/draft-leads-new`, {
        params: {
            type,
            fromDate,
            toDate,
            search,
            perPage,
            currentPage,
            dobFromDate,
            dobToDate,
            minLoanAmount,
            maxLoanAmount,
            minSalary,
            maxSalary,
            profession,
            utmMedium,
            utmSource,
        },
        skipAdminAppend: true,
    });
};

export const getAnalytics = async ({
  type,
  fromDate,
  toDate,
  lender,
  utmMedium,
  utmSource,
} = {}) => {
    return Api().get(`/analytics`, {
        params: {
            type,
            fromDate,
            toDate,
            lender,
            utmMedium,
            utmSource,
        },
        skipAdminAppend: true,
    });
};

export const getLendingUserJourney = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  stage,
  lender,
} = {}) => {
    return Api().get(`/lending-user-journey`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            stage,
            lender,
        },
        skipAdminAppend: true,
    });
};

export const getLendingUserJourneyDetail = async ({ phone } = {}) => {
    return Api().get(`/lending-user-journey/detail`, {
        params: { phone },
        skipAdminAppend: true,
    });
};

export const getUserTrack = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  stage,
  lender,
  medium,
  source,
  viewAllClicked,
  feedbackStatus,
  trackingEvent,
} = {}) => {
    return Api().get(`/user-track`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            stage,
            lender,
            medium,
            source,
            viewAllClicked,
            feedbackStatus,
            trackingEvent,
        },
        skipAdminAppend: true,
    });
};

export const getUserTrackDetail = async ({ phone } = {}) => {
    return Api().get(`/user-track/detail`, {
        params: { phone },
        skipAdminAppend: true,
    });
};

export const getDistinctMediums = async () => {
    return Api().get(`/user-track/distinct-mediums`, {
        skipAdminAppend: true,
    });
};

// ---------- Short Ticket (short_*) CMS endpoints ----------

export const getShortUserTrack = async ({
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
    return Api().get(`/short-user-track`, {
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

export const getShortDistinctMediums = async () => {
    return Api().get(`/short-user-track/distinct-mediums`, {
        skipAdminAppend: true,
    });
};

export const getShortUserTrackDetail = async ({ phone } = {}) => {
    return Api().get(`/short-user-track/detail`, {
        params: { phone },
        skipAdminAppend: true,
    });
};

// ---------- Cready RPM (RapidMoney-only replica of Short User Track) ----------

export const getCreadyRpm = async ({
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
    return Api().get(`/cready-rpm`, {
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

export const getCreadyRpmDistinctMediums = async () => {
    return Api().get(`/cready-rpm/distinct-mediums`, {
        skipAdminAppend: true,
    });
};

export const getCreadyRpmDetail = async ({ phone } = {}) => {
    return Api().get(`/cready-rpm/detail`, {
        params: { phone },
        skipAdminAppend: true,
    });
};

// AF Paid trend for the Cready RPM dashboard (shown on AF card click).
// granularity='hour' returns a 24-hour breakdown for a single day; else daily.
export const getCreadyRpmAfPaidTrend = async ({ type, fromDate, toDate, granularity } = {}) => {
    return Api().get(`/cready-rpm/af-paid-trend`, {
        params: { type, fromDate, toDate, granularity },
        skipAdminAppend: true,
    });
};

export const getShortOfferLeads = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  minLoanAmount,
  maxLoanAmount,
  dobFromDate,
  dobToDate,
  loanPurpose,
  minMonthlyIncome,
  maxMonthlyIncome,
  lender,
  disbStatus,
  pincode,
  employmentType,
  medium,
  source,
  feedbackStatus,
  distinct,
  agentId,
} = {}) => {
    return Api().get(`/short-offer-leads`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            minLoanAmount,
            maxLoanAmount,
            dobFromDate,
            dobToDate,
            loanPurpose,
            minMonthlyIncome,
            maxMonthlyIncome,
            lender,
            disbStatus,
            pincode,
            employmentType,
            medium,
            source,
            feedbackStatus,
            distinct,
            // Call-center pool member → filter to leads assigned to this agent.
            agentId,
        },
        skipAdminAppend: true,
    });
};

export const getShortOfferLeadsFilterValues = async () => {
    return Api().get(`/short-offer-leads/filter-values`, {
        skipAdminAppend: true,
    });
};

export const getShortSelectedLenders = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
  lenderName,
  status,
  medium,
  source,
  minMonthlyIncome,
  maxMonthlyIncome,
  minLoanAmount,
  feedbackStatus,
} = {}) => {
    return Api().get(`/short-selected-lenders`, {
        params: {
            currentPage,
            perPage,
            search,
            type,
            fromDate,
            toDate,
            lenderName,
            status,
            medium,
            source,
            minMonthlyIncome,
            maxMonthlyIncome,
            minLoanAmount,
            feedbackStatus,
        },
        skipAdminAppend: true,
    });
};

export const getShortDistinctLenders = async () => {
    return Api().get(`/short-selected-lenders/distinct-lenders`, {
        skipAdminAppend: true,
    });
};

export const getShortSelectedLendersByPhone = async (phone) => {
    return Api().get(`/short-selected-lenders/by-phone/${encodeURIComponent(phone)}`, {
        skipAdminAppend: true,
    });
};

export const getShortOfferLeadByPhone = async (phone) => {
    return Api().get(`/short-offer-leads/by-phone/${encodeURIComponent(phone)}`, {
        skipAdminAppend: true,
    });
};

export const getOfferLeadByPhone = async (phone) => {
    return Api().get(`/offer-leads/by-phone/${encodeURIComponent(phone)}`, {
        skipAdminAppend: true,
    });
};

export const getShortOfferLeadById = async (id) => {
    return Api().get(`/short-offer-leads/${encodeURIComponent(id)}`, {
        skipAdminAppend: true,
    });
};

export const getOfferLeadById = async (id) => {
    return Api().get(`/offer-leads/${encodeURIComponent(id)}`, {
        skipAdminAppend: true,
    });
};

// Bureau PI lookup (ClickHouse Cready_Scrub_PI_Cibil_Equifax) by phone.
// Returns { statusCode, data: { found, count, leads: [{ pincode, pan, dob, ... }] } }.
// The offer-lead detail page uses leads[0].pincode as the "Bureau Pincode".
export const searchLeadGeneration = async (phone) => {
    return Api().post(`/leadsGeneration`, { phone }, {
        skipAdminAppend: true,
    });
};

// ---------- Lead Feedback (call-center disposition, keyed by phone) ----------
// skipAdminAppend is required — otherwise the request interceptor rewrites the
// URL to /lead-feedback/admin/... and breaks the route match.
export const getLeadFeedback = async (phone) => {
    return Api().get(`/lead-feedback/${encodeURIComponent(phone)}`, {
        skipAdminAppend: true,
    });
};

export const saveLeadFeedback = async ({ phone, status, remark, updatedBy, nextAction, nextActionAt } = {}) => {
    return Api().put(`/lead-feedback`, { phone, status, remark, updatedBy, nextAction, nextActionAt }, {
        skipAdminAppend: true,
    });
};

// ---------- Short Ticket feedback (separate short_feedback table) ----------
export const getShortLeadFeedback = async (phone) => {
    return Api().get(`/short-feedback/${encodeURIComponent(phone)}`, {
        skipAdminAppend: true,
    });
};

export const saveShortLeadFeedback = async ({ phone, status, remark, updatedBy, nextAction, nextActionAt } = {}) => {
    return Api().put(`/short-feedback`, { phone, status, remark, updatedBy, nextAction, nextActionAt }, {
        skipAdminAppend: true,
    });
};

// ---------- Callback reminders (scheduled callbacks whose time has arrived) ----------
// `agent` is optional — omit it for the shared team queue (every call-center agent
// sees all due callbacks); pass it to scope to one agent's own scheduled callbacks.
export const getDueCallbacks = async (agent) =>
    Api().get(`/lead-feedback/due-callbacks`, { params: { agent }, skipAdminAppend: true });

export const dismissCallback = async (phone) =>
    Api().put(`/lead-feedback/callback-done`, { phone }, { skipAdminAppend: true });

export const getShortDueCallbacks = async (agent) =>
    Api().get(`/short-feedback/due-callbacks`, { params: { agent }, skipAdminAppend: true });

// Recent InCred-success leads for the in-CMS alert bell (last 6h). Powers the
// IncredSuccessAlerts navbar bell — beeps / desktop-notifies on new arrivals.
// agentId scopes a pooled call-center agent to the leads assigned to them
// (lead_assignments) — same persisted ownership the Offer Leads list uses.
export const getIncredSuccessAlerts = async ({ agentId } = {}) =>
    Api().get(`/offer-leads/incred-success-alerts`, { params: { agentId }, skipAdminAppend: true });

export const dismissShortCallback = async (phone) =>
    Api().put(`/short-feedback/callback-done`, { phone }, { skipAdminAppend: true });

// ---------- Follow-up funnel (call-center disposition pipeline) ----------
// `agent` scopes to one agent; the band params narrow the lead universe to a
// segmented agent's income/loan window (so Total Leads matches their segment).
export const getFollowupFunnel = async ({ scope = 'all', type, fromDate, toDate, agent, minMonthlyIncome, maxMonthlyIncome, minLoanAmount, utmMedium, utmSource } = {}) =>
    Api().get(`/followup-funnel`, { params: { scope, type, fromDate, toDate, agent, minMonthlyIncome, maxMonthlyIncome, minLoanAmount, utmMedium, utmSource }, skipAdminAppend: true });

// ---------- Feedback records (per-phone high/short feedback list) ----------
export const getFeedbackRecords = async ({ scope = 'all', status, search, fromDate, toDate, page = 1, perPage = 20, agent, utmMedium, utmSource, minMonthlyIncome, maxMonthlyIncome, minLoanAmount } = {}) =>
    Api().get(`/feedback-records`, { params: { scope, status, search, fromDate, toDate, page, perPage, agent, utmMedium, utmSource, minMonthlyIncome, maxMonthlyIncome, minLoanAmount }, skipAdminAppend: true });

// Distinct agent names for the admin "filter by agent" dropdown.
export const getFeedbackAgents = async () =>
    Api().get(`/feedback-records/agents`, { skipAdminAppend: true });

// Customers behind one funnel stage (click-through modal) + CSV export.
export const getStageLeads = async (params = {}) =>
    Api().get(`/followup-funnel/stage-leads`, { params, skipAdminAppend: true });

export const exportStageLeads = async (params = {}) =>
    Api().get(`/followup-funnel/stage-leads/export`, { params, skipAdminAppend: true, responseType: 'blob' });

// Full CSV of the (filtered) call-center feedback records — super-admin export.
export const exportFeedbackRecords = async (params = {}) =>
    Api().get(`/feedback-records/export`, { params, skipAdminAppend: true, responseType: 'blob' });

export const getShortAnalytics = async ({
  type,
  fromDate,
  toDate,
  medium,
  source,
} = {}) => {
    return Api().get(`/short-analytics`, {
        params: {
            type,
            fromDate,
            toDate,
            medium,
            source,
        },
        skipAdminAppend: true,
    });
};

export const getShortDraftLeadsNew = async ({
  type,
  fromDate,
  toDate,
  search = '',
  perPage = 10,
  currentPage = 1,
  dobFromDate,
  dobToDate,
  minLoanAmount,
  maxLoanAmount,
  minSalary,
  maxSalary,
  profession,
} = {}) => {
    return Api().get(`/short-draft-leads`, {
        params: {
            type,
            fromDate,
            toDate,
            search,
            perPage,
            currentPage,
            dobFromDate,
            dobToDate,
            minLoanAmount,
            maxLoanAmount,
            minSalary,
            maxSalary,
            profession,
        },
        skipAdminAppend: true,
    });
};


export const getOtpLogs = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  status,
  purpose,
  type,
  fromDate,
  toDate,
} = {}) => {
    return Api().get(`/auth/otp-logs`, {
        params: {
            currentPage,
            perPage,
            search,
            status,
            purpose,
            type,
            fromDate,
            toDate,
        },
        skipAdminAppend: true,
    });
};

export const getExportAuditLogs = async ({
  search = '',
  perPage = 10,
  currentPage = 1,
  exportType,
  type,
  fromDate,
  toDate,
} = {}) => {
    return Api().get(`/auth/export-audit-logs`, {
        params: {
            currentPage,
            perPage,
            search,
            exportType,
            type,
            fromDate,
            toDate,
        },
        skipAdminAppend: true,
    });
};

export const AddLender = async (formData) => {
    console.log(formData, "fffsss")
    return Api().post('/lender', formData);
};

export const getLenderById = async id => Api().get(`/lender/${id}`);

export const UpdateLender = async (id, formData) => {
    return Api().put(`/lender/${id}`, formData);
};

// Redis queue status for an async offer lead — polls the in-memory key written by
// the BullMQ worker. Returns { status: 'queued'|'processing'|'done'|'failed'|'unknown', data }
// Key expires after 1 hour, so 'unknown' means either sync submission or TTL elapsed.
export const getOfferQueueStatus = async (offerLeadId) =>
    Api().get(`/onSubmit/offer-status/${encodeURIComponent(offerLeadId)}`, {
        skipAdminAppend: true,
    });