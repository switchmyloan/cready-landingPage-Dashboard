import { X } from "lucide-react";

// Date presets + an explicit range in ONE control.
//
// The two used to sit side by side as a row of full-width buttons plus two loose
// date inputs, which ate most of the filter bar for what is only a date picker.
// Everything now lives inside a single bordered pill: short preset labels, then
// the range fused onto the end, with a clear (✕) that only appears once a date
// is set. Picking a range wins over a preset (and de-highlights it), matching how
// the backends resolve the two.
const PRESETS = [
  { key: "", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yest" },
  { key: "current_month", label: "This Mo" },
  { key: "last_month", label: "Last Mo" },
];

export default function CompactDateFilter({
  range,
  onRangeChange,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onClearRange,
  accent = "indigo",
}) {
  const hasRange = !!(fromDate || toDate);
  const activeCls =
    accent === "purple" ? "bg-purple-600 text-white" : "bg-indigo-600 text-white";

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden divide-x divide-gray-200">
      {PRESETS.map((p) => {
        const active = !hasRange && range === p.key;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => { onClearRange(); onRangeChange(p.key); }}
            className={`px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap transition ${
              active ? activeCls : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        );
      })}

      <div className={`flex items-center gap-0.5 px-1.5 py-1 ${hasRange ? "bg-indigo-50" : ""}`}>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-[104px] px-1 py-0.5 text-[11px] text-gray-700 bg-transparent border-0 focus:outline-none"
        />
        <span className="text-gray-300 text-[11px]">→</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToChange(e.target.value)}
          className="w-[104px] px-1 py-0.5 text-[11px] text-gray-700 bg-transparent border-0 focus:outline-none"
        />
        {hasRange && (
          <button
            type="button"
            onClick={onClearRange}
            title="Clear range"
            className="text-gray-400 hover:text-rose-500 transition px-0.5"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
