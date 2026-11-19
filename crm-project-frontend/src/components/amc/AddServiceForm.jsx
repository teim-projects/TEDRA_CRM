import React, { useState, useEffect, useMemo } from "react";
import { RxCross2 } from "react-icons/rx";
import { MapPin, ExternalLink } from "lucide-react";
import Select from "react-select";
import Swal from "sweetalert2";
import LocationPickerModal from "../common/LocationPickerModal";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";

export default function AddServiceForm({
  open,
  onClose,
  onSuccess,
  service = null,
  initialCustomer = null,
  initialProject = null,
  baseApi,
  token,
}) {
  const BASE_API = (baseApi || "http://127.0.0.1:8000").replace(/\/$/, "");

  const [formData, setFormData] = useState({
    customer: "",
    site: "",
    project: "",
    equipment: "",
    serial_number: "",
    service_type: "breakdown",
    service_date: new Date().toISOString().split("T")[0],
    completion_date: "",
    priority: "medium",
    status: "scheduled",
    service_engineer: "",
    technicians: [],
    service_cost: "",
    contact_person: "",
    contact_phone: "",
    service_address: "",
    latitude: null,
    longitude: null,
    location_url: "",
    description: "",
    resolution_notes: "",
    customer_feedback: "",
  });

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [sitesList, setSitesList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [techniciansList, setTechniciansList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch options (customers, staff, projects)
  useEffect(() => {
    if (!open) return;

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    setLoadingOptions(true);
    Promise.all([
      fetch(`${BASE_API}/lead/customer/?limit=1000`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${BASE_API}/auth/staff/?limit=1000`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${BASE_API}/lead/projects/?limit=1000`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([custData, staffData, projData]) => {
        const custList = Array.isArray(custData.results)
          ? custData.results
          : Array.isArray(custData)
          ? custData
          : [];
        const stList = Array.isArray(staffData.results)
          ? staffData.results
          : Array.isArray(staffData)
          ? staffData
          : [];
        const prList = Array.isArray(projData.results)
          ? projData.results
          : Array.isArray(projData)
          ? projData
          : [];

        setCustomers(custList);
        setStaffList(stList);
        setProjectsList(prList);

        // Filter technicians strictly by role "Technician"
        const techs = stList.filter((s) => {
          const roleName = s.role?.name || (typeof s.role === "string" ? s.role : "");
          return (roleName || "").trim().toLowerCase() === "technician";
        });
        setTechniciansList(techs.length > 0 ? techs : stList);
      })
      .catch((err) => console.error("Error loading service form options:", err))
      .finally(() => setLoadingOptions(false));
  }, [open, BASE_API, token]);

  // Pre-fill form when editing or initializing
  useEffect(() => {
    if (!open) return;

    if (service) {
      setFormData({
        customer: service.customer || service.customer_details?.id || "",
        site: service.site || service.site_details?.id || "",
        project: service.project || service.project_details?.id || "",
        equipment: service.equipment || service.project_details?.project_name || service.project_details?.product || "",
        serial_number: service.serial_number || service.project_details?.project_code || "",
        service_type: service.service_type || "breakdown",
        service_date: service.service_date || new Date().toISOString().split("T")[0],
        completion_date: service.completion_date || "",
        priority: service.priority || "medium",
        status: service.status || "scheduled",
        service_engineer: service.service_engineer || service.service_engineer_details?.id || "",
        technicians: Array.isArray(service.technicians)
          ? service.technicians.map((t) => (typeof t === "object" ? t.id : t))
          : Array.isArray(service.technicians_details)
          ? service.technicians_details.map((t) => t.id)
          : [],
        service_cost: service.service_cost ? String(service.service_cost) : "",
        contact_person: service.contact_person || service.customer_details?.contact_person || "",
        contact_phone:
          service.contact_phone ||
          service.customer_details?.phone_number ||
          service.customer_details?.mobile_number ||
          "",
        service_address: service.service_address || service.customer_details?.address || "",
        latitude: service.latitude || null,
        longitude: service.longitude || null,
        location_url: service.location_url || "",
        description: service.description || "",
        diagnosis: service.diagnosis || "",
        resolution_notes: service.resolution_notes || "",
        customer_feedback: service.customer_feedback || "",
      });
    } else if (initialCustomer) {
      const addr = [
        initialCustomer.address,
        initialCustomer.city,
        initialCustomer.state,
        initialCustomer.pincode,
      ]
        .filter(Boolean)
        .join(", ");

      setFormData({
        customer: initialCustomer.id || "",
        site: "",
        project: initialProject?.id || "",
        equipment: initialProject?.project_name || initialProject?.product || "",
        serial_number: initialProject?.project_code || "",
        service_type: "breakdown",
        service_date: new Date().toISOString().split("T")[0],
        completion_date: "",
        priority: "medium",
        status: "scheduled",
        service_engineer: "",
        technicians: [],
        service_cost: "",
        contact_person: initialCustomer.contact_person || initialCustomer.name || "",
        contact_phone: initialCustomer.phone_number || initialCustomer.mobile_number || "",
        service_address: addr,
        description: "",
        diagnosis: "",
        resolution_notes: "",
        customer_feedback: "",
      });
    } else {
      setFormData({
        customer: "",
        site: "",
        project: "",
        equipment: "",
        serial_number: "",
        service_type: "breakdown",
        service_date: new Date().toISOString().split("T")[0],
        completion_date: "",
        priority: "medium",
        status: "scheduled",
        service_engineer: "",
        technicians: [],
        service_cost: "",
        contact_person: "",
        contact_phone: "",
        service_address: "",
        description: "",
        diagnosis: "",
        resolution_notes: "",
        customer_feedback: "",
      });
    }
  }, [open, service, initialCustomer, initialProject]);

  // Fetch sites for the selected customer (also matching converted lead sites)
  useEffect(() => {
    if (!open) return;
    if (formData.customer) {
      const selectedCust = customers.find((c) => String(c.id) === String(formData.customer));
      const leadId = selectedCust?.lead || selectedCust?.lead_id;
      const leadParam = leadId ? `&lead=${leadId}` : "";
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      fetch(`${BASE_API}/api/site/?customer=${formData.customer}${leadParam}&limit=100`, { headers })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
          setSitesList(list);
        })
        .catch(() => setSitesList([]));
    } else {
      setSitesList([]);
    }
  }, [open, formData.customer, customers, BASE_API, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // When site changes, auto-populate address, contact person, and phone
      if (name === "site" && value) {
        const siteObj = sitesList.find((s) => String(s.id) === String(value));
        if (siteObj) {
          const siteAddr = [siteObj.address, siteObj.city, siteObj.state, siteObj.pincode]
            .filter(Boolean)
            .join(", ");
          if (siteAddr) updated.service_address = siteAddr;
          if (siteObj.owner_name) updated.contact_person = siteObj.owner_name;
          if (siteObj.owner_contact) updated.contact_phone = siteObj.owner_contact;
          if (!prev.equipment && siteObj.site_type) updated.equipment = siteObj.site_type;
        }
      }

      // When project changes, auto-populate equipment and serial number
      if (name === "project" && value) {
        const projObj = projectsList.find((p) => String(p.id) === String(value));
        if (projObj) {
          if (!prev.equipment) {
            updated.equipment = projObj.project_name || projObj.product || "";
          }
          if (!prev.serial_number) {
            updated.serial_number = projObj.project_code || `RO-PN-${projObj.id}`;
          }
        }
      }

      // When customer changes, auto-populate address, contact person, and phone
      if (name === "customer" && value) {
        const custObj = customers.find((c) => String(c.id) === String(value));
        if (custObj) {
          const addr = [
            custObj.address,
            custObj.city,
            custObj.state,
            custObj.pincode,
          ]
            .filter(Boolean)
            .join(", ");

          if (!prev.contact_person) {
            updated.contact_person = custObj.contact_person || custObj.name || "";
          }
          if (!prev.contact_phone) {
            updated.contact_phone =
              custObj.phone_number || custObj.mobile_number || custObj.contact_number || "";
          }
          if (!prev.service_address) {
            updated.service_address = addr;
          }
        }
      }

      return updated;
    });
  };

  // Filter projects by selected customer
  const filteredProjects = formData.customer
    ? projectsList.filter(
        (p) =>
          String(p.customer) === String(formData.customer) ||
          String(p.customer_details?.id) === String(formData.customer)
      )
    : projectsList;

  // Options formatted for searchable Select (matching AddLeadForm Executive format)
  const technicianSelectOptions = useMemo(() => {
    return techniciansList.map((t) => {
      const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.username;
      const contactInfo = t.email || t.mobile_no || "Technician";
      return {
        value: t.id,
        id: t.id,
        label: `${name} (${contactInfo})`,
      };
    });
  }, [techniciansList]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer) {
      Swal.fire({
        icon: "warning",
        title: "Customer Required",
        text: "Please select a customer for this service request.",
      });
      return;
    }

    if (!formData.service_date) {
      Swal.fire({
        icon: "warning",
        title: "Date Required",
        text: "Please specify the service date.",
      });
      return;
    }

    if (formData.status === "in_progress" && !isServiceDue(formData.service_date)) {
      Swal.fire({
        icon: "warning",
        title: "Service Not Due Yet",
        text: `This service is scheduled for ${formatDisplayDate(formData.service_date)}. It can only be marked In Progress on or after the scheduled date.`,
      });
      return;
    }

    if (formData.status === "completed") {
      if (!isServiceDue(formData.service_date)) {
        Swal.fire({
          icon: "warning",
          title: "Cannot Complete Before Scheduled Date",
          text: `This service is scheduled for ${formatDisplayDate(formData.service_date)}. It cannot be marked completed before the scheduled date arrives.`,
        });
        return;
      }
      if (service?.status !== "in_progress" && service?.status !== "completed") {
        Swal.fire({
          icon: "warning",
          title: "Must Start Service First",
          text: "This service has not been started yet. Please start the service (set to In Progress) before marking it completed.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        customer: Number(formData.customer),
        site: formData.site ? Number(formData.site) : null,
        project: formData.project ? Number(formData.project) : null,
        service_category: "single_service",
        amc_contract: null,
        service_type: formData.service_type,
        service_date: formData.service_date,
        completion_date: formData.completion_date || null,
        priority: formData.priority,
        status: formData.status,
        service_engineer: formData.service_engineer ? Number(formData.service_engineer) : null,
        technicians: formData.technicians,
        service_cost: formData.service_cost ? parseFloat(formData.service_cost) : 0.0,
        contact_person: formData.contact_person,
        contact_phone: formData.contact_phone,
        service_address: formData.service_address,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        location_url: formData.location_url || "",
        equipment: formData.equipment || "",
        serial_number: formData.serial_number || "",
        description: formData.description,
        diagnosis: formData.diagnosis || "",
        resolution_notes: formData.resolution_notes,
        customer_feedback: formData.customer_feedback || null,
      };

      if (formData.status === "completed" && !payload.completion_date) {
        payload.completion_date = new Date().toISOString().split("T")[0];
      }

      const url = service
        ? `${BASE_API}/amc/services/${service.id}/`
        : `${BASE_API}/amc/services/`;

      const method = service ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.detail ||
            Object.values(data).flat().join(" ") ||
            "Failed to save service request"
        );
      }

      Swal.fire({
        icon: "success",
        title: service ? "Service Updated" : "Service Added",
        text: `Service ${data.service_number || ""} saved successfully.`,
        timer: 1600,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      console.error("Save service error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Could not save service record.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-2xl w-full mx-auto my-8 relative max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header Bar (Styled matching AddLeadForm) */}
        <div className="bg-white px-6 pt-6 pb-2 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {service ? "Edit Service" : "Add Service"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Record on-demand repair, inspection, water test, or one-time maintenance service
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
            aria-label="Close"
          >
            <RxCross2 size={18} />
          </button>
        </div>

        {/* Form Main Body (Styled matching AddLeadForm) */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          <form className="space-y-4 text-slate-800" onSubmit={handleSubmit}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Customer */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Customer *
                </label>
                <select
                  name="customer"
                  value={formData.customer}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.name} {c.city ? `(${c.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Site / Parking Facility */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>Site / Parking Facility</span>
                  {sitesList.length > 0 && (
                    <span className="text-[10px] text-sky-600 font-medium">
                      {sitesList.length} site{sitesList.length > 1 ? "s" : ""} available
                    </span>
                  )}
                </label>
                <select
                  name="site"
                  value={formData.site}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  <option value="">Select Facility Site (Optional)</option>
                  {sitesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.site_shortcut ? `[${s.site_shortcut}]` : ""} {s.site_type ? `· ${s.site_type}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Linked Project / Equipment */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Linked Project
                </label>
                <select
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  <option value="">Select Project / Standalone</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_code || `PRJ-${p.id}`} — {p.customer_details?.company_name || "Project"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Equipment / Machine Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Equipment / Machine Name
                </label>
                <input
                  type="text"
                  name="equipment"
                  placeholder="e.g. Industrial RO System · DSA-RO-1000"
                  value={formData.equipment}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Serial Number */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Serial Number
                </label>
                <input
                  type="text"
                  name="serial_number"
                  placeholder="e.g. RO-PN-2026-0008"
                  value={formData.serial_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Service Type */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Service Type *
                </label>
                <select
                  name="service_type"
                  value={formData.service_type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  <option value="breakdown">Breakdown / Emergency Service</option>
                  <option value="routine_maintenance">General Servicing & Maintenance</option>
                  <option value="filter_replacement">Filter / Membrane Replacement</option>
                  <option value="water_testing">Water Quality Testing</option>
                  <option value="system_audit">System Audit & Inspection</option>
                  <option value="installation_check">Installation & Commissioning</option>
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Priority Level *
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer capitalize"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical / Emergency</option>
                </select>
              </div>

              {/* Scheduled Service Date */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Service Date *
                </label>
                <input
                  type="date"
                  name="service_date"
                  value={formData.service_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer capitalize"
                >
                  <option value="scheduled">Scheduled</option>
                  <option
                    value="in_progress"
                    disabled={!isServiceDue(formData.service_date)}
                    title={!isServiceDue(formData.service_date) ? "Cannot start before scheduled date" : ""}
                  >
                    In Progress {!isServiceDue(formData.service_date) ? "(Locked until service date)" : ""}
                  </option>
                  <option
                    value="completed"
                    disabled={!isServiceDue(formData.service_date) || (service?.status !== "in_progress" && service?.status !== "completed")}
                    title={
                      !isServiceDue(formData.service_date)
                        ? "Cannot complete before scheduled date"
                        : service?.status !== "in_progress" && service?.status !== "completed"
                        ? "Must start service first before marking completed"
                        : ""
                    }
                  >
                    Completed {!isServiceDue(formData.service_date) ? "(Locked until service date)" : service?.status !== "in_progress" && service?.status !== "completed" ? "(Start service first)" : ""}
                  </option>
                  <option value="pending_parts">Pending Parts / Spares</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {!isServiceDue(formData.service_date) && (
                  <p className="text-[10px] text-amber-600">
                    Service scheduled for {formatDisplayDate(formData.service_date)}. Start unlocks when date arrives.
                  </p>
                )}
              </div>

              {/* Assigned Technician(s) - Matching AddLeadForm Executive & Multi-select */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Assigned Technician *
                </label>
                <Select
                  isMulti
                  options={technicianSelectOptions}
                  value={technicianSelectOptions.filter((opt) =>
                    (formData.technicians || []).some((id) => String(id) === String(opt.value))
                  )}
                  onChange={(selected) => {
                    const ids = (selected || []).map((s) => Number(s.value));
                    setFormData((prev) => ({ ...prev, technicians: ids }));
                  }}
                  placeholder="Select Executive / Technician"
                  className="text-sm mt-0.5"
                  isLoading={loadingOptions}
                  noOptionsMessage={() => (loadingOptions ? "Loading staff..." : "No technicians found")}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: "38px",
                      borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
                      borderRadius: "0.5rem",
                      boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
                      "&:hover": { borderColor: "#cbd5e1" },
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "#eff6ff",
                      borderRadius: "0.375rem",
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "#1d4ed8",
                      fontWeight: "600",
                      fontSize: "12px",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "#1d4ed8",
                      ":hover": {
                        backgroundColor: "#dbeafe",
                        color: "#1e40af",
                      },
                    }),
                  }}
                />
              </div>

              {/* Lead Service Engineer / In-Charge */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Lead Engineer / Supervisor
                </label>
                <select
                  name="service_engineer"
                  value={formData.service_engineer}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  <option value="">Select Executive</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.first_name || st.username} {st.last_name || ""} {st.email && `(${st.email})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Charges */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Service / Visiting Charges (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  name="service_cost"
                  value={formData.service_cost}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Contact Person */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Site Contact Person
                </label>
                <input
                  type="text"
                  name="contact_person"
                  placeholder="e.g. Mr. Rajesh Sharma"
                  value={formData.contact_person}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  name="contact_phone"
                  placeholder="e.g. 9822011235"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Completion Date (if status is completed) */}
              {formData.status === "completed" && (
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    name="completion_date"
                    value={formData.completion_date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                  />
                </div>
              )}

              {/* Service Address */}
              <div className="space-y-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    Service / Site Address
                  </label>
                  <button
                    type="button"
                    onClick={() => setLocationModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-800 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{formData.latitude && formData.longitude ? "Change Pin" : "📍 Pin on Map"}</span>
                  </button>
                </div>
                <textarea
                  name="service_address"
                  rows={2}
                  placeholder="Full address where service needs to be performed..."
                  value={formData.service_address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
                {formData.latitude && formData.longitude && (
                  <div className="mt-1 flex items-center justify-between bg-cyan-50/80 border border-cyan-200/80 rounded-lg px-2.5 py-1 text-[11px] text-cyan-900">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <MapPin className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      <span>GPS: {Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-cyan-700 hover:underline flex items-center gap-0.5"
                      >
                        <span>Preview</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, latitude: null, longitude: null, location_url: "" }))}
                        className="text-[10px] text-slate-400 hover:text-rose-600"
                        title="Remove coordinates"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Issues Reported / Scope */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Problem Reported / Scope of Work
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="e.g. Product water flow reduced and high pressure pump cycling intermittently..."
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                />
              </div>

              {/* Diagnosis / Technical Finding */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Diagnosis / Technical Finding
                </label>
                <textarea
                  name="diagnosis"
                  rows={2}
                  placeholder="e.g. Pre-filter saturated; membrane feed pressure below normal operating range..."
                  value={formData.diagnosis}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                />
              </div>

              {/* Work Performed / Resolution Notes */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Work Performed / Resolution Notes
                </label>
                <textarea
                  name="resolution_notes"
                  rows={2}
                  placeholder="Record work performed, replaced parts, test parameters, or completion remarks..."
                  value={formData.resolution_notes || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

            </div>

            {/* Action Buttons Panel (Styled matching AddLeadForm) */}
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
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving..." : service ? "Update Service" : "Add Service"}
              </button>
            </div>

          </form>
        </div>

      </div>

      <LocationPickerModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
        initialAddress={formData.service_address}
        title="Pin Service Site Location"
        onSelectLocation={({ latitude, longitude, address, location_url }) => {
          setFormData((prev) => ({
            ...prev,
            latitude,
            longitude,
            location_url,
            service_address: address || prev.service_address,
          }));
        }}
      />
    </div>
  );
}
