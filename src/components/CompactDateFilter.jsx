import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, X, Check } from "lucide-react";

// Date filter: the everyday choices are VISIBLE, the rest is one click away.
//
// This has swung twice. It began as five preset buttons plus two loose date
// inputs — everything on screen at once, ~460px of the bar for a date picker.
// Collapsing all of it into a single dropdown fixed the width but hid Today and
// Yesterday behind a click, which is most of what anyone actually picks.
//
// So: the two or three common presets sit inline as chips, and everything else
// (the remaining presets and the custom range) lives behind one small calendar
// button. Common case = one click and no reading; rare case = still there.
const QUICK = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
];
const MORE = [
  { key: "", label: "All time" },
  { key: "current_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];
const ALL = [...QUICK, ...MORE];

const shortDate = (v) => {
  if (!v) return "";
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const ACCENT = {
  indigo: { on: "bg-indigo-600 text-white border-indigo-600", soft: "border-indigo-200 bg-indigo-50 text-indigo-700", ring: "text-indigo-700" },
  purple: { on: "bg-purple-600 text-white border-purple-600", soft: "border-purple-200 bg-purple-50 text-purple-700", ring: "text-purple-700" },
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
  // Optional prefix shown on the More button ("Disbursed: This month"). Without
  // it two of these controls on one bar look identical and neither says what it
  // filters.
  label: fieldLabel = "",
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const hasRange = !!(fromDate || toDate);
  const tone = ACCENT[accent] || ACCENT.indigo;

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

  // An explicit range always wins over a preset — same precedence the backends
  // apply, so the control can never claim something the data does not reflect.
  const rangeLabel = fromDate && toDate
    ? `${shortDate(fromDate)} – ${shortDate(toDate)}`
    : fromDate ? `From ${shortDate(fromDate)}`
      : toDate ? `Till ${shortDate(toDate)}` : "";
  const activeMore = !hasRange && MORE.find((m) => m.key === range);
  // The More button says what IT holds, not just "More" — otherwise picking
  // "Last month" leaves the bar looking like nothing is filtered.
  const moreLabel = hasRange ? rangeLabel : (activeMore ? activeMore.label : "More");
  const moreActive = hasRange || !!activeMore;

  const pick = (key) => { onClearRange(); onRangeChange(key); setOpen(false); };

  return (
    <div className="relative inline-flex items-center gap-1" ref={boxRef}>
      {QUICK.map((q) => {
        const on = !hasRange && range === q.key;
        return (
          <button
            key={q.key}
            type="button"
            onClick={() => pick(q.key)}
            className={`h-[34px] px-3 rounded-lg border text-[12px] font-semibold whitespace-nowrap transition ${
              on ? tone.on : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {q.label}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={fieldLabel ? `${fieldLabel} — more date options` : "More date options"}
        className={`inline-flex items-center gap-1.5 h-[34px] pl-2.5 pr-2 rounded-lg border text-[12px] font-semibold whitespace-nowrap transition ${
          moreActive ? tone.soft : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        <Calendar size={13} className="shrink-0 opacity-70" />
        {fieldLabel && <span className="text-gray-400 font-medium">{fieldLabel}:</span>}
        <span>{moreLabel}</span>
        {moreActive ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClearRange(); onRangeChange(""); }}
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
        <div className="absolute z-30 top-full mt-1 right-0 w-[230px] rounded-xl border border-gray-200 bg-white shadow-lg shadow-gray-200/60 overflow-hidden">
          {ALL.map((p) => {
            const on = !hasRange && range === p.key;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => pick(p.key)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] transition ${
                  on ? `${tone.ring} font-semibold bg-gray-50` : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
                {on && <Check size={13} />}
              </button>
            );
          })}

          {/* Always visible, not hidden behind another toggle — a range picker you
              have to reveal first is the thing people give up on. */}
          <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/60">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Custom range</p>
            <div className="flex flex-col gap-1.5">
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
            </div>
            {hasRange && (
              <button
                type="button"
                onClick={() => { onClearRange(); setOpen(false); }}
                className="mt-1.5 text-[11px] font-semibold text-gray-500 hover:text-rose-500"
              >
                Clear range
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
