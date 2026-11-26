import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import {
  MdOutlineRemoveRedEye,
  MdZoomIn,
  MdFilterList,
  MdDownload,
  MdRefresh,
  MdCheckCircle,
  MdClose,
  MdEdit,
  MdPhone,
  MdEmail,
  MdLocationOn,
  MdOpenInNew,
} from "react-icons/md";
import Base from "../components/Base";
import TableView from "../components/TableView";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import RecordViewer from "../components/RecordViewer";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";
import { getBaseApiUrl } from "../utils/apiConfig";
import { useUserRole } from "../hooks/useAuth";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_BADGE_MAP = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-sky-50 text-sky-700 border-sky-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_BADGE_MAP = {
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function Tickets() {
  const BASE_API = getBaseApiUrl();
  const API_URL = `${BASE_API}/api/customer/admin-tickets/`;
  const STAFF_URL = `${BASE_API}/auth/staff/all/`;

  const { hasPermission } = useUserRole(BASE_API);
  const canEditTicket = hasPermission("tickets", "edit");

  const token = useMemo(
    () =>
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    []
  );

  const [allRows, setAllRows] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [recordViewerRow, setRecordViewerRow] = useState(null);

  const [staffList, setStaffList] = useState([]);
  const [managingTicket, setManagingTicket] = useState(null);
  const [manageForm, setManageForm] = useState({
    status: "open",
    priority: "medium",
    assigned_to: "",
    resolution_notes: "",
  });
  const [savingManage, setSavingManage] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!token) throw new Error("No bearer token found.");
      const res = await fetch(`${API_URL}?limit=1000`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
      }
      const data = await res.json();
      const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];

      const normalized = list.map((t) => ({
        ...t,
        company_name: t.customer_details?.name || t.customer_name || "-",
        site_name_display: t.site_details?.name || t.site_name || "-",
        site_shortcut_display: t.site_details?.site_shortcut || "",
        contact_phone_display:
          t.contact_phone ||
          t.site_details?.owner_contact ||
          t.customer_details?.contact_number ||
          "-",
        contact_person_display:
          t.contact_person ||
          t.site_details?.owner_name ||
          t.customer_details?.contact_person ||
          "-",
        assigned_name_display: t.assigned_to_details?.full_name || "-",
      }));

      setAllRows(normalized);
      setFilteredData(normalized);
    } catch (err) {
      setError(err.message || String(err));
      setAllRows([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, token]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (!token) return;
    fetch(STAFF_URL, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const items = Array.isArray(data) ? data : data.results || [];
        setStaffList(items);
      })
      .catch(() => setStaffList([]));
  }, [STAFF_URL, token]);

  const statusCounts = useMemo(() => {
    const counts = { all: allRows.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    allRows.forEach((r) => {
      const st = String(r.status || "").toLowerCase();
      if (counts[st] !== undefined) counts[st] += 1;
    });
    return counts;
  }, [allRows]);

  const displayedRows = useMemo(() => {
    if (statusFilter === "all") return filteredData;
    return filteredData.filter((r) => String(r.status || "").toLowerCase() === statusFilter);
  }, [filteredData, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, filteredData.length, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(displayedRows.length / itemsPerPage));
  const currentPageData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return displayedRows.slice(start, start + itemsPerPage);
  }, [displayedRows, currentPage, itemsPerPage]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const openManageModal = (row) => {
    setManagingTicket(row);
    setManageForm({
      status: row.status || "open",
      priority: row.priority || "medium",
      assigned_to: row.assigned_to ? String(row.assigned_to) : "",
      resolution_notes: row.resolution_notes || "",
    });
  };

  const updateTicketFields = async (ticketId, payload, successMessage = "Ticket updated") => {
    const res = await fetch(`${API_URL}${ticketId}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.detail || "Failed to update ticket.");
    }
    Swal.fire({
      icon: "success",
      title: "Updated",
      text: successMessage,
      timer: 1400,
      showConfirmButton: false,
    });
    await fetchTickets();
    return data;
  };

  const handleQuickStatusUpdate = async (row, newStatus) => {
    if (!canEditTicket || row.status === newStatus) return;

    if (newStatus === "closed" || newStatus === "resolved") {
      const result = await Swal.fire({
        title: `Mark ${row.ticket_number} as ${newStatus === "closed" ? "Closed" : "Resolved"}?`,
        input: "textarea",
        inputLabel: "Resolution Notes (optional)",
        inputValue: row.resolution_notes || "",
        inputPlaceholder: "Add resolution / closing remarks...",
        showCancelButton: true,
        confirmButtonText: newStatus === "closed" ? "Mark as Closed" : "Mark as Resolved",
        cancelButtonText: "Cancel",
      });
      if (!result.isConfirmed) return;

      try {
        await updateTicketFields(
          row.id,
          { status: newStatus, resolution_notes: result.value || "" },
          `${row.ticket_number} marked as ${newStatus}.`
        );
      } catch (err) {
        Swal.fire({ icon: "error", title: "Update Failed", text: err.message });
      }
      return;
    }

    try {
      await updateTicketFields(
        row.id,
        { status: newStatus },
        `${row.ticket_number} status updated to ${newStatus.replace(/_/g, " ")}.`
      );
    } catch (err) {
      Swal.fire({ icon: "error", title: "Update Failed", text: err.message });
    }
  };

  const handleSaveManageModal = async (e) => {
    e.preventDefault();
    if (!managingTicket) return;
    setSavingManage(true);
    try {
      await updateTicketFields(
        managingTicket.id,
        {
          status: manageForm.status,
          priority: manageForm.priority,
          assigned_to: manageForm.assigned_to ? Number(manageForm.assigned_to) : null,
          resolution_notes: manageForm.resolution_notes,
        },
        `${managingTicket.ticket_number} updated successfully.`
      );
      setManagingTicket(null);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Update Failed", text: err.message });
    } finally {
      setSavingManage(false);
    }
  };

  const handleExportExcel = () => {
    if (displayedRows.length === 0) {
      Swal.fire({
        icon: "info",
        title: "No Data to Export",
        text: "There are no ticket records matching the active filters.",
      });
      return;
    }

    const formatted = displayedRows.map((r, idx) => ({
      "Sr. No.": idx + 1,
      "Ticket #": r.ticket_number || "-",
      "Raised Date": formatExcelDate(r.created_at),
      "Company Name": r.company_name,
      "Customer Code": r.customer_details?.customer_code || "-",
      "Site Name": r.site_name_display,
      "Site Code": r.site_shortcut_display || "-",
      "Contact Person": r.contact_person_display,
      "Contact Number": r.contact_phone_display,
      "Company Email": r.customer_details?.email || "-",
      "Category": r.category_display || r.category || "-",
      "Priority": r.priority_display || r.priority || "-",
      "Subject": r.subject || "-",
      "Description": r.description || "-",
      "Status": r.status_display || r.status || "-",
      "Assigned To": r.assigned_name_display,
      "Resolution Notes": r.resolution_notes || "-",
    }));

    exportToExcel({
      data: formatted,
      fileName: "Customer_Support_Tickets",
      sheetName: "Tickets",
    });
  };

  const columns = [
    {
      key: "sr",
      label: "Sr.",
      render: (_, i) => (
        <span className="text-slate-500 text-xs font-medium">
          {(currentPage - 1) * itemsPerPage + i + 1}
        </span>
      ),
      className: "w-12 whitespace-nowrap",
    },
    {
      key: "ticket_number",
      label: (
        <div className="leading-tight">
          <div>Ticket #</div>
          <div className="text-[10px] font-normal text-slate-400">Date</div>
        </div>
      ),
      render: (r) => (
        <div className="whitespace-nowrap">
          <span className="text-sky-700 font-bold text-xs block">{r.ticket_number || "-"}</span>
          <span className="text-[10px] text-slate-400 block">{formatDate(r.created_at)}</span>
        </div>
      ),
      className: "whitespace-nowrap",
    },
    {
      key: "company_name",
      label: "Company",
      render: (r) => (
        <div
          className="max-w-[160px] truncate mx-auto text-left"
          title={`${r.company_name}${r.customer_details?.customer_code ? ` (${r.customer_details.customer_code})` : ""}${r.customer_details?.email ? ` · ${r.customer_details.email}` : ""}`}
        >
          <span className="text-slate-900 font-semibold text-xs block truncate">
            {r.company_name}
          </span>
          {r.customer_details?.customer_code && (
            <span className="text-[10px] text-slate-400 font-mono block truncate">
              {r.customer_details.customer_code}
            </span>
          )}
        </div>
      ),
      className: "min-w-[140px] max-w-[170px]",
    },
    {
      key: "site_name_display",
      label: "Site",
      render: (r) => {
        if (!r.site_details?.name && r.site_name_display === "-") {
          return <span className="text-slate-400 text-xs">-</span>;
        }
        return (
          <div
            className="max-w-[160px] truncate mx-auto text-left"
            title={`${r.site_name_display}${r.site_shortcut_display ? ` (${r.site_shortcut_display})` : ""}`}
          >
            <span className="text-sky-900 font-semibold text-xs block truncate">
              📍 {r.site_name_display}
            </span>
            {r.site_shortcut_display && (
              <span className="text-[10px] font-mono text-cyan-700 font-bold block truncate">
                ({r.site_shortcut_display})
              </span>
            )}
          </div>
        );
      },
      className: "min-w-[140px] max-w-[170px]",
    },
    {
      key: "contact_phone_display",
      label: (
        <div className="leading-tight">
          <div>Contact &amp;</div>
          <div>Mobile</div>
        </div>
      ),
      render: (r) => (
        <div className="max-w-[140px] truncate mx-auto text-left">
          <span className="text-slate-800 text-xs font-medium block truncate">
            {r.contact_person_display}
          </span>
          <span className="text-[11px] text-slate-500 font-mono block truncate">
            {r.contact_phone_display}
          </span>
        </div>
      ),
      className: "min-w-[120px] max-w-[150px]",
    },
    {
      key: "category",
      label: "Category",
      render: (r) => {
        const prioCls =
          PRIORITY_BADGE_MAP[String(r.priority || "").toLowerCase()] ||
          "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <div className="whitespace-nowrap space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-700 block max-w-[130px] truncate mx-auto">
              {r.category_display || r.category || "-"}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border inline-block ${prioCls}`}
            >
              {r.priority_display || r.priority || "-"}
            </span>
          </div>
        );
      },
      className: "whitespace-nowrap",
    },
    {
      key: "subject",
      label: "Subject",
      render: (r) => (
        <span
          className="text-slate-800 font-medium text-xs block max-w-[180px] truncate mx-auto cursor-default"
          title={`${r.subject || ""}\n${r.description || ""}`}
        >
          {r.subject || "-"}
        </span>
      ),
      className: "min-w-[140px] max-w-[200px]",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const norm = String(r.status || "open").toLowerCase();
        const badgeCls =
          STATUS_BADGE_MAP[norm] || "bg-slate-100 text-slate-700 border-slate-200";
        if (!canEditTicket) {
          return (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap inline-block ${badgeCls}`}
            >
              {r.status_display || r.status || "-"}
            </span>
          );
        }
        return (
          <select
            value={norm}
            onChange={(e) => handleQuickStatusUpdate(r, e.target.value)}
            aria-label={`Change status for ${r.ticket_number}`}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border cursor-pointer focus:outline-none ${badgeCls}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                {opt.label}
              </option>
            ))}
          </select>
        );
      },
      className: "whitespace-nowrap",
    },
    {
      key: "assigned_name_display",
      label: "Assigned To",
      render: (r) => (
        <span
          className="text-slate-700 text-xs block max-w-[130px] truncate mx-auto"
          title={r.assigned_to_details?.email || r.assigned_name_display}
        >
          {r.assigned_name_display}
        </span>
      ),
      className: "min-w-[110px] max-w-[140px]",
    },
  ];

  const actionsRenderer = useCallback(
    (row) => (
      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
        <button
          onClick={() => {
            setRecordViewerRow(row);
            setViewOpen(true);
          }}
          className="p-1 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Quick Record View"
        >
          <MdZoomIn />
        </button>

        <button
          onClick={() => openManageModal(row)}
          className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="View Company, Site & Manage Ticket"
        >
          <MdOutlineRemoveRedEye />
        </button>

        {canEditTicket && row.status !== "closed" && (
          <button
            onClick={() => handleQuickStatusUpdate(row, "closed")}
            className="p-1 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
            title="Mark as Closed"
          >
            <MdCheckCircle />
          </button>
        )}
      </div>
    ),
    [canEditTicket]
  );

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* HEADER BLOCK MATCHING LEAD.JSX */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-1.5 h-9 sm:h-10 bg-sky-600 rounded-full block shrink-0"></span>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Customer Support Tickets
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Synchronizing support tickets..."
                  : `Total ${displayedRows.length} ticket${displayedRows.length !== 1 ? "s" : ""} · ${statusCounts.open} open · ${statusCounts.in_progress} in progress`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <MdFilterList className="text-slate-400 text-sm" />
              <span>Filter</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              <span>Export</span>
            </button>
            <button
              onClick={fetchTickets}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <MdRefresh className={`text-sm ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* STATUS FILTER BAR */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: `All (${statusCounts.all})` },
            { id: "open", label: `Open (${statusCounts.open})` },
            { id: "in_progress", label: `In Progress (${statusCounts.in_progress})` },
            { id: "resolved", label: `Resolved (${statusCounts.resolved})` },
            { id: "closed", label: `Closed (${statusCounts.closed})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* REUSABLE TABLEVIEW MATCHING LEAD.JSX */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <TableView
            columns={columns}
            rows={currentPageData}
            loading={loading}
            error={error}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            pageSize={itemsPerPage}
            actions={actionsRenderer}
            emptyMessage="No customer support tickets found matching the selected filters."
          />
        </div>
      </div>

      {/* FILTER DRAWER */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {isFilterOpen && (
              <div
                className="fixed inset-0 w-screen h-screen bg-black/40 z-[9999]"
                onClick={() => setIsFilterOpen(false)}
              />
            )}
            <div
              className={`fixed top-0 right-0 h-screen w-full max-w-[380px] sm:w-[380px] bg-white shadow-2xl z-[10000] flex flex-col transition-transform duration-300 ease-in-out ${
                isFilterOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
                <h3 className="text-lg font-bold text-slate-900">Filter Tickets</h3>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <AdvancedTableFilter
                  data={allRows}
                  onFilter={setFilteredData}
                  setItemsPerPage={setItemsPerPage}
                  columns={columns}
                />
              </div>
            </div>
          </>,
          document.body
        )}

      {/* RECORD VIEWER */}
      <RecordViewer
        isOpen={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setRecordViewerRow(null);
        }}
        record={recordViewerRow}
        title="Ticket Details"
      />

      {/* MANAGE & FULL TICKET DETAILS MODAL */}
      {managingTicket && (
        <div
          className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setManagingTicket(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-sky-700 uppercase">
                    {managingTicket.ticket_number}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                    {managingTicket.category_display || managingTicket.category}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  {managingTicket.subject}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setManagingTicket(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                <MdClose size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
              {/* COMPANY & SITE DETAILS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Company / Customer Details
                  </span>
                  <p className="text-sm font-bold text-slate-900">
                    {managingTicket.company_name}{" "}
                    {managingTicket.customer_details?.customer_code &&
                      `(${managingTicket.customer_details.customer_code})`}
                  </p>
                  <p className="text-slate-700 font-medium">
                    Contact: {managingTicket.contact_person_display}
                  </p>
                  <div className="flex flex-wrap gap-3 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <MdPhone className="text-cyan-600" />
                      {managingTicket.contact_phone_display}
                    </span>
                    {managingTicket.customer_details?.email && (
                      <span className="inline-flex items-center gap-1">
                        <MdEmail className="text-sky-600" />
                        {managingTicket.customer_details.email}
                      </span>
                    )}
                  </div>
                  {(managingTicket.customer_details?.billing_address ||
                    managingTicket.customer_details?.city) && (
                    <p className="text-[11px] text-slate-500 pt-1">
                      {[
                        managingTicket.customer_details?.billing_address,
                        managingTicket.customer_details?.city,
                        managingTicket.customer_details?.state,
                        managingTicket.customer_details?.pin_code,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 bg-sky-50/40 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Site &amp; Reference Details
                  </span>
                  {managingTicket.site_details ? (
                    <>
                      <p className="text-sm font-bold text-sky-900">
                        📍 {managingTicket.site_details.name}{" "}
                        {managingTicket.site_details.site_shortcut &&
                          `(${managingTicket.site_details.site_shortcut})`}
                      </p>
                      <p className="text-[11px] text-slate-600 flex items-start gap-1">
                        <MdLocationOn className="text-sky-600 shrink-0 mt-0.5" size={14} />
                        <span>
                          {[
                            managingTicket.site_details.address,
                            managingTicket.site_details.city,
                            managingTicket.site_details.state,
                            managingTicket.site_details.pincode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </p>
                      {managingTicket.site_details.owner_name && (
                        <p className="text-[11px] text-slate-600">
                          Site Contact: {managingTicket.site_details.owner_name}{" "}
                          {managingTicket.site_details.owner_contact &&
                            `(${managingTicket.site_details.owner_contact})`}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500 italic">No specific site linked.</p>
                  )}
                  <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
                    {managingTicket.amc_contract_number && (
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                        AMC: {managingTicket.amc_contract_number}
                      </span>
                    )}
                    {managingTicket.project_code && (
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                        Project: {managingTicket.project_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* DESCRIPTION & ATTACHMENT */}
              <div className="p-4 rounded-xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Customer Issue Description
                </span>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {managingTicket.description}
                </p>
                {managingTicket.attachment_url && (
                  <div className="pt-2">
                    <a
                      href={managingTicket.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50"
                    >
                      <span>{managingTicket.attachment_name || "View Attachment"}</span>
                      <MdOpenInNew size={13} />
                    </a>
                  </div>
                )}
              </div>

              {/* STATUS & ASSIGNMENT UPDATE FORM */}
              <form
                onSubmit={handleSaveManageModal}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <MdEdit className="text-sky-600" size={14} />
                    <span>Update Status &amp; Resolution</span>
                  </h3>
                  {canEditTicket && manageForm.status !== "closed" && (
                    <button
                      type="button"
                      onClick={() => setManageForm((prev) => ({ ...prev, status: "closed" }))}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Set Status: Closed
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">Ticket Status</label>
                    <select
                      value={manageForm.status}
                      disabled={!canEditTicket}
                      onChange={(e) =>
                        setManageForm((prev) => ({ ...prev, status: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">Priority</label>
                    <select
                      value={manageForm.priority}
                      disabled={!canEditTicket}
                      onChange={(e) =>
                        setManageForm((prev) => ({ ...prev, priority: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">Assign To</label>
                    <select
                      value={manageForm.assigned_to}
                      disabled={!canEditTicket}
                      onChange={(e) =>
                        setManageForm((prev) => ({ ...prev, assigned_to: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={String(st.id)}>
                          {st.name || st.full_name || st.email}
                          {st.role_name ? ` (${st.role_name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Resolution Notes</label>
                  <textarea
                    rows={3}
                    disabled={!canEditTicket}
                    value={manageForm.resolution_notes}
                    onChange={(e) =>
                      setManageForm((prev) => ({ ...prev, resolution_notes: e.target.value }))
                    }
                    placeholder="Enter technician action, diagnosis, or closing notes visible to the customer..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setManagingTicket(null)}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  {canEditTicket && (
                    <button
                      type="submit"
                      disabled={savingManage}
                      className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {savingManage ? "Saving..." : "Save Changes"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Base>
  );
}
