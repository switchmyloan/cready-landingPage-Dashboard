// Shared date-range resolution.
//
// EXTRACTED from DisbursalDashboard.jsx:1191, where it was defined inline and not
// exported. Copying it into a second dashboard would give us two divergent
// implementations of the same logic, and the `'Custom' → null` subtlety (which
// preserves user-edited dates rather than overwriting them) is exactly the kind of
// thing a copy loses.
//
// DisbursalDashboard is deliberately NOT changed to import this — that would mean
// editing an existing module. It can adopt this later; until then the two are
// intentionally identical and this file is the one new code should use.

export const fmtISO = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// The range tokens, in display order. Matches DisbursalDashboard's strip.
export const RANGE_TOKENS = ['Today', 'Yesterday', '7D', '30D', '90D', 'Current Month', 'Custom'];

/**
 * Resolve a range token into the { fromDate, toDate } that should appear in the
 * API URL.
 *
 * The backend computes its own bounds from the token, but keeping the URL params
 * in sync is what makes a dashboard URL shareable.
 *
 * @returns {{fromDate:string,toDate:string}|null} null for 'Custom' — the caller
 *          must preserve whatever dates the user typed.
 */
export const dateForRange = (r) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fmt = fmtISO;

    if (r === 'All') return { fromDate: '', toDate: '' };
    if (r === 'Today') return { fromDate: fmt(today), toDate: fmt(today) };
    if (r === 'Yesterday') {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return { fromDate: fmt(y), toDate: fmt(y) };
    }
    if (r === 'Current Month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { fromDate: fmt(firstDay), toDate: fmt(today) };
    }
    if (r === 'Custom') return null; // preserve user-edited dates

    const days = { '24H': 1, '7D': 7, '30D': 30, '90D': 90 }[r] ?? 0;
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    return { fromDate: fmt(from), toDate: fmt(today) };
};

/**
 * Every fetch must early-return on this. Firing a request with a half-entered
 * custom range produces a confusing partial result and a wasted round-trip.
 */
export const isCustomIncomplete = (range, fromDate, toDate) =>
    range === 'Custom' && (!fromDate || !toDate);
