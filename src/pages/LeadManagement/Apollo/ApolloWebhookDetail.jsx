import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft, Hash, User, Megaphone, IndianRupee, Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import PremiumLoader from '../../../components/PremiumLoader';
import { getApolloEventDetail } from '../../../api-services/Modules/ApolloWebhook';

const fmtInr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
const fmtDT = (s) => (s ? String(s).replace('T', ' ').slice(0, 19) : '—');

// Colour a stage by its meaning — green = disbursed/signed, red = rejected, amber = mid.
const stageTone = (s) => {
  const t = String(s || '').toLowerCase();
  if (/disburs|signed|complete|success/.test(t)) return { chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
  if (/reject|fail|declin|cancel/.test(t)) return { chip: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' };
  return { chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' };
};

const Info = ({ icon, label, value, mono }) => (
  <div className="flex items-start gap-2.5">
    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 grid place-items-center shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-[13.5px] font-semibold text-gray-800 truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  </div>
);

const ApolloWebhookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApolloEventDetail(id);
      if (res?.data?.success) setData(res.data.data);
      else ToastNotification.error('Failed to load lead');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const lead = data?.lead;
  const timeline = data?.timeline || [];
  const commission = data?.commission || [];
  const tone = stageTone(lead?.stage);

  return (
    <>
      <Toaster />

      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-gray-400">Apollo · Loan</span>
          <span className="text-[15px] font-extrabold text-gray-900 font-mono">{id}</span>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-20"><PremiumLoader size="md" label="Loading lead…" /></div>
      ) : !lead ? (
        <div className="py-20 text-center text-gray-400 italic bg-white border border-gray-200 rounded-xl">No data for this loan.</div>
      ) : (
        <>
          {/* Header card */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-5 py-4 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow"><Activity size={22} /></div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Current Stage</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[12px] font-bold ${tone.chip}`}>{lead.stageLabel}</span>
                </div>
              </div>
              {lead.disbursementAmount != null && (
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Disbursed</p>
                  <p className="text-[20px] font-extrabold text-emerald-700">{fmtInr(lead.disbursementAmount)}</p>
                  {lead.disbursementDate && <p className="text-[11px] text-gray-500">{lead.disbursementDate}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Identity + attribution */}
          <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm px-5 py-4 mb-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Info icon={<Hash size={15} />} label="Loan ID" value={lead.loanId} mono />
            <Info icon={<User size={15} />} label="User ID" value={lead.userId} mono />
            <Info icon={<Megaphone size={15} />} label="UTM Source" value={lead.utmSource} />
            <Info icon={<Megaphone size={15} />} label="UTM Campaign" value={lead.utmCampaign} mono />
            <Info icon={<Clock size={15} />} label="Created" value={fmtDT(lead.createdAt)} />
            <Info icon={<Clock size={15} />} label="Updated" value={fmtDT(lead.updatedAt)} />
          </div>

          {/* Event timeline (apollo_events history) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Activity size={15} className="text-purple-600" />
              <h3 className="text-[14px] font-bold text-gray-800">Event Timeline</h3>
              <span className="text-[11px] text-gray-400">{timeline.length} events</span>
            </div>
            {timeline.length === 0 ? (
              <p className="px-4 py-8 text-center text-gray-400 italic text-[13px]">No events recorded.</p>
            ) : (
              <ol className="px-5 py-4">
                {timeline.map((ev, i) => {
                  const t = stageTone(ev.stage);
                  const last = i === timeline.length - 1;
                  return (
                    <li key={`${ev.stage}-${i}`} className="relative pl-6 pb-4 last:pb-0">
                      {!last && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200" />}
                      <span className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${t.dot}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${t.chip}`}>{ev.stageLabel}</span>
                        {ev.disbursementAmount != null && (
                          <span className="text-[12px] font-semibold text-emerald-700">{fmtInr(ev.disbursementAmount)}</span>
                        )}
                        <span className="text-[11.5px] text-gray-400 ml-auto">{fmtDT(ev.at)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Commission / disbursal */}
          {commission.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <IndianRupee size={15} className="text-emerald-600" />
                <h3 className="text-[14px] font-bold text-gray-800">Commission / Disbursal</h3>
              </div>
              <div className="px-5 py-3 divide-y divide-gray-50">
                {commission.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-700">
                      {/reject|fail/i.test(c.stage) ? <XCircle size={14} className="text-rose-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                      {c.stage}
                    </span>
                    <span className="text-[13px] font-bold text-emerald-700 tabular-nums">{fmtInr(c.disbursementAmount)}</span>
                    <span className="text-[11.5px] text-gray-400 w-28 text-right">{c.disbursementDate || fmtDT(c.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default ApolloWebhookDetail;
