import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeIndianRupee, Clock, Phone, CheckCircle2, X, TrendingUp, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../custom-hooks/useAuth';
import { isCallCenterRole } from '../../custom-hooks/callCenterBands';
import { getCallCenterAgentId } from '../../custom-hooks/callCenterPool';
import { getRamFinCorpHotLeads } from '../../api-services/Modules/RamFinCorpFunnel';
import { io } from 'socket.io-client';

// RamFinCorp hot leads — users RamFinCorp came back BRE APPROVED on, WITH an
// offer amount. These are the ones worth calling: the lender has already said
// yes and named a number, so the agent opens with "₹19,660 approved" instead of
// a cold pitch.
//
// 'Proceed to bank' is not here on purpose — it is a different BRE outcome and
// never carries an offeredAmount, so those rows would give an agent nothing to
// quote. Same rule the funnel's BRE Approved column uses.
// 5 minutes. At 30s these four bells together made ~6 DB-backed calls a minute
// per open tab, all day, whether or not anyone was looking at them — the bells
// were quietly the most frequent load on the database in the whole CMS.
const POLL_MS = 5 * 60 * 1000;
const WITHIN_HOURS = 24;

const fmtInr = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`);

const fmtWhen = (v) => {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(v);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  const rel = mins < 1 ? 'just now'
    : mins < 60 ? `${mins}m ago`
      : mins < 1440 ? `${Math.round(mins / 60)}h ago`
        : `${Math.round(mins / 1440)}d ago`;
  return `${d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${rel}`;
};

const detailPathFor = (it) =>
  `${it.scope === 'short' ? '/short-offer-leads' : '/offer-leads'}/${encodeURIComponent(it.id)}`;

export default function RamFinCorpOfferAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [disbursedCount, setDisbursedCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const seenRef = useRef(null);
  const flashTimer = useRef(null);
  const boxRef = useRef(null);

  // Super Admin + management see it for oversight; call-center agents see it
  // because they are the ones who act on it.
  const canSee = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return role === 'super-admin' || role === 'dev' || role === 'management' || role === 'mv-page-admin'
      || isCallCenterRole(user?.role);
  }, [user]);

  // Round-robin scoping: an agent sees only the offers on leads assigned to
  // them. Super Admin / management have no agent id and get the full list.
  const agentId = useMemo(() => getCallCenterAgentId(user), [user]);

  const poll = useCallback(async () => {
    try {
      const res = await getRamFinCorpHotLeads({
        withinHours: WITHIN_HOURS,
        agentId: agentId || undefined,
      });
      const payload = res?.data?.data || {};
      const list = payload.data || [];
      setItems(list);
      setTotalAmount(payload.totalOfferAmount || 0);
      setPendingCount(payload.pendingCount ?? (payload.data || []).length);
      setDisbursedCount(payload.disbursedCount || 0);

      // Flash only for offers that appeared AFTER this tab opened. On the first
      // poll we just record what exists — otherwise every reload would toast the
      // entire backlog.
      const ids = new Set(list.map((x) => x.phone));
      if (seenRef.current === null) {
        seenRef.current = ids;
        return;
      }
      const fresh = list.find((x) => !seenRef.current.has(x.phone));
      seenRef.current = ids;
      if (fresh) {
        setFlash(fresh);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 8000);
      }
    } catch {
      /* a failed poll leaves the last good list on screen */
    }
  }, [agentId]);

  useEffect(() => {
    if (!canSee) return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { clearInterval(id); clearTimeout(flashTimer.current); };
  }, [poll, canSee]);

  // Live updates.
  //
  // The server says "an approved RamFinCorp offer landed" and we run the SAME
  // poll() as always — so the token check and the per-agent filtering still decide
  // what this user sees. Nothing about the data path changes; it just stops
  // waiting for the next 5-minute tick.
  //
  // The interval above is KEPT on purpose. If the socket cannot connect — a proxy
  // that blocks WebSocket, a laptop waking from sleep — the bell behaves exactly
  // as it did before this existed.
  useEffect(() => {
    if (!canSee) return undefined;
    // VITE_API_URL ends in /api; socket.io lives at the server root.
    const url = String(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
      || window.location.origin;
    const socket = io(url, {
      // Token in the handshake, not the URL — a URL token lands in the access log.
      auth: { token: localStorage.getItem('access_token') || '' },
    });
    socket.on('ramfincorp:new', poll);
    return () => socket.disconnect();
  }, [poll, canSee]);

  useEffect(() => { seenRef.current = null; }, [agentId]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!canSee) return null;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
        title={`RamFinCorp offers — ${items.length} approved in the last ${WITHIN_HOURS}h`}
        aria-label="RamFinCorp offer alerts"
      >
        <TrendingUp size={18} />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white text-[9.5px] font-bold shadow">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-h-[70vh] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-emerald-50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-gray-800 inline-flex items-center gap-1.5">
                <TrendingUp size={14} className="text-teal-600" /> RamFinCorp · Approved Offers
              </p>
              <span className="text-[11px] font-semibold text-gray-500">
                {pendingCount} to call{disbursedCount > 0 && <span className="text-emerald-600"> · {disbursedCount} paid</span>}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">
              BRE approved · last {WITHIN_HOURS}h
              {totalAmount > 0 && <span className="font-semibold text-teal-700"> · {fmtInr(totalAmount)}</span>}
            </p>
          </div>

          <div className="overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <CheckCircle2 size={22} className="text-gray-300" />
                <p className="text-[12.5px] text-gray-400">No approved offers in the last {WITHIN_HOURS}h.</p>
              </div>
            ) : items.map((it) => (
              <div
                key={`${it.phone}-${it.createdAt}`}
                className={`px-4 py-3 border-b border-gray-50 transition ${
                  it.disbursed ? 'bg-emerald-50/50 hover:bg-emerald-50 opacity-70' : 'hover:bg-teal-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate" title={it.name}>
                      {it.name || 'Unnamed lead'}
                    </p>
                    {/* The amount is the whole point of the alert — lead with it. */}
                    <p className="text-[13px] font-bold text-teal-700 inline-flex items-center gap-1 mt-0.5">
                      <BadgeIndianRupee size={12} /> {fmtInr(it.offerAmount)}
                    </p>
                    {/* The number is PLAIN TEXT, not a tel: link — agents copy it
                        into their dialer, and a link hijacks the click so it
                        cannot be selected. `select-all` makes one click grab the
                        whole number. The icon beside it keeps tap-to-call. */}
                    {it.phone && (
                      <p className="mt-0.5 flex items-center gap-1 w-fit">
                        <a
                          href={`tel:${it.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-teal-500 hover:text-teal-700"
                          title="Call this lead"
                        >
                          <Phone size={11} />
                        </a>
                        <span className="text-[12.5px] font-bold font-mono text-gray-800 select-all cursor-text">
                          {it.phone}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {it.disbursed ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700"
                        title={`Already disbursed${it.disbursedAmount ? ` — ${fmtInr(it.disbursedAmount)}` : ''}`}
                      >
                        <CheckCircle2 size={9} /> Paid
                      </span>
                    ) : (
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                        it.scope === 'high' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {it.scope === 'high' ? 'High' : 'Short'}
                      </span>
                    )}
                    {it.id != null && (
                      <button
                        onClick={() => { setOpen(false); navigate(detailPathFor(it)); }}
                        className="w-6 h-6 grid place-items-center rounded-full border border-teal-200 text-teal-600 hover:bg-teal-100 hover:border-teal-300 transition"
                        title="Open this lead's detail page"
                        aria-label="View lead details"
                      >
                        <Info size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                  <Clock size={11} /> {fmtWhen(it.createdAt)}
                  {it.disbursed ? (
                    <span className="ml-auto text-[10.5px] font-bold text-emerald-700 whitespace-nowrap">
                      Disbursed {it.disbursedAmount ? fmtInr(it.disbursedAmount) : ''}
                    </span>
                  ) : it.utmMedium ? (
                    <span className="ml-auto text-gray-400 truncate max-w-[110px]">{it.utmMedium}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flash toast, portaled to <body> so the navbar's backdrop-filter cannot
          trap a `fixed` element at the top of the page. */}
      {flash && createPortal((
        <div className="fixed bottom-5 right-5 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-2xl shadow-teal-500/20 border border-teal-200 max-w-[320px]">
          <div className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0 bg-gradient-to-br from-teal-500 to-emerald-500">
            <BadgeIndianRupee size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-800">💰 RamFinCorp · Offer Approved</p>
            <p className="text-[12px] text-gray-600 truncate">
              {fmtInr(flash.offerAmount)} · {flash.name || 'Unnamed lead'}
            </p>
            {flash.phone && (
              <p className="flex items-center gap-1 mt-0.5 w-fit">
                <a href={`tel:${flash.phone}`} className="shrink-0 text-teal-600 hover:text-teal-800" title="Call this lead">
                  <Phone size={11} />
                </a>
                <span className="text-[12px] font-bold font-mono text-teal-700 select-all cursor-text">
                  {flash.phone}
                </span>
              </p>
            )}
          </div>
          <button onClick={() => setFlash(null)} className="ml-auto text-gray-300 hover:text-gray-500 shrink-0">
            <X size={14} />
          </button>
        </div>
      ), document.body)}
    </div>
  );
}
