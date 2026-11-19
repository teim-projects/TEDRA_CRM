import { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import { RxCross2 } from "react-icons/rx";
import { MdAutorenew } from "react-icons/md";
import { useUserRole } from "../../hooks/useAuth";

const paymentFrequencyOptions = [
  { id: "annual", name: "Annual" },
  { id: "quarterly", name: "Quarterly" },
  { id: "monthly", name: "Monthly" },
  { id: "half_yearly", name: "Half-Yearly" },
];

const serviceFrequencyOptions = [
  { id: "quarterly", name: "Quarterly (4 visits/year)", defaultVisits: 4 },
  { id: "monthly", name: "Monthly (12 visits/year)", defaultVisits: 12 },
  { id: "bi_monthly", name: "Bi-Monthly (6 visits/year)", defaultVisits: 6 },
  { id: "half_yearly", name: "Half-Yearly (2 visits/year)", defaultVisits: 2 },
  { id: "annual", name: "Annual (1 visit/year)", defaultVisits: 1 },
  { id: "as_needed", name: "As Needed / Breakdown Only", defaultVisits: 0 },
  { id: "custom", name: "Custom / As Agreed", defaultVisits: null },
];

export default function RenewAMCModal({
  open,
  onClose,
  onSuccess,
  amcContract,
  token,
  baseUrl,
}) {
  const BASE_API = baseUrl || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000";
  const { userInfo } = useUserRole(BASE_API);
  const isAdmin =
    userInfo?.is_superuser ||
    ["admin", "sub-admin", "subadmin"].includes(userInfo?.role?.name?.toLowerCase());

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

  const [formData, setFormData] = useState({
    new_start_date: "",
    new_end_date: "",
    new_annual_value: "0",
    payment_frequency: "quarterly",
    service_frequency: "quarterly",
    no_of_visits: 4,
    site_address: "",
    support_coordinator: "",
    remarks: "",
  });

  const [staffOptions, setStaffOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch staff list for Support Coordinator selection
  useEffect(() => {
    if (!open) return;
    const STAFF_API_URL = `${BASE_API.replace(/\/$/, "")}/auth/staff/all/`;
    fetch(STAFF_API_URL, {
      headers: {
        "Content-Type": "application/json",
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
      },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setStaffOptions(list);
      })
      .catch(() => setStaffOptions([]));
  }, [open, effectiveToken, BASE_API]);

  // Pre-calculate renewal terms
  useEffect(() => {
    if (open && amcContract) {
      let defaultStart = "";
      let defaultEnd = "";

      if (amcContract.end_date) {
        const endDateObj = new Date(amcContract.end_date);
        if (!isNaN(endDateObj.getTime())) {
          // 1 day after current end_date
          const nextDay = new Date(endDateObj);
          nextDay.setDate(nextDay.getDate() + 1);
          defaultStart = nextDay.toISOString().split("T")[0];

          // 1 year after new_start_date minus 1 day
          const nextYear = new Date(nextDay);
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          nextYear.setDate(nextYear.getDate() - 1);
          defaultEnd = nextYear.toISOString().split("T")[0];
        }
      }

      const coordId =
        amcContract.support_coordinator ||
        amcContract.support_coordinator_details?.id ||
        (!isAdmin && userInfo?.id ? userInfo.id : "");

      setFormData({
        new_start_date: defaultStart,
        new_end_date: defaultEnd,
        new_annual_value: amcContract.annual_value ? String(amcContract.annual_value) : "0",
        payment_frequency: amcContract.payment_frequency || "quarterly",
        service_frequency: amcContract.service_frequency || "quarterly",
        no_of_visits:
          amcContract.no_of_visits !== undefined && amcContract.no_of_visits !== null
            ? amcContract.no_of_visits
            : 4,
        site_address: amcContract.site_address || "",
        support_coordinator: coordId,
        remarks: "",
      });
    }
  }, [open, amcContract, isAdmin, userInfo]);

  if (!open || !amcContract) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleServiceFrequencyChange = (e) => {
    const val = e.target.value;
    const opt = serviceFrequencyOptions.find((o) => o.id === val);
    setFormData((prev) => ({
      ...prev,
      service_frequency: val,
      no_of_visits:
        opt?.defaultVisits !== null && opt?.defaultVisits !== undefined
          ? opt.defaultVisits
          : prev.no_of_visits,
    }));
  };

  const customerName =
    amcContract.customer_details?.company_name ||
    amcContract.customer_details?.name ||
    amcContract.customer ||
    "Customer Account";

  const customerCode =
    amcContract.customer_details?.customer_code ||
    (amcContract.customer_details?.id ? `#${amcContract.customer_details.id}` : "");

  const productName = amcContract.product || "Water Treatment System";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.new_start_date || !formData.new_end_date) {
      Swal.fire("Required", "Please select New Start Date and New End Date.", "warning");
      return;
    }

    setLoading(true);
    try {
      const url = `${BASE_API.replace(/\/$/, "")}/lead/amc/contracts/${amcContract.id}/renew/`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        },
        body: JSON.stringify({
          new_start_date: formData.new_start_date,
          new_end_date: formData.new_end_date,
          new_annual_value: parseFloat(formData.new_annual_value || 0),
          payment_frequency: formData.payment_frequency,
          service_frequency: formData.service_frequency || "quarterly",
          no_of_visits:
            formData.no_of_visits !== "" && formData.no_of_visits !== null
              ? parseInt(formData.no_of_visits, 10)
              : 4,
          site_address: formData.site_address || "",
          support_coordinator: formData.support_coordinator || null,
          remarks: formData.remarks,
        }),
      });

      if (!res.ok) {
        const errTxt = await res.text().catch(() => "");
        throw new Error(`Failed to renew AMC contract: ${errTxt}`);
      }

      // Dispatch custom notification for real-time notification drawer update
      const customNotif = {
        id: `custom_amc_renew_${amcContract.id}_${Date.now()}`,
        title: "AMC Contract Renewed",
        description: `AMC contract ${amcContract.contract_id || `#${amcContract.id}`} renewed for period ${formData.new_start_date} to ${formData.new_end_date}.`,
        type: "amc",
        amcId: amcContract.id,
        targetUrl: `/amc?amcId=${amcContract.id}`,
        time: "Just now",
        timestamp: Date.now(),
        read: false,
        priority: "high",
        badge: "AMC Renewed",
      };

      const existingNotifs = JSON.parse(localStorage.getItem("crm_custom_notifs") || "[]");
      localStorage.setItem("crm_custom_notifs", JSON.stringify([customNotif, ...existingNotifs]));
      window.dispatchEvent(new Event("crm_notification_updated"));

      Swal.fire({
        icon: "success",
        title: "AMC Renewed Successfully!",
        text: `Contract ${amcContract.contract_id || `#${amcContract.id}`} has been renewed.`,
        timer: 1500,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Renew AMC Error:", err);
      Swal.fire("Error", err.message || "Failed to renew AMC contract", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-2xl w-full mx-auto my-8 relative max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header Bar (Matching AddLeadForm) */}
        <div className="bg-white px-6 pt-6 pb-2 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Renew AMC Contract
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {amcContract.contract_id || `#${amcContract.id}`} — {customerName}
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

        {/* Form Main Body */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          <form className="space-y-4 text-slate-800" onSubmit={handleSubmit}>
            
            {/* Current Contract Overview Summary */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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
                  Product
                </span>
                <span className="font-semibold text-slate-800 truncate block mt-0.5" title={productName}>
                  {productName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Current Cycle
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {amcContract.start_date || "-"} to {amcContract.end_date || "-"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Current Value
                </span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  ₹{parseFloat(amcContract.annual_value || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Contract ID */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Contract ID
                </label>
                <input
                  type="text"
                  value={amcContract.contract_id || `#${amcContract.id}`}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-medium h-[38px] cursor-not-allowed"
                />
              </div>

              {/* Customer */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Customer
                </label>
                <input
                  type="text"
                  value={`${customerName}${customerCode ? ` (${customerCode})` : ""}`}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-medium h-[38px] cursor-not-allowed"
                />
              </div>

              {/* New Start Date */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  New Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="new_start_date"
                  value={formData.new_start_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* New End Date */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  New End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="new_end_date"
                  value={formData.new_end_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* New Annual Value */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  New Annual Value (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  name="new_annual_value"
                  value={formData.new_annual_value}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Payment Frequency */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Payment Frequency
                </label>
                <select
                  name="payment_frequency"
                  value={formData.payment_frequency}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  {paymentFrequencyOptions.map((pf) => (
                    <option key={pf.id} value={pf.id}>
                      {pf.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Site Maintenance & Routine Visits Block */}
              <div className="space-y-2 md:col-span-2 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Site Maintenance & Routine Visits
                  </span>
                  <span className="text-[11px] text-blue-600 font-medium">Renewal cycle visit plan</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Visit Frequency <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="service_frequency"
                      value={formData.service_frequency}
                      onChange={handleServiceFrequencyChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                    >
                      {serviceFrequencyOptions.map((sf) => (
                        <option key={sf.id} value={sf.id}>
                          {sf.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <span>
                        No. of Visits for this Site <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Renewal cycle total</span>
                    </label>
                    <input
                      type="number"
                      name="no_of_visits"
                      value={formData.no_of_visits}
                      onChange={handleChange}
                      min="0"
                      step="1"
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                    />
                  </div>
                </div>
              </div>

              {/* Support Coordinator (Matching Assigned Executive from AddLeadForm) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Support Coordinator
                  {!isAdmin && (
                    <span className="text-[11px] text-blue-600 font-normal ml-1.5">
                      (Auto-mapped to your logged-in account)
                    </span>
                  )}
                </label>
                <select
                  name="support_coordinator"
                  value={formData.support_coordinator}
                  onChange={handleChange}
                  disabled={!isAdmin && Boolean(formData.support_coordinator)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="">Select Executive</option>
                  {staffOptions.map((s) => {
                    const name =
                      s.name || `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.username;
                    const email = s.email ? `(${s.email})` : "";
                    return (
                      <option key={s.id} value={s.id}>
                        {name} {email}
                      </option>
                    );
                  })}
                  {!isAdmin &&
                    userInfo?.id &&
                    !staffOptions.some((s) => String(s.id) === String(userInfo.id)) && (
                      <option value={userInfo.id}>
                        {userInfo.full_name || userInfo.first_name || userInfo.email || "My Account"}
                      </option>
                    )}
                </select>
              </div>

              {/* Site Address / Location */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Site Address / Location
                </label>
                <input
                  type="text"
                  name="site_address"
                  value={formData.site_address}
                  onChange={handleChange}
                  placeholder="Site address for routine visits..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Renewal Remarks / Notes */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Renewal Remarks / Notes
                </label>
                <textarea
                  name="remarks"
                  rows={3}
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="e.g. 10% annual price adjustment applied, customer approved renewal via email."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                />
              </div>

            </div>

            {/* Action Buttons Panel (Matching AddLeadForm) */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <MdAutorenew className={loading ? "animate-spin text-sm" : "text-sm"} />
                {loading ? "Renewing..." : "Confirm Renewal"}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
