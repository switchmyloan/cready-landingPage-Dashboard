// Intelligence — formatters and small shared helpers.

export const fmtNum = (n) => (Number(n) || 0).toLocaleString("en-IN");

/** Compact INR. Indian units (L / Cr), not K/M — the audience reads lakhs. */
export const fmtINR = (n) => {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
    return `₹${v.toFixed(0)}`;
};

export const fmtPct = (x, dp = 2) => `${((Number(x) || 0) * 100).toFixed(dp)}%`;

/**
 * Deltas for RATES are in percentage POINTS, never percent.
 * "+0.4%" is ambiguous (relative or absolute?); "+0.4pp" is not.
 */
export const fmtPP = (x, dp = 1) => {
    const v = (Number(x) || 0) * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}pp`;
};

/** Relative delta, for counts/amounts. */
export const fmtDelta = (x, dp = 1) => {
    if (x == null) return "—";
    const v = (Number(x) || 0) * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;
};

export const fmtValue = (v, kind) => {
    if (v == null) return "—";
    if (kind === "rate") return fmtPct(v);
    if (kind === "amount") return fmtINR(v);
    return fmtNum(v);
};

export const hourLabel = (h) => {
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${ampm}`;
};

export const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

export const fmtDateShort = (iso) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/** Bin index for a quantile ramp. Mirrors the server's binIndex(). */
export const binIndex = (value, bins) => {
    if (value == null || !Number.isFinite(Number(value))) return 0;
    let i = 0;
    while (i < bins.length && Number(value) > bins[i]) i += 1;
    return i;
};

export const clsx = (...xs) => xs.filter(Boolean).join(" ");

/** Tier chip styling. Low is never rendered as a recommendation — only a signal. */
export const tierChip = (tier) =>
    ({
        High: "bg-green-100 text-green-700 border-green-200",
        Medium: "bg-blue-100 text-blue-700 border-blue-200",
        Low: "bg-gray-100 text-gray-600 border-gray-200",
    }[tier] || "bg-gray-100 text-gray-600 border-gray-200");
