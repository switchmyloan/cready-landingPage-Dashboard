import Api from "../api";

// Feedback Champions — call-centre leaderboard over feedback_link_logs
// (who sends feedback links, and whose links customers actually fill).

export const getFeedbackLeaderboard = async ({ type, fromDate, toDate } = {}) => {
  return Api().get(`/feedback-champions/leaderboard`, {
    params: { type, fromDate, toDate },
    skipAdminAppend: true,
  });
};

export const getFeedbackAgentLinks = async ({
  email,
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
} = {}) => {
  return Api().get(`/feedback-champions/links`, {
    params: { email, perPage, currentPage, type, fromDate, toDate },
    skipAdminAppend: true,
  });
};
