import Api from "../api";

// User Track funnel — counts only. Same stage logic as the User Track table.
// scope: 'high' (High Ticket) | 'short' (Short Ticket).
export const getUserTrackFunnel = async ({ fromDate, toDate, medium, scope = "high" } = {}) =>
  Api().get(`/user-track-funnel`, {
    params: { fromDate, toDate, medium, scope },
    skipAdminAppend: true,
  });

// UTM medium dropdown options for the chosen scope.
export const getUserTrackMediums = async ({ scope = "high" } = {}) =>
  Api().get(`/user-track-funnel/mediums`, {
    params: { scope },
    skipAdminAppend: true,
  });
