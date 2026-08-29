import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trophy, Send, Star, Percent, RefreshCw, Users, X, Phone,
  ChevronLeft, ChevronRight, CheckCircle2, Clock, Sparkles, Crown, BarChart3,
} from "lucide-react";
import { getFeedbackLeaderboard, getFeedbackAgentLinks } from "../../../api-services/Modules/FeedbackChampions";
import PremiumPageLoader from "../../../components/PremiumPageLoader";
import { useAuth } from "../../../custom-hooks/useAuth";

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const RANGE_CHIPS = [
  { key: "", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
];

// Medal styling. `height` drives the Olympic-style podium — gold stands tallest.
const MEDALS = {
  gold: {
    emoji: "🥇", label: "Champion", order: 2, height: "sm:-mt-2",
    card: "from-amber-100 via-yellow-50 to-white border-amber-400",
    glow: "shadow-[0_12px_40px_-8px_rgba(245,158,11,0.55)]",
    ring: "from-amber-400 via-yellow-400 to-amber-500",
    text: "text-amber-700", chip: "bg-amber-500 text-white",
    bar: "from-amber-400 to-yellow-500",
  },
  silver: {
    emoji: "🥈", label: "Runner-up", order: 1, height: "sm:mt-2",
    card: "from-blue-50 via-sky-50 to-white border-blue-200",
    glow: "shadow-[0_10px_30px_-10px_rgba(59,130,246,0.4)]",
    ring: "from-blue-400 via-sky-400 to-blue-500",
    text: "text-blue-600", chip: "bg-blue-500 text-white",
    bar: "from-blue-400 to-sky-500",
  },
  bronze: {
    emoji: "🥉", label: "Third place", order: 3, height: "sm:mt-4",
    card: "from-orange-100 via-amber-50 to-white border-orange-300",
    glow: "shadow-[0_10px_30px_-10px_rgba(234,88,12,0.45)]",
    ring: "from-orange-400 via-amber-500 to-orange-600",
    text: "text-orange-700", chip: "bg-orange-500 text-white",
    bar: "from-orange-400 to-amber-500",
  },
};

const initials = (name) =>
  String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const Kpi = ({ icon, label, value, sub, tone }) => (
  <div className={`flex-1 min-w-[160px] relative overflow-hidden rounded-xl border bg-white px-4 py-3 shadow-sm ${tone}`}>
    <div className="flex items-center gap-1.5 mb-1 text-gray-400">
      {icon}
      <span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-[26px] leading-none font-extrabold text-gray-900">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

// ── Podium card ─────────────────────────────────────────────────────────────
const RANK_NUM = { gold: 1, silver: 2, bronze: 3 };

// One metric: a colored icon on top, the bold value, then a small caption below.
const StatCell = ({ Icon, value, label, color }) => (
  <div className="flex-1 flex flex-col items-center gap-1">
    <Icon size={15} className={color} />
    <span className="text-[14px] font-extrabold text-gray-900 leading-none">{value}</span>
    <span className="text-[8.5px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
  </div>
);

const PodiumCard = ({ row, isMe, topFeedback, onClick }) => {
  const m = MEDALS[row.medal];
  const isGold = row.medal === "gold";
  // Bar length is relative to the leader, so the gap is visible at a glance.
  const share = topFeedback ? Math.max((row.feedback / topFeedback) * 100, 6) : 0;
  return (
    <button
      onClick={onClick}
      title={`See every link ${row.name} sent`}
      style={{ order: m.order }}
      className={`group relative flex-1 min-w-[215px] max-w-[300px] text-left rounded-2xl border bg-gradient-to-b ${m.card} ${m.glow} ${isGold ? "sm:-mt-4 border-2 pt-8" : "sm:mt-3 pt-9"} px-4 pb-4 hover:-translate-y-1 transition-all duration-300`}
    >
      {/* shine sweep on hover */}
      <span className="pointer-events-none absolute inset-y-0 -left-full w-1/2 bg-white/40 skew-x-[-20deg] group-hover:left-[140%] transition-all duration-700 rounded-2xl" />

      {isGold ? (
        /* Champion emblem — floating crown flanked by laurels + a CHAMPION ribbon */
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
          <div className="flex items-center">
            <span className="text-amber-400/70 text-[19px] -mr-1 select-none scale-x-[-1]">🌿</span>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 grid place-items-center text-white shadow-lg ring-4 ring-white">
              <Crown size={22} fill="currentColor" />
            </div>
            <span className="text-amber-400/70 text-[19px] -ml-1 select-none">🌿</span>
          </div>
          <span className="-mt-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8.5px] font-black uppercase tracking-wider shadow-sm">
            Champion
          </span>
        </div>
      ) : (
        <>
          {/* rank number badge (top-left) + accent star (top-right) */}
          <span className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-full grid place-items-center text-white text-[11px] font-black shadow bg-gradient-to-br ${m.ring}`}>
            {RANK_NUM[row.medal]}
          </span>
          <Star size={16} className={`absolute top-3 right-3 ${m.text}`} fill="currentColor" />
        </>
      )}

      {/* avatar + name + feedback count */}
      <div className="relative flex items-center gap-2.5">
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${m.ring} grid place-items-center text-white text-[13px] font-black shadow ring-2 ring-white shrink-0`}>
          {initials(row.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-gray-900 truncate flex items-center gap-1">
            {row.name}
            {isMe && (
              <span className="px-1 py-px rounded bg-purple-600 text-white text-[8.5px] font-bold uppercase">You</span>
            )}
          </p>
          <p className={`text-[9.5px] font-bold uppercase tracking-wide ${m.text}`}>{m.label}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[24px] leading-none font-black ${m.text}`}>{fmtNum(row.feedback)}</p>
          <p className="text-[8.5px] font-semibold text-gray-500 uppercase">feedback</p>
        </div>
      </div>

      {/* progress bar (relative to the leader) */}
      <div className="relative mt-3 h-1.5 rounded-full bg-white/70 overflow-hidden border border-white/80">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${m.bar} transition-all duration-700`}
          style={{ width: `${share}%` }}
        />
      </div>

      {/* metrics — icon + value + caption, three columns */}
      <div className="relative mt-3 flex items-stretch">
        <StatCell Icon={Send} value={fmtNum(row.sent)} label="Sent" color={m.text} />
        <span className="w-px bg-gray-200/70 my-0.5" />
        <StatCell Icon={BarChart3} value={`${row.conversion}%`} label="Conv" color={m.text} />
        <span className="w-px bg-gray-200/70 my-0.5" />
        <StatCell Icon={Star} value={row.avgRating != null ? `${row.avgRating}★` : "—"} label="Rating" color={m.text} />
      </div>
    </button>
  );
};

// ── Per-agent link log ──────────────────────────────────────────────────────
const LinksModal = ({ agent, dateParams, onClose }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 10;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getFeedbackAgentLinks({ email: agent.email, perPage, currentPage: page, ...dateParams })
      .then((res) => {
        if (!alive) return;
        setRows(res?.data?.data?.data || []);
        setTotal(res?.data?.data?.pagination?.total || 0);
      })
      .catch(() => { if (alive) { setRows([]); setTotal(0); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agent.email, page, dateParams]);

  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="relative px-6 py-4 bg-gradient-to-br from-purple-50 via-violet-50 to-white border-b border-gray-100">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 grid place-items-center text-white font-bold shadow">
              {initials(agent.name)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{agent.name}</h3>
              <p className="text-[12px] text-gray-500">
                {fmtNum(agent.sent)} links sent · {fmtNum(agent.feedback)} filled · {agent.conversion}% conversion
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-[12.5px] min-w-[620px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2.5 font-medium">Phone</th>
                <th className="px-3 py-2.5 font-medium">Link Sent</th>
                <th className="px-3 py-2.5 font-medium">Result</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No links sent in this period.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={`${r.phone}-${i}`} className="border-b border-gray-50 hover:bg-purple-50/30">
                  <td className="px-5 py-2.5">
                    <a href={`tel:${r.phone}`} className="font-mono text-purple-700 hover:underline inline-flex items-center gap-1">
                      <Phone size={11} /> {r.phone}
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{fmtDT(r.sent_at)}</td>
                  <td className="px-3 py-2.5">
                    {r.is_credited ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                        title={r.filled_after
                          ? "Filled after this link went out."
                          : "This customer's feedback predates the link — still counted, but worth knowing."}
                      >
                        <CheckCircle2 size={11} /> Filled{r.filled_after === false ? " (earlier)" : ""}
                      </span>
                    ) : r.feedback_id ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
                        title="This customer's feedback is counted once, on the most recent link sent to them."
                      >
                        <CheckCircle2 size={11} /> Counted once
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                        <Clock size={11} /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{r.customer_name || "—"}</td>
                  <td className="px-3 py-2.5">
                    {r.overall_rating != null ? (
                      <span className="font-semibold text-amber-600">{r.overall_rating}★</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 mt-auto">
          <p className="text-[12px] text-gray-500">{fmtNum(total)} links · page {page} / {totalPages}</p>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={15} /></button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main page ───────────────────────────────────────────────────────────────
const FeedbackChampions = () => {
  const { user } = useAuth();
  const myEmail = String(user?.email || "").toLowerCase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [range, setRange] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [agent, setAgent] = useState(null);

  const dateParams = useMemo(
    () => ((!range && fromDate && toDate) ? { fromDate, toDate } : range ? { type: range } : {}),
    [range, fromDate, toDate],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFeedbackLeaderboard(dateParams);
      setData(res?.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [dateParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const board = data?.leaderboard || [];
  const totals = data?.totals || {};
  const podium = board.filter((r) => r.medal);
  const topFeedback = podium[0]?.feedback || 0;
  const me = board.find((r) => String(r.email || "").toLowerCase() === myEmail);
  const isMe = (r) => String(r.email || "").toLowerCase() === myEmail;

  if (firstLoad) {
    return (
      <div className="min-w-0 w-full max-w-full overflow-x-hidden">
        <PremiumPageLoader
          theme="purple"
          title="Loading Feedback Champions"
          brandLabel="Call-Centre Leaderboard"
          icon={Trophy}
          phrases={["Counting links sent…", "Matching filled feedback…", "Awarding medals…"]}
          tiles={[{ label: "Links Sent" }, { label: "Feedback" }, { label: "Conversion" }]}
          progressLabel="Preparing the leaderboard"
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden px-1 pb-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-6 mb-4 shadow-lg">
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-500 grid place-items-center text-amber-900 shadow-lg ring-4 ring-white/20">
            <Trophy size={28} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[26px] font-black text-white tracking-tight flex items-center gap-2">
              Feedback Champions
              <Sparkles size={18} className="text-amber-300" />
            </h1>
            <p className="text-[13px] text-white/80">
              Every feedback link you send counts. Fill the board and take the crown 🏆
            </p>
          </div>

          {/* Your own standing — the reason this page is open to everyone */}
          {me && (
            <div className="ml-auto rounded-xl bg-white/15 backdrop-blur border border-white/25 px-4 py-2.5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Your rank</p>
              <p className="text-[22px] font-black leading-none mt-0.5">
                #{me.rank}
                <span className="text-[12px] font-semibold text-white/80 ml-2">
                  {fmtNum(me.feedback)} feedback · {fmtNum(me.sent)} sent
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {RANGE_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => { setRange(c.key); setFromDate(""); setToDate(""); }}
              className={`px-3 py-2 text-[12.5px] font-medium transition ${!fromDate && !toDate && range === c.key ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1.5">
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setRange(""); }}
            className="px-2 py-2 text-[12.5px] rounded-lg border border-gray-200 text-gray-600" />
          <span className="text-gray-400 text-xs">→</span>
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setRange(""); }}
            className="px-2 py-2 text-[12.5px] rounded-lg border border-gray-200 text-gray-600" />
        </div>
        <button onClick={fetchData} title="Refresh" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
        <span className="text-[11px] text-gray-400 ml-auto">Date filter applies to when the link was sent</span>
      </div>

      {/* Totals */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Kpi icon={<Users size={13} />} label="Agents" value={fmtNum(totals.agents)} sub="sent at least one link" tone="border-purple-200" />
        <Kpi icon={<Send size={13} />} label="Links Sent" value={fmtNum(totals.sent)} tone="border-blue-200" />
        <Kpi icon={<Star size={13} />} label="Feedback Received" value={fmtNum(totals.feedback)} tone="border-emerald-200" />
        <Kpi icon={<Percent size={13} />} label="Conversion" value={`${totals.conversion || 0}%`} sub="customers who gave feedback" tone="border-amber-200" />
      </div>

      {/* Podium — or a nudge when nobody has converted yet */}
      {podium.length > 0 ? (
        <div className="mb-6">
          <div className="mb-2">
            <p className="text-[13px] font-extrabold text-gray-800 flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-500" /> Top Performers
            </p>
            <p className="text-[11px] text-gray-400">The agents who are driving the best results!</p>
          </div>
          <div className="flex flex-wrap items-start justify-center gap-4 pt-6">
            {podium.map((r) => (
              <PodiumCard
                key={r.email}
                row={r}
                isMe={isMe(r)}
                topFeedback={topFeedback}
                onClick={() => setAgent(r)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border-2 border-dashed border-purple-200 bg-gradient-to-br from-purple-50/60 to-white p-8 text-center">
          <div className="text-[44px] leading-none mb-2">🏆</div>
          <p className="text-[16px] font-bold text-gray-800">The podium is still empty</p>
          <p className="text-[13px] text-gray-500 mt-1">
            {totals.sent
              ? `${fmtNum(totals.sent)} link${totals.sent === 1 ? "" : "s"} sent so far — the first agent whose customer fills the form takes Gold.`
              : "Send a feedback link to a customer to get on the board."}
          </p>
        </div>
      )}

      {/* Full leaderboard */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <span className="w-1 h-5 rounded-full bg-purple-600" />
          <h2 className="text-[15px] font-bold text-gray-800">Leaderboard</h2>
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100">
            {fmtNum(board.length)} AGENTS
          </span>
          <span className="ml-auto text-[11px] text-gray-400 hidden sm:block">
            One customer = one point, credited to the latest link sent to them
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[760px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Agent</th>
                <th className="px-3 py-2.5 font-medium text-right">Links Sent</th>
                <th className="px-3 py-2.5 font-medium text-right">Feedback</th>
                <th className="px-3 py-2.5 font-medium text-right">Conversion</th>
                <th className="px-3 py-2.5 font-medium text-right">Avg Rating</th>
                <th className="px-3 py-2.5 font-medium text-right">Promoters</th>
                <th className="px-3 py-2.5 font-medium">Last Sent</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : board.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No feedback links sent in this period.</td></tr>
              ) : board.map((r) => (
                <tr
                  key={r.email}
                  onClick={() => setAgent(r)}
                  className={`border-b border-gray-50 transition cursor-pointer ${
                    isMe(r) ? "bg-purple-50/70 hover:bg-purple-100/70"
                    // Roster agents who sent nothing sit on the board but shouldn't
                    // compete visually with the ones who did.
                    : r.sent === 0 ? "opacity-55 hover:opacity-100 hover:bg-gray-50"
                    : "hover:bg-purple-50/30"}`}
                  title="See every link this agent sent"
                >
                  <td className="px-5 py-3 text-gray-400 tabular-nums">
                    {r.medal ? <span className="text-[18px]">{MEDALS[r.medal].emoji}</span> : r.rank}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full grid place-items-center text-white text-[11px] font-bold shrink-0 bg-gradient-to-br ${r.medal ? MEDALS[r.medal].ring : "from-purple-500 to-indigo-600"}`}>
                        {initials(r.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
                          {r.name}
                          {isMe(r) && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-600 text-white text-[9px] font-bold uppercase">You</span>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">{fmtNum(r.sent)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-700">{fmtNum(r.feedback)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className={`font-semibold ${r.conversion >= 50 ? "text-green-600" : r.conversion >= 20 ? "text-amber-600" : "text-gray-500"}`}>
                      {r.conversion}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-600 font-semibold">
                    {r.avgRating != null ? `${r.avgRating}★` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">{fmtNum(r.promoters)}</td>
                  <td className="px-3 py-3 text-gray-500">{fmtDT(r.lastSentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {agent && <LinksModal agent={agent} dateParams={dateParams} onClose={() => setAgent(null)} />}
    </div>
  );
};

export default FeedbackChampions;
