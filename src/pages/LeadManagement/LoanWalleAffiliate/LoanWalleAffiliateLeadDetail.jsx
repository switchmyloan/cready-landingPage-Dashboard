import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Clock, FileText, Landmark, Activity } from 'lucide-react';

import { getLwLeadDetail } from '../../../api-services/Modules/LwAffiliate';
import PremiumPageLoader from '../../../components/PremiumPageLoader';

const statusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (/disburs|approved|success|complete|active/.test(s)) return 'bg-green-100 text-green-800 border-green-200';
  if (/reject|declin|fail|cancel|expire/.test(s)) return 'bg-red-100 text-red-800 border-red-200';
  if (/pending|await|progress|review|initiat|process|onboard/.test(s)) return 'bg-amber-100 text-amber-800 border-amber-200';
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

const Field = ({ label, children }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <div className="text-sm font-medium text-gray-800 mt-0.5 break-all">{children}</div>
  </div>
);

// One event in the timeline — expandable to reveal the parsed payload.
const EventItem = ({ ev, isLast }) => {
  const [open, setOpen] = useState(false);
  const recognised = Number(ev.isRecognised) === 1;

  return (
    <div className="relative pl-8">
      {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" />}
      <span className={`absolute left-1.5 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white ring-2 ${recognised ? 'bg-indigo-500 ring-indigo-200' : 'bg-gray-400 ring-gray-200'}`} />

      <div className="pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">{ev.event || 'EVENT'}</span>
          <StatusBadge status={ev.status} fallback="—" />
          {ev.partnerCode && (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border bg-gray-50 text-gray-700 border-gray-200">{ev.partnerCode}</span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} /> {fmtDateTime(ev.eventAt)}
          </span>
          {ev.receivedAt && (
            <span className="text-[11px] text-gray-400">· received {fmtDateTime(ev.receivedAt)}</span>
          )}
          {!recognised && (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
              not recognised{ev.reason ? `: ${ev.reason}` : ''}
            </span>
          )}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {open ? 'Hide payload' : 'View payload'}
        </button>

        {open && (
          <pre className="mt-2 text-[11.5px] leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-72 text-gray-700">
            {ev.rawPayload ? (typeof ev.rawPayload === 'object' ? JSON.stringify(ev.rawPayload, null, 2) : String(ev.rawPayload)) : '—'}
          </pre>
        )}
      </div>
    </div>
  );
};

const LoanWalleAffiliateLeadDetail = () => {
  const { trackingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seed = location.state?.lead || null;

  const [detail, setDetail] = useState({ lead: null, disbursal: null, events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getLwLeadDetail(trackingId);
        if (cancelled) return;
        if (res?.data?.success) {
          setDetail(res.data.data || { lead: null, disbursal: null, events: [] });
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
  }, [trackingId]);

  const { lead, disbursal, events } = detail;
  const userId = lead?.userId || disbursal?.userId || seed?.userId || '—';

  if (loading) return <PremiumPageLoader />;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Lead <span className="font-mono">{trackingId}</span></h1>
          <p className="text-sm text-gray-500">
            User <span className="font-mono">{userId}</span>
            {' · '}MRN <span className="font-mono">{lead?.mrn || disbursal?.mrn || '—'}</span>
            {' · '}Phone <span className="font-mono">{lead?.phone || disbursal?.phone || '—'}</span>
          </p>
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
            <FileText size={16} className="text-sky-600" />
            <h2 className="text-sm font-bold text-gray-800">Lead (current state)</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Status"><StatusBadge status={lead?.latestStatus} /></Field>
            <Field label="Partner">{lead?.partnerCode || '—'}</Field>
            <Field label="MRN">{lead?.mrn || '—'}</Field>
            <Field label="Phone">{lead?.phone || '—'}</Field>
            <Field label="Status Changed At">{fmtDateTime(lead?.latestStatusAt)}</Field>
            <Field label="Updated At">{fmtDateTime(lead?.updatedAt)}</Field>
            <Field label="Loan Amount">{inr(lead?.loanAmount)}</Field>
            <Field label="Disbursed Amount">{inr(lead?.disbursedAmount)}</Field>
            <Field label="UTM Source">{lead?.utmSource || '—'}</Field>
            <Field label="UTM Medium">{lead?.utmMedium || '—'}</Field>
            <Field label="Click ID">{lead?.clickid || '—'}</Field>
            <Field label="Events Received">{lead?.eventCount ?? '—'}</Field>
            {!lead && <p className="col-span-2 text-sm text-gray-400 italic">No lead snapshot for this tracking ID.</p>}
          </div>
        </div>

        {/* Disbursal */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <Landmark size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-800">Disbursal</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Status"><StatusBadge status={disbursal?.status} fallback="Not disbursed" /></Field>
            <Field label="Partner">{disbursal?.partnerCode || '—'}</Field>
            <Field label="Loan Amount">{inr(disbursal?.loanAmount)}</Field>
            <Field label="Disbursed Amount">{inr(disbursal?.disbursedAmount)}</Field>
            <Field label="Disbursed Date">{disbursal?.disbursedDate || '—'}</Field>
            <Field label="Disbursed At">{fmtDateTime(disbursal?.disbursedAt)}</Field>
            {!disbursal && <p className="col-span-2 text-sm text-gray-400 italic">This lead has no disbursal yet.</p>}
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800">Event Timeline</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{events?.length || 0} events</span>
          </div>
        </div>

        <div className="p-5">
          {(!events || events.length === 0) ? (
            <div className="text-center py-10 text-gray-400 italic">
              No webhook events recorded for this lead yet.
            </div>
          ) : (
            <div>
              {events.map((ev, i) => (
                <EventItem key={ev.eventId || i} ev={ev} isLast={i === events.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanWalleAffiliateLeadDetail;
