import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

// Date presets + an explicit range, collapsed into ONE dropdown button.
//
// This started as a row of five preset buttons sitting next to two date inputs —
// every option visible at all times, eating ~460px of the filter bar for what is
// only a date picker. Now the trigger shows just the ACTIVE choice (~150px) and
// the options live in a popover; the two date inputs appear inside it only when
// "Custom range" is picked, since that is the rare case.
const PRESETS = [
  { key: "", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "current_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

const shortDate = (v) => {
  if (!v) return "";
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export default function CompactDateFilter({
  range,
  onRangeChange,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onClearRange,
  accent = "indigo",
  // Optional prefix shown inside the trigger ("Disbursed: Today"). Without it two
  // of these controls on one bar look identical and neither says what it filters.
  label: fieldLabel = "",
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const boxRef = useRef(null);
  const hasRange = !!(fromDate || toDate);

  // Close on outside click / Esc, so the popover never sits open over the table.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // An explicit range wins over a preset — same precedence the backends apply.
  const label = hasRange
    ? fromDate && toDate
      ? `${shortDate(fromDate)} – ${shortDate(toDate)}`
      : fromDate
        ? `From ${shortDate(fromDate)}`
        : `Till ${shortDate(toDate)}`
    : PRESETS.find((p) => p.key === range)?.label || "All time";

  const activeCls = accent === "purple" ? "text-purple-700" : "text-indigo-700";
  const isDefault = !hasRange && !range;

  return (
    <div className="relative inline-block" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 h-[34px] pl-2.5 pr-2 rounded-lg border text-[12px] font-semibold transition ${
          isDefault
            ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            : `border-indigo-200 bg-indigo-50 ${activeCls}`
        }`}
        title="Date filter"
      >
        <Calendar size={13} className="shrink-0 opacity-70" />
        <span className="whitespace-nowrap">
          {fieldLabel && <span className="text-gray-400 font-medium">{fieldLabel}: </span>}
          {label}
        </span>
        {!isDefault ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClearRange(); onRangeChange(""); setShowCustom(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClearRange(); onRangeChange(""); } }}
            className="ml-0.5 grid place-items-center w-4 h-4 rounded-full text-gray-400 hover:text-rose-500 hover:bg-white/70"
            title="Clear date filter"
          >
            <X size={11} />
          </span>
        ) : (
          <ChevronDown size={13} className="opacity-50" />
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-[190px] rounded-xl border border-gray-200 bg-white shadow-lg shadow-gray-200/60 overflow-hidden">
          {PRESETS.map((p) => {
            const active = !hasRange && range === p.key;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => { onClearRange(); onRangeChange(p.key); setShowCustom(false); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[12.5px] transition ${
                  active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            className={`w-full text-left px-3 py-1.5 text-[12.5px] border-t border-gray-100 transition ${
              hasRange ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Custom range…
          </button>

          {(showCustom || hasRange) && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60 flex flex-col gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromChange(e.target.value)}
                className="px-2 py-1 text-[11.5px] rounded-lg border border-gray-200 text-gray-700 bg-white"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => onToChange(e.target.value)}
                className="px-2 py-1 text-[11.5px] rounded-lg border border-gray-200 text-gray-700 bg-white"
              />
              {hasRange && (
                <button
                  type="button"
                  onClick={() => { onClearRange(); setShowCustom(false); }}
                  className="text-[11px] font-semibold text-gray-500 hover:text-rose-500 self-end"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
