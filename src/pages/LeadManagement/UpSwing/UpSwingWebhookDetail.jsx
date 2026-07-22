import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, User, Activity, Mail, Phone, Hash, CreditCard } from 'lucide-react';

import { getUpSwingEventDetail } from '../../../api-services/Modules/UpSwingWebhook';
import PremiumPageLoader from '../../../components/PremiumPageLoader';

// Colour an event/stage badge by what it represents.
const eventClass = (t) => {
  const s = String(t || '').toLowerCase();
  if (/disburs|approved|success|complete|active|created|resolved|nstp/.test(s)) return 'bg-green-100 text-green-800 border-green-200';
  if (/reject|declin|fail|cancel|expire|error/.test(s)) return 'bg-red-100 text-red-800 border-red-200';
  if (/pending|await|progress|review|initiat|process|launch|login|otp|sign|viewed|dashboard|offer/.test(s)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const EventBadge = ({ type }) =>
  type
    ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${eventClass(type)}`}>{type}</span>
    : <span className="text-gray-400 italic text-sm">—</span>;

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

// One event in the vertical timeline.
const TimelineItem = ({ ev, isLast }) => (
  <div className="relative pl-8">
    {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" />}
    <span className="absolute left-1.5 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white ring-2 bg-sky-500 ring-sky-200" />
    <div className="pb-5">
      <div className="flex flex-wrap items-center gap-2">
        <EventBadge type={ev.label || ev.eventType} />
        {ev.source && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200">
            {ev.source}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Clock size={12} /> {fmtDateTime(ev.at)}
        </span>
      </div>
    </div>
  </div>
);

const UpSwingWebhookDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seed = location.state?.lead || null;

  const [lead, setLead] = useState(seed);
  const [status, setStatus] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);
  const [timeline, setTimeline] = useState([]);
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
          const d = res.data.data || {};
          setLead(d.lead || seed || null);
          setStatus(d.status || null);
          setCurrentStage(d.currentStage || null);
          setTimeline(Array.isArray(d.timeline) ? d.timeline : []);
        } else {
          setError('Failed to load lead detail');
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load lead detail');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !lead) return <PremiumPageLoader />;

  const l = lead || {};

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-gray-800">{l.name || 'Unknown lead'}</span>
          {l.mrn && (
            <span className="text-sm text-gray-500 inline-flex items-center gap-1.5">
              <User size={13} className="text-gray-400" /> MRN <span className="font-mono font-semibold text-gray-700">{l.mrn}</span>
            </span>
          )}
          {status && <EventBadge type={status} />}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-red-200 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Lead */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
            <User size={16} className="text-sky-600" />
            <h2 className="text-sm font-bold text-gray-800">Lead</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Name">{l.name || <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="Profile">{l.profile || <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="Phone">
              {l.phone
                ? <a href={`tel:${l.phone}`} className="text-sky-600 hover:underline inline-flex items-center gap-1"><Phone size={12} /> {l.phone}</a>
                : <span className="text-gray-400 italic">—</span>}
            </Field>
            <Field label="Email">
              {l.email
                ? <span className="inline-flex items-center gap-1"><Mail size={12} className="text-gray-400" /> {l.email}</span>
                : <span className="text-gray-400 italic">—</span>}
            </Field>
            <Field label="PAN">
              {l.pan
                ? <span className="inline-flex items-center gap-1"><CreditCard size={12} className="text-gray-400" /> {l.pan}</span>
                : <span className="text-gray-400 italic">—</span>}
            </Field>
            <Field label="MRN">{l.mrn || <span className="text-gray-400 italic">—</span>}</Field>
            <div className="col-span-2"><Field label="PCI" mono>{l.pci || '—'}</Field></div>
          </div>
        </div>

        {/* Journey */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <Activity size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-800">Journey</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Status">{status ? <EventBadge type={status} /> : <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="Current Stage">{currentStage ? <EventBadge type={currentStage} /> : <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="Total Events">
              <span className="inline-flex items-center gap-1"><Hash size={12} className="text-gray-400" /> {timeline.length || l.eventCount || 0}</span>
            </Field>
            <Field label="Last Activity">{fmtDateTime(timeline.length ? timeline[timeline.length - 1].at : l.lastSeen)}</Field>
            <div className="col-span-2"><Field label="Journey ID" mono>{l.journeyId || '—'}</Field></div>
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Activity size={16} className="text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800">Event Timeline</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{timeline.length} events</span>
        </div>
        <div className="p-5">
          {loading && !timeline.length ? (
            <div className="text-center py-10 text-gray-400 italic">Loading timeline…</div>
          ) : !timeline.length ? (
            <div className="text-center py-10 text-gray-400 italic">No events recorded for this lead.</div>
          ) : (
            timeline.map((e, i) => (
              <TimelineItem key={`${e.eventType}-${e.at}-${i}`} ev={e} isLast={i === timeline.length - 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UpSwingWebhookDetail;
