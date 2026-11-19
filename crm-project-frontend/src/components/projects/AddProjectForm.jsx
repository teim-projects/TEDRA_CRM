import { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import Select from "react-select";
import { MdClose } from "react-icons/md";
import { useUserRole } from "../../hooks/useAuth";

export default function AddProjectForm({
  open,
  onClose,
  onSuccess,
  project = null,
  initialCustomer = null,
  initialSite = null,
}) {
  const BASE_API = import.meta.env.VITE_BASE_API_URL ?? "http://127.0.0.1:8000";
  const { userInfo } = useUserRole(BASE_API);
  const isAdmin = userInfo?.is_superuser || ["admin", "sub-admin", "subadmin"].includes(userInfo?.role?.name?.toLowerCase());
  const token = useMemo(
    () =>
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    []
  );

  const PROJECT_API_URL = `${BASE_API.replace(/\/$/, "")}/lead/projects/`;
  const CUSTOMER_API_URL = `${BASE_API.replace(/\/$/, "")}/lead/customer/`;
  const SITE_API_URL = `${BASE_API.replace(/\/$/, "")}/api/site/`;
  const PRODUCT_API_URL = `${BASE_API.replace(/\/$/, "")}/product/products/`;
  const STAFF_API_URL = `${BASE_API.replace(/\/$/, "")}/auth/staff/all/`;

  const stageOptions = [
    { id: "order_confirmed", name: "Order Confirmed" },
    { id: "site_survey", name: "Site Survey" },
    { id: "material_procurement", name: "Material Procurement" },
    { id: "dispatched", name: "Dispatched" },
    { id: "delivered", name: "Delivered" },
    { id: "installation", name: "Installation" },
    { id: "testing", name: "Testing" },
    { id: "handover", name: "Handover" },
  ];

  const priorityOptions = [
    { id: "critical", name: "Critical" },
    { id: "high", name: "High" },
    { id: "medium", name: "Medium" },
    { id: "low", name: "Low" },
  ];

  const [formData, setFormData] = useState({
    customer: "",
    site: "",
    start_date: "",
    expected_to_go_live: "",
    amc_start_date: "",
    amc_end_date: "",
    project_stage: "order_confirmed",
    priority: "medium",
    project_executive: "",
    no_of_user: "",
    project_value: "",
    project_scope_requirements: "",
    team_members: "",
  });

  const [selectedProduct, setSelectedProduct] = useState("");
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

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    setLoadingSites(true);
    fetch(`${SITE_API_URL}?customer=${formData.customer}&limit=1000`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setCustomerSites(list);
      })
      .catch(() => setCustomerSites([]))
      .finally(() => setLoadingSites(false));
  }, [open, formData.customer, SITE_API_URL, token]);

  // Set initial form data
  useEffect(() => {
    if (!open) return;

    if (project) {
      setFormData({
        customer: project.customer || "",
        site: project.site ? String(project.site) : "",
        start_date: project.start_date || "",
        expected_to_go_live: project.expected_to_go_live || "",
        amc_start_date: project.amc_start_date || "",
        amc_end_date: project.amc_end_date || "",
        project_stage: project.project_stage || "order_confirmed",
        priority: project.priority || "medium",
        project_executive: project.project_executive || "",
        no_of_user: project.no_of_user || "",
        project_value: project.project_value ? String(project.project_value) : "",
        project_scope_requirements: project.project_scope_requirements || "",
        team_members: project.team_members || "",
      });

      let firstProd = "";
      if (Array.isArray(project.product) && project.product.length > 0) {
        const item = project.product[0];
        firstProd = typeof item === "object" && item !== null ? (item.product || item.name || "") : String(item);
      } else if (typeof project.product === "string" && project.product.trim()) {
        try {
          const parsed = JSON.parse(project.product);
          firstProd = Array.isArray(parsed) ? String(parsed[0] || "") : project.product;
        } catch {
          firstProd = project.product;
        }
      }
      setSelectedProduct(firstProd);
    } else if (initialSite) {
      const parentCust = initialSite.customer || initialCustomer?.id || "";
      setFormData({
        customer: parentCust ? String(parentCust) : "",
        site: String(initialSite.id),
        start_date: "",
        expected_to_go_live: "",
        amc_start_date: initialSite.amc_start_date || "",
        amc_end_date: initialSite.amc_end_date || "",
        project_stage: "order_confirmed",
        priority: "medium",
        project_executive: initialCustomer?.sales_executive || initialCustomer?.sales_executive_details?.id || (!isAdmin && userInfo?.id ? userInfo.id : ""),
        no_of_user: "",
        project_value: initialSite.amount ? String(initialSite.amount) : "",
        project_scope_requirements: `Deployment & installation for site: ${initialSite.name}. Address: ${[initialSite.address, initialSite.city, initialSite.state, initialSite.pincode].filter(Boolean).join(", ")}`,
        team_members: "",
      });
      if (Array.isArray(initialSite.products) && initialSite.products.length > 0) {
        setSelectedProduct(initialSite.products[0]);
      }
    } else if (initialCustomer) {
      setFormData({
        customer: initialCustomer.id || "",
        site: "",
        start_date: "",
        expected_to_go_live: "",
        amc_start_date: initialCustomer.amc_start_date || "",
        amc_end_date: initialCustomer.amc_end_date || "",
        project_stage: "order_confirmed",
        priority: "medium",
        project_executive: initialCustomer.sales_executive || initialCustomer.sales_executive_details?.id || (!isAdmin && userInfo?.id ? userInfo.id : ""),
        no_of_user: "",
        project_value: initialCustomer.project_value !== undefined && initialCustomer.project_value !== null ? String(initialCustomer.project_value) : "",
        project_scope_requirements: initialCustomer.remarks || initialCustomer.requirement_details || "",
        team_members: "",
      });
      const custProds = initialCustomer.product_purchased || initialCustomer.product_purchased_list || [];
      const firstItem = Array.isArray(custProds) ? custProds[0] : custProds;
      let firstProd = typeof firstItem === "object" && firstItem !== null ? (firstItem.product || firstItem.name || "") : String(firstItem || "");
      firstProd = firstProd.trim();
      if (/^\d+$/.test(firstProd) && products.length > 0) {
        const matchP = products.find(p => String(p.id) === firstProd);
        if (matchP) firstProd = matchP.name;
      }
      setSelectedProduct(firstProd);
    } else {
      setFormData({
        customer: "",
        site: "",
        start_date: "",
        expected_to_go_live: "",
        amc_start_date: "",
        amc_end_date: "",
        project_stage: "order_confirmed",
        priority: "medium",
        project_executive: !isAdmin && userInfo?.id ? userInfo.id : "",
        no_of_user: "",
        project_value: "",
        project_scope_requirements: "",
        team_members: "",
      });
      setSelectedProduct("");
    }
  }, [open, project, initialSite, initialCustomer, isAdmin, userInfo]);

  const selectedSiteObj = useMemo(() => {
    if (!formData.site) return null;
    return (
      customerSites.find((s) => String(s.id) === String(formData.site)) ||
      (initialSite && String(initialSite.id) === String(formData.site) ? initialSite : null)
    );
  }, [formData.site, customerSites, initialSite]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // If customer dropdown is changed manually, auto-populate matching customer data
    if (name === "customer" && value) {
      const foundCustomer = customers.find((c) => String(c.id) === String(value));
      if (foundCustomer) {
        setFormData((prev) => ({
          ...prev,
          customer: value,
          site: "",
          project_executive: prev.project_executive || foundCustomer.sales_executive || foundCustomer.sales_executive_details?.id || "",
          project_value: prev.project_value || (foundCustomer.project_value ? String(foundCustomer.project_value) : ""),
          project_scope_requirements: prev.project_scope_requirements || foundCustomer.remarks || foundCustomer.requirement_details || "",
        }));
        if (!selectedProduct && (foundCustomer.product_purchased || foundCustomer.product_purchased_list)) {
          const prods = foundCustomer.product_purchased || foundCustomer.product_purchased_list;
          const firstItem = Array.isArray(prods) ? prods[0] : prods;
          const firstProd = typeof firstItem === "object" && firstItem !== null ? (firstItem.product || firstItem.name || "") : String(firstItem || "");
          setSelectedProduct(firstProd);
        }
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const productSelectOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.name || p.product_name || String(p.id),
        label: `${p.name || p.product_name || "Product"} ${p.product_code ? `(${p.product_code})` : ""}`,
        productObj: p,
      })),
    [products]
  );

  const selectedProductSelectOption = useMemo(() => {
    if (!selectedProduct) return null;

    return productSelectOptions.find((opt) => {
      const p = opt.productObj;
      if (p?.id !== undefined && String(p.id) === String(selectedProduct)) return true;
      if (String(opt.value) === String(selectedProduct)) return true;
      if (p?.name && String(p.name).trim().toLowerCase() === String(selectedProduct).trim().toLowerCase()) return true;
      if (p?.product_name && String(p.product_name).trim().toLowerCase() === String(selectedProduct).trim().toLowerCase()) return true;
      return false;
    }) || { value: selectedProduct, label: selectedProduct };
  }, [selectedProduct, productSelectOptions]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer) {
      Swal.fire("Required", "Please select a Customer.", "warning");
      return;
    }

    setLoading(true);

    try {
      const finalProd = selectedProductSelectOption?.productObj?.name || (selectedProduct && !/^\d+$/.test(String(selectedProduct).trim()) ? selectedProduct : (selectedProductSelectOption?.label || selectedProduct));
      const payload = {
        ...formData,
        customer: parseInt(formData.customer, 10),
        site: formData.site ? parseInt(formData.site, 10) : null,
        project_executive: formData.project_executive ? parseInt(formData.project_executive, 10) : null,
        product: finalProd ? [finalProd] : [],
        team_members: formData.team_members || "",
        project_value: formData.project_value ? parseFloat(formData.project_value) : 0.0,
        start_date: formData.start_date || null,
        expected_to_go_live: formData.expected_to_go_live || null,
        amc_start_date: formData.amc_start_date || null,
        amc_end_date: formData.amc_end_date || null,
      };

      const isEdit = !!project?.id;
      const url = isEdit ? `${PROJECT_API_URL}${project.id}/` : PROJECT_API_URL;
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
        let errorMsg = "Failed to save project.";
        if (typeof errorData === "object") {
          errorMsg = Object.entries(errorData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
        }
        throw new Error(errorMsg);
      }

      const savedData = await res.json();
      Swal.fire("Success", `Project ${isEdit ? "updated" : "created"} successfully!`, "success");

      if (onSuccess) onSuccess(savedData);
      onClose();
    } catch (err) {
      console.error("Save project error:", err);
      Swal.fire("Error", err.message || "Failed to save project.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <MdClose size={22} />
        </button>

        <div className="mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-800">
            {project ? "Edit Project" : "Create New Project"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {initialCustomer
              ? `Creating project for customer: ${initialCustomer.company_name || initialCustomer.name}`
              : "Enter details to create or update project assignment."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Customer & Site */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Customer <span className="text-rose-500">*</span>
              </label>
              <select
                name="customer"
                value={formData.customer}
                onChange={handleChange}
                disabled={!!initialCustomer || !!initialSite}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px] disabled:bg-slate-50"
                required
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || c.name} ({c.customer_code || `#${c.id}`})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Customer Site <span className="text-slate-400 font-normal text-[11px]">(Link to parking site)</span>
              </label>
              <select
                name="site"
                value={formData.site}
                onChange={(e) => {
                  const sId = e.target.value;
                  const chosenSite = customerSites.find((s) => String(s.id) === String(sId));
                  if (chosenSite) {
                    const fullSiteAddress = [
                      chosenSite.address,
                      chosenSite.city,
                      chosenSite.state,
                      chosenSite.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    setFormData((prev) => ({
                      ...prev,
                      site: sId,
                      project_value: chosenSite.amount ? String(chosenSite.amount) : prev.project_value,
                      amc_start_date: chosenSite.amc_start_date || prev.amc_start_date,
                      amc_end_date: chosenSite.amc_end_date || prev.amc_end_date,
                      project_scope_requirements: prev.project_scope_requirements || `Deployment & installation for site: ${chosenSite.name}. Address: ${fullSiteAddress}`,
                    }));
                    if (Array.isArray(chosenSite.products) && chosenSite.products.length > 0) {
                      const firstP = chosenSite.products[0];
                      const resolvedName = typeof firstP === "object" && firstP !== null ? (firstP.name || firstP.product) : String(firstP);
                      setSelectedProduct(resolvedName);
                    }
                  } else {
                    setFormData((prev) => ({ ...prev, site: sId }));
                  }
                }}
                disabled={!formData.customer || loadingSites || !!initialSite}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px] disabled:bg-slate-50 cursor-pointer"
              >
                <option value="">
                  {loadingSites
                    ? "Loading sites..."
                    : customerSites.length > 0
                    ? "Select Site (Optional)"
                    : formData.customer
                    ? "No sites registered for customer"
                    : "Select a customer first"}
                </option>
                {customerSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.site_shortcut ? `(${s.site_shortcut})` : ""} {s.city ? `· ${s.city}` : ""} {s.amount ? `· ₹${parseFloat(s.amount).toLocaleString("en-IN")}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Site Physical / Installation Address Banner */}
          {selectedSiteObj && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-800 font-semibold">
                <span className="flex items-center gap-1.5 text-cyan-800">
                  <span>📍</span>
                  <span>{selectedSiteObj.name}</span>
                  {selectedSiteObj.site_shortcut && (
                    <span className="text-[10px] font-mono font-semibold text-cyan-700 bg-cyan-100/60 px-1.5 py-0.2 rounded border border-cyan-200">
                      {selectedSiteObj.site_shortcut}
                    </span>
                  )}
                </span>
                {selectedSiteObj.amount && (
                  <span className="text-emerald-700 font-bold text-xs">
                    ₹{parseFloat(selectedSiteObj.amount).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 flex items-start gap-1 pt-1 border-t border-slate-200/60">
                <span className="font-semibold text-slate-500 shrink-0">Physical / Installation Address:</span>
                <span className="font-medium text-slate-800">
                  {[selectedSiteObj.address, selectedSiteObj.city, selectedSiteObj.state, selectedSiteObj.pincode]
                    .filter(Boolean)
                    .join(", ") || "No physical address specified"}
                </span>
              </div>
            </div>
          )}

          {/* Row 2: Project Executive & Product */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Project Executive
                {!isAdmin && (
                  <span className="text-[11px] text-blue-600 font-normal ml-1.5">(Auto-mapped to your logged-in account)</span>
                )}
              </label>
              <select
                name="project_executive"
                value={formData.project_executive}
                onChange={handleChange}
                disabled={!isAdmin && Boolean(formData.project_executive)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed"
              >
                <option value="">Select Executive</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.full_name || s.username || s.email}
                  </option>
                ))}
                {!isAdmin && userInfo?.id && !staffOptions.some(s => String(s.id) === String(userInfo.id)) && (
                  <option value={userInfo.id}>
                    {userInfo.full_name || userInfo.first_name || userInfo.email || "My Account"}
                  </option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Product
              </label>
              <Select
                isClearable
                options={productSelectOptions}
                value={selectedProductSelectOption}
                onChange={(opt) =>
                  setSelectedProduct(opt ? opt.value : "")
                }
                placeholder="Select Product..."
                className="text-sm"
              />
            </div>
          </div>

          {/* Row 3: Team Members & Users */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Team Members
              </label>
              <input
                type="text"
                name="team_members"
                value={formData.team_members}
                onChange={handleChange}
                placeholder="e.g. Rahul, Priya, Alex"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                No. of Users
              </label>
              <input
                type="text"
                name="no_of_user"
                value={formData.no_of_user}
                onChange={handleChange}
                placeholder="e.g. 10 users"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Row 4: Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Expected to Go Live
              </label>
              <input
                type="date"
                name="expected_to_go_live"
                value={formData.expected_to_go_live}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Row 5: AMC Dates Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                AMC Start Date
              </label>
              <input
                type="date"
                name="amc_start_date"
                value={formData.amc_start_date}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                AMC End Date
              </label>
              <input
                type="date"
                name="amc_end_date"
                value={formData.amc_end_date}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Row 6: Stage & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Current Stage
              </label>
              <select
                name="project_stage"
                value={formData.project_stage}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px]"
              >
                {stageOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px]"
              >
                {priorityOptions.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 7: Value */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">
              Project Value (₹)
            </label>
            <input
              type="number"
              step="0.01"
              name="project_value"
              value={formData.project_value}
              onChange={handleChange}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Row 6: Scope / Requirements */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">
              Project Scope / Requirements
            </label>
            <textarea
              name="project_scope_requirements"
              value={formData.project_scope_requirements}
              onChange={handleChange}
              rows={3}
              placeholder="Enter project scope, key deliverables, or requirements..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? "Saving..." : project ? "Update Project" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
