import { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import CreatableSelect from "react-select/creatable";
import { RxCross2 } from "react-icons/rx";
import { MapPin, ExternalLink } from "lucide-react";
import { useUserRole } from "../../hooks/useAuth";
import LocationPickerModal from "../common/LocationPickerModal";

export default function AddAMCContractForm({
  open,
  onClose,
  onSuccess,
  amcContract = null,
  initialProject = null,
  initialCustomer = null,
}) {
  const BASE_API = import.meta.env.VITE_BASE_API_URL ?? "http://127.0.0.1:8000";
  const { userInfo } = useUserRole(BASE_API);
  const isAdmin =
    userInfo?.is_superuser ||
    ["admin", "sub-admin", "subadmin"].includes(userInfo?.role?.name?.toLowerCase());

  const token = useMemo(
    () =>
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    []
  );

  const API_URL = `${BASE_API.replace(/\/$/, "")}/lead/amc/contracts/`;
  const CUSTOMER_API_URL = `${BASE_API.replace(/\/$/, "")}/lead/customer/`;
  const SITE_API_URL = `${BASE_API.replace(/\/$/, "")}/api/site/`;
  const PRODUCT_API_URL = `${BASE_API.replace(/\/$/, "")}/product/products/`;
  const STAFF_API_URL = `${BASE_API.replace(/\/$/, "")}/auth/staff/all/`;

  const amcTypeOptions = [
    { id: "comprehensive", name: "Comprehensive" },
    { id: "non_comprehensive", name: "Non-Comprehensive" },
  ];

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

  const [formData, setFormData] = useState({
    contract_id: "",
    customer: "",
    site: "",
    product: "",
    amc_type: "comprehensive",
    start_date: "",
    end_date: "",
    annual_value: "0",
    payment_frequency: "quarterly",
    service_frequency: "quarterly",
    no_of_visits: 4,
    site_address: "",
    latitude: null,
    longitude: null,
    location_url: "",
    support_coordinator: "",
    scope_of_support: "",
  });

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSites, setCustomerSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [products, setProducts] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch dropdown data
  useEffect(() => {
    if (!open) return;

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    fetch(`${CUSTOMER_API_URL}?limit=1000`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setCustomers(list);
      })
      .catch(() => setCustomers([]));

    fetch(`${PRODUCT_API_URL}?limit=1000`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setProducts(list);
      })
      .catch(() => setProducts([]));

    fetch(STAFF_API_URL, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setStaffOptions(list);
      })
      .catch(() => setStaffOptions([]));
  }, [open, token, CUSTOMER_API_URL, PRODUCT_API_URL, STAFF_API_URL]);

  // Fetch sites for the selected customer
  useEffect(() => {
    if (!open || !formData.customer) {
      setCustomerSites([]);
      return;
    }

    const custId =
      typeof formData.customer === "object"
        ? formData.customer?.id
        : formData.customer;

    if (!custId) {
      setCustomerSites([]);
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    setLoadingSites(true);
    fetch(`${SITE_API_URL}?customer=${custId}&limit=1000`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setCustomerSites(list);

        // If a site is selected (e.g. from initialProject), sync its physical address!
        if (formData.site && list.length > 0) {
          const matchedSite = list.find((s) => String(s.id) === String(formData.site));
          if (matchedSite) {
            const fullSiteAddr = [
              matchedSite.address,
              matchedSite.city,
              matchedSite.state,
              matchedSite.pincode,
            ]
              .filter(Boolean)
              .join(", ");
            if (fullSiteAddr) {
              setFormData((prev) => {
                const needsPhysicalAddr =
                  !prev.site_address ||
                  (matchedSite.address && !prev.site_address.includes(matchedSite.address));
                return needsPhysicalAddr
                  ? {
                      ...prev,
                      site_address: fullSiteAddr,
                      latitude: matchedSite.latitude || prev.latitude,
                      longitude: matchedSite.longitude || prev.longitude,
                      location_url: matchedSite.location_url || prev.location_url,
                    }
                  : prev;
              });
            }
          }
        }
      })
      .catch(() => setCustomerSites([]))
      .finally(() => setLoadingSites(false));
  }, [open, formData.customer, formData.site, SITE_API_URL, token]);

  // Set initial form data
  useEffect(() => {
    if (!open) return;

    if (amcContract) {
      const siteIdVal = amcContract.site
        ? String(typeof amcContract.site === "object" ? amcContract.site.id : amcContract.site)
        : "";
      setFormData({
        contract_id: amcContract.contract_id || "",
        customer: amcContract.customer || amcContract.customer_details?.id || "",
        site: siteIdVal,
        product: amcContract.product || "",
        amc_type: amcContract.amc_type || "comprehensive",
        start_date: amcContract.start_date || "",
        end_date: amcContract.end_date || "",
        annual_value: amcContract.annual_value ? String(amcContract.annual_value) : "0",
        payment_frequency: amcContract.payment_frequency || "quarterly",
        service_frequency: amcContract.service_frequency || "quarterly",
        no_of_visits:
          amcContract.no_of_visits !== undefined && amcContract.no_of_visits !== null
            ? amcContract.no_of_visits
            : 4,
        site_address: amcContract.site_address || "",
        latitude: amcContract.latitude || null,
        longitude: amcContract.longitude || null,
        location_url: amcContract.location_url || "",
        support_coordinator:
          amcContract.support_coordinator || amcContract.support_coordinator_details?.id || "",
        scope_of_support: amcContract.scope_of_support || "",
      });
    } else if (initialProject) {
      let prodName = Array.isArray(initialProject.product)
        ? initialProject.product[0] || ""
        : typeof initialProject.product === "string"
        ? initialProject.product
        : "";
      prodName = String(prodName || "").trim();
      if (/^\d+$/.test(prodName) && products.length > 0) {
        const foundP = products.find((p) => String(p.id) === prodName);
        if (foundP) prodName = foundP.name || foundP.product_name || "";
        else prodName = "";
      } else if (/^\d+$/.test(prodName) || prodName.toLowerCase() === "product") {
        prodName = "";
      }

      const projSiteVal = initialProject.site
        ? String(typeof initialProject.site === "object" ? initialProject.site.id : initialProject.site)
        : "";

      // Resolve site physical installation address first, followed by city and state
      const siteDetails =
        initialProject.site_details ||
        (typeof initialProject.site === "object" ? initialProject.site : null);

      let initialAddr = "";
      if (siteDetails) {
        initialAddr = [
          siteDetails.address,
          siteDetails.city,
          siteDetails.state,
          siteDetails.pincode,
        ]
          .filter(Boolean)
          .join(", ");
      }

      if (!initialAddr && projSiteVal && customerSites.length > 0) {
        const foundSite = customerSites.find((s) => String(s.id) === String(projSiteVal));
        if (foundSite) {
          initialAddr = [
            foundSite.address,
            foundSite.city,
            foundSite.state,
            foundSite.pincode,
          ]
            .filter(Boolean)
            .join(", ");
        }
      }

      if (!initialAddr) {
        initialAddr = [
          initialProject.customer_details?.billing_address ||
            initialProject.customer_details?.address,
          initialProject.customer_details?.city,
          initialProject.customer_details?.state,
          initialProject.customer_details?.pin_code ||
            initialProject.customer_details?.pincode,
        ]
          .filter(Boolean)
          .join(", ");
      }

      setFormData({
        contract_id: "Auto Generated",
        customer: initialProject.customer || initialProject.customer_details?.id || "",
        site: projSiteVal,
        product: prodName,
        amc_type: "comprehensive",
        start_date: initialProject.amc_start_date || initialProject.start_date || "",
        end_date: initialProject.amc_end_date || "",
        annual_value: initialProject.project_value ? String(initialProject.project_value) : "0",
        payment_frequency: "quarterly",
        service_frequency: "quarterly",
        no_of_visits: 4,
        site_address: initialAddr || "",
        support_coordinator:
          initialProject.project_executive ||
          initialProject.project_executive_details?.id ||
          "",
        scope_of_support: initialProject.project_scope_requirements || "",
      });
    } else if (initialCustomer) {
      let firstProd = Array.isArray(initialCustomer.product_purchased)
        ? typeof initialCustomer.product_purchased[0] === "object"
          ? initialCustomer.product_purchased[0]?.product
          : initialCustomer.product_purchased[0]
        : "";
      firstProd = String(firstProd || "").trim();
      if (/^\d+$/.test(firstProd) && products.length > 0) {
        const foundP = products.find((p) => String(p.id) === firstProd);
        if (foundP) firstProd = foundP.name || foundP.product_name || "";
        else firstProd = "";
      } else if (/^\d+$/.test(firstProd) || firstProd.toLowerCase() === "product") {
        firstProd = "";
      }

      setFormData({
        contract_id: "Auto Generated",
        customer: initialCustomer.id || "",
        site: "",
        product: firstProd || "",
        amc_type: "comprehensive",
        start_date: initialCustomer.amc_start_date || "",
        end_date: initialCustomer.amc_end_date || "",
        annual_value: initialCustomer.project_value ? String(initialCustomer.project_value) : "0",
        payment_frequency: "quarterly",
        service_frequency: "quarterly",
        no_of_visits: 4,
        site_address:
          [
            initialCustomer.billing_address || initialCustomer.address,
            initialCustomer.city,
            initialCustomer.state,
            initialCustomer.pin_code || initialCustomer.pincode,
          ]
            .filter(Boolean)
            .join(", ") || "",
        support_coordinator:
          initialCustomer.sales_executive ||
          initialCustomer.sales_executive_details?.id ||
          (!isAdmin && userInfo?.id ? userInfo.id : ""),
        scope_of_support: "",
      });
    } else {
      setFormData({
        contract_id: "Auto Generated",
        customer: "",
        site: "",
        product: "",
        amc_type: "comprehensive",
        start_date: "",
        end_date: "",
        annual_value: "0",
        payment_frequency: "quarterly",
        service_frequency: "quarterly",
        no_of_visits: 4,
        site_address: "",
        support_coordinator: !isAdmin && userInfo?.id ? userInfo.id : "",
        scope_of_support: "",
      });
    }
  }, [open, amcContract, initialProject, initialCustomer, isAdmin, userInfo, products]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "customer" && value) {
      const foundCust = customers.find((c) => String(c.id) === String(value));
      if (foundCust) {
        setFormData((prev) => ({
          ...prev,
          customer: value,
          site: "",
          support_coordinator:
            prev.support_coordinator ||
            foundCust.sales_executive ||
            foundCust.sales_executive_details?.id ||
            "",
          annual_value:
            prev.annual_value !== "0"
              ? prev.annual_value
              : foundCust.project_value
              ? String(foundCust.project_value)
              : "0",
          start_date: prev.start_date || foundCust.amc_start_date || "",
          end_date: prev.end_date || foundCust.amc_end_date || "",
          site_address:
            prev.site_address ||
            [
              foundCust.billing_address || foundCust.address,
              foundCust.city,
              foundCust.state,
              foundCust.pin_code || foundCust.pincode,
            ]
              .filter(Boolean)
              .join(", ") ||
            "",
        }));
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSiteChange = (e) => {
    const sId = e.target.value;
    const chosenSite = customerSites.find((s) => String(s.id) === String(sId));
    if (chosenSite) {
      const fullSiteAddr = [chosenSite.address, chosenSite.city, chosenSite.state, chosenSite.pincode]
        .filter(Boolean)
        .join(", ");
      setFormData((prev) => ({
        ...prev,
        site: sId,
        site_address: fullSiteAddr || prev.site_address,
        latitude: chosenSite.latitude || prev.latitude,
        longitude: chosenSite.longitude || prev.longitude,
        location_url: chosenSite.location_url || prev.location_url,
        annual_value:
          chosenSite.amount && prev.annual_value === "0"
            ? String(chosenSite.amount)
            : prev.annual_value,
        scope_of_support:
          prev.scope_of_support ||
          `Routine preventive maintenance and inspection for site: ${chosenSite.name}${
            chosenSite.site_shortcut ? ` (${chosenSite.site_shortcut})` : ""
          }. Parking System: ${chosenSite.site_type || "N/A"}. Supervisor: ${
            chosenSite.owner_name || "N/A"
          } (${chosenSite.owner_contact || "N/A"}).`,
      }));

      if (
        Array.isArray(chosenSite.products) &&
        chosenSite.products.length > 0 &&
        !formData.product
      ) {
        const firstP = chosenSite.products[0];
        const resolvedName =
          typeof firstP === "object" && firstP !== null
            ? firstP.name || firstP.product
            : String(firstP);
        setFormData((prev) => ({ ...prev, product: resolvedName }));
      }
    } else {
      setFormData((prev) => ({ ...prev, site: sId }));
    }
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

  const productSelectOptions = useMemo(
    () =>
      products
        .map((p) => ({
          value: p.name || p.product_name || "",
          id: p.id,
          label: p.name || p.product_name || "",
        }))
        .filter((opt) => opt.value),
    [products]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer) {
      Swal.fire("Required", "Please select a Customer.", "warning");
      return;
    }

    if (!formData.product) {
      Swal.fire("Required", "Please specify a Product.", "warning");
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      Swal.fire("Required", "Please enter Start Date and End Date.", "warning");
      return;
    }

    setLoading(true);

    try {
      const custId =
        typeof formData.customer === "object"
          ? formData.customer?.id
          : parseInt(formData.customer, 10);
      const coordId =
        typeof formData.support_coordinator === "object"
          ? formData.support_coordinator?.id
          : formData.support_coordinator
          ? parseInt(formData.support_coordinator, 10)
          : null;

      let finalProduct =
        typeof formData.product === "object"
          ? formData.product?.name || formData.product?.value || ""
          : String(formData.product || "");
      finalProduct = finalProduct.trim();
      if (/^\d+$/.test(finalProduct) && products.length > 0) {
        const found = products.find((p) => String(p.id) === finalProduct);
        if (found) finalProduct = found.name || found.product_name || "";
      }
      if (/^\d+$/.test(finalProduct) || finalProduct.toLowerCase() === "product") {
        finalProduct = "";
      }

      const payload = {
        customer: custId,
        site: formData.site ? parseInt(formData.site, 10) : null,
        project: initialProject?.id ? parseInt(initialProject.id, 10) : null,
        product: finalProduct,
        amc_type: formData.amc_type,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        annual_value: formData.annual_value ? parseFloat(formData.annual_value) : 0.0,
        payment_frequency: formData.payment_frequency,
        service_frequency: formData.service_frequency || "quarterly",
        no_of_visits:
          formData.no_of_visits !== "" && formData.no_of_visits !== null
            ? parseInt(formData.no_of_visits, 10)
            : 4,
        site_address: formData.site_address || "",
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        location_url: formData.location_url || "",
        support_coordinator: coordId,
        scope_of_support: formData.scope_of_support || "",
      };

      const isEdit = !!amcContract?.id;
      const url = isEdit ? `${API_URL}${amcContract.id}/` : API_URL;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMsg = "Failed to save AMC contract.";
        if (typeof errorData === "object") {
          errorMsg = Object.entries(errorData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
        }
        throw new Error(errorMsg);
      }

      const savedData = await res.json();

      // Dispatch custom notification for real-time drawer update
      const customNotif = {
        id: `custom_amc_${savedData.id || Date.now()}`,
        title: isEdit ? "AMC Contract Updated" : "New AMC Contract Created",
        description: `AMC contract ${savedData.contract_id || `#${savedData.id}`} created for client.`,
        type: "amc",
        amcId: savedData.id,
        targetUrl: `/amc?amcId=${savedData.id}`,
        time: "Just now",
        timestamp: Date.now(),
        read: false,
        priority: "high",
        badge: isEdit ? "AMC Edit" : "New AMC",
      };

      const existingNotifs = JSON.parse(localStorage.getItem("crm_custom_notifs") || "[]");
      localStorage.setItem("crm_custom_notifs", JSON.stringify([customNotif, ...existingNotifs]));
      window.dispatchEvent(new Event("crm_notification_updated"));

      Swal.fire("Success", `AMC Contract ${isEdit ? "updated" : "created"} successfully!`, "success");

      if (onSuccess) onSuccess(savedData);
      onClose();
    } catch (err) {
      console.error("Save AMC contract error:", err);
      Swal.fire("Error", err.message || "Failed to save AMC contract.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-2xl w-full mx-auto my-8 relative max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header Bar (Matching AddLeadForm) */}
        <div className="bg-white px-6 pt-6 pb-2 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {amcContract ? "Edit AMC Contract" : "New AMC Contract"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage contract parameters, visit frequency, and customer coverage
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

        {/* Form Main Body (Matching AddLeadForm) */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          <form className="space-y-4 text-slate-800" onSubmit={handleSubmit}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Contract ID */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Contract ID
                </label>
                <input
                  type="text"
                  name="contract_id"
                  value={formData.contract_id || "Auto Generated"}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-medium h-[38px] cursor-not-allowed"
                />
              </div>

              {/* Customer */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Customer <span className="text-rose-500">*</span>
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
                      {c.company_name || c.name} ({c.customer_code || `#${c.id}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Site */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Customer Site <span className="text-slate-400 font-normal text-[11px]">(Link to parking site)</span>
                </label>
                <select
                  name="site"
                  value={formData.site}
                  onChange={handleSiteChange}
                  disabled={!formData.customer || loadingSites}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] disabled:bg-slate-50 cursor-pointer"
                >
                  <option value="">
                    {loadingSites
                      ? "Loading sites..."
                      : customerSites.length > 0
                      ? "Select Site (Auto-fills Address)"
                      : formData.customer
                      ? "No sites registered for customer"
                      : "Select a customer first"}
                  </option>
                  {customerSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.site_shortcut ? `(${s.site_shortcut})` : ""} {s.city ? `· ${s.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Product <span className="text-rose-500">*</span>
                </label>
                <CreatableSelect
                  options={productSelectOptions}
                  value={(() => {
                    if (!formData.product) return null;
                    const strVal = String(formData.product).trim();
                    const match = productSelectOptions.find(
                      (opt) =>
                        opt.value === strVal ||
                        String(opt.id) === strVal ||
                        opt.label.toLowerCase() === strVal.toLowerCase()
                    );
                    if (match) return match;
                    if (/^\d+$/.test(strVal) && products.length > 0) {
                      const pr = products.find((p) => String(p.id) === strVal);
                      if (pr)
                        return {
                          value: pr.name || pr.product_name,
                          label: pr.name || pr.product_name,
                        };
                    }
                    if (/^\d+$/.test(strVal) || strVal.toLowerCase() === "product") return null;
                    return { value: formData.product, label: formData.product };
                  })()}
                  onChange={(opt) =>
                    setFormData((prev) => ({
                      ...prev,
                      product: opt ? opt.value || opt.label : "",
                    }))
                  }
                  placeholder="Select or enter product..."
                  className="text-sm mt-0.5"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: "38px",
                      borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
                      borderRadius: "0.5rem",
                      boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
                      "&:hover": { borderColor: "#cbd5e1" },
                    }),
                  }}
                />
              </div>

              {/* AMC Type */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  AMC Type
                </label>
                <select
                  name="amc_type"
                  value={formData.amc_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  {amcTypeOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              {/* Annual Value */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Annual Value (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  name="annual_value"
                  value={formData.annual_value}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  step="any"
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
                  <span className="text-[11px] text-blue-600 font-medium">Site-specific scheduling</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Site Visit Frequency <span className="text-rose-500">*</span>
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
                      <span className="text-[10px] text-slate-400 font-normal">Annual / cycle total</span>
                    </label>
                    <input
                      type="number"
                      name="no_of_visits"
                      value={formData.no_of_visits}
                      onChange={handleChange}
                      placeholder="4"
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
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    Site Address / Location
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
                <input
                  type="text"
                  name="site_address"
                  value={formData.site_address}
                  onChange={handleChange}
                  placeholder="Site location for technician visits..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
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

              {/* Scope of Support */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Scope of Support
                </label>
                <textarea
                  name="scope_of_support"
                  value={formData.scope_of_support}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe what is covered under this AMC — modules, support hours, on-site visits..."
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
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer disabled:opacity-50"
              >
                {loading ? "Saving..." : amcContract ? "Update Contract" : "Save Contract"}
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
        initialAddress={formData.site_address}
        title="Pin AMC Site Location"
        onSelectLocation={({ latitude, longitude, address, location_url }) => {
          setFormData((prev) => ({
            ...prev,
            latitude,
            longitude,
            location_url,
            site_address: address || prev.site_address,
          }));
        }}
      />
    </div>
  );
}
