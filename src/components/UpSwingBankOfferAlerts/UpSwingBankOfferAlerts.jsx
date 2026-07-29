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

// Readable labels for the alerted stages (Bank Offer + everything after it). Later
// stages carry no offer amount, so the STAGE is what the alert leads with.
const STAGE_LABELS = {
  BANK_OFFER_AVAILABLE: 'Bank Offer Available',
  OFFER_SELECTED: 'Offer Selected',
  AADHAAR_SUCCESS: 'Aadhaar Verified',
  DEMOG_POST_OFFER_SUCCESS: 'Demographics Done',
  VKYC_INITIATED: 'VKYC Initiated',
  VKYC_SUCCESS: 'VKYC Success',
  E_SIGN_SUCCESS: 'E-Sign Success',
  ENACH_INITIATED: 'eNACH Initiated',
  ENACH_SUCCESS: 'eNACH Success',
  LOAN_DISBURSED: 'Loan Disbursed',
};
const stageLabel = (s) => STAGE_LABELS[s] || String(s || '').replace(/_/g, ' ');
const isDisbursed = (s) => s === 'LOAN_DISBURSED';

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

      // Key by pci + stage so a lead ADVANCING to a new stage (e.g. Bank Offer →
      // VKYC) fires a fresh alert, not just brand-new pcis.
      const keyOf = (it) => `${it.id}-${it.stage}`;
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
              const amt = it.bankOfferedAmount != null ? ` · ${fmtInr(it.bankOfferedAmount)}` : '';
              new window.Notification(`${isDisbursed(it.stage) ? '🎉' : '🏦'} UpSwing · ${stageLabel(it.stage)}`, {
                body: `${it.productVariant || 'UL-PERSONAL'}${amt}`,
                tag: keyOf(it),
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
        <div className="absolute right-0 mt-2 w-80 max-h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-indigo-500/10 border border-gray-200/80 z-[60]">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-br from-indigo-50 to-violet-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Landmark size={15} className="text-indigo-600" />
              <span className="text-[13px] font-bold text-gray-800">UpSwing Offer &amp; Beyond</span>
            </div>
            <span className="text-[11px] font-semibold text-indigo-700">{count} {count === 1 ? 'lead' : 'leads'}</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <CheckCircle2 size={22} className="text-gray-300" />
                <p className="text-[12.5px] text-gray-400">No leads at offer stage or beyond.</p>
              </div>
            ) : items.map((it) => {
              const disb = isDisbursed(it.stage);
              const done = !!it.hasFeedback; // call-center already dispositioned this lead
              return (
              <div key={`${it.id}-${it.stage}`} className={`px-4 py-3 border-b border-gray-50 transition ${done ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-indigo-50/30'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* Stage leads (later stages have no amount) */}
                    <p className={`text-[13px] font-bold inline-flex items-center gap-1 ${disb ? 'text-emerald-700' : 'text-gray-800'}`}>
                      {disb ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Landmark size={13} className="text-indigo-600" />}
                      {stageLabel(it.stage)}
                    </p>
                    {/* Amount only where present (Bank Offer stage) */}
                    {it.bankOfferedAmount != null && (
                      <p className="text-[12px] font-semibold text-indigo-700 inline-flex items-center gap-1 mt-0.5">
                        <BadgeIndianRupee size={12} /> {fmtInr(it.bankOfferedAmount)}
                        {it.bankOfferedInterest != null && <span className="text-[11px] font-medium text-gray-500">@ {it.bankOfferedInterest}%</span>}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5" title={it.pci}>
                      {it.productVariant ? `${it.productVariant} · ` : ''}{String(it.pci || '').slice(0, 14)}…
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${disb ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {disb ? 'Disbursed' : 'Offer+'}
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
        </div>
      )}

      {/* In-app flash toast (fixed, escapes the navbar) — fires on a new arrival. */}
      {flash && (
        <div className="fixed bottom-5 right-5 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-2xl shadow-indigo-500/20 border border-indigo-200 max-w-[320px]">
          <div className={`w-8 h-8 rounded-lg grid place-items-center text-white shrink-0 ${isDisbursed(flash.stage) ? 'bg-gradient-to-br from-emerald-500 to-green-500' : 'bg-gradient-to-br from-indigo-500 to-violet-500'}`}>
            {isDisbursed(flash.stage) ? <CheckCircle2 size={16} /> : <Landmark size={16} />}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-800">{isDisbursed(flash.stage) ? '🎉' : '🏦'} UpSwing · {stageLabel(flash.stage)}</p>
            <p className="text-[12px] text-gray-600 truncate">
              {flash.bankOfferedAmount != null ? `${fmtInr(flash.bankOfferedAmount)} · ` : ''}{flash.productVariant || 'UL-PERSONAL'}
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
