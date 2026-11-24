import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { State, City } from "country-state-city";
import { RxCross2 } from "react-icons/rx";
import { getValidAccessToken } from "../../utils/authUtils";

const PARKING_SITE_TYPES = [
  "Two-Post Hydraulic Stack Parking",
  "Automated Tower Parking (Elevator Type)",
  "Multi-Level Puzzle Parking",
  "Pit-Type Cantilever Stack Parking",
  "Vertical Rotary Carousel Parking",
  "Commercial Basement Parking",
  "Residential Multi-Tier Parking",
  "Surface / Multi-Level Car Park",
  "Other / Custom Facility",
];

const SITE_STATUSES = ["Active", "Under Installation", "Under Maintenance", "Inactive"];

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    height: "38px",
    fontSize: "0.875rem",
    borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
    borderRadius: "0.5rem",
    backgroundColor: state.isDisabled ? "#f8fafc" : "#ffffff",
    "&:hover": {
      borderColor: state.isFocused ? "#3b82f6" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 10px",
    height: "38px",
  }),
  input: (base) => ({
    ...base,
    margin: "0px",
    padding: "0px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "38px",
  }),
  menu: (base) => ({
    ...base,
    fontSize: "0.875rem",
    borderRadius: "0.5rem",
    zIndex: 9999,
  }),
};

const creatableMultiSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    fontSize: "0.875rem",
    borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
    borderRadius: "0.5rem",
    backgroundColor: state.isDisabled ? "#f8fafc" : "#ffffff",
    "&:hover": {
      borderColor: state.isFocused ? "#3b82f6" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 8px",
  }),
  input: (base) => ({
    ...base,
    margin: "0px",
    padding: "0px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
  }),
  menu: (base) => ({
    ...base,
    fontSize: "0.875rem",
    borderRadius: "0.5rem",
    zIndex: 9999,
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#eff6ff",
    borderRadius: "4px",
    border: "1px solid #bfdbfe",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "500",
    padding: "1px 6px",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#1d4ed8",
    cursor: "pointer",
    ":hover": {
      backgroundColor: "#dbeafe",
      color: "#1e40af",
    },
  }),
};

export default function AddSiteModal({
  open,
  onClose,
  customer,
  initialData = null,
  baseApi,
  onSuccess,
  productList = [],
}) {
  const BASE_API = (baseApi || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const isEditing = Boolean(initialData && initialData.id);

  // Available products state (from props or fetched directly)
  const [availableProducts, setAvailableProducts] = useState(productList || []);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (Array.isArray(productList) && productList.length > 0) {
      setAvailableProducts(productList);
    } else if (open) {
      setLoadingProducts(true);
      const token = getValidAccessToken();
      fetch(`${BASE_API}/product/products/?limit=1000`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const items = Array.isArray(data) ? data : data.results || [];
          setAvailableProducts(items);
        })
        .catch((err) => {
          console.error("Failed to load products in AddSiteModal:", err);
        })
        .finally(() => setLoadingProducts(false));
    }
  }, [open, productList, BASE_API]);

  const productSelectOptions = useMemo(() => {
    return (availableProducts || [])
      .filter((p) => p && p.is_service !== true)
      .map((p) => ({
        value: p.name || String(p.id),
        label: p.name,
      }));
  }, [availableProducts]);

  // States & Cities from country-state-city (India)
  const states = useMemo(() => {
    return State.getStatesOfCountry("IN").map((s) => ({
      value: s.name,
      label: s.name,
      isoCode: s.isoCode,
    }));
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    site_type: "Two-Post Hydraulic Stack Parking",
    capacity_cars: "",
    amount: "",
    products: [],
    address: "",
    state: "",
    city: "",
    pincode: "",
    owner_name: "",
    owner_contact: "",
    status: "Active",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Dependent Cities list based on selected State
  const cities = useMemo(() => {
    if (!formData.state) return [];
    const selectedStateObj = states.find((s) => s.value === formData.state);
    if (!selectedStateObj) return [];
    return City.getCitiesOfState("IN", selectedStateObj.isoCode).map((c) => ({
      value: c.name,
      label: c.name,
    }));
  }, [formData.state, states]);

  // Pre-fill form when modal opens or customer / initialData changes
  useEffect(() => {
    if (open) {
      setErrorMsg("");
      if (initialData) {
        let initialProducts = [];
        if (Array.isArray(initialData.products)) {
          initialProducts = initialData.products
            .map((p) => (typeof p === "object" && p !== null ? p.name || p.product || "" : String(p || "")))
            .filter(Boolean);
        }
        setFormData({
          name: initialData.name || "",
          site_type: initialData.site_type || "Two-Post Hydraulic Stack Parking",
          capacity_cars:
            initialData.capacity_cars !== undefined && initialData.capacity_cars !== null
              ? initialData.capacity_cars
              : "",
          amount:
            initialData.amount !== undefined && initialData.amount !== null
              ? initialData.amount
              : "",
          products: initialProducts,
          address: initialData.address || "",
          state: initialData.state || customer?.state || "",
          city: initialData.city || customer?.city || "",
          pincode: initialData.pincode || "",
          owner_name: initialData.owner_name || customer?.contact_person || "",
          owner_contact: initialData.owner_contact || customer?.contact_number || "",
          status: initialData.status || "Active",
        });
      } else {
        setFormData({
          name: "",
          site_type: "Two-Post Hydraulic Stack Parking",
          capacity_cars: "",
          amount: "",
          products: [],
          address: customer?.billing_address || "",
          state: customer?.state || "",
          city: customer?.city || "",
          pincode: customer?.pin_code || "",
          owner_name: customer?.contact_person || "",
          owner_contact: customer?.contact_number || "",
          status: "Active",
        });
      }
    }
  }, [open, customer, initialData]);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("Please enter the Site / Facility Name.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    const token = getValidAccessToken();
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const payload = {
      name: formData.name.trim(),
      customer: customer?.id || null,
      lead: customer?.lead || customer?.lead_id || customer?.lead_details?.id || initialData?.lead || null,
      site_type: formData.site_type,
      capacity_cars: formData.capacity_cars !== "" ? parseInt(formData.capacity_cars, 10) : 0,
      amount: formData.amount !== "" ? parseFloat(formData.amount) : 0.0,
      products: Array.isArray(formData.products) ? formData.products : [],
      address: formData.address.trim(),
      state: formData.state.trim(),
      city: formData.city.trim(),
      pincode: formData.pincode !== "" ? parseInt(formData.pincode, 10) : null,
      owner_name: formData.owner_name.trim(),
      owner_contact: formData.owner_contact.trim(),
      status: formData.status,
    };

    try {
      const url = isEditing
        ? `${BASE_API}/api/site/${initialData.id}/`
        : `${BASE_API}/api/site/`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail =
          typeof errData === "object"
            ? Object.entries(errData)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join("\n")
            : "Failed to save site.";
        throw new Error(detail);
      }

      const savedSite = await res.json();

      Swal.fire({
        icon: "success",
        title: isEditing ? "Site Updated" : "Site Added",
        text: `Site "${savedSite.name}" ${isEditing ? "updated" : "created"} successfully!`,
        timer: 1800,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess(savedSite);
      if (onClose) onClose();
    } catch (err) {
      console.error("Save site error:", err);
      setErrorMsg(err.message || "An error occurred while saving the site.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-2xl w-full mx-auto my-auto sm:my-8 relative max-h-[96vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Bar matching AddLeadForm */}
        <div className="bg-white px-4 sm:px-6 py-3.5 sm:py-4 flex justify-between items-start border-b border-slate-100 gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {isEditing ? "Edit Site / Facility" : "Add New Site / Facility"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Customer: <span className="text-slate-800 font-semibold">{customer?.name || "Customer"}</span>
              {customer?.customer_code ? ` (${customer.customer_code})` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer shrink-0"
          >
            <RxCross2 size={18} />
          </button>
        </div>

        {/* Form Body matching AddLeadForm styling */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 scrollbar-thin">
          <form className="space-y-4 text-slate-800" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Site Name */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Site / Facility Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Phoenix IT Park - Tower Parking Zone"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Products / Systems Installed at this Site */}
              <div className="space-y-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    Products / Systems Installed at this Site
                  </label>
                  {loadingProducts && (
                    <span className="text-[10px] text-blue-500 font-medium animate-pulse">Loading products...</span>
                  )}
                </div>
                <CreatableSelect
                  isMulti
                  options={productSelectOptions}
                  value={(formData.products || []).map((p) => {
                    const match = productSelectOptions.find(
                      (opt) => opt.value === p || opt.label === p
                    );
                    return match || { value: p, label: p };
                  })}
                  onChange={(selected) => {
                    const values = selected ? selected.map((s) => s.value || s.label) : [];
                    setFormData((prev) => ({ ...prev, products: values }));
                  }}
                  placeholder="Select or type parking products installed at this site..."
                  styles={creatableMultiSelectStyles}
                  isLoading={loadingProducts}
                  noOptionsMessage={() => "No products found"}
                />
                <p className="text-[10px] text-slate-400">
                  Select existing product models or type custom systems and press Enter.
                </p>
              </div>

              {/* Parking System / Site Type */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Parking System / Site Type
                </label>
                <select
                  name="site_type"
                  value={formData.site_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                >
                  {PARKING_SITE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Car Capacity */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Car / Vehicle Capacity
                </label>
                <input
                  type="number"
                  name="capacity_cars"
                  value={formData.capacity_cars}
                  onChange={handleChange}
                  placeholder="e.g. 50"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Site Amount / Value */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Site Amount / Value (₹)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="e.g. 1500000"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* STATE (Searchable Dropdown matching Lead Form) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  State
                </label>
                <Select
                  options={states}
                  value={
                    states.find((s) => s.value.toLowerCase() === (formData.state || "").toLowerCase()) ||
                    (formData.state ? { value: formData.state, label: formData.state } : null)
                  }
                  onChange={(selected) => {
                    setFormData((prev) => ({
                      ...prev,
                      state: selected ? selected.value : "",
                      city: "", // Clear city when state changes
                    }));
                  }}
                  placeholder="Search and select State..."
                  isClearable
                  className="text-sm"
                  styles={customSelectStyles}
                />
              </div>

              {/* CITY (Searchable Dropdown matching Lead Form) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  City
                </label>
                <Select
                  options={cities}
                  value={
                    cities.find((c) => c.value.toLowerCase() === (formData.city || "").toLowerCase()) ||
                    (formData.city ? { value: formData.city, label: formData.city } : null)
                  }
                  onChange={(selected) => {
                    setFormData((prev) => ({
                      ...prev,
                      city: selected ? selected.value : "",
                    }));
                  }}
                  isDisabled={!formData.state}
                  placeholder={!formData.state ? "Select State First" : "Search and select City..."}
                  isClearable
                  className="text-sm"
                  styles={customSelectStyles}
                />
              </div>

              {/* Pincode */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Pincode
                </label>
                <input
                  type="number"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="e.g. 411014"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Site Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                >
                  {SITE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Site Address */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Physical / Installation Address
                </label>
                <textarea
                  name="address"
                  rows="2"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Full physical installation or parking facility address..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white resize-none"
                />
              </div>

              {/* Site In-Charge / Supervisor Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Site In-Charge / Supervisor
                </label>
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Contact Phone / Mobile
                </label>
                <input
                  type="text"
                  name="owner_contact"
                  value={formData.owner_contact}
                  onChange={handleChange}
                  placeholder="e.g. +91 98200 12345"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Modal Footer Buttons matching AddLeadForm */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-1.5 text-center"
              >
                {submitting ? "Saving..." : isEditing ? "Update Site" : "Save Site"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
