import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Toaster } from 'react-hot-toast';
import ToastNotification from '@components/Notification/ToastNotification';

import { getScResponseLeads } from '../../api-services/Modules/Leads';
import { getDisbursalFilterOptions } from '../../api-services/Modules/Disbursal';
import ExportModal from '../../components/ExportModal';
import ModuleInfoCard from '../../components/ModuleInfoCard';
import SummaryCards from '../../components/Table/SummaryCards';
import MainTable from '../../components/Table/MainTable';
import { scResponseLeadsColumn } from '../../components/TableHeader';

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Summary card key → status filter value. Backend maps 'rejected'/'dedupted'
// to the SmartCoin classification (NOT dup & NOT success / isDuplicate).
const CARD_STATUS_MAP = { total: '', success: 'success', reject: 'rejected', duplicate: 'dedupted', error: 'error' };

const ScResponseLeads = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [filteredCount, setFilteredCount] = useState(0);
  const [tablePagination, setTablePagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    filter_date: 'today',
    startDate: null,
    endDate: null,
    status: '',
    utmMedium: '',
    utmSource: '',
  });

  // Matches the /offer-leads, /kb-lending-page, and /mv-success-leads filters
  // so the same set of traffic sources is available across modules.
  const MEDIUM_OPTIONS = [
    { value: 'moneyview', label: 'moneyview' },
    { value: 'meta', label: 'meta' },
    { value: 'kreditbee', label: 'kreditbee' },
    { value: 'zype', label: 'zype' },
    { value: 'SC', label: 'SC' },
  ];

  // Medium dropdown — merge the hardcoded baseline with the DB's distinct
  // mediums (same source as the Disbursal dashboard) so ALL mediums show.
  const [mediumOptions, setMediumOptions] = useState(MEDIUM_OPTIONS.map((m) => m.value));
  useEffect(() => {
    let cancelled = false;
    const mergeAndSort = (base, api) => {
      const seen = new Set();
      const out = [];
      for (const s of [...base, ...(Array.isArray(api) ? api : [])]) {
        const k = String(s || '').toLowerCase();
        if (!s || seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
      out.sort((a, b) => a.localeCompare(b));
      return out;
    };
    getDisbursalFilterOptions({ scope: 'high' })
      .then((res) => {
        if (cancelled) return;
        const opts = res?.data?.data || {};
        const base = MEDIUM_OPTIONS.map((m) => m.value);
        const merged = mergeAndSort(base, opts.utmMediums).filter(
          (m) => !['quickloans', 'easyloan', 'easyloans'].includes(String(m).toLowerCase())
        );
        setMediumOptions(['QuickLoans', ...merged]);
      })
      .catch((err) => console.error('Failed to load mediums:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Hardcoded source baseline — same approach as Disbursal Dashboard so the
  // dropdown always has at least one option.
  const SOURCE_OPTIONS = [
    { value: 'google', label: 'google' },
    { value: 'google_ads', label: 'google_ads' },
  ];

  const [summaryMetrics, setSummaryMetrics] = useState({
    totalLeads: 0,
    successCount: 0,
    rejectCount: 0,
    duplicateCount: 0
  });

  // Fetch backend data
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getScResponseLeads({
        type: query.filter_date || null,
        fromDate: query.startDate,
        toDate: query.endDate,
        perPage: query.limit,
        currentPage: query.page_no,
        status: query.status,
        search: query.search,
        utmMedium: query.utmMedium || undefined,
        utmSource: query.utmSource || undefined,
      });

      if (res?.data?.success) {
        setRawData(res?.data?.data?.data || []);
        setFilteredCount(res?.data?.data?.pagination?.total || 0);
        const s = res?.data?.data?.summary || {};
        setSummaryMetrics({
          totalLeads: s.total || 0,
          successCount: s.success || 0,
          rejectCount: s.rejected || 0,
          duplicateCount: s.deduped || 0
        });
      } 
      // else {
      //   ToastNotification.error('Failed to fetch leads');
      // }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [query.filter_date, query.startDate, query.endDate, query.limit, query.page_no, query.status, query.search, query.utmMedium, query.utmSource]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onPageChange = useCallback((pageInfo) => {
    setTablePagination({
      pageIndex: pageInfo.pageIndex,
      pageSize: pageInfo.pageSize,
    });
    setQuery((prevQuery) => {
      return {
        ...prevQuery,
        page_no: pageInfo.pageIndex + 1,
        limit: pageInfo.pageSize,
      };
    });
  }, []);

  const handleStatusFilter = useCallback(newStatus => {
    setQuery(prev => ({ ...prev, status: newStatus, page_no: 1 }));
  }, []);

  // Summary card → status filter. Clicking the active card toggles it off.
  const handleCardClick = useCallback(cardKey => {
    const nextStatus = CARD_STATUS_MAP[cardKey] ?? '';
    setQuery(prev => ({
      ...prev,
      status: prev.status === nextStatus ? '' : nextStatus,
      page_no: 1,
    }));
  }, []);

  // Reverse-map current status → card key so the active card is highlighted.
  const activeCardKey = useMemo(() => {
    switch (query.status) {
      case 'success': return 'success';
      case 'rejected': return 'reject';
      case 'dedupted': return 'duplicate';
      case '': return 'total';
      default: return null;
    }
  }, [query.status]);

  const handleUtmMediumFilter = useCallback(newMedium => {
    setQuery(prev => ({ ...prev, utmMedium: newMedium, page_no: 1 }));
  }, []);

  const handleUtmSourceFilter = useCallback(newSource => {
    setQuery(prev => ({ ...prev, utmSource: newSource, page_no: 1 }));
  }, []);

  const onSearchHandler = useCallback(term => {
    setQuery(prev => ({ ...prev, search: term, page_no: 1 }));
  }, []);

  const debouncedSearch = useMemo(() => debounce(onSearchHandler, 300), [onSearchHandler]);

  const onFilterByDate = useCallback(type => {
    setQuery(prev => ({
      ...prev,
      filter_date: prev.filter_date === type ? '' : type,
      startDate: null,
      endDate: null,
      page_no: 1
    }));
  }, []);

  const onFilterByRange = useCallback(range => {
    setQuery(prev => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
      filter_date: '',
      page_no: 1
    }));
  }, []);

  const handleExport = () => setExportModalOpen(true);

  const handleExportSubmit = async () => {
    setExportLoading(true);
    let urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    // Date params come from the table's own applied filter (mirrors the list fetch).
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
      downloadFileName = `SC_Response_Leads_${date}_${time}.csv`;
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
      downloadFileName = `SML_SC_Response_Leads_${query.startDate}_to_${query.endDate}.csv`;
    } else {
      // No date filter applied -> export the whole current view.
      downloadFileName = `SC_Response_Leads_${date}_${time}.csv`;
    }

    // Apply currently active filters to export so CSV matches what user sees
    if (query.search) urlParams.append("search", query.search);
    if (query.status) urlParams.append("status", query.status);
    if (query.utmMedium) urlParams.append("utmMedium", query.utmMedium);
    if (query.utmSource) urlParams.append("utmSource", query.utmSource);

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/offer-leads/sc-response-export?${urlParams.toString()}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      ToastNotification.success("Download started!");
    } catch (err) {
      console.error(err);
      ToastNotification.error("Export failed!");
    } finally {
      setExportLoading(false);
      setExportModalOpen(false);
    }
  };

  // Reuse the offer-lead detail page — rows carry the offerLeads id.
  const handleEdit = (lead) => {
    navigate(`/offer-leads/${lead.id}`, { state: { lead } });
  };

  return (
    <>
      <Toaster />

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        isSubmitting={exportLoading}
      />
      <SummaryCards
        totalLeads={Number(summaryMetrics.totalLeads) || 0}
        successCount={Number(summaryMetrics.successCount) || 0}
        rejectCount={Number(summaryMetrics.rejectCount) || 0}
        duplicateCount={Number(summaryMetrics.duplicateCount) || 0}
        loading={loading}
        duplicateCard={true}
        onCardClick={handleCardClick}
        activeKey={activeCardKey}
      />

      {/* Medium filter strip — mirrors /offer-leads and /mv-success-leads so
          SmartCoin response analysis stays aligned across modules. */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 my-3">
        <label className="text-sm font-semibold text-gray-700">
          Medium:
        </label>
        <select
          value={query.utmMedium}
          onChange={(e) => handleUtmMediumFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
        >
          <option value="">All Mediums</option>
          {mediumOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {query.utmMedium && (
          <button
            onClick={() => handleUtmMediumFilter('')}
            className="text-xs px-3 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
          >
            Clear
          </button>
        )}

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <label className="text-sm font-semibold text-gray-700">
          Source:
        </label>
        <select
          value={query.utmSource}
          onChange={(e) => handleUtmSourceFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px]"
        >
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {query.utmSource && (
          <button
            onClick={() => handleUtmSourceFilter('')}
            className="text-xs px-3 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
          >
            Clear
          </button>
        )}
      </div>

      <MainTable
        columns={scResponseLeadsColumn({ handleEdit })}
        data={rawData || []}
        totalDataCount={filteredCount || 0}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={handleExport}
        title="SC RESPONSE LEADS"

        // Filters
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}

        // STATUS FILTER
        onFilterChange={handleStatusFilter}
        activeStatusFilter={query.status}
      />

      <ModuleInfoCard
        title="SC Response Leads"
        subtitle="Every applicant who received a SmartCoin response, straight from lender_response."
        whatYouSee={[
          'All applicants who got any SmartCoin response — categorised as Success, Rejected, or Duplicate.',
          'A status badge per applicant; hover shows the original SmartCoin message.',
          'Summary cards: total / success / rejected / duplicate counts for the selected date range.',
          'Covers the full SmartCoin outcome for every lead — a dedupe/duplicate still shows up here.',
        ]}
        dataSource={[
          'Built directly from offerLeads.lender_response → smartCoin.',
          'Duplicate is decided by the isDuplicate flag (SmartCoin’s success flag can be true even on a duplicate).',
          'Success = non-duplicate application/dedupe that came back success; everything else non-dup = reject.',
        ]}
        flow={[
          'Applicant submits form',
          'SmartCoin dedupe/offer runs',
          'Response saved in lender_response',
          'Status classified',
          'Row appears here',
        ]}
      />
    </>
  );
};

export default ScResponseLeads;
