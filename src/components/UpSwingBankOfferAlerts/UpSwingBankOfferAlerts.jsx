import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Clock, CheckCircle2, X, Info, BadgeIndianRupee } from 'lucide-react';
import { getUpSwingBankOfferAlerts } from '../../api-services/Modules/UpSwingWebhook';
import { useAuth } from '../../custom-hooks/useAuth';

// How often we check the backend for new UpSwing BANK_OFFER_AVAILABLE leads.
const POLL_MS = 30000;

// Who sees this alert: Super Admin (role) + the specific call-center agent(s) by
// email — same gating as the InCred alert. Everyone else gets no bell.
const ALERT_EMAILS = ['callcenter2@cready.in'];

const fmtInr = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`);

// "HH:MM · 5m ago"
const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  const ago = diffMin <= 0 ? 'now'
    : diffMin < 60 ? `${diffMin}m ago`
    : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago`
    : `${Math.floor(diffMin / 1440)}d ago`;
  return `${time} · ${ago}`;
};

// Descending two-note chime (C6 → G5) via WebAudio — deliberately different from the
// InCred alert's ascending chime so the two bells are distinguishable by ear.
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
    note(1046.50, 0.00, 0.34); // C6
    note(783.99, 0.16, 0.5);   // G5
  } catch { /* audio not available — ignore */ }
};

// Navbar bell that polls for UpSwing leads that reached BANK_OFFER_AVAILABLE and
// alerts on new arrivals: indigo badge + dropdown + beep + browser desktop
// notification + in-app flash toast. Seeds on the first poll so pre-existing offers
// never blast the user. Shown ONLY to Super Admin + the allowlisted agent(s). These
// tables carry no PII, so items show pci + the offer figures (not name/phone).
const UpSwingBankOfferAlerts = () => {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const notified = useRef(new Set());
  const seeded = useRef(false);
  const boxRef = useRef(null);
  const flashTimer = useRef(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const canSee = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    const email = String(user?.email || '').trim().toLowerCase();
    return role === 'super-admin' || ALERT_EMAILS.includes(email);
  }, [user]);

  const poll = useCallback(async () => {
    try {
      const res = await getUpSwingBankOfferAlerts();
      if (!res?.data?.success) return;
      const rows = res.data.data || [];
      rows.sort((a, b) => new Date(String(b.createdAt).replace(' ', 'T')) - new Date(String(a.createdAt).replace(' ', 'T')));

      const fresh = rows.filter((it) => !notified.current.has(it.id));
      if (!seeded.current) {
        rows.forEach((it) => notified.current.add(it.id));
        seeded.current = true;
      } else if (fresh.length) {
        fresh.forEach((it) => notified.current.add(it.id));
        beep();
        const top = fresh[0];
        setFlash(top);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 6000);
        if (window.Notification && window.Notification.permission === 'granted') {
          fresh.slice(0, 5).forEach((it) => {
            try {
              new window.Notification('🏦 UpSwing bank offer available', {
                body: `${fmtInr(it.bankOfferedAmount) || 'Offer'} · ${it.productVariant || 'UL-PERSONAL'}`,
                tag: `upswing-offer-${it.id}`,
              });
            } catch { /* ignore */ }
          });
        }
      }
      setItems(rows);
    } catch { /* keep last items on a transient failure */ }
  }, []);

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
        className="relative p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition focus:outline-none focus:ring-2 focus:ring-indigo-200"
        aria-label="UpSwing bank offer alerts"
        title="UpSwing bank offer leads"
      >
        <Landmark size={16} />
        {count > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-indigo-500 text-white text-[10px] font-bold ring-2 ring-white">
              {count > 9 ? '9+' : count}
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-400 opacity-60 animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-indigo-500/10 border border-gray-200/80 z-[60]">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-indigo-50 to-violet-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Landmark size={15} className="text-indigo-600" />
              <span className="text-[13px] font-bold text-gray-800">UpSwing Bank Offers</span>
            </div>
            <span className="text-[11px] font-semibold text-indigo-700">{count} in last 6h</span>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <CheckCircle2 size={22} className="text-gray-300" />
                <p className="text-[12.5px] text-gray-400">No bank offers recently.</p>
              </div>
            ) : items.map((it) => (
              <div key={it.id} className="px-4 py-3 border-b border-gray-50 hover:bg-indigo-50/30 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 inline-flex items-center gap-1">
                      <BadgeIndianRupee size={13} className="text-indigo-600" />
                      {fmtInr(it.bankOfferedAmount) || 'Offer available'}
                      {it.bankOfferedInterest != null && <span className="text-[11px] font-medium text-gray-500">@ {it.bankOfferedInterest}%</span>}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5" title={it.pci}>
                      {it.productVariant ? `${it.productVariant} · ` : ''}{String(it.pci || '').slice(0, 14)}…
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase tracking-wide">
                      Offer
                    </span>
                    <button
                      onClick={() => { setOpen(false); navigate(`/upswing-webhook/${encodeURIComponent(it.pci)}`); }}
                      className="w-6 h-6 grid place-items-center rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 transition"
                      title="View lead details"
                      aria-label="View lead details"
                    >
                      <Info size={13} />
                    </button>
                  </div>
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
        <div className="fixed bottom-5 right-5 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-2xl shadow-indigo-500/20 border border-indigo-200 max-w-[320px]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white shrink-0">
            <Landmark size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-800">🏦 New UpSwing bank offer!</p>
            <p className="text-[12px] text-gray-600 truncate">
              {fmtInr(flash.bankOfferedAmount) || 'Offer available'} <span className="text-gray-400">·</span> {flash.productVariant || 'UL-PERSONAL'}
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

export default UpSwingBankOfferAlerts;
