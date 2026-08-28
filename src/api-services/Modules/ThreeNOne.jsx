import Api from "../api";

// 3N1 (3-in-1) Analysis — reads public.lender_events through the backend /3n1
// routes. `analysis` returns the land → select → continue funnel: an overall
// summary, a split by source (compare vs campaign), and a per-lender breakdown.
export const getThreeNOneAnalysis = async ({ type, fromDate, toDate, source, utmSource } = {}) => {
  return Api().get(`/3n1/analysis`, {
    params: { type, fromDate, toDate, source, utmSource },
    skipAdminAppend: true,
  });
};

// Export — filtered events + user PI (name/phone/email/pan/dob/… from cibil_pi,
// joined by mrn). Returns { data: { rows } }; the page builds the CSV.
export const getThreeNOneExport = async ({ type, fromDate, toDate, source, utmSource } = {}) => {
  return Api().get(`/3n1/export`, {
    params: { type, fromDate, toDate, source, utmSource },
    skipAdminAppend: true,
  });
};
