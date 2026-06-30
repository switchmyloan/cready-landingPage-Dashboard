import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, Phone, Clock, CheckCircle2, AlarmClock } from 'lucide-react';
import {
  getDueCallbacks, getShortDueCallbacks,
  dismissCallback, dismissShortCallback,
} from '../../api-services/Modules/Leads';




// How often we ask the backend for callbacks whose scheduled time has arrived.
const POLL_MS = 45000;

// "HH:MM · due 5m ago" — the scheduled time plus how overdue it is.
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
  return `${time} · due ${ago}`;
};

const keyOf = (it) => `${it.scope}:${it.phone}:${it.next_action_at}`;

// Short attention beep via WebAudio — avoids shipping an audio asset.
const beep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start(); o.stop(ctx.currentTime + 0.36);
  } catch { /* audio not available — ignore */ }
};

// Bell in the navbar (shown to EVERY logged-in user) that polls for scheduled
// callbacks whose time has arrived and alerts: red badge + dropdown list + desktop
// notification + beep. "Done" marks a callback handled so it stops alerting.
const CallbackReminders = () => {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const notified = useRef(new Set()); // keys already desktop-notified this session
  const seeded = useRef(false);       // skip notifying for callbacks already due at mount
  const boxRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const [hi, sh] = await Promise.allSettled([getDueCallbacks(), getShortDueCallbacks()]);
      const merged = [];
      if (hi.status === 'fulfilled' && hi.value?.data?.success) {
        for (const r of (hi.value.data.data || [])) merged.push({ ...r, scope: 'high' });
      }
      if (sh.status === 'fulfilled' && sh.value?.data?.success) {
        for (const r of (sh.value.data.data || [])) merged.push({ ...r, scope: 'short' });
      }
      merged.sort((a, b) => new Date(b.next_action_at) - new Date(a.next_action_at));

      // Desktop-notify only callbacks that became due AFTER mount; on the first poll
      // we just seed the "seen" set so the agent isn't blasted for pre-existing ones.
      const fresh = merged.filter((it) => !notified.current.has(keyOf(it)));
      if (!seeded.current) {
        merged.forEach((it) => notified.current.add(keyOf(it)));
        seeded.current = true;
      } else if (fresh.length) {
        fresh.forEach((it) => notified.current.add(keyOf(it)));
        beep();
        if (window.Notification && window.Notification.permission === 'granted') {
          fresh.slice(0, 5).forEach((it) => {
            try {
              new window.Notification('⏰ Callback due', {
                body: `Call back ${it.name || it.phone}${it.name ? ` (${it.phone})` : ''}${it.status ? ` — ${it.status}` : ''}`,
                tag: keyOf(it),
              });
            } catch { /* ignore */ }
          });
        }
      }
      setItems(merged);
    } catch { /* keep last items on a transient failure */ }
  }, []);

  // Poll loop + one-time permission request — runs for every logged-in user.
  useEffect(() => {
    if (window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {});
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // Click outside closes the dropdown.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleDone = async (it) => {
    setItems((prev) => prev.filter((x) => keyOf(x) !== keyOf(it)));
    try {
      if (it.scope === 'short') await dismissShortCallback(it.phone);
      else await dismissCallback(it.phone);
    } catch { /* if it failed, the next poll brings it back */ }
  };

  const count = items.length;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition focus:outline-none focus:ring-2 focus:ring-purple-200"
        aria-label="Callback reminders"
        title="Callback reminders"
      >
        <Bell size={16} />
        {count > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-rose-500 text-white text-[10px] font-bold ring-2 ring-white">
              {count > 9 ? '9+' : count}
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-400 opacity-60 animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-purple-500/10 border border-gray-200/80 z-[60]">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-purple-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <AlarmClock size={15} className="text-purple-600" />
              <span className="text-[13px] font-bold text-gray-800">Callback Reminders</span>
            </div>
            <span className="text-[11px] font-semibold text-purple-700">{count} due</span>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <CheckCircle2 size={22} className="text-emerald-400" />
                <p className="text-[12.5px] text-gray-400">No callbacks due right now.</p>
              </div>
            ) : items.map((it) => (
              <div key={keyOf(it)} className="px-4 py-3 border-b border-gray-50 hover:bg-purple-50/30 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate">{it.name || 'Unknown customer'}</p>
                    <a
                      href={`tel:${it.phone}`}
                      className="text-[12px] text-purple-600 font-medium inline-flex items-center gap-1 hover:underline"
                    >
                      <Phone size={11} /> {it.phone}
                    </a>
                  </div>
                  <span className="shrink-0 inline-flex px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wide">
                    {it.scope === 'short' ? 'Short' : 'High'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium">
                  <Clock size={11} /> {fmtWhen(it.next_action_at)}
                </div>
                {it.status ? (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Last: <span className="font-semibold text-gray-700">{it.status}</span>
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={`tel:${it.phone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition"
                  >
                    <Phone size={11} /> Call now
                  </a>
                  <button
                    onClick={() => handleDone(it)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-semibold hover:bg-gray-200 transition"
                  >
                    <CheckCircle2 size={11} /> Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallbackReminders;
