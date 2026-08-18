import { useEffect, useState } from 'react';
import {
  MessageSquare, Save, Clock, PencilLine, UserRound, Check, Info, Bell,
  PhoneOff, PhoneMissed, ThumbsUp, ThumbsDown, CalendarClock, Power, Languages,
  FileText, Wallet, ShieldAlert, BadgeCheck,
} from 'lucide-react';
import {
  getLeadFeedback, saveLeadFeedback,
  getShortLeadFeedback, saveShortLeadFeedback,
  getVyaparLeadFeedback, saveVyaparLeadFeedback,
} from '../../api-services/Modules/Leads';
import { useAuth } from '../../custom-hooks/useAuth';
import ToastNotification from '../Notification/ToastNotification';

// Call-center dispositions shown in the dropdown. Edit this list to change the
// options — values are stored verbatim, so keep them stable for reporting.
// Exported so the list-page "Feedback" filters offer the same options.
export const FEEDBACK_STATUSES = [
  'Not Connected',
  'Customer Disconnected',
  'Interested',
  'Not Interested',
  'Call Back Later',
  'Wrong Number',
  'Switched Off / Not Reachable',
  'Language Barrier',
  'Documents Pending',
  'Already Availed Loan',
  'Not Eligible',
  'Converted / Disbursed',
];

// Icon + sub-label + colour for each disposition, so the outcome grid mirrors the
// product mockup. Falls back to a neutral chip for any status not mapped here.
const OUTCOME_META = {
  'Not Connected':                { Icon: PhoneOff,      tint: 'text-rose-500',    desc: 'Could not reach' },
  'Customer Disconnected':        { Icon: PhoneMissed,   tint: 'text-orange-500',  desc: 'Customer hung up' },
  'Interested':                   { Icon: ThumbsUp,      tint: 'text-emerald-500', desc: 'Customer interested' },
  'Not Interested':               { Icon: ThumbsDown,    tint: 'text-rose-500',    desc: 'Not interested' },
  'Call Back Later':              { Icon: CalendarClock, tint: 'text-purple-500',  desc: 'Requested callback' },
  'Wrong Number':                 { Icon: PhoneOff,      tint: 'text-gray-500',    desc: 'Incorrect number' },
  'Switched Off / Not Reachable': { Icon: Power,         tint: 'text-gray-500',    desc: 'Phone switched off' },
  'Language Barrier':             { Icon: Languages,     tint: 'text-amber-500',   desc: 'Could not communicate' },
  'Documents Pending':            { Icon: FileText,      tint: 'text-blue-500',    desc: 'Waiting for documents' },
  'Already Availed Loan':         { Icon: Wallet,        tint: 'text-amber-600',   desc: 'Already has a loan' },
  'Not Eligible':                 { Icon: ShieldAlert,   tint: 'text-rose-500',    desc: 'Does not meet criteria' },
  'Converted / Disbursed':        { Icon: BadgeCheck,    tint: 'text-emerald-600', desc: 'Loan disbursed' },
};
const FALLBACK_OUTCOME = { Icon: MessageSquare, tint: 'text-gray-500', desc: '' };

// Tap-to-add canned remarks (mockup's "Quick Notes").
const QUICK_NOTES = [
  'Requested callback tomorrow',
  'Customer busy',
  'Interested, needs details',
  'Salary proof pending',
  'Need documents',
  'Not interested',
];

// "Next Action" options. Anything other than 'No Action' asks for a date + time.
const NEXT_ACTIONS = [
  'Schedule Callback',
  'Follow-up Call',
  'Send Documents Link',
  'Final Reminder',
  'Ringing One',
  'Ringing Two',
  'Ringing Three',
  'Finally Not contactable',
  'No Action',
];

// Split a stored ISO timestamp into the local YYYY-MM-DD + HH:MM the inputs need.
const splitDateTime = (iso) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

const formatDateTime = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// "HH:MM AM · Today / Yesterday / DD MMM YYYY" — matches the mockup's timestamp.
const formatTimelineTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toUpperCase();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  const rel = diffDays === 0 ? 'Today'
    : diffDays === 1 ? 'Yesterday'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${time} · ${rel}`;
};

// Activity Timeline — the full feedback change history (newest first), styled to
// match the product mockup. Each save (any status/remark change) appends one
// immutable row to lead_feedback_log / short_feedback_log.
const ActivityTimeline = ({ log, loading }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
    {/* Header */}
    <div className="flex items-center gap-2.5 mb-5">
      <div className="grid place-items-center w-8 h-8 rounded-lg bg-purple-50 text-purple-600">
        <Clock size={16} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-800 tracking-tight">Activity Timeline</h3>
        <p className="text-[11px] text-gray-400">
          {log.length > 0
            ? `Updated ${log.length} ${log.length === 1 ? 'time' : 'times'}`
            : 'Feedback change history'}
        </p>
      </div>
    </div>

    {loading && log.length === 0 ? (
      <p className="text-sm text-gray-400 py-2">Loading…</p>
    ) : log.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
        <div className="grid place-items-center w-9 h-9 rounded-full bg-gray-100 text-gray-300">
          <Clock size={18} />
        </div>
        <p className="text-sm text-gray-400">No activity yet — feedback updates will appear here.</p>
      </div>
    ) : (
      <ol className="relative">
        {log.map((entry, i) => {
          const isLatest = i === 0;
          const last = i === log.length - 1;
          return (
            <li key={entry.id} className="relative pl-14 pb-6 last:pb-0">
              {/* connecting line through the icon nodes */}
              {!last && <span className="absolute left-[19px] top-9 bottom-0 w-px bg-gray-200" />}

              {/* icon node — aligned with the card */}
              <span
                className={`absolute left-0 top-[26px] grid place-items-center w-10 h-10 rounded-xl ring-4 ring-white ${
                  isLatest
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/30'
                    : 'bg-purple-50 text-purple-600'
                }`}
              >
                <PencilLine size={16} />
              </span>

              {/* timestamp + Latest badge */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLatest ? 'bg-purple-500' : 'bg-gray-300'}`} />
                  {formatTimelineTime(entry.createdAt)}
                </span>
                {isLatest && (
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                    Latest
                  </span>
                )}
              </div>

              {/* card */}
              <div className="rounded-xl border border-gray-100 bg-white shadow-sm px-4 py-3">
                <p className="text-[13px] font-bold text-gray-800">Outcome updated</p>
                {entry.status ? (
                  <p className="text-[13px] font-semibold text-purple-600 mt-0.5">{entry.status}</p>
                ) : (
                  <p className="text-[12px] text-gray-400 italic mt-0.5">No status set</p>
                )}
                {entry.remark ? (
                  <p className="text-[12px] text-gray-500 mt-1.5 break-words">“{entry.remark}”</p>
                ) : null}
                {entry.next_action ? (
                  <p className="text-[11px] text-purple-600 mt-1.5 flex items-center gap-1.5">
                    <CalendarClock size={12} /> {entry.next_action}
                    {entry.next_action_at ? ` · ${formatTimelineTime(entry.next_action_at)}` : ''}
                  </p>
                ) : null}
                <p className="text-[11px] text-gray-400 mt-2.5 flex items-center gap-1.5">
                  <UserRound size={12} /> by {entry.updated_by || 'CMS user'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    )}
  </div>
);

// A per-lead feedback card. Keyed by phone — the same record is shown/edited
// across the three modules of a ticket (backend normalizes the phone to its last
// 10 digits, so format differences don't matter). `scope` selects which table is
// used: 'high' → lead_feedback, 'short' → short_feedback, 'vyapar' →
// vyapar_feedback (each kept separate).
const LeadFeedback = ({ phone, scope = 'high' }) => {
  const { user } = useAuth();
  const fetchFeedback = scope === 'vyapar' ? getVyaparLeadFeedback
    : scope === 'short' ? getShortLeadFeedback
    : getLeadFeedback;
  const persistFeedback = scope === 'vyapar' ? saveVyaparLeadFeedback
    : scope === 'short' ? saveShortLeadFeedback
    : saveLeadFeedback;
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionTime, setNextActionTime] = useState('');
  const [initial, setInitial] = useState({ status: '', remark: '', nextAction: '', nextActionDate: '', nextActionTime: '' });
  const [meta, setMeta] = useState(null); // { updated_by, updatedAt }
  const [log, setLog] = useState([]);     // full change history (newest first)
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // bump to refetch after a save

  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    setLoading(true);
    fetchFeedback(phone)
      .then((res) => {
        if (cancelled) return;
        const row = res?.data?.data;
        const serverLog = Array.isArray(res?.data?.log) ? res.data.log : [];
        // Keep optimistic entries if the server log hasn't caught up yet (e.g. the
        // log table was just created / backend restarting) so a just-saved row
        // doesn't flash and vanish. The component remounts per lead, so `prev`
        // never carries another lead's entries here.
        setLog((prev) => (serverLog.length >= prev.length ? serverLog : prev));
        // Source of truth for the CURRENT selection is the newest timeline entry —
        // the standalone lead_feedback row can lag if a write partially failed,
        // which made a just-saved status not show on revisit. Fall back to it.
        const effective = serverLog.length ? serverLog[0] : row;
        if (effective) {
          const na = effective.next_action || '';
          const { date, time } = splitDateTime(effective.next_action_at);
          setStatus(effective.status || '');
          setRemark(effective.remark || '');
          setNextAction(na);
          setNextActionDate(date);
          setNextActionTime(time);
          setInitial({ status: effective.status || '', remark: effective.remark || '', nextAction: na, nextActionDate: date, nextActionTime: time });
          setMeta({ updated_by: effective.updated_by, updatedAt: effective.updatedAt || effective.createdAt });
        } else {
          setStatus(''); setRemark(''); setNextAction(''); setNextActionDate(''); setNextActionTime('');
          setInitial({ status: '', remark: '', nextAction: '', nextActionDate: '', nextActionTime: '' });
          setMeta(null);
        }
      })
      .catch(() => { /* table may not exist yet — start with an empty form */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [phone, scope, reloadKey]);

  const dirty =
    status !== initial.status ||
    remark !== initial.remark ||
    nextAction !== initial.nextAction ||
    nextActionDate !== initial.nextActionDate ||
    nextActionTime !== initial.nextActionTime;

  const handleSave = async () => {
    if (!phone) { ToastNotification.error('No phone number for this lead'); return; }
    setSaving(true);
    try {
      // A schedule is saved whenever both date and time are set — no need to pick
      // an action first (every field in the form is open by default).
      const nextActionAt = (nextActionDate && nextActionTime)
        ? new Date(`${nextActionDate}T${nextActionTime}`).toISOString()
        : null;
      const res = await persistFeedback({
        phone,
        status,
        remark,
        updatedBy: user?.name || user?.email || 'CMS user',
        nextAction: nextAction || null,
        nextActionAt,
      });
      if (res?.data?.success) {
        const row = res.data.data;
        ToastNotification.success('Feedback saved');
        setInitial({ status, remark, nextAction, nextActionDate, nextActionTime });
        if (row) setMeta({ updated_by: row.updated_by, updatedAt: row.updatedAt });
        // Real-time: prepend to the timeline the instant the save succeeds, so the
        // entry shows without waiting for the refetch (which then syncs real ids).
        setLog((prev) => [{
          id: `tmp-${Date.now()}`,
          status: status || null,
          remark: remark || null,
          next_action: nextAction || null,
          next_action_at: nextActionAt || null,
          updated_by: user?.name || user?.email || 'CMS user',
          createdAt: new Date().toISOString(),
        }, ...prev]);
        setReloadKey((k) => k + 1); // sync with server (authoritative ids/timestamps)
      } else {
        ToastNotification.error('Could not save feedback');
      }
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || 'Could not save feedback');
    } finally {
      setSaving(false);
    }
  };

  const updatedLabel = formatDateTime(meta?.updatedAt);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* ─── Outcome & Feedback ─── */}
      <div className="xl:col-span-2 rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
            <MessageSquare size={17} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-800 tracking-tight">Outcome &amp; Feedback</h3>
            <p className="text-[11px] text-gray-400">Update the disposition for this lead</p>
          </div>
        </div>

        {/* 1. Call Outcome grid */}
        <p className="text-[12px] font-bold text-gray-700">1. Call Outcome</p>
        <p className="text-[11px] text-gray-400 mb-3">What was the outcome of this call?</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {FEEDBACK_STATUSES.map((s) => {
            const om = OUTCOME_META[s] || FALLBACK_OUTCOME;
            const Icon = om.Icon;
            const selected = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={loading || saving}
                className={`relative rounded-xl border p-3 text-center transition disabled:opacity-60 ${
                  selected
                    ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-200 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/40'
                }`}
              >
                {selected && (
                  <span className="absolute top-1.5 right-1.5 grid place-items-center w-4 h-4 rounded-full bg-purple-600 text-white">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
                <span className="grid place-items-center mb-1.5">
                  <Icon size={22} className={om.tint} />
                </span>
                <p className="text-[12px] font-bold text-gray-800 leading-tight">{s}</p>
                {om.desc ? <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{om.desc}</p> : null}
              </button>
            );
          })}
        </div>

        {/* hint */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-purple-50/70 border border-purple-100 px-3 py-2">
          <Info size={13} className="text-purple-500 shrink-0" />
          <p className="text-[11px] text-purple-700">
            Selecting an outcome helps us serve your customer better and improves follow-up.
          </p>
        </div>

        {/* 2. Next Action */}
        <p className="text-[12px] font-bold text-gray-700 mt-5">2. Next Action</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Action</label>
            <select
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              disabled={loading || saving}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-gray-50"
            >
              <option value="">— Select action —</option>
              {NEXT_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Next Call Date &amp; Time
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                disabled={loading || saving}
                className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-gray-50"
              />
              <input
                type="time"
                value={nextActionTime}
                onChange={(e) => setNextActionTime(e.target.value)}
                disabled={loading || saving}
                className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>
        {nextActionDate && nextActionTime && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <Bell size={13} className="text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700">
              {nextAction || 'Follow-up'} scheduled for{' '}
              <b>{new Date(`${nextActionDate}T${nextActionTime}`).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>.
            </p>
          </div>
        )}

        {/* 3. Quick Notes */}
        <p className="text-[12px] font-bold text-gray-700 mt-5">
          3. Quick Notes <span className="text-[10px] font-normal text-gray-400">(tap to add)</span>
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {QUICK_NOTES.map((q) => {
            const active = remark.includes(q);
            return (
              <button
                key={q}
                type="button"
                onClick={() =>
                  setRemark((r) =>
                    active
                      ? r.replace(q, '').replace(/\s{2,}/g, ' ').trim()
                      : (r && r.trim() ? `${r.trim()} ${q}` : q)
                  )
                }
                disabled={loading || saving}
                className={`px-3 py-1.5 rounded-lg border text-[11.5px] transition disabled:opacity-60 ${
                  active
                    ? 'border-purple-400 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                {q}
              </button>
            );
          })}
        </div>

        {/* 4. Additional Notes */}
        <p className="text-[12px] font-bold text-gray-700 mt-5">
          4. Additional Notes <span className="text-[10px] font-normal text-gray-400">(optional)</span>
        </p>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          disabled={loading || saving}
          rows={3}
          placeholder="Add more context about the conversation…"
          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-gray-50 resize-y"
        />

        {/* footer */}
        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap border-t border-gray-100 pt-4">
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            {updatedLabel ? (
              <><Clock size={12} /> Last updated {meta?.updated_by ? `by ${meta.updated_by} ` : ''}on {updatedLabel}</>
            ) : (loading ? 'Loading…' : 'No feedback recorded yet')}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-sm hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={15} /> {saving ? 'Saving…' : 'Save Feedback'}
          </button>
        </div>
      </div>

      {/* ─── Activity Timeline ─── */}
      <div className="xl:col-span-1">
        <ActivityTimeline log={log} loading={loading} />
      </div>
    </div>
  );
};

export default LeadFeedback;
