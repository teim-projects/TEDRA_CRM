import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  MdClose,
  MdArrowBack,
  MdMail,
  MdCall,
  MdEdit,
  MdAdd,
  MdOutlineRemoveRedEye,
  MdEngineering,
  MdCheckCircle,
  MdAccessTime,
  MdWarningAmber,
  MdOutlinePayment,
  MdLocationOn,
  MdBusiness,
  MdDescription,
  MdReceiptLong,
  MdOutlineBuild,
  MdAccountBalance,
  MdFilterList,
  MdCardGiftcard,
  MdAddLocationAlt,
  MdDirectionsCar,
  MdDelete,
  MdApartment,
  MdPhone,
  MdViewModule,
  MdViewList,
  MdSearch,
  MdOutlineNavigateBefore,
  MdOutlineNavigateNext,
  MdAssignment,
} from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";
import SendMessageModal from "../templates/SendMessageModal";
import AddSiteModal from "./AddSiteModal";
import TableView from "../TableView";

export default function CustomerDetailView({
  customer,
  onBack,
  onEdit,
  onRefresh,
  baseApi,
  token,
  formatDate,
  canEdit = true,
  canDelete = true,
  productList = [],
}) {
  const navigate = useNavigate();
  const BASE_API = (baseApi || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "sites" | "services" | "amc" | "quotations" | "projects" | "referrals"
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Related data states
  const [sites, setSites] = useState([]);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [services, setServices] = useState([]);
  const [amcContracts, setAmcContracts] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [referralPoints, setReferralPoints] = useState(0);
  const [loadingRelated, setLoadingRelated] = useState(true);

  // Send message modal
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState("email");

  const customerId = customer?.id;
  const customerName = customer?.name || customer?.company_name || "Customer";
  const customerPhone = customer?.contact_number || customer?.phone || "";
  const customerEmail = customer?.email || "";
  const contactPerson = customer?.contact_person || "Primary Contact";
  const salesExecutiveName =
    customer?.sales_executive_details?.full_name ||
    customer?.sales_executive_details?.first_name ||
    customer?.sales_executive_name ||
    "—";

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // Fetch all related context (Services, AMC Contracts, Quotations, Projects, Referrals)
  const fetchCustomerRelatedData = useCallback(async () => {
    if (!customerId) return;
    setLoadingRelated(true);

    try {
      const leadIdParam = customer?.lead || customer?.lead_id ? `&lead=${customer.lead || customer.lead_id}` : "";
      const [srvRes, amcRes, quoteRes, prjRes, refRes, siteRes] = await Promise.allSettled([
        fetch(`${BASE_API}/amc/services/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/amc/contracts/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/quotation/quotation/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/lead/projects/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/lead/customer/${customerId}/referrals/`, { headers: authHeaders }),
        fetch(`${BASE_API}/api/site/?customer=${customerId}${leadIdParam}&limit=100`, { headers: authHeaders }),
      ]);

      // Sites
      if (siteRes.status === "fulfilled" && siteRes.value.ok) {
        const data = await siteRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setSites(list);
      }

      // Services
      if (srvRes.status === "fulfilled" && srvRes.value.ok) {
        const data = await srvRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setServices(list);
      }

      // AMC Contracts
      if (amcRes.status === "fulfilled" && amcRes.value.ok) {
        const data = await amcRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setAmcContracts(list);
      }

      // Quotations
      if (quoteRes.status === "fulfilled" && quoteRes.value.ok) {
        const data = await quoteRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setQuotations(list);
      }

      // Projects
      if (prjRes.status === "fulfilled" && prjRes.value.ok) {
        const data = await prjRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setProjects(list);
      }

      // Referrals
      if (refRes.status === "fulfilled" && refRes.value.ok) {
        const data = await refRes.value.json();
        const list = Array.isArray(data.referrals) ? data.referrals : [];
        setReferrals(list);
        setReferralPoints(data.referral_points !== undefined ? data.referral_points : list.length);
      } else if (customer?.referred_leads) {
        const list = Array.isArray(customer.referred_leads) ? customer.referred_leads : [];
        setReferrals(list);
        setReferralPoints(customer.referral_points !== undefined ? customer.referral_points : list.length);
      }
    } catch (err) {
      console.error("Error fetching customer related context:", err);
    } finally {
      setLoadingRelated(false);
    }
  }, [customerId, BASE_API, authHeaders, customer]);

  useEffect(() => {
    if (customer?.referred_leads) {
      const list = Array.isArray(customer.referred_leads) ? customer.referred_leads : [];
      setReferrals(list);
      setReferralPoints(customer.referral_points !== undefined ? customer.referral_points : list.length);
    }
  }, [customer]);

  useEffect(() => {
    fetchCustomerRelatedData();
  }, [fetchCustomerRelatedData]);

  const handleDeleteSite = async (siteId, siteName) => {
    const result = await Swal.fire({
      title: "Delete Site?",
      text: `Are you sure you want to delete site "${siteName || "this site"}"? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${BASE_API}/api/site/${siteId}/`, {
          method: "DELETE",
          headers: authHeaders,
        });

        if (res.ok) {
          Swal.fire({
            icon: "success",
            title: "Site Deleted",
            text: `Site "${siteName}" has been deleted.`,
            timer: 1500,
            showConfirmButton: false,
          });
          fetchCustomerRelatedData();
        } else {
          throw new Error("Failed to delete site.");
        }
      } catch (err) {
        Swal.fire("Error", err.message || "Failed to delete site.", "error");
      }
    }
  };

  const handleConvertSiteToProject = async (site) => {
    if (!site || !site.id) return;

    const result = await Swal.fire({
      title: "Convert Site to Project?",
      text: `Create a new Project for site "${site.name}" under ${customerName}? Site value (₹${parseFloat(site.amount || 0).toLocaleString("en-IN")}), products, and AMC dates will be linked to the Project.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Convert to Project",
      confirmButtonColor: "#059669",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${BASE_API}/api/site/${site.id}/convert-to-project/`, {
        method: "POST",
        headers: authHeaders,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to convert site to project");
      }

      await Swal.fire({
        icon: "success",
        title: "Success!",
        text: data.message || `Site converted to Project (${data.project_code || "Success"})`,
        timer: 1800,
        showConfirmButton: false,
      });

      await fetchCustomerRelatedData();
      setActiveTab("projects");
    } catch (err) {
      console.error("Convert site to project error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to convert site to project",
      });
    }
  };

  // Format date helper fallback
  const formatDt = useCallback(
    (dateStr) => {
      if (!dateStr) return "—";
      if (typeof formatDate === "function") return formatDate(dateStr);
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      } catch {
        return dateStr;
      }
    },
    [formatDate]
  );

  // Site viewing states (Cards vs Table, search, filter)
  const [siteViewMode, setSiteViewMode] = useState("cards"); // "cards" by default
  const [siteSearchQuery, setSiteSearchQuery] = useState("");
  const [siteStatusFilter, setSiteStatusFilter] = useState("all");
  const SITE_PAGE_SIZE = 8;

  // Global Site Filter for Customer Detail View
  const [selectedSiteId, setSelectedSiteId] = useState("all");

  const selectedSite = useMemo(() => {
    if (selectedSiteId === "all") return null;
    return sites.find((s) => String(s.id) === String(selectedSiteId)) || null;
  }, [sites, selectedSiteId]);

  // Pagination states for related tabs
  const [sitePage, setSitePage] = useState(1);
  const [servicePage, setServicePage] = useState(1);
  const [amcPage, setAmcPage] = useState(1);
  const [quotationPage, setQuotationPage] = useState(1);
  const [projectPage, setProjectPage] = useState(1);
  const [referralPage, setReferralPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setSelectedSiteId("all");
    setSitePage(1);
    setServicePage(1);
    setAmcPage(1);
    setQuotationPage(1);
    setProjectPage(1);
    setReferralPage(1);
  }, [customer?.id]);

  useEffect(() => {
    setSitePage(1);
    setServicePage(1);
    setAmcPage(1);
    setQuotationPage(1);
    setProjectPage(1);
  }, [selectedSiteId]);

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (siteStatusFilter !== "all" && site.status !== siteStatusFilter) {
        return false;
      }
      if (siteSearchQuery.trim()) {
        const q = siteSearchQuery.toLowerCase();
        const matchName = (site.name || "").toLowerCase().includes(q);
        const matchCode = (site.site_shortcut || "").toLowerCase().includes(q);
        const matchType = (site.site_type || "").toLowerCase().includes(q);
        const matchCity = (site.city || "").toLowerCase().includes(q);
        const matchState = (site.state || "").toLowerCase().includes(q);
        const matchOwner = (site.owner_name || "").toLowerCase().includes(q);
        return matchName || matchCode || matchType || matchCity || matchState || matchOwner;
      }
      return true;
    });
  }, [sites, siteSearchQuery, siteStatusFilter]);

  // Site-filtered datasets
  const visibleSites = useMemo(() => {
    if (selectedSiteId === "all") return filteredSites;
    return filteredSites.filter((s) => String(s.id) === String(selectedSiteId));
  }, [filteredSites, selectedSiteId]);

  const visibleProjects = useMemo(() => {
    if (selectedSiteId === "all") return projects;
    return projects.filter((p) => {
      const siteVal = p.site?.id || p.site || p.site_details?.id;
      return String(siteVal) === String(selectedSiteId);
    });
  }, [projects, selectedSiteId]);

  const visibleAmcContracts = useMemo(() => {
    if (selectedSiteId === "all") return amcContracts;
    return amcContracts.filter((c) => {
      const siteVal =
        c.site?.id ||
        c.site ||
        c.site_details?.id ||
        c.project_details?.site?.id ||
        c.project_details?.site ||
        c.project_details?.site_details?.id;
      return String(siteVal) === String(selectedSiteId);
    });
  }, [amcContracts, selectedSiteId]);

  const visibleServices = useMemo(() => {
    if (selectedSiteId === "all") return services;
    return services.filter((s) => {
      const siteVal =
        s.site?.id ||
        s.site ||
        s.site_details?.id ||
        s.amc_contract_details?.site?.id ||
        s.amc_contract_details?.site ||
        s.amc_contract_details?.site_details?.id ||
        s.project_details?.site?.id ||
        s.project_details?.site ||
        s.project_details?.site_details?.id;
      return String(siteVal) === String(selectedSiteId);
    });
  }, [services, selectedSiteId]);

  const visibleQuotations = useMemo(() => {
    if (selectedSiteId === "all") return quotations;
    if (!selectedSite) return quotations;
    const sName = (selectedSite.name || "").toLowerCase().trim();
    const sCode = (selectedSite.site_shortcut || "").toLowerCase().trim();
    return quotations.filter((q) => {
      const shipTo = (q.ship_to_company_name || q.site_name || q.ship_to_address || "").toLowerCase();
      if (sName && shipTo.includes(sName)) return true;
      if (sCode && shipTo.includes(sCode)) return true;
      return false;
    });
  }, [quotations, selectedSiteId, selectedSite]);

  const totalSitesValue = useMemo(() => {
    return visibleSites.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  }, [visibleSites]);

  const totalSitesCapacity = useMemo(() => {
    return visibleSites.reduce((sum, s) => sum + (parseInt(s.capacity_cars, 10) || 0), 0);
  }, [visibleSites]);

  const totalSitePages = useMemo(
    () => Math.max(1, Math.ceil(visibleSites.length / SITE_PAGE_SIZE)),
    [visibleSites.length]
  );

  const pagedSites = useMemo(
    () => visibleSites.slice((sitePage - 1) * SITE_PAGE_SIZE, sitePage * SITE_PAGE_SIZE),
    [visibleSites, sitePage]
  );
  const pagedServices = useMemo(
    () => visibleServices.slice((servicePage - 1) * PAGE_SIZE, servicePage * PAGE_SIZE),
    [visibleServices, servicePage]
  );
  const pagedAmcContracts = useMemo(
    () => visibleAmcContracts.slice((amcPage - 1) * PAGE_SIZE, amcPage * PAGE_SIZE),
    [visibleAmcContracts, amcPage]
  );
  const pagedQuotations = useMemo(
    () => visibleQuotations.slice((quotationPage - 1) * PAGE_SIZE, quotationPage * PAGE_SIZE),
    [visibleQuotations, quotationPage]
  );
  const pagedProjects = useMemo(
    () => visibleProjects.slice((projectPage - 1) * PAGE_SIZE, projectPage * PAGE_SIZE),
    [visibleProjects, projectPage]
  );
  const pagedReferrals = useMemo(
    () => referrals.slice((referralPage - 1) * PAGE_SIZE, referralPage * PAGE_SIZE),
    [referrals, referralPage]
  );

  // Table Column Definitions
  const siteColumns = useMemo(
    () => [
      {
        key: "name",
        label: "Site Name",
        render: (site) => (
          <div className="flex items-center gap-1.5 justify-center">
            <span className="font-bold text-sky-800 text-xs">{site.name}</span>
            {site.site_shortcut && (
              <span className="text-[9px] font-mono font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded">
                {site.site_shortcut}
              </span>
            )}
          </div>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "site_type",
        label: "Parking System Type",
        render: (site) => (
          <span className="inline-flex items-center gap-1 font-medium text-slate-700 text-xs">
            <MdDirectionsCar size={13} className="text-cyan-600" />
            {site.site_type || "Standard Parking"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "capacity_cars",
        label: "Capacity",
        render: (site) =>
          site.capacity_cars ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
              {site.capacity_cars} Cars
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
        className: "whitespace-nowrap",
      },
      {
        key: "amount",
        label: "Site Value",
        render: (site) => (
          <span className="font-bold text-emerald-700 text-xs whitespace-nowrap">
            {site.amount ? `₹${parseFloat(site.amount).toLocaleString("en-IN")}` : "—"}
          </span>
        ),
        className: "whitespace-nowrap text-right",
      },
      {
        key: "address",
        label: "Location / Address",
        render: (site) => (
          <span
            className="text-xs text-slate-600 truncate max-w-xs block mx-auto"
            title={[site.address, site.city, site.state, site.pincode].filter(Boolean).join(", ")}
          >
            {[site.address, site.city, site.state, site.pincode].filter(Boolean).join(", ") || "—"}
          </span>
        ),
        className: "max-w-xs",
      },
      {
        key: "owner_name",
        label: "Supervisor",
        render: (site) => (
          <span className="text-slate-700 text-xs font-medium">
            {site.owner_name || "—"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "owner_contact",
        label: "Contact",
        render: (site) =>
          site.owner_contact ? (
            <a
              href={`tel:${site.owner_contact}`}
              className="text-sky-600 hover:underline font-mono inline-flex items-center gap-1 text-xs"
            >
              <MdPhone size={12} />
              {site.owner_contact}
            </a>
          ) : (
            <span className="text-slate-400">—</span>
          ),
        className: "whitespace-nowrap",
      },
      {
        key: "status",
        label: "Status",
        render: (site) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              site.status === "Active"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : site.status === "Under Installation"
                ? "bg-sky-50 text-sky-700 border-sky-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {site.status || "Active"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "project",
        label: "Project",
        render: (site) => {
          const siteProject =
            projects.find((p) => p.site === site.id || p.site_details?.id === site.id) ||
            (site.has_project ? site.project_details : null);
          if (siteProject) {
            return (
              <button
                type="button"
                onClick={() => setActiveTab("projects")}
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-pointer transition-colors"
                title={`Linked to Project ${siteProject.project_code || siteProject.id} (Click to view)`}
              >
                <span>📁 {siteProject.project_code || "Project"}</span>
              </button>
            );
          }
          return (
            <button
              type="button"
              onClick={() => handleConvertSiteToProject(site)}
              className="text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs hover:bg-sky-100"
              title="Convert this site to a Project"
            >
              <MdAssignment size={11} className="text-sky-600" />
              <span>+ To Project</span>
            </button>
          );
        },
        className: "whitespace-nowrap text-center",
      },
    ],
    [projects, handleConvertSiteToProject]
  );

  const serviceColumns = useMemo(
    () => [
      {
        key: "service_number",
        label: "Service No",
        render: (srv) => (
          <span className="font-bold text-sky-700 whitespace-nowrap text-xs">
            {srv.service_number || `#SRV-${srv.id}`}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "service_date",
        label: "Date",
        render: (srv) => (
          <span className="text-slate-600 whitespace-nowrap text-xs">
            {formatDt(srv.service_date)}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "service_type",
        label: "Type",
        render: (srv) => (
          <span className="font-medium text-slate-800 whitespace-nowrap capitalize text-xs">
            {srv.service_type_display || srv.service_type || "Routine"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "site",
        label: "Facility / Site",
        render: (srv) => {
          const siteObj = srv.site_details || srv.amc_contract_details?.site_details || srv.project_details?.site_details;
          const sName = srv.site_name || siteObj?.name || srv.site?.name;
          const sCode = srv.site_shortcut || siteObj?.site_shortcut || srv.site?.site_shortcut;
          return (
            <div className="whitespace-nowrap">
              {sName ? (
                <div>
                  <span className="font-semibold text-slate-800 text-xs inline-flex items-center gap-1">
                    <span>📍</span>
                    <span>{sName}</span>
                  </span>
                  {sCode && (
                    <span className="text-[10px] font-mono text-sky-600 font-medium block">
                      ({sCode})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 text-xs">—</span>
              )}
            </div>
          );
        },
        className: "whitespace-nowrap",
      },
      {
        key: "service_category",
        label: "Category",
        render: (srv) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
              srv.service_category === "amc_service"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {srv.service_category === "amc_service" ? "AMC Service" : "On-Demand"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "technician",
        label: "Technician",
        render: (srv) => {
          const techs = Array.isArray(srv.technicians_details) ? srv.technicians_details : [];
          const techName = techs[0]
            ? `${techs[0].first_name || ""} ${techs[0].last_name || ""}`.trim() || techs[0].username
            : srv.service_engineer_details?.full_name || "Unassigned";
          return (
            <span className="inline-flex items-center gap-1 font-medium text-slate-700 text-xs whitespace-nowrap">
              <MdEngineering size={12} className="text-slate-400" />
              {techName}
            </span>
          );
        },
        className: "whitespace-nowrap",
      },
      {
        key: "status",
        label: "Status",
        render: (srv) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize whitespace-nowrap ${
              srv.status === "completed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : srv.status === "in_progress"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : srv.status === "cancelled"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {srv.status_display || srv.status || "Scheduled"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "service_cost",
        label: "Cost",
        render: (srv) => (
          <span className="font-semibold text-slate-900 whitespace-nowrap text-xs">
            ₹{parseFloat(srv.service_cost || 0).toLocaleString("en-IN")}
          </span>
        ),
        className: "whitespace-nowrap text-right",
      },
    ],
    [formatDt]
  );

  const amcColumns = useMemo(
    () => [
      {
        key: "contract_id",
        label: "Contract ID",
        render: (c) => (
          <span className="font-bold text-sky-700 whitespace-nowrap text-xs">
            {c.contract_id || `#AMC-${c.id}`}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "period",
        label: "Period (Start — End)",
        render: (c) => (
          <span className="text-slate-700 whitespace-nowrap text-xs">
            <span className="font-medium text-slate-800">{formatDt(c.start_date)}</span>
            <span className="text-slate-400 mx-1">to</span>
            <span className="font-medium text-slate-800">{formatDt(c.end_date)}</span>
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "annual_value",
        label: "Annual Value",
        render: (c) => (
          <span className="font-bold text-emerald-700 whitespace-nowrap text-xs">
            ₹{parseFloat(c.annual_value || 0).toLocaleString("en-IN")}
          </span>
        ),
        className: "whitespace-nowrap text-right",
      },
      {
        key: "frequency",
        label: "Frequency & Visits",
        render: (c) => (
          <div className="text-slate-700 whitespace-nowrap capitalize text-xs">
            <span className="font-semibold block">{c.service_frequency_display || c.service_frequency || "Quarterly"}</span>
            <span className="text-[10px] text-slate-500 block">
              ({c.no_of_visits !== undefined && c.no_of_visits !== null ? c.no_of_visits : 4} visits)
            </span>
          </div>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "coordinator",
        label: "Coordinator",
        render: (c) => (
          <span className="text-slate-700 whitespace-nowrap text-xs">
            {c.support_coordinator_details?.full_name || c.support_coordinator_details?.username || "—"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "status",
        label: "Status",
        render: (c) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize whitespace-nowrap ${
              c.status === "active"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : c.status === "renewed"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : c.status === "expired"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {c.status_display || c.status || "Active"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
    ],
    [formatDt]
  );

  const quotationColumns = useMemo(
    () => [
      {
        key: "quotation_number",
        label: "Quotation No",
        render: (q) => (
          <div className="whitespace-nowrap">
            <span className="font-bold text-sky-700 text-xs">
              {q.quotation_number || `#QT-${q.id}`}
            </span>
            {q.is_dropped && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-slate-700 text-white rounded text-[9px] font-extrabold">
                DROPPED
              </span>
            )}
          </div>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "date",
        label: "Date",
        render: (q) => (
          <span className="text-slate-600 whitespace-nowrap text-xs">
            {formatDt(q.quotation_date || q.created_at)}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "subject",
        label: "Subject / Purpose",
        render: (q) => (
          <span className="text-slate-800 text-xs truncate max-w-xs block mx-auto" title={q.subject || ""}>
            {q.subject || "Car Parking System"}
          </span>
        ),
        className: "max-w-xs",
      },
      {
        key: "location",
        label: "Location",
        render: (q) => (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium whitespace-nowrap">
            {q.quotation_for || "Pune"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "grand_total",
        label: "Grand Total",
        render: (q) => {
          const quoteAmount = parseFloat(q.latest_version_details?.grand_total || q.total_amount || 0);
          return (
            <span className="font-bold text-slate-900 whitespace-nowrap text-xs">
              ₹{quoteAmount.toLocaleString("en-IN")}
            </span>
          );
        },
        className: "whitespace-nowrap text-right",
      },
      {
        key: "status",
        label: "Status",
        render: (q) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
              q.is_finalized
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : q.is_dropped
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {q.is_finalized ? "Finalized" : q.is_dropped ? "Dropped" : "Draft"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
    ],
    [formatDt]
  );

  const projectColumns = useMemo(
    () => [
      {
        key: "project_code",
        label: "Project Code",
        render: (p) => (
          <span className="font-bold text-sky-700 whitespace-nowrap text-xs">
            {p.project_code || `PRJ-${p.id}`}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "project_name",
        label: "Project Name",
        render: (p) => (
          <span className="font-semibold text-slate-800 whitespace-nowrap text-xs">
            {p.project_name || "—"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "site",
        label: "Site & Installation Address",
        render: (p) => {
          const sName = p.site_details?.name || p.site_name;
          const sAddr = [
            p.site_details?.address,
            p.site_details?.city,
            p.site_details?.state,
            p.site_details?.pincode,
          ]
            .filter(Boolean)
            .join(", ");
          return sName ? (
            <div className="flex flex-col text-left max-w-[200px]">
              <span className="font-medium text-cyan-700 whitespace-nowrap text-xs bg-cyan-50 border border-cyan-200/70 px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit">
                📍 {sName}
              </span>
              {sAddr && (
                <span className="text-[10px] text-slate-500 mt-0.5 truncate" title={sAddr}>
                  {sAddr}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          );
        },
        className: "whitespace-nowrap",
      },
      {
        key: "project_stage",
        label: "Stage",
        render: (p) => (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-100 capitalize whitespace-nowrap">
            {p.project_stage_display || p.project_stage || "Initiation"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "priority",
        label: "Priority",
        render: (p) => (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize whitespace-nowrap">
            {p.priority_display || p.priority || "Medium"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "expected_to_go_live",
        label: "Go-Live",
        render: (p) => (
          <span className="text-slate-600 whitespace-nowrap text-xs">
            {formatDt(p.expected_to_go_live || p.start_date)}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "project_value",
        label: "Value",
        render: (p) => (
          <span className="font-bold text-slate-900 whitespace-nowrap text-xs">
            ₹{parseFloat(p.project_value || 0).toLocaleString("en-IN")}
          </span>
        ),
        className: "whitespace-nowrap text-right",
      },
      {
        key: "executive",
        label: "Executive",
        render: (p) => (
          <span className="text-slate-700 whitespace-nowrap text-xs">
            {p.project_executive_details?.full_name || p.project_executive_details?.username || "—"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
    ],
    [formatDt]
  );

  const referralColumns = useMemo(
    () => [
      {
        key: "company_name",
        label: "Referred Lead / Company",
        render: (ref) => (
          <div className="whitespace-nowrap">
            <span className="font-bold text-slate-900 block text-xs">
              {ref.company_name || "Unnamed"}
            </span>
            <span className="text-[10px] text-slate-400">Lead #{ref.id}</span>
          </div>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "contact_person",
        label: "Contact Person",
        render: (ref) => (
          <span className="text-slate-700 font-medium text-xs whitespace-nowrap">
            {ref.contact_person || "—"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "phone_email",
        label: "Phone & Email",
        render: (ref) => (
          <div className="whitespace-nowrap">
            {ref.mobile_number && (
              <span className="text-slate-800 font-medium block text-xs">
                {ref.mobile_number}
              </span>
            )}
            {ref.email_address && (
              <span className="text-[10px] text-slate-400 block truncate max-w-[160px] mx-auto">
                {ref.email_address}
              </span>
            )}
            {!ref.mobile_number && !ref.email_address && <span className="text-slate-400">—</span>}
          </div>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "enquiry_date",
        label: "Date Referred",
        render: (ref) => (
          <span className="text-slate-600 whitespace-nowrap text-xs">
            {ref.enquiry_date ? formatDt(ref.enquiry_date) : ref.created_at ? formatDt(ref.created_at) : "—"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "pipeline_stage",
        label: "Pipeline Stage",
        render: (ref) => (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            {ref.pipeline_stage_display || ref.pipeline_stage || "New Lead"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "status",
        label: "Status",
        render: (ref) => (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
              ref.status === "close_win"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : ref.status === "close_loss"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-sky-50 text-sky-700 border border-sky-200"
            }`}
          >
            {ref.status_display || ref.status || "Active"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "conversion",
        label: "Conversion",
        render: (ref) => (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
              ref.is_converted
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {ref.is_converted ? "✓ Won / Converted" : "In Pipeline"}
          </span>
        ),
        className: "whitespace-nowrap",
      },
      {
        key: "points",
        label: "Points Awarded",
        render: () => (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
            <MdCardGiftcard size={12} className="text-amber-600" />
            <span>+1 Point</span>
          </span>
        ),
        className: "whitespace-nowrap",
      },
    ],
    [formatDt]
  );

  if (!customer) return null;

  // Helper to resolve product names
  const resolveProducts = (productPurchased) => {
    if (!productPurchased) return [];
    if (Array.isArray(productPurchased)) {
      return productPurchased.map((item) => {
        if (typeof item === "object" && item !== null) {
          return item.name || item.product_name || item.title || JSON.stringify(item);
        }
        if (productList.length > 0) {
          const match = productList.find((p) => String(p.id) === String(item));
          if (match) return match.name;
        }
        return String(item);
      });
    }
    return [String(productPurchased)];
  };

  // Helper for Status badge color
  const getCustomerStatusBadge = (status) => {
    switch (String(status).toLowerCase()) {
      case "active":
        return {
          pill: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
          dot: "bg-emerald-500",
          label: "Active Customer",
        };
      case "prospect":
        return {
          pill: "bg-sky-50 text-sky-700 border-sky-200/60",
          dot: "bg-sky-500",
          label: "Prospect",
        };
      case "on_hold":
        return {
          pill: "bg-amber-50 text-amber-700 border-amber-200/60",
          dot: "bg-amber-500",
          label: "On Hold",
        };
      case "inactive":
        return {
          pill: "bg-slate-100 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
          label: "Inactive",
        };
      default:
        return {
          pill: "bg-slate-50 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
          label: customer.customer_status_display || customer.customer_status || "Customer",
        };
    }
  };

  const statusMeta = getCustomerStatusBadge(customer.customer_status);

  // KPI Calculations (Filtered by selected site)
  const completedServicesCount = visibleServices.filter((s) => s.status === "completed").length;
  const upcomingServicesCount = visibleServices.filter((s) => s.status === "scheduled" || s.status === "in_progress").length;

  const activeAmcContracts = visibleAmcContracts.filter((c) => c.status === "active");
  const totalAnnualAmc = visibleAmcContracts.reduce((sum, c) => sum + parseFloat(c.annual_value || 0), 0);

  const totalQuotationValue = visibleQuotations.reduce((sum, q) => {
    const val = parseFloat(q.latest_version_details?.grand_total || q.total_amount || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Communication handlers
  const openWhatsAppModal = () => {
    setMessageChannel("whatsapp");
    setMessageModalOpen(true);
  };

  const openEmailModal = () => {
    setMessageChannel("email");
    setMessageModalOpen(true);
  };

  const handleCall = () => {
    if (!customerPhone) {
      Swal.fire({ icon: "info", text: "No mobile number recorded for this customer." });
      return;
    }
    window.location.href = `tel:${customerPhone}`;
  };

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pb-10 animate-fade-in text-xs">
      {/* 2. MAIN CUSTOMER SUMMARY CARD (Exact UI match with FollowupHistoryView & Figma) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-7 space-y-6">
        {/* Top Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Customer Code */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100 uppercase tracking-wide">
                {customer.customer_code || `CUST-${String(customer.id).padStart(4, "0")}`}
              </span>
              {customer.lead && (
                <span className="text-[10px] text-slate-400">
                  Converted from Lead #{customer.lead}
                </span>
              )}
            </div>

            {/* Company Name */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              {customerName}
            </h1>

            {/* Subtitle with Contact Details */}
            <p className="text-[11px] text-slate-500 font-normal mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-slate-700">{contactPerson}</span>
              {customer.designation && <span>({customer.designation})</span>}
              <span>·</span>
              <span>Executive: <strong className="text-slate-800">{salesExecutiveName}</strong></span>
              {(customer.city || customer.state) && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 text-slate-600">
                    <MdLocationOn size={13} className="text-slate-400" />
                    {[customer.city, customer.state].filter(Boolean).join(", ")}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Right: Status Pill & Communication Actions */}
          <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
            {/* Site Dropdown Selector */}
            {sites.length > 0 && (
              <div className="flex items-center gap-1.5 bg-sky-50/90 hover:bg-sky-100/90 border border-sky-200 hover:border-sky-300 rounded-lg px-2.5 py-1 transition-all shadow-2xs">
                <MdLocationOn size={15} className="text-sky-600 shrink-0" />
                <span className="text-[11px] font-bold text-sky-900 whitespace-nowrap hidden sm:inline">Site:</span>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 pr-1 outline-none cursor-pointer max-w-[170px] truncate"
                  title="Filter customer data by selected site"
                >
                  <option value="all">All Sites ({sites.length})</option>
                  {sites.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} {s.site_shortcut ? `(${s.site_shortcut})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Pill Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border shadow-2xs whitespace-nowrap ${statusMeta.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}></span>
              {statusMeta.label}
            </span>

            {/* Action Buttons: WhatsApp, Email, Phone, Edit */}
            <div className="flex items-center gap-1 border-l border-slate-200/80 pl-2 text-slate-500">
              <button
                type="button"
                onClick={openWhatsAppModal}
                className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title="Send WhatsApp Message"
              >
                <FaWhatsapp size={16} />
              </button>
              <button
                type="button"
                onClick={openEmailModal}
                className="p-1.5 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                title="Send Email"
              >
                <MdMail size={16} />
              </button>
              <button
                type="button"
                onClick={handleCall}
                className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title={`Call ${customerPhone || ""}`}
              >
                <MdCall size={16} />
              </button>

              {/* Add Site Action Button */}
              <button
                type="button"
                onClick={() => {
                  setEditingSite(null);
                  setShowAddSiteModal(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/90 rounded-lg transition-colors cursor-pointer shadow-2xs mx-0.5"
                title="Add New Site for this Customer"
              >
                <MdAddLocationAlt size={15} />
                <span>Add Site</span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit && onEdit(customer)}
                  className="p-1.5 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Customer Details"
                >
                  <MdEdit size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={onBack}
                className="p-1.5 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600 ml-1 border-l border-slate-200 pl-2"
                title="Close"
              >
                <MdClose size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE SITE FILTER BANNER */}
        {selectedSite && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-sky-50 via-sky-50/70 to-slate-50 px-3.5 py-2 rounded-xl border border-sky-200 shadow-2xs animate-fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
              <span className="text-xs font-bold text-sky-950">
                Filtered by Site:
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white text-sky-900 border border-sky-300 shadow-2xs">
                <span>📍 {selectedSite.name}</span>
                {selectedSite.site_shortcut && (
                  <span className="text-[10px] font-mono text-cyan-700 font-bold ml-1">
                    ({selectedSite.site_shortcut})
                  </span>
                )}
              </span>
              {selectedSite.site_type && (
                <span className="text-[11px] text-slate-500 font-medium">
                  · {selectedSite.site_type}
                </span>
              )}
              {selectedSite.capacity_cars > 0 && (
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-700 font-medium">
                  🚗 {selectedSite.capacity_cars} Cars
                </span>
              )}
              {selectedSite.amount ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  ₹{parseFloat(selectedSite.amount).toLocaleString("en-IN")}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2.5">
              {selectedSite.address && (
                <span className="text-[11px] text-slate-500 truncate max-w-xs hidden lg:inline" title={[selectedSite.address, selectedSite.city, selectedSite.state, selectedSite.pincode].filter(Boolean).join(", ")}>
                  📍 {[selectedSite.address, selectedSite.city, selectedSite.state].filter(Boolean).join(", ")}
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedSiteId("all")}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Reset site filter to view all customer data"
              >
                <MdClose size={13} />
                <span>Show All Sites</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. 6 KPI PULSE CARDS ROW (Exact match with FollowupHistoryView & Figma design) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-1">
          {/* KPI 0: Sites & Facilities */}
          <div
            onClick={() => setActiveTab("sites")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "sites"
                ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Sites & Facilities
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {visibleSites.length} {visibleSites.length === 1 ? "site" : "sites"} {selectedSite ? "selected" : "registered"}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5 truncate">
              {visibleSites.reduce((acc, s) => acc + (s.capacity_cars || 0), 0)} cars capacity · View all
            </span>
          </div>

          {/* KPI 1: Services */}
          <div
            onClick={() => setActiveTab("services")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "services"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Services & Visits
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {visibleServices.length} {visibleServices.length === 1 ? "visit" : "visits"} recorded
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5 truncate">
              {completedServicesCount} completed · {upcomingServicesCount} upcoming
            </span>
          </div>

          {/* KPI 2: AMC Contracts */}
          <div
            onClick={() => setActiveTab("amc")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "amc"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              AMC Contracts
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {visibleAmcContracts.length} {visibleAmcContracts.length === 1 ? "contract" : "contracts"}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5 truncate">
              {activeAmcContracts.length > 0 ? "Active Contract" : "No Active AMC"} · ₹{totalAnnualAmc.toLocaleString("en-IN")}/yr
            </span>
          </div>

          {/* KPI 3: Quotations */}
          <div
            onClick={() => setActiveTab("quotations")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "quotations"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Quotations
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {visibleQuotations.length} {visibleQuotations.length === 1 ? "quotation" : "quotations"}
            </span>
            <span className="text-[10px] text-slate-500 font-normal block mt-0.5 truncate">
              Total ₹{totalQuotationValue.toLocaleString("en-IN")} quoted
            </span>
          </div>

          {/* KPI 4: Project Value & Commercial */}
          <div
            onClick={() => setActiveTab("projects")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "projects"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Project & Commercial
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {customer.project_value ? `₹${parseFloat(customer.project_value).toLocaleString("en-IN")}` : "—"}
            </span>
            <span className="text-[10px] text-slate-500 font-normal block mt-0.5 truncate">
              {visibleProjects.length} project(s) · {customer.payment_terms_display || customer.payment_terms || "Credit"}
            </span>
          </div>

          {/* KPI 5: Referral Points */}
          <div
            onClick={() => setActiveTab("referrals")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "referrals"
                ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Referral Points
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {referralPoints} {referralPoints === 1 ? "point" : "points"} earned
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5 truncate">
              {referrals.length} {referrals.length === 1 ? "referral" : "referrals"} (1 pt each)
            </span>
          </div>
        </div>

        {/* 4. TABS NAVIGATION HEADER */}
        <div className="border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto pt-2 scrollbar-none">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "overview"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdBusiness size={15} />
              <span>Overview & Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("sites")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "sites"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdLocationOn size={15} />
              <span>Sites</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {visibleSites.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("services")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "services"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdOutlineBuild size={15} />
              <span>Services</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {visibleServices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("amc")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "amc"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdDescription size={15} />
              <span>AMC Contracts</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {visibleAmcContracts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("quotations")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "quotations"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdReceiptLong size={15} />
              <span>Quotations</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {visibleQuotations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("projects")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "projects"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdEngineering size={15} />
              <span>Projects</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {visibleProjects.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("referrals")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "referrals"
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdCardGiftcard size={15} />
              <span>Referral Points</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                {referralPoints} pts
              </span>
            </button>
          </div>
        </div>

        {/* 5. TAB PANELS CONTENT */}

        {/* TAB 1: OVERVIEW & PROFILE */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card A: Company & Contact Information */}
              <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-3.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/70 pb-1.5">
                  Company & Contact Information
                </h3>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Company Name</span>
                  <span className="col-span-2 text-slate-900 font-semibold text-xs">{customerName}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Contact Person</span>
                  <span className="col-span-2 text-slate-800 text-[11px]">
                    {customer.contact_person || "—"}
                    {customer.designation && <span className="text-slate-400 ml-1">({customer.designation})</span>}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Mobile Phone</span>
                  <span className="col-span-2 text-slate-800 text-[11px] flex items-center gap-2">
                    <span>{customerPhone || "—"}</span>
                    {customerPhone && (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={openWhatsAppModal}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="WhatsApp"
                        >
                          <FaWhatsapp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCall}
                          className="p-1 text-sky-600 hover:bg-sky-50 rounded"
                          title="Call"
                        >
                          <MdCall size={13} />
                        </button>
                      </span>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Email Address</span>
                  <span className="col-span-2 text-slate-800 text-[11px] flex items-center gap-1.5">
                    {customerEmail ? (
                      <a href={`mailto:${customerEmail}`} className="text-sky-600 hover:underline">
                        {customerEmail}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Website</span>
                  <span className="col-span-2 text-slate-800 text-[11px]">
                    {customer.website ? (
                      <a
                        href={customer.website.startsWith("http") ? customer.website : `https://${customer.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-600 hover:underline"
                      >
                        {customer.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Industry Category</span>
                  <span className="col-span-2 text-slate-700 text-[11px] capitalize">
                    {customer.industry_category_display || customer.industry_category || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Lead Source</span>
                  <span className="col-span-2 text-slate-700 text-[11px] capitalize">
                    {customer.lead_source_display || customer.lead_source || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">GST Number</span>
                  <span className="col-span-2 text-slate-800 font-mono font-medium text-[11px]">
                    {customer.gst_number || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">PAN Number</span>
                  <span className="col-span-2 text-slate-800 font-mono font-medium text-[11px]">
                    {customer.pan_number || customer.pan || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">MSME Number</span>
                  <span className="col-span-2 text-slate-800 font-mono text-[11px]">
                    {customer.msme_number || "—"}
                  </span>
                </div>
              </div>

              {/* Card B: Commercial, Address & Billing */}
              <div className="space-y-5">
                <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-3.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/70 pb-1.5">
                    Commercial & Contract Terms
                  </h3>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Payment Terms</span>
                    <span className="col-span-2 text-slate-800 font-medium text-[11px] capitalize">
                      {customer.payment_terms_display || customer.payment_terms || "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Project Value</span>
                    <span className="col-span-2 text-emerald-700 font-bold text-xs">
                      {customer.project_value ? `₹${parseFloat(customer.project_value).toLocaleString("en-IN")}` : "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Sales Executive</span>
                    <span className="col-span-2 text-slate-800 font-medium text-[11px]">{salesExecutiveName}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">AMC Coverage</span>
                    <span className="col-span-2 text-slate-700 text-[11px]">
                      {customer.amc_start_date ? (
                        <span>
                          {formatDt(customer.amc_start_date)} to {formatDt(customer.amc_end_date)}
                        </span>
                      ) : (
                        "No fixed dates in master"
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Products Purchased</span>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {resolveProducts(customer.product_purchased).length > 0 ? (
                        resolveProducts(customer.product_purchased).map((prod, idx) => (
                          <span
                            key={idx}
                            className="bg-sky-50 text-sky-700 border border-sky-100 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          >
                            {prod}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Service Package</span>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {Array.isArray(customer.service_package) && customer.service_package.length > 0 ? (
                        customer.service_package.map((pkg, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          >
                            {typeof pkg === "object" ? pkg.name || JSON.stringify(pkg) : pkg}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card C: Billing Address */}
                <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/70 pb-1.5">
                    Billing Address
                  </h3>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    {customer.billing_address || customer.address || "No billing address specified."}
                  </p>
                  {(customer.city || customer.state || customer.pin_code) && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      {[customer.city, customer.state, customer.pin_code].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card D: Customer Sites & Parking Facilities Overview */}
            <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Customer Sites &amp; Parking Facilities
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-700 font-bold rounded-full">
                    {sites.length} {sites.length === 1 ? "site" : "sites"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("sites")}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    View All Sites →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSite(null);
                      setShowAddSiteModal(true);
                    }}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <MdAdd size={16} />
                    <span>Add Site</span>
                  </button>
                </div>
              </div>

              {sites.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <p className="text-xs">No sites registered for this customer yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSite(null);
                      setShowAddSiteModal(true);
                    }}
                    className="mt-2 text-xs font-semibold text-sky-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MdAddLocationAlt size={14} /> Add First Site
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {sites.map((site) => (
                    <div
                      key={site.id}
                      className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-900 block leading-tight truncate">{site.name}</span>
                            {site.site_shortcut && (
                              <span className="text-[9px] font-mono text-cyan-700 font-semibold bg-cyan-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                {site.site_shortcut}
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            site.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {site.status || "Active"}
                          </span>
                        </div>

                        {/* Value & Capacity row */}
                        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                          {site.capacity_cars > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                              🚗 {site.capacity_cars} Cars
                            </span>
                          )}
                          {site.amount ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ₹{parseFloat(site.amount).toLocaleString("en-IN")}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1 text-[10px] text-slate-600">
                          {site.site_type && (
                            <p className="flex items-center gap-1.5 font-medium text-slate-700">
                              <MdDirectionsCar size={13} className="text-cyan-600 shrink-0" />
                              <span className="truncate">{site.site_type}</span>
                            </p>
                          )}
                          {(site.city || site.state || site.address) && (
                            <p className="flex items-start gap-1 text-slate-500">
                              <MdLocationOn size={13} className="text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{[site.address, site.city, site.state, site.pincode].filter(Boolean).join(", ")}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] gap-1 flex-wrap">
                        {(() => {
                          const siteProject =
                            projects.find((p) => p.site === site.id || p.site_details?.id === site.id) ||
                            (site.has_project ? site.project_details : null);
                          if (siteProject) {
                            return (
                              <button
                                type="button"
                                onClick={() => setActiveTab("projects")}
                                className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title={`Linked to Project ${siteProject.project_code || siteProject.id} (Click to view)`}
                              >
                                <span>📁 {siteProject.project_code || "In Project"}</span>
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => handleConvertSiteToProject(site)}
                              className="px-2 py-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Convert this site to a Project"
                            >
                              <MdAssignment size={11} className="text-sky-600" />
                              <span>+ To Project</span>
                            </button>
                          );
                        })()}
                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSite(site);
                              setShowAddSiteModal(true);
                            }}
                            className="p-1 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                            title="Edit Site"
                          >
                            <MdEdit size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSite(site.id, site.name)}
                            className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Delete Site"
                          >
                            <MdDelete size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 1.5: SITES & PARKING FACILITIES (Card View & Management) */}
        {activeTab === "sites" && (
          <div className="space-y-4 animate-fade-in">
            {/* Header Banner with Icon, Title, Stats & Actions */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <MdLocationOn size={22} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    Customer Sites &amp; Parking Facilities
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage multi-location parking sites, tower installations, and facility supervisors for {customerName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Stats Pills */}
                {sites.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs">
                    <span>{sites.length} Site{sites.length > 1 ? "s" : ""}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-700">🚗 {totalSitesCapacity} Cars</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-700">₹{totalSitesValue.toLocaleString("en-IN")}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setEditingSite(null);
                    setShowAddSiteModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <MdAdd size={16} />
                  <span>+ Add New Site</span>
                </button>
              </div>
            </div>

            {/* Controls Bar: Search, Status Filter & View Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <MdSearch
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={siteSearchQuery}
                    onChange={(e) => {
                      setSiteSearchQuery(e.target.value);
                      setSitePage(1);
                    }}
                    placeholder="Search sites by name, city, shortcut..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={siteStatusFilter}
                  onChange={(e) => {
                    setSiteStatusFilter(e.target.value);
                    setSitePage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white text-slate-700 cursor-pointer h-[32px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Under Installation">Under Installation</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* View Mode Toggle: Cards vs Table */}
              <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSiteViewMode("cards")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    siteViewMode === "cards"
                      ? "bg-white text-sky-700 shadow-2xs border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Card View"
                >
                  <MdViewModule size={15} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSiteViewMode("table")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    siteViewMode === "table"
                      ? "bg-white text-sky-700 shadow-2xs border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Table View"
                >
                  <MdViewList size={15} />
                  <span>Table</span>
                </button>
              </div>
            </div>

            {/* SITES CONTENT: CARDS VIEW */}
            {siteViewMode === "cards" ? (
              filteredSites.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 px-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                    <MdApartment size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {siteSearchQuery || siteStatusFilter !== "all"
                      ? "No matching parking sites found"
                      : "No sites registered for this customer"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {siteSearchQuery || siteStatusFilter !== "all"
                      ? "Try adjusting your search query or status filter."
                      : "Register multi-tier parking sites, tower installations, and facility supervisors."}
                  </p>
                  {siteSearchQuery || siteStatusFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSiteSearchQuery("");
                        setSiteStatusFilter("all");
                      }}
                      className="mt-3 px-3 py-1.5 text-xs text-sky-600 font-semibold hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSite(null);
                        setShowAddSiteModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-2xs shadow-sky-500/10 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MdAdd size={16} />
                      <span>Add First Site</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {pagedSites.map((site) => (
                      <div
                        key={site.id}
                        className="bg-white rounded-xl border border-slate-200/90 hover:border-sky-300 hover:shadow-xs transition-all duration-150 flex flex-col justify-between overflow-hidden shadow-2xs group"
                      >
                        {/* Card Top / Body */}
                        <div className="p-3 space-y-2 flex-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate leading-snug">
                                {site.name}
                              </h4>
                              {site.site_shortcut && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold text-cyan-700 bg-cyan-50 border border-cyan-200/70">
                                  {site.site_shortcut}
                                </span>
                              )}
                            </div>

                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                site.status === "Active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : site.status === "Under Installation"
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : site.status === "Under Maintenance"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {site.status || "Active"}
                            </span>
                          </div>

                          {/* Key Metrics Row (Capacity & Value) */}
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[9px] text-slate-400 block font-medium uppercase tracking-wider">
                                Capacity
                              </span>
                              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                <span>🚗</span>
                                <span>{site.capacity_cars ? `${site.capacity_cars} Cars` : "—"}</span>
                              </span>
                            </div>

                            <div className="p-1.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                              <span className="text-[9px] text-emerald-700/80 block font-medium uppercase tracking-wider">
                                Site Value
                              </span>
                              <span className="text-[11px] font-bold text-emerald-800 block mt-0.5 truncate">
                                {site.amount ? `₹${parseFloat(site.amount).toLocaleString("en-IN")}` : "—"}
                              </span>
                            </div>
                          </div>

                          {/* Parking System Type */}
                          {site.site_type && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                              <MdDirectionsCar size={13} className="text-sky-600 shrink-0" />
                              <span className="truncate">{site.site_type}</span>
                            </div>
                          )}

                          {/* Site AMC Status */}
                          {site.has_amc && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md font-semibold truncate">
                              <span>🛡️ AMC:</span>
                              <span className="font-mono">{site.amc_start_date || "—"} to {site.amc_end_date || "—"}</span>
                            </div>
                          )}

                          {/* Products Installed (if any) */}
                          {Array.isArray(site.products) && site.products.length > 0 && (
                            <div className="space-y-0.5 pt-1 border-t border-slate-100">
                              <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">
                                Products:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {site.products.map((prod, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60"
                                  >
                                    {prod}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Location & Address */}
                          <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-100">
                            <div className="flex items-start gap-1">
                              <MdLocationOn size={13} className="text-rose-500 shrink-0 mt-0.5" />
                              <span className="line-clamp-1 leading-snug">
                                {[site.address, site.city, site.state, site.pincode].filter(Boolean).join(", ") ||
                                  "No physical address specified"}
                              </span>
                            </div>
                          </div>

                          {/* Supervisor Contact */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-600">
                            <span className="text-slate-500 truncate mr-1">
                              In-Charge: <strong className="text-slate-700 font-medium">{site.owner_name || "—"}</strong>
                            </span>
                            {site.owner_contact && (
                              <a
                                href={`tel:${site.owner_contact}`}
                                className="inline-flex items-center gap-1 text-sky-600 font-medium hover:underline shrink-0"
                              >
                                <MdPhone size={11} />
                                <span>{site.owner_contact}</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Card Action Footer */}
                        <div className="px-3 py-1.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                          {(() => {
                            const siteProject =
                              projects.find((p) => p.site === site.id || p.site_details?.id === site.id) ||
                              (site.has_project ? site.project_details : null);
                            if (siteProject) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("projects")}
                                  className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title={`Linked to Project ${siteProject.project_code || siteProject.id} (Click to view)`}
                                >
                                  <span>📁 {siteProject.project_code || "In Project"}</span>
                                </button>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => handleConvertSiteToProject(site)}
                                className="px-2 py-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs hover:bg-sky-100"
                                title="Convert this site to a Project"
                              >
                                <MdAssignment size={12} className="text-sky-600" />
                                <span>+ To Project</span>
                              </button>
                            );
                          })()}

                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSite(site);
                                setShowAddSiteModal(true);
                              }}
                              className="px-2 py-0.5 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Edit Site Details"
                            >
                              <MdEdit size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSite(site.id, site.name)}
                              className="px-2 py-0.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Delete Site"
                            >
                              <MdDelete size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* PAGINATION PANEL (Consistent with Products page) */}
                  {filteredSites.length > 0 && (
                    <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs sm:text-sm mt-3">
                      <div className="text-slate-600">
                        Page {sitePage} of {totalSitePages}
                        <span className="text-slate-400 text-xs ml-2 hidden sm:inline">
                          ({filteredSites.length} total site{filteredSites.length !== 1 ? "s" : ""})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSitePage((prev) => Math.max(1, prev - 1))}
                          disabled={sitePage === 1}
                          className="px-3 py-1 rounded border border-slate-200 bg-white text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
                          aria-label="Previous page"
                        >
                          <MdOutlineNavigateBefore />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSitePage((prev) => Math.min(totalSitePages, prev + 1))}
                          disabled={sitePage === totalSitePages}
                          className="px-3 py-1 rounded border border-slate-200 bg-white text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
                          aria-label="Next page"
                        >
                          <MdOutlineNavigateNext />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* SITES CONTENT: TABLE VIEW FALLBACK */
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                <TableView
                  columns={siteColumns}
                  rows={pagedSites}
                  loading={loadingRelated}
                  page={sitePage}
                  totalPages={Math.max(1, Math.ceil(filteredSites.length / SITE_PAGE_SIZE))}
                  onPageChange={setSitePage}
                  pageSize={SITE_PAGE_SIZE}
                  actions={(site) => {
                    const siteProject =
                      projects.find((p) => p.site === site.id || p.site_details?.id === site.id) ||
                      (site.has_project ? site.project_details : null);
                    return (
                      <div className="flex items-center justify-center gap-1.5">
                        {siteProject ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("projects")}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-all duration-150 text-xs shadow-2xs cursor-pointer font-bold inline-flex items-center gap-1 px-2"
                            title={`Linked to Project ${siteProject.project_code || siteProject.id}`}
                          >
                            <span>📁 {siteProject.project_code || "Project"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConvertSiteToProject(site)}
                            className="p-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded transition-all duration-150 text-xs shadow-2xs cursor-pointer font-semibold inline-flex items-center gap-1 px-2"
                            title="Convert site to Project"
                          >
                            <MdAssignment size={13} />
                            <span>+ Project</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSite(site);
                            setShowAddSiteModal(true);
                          }}
                          className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded transition-all duration-150 text-xs shadow-2xs cursor-pointer"
                          title="Edit Site"
                        >
                          <MdEdit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSite(site.id, site.name)}
                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded transition-all duration-150 text-xs shadow-2xs cursor-pointer"
                          title="Delete Site"
                        >
                          <MdDelete size={14} />
                        </button>
                      </div>
                    );
                  }}
                  emptyMessage="No sites registered for this customer yet."
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SERVICES (All On-Demand & AMC Services for this customer) */}
        {activeTab === "services" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Services &amp; Maintenance Visits
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Complete history of on-demand breakdown jobs and scheduled AMC visits for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/services?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add Service</span>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <TableView
                columns={serviceColumns}
                rows={pagedServices}
                loading={loadingRelated}
                page={servicePage}
                totalPages={Math.max(1, Math.ceil(visibleServices.length / PAGE_SIZE))}
                onPageChange={setServicePage}
                pageSize={PAGE_SIZE}
                actions={(srv) => (
                  <button
                    type="button"
                    onClick={() => navigate("/amc-services", { state: { viewingService: srv, serviceId: srv.id } })}
                    className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-700 rounded transition-all duration-150 text-xs font-semibold shadow-2xs cursor-pointer inline-flex items-center gap-1 border border-sky-200"
                    title="View Full Service Details"
                  >
                    <MdOutlineRemoveRedEye size={13} />
                    <span>View</span>
                  </button>
                )}
                emptyMessage={selectedSite ? `No service visits recorded for site "${selectedSite.name}".` : "No service visits recorded for this customer yet."}
              />
            </div>
          </div>
        )}

        {/* TAB 3: AMC CONTRACTS */}
        {activeTab === "amc" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  AMC Contracts
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Annual maintenance contracts, visit schedules, and renewals for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/amc?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add AMC Contract</span>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <TableView
                columns={amcColumns}
                rows={pagedAmcContracts}
                loading={loadingRelated}
                page={amcPage}
                totalPages={Math.max(1, Math.ceil(visibleAmcContracts.length / PAGE_SIZE))}
                onPageChange={setAmcPage}
                pageSize={PAGE_SIZE}
                actions={(c) => (
                  <button
                    type="button"
                    onClick={() => navigate(`/amc?contractId=${c.id}`)}
                    className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-700 rounded transition-all duration-150 text-xs font-semibold shadow-2xs cursor-pointer inline-flex items-center gap-1 border border-sky-200"
                    title="View Full AMC Details"
                  >
                    <MdOutlineRemoveRedEye size={13} />
                    <span>View</span>
                  </button>
                )}
                emptyMessage={selectedSite ? `No AMC contracts found for site "${selectedSite.name}".` : "No AMC contracts found for this customer."}
              />
            </div>
          </div>
        )}

        {/* TAB 4: QUOTATIONS */}
        {activeTab === "quotations" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Quotations &amp; Proposals
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Commercial estimates, system proposals, and revisions generated for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/quotations?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add Quotation</span>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <TableView
                columns={quotationColumns}
                rows={pagedQuotations}
                loading={loadingRelated}
                page={quotationPage}
                totalPages={Math.max(1, Math.ceil(visibleQuotations.length / PAGE_SIZE))}
                onPageChange={setQuotationPage}
                pageSize={PAGE_SIZE}
                actions={(q) => (
                  <button
                    type="button"
                    onClick={() => navigate(`/quotations?id=${q.id}`)}
                    className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-700 rounded transition-all duration-150 text-xs font-semibold shadow-2xs cursor-pointer inline-flex items-center gap-1 border border-sky-200"
                    title="View Quotation"
                  >
                    <MdOutlineRemoveRedEye size={13} />
                    <span>View</span>
                  </button>
                )}
                emptyMessage={selectedSite ? `No quotations found for site "${selectedSite.name}".` : "No quotations generated for this customer yet."}
              />
            </div>
          </div>
        )}

        {/* TAB 5: PROJECTS */}
        {activeTab === "projects" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Projects
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Execution projects and deployment milestones for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/projects?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add Project</span>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <TableView
                columns={projectColumns}
                rows={pagedProjects}
                loading={loadingRelated}
                page={projectPage}
                totalPages={Math.max(1, Math.ceil(visibleProjects.length / PAGE_SIZE))}
                onPageChange={setProjectPage}
                pageSize={PAGE_SIZE}
                actions={(p) => (
                  <button
                    type="button"
                    onClick={() => navigate(`/projects?projectId=${p.id}`)}
                    className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-700 rounded transition-all duration-150 text-xs font-semibold shadow-2xs cursor-pointer inline-flex items-center gap-1 border border-sky-200"
                    title="View Full Project Details"
                  >
                    <MdOutlineRemoveRedEye size={13} />
                    <span>View</span>
                  </button>
                )}
                emptyMessage={selectedSite ? `No projects found for site "${selectedSite.name}".` : "No projects found for this customer."}
              />
            </div>
          </div>
        )}

        {/* TAB 6: REFERRAL POINTS & NETWORK */}
        {activeTab === "referrals" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-2">
                  <span>Referral Points & Network</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[11px] font-bold">
                    {referralPoints} {referralPoints === 1 ? "Point" : "Points"}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Leads referred by {customerName}. Each qualified referral earns 1 point.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-lg text-[11px] text-amber-800 font-semibold flex items-center gap-1.5 shadow-2xs">
                  <MdCardGiftcard className="text-amber-600" size={15} />
                  <span>Rule: 1 Referral = 1 Point</span>
                </div>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MdCardGiftcard size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Total Referral Points
                  </span>
                  <span className="text-xl font-bold text-emerald-950">
                    {referralPoints} <span className="text-xs font-semibold text-emerald-700">Pts</span>
                  </span>
                </div>
              </div>

              <div className="bg-sky-50/50 border border-sky-200/70 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MdBusiness size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block">
                    Total Leads Referred
                  </span>
                  <span className="text-xl font-bold text-sky-950">
                    {referrals.length} <span className="text-xs font-semibold text-sky-700">Leads</span>
                  </span>
                </div>
              </div>

              <div className="bg-purple-50/50 border border-purple-200/70 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MdCheckCircle size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">
                    Converted Customers
                  </span>
                  <span className="text-xl font-bold text-purple-950">
                    {referrals.filter((r) => r.is_converted).length}{" "}
                    <span className="text-xs font-semibold text-purple-700">Converted</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <TableView
                columns={referralColumns}
                rows={pagedReferrals}
                loading={loadingRelated}
                page={referralPage}
                totalPages={Math.max(1, Math.ceil(referrals.length / PAGE_SIZE))}
                onPageChange={setReferralPage}
                pageSize={PAGE_SIZE}
                emptyMessage="No referral records registered for this customer yet."
              />
            </div>
          </div>
        )}
      </div>

      {/* 6. SEND MESSAGE MODAL (Integrated WhatsApp & Email) */}
      {messageModalOpen && (
        <SendMessageModal
          isOpen={messageModalOpen}
          onClose={() => setMessageModalOpen(false)}
          category="customer"
          recordData={{
            name: customerName,
            company_name: customerName,
            contact_person: contactPerson,
            email: customerEmail,
            email_address: customerEmail,
            mobile_number: customerPhone,
            phone_number: customerPhone,
            customer_code: customer.customer_code,
            id: customer.id,
          }}
          defaultChannel={messageChannel}
          onSuccess={() => {
            Swal.fire({
              icon: "success",
              title: "Message Sent",
              text: "Communication delivered successfully.",
              timer: 1500,
              showConfirmButton: false,
            });
          }}
        />
      )}
      {/* 7. ADD / EDIT SITE MODAL */}
      {showAddSiteModal && (
        <AddSiteModal
          open={showAddSiteModal}
          onClose={() => {
            setShowAddSiteModal(false);
            setEditingSite(null);
          }}
          customer={customer}
          initialData={editingSite}
          baseApi={BASE_API}
          productList={productList}
          onSuccess={() => {
            fetchCustomerRelatedData();
          }}
        />
      )}
    </div>
  );
}

