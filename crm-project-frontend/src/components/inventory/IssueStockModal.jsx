import React, { useState, useEffect, useMemo } from "react";
import { MdClose } from "react-icons/md";
import { ArrowUpRight, Layers, FileText, UserCheck, Wrench, Calendar, CheckCircle2 } from "lucide-react";
import Swal from "sweetalert2";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function IssueStockModal({
  isOpen,
  onClose,
  onSuccess,
  items = [],
  baseApi,
  preselectedItem = null,
  preselectedService = null,
  preselectedVisit = null,
  preselectedProject = null,
  currentUser = null,
  assignedTechnician = null,
  isRequestOnly = false,
}) {
  const api = (baseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(preselectedItem?.id || (items[0]?.id || ""));
  const [quantity, setQuantity] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [jobType, setJobType] = useState("SERVICE"); // "SERVICE" | "AMC_VISIT" | "PROJECT" | "GENERAL"
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProject?.id || "");
  const [notes, setNotes] = useState("");

  // External options loaded
  const [technicians, setTechnicians] = useState([]);
  const [services, setServices] = useState([]);
  const [amcVisits, setAmcVisits] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Cached user detection
  const getCachedUser = () => {
    try {
      const u = localStorage.getItem("crm_user_info");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  };

  const activeUser = currentUser || getCachedUser();
  const roleName = (activeUser?.role?.name || activeUser?.role_name || "").toLowerCase();
  const isTechUser = Boolean(
    activeUser?.is_technician ||
    roleName === "technician" ||
    roleName.includes("technician")
  );

  const technicianDisplayName = useMemo(() => {
    if (isTechUser && activeUser) {
      return (
        activeUser.full_name ||
        `${activeUser.first_name || ""} ${activeUser.last_name || ""}`.trim() ||
        activeUser.username ||
        activeUser.email ||
        "Technician"
      );
    }
    if (assignedTechnician) {
      return (
        assignedTechnician.name ||
        assignedTechnician.full_name ||
        `${assignedTechnician.first_name || ""} ${assignedTechnician.last_name || ""}`.trim() ||
        assignedTechnician.username ||
        assignedTechnician.email ||
        "Assigned Technician"
      );
    }
    const found = technicians.find((t) => String(t.id) === String(selectedTechnicianId));
    if (found) {
      return (
        found.full_name ||
        `${found.first_name || ""} ${found.last_name || ""}`.trim() ||
        found.username ||
        found.email ||
        "Technician"
      );
    }
    if (activeUser) {
      return (
        activeUser.full_name ||
        `${activeUser.first_name || ""} ${activeUser.last_name || ""}`.trim() ||
        activeUser.username ||
        activeUser.email ||
        "Technician"
      );
    }
    return "";
  }, [isTechUser, activeUser, assignedTechnician, technicians, selectedTechnicianId]);

  const currentItem = items.find((it) => String(it.id) === String(selectedItemId)) || preselectedItem;
  const availableStock = parseFloat(currentItem?.available_stock || 0);

  // Load Technicians, Services, and AMC visits
  useEffect(() => {
    if (!isOpen) return;

    if (preselectedItem?.id) {
      setSelectedItemId(preselectedItem.id);
    } else if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }

    if (preselectedProject) {
      setJobType("PROJECT");
      setSelectedProjectId(preselectedProject.id);
    } else if (preselectedService) {
      const isVisit = Boolean(
        preselectedService.work_type === "amc_visit" ||
        preselectedService.visit_number ||
        preselectedService.contract_id ||
        preselectedService.amc_contract
      );
      if (isVisit) {
        setJobType("AMC_VISIT");
        setSelectedVisitId(preselectedService.id);
      } else {
        setJobType("SERVICE");
        setSelectedServiceId(preselectedService.id);
      }
    } else if (preselectedVisit) {
      setJobType("AMC_VISIT");
      setSelectedVisitId(preselectedVisit.id);
    }

    // 1. If logged in as technician, automatically select activeUser
    if (isTechUser && activeUser?.id) {
      setSelectedTechnicianId(String(activeUser.id));
    } else {
      // 2. Look for assigned technician from props or preselected job
      let techId = assignedTechnician?.id || "";
      if (!techId && preselectedProject) {
        techId =
          (Array.isArray(preselectedProject.technicians_details) && preselectedProject.technicians_details[0]?.id) ||
          (Array.isArray(preselectedProject.technicians) && preselectedProject.technicians[0]?.id) ||
          (Array.isArray(preselectedProject.technicians) && typeof preselectedProject.technicians[0] === "number" && preselectedProject.technicians[0]) ||
          preselectedProject.project_executive?.id ||
          preselectedProject.project_executive ||
          "";
      } else if (!techId && preselectedService) {
        techId =
          preselectedService.service_engineer?.id ||
          preselectedService.service_engineer_id ||
          preselectedService.service_engineer_details?.id ||
          (Array.isArray(preselectedService.technicians_details) && preselectedService.technicians_details[0]?.id) ||
          (Array.isArray(preselectedService.assigned_technicians_list) && preselectedService.assigned_technicians_list[0]?.id) ||
          (Array.isArray(preselectedService.technicians) && preselectedService.technicians[0]?.id) ||
          (Array.isArray(preselectedService.technicians) && typeof preselectedService.technicians[0] === "number" && preselectedService.technicians[0]) ||
          "";
      } else if (!techId && preselectedVisit) {
        techId =
          preselectedVisit.service_engineer?.id ||
          preselectedVisit.service_engineer_id ||
          preselectedVisit.service_engineer_details?.id ||
          (Array.isArray(preselectedVisit.technicians_details) && preselectedVisit.technicians_details[0]?.id) ||
          (Array.isArray(preselectedVisit.assigned_technicians_list) && preselectedVisit.assigned_technicians_list[0]?.id) ||
          (Array.isArray(preselectedVisit.technicians) && preselectedVisit.technicians[0]?.id) ||
          (Array.isArray(preselectedVisit.technicians) && typeof preselectedVisit.technicians[0] === "number" && preselectedVisit.technicians[0]) ||
          "";
      }
      if (techId) {
        setSelectedTechnicianId(String(techId));
      } else if (activeUser?.id && isRequestOnly) {
        setSelectedTechnicianId(String(activeUser.id));
      }
    }

    const fetchDropdownData = async () => {
      setLoadingOptions(true);
      const token = localStorage.getItem("access") || localStorage.getItem("access_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      try {
        // Fetch staff - try /auth/staff/all/ first (all authenticated), fallback to /auth/staff/
        let staffRes = await fetch(`${api}/auth/staff/all/`, { headers }).catch(() => null);
        if (!staffRes || !staffRes.ok) {
          staffRes = await fetch(`${api}/auth/staff/?limit=1000`, { headers }).catch(() => null);
        }

        const [srvRes, vstRes, prjRes] = await Promise.all([
          fetch(`${api}/amc/services/?limit=500`, { headers }).catch(() => null),
          fetch(`${api}/amc/visits/?limit=500`, { headers }).catch(() => null),
          fetch(`${api}/lead/projects/?limit=500`, { headers }).catch(() => null),
        ]);

        let loadedTechs = [];
        if (staffRes && staffRes.ok) {
          const d = await staffRes.json();
          loadedTechs = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
        }

        // Ensure activeUser is in the list
        if (activeUser?.id && !loadedTechs.some((t) => String(t.id) === String(activeUser.id))) {
          loadedTechs.unshift({
            id: activeUser.id,
            first_name: activeUser.first_name || activeUser.full_name || "Technician",
            last_name: activeUser.last_name || "",
            username: activeUser.username || activeUser.email,
            email: activeUser.email,
            mobile_no: activeUser.mobile_no || activeUser.phone,
          });
        }

        // Ensure assignedTechnician is in the list
        if (assignedTechnician?.id && !loadedTechs.some((t) => String(t.id) === String(assignedTechnician.id))) {
          loadedTechs.unshift({
            id: assignedTechnician.id,
            first_name: assignedTechnician.name || assignedTechnician.first_name || "Assigned",
            last_name: assignedTechnician.last_name || "",
            username: assignedTechnician.username || assignedTechnician.email,
            email: assignedTechnician.email,
            mobile_no: assignedTechnician.mobile_no || assignedTechnician.phone,
          });
        }

        setTechnicians(loadedTechs);

        if (srvRes && srvRes.ok) {
          const d = await srvRes.json();
          const list = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
          setServices(list);
        }

        if (vstRes && vstRes.ok) {
          const d = await vstRes.json();
          const list = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
          setAmcVisits(list);
        }

        if (prjRes && prjRes.ok) {
          const d = await prjRes.json();
          const list = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
          setProjects(list);
        }
      } catch (err) {
        console.warn("Error fetching issue stock dropdowns:", err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchDropdownData();
  }, [isOpen, preselectedItem, preselectedService, preselectedVisit, preselectedProject, baseApi, isRequestOnly, isTechUser, activeUser?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemId) {
      Swal.fire({ icon: "error", title: "Validation", text: "Please select an inventory item." });
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      Swal.fire({ icon: "error", title: "Validation", text: "Please enter a valid positive quantity." });
      return;
    }
    if (!isRequestOnly && qty > availableStock) {
      Swal.fire({
        icon: "error",
        title: "Insufficient Stock",
        text: `Cannot issue ${qty} ${currentItem?.unit || "units"}. Only ${availableStock} ${currentItem?.unit || "units"} available in inventory.`,
      });
      return;
    }

    if (isRequestOnly && qty > availableStock) {
      const confirmOver = await Swal.fire({
        title: "Requested Qty Exceeds Current Stock",
        text: `You are requesting ${qty} ${currentItem?.unit || "units"}, but only ${availableStock} are currently in warehouse inventory. Do you still want to submit this requisition request?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#0284c7",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Yes, Submit Request",
        cancelButtonText: "Cancel",
      });
      if (!confirmOver.isConfirmed) return;
    }

    setLoading(true);
    const token = localStorage.getItem("access") || localStorage.getItem("access_token");

    try {
      const payload = {
        item_id: selectedItemId,
        quantity: qty,
        technician_id: selectedTechnicianId || (activeUser?.id ? activeUser.id : null),
        service_id: jobType === "SERVICE" ? (selectedServiceId || null) : null,
        visit_id: jobType === "AMC_VISIT" ? (selectedVisitId || null) : null,
        project_id: jobType === "PROJECT" ? (selectedProjectId || null) : null,
        notes: notes.trim(),
      };

      const targetEndpoint = isRequestOnly
        ? `${api}/inventory/items/request-stock/`
        : `${api}/inventory/items/issue-stock/`;

      const res = await fetch(targetEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errText = isRequestOnly ? "Failed to submit stock request." : "Failed to issue stock.";
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await res.json();
            errText = errData.error || errData.detail || JSON.stringify(errData);
          } else {
            errText = `Server error (${res.status}). Please check input details.`;
          }
        } catch {
          errText = `Server error (${res.status}).`;
        }
        throw new Error(errText);
      }

      Swal.fire({
        icon: "success",
        title: isRequestOnly ? "Stock Request Submitted" : "Stock Issued Successfully",
        text: isRequestOnly
          ? `Request for ${qty} ${currentItem?.unit || "units"} of ${currentItem?.name} submitted for inventory approval.`
          : `Issued ${qty} ${currentItem?.unit || "units"} of ${currentItem?.name} to field operations.`,
        timer: 1800,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-sky-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              {isRequestOnly ? <Wrench size={19} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isRequestOnly ? "Request Stock for Field Work" : "Issue Stock to Technician"}
              </h3>
              <p className="text-xs text-slate-500">
                {isRequestOnly
                  ? "Submit a requisition request for spare parts & materials for this service / visit"
                  : "Allocate spare parts & materials to technician for service job or AMC visit"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-sm">
          {/* Select Item */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Select Inventory Item <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white transition-all"
              required
            >
              <option value="">-- Choose Inventory Item --</option>
              {items.map((it) => (
                <option key={it.id} value={it.id} disabled={parseFloat(it.available_stock || 0) <= 0}>
                  {it.name} ({it.item_code}) {it.capacity ? `[${it.capacity}]` : ""} - Available: {it.available_stock} {it.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Banner */}
          {currentItem && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Available Stock</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {currentItem.available_stock} {currentItem.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Capacity</span>
                <span className="font-semibold text-slate-800">
                  {currentItem.capacity || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Used Stock</span>
                <span className="font-semibold text-slate-600">
                  {currentItem.used_stock || 0} {currentItem.unit}
                </span>
              </div>
            </div>
          )}

          {/* Quantity to Issue */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Quantity to Issue <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Layers size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={availableStock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Max ${availableStock} ${currentItem?.unit || "units"}`}
                className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                required
              />
            </div>
          </div>

          {/* Technician Selection / Auto-Assigned Display */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              {isRequestOnly ? "Requesting Technician" : "Issue To Technician"} <span className="text-rose-500">*</span>
            </label>

            {isTechUser || (isRequestOnly && technicianDisplayName) ? (
              /* If logged in as technician or in request mode, show their name clearly and automatically */
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-sky-50/80 border border-sky-200 shadow-2xs">
                <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                  {(technicianDisplayName || "T").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    {technicianDisplayName || "Technician"}
                  </span>
                  <span className="text-[10px] text-sky-700 font-medium block truncate">
                    {isTechUser ? "Logged-in Field Specialist" : "Assigned Service Engineer"}
                    {activeUser?.mobile_no ? ` · ${activeUser.mobile_no}` : ""}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
                  {isTechUser ? "You" : "Assigned"}
                </span>
              </div>
            ) : (
              /* If Admin/Manager, show the selectable dropdown of technicians */
              <div className="relative">
                <UserCheck size={16} className="absolute left-3 top-3 text-slate-400" />
                <select
                  value={selectedTechnicianId}
                  onChange={(e) => setSelectedTechnicianId(e.target.value)}
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white transition-all"
                  required
                >
                  <option value="">-- Select Field Technician --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name || t.last_name
                        ? `${t.first_name || ""} ${t.last_name || ""}`.trim()
                        : t.full_name || t.username}{" "}
                      {t.phone || t.mobile_no ? `(${t.phone || t.mobile_no})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Job Mapping: Service / AMC Visit / Project */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              {isRequestOnly ? "Request For Job / Project" : "Issue For Specific Job / Project"}
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setJobType("SERVICE")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  jobType === "SERVICE"
                    ? "bg-sky-50 border-sky-400 text-sky-700 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Service Job
              </button>
              <button
                type="button"
                onClick={() => setJobType("AMC_VISIT")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  jobType === "AMC_VISIT"
                    ? "bg-purple-50 border-purple-400 text-purple-700 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                AMC Visit
              </button>
              <button
                type="button"
                onClick={() => setJobType("PROJECT")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  jobType === "PROJECT"
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Project
              </button>
              <button
                type="button"
                onClick={() => setJobType("GENERAL")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  jobType === "GENERAL"
                    ? "bg-slate-100 border-slate-400 text-slate-800 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                General
              </button>
            </div>

            {/* Project dropdown or locked display */}
            {jobType === "PROJECT" && (
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-500">
                  Target Project <span className="text-rose-500">*</span>
                </label>
                {preselectedProject ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs">
                    <div>
                      <span className="font-bold text-indigo-900 block">
                        {preselectedProject.project_code || `PRJ-${preselectedProject.id}`}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {preselectedProject.customer_details?.company_name || preselectedProject.customer_name || "Client Project"}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      Target Project
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                      required
                    >
                      <option value="">-- Choose Target Project --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.project_code || `PRJ-${p.id}`} - {p.customer_details?.company_name || p.customer_name || "Client"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Service dropdown */}
            {jobType === "SERVICE" && (
              <div className="space-y-1">
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                >
                  <option value="">-- Choose Service Request --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.service_number} - {s.customer_name || s.customer?.name || "Customer"} ({s.service_type || "Service"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* AMC Visit dropdown */}
            {jobType === "AMC_VISIT" && (
              <div className="space-y-1">
                <select
                  value={selectedVisitId}
                  onChange={(e) => setSelectedVisitId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                >
                  <option value="">-- Choose AMC Routine Visit --</option>
                  {amcVisits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.visit_number} - {v.contract_number || v.customer_name || "Contract"} ({v.visit_date || "Scheduled"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Notes / Fault Description / Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. RO membrane replacement for high TDS breakdown"
              className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none transition-all"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {loading
                ? isRequestOnly
                  ? "Submitting Request..."
                  : "Issuing..."
                : isRequestOnly
                ? "Submit Stock Request"
                : "Confirm & Issue Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

