import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useLocation } from "react-router-dom";
import Base from "../components/Base";
import TableView from "../components/TableView";
import AddServiceForm from "../components/amc/AddServiceForm";
import ServiceDetailView from "../components/amc/ServiceDetailView";
import AllocateTechniciansModal from "../components/projects/AllocateTechniciansModal";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import SendMessageModal from "../components/templates/SendMessageModal";
import AddActivityModal from "../components/technician/AddActivityModal";
import {
  MdAdd,
  MdFilterList,
  MdDelete,
  MdOutlineRemoveRedEye,
  MdEdit,
  MdMail,
  MdDownload,
  MdEngineering,
  MdOutlineBuild,
  MdCheckCircle,
  MdSchedule,
  MdPendingActions,
  MdNotes,
} from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import Swal from "sweetalert2";
import { useUserRole } from "../hooks/useAuth";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";

const BASE_API = import.meta.env.VITE_BASE_API_URL ?? "http://127.0.0.1:8000";

export default function AMCServices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const pendingServiceIdRef = useRef(null);
  const { hasPermission } = useUserRole(BASE_API);
  const canCreateAMC = hasPermission("amc", "create");
  const canEditAMC = hasPermission("amc", "edit");
  const canDeleteAMC = hasPermission("amc", "delete");

  const token = useMemo(
    () =>
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    []
  );

  const API_URL = `${BASE_API.replace(/\/$/, "")}/amc/services/`;

  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(10);

  // Filter drawer
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  // Modals state
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [viewingService, setViewingService] = useState(null);
  const [allocatingService, setAllocatingService] = useState(null);

  // Send Message Modal state
  const [sendMessageModalOpen, setSendMessageModalOpen] = useState(false);
  const [selectedMessageRecord, setSelectedMessageRecord] = useState(null);
  const [selectedServiceForNote, setSelectedServiceForNote] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_URL}?service_category=single_service&limit=1000`, { headers });
      if (!res.ok) {
        throw new Error(`Failed to load Services (HTTP ${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
      // Keep only single services (routine AMC contract visits belong strictly to AMC module)
      const singleList = list.filter((r) => r.service_category === "single_service" || (!r.amc_contract && r.service_category !== "amc_service"));
      setAllRows(singleList);
      setFilteredData(singleList);
    } catch (err) {
      console.error("AMC Services fetch error:", err);
      setError(err.message || "Failed to load AMC Services.");
      setAllRows([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle pagination on filtered data
  useEffect(() => {
    setRows(filteredData);
    setTotalCount(filteredData.length);
    setTotalPages(Math.max(1, Math.ceil(filteredData.length / itemsPerPage)));
    setCurrentPage(1);
  }, [filteredData, itemsPerPage]);

  // Sync viewingService with allRows updates
  useEffect(() => {
    if (viewingService?.id && allRows.length > 0) {
      const match = allRows.find((r) => r.id === viewingService.id);
      if (match) setViewingService(match);
    }
  }, [allRows]);

  // Handle location.state or URL param and clean up URL IMMEDIATELY so ID never appears in address bar
  useEffect(() => {
    // 1. Check if passed via location.state
    if (location.state?.viewingService) {
      setViewingService(location.state.viewingService);
    } else if (location.state?.serviceId) {
      pendingServiceIdRef.current = String(location.state.serviceId);
    }

    // 2. Check searchParams fallback and immediately scrub it from browser address bar
    const serviceId = searchParams.get("serviceId");
    if (serviceId) {
      pendingServiceIdRef.current = String(serviceId);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("serviceId");
        window.history.replaceState(null, "", url.pathname + (url.search || ""));
      } catch {
        // Fallback
      }
      setSearchParams({}, { replace: true });
    }
  }, [location.state, searchParams, setSearchParams]);

  // Match pending service ID as soon as allRows arrives
  useEffect(() => {
    if (pendingServiceIdRef.current && allRows.length > 0) {
      const match = allRows.find((r) => String(r.id) === String(pendingServiceIdRef.current));
      if (match) {
        setViewingService(match);
      }
      pendingServiceIdRef.current = null;
    }
  }, [allRows]);

  const handleOpenService = (service) => {
    // Keep URL completely clean (never append query parameters)
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
      setSearchParams({}, { replace: true });
    }
    setViewingService(service);
  };

  const handleCloseService = () => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
      setSearchParams({}, { replace: true });
    }
    setViewingService(null);
  };

  const getCurrentPageData = () => {
    const start = (currentPage - 1) * itemsPerPage;
    return rows.slice(start, start + itemsPerPage);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete Service Record?",
      text: "This service record will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it",
    });

    if (!result.isConfirmed) return;

    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(`${API_URL}${id}/`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to delete service record");
      Swal.fire("Deleted!", "Service record deleted.", "success");
      fetchData();
    } catch (err) {
      Swal.fire("Error", err.message || "Failed to delete service record", "error");
    }
  };

  // Status badge coloring
  const getStatusBadge = (status) => {
    switch (status) {
      case "scheduled":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "in_progress":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending_parts":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "cancelled":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Priority badge coloring
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "critical":
        return "bg-rose-50 text-rose-700 border-rose-200 font-bold";
      case "high":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "low":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  // Service Type label & badge
  const getServiceTypeBadge = (st) => {
    switch (st) {
      case "routine_maintenance":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "breakdown":
        return "bg-rose-50 text-rose-700 border-rose-200 font-bold";
      case "filter_replacement":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "water_testing":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "system_audit":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "installation_check":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = allRows.length;
    const scheduled = allRows.filter((r) => r.status === "scheduled").length;
    const inProgress = allRows.filter((r) => r.status === "in_progress").length;
    const completed = allRows.filter((r) => r.status === "completed").length;
    return { total, scheduled, inProgress, completed };
  }, [allRows]);

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = rows && rows.length > 0 ? rows : allRows;
    const formatted = dataToExport.map((r, idx) => ({
      "Sr No": idx + 1,
      "Service Number": r.service_number || `SRV-${String(r.id).padStart(3, "0")}`,
      "Customer / Company": r.customer_details?.company_name || r.customer_details?.name || "-",
      "Site": r.site_name || r.site_details?.name || r.amc_contract_details?.site_details?.name || r.project_details?.site_details?.name || "-",
      "Contact Person": r.customer_details?.contact_person || "-",
      "Phone": r.customer_details?.phone_number || r.customer_details?.mobile_number || "-",
      "Linked AMC": r.amc_contract_details?.contract_id || "Standalone",
      "Service Type": r.service_type_display || r.service_type,
      "Scheduled Date": formatExcelDate(r.service_date),
      "Completion Date": formatExcelDate(r.completion_date),
      "Priority": r.priority_display || r.priority,
      "Status": r.status_display || r.status,
      "Allocated Technicians": r.technicians_details?.map((t) => `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email).filter(Boolean).join(", ") || "-",
      "Service Engineer": r.service_engineer_details?.first_name || "-",
      "Cost (₹)": r.service_cost ? parseFloat(r.service_cost) : 0,
      "Issues / Scope": r.description || "-",
      "Resolution / Notes": r.resolution_notes || "-",
      "Created Date": formatExcelDate(r.created_at),
    }));

    exportToExcel({
      data: formatted,
      fileName: "AMC_Services",
      sheetName: "AMC Services",
    });
  };

  const columns = [
    {
      key: "sr",
      label: "Sr.No",
      render: (_, idx) => (
        <span className="text-slate-600 font-medium text-xs whitespace-nowrap block">
          {(currentPage - 1) * itemsPerPage + (idx + 1)}
        </span>
      ),
      className: "w-14 whitespace-nowrap",
    },
    {
      key: "service_number",
      label: "Service #",
      render: (r) => (
        <span className="font-mono font-bold text-sky-600 text-xs whitespace-nowrap block" title={r.service_number}>
          {r.service_number || `SRV-${r.id}`}
        </span>
      ),
      className: "w-28 whitespace-nowrap",
    },
    {
      key: "customer",
      label: "Customer",
      render: (r) => {
        const cName = r.customer_details?.company_name || r.customer_details?.name || "—";
        const loc = [r.customer_details?.city, r.customer_details?.state].filter(Boolean).join(", ");
        return (
          <div className="max-w-[160px] truncate" title={`${cName} ${loc ? `(${loc})` : ""}`}>
            <span className="font-semibold text-slate-900 text-xs block truncate">{cName}</span>
            {loc && <span className="text-[10px] text-slate-400 block truncate">{loc}</span>}
          </div>
        );
      },
      className: "w-40 max-w-[170px]",
    },
    {
      key: "site",
      label: "Site",
      render: (r) => {
        const siteObj = r.site_details || r.amc_contract_details?.site_details || r.project_details?.site_details;
        const sName = r.site_name || siteObj?.name || r.site?.name;
        const sCode = r.site_shortcut || siteObj?.site_shortcut || r.site?.site_shortcut;
        const sAddr = siteObj?.address || siteObj?.city || "";
        if (!sName) {
          return <span className="text-slate-400 text-xs">—</span>;
        }
        return (
          <div className="max-w-[170px] truncate" title={`${sName}${sCode ? ` (${sCode})` : ""}${sAddr ? ` - ${sAddr}` : ""}`}>
            <div className="inline-flex items-center gap-1 max-w-full">
              <span className="text-xs">📍</span>
              <span className="font-semibold text-sky-900 text-xs truncate">{sName}</span>
            </div>
            {sCode && (
              <span className="text-[10px] font-mono text-sky-600 block truncate font-medium">
                ({sCode})
              </span>
            )}
          </div>
        );
      },
      className: "w-44 max-w-[180px]",
    },
    {
      key: "project",
      label: "Project / Equipment",
      render: (r) => {
        const pCode = r.project_details?.project_code;
        const pProds = r.project_details?.product;
        const prodName = Array.isArray(pProds) ? pProds.join(", ") : pProds || "";
        return (
          <div className="max-w-[150px] truncate" title={pCode || "On-Demand Service"}>
            <span className="text-xs font-semibold text-slate-800 block truncate">
              {pCode || "On-Demand"}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {prodName || "Direct Service"}
            </span>
          </div>
        );
      },
      className: "w-36 max-w-[160px]",
    },
    {
      key: "service_cost",
      label: "Charges (₹)",
      render: (r) => {
        const val = r.service_cost ? parseFloat(r.service_cost) : 0;
        return (
          <span className="text-xs font-bold text-slate-800 whitespace-nowrap block">
            {val > 0 ? `₹${val.toLocaleString("en-IN")}` : "Free"}
          </span>
        );
      },
      className: "w-24 whitespace-nowrap",
    },
    {
      key: "service_type",
      label: "Service Type",
      render: (r) => (
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap inline-block capitalize ${getServiceTypeBadge(
            r.service_type
          )}`}
        >
          {r.service_type_display || r.service_type?.replace(/_/g, " ")}
        </span>
      ),
      className: "w-36 whitespace-nowrap",
    },
    {
      key: "service_date",
      label: "Scheduled Date",
      render: (r) => (
        <span className="text-slate-700 font-medium text-xs whitespace-nowrap block">
          {formatDate(r.service_date)}
        </span>
      ),
      className: "w-28 whitespace-nowrap",
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap inline-block capitalize ${getPriorityBadge(
            r.priority
          )}`}
        >
          {r.priority_display || r.priority}
        </span>
      ),
      className: "w-24 whitespace-nowrap",
    },
    {
      key: "technicians",
      label: "Technicians",
      render: (r) => {
        const techs = r.technicians_details || [];
        if (!techs || techs.length === 0) {
          return (
            <button
              onClick={() => setAllocatingService(r)}
              className="text-[10px] text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs whitespace-nowrap shrink-0"
              title="Click to allocate technicians"
            >
              <MdEngineering size={12} className="shrink-0" />
              <span className="whitespace-nowrap">+ Allocate</span>
            </button>
          );
        }

        const names = techs
          .map((t) => `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.username || t.email)
          .filter(Boolean);
        const displayLabel = names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
        const allNamesTooltip = names.join(", ");

        return (
          <button
            onClick={() => setAllocatingService(r)}
            className="text-[10px] text-slate-700 hover:text-sky-700 bg-slate-100 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 cursor-pointer transition-colors max-w-[140px] truncate whitespace-nowrap shrink-0"
            title={`Allocated: ${allNamesTooltip} (Click to manage)`}
          >
            <MdEngineering size={12} className="text-sky-600 shrink-0" />
            <span className="truncate whitespace-nowrap">{displayLabel}</span>
          </button>
        );
      },
      className: "w-36 min-w-[125px] max-w-[150px] whitespace-nowrap",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span
          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap inline-block capitalize ${getStatusBadge(
            r.status
          )}`}
        >
          {r.status_display || r.status?.replace(/_/g, " ")}
        </span>
      ),
      className: "w-28 whitespace-nowrap",
    },
  ];

  const actionsRenderer = (row) => (
    <div className="flex items-center gap-1">
      {/* View Details */}
      <button
        onClick={() => handleOpenService(row)}
        className="p-1 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 rounded transition-all text-sm shadow-2xs cursor-pointer"
        title="View Service Details"
      >
        <MdOutlineRemoveRedEye />
      </button>

      {/* Allocate Technicians */}
      <button
        onClick={() => setAllocatingService(row)}
        className="p-1 bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-700 rounded transition-all text-sm shadow-2xs cursor-pointer"
        title="Allocate Technicians"
      >
        <MdEngineering />
      </button>

      {/* Log Activity Note Button */}
      <button
        onClick={() => setSelectedServiceForNote(row)}
        className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded transition-all text-sm shadow-2xs cursor-pointer"
        title="Add Site Log / Note"
      >
        <MdNotes />
      </button>

      {/* Send Message */}
      <button
        onClick={() => {
          setSelectedMessageRecord({
            ...row,
            company_name: row.customer_details?.company_name || row.customer_details?.name || "",
            email: row.customer_details?.email || "",
            mobile_number: row.customer_details?.phone_number || row.customer_details?.mobile_number || "",
          });
          setSendMessageModalOpen(true);
        }}
        className="p-1 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 rounded transition-all text-sm shadow-2xs cursor-pointer"
        title="Send Communication (Email / WhatsApp)"
      >
        <MdMail />
      </button>

      {/* Edit */}
      {canEditAMC && (
        <button
          onClick={() => {
            setEditingService(row);
            setShowServiceForm(true);
          }}
          className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded transition-all text-sm shadow-2xs cursor-pointer"
          title="Edit Service"
        >
          <MdEdit />
        </button>
      )}

      {/* Delete */}
      {canDeleteAMC && (
        <button
          onClick={() => handleDelete(row.id)}
          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded transition-all text-sm shadow-2xs cursor-pointer"
          title="Delete Service"
        >
          <MdDelete />
        </button>
      )}
    </div>
  );

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {viewingService ? (
          <ServiceDetailView
            service={viewingService}
            onBack={handleCloseService}
            onEdit={(srv) => {
              setEditingService(srv);
              setShowServiceForm(true);
            }}
            onDelete={(id) => {
              handleDelete(id);
              handleCloseService();
            }}
            onAllocate={(srv) => setAllocatingService(srv)}
            onRefresh={(updated) => {
              fetchData();
              if (updated) {
                setViewingService((prev) => ({ ...prev, ...updated }));
              }
            }}
            formatDate={formatDate}
            token={token}
            baseApi={BASE_API}
            canEdit={canEditAMC}
            canDelete={canDeleteAMC}
          />
        ) : (
          <>
        {/* HEADER BLOCK WITH SKY ACCENT */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Services
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? "Loading service records..." : `Total ${totalCount} on-demand service requests & maintenance jobs recorded`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
            >
              <MdFilterList className="text-slate-400" />
              Filter
            </button>

            <button
              onClick={handleExportExcel}
              className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
              title="Export Services to Excel"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              Export
            </button>

            {canCreateAMC && (
              <button
                onClick={() => {
                  setEditingService(null);
                  setShowServiceForm(true);
                }}
                className="px-3 sm:px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <MdAdd size={16} />
                Add Service
              </button>
            )}
          </div>
        </div>

        {/* 4 SUMMARY STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Total Services</span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">{stats.total} visits</span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">All service requests</span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Scheduled</span>
            <span className="text-xs sm:text-[13px] font-bold text-sky-700 block mt-0.5">{stats.scheduled} upcoming</span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5">Planned visits</span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">In Progress</span>
            <span className="text-xs sm:text-[13px] font-bold text-amber-700 block mt-0.5">{stats.inProgress} active</span>
            <span className="text-[10px] text-amber-600 font-medium block mt-0.5">Technicians on-site</span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Completed</span>
            <span className="text-xs sm:text-[13px] font-bold text-emerald-700 block mt-0.5">{stats.completed} visits</span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Signed & resolved</span>
          </div>
        </div>

        {/* SERVICES TABLE VIEW */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <TableView
            columns={columns}
            rows={getCurrentPageData()}
            loading={loading}
            error={error}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              if (p < 1 || p > totalPages) return;
              setCurrentPage(p);
            }}
            pageSize={itemsPerPage}
            actions={actionsRenderer}
            emptyMessage="No services recorded. Click 'Add Service' to create one."
            rowClassName={() => "hover:bg-slate-50/80 transition-colors duration-150"}
          />
        </div>

</>
        )}

        {/* ADD / EDIT SERVICE FORM MODAL */}
        <AddServiceForm
          open={showServiceForm}
          onClose={() => {
            setShowServiceForm(false);
            setEditingService(null);
          }}
          service={editingService}
          baseApi={BASE_API}
          token={token}
          onSuccess={() => fetchData()}
        />

        {/* ALLOCATE TECHNICIANS MODAL */}
        {allocatingService && (
          <AllocateTechniciansModal
            open={!!allocatingService}
            onClose={() => setAllocatingService(null)}
            entity={allocatingService}
            endpoint={`${BASE_API}/amc/services/${allocatingService.id}/allocate-technicians/`}
            title={`Allocate Technicians — ${allocatingService.service_number || `#SRV-${allocatingService.id}`}`}
            baseApi={BASE_API}
            token={token}
            onSuccess={() => {
              fetchData();
              setAllocatingService(null);
            }}
          />
        )}

        {/* SEND MESSAGE MODAL */}
        <SendMessageModal
          isOpen={sendMessageModalOpen}
          onClose={() => {
            setSendMessageModalOpen(false);
            setSelectedMessageRecord(null);
          }}
          category="amc"
          recordData={selectedMessageRecord}
          onSuccess={() => {}}
        />

        {/* LOG ACTIVITY / NOTE MODAL */}
        <AddActivityModal
          service={selectedServiceForNote}
          isOpen={Boolean(selectedServiceForNote)}
          onClose={() => setSelectedServiceForNote(null)}
          onSuccess={() => {
            fetchData();
          }}
          baseApi={BASE_API}
        />

        {/* ADVANCED FILTER DRAWER */}
        {typeof document !== "undefined" &&
          createPortal(
            <>
              {isFilterOpen && (
                <div
                  className="fixed inset-0 bg-slate-900/40 z-9998 transition-opacity duration-300 backdrop-blur-2xs"
                  onClick={() => setIsFilterOpen(false)}
                />
              )}
              <div
                className={`fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-white shadow-2xl z-9999 transform transition-transform duration-300 ease-in-out flex flex-col ${
                  isFilterOpen ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">Filter AMC Services</h3>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <RxCross2 size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <AdvancedTableFilter
                    columns={columns}
                    data={allRows}
                    onFilter={setFilteredData}
                    onClose={() => setIsFilterOpen(false)}
                  />
                </div>
              </div>
            </>,
            document.body
          )}
      </div>
    </Base>
  );
}

