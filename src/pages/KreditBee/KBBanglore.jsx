import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Toaster } from 'react-hot-toast';
import ToastNotification from '@components/Notification/ToastNotification';

import { getKBBangloreLogs } from '../../api-services/Modules/Leads';
import ExportModal from '../../components/ExportModal';
import SummaryCards from '../../components/Table/SummaryCards';
import MainTable from '../../components/Table/MainTable';
import { kbLogsColumn, leadsColumn } from '../../components/TableHeader';

// Debounce utility (kept as is)
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const KBBanglore = () => {
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
    status: 'success'
  });

  const [summaryMetrics, setSummaryMetrics] = useState({
    totalLeads: 0,
    successCount: 0,
    rejectCount: 0,
    duplicateCount: 0,
    errorsCount: 0
  });

  const getLeadStatusMsg = (lead) => {
    return (lead?.lender_response?.MoneyView?.message || '').toLowerCase().trim();
  };

  // Fetch backend data
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getKBBangloreLogs({
        type: query.filter_date || null,
        fromDate: query.startDate,
        toDate: query.endDate,
        perPage: query.limit,
        currentPage: query.page_no,
        status: query.status,
        search: query.search
      });
      console.log(res?.data?.data,"res?.data")
      if (res?.data) {
        setRawData(res?.data?.data || []);
        setFilteredCount(res?.data?.pagination?.total || 0);    
        // debugger
        setSummaryMetrics({
          totalLeads: res?.data?.summaryObj?.total || 10,
          successCount: res?.data?.summaryObj?.success,
          rejectCount: res?.data?.summaryObj?.reject,
          duplicateCount: res?.data?.summaryObj?.duplicate,
          errorsCount: res?.data?.summaryObj?.Errors
        });
      } else {
        ToastNotification.error('Failed to fetch logs');
      }
    } catch (err) {
      console.error(err);
      ToastNotification.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [query.filter_date, query.startDate, query.endDate, query.limit, query.page_no, query.status, query.search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads,query.search]);

  // Table data (filtered by status + search)
  const { tableData } = useMemo(() => {
    let list = [...rawData];

    const wantStatus = query.status.toLowerCase().trim();
    list = list.filter(lead => {
      const got = getLeadStatusMsg(lead);
      if (wantStatus === 'success') return got.includes('success');
      if (wantStatus === 'rejected') return got.includes('rejected');
      if (wantStatus.includes('deduped')) return got.includes('deduped');
      if (wantStatus.includes('Errors')) return got.includes('Errors');

      return true;
    });

    if (query.search) {
      const s = query.search.toLowerCase();
      list = list.filter(lead =>
        `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.phone}`
          .toLowerCase()
          .includes(s)
      );
    }

    return { tableData: list };
  }, [rawData, query.search, query.status]);

  const onPageChange = useCallback((pageInfo) => {
    setTablePagination({
      pageIndex: pageInfo.pageIndex,
      pageSize: pageInfo.pageSize,
    });
    setQuery((prevQuery) => {
      return {
        ...prevQuery,
        page_no: pageInfo.pageIndex + 1, // 1-based index for query
        limit: pageInfo.pageSize, // new limit
      };
    });
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
    let urlParams = new URLSearchParams({ mode: "download" });
    let downloadFileName;

    const now = new Date();
    const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, "-").replace(" ", "");

    // Date params come from the table's own applied filter (mirrors the list fetch).
    if (query.filter_date) {
      urlParams.append("type", query.filter_date);
      downloadFileName = `MV_Leads_${date}_${time}.csv`;
    } else if (query.startDate && query.endDate) {
      urlParams.append("fromDate", query.startDate);
      urlParams.append("toDate", query.endDate);
      downloadFileName = `SML_MV_SUCCESS_Leads_${query.startDate}_to_${query.endDate}.csv`;
    } else {
      // No date filter applied -> export the whole current view.
      downloadFileName = `MV_Leads_${date}_${time}.csv`;
    }

    try {
      ToastNotification.success("Starting CSV download...");
      const url = `${import.meta.env.VITE_API_URL}/leads/kb-success-leads-export-banglore?${urlParams.toString()}`;
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
    console.log(lead, "leadsss")
    navigate(`/kb-banglore-success-leads/${lead.id}`, { state: { lead } });
  };

  console.log(rawData, "rawData")

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
        successCount={Number(summaryMetrics.successCount) || 0}
        loading={loading}
      />
      <MainTable
        columns={kbLogsColumn({ handleEdit })}
        data={rawData || []}
        totalDataCount={filteredCount || 0}
        loading={loading}
        onPageChange={onPageChange}
        onSearch={debouncedSearch}
        onRefresh={fetchLeads}
        onExport={handleExport}
        // onCreate={() => navigate('/leads/create')}
        createLabel="Add Lead"
        title="KB LOGS - Banglore"

        // Filters
        onFilterByDate={onFilterByDate}
        activeFilter={query.filter_date}
        onFilterByRange={onFilterByRange}
        activeDateRange={{ startDate: query.startDate, endDate: query.endDate }}

        // STATUS FILTER
        onFilterChange={handleStatusFilter}
        activeStatusFilter={query.status}
      />
    </>
  );
};

export default KBBanglore;