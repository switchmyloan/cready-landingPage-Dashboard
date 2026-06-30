import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, Clock, MapPin, Hash, Globe, ExternalLink,
  User, Briefcase, CalendarDays, IndianRupee,
  ShieldCheck, Users, Copy, FileText, Sparkles,
  MousePointerClick, LayoutGrid,
} from 'lucide-react';

import { getUserTrackDetail } from '../../../api-services/Modules/Leads';
import ToastNotification from '../../../components/Notification/ToastNotification';
import LeadFeedback from '../../../components/LeadFeedback/LeadFeedback';

const formatDateTime = (v) => {
  if (!v) return 'N/A';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const formatINR = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
};

const titleCase = (s) => (s || '').split(/\s+/).filter(Boolean).map(w => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(' ');

const copyToClipboard = async (text, label = 'Copied') => {
  try {
    await navigator.clipboard.writeText(String(text));
    ToastNotification.success(label);
  } catch {
    ToastNotification.error('Copy fail');
  }
};

const Field = ({ label, value, Icon, copyable }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
      {Icon && <Icon size={11} />} {label}
    </p>
    <div className="flex items-center gap-1.5 mt-0.5">
      <p className="text-sm text-gray-800 font-medium break-all">
        {value !== undefined && value !== null && value !== '' ? value : <span className="text-gray-400 italic">N/A</span>}
      </p>
      {copyable && value && (
        <button
          type="button"
          onClick={() => copyToClipboard(value, `${label} copied`)}
          className="text-gray-400 hover:text-gray-700 shrink-0"
        >
          <Copy size={12} />
        </button>
      )}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
    <h2 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">{title}</h2>
    {children}
  </div>
);

const StatusChip = ({ done, label }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
    done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-green-500' : 'bg-gray-400'}`} />
    {label}
  </span>
);

// One event in the chronological timeline.
const TimelineItem = ({ event, at, details, last }) => {
  const meta = {
    landed:          { Icon: Users,             color: 'blue',   label: 'Landed on page' },
    draft_updated:   { Icon: FileText,          color: 'gray',   label: 'Draft updated' },
    otp_verified:    { Icon: ShieldCheck,       color: 'amber',  label: 'OTP verified' },
    submitted:       { Icon: Sparkles,          color: 'purple', label: 'Submitted (offerLeads)' },
    submitted_again: { Icon: Sparkles,          color: 'purple', label: 'Re-submitted' },
    lender_clicked:  { Icon: MousePointerClick, color: 'green',  label: `Lender clicked${details?.lenderName ? ` — ${details.lenderName}` : ''}` },
  }[event] || { Icon: FileText, color: 'gray', label: event };

  const colors = {
    blue:   { bg: 'bg-blue-100',   text: 'text-blue-600',   line: 'bg-blue-200' },
    gray:   { bg: 'bg-gray-100',   text: 'text-gray-600',   line: 'bg-gray-200' },
    amber:  { bg: 'bg-amber-100',  text: 'text-amber-600',  line: 'bg-amber-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', line: 'bg-purple-200' },
    green:  { bg: 'bg-green-100',  text: 'text-green-600',  line: 'bg-green-200' },
  }[meta.color];

  const { Icon } = meta;

  return (
    <div className="relative pl-10 pb-5">
      {!last && <span className={`absolute left-[15px] top-7 bottom-0 w-px ${colors.line}`} />}
      <div className={`absolute left-0 top-0 w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center`}>
        <Icon size={15} />
      </div>
      <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(at)}</p>
    </div>
  );
};

const UserTrackDetail = () => {
  const { phone: phoneParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const phone = useMemo(() => decodeURIComponent(phoneParam || ''), [phoneParam]);
  const listRow = location.state?.row;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getUserTrackDetail({ phone });
        if (!cancelled && res?.data?.success) setData(res.data.data);
        else if (!cancelled) ToastNotification.error('Failed to load details');
      } catch (err) {
        console.error(err);
        if (!cancelled) ToastNotification.error('Failed to load details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [phone]);

  const summary = data?.summary || {};
  const profile = data?.profile || {};
  const timeline = data?.timeline || [];
  const lenders = data?.lenders || [];
  const trackingEvents = data?.tracking_events || {};
  const attempts = summary.attempts_count || 0;
  const lendersCount = summary.lenders_count || 0;
  const displayName = 
    [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    || (listRow && (listRow.fullname || [listRow.first_name, listRow.last_name].filter(Boolean).join(' ')))
    || 'Unknown';

  return (
    <div className="pb-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-3"
      >
        <ArrowLeft size={15} /> Back to User Track
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">User</p>
            <h1 className="text-xl font-bold text-gray-900">{titleCase(displayName)}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-sm font-mono text-gray-700 hover:text-purple-700">
                <Phone size={13} className="text-gray-400" /> {phone}
              </a>
              {profile.email && (
                <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-purple-700">
                  <Mail size={13} className="text-gray-400" /> {profile.email}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip done={attempts > 0} label="Landed" />
            <StatusChip done={!!summary.has_otp_verified} label="OTP Verified" />
            <StatusChip done={!!summary.has_submitted} label="Submitted" />
            <StatusChip done={!!summary.has_lender_clicked} label="Lender Clicked" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-500">
          Loading user details…
        </div>
      )}

      {!loading && !data && (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-500">
          No data found for this phone number.
        </div>
      )}

      {!loading && data && attempts === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          This phone has no entries in <span className="font-mono">apply_new_draft_leads</span>.
        </div>
      )}

      {!loading && data && attempts > 0 && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
            {[
              { key: 'overview',  label: 'Overview',         Icon: LayoutGrid,         count: null },
              { key: 'lenders',   label: 'Selected Lenders', Icon: MousePointerClick, count: lendersCount },
            ].map(({ key, label, Icon, count }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${
                    active
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                  {count !== null && (
                    <span className={`inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${
                      active ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {!loading && data && attempts > 0 && activeTab === 'overview' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500">Attempts</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{attempts}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Draft rows in DB</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500">First Seen</p>
              <p className="mt-1 text-sm font-semibold text-gray-800">{formatDateTime(summary.first_seen_at)}</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500">Last Seen</p>
              <p className="mt-1 text-sm font-semibold text-gray-800">{formatDateTime(summary.last_seen_at)}</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500">OTP Verified At</p>
              <p className="mt-1 text-sm font-semibold text-gray-800">
                {summary.has_otp_verified ? formatDateTime(summary.otp_verified_at) : <span className="text-gray-400 italic">Not verified</span>}
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500">Submitted At</p>
              <p className="mt-1 text-sm font-semibold text-gray-800">
                {summary.has_submitted ? formatDateTime(summary.submitted_at) : <span className="text-gray-400 italic">Not submitted</span>}
              </p>
              {summary.submissions_count > 1 && (
                <p className="text-[11px] text-gray-500 mt-0.5">{summary.submissions_count} submissions</p>
              )}
            </div>
          </div>

          {/* Profile */}
          <Section title="Latest Profile (from last draft)">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <Field label="Full Name"    value={profile.firstName || profile.lastName ? titleCase(`${profile.firstName || ''} ${profile.lastName || ''}`) : null} Icon={User} />
              <Field
                label="Dashboard Link"
                Icon={ExternalLink}
                value={data?.dashboard_url ? (
                  <span className="inline-flex flex-wrap items-center gap-3">
                    <a href={data.dashboard_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-purple-700 hover:underline">
                      <ExternalLink size={12} /> Open
                    </a>
                    <button type="button" onClick={() => copyToClipboard(data.dashboard_url, 'Dashboard link copied')} className="inline-flex items-center gap-1 text-gray-500 hover:text-purple-700">
                      <Copy size={12} /> Copy
                    </button>
                  </span>
                ) : null}
              />
              <Field label="First Name"   value={profile.firstName} />
              <Field label="Last Name"    value={profile.lastName} />
              <Field label="Email"        value={profile.email} Icon={Mail} copyable />
              <Field label="PAN"          value={profile.panNumber} Icon={Hash} copyable />
              <Field label="DOB"          value={profile.dob} Icon={CalendarDays} />
              <Field label="Gender"       value={profile.gender} />
              <Field label="Pincode"      value={profile.pincode} Icon={MapPin} />
              <Field label="Profession"   value={profile.profession} Icon={Briefcase} />
              <Field label="Salary"       value={formatINR(profile.salary)} Icon={IndianRupee} />
              <Field label="Loan Amount"  value={formatINR(profile.loanAmount)} Icon={IndianRupee} />
              <Field label="MRN"          value={profile.mrn} copyable />
            </div>
          </Section>

          {/* Session / Source */}
          <Section title="Session & Source">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <Field label="Session ID"   value={profile.sessionId} Icon={Hash} copyable />
              <Field label="IP Address"   value={profile.ipAddress} Icon={Globe} />
              <Field label="UTM Source"   value={profile.utm_source} />
              <Field label="UTM Medium"   value={profile.utm_medium} />
              <Field label="UTM Campaign" value={profile.utm_campaign} />
              <Field label="UTM Content"  value={profile.utm_content} />
            </div>
          </Section>

          {/* Frontend event tracking (latest offerLeads.tracking_events) — which
              UI events the user did (e.g. InCred fake-offer modal shown) + when. */}
          {Object.keys(trackingEvents).some((k) => !k.endsWith('_at')) && (
            <Section title="Tracking Events">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {Object.keys(trackingEvents)
                  .filter((k) => !k.endsWith('_at'))
                  .map((k) => (
                    <Field
                      key={k}
                      Icon={MousePointerClick}
                      label={k.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                      value={trackingEvents[`${k}_at`] ? formatDateTime(trackingEvents[`${k}_at`]) : 'Yes'}
                    />
                  ))}
              </div>
            </Section>
          )}

          {/* Timeline */}
          <Section title={`Timeline (${timeline.length} events)`}>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-500">No events recorded.</p>
            ) : (
              <div>
                {timeline.map((e, i) => (
                  <TimelineItem
                    key={`${e.event}-${e.at}-${i}`}
                    event={e.event}
                    at={e.at}
                    last={i === timeline.length - 1}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Offers Shown — what the user actually saw on the /offers page,
              taken from the latest offerLeads.shown_offers JSON. */}
          {(() => {
            const latestOffer = data.offers && data.offers.length
              ? data.offers[data.offers.length - 1]
              : null;
            let shown = latestOffer?.shown_offers;
            if (typeof shown === 'string') {
              try { shown = JSON.parse(shown); } catch { shown = null; }
            }
            if (!Array.isArray(shown) || shown.length === 0) return null;
            return (
              <Section title={`Offers Shown to User (${shown.length})`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shown.map((o, i) => {
                    const name = typeof o === 'string' ? o : (o?.lenderName || '—');
                    const section = typeof o === 'object' ? o?.section : null;
                    const utmLink = typeof o === 'object' ? o?.utmLink : null;
                    const wasApproved = typeof o === 'object' ? o?.wasApproved : null;
                    return (
                      <div key={`${name}-${i}`} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                          {section && (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              section === 'promoted'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              {section}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {wasApproved === true && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Approved</span>
                          )}
                          {wasApproved === false && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Not approved</span>
                          )}
                          {/* {utmLink && (
                            <a
                              href={utmLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-purple-600 hover:underline truncate max-w-[200px]"
                              title={utmLink}
                            >
                              UTM Link
                            </a>
                          )} */}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500 mt-3">
                  Captured from latest submission on {formatDateTime(latestOffer?.createdAt)}.
                </p>
              </Section>
            );
          })()}

          {/* Submissions (offerLeads) — only when this user has submitted */}
          {data.offers && data.offers.length > 0 && (
            <Section title={`Submissions (${data.offers.length}) — offerLeads`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Submitted At</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Loan Amount</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Monthly Income</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Purpose</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">UTM Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.offers.map((o, i) => {
                      const name = o.name || [o.first_name, o.last_name].filter(Boolean).join(' ');
                      return (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                          <td className="px-3 py-2 text-gray-800">{name ? titleCase(name) : <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{o.email || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{formatINR(o.loan_amount) || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{formatINR(o.monthly_income) || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{o.loan_purpose || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{o.utm_source || <span className="text-gray-400 italic">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Raw draft rows */}
          <Section title={`All Draft Entries (${data.drafts.length})`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Created At</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Profession</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Salary</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Loan</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">OTP</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.drafts.map((d, i) => {
                    const name = d.fullname || [d.firstName || d.first_name, d.lastName || d.last_name].filter(Boolean).join(' ');
                    const otpFlag = d.otpVerified || d.otp_verified;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDateTime(d.createdAt || d.created_at)}</td>
                        <td className="px-3 py-2 text-gray-800">{name ? titleCase(name) : <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{d.email || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{d.profession || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{formatINR(d.salary) || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{formatINR(d.loanAmount || d.loan_amount) || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-3 py-2">
                          {otpFlag
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-semibold">YES</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold">NO</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-gray-500 max-w-[140px] truncate" title={d.sessionId || d.session_id}>
                          {d.sessionId || d.session_id || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      {!loading && data && attempts > 0 && activeTab === 'lenders' && (
        <>
          {/* Summary line for lender clicks */}
          <div className="p-4 bg-white rounded-lg border border-gray-200 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-100 text-green-600">
                <MousePointerClick size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Lender clicks by this user</p>
                <p className="text-xl font-bold text-gray-900">
                  {lendersCount} {lendersCount === 1 ? 'click' : 'clicks'}
                  {lenders.length > 0 && summary.first_lender_at && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      • first on {formatDateTime(summary.first_lender_at)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {lenders.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
              This user has not clicked on any lender yet.
            </div>
          ) : (
            <Section title={`All Lender Clicks (${lenders.length})`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Clicked At</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Lender</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">MRN</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Offer Lead ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lenders.map((l, i) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                        <td className="px-3 py-2 text-gray-800 font-medium">
                          {l.lenderName || <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {l.status
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold uppercase">{l.status}</span>
                            : <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                          {l.mrn || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-gray-700">
                          {l.offerLeadId || <span className="text-gray-400 italic">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}

      {/* Call-center feedback — moved to the BOTTOM of the page. Shared per
          phone across the high-ticket modules; rendered independently of the
          track data so it stays available even while details load. */}
      <div className="mt-4">
        <LeadFeedback phone={phone} />
      </div>
    </div>
  );
};

export default UserTrackDetail;
