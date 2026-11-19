import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Building,
  Plus,
  Search,
  Filter,
  RefreshCw,
  X
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import TableView from "../TableView";

export default function VendorView({ onRefreshParentCounts, onNavigateTab, baseApi: propBaseApi }) {
  const baseApi = (propBaseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCity, setFilterCity] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    vendor_code: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gst_number: "",
    pan_number: "",
    payment_terms: "30 Days Net",
    bank_details: "",
    is_active: true
  });

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${baseApi}/inventory/vendors/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(Array.isArray(data) ? data : data.results || []);
      }
      if (onRefreshParentCounts) onRefreshParentCounts();
    } catch (err) {
      console.error("Error fetching vendors:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const openAddModal = () => {
    setEditingVendor(null);
    setFormData({
      name: "",
      vendor_code: `VEND-${Date.now().toString().slice(-4)}`,
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      gst_number: "",
      pan_number: "",
      payment_terms: "30 Days Net",
      bank_details: "",
      is_active: true
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name || "",
      vendor_code: vendor.vendor_code || "",
      contact_person: vendor.contact_person || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: vendor.address || "",
      city: vendor.city || "",
      state: vendor.state || "",
      pincode: vendor.pincode || "",
      gst_number: vendor.gst_number || "",
      pan_number: vendor.pan_number || "",
      payment_terms: vendor.payment_terms || "30 Days Net",
      bank_details: vendor.bank_details || "",
      is_active: vendor.is_active !== undefined ? vendor.is_active : true
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("Vendor Company Name is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const token = localStorage.getItem("access");
      const url = editingVendor
        ? `${baseApi}/inventory/vendors/${editingVendor.id}/`
        : `${baseApi}/inventory/vendors/`;
      const method = editingVendor ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchVendors();
      } else {
        const errData = await res.json();
        setErrorMsg(
          errData.detail ||
            errData.vendor_code?.[0] ||
            "Failed to save vendor details."
        );
      }
    } catch (err) {
      console.error("Save vendor error:", err);
      setErrorMsg("Error communicating with server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (vendorId, vendorName) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${vendorName}"?`)) return;
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${baseApi}/inventory/vendors/${vendorId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchVendors();
      } else {
        alert("Failed to delete vendor. They may have linked Purchase Orders or GRNs.");
      }
    } catch (err) {
      console.error("Delete vendor error:", err);
      alert("Error deleting vendor.");
    }
  };

  const cities = useMemo(() => {
    const set = new Set();
    vendors.forEach((v) => {
      if (v.city) set.add(v.city);
    });
    return Array.from(set);
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return vendors.filter((v) => {
      const matchesSearch =
        !q ||
        v.name?.toLowerCase().includes(q) ||
        v.vendor_code?.toLowerCase().includes(q) ||
        v.contact_person?.toLowerCase().includes(q) ||
        v.phone?.includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q) ||
        v.gst_number?.toLowerCase().includes(q);

      const matchesCity = filterCity === "ALL" || v.city === filterCity;
      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" && v.is_active) ||
        (filterStatus === "INACTIVE" && !v.is_active);

      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [vendors, searchQuery, filterCity, filterStatus]);

  const totalPages = Math.ceil(filteredVendors.length / pageSize) || 1;
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVendors.slice(start, start + pageSize);
  }, [filteredVendors, currentPage, pageSize]);

  const getAvatarColor = (name) => {
    const colors = [
      "bg-blue-100 text-blue-700",
      "bg-purple-100 text-purple-700",
      "bg-sky-100 text-sky-700",
      "bg-teal-100 text-teal-700",
      "bg-emerald-100 text-emerald-700",
      "bg-indigo-100 text-indigo-700"
    ];
    if (!name) return colors[0];
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  };

  // Reusable TableView Columns definition (Matching Lead & Quotation row height)
  const columns = useMemo(() => [
    {
      key: "name",
      label: "VENDOR / AGENCY NAME",
      className: "text-left pl-3 whitespace-nowrap",
      headerClassName: "text-left pl-3 whitespace-nowrap",
      render: (vendor) => {
        const initial = (vendor.name || "V").charAt(0).toUpperCase();
        const avatarColor = getAvatarColor(vendor.name);
        return (
          <div className="flex items-center gap-2 whitespace-nowrap truncate max-w-[220px]" title={vendor.name}>
            <div
              className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${avatarColor}`}
            >
              {initial}
            </div>
            <span className="font-semibold text-slate-900 uppercase tracking-wide text-xs truncate">
              {vendor.name}
            </span>
            {vendor.vendor_code && (
              <span className="text-[10px] font-mono text-slate-400">
                [{vendor.vendor_code}]
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "phone",
      label: "MOBILE CONNECTION",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (v) => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{v.phone || "-"}</span>
    },
    {
      key: "email",
      label: "EMAIL ADDRESS",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (v) => <span className="text-xs text-slate-600 whitespace-nowrap">{v.email || "-"}</span>
    },
    {
      key: "gst_number",
      label: "GST TAX REFERENCE",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (v) => (
        v.gst_number ? (
          <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 font-semibold rounded uppercase tracking-wide whitespace-nowrap">
            {v.gst_number}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        )
      )
    }
  ], []);

  const actionsRenderer = useCallback((vendor) => (
    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
      <button
        onClick={() => {
          if (onNavigateTab) onNavigateTab("po");
        }}
        className="px-1.5 py-0.5 rounded border border-sky-300 text-sky-700 bg-sky-50/50 hover:bg-sky-100 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
        title="Create Purchase Order for Vendor"
      >
        + PO
      </button>

      <button
        onClick={() => openEditModal(vendor)}
        className="px-2 py-0.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        title="Edit Vendor"
      >
        Edit
      </button>

      <button
        onClick={() => handleDelete(vendor.id, vendor.name)}
        className="px-2 py-0.5 text-xs font-medium rounded bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
        title="Delete Vendor"
      >
        Delete
      </button>
    </div>
  ), [onNavigateTab]);

  return (
    <div className="space-y-3.5 font-sans antialiased text-slate-800">
      {/* COMPACT HEADER BLOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-0.5 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-8 bg-sky-600 rounded-full block shrink-0" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
              Vendor Directory
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage institutional product suppliers and commercial business profiles.
            </p>
          </div>
        </div>

        {/* COMPACT ACTION BUTTONS */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isFilterOpen || searchQuery || filterCity !== "ALL" || filterStatus !== "ALL"
                ? "bg-sky-50 border-sky-300 text-sky-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-3 sm:px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* COMPACT SUMMARY STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total Registered
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-slate-900 block mt-0.5">
            {vendors.length} vendors
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            All registered suppliers
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Active Suppliers
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-emerald-700 block mt-0.5">
            {vendors.filter((v) => v.is_active).length} active
          </span>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            Ready for purchase orders
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            GST Registered
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-sky-700 block mt-0.5">
            {vendors.filter((v) => Boolean(v.gst_number)).length} verified
          </span>
          <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
            Tax invoice enabled
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Coverage
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-purple-700 block mt-0.5">
            {cities.length} cities
          </span>
          <span className="text-[10px] text-purple-600 font-medium block mt-0.5">
            Regional distribution
          </span>
        </div>
      </div>

      {/* FILTER BAR */}
      {isFilterOpen && (
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 animate-fade-in">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor by name, phone, email, GST, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cities.length > 0 && (
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="ALL">All Cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            <button
              onClick={() => {
                setSearchQuery("");
                setFilterCity("ALL");
                setFilterStatus("ALL");
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* REUSED TABLE VIEW (MATCHING LEAD / CUSTOMER PAGES) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <TableView
          columns={columns}
          rows={paginatedVendors}
          loading={isLoading}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          actions={actionsRenderer}
          emptyMessage="No vendors found. Click '+ Add Vendor' to register your first supplier."
        />
      </div>

      {/* ADD / EDIT VENDOR MODAL (SPACIOUS FULL SIZE MATCHING CUSTOMER FORM) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-3xl w-full mx-auto my-6 relative max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Building size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingVendor ? "Edit Vendor Profile" : "Register Institutional Vendor"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingVendor ? `Code: ${editingVendor.vendor_code || 'N/A'}` : "Create new supplier / vendor profile"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 overflow-y-auto flex-1 text-slate-800 scrollbar-thin">
              <form onSubmit={handleSubmit} className="space-y-5 text-sm">
                {errorMsg && (
                  <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Vendor / Agency Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. SHIVANI PRINTER"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Vendor Code
                    </label>
                    <input
                      type="text"
                      value={formData.vendor_code}
                      onChange={(e) => setFormData({ ...formData, vendor_code: e.target.value })}
                      placeholder="VEND-001"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Mobile Connection
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="4455661122"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vendor@gmail.com"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Address / Warehouse Location
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street / Industrial address"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Pune"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      GST Tax Reference
                    </label>
                    <input
                      type="text"
                      value={formData.gst_number}
                      onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                      placeholder="27ADGET345SGG"
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white uppercase"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isSubmitting ? "Saving..." : editingVendor ? "Update Profile" : "Save Vendor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
