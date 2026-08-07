import { useEffect, useState, useCallback, useMemo } from 'react';
import DataTable from '@components/Table/DataTable';
import SummaryCards from '@components/Table/SummaryCards';
import { Toaster } from 'react-hot-toast';
import { leadsColumn } from '../../../components/TableHeader';
import { useNavigate } from 'react-router-dom';
import { getLeads } from '../../../api-services/Modules/Leads';
import ExportModal from '../../../components/ExportModal';
import ToastNotification from '@components/Notification/ToastNotification';

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const Leads = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalLeads: 0,
    successCount: 0,
    rejectCount: 0,
    duplicateCount: 0,
  });

  const [query, setQuery] = useState({
    page_no: 1,
    limit: 10,
    search: '',
    filter_date: 'today',
    startDate: null,
    endDate: null,
    status: ''
  });

  const [filteredCount, setFilteredCount] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeads({
        type: query.filter_date || null,
        fromDate: query.startDate,
        toDate: query.endDate,
        perPage: query.limit,
        currentPage: query.page_no,
        status: query.status,
        search: query.search,
      });
      if (res?.data?.success) {
        setRawData(res.data.data?.data || []);
        setFilteredCount(res.data.data?.pagination?.total || 0);
        const summary = res.data.data?.summary;
        if (summary) {
          setSummaryMetrics({
            totalLeads: summary.total || 0,
            successCount: summary.success || 0,
            rejectCount: summary.rejected || 0,
            duplicateCount: summary.duplicate || 0,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [query.filter_date, query.startDate, query.endDate, query.limit, query.page_no, query.status, query.search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onPageChange = useCallback(p => {
    setQuery(prev => ({ ...prev, page_no: p.pageIndex + 1, limit: p.pageSize }));
  }, []);

  const handleStatusFilter = useCallback(newStatus => {
    setQuery(prev => ({ ...prev, status: newStatus, page_no: 1 }));
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
    const urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
      downloadFileName = `SML_Leads_${date}_${time}.csv`;
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
      downloadFileName = `SML_Leads_${query.startDate}_to_${query.endDate}.csv`;
    } else {
      downloadFileName = `SML_Leads_${date}_${time}.csv`;
    }

    if (query.status) {
      urlParams.append("status", query.status);
    }

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/leads/leads-export?${urlParams.toString()}`;
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

  const handleEdit = (lead) => {
    navigate(`/lead-detail/${lead.id}`, { state: { lead } });
  };

  return (
    <>
      <Toaster />
      <SummaryCards
        totalLeads={summaryMetrics.totalLeads}
        successCount={summaryMetrics.successCount}
        rejectCount={summaryMetrics.rejectCount}
        duplicateCount={summaryMetrics.duplicateCount}
        loading={loading}
        duplicateCard={true}
      />
      <DataTable
        columns={leadsColumn({ handleEdit })}
        data={rawData}
        totalDataCount={filteredCount}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={handleExport}
        onCreate={() => navigate('/leads/create')}
        createLabel="Add Lead"
        title="Logs"

        // Filters
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}

        // STATUS FILTER
        onFilterChange={handleStatusFilter}
        activeStatusFilter={query.status}
      />
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        isSubmitting={exportLoading}
      />
    </>
  );
};

export default Leads;