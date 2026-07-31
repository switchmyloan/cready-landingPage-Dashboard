
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SKIP_KEYS = ['isSalaried', 'staticLenders'];

// Classify a single lender response into: success | dedupe | reject
// PURELY based on the `message` field — mirrors backend offerLeads.services.js classifyLenderResponse
const classifyLenderResponse = (resp) => {
  if (!resp || typeof resp !== 'object') return 'reject';

  // InCred — detected by its unique nested response shape since this classifier
  // has no lender-name param. Offer flow issues an APPLICATION_ID; dedupe flow
  // returns isAllowed. Either signals success. (Its message "Request Processed
  // Successfully" / "Lead processed successfully" would otherwise fall to 'reject'.)
  if (resp?.data?.response?.response?.APPLICATION_ID) return 'success';
  if (resp?.data?.response?.response?.isAllowed === true) return 'success';
  // InCred top-level shape: message "Lead processed successfully" / a populated
  // LOAN_OFFERS array = the lead was processed → success (mirrors OfferLeadDetail).
  // Both are InCred-specific signals, so this can't mis-classify other lenders.
  if ((resp?.message || '').toString().toLowerCase().includes('lead processed successfully')
      || (Array.isArray(resp?.LOAN_OFFERS) && resp.LOAN_OFFERS.length > 0)) return 'success';

  const message = (resp.message || '').toString().toLowerCase().trim();
  if (!message) return 'reject';

  // TrueBalance edge case: duplication-check passed (isRepeat = false) and eligible → success
  if (message.includes('isrepeat = false') && message.includes('iseligible = true')) {
    return 'success';
  }

  // Dedupe / Duplicate
  if (
    message.includes('duplicate') ||
    message.includes('dedupe') ||
    message.includes('deduped') ||
    message.includes('isrepeat = true')
  ) {
    return 'dedupe';
  }

  // Rejected
  if (message.includes('rejected') || message.includes('reject')) {
    return 'reject';
  }

  // Success — EXACT match only (sync with OfferLeads lender filter which uses
  // `lender_response->'<lender>'->>'message' = 'success'`)
  if (message === 'success') {
    return 'success';
  }

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
          <p className="text-sm text-gray-800">{message}</p>
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

const OfferCards = ({ offers, title, colorScheme = 'blue' }) => {
  if (!offers || offers.length === 0) return null;

  const colors = {
    blue: { border: 'border-blue-200', title: 'text-blue-700', bg: 'bg-blue-50', borderT: 'border-blue-100', emi: 'text-blue-800', emiBold: 'text-blue-900', feeB: 'border-blue-200' },
    green: { border: 'border-green-200', title: 'text-green-700', bg: 'bg-green-50', borderT: 'border-green-100', emi: 'text-green-800', emiBold: 'text-green-900', feeB: 'border-green-200' },
  };
  const c = colors[colorScheme] || colors.blue;

  return (
    <div className="mb-8">
      <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offers.map((item, index) => (
          <div key={index} className={`bg-white border ${c.border} rounded-xl shadow-lg hover:shadow-2xl transition duration-300 overflow-hidden`}>
            <div className="p-5">
              <h3 className={`text-lg font-extrabold ${c.title} mb-4 border-b pb-2`}>
                Offer Option #{index + 1}
              </h3>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm font-semibold text-gray-600">Loan Amount:</span>
                <span className="text-base font-bold text-gray-900">
                  ₹ {parseFloat(item?.loanAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm font-semibold text-gray-600">Tenure:</span>
                <span className="text-base font-bold text-gray-900">
                  {item?.loanTenure} Months
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm font-semibold text-gray-600">Rate of Interest (p.a.):</span>
                <span className="text-base font-bold text-red-600">
                  {item?.rateOfInterest}%
                </span>
              </div>
            </div>
            <div className={`${c.bg} border-t ${c.borderT} p-5`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-md font-bold ${c.emi}`}>Monthly EMI:</span>
                <span className={`text-xl font-extrabold ${c.emiBold}`}>
                  ₹ {parseFloat(item?.loanEmi || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {item?.processingFeeAmount && (
                <div className={`flex justify-between items-center pt-2 border-t ${c.feeB}`}>
                  <span className="text-xs font-medium text-gray-500">Processing Fee:</span>
                  <span className="text-sm font-semibold text-gray-700">
                    ₹ {parseFloat(item.processingFeeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MVSuccessDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lead } = location.state || {};
  const [activeTab, setActiveTab] = useState("Basic");
  const [statusFilter, setStatusFilter] = useState("all");

  const tabs = ["Basic", "Offers"];
  console.log(lead, "lead")
  if (!lead) {
    return (
      <div className="p-10 border border-red-300 bg-red-50 rounded-lg">
        <h1 className="text-2xl font-bold text-red-800 mb-2">Data Loading Error!</h1>
        <p className="text-red-700">Lead data could not be found. Please go back and select a lead.</p>
        <button onClick={() => navigate(-1)} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">Go Back</button>
      </div>
    );
  }

  const lenderResponse = lead?.lender_response || {};

  // Extract lender entries (skip non-lender keys)
  const allLenderEntries = Object.entries(lenderResponse).filter(([key]) => !SKIP_KEYS.includes(key) && typeof lenderResponse[key] === 'object' && lenderResponse[key] !== null);

  // Counts per status (for filter button badges)
  const statusCounts = allLenderEntries.reduce(
    (acc, [, resp]) => {
      const s = classifyLenderResponse(resp);
      acc[s] = (acc[s] || 0) + 1;
      acc.all += 1;
      return acc;
    },
    { all: 0, success: 0, dedupe: 0, reject: 0 }
  );

  // Apply status filter
  const lenderEntries = statusFilter === 'all'
    ? allLenderEntries
    : allLenderEntries.filter(([, resp]) => classifyLenderResponse(resp) === statusFilter);

  // Extract MoneyView offers
  const moneyViewOffers = lenderResponse?.MoneyView?.data?.resData?.data?.response?.offerObjects || [];

  // Extract KreditBee offers
  const kreditBeeOffers = lenderResponse?.KreditBee?.data?.resData?.data?.response?.offerObjects || [];

  // Static lenders
  const staticLenders = lenderResponse?.staticLenders || [];

  return (
    <div className="w-full">
      <div className="rounded-lg shadow-sm px-4">
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-2 text-sm font-medium transition-colors ${activeTab === tab ? "text-indigo-600" : "text-gray-600 hover:text-indigo-600"}`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute left-0 -bottom-[1px] h-0.5 w-full bg-indigo-600 rounded"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 p-4 rounded-lg shadow-sm bg-white">
        {activeTab === "Basic" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Basic Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-12">
              <div>
                <p className="text-sm font-medium text-gray-700">Lead ID:</p>
                <p className="text-gray-700 font-medium">{lead?.leadID || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Name:</p>
                <p className="text-gray-700 font-medium">{lead?.firstName + ' ' + lead?.lastName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Phone:</p>
                <p className="text-gray-700 font-medium">{lead.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email:</p>
                <p className="text-gray-700 font-medium">{lead.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Gender:</p>
                <p className="text-gray-700 font-medium">{lead.gender || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Date of Birth:</p>
                <p className="text-gray-700 font-medium">{lead.dob || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">PAN No:</p>
                <p className="text-gray-700 font-medium">{lead?.panNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Pincode:</p>
                <p className="text-gray-700 font-medium">{lead.pincode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Profession:</p>
                <p className="text-gray-700 font-medium">{lead?.profession || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Monthly Income:</p>
                <p className="text-gray-700 font-medium">{lead.salary ? `₹ ${Number(lead.salary).toLocaleString('en-IN')}` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Loan Amount:</p>
                <p className="text-gray-700 font-medium">{lead.loanAmount ? `₹ ${Number(lead.loanAmount).toLocaleString('en-IN')}` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Loan Purpose:</p>
                <p className="text-gray-700 font-medium">{lead.loan_purpose || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">UTM Source:</p>
                <p className="text-gray-700 font-medium">{lead.utm_source || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">UTM Medium:</p>
                <p className="text-gray-700 font-medium">{lead.utm_medium || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">UTM Campaign:</p>
                <p className="text-gray-700 font-medium">{lead.utm_campaign || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Created At:</p>
                <p className="text-gray-700 font-medium">{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Offers" && (
          <div>
            {/* MoneyView Offer Cards */}
            <OfferCards offers={moneyViewOffers} title="MoneyView Loan Offers" colorScheme="blue" />

            {/* KreditBee Offer Cards */}
            <OfferCards offers={kreditBeeOffers} title="KreditBee Loan Offers" colorScheme="green" />

            {/* All Lender Response Cards */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {lenderEntries.map(([name, response]) => (
                  <LenderCard key={name} name={name} response={response} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 p-4 border border-gray-200 rounded-lg mb-8">No lender response data available.</p>
            )}

            {/* Static Lenders */}
            {staticLenders.length > 0 && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Static Lenders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {staticLenders.map((lender, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-5 shadow-sm bg-gray-50">
                      <h4 className="text-base font-bold text-gray-800 mb-2">{lender.name}</h4>
                      {lender.utm_link && (
                        <a href={lender.utm_link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline break-all">
                          {lender.utm_link.length > 60 ? lender.utm_link.slice(0, 60) + '...' : lender.utm_link}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Salaried Flag */}
            {lenderResponse.isSalaried !== undefined && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm">
                <span className="font-semibold text-gray-600">Salaried:</span>
                <span className="font-bold">{lenderResponse.isSalaried ? 'Yes' : 'No'}</span>
              </div>
            )}

            {/* No data at all */}
            {lenderEntries.length === 0 && moneyViewOffers.length === 0 && kreditBeeOffers.length === 0 && staticLenders.length === 0 && (
              <div className="text-center p-8 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-lg font-medium text-gray-500">No offer data found for this lead.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MVSuccessDetail;
