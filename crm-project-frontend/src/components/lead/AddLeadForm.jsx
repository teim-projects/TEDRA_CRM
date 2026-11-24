import React, { useEffect, useMemo, useState } from "react";
import { RxCross2 } from "react-icons/rx";
import Swal from "sweetalert2";
import { useUserRole } from "../../hooks/useAuth";
import { State, City } from "country-state-city";
import Select from "react-select";
import {
  MdAdd,
  MdDelete,
  MdEdit,
  MdLocationOn,
  MdApartment,
  MdDirectionsCar,
  MdCheckCircle,
  MdClose,
} from "react-icons/md";

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

const multiSelectStyles = {
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
  menu: (base) => ({
    ...base,
    fontSize: "0.875rem",
    borderRadius: "0.5rem",
    zIndex: 9999,
  }),
};

const initialSiteForm = {
  name: "",
  site_type: "Two-Post Hydraulic Stack Parking",
  capacity_cars: "",
  amount: "",
  products: [],
  state: "",
  city: "",
  address: "",
  pincode: "",
  owner_name: "",
  owner_contact: "",
  status: "Active",
};

export default function AddLeadForm({
  open,
  onClose,
  onSuccess,
  baseApi,
  token = "",
  lead = null,
}) {
  const BASE_API = (baseApi || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const API_URL = `${BASE_API}/lead/lead/`;
  const PRODUCT_API_URL = `${BASE_API}/product/products/`;
  const CUSTOMER_API_URL = `${BASE_API}/lead/customer/?limit=1000`;
  const STAFF_API_URL = `${BASE_API}/auth/staff/all/`;
  const SITE_API_URL = `${BASE_API}/api/site/`;

  const states = useMemo(() => State.getStatesOfCountry("IN"), []);
  const indianStates = useMemo(() => {
    return State.getStatesOfCountry("IN").map((s) => ({
      value: s.name,
      label: s.name,
      isoCode: s.isoCode,
    }));
  }, []);

  const { userInfo } = useUserRole(baseApi);
  const isAdmin =
    userInfo?.is_superuser ||
    ["admin", "sub-admin", "subadmin"].includes(userInfo?.role?.name?.toLowerCase());

  const [step, setStep] = useState(1);
  const [convertingToCustomer, setConvertingToCustomer] = useState(false);
  const [showOtherLeadSource, setShowOtherLeadSource] = useState(false);
  const [showOtherIndustry, setShowOtherIndustry] = useState(false);

  // Lead Basic Form Data (Removed product_interested & amount from Step 1)
  const [formData, setFormData] = useState({
    enquiry_date: "",
    company_name: "",
    mobile_number: "",
    linkedin_profile_url: "",
    state: "",
    expected_closure_date: "",
    lead_source: "",
    lead_source_other: "",
    referred_by_customer: "",
    contact_person: "",
    email_address: "",
    city: "",
    industry_type: "",
    industry_type_other: "",
    expected_budget: "",
    priority: "",
    assigned_executive: "",
    followup_date: "",
    pipeline_stage: "new_lead",
    status: "open",
    requirement_details: "",
    remarks: "",
    amount: "",
    product_interested: [],
    gst_number: "",
    pan_number: "",
    msme_number: "",
    address: "",
  });

  // Cities for Basic Information state
  const cities = useMemo(() => {
    if (!formData.state) return [];
    const selectedState = states.find((state) => state.name === formData.state);
    return selectedState ? City.getCitiesOfState("IN", selectedState.isoCode) : [];
  }, [formData.state, states]);

  // Sites list state for Step 2
  const [sitesList, setSitesList] = useState([]);
  const [deletedSiteIds, setDeletedSiteIds] = useState([]);
  const [siteForm, setSiteForm] = useState(initialSiteForm);
  const [editingSiteIndex, setEditingSiteIndex] = useState(null);
  const [showSiteForm, setShowSiteForm] = useState(false);

  // Dependent cities for Site Form
  const siteCities = useMemo(() => {
    if (!siteForm.state) return [];
    const selectedStateObj = indianStates.find((s) => s.value === siteForm.state);
    if (!selectedStateObj) return [];
    return City.getCitiesOfState("IN", selectedStateObj.isoCode).map((c) => ({
      value: c.name,
      label: c.name,
    }));
  }, [siteForm.state, indianStates]);

  const [products, setProducts] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileError, setMobileError] = useState("");

  const customerOptions = useMemo(() => {
    return (customers || []).map((c) => ({
      value: c.id,
      label: `${c.name || "Unnamed"}${c.customer_code ? ` (${c.customer_code})` : ""}${
        c.contact_number ? ` - ${c.contact_number}` : ""
      }`,
      customer: c,
    }));
  }, [customers]);

  const authToken = useMemo(
    () =>
      token ||
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    [token]
  );

  const leadSourceOptions = [
    { id: "website", name: "Website" },
    { id: "referral", name: "Referral" },
    { id: "cold_call", name: "Cold Call" },
    { id: "social_media", name: "Social Media" },
    { id: "email_campaign", name: "Email Campaign" },
    { id: "exhibition", name: "Exhibition" },
    { id: "visit", name: "Visit" },
    { id: "other", name: "Other" },
  ];

  const industryOptions = [
    { id: "it_services", name: "IT Services" },
    { id: "manufacturing", name: "Manufacturing" },
    { id: "banking", name: "Banking" },
    { id: "automotive", name: "Automotive" },
    { id: "healthcare", name: "Healthcare" },
    { id: "education", name: "Education" },
    { id: "real_estate", name: "Real Estate" },
    { id: "other", name: "Other" },
  ];

  const priorityOptions = [
    { id: "critical", name: "Critical" },
    { id: "high", name: "High" },
    { id: "medium", name: "Medium" },
    { id: "low", name: "Low" },
  ];

  const pipelineOptions = [
    { id: "new_lead", name: "New Lead" },
    { id: "contacted", name: "Contacted" },
    { id: "requirement_gathering", name: "Requirement Gathering" },
    { id: "demo_scheduled", name: "Demo Scheduled" },
    { id: "demo_completed", name: "Demo Completed" },
    { id: "proposal_sent", name: "Proposal Sent" },
    { id: "negotiation", name: "Negotiation" },
  ];

  const statusOptions = [
    { id: "open", name: "Open" },
    { id: "close_win", name: "Close Win" },
    { id: "close_loss", name: "Close Loss" },
  ];

  // Fetch products
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setShowOtherLeadSource(false);
    setShowOtherIndustry(false);

    const controller = new AbortController();
    setLoadingProducts(true);

    fetch(PRODUCT_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText} ${txt}`);
        }
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data) ? data : data.results ?? [];
        setProducts(items);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Failed to fetch products:", err);
          setProducts([]);
        }
      })
      .finally(() => setLoadingProducts(false));

    return () => controller.abort();
  }, [open, PRODUCT_API_URL, authToken]);

  // Fetch staff
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoadingStaff(true);

    fetch(STAFF_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText} ${txt}`);
        }
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data) ? data : data.results ?? [];
        setStaffOptions(
          items.map((u) => ({
            id: u.id,
            name: `${u.first_name} ${u.last_name}`.trim() || u.email || u.mobile_no,
            email: u.email,
            mobile: u.mobile_no,
          }))
        );
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Failed to fetch staff:", err);
          setStaffOptions([]);
        }
      })
      .finally(() => setLoadingStaff(false));

    return () => controller.abort();
  }, [open, STAFF_API_URL, authToken]);

  // Fetch existing customers for referral selection
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoadingCustomers(true);

    fetch(CUSTOMER_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText} ${txt}`);
        }
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data) ? data : data.results ?? [];
        setCustomers(items);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Failed to fetch customers for referrals:", err);
          setCustomers([]);
        }
      })
      .finally(() => setLoadingCustomers(false));

    return () => controller.abort();
  }, [open, CUSTOMER_API_URL, authToken]);

  // Fetch sites if editing existing lead
  useEffect(() => {
    if (!open) return;
    if (lead && lead.id) {
      const custParam =
        lead.converted_to_customer_id || lead.converted_to_customer
          ? `&customer=${lead.converted_to_customer_id || lead.converted_to_customer}`
          : "";
      fetch(`${SITE_API_URL}?lead=${lead.id}${custParam}`, {
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const items = Array.isArray(data) ? data : data.results || [];
          setSitesList(items);
        })
        .catch((err) => {
          console.error("Failed to fetch lead sites:", err);
          setSitesList([]);
        });
    } else {
      setSitesList([]);
    }
    setDeletedSiteIds([]);
    setSiteForm(initialSiteForm);
    setEditingSiteIndex(null);
    setShowSiteForm(false);
  }, [open, lead?.id, SITE_API_URL, authToken]);

  // Pre-fill form when lead changes
  useEffect(() => {
    if (!open) return;

    if (lead) {
      const isLeadSourceOther =
        lead.lead_source && !leadSourceOptions.some((opt) => opt.id === lead.lead_source);
      const isIndustryOther =
        lead.industry_type && !industryOptions.some((opt) => opt.id === lead.industry_type);

      setFormData({
        enquiry_date: lead.enquiry_date || "",
        company_name: lead.company_name || "",
        mobile_number: lead.mobile_number || "",
        linkedin_profile_url: lead.linkedin_profile_url || "",
        state: lead.state || "",
        product_interested: Array.isArray(lead.product_interested)
          ? lead.product_interested
              .map((p) => {
                const matched = products.find(
                  (pr) => pr.id === p || String(pr.id) === String(p) || pr.name === p
                );
                return matched
                  ? matched.name
                  : typeof p === "object" && p !== null
                  ? p.name || p.product || ""
                  : String(p);
              })
              .filter(Boolean)
          : lead.product_interested
          ? [lead.product_interested]
          : [],
        expected_closure_date: lead.expected_closure_date || "",
        lead_source: isLeadSourceOther ? "other" : lead.lead_source || "",
        lead_source_other: isLeadSourceOther ? lead.lead_source : "",
        referred_by_customer:
          lead.referred_by_customer || lead.referred_by_customer_details?.id || "",
        contact_person: lead.contact_person || "",
        email_address: lead.email_address || "",
        city: lead.city || "",
        industry_type: isIndustryOther ? "other" : lead.industry_type || "",
        industry_type_other: isIndustryOther ? lead.industry_type : "",
        expected_budget: lead.expected_budget || "",
        priority: lead.priority || "",
        assigned_executive: lead.assigned_executive || "",
        followup_date: lead.followup_date || "",
        pipeline_stage: lead.pipeline_stage || "new_lead",
        status: lead.status || "open",
        requirement_details: lead.requirement_details || "",
        remarks: lead.remarks || "",
        amount: lead.amount !== undefined && lead.amount !== null ? String(lead.amount) : "",
        gst_number: lead.gst_number || "",
        pan_number: lead.pan_number || "",
        msme_number: lead.msme_number || "",
        address: lead.address || "",
      });

      setShowOtherLeadSource(isLeadSourceOther);
      setShowOtherIndustry(isIndustryOther);
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;

      setFormData({
        enquiry_date: todayStr,
        company_name: "",
        mobile_number: "",
        linkedin_profile_url: "",
        state: "",
        product_interested: [],
        expected_closure_date: "",
        lead_source: "",
        lead_source_other: "",
        referred_by_customer: "",
        contact_person: "",
        email_address: "",
        city: "",
        industry_type: "",
        industry_type_other: "",
        expected_budget: "",
        priority: "",
        assigned_executive: !isAdmin && userInfo?.id ? userInfo.id : "",
        followup_date: "",
        pipeline_stage: "new_lead",
        status: "open",
        requirement_details: "",
        remarks: "",
        amount: "",
        gst_number: "",
        pan_number: "",
        msme_number: "",
        address: "",
      });

      setShowOtherLeadSource(false);
      setShowOtherIndustry(false);
    }
  }, [open, lead, isAdmin, userInfo, products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const clearError = (e) => {
    e.target.classList.remove("input-error");
  };

  const showError = (field, message) => {
    Swal.fire({
      icon: "error",
      title: "Validation",
      text: message,
    });

    const el = document.querySelector(`[name="${field}"]`);
    if (el) {
      el.classList.add("input-error");
    }
  };

  const checkDuplicateMobile = async (numToTest) => {
    const rawVal = numToTest !== undefined ? numToTest : formData.mobile_number;
    if (!rawVal) {
      setMobileError("");
      return false;
    }
    const digits = rawVal.replace(/\D/g, "");
    if (digits.length < 10) {
      setMobileError("");
      return false;
    }

    try {
      const queryParams = new URLSearchParams({
        mobile: digits,
        ...(lead?.id ? { lead_id: lead.id } : {}),
      });
      const res = await fetch(`${API_URL}check-mobile/?${queryParams.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          const msg = data.message || "A lead with this mobile number already exists.";
          setMobileError(msg);
          return msg;
        }
      }
    } catch (err) {
      console.error("Error checking duplicate mobile number:", err);
    }
    setMobileError("");
    return false;
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    if (!formData.enquiry_date) {
      showError("enquiry_date", "Lead Date is required");
      return false;
    }
    if (!formData.company_name.trim()) {
      showError("company_name", "Company Name is required");
      return false;
    }
    if (!formData.mobile_number.trim()) {
      showError("mobile_number", "Mobile Number is required");
      return false;
    }
    if (!/^\d{10}$/.test(formData.mobile_number.replace(/\s/g, ""))) {
      showError("mobile_number", "Please enter a valid 10-digit mobile number");
      return false;
    }
    if (mobileError) {
      showError("mobile_number", mobileError);
      return false;
    }
    if (formData.email_address && !emailRegex.test(formData.email_address)) {
      showError("email_address", "Please enter a valid email address");
      return false;
    }
    const leadSourceValue =
      formData.lead_source === "other" ? formData.lead_source_other : formData.lead_source;
    if (!leadSourceValue || !leadSourceValue.trim()) {
      showError("lead_source", "Lead Source is required");
      return false;
    }
    if (formData.lead_source === "referral" && !formData.referred_by_customer) {
      showError("referred_by_customer", "Please select the existing customer who referred this lead");
      return false;
    }
    if (!formData.contact_person.trim()) {
      showError("contact_person", "Contact Person is required");
      return false;
    }
    if (!formData.priority) {
      showError("priority", "Priority is required");
      return false;
    }
    return true;
  };

  const validateStep1 = () => {
    if (!formData.company_name.trim()) {
      showError("company_name", "Company Name is required");
      return false;
    }
    if (!formData.mobile_number.trim()) {
      showError("mobile_number", "Mobile Number is required");
      return false;
    }
    if (!/^\d{10}$/.test(formData.mobile_number.replace(/\s/g, ""))) {
      showError("mobile_number", "Please enter a valid 10-digit mobile number");
      return false;
    }
    if (mobileError) {
      showError("mobile_number", mobileError);
      return false;
    }
    if (formData.email_address && !emailRegex.test(formData.email_address)) {
      showError("email_address", "Please enter a valid email address");
      return false;
    }
    const leadSourceValue =
      formData.lead_source === "other" ? formData.lead_source_other : formData.lead_source;
    if (!leadSourceValue || !leadSourceValue.trim()) {
      showError("lead_source", "Lead Source is required");
      return false;
    }
    if (formData.lead_source === "referral" && !formData.referred_by_customer) {
      showError("referred_by_customer", "Please select the existing customer who referred this lead");
      return false;
    }
    if (!formData.contact_person.trim()) {
      showError("contact_person", "Contact Person is required");
      return false;
    }
    if (!formData.priority) {
      showError("priority", "Priority is required");
      return false;
    }
    return true;
  };

  const productSelectOptions = useMemo(() => {
    return products.map((p) => ({
      value: p.name || p.product_name || String(p.id),
      id: p.id,
      label: p.name || p.product_name,
    }));
  }, [products]);

  // Handle product selection inside Site form (auto calculates site amount)
  const handleSiteProductChange = (selectedOptions) => {
    const selectedValues = selectedOptions ? selectedOptions.map((opt) => opt.value) : [];

    let totalCalculated = 0;
    selectedValues.forEach((val) => {
      const prod = products.find(
        (p) =>
          p.name === val ||
          String(p.id) === String(val) ||
          (p.name && p.name.toLowerCase() === String(val).toLowerCase())
      );
      if (prod && prod.unit_price) {
        totalCalculated += parseFloat(prod.unit_price) || 0;
      }
    });

    setSiteForm((prev) => ({
      ...prev,
      products: selectedValues,
      amount:
        prev.amount === "" || prev.amount === "0" || prev._autoCalculated
          ? totalCalculated > 0
            ? String(totalCalculated)
            : prev.amount
          : prev.amount,
      _autoCalculated: prev.amount === "" || prev._autoCalculated,
    }));
  };

  const handleSaveSiteToList = (e) => {
    e && e.preventDefault();
    if (!siteForm.name.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Site Name Required",
        text: "Please enter a name for this site or parking facility.",
        timer: 1600,
        showConfirmButton: false,
      });
      return;
    }

    const siteObj = {
      ...siteForm,
      name: siteForm.name.trim(),
      capacity_cars: siteForm.capacity_cars !== "" ? parseInt(siteForm.capacity_cars, 10) : 0,
      amount: siteForm.amount !== "" ? parseFloat(siteForm.amount) : 0.0,
      pincode: siteForm.pincode !== "" ? parseInt(siteForm.pincode, 10) : null,
      products: siteForm.products || [],
    };

    if (editingSiteIndex !== null) {
      setSitesList((prev) =>
        prev.map((s, idx) => (idx === editingSiteIndex ? { ...s, ...siteObj } : s))
      );
    } else {
      setSitesList((prev) => [...prev, siteObj]);
    }

    setSiteForm(initialSiteForm);
    setEditingSiteIndex(null);
    setShowSiteForm(false);
  };

  const handleCancelSiteForm = () => {
    setSiteForm(initialSiteForm);
    setEditingSiteIndex(null);
    setShowSiteForm(false);
  };

  const handleEditSite = (index) => {
    const s = sitesList[index];
    setSiteForm({
      id: s.id,
      name: s.name || "",
      site_type: s.site_type || "Two-Post Hydraulic Stack Parking",
      capacity_cars:
        s.capacity_cars !== undefined && s.capacity_cars !== null ? String(s.capacity_cars) : "",
      amount: s.amount !== undefined && s.amount !== null ? String(s.amount) : "",
      products: Array.isArray(s.products) ? s.products : [],
      state: s.state || "",
      city: s.city || "",
      address: s.address || "",
      pincode: s.pincode ? String(s.pincode) : "",
      owner_name: s.owner_name || "",
      owner_contact: s.owner_contact || "",
      status: s.status || "Active",
      _autoCalculated: false,
    });
    setEditingSiteIndex(index);
    setShowSiteForm(true);
  };

  const handleRemoveSite = (index) => {
    const s = sitesList[index];
    if (s && s.id) {
      setDeletedSiteIds((prev) => [...prev, s.id]);
    }
    setSitesList((prev) => prev.filter((_, idx) => idx !== index));
    if (editingSiteIndex === index) {
      setEditingSiteIndex(null);
      setSiteForm(initialSiteForm);
      setShowSiteForm(false);
    }
  };

  const totalSitesAmount = useMemo(() => {
    return sitesList.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
  }, [sitesList]);

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    const dupMsg = await checkDuplicateMobile();
    if (dupMsg) {
      const displayMsg =
        typeof dupMsg === "string"
          ? dupMsg
          : mobileError || "A lead with this mobile number already exists.";
      showError("mobile_number", displayMsg);
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const formatDate = (dateStr) => {
        if (!dateStr) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return null;
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        } catch {
          return null;
        }
      };

      let leadSourceValue = formData.lead_source;
      if (leadSourceValue === "other") {
        leadSourceValue = formData.lead_source_other || "other";
      }

      let industryTypeValue = formData.industry_type;
      if (industryTypeValue === "other") {
        industryTypeValue = formData.industry_type_other || "other";
      }

      // Aggregate products & amounts from all configured sites
      const calculatedTotalAmount = sitesList.reduce(
        (acc, s) => acc + (parseFloat(s.amount) || 0),
        0
      );
      const allSiteProducts = Array.from(
        new Set(sitesList.flatMap((s) => (Array.isArray(s.products) ? s.products : [])))
      );

      const payload = {
        enquiry_date: formatDate(formData.enquiry_date),
        company_name: formData.company_name,
        mobile_number: formData.mobile_number,
        linkedin_profile_url: formData.linkedin_profile_url || "",
        state: formData.state || "",
        product_interested:
          allSiteProducts.length > 0 ? allSiteProducts : formData.product_interested || [],
        amount:
          calculatedTotalAmount > 0
            ? calculatedTotalAmount
            : formData.amount !== "" && formData.amount !== null
            ? parseFloat(formData.amount)
            : 0.0,
        expected_closure_date: formatDate(formData.expected_closure_date),
        lead_source: leadSourceValue,
        referred_by_customer:
          leadSourceValue === "referral" && formData.referred_by_customer
            ? formData.referred_by_customer
            : null,
        contact_person: formData.contact_person,
        email_address: formData.email_address || "",
        city: formData.city || "",
        industry_type: industryTypeValue,
        expected_budget: formData.expected_budget || "",
        priority: formData.priority,
        assigned_executive: formData.assigned_executive || null,
        followup_date: formatDate(formData.followup_date),
        pipeline_stage: formData.pipeline_stage || "new_lead",
        requirement_details: formData.requirement_details || "",
        remarks: formData.remarks || "",
        status: "open",
        gst_number: formData.gst_number || "",
        pan_number: formData.pan_number || "",
        msme_number: formData.msme_number || "",
        address: formData.address || "",
      };

      const url = lead ? `${API_URL}${lead.id}/` : API_URL;
      const method = lead ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        if (data && typeof data === "object") {
          if (data.mobile_number) {
            const mMsg = Array.isArray(data.mobile_number)
              ? data.mobile_number.join(", ")
              : String(data.mobile_number);
            setMobileError(mMsg);
          }
          const errorMessages = Object.entries(data)
            .map(([field, messages]) => {
              const msg = Array.isArray(messages) ? messages.join(", ") : messages;
              return `${field}: ${msg}`;
            })
            .join("\n");
          throw new Error(errorMessages || "Validation failed");
        }
        const msg = data?.detail || JSON.stringify(data) || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      const savedLeadId = data?.id || lead?.id;
      if (savedLeadId) {
        // Save or update each configured site for this lead
        for (const site of sitesList) {
          const sitePayload = {
            lead: savedLeadId,
            customer:
              site.customer ||
              lead?.converted_to_customer_id ||
              lead?.converted_to_customer ||
              null,
            name: site.name,
            site_type: site.site_type || "Two-Post Hydraulic Stack Parking",
            capacity_cars: site.capacity_cars !== "" ? parseInt(site.capacity_cars, 10) : 0,
            amount: site.amount !== "" ? parseFloat(site.amount) : 0.0,
            products: site.products || [],
            state: site.state || "",
            city: site.city || "",
            address: site.address || "",
            pincode:
              site.pincode !== "" && site.pincode !== null ? parseInt(site.pincode, 10) : null,
            owner_name: site.owner_name || "",
            owner_contact: site.owner_contact || "",
            status: site.status || "Active",
          };

          try {
            if (site.id) {
              await fetch(`${SITE_API_URL}${site.id}/`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify(sitePayload),
              });
            } else {
              await fetch(SITE_API_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify(sitePayload),
              });
            }
          } catch (siteErr) {
            console.error("Failed to save site for lead:", siteErr);
          }
        }

        // Delete any removed sites
        for (const delId of deletedSiteIds) {
          try {
            await fetch(`${SITE_API_URL}${delId}/`, {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
            });
          } catch (delErr) {
            console.error("Failed to delete removed site:", delErr);
          }
        }
      }

      Swal.fire({
        icon: "success",
        text: lead ? "Lead updated successfully" : "Lead added successfully",
        timer: 1200,
        showConfirmButton: false,
      });

      window.dispatchEvent(
        new CustomEvent("newNotification", {
          detail: {
            title: lead ? "Lead Record Updated" : "New Lead Added",
            description: `Lead ${lead ? "updated" : "created"} for ${
              formData.company_name || formData.contact_person || "Client"
            }.`,
            type: "leads",
            badge: lead ? "Updated" : "New Lead",
          },
        })
      );

      onSuccess && onSuccess(data);
      onClose && onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to save lead",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToCustomer = async () => {
    if (!lead || !lead.id) return;

    const result = await Swal.fire({
      title: "Convert to Customer?",
      text: "This will create a customer record from this lead data and link any associated sites.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Convert",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setConvertingToCustomer(true);
    try {
      const response = await fetch(`${API_URL}${lead.id}/convert-to-customer/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to convert lead");
      }

      Swal.fire({
        icon: "success",
        title: "Success!",
        text: data.message || "Lead converted to customer successfully",
        timer: 2000,
        showConfirmButton: false,
      });

      onSuccess && onSuccess(data);
      onClose && onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Conversion Failed",
        text: err.message,
      });
    } finally {
      setConvertingToCustomer(false);
    }
  };

  const handleNextFromStep1 = async (e) => {
    e && e.preventDefault();
    const isDup = await checkDuplicateMobile();
    if (isDup) {
      showError("mobile_number", mobileError || "A lead with this mobile number already exists.");
      return;
    }
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleNextFromStep2 = (e) => {
    e && e.preventDefault();
    setStep(3);
  };

  const handleLeadSourceChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, lead_source: value }));
    setShowOtherLeadSource(value === "other");
    if (value !== "other") {
      setFormData((prev) => ({ ...prev, lead_source_other: "" }));
    }
  };

  const handleIndustryChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, industry_type: value }));
    setShowOtherIndustry(value === "other");
    if (value !== "other") {
      setFormData((prev) => ({ ...prev, industry_type_other: "" }));
    }
  };

  if (!open) return null;

  return (
    <>
      <style>
        {`
          .input-error {
            border: 1px solid #ef4444 !important;
          }
        `}
      </style>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in">
        <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-3xl w-full mx-auto my-auto sm:my-6 relative max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header Bar */}
          <div className="bg-white px-4 sm:px-6 pt-4 sm:pt-5 pb-3 flex justify-between items-start border-b border-slate-100">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                {lead ? "Edit Lead" : "Add New Lead"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage parking lead attributes, facility sites, and pipeline info
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <RxCross2 size={18} />
            </button>
          </div>

          {/* Stepper Header Navigation */}
          <div className="px-3 sm:px-6 py-2 sm:py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  step === 1
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/20">
                  1
                </span>
                <span>Basic Details</span>
              </button>
              <span className="text-slate-300 shrink-0">›</span>
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  step === 2
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/20">
                  2
                </span>
                <span>Sites & Products</span>
                <span className="text-[10px] opacity-80">(Optional)</span>
              </button>
              <span className="text-slate-300 shrink-0">›</span>
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(3);
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  step === 3
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/20">
                  3
                </span>
                <span>Pipeline Info</span>
              </button>
            </div>

            {sitesList.length > 0 && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 ml-2">
                {sitesList.length} Site{sitesList.length > 1 ? "s" : ""} (₹
                {totalSitesAmount.toLocaleString("en-IN")})
              </span>
            )}
          </div>

          {/* Form Main Body */}
          <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 scrollbar-thin">
            <form className="space-y-4 text-slate-800" onSubmit={handleSubmit}>
              {/* ================= STEP 1: BASIC INFORMATION (WITHOUT PRODUCT / AMOUNT) ================= */}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Lead Date *
                    </label>
                    <input
                      type="date"
                      name="enquiry_date"
                      value={formData.enquiry_date}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Company Name *
                    </label>
                    <input
                      name="company_name"
                      type="text"
                      placeholder="e.g. Infosys Ltd"
                      value={formData.company_name}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Mobile Number *
                    </label>
                    <input
                      name="mobile_number"
                      type="text"
                      placeholder="+91 98765 43210"
                      value={formData.mobile_number}
                      onBlur={(e) => checkDuplicateMobile(e.target.value)}
                      onChange={(e) => {
                        clearError(e);
                        const val = e.target.value;
                        handleChange(e);
                        const digits = val.replace(/\D/g, "");
                        if (digits.length >= 10) {
                          checkDuplicateMobile(val);
                        } else {
                          setMobileError("");
                        }
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white ${
                        mobileError ? "border-rose-500 bg-rose-50/50" : "border-slate-200"
                      }`}
                    />
                    {mobileError && (
                      <div className="text-[11px] font-semibold text-rose-700 mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 shadow-xs">
                        <span className="text-sm leading-none mt-0.5">⚠️</span>
                        <span className="flex-1 leading-snug">{mobileError}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      LinkedIn Profile URL
                    </label>
                    <input
                      name="linkedin_profile_url"
                      type="url"
                      placeholder="https://linkedin.com/in/username"
                      value={formData.linkedin_profile_url}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      State
                    </label>
                    <select
                      name="state"
                      value={formData.state}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                        setFormData((prev) => ({ ...prev, city: "" }));
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                    >
                      <option value="">Select State</option>
                      {states.map((state) => (
                        <option key={state.isoCode} value={state.name}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      City
                    </label>
                    <select
                      name="city"
                      value={formData.city}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      disabled={!formData.state}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 h-[38px]"
                    >
                      <option value="">
                        {!formData.state ? "Select State First" : "Select City"}
                      </option>
                      {cities.map((city) => (
                        <option value={city.name} key={city.name}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Expected Closure Date
                    </label>
                    <input
                      type="date"
                      name="expected_closure_date"
                      value={formData.expected_closure_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Lead Source *
                    </label>
                    <select
                      name="lead_source"
                      value={formData.lead_source}
                      onChange={handleLeadSourceChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                    >
                      <option value="">Select Lead Source</option>
                      {leadSourceOptions.map((opt) => (
                        <option value={opt.id} key={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {showOtherLeadSource && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">
                        Specify Other Lead Source *
                      </label>
                      <input
                        name="lead_source_other"
                        type="text"
                        placeholder="Enter custom lead source"
                        value={formData.lead_source_other}
                        onChange={(e) => {
                          clearError(e);
                          handleChange(e);
                        }}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  )}

                  {formData.lead_source === "referral" && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">
                        Referred By Customer *
                      </label>
                      <Select
                        options={customerOptions}
                        value={
                          customerOptions.find(
                            (opt) => String(opt.value) === String(formData.referred_by_customer)
                          ) || null
                        }
                        onChange={(selected) => {
                          setFormData((prev) => ({
                            ...prev,
                            referred_by_customer: selected ? selected.value : "",
                          }));
                        }}
                        placeholder="Search & select existing customer..."
                        isClearable
                        isLoading={loadingCustomers}
                        noOptionsMessage={() =>
                          loadingCustomers ? "Loading customers..." : "No customers found"
                        }
                        className="text-sm mt-0.5"
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: "38px",
                            borderColor: "#e2e8f0",
                            borderRadius: "0.5rem",
                            "&:hover": { borderColor: "#cbd5e1" },
                          }),
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Contact Person *
                    </label>
                    <input
                      name="contact_person"
                      type="text"
                      placeholder="Full name"
                      value={formData.contact_person}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email_address"
                      placeholder="contact@company.com"
                      value={formData.email_address}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Industry Type
                    </label>
                    <select
                      name="industry_type"
                      value={formData.industry_type}
                      onChange={handleIndustryChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                    >
                      <option value="">Select Industry</option>
                      {industryOptions.map((opt) => (
                        <option value={opt.id} key={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {showOtherIndustry && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">
                        Specify Other Industry Type
                      </label>
                      <input
                        name="industry_type_other"
                        type="text"
                        placeholder="Enter custom industry type"
                        value={formData.industry_type_other}
                        onChange={(e) => {
                          clearError(e);
                          handleChange(e);
                        }}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Expected Budget
                    </label>
                    <input
                      name="expected_budget"
                      type="text"
                      placeholder="Enter expected budget"
                      value={formData.expected_budget}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Priority *
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                    >
                      <option value="">Select Priority</option>
                      {priorityOptions.map((opt) => (
                        <option value={opt.id} key={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      GST Number
                    </label>
                    <input
                      name="gst_number"
                      type="text"
                      placeholder="29AAGCM0000A1ZP"
                      value={formData.gst_number}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white uppercase"
                      maxLength={15}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      PAN Number
                    </label>
                    <input
                      name="pan_number"
                      type="text"
                      placeholder="AAGCM0000A"
                      value={formData.pan_number}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white uppercase"
                      maxLength={10}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      MSME Number
                    </label>
                    <input
                      name="msme_number"
                      type="text"
                      placeholder="UDYAM-XX-XX-XXXXXXX"
                      value={formData.msme_number}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Address
                    </label>
                    <textarea
                      name="address"
                      rows={2}
                      placeholder="Enter full address details..."
                      value={formData.address}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* ================= STEP 2: SITES & PRODUCTS (OPTIONAL) ================= */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Banner / Summary Header */}
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                          Lead Sites & Product Configuration (Optional)
                        </h4>
                      </div>
                      <p className="text-[11px] text-blue-700/80 mt-0.5">
                        Configure multi-location parking facilities, car capacity, site-specific products, and contract values.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {sitesList.length > 0 && (
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs">
                          <span>
                            {sitesList.length} Site{sitesList.length > 1 ? "s" : ""}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-emerald-700">
                            ₹{totalSitesAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {!showSiteForm && (
                        <button
                          type="button"
                          onClick={() => {
                            setSiteForm(initialSiteForm);
                            setEditingSiteIndex(null);
                            setShowSiteForm(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <MdAdd size={16} />
                          <span>Add Site</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-form to Add or Edit Site */}
                  {showSiteForm && (
                    <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-xl space-y-3.5 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <MdApartment className="text-blue-600" size={16} />
                          <span>
                            {editingSiteIndex !== null
                              ? "Edit Site Details"
                              : "Add New Site / Parking Facility"}
                          </span>
                        </h5>
                        <button
                          type="button"
                          onClick={handleCancelSiteForm}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded-sm hover:bg-slate-200/60 cursor-pointer"
                        >
                          <MdClose size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-800">
                        {/* Site Name */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600">
                            Site / Facility Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={siteForm.name}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="e.g. Phoenix IT Park - Tower Parking Zone"
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        {/* Parking System / Site Type */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">
                            Parking System / Site Type
                          </label>
                          <select
                            value={siteForm.site_type}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, site_type: e.target.value }))
                            }
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
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
                            value={siteForm.capacity_cars}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, capacity_cars: e.target.value }))
                            }
                            placeholder="e.g. 50"
                            min="0"
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        {/* Product Selection for THIS Site */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 flex items-center justify-between">
                            <span>Products Required for this Site</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              Select parking models & systems
                            </span>
                          </label>
                          <Select
                            isMulti
                            options={productSelectOptions}
                            value={productSelectOptions.filter((opt) =>
                              (siteForm.products || []).some(
                                (p) =>
                                  String(p) === String(opt.value) ||
                                  String(p) === String(opt.id) ||
                                  String(p).toLowerCase() === String(opt.label).toLowerCase()
                              )
                            )}
                            onChange={handleSiteProductChange}
                            placeholder="Select products for this facility..."
                            className="text-sm"
                            styles={multiSelectStyles}
                            isLoading={loadingProducts}
                            noOptionsMessage={() =>
                              loadingProducts ? "Loading products..." : "No products available"
                            }
                          />
                        </div>

                        {/* Site Amount / Estimated Value */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">
                            Site Amount / Value (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={siteForm.amount}
                            onChange={(e) =>
                              setSiteForm((prev) => ({
                                ...prev,
                                amount: e.target.value,
                                _autoCalculated: false,
                              }))
                            }
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        {/* Pincode */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">
                            Pincode
                          </label>
                          <input
                            type="number"
                            value={siteForm.pincode}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, pincode: e.target.value }))
                            }
                            placeholder="e.g. 411014"
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        {/* State (Searchable) */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">
                            State
                          </label>
                          <Select
                            options={indianStates}
                            value={
                              indianStates.find(
                                (s) => s.value.toLowerCase() === (siteForm.state || "").toLowerCase()
                              ) || (siteForm.state ? { value: siteForm.state, label: siteForm.state } : null)
                            }
                            onChange={(selected) => {
                              setSiteForm((prev) => ({
                                ...prev,
                                state: selected ? selected.value : "",
                                city: "",
                              }));
                            }}
                            placeholder="Search State..."
                            isClearable
                            className="text-sm"
                            styles={customSelectStyles}
                          />
                        </div>

                        {/* City (Searchable, Dependent) */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">
                            City
                          </label>
                          <Select
                            options={siteCities}
                            value={
                              siteCities.find(
                                (c) => c.value.toLowerCase() === (siteForm.city || "").toLowerCase()
                              ) || (siteForm.city ? { value: siteForm.city, label: siteForm.city } : null)
                            }
                            onChange={(selected) => {
                              setSiteForm((prev) => ({
                                ...prev,
                                city: selected ? selected.value : "",
                              }));
                            }}
                            isDisabled={!siteForm.state}
                            placeholder={!siteForm.state ? "Select State First" : "Search City..."}
                            isClearable
                            className="text-sm"
                            styles={customSelectStyles}
                          />
                        </div>

                        {/* Physical Address */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600">
                            Installation / Physical Address
                          </label>
                          <input
                            type="text"
                            value={siteForm.address}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, address: e.target.value }))
                            }
                            placeholder="Plot No, Street / Tech Park address..."
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        {/* Supervisor Name */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">
                            Site Supervisor / Contact Person
                          </label>
                          <input
                            type="text"
                            value={siteForm.owner_name}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, owner_name: e.target.value }))
                            }
                            placeholder="e.g. Rahul Sharma"
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        {/* Contact Phone */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">
                            Supervisor Contact Phone
                          </label>
                          <input
                            type="text"
                            value={siteForm.owner_contact}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, owner_contact: e.target.value }))
                            }
                            placeholder="e.g. +91 98200 12345"
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>

                      {/* Sub-form action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={handleCancelSiteForm}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveSiteToList}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <MdCheckCircle size={15} />
                          <span>
                            {editingSiteIndex !== null ? "Update Site" : "Save Site to Lead"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sites List or Empty State */}
                  {sitesList.length === 0 && !showSiteForm ? (
                    <div className="text-center py-10 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                      <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                        <MdApartment size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-700">No Sites Added Yet</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Adding sites is completely optional. If this client has multiple parking locations or facilities, add them now with product requirements and amounts.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4 max-w-md mx-auto w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setSiteForm(initialSiteForm);
                            setEditingSiteIndex(null);
                            setShowSiteForm(true);
                          }}
                          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <MdAdd size={16} />
                          <span>Add First Site</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          className="w-full sm:w-auto px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer text-center"
                        >
                          Skip to Pipeline Info →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {sitesList.map((site, idx) => (
                        <div
                          key={site.id || idx}
                          className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 truncate">
                                {site.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                {site.site_type || "Parking Facility"}
                              </span>
                              {site.capacity_cars > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                  🚗 {site.capacity_cars} Cars
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              {(site.city || site.state) && (
                                <span className="flex items-center gap-1">
                                  <MdLocationOn className="text-slate-400" size={13} />
                                  {[site.city, site.state].filter(Boolean).join(", ")}
                                </span>
                              )}
                              {site.owner_name && (
                                <span className="text-slate-400">
                                  Supervisor:{" "}
                                  <strong className="text-slate-600 font-medium">
                                    {site.owner_name}
                                  </strong>
                                </span>
                              )}
                            </div>

                            {/* Tagged Products */}
                            {Array.isArray(site.products) && site.products.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Products:
                                </span>
                                {site.products.map((prodName, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700"
                                  >
                                    {prodName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Right side: Amount and actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-400 block font-medium">
                                Site Value
                              </span>
                              <span className="text-sm font-bold text-emerald-700">
                                ₹
                                {parseFloat(site.amount || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditSite(idx)}
                                title="Edit Site"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <MdEdit size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSite(idx)}
                                title="Remove Site"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <MdDelete size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ================= STEP 3: PIPELINE & FOLLOW-UP INFORMATION ================= */}
              {step === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Assigned Executive *
                      {!isAdmin && (
                        <span className="text-[11px] text-blue-600 font-normal ml-1.5">
                          (Auto-mapped to your logged-in account)
                        </span>
                      )}
                    </label>
                    <select
                      name="assigned_executive"
                      value={formData.assigned_executive}
                      onChange={(e) => {
                        clearError(e);
                        handleChange(e);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed"
                      disabled={loadingStaff || (!isAdmin && Boolean(formData.assigned_executive))}
                    >
                      <option value="">
                        {loadingStaff ? "Loading staff..." : "Select Executive"}
                      </option>
                      {staffOptions.map((staff) => (
                        <option value={staff.id} key={staff.id}>
                          {staff.name} {staff.email && `(${staff.email})`}
                        </option>
                      ))}
                      {!isAdmin &&
                        userInfo?.id &&
                        !staffOptions.some((s) => String(s.id) === String(userInfo.id)) && (
                          <option value={userInfo.id}>
                            {userInfo.full_name ||
                              userInfo.first_name ||
                              userInfo.email ||
                              "My Account"}
                          </option>
                        )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      name="followup_date"
                      value={formData.followup_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Pipeline Stage
                    </label>
                    <select
                      name="pipeline_stage"
                      value={formData.pipeline_stage}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                    >
                      {pipelineOptions.map((opt) => (
                        <option value={opt.id} key={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                    >
                      {statusOptions.map((opt) => (
                        <option value={opt.id} key={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Requirement Details
                    </label>
                    <textarea
                      name="requirement_details"
                      placeholder="Describe the client's parking requirements, site constraints, and specifications..."
                      value={formData.requirement_details}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Remarks
                    </label>
                    <textarea
                      name="remarks"
                      placeholder="Any additional notes or commercial discussion details..."
                      value={formData.remarks}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* ================= ACTION BUTTONS PANEL ================= */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-3 border-t border-slate-100 mt-6">
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep(step - 1)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer justify-center text-center"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className={`px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer justify-center text-center ${
                      step === 1 ? "col-span-2 sm:col-span-1" : ""
                    }`}
                  >
                    Cancel
                  </button>
                </div>

                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                  {lead && !lead.is_converted && step === 3 && (
                    <button
                      type="button"
                      onClick={handleConvertToCustomer}
                      className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm shadow-green-500/10 cursor-pointer justify-center text-center"
                      disabled={convertingToCustomer}
                    >
                      {convertingToCustomer ? "Converting..." : "Convert to Customer"}
                    </button>
                  )}

                  {step === 1 && (
                    <button
                      type="button"
                      onClick={handleNextFromStep1}
                      className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer justify-center text-center whitespace-nowrap"
                    >
                      Next: Sites & Products →
                    </button>
                  )}

                  {step === 2 && (
                    <button
                      type="button"
                      onClick={handleNextFromStep2}
                      className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer justify-center text-center whitespace-nowrap"
                    >
                      {sitesList.length > 0 ? "Next: Pipeline Info →" : "Skip & Next: Pipeline Info →"}
                    </button>
                  )}

                  {step === 3 && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer justify-center text-center whitespace-nowrap"
                    >
                      {loading
                        ? lead
                          ? "Updating..."
                          : "Saving..."
                        : lead
                        ? "Update Record"
                        : "Submit Entry"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
