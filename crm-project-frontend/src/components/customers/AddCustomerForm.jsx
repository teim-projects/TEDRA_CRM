import React, { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import { RxCross2 } from "react-icons/rx";
import { CitySelect, StateSelect, GetState, GetCity } from "react-country-state-city";
import "react-country-state-city/dist/react-country-state-city.css";
import { State, City } from "country-state-city";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import {
  MdAdd,
  MdDelete,
  MdEdit,
  MdLocationOn,
  MdApartment,
  MdDirectionsCar,
  MdPhone,
  MdCheckCircle,
  MdClose,
} from "react-icons/md";
import { useUserRole } from "../../hooks/useAuth";

const PARKING_TYPES = [
  "Two-Post Hydraulic Stack Parking",
  "Four-Post Multi-Stack Parking",
  "Automated Tower Parking (Elevator Type)",
  "Multi-Level Puzzle Parking",
  "Pit-Type Cantilever Stack Parking",
  "Vertical Rotary Carousel Parking",
  "Commercial Basement Parking",
  "Residential Multi-Tier Parking",
  "Surface / Multi-Level Car Park",
  "Other / Custom Facility",
];

const indianStates = State.getStatesOfCountry("IN").map((s) => ({
  value: s.name,
  label: s.name,
  isoCode: s.isoCode,
}));

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "36px",
    height: "36px",
    fontSize: "0.8125rem",
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
    padding: "0 8px",
    height: "36px",
  }),
  input: (base) => ({
    ...base,
    margin: "0px",
    padding: "0px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "36px",
  }),
  menu: (base) => ({
    ...base,
    fontSize: "0.8125rem",
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

export default function AddCustomerForm({
  open,
  onClose,
  onSuccess,
  baseApi,
  customer = null,
}) {
  const BASE_API = baseApi;
  const { userInfo } = useUserRole(BASE_API);
  const isAdmin =
    userInfo?.is_superuser ||
    ["admin", "sub-admin", "subadmin"].includes(userInfo?.role?.name?.toLowerCase());
  const API_URL = `${BASE_API}/lead/customer/`;
  const LEAD_API_URL = `${BASE_API}/lead/lead/`;
  const PRODUCT_API_URL = `${BASE_API}/product/products/`;
  const STAFF_API_URL = `${BASE_API}/auth/staff/all/`;
  const SITE_API_URL = `${BASE_API}/api/site/`;

  const [formData, setFormData] = useState({
    customer_code: "",
    name: "",
    contact_person: "",
    designation: "",
    contact_number: "",
    email: "",
    website: "",
    industry_category: "",
    industry_category_other: "",
    lead_source: "",
    gst_number: "",
    pan_number: "",
    msme_number: "",
    payment_terms: "",
    project_value: "",
    sales_executive: "",
    amc_start_date: "",
    amc_end_date: "",
    customer_status: "prospect",
    billing_address: "",
    city: "",
    state: "",
    pin_code: "",
    lead: "",
  });

  const [loading, setLoading] = useState(false);
  const [leadLookup, setLeadLookup] = useState("");
  const [loadingLead, setLoadingLead] = useState(false);
  const [leadFound, setLeadFound] = useState(null);
  const [staffOptions, setStaffOptions] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Billing address state & city ids
  const INDIA_ID = 101;
  const [cityid, setCityid] = useState(null);
  const [stateid, setStateid] = useState(0);

  // Products from catalog
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Customer Sites Management (site-specific AMC enabled/disabled per site)
  const [sitesList, setSitesList] = useState([]);
  const [deletedSiteIds, setDeletedSiteIds] = useState([]);
  const [siteForm, setSiteForm] = useState(initialSiteForm);
  const [editingSiteIndex, setEditingSiteIndex] = useState(null);
  const [showSiteForm, setShowSiteForm] = useState(false);

  // Dynamic city list for Site sub-form
  const siteCities = useMemo(() => {
    if (!siteForm.state) return [];
    const selectedStateObj = indianStates.find((s) => s.value === siteForm.state);
    if (!selectedStateObj) return [];
    return City.getCitiesOfState("IN", selectedStateObj.isoCode).map((c) => ({
      value: c.name,
      label: c.name,
    }));
  }, [siteForm.state]);

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

  const paymentTermsOptions = [
    { id: "advance", name: "Advance" },
    { id: "partial", name: "Partial" },
    { id: "credit", name: "Credit" },
    { id: "milestone", name: "Milestone" },
    { id: "upon_completion", name: "Upon Completion" },
  ];

  const customerStatusOptions = [
    { id: "prospect", name: "Prospect" },
    { id: "active", name: "Active" },
    { id: "inactive", name: "Inactive" },
    { id: "on_hold", name: "On Hold" },
  ];

  const token = useMemo(
    () =>
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "",
    []
  );

  // Fetch Staff
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoadingStaff(true);

    fetch(STAFF_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  }, [open, STAFF_API_URL, token]);

  // Fetch Products
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoadingProducts(true);

    fetch(PRODUCT_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      .finally(() => {
        setLoadingProducts(false);
      });

    return () => controller.abort();
  }, [open, PRODUCT_API_URL, token]);

  // Aggregated site totals
  const totalSitesAmount = useMemo(() => {
    return sitesList.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  }, [sitesList]);

  const totalSitesCapacity = useMemo(() => {
    return sitesList.reduce((sum, s) => sum + (parseInt(s.capacity_cars, 10) || 0), 0);
  }, [sitesList]);

  // Product options for react-select inside site form
  const productSelectOptions = useMemo(() => {
    return products
      .filter((p) => p.is_service !== true)
      .map((p) => ({
        value: p.name || String(p.id),
        label: p.name,
      }));
  }, [products]);

  // Automatically sync project_value to totalSitesAmount if sites exist
  useEffect(() => {
    if (totalSitesAmount > 0) {
      setFormData((prev) => ({
        ...prev,
        project_value: String(totalSitesAmount),
      }));
    }
  }, [totalSitesAmount]);

  // Load customer data when editing
  useEffect(() => {
    if (!customer || !open) return;

    const isIndustryOther =
      customer.industry_category &&
      !industryOptions.some((opt) => opt.id === customer.industry_category);

    setFormData({
      customer_code: customer.customer_code || "",
      name: customer.name || "",
      contact_person: customer.contact_person || "",
      designation: customer.designation || "",
      contact_number: customer.contact_number || "",
      email: customer.email || "",
      website: customer.website || "",
      industry_category: isIndustryOther ? "other" : customer.industry_category || "",
      industry_category_other: isIndustryOther ? customer.industry_category : "",
      lead_source: customer.lead_source || "",
      gst_number: customer.gst_number || "",
      pan_number: customer.pan_number || customer.pan || "",
      msme_number: customer.msme_number || "",
      payment_terms: customer.payment_terms || "",
      project_value: customer.project_value || "",
      sales_executive: customer.sales_executive || "",
      amc_start_date: customer.amc_start_date || "",
      amc_end_date: customer.amc_end_date || "",
      customer_status: customer.customer_status || "prospect",
      billing_address: customer.billing_address || customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      pin_code: customer.pin_code || "",
      lead: customer.lead || "",
    });

    // Fetch existing sites for this customer
    if (customer.id) {
      const custParam = customer.id;
      const leadParam = customer.lead ? `&lead=${customer.lead}` : "";
      fetch(`${SITE_API_URL}?customer=${custParam}${leadParam}&limit=100`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const items = Array.isArray(data) ? data : data.results || [];
          setSitesList(items);
        })
        .catch((err) => {
          console.error("Failed to fetch customer sites:", err);
          setSitesList([]);
        });
    }

    setDeletedSiteIds([]);
    setSiteForm(initialSiteForm);
    setEditingSiteIndex(null);
    setShowSiteForm(false);

    // Load states and cities for billing address
    GetState(INDIA_ID).then((states) => {
      const matchedState = states.find(
        (s) => s.name.toLowerCase() === customer.state?.toLowerCase()
      );

      if (matchedState) {
        setStateid(matchedState.id);
        setFormData((prev) => ({ ...prev, state: matchedState.name }));

        GetCity(INDIA_ID, matchedState.id).then((cities) => {
          const matchedCity = cities.find(
            (c) => c.name.toLowerCase() === customer.city?.toLowerCase()
          );
          if (matchedCity) {
            setCityid(matchedCity.id);
            setFormData((prev) => ({ ...prev, city: matchedCity.name }));
          }
        });
      }
    });
  }, [customer, open, SITE_API_URL, token]);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setSitesList([]);
      setDeletedSiteIds([]);
      setSiteForm(initialSiteForm);
      setEditingSiteIndex(null);
      setShowSiteForm(false);
      setFormData({
        customer_code: "",
        name: "",
        contact_person: "",
        designation: "",
        contact_number: "",
        email: "",
        website: "",
        industry_category: "",
        industry_category_other: "",
        lead_source: "",
        gst_number: "",
        pan_number: "",
        msme_number: "",
        payment_terms: "",
        project_value: "",
        sales_executive: !isAdmin && userInfo?.id ? userInfo.id : "",
        amc_start_date: "",
        amc_end_date: "",
        customer_status: "prospect",
        billing_address: "",
        city: "",
        state: "",
        pin_code: "",
        lead: "",
      });
      setLeadLookup("");
      setLeadFound(null);
      setCityid(null);
      setStateid(0);
    }
  }, [open, isAdmin, userInfo]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Lead Lookup
  const handleLeadLookup = async () => {
    if (!leadLookup.trim()) {
      Swal.fire({ icon: "warning", title: "Please enter a Lead ID or Mobile Number" });
      return;
    }

    setLoadingLead(true);
    try {
      const searchQuery = leadLookup.trim();
      let response = await fetch(`${LEAD_API_URL}?search=${searchQuery}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      let data = await response.json();
      let leads = Array.isArray(data) ? data : data.results || [];

      if (leads.length === 0 && !isNaN(searchQuery)) {
        response = await fetch(`${LEAD_API_URL}${searchQuery}/`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (response.ok) {
          const leadData = await response.json();
          leads = [leadData];
        }
      }

      if (leads.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No Lead Found",
          text: "No lead found with this ID or mobile number",
        });
        setLeadFound(null);
        return;
      }

      const lead = leads[0];
      setLeadFound(lead);

      const isLeadIndustryOther =
        lead.industry_type && !industryOptions.some((opt) => opt.id === lead.industry_type);

      setFormData((prev) => ({
        ...prev,
        name: lead.company_name || prev.name,
        contact_person: lead.contact_person || prev.contact_person,
        contact_number: lead.mobile_number || prev.contact_number,
        email: lead.email_address || prev.email,
        city: lead.city || prev.city,
        state: lead.state || prev.state,
        industry_category: isLeadIndustryOther ? "other" : lead.industry_type || prev.industry_category,
        industry_category_other: isLeadIndustryOther
          ? lead.industry_type
          : prev.industry_category_other || "",
        lead_source: lead.lead_source || prev.lead_source,
        lead: lead.id,
        gst_number: lead.gst_number || prev.gst_number,
        pan_number: lead.pan_number || prev.pan_number,
        msme_number: lead.msme_number || prev.msme_number,
      }));

      // Fetch any sites already added to this lead
      fetch(`${SITE_API_URL}?lead=${lead.id}&limit=100`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((siteData) => {
          const sItems = Array.isArray(siteData) ? siteData : siteData.results || [];
          if (sItems.length > 0) {
            setSitesList(sItems);
          }
        })
        .catch(() => {});

      Swal.fire({
        icon: "success",
        title: "Lead Found",
        text: `Lead: ${lead.company_name || lead.contact_person}`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Lead lookup error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to lookup lead",
      });
    } finally {
      setLoadingLead(false);
    }
  };

  // Sites Form Helpers
  const handleSaveSite = () => {
    if (!siteForm.name.trim()) {
      Swal.fire({ icon: "error", title: "Validation", text: "Site Name is required." });
      return;
    }

    const siteObj = {
      ...siteForm,
      name: siteForm.name.trim(),
      amount: siteForm.amount !== "" && siteForm.amount !== null ? siteForm.amount : "",
      capacity_cars:
        siteForm.capacity_cars !== "" && siteForm.capacity_cars !== null
          ? siteForm.capacity_cars
          : "",
      products: Array.isArray(siteForm.products) ? siteForm.products : [],
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

  const handleEditSite = (index) => {
    const target = sitesList[index];
    setSiteForm({
      ...initialSiteForm,
      ...target,
      products: Array.isArray(target.products) ? target.products : [],
    });
    setEditingSiteIndex(index);
    setShowSiteForm(true);
  };

  const handleDeleteSite = (index) => {
    const target = sitesList[index];
    if (target.id) {
      setDeletedSiteIds((prev) => [...prev, target.id]);
    }
    setSitesList((prev) => prev.filter((_, idx) => idx !== index));
    if (editingSiteIndex === index) {
      setSiteForm(initialSiteForm);
      setEditingSiteIndex(null);
      setShowSiteForm(false);
    }
  };

  const validate = () => {
    if (!formData.name.trim()) {
      Swal.fire({ icon: "error", title: "Validation", text: "Company Name is required" });
      return false;
    }

    if (formData.contact_number && formData.contact_number.toString().trim()) {
      const cleanNumber = formData.contact_number.toString().replace(/\D/g, "");
      if (cleanNumber.length !== 10) {
        Swal.fire({
          icon: "error",
          title: "Validation",
          text: "Mobile number must be exactly 10 digits",
        });
        return false;
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Swal.fire({ icon: "error", title: "Validation", text: "Email is invalid" });
      return false;
    }

    if (formData.gst_number && formData.gst_number.trim()) {
      const gstTrimmed = formData.gst_number.trim().toUpperCase();
      if (gstTrimmed.length !== 15) {
        Swal.fire({
          icon: "error",
          title: "Validation",
          text: "GST number must be exactly 15 characters",
        });
        return false;
      }

      const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
      if (!gstPattern.test(gstTrimmed)) {
        Swal.fire({
          icon: "error",
          title: "GST Validation",
          text: "Invalid GST format. Expected format: 22AAAAA0000A1Z5",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      let finalIndustry = formData.industry_category;
      if (finalIndustry === "other") {
        finalIndustry = formData.industry_category_other?.trim() || "other";
      }

      // Compute total project value from all sites
      const calculatedTotalAmount = sitesList.reduce(
        (sum, s) => sum + (parseFloat(s.amount) || 0),
        0
      );

      // Collect all unique products purchased across all customer sites
      const productPurchasedSet = new Set();
      sitesList.forEach((site) => {
        if (Array.isArray(site.products)) {
          site.products.forEach((prodName) => {
            const pKey = String(prodName).trim();
            if (pKey) productPurchasedSet.add(pKey);
          });
        }
      });

      const productPurchasedPayload = Array.from(productPurchasedSet).map((p) => ({
        product: p,
      }));

      const payload = {
        name: formData.name.trim(),
        contact_person: formData.contact_person?.trim() || "",
        designation: formData.designation?.trim() || "",
        contact_number: formData.contact_number?.toString() || "",
        email: formData.email ? String(formData.email).trim() : "",
        website: formData.website?.trim() || "",
        industry_category: finalIndustry || "",
        lead_source: formData.lead_source?.trim() || "",
        gst_number: formData.gst_number?.trim().toUpperCase() || "",
        pan_number: formData.pan_number?.trim().toUpperCase() || "",
        msme_number: formData.msme_number?.trim() || "",
        product_purchased: productPurchasedPayload,
        payment_terms: formData.payment_terms || "",
        project_value:
          calculatedTotalAmount > 0
            ? calculatedTotalAmount
            : formData.project_value
            ? parseFloat(formData.project_value)
            : null,
        sales_executive: formData.sales_executive || null,
        customer_status: formData.customer_status || "prospect",
        billing_address: formData.billing_address?.trim() || "",
        city: formData.city?.trim() || "",
        state: formData.state?.trim() || "",
        pin_code: formData.pin_code?.toString().trim() || "",
        lead: formData.lead || null,
      };

      const url = customer ? `${API_URL}${customer.id}/` : API_URL;
      const method = customer ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        let errorMessage = "";
        if (data) {
          if (typeof data === "object") {
            errorMessage = Object.entries(data)
              .map(([field, messages]) => {
                const msg = Array.isArray(messages) ? messages.join(", ") : messages;
                return `${field}: ${msg}`;
              })
              .join("\n");
          } else {
            errorMessage = data.detail || "Something went wrong";
          }
        } else {
          errorMessage = `${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const savedCustomerId = data?.id || customer?.id;

      // Save/Update each configured site linked to this customer
      if (savedCustomerId) {
        for (const site of sitesList) {
          const sitePayload = {
            customer: savedCustomerId,
            lead: formData.lead || customer?.lead || null,
            name: site.name,
            site_type: site.site_type || "Two-Post Hydraulic Stack Parking",
            capacity_cars:
              site.capacity_cars !== "" && site.capacity_cars !== null
                ? parseInt(site.capacity_cars, 10)
                : 0,
            amount: site.amount !== "" && site.amount !== null ? parseFloat(site.amount) : 0.0,
            products: Array.isArray(site.products) ? site.products : [],
            state: site.state || "",
            city: site.city || "",
            address: site.address || "",
            pincode: site.pincode ? parseInt(site.pincode, 10) : null,
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
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(sitePayload),
              });
            } else {
              await fetch(SITE_API_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(sitePayload),
              });
            }
          } catch (siteErr) {
            console.error("Failed to save site for customer:", siteErr);
          }
        }

        // Delete any removed sites
        for (const delId of deletedSiteIds) {
          try {
            await fetch(`${SITE_API_URL}${delId}/`, {
              method: "DELETE",
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });
          } catch (delErr) {
            console.error("Failed to delete site:", delErr);
          }
        }
      }

      // Check if there's a lead with same mobile number and mark as converted
      if (formData.contact_number && !customer) {
        try {
          const leadRes = await fetch(`${LEAD_API_URL}?search=${formData.contact_number}`, {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (leadRes.ok) {
            const leadData = await leadRes.json();
            const leads = Array.isArray(leadData) ? leadData : leadData.results || [];

            if (leads.length > 0) {
              const lead = leads[0];
              if (!lead.is_converted) {
                await fetch(`${LEAD_API_URL}${lead.id}/`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    converted_to_customer: data.id,
                    is_converted: true,
                  }),
                });
              }
            }
          }
        } catch (err) {
          console.error("Error linking lead to customer:", err);
        }
      }

      Swal.fire({
        icon: "success",
        text: customer ? "Customer updated successfully" : "Customer added successfully",
        timer: 1200,
        showConfirmButton: false,
      });

      onSuccess && onSuccess(data);
      onClose && onClose();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message || "Failed to save customer" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 overflow-y-auto p-2 sm:p-4 animate-fade-in">
        <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-4xl w-full mx-auto my-auto sm:my-8 relative max-h-[96vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
          {/* HEADER */}
          <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-4 sm:px-6 py-3.5 sm:py-4 flex justify-between items-start sm:items-center gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {customer ? "Edit Customer" : "Add New Customer"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 sm:line-clamp-none">
                {customer
                  ? `Code: ${customer.customer_code || "N/A"}`
                  : "Create new customer record with multi-location parking sites and installed products"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              <RxCross2 size={18} />
            </button>
          </div>

          {/* FORM BODY */}
          <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 text-slate-800 scrollbar-thin">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Lead Lookup Section */}
              {!customer && (
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                  <label className="block text-xs font-semibold text-blue-700 mb-2">
                    Lookup Lead
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={leadLookup}
                      onChange={(e) => setLeadLookup(e.target.value)}
                      placeholder="Enter Lead ID or Mobile Number"
                      className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm border border-blue-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleLeadLookup}
                      disabled={loadingLead}
                      className="px-3.5 sm:px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      {loadingLead ? "Searching..." : "Search"}
                    </button>
                  </div>
                  {leadFound && (
                    <div className="mt-2 text-xs text-green-700">
                      ✓ Lead found: {leadFound.company_name || leadFound.contact_person}
                    </div>
                  )}
                </div>
              )}

              {/* COMPANY INFORMATION */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-200">
                  COMPANY INFORMATION
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Customer Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                      value={formData.customer_code || "Auto-generated"}
                      disabled
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="name"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Company name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Contact Person <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="contact_person"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      value={formData.contact_person}
                      onChange={handleChange}
                      placeholder="Primary contact name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Designation</label>
                    <input
                      name="designation"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      value={formData.designation}
                      onChange={handleChange}
                      placeholder="e.g. CTO, IT Manager"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Mobile <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="contact_number"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={formData.contact_number}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Email</label>
                    <input
                      name="email"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="contact@company.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Website</label>
                    <input
                      name="website"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      type="url"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="www.company.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Industry Category</label>
                    <select
                      name="industry_category"
                      value={formData.industry_category}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          industry_category: val,
                          industry_category_other:
                            val !== "other" ? "" : prev.industry_category_other,
                        }));
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select Industry</option>
                      {industryOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    {formData.industry_category === "other" && (
                      <input
                        name="industry_category_other"
                        type="text"
                        className="w-full px-3 py-2 mt-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                        value={formData.industry_category_other}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            industry_category_other: e.target.value,
                          }))
                        }
                        placeholder="Specify other industry..."
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">GST Number</label>
                    <input
                      name="gst_number"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      value={formData.gst_number}
                      onChange={handleChange}
                      maxLength={15}
                      placeholder="29AAGCM0000A1ZP"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">PAN Number</label>
                    <input
                      name="pan_number"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      value={formData.pan_number}
                      onChange={handleChange}
                      maxLength={10}
                      placeholder="AAGCM0000A"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">MSME Number</label>
                    <input
                      name="msme_number"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      value={formData.msme_number}
                      onChange={handleChange}
                      placeholder="UDYAM-XX-XX-XXXXXXX"
                    />
                  </div>
                </div>
              </div>

              {/* COMMERCIAL DETAILS */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-200">
                  COMMERCIAL DETAILS
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Payment Terms</label>
                    <select
                      name="payment_terms"
                      value={formData.payment_terms}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select Payment Terms</option>
                      {paymentTermsOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Total Project Value (₹)
                      {totalSitesAmount > 0 && (
                        <span className="text-[10px] text-emerald-600 font-normal ml-2">
                          (Auto-calculated from {sitesList.length} site{sitesList.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </label>
                    <input
                      name="project_value"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      type="number"
                      value={formData.project_value}
                      onChange={handleChange}
                      placeholder={totalSitesAmount > 0 ? String(totalSitesAmount) : "Amount in ₹"}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Sales Executive
                      {!isAdmin && (
                        <span className="text-[11px] text-blue-600 font-normal ml-1.5">
                          (Auto-mapped to your logged-in account)
                        </span>
                      )}
                    </label>
                    <select
                      name="sales_executive"
                      value={formData.sales_executive}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed"
                      disabled={loadingStaff || (!isAdmin && Boolean(formData.sales_executive))}
                    >
                      <option value="">Select Executive</option>
                      {staffOptions.map((staff) => (
                        <option key={staff.id} value={staff.id}>
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
                    <label className="block text-xs font-semibold text-slate-600">Customer Status</label>
                    <select
                      name="customer_status"
                      value={formData.customer_status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {customerStatusOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* CUSTOMER SITES & PARKING FACILITIES SECTION */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <MdApartment className="text-blue-600 shrink-0" size={17} />
                      <span>CUSTOMER SITES &amp; PARKING FACILITIES</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Add multi-location parking sites and specify products installed per site.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                    {sitesList.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs flex-wrap">
                        <span>{sitesList.length} Site{sitesList.length !== 1 ? "s" : ""}</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-amber-700">🚗 {totalSitesCapacity} Cars</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-emerald-700">₹{totalSitesAmount.toLocaleString("en-IN")}</span>
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
                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer ml-auto sm:ml-0"
                      >
                        <MdAdd size={16} />
                        <span>Add Site</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-form to Add or Edit a Site */}
                {showSiteForm && (
                  <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-xl space-y-3.5 animate-fade-in shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          {editingSiteIndex !== null
                            ? `Edit Site #${editingSiteIndex + 1}`
                            : "Add Customer Parking Site"}
                        </h5>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSiteForm(initialSiteForm);
                          setEditingSiteIndex(null);
                          setShowSiteForm(false);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 cursor-pointer"
                      >
                        <RxCross2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Site Name */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">
                          Site Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={siteForm.name}
                          onChange={(e) =>
                            setSiteForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="e.g. Pune Tech Park Tower 1"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      {/* Site / Parking Type */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">
                          Parking System Type
                        </label>
                        <select
                          value={siteForm.site_type}
                          onChange={(e) =>
                            setSiteForm((prev) => ({ ...prev, site_type: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white text-slate-700 h-[36px]"
                        >
                          {PARKING_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Car Capacity */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">
                          Car Capacity
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={siteForm.capacity_cars}
                            onChange={(e) =>
                              setSiteForm((prev) => ({
                                ...prev,
                                capacity_cars: e.target.value,
                              }))
                            }
                            placeholder="e.g. 50"
                            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">🚗</span>
                        </div>
                      </div>

                      {/* Site Amount */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">
                          Site Amount (₹)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={siteForm.amount}
                            onChange={(e) =>
                              setSiteForm((prev) => ({ ...prev, amount: e.target.value }))
                            }
                            placeholder="e.g. 2500000"
                            className="w-full pl-7 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                            ₹
                          </span>
                        </div>
                      </div>

                      {/* Products for this site */}
                      <div className="space-y-1 sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Products / Services Installed at this Site
                        </label>
                        <CreatableSelect
                          isMulti
                          options={productSelectOptions}
                          value={(siteForm.products || []).map((p) => {
                            const match = productSelectOptions.find(
                              (opt) => opt.value === p || opt.label === p
                            );
                            return match || { value: p, label: p };
                          })}
                          onChange={(selected) => {
                            const values = selected
                              ? selected.map((s) => s.value || s.label)
                              : [];
                            setSiteForm((prev) => ({ ...prev, products: values }));
                          }}
                          placeholder="Select parking models installed at this site..."
                          styles={customSelectStyles}
                          isLoading={loadingProducts}
                          noOptionsMessage={() => "No products found"}
                        />
                      </div>

                      {/* State */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">State</label>
                        <Select
                          options={indianStates}
                          value={indianStates.find((s) => s.value === siteForm.state) || null}
                          onChange={(selected) => {
                            setSiteForm((prev) => ({
                              ...prev,
                              state: selected ? selected.value : "",
                              city: "",
                            }));
                          }}
                          placeholder="Select State..."
                          styles={customSelectStyles}
                          isClearable
                        />
                      </div>

                      {/* City */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">City</label>
                        <Select
                          options={siteCities}
                          value={
                            siteCities.find((c) => c.value === siteForm.city) ||
                            (siteForm.city
                              ? { value: siteForm.city, label: siteForm.city }
                              : null)
                          }
                          onChange={(selected) => {
                            setSiteForm((prev) => ({
                              ...prev,
                              city: selected ? selected.value : "",
                            }));
                          }}
                          placeholder={siteForm.state ? "Select City..." : "Select State first"}
                          styles={customSelectStyles}
                          isDisabled={!siteForm.state}
                          isClearable
                        />
                      </div>

                      {/* Address */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">Site Address</label>
                        <input
                          type="text"
                          value={siteForm.address}
                          onChange={(e) =>
                            setSiteForm((prev) => ({ ...prev, address: e.target.value }))
                          }
                          placeholder="Plot / Street address"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      {/* Pincode */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">Pincode</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={siteForm.pincode}
                          onChange={(e) =>
                            setSiteForm((prev) => ({ ...prev, pincode: e.target.value }))
                          }
                          placeholder="6-digit PIN"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      {/* Site In-Charge */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">
                          Site In-Charge / Supervisor
                        </label>
                        <input
                          type="text"
                          value={siteForm.owner_name}
                          onChange={(e) =>
                            setSiteForm((prev) => ({ ...prev, owner_name: e.target.value }))
                          }
                          placeholder="Supervisor contact person"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      {/* Contact Phone */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-600">Contact Phone</label>
                        <input
                          type="text"
                          maxLength={15}
                          value={siteForm.owner_contact}
                          onChange={(e) =>
                            setSiteForm((prev) => ({
                              ...prev,
                              owner_contact: e.target.value,
                            }))
                          }
                          placeholder="+91 98765 43210"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setSiteForm(initialSiteForm);
                          setEditingSiteIndex(null);
                          setShowSiteForm(false);
                        }}
                        className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSite}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                      >
                        {editingSiteIndex !== null ? "Update Site" : "Save Site"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Display List of Sites */}
                {sitesList.length === 0 && !showSiteForm ? (
                  <div className="text-center py-7 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                    <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                      <MdApartment size={20} />
                    </div>
                    <h5 className="text-xs font-bold text-slate-700">No Sites Added Yet</h5>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                      Register parking sites for this customer. Each site can have its own products and AMC dates or no AMC.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSiteForm(initialSiteForm);
                        setEditingSiteIndex(null);
                        setShowSiteForm(true);
                      }}
                      className="mt-3 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <MdAdd size={15} />
                      <span>Add First Site</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sitesList.map((site, idx) => (
                      <div
                        key={site.id || idx}
                        className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-all shadow-2xs space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-slate-900 block leading-tight truncate">
                                {site.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                <MdDirectionsCar size={12} className="text-blue-500 shrink-0" />
                                <span className="truncate">
                                  {site.site_type || "Parking Facility"}
                                </span>
                              </span>
                            </div>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              {site.status || "Active"}
                            </span>
                          </div>

                          {/* Chips */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {site.capacity_cars > 0 && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                🚗 {site.capacity_cars} Cars
                              </span>
                            )}
                            {site.amount ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ₹{parseFloat(site.amount).toLocaleString("en-IN")}
                              </span>
                            ) : null}
                          </div>

                          {/* Products */}
                          {Array.isArray(site.products) && site.products.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {site.products.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-100"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Location */}
                          {(site.city || site.state || site.address) && (
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                              <MdLocationOn size={12} className="text-rose-500 shrink-0" />
                              <span className="truncate">
                                {[site.address, site.city, site.state].filter(Boolean).join(", ")}
                              </span>
                            </p>
                          )}

                          {/* Contact */}
                          {site.owner_name && (
                            <p className="text-[10px] text-slate-500 flex items-center justify-between">
                              <span>
                                In-Charge: <strong className="text-slate-700">{site.owner_name}</strong>
                              </span>
                              {site.owner_contact && (
                                <span className="text-blue-600 font-medium">
                                  {site.owner_contact}
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* Footer actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-mono">
                            Site #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditSite(idx)}
                              className="px-2 py-0.5 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSite(idx)}
                              className="px-2 py-0.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BILLING ADDRESS */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-200">
                  BILLING ADDRESS
                </h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Billing Address
                    </label>
                    <textarea
                      name="billing_address"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                      value={formData.billing_address}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Full billing address"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">City</label>
                      <div className="input-like-select text-sm mt-0.5">
                        <CitySelect
                          key={`city-billing-${stateid}`}
                          countryid={INDIA_ID}
                          stateid={stateid}
                          defaultValue={
                            customer && cityid ? { id: cityid, name: formData.city } : null
                          }
                          onChange={(e) => {
                            setCityid(e.id);
                            setFormData((prev) => ({ ...prev, city: e.name }));
                          }}
                          placeHolder="Select City"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">State</label>
                      <div className="input-like-select text-sm mt-0.5">
                        <StateSelect
                          countryid={INDIA_ID}
                          defaultValue={
                            customer && stateid ? { id: stateid, name: formData.state } : null
                          }
                          onChange={(e) => {
                            setStateid(e.id);
                            setFormData((prev) => ({ ...prev, state: e.name, city: "" }));
                            setCityid(0);
                          }}
                          placeHolder="Select State"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">Pin Code</label>
                      <input
                        name="pin_code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                        value={formData.pin_code}
                        onChange={handleChange}
                        placeholder="6-digit PIN"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer text-center"
                  disabled={loading}
                >
                  {loading
                    ? customer
                      ? "Updating..."
                      : "Saving..."
                    : customer
                    ? "Update Customer"
                    : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>
        {`
          .input-like-select .rsc-select-container {
            width: 100% !important;
          }
          
          .input-like-select .rsc-select-input {
            width: 100% !important;
            padding: 0.5rem 0.75rem !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 0.5rem !important;
            font-size: 0.875rem !important;
            background-color: #fff !important;
            color: #1e293b !important;
            padding-right: 0.75rem !important;
          }
          
          .input-like-select .rsc-select-input:focus {
            outline: none !important;
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 1px #3b82f6 !important;
          }
          
          .input-like-select svg {
            display: none !important;
          }
        `}
      </style>
    </>
  );
}
