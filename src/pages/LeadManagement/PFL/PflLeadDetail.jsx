import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ChevronLeft, Phone, Mail, CreditCard, Hash, User, Clock, FileText } from 'lucide-react';

import ToastNotification from '@components/Notification/ToastNotification';
import PremiumLoader from '../../../components/PremiumLoader';
import { getPflLeadDetail } from '../../../api-services/Modules/PflLeads';

const toneForStatus = (s) => {
  const t = String(s || '').toLowerCase();
  if (/disburs|success|complete|verified/.test(t)) return 'bg-emerald-500';
  if (/reject|disqualif|declin|fail|cancel|expire/.test(t)) return 'bg-rose-500';
  return 'bg-purple-400';
};

const InfoChip = ({ icon, label, value, href }) => {
  if (!value) return null;
  const body = (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-800">
      {icon}{value}
    </span>
  );
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      {href ? <a href={href} onClick={(e) => e.stopPropagation()} className="hover:text-purple-700 hover:underline">{body}</a> : body}
    </div>
  );
};

const PflLeadDetail = () => {
  const { mrn } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPflLeadDetail(mrn);
      if (res?.data?.success) setData(res.data.data);
      else ToastNotification.error('Failed to load lead');
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [mrn]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const c = data?.contact || {};
  const events = data?.events || [];
  const apps = data?.applications || [];
  const name = c.name ? String(c.name).toLowerCase() : '';

  return (
    <>
      <Toaster />

      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
        <ChevronLeft size={16} /> Back
      </button>

      {loading && !data ? (
        <div className="py-20"><PremiumLoader size="md" label="Loading lead…" /></div>
      ) : !data ? (
        <div className="py-20 text-center text-gray-400 italic bg-white border border-gray-200 rounded-xl">Lead not found.</div>
      ) : (
        <>
          {/* Header — contact */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow"><User size={22} /></div>
              <div className="min-w-0">
                <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight capitalize truncate">{name || 'Unknown name'}</h1>
                <p className="text-[12px] text-gray-500">Current stage: <b>{data.currentStage || '—'}</b></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <InfoChip icon={<Hash size={13} className="text-indigo-500" />} label="MRN" value={data.mrn} />
              <InfoChip icon={<Phone size={13} className="text-indigo-500" />} label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone}` : undefined} />
              <InfoChip icon={<CreditCard size={13} className="text-indigo-500" />} label="PAN" value={c.pan} />
              <InfoChip icon={<Mail size={13} className="text-indigo-500" />} label="Email" value={c.email} />
              <InfoChip icon={<FileText size={13} className="text-indigo-500" />} label="Applications" value={apps.length ? String(apps.length) : null} />
            </div>
          </div>

          {/* Applications */}
          {apps.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-3">
              <h3 className="text-[13px] font-bold text-gray-800 mb-2">Applications ({apps.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {apps.map((a) => <span key={a} className="font-mono text-[11px] bg-gray-100 text-gray-600 px-2 py-1 rounded" title={a}>{a}</span>)}
              </div>
            </div>
          )}

          {/* Event timeline */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Clock size={15} className="text-purple-600" />
              <h3 className="text-[14px] font-bold text-gray-800">Event Timeline</h3>
              <span className="text-[11px] text-gray-400">{events.length} events (oldest → newest)</span>
            </div>
            {events.length === 0 ? (
              <div className="py-10 text-center text-gray-400 italic">No events.</div>
            ) : (
              <div className="p-4">
                <ol className="relative border-l-2 border-gray-100 ml-2">
                  {events.map((e, i) => (
                    <li key={e.correlationId || i} className="mb-4 ml-4">
                      <span className={`absolute -left-[7px] w-3 h-3 rounded-full ${toneForStatus(e.stage)} ring-2 ring-white`} />
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[13px] font-semibold text-gray-800">{e.stage}</span>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">{e.receivedAt}</span>
                      </div>
                      <div className="text-[10.5px] text-gray-400 font-mono truncate" title={e.dp}>{e.dp}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default PflLeadDetail;
