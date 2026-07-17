// Intelligence — shared constants.
//
// Palette values are taken from the EXISTING codebase, not invented:
//   COLORS       ← DisbursalDashboard.jsx:158 (Cready brand: purple → violet → indigo)
//   CATEGORICAL  ← OfferLeadsAnalytics.jsx:19
//   STATUS       ← OfferLeadsLenderStatsChart.jsx
// Introducing a parallel palette would make this module look like a different
// product.

export const COLORS = {
    brand: "#7c3aed",   // violet-600
    brand2: "#6366f1",  // indigo-500
    accent: "#a855f7",  // purple-500
    info: "#3b82f6",    // blue-500
    pos: "#8b5cf6",     // violet-500
    neg: "#dc2626",
    warn: "#b45309",
};

export const CATEGORICAL = [
    "#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
    "#EC4899", "#8B5CF6", "#06B6D4", "#84CC16", "#F97316",
    "#6366F1", "#14B8A6", "#E11D48", "#A855F7", "#0EA5E9",
];

export const STATUS_COLORS = { success: "#10B981", reject: "#EF4444", dedupe: "#F59E0B" };

// Sequential ramps, 5 quantile steps (§1.5). Ordered by LIGHTNESS so they survive
// greyscale and the common colour-vision deficiencies — a state is never encoded
// by hue alone anywhere in this module.
export const RAMP = {
    high: ["#EDE9FE", "#C4B5FD", "#A78BFA", "#8B5CF6", "#6D28D9"], // violet — High Ticket
    short: ["#E0F2FE", "#BAE6FD", "#7DD3FC", "#0EA5E9", "#0369A1"], // sky — Short Ticket
};

// Diverging ramp for RATE metrics: for a rate the question is "better or worse
// than normal?", not "big or small?", so the scale is anchored on the mean.
export const DIVERGING = ["#DC2626", "#FCA5A5", "#E5E7EB", "#C4B5FD", "#6D28D9"];

// The four modules. One tab, switched in-page — the AllLenders.jsx pattern, which
// is the newest code in the repo and already chose this over duplicated files.
export const MODULES = [
    { key: "high", label: "High Ticket", scope: "high", theme: "high" },
    { key: "short", label: "Short Ticket", scope: "short", theme: "short" },
    { key: "campaigns", label: "Campaigns", scope: "high", theme: "high", pivot: "campaign" },
    { key: "lenders", label: "Lenders", scope: "high", theme: "high", pivot: "lender" },
];

// Sections within the tab.
export const SECTIONS = [
    { key: "time", label: "Time" },
    { key: "customer", label: "Customer" },
    { key: "cohort", label: "Cohort" },
    { key: "lenders", label: "Lenders" },
    { key: "recommendations", label: "Recommendations" },
];

export const DOW_LABELS = {
    1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};
export const DOW_FULL = {
    1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday",
};

export const METRIC_OPTIONS = [
    { key: "disbursed", label: "Disbursed", kind: "count" },
    { key: "disbursed_amount", label: "Disbursed Amount", kind: "amount" },
    { key: "conversion", label: "Conversion %", kind: "rate" },
    { key: "landed", label: "Landed", kind: "count" },
    { key: "otp_verified", label: "OTP Verified", kind: "count" },
    { key: "form_submitted", label: "Form Submitted", kind: "count" },
    { key: "lender_clicked", label: "Lender Clicked", kind: "count" },
    { key: "submit_rate", label: "Form Submit %", kind: "rate" },
    { key: "click_rate", label: "Lender Click %", kind: "rate" },
    // Gated: hidden when the data-quality gate says the metric isn't measurable.
    { key: "approved", label: "Approved", kind: "count", gated: "approval_rate" },
    { key: "approval_rate", label: "Approval %", kind: "rate", gated: "approval_rate" },
    { key: "rejection_rate", label: "Rejection %", kind: "rate", gated: "rejection_rate" },
];

export const COHORT_STAGES = [
    { key: "disbursed", label: "Disbursed" },
    { key: "lender_clicked", label: "Lender Clicked" },
    { key: "form_submitted", label: "Form Submitted" },
];
