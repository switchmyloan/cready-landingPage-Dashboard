import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Flame, Phone, Clock, CheckCircle2, X } from 'lucide-react';
import { getIncredSuccessAlerts } from '../../api-services/Modules/Leads';
import { useAuth } from '../../custom-hooks/useAuth';
import { getCallCenterAgentId } from '../../custom-hooks/callCenterPool';

// How often we check the backend for new InCred-SUCCESS leads.
const POLL_MS = 30000;

// "HH:MM · 5m ago"
const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  const ago = diffMin <= 0 ? 'now'
    : diffMin < 60 ? `${diffMin}m ago`
    : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago`
    : `${Math.floor(diffMin / 1440)}d ago`;
  return `${time} · ${ago}`;
};

// Pleasant ascending notification chime (G5 → C6 → E6) via WebAudio — soft sine
// "bells" with a quick attack and long decay. No audio asset shipped; fails silently
// when WebAudio is unavailable / blocked by autoplay policy.
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
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g); g.connect(master);
      const t = now + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    };
    note(783.99, 0.00, 0.35);   // G5
    note(1046.50, 0.11, 0.42);  // C6
    note(1318.51, 0.22, 0.55);  // E6
  } catch { /* audio not available — ignore */ }
};

// Navbar bell that polls for InCred-SUCCESS leads (lender_response.InCred.message =
// 'Lead processed successfully' — the same success used by the All Lenders card and
// the Hot Leads filter) and alerts on new arrivals: orange badge + dropdown list +
// beep + browser desktop notification + an in-app flash toast. Seeds on the first
// poll so pre-existing successes never blast the user. Shown to every logged-in user.
const IncredSuccessAlerts = () => {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(null); // latest new lead → flash toast
  const notified = useRef(new Set());        // ids already alerted this session
  const seeded = useRef(false);              // skip alerting for successes present at mount
  const boxRef = useRef(null);
  const flashTimer = useRef(null);

  // A pooled call-center agent only gets alerts for the leads assigned to them
  // (persisted ownership). Non-pool users (Super Admin etc.) get agentId = null →
  // they see ALL InCred successes.
  const { user } = useAuth();
  const agentId = useMemo(() => getCallCenterAgentId(user), [user]);

  // If the agent changes (different agent logs in), re-seed so we don't blast the
  // new agent's pre-existing successes as if they just arrived.
  useEffect(() => {
    seeded.current = false;
    notified.current = new Set();
  }, [agentId]);

  const poll = useCallback(async () => {
    try {
      const res = await getIncredSuccessAlerts({ agentId });
      if (!res?.data?.success) return;
      const rows = res.data.data || [];
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const fresh = rows.filter((it) => !notified.current.has(it.id));
      if (!seeded.current) {
        rows.forEach((it) => notified.current.add(it.id));
        seeded.current = true;
      } else if (fresh.length) {
        fresh.forEach((it) => notified.current.add(it.id));
        beep();
        // In-app flash (newest fresh lead) — auto-clears after 6s.
        const top = fresh[0];
        setFlash(top);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 6000);
        // Desktop notification per fresh lead (works even when tab is in background).
        if (window.Notification && window.Notification.permission === 'granted') {
          fresh.slice(0, 5).forEach((it) => {
            try {
              new window.Notification('🔥 InCred success lead', {
                body: `${it.name || it.phone}${it.name ? ` (${it.phone})` : ''}`,
                tag: `incred-${it.id}`,
              });
            } catch { /* ignore */ }
          });
        }
      }
      setItems(rows);
    } catch { /* keep last items on a transient failure */ }
  }, [agentId]);

  useEffect(() => {
    if (window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {});
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { clearInterval(id); if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [poll]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const count = items.length;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition focus:outline-none focus:ring-2 focus:ring-orange-200"
        aria-label="InCred success alerts"
        title="InCred success leads"
      >
        <Flame size={16} />
        {count > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-orange-500 text-white text-[10px] font-bold ring-2 ring-white">
              {count > 9 ? '9+' : count}
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-400 opacity-60 animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-orange-500/10 border border-gray-200/80 z-[60]">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-orange-50 to-amber-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Flame size={15} className="text-orange-600" />
              <span className="text-[13px] font-bold text-gray-800">InCred Success Leads</span>
            </div>
            <span className="text-[11px] font-semibold text-orange-700">{count} in last 6h</span>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <CheckCircle2 size={22} className="text-gray-300" />
                <p className="text-[12.5px] text-gray-400">No InCred success leads recently.</p>
              </div>
            ) : items.map((it) => (
              <div key={it.id} className="px-4 py-3 border-b border-gray-50 hover:bg-orange-50/30 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate">{it.name || 'Unknown customer'}</p>
                    <a href={`tel:${it.phone}`} className="text-[12px] text-orange-600 font-medium inline-flex items-center gap-1 hover:underline">
                      <Phone size={11} /> {it.phone}
                    </a>
                  </div>
                  <span className="shrink-0 inline-flex px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-bold uppercase tracking-wide">
                    Success
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                  <Clock size={11} /> {fmtWhen(it.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-app flash toast (fixed, escapes the navbar) — fires on a new arrival. */}
      {flash && (
        <div className="fixed bottom-5 right-5 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-2xl shadow-orange-500/20 border border-orange-200 max-w-[320px]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 grid place-items-center text-white shrink-0">
            <Flame size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-800">🔥 New InCred success lead!</p>
            <p className="text-[12px] text-gray-600 truncate">
              {flash.name || 'Customer'} <span className="text-gray-400">·</span> {flash.phone}
            </p>
          </div>
          <button
            onClick={() => setFlash(null)}
            className="ml-1 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default IncredSuccessAlerts;
