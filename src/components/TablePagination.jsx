import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// Table footer pagination: rows-per-page, the visible row range, and numbered
// page buttons with first/last jumps.
//
// The pages this replaces had only prev/next chevrons, so reaching page 40 of a
// 900-row list meant 39 clicks and there was no way to widen the page. Page
// numbers are windowed (max 5 around the current one) with ellipsis + first/last
// so the footer stays the same width whether there are 3 pages or 300.

const PER_PAGE_OPTIONS = [20, 50, 100, 200];

const btn =
  "min-w-[28px] h-7 px-2 grid place-items-center rounded-lg border text-[12px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";
const idle = "border-gray-200 text-gray-600 hover:bg-gray-50";
const active = "border-indigo-600 bg-indigo-600 text-white";

// Up to 5 page numbers centred on the current page, clamped at both ends so the
// window is always full (page 1 shows 1-5, the last page shows the final 5).
const pageWindow = (current, totalPages, size = 5) => {
  const start = Math.max(1, Math.min(current - Math.floor(size / 2), totalPages - size + 1));
  const end = Math.min(totalPages, start + size - 1);
  const out = [];
  for (let i = Math.max(1, start); i <= end; i += 1) out.push(i);
  return out;
};

export default function TablePagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  onPerPageChange,
  noun = "rows",
}) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const current = Math.min(Math.max(page, 1), safeTotalPages);
  const pages = pageWindow(current, safeTotalPages);
  const from = total === 0 ? 0 : (current - 1) * perPage + 1;
  const to = Math.min(current * perPage, total);
  const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
      <div className="flex items-center gap-2 text-[12px] text-gray-500">
        <span>
          Showing <span className="font-semibold text-gray-700">{fmt(from)}</span>
          {"–"}
          <span className="font-semibold text-gray-700">{fmt(to)}</span> of{" "}
          <span className="font-semibold text-gray-700">{fmt(total)}</span> {noun}
        </span>
        {onPerPageChange && (
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="ml-1 px-1.5 py-1 rounded-lg border border-gray-200 text-[11.5px] text-gray-600 bg-white"
            title="Rows per page"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button className={`${btn} ${idle}`} disabled={current <= 1} onClick={() => onPageChange(1)} title="First page">
          <ChevronsLeft size={14} />
        </button>
        <button className={`${btn} ${idle}`} disabled={current <= 1} onClick={() => onPageChange(current - 1)} title="Previous page">
          <ChevronLeft size={14} />
        </button>

        {pages[0] > 1 && <span className="px-1 text-[12px] text-gray-400">…</span>}
        {pages.map((p) => (
          <button
            key={p}
            className={`${btn} ${p === current ? active : idle}`}
            onClick={() => onPageChange(p)}
            aria-current={p === current ? "page" : undefined}
          >
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < safeTotalPages && <span className="px-1 text-[12px] text-gray-400">…</span>}

        <button className={`${btn} ${idle}`} disabled={current >= safeTotalPages} onClick={() => onPageChange(current + 1)} title="Next page">
          <ChevronRight size={14} />
        </button>
        <button className={`${btn} ${idle}`} disabled={current >= safeTotalPages} onClick={() => onPageChange(safeTotalPages)} title="Last page">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
