import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import Base from "../components/Base";
import TableView from "../components/TableView";
import { MdEdit, MdDelete, MdOutlineRemoveRedEye, MdFilterList, MdAdd, MdZoomIn, MdHandshake, MdMail, MdDownload, MdEngineering, MdCheckCircle } from "react-icons/md";
import AllocateTechniciansModal from "../components/projects/AllocateTechniciansModal";
import ProjectDetailView from "../components/projects/ProjectDetailView";
import Swal from "sweetalert2";
import AddProjectForm from "../components/projects/AddProjectForm";
import AddAMCContractForm from "../components/amc/AddAMCContractForm";
import RecordViewer from "../components/RecordViewer";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import SendMessageModal from "../components/templates/SendMessageModal";
import { useUserRole } from "../hooks/useAuth";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";
import { getBaseApiUrl } from "../utils/apiConfig";

export default function Project() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const BASE_API = getBaseApiUrl();
  const API_URL = `${BASE_API.replace(/\/$/, "")}/lead/projects/`;

  const { hasPermission } = useUserRole(BASE_API);
  const canCreateProject = hasPermission("projects", "create");
  const canEditProject = hasPermission("projects", "edit");
  const canDeleteProject = hasPermission("projects", "delete");
  const canCreateAMC = hasPermission("amc", "create");

  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [showAMCForm, setShowAMCForm] = useState(false);
  const [amcProject, setAmcProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [allocatingProject, setAllocatingProject] = useState(null);

  // Record Viewer
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Send Message Modal state
  const [sendMessageModalOpen, setSendMessageModalOpen] = useState(false);
  const [selectedMessageRecord, setSelectedMessageRecord] = useState(null);

  // Filter
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  const [highlightedProjectId, setHighlightedProjectId] = useState(null);

  const handleViewProject = (projectRow) => {
    setViewingProject(projectRow);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("view", projectRow.id);
    setSearchParams(newParams, { replace: true });
  };

  const handleBackToList = () => {
    setViewingProject(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("view");
    setSearchParams(newParams, { replace: true });
  };

  // Sync viewingProject from URL parameter ?view=<id>
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (viewId && allRows.length > 0) {
      const match = allRows.find((r) => String(r.id) === String(viewId));
      if (match) setViewingProject(match);
    }
  }, [searchParams, allRows]);

  // Keep viewingProject updated in real-time when allRows refreshes
  useEffect(() => {
    if (viewingProject && allRows.length > 0) {
      const match = allRows.find((r) => String(r.id) === String(viewingProject.id));
      if (match) setViewingProject(match);
    }
  }, [allRows]);

  // Highlight target project row and paginate when redirected from notification (without auto-opening record viewer)
  useEffect(() => {
    const targetProjectId = searchParams.get("projectId") || searchParams.get("id");
    if (targetProjectId) {
      setHighlightedProjectId(targetProjectId);
      if (allRows.length > 0) {
        const itemIdx = allRows.findIndex((r) => String(r.id) === String(targetProjectId));
        if (itemIdx !== -1) {
          const pageNum = Math.floor(itemIdx / itemsPerPage) + 1;
          setCurrentPage(pageNum);
        }
      }
    }
  }, [searchParams, allRows, itemsPerPage]);

  // Clear highlight and remove query parameters when user clicks anywhere on screen
  useEffect(() => {
    if (!highlightedProjectId) return;

    const handleScreenClick = () => {
      if (window._lastNotificationClickTime && Date.now() - window._lastNotificationClickTime < 600) {
        return;
      }
      setHighlightedProjectId(null);
      if (window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener("click", handleScreenClick, { capture: true });
      window.addEventListener("pointerdown", handleScreenClick, { capture: true });
    }, 400);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleScreenClick, { capture: true });
      window.removeEventListener("pointerdown", handleScreenClick, { capture: true });
    };
  }, [highlightedProjectId]);

  const token = useMemo(
    () =>
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `${API_URL}?limit=1000`;
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${body ? " — " + body : ""}`);
      }

      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];

      const normalized = results.map((r) => ({
        ...r,
        customer_name:
          r.customer_details?.company_name ||
          r.customer_details?.name ||
          (typeof r.customer === "string" ? r.customer : ""),
        project_executive_name:
          r.project_executive_details?.full_name ||
          r.project_executive_details?.name ||
          r.project_executive_details?.username ||
          "",
        amc_dates:
          r.amc_start_date && r.amc_end_date
            ? `${r.amc_start_date} to ${r.amc_end_date}`
            : r.amc_start_date || r.amc_end_date || "",
      }));

      setAllRows(normalized);
      setFilteredData(normalized);
      setRows(normalized);
      setTotalCount(normalized.length);
      setTotalPages(Math.max(1, Math.ceil(normalized.length / itemsPerPage)));
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
  }, [API_URL, token, itemsPerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setRows(filteredData);
    setTotalCount(filteredData.length);
    setTotalPages(Math.max(1, Math.ceil(filteredData.length / itemsPerPage)));
    if (!window.location.search.includes("projectId") && !window.location.search.includes("id=") && !window.location.search.includes("highlight")) {
      setCurrentPage(1);
    }
  }, [filteredData, itemsPerPage]);

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This project will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${API_URL}${id}/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete project");
      }

      Swal.fire("Deleted!", "Project has been deleted.", "success");
      fetchData();
    } catch (err) {
      Swal.fire("Error", err.message || "Failed to delete project", "error");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getStageBadgeColor = (stage) => {
    switch (stage) {
      case "order_confirmed":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "site_survey":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      case "material_procurement":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      case "dispatched":
        return "bg-sky-100 text-sky-700 border border-sky-200";
      case "delivered":
        return "bg-teal-100 text-teal-700 border border-teal-200";
      case "installation":
        return "bg-indigo-100 text-indigo-700 border border-indigo-200";
      case "testing":
        return "bg-orange-100 text-orange-700 border border-orange-200";
      case "handover":
        return "bg-emerald-100 text-emerald-700 font-bold border border-emerald-200";
      // Legacy backwards compatibility
      case "requirement_analysis":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "go_live":
        return "bg-emerald-100 text-emerald-700 font-bold border border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  const getPriorityBadgeColor = (priority) => {
    switch (priority) {
      case "critical":
        return "bg-rose-100 text-rose-700 font-bold";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      case "low":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const [productList, setProductList] = useState([]);

  useEffect(() => {
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(`${BASE_API}/product/products/?limit=1000`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setProductList(list);
      })
      .catch(() => setProductList([]));
  }, [BASE_API, token]);

  const resolveProductName = useCallback((item) => {
    if (!item) return "";
    const found = productList.find(
      (p) => String(p.id) === String(item) || String(p.name).toLowerCase() === String(item).toLowerCase()
    );
    return found ? (found.name || found.product_name || `Product #${found.id}`) : String(item);
  }, [productList]);

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
      key: "project_code",
      label: "Project Code",
      render: (r) => {
        const code = r.project_code || `#${r.id}`;
        return (
          <span className="font-bold text-blue-600 text-xs whitespace-nowrap block" title={code}>
            {code}
          </span>
        );
      },
      className: "w-28 whitespace-nowrap",
    },
    {
      key: "customer",
      label: "Customer",
      render: (r) => {
        const name = r.customer_details?.company_name || r.customer_details?.name || r.customer || "-";
        return (
          <span
            className="text-slate-900 font-semibold text-xs tracking-tight block max-w-[150px] truncate mx-auto cursor-default"
            title={name}
          >
            {name}
          </span>
        );
      },
      className: "w-40 min-w-[130px] max-w-[160px]",
    },
    {
      key: "site",
      label: "Site & Location",
      render: (r) => {
        const siteName = r.site_details?.name || r.site_name;
        if (!siteName) {
          return <span className="text-slate-400 text-xs whitespace-nowrap block">—</span>;
        }
        const fullAddr = [r.site_details?.address, r.site_details?.city, r.site_details?.state, r.site_details?.pincode]
          .filter(Boolean)
          .join(", ");
        return (
          <div className="max-w-[160px] mx-auto text-left cursor-default">
            <span
              className="font-medium text-slate-800 text-xs block truncate"
              title={fullAddr ? `${siteName} — ${fullAddr}` : siteName}
            >
              📍 {siteName}
            </span>
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              {r.site_details?.site_shortcut && (
                <span className="text-[9px] font-mono font-semibold text-cyan-700 bg-cyan-50 px-1 py-0.2 rounded border border-cyan-200/70 inline-block">
                  {r.site_details.site_shortcut}
                </span>
              )}
              {r.site_details?.city && (
                <span className="text-[10px] text-slate-400 truncate max-w-[90px]" title={fullAddr || r.site_details.city}>
                  {r.site_details.city}
                </span>
              )}
            </div>
          </div>
        );
      },
      className: "w-40 min-w-[130px] max-w-[160px]",
    },
    {
      key: "product",
      label: "Product(s)",
      render: (r) => {
        const rawProds = Array.isArray(r.product) ? r.product : r.product ? [r.product] : [];
        if (rawProds.length === 0) return <span className="text-slate-400 text-xs whitespace-nowrap block">-</span>;
        const resolvedNames = rawProds.map(resolveProductName).filter(Boolean).join(", ");
        return (
          <span className="text-slate-700 text-xs block truncate max-w-[140px] mx-auto cursor-default" title={resolvedNames}>
            {resolvedNames || "-"}
          </span>
        );
      },
      className: "w-36 max-w-[150px]",
    },
    {
      key: "technicians",
      label: "Technicians",
      render: (r) => {
        const techs = r.technicians_details || [];
        if (!techs || techs.length === 0) {
          return (
            <button
              onClick={() => setAllocatingProject(r)}
              className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs whitespace-nowrap shrink-0"
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
            onClick={() => setAllocatingProject(r)}
            className="text-[10px] text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 cursor-pointer transition-colors max-w-[150px] truncate whitespace-nowrap shrink-0"
            title={`Allocated: ${allNamesTooltip} (Click to manage)`}
          >
            <MdEngineering size={12} className="text-blue-600 shrink-0" />
            <span className="truncate whitespace-nowrap">{displayLabel}</span>
          </button>
        );
      },
      className: "w-36 min-w-[125px] max-w-[150px] whitespace-nowrap",
    },
    {
      key: "project_executive",
      label: "Executive",
      render: (r) => {
        const execName = r.project_executive_details?.full_name || r.project_executive_details?.name || r.project_executive_details?.username || "-";
        return (
          <span className="text-slate-600 text-xs block max-w-[130px] truncate mx-auto cursor-default" title={execName}>
            {execName}
          </span>
        );
      },
      className: "w-32 max-w-[140px]",
    },
    {
      key: "project_stage",
      label: "Stage",
      render: (r) => {
        const stage = r.project_stage_display || r.project_stage || "Order Confirmed";
        return (
          <span
            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full capitalize whitespace-nowrap inline-block ${getStageBadgeColor(
              r.project_stage
            )}`}
            title={stage}
          >
            {stage}
          </span>
        );
      },
      className: "w-36 whitespace-nowrap",
    },
    {
      key: "progress",
      label: "PROGRESS",
      render: (r) => {
        let pct = 0;
        if (r.progress !== undefined && r.progress !== null && !isNaN(Number(r.progress))) {
          pct = Math.min(100, Math.max(0, Math.round(Number(r.progress))));
        } else {
          const stageWeights = {
            order_confirmed: 20,
            site_survey: 35,
            material_procurement: 50,
            dispatched: 65,
            delivered: 75,
            installation: 85,
            testing: 92,
            handover: 100,
            completed: 100,
          };
          const sKey = (r.project_stage || "").toLowerCase();
          pct = stageWeights[sKey] ?? 25;
        }

        return (
          <div className="flex items-center gap-2.5 min-w-[115px] max-w-[140px] mx-auto">
            <div className="flex-1 bg-slate-100/90 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#4b9bc7] h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              ></div>
            </div>
            <span className="text-xs font-bold text-slate-900 w-8 text-right shrink-0">
              {pct}%
            </span>
          </div>
        );
      },
      className: "w-36 whitespace-nowrap text-center",
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => {
        const priority = r.priority_display || r.priority || "Medium";
        return (
          <span
            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full capitalize whitespace-nowrap inline-block ${getPriorityBadgeColor(
              r.priority
            )}`}
            title={priority}
          >
            {priority}
          </span>
        );
      },
      className: "w-24 whitespace-nowrap",
    },
    {
      key: "expected_to_go_live",
      label: "Go Live Date",
      render: (r) => {
        const d = formatDate(r.expected_to_go_live);
        return (
          <span className="text-slate-600 text-xs whitespace-nowrap block" title={d}>
            {d}
          </span>
        );
      },
      className: "w-28 whitespace-nowrap",
    },
    {
      key: "project_value",
      label: "Value (₹)",
      render: (r) => {
        const valText = r.project_value
          ? `₹${parseFloat(r.project_value).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
          })}`
          : "—";
        return (
          <span className="text-slate-900 font-semibold text-xs whitespace-nowrap block" title={valText}>
            {valText}
          </span>
        );
      },
      className: "w-28 whitespace-nowrap",
    },
    {
      key: "amc_dates",
      label: "AMC Period",
      render: (r) => {
        if (!r.amc_start_date && !r.amc_end_date) {
          return <span className="text-slate-400 text-xs whitespace-nowrap block italic">No AMC</span>;
        }
        const amcText = `${formatDate(r.amc_start_date)} - ${formatDate(r.amc_end_date)}`;
        return (
          <span className="text-slate-700 text-xs whitespace-nowrap block" title={`AMC Period: ${amcText}`}>
            {amcText}
          </span>
        );
      },
      className: "w-36 whitespace-nowrap",
    },
  ];

  const actionsRenderer = (row) => (
    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
      {/* Record Viewer */}
      <button
        onClick={() => {
          setSelectedProject(row);
          setViewOpen(true);
        }}
        className="p-1 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="View Full Record"
      >
        <MdZoomIn />
      </button>

      {/* Details Modal */}
      <button
        onClick={() => handleViewProject(row)}
        className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="View Details"
      >
        <MdOutlineRemoveRedEye />
      </button>

      {/* Allocate Project to Technicians */}
      <button
        onClick={() => setAllocatingProject(row)}
        className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
        title="Allocate Project to Technicians"
      >
        <MdEngineering />
      </button>

      {/* Add to AMC / AMC Added Tick */}
      {row.has_amc || row.amc_contract_number ? (
        <button
          onClick={() => {
            Swal.fire({
              icon: "info",
              title: "AMC Contract Active",
              html: `This project is already converted & linked to AMC Contract <b>${row.amc_contract_number || "Active"}</b>.<br/><br/>To renew, service, or manage this contract, please navigate to the <b>AMC Contracts</b> module.`,
              showCancelButton: true,
              confirmButtonColor: "#0284c7",
              cancelButtonColor: "#64748b",
              confirmButtonText: "Go to AMC Contracts",
              cancelButtonText: "Close",
            }).then((result) => {
              if (result.isConfirmed) {
                navigate("/amc");
              }
            });
          }}
          className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer flex items-center justify-center"
          title={`AMC Contract Added (${row.amc_contract_number || "Active"}) — Managed in AMC Contracts`}
        >
          <MdCheckCircle className="text-emerald-600 text-base" />
        </button>
      ) : (
        canCreateAMC && (
          <button
            onClick={() => {
              setAmcProject(row);
              setShowAMCForm(true);
            }}
            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
            title="Add to AMC Contract"
          >
            <MdHandshake />
          </button>
        )
      )}

      {/* Send Message */}
      <button
        onClick={() => {
          setSelectedMessageRecord(row);
          setSendMessageModalOpen(true);
        }}
        className="p-1 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="Send Email / WhatsApp"
      >
        <MdMail />
      </button>

      {/* Edit */}
      {canEditProject && (
        <button
          onClick={() => {
            setEditingProject(row);
            setShowProjectForm(true);
          }}
          className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Edit Project"
        >
          <MdEdit />
        </button>
      )}

      {/* Delete */}
      {canDeleteProject && (
        <button
          onClick={() => handleDelete(row.id)}
          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Delete Project"
        >
          <MdDelete />
        </button>
      )}
    </div>
  );

  const getCurrentPageData = () => {
    const start = (currentPage - 1) * itemsPerPage;
    return rows.slice(start, start + itemsPerPage);
  };

  const handleExportExcel = () => {
    const dataToExport = rows && rows.length > 0 ? rows : allRows;
    const formatted = dataToExport.map((r, idx) => ({
      "Sr No": idx + 1,
      "Project Code": r.project_code || `PRJ-${String(r.id).padStart(3, "0")}`,
      "Customer / Company Name": r.customer_name || r.customer_details?.name || "-",
      "Contact Person": r.contact_person || r.customer_details?.contact_person || "-",
      "Mobile Number": r.contact_number || r.customer_details?.contact_number || "-",
      "Project Executive": r.project_executive_details?.full_name || r.project_executive_details?.first_name || (r.project_executive ? String(r.project_executive) : "-"),
      "Stage / Status": r.stage || r.status || "-",
      "Allocated Technicians": r.technicians_details?.map(t => `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email).filter(Boolean).join(", ") || "-",
      "Expected Go Live Date": formatExcelDate(r.expected_to_go_live),
      "Project Value (₹)": r.project_value ? parseFloat(r.project_value) : 0,
      "AMC Start Date": formatExcelDate(r.amc_start_date),
      "AMC End Date": formatExcelDate(r.amc_end_date),
      "Scope of Work / Remarks": r.scope_of_work || r.remarks || "-",
      "Created Date": formatExcelDate(r.created_at),
    }));

    exportToExcel({
      data: formatted,
      fileName: "Projects",
      sheetName: "Projects",
    });
  };

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {viewingProject ? (
          <ProjectDetailView
            project={viewingProject}
            onBack={handleBackToList}
            onEdit={(p) => {
              setEditingProject(p);
              setShowProjectForm(true);
            }}
            onAllocate={(p) => setAllocatingProject(p)}
            onDelete={(id) => {
              handleDelete(id);
              setViewingProject(null);
            }}
            resolveProductName={resolveProductName}
            formatDate={formatDate}
            getStageBadgeColor={getStageBadgeColor}
            token={token}
            baseApi={BASE_API}
            canEdit={canEditProject}
            canDelete={canDeleteProject}
            onProjectUpdated={(updatedProject) => {
              if (updatedProject) setViewingProject(updatedProject);
              fetchData();
            }}
          />
        ) : (
          <>
            {/* HEADER BLOCK WITH BLUE ACCENT */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="w-1.5 h-9 sm:h-10 bg-sky-600 rounded-full block shrink-0"></span>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">Project Management</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {loading ? "Loading project records..." : `Total ${totalCount} projects identified across accounts`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="col-span-1 w-full sm:w-auto px-2 sm:px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                  >
                    <MdFilterList className="text-slate-400 shrink-0 text-sm" />
                    <span>Filter</span>
                  </button>

                  <button
                    onClick={handleExportExcel}
                    className="col-span-1 w-full sm:w-auto px-2 sm:px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                    title="Export Projects to Excel"
                  >
                    <MdDownload className="text-emerald-600 text-sm shrink-0" />
                    <span>Export</span>
                  </button>
                </div>

                {canCreateProject && (
                  <button
                    onClick={() => {
                      setEditingProject(null);
                      setShowProjectForm(true);
                    }}
                    className="w-full sm:w-auto px-3.5 sm:px-4 py-2 sm:py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-2xs shadow-sky-500/10 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Project</span>
                  </button>
                )}
              </div>
            </div>

            {/* PROJECT TABLE VIEW */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
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
                emptyMessage="No project records found."
                rowClassName={(row) => highlightedProjectId && String(row.id) === String(highlightedProjectId) ? "!bg-blue-100/90 font-bold border-l-4 border-l-blue-600 ring-2 ring-blue-400/60 shadow-md animate-pulse" : "hover:bg-slate-50/80 transition-colors duration-150"}
              />
            </div>
          </>
        )}
      </div>

      {/* FILTER DRAWER - PORTAL TO BODY PREVENTS LAYOUT PUSH AND WHITE BOTTOM STRIP */}
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
              className={`fixed top-0 right-0 h-screen w-full max-w-[380px] sm:w-[380px] bg-white shadow-2xl z-[10000] flex flex-col transition-transform duration-300 ease-in-out ${isFilterOpen ? "translate-x-0" : "translate-x-full"
                }`}
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
                  onFilter={setFilteredData}
                  setItemsPerPage={setItemsPerPage}
                  columns={columns}
                />
              </div>
            </div>
          </>,
          document.body
        )}

      {/* ADD / EDIT PROJECT FORM MODAL */}
      <AddProjectForm
        open={showProjectForm}
        onClose={() => {
          setShowProjectForm(false);
          setEditingProject(null);
        }}
        onSuccess={() => fetchData()}
        project={editingProject}
      />

      {/* ALLOCATE TECHNICIANS MODAL */}
      {allocatingProject && (
        <AllocateTechniciansModal
          open={!!allocatingProject}
          onClose={() => setAllocatingProject(null)}
          project={allocatingProject}
          baseApi={BASE_API}
          token={token}
          onSuccess={() => {
            fetchData();
            setAllocatingProject(null);
          }}
        />
      )}

      {/* ADD AMC CONTRACT FROM PROJECT MODAL */}
      <AddAMCContractForm
        open={showAMCForm}
        onClose={() => {
          setShowAMCForm(false);
          setAmcProject(null);
        }}
        onSuccess={() => {
          setShowAMCForm(false);
          setAmcProject(null);
          fetchData();
        }}
        initialProject={amcProject}
      />

      {/* RECORD VIEWER MODAL */}
      <RecordViewer
        isOpen={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedProject(null);
        }}
        record={selectedProject}
        title="Project Details"
      />

      {/* Send Message Modal */}
      <SendMessageModal
        isOpen={sendMessageModalOpen}
        onClose={() => {
          setSendMessageModalOpen(false);
          setSelectedMessageRecord(null);
        }}
        category="project"
        recordData={selectedMessageRecord}
        onSuccess={() => { }}
      />
    </Base>
  );
}
