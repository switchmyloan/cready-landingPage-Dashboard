import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, Hash, Layers, Wallet, BadgeCheck, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

import { getUpSwingEventDetail } from '../../../api-services/Modules/UpSwingWebhook';
import PremiumPageLoader from '../../../components/PremiumPageLoader';

// Colour a stage/event badge by what it represents.
const eventClass = (t) => {
  const s = String(t || '').toLowerCase();
  if (/disburs|approved|success|complete|active|created|resolved|nstp|offer_available/.test(s)) return 'bg-green-100 text-green-800 border-green-200';
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

const fmtInr = (v) => (v == null || v === '' ? '—' : `₹ ${Number(v).toLocaleString('en-IN')}`);
const fmtPctVal = (v) => (v == null || v === '' ? '—' : `${v}%`);
const fmtMonths = (v) => (v == null || v === '' ? '—' : `${v} mo`);

const Field = ({ label, children, mono }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <div className={`text-sm font-medium text-gray-800 mt-0.5 break-all ${mono ? 'font-mono text-xs' : ''}`}>{children}</div>
  </div>
);

// Payload keys already shown elsewhere on the row (or just noise) — hide from the
// inline field list so only the event-specific detail shows.
const HIDDEN_PAYLOAD_KEYS = new Set(['pci', 'eventType', 'eventTimestamp', 'source']);

const isPlainObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// Format a leaf value — amount-ish numbers as INR, arrays/objects compact JSON.
const fmtPayloadVal = (key, v) => {
  if (v == null || v === '') return '—';
  if (/amount|amt|salary|income/i.test(key) && typeof v === 'number') return `₹ ${v.toLocaleString('en-IN')}`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// Flatten a payload into readable [label, value] chips: skip the redundant top-level
// keys, and expand one level of nested objects (e.g. meta → meta.lender, meta.amount)
// so nested detail like the dashboard `meta` reads as fields, not a JSON blob.
const flattenPayload = (payload) => {
  const out = [];
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (HIDDEN_PAYLOAD_KEYS.has(k) || v == null || v === '') return;
    if (isPlainObj(v)) {
      const entries = Object.entries(v);
      // Small object → expand its fields; larger/deep → keep as one JSON chip.
      if (entries.length && entries.length <= 6 && entries.every(([, vv]) => !isPlainObj(vv) || Object.keys(vv).length <= 4)) {
        entries.forEach(([sk, sv]) => { if (sv != null && sv !== '') out.push([`${k}.${sk}`, sv]); });
        return;
      }
    }
    out.push([k, v]);
  });
  return out;
};

// One event in the vertical timeline. Surfaces the event-specific payload fields
// inline (rejectedReason, fsi, journeyId, offer flags, meta …) and lets you expand
// the full raw payload.
const TimelineItem = ({ ev, isLast }) => {
  const [open, setOpen] = useState(false);
  const payload = ev.payload && typeof ev.payload === 'object' ? ev.payload : null;
  const fields = payload ? flattenPayload(payload) : [];

  return (
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

        {/* Event-specific payload fields, inline. */}
        {fields.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {fields.map(([k, v]) => (
              <span key={k} className="text-[11.5px] text-gray-600">
                <span className="text-gray-400">{k}:</span>{' '}
                <span className={`font-medium ${/reject/i.test(k) ? 'text-red-600' : 'text-gray-800'}`}>{fmtPayloadVal(k, v)}</span>
              </span>
            ))}
          </div>
        )}

        {payload && (
          <>
            <button
              onClick={() => setOpen((o) => !o)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800"
            >
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {open ? 'Hide payload' : 'View payload'}
            </button>
            {open && (
              <pre className="mt-1.5 text-[11px] leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-64 text-gray-700">
                {JSON.stringify(payload, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const UpSwingWebhookDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seed = location.state?.lead || null;

  const [lead, setLead] = useState(seed);
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
  const hasOffer = l.bankOfferedAmount != null || l.offerAvailable;
  const isRejected = /reject|declin/i.test(l.eventType || '') || l.rejectedReason;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <EventBadge type={l.eventType} />
          {l.productVariant && (
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
              <Layers size={13} className="text-gray-400" /> {l.productVariant}
            </span>
          )}
          {hasOffer && !isRejected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <BadgeCheck size={12} /> Offer available
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold border border-red-200">
              <XCircle size={12} /> Rejected
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-red-200 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Journey */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <Activity size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-800">Journey</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Current Stage"><EventBadge type={l.eventType} /></Field>
            <Field label="Journey Type">{l.journeyType || <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="Product">{l.productVariant || <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="FSI">{l.fsi || <span className="text-gray-400 italic">—</span>}</Field>
            <Field label="Offer Available">
              {l.offerAvailable == null
                ? <span className="text-gray-400 italic">—</span>
                : l.offerAvailable
                  ? <span className="text-emerald-700 font-semibold">Yes</span>
                  : <span className="text-gray-500">No</span>}
            </Field>
            <Field label="FSI Eligibility">{l.fsiOfferEligibility || <span className="text-gray-400 italic">—</span>}</Field>
            <div className="col-span-2"><Field label="PCI" mono>{l.pci || '—'}</Field></div>
            <div className="col-span-2"><Field label="Journey ID" mono>{l.journeyId || '—'}</Field></div>
            {(l.reason || l.rejectedReason) && (
              <div className="col-span-2">
                <Field label={l.rejectedReason ? 'Rejected Reason' : 'Reason'}>
                  <span className={l.rejectedReason ? 'text-red-700' : ''}>{l.rejectedReason || l.reason}</span>
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* Offer & Disbursal */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
            <Wallet size={16} className="text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-800">Offer &amp; Disbursal</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Bank Offer</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Amount">{fmtInr(l.bankOfferedAmount)}</Field>
                <Field label="Interest">{fmtPctVal(l.bankOfferedInterest)}</Field>
                <Field label="Tenure">
                  {l.bankOfferedMinTenure != null || l.bankOfferedMaxTenure != null
                    ? `${l.bankOfferedMinTenure ?? '?'}–${l.bankOfferedMaxTenure ?? '?'} mo`
                    : <span className="text-gray-400 italic">—</span>}
                </Field>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">User Selected</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Amount">{fmtInr(l.userSelectedLoanAmount)}</Field>
                <Field label="Interest">{fmtPctVal(l.userSelectedInterestRate)}</Field>
                <Field label="Tenure">{fmtMonths(l.userSelectedTenure)}</Field>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Disbursal</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Amount">
                  {l.loanDisbursalAmount == null
                    ? <span className="text-gray-400 italic">—</span>
                    : <span className="text-emerald-700 font-bold">{fmtInr(l.loanDisbursalAmount)}</span>}
                </Field>
                <Field label="Interest">{fmtPctVal(l.loanInterestRate)}</Field>
                <Field label="Tenure">{fmtMonths(l.loanTenureInMonths)}</Field>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Hash size={16} className="text-purple-600" />
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
