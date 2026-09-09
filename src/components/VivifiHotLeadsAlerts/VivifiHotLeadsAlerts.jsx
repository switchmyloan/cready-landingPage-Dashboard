import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, CheckCircle2, X, Info, BadgeIndianRupee, Phone, ChevronDown } from 'lucide-react';
import { getVivifiHotLeadAlerts } from '../../api-services/Modules/VivifiWebhook';
import { useAuth } from '../../custom-hooks/useAuth';
import { isCallCenterRole } from '../../custom-hooks/callCenterBands';
import { getCallCenterAgentId } from '../../custom-hooks/callCenterPool';

// How often we poll the backend for Vivifi leads at a hot status.
// 5 minutes. At 30s these four bells together made ~6 DB-backed calls a minute
// per open tab, all day, whether or not anyone was looking at them — the bells
// were quietly the most frequent load on the database in the whole CMS.
const POLL_MS = 5 * 60 * 1000;

const fmtInr = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`);

// The tables store DateTime64 in IST, so the backend already emits IST wall-clock.
// "30 Jul, 11:27 am · 5m ago"
const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  const ago = diffMin <= 0 ? 'now'
    : diffMin < 60 ? `${diffMin}m ago`
    : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago`
    : `${Math.floor(diffMin / 1440)}d ago`;
  return `${date}, ${time} · ${ago}`;
};

// Short ascending two-note chime (E5 → B5) via WebAudio — distinct from the InCred /
// UpSwing bells so the three are distinguishable by ear.
const beep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const note = (freq, start, dur) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.connect(g); g.connect(master);
      const t = now + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    };
    note(659.25, 0.00, 0.30); // E5
    note(987.77, 0.16, 0.44); // B5
  } catch { /* audio not available — ignore */ }
};

// Navbar bell that polls for Vivifi leads at a hot status (awaiting VKYC / e-Sign /
// e-Mandate / loan-chosen) and alerts on new arrivals: cyan badge + dropdown +
// beep + browser desktop notification + in-app flash toast. Seeds on the first poll
// so pre-existing leads never blast the user. Shown to ALL call-center agents +
// Super Admin — this is a SHARED actionable list, not a per-agent assignment.
const VivifiHotLeadsAlerts = () => {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set()); // status groups the user collapsed
  const toggleGroup = useCallback((s) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  }), []);
  const notified = useRef(new Set());
  const seeded = useRef(false);
  const boxRef = useRef(null);
  const flashTimer = useRef(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const canSee = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return role === 'super-admin' || isCallCenterRole(user?.role);
  }, [user]);
  // Per-agent scope: a pooled call-center agent only gets THEIR assigned leads'
  // hot statuses; Super Admin (no agentId) gets all.
  const agentId = useMemo(() => getCallCenterAgentId(user), [user]);

  // Group the leads by status (Awaiting VKYC / Esign / EMandate / Loan Chosen …) so
  // the dropdown is scannable — each group shows its count and collapses. Biggest
  // group first; items inside stay newest-first (already sorted on poll).
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const s = it.status || 'Other';
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(it);
    });
    return [...map.entries()]
      .map(([status, list]) => ({ status, items: list }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const poll = useCallback(async () => {
    try {
      // Agents want to hear about ANY movement on their own leads, not just the
      // hot four — the dedupe key is leadId+status, so each stage change fires
      // once. Super Admin (no agentId) keeps the narrow hot-only bell; the whole
      // book changing stage would be unusable as a notification stream.
      const res = await getVivifiHotLeadAlerts({
        agentId: agentId || undefined,
        allStages: agentId ? true : undefined,
      });
      if (!res?.data?.success) return;
      const rows = res.data.data || [];
      rows.sort((a, b) => new Date(String(b.updatedAt).replace(' ', 'T')) - new Date(String(a.updatedAt).replace(' ', 'T')));

      // Key by leadId + status so a lead ADVANCING to a new hot status (e.g. Esign →
      // EMandate) fires a fresh alert, not just brand-new leadIds.
      const keyOf = (it) => `${it.leadId}-${it.status}`;
      const fresh = rows.filter((it) => !notified.current.has(keyOf(it)));
      if (!seeded.current) {
        rows.forEach((it) => notified.current.add(keyOf(it)));
        seeded.current = true;
      } else if (fresh.length) {
        fresh.forEach((it) => notified.current.add(keyOf(it)));
        beep();
        const top = fresh[0];
        setFlash(top);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 6000);
        if (window.Notification && window.Notification.permission === 'granted') {
          fresh.slice(0, 5).forEach((it) => {
            try {
              const amt = it.eligibleAmount != null ? ` · ${fmtInr(it.eligibleAmount)}` : '';
              new window.Notification(`🔥 Vivifi · ${it.status || 'Hot lead'}`, {
                // Name AND number — `name || phone` hid the number whenever a
                // name existed, leaving the agent nothing to dial from.
                body: `${it.phone ? `📞 ${it.phone}
` : ''}${it.name || it.leadId || ''}${amt}`,
                tag: keyOf(it),
              });
            } catch { /* ignore */ }
          });
        }
      }
      setItems(rows);
    } catch { /* keep last items on a transient failure */ }
  }, [agentId]);

  useEffect(() => {
    if (!canSee) return undefined;
    if (window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {});
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { clearInterval(id); if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [poll, canSee]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!canSee) return null;

  const count = items.length;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 transition focus:outline-none focus:ring-2 focus:ring-cyan-200"
        aria-label="Vivifi hot lead alerts"
        title="Vivifi hot leads (awaiting VKYC / e-Sign / e-Mandate / loan-chosen)"
      >
        <Zap size={16} />
        {count > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-cyan-500 text-white text-[10px] font-bold ring-2 ring-white">
              {count > 9 ? '9+' : count}
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-cyan-400 opacity-60 animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-cyan-500/10 border border-gray-200/80 z-[60]">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-br from-cyan-50 to-sky-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-cyan-600" />
              <span className="text-[13px] font-bold text-gray-800">Vivifi Hot Leads</span>
            </div>
            <span className="text-[11px] font-semibold text-cyan-700">{count} {count === 1 ? 'lead' : 'leads'}</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <CheckCircle2 size={22} className="text-gray-300" />
                <p className="text-[12.5px] text-gray-400">No Vivifi leads awaiting a step.</p>
              </div>
            ) : groups.map((g) => {
              const isCollapsed = collapsed.has(g.status);
              return (
              <div key={g.status}>
                {/* Collapsible status header with a count — scan the pipeline at a glance. */}
                <button
                  type="button"
                  onClick={() => toggleGroup(g.status)}
                  className="sticky top-0 z-10 w-full flex items-center justify-between gap-2 px-4 py-2 bg-cyan-50/90 backdrop-blur border-b border-cyan-100 hover:bg-cyan-100/70 transition"
                >
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-cyan-800">
                    <Zap size={12} className="text-cyan-600" />
                    {g.status || 'Hot lead'}
                    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-600 text-white text-[10px] font-bold">{g.items.length}</span>
                  </span>
                  <ChevronDown size={14} className={`text-cyan-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>

                {!isCollapsed && g.items.map((it) => {
                  const done = !!it.hasFeedback; // call-center already dispositioned this lead
                  return (
                  <div key={`${it.leadId}-${it.status}`} className={`px-4 py-3 border-b border-gray-50 transition ${done ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-cyan-50/30'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {it.name && (
                          <p className="text-[12.5px] font-semibold text-gray-800 truncate">{it.name}</p>
                        )}
                        {it.eligibleAmount != null && (
                          <p className="text-[12px] font-semibold text-cyan-700 inline-flex items-center gap-1 mt-0.5">
                            <BadgeIndianRupee size={12} /> {fmtInr(it.eligibleAmount)}
                          </p>
                        )}
                        {it.phone && (
                          <a
                            href={`tel:${it.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold font-mono text-gray-800 hover:text-cyan-700 hover:underline w-fit"
                            title="Call this lead"
                          >
                            <Phone size={11} className="text-cyan-500" /> {it.phone}
                          </a>
                        )}
                        <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5" title={it.leadId}>
                          {String(it.leadId || '').slice(0, 20)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => { setOpen(false); navigate(`/vivifi-webhook-leads/${encodeURIComponent(it.leadId)}`); }}
                          className="w-6 h-6 grid place-items-center rounded-full border border-cyan-200 text-cyan-600 hover:bg-cyan-100 hover:border-cyan-300 transition"
                          title="View lead details"
                          aria-label="View lead details"
                        >
                          <Info size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                      <Clock size={11} /> {fmtWhen(it.updatedAt)}
                      {done && (
                        <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wide" title="Call-center feedback already logged">
                          <CheckCircle2 size={9} /> Feedback
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In-app flash toast — portaled to <body> so the navbar's backdrop-filter
          (which turns `fixed` into a navbar-relative containing block) can't trap it
          at the top; anchored to the viewport bottom-right. Fires on a new arrival. */}
      {flash && createPortal((
        <div className="fixed bottom-5 right-5 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-2xl shadow-cyan-500/20 border border-cyan-200 max-w-[320px]">
          <div className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0 bg-gradient-to-br from-cyan-500 to-sky-500">
            <Zap size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-800">🔥 Vivifi · {flash.status || 'Hot lead'}</p>
            <p className="text-[12px] text-gray-600 truncate">
              {flash.eligibleAmount != null ? `${fmtInr(flash.eligibleAmount)} · ` : ''}{flash.name || flash.phone || flash.leadId}
            </p>
            {flash.phone && (
              <a href={`tel:${flash.phone}`} className="text-[12px] font-bold font-mono text-cyan-700 hover:underline flex items-center gap-1 mt-0.5 w-fit">
                <Phone size={11} /> {flash.phone}
              </a>
            )}
          </div>
          <button
            onClick={() => setFlash(null)}
            className="ml-1 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ), document.body)}
    </div>
  );
};

export default VivifiHotLeadsAlerts;
