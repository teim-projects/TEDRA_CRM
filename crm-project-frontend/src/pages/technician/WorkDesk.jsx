import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Base from "../../components/Base";
import TableView from "../../components/TableView";
import AdvancedTableFilter from "../../components/AdvancedTableFilter";
import { exportToExcel, formatExcelDate } from "../../utils/excelExport";
import {
  MdFilterList,
  MdDownload,
  MdOutlineRemoveRedEye,
  MdCheckCircle,
  MdEditDocument,
  MdPlayArrow,
  MdRefresh,
  MdEngineering,
  MdPersonAdd,
  MdNavigation,
} from "react-icons/md";
import CompleteVisitModal from "../../components/technician/CompleteVisitModal";
import StartVisitModal from "../../components/technician/StartVisitModal";
import AddActivityModal from "../../components/technician/AddActivityModal";
import ServiceDetailView from "../../components/amc/ServiceDetailView";
import AllocateTechniciansModal from "../../components/projects/AllocateTechniciansModal";
import { navigateToLocation, getCurrentCoordinates } from "../../utils/navigation";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function WorkDesk() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const BASE_API = getBaseApiUrl();

  const token = useMemo(
    () =>
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "",
    []
  );

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [allRows, setAllRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Quick Filter dropdown state (matching user screenshot)
  const [filterType, setFilterType] = useState(searchParams.get("filter") || "all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f) {
      setFilterType(f);
    }
  }, [searchParams]);

  const pendingViewIdRef = useRef(null);

  // Handle optional initial URL param, then clean up URL IMMEDIATELY so ID is never shown in address bar
  useEffect(() => {
    const viewId = searchParams.get("viewId") || searchParams.get("view") || searchParams.get("serviceId");
    const workType = searchParams.get("workType");
    if (viewId) {
      pendingViewIdRef.current = { viewId: String(viewId), workType };
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("viewId");
        url.searchParams.delete("view");
        url.searchParams.delete("serviceId");
        url.searchParams.delete("workType");
        window.history.replaceState(null, "", url.pathname + (url.search || ""));
      } catch (e) {
        // Fallback
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("viewId");
        next.delete("view");
        next.delete("serviceId");
        next.delete("workType");
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // When allRows finishes loading, if pendingViewIdRef has an ID, match and show it!
  useEffect(() => {
    if (pendingViewIdRef.current && allRows.length > 0) {
      const { viewId, workType } = pendingViewIdRef.current;
      const match = allRows.find((r) => {
        if (String(r.id) !== String(viewId)) return false;
        if (workType) {
          const rType = r.work_type || (r.visit_number || r.contract_id ? "amc_visit" : "single_service");
          return rType === workType;
        }
        return true;
      });
      if (match) {
        setViewingService(match);
      }
      pendingViewIdRef.current = null;
    }
  }, [allRows]);

  // If navigated here with a visit/service in location.state (e.g. from AMC Details Eye Button)
  useEffect(() => {
    if (location.state?.viewingService) {
      setViewingService(location.state.viewingService);
    }
  }, [location.state]);

  const handleOpenServiceDetail = (serviceItem) => {
    setViewingService(serviceItem);
  };

  const handleCloseServiceDetail = () => {
    setViewingService(null);
    if (location.state?.from === "amc") {
      navigate(-1);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Advanced Filter Drawer state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total_work: 0,
    today_work: 0,
    overdue_work: 0,
    completed_work: 0,
  });

  // Modals state
  const [selectedServiceForStart, setSelectedServiceForStart] = useState(null);
  const [selectedServiceForComplete, setSelectedServiceForComplete] = useState(null);
  const [selectedServiceForNote, setSelectedServiceForNote] = useState(null);
  const [selectedServiceForAllocate, setSelectedServiceForAllocate] = useState(null);
  const [viewingService, setViewingService] = useState(null);

  const filterOptions = [
    { value: "all", label: "All Records" },
    { value: "today", label: "Today's Work" },
    { value: "overdue", label: "Overdue Work" },
    { value: "completed", label: "Completed Work" },
  ];

  const currentFilterLabel =
    filterOptions.find((o) => o.value === filterType)?.label || "All Records";

  const fetchDataAndStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all work items allocated (both AMC visits and Single services)
      const url = `${BASE_API}/technician/work-desk/?limit=1000`;
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load work desk (Status ${res.status})`);
      }

      const data = await res.json();
      const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
      setAllRows(list);

      // Compute stats
      const today = getTodayString();
      let todayCount = 0;
      let overdueCount = 0;
      let completedCount = 0;

      list.forEach((item) => {
        const isCompleted = item.status === "completed";
        if (isCompleted) {
          completedCount++;
        } else {
          if (item.service_date === today) {
            todayCount++;
          } else if (item.service_date && item.service_date < today) {
            overdueCount++;
          }
        }
      });

      setStats({
        total_work: list.length,
        today_work: todayCount,
        overdue_work: overdueCount,
        completed_work: completedCount,
      });
    } catch (err) {
      console.error("Error fetching work desk:", err);
      setError(err.message || "Failed to load work desk list.");
      setAllRows([]);
      setFilteredData([]);
      setRows([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [BASE_API, token]);

  useEffect(() => {
    fetchDataAndStats();
  }, [fetchDataAndStats]);

  // Apply Quick Filter (All Records, Today's Work, Overdue Work, Completed Work)
  useEffect(() => {
    const today = getTodayString();
    let result = [...allRows];

    if (filterType === "today") {
      result = result.filter(
        (item) => item.service_date === today && item.status !== "completed"
      );
    } else if (filterType === "overdue") {
      result = result.filter(
        (item) =>
          item.service_date &&
          item.service_date < today &&
          item.status !== "completed"
      );
    } else if (filterType === "completed") {
      result = result.filter((item) => item.status === "completed");
    }

    setFilteredData(result);
    setRows(result);
    setTotalCount(result.length);
    setTotalPages(Math.max(1, Math.ceil(result.length / itemsPerPage)));
    setCurrentPage(1);
  }, [filterType, allRows, itemsPerPage]);

  // Handle advanced filter updates
  const handleAdvancedFilter = (filtered) => {
    setFilteredData(filtered);
    setRows(filtered);
    setTotalCount(filtered.length);
    setTotalPages(Math.max(1, Math.ceil(filtered.length / itemsPerPage)));
    setCurrentPage(1);
  };

  const getCurrentPageData = useCallback(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return rows.slice(startIndex, startIndex + itemsPerPage);
  }, [rows, currentPage, itemsPerPage]);

  // Start Journey via Google Maps navigation & log GPS milestone
  const handleNavigate = async (row) => {
    Swal.fire({
      title: "Starting Journey...",
      html: `
        <div style="font-size: 13px; color: #475569; padding: 6px 0;">
          Acquiring departure GPS coordinates.<br/>
          <span style="font-weight: 600; color: #0284c7;">Please tap 'Allow' if prompted by your browser.</span>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    let coords = null;
    try {
      coords = await getCurrentCoordinates().catch(() => null);
      await fetch(`${BASE_API}/technician/services/${row.id}/start-journey/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          work_type: row.work_type,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          accuracy: coords?.accuracy || null,
          notes: "Technician clicked Navigate to start journey from Work Desk.",
        }),
      });
      fetchDataAndStats();
    } catch (e) {
      console.warn("Could not log journey start:", e);
    } finally {
      Swal.close();
    }

    // Launch Google Maps navigation in a separate app/tab (keeping CRM website active)
    navigateToLocation({
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.service_address || row.customer_address,
      destinationName: row.customer_name || row.equipment || row.service_number || "Service Site",
    });
  };

  // Start Visit handler (opens StartVisitModal for photo/GPS check-in)
  const handleStartVisit = (service, serviceDate, workType) => {
    const rawDate = serviceDate || service?.service_date || service?.visit_date;
    if (rawDate && !isServiceDue(rawDate)) {
      alert(`This service/visit is scheduled for ${formatDisplayDate(rawDate)}. You can only start it when the scheduled date arrives.`);
      return;
    }
    const target = typeof service === "object" && service !== null ? service : { id: service, service_date: rawDate, work_type: workType };
    setSelectedServiceForStart(target);
  };

  const formatNumber = (num) => String(num).padStart(2, "0");

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Row styling (highlight overdue in red-100, today in yellow-100, matching FollowUp.jsx)
  const getRowClassName = (r) => {
    if (r.status === "completed") return "";
    const today = getTodayString();
    if (!r.service_date) return "";
    if (r.service_date < today) {
      return "bg-red-100";
    }
    if (r.service_date === today) {
      return "bg-yellow-100";
    }
    return "";
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = rows.length > 0 ? rows : allRows;
    const formatted = dataToExport.map((r, idx) => ({
      "Sr No": idx + 1,
      "Service No": r.service_number || "-",
      "Scheduled Date": formatExcelDate(r.service_date),
      "Completion Date": formatExcelDate(r.completion_date),
      "Type": r.contract_id ? `AMC (${r.contract_id})` : (r.service_category_display || r.service_category || "Single Service"),
      "Customer Name": r.customer_name || "-",
      "Site": r.site_name || r.site_details?.name || "-",
      "Contact Person": r.contact_person || "-",
      "Contact Phone": r.customer_phone || "-",
      "Site Address": r.customer_address || "-",
      "Equipment": r.equipment || "-",
      "Serial Number": r.serial_number || "-",
      "Priority": r.priority_display || r.priority || "-",
      "Status": r.status_display || r.status || "-",
      "Problem Reported": r.description || "-",
      "Diagnosis": r.diagnosis || "-",
      "Resolution Notes": r.resolution_notes || "-",
      "Rating": r.customer_feedback || "-",
    }));

    exportToExcel({
      data: formatted,
      fileName: `Work_Desk_${filterType}`,
      sheetName: "WorkDesk",
    });
  };

  const columns = [
    {
      key: "sr",
      label: "Sr.No",
      render: (r, idx) => (
        <span className="text-slate-700 text-xs font-semibold">
          {(currentPage - 1) * itemsPerPage + idx + 1}
        </span>
      ),
      className: "w-14 text-center",
    },
    {
      key: "service_number",
      label: "Service #",
      render: (r) => (
        <span className="font-mono text-xs font-bold text-sky-700 whitespace-nowrap block">
          {r.service_number}
        </span>
      ),
      className: "whitespace-nowrap",
    },
    {
      key: "type",
      label: "Service Type",
      render: (r) => {
        const isAMC = Boolean(r.contract_id || r.service_category === "amc_service");
        return (
          <div className="whitespace-nowrap text-center">
            {isAMC ? (
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider inline-block">
                AMC {r.contract_id ? `• ${r.contract_id}` : "Visit"}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium uppercase tracking-wider inline-block">
                Single Service
              </span>
            )}
          </div>
        );
      },
      className: "whitespace-nowrap",
    },
    {
      key: "service_date",
      label: "Scheduled Date",
      render: (r) => {
        const today = getTodayString();
        const isOverdue = r.service_date && r.service_date < today && r.status !== "completed";
        const isToday = r.service_date === today && r.status !== "completed";
        return (
          <span
            className={`text-xs font-medium whitespace-nowrap block ${isOverdue
              ? "text-red-600 font-bold"
              : isToday
                ? "text-amber-600 font-bold"
                : "text-slate-700"
              }`}
          >
            {formatDate(r.service_date)}
          </span>
        );
      },
      className: "whitespace-nowrap",
    },
    {
      key: "customer",
      label: "Customer",
      render: (r) => (
        <div className="max-w-[150px] truncate text-left mx-auto" title={r.customer_name || ""}>
          <span className="text-slate-900 font-bold text-xs block truncate">
            {r.customer_name || "-"}
          </span>
        </div>
      ),
      className: "w-36 max-w-[150px] whitespace-nowrap",
    },
    {
      key: "site",
      label: "Site",
      render: (r) => {
        const siteObj = r.site_details || r.amc_contract_details?.site_details || r.project_details?.site_details;
        const sName = r.site_name || siteObj?.name || r.site?.name;
        const sCode = r.site_shortcut || siteObj?.site_shortcut || r.site?.site_shortcut;
        const sAddr = r.service_address || r.customer_address || siteObj?.address || "";
        if (!sName) {
          return <span className="text-slate-400 text-xs block text-center">—</span>;
        }
        return (
          <div className="max-w-[160px] truncate text-left mx-auto" title={`${sName}${sCode ? ` (${sCode})` : ""}${sAddr ? ` - ${sAddr}` : ""}`}>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-900 truncate">
              <span>📍</span>
              <span className="truncate">{sName}</span>
              {sCode && (
                <span className="font-mono text-[10px] text-sky-600 font-bold shrink-0">
                  ({sCode})
                </span>
              )}
            </span>
          </div>
        );
      },
      className: "w-40 max-w-[170px] whitespace-nowrap",
    },
    {
      key: "contact",
      label: "Contact",
      render: (r) => (
        <div className="whitespace-nowrap text-center">
          {r.customer_phone ? (
            <a
              href={`tel:${r.customer_phone}`}
              className="text-sky-700 hover:text-sky-800 text-xs font-semibold block"
            >
              {r.customer_phone}
            </a>
          ) : (
            <span className="text-slate-400 text-xs">-</span>
          )}
        </div>
      ),
      className: "whitespace-nowrap",
    },
    {
      key: "equipment",
      label: "Equipment",
      render: (r) => (
        <div className="max-w-[140px] truncate text-left mx-auto" title={`${r.equipment || ""}${r.serial_number ? ` (#${r.serial_number})` : ""}`}>
          <span className="text-slate-800 font-semibold text-xs block truncate">
            {r.equipment || "-"}
            {r.serial_number && (
              <span className="text-slate-400 font-mono text-[10px] ml-1 font-normal">
                #{r.serial_number}
              </span>
            )}
          </span>
        </div>
      ),
      className: "min-w-[120px] max-w-[150px] whitespace-nowrap",
    },
    {
      key: "technician",
      label: "Technician",
      render: (r) => {
        const techs =
          Array.isArray(r.technicians_details) && r.technicians_details.length > 0
            ? r.technicians_details
            : Array.isArray(r.assigned_technicians_list) && r.assigned_technicians_list.length > 0
              ? r.assigned_technicians_list
              : Array.isArray(r.technicians)
                ? r.technicians
                : [];
        if (techs.length === 0) {
          return (
            <button
              onClick={() => setSelectedServiceForAllocate(r)}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Click to allocate technician"
            >
              <MdEngineering size={11} />
              <span>Allocate Work</span>
            </button>
          );
        }
        const names = techs
          .map((t) => {
            if (typeof t === "string") return t;
            const name = t.name || `${t.first_name || ""} ${t.last_name || ""}`.trim();
            return name || t.username || t.email || "Technician";
          })
          .join(", ");
        return (
          <span
            className="text-xs font-semibold text-slate-800 block max-w-[120px] truncate mx-auto cursor-pointer hover:text-sky-600"
            title={names}
            onClick={() => setSelectedServiceForAllocate(r)}
          >
            {names}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => {
        const p = (r.priority || "").toLowerCase();
        const colorClass =
          p === "critical"
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : p === "high"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-50 text-slate-600 border-slate-200";
        return (
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap inline-block ${colorClass}`}>
            {r.priority_display || r.priority || "-"}
          </span>
        );
      },
      className: "whitespace-nowrap",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const s = (r.status || "").toLowerCase();
        const isDone = s === "completed";
        const isInProg = s === "in_progress";
        const isPending = s === "pending_parts";
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap inline-block ${isDone
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : isInProg
                ? "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse"
                : isPending
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-blue-50 text-blue-600 border border-blue-200"
              }`}
          >
            {r.status_display || r.status || "-"}
          </span>
        );
      },
      className: "whitespace-nowrap",
    },
  ];

  const actionsRenderer = useCallback((row) => {
    const isCompleted = row.status === "completed";
    const isInProgress = row.status === "in_progress";
    const techs =
      Array.isArray(row.technicians_details) && row.technicians_details.length > 0
        ? row.technicians_details
        : Array.isArray(row.assigned_technicians_list) && row.assigned_technicians_list.length > 0
          ? row.assigned_technicians_list
          : Array.isArray(row.technicians)
            ? row.technicians
            : [];
    const hasTechs = techs.length > 0;

    return (
      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
        {/* View Details Eye Button */}
        <button
          onClick={() => handleOpenServiceDetail(row)}
          className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="View Service Details & Technical Report"
        >
          <MdOutlineRemoveRedEye />
        </button>

        {/* Navigate Route GPS Button */}
        <button
          onClick={() => handleNavigate(row)}
          className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Navigate turn-by-turn route to site via GPS"
        >
          <MdNavigation />
        </button>

        {/* Allocate Technicians Button */}
        {!isCompleted && (
          <button
            onClick={() => setSelectedServiceForAllocate(row)}
            className={`p-1 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer ${hasTechs
              ? "bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700"
              : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
              }`}
            title={hasTechs ? "Reassign Technicians" : "Allocate Work (Unassigned)"}
          >
            <MdEngineering />
          </button>
        )}

        {/* Start Visit Button - Enabled only when service/visit date arrives */}
        {!isCompleted && !isInProgress && (() => {
          const rawDate = row.service_date;
          const isDue = isServiceDue(rawDate);
          return (
            <button
              disabled={!isDue}
              onClick={() => handleStartVisit(row, rawDate, row.work_type)}
              className={`p-1 rounded transition-all duration-150 text-sm shadow-sm ${isDue
                ? "bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-700 cursor-pointer"
                : "bg-slate-100 text-slate-300 cursor-not-allowed opacity-50 border border-slate-200"
                }`}
              title={
                isDue
                  ? "Start Visit"
                  : `Scheduled for ${formatDisplayDate(rawDate)}. Can only be started on or after scheduled date.`
              }
            >
              <MdPlayArrow />
            </button>
          );
        })()}

        {/* Complete Visit Button - Enabled only when started (in progress) and date has arrived */}
        {!isCompleted && (() => {
          const rawDate = row.service_date;
          const isDue = isServiceDue(rawDate);
          const canComplete = isInProgress && isDue;
          return (
            <button
              disabled={!canComplete}
              onClick={() => {
                if (!isDue) {
                  alert(`This visit is scheduled for ${formatDisplayDate(rawDate)}. It cannot be completed before the scheduled date.`);
                  return;
                }
                if (!isInProgress) {
                  alert("You must start the visit (set to In Progress) before you can complete it.");
                  return;
                }
                setSelectedServiceForComplete(row);
              }}
              className={`p-1 rounded transition-all duration-150 text-sm shadow-sm ${canComplete
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                : "bg-slate-100 text-slate-300 cursor-not-allowed opacity-50 border border-slate-200"
                }`}
              title={
                !isDue
                  ? `Scheduled for ${formatDisplayDate(rawDate)}. Cannot complete before scheduled date.`
                  : !isInProgress
                    ? "Start the visit first to enable completion."
                    : "Complete Visit & Report"
              }
            >
              <MdCheckCircle />
            </button>
          );
        })()}

        {/* Log Activity Note Button */}
        <button
          onClick={() => setSelectedServiceForNote(row)}
          className="p-1 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Add Site Log / Note"
        >
          <MdEditDocument />
        </button>
      </div>
    );
  }, []);

  const currentPageData = getCurrentPageData();

  // If a service is selected to view details, render full ServiceDetailView (matching Follow-up History UI)
  if (viewingService) {
    return (
      <Base title="">
        <ServiceDetailView
          service={viewingService}
          onBack={handleCloseServiceDetail}
          token={token}
          baseApi={BASE_API}
          formatDate={formatDate}
          onRefresh={async (updatedEntity) => {
            if (updatedEntity) {
              setViewingService((prev) => ({ ...prev, ...updatedEntity }));
            }
            await fetchDataAndStats();
            try {
              const res = await fetch(`${BASE_API}/technician/work-desk/?limit=1000`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
                const updated = list.find((it) => {
                  if (String(it.id) !== String(viewingService.id)) return false;
                  if (viewingService.work_type && it.work_type) {
                    return it.work_type === viewingService.work_type;
                  }
                  return true;
                });
                if (updated) {
                  setViewingService(updated);
                }
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </Base>
    );
  }

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* HEADER BLOCK WITH THE BLUE VERTICAL ACCENT LINE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Work Desk
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Synchronizing work records..."
                  : `${totalCount} service visits and AMC tasks identified`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Quick Filter Dropdown (Exact match to screenshot) */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
              >
                <MdFilterList className="text-slate-400" />
                <span>{currentFilterLabel}</span>
              </button>

              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-20 cursor-default"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 px-1 z-30">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterType(option.value);
                          setShowFilterDropdown(false);
                          if (option.value === "all") {
                            setSearchParams({});
                          } else {
                            setSearchParams({ filter: option.value });
                          }
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer ${filterType === option.value
                          ? "bg-blue-50/80 text-blue-600 font-semibold"
                          : "text-slate-700 font-medium"
                          }`}
                      >
                        <span>{option.label}</span>
                        {filterType === option.value && (
                          <span className="text-blue-600 font-bold text-xs">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Field Map Button */}
            <button
              onClick={() => navigate("/technician/field-map")}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
              title="Open Daily Field Route Map"
            >
              <MdNavigation className="text-blue-600 text-sm" />
              <span>🗺️ Field Map</span>
            </button>

            {/* Advanced Filter Button */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
            >
              <MdFilterList className="text-slate-400" />
              Filter
            </button>

            {/* Export to Excel Button */}
            <button
              onClick={handleExportExcel}
              className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
              title="Export Work Desk to Excel"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              Export
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchDataAndStats()}
              className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-sky-600 rounded-lg hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              title="Refresh Work Desk"
            >
              <MdRefresh className="text-base" />
            </button>
          </div>
        </div>

        {/* STATS CARDS (Styled matching Services page KPI blocks) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Work */}
          <div
            onClick={() => {
              setFilterType("all");
              setSearchParams({});
            }}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${filterType === "all"
              ? "border-sky-500 ring-2 ring-sky-100 shadow-sm"
              : "border-slate-200/80 shadow-2xs hover:border-slate-300"
              }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Total Work</span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">{formatNumber(stats.total_work)} tasks</span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">All assigned jobs</span>
          </div>

          {/* Card 2: Today's Work */}
          <div
            onClick={() => {
              setFilterType("today");
              setSearchParams({ filter: "today" });
            }}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${filterType === "today"
              ? "border-sky-500 ring-2 ring-sky-100 shadow-sm"
              : "border-slate-200/80 shadow-2xs hover:border-sky-300"
              }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Today's Work</span>
            <span className="text-xs sm:text-[13px] font-bold text-sky-700 block mt-0.5">{formatNumber(stats.today_work)} scheduled</span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5">Scheduled for today</span>
          </div>

          {/* Card 3: Overdue Work */}
          <div
            onClick={() => {
              setFilterType("overdue");
              setSearchParams({ filter: "overdue" });
            }}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${filterType === "overdue"
              ? "border-amber-500 ring-2 ring-amber-100 shadow-sm"
              : "border-slate-200/80 shadow-2xs hover:border-amber-300"
              }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Overdue Work</span>
            <span className="text-xs sm:text-[13px] font-bold text-amber-700 block mt-0.5">{formatNumber(stats.overdue_work)} pending</span>
            <span className="text-[10px] text-amber-600 font-medium block mt-0.5">Past due date</span>
          </div>

          {/* Card 4: Completed Work */}
          <div
            onClick={() => {
              setFilterType("completed");
              setSearchParams({ filter: "completed" });
            }}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${filterType === "completed"
              ? "border-emerald-500 ring-2 ring-emerald-100 shadow-sm"
              : "border-slate-200/80 shadow-2xs hover:border-emerald-300"
              }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Completed Work</span>
            <span className="text-xs sm:text-[13px] font-bold text-emerald-700 block mt-0.5">{formatNumber(stats.completed_work)} done</span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Closed & resolved</span>
          </div>
        </div>

        {/* COMPACT DATA TABLE COMPONENT */}
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
            rowClassName={getRowClassName}
            emptyMessage="No service jobs found matching the selected criteria"
          />
        </div>
      </div>

      {/* FILTER DRAWER - PORTAL TO BODY (Mounted ONLY when open to avoid intercepting clicks) */}
      {isFilterOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 w-screen h-screen bg-black/40 z-[9999]"
              onClick={() => setIsFilterOpen(false)}
            />

            <div
              className="fixed top-0 right-0 h-screen w-full max-w-[380px] sm:w-[380px] bg-white shadow-2xl z-[10000] flex flex-col transition-transform duration-300 ease-in-out translate-x-0"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
                <h3 className="text-lg font-bold text-slate-900">Filters</h3>
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
                  onFilter={handleAdvancedFilter}
                  setItemsPerPage={setItemsPerPage}
                  columns={columns}
                />
              </div>
            </div>
          </>,
          document.body
        )}

      {/* MODALS */}
      <StartVisitModal
        service={selectedServiceForStart}
        isOpen={Boolean(selectedServiceForStart)}
        onClose={() => setSelectedServiceForStart(null)}
        onSuccess={() => {
          fetchDataAndStats();
        }}
        baseApi={BASE_API}
      />

      <CompleteVisitModal
        service={selectedServiceForComplete}
        isOpen={Boolean(selectedServiceForComplete)}
        onClose={() => setSelectedServiceForComplete(null)}
        onSuccess={() => {
          fetchDataAndStats();
        }}
        baseApi={BASE_API}
      />

      <AddActivityModal
        service={selectedServiceForNote}
        isOpen={Boolean(selectedServiceForNote)}
        onClose={() => setSelectedServiceForNote(null)}
        onSuccess={() => {
          fetchDataAndStats();
        }}
        baseApi={BASE_API}
      />

      {/* ALLOCATE TECHNICIANS MODAL */}
      {selectedServiceForAllocate && (
        <AllocateTechniciansModal
          open={Boolean(selectedServiceForAllocate)}
          onClose={() => setSelectedServiceForAllocate(null)}
          entity={selectedServiceForAllocate}
          endpoint={
            selectedServiceForAllocate.work_type === "amc_visit" || selectedServiceForAllocate.contract_id || selectedServiceForAllocate.visit_number
              ? `${BASE_API}/amc/visits/${selectedServiceForAllocate.id}/allocate-technicians/`
              : `${BASE_API}/amc/services/${selectedServiceForAllocate.id}/allocate-technicians/`
          }
          title={`Allocate Technicians — ${selectedServiceForAllocate.visit_number || selectedServiceForAllocate.service_number || `#TASK-${selectedServiceForAllocate.id}`}`}
          baseApi={BASE_API}
          token={token}
          onSuccess={() => {
            fetchDataAndStats();
            setSelectedServiceForAllocate(null);
          }}
        />
      )}
    </Base>
  );
}
