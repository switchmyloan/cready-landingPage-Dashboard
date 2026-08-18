import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getVyaparOfferLeadByPhone } from '../../../api-services/Modules/Leads';
import LeadFeedback from '../../../components/LeadFeedback/LeadFeedback';

const SKIP_KEYS = ['isSalaried', 'staticLenders', 'priorityOrder'];

// Only lender responses whose `message` contains one of these patterns are shown.
// Case-insensitive substring match so minor punctuation/casing differences still qualify.
const ALLOWED_MESSAGE_PATTERNS = [
  'create leadstatus : rejected',
  'user not eligible for loan',
  'attributed successfully',
  'duplication-check : isrepeat = false | iseligible = true | unknown error',
];

const messageMatchesAllowlist = (resp) => {
  const message = (resp?.message || '').toString().toLowerCase().trim();
  if (!message) return false;
  return ALLOWED_MESSAGE_PATTERNS.some((pat) => message.includes(pat));
};

const classifyLenderResponse = (resp) => {
  if (!resp || typeof resp !== 'object') return 'reject';

  const message = (resp.message || '').toString().toLowerCase().trim();
  if (!message) return 'reject';

  if (message.includes('isrepeat = false') && message.includes('iseligible = true')) return 'success';

  if (
    message.includes('duplicate') ||
    message.includes('dedupe') ||
    message.includes('deduped') ||
    message.includes('isrepeat = true')
  ) return 'dedupe';

  if (message.includes('rejected') || message.includes('reject')) return 'reject';

  if (message === 'success') return 'success';

  return 'reject';
};

const STATUS_META = {
  success: { label: 'Success', chip: 'bg-green-100 text-green-700', border: 'border-green-200', bg: 'bg-green-50' },
  dedupe: { label: 'Duplicate', chip: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200', bg: 'bg-yellow-50' },
  reject: { label: 'Rejected', chip: 'bg-red-100 text-red-700', border: 'border-red-200', bg: 'bg-red-50' },
};

const LenderCard = ({ name, response }) => {
  if (!response || typeof response !== 'object') return null;

  const status = classifyLenderResponse(response);
  const meta = STATUS_META[status];
  const message = response.message || 'N/A';

  return (
    <div className={`border rounded-xl shadow-sm overflow-hidden ${meta.border}`}>
      <div className={`px-5 py-3 flex items-center justify-between ${meta.bg}`}>
        <h3 className="text-base font-bold text-gray-800">{name}</h3>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${meta.chip}`}>
          {meta.label}
        </span>
      </div>
      <div className="p-5 space-y-2">
        <div>
          <p className="text-xs font-semibold text-gray-500">Message</p>
          <p className="text-sm text-gray-800 break-words">{message}</p>
        </div>
        {response.is_offer !== undefined && (
          <div>
            <p className="text-xs font-semibold text-gray-500">Offer Available</p>
            <p className="text-sm font-medium">{response.is_offer ? 'Yes' : 'No'}</p>
          </div>
        )}
        {response.utm_link && (
          <div>
            <p className="text-xs font-semibold text-gray-500">UTM Link</p>
            <a href={response.utm_link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline break-all">
              {response.utm_link.length > 60 ? response.utm_link.slice(0, 60) + '...' : response.utm_link}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

const VyaparSelectedLenderDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lead } = location.state || {};

  const [offerLead, setOfferLead] = useState(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const phone = lead?.phoneNumber || lead?.phone_number || lead?.phone || null;

  useEffect(() => {
    if (!phone) return;

    let cancelled = false;
    setOfferLoading(true);
    setOfferError(null);

    getVyaparOfferLeadByPhone(phone)
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.success) {
          setOfferLead(res.data.data);
        } else {
          setOfferLead(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setOfferError(err?.response?.data?.message || err?.message || 'Failed to load offer');
        setOfferLead(null);
      })
      .finally(() => {
        if (!cancelled) setOfferLoading(false);
      });

    return () => { cancelled = true; };
  }, [phone]);

  const lenderResponse = offerLead?.lender_response || {};

  const allLenderEntries = useMemo(() => (
    Object.entries(lenderResponse).filter(
      ([key, value]) => !SKIP_KEYS.includes(key)
        && typeof value === 'object'
        && value !== null
        && messageMatchesAllowlist(value)
    )
  ), [lenderResponse]);

  const statusCounts = useMemo(() => (
    allLenderEntries.reduce(
      (acc, [, resp]) => {
        const s = classifyLenderResponse(resp);
        acc[s] = (acc[s] || 0) + 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, success: 0, dedupe: 0, reject: 0 }
    )
  ), [allLenderEntries]);

  const lenderEntries = statusFilter === 'all'
    ? allLenderEntries
    : allLenderEntries.filter(([, resp]) => classifyLenderResponse(resp) === statusFilter);

  const staticLenders = lenderResponse?.staticLenders || [];

  if (!lead) {
    return (
      <div className="p-10 border border-red-300 bg-red-50 rounded-lg">
        <h1 className="text-2xl font-bold text-red-800 mb-2">Data Loading Error!</h1>
        <p className="text-red-700">Selected lender data could not be found. Please go back and select a row.</p>
        <button onClick={() => navigate(-1)} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">Go Back</button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Vyapar Selected Lender — Details</h1>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
        >
          Back to List
        </button>
      </div>

      {/* Basic selected-lender row */}
      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Selected Lender</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-12">

          <div>
            <p className="text-sm font-medium text-gray-500">Lender Name</p>
            <p className="text-gray-800 font-medium">{lead.lenderName || lead.lender_name || 'N/A'}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-500">Created At</p>
            <p className="text-gray-800 font-medium">
              {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Call-center feedback — vyapar-ticket (vyapar_feedback table) */}
      <div className="mb-6">
        <LeadFeedback phone={phone} scope="vyapar" />
      </div>

      {/* Basic info from vyaparOfferLeads */}
      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Offer Profile (from Vyapar Offer Leads)</h2>
          {offerLoading && <span className="text-xs text-gray-500">Loading...</span>}
        </div>

        {offerError && (
          <p className="text-sm text-red-600 mb-3">Could not load offer profile: {offerError}</p>
        )}

        {!offerLoading && !offerLead && !offerError && (
          <p className="text-sm text-gray-500">No matching vyapar offer lead found for phone {phone || 'N/A'}.</p>
        )}

        {offerLead && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-12">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="text-gray-800 font-medium">{offerLead.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-gray-800 font-medium">{offerLead.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Gender</p>
              <p className="text-gray-800 font-medium">{offerLead.gender || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">DOB</p>
              <p className="text-gray-800 font-medium">{offerLead.dob || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">PAN</p>
              <p className="text-gray-800 font-medium">{offerLead.pan_no || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pincode</p>
              <p className="text-gray-800 font-medium">{offerLead.pincode || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Profile</p>
              <p className="text-gray-800 font-medium">{offerLead.profile || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Monthly Income</p>
              <p className="text-gray-800 font-medium">
                {offerLead.monthly_income ? `₹ ${Number(offerLead.monthly_income).toLocaleString('en-IN')}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Loan Amount</p>
              <p className="text-gray-800 font-medium">
                {offerLead.loan_amount ? `₹ ${Number(offerLead.loan_amount).toLocaleString('en-IN')}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Loan Purpose</p>
              <p className="text-gray-800 font-medium">{offerLead.loan_purpose || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">UTM Source</p>
              <p className="text-gray-800 font-medium">{offerLead.utm_source || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">UTM Campaign</p>
              <p className="text-gray-800 font-medium">{offerLead.utm_campaign || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Lender responses */}
      {offerLead && (
        <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b pb-2">
            <h3 className="text-xl font-bold text-gray-900">Lender Responses</h3>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All', activeCls: 'bg-indigo-600 text-white border-indigo-600', idleCls: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
                { key: 'success', label: 'Success', activeCls: 'bg-green-600 text-white border-green-600', idleCls: 'bg-white text-green-700 border-green-300 hover:bg-green-50' },
                { key: 'dedupe', label: 'Duplicate', activeCls: 'bg-yellow-500 text-white border-yellow-500', idleCls: 'bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50' },
                { key: 'reject', label: 'Rejected', activeCls: 'bg-red-600 text-white border-red-600', idleCls: 'bg-white text-red-700 border-red-300 hover:bg-red-50' },
              ].map(btn => {
                const isActive = statusFilter === btn.key;
                return (
                  <button
                    key={btn.key}
                    onClick={() => setStatusFilter(btn.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${isActive ? btn.activeCls : btn.idleCls}`}
                  >
                    {btn.label} ({statusCounts[btn.key] || 0})
                  </button>
                );
              })}
            </div>
          </div>

          {lenderEntries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {lenderEntries.map(([name, response]) => (
                <LenderCard key={name} name={name} response={response} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 p-4 border border-gray-200 rounded-lg mb-6">
              No lender response data available.
            </p>
          )}

          {staticLenders.length > 0 && (
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Static Lenders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {staticLenders.map((l, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-5 shadow-sm bg-gray-50">
                    <h4 className="text-base font-bold text-gray-800 mb-2">{l.name}</h4>
                    {l.utm_link && (
                      <a href={l.utm_link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline break-all">
                        {l.utm_link.length > 60 ? l.utm_link.slice(0, 60) + '...' : l.utm_link}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {lenderResponse.isSalaried !== undefined && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm">
              <span className="font-semibold text-gray-600">Salaried:</span>
              <span className="font-bold">{lenderResponse.isSalaried ? 'Yes' : 'No'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VyaparSelectedLenderDetail;
