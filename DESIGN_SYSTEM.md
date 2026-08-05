# Cready Portal — Design System & Theme Guide

A reusable reference so a **new project can replicate this exact look & feel**. Hand this file to your coding assistant and say "build the UI using DESIGN_SYSTEM.md". Everything below is Tailwind-utility based (no custom component library) so it's copy-paste portable.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | **React 19** + **Vite 7** |
| Styling | **Tailwind CSS 3.4** (utility-first) + **daisyui 5** (used lightly, mostly dropdown) |
| Icons | **lucide-react** (line icons, `size={14..22}`) |
| Toasts | **react-hot-toast** |
| Routing | **react-router-dom 7** |
| Tables | **@tanstack/react-table** (via a shared `MainTable` wrapper) |
| Forms | **react-hook-form** + **yup** |
| Charts | **recharts** |
| Export | **xlsx** / **file-saver** + a hand-rolled CSV helper (see §12) |
| Font | **Roboto** (`font-family: "Roboto", sans-serif` on `body`) |

Install: `npm i react react-dom react-router-dom lucide-react react-hot-toast @tanstack/react-table recharts react-hook-form yup xlsx file-saver` + `tailwindcss postcss autoprefixer daisyui`.

---

## 2. Design vibe (the "feel")

- **Clean SaaS dashboard.** White cards on a light gray canvas, soft borders, subtle shadows, lots of rounded corners.
- **Purple → indigo is the brand gradient.** Used on the primary button, page-header icon, active chips, KPI accents.
- **Dense but readable.** Small font sizes (10–13px) with `uppercase tracking-wide` labels; numbers are `tabular-nums` and bold.
- **Semantic color-coding everywhere** — green = success/disbursed, amber = pending/in-progress, rose/red = rejected, sky/blue = info, purple = brand/neutral-primary.
- **Gradient icon chips** — every KPI/header has a `w-10 h-10 rounded-lg bg-gradient-to-br from-X to-Y` icon tile in white.

---

## 3. Color palette (semantic tones)

Use Tailwind's default palette. Map meaning → tone:

| Tone | Meaning | Gradient (icon tiles) | Solid / bg / text |
|---|---|---|---|
| **purple** | brand / primary / total | `from-purple-500 to-indigo-500` | `bg-purple-600`, `text-purple-700`, `bg-purple-50` |
| **green** | success / disbursed / approved | `from-emerald-500 to-green-500` | `text-emerald-600`, `bg-emerald-100 text-emerald-700` |
| **amber** | pending / in-progress / awaiting | `from-amber-500 to-orange-500` | `text-amber-600`, `bg-amber-100 text-amber-700` |
| **rose/red** | rejected / failed / cancelled | `from-rose-500 to-red-500` | `text-rose-600`, `bg-rose-100 text-rose-700` |
| **blue/sky** | info / neutral metric | `from-sky-500 to-blue-500` | `text-sky-600` |
| **gray** | unknown / other / muted | `from-gray-400 to-gray-500` | `text-gray-400`, `bg-gray-100 text-gray-600` |

daisyui theme (secondary role, `tailwind.config.js`): `primary #4B49AC`, `secondary #F3797E`, `accent #7DA0FA`, `base-100 #F9FAFB`. But **99% of the UI uses the Tailwind purple/indigo utilities above**, not the daisyui vars.

**Canvas:** page bg is light gray (`bg-gray-50`/`#F9FAFB`); every panel is `bg-white`.

---

## 4. Typography

- **Font:** Roboto. `body { font-family: "Roboto", sans-serif; font-weight: 400; }`
- **Size scale (arbitrary values are the norm here):**
  - Page title: `text-[18px] font-extrabold text-gray-900`
  - Section heading: `text-[14px] font-bold text-gray-800`
  - KPI value: `text-lg`–`text-[24px] font-bold`/`font-extrabold text-gray-900`
  - Body: `text-[13px] text-gray-600`
  - Table cell: `text-[12.5px]`
  - Label / eyebrow: `text-[10.5px] md:text-[11px] font-semibold uppercase tracking-wide text-gray-500`
  - Sub / caption: `text-[11px] text-gray-400`
  - Micro (chips, badges): `text-[9px]–text-[10px] font-bold uppercase tracking-wide`
- **Numbers:** always add `tabular-nums`; format with `Number(n).toLocaleString('en-IN')`; currency `₹${n.toLocaleString('en-IN')}`.

---

## 5. Radius, shadow, border, spacing

- **Radius:** `rounded-lg` (buttons, icon tiles, inputs) · `rounded-xl` (cards/panels) · `rounded-2xl` (modals, dropdowns) · `rounded-full` (chips, badges, pills).
- **Border:** `border border-gray-200/80` (cards) · `border-gray-100` (inner dividers).
- **Shadow:** `shadow-sm` (cards) · `shadow-2xl` (modals/dropdowns), often tinted: `shadow-2xl shadow-purple-500/10`.
- **Gap/padding:** panels `px-4 py-3` or `px-5 py-4`; card grids `flex flex-wrap gap-3` or `grid ... gap-3`; page sections `mb-3`.

---

## 6. Layout

- **Fixed left sidebar** (width `16rem`) + **fixed top navbar** (height `~4rem`). Main content offset:
  ```css
  .content { margin-left: 16rem; margin-top: 4rem; }
  ```
- **Navbar:** `fixed top-0 left-0 w-full z-10 px-4 py-2 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-gray-200/70 shadow-sm`.
- **Sidebar:** grouped nav (groups like "High Ticket", "Short Ticket", "Lenders", "Intelligence"), each item an icon (lucide) + label; active item = purple pill (`bg-purple-600 text-white` or `bg-gradient-to-r from-purple-*`).
- **Breadcrumb** row under navbar: `Home > Group > Page` with a Home icon.

---

## 7. Core components (copy-paste)

### 7.1 Page header (gradient banner)
```jsx
<div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-5 py-4 mb-3">
  <div className="flex items-center gap-3">
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow">
      <TrendingDown size={22} />
    </div>
    <div>
      <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">Page Title</h1>
      <p className="text-[12px] text-gray-500">One-line subtitle.</p>
    </div>
  </div>
  {/* right-side actions (buttons) */}
</div>
```

### 7.2 KPI card (the signature component)
```jsx
const TONES = {
  purple: 'from-purple-500 to-indigo-500',
  green:  'from-emerald-500 to-green-500',
  amber:  'from-amber-500 to-orange-500',
  blue:   'from-sky-500 to-blue-500',
  red:    'from-rose-500 to-red-500',
  gray:   'from-gray-400 to-gray-500',
};
const KpiCard = ({ icon: Icon, label, value, sub, tone = 'purple' }) => (
  <div className="flex items-center gap-3 bg-white border border-gray-200/80 rounded-xl px-4 py-3 shadow-sm min-w-[180px]">
    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TONES[tone]} grid place-items-center text-white shrink-0`}>
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  </div>
);
// Row: <div className="flex flex-wrap gap-3 mb-3"> …cards… </div>
```
> A common variant uses a bordered tinted tile instead of the icon: `border ${toneBorder} ${toneBg}` with the icon inline in the label row. Both are valid.

### 7.3 Stage / filter chip (rounded pill with count)
```jsx
const StageChip = ({ label, count, active, tone = 'purple', onClick }) => (
  <button onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition
      ${active ? 'bg-purple-600 border-purple-600 text-white'
               : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'}`}>
    {label}
    {count != null && (
      <span className={`px-1.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
    )}
  </button>
);
```

### 7.4 Filter bar (date chips + custom range + refresh)
```jsx
<div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm">
  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1 inline-flex items-center gap-1.5">
    <Calendar size={13} /> Period:
  </span>
  {['All','Today','Yesterday'].map((c) => (
    <button key={c} onClick={() => pick(c)}
      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition
        ${active===c ? 'bg-purple-600 border-purple-600 text-white'
                     : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'}`}>{c}</button>
  ))}
  <span className="mx-1 h-5 w-px bg-gray-200" />
  <input type="date" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-purple-400" />
  <span className="text-gray-400 text-xs">to</span>
  <input type="date" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-purple-400" />
  <button className="ml-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Refresh</button>
</div>
```

### 7.5 Buttons
```jsx
// Primary (brand gradient)
<button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 transition">
  <Download size={15} /> Export CSV
</button>
// Secondary (outline)
<button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-purple-200 text-purple-700 text-sm font-bold shadow-sm hover:bg-purple-50 transition">
  <BookOpen size={15} /> Docs
</button>
// Ghost / small
<button className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Refresh</button>
```

### 7.6 Status badge / pill
```jsx
const BADGE = {
  success: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  reject:  'bg-rose-100 text-rose-700',
  info:    'bg-indigo-100 text-indigo-700',
};
<span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${BADGE[kind]}`}>{label}</span>
```

### 7.7 Data table (sticky + totals footer)
```jsx
<div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
    <Filter size={15} className="text-purple-600" />
    <h3 className="text-[14px] font-bold text-gray-800">Section title</h3>
  </div>
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm border-collapse">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="sticky left-0 z-20 bg-gray-50 text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 min-w-[120px]">Col</th>
          <th className="text-right px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Metric</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={`border-b border-gray-50 ${i%2 ? 'bg-gray-50' : 'bg-white'} hover:bg-purple-50`}>
            <td className="sticky left-0 z-10 px-4 py-2 text-[12.5px] font-semibold text-gray-800 whitespace-nowrap">{r.name}</td>
            <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-gray-800 font-medium">{fmt(r.n)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-gray-200">
        <tr className="bg-gray-100">
          <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-gray-600">Total</td>
          <td className="px-3 py-2.5 text-right text-[12.5px] font-bold text-gray-800 tabular-nums">{fmt(total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>
```
Conventions: **sticky first (and often second) column** with matching `bg-*` per row, zebra rows (`i%2`), `hover:bg-purple-50`, right-aligned `tabular-nums` numerics, bold `tfoot` totals, wide tables scroll inside `overflow-x-auto`.

### 7.8 Modal / dialog
```jsx
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
    {/* header — gradient */}
    <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-t-2xl">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow"><BookOpen size={18} /></div>
        <h2 className="text-[15px] font-extrabold text-gray-900">Title</h2>
      </div>
      <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition"><X size={18} /></button>
    </div>
    {/* body — scrolls */}
    <div className="overflow-y-auto px-5 py-4"> … </div>
    {/* footer */}
    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
      <p className="text-[11px] text-gray-400">note</p>
      <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-[12.5px] font-bold hover:bg-purple-700">Got it</button>
    </div>
  </div>
</div>
```
Modal = `flex flex-col` + `max-h-[88vh]` + `shrink-0` header/footer + scrolling body. Same pattern for **navbar dropdowns** (`absolute right-0 mt-2 w-80 max-h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border z-[60]`).

### 7.9 Numbered doc section (for in-app "how it works" panels)
```jsx
const DocsSection = ({ n, title, children }) => (
  <div className="mb-5">
    <h3 className="flex items-center gap-2 text-[14px] font-bold text-gray-800 mb-2">
      <span className="grid place-items-center w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold shrink-0">{n}</span>
      {title}
    </h3>
    <div className="text-[13px] text-gray-600 leading-relaxed space-y-2 pl-7">{children}</div>
  </div>
);
```

---

## 8. Status → tone helper (reused across pages)
```js
const toneForStatus = (s) => {
  const t = String(s || '').toLowerCase();
  if (/disburs|approved|success|complete|active/.test(t)) return 'green';
  if (/reject|declin|fail|cancel|expire/.test(t))         return 'red';
  if (/pending|await|progress|review|initiat|process/.test(t)) return 'amber';
  return 'gray';
};
```
Drive both KPI-card `tone` and badge colors from this so a stage always renders the same color everywhere.

---

## 9. Notifications (navbar bell pattern)
- **Bell** in navbar with a count badge (`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-<tone>-500 text-white text-[10px] font-bold ring-2 ring-white`) + `animate-ping` halo.
- **Dropdown** = the modal-dropdown shape from §7.8 (gradient header, scrolling list, item rows).
- **On new item:** WebAudio chime (`AudioContext` triangle/sine oscillators), a browser `Notification`, and an in-app **flash toast** `fixed bottom-5 right-5 z-[100]` card that auto-dismisses (~6s).
- Poll every 30s; **seed on first load** so pre-existing items don't blast alerts; dedupe by id (or id+stage).

---

## 10. Toasts
`react-hot-toast` — mount `<Toaster />` once. Wrap in a tiny `ToastNotification.{success,error}` helper. Errors: `ToastNotification.error('Export failed')`.

---

## 11. Charts
`recharts` for trends/bars. Keep them theme-consistent: purple/indigo primary series, gray gridlines, `tabular-nums` tooltips. For simple funnels/matrices a plain HTML table (§7.7) is preferred over a chart lib.

---

## 12. CSV export helper (used on every list)
```js
const csvEscape = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename, cols, rows) => {           // cols: { header, value:(row,i)=>… }[]
  const head = cols.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((r, i) => cols.map((c) => csvEscape(c.value(r, i))).join(',')).join('\n');
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' }); // BOM → Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};
// Columns start with { header:'SN', value:(r,i)=>i+1 }, dates trimmed to "YYYY-MM-DD HH:MM", amounts as raw numbers.
```

---

## 13. Conventions & gotchas

- **Arbitrary font sizes** (`text-[12.5px]`) are intentional and everywhere — keep the scale in §4, don't switch to `text-sm/base`.
- **Labels are `uppercase tracking-wide text-gray-500`**, values are `text-gray-800/900 font-bold`.
- **Numbers:** `tabular-nums`, `toLocaleString('en-IN')`, currency with `₹`.
- **Dates in IST** (`Asia/Kolkata`). Format `YYYY-MM-DD HH:MM`. If a backend sends a naive timestamp, be explicit about the timezone (append `+05:30` or format server-side) so the browser doesn't shift it.
- **Icon sizes:** 13–15 in chips/buttons, 18 in KPI tiles, 22 in page headers.
- **Every panel:** `bg-white border border-gray-200/80 rounded-xl shadow-sm`, sections separated by `mb-3`.
- **Empty states:** centered muted text, e.g. `py-20 text-center text-gray-400 italic bg-white border border-gray-200 rounded-xl` with "No data for this period."
- **Loading:** shimmer skeletons (`animate-shimmer` keyframe below) or a `PremiumLoader` spinner.
- **z-index ladder:** navbar `z-10`, sticky table cells `z-10/20`, dropdowns `z-[60]`, modals `z-[100]`, flash toasts `z-[100]`.

`tailwind.config.js` extras to copy:
```js
theme: { extend: {
  keyframes: { shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } } },
  animation: { shimmer: 'shimmer 2s linear infinite' },
}},
plugins: [require('daisyui')],
```

---

### TL;DR for the assistant
White cards on gray, **purple→indigo** brand gradient, Roboto, tiny `uppercase tracking-wide` gray labels over bold `tabular-nums` values, **gradient icon tiles**, rounded-xl panels / rounded-2xl modals / rounded-full chips, **semantic tones** (green/amber/rose/blue/gray) driven by one `toneForStatus`, lucide icons, sticky-column tables with bold totals, and the KPI-card + filter-chip + modal patterns above. Reuse §7 components verbatim.
