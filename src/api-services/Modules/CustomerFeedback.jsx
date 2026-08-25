import Api from "../api";

// Customer feedback (testimonials / CSAT) — read-only over the backend
// /customer-feedback routes (public.customer_feedback table). List is paginated +
// searchable + date-filterable; detail returns the full submission for one row.

export const getCustomerFeedback = async ({
  search = "",
  perPage = 10,
  currentPage = 1,
  type,
  fromDate,
  toDate,
} = {}) => {
  return Api().get(`/customer-feedback`, {
    params: { search, perPage, currentPage, type, fromDate, toDate },
    skipAdminAppend: true,
  });
};

export const getCustomerFeedbackById = async (id) => {
  return Api().get(`/customer-feedback/${encodeURIComponent(id)}`, {
    skipAdminAppend: true,
  });
};
