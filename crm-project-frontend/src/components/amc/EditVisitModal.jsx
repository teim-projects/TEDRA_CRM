import React, { useState, useEffect, useMemo } from "react";
import { RxCross2 } from "react-icons/rx";
import {
  MdEditCalendar,
  MdEngineering,
  MdSearch,
  MdCheck,
  MdPerson,
  MdPhone,
  MdCheckCircle,
  MdOutlineNotes,
  MdEmail,
} from "react-icons/md";
import Swal from "sweetalert2";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";

export default function EditVisitModal({
  open,
  onClose,
  service,
  slot,
  amc,
  baseApi,
  token,
  onSuccess,
}) {
  const [serviceDate, setServiceDate] = useState("");
  const [serviceType, setServiceType] = useState("routine_maintenance");
  const [status, setStatus] = useState("scheduled");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [technicians, setTechnicians] = useState([]);
  const [selectedTechIds, setSelectedTechIds] = useState([]);
  const [techSearch, setTechSearch] = useState("");
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [saving, setSaving] = useState(false);

  const BASE_API = (baseApi || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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

  // Initialize form state whenever modal opens or target changes
  useEffect(() => {
    if (!open) return;

    const initialDate =
      service?.service_date ||
      slot?.date ||
      new Date().toISOString().split("T")[0];

    const initialType =
      service?.service_type ||
      (slot?.visitNumber && slot.visitNumber % 2 === 0
        ? "system_audit"
        : "routine_maintenance");

    const initialStatus = service?.status || "scheduled";
    const initialPriority = service?.priority || "medium";

    const defaultDesc =
      service?.description ||
      (slot?.visitNumber
        ? `Routine Maintenance Visit #${String(slot.visitNumber).padStart(2, "0")} under AMC ${amc?.contract_id || `#${amc?.id}`}`
        : "");

    const initialContactPerson =
      service?.contact_person ||
      amc?.customer_details?.contact_person ||
      amc?.customer_details?.name ||
      "";

    const initialContactPhone =
      service?.contact_phone ||
      amc?.customer_details?.contact_number ||
      amc?.customer_details?.mobile_number ||
      "";

    setServiceDate(initialDate);
    setServiceType(initialType);
    setStatus(initialStatus);
    setPriority(initialPriority);
    setDescription(defaultDesc);
    setResolutionNotes(service?.resolution_notes || "");
    setContactPerson(initialContactPerson);
    setContactPhone(initialContactPhone);
    setTechSearch("");

    // Populate allocated technician IDs
    let techIds = [];
    if (Array.isArray(service?.technicians)) {
      techIds = service.technicians.map((t) =>
        typeof t === "object" && t !== null ? t.id : Number(t)
      );
    } else if (Array.isArray(service?.technicians_details)) {
      techIds = service.technicians_details.map((t) => t.id);
    }
    setSelectedTechIds(techIds.filter(Boolean));
  }, [open, service, slot, amc]);

  // Fetch technician list
  useEffect(() => {
    if (!open) return;

    const fetchTechnicians = async () => {
      setLoadingTechs(true);
      try {
        const res = await fetch(`${BASE_API}/auth/staff/?limit=1000`, {
          headers: {
            "Content-Type": "application/json",
            ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
          },
        });

        if (!res.ok) throw new Error("Failed to load technician roster");

        const data = await res.json();
        const results = Array.isArray(data.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];

        const techList = results.filter((u) => {
          const roleName =
            u.role?.name || (typeof u.role === "string" ? u.role : "");
          return (roleName || "").trim().toLowerCase() === "technician";
        });

        setTechnicians(techList);
      } catch (err) {
        console.error("Error loading technicians:", err);
      } finally {
        setLoadingTechs(false);
      }
    };

    fetchTechnicians();
  }, [open, BASE_API, effectiveToken]);

  if (!open) return null;

  const visitLabel = slot?.visitNumber
    ? `Visit ${String(slot.visitNumber).padStart(2, "0")}`
    : service?.service_number || "AMC Visit";

  const customerName =
    amc?.customer_details?.company_name ||
    amc?.customer_details?.name ||
    amc?.customer_name ||
    "Customer";

  const siteName =
    service?.site_name ||
    service?.site_details?.name ||
    amc?.site_details?.name ||
    amc?.site_name ||
    "";

  const siteShortcut =
    service?.site_shortcut ||
    service?.site_details?.site_shortcut ||
    amc?.site_details?.site_shortcut ||
    amc?.site_shortcut ||
    "";

  const filteredTechnicians = technicians.filter((t) => {
    if (!techSearch.trim()) return true;
    const q = techSearch.toLowerCase().trim();
    const name = `${t.first_name || ""} ${t.last_name || ""}`.toLowerCase();
    const email = (t.email || "").toLowerCase();
    const phone = String(t.mobile_no || "");
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  const handleToggleTech = (id) => {
    setSelectedTechIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllTechs = () => {
    const allFilteredIds = filteredTechnicians.map((t) => t.id);
    setSelectedTechIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const handleClearAllTechs = () => {
    setSelectedTechIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serviceDate) {
      Swal.fire("Validation Error", "Please specify a service date.", "warning");
      return;
    }

    if (status === "in_progress" && !isServiceDue(serviceDate)) {
      Swal.fire({
        icon: "warning",
        title: "Visit Not Due Yet",
        text: `This visit is scheduled for ${formatDisplayDate(serviceDate)}. It can only be marked In Progress on or after the scheduled date.`,
      });
      return;
    }

    if (status === "completed") {
      if (!isServiceDue(serviceDate)) {
        Swal.fire({
          icon: "warning",
          title: "Cannot Complete Before Scheduled Date",
          text: `This visit is scheduled for ${formatDisplayDate(serviceDate)}. It cannot be marked completed before the scheduled date arrives.`,
        });
        return;
      }
      if (service?.status !== "in_progress" && service?.status !== "completed") {
        Swal.fire({
          icon: "warning",
          title: "Must Start Visit First",
          text: "This visit has not been started yet. Please start the visit (set to In Progress) before marking it completed.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        visit_date: serviceDate,
        service_date: serviceDate,
        visit_type: serviceType,
        service_type: serviceType,
        status: status,
        priority: priority,
        description: description,
        resolution_notes: resolutionNotes,
        contact_person: contactPerson,
        contact_phone: contactPhone,
        technicians: selectedTechIds,
      };

      if (status === "completed" && (!service || !service.completion_date)) {
        payload.completion_date = new Date().toISOString().split("T")[0];
      }

      let res;
      if (service?.id) {
        // Update existing AMCVisit
        res = await fetch(`${BASE_API}/amc/visits/${service.id}/`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new AMCVisit for planned visit slot
        const createPayload = {
          ...payload,
          amc_contract: amc?.id,
          site: amc?.site || amc?.site_details?.id || null,
          customer: amc?.customer || amc?.customer_details?.id,
          project: amc?.project || amc?.project_details?.id || null,
          visit_index: slot?.visitNumber || 1,
          visit_address: amc?.site_address || "",
        };

        res = await fetch(`${BASE_API}/amc/visits/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
          },
          body: JSON.stringify(createPayload),
        });
      }

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          resData.detail ||
            resData.message ||
            (Array.isArray(resData.non_field_errors)
              ? resData.non_field_errors.join(", ")
              : "Failed to save visit changes")
        );
      }

      Swal.fire({
        icon: "success",
        title: "Visit Updated",
        text: "Service date rescheduled & visit details saved successfully.",
        timer: 1600,
        showConfirmButton: false,
      });

      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      console.error("Save visit error:", err);
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: err.message || "Could not update visit details.",
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
                Reschedule & Edit {visitLabel}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                {service?.service_number || `VISIT SLOT`}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>Customer: <strong className="text-slate-600 font-medium">{customerName}</strong></span>
              {siteName && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                  <span>📍</span>
                  <span>{siteName}</span>
                  {siteShortcut && (
                    <span className="font-mono text-[9px] text-sky-600 font-medium">({siteShortcut})</span>
                  )}
                </span>
              )}
              {amc?.contract_id && <span className="text-slate-400"> · {amc.contract_id}</span>}
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
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Contract
                </span>
                <span className="font-semibold text-slate-800 truncate block mt-0.5">
                  {amc?.contract_id || `#${amc?.id}`}
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
                  Site
                </span>
                <span className="font-semibold text-sky-800 truncate block mt-0.5" title={siteName || "—"}>
                  {siteName ? `📍 ${siteName}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Contract Period
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {amc?.start_date || "-"} to {amc?.end_date || "-"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Assigned Techs
                </span>
                <span className="font-bold text-blue-600 block mt-0.5">
                  {selectedTechIds.length} Technician{selectedTechIds.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Reschedule Date */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Reschedule Service Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Visit Status */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Visit Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer capitalize"
                >
                  <option value="scheduled">Scheduled</option>
                  <option
                    value="in_progress"
                    disabled={!isServiceDue(serviceDate)}
                    title={!isServiceDue(serviceDate) ? "Cannot start before scheduled date" : ""}
                  >
                    In Progress {!isServiceDue(serviceDate) ? "(Locked until visit date)" : ""}
                  </option>
                  <option
                    value="completed"
                    disabled={!isServiceDue(serviceDate) || (service?.status !== "in_progress" && service?.status !== "completed")}
                    title={
                      !isServiceDue(serviceDate)
                        ? "Cannot complete before scheduled date"
                        : service?.status !== "in_progress" && service?.status !== "completed"
                        ? "Must start visit first before marking completed"
                        : ""
                    }
                  >
                    Completed {!isServiceDue(serviceDate) ? "(Locked until visit date)" : service?.status !== "in_progress" && service?.status !== "completed" ? "(Start visit first)" : ""}
                  </option>
                  <option value="pending_parts">Pending Parts</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {!isServiceDue(serviceDate) && (
                  <p className="text-[10px] text-amber-600">
                    Visit scheduled for {formatDisplayDate(serviceDate)}. Start unlocks when date arrives.
                  </p>
                )}
              </div>

              {/* Service Type */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Service / Visit Type
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  <option value="routine_maintenance">Routine Maintenance</option>
                  <option value="preventive_maintenance">Preventive Maintenance</option>
                  <option value="filter_replacement">Filter / Membrane Replacement</option>
                  <option value="system_audit">System Audit & Inspection</option>
                  <option value="water_testing">Water Quality Testing</option>
                  <option value="breakdown">Breakdown / Emergency</option>
                  <option value="installation_check">Installation Check</option>
                </select>
              </div>

              {/* Visit Priority */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Visit Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer capitalize"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical / Emergency</option>
                </select>
              </div>

              {/* Site Contact Person */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Site Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Mr. Rajesh Sharma"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Contact Phone Number */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g. 9822011235"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Reassign Technicians Block */}
              <div className="space-y-2 md:col-span-2 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Reassign Technicians
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full">
                      {selectedTechIds.length} Allocated
                    </span>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleSelectAllTechs}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllTechs}
                      className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative pt-1">
                  <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none" />
                  <input
                    type="text"
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                    placeholder="Search technicians by name, mobile, or email..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                  />
                </div>

                {/* Technicians List Cards */}
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 pt-1 scrollbar-thin">
                  {loadingTechs ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      Loading technician roster...
                    </div>
                  ) : filteredTechnicians.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs">
                      No technicians match "{techSearch}"
                    </div>
                  ) : (
                    filteredTechnicians.map((tech) => {
                      const isSelected = selectedTechIds.includes(tech.id);
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
                          onClick={() => handleToggleTech(tech.id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                            isSelected
                              ? "bg-blue-50/70 border-blue-400 ring-1 ring-blue-300 shadow-xs"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Checkbox */}
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                isSelected
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <MdCheck size={12} className="stroke-2" />}
                            </div>

                            {/* Initials Avatar */}
                            <div
                              className={`w-7 h-7 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 ${
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
                                  className={`text-xs truncate block ${
                                    isSelected ? "font-bold text-blue-950" : "font-semibold text-slate-900"
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
                              <MdCheckCircle size={12} />
                              <span>Assigned</span>
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Important Visit Instructions */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Important Visit Instructions / Tasks to Inspect
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Inspect membrane flow rate, replace 5-micron sediment cartridge, calibrate TDS sensors, verify auto-flush cycle..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                />
              </div>

              {/* Resolution Notes / Work Done Report */}
              {(status === "in_progress" || status === "completed" || resolutionNotes) && (
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Resolution Notes / Work Done Report
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Record serviced equipment details, replaced spares, post-service TDS readings, and customer feedback..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                  />
                </div>
              )}

            </div>

            {/* Action Buttons Panel (Matching AddLeadForm) */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-6">
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
                    <MdEditCalendar size={15} />
                    <span>Reschedule & Save Visit</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
