import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import Base from "../components/Base";
import AddStaffForm from "../components/accounts/AddStaffForm";
import {
  MdEdit,
  MdDelete,
  MdFilterList,
  MdZoomIn,
  MdDownload,
  MdBuild,
  MdShield,
  MdToggleOn,
  MdToggleOff,
  MdNavigation,
  MdInventory,
} from "react-icons/md";
import Swal from "sweetalert2";
import TableView from "../components/TableView";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import RecordViewer from "../components/RecordViewer";
import TechnicianStockLogModal from "../components/inventory/TechnicianStockLogModal";
import { useUserRole } from "../hooks/useAuth";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";

export default function Technicians() {
  const navigate = useNavigate();
  const BASE_API = import.meta.env.VITE_BASE_API_URL ?? "http://127.0.0.1:8000";

  const { hasPermission } = useUserRole(BASE_API);
  const canCreateAccount = hasPermission("accounts", "create");
  const canEditAccount = hasPermission("accounts", "edit");
  const canDeleteAccount = hasPermission("accounts", "delete");

  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Quick Status Filter: "all" | "active" | "inactive"
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Roles state
  const [roles, setRoles] = useState([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  // Record Viewer state
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Stock Log Modal state
  const [stockLogOpen, setStockLogOpen] = useState(false);
  const [selectedTechnicianForLog, setSelectedTechnicianForLog] = useState(null);

  const token = useMemo(() => {
    return (
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      ""
    );
  }, []);

  // Fetch all roles to find Technician role ID
  const fetchRoles = useCallback(async () => {
    try {
      if (!token) return;
      const res = await fetch(`${BASE_API}/auth/roles/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const roleList = Array.isArray(data) ? data : data.results ?? [];
        setRoles(roleList);
      }
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  }, [token, BASE_API]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const technicianRole = useMemo(() => {
    return roles.find((r) => r.name?.toLowerCase().trim() === "technician");
  }, [roles]);

  // Fetch staff and filter strictly for technicians
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!token) throw new Error("No authorization token found.");

      const res = await fetch(`${BASE_API}/auth/staff/?limit=1000`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${body ? " - " + body : ""}`);
      }

      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];

      // Filter exclusively for users with role "Technician"
      const techniciansList = results.filter((user) => {
        const roleName = user.role?.name || (typeof user.role === "string" ? user.role : "");
        return (roleName || "").trim().toLowerCase() === "technician";
      });

      setAllRows(techniciansList);
      setFilteredData(techniciansList);
      setRows(techniciansList);
      setTotalCount(techniciansList.length);
      setTotalPages(Math.max(1, Math.ceil(techniciansList.length / itemsPerPage)));
    } catch (err) {
      setError(err.message || String(err));
      setRows([]);
      setAllRows([]);
      setFilteredData([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [token, BASE_API, itemsPerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply status filter tabs and table filter changes
  useEffect(() => {
    let dataset = filteredData;
    if (statusFilter === "active") {
      dataset = dataset.filter((r) => r.is_active !== false);
    } else if (statusFilter === "inactive") {
      dataset = dataset.filter((r) => r.is_active === false);
    }
    setRows(dataset);
    setTotalCount(dataset.length);
    setTotalPages(Math.max(1, Math.ceil(dataset.length / itemsPerPage)));
    setCurrentPage(1);
  }, [filteredData, statusFilter, itemsPerPage]);

  // Get current page slice
  const getCurrentPageData = useCallback(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return rows.slice(startIndex, startIndex + itemsPerPage);
  }, [rows, currentPage, itemsPerPage]);

  // Toggle technician active/inactive status
  const handleToggleStatus = async (tech) => {
    if (!canEditAccount) {
      Swal.fire({
        icon: "warning",
        title: "Permission Denied",
        text: "You do not have permission to change technician status.",
      });
      return;
    }

    const isCurrentlyActive = tech.is_active !== false;
    const newStatus = !isCurrentlyActive;
    const fullName =
      `${tech.first_name || ""} ${tech.last_name || ""}`.trim() ||
      tech.email ||
      "this technician";

    const confirm = await Swal.fire({
      title: isCurrentlyActive ? "Set Technician Inactive?" : "Activate Technician?",
      text: isCurrentlyActive
        ? `Are you sure you want to mark ${fullName} as Inactive? They will be marked off-duty.`
        : `Are you sure you want to activate ${fullName}? They will be marked Active on Field.`,
      icon: isCurrentlyActive ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText: isCurrentlyActive ? "Yes, Set Inactive" : "Yes, Activate",
      confirmButtonColor: isCurrentlyActive ? "#e11d48" : "#10b981",
      cancelButtonColor: "#64748b",
    });

    if (!confirm.isConfirmed) return;

    try {
      const resp = await fetch(`${BASE_API}/auth/staff/${tech.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: newStatus }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`${resp.status} ${resp.statusText} - ${text}`);
      }

      Swal.fire({
        icon: "success",
        text: `Technician marked ${newStatus ? "Active on Field" : "Inactive"} successfully.`,
        timer: 1400,
        showConfirmButton: false,
      });

      fetchData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err.message || String(err),
      });
    }
  };

  // Delete technician handler
  const handleDeleteStaff = async (id) => {
    const confirm = await Swal.fire({
      title: "Remove Technician?",
      text: "This user account will be removed from system records.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
    });

    if (!confirm.isConfirmed) return;

    try {
      const resp = await fetch(`${BASE_API}/auth/staff/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`${resp.status} ${resp.statusText} - ${text}`);
      }
      Swal.fire({
        icon: "success",
        text: "Technician removed successfully",
        timer: 1200,
        showConfirmButton: false,
      });
      fetchData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Action Failed",
        text: err.message || String(err),
      });
    }
  };

  // Stats
  const activeCount = useMemo(
    () => allRows.filter((r) => r.is_active !== false).length,
    [allRows]
  );
  const inactiveCount = useMemo(
    () => allRows.filter((r) => r.is_active === false).length,
    [allRows]
  );

  // Table Columns
  const columns = useMemo(
    () => [
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
        key: "name",
        label: "Technician Name",
        render: (r) => {
          const fullName =
            `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.username || "-";
          const initials =
            `${r.first_name?.[0] || ""}${r.last_name?.[0] || ""}`.toUpperCase() || "T";
          return (
            <div className="flex items-center gap-2 max-w-[200px]">
              <div
                className={`w-7 h-7 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 ${
                  r.is_active !== false
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {initials}
              </div>
              <span
                className={`text-xs font-semibold truncate block ${
                  r.is_active !== false ? "text-slate-800" : "text-slate-400 line-through"
                }`}
                title={fullName}
              >
                {fullName}
              </span>
            </div>
          );
        },
        className: "min-w-[150px] max-w-[200px]",
      },
      {
        key: "email",
        label: "Email Address",
        render: (r) => (
          <span
            className="text-slate-700 text-xs block max-w-[190px] truncate"
            title={r.email || ""}
          >
            {r.email || "-"}
          </span>
        ),
        className: "min-w-[140px] max-w-[200px]",
      },
      {
        key: "mobile_no",
        label: "Mobile Number",
        render: (r) => (
          <span
            className="text-slate-700 text-xs font-medium whitespace-nowrap block"
            title={r.mobile_no || ""}
          >
            {r.mobile_no || "-"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "role",
        label: "Role",
        render: () => (
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap inline-flex items-center gap-1 shadow-2xs">
            <MdBuild size={11} className="text-blue-600" />
            <span>Technician</span>
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "status",
        label: "Status (Click to Toggle)",
        render: (r) => {
          const isActive = r.is_active !== false;
          return (
            <button
              type="button"
              onClick={() => handleToggleStatus(r)}
              disabled={!canEditAccount}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-150 border ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:border-slate-300"
              } ${canEditAccount ? "cursor-pointer" : "cursor-default opacity-80"}`}
              title={
                canEditAccount
                  ? isActive
                    ? "Click to set Inactive (Off Duty)"
                    : "Click to set Active (On Field)"
                  : undefined
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <span>{isActive ? "Active on Field" : "Inactive"}</span>
            </button>
          );
        },
        className: "whitespace-nowrap",
      },
      {
        key: "date_joined",
        label: "Date Joined",
        render: (r) => (
          <span className="text-slate-500 text-xs whitespace-nowrap block">
            {r.date_joined ? formatExcelDate(r.date_joined) : "-"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
    ],
    [currentPage, itemsPerPage, canEditAccount]
  );

  // Filter columns
  const filterColumns = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "mobile_no", label: "Mobile Number" },
  ];

  // Actions column
  const actionsRenderer = useCallback(
    (row) => (
      <div className="flex items-center justify-center gap-2 text-slate-500 whitespace-nowrap">
        {/* Toggle Active / Inactive Quick Button */}
        {canEditAccount && (
          <button
            onClick={() => handleToggleStatus(row)}
            className="p-1 bg-transparent border-none cursor-pointer transition-colors"
            title={
              row.is_active !== false
                ? "Set Inactive (Mark off-duty)"
                : "Set Active (Mark on-field)"
            }
          >
            {row.is_active !== false ? (
              <MdToggleOn
                size={22}
                className="text-emerald-600 hover:text-rose-500 transition-colors"
              />
            ) : (
              <MdToggleOff
                size={22}
                className="text-slate-400 hover:text-emerald-600 transition-colors"
              />
            )}
          </button>
        )}

        {/* Inventory Stock Log */}
        <button
          onClick={() => {
            setSelectedTechnicianForLog(row);
            setStockLogOpen(true);
          }}
          className="hover:text-blue-700 transition-colors p-1 bg-transparent border-none cursor-pointer flex items-center gap-1 text-[11px] text-blue-600 font-bold px-2 py-0.5 rounded border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 shadow-2xs"
          title="Technician Stock & Service Log"
        >
          <MdInventory size={13} />
          <span>Log</span>
        </button>

        {/* View Profile */}
        <button
          onClick={() => {
            setSelectedStaff(row);
            setViewOpen(true);
          }}
          className="hover:text-purple-600 transition-colors p-1 bg-transparent border-none cursor-pointer"
          title="View Technician Profile"
        >
          <MdZoomIn size={16} />
        </button>

        {/* Edit Technician */}
        {canEditAccount && (
          <button
            onClick={() => {
              setEditingStaff(row);
              setShowStaffForm(true);
            }}
            className="hover:text-amber-600 transition-colors p-1 bg-transparent border-none cursor-pointer"
            title="Edit Details & Status"
          >
            <MdEdit size={16} />
          </button>
        )}

        {/* Delete Technician */}
        {canDeleteAccount && (
          <button
            onClick={() => handleDeleteStaff(row.id)}
            className="hover:text-rose-600 transition-colors p-1 bg-transparent border-none cursor-pointer"
            title="Delete Technician"
          >
            <MdDelete size={16} />
          </button>
        )}
      </div>
    ),
    [canEditAccount, canDeleteAccount]
  );

  const currentPageData = getCurrentPageData();

  // Excel export
  const handleExportExcel = () => {
    const dataToExport = rows && rows.length > 0 ? rows : allRows;
    const formatted = dataToExport.map((r, idx) => ({
      "Sr No": idx + 1,
      "Technician Name":
        `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
      "Email Address": r.email || "-",
      "Mobile Number": r.mobile_no || "-",
      Designation: "Technician",
      Status: r.is_active !== false ? "Active on Field" : "Inactive",
      "Date Joined": formatExcelDate(r.date_joined),
    }));

    exportToExcel({
      data: formatted,
      fileName: "Tedra_Technicians",
      sheetName: "Technicians",
    });
  };

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* HEADER BLOCK */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Technician Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Loading technicians..."
                  : `${totalCount} technician${totalCount === 1 ? "" : "s"} listed (${activeCount} active, ${inactiveCount} inactive)`}
              </p>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2 mt-3 md:mt-0 flex-wrap">
            <button
              onClick={() => navigate("/technician/field-map")}
              className="px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="View Daily Field Dispatch Map"
            >
              <MdNavigation className="text-blue-600 text-sm" />
              <span>🗺️ Field Dispatch Map</span>
            </button>

            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-2.5 py-1.5 bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="Filter Technicians"
            >
              <MdFilterList className="text-slate-500 text-sm" />
              <span>Filters</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="Export Technicians to Excel"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              <span>Export</span>
            </button>

            {canCreateAccount && (
              <button
                onClick={() => {
                  setEditingStaff(null);
                  setShowStaffForm(true);
                }}
                className="px-3 sm:px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>+</span>
                <span>Add Technician</span>
              </button>
            )}
          </div>
        </div>

        {/* STATS ROW (CLICKABLE QUICK FILTERS - Styled matching Services page KPI blocks) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Technicians */}
          <div
            onClick={() => setStatusFilter("all")}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === "all"
                ? "border-sky-500 ring-2 ring-sky-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
            title="Click to view all technicians"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                Total Technicians
              </span>
              {statusFilter === "all" && (
                <span className="text-[9px] font-bold bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded">
                  All
                </span>
              )}
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {allRows.length} staff
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              Assigned to field service
            </span>
          </div>

          {/* Card 2: Active on Field */}
          <div
            onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === "active"
                ? "border-sky-500 ring-2 ring-sky-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-sky-300"
            }`}
            title="Click to filter active technicians"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                Active on Field
              </span>
              {statusFilter === "active" && (
                <span className="text-[9px] font-bold bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded">
                  Filtered
                </span>
              )}
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-sky-700 block mt-0.5">
              {activeCount} active
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
              Available for site visits
            </span>
          </div>

          {/* Card 3: Inactive / Leave */}
          <div
            onClick={() => setStatusFilter(statusFilter === "inactive" ? "all" : "inactive")}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === "inactive"
                ? "border-amber-500 ring-2 ring-amber-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-amber-300"
            }`}
            title="Click to filter inactive technicians"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                Inactive / Off Duty
              </span>
              {statusFilter === "inactive" && (
                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                  Filtered
                </span>
              )}
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-amber-700 block mt-0.5">
              {inactiveCount} off-duty
            </span>
            <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
              Off duty or archived
            </span>
          </div>

          {/* Card 4: System Role */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Field Role
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-emerald-700 block mt-0.5 flex items-center gap-1.5">
              <MdShield size={14} className="text-emerald-600" />
              <span>Technician</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
              Designated service role
            </span>
          </div>
        </div>

        {/* DATA TABLE VIEW */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <TableView
            columns={columns}
            rows={currentPageData}
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
            emptyMessage={
              statusFilter !== "all"
                ? `No ${statusFilter} technicians found.`
                : "No technicians recorded yet. Click '+ Add Technician' to create one."
            }
            rowClassName={(r) =>
              r.is_active === false
                ? "bg-slate-50/50 hover:bg-slate-100/60 transition-colors duration-150 opacity-75"
                : "hover:bg-slate-50/80 transition-colors duration-150"
            }
          />
        </div>
      </div>

      {/* FILTER DRAWER / MODAL VIA PORTAL */}
      {isFilterOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity"
              onClick={() => setIsFilterOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <MdFilterList className="text-blue-600 text-lg" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Filter Technicians
                  </h3>
                </div>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <AdvancedTableFilter
                  data={allRows}
                  onFilter={setFilteredData}
                  setItemsPerPage={setItemsPerPage}
                  columns={filterColumns}
                />
              </div>
            </div>
          </>,
          document.body
        )}

      {/* TECHNICIAN STOCK LOG MODAL */}
      {stockLogOpen && selectedTechnicianForLog && (
        <TechnicianStockLogModal
          isOpen={stockLogOpen}
          onClose={() => {
            setStockLogOpen(false);
            setSelectedTechnicianForLog(null);
          }}
          technician={selectedTechnicianForLog}
          baseApi={BASE_API}
        />
      )}

      {/* RECORD DETAILS DRAWER */}
      <RecordViewer
        isOpen={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedStaff(null);
        }}
        record={selectedStaff}
        title="Technician Profile Details"
      />

      {/* ADD / EDIT TECHNICIAN FORM MODAL */}
      <AddStaffForm
        open={showStaffForm}
        onClose={() => {
          setShowStaffForm(false);
          setEditingStaff(null);
        }}
        onSuccess={() => {
          fetchData();
          setShowStaffForm(false);
          setEditingStaff(null);
        }}
        baseApi={BASE_API}
        roles={roles}
        staff={editingStaff}
        defaultRoleId={technicianRole?.id || ""}
      />
    </Base>
  );
}
