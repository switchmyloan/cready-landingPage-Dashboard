import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Clock, User, Activity, KeyRound, Hash } from 'lucide-react';

import { getUpSwingEventDetail } from '../../../api-services/Modules/UpSwingWebhook';
import PremiumPageLoader from '../../../components/PremiumPageLoader';

const eventClass = (t) => {
  const s = String(t || '').toLowerCase();
  if (/disburs|approved|success|complete|active|created/.test(s)) return 'bg-green-100 text-green-800 border-green-200';
  if (/reject|declin|fail|cancel|expire|error/.test(s)) return 'bg-red-100 text-red-800 border-red-200';
  if (/pending|await|progress|review|initiat|process|launch|login|otp|sign/.test(s)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const EventBadge = ({ type }) =>
  type
    ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${eventClass(type)}`}>{type}</span>
    : <span className="text-gray-400 italic text-sm">EVENT</span>;

const fmtDateTime = (v) => {
  if (!v) return '—';
  const s = String(v).replace('T', ' ');
  return s.length >= 19 ? s.slice(0, 19) : s;
};

const Field = ({ label, children, mono }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <div className={`text-sm font-medium text-gray-800 mt-0.5 break-all ${mono ? 'font-mono text-xs' : ''}`}>{children}</div>
  </div>
);

// One event in the pci timeline — expandable to reveal its full payload.
const EventItem = ({ ev, isLast, highlightId }) => {
  const [open, setOpen] = useState(false);
  const isCurrent = String(ev.id) === String(highlightId);
  const payload = ev.payload && typeof ev.payload === 'object' ? ev.payload : null;

  return (
    <div className="relative pl-8">
      {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" />}
      <span className={`absolute left-1.5 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white ring-2 ${isCurrent ? 'bg-purple-600 ring-purple-300' : 'bg-sky-500 ring-sky-200'}`} />
      <div className="pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <EventBadge type={ev.event_type} />
          {isCurrent && <span className="text-[10px] font-bold uppercase tracking-wide text-purple-600">this event</span>}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} /> {fmtDateTime(ev.received_at)}
          </span>
        </div>
        {payload && (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {Object.entries(payload).slice(0, 6).map(([k, v]) => (
              <span key={k} className="text-xs text-gray-600">
                <span className="text-gray-400">{k}:</span> <span className="font-medium text-gray-800">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {open ? 'Hide payload' : 'View payload'}
        </button>
        {open && (
          <pre className="mt-2 text-[11.5px] leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-72 text-gray-700">
            {ev.payload ? JSON.stringify(ev.payload, null, 2) : '—'}
          </pre>
        )}
      </div>
    </div>
  );
};

const UpSwingWebhookDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seed = location.state?.event || null;

  const [detail, setDetail] = useState({ event: null, lead: null, timeline: [], launchSessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getUpSwingEventDetail(id);
        if (cancelled) return;
        if (res?.data?.success) {
          setDetail(res.data.data || { event: null, lead: null, timeline: [], launchSessions: [] });
        } else {
          setError('Failed to load event detail');
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load event detail');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PremiumPageLoader />;

  const { event, lead, timeline, launchSessions } = detail;
  const ev = event || seed;
  const mrn = lead?.mrn || '—';

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <EventBadge type={ev?.event_type} />
          <span className="text-sm text-gray-500 inline-flex items-center gap-1.5">
            <User size={13} className="text-gray-400" /> MRN <span className="font-mono font-semibold text-gray-700">{mrn}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-red-200 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Snapshot cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Lead */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
            <User size={16} className="text-sky-600" />
            <h2 className="text-sm font-bold text-gray-800">UpSwing Lead</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="MRN">{lead?.mrn || <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="Consent">
              {lead ? (lead.consent_given
                ? <span className="text-green-700 font-semibold">Given</span>
                : <span className="text-gray-500">Not given</span>) : '—'}
            </Field>
            <Field label="Consent At">{fmtDateTime(lead?.consent_at)}</Field>
            <Field label="Pushed To UpSwing">{fmtDateTime(lead?.pushed_to_upswing_at)}</Field>
            <div className="col-span-2"><Field label="PCI" mono>{lead?.pci || ev?.pci || '—'}</Field></div>
            {!lead && <p className="col-span-2 text-sm text-gray-400 italic">No matching lead in upswing_leads for this pci.</p>}
          </div>
        </div>

        {/* Event */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <Hash size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-800">This Event</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Event Type"><EventBadge type={ev?.event_type} /></Field>
            <Field label="Source">{ev?.payload?.source || ev?.source || '—'}</Field>
            <Field label="Received At">{fmtDateTime(ev?.received_at)}</Field>
            <Field label="Processed At">{fmtDateTime(ev?.processed_at)}</Field>
            <div className="col-span-2"><Field label="Event ID" mono>{ev?.event_id || '—'}</Field></div>
            {ev?.payload && (
              <div className="col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Payload</p>
                <pre className="text-[11.5px] leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-60 text-gray-700">
                  {JSON.stringify(ev.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Launch sessions */}
      {launchSessions?.length > 0 && (
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm mb-5">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <KeyRound size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-gray-800">Launch Sessions</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{launchSessions.length}</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-gray-500 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left py-2 px-3">JTI</th>
                  <th className="text-left py-2 px-3">Issued</th>
                  <th className="text-left py-2 px-3">Expires</th>
                  <th className="text-left py-2 px-3">Consumed</th>
                </tr>
              </thead>
              <tbody>
                {launchSessions.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-2 px-3 font-mono text-xs text-gray-600" title={s.jti}>{s.jti ? `${String(s.jti).slice(0, 16)}…` : '—'}</td>
                    <td className="py-2 px-3 text-gray-600">{fmtDateTime(s.issued_at)}</td>
                    <td className="py-2 px-3 text-gray-600">{fmtDateTime(s.expires_at)}</td>
                    <td className="py-2 px-3">{s.consumed_at ? <span className="text-green-700">{fmtDateTime(s.consumed_at)}</span> : <span className="text-gray-400 italic">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event timeline (all events for this pci) */}
      <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Activity size={16} className="text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800">Event Timeline</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{timeline?.length || 0} events</span>
        </div>
        <div className="p-5">
          {(!timeline || timeline.length === 0) ? (
            <div className="text-center py-10 text-gray-400 italic">No events recorded for this pci.</div>
          ) : (
            timeline.map((e, i) => (
              <EventItem key={e.id} ev={e} isLast={i === timeline.length - 1} highlightId={ev?.id} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UpSwingWebhookDetail;
