
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, Copy, XCircle, ExternalLink, Layers, ArrowLeft,
  User, Phone, Mail, Calendar, CreditCard, MapPin, Briefcase,
  Wallet, IndianRupee, Target, Globe, Share2, Megaphone, Clock, UserRound,
  MousePointerClick, Sparkles, Gauge, Award, ShieldX, TrendingUp, ArrowUpCircle, Loader2,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import LeadFeedback from '../../components/LeadFeedback/LeadFeedback';
import { getSelectedLendersByPhone, getShortSelectedLendersByPhone, getBreEligibility, getBreOffers, getOfferLeadById, getShortOfferLeadById } from '../../api-services/Modules/Leads';
import { useAuth } from '../../custom-hooks/useAuth';
import { isCallCenterRole } from '../../custom-hooks/callCenterBands';

const SKIP_KEYS = ['isSalaried', 'staticLenders', 'priorityOrder','kreditBeeCoupon'];

// A "static lender" placeholder is written into lender_response as a top-level
// key holding only { name, utm_link } — no `message`, no nested API response
// (e.g. RapidMoney). Those are redirect-only offers, NOT real accept/reject
// responses, so classifying them as "Rejected" (the empty-message fallback) is
// wrong. We detect them by: has a redirect link AND carries no message. Real
// responses that happen to belong to a static-brand name (e.g. poonawalla
// returning "Unauthorized") DO have a message, so they stay classified.
const getStaticLink = (resp) => resp?.utm_link || resp?.redirectionLink || null;
const isStaticPlaceholder = (resp) => {
  if (!resp || typeof resp !== 'object') return false;
  const hasMessage = (resp.message ?? '').toString().trim().length > 0;
  return !hasMessage && Boolean(getStaticLink(resp));
};

// Classify a single lender response into: success | dedupe | reject.
// Per-lender success checks come first (mirrors backend LENDER_EXTRACTORS in
// shortOfferLeads.services.js) because some lenders' "success" lives in
// nested fields, not the top-level `message`. e.g. KreditBee returns
// `message: "Create leadStatus : Approved"` with the real signal at
// `data.response.model.leadStatus = 'Approved'` — message-only classification
// would mark it Rejected. Falls back to message text for everything else.
const classifyLenderResponse = (resp, name) => {
  if (!resp || typeof resp !== 'object') return 'reject';

  if (name === 'RamFinCorp' && resp?.message === 'Attributed Successfully') return 'success';
  if (name === 'KreditBee' && resp?.data?.response?.model?.leadStatus === 'Approved') return 'success';
  if (name === 'smartCoin' && resp?.data?.response?.leadId) return 'success';
  if (name === 'MPokket' && (resp?.requestId || resp?.data?.resData?.data?.requestId)) return 'success';
  // InCred — single 'InCred' key now carries BOTH stages:
  //   apply  → APPLICATION_ID issued
  //   dedupe → isAllowed === true (message "Request Processed Successfully"
  //            matches no keyword below, so the explicit check is required or
  //            it would fall through to 'reject').
  // if (name === 'InCred' && (resp?.data?.response?.response?.APPLICATION_ID || resp?.data?.response?.response?.isAllowed === true)) return 'success';
   if (name === 'InCred') {
    const inc = resp?.data?.response?.response;
    if (inc?.STATUS === 'REJECTED') return 'reject';
    if (inc?.APPLICATION_ID || inc?.isAllowed === true) return 'success';
  }

  // Legacy 'InCred Dedupe' key (pre-rename rows).
  if (name === 'InCred Dedupe' && resp?.data?.response?.response?.isAllowed === true) return 'success';

  const message = (resp.message || '').toString().toLowerCase().trim();
  if (!message) return 'reject';

  // TrueBalance edge case: duplication-check passed (isRepeat = false) and eligible → success
  if ( message.includes('iseligible = true')) {
    return 'success';
  }
  
  if (message.includes('no duplicate') || message.includes('duplicate not found')) {
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
  if (message === 'success' || message.includes('activity posted') || message.includes('accept')) {
    return 'success';
  }

  return 'reject';
};

const STATUS_META = {
  success: {
    label: 'Success', Icon: CheckCircle2,
    chip: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-200', accent: 'bg-emerald-500',
    iconWrap: 'bg-emerald-50 text-emerald-600',
    ring: 'hover:border-emerald-300',
  },
  dedupe: {
    label: 'Duplicate', Icon: Copy,
    chip: 'bg-amber-100 text-amber-700',
    border: 'border-amber-200', accent: 'bg-amber-400',
    iconWrap: 'bg-amber-50 text-amber-600',
    ring: 'hover:border-amber-300',
  },
  reject: {
    label: 'Rejected', Icon: XCircle,
    chip: 'bg-rose-100 text-rose-700',
    border: 'border-rose-200', accent: 'bg-rose-500',
    iconWrap: 'bg-rose-50 text-rose-600',
    ring: 'hover:border-rose-300',
  },
};

const LenderCard = ({ name, response }) => {
  if (!response || typeof response !== 'object') return null;

  const status = classifyLenderResponse(response, name);
  const meta = STATUS_META[status];
  const { Icon } = meta;
  const message = response.message || 'N/A';
  // For Zype, prioritize the redirectionLink. For others, use utm_link.
  const isZype = name && name.toLowerCase().includes('zype');
  const link = isZype ? (response.redirectionLink || response.utm_link) : response.utm_link;

  return (
    <div className={`group relative flex flex-col bg-white border ${meta.border} ${meta.ring} rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}>
      {/* status accent strip */}
      <span className={`absolute inset-x-0 top-0 h-1 ${meta.accent}`} />

      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 grid place-items-center w-9 h-9 rounded-xl ${meta.iconWrap}`}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <h3 className="text-base font-bold text-gray-800 truncate">{name}</h3>
        </div>
        <span className={`shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-full ${meta.chip}`}>
          {meta.label}
        </span>
      </div>

      <div className="px-5 pb-5 space-y-3 flex-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Message</p>
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>
        {response.is_offer !== undefined && (
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Offer Available</p>
            <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${response.is_offer ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
              {response.is_offer ? 'Yes' : 'No'}
            </span>
          </div>
        )}
        {link && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">UTM Link</p>
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:underline break-all">
              <ExternalLink size={13} className="shrink-0" />
              <span className="break-all">{link.length > 52 ? link.slice(0, 52) + '...' : link}</span>
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

// Single label/value cell with a soft icon chip. Used across the Basic tab.
const Field = (props) => {
  const { Icon, label, value, valueClass = 'text-gray-800' } = props;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid place-items-center w-8 h-8 rounded-lg bg-gray-50 text-gray-400 shrink-0">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className={`text-sm font-semibold break-words ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
};

// Card section wrapper with a coloured header icon + title.
const InfoSection = (props) => {
  const { Icon, title, tint, children } = props;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-5">
        <div className={`grid place-items-center w-8 h-8 rounded-lg ${tint}`}>
          <Icon size={16} />
        </div>
        <h3 className="text-sm font-bold text-gray-800 tracking-tight">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        {children}
      </div>
    </div>
  );
};

// ── BRE Offers tab ──────────────────────────────────────────────────────────
// Renders the response from /offer-leads/bre-offers/:mrn (the BRE bureau
// service). Only mounted when the lead is present in the BRE dataset.

const confidenceChip = (c) => {
  const k = String(c || '').toUpperCase();
  if (k === 'HIGH') return 'bg-emerald-100 text-emerald-700';
  if (k === 'MEDIUM') return 'bg-amber-100 text-amber-700';
  if (k === 'LOW') return 'bg-rose-100 text-rose-700';
  return 'bg-gray-100 text-gray-600';
};

const decisionChip = (d) => {
  const k = String(d || '').toUpperCase();
  if (k === 'APPROVE') return 'bg-emerald-100 text-emerald-700';
  if (k === 'REJECT') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
};

const ProbBar = ({ value }) => {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  const tone = v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full ${tone} rounded-full`} style={{ width: `${v}%` }} />
    </div>
  );
};

const BreOfferCard = ({ offer, variant = 'eligible' }) => {
  const borderTone = variant === 'fallback' ? 'border-amber-200' : 'border-indigo-100';
  return (
    <div className={`relative bg-white border ${borderTone} rounded-2xl shadow-sm hover:shadow-md transition-all p-5`}>
      {offer.rank != null && (
        <span className="absolute top-4 right-4 grid place-items-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
          #{offer.rank}
        </span>
      )}
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-base font-bold text-gray-800 truncate">{offer.lender}</h4>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {offer.category && <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600">{offer.category}</span>}
        {offer.tier && <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-600">{offer.tier}</span>}
        {offer.approval_confidence && (
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${confidenceChip(offer.approval_confidence)}`}>
            {offer.approval_confidence}
          </span>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Approval Probability</span>
            <span className="text-sm font-bold text-gray-800">{offer.approval_probability ?? 0}%</span>
          </div>
          <ProbBar value={offer.approval_probability} />
        </div>
        {offer.typical_rate && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Typical Rate</span>
            <span className="text-sm font-semibold text-gray-700">{offer.typical_rate}</span>
          </div>
        )}
        {offer.note && <p className="text-xs text-amber-600 font-medium pt-1">{offer.note}</p>}
      </div>
    </div>
  );
};

const BreStat = ({ label, value, tone = 'text-gray-900' }) => (
  <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <p className={`text-xl font-extrabold ${tone}`}>{value}</p>
  </div>
);

// Skeleton shown while the BRE offers are being built + fetched. Mirrors the
// real layout (hero → stats → offer cards) so the transition feels seamless.
const BreOffersSkeleton = () => (
  <div className="space-y-7 animate-pulse">
    {/* status line */}
    <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 font-medium">
      <Loader2 size={16} className="animate-spin" />
      <span>Fetching BRE offers…</span>
    </div>
    {/* hero */}
    <div className="h-36 rounded-2xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
    {/* summary stats */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-gray-100 border border-gray-100" />
      ))}
    </div>
    {/* offer cards */}
    <div>
      <div className="h-5 w-40 rounded bg-gray-200 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="flex gap-1.5">
              <div className="h-4 w-12 rounded-full bg-gray-100" />
              <div className="h-4 w-12 rounded-full bg-gray-100" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const BreOffersTab = ({ loading, data }) => {
  if (loading) return <BreOffersSkeleton />;
  // Any error or missing data shows a single clean empty state — never a raw
  // error/500 to the user. (Failures are still logged server-side.)
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 border border-dashed border-gray-200 rounded-2xl bg-gray-50/60">
        <Sparkles size={28} className="text-gray-300" />
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  const offers = data.offers || [];
  const fallback = data.fallback_offers || [];
  const ineligible = data.ineligible_lenders || [];
  const summary = data.summary || {};
  const upgrades = data.upgrade_suggestions || [];

  return (
    <div className="space-y-7">
      {/* Hero — bureau snapshot */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 p-6 text-white shadow-lg shadow-indigo-500/20">
        <div className="absolute -top-10 -right-8 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/30 shrink-0">
              <Sparkles size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight truncate">{data.applicant_name || 'BRE Offers'}</h2>
              <p className="text-xs text-white/80">MRN {data.mrn || '—'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.tier && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">{data.tier}</span>}
            {data.decision && <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${decisionChip(data.decision)}`}>{data.decision}</span>}
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70 flex items-center gap-1"><Gauge size={12} /> Bureau Score</p>
            <p className="text-2xl font-extrabold">{data.bureau_score ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70 flex items-center gap-1"><TrendingUp size={12} /> BRE Score</p>
            <p className="text-2xl font-extrabold">{data.bre_score ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70 flex items-center gap-1"><Award size={12} /> Best Lender</p>
            <p className="text-base font-bold truncate">{summary.best_offer?.lender || '—'}</p>
            {summary.best_offer?.approval_probability != null && (
              <p className="text-xs text-white/80">{summary.best_offer.approval_probability}% approval</p>
            )}
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70 flex items-center gap-1"><CheckCircle2 size={12} /> Eligible</p>
            <p className="text-2xl font-extrabold">{summary.eligible_count ?? offers.length}</p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BreStat label="Lenders Evaluated" value={summary.total_lenders_evaluated ?? '—'} />
          <BreStat label="Eligible" value={summary.eligible_count ?? '—'} tone="text-emerald-600" />
          <BreStat label="Fallback" value={summary.fallback_count ?? '—'} tone="text-amber-600" />
          <BreStat label="Ineligible" value={summary.ineligible_count ?? '—'} tone="text-rose-600" />
        </div>
      )}

      {/* Eligible offers */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={18} /></div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Eligible Offers</h3>
            <p className="text-xs text-gray-400">{offers.length} lender{offers.length === 1 ? '' : 's'} ranked by approval probability</p>
          </div>
        </div>
        {offers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {offers.map((o, i) => <BreOfferCard key={`${o.lender}-${i}`} offer={o} />)}
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60">No eligible lenders.</p>
        )}
      </div>

      {/* Fallback offers */}
      {fallback.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-amber-50 text-amber-600"><Layers size={18} /></div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">Fallback Offers</h3>
              <p className="text-xs text-gray-400">{fallback.length} sub-prime fallback{fallback.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {fallback.map((o, i) => <BreOfferCard key={`${o.lender}-${i}`} offer={o} variant="fallback" />)}
          </div>
        </div>
      )}

      {/* Upgrade suggestions */}
      {upgrades.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600"><ArrowUpCircle size={18} /></div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Upgrade Path</h3>
          </div>
          <div className="space-y-3">
            {upgrades.map((u, i) => (
              <div key={i} className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">{u.action}</p>
                  {u.unlocks_count != null && (
                    <span className="shrink-0 px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-600 text-white">
                      +{u.unlocks_count} lender{u.unlocks_count === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                {Array.isArray(u.unlocks) && u.unlocks.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.unlocks.map((l, j) => (
                      <span key={j} className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-white text-indigo-600 border border-indigo-200">{l}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ineligible lenders */}
      {ineligible.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-rose-50 text-rose-600"><ShieldX size={18} /></div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">Ineligible Lenders</h3>
              <p className="text-xs text-gray-400">{ineligible.length} lender{ineligible.length === 1 ? '' : 's'} did not qualify</p>
            </div>
          </div>
          <div className="overflow-x-auto border border-gray-100 rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Lender</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Prob.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Fail Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ineligible.map((l, i) => (
                  <tr key={`${l.lender}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{l.lender}</td>
                    <td className="px-4 py-3 text-gray-600">{l.category || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{l.approval_probability ?? 0}%</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(l.fail_reasons || []).map((r, j) => (
                          <span key={j} className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-rose-50 text-rose-600">{r}</span>
                        ))}
                        {(!l.fail_reasons || l.fail_reasons.length === 0) && <span className="text-gray-400 italic">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const OfferLeadDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isCC = isCallCenterRole(user?.role);
  // The dashboard list now sends only the grid columns (minimal payload), so the
  // row handed over via router state is incomplete. Seed from it for an instant
  // first paint, then refetch the full record by phone (effect below) and overlay
  // the rest. Everything downstream reads `lead` (aliased to fullLead).
  const { lead: leadFromState } = location.state || {};
  const [fullLead, setFullLead] = useState(leadFromState);
  const [activeTab, setActiveTab] = useState("Basic");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLenders, setSelectedLenders] = useState([]);
  const [slLoading, setSlLoading] = useState(false);

  // BRE Offers (CIBIL bureau). `breEligible` (cheap pi_dedup check) gates the
  // tab; `breFetched` ensures the heavy offers call runs once, lazily, when the
  // user first opens the tab.
  const [breData, setBreData] = useState(null);
  const [breEligible, setBreEligible] = useState(false);
  const [breLoading, setBreLoading] = useState(false);
  const [breFetched, setBreFetched] = useState(false);
  // Fetch guard is a ref (not state) so starting the offers fetch doesn't
  // retrigger the lazy effect. Also set when eligibility returns cached data,
  // so opening the tab skips the /bre-offers call entirely.
  const breFetchStarted = useRef(false);

  // This page serves both /offer-leads (high) and /short-offer-leads (short), so
  // read the clicks from the matching table.
  const isShort = location.pathname.includes('short');

  // Everything below reads `lead`: starts as the minimal list row (instant
  // paint), upgraded to the full record once the by-id refetch resolves.
  const lead = fullLead;

  // Refetch the complete offer-lead row by id (URL param). The dashboard list
  // sends only the grid columns, so detail-only fields (lender_response,
  // shown_offers, email, dob, pan_no, utm_*) are missing from the state row —
  // this fills them in. Keeps the state row on failure. Fetching by id (not
  // phone) returns the exact row clicked, not just the latest for that phone.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetcher = isShort ? getShortOfferLeadById : getOfferLeadById;
    fetcher(id)
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.success && res.data.data) {
          setFullLead((prev) => ({ ...(prev || {}), ...res.data.data }));
        }
      })
      .catch(() => { /* keep the state row on failure */ });
    return () => { cancelled = true; };
  }, [id, isShort]);

  // Lenders this user actually clicked (selectedLenders / shortSelectedLenders),
  // keyed by phone — powers the "Selected Lenders" tab.
  useEffect(() => {
    const phone = lead?.phone;
    if (!phone) return;
    let cancelled = false;
    setSlLoading(true);
    const fetcher = isShort ? getShortSelectedLendersByPhone : getSelectedLendersByPhone;
    fetcher(phone)
      .then((res) => { if (!cancelled && res?.data?.success) setSelectedLenders(res.data.data || []); })
      .catch(() => { /* keep empty on failure */ })
      .finally(() => { if (!cancelled) setSlLoading(false); });
    return () => { cancelled = true; };
  }, [lead?.phone, isShort]);

  // 1) Cheap membership check on page load — decides whether the BRE Offers tab
  // is shown at all (lead's phone present in `BRE_cibil_data`.pi_dedup).
  // No payload build or BRE service call happens here.
  useEffect(() => {
    const phone = lead?.phone;
    if (!phone) { setBreEligible(false); return; }
    let cancelled = false;
    getBreEligibility(phone)
      .then((res) => {
        if (cancelled) return;
        const body = res?.data;
        const ok = Boolean(body?.success && body?.eligible);
        setBreEligible(ok);
        // If the data is already cached in bre_offers, the eligibility response
        // carries it — render from that and mark as fetched so opening the tab
        // does NOT call /bre-offers again.
        if (ok && body.cached && body.data) {
          setBreData(body.data);
          setBreFetched(true);
          breFetchStarted.current = true;
        }
      })
      .catch(() => { if (!cancelled) setBreEligible(false); });
    return () => { cancelled = true; };
  }, [lead?.phone]);

  // 2) Lazy-load the actual offers the first time the user opens the tab — ONLY
  // when not already provided by the cache (breFetchStarted set in effect 1).
  // This is the only place the payload is built and the BRE service is called.
  useEffect(() => {
    if (activeTab !== 'BRE Offers' || breFetchStarted.current) return;
    const phone = lead?.phone;
    if (!phone) return;
    breFetchStarted.current = true;
    setBreFetched(true);
    setBreLoading(true);
    getBreOffers(phone)
      .then((res) => {
        const body = res?.data;
        // On any failure / empty / ineligible, leave data null so the tab shows
        // the clean "No data available" state instead of a raw error.
        setBreData(body?.success && body?.eligible ? (body.data || null) : null);
        if (body?.offersError) console.error('BRE offers error:', body.offersError);
      })
      .catch((err) => { console.error('BRE offers load failed:', err?.message || err); })
      .finally(() => setBreLoading(false));
  }, [activeTab, lead?.phone]);

  // Call-center sees a customer-facing "Shown Offers" tab (what was rendered to the
  // user) instead of "Offers" (which exposes internal rejection / dedupe responses).
  // "BRE Offers" is appended only when the lead exists in the BRE bureau dataset.
  const tabs = ["Basic", "Offers", "Selected Lenders", ...(breEligible ? ["BRE Offers"] : [])];

  // No row yet but we have an id (e.g. opened via direct link / refresh) — the
  // by-id fetch above is in flight, so show a loader instead of the error.
  if (!lead && id) {
    return (
      <div className="p-10 text-gray-500">Loading lead…</div>
    );
  }

  if (!lead) {
    return (
      <div className="p-10 border border-red-300 bg-red-50 rounded-lg">
        <h1 className="text-2xl font-bold text-red-800 mb-2">Data Loading Error!</h1>
        <p className="text-red-700">Lead data could not be found. Please go back and select a lead.</p>
        <button onClick={() => navigate(-1)} className="mt-4 inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"><ArrowLeft size={16} /> Go Back</button>
      </div>
    );
  }

  const lenderResponse = lead?.lender_response || {};

  // "Shown Offers" (call-center): the lenders actually rendered to the customer on
  // the offers page — stored on the offerLeads row's shown_offers JSON column. Each
  // entry is a lender name (string) or an object carrying lenderName/name.
  const shownOffers = (() => {
    let raw = lead?.shown_offers;
    if (!raw) return [];
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return []; } }
    if (!Array.isArray(raw)) return [];
    return raw.map((o) => (typeof o === 'string' ? o : (o?.lenderName || o?.name || ''))).filter(Boolean);
  })();

  // Avatar initials from the lead name (max 2 letters).
  const initials = (lead.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

  // All top-level object entries (skip non-lender meta keys)
  const topLevelEntries = Object.entries(lenderResponse).filter(([key, val]) => !SKIP_KEYS.includes(key) && typeof val === 'object' && val !== null && !Array.isArray(val));

  // Split into real lender responses (classified into success/dedupe/reject)
  // and static-lender placeholders (link-only, shown in the Static Lenders
  // section instead of being mislabeled "Rejected").
  const allLenderEntries = topLevelEntries.filter(([, resp]) => !isStaticPlaceholder(resp));
  const placeholderStatic = topLevelEntries
    .filter(([, resp]) => isStaticPlaceholder(resp))
    .map(([key, resp]) => ({ name: resp.name || key, utm_link: getStaticLink(resp) }));

  // Counts per status (for filter button badges)
  const statusCounts = allLenderEntries.reduce(
    (acc, [name, resp]) => {
      const s = classifyLenderResponse(resp, name);
      acc[s] = (acc[s] || 0) + 1;
      acc.all += 1;
      return acc;
    },
    { all: 0, success: 0, dedupe: 0, reject: 0 }
  );

  // Apply status filter
  const lenderEntries = statusFilter === 'all'
    ? allLenderEntries
    : allLenderEntries.filter(([name, resp]) => classifyLenderResponse(resp, name) === statusFilter);

  // Extract MoneyView offers
  const moneyViewOffers = lenderResponse?.MoneyView?.data?.resData?.data?.response?.offerObjects || [];

  // Extract KreditBee offers
  const kreditBeeOffers = lenderResponse?.KreditBee?.data?.resData?.data?.response?.offerObjects || [];

  // Static lenders — declared array + any link-only top-level placeholders
  // (e.g. RapidMoney), deduped by name so each brand shows exactly once.
  const declaredStatic = lenderResponse?.staticLenders || [];
  const staticLenders = [...declaredStatic, ...placeholderStatic].reduce((acc, lender) => {
    const key = (lender?.name || '').toLowerCase();
    if (!key || acc.seen.has(key)) return acc;
    acc.seen.add(key);
    acc.list.push(lender);
    return acc;
  }, { seen: new Set(), list: [] }).list;

  return (
    <div className="w-full">
      {/* Toaster — feedback save success/error notifications render here */}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
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
          <div className="space-y-5">
            {/* Hero header — avatar + name + quick chips */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 text-white shadow-lg shadow-indigo-500/20">
              <div className="absolute -top-10 -right-8 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="grid place-items-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30 text-2xl font-black shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight truncate">{lead.name || 'Unnamed Lead'}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {lead.id && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold">
                        ID #{lead.id}
                      </span>
                    )}
                    {lead.gender && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold capitalize">
                        <UserRound size={12} /> {lead.gender.toLowerCase()}
                      </span>
                    )}
                    {lead.profile && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold capitalize">
                        <Briefcase size={12} /> {lead.profile.toLowerCase()}
                      </span>
                    )}
                    {lead.createdAt && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold">
                        <Clock size={12} /> {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal details */}
            <InfoSection Icon={User} title="Personal Details" tint="bg-indigo-50 text-indigo-600">
              <Field Icon={User} label="Name" value={lead.name || 'N/A'} />
              <Field Icon={Phone} label="Phone" value={lead.phone || 'N/A'} />
              <Field
                Icon={ExternalLink}
                label="Dashboard Link"
                value={lead.dashboard_url ? (
                  <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
                    <a
                      href={lead.dashboard_url}
                      target="_blank"
                      rel="noreferrer"
                      title={lead.dashboard_url}
                      className="truncate max-w-[220px] text-purple-700 hover:underline"
                    >
                      {lead.dashboard_url}
                    </a>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText(lead.dashboard_url); toast.success('Dashboard link copied'); }}
                      className="inline-flex items-center shrink-0 text-gray-500 hover:text-purple-700"
                      title="Copy link"
                    >
                      <Copy size={13} />
                    </button>
                  </span>
                ) : <span className="font-normal text-gray-400">No link yet</span>}
              />
              <Field Icon={Mail} label="Email" value={lead.email || 'N/A'} />
              <Field Icon={UserRound} label="Gender" value={lead.gender || 'N/A'} valueClass="text-gray-800 capitalize" />
              <Field Icon={Calendar} label="Date of Birth" value={lead.dob || 'N/A'} />
              <Field Icon={CreditCard} label="PAN No" value={lead.pan_no || 'N/A'} />
              <Field Icon={MapPin} label="Pincode" value={lead.pincode || 'N/A'} />
              <Field Icon={Briefcase} label="Profile" value={lead.profile || 'N/A'} valueClass="text-gray-800 capitalize" />
            </InfoSection>

            {/* Loan details */}
            <InfoSection Icon={Wallet} title="Loan Details" tint="bg-emerald-50 text-emerald-600">
              <Field Icon={Wallet} label="Monthly Income" value={lead.monthly_income ? `₹ ${Number(lead.monthly_income).toLocaleString('en-IN')}` : 'N/A'} valueClass="text-emerald-700" />
              <Field Icon={IndianRupee} label="Loan Amount" value={lead.loan_amount ? `₹ ${Number(lead.loan_amount).toLocaleString('en-IN')}` : 'N/A'} valueClass="text-emerald-700" />
              <Field Icon={Target} label="Loan Purpose" value={lead.loan_purpose || 'N/A'} />
            </InfoSection>

            {/* Tracking / UTM */}
            <InfoSection Icon={Globe} title="Tracking & Source" tint="bg-amber-50 text-amber-600">
              <Field Icon={Globe} label="UTM Source" value={lead.utm_source || 'N/A'} />
              <Field Icon={Share2} label="UTM Medium" value={lead.utm_medium || 'N/A'} />
              <Field Icon={Megaphone} label="UTM Campaign" value={lead.utm_campaign || 'N/A'} />
              <Field Icon={Clock} label="Created At" value={lead.createdAt ? new Date(lead.createdAt).toLocaleString() : 'N/A'} />
            </InfoSection>

            {/* Frontend event tracking (offerLeads.tracking_events) — which UI
                events the user did (e.g. InCred fake-offer modal shown) + when. */}
            {lead.tracking_events && Object.keys(lead.tracking_events).some((k) => !k.endsWith('_at')) && (
              <InfoSection Icon={MousePointerClick} title="Tracking Events" tint="bg-violet-50 text-violet-600">
                {Object.keys(lead.tracking_events)
                  .filter((k) => !k.endsWith('_at'))
                  .map((k) => (
                    <Field
                      key={k}
                      Icon={CheckCircle2}
                      label={k.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                      value={lead.tracking_events[`${k}_at`] || 'Yes'}
                      valueClass="text-violet-700"
                    />
                  ))}
              </InfoSection>
            )}

            {/* Call-center feedback — this page is shared by high-ticket
                (/offer-leads) and short-ticket (/short-offer-leads), so pick the
                feedback table from the URL. */}
            <LeadFeedback phone={lead.phone} scope={location.pathname.includes('short') ? 'short' : 'high'} />
          </div>
        )}

        {activeTab === "Offers" && (
          <div>
            {/* MoneyView Offer Cards */}
            <OfferCards offers={moneyViewOffers} title="MoneyView Loan Offers" colorScheme="blue" />

            {/* KreditBee Offer Cards */}
            <OfferCards offers={kreditBeeOffers} title="KreditBee Loan Offers" colorScheme="green" />

            {/* All Lender Response Cards */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">Lender Responses</h3>
                  <p className="text-xs text-gray-400">{statusCounts.all} {statusCounts.all === 1 ? 'lender' : 'lenders'} responded</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'all', label: 'All', activeCls: 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200', idleCls: 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50' },
                  { key: 'success', label: 'Success', activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200', idleCls: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                  { key: 'dedupe', label: 'Duplicate', activeCls: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200', idleCls: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' },
                  { key: 'reject', label: 'Rejected', activeCls: 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-200', idleCls: 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50' },
                ].map(btn => {
                  const isActive = statusFilter === btn.key;
                  const count = statusCounts[btn.key] || 0;
                  return (
                    <button
                      key={btn.key}
                      onClick={() => setStatusFilter(btn.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${isActive ? btn.activeCls : btn.idleCls}`}
                    >
                      {btn.label}
                      <span className={`grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25' : 'bg-gray-100 text-gray-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {lenderEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {lenderEntries.map(([name, response]) => (
                  <LenderCard key={name} name={name} response={response} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 mb-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50/60">
                <Layers size={28} className="text-gray-300" />
                <p className="text-sm text-gray-500">No lenders match this filter.</p>
              </div>
            )}

            {/* Static Lenders */}
            {staticLenders.length > 0 && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-5">Static Lenders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                  {staticLenders.map((lender, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-2xl p-5 shadow-sm bg-white hover:shadow-md transition-shadow">
                      <h4 className="text-base font-bold text-gray-800 mb-2">{lender.name}</h4>
                      {lender.utm_link && (
                        <a href={lender.utm_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline break-all">
                          <ExternalLink size={13} className="shrink-0" />
                          <span className="break-all">{lender.utm_link.length > 52 ? lender.utm_link.slice(0, 52) + '...' : lender.utm_link}</span>
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

        {activeTab === "Shown Offers" && (
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600">
                <Layers size={18} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 leading-tight">Shown Offers</h3>
                <p className="text-xs text-gray-400">
                  {shownOffers.length} offer{shownOffers.length === 1 ? '' : 's'} rendered to the customer on the offers page
                </p>
              </div>
            </div>

            {shownOffers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {shownOffers.map((name, idx) => (
                  <div
                    key={`${name}-${idx}`}
                    className="flex items-center gap-3 border border-emerald-100 rounded-2xl p-4 shadow-sm bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{name}</p>
                      <p className="text-[11px] text-emerald-600 font-medium">Shown to customer</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 border border-dashed border-gray-200 rounded-2xl bg-gray-50/60">
                <Layers size={28} className="text-gray-300" />
                <p className="text-sm text-gray-500">No offers were shown to this customer (or not tracked).</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "Selected Lenders" && (
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="grid place-items-center w-9 h-9 rounded-xl bg-purple-50 text-purple-600">
                <MousePointerClick size={18} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 leading-tight">Selected Lenders</h3>
                <p className="text-xs text-gray-400">
                  {selectedLenders.length} lender{selectedLenders.length === 1 ? '' : 's'} clicked by this user
                </p>
              </div>
            </div>

            {slLoading ? (
              <p className="text-sm text-gray-500 py-10 text-center">Loading…</p>
            ) : selectedLenders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 border border-dashed border-gray-200 rounded-2xl bg-gray-50/60">
                <MousePointerClick size={28} className="text-gray-300" />
                <p className="text-sm text-gray-500">This user hasn’t clicked any lender yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Lender</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Clicked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedLenders.map((s, i) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{s.lenderName || <span className="text-gray-400 italic">N/A</span>}</td>
                        <td className="px-4 py-3">
                          {s.status
                            ? <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 uppercase">{s.status}</span>
                            : <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "BRE Offers" && (
          <BreOffersTab loading={breLoading || !breFetched} data={breData} />
        )}
      </div>
    </div>
  );
};

export default OfferLeadDetail;