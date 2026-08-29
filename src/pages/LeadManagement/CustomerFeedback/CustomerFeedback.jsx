import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Star, Search, RefreshCw, X, Phone, MapPin, IndianRupee, Clock,
  MessageSquare, ChevronLeft, ChevronRight, Eye, BadgeCheck, Smile, Quote,
} from "lucide-react";
import { getCustomerFeedback, getCustomerFeedbackById } from "../../../api-services/Modules/CustomerFeedback";

// ── helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};
const fmtINR = (n) => (n == null || n === "" ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);
const initials = (name) =>
  String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

// NPS 0-10 → promoter / passive / detractor
const npsMeta = (n) => {
  if (n == null) return { label: "—", cls: "bg-gray-100 text-gray-500 border-gray-200" };
  if (n >= 9) return { label: `Promoter · ${n}`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (n >= 7) return { label: `Passive · ${n}`, cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: `Detractor · ${n}`, cls: "bg-rose-50 text-rose-700 border-rose-200" };
};

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : (() => { try { return JSON.parse(v); } catch { return []; } })());

const Stars = ({ value = 0, size = 14 }) => {
  const v = Number(value) || 0;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= v ? "text-amber-400 fill-amber-400" : "text-gray-300"} />
      ))}
    </span>
  );
};

const DATE_PRESETS = [
  { key: "", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
];

// ── Detail modal ─────────────────────────────────────────────────────────────
const Chip = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${tones[tone]}`}>{children}</span>;
};

const SubScore = ({ label, value }) => (
  <div>
    <div className="flex items-center justify-between text-[11px] mb-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-gray-700 tabular-nums">{value ?? "—"}/2</span>
    </div>
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${Math.min(((Number(value) || 0) / 2) * 100, 100)}%` }} />
    </div>
  </div>
);

const Field = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-[13px] text-gray-800 mt-0.5 break-words">{value ?? "—"}</p>
  </div>
);

const DetailModal = ({ id, onClose }) => {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCustomerFeedbackById(id)
      .then((res) => { if (alive) setRow(res?.data?.data || null); })
      .catch(() => { if (alive) setRow(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const purposes = asArray(row?.purposes);
  const help = asArray(row?.help);
  const improve = asArray(row?.improve);
  const service = row?.service || {};
  const promote = row?.marketing_consent?.promoteFeedback;

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="relative px-6 py-5 bg-gradient-to-br from-purple-50 via-violet-50 to-white border-b border-gray-100">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70">
            <X size={18} />
          </button>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : !row ? (
            <p className="text-rose-600 text-sm">Feedback not found.</p>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 grid place-items-center text-white font-bold text-lg shadow">
                {initials(row.customer_name)}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">{row.customer_name || "Anonymous"}</h3>
                <p className="text-[12px] text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  <span className="inline-flex items-center gap-1"><Phone size={12} /> {row.customer_phone || row.phone || "—"}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={12} /> {row.customer_city || "—"}</span>
                  <span className="inline-flex items-center gap-1"><IndianRupee size={12} /> {fmtINR(row.loan_amount)}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {row && !loading && (
          <div className="overflow-y-auto px-6 py-5 space-y-6">
            {/* ratings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Overall Rating</p>
                <div className="flex items-center gap-2">
                  <Stars value={row.overall_rating} size={18} />
                  <span className="text-sm font-bold text-gray-700">{row.overall_rating ?? "—"}/5</span>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">NPS</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${npsMeta(row.nps).cls}`}>
                  {npsMeta(row.nps).label}
                </span>
                {row.nps_reason ? <p className="text-[12px] text-gray-600 mt-2 italic">“{row.nps_reason}”</p> : null}
              </div>
            </div>

            {/* service sub-scores */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Service Scores</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <SubScore label="Apply" value={row.service_apply ?? service.apply} />
                <SubScore label="Understand" value={row.service_understand ?? service.understand} />
                <SubScore label="Speed" value={row.service_speed ?? service.speed} />
                <SubScore label="Support" value={row.service_support ?? service.support} />
              </div>
            </div>

            {/* impact story */}
            {row.impact_story ? (
              <div className="rounded-xl bg-indigo-50/50 border border-indigo-100 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500 mb-1 flex items-center gap-1.5"><MessageSquare size={13} /> Impact Story</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{row.impact_story}</p>
              </div>
            ) : null}

            {/* multi-selects */}
            {(purposes.length || row.purpose_other) ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Loan Purposes</p>
                <div className="flex flex-wrap gap-1.5">
                  {purposes.map((p, i) => <Chip key={i} tone="blue">{p}</Chip>)}
                  {row.purpose_other ? <Chip tone="blue">Other: {row.purpose_other}</Chip> : null}
                </div>
              </div>
            ) : null}
            {(help.length || row.help_other) ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">How it Helped</p>
                <div className="flex flex-wrap gap-1.5">
                  {help.map((h, i) => <Chip key={i} tone="purple">{h}</Chip>)}
                  {row.help_other ? <Chip tone="purple">Other: {row.help_other}</Chip> : null}
                </div>
              </div>
            ) : null}
            {(improve.length || row.improve_note) ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Wants Improved</p>
                <div className="flex flex-wrap gap-1.5">
                  {improve.map((h, i) => <Chip key={i}>{h}</Chip>)}
                  {row.improve_note ? <Chip>Note: {row.improve_note}</Chip> : null}
                </div>
              </div>
            ) : null}

            {/* consent + meta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
              <Field label="Submission ID" value={row.submission_id} />
              <Field label="Source" value={row.source} />
              <Field label="Attribution" value={row.attribution} />
              <Field label="Time Spent" value={row.seconds_spent != null ? `${row.seconds_spent}s` : "—"} />
              <Field label="Submitted" value={fmtDate(row.submitted_at || row.createdAt)} />
              <Field label="IP" value={row.ip_address} />
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              {row.promote_feedback_granted ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  <BadgeCheck size={13} /> Promotion consent granted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">
                  No promotion consent
                </span>
              )}
              {promote?.scope ? <span className="text-gray-400 text-[11px]">({promote.scope})</span> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Shareable flip card ──────────────────────────────────────────────────────
// A replica of the form's testimonial card: FRONT shows the customer's quote +
// name/city; tapping flips to a personalised "note from Cready" on the BACK.
const AVATAR_EMOJI = ["🙂", "😊", "😄", "🧑", "👩", "👨", "🧔", "👵", "🧑‍🦱", "👳"];

const humanList = (arr) => {
  const a = (arr || []).filter(Boolean).map(String);
  if (!a.length) return "";
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
};

const CreadyMark = () => (
  <span className="inline-flex items-center gap-1.5 text-white font-semibold text-[13px]">
    <span className="w-4 h-4 rounded-full border-2 border-white/80 border-t-transparent inline-block" />
    cready
  </span>
);

const FlipCardModal = ({ id, onClose }) => {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setFlipped(false);
    getCustomerFeedbackById(id)
      .then((res) => { if (alive) setRow(res?.data?.data || null); })
      .catch(() => { if (alive) setRow(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const firstName = String(row?.customer_name || "there").trim().split(/\s+/)[0];
  const story = row?.impact_story || row?.nps_reason || "Thank you for trusting us";
  const purposes = asArray(row?.purposes);
  const purposeLine = purposes.length
    ? `You used this loan for ${humanList(purposes)}, and it helped you find some financial breathing room.`
    : `This loan helped you find some financial breathing room.`;
  const avatar = AVATAR_EMOJI[(Number(row?.avatar_style) || 0) % AVATAR_EMOJI.length];

  return (
    <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"><X size={20} /></button>

      {loading ? (
        <p className="text-white/80 text-sm">Loading…</p>
      ) : !row ? (
        <p className="text-rose-300 text-sm">Feedback not found.</p>
      ) : (
        <>
          <div className="w-full max-w-[560px]" style={{ perspective: "1600px" }} onClick={(e) => e.stopPropagation()}>
            <div
              className="relative w-full aspect-[16/10] cursor-pointer transition-transform duration-700"
              style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              onClick={() => setFlipped((f) => !f)}
              title="Tap to flip"
            >
              {/* ── FRONT ── */}
              <div
                className="absolute inset-0 rounded-[28px] flex flex-col overflow-hidden shadow-2xl"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              >
                {/* layered background: base gradient, aurora blobs, a spotlight
                    behind the quote and a fine dot grid — so the middle of the
                    card reads as designed space rather than emptiness */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />
                <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-fuchsia-400/30 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-indigo-300/25 blur-3xl" />
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.13]"
                  style={{
                    backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                    backgroundSize: "16px 16px",
                    maskImage: "radial-gradient(ellipse at center, #000 20%, transparent 72%)",
                    WebkitMaskImage: "radial-gradient(ellipse at center, #000 20%, transparent 72%)",
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-6 top-1/3 h-40"
                  style={{ background: "radial-gradient(ellipse at center, rgba(255,255,255,0.20), transparent 70%)" }}
                />
                {/* glass sheen along the top edge */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/15 to-transparent" />

                <div className="relative flex flex-col h-full p-5">
                  {/* identity + score */}
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-300/60 to-fuchsia-300/60 blur-[6px]" />
                      <div className="relative w-14 h-14 rounded-full bg-white grid place-items-center text-[28px] shadow-lg ring-2 ring-white/70">
                        {avatar}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-white font-bold text-[16px] leading-tight truncate">
                        {row.customer_name || "Anonymous"}
                      </p>
                      {row.customer_city && (
                        <p className="text-white/60 text-[11.5px] truncate flex items-center gap-1">
                          <MapPin size={10} /> {row.customer_city}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 mt-1.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={13}
                            className={i <= (row.overall_rating || 0)
                              ? "text-amber-300 fill-amber-300 drop-shadow-[0_1px_3px_rgba(252,211,77,0.6)]"
                              : "text-white/20"}
                          />
                        ))}
                        {row.overall_rating != null && (
                          <span className="text-white/70 text-[11px] font-bold ml-0.5">{row.overall_rating}.0</span>
                        )}
                      </span>
                    </div>
                    {row.nps != null && (
                      <div className="shrink-0 w-[52px] h-[52px] rounded-2xl bg-white/12 border border-white/25 backdrop-blur-md grid place-items-center shadow-inner">
                        <span className="text-white text-[19px] font-black leading-none">{row.nps}</span>
                        <span className="text-white/55 text-[8px] font-bold uppercase tracking-[0.14em] mt-0.5">NPS</span>
                      </div>
                    )}
                  </div>

                  {/* the quote — hero of the card, framed by matching marks */}
                  <div className="relative flex-1 grid place-items-center px-1">
                    <span className="pointer-events-none absolute left-0 top-1 text-[64px] leading-none font-serif text-white/20 select-none">“</span>
                    <span className="pointer-events-none absolute right-0 bottom-0 text-[64px] leading-none font-serif text-white/20 select-none">”</span>
                    <p className="relative text-white text-[19px] font-semibold italic leading-relaxed text-center px-5"
                       style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      {story}
                    </p>
                  </div>

                  {/* context chips */}
                  {(purposes.length > 0 || row.loan_amount || row.nps >= 9) && (
                    <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                      {row.nps >= 9 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-emerald-100 text-[10.5px] font-bold backdrop-blur-sm">
                          <BadgeCheck size={11} /> Promoter
                        </span>
                      )}
                      {row.loan_amount ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/20 border border-white/30 text-white text-[10.5px] font-bold backdrop-blur-sm">
                          {fmtINR(row.loan_amount)}
                        </span>
                      ) : null}
                      {purposes.slice(0, 3).map((p, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/85 text-[10.5px] font-medium capitalize backdrop-blur-sm">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-white/15 flex items-center justify-between">
                    <span className="text-white/45 text-[10.5px]">Shared with permission</span>
                    <CreadyMark />
                  </div>
                </div>
              </div>

              {/* ── BACK ── */}
              <div
                className="absolute inset-0 rounded-[28px] p-6 flex flex-col bg-gradient-to-br from-purple-700 via-violet-700 to-indigo-800 shadow-2xl overflow-hidden"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.22em]">A note from Cready</p>
                <div className="mt-3 space-y-2.5 text-white/90 text-[13px] leading-relaxed overflow-y-auto pr-1">
                  <p>Dear {firstName},</p>
                  <p><span className="italic">{story}</span> — your words, and the whole reason we do this.</p>
                  <p>{purposeLine}</p>
                  <p>Your words go to the team this week, and they&apos;ll shape what we build next.</p>
                  <p className="pt-1">With gratitude,<br /><span className="font-bold">Team Cready</span> <span className="text-pink-300">♥</span></p>
                </div>
                <div className="mt-auto pt-3 border-t border-white/15 flex items-center justify-between">
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={16} className={s <= (row.overall_rating || 0) ? "text-green-400 fill-green-400" : "text-white/25"} />
                    ))}
                  </span>
                  <CreadyMark />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-white/70 text-[12.5px] inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Tap the card — there&apos;s a note for you on the back
          </p>
        </>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const CustomerFeedback = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [cardId, setCardId] = useState(null);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateType, setDateType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const useCustom = !dateType && fromDate && toDate;
      const res = await getCustomerFeedback({
        search, perPage, currentPage: page,
        type: dateType || undefined,
        fromDate: useCustom ? fromDate : undefined,
        toDate: useCustom ? toDate : undefined,
      });
      setRows(res?.data?.data?.data || []);
      setTotal(res?.data?.data?.pagination?.total || 0);
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, page, dateType, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const setPreset = (key) => { setDateType(key); setFromDate(""); setToDate(""); setPage(1); };
  const clearAll = () => { setDateType(""); setFromDate(""); setToDate(""); setSearchInput(""); setSearch(""); setPage(1); };

  const startIdx = useMemo(() => (page - 1) * perPage, [page]);

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden px-1 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 via-violet-50 to-white border border-purple-100 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 grid place-items-center text-white shadow">
            <Smile size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Feedback</h1>
            <p className="text-[13px] text-gray-500">Testimonials & CSAT from the Cready feedback form — ratings, NPS and stories.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone, city or submission id…"
            className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg bg-gray-50 border border-gray-200 outline-none focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-2 text-[12.5px] font-medium transition ${!fromDate && !toDate && dateType === p.key ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1.5">
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setDateType(""); setPage(1); }}
            className="px-2 py-2 text-[12.5px] rounded-lg border border-gray-200 text-gray-600" />
          <span className="text-gray-400 text-xs">→</span>
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setDateType(""); setPage(1); }}
            className="px-2 py-2 text-[12.5px] rounded-lg border border-gray-200 text-gray-600" />
        </div>
        <button onClick={fetchData} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
        <button onClick={clearAll} className="px-3 py-2 text-[12.5px] font-medium text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-50">
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-purple-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Feedback</h2>
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100">{total} ENTRIES</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[820px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Phone</th>
                <th className="px-3 py-2.5 font-medium">Loan</th>
                <th className="px-3 py-2.5 font-medium">Rating</th>
                <th className="px-3 py-2.5 font-medium">NPS</th>
                <th className="px-3 py-2.5 font-medium">Submitted</th>
                <th className="px-3 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No feedback found.</td></tr>
              ) : rows.map((r, i) => {
                const nm = npsMeta(r.nps);
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-purple-50/40 transition cursor-pointer" onClick={() => setDetailId(r.id)}>
                    <td className="px-5 py-3 text-gray-400 tabular-nums">{startIdx + i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 grid place-items-center text-white text-[11px] font-bold shrink-0">{initials(r.customer_name)}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{r.customer_name || "Anonymous"}</p>
                          <p className="text-[11px] text-gray-400 inline-flex items-center gap-1"><MapPin size={10} /> {r.customer_city || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-600">{r.customer_phone || r.phone || "—"}</td>
                    <td className="px-3 py-3 tabular-nums text-gray-700">{fmtINR(r.loan_amount)}</td>
                    <td className="px-3 py-3"><Stars value={r.overall_rating} /></td>
                    <td className="px-3 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${nm.cls}`}>{nm.label}</span></td>
                    <td className="px-3 py-3 text-gray-500 text-[12px]">{fmtDate(r.submitted_at || r.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setCardId(r.id); }}
                          title="View testimonial card"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm transition"
                        >
                          <Quote size={13} /> Card
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetailId(r.id); }}
                          title="View full details"
                          className="w-7 h-7 grid place-items-center rounded-full border border-purple-200 text-purple-600 hover:bg-purple-100 transition"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-[12px] text-gray-500">
            {total === 0 ? "0" : `${startIdx + 1}–${Math.min(startIdx + perPage, total)}`} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={15} /></button>
            <span className="px-2 text-[12.5px] text-gray-600 tabular-nums">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {detailId != null && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {cardId != null && <FlipCardModal id={cardId} onClose={() => setCardId(null)} />}
    </div>
  );
};

export default CustomerFeedback;
