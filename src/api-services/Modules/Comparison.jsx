import Api from "../api";

// Month-over-month disbursement comparison (Phase 1). Backed by /comparison, which
// composes the cached disbursal helpers so totals reconcile with the Disbursal
// Dashboard for identical filters.
export const getComparison = async ({ scope, asOf, includeInProgress } = {}) => {
  return Api().get(`/comparison`, {
    params: { scope, asOf, includeInProgress },
    skipAdminAppend: true,
  });
};
