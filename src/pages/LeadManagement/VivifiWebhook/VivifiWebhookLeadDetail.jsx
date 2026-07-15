import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Phone, Clock, FileText, Landmark, Activity } from 'lucide-react';

import { getVivifiLeadDetail } from '../../../api-services/Modules/VivifiWebhook';
import PremiumPageLoader from '../../../components/PremiumPageLoader';

const statusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (/disburs|approved|success|complete|active/.test(s)) return 'bg-green-100 text-green-800 border-green-200';
  if (/reject|declin|fail|cancel|expire/.test(s)) return 'bg-red-100 text-red-800 border-red-200';
  if (/pending|await|progress|review|initiat|process|vkyc|esign|sign/.test(s)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const StatusBadge = ({ status, fallback = 'N/A' }) =>
  status
    ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${statusClass(status)}`}>{status}</span>
    : <span className="text-gray-400 italic text-sm">{fallback}</span>;

// ClickHouse returns 'YYYY-MM-DD HH:MM:SS(.sss)' in IST wall-clock — show as-is.
const fmtDateTime = (v) => {
  if (!v) return '—';
  const s = String(v).replace('T', ' ');
  return s.length >= 19 ? s.slice(0, 19) : s;
};
const inr = (v) => (v === null || v === undefined || v === '' || isNaN(v)) ? '—' : `₹ ${Number(v).toLocaleString('en-IN')}`;

const eventTypeChip = (t) => {
  const s = String(t || '').toUpperCase();
  if (s === 'LOAN_STATUS') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (s === 'APPLICATION_STATUS') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
};

const Field = ({ label, children }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <div className="text-sm font-medium text-gray-800 mt-0.5">{children}</div>
  </div>
);

// One event in the timeline — expandable to reveal `data` + `rawPayload`.
const EventItem = ({ ev, isLast }) => {
  const [open, setOpen] = useState(false);
  const hasData = ev.data && (typeof ev.data === 'object' ? Object.keys(ev.data).length : String(ev.data).length);

  return (
    <div className="relative pl-8">
      {/* Timeline rail + dot */}
      {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" />}
      <span className={`absolute left-1.5 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white ring-2 ${/loan/i.test(ev.eventType) ? 'bg-indigo-500 ring-indigo-200' : 'bg-sky-500 ring-sky-200'}`} />

      <div className="pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${eventTypeChip(ev.eventType)}`}>{ev.eventType || 'EVENT'}</span>
          <StatusBadge status={ev.status} fallback="—" />
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} /> {fmtDateTime(ev.eventTimestamp)}
          </span>
          {ev.receivedAt && (
            <span className="text-[11px] text-gray-400">· received {fmtDateTime(ev.receivedAt)}</span>
          )}
        </div>

        {/* Quick data preview (parsed JSON) */}
        {hasData && typeof ev.data === 'object' && (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {Object.entries(ev.data).slice(0, 6).map(([k, v]) => (
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
          <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">data</p>
              <pre className="text-[11.5px] leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-72 text-gray-700">
                {ev.data ? JSON.stringify(ev.data, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">rawPayload</p>
              <pre className="text-[11.5px] leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-72 text-gray-700">
                {ev.rawPayload ? (typeof ev.rawPayload === 'object' ? JSON.stringify(ev.rawPayload, null, 2) : String(ev.rawPayload)) : '—'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const VivifiWebhookLeadDetail = () => {
  const { leadId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seed = location.state?.lead || null;

  const [detail, setDetail] = useState({ application: null, loan: null, events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [evFilter, setEvFilter] = useState('all'); // all | APPLICATION_STATUS | LOAN_STATUS

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getVivifiLeadDetail(leadId);
        if (cancelled) return;
        if (res?.data?.success) {
          setDetail(res.data.data || { application: null, loan: null, events: [] });
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
  }, [leadId]);

  const { application, loan, events } = detail;
  const phone = application?.phoneNumber || loan?.phoneNumber || seed?.phoneNumber || '—';

  const eventTypes = useMemo(() => {
    const set = new Set((events || []).map((e) => e.eventType).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [events]);

  const filteredEvents = useMemo(
    () => (evFilter === 'all' ? events : (events || []).filter((e) => e.eventType === evFilter)),
    [events, evFilter]
  );

  if (loading) return <PremiumPageLoader />;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Lead <span className="font-mono">{leadId}</span></h1>
          <p className="text-sm text-gray-500 inline-flex items-center gap-1.5"><Phone size={13} className="text-gray-400" /> {phone}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-red-200 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Snapshot cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Application */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
            <FileText size={16} className="text-sky-600" />
            <h2 className="text-sm font-bold text-gray-800">Application (current state)</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Status"><StatusBadge status={application?.status} /></Field>
            <Field label="Updated At">{fmtDateTime(application?.updatedAt)}</Field>
            <div className="col-span-2">
              <Field label="Rejection Reason">
                {application?.rejectionReason
                  ? <span className="text-red-700">{application.rejectionReason}</span>
                  : <span className="text-gray-400 italic">—</span>}
              </Field>
            </div>
            {!application && <p className="col-span-2 text-sm text-gray-400 italic">No application snapshot for this lead.</p>}
          </div>
        </div>

        {/* Loan */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <Landmark size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-800">Loan / Disbursal (current state)</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Status"><StatusBadge status={loan?.status} /></Field>
            <Field label="Updated At">{fmtDateTime(loan?.updatedAt)}</Field>
            <Field label="Amount">{inr(loan?.amount)}</Field>
            <Field label="Disbursal Amount">{inr(loan?.disbursalAmount)}</Field>
            <Field label="Disbursal Date">{fmtDateTime(loan?.disbursalDate)}</Field>
            {!loan && <p className="col-span-2 text-sm text-gray-400 italic">No loan snapshot for this lead.</p>}
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800">Event Timeline</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{events?.length || 0} events</span>
          </div>
          {eventTypes.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {eventTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setEvFilter(t)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition ${evFilter === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50'}`}
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-5">
          {(!filteredEvents || filteredEvents.length === 0) ? (
            <div className="text-center py-10 text-gray-400 italic">
              No webhook events recorded for this lead yet.
            </div>
          ) : (
            <div>
              {filteredEvents.map((ev, i) => (
                <EventItem key={`${ev.eventTimestamp}-${i}`} ev={ev} isLast={i === filteredEvents.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VivifiWebhookLeadDetail;
