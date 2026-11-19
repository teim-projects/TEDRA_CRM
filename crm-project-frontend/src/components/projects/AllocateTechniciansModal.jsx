import React, { useState, useEffect, useMemo } from "react";
import { RxCross2 } from "react-icons/rx";
import {
  MdEngineering,
  MdSearch,
  MdCheck,
  MdPerson,
  MdCheckCircle,
  MdPhone,
  MdEmail,
} from "react-icons/md";
import Swal from "sweetalert2";

export default function AllocateTechniciansModal({
  open,
  onClose,
  project,
  entity,
  endpoint,
  title,
  baseApi,
  token,
  onSuccess,
}) {
  const currentEntity = entity || project;
  const [technicians, setTechnicians] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const BASE_API = baseApi ? baseApi.replace(/\/$/, "") : "http://127.0.0.1:8000";

  const effectiveToken = useMemo(
    () =>
      token ||
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    [token]
  );

  // Pre-populate currently allocated technicians when modal opens
  useEffect(() => {
    if (!open || !currentEntity) return;

    let existingIds = [];
    const sourceList =
      Array.isArray(currentEntity.technicians_details) && currentEntity.technicians_details.length > 0
        ? currentEntity.technicians_details
        : Array.isArray(currentEntity.assigned_technicians_list) && currentEntity.assigned_technicians_list.length > 0
        ? currentEntity.assigned_technicians_list
        : Array.isArray(currentEntity.technicians)
        ? currentEntity.technicians
        : [];

    existingIds = sourceList.map((t) =>
      typeof t === "object" && t !== null ? t.id : Number(t)
    );

    setSelectedIds(existingIds.filter(Boolean));
    setSearchQuery("");
  }, [open, currentEntity]);

  // Fetch all active technicians
  useEffect(() => {
    if (!open) return;

    const fetchTechnicians = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_API}/auth/staff/?limit=1000`, {
          headers: {
            "Content-Type": "application/json",
            ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
          },
        });

        if (!res.ok) throw new Error("Failed to load staff list");

        const data = await res.json();
        const results = Array.isArray(data.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];

        // Filter exclusively for users with role "Technician"
        const techList = results.filter((u) => {
          const roleName =
            u.role?.name || (typeof u.role === "string" ? u.role : "");
          return (roleName || "").trim().toLowerCase() === "technician";
        });

        setTechnicians(techList);
      } catch (err) {
        console.error("Error loading technicians:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTechnicians();
  }, [open, BASE_API, effectiveToken]);

  if (!open || !currentEntity) return null;

  const customerName =
    currentEntity?.customer_details?.company_name ||
    currentEntity?.customer_details?.name ||
    currentEntity?.customer_name ||
    currentEntity?.customer ||
    "-";

  const entityCode =
    currentEntity?.service_number ||
    currentEntity?.project_code ||
    (currentEntity?.id ? `PRJ-${currentEntity.id}` : "VISIT");

  // Filter technicians based on search input
  const filteredTechnicians = technicians.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${t.first_name || ""} ${t.last_name || ""}`.toLowerCase();
    const email = (t.email || "").toLowerCase();
    const mobile = String(t.mobile_no || "");
    return fullName.includes(q) || email.includes(q) || mobile.includes(q);
  });

  const handleToggleTechnician = (techId) => {
    setSelectedIds((prev) =>
      prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredTechnicians.map((t) => t.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(
        endpoint || `${BASE_API}/lead/projects/${currentEntity?.id}/allocate-technicians/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
          },
          body: JSON.stringify({
            technicians: selectedIds,
            technician_ids: selectedIds,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to allocate project");
      }

      Swal.fire({
        icon: "success",
        title: "Allocation Saved",
        text: `Allocated to ${selectedIds.length} technician${
          selectedIds.length === 1 ? "" : "s"
        } successfully.`,
        timer: 1600,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Allocation Failed",
        text: err.message || "Could not save technician allocation.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-2xl w-full mx-auto my-8 relative max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header Bar (Matching AddLeadForm) */}
        <div className="bg-white px-6 pt-6 pb-2 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">
                {title || (currentEntity?.service_number ? `Allocate Visit` : "Allocate Project")}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                {entityCode}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customer: <span className="text-slate-600 font-medium">{customerName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
            aria-label="Close"
          >
            <RxCross2 size={18} />
          </button>
        </div>

        {/* Main Body */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          <form className="space-y-4 text-slate-800" onSubmit={handleSubmit}>
            
            {/* Context Summary Cards (Matching AddLeadForm & RenewAMCModal Style) */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Stage / Type
                </span>
                <span className="font-semibold text-slate-800 capitalize truncate block mt-0.5">
                  {currentEntity?.service_type_display ||
                    currentEntity?.service_type ||
                    currentEntity?.project_stage_display ||
                    currentEntity?.project_stage ||
                    currentEntity?.status_display ||
                    currentEntity?.status ||
                    "Scheduled"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Priority
                </span>
                <span className="font-semibold text-slate-800 capitalize block mt-0.5">
                  {currentEntity?.priority_display || currentEntity?.priority || "Medium"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Customer
                </span>
                <span className="font-semibold text-slate-800 truncate block mt-0.5" title={customerName}>
                  {customerName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Selected
                </span>
                <span className="font-bold text-blue-600 block mt-0.5">
                  {selectedIds.length} Technician{selectedIds.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Search Input (Standardized Input Styling) */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Search Technicians
              </label>
              <div className="relative">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search technicians by name, mobile, or email..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>
            </div>

            {/* Multi-Select Header Controls */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="text-xs font-semibold text-slate-600">
                Select one or multiple field service technicians:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Technicians List Cards */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                    <span>Loading available technicians...</span>
                  </div>
                </div>
              ) : filteredTechnicians.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <p>No technicians match the active search filter.</p>
                </div>
              ) : (
                filteredTechnicians.map((tech) => {
                  const isSelected = selectedIds.includes(tech.id);
                  const fullName =
                    `${tech.first_name || ""} ${tech.last_name || ""}`.trim() ||
                    tech.username ||
                    "Technician";
                  const initials =
                    `${tech.first_name?.[0] || ""}${tech.last_name?.[0] || ""}`.toUpperCase() ||
                    "T";
                  const isActive = tech.is_active !== false;

                  return (
                    <div
                      key={tech.id}
                      onClick={() => handleToggleTechnician(tech.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-blue-50/70 border-blue-400 ring-1 ring-blue-300 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <MdCheck size={14} className="stroke-2" />}
                        </div>

                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-blue-200 text-blue-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {initials}
                        </div>

                        {/* Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold truncate block ${
                                isSelected ? "text-blue-950 font-bold" : "text-slate-900"
                              }`}
                            >
                              {fullName}
                            </span>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                                isActive
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {isActive ? "Active on Field" : "Inactive"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-3 mt-0.5">
                            {tech.mobile_no && (
                              <span className="inline-flex items-center gap-1">
                                <MdPhone size={12} className="text-slate-400" />
                                <span>{tech.mobile_no}</span>
                              </span>
                            )}
                            {tech.email && (
                              <span className="inline-flex items-center gap-1 truncate">
                                <MdEmail size={12} className="text-slate-400" />
                                <span className="truncate">{tech.email}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                          <MdCheckCircle size={13} />
                          <span>Allocated</span>
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Buttons Panel (Matching AddLeadForm) */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-6">
              <div className="text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-800">{selectedIds.length}</span> of{" "}
                {technicians.length} technician{technicians.length === 1 ? "" : "s"} allocated
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <MdEngineering size={15} />
                      <span>Save Allocation</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
