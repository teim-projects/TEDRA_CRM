import SendMessageModal from "../templates/SendMessageModal";
import React, { useState, useMemo, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import {
  MdArrowBack,
  MdClose,
  MdMail,
  MdOutlineChatBubbleOutline,
  MdEdit,
  MdDeleteOutline,
  MdEngineering,
  MdCalendarToday,
  MdArrowForward,
  MdCheck,
  MdOutlineLocalShipping,
  MdBuild,
  MdPeopleOutline,
  MdVerified,
  MdOutlineShield
} from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";
import {
  PackagePlus,
  RotateCcw,
  Package,
  Layers,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowUpRight
} from "lucide-react";
import IssueStockModal from "../inventory/IssueStockModal";
import ReturnStockModal from "../inventory/ReturnStockModal";
import { useUserRole } from "../../hooks/useAuth";

const STAGES = [
  { id: "order_confirmed", label: "Order Confirmed", short: "Order Confirmed" },
  { id: "site_survey", label: "Site Survey", short: "Site Survey" },
  { id: "material_procurement", label: "Material Procurement", short: "Procurement" },
  { id: "dispatched", label: "Dispatched", short: "Dispatched" },
  { id: "delivered", label: "Delivered", short: "Delivered" },
  { id: "installation", label: "Installation", short: "Installation" },
  { id: "testing", label: "Testing", short: "Testing" },
  { id: "handover", label: "Handover", short: "Handover" },
];

export default function ProjectDetailView({
  project,
  onBack,
  onEdit,
  onAllocate,
  onDelete,
  resolveProductName,
  formatDate,
  token,
  baseApi,
  onProjectUpdated,
  canEdit = true,
  canDelete = true,
}) {
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  // SendMessageModal state matching FollowupHistoryView
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState("email");

  const openWhatsAppModal = () => {
    setMessageChannel("whatsapp");
    setMessageModalOpen(true);
  };

  const openEmailModal = () => {
    setMessageChannel("email");
    setMessageModalOpen(true);
  };

  const BASE_API = (baseApi || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  // Role detection: Superadmin / Admin can directly issue stock; Technicians can only request stock
  const { userRole, userInfo, hasPermission } = useUserRole(BASE_API);
  const isSuperUser = Boolean(userInfo?.is_superuser);
  const roleName = (userRole?.name || userInfo?.role_name || userInfo?.role?.name || "").toLowerCase();
  const _isTechnician = roleName === "technician" || roleName.includes("technician") || Boolean(userInfo?.is_technician);
  const canDirectIssue = isSuperUser || roleName === "admin" || roleName === "superuser" || hasPermission("inventory", "create") || hasPermission("inventory", "edit");

  // Project Materials / Stock Inventory State
  const [issuedStock, setIssuedStock] = useState([]);
  const [loadingIssuedStock, setLoadingIssuedStock] = useState(false);
  const [issueStockModalOpen, setIssueStockModalOpen] = useState(false);
  const [issueModalMode, setIssueModalMode] = useState("REQUEST"); // "ISSUE" | "REQUEST"
  const [returnStockModalOpen, setReturnStockModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);

  const handleOpenDirectIssue = () => {
    setIssueModalMode("ISSUE");
    setIssueStockModalOpen(true);
  };

  const handleOpenStockRequest = () => {
    setIssueModalMode("REQUEST");
    setIssueStockModalOpen(true);
  };

  const handleOpenReturnStock = () => {
    setReturnStockModalOpen(true);
  };

  const fetchIssuedStock = async () => {
    if (!project?.id) return;
    setLoadingIssuedStock(true);
    try {
      const res = await fetch(`${BASE_API}/inventory/transactions/?project=${project.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setIssuedStock(list);
      }
    } catch (err) {
      console.warn("Could not load project inventory:", err);
    } finally {
      setLoadingIssuedStock(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await fetch(`${BASE_API}/inventory/items/?limit=500`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setInventoryItems(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.warn("Could not load inventory items:", err);
    }
  };

  useEffect(() => {
    if (project?.id) {
      fetchIssuedStock();
      fetchInventoryItems();
    }
  }, [project?.id]);

  const stockSummary = useMemo(() => {
    const itemMap = {};
    (issuedStock || []).forEach((tx) => {
      const itemId = tx.item || tx.item_id;
      if (!itemId) return;
      if (!itemMap[itemId]) {
        itemMap[itemId] = {
          itemId,
          name: tx.item_name || "Material / Equipment",
          code: tx.item_code || "",
          capacity: tx.item_capacity || tx.capacity || "",
          unit: tx.unit || "Nos",
          technician: tx.technician_name || "",
          date: tx.created_at || "",
          issuedQty: 0,
          pendingIssueQty: 0,
          usedQty: 0,
          returnedQty: 0,
          pendingReturnQty: 0,
        };
      }
      const q = parseFloat(tx.quantity || 0);
      if (tx.technician_name && !itemMap[itemId].technician) {
        itemMap[itemId].technician = tx.technician_name;
      }
      if (tx.transaction_type === "ISSUE_STOCK") {
        if (tx.status === "PENDING_APPROVAL") {
          itemMap[itemId].pendingIssueQty += q;
        } else {
          itemMap[itemId].issuedQty += q;
        }
      } else if (tx.transaction_type === "USED_STOCK") {
        itemMap[itemId].usedQty += q;
      } else if (tx.transaction_type === "RETURN_STOCK") {
        if (tx.status === "PENDING_APPROVAL") {
          itemMap[itemId].pendingReturnQty += q;
        } else {
          itemMap[itemId].returnedQty += q;
        }
      }
    });

    const items = Object.values(itemMap);
    const totalIssued = items.reduce((acc, it) => acc + it.issuedQty, 0);
    const totalPendingIssue = items.reduce((acc, it) => acc + (it.pendingIssueQty || 0), 0);
    const totalUsed = items.reduce((acc, it) => acc + it.usedQty, 0);
    const totalReturned = items.reduce((acc, it) => acc + it.returnedQty, 0);
    const totalPendingReturn = items.reduce((acc, it) => acc + (it.pendingReturnQty || 0), 0);
    const totalInHand = items.reduce((acc, it) => acc + Math.max(0, it.issuedQty - it.usedQty - it.returnedQty), 0);

    return {
      items,
      totalIssued,
      totalPendingIssue,
      totalUsed,
      totalReturned,
      totalPendingReturn,
      totalInHand,
    };
  }, [issuedStock]);

  // Products resolution
  const productsList = useMemo(() => {
    if (!project?.product) return [];
    if (Array.isArray(project.product)) return project.product;
    if (typeof project.product === "string" && project.product.trim()) {
      try {
        const parsed = JSON.parse(project.product);
        return Array.isArray(parsed) ? parsed : [project.product];
      } catch {
        return [project.product];
      }
    }
    return [];
  }, [project?.product]);

  const messageRecord = useMemo(() => {
    if (!project) return {};
    return {
      ...project,
      id: project.id,
      project_code: project.project_code || `PRJ-${project.id}`,
      company_name: project.customer_details?.company_name || project.customer_details?.name || "",
      contact_person: project.customer_details?.contact_person || project.customer_details?.name || "",
      email: project.customer_details?.email || "",
      mobile_number:
        project.customer_details?.phone_number ||
        project.customer_details?.mobile_number ||
        project.customer_details?.contact_number ||
        "",
      phone:
        project.customer_details?.phone_number ||
        project.customer_details?.mobile_number ||
        "",
    };
  }, [project]);

  const stepperTrackRef = useRef(null);

  const currentStageIdx = project?.project_stage ? STAGES.findIndex((s) => s.id === project.project_stage) : 0;
  const activeIdx = currentStageIdx >= 0 ? currentStageIdx : 0;
  const progressPercentage = Math.round(((activeIdx + 1) / STAGES.length) * 100);

  useEffect(() => {
    if (stepperTrackRef.current) {
      const activeEl = stepperTrackRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeIdx]);

  if (!project) return null;

  const primaryProductTitle =
    productsList.length > 0
      ? resolveProductName(productsList[0])
      : project.project_code || "Water Treatment Project";

  const customerName =
    project.customer_details?.company_name ||
    project.customer_details?.name ||
    project.customer ||
    "Client Account";

  const siteName =
    project.site_details?.name ||
    project.site_name ||
    (typeof project.site === "object" ? project.site?.name : "") ||
    "";

  const siteShortcut = project.site_details?.site_shortcut || "";

  // Physical installation address of the site (called first, then city, state, pincode)
  const siteLocation = project.site_details
    ? [
      project.site_details.address,
      project.site_details.city,
      project.site_details.state,
      project.site_details.pincode,
    ]
      .filter(Boolean)
      .join(", ")
    : "";

  const customerLocation = [
    project.customer_details?.billing_address || project.customer_details?.address,
    project.customer_details?.city,
    project.customer_details?.state,
    project.customer_details?.pin_code || project.customer_details?.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  const displayLocation = siteLocation || customerLocation || "Location on record";

  const technicians = Array.isArray(project.technicians_details)
    ? project.technicians_details
    : [];

  const firstTechName =
    technicians.length > 0
      ? `${technicians[0].first_name || ""} ${technicians[0].last_name || ""}`.trim() ||
      technicians[0].email
      : null;

  const executiveName =
    project.project_executive_details?.full_name ||
    project.project_executive_details?.first_name ||
    project.project_executive_details?.name ||
    "Assigned Executive";

  // Currency format helper: ₹18.5L or ₹4,50,000
  const formatCurrency = (amt) => {
    const num = parseFloat(amt);
    if (isNaN(num) || num <= 0) return "—";
    if (num >= 100000) {
      const inLakhs = num / 100000;
      return `₹${inLakhs % 1 === 0 ? inLakhs.toFixed(0) : inLakhs.toFixed(1)}L`;
    }
    return `₹${num.toLocaleString("en-IN")}`;
  };

  // Mask phone helper matching FollowupHistoryView: "+91 98•• ••418"
  const maskPhone = (phone) => {
    if (!phone) return "—";
    const clean = String(phone).trim();
    if (clean.length >= 10) {
      const prefix = clean.startsWith("+") ? clean.slice(0, 3) + " " : "+91 ";
      const first2 = clean.slice(-10, -8);
      const last3 = clean.slice(-3);
      return `${prefix}${first2}•• ••${last3}`;
    }
    return clean;
  };

  const handleStageChange = async (newStageId) => {
    if (newStageId === project.project_stage || isUpdatingStage) return;

    const targetStage = STAGES.find((s) => s.id === newStageId);
    const confirmResult = await Swal.fire({
      title: "Update Project Stage?",
      html: `Transition project to <b>${targetStage?.label || newStageId}</b>?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0284c7",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, update stage",
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setIsUpdatingStage(true);
      const res = await fetch(
        `${baseApi.replace(/\/$/, "")}/lead/projects/${project.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ project_stage: newStageId }),
        }
      );

      if (res.ok) {
        const updatedData = await res.json();
        Swal.fire({
          icon: "success",
          title: "Stage Updated",
          text: `Project is now in ${targetStage?.label || newStageId}`,
          timer: 1500,
          showConfirmButton: false,
        });
        if (onProjectUpdated) {
          onProjectUpdated(updatedData);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        Swal.fire(
          "Error",
          errData?.detail || "Could not update project stage.",
          "error"
        );
      }
    } catch (err) {
      console.error("Stage update error:", err);
      Swal.fire("Error", "Network error updating stage.", "error");
    } finally {
      setIsUpdatingStage(false);
    }
  };



  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pb-10 animate-fade-in text-xs">



      {/* 2. THE BIG OUTER BORDERED CONTAINER ENCASING HEADER & 4 KPIS (Exact FollowupHistoryView structure) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6">

        {/* TOP HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {/* Project Code ID Tag & Site Badge */}
            <div className="flex items-center gap-2 flex-wrap text-[10px] font-semibold tracking-wide">
              <span className="text-sky-600 uppercase font-bold">{project.project_code || `PRJ-${project.id}`}</span>
              {siteName && (
                <span className="inline-flex items-center gap-1 font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200/80 px-2 py-0.5 rounded-full text-[10px]">
                  <span>📍 Site: {siteName}</span>
                  {siteShortcut && (
                    <span className="font-mono text-[9px] bg-white px-1 rounded border border-cyan-200">
                      {siteShortcut}
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Product / Project Title */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              {primaryProductTitle}
            </h1>

            {/* Subtitle with Company Name and Site Name side by side */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 font-normal mt-0.5">
              <span className="font-bold text-slate-900">{customerName}</span>
              {siteName && (
                <span className="inline-flex items-center gap-1 font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200/80 px-2 py-0.5 rounded-md text-[11px]">
                  <span>📍 {siteName}</span>
                </span>
              )}
              <span>·</span>
              <span>
                Project executive: <span className="text-slate-700 font-medium">{executiveName}</span>
              </span>
              <span>·</span>
              <span className="text-slate-500">{displayLocation}</span>
            </div>
          </div>

          {/* Top Right Controls & Status Pill */}
          <div className="flex items-center gap-2.5 self-start sm:self-center">
            {/* Status Pill Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs capitalize">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              {project.project_stage_display || STAGES[activeIdx]?.label}
            </span>

            {/* Action Buttons: WhatsApp, Email, Allocate, Edit, Delete */}
            <div className="flex items-center gap-1 text-slate-400">
              <button
                type="button"
                onClick={openWhatsAppModal}
                className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title="Message Customer via WhatsApp"
              >
                <MdOutlineChatBubbleOutline size={15} />
              </button>

              <button
                type="button"
                onClick={openEmailModal}
                className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Email Customer"
              >
                <MdMail size={15} />
              </button>

              <button
                type="button"
                onClick={() => onAllocate(project)}
                className="p-1.5 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                title="Allocate Project Technicians"
              >
                <MdEngineering size={16} />
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(project)}
                  className="p-1.5 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Project"
                >
                  <MdEdit size={15} />
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(project.id)}
                  className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete Project"
                >
                  <MdDeleteOutline size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={onBack}
                className="p-1.5 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-1 border-l border-slate-200 pl-2 text-slate-400"
                title="Close / Back to all projects"
              >
                <MdClose size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. 4 KPI PULSE CARDS ROW (Exact match with FollowupHistoryView styling) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Current Stage */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Current stage
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5 capitalize truncate" title={project.project_stage_display || STAGES[activeIdx]?.label}>
              {project.project_stage_display || STAGES[activeIdx]?.label}
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
              Stage {activeIdx + 1} of 8 ({progressPercentage}% done)
            </span>
          </div>

          {/* KPI 2: Contract Value */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Contract value
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {formatCurrency(project.project_value)}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              {project.no_of_user ? `${project.no_of_user} User Licenses` : "Turnkey execution"}
            </span>
          </div>

          {/* KPI 3: Target Handover */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Target handover
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {formatDate(project.expected_to_go_live || project.start_date)}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              Started {formatDate(project.start_date)}
            </span>
          </div>

          {/* KPI 4: Technical Workforce */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Field workforce
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {technicians.length} technician{technicians.length === 1 ? "" : "s"}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5 capitalize">
              Priority: <strong className="font-semibold text-slate-700">{project.priority_display || project.priority || "Medium"}</strong>
            </span>
          </div>
        </div>

        {/* 4. MAIN TWO-COLUMN WORKSPACE (Inside the big outer container matching FollowupHistoryView) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* LEFT 2 COLUMNS: Complete Progress & Operational Execution */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5">

            {/* Header with Title and Allocate Technicians Button */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Project delivery progress
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  8-stage delivery lifecycle from order confirmed to customer handover
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAllocate(project)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                >
                  <MdEngineering size={14} />
                  <span>Allocate technicians</span>
                </button>
              </div>
            </div>

            {/* 8-STAGE PROGRESS STEPPER (Refined font sizes matching FollowupHistoryView) */}
            <div className="bg-[#f8fafc] border border-slate-200/70 rounded-xl p-3.5 sm:p-5 space-y-2.5 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                <span className="font-bold text-slate-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                  <MdVerified className="text-sky-600 shrink-0" size={14} />
                  <span>Current Phase:</span>
                  <span className="text-sky-700 normal-case font-bold">{project.project_stage_display || STAGES[activeIdx]?.label}</span>
                </span>
                <span className="font-bold text-sky-700 text-[10px] sm:text-[11px] self-end sm:self-auto">
                  {progressPercentage}% complete
                </span>
              </div>

              {/* STEPPER TRACK */}
              <div
                ref={stepperTrackRef}
                className="overflow-x-auto no-scrollbar scrollbar-none scroll-smooth py-1.5"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <div className="min-w-[560px] sm:min-w-[640px] flex items-center justify-between relative px-2">
                  {/* Connecting Track Line */}
                  <div className="absolute top-3 left-6 right-6 h-0.5 bg-slate-200 -z-0">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${(activeIdx / (STAGES.length - 1)) * 100}%`,
                      }}
                    ></div>
                  </div>

                  {STAGES.map((st, idx) => {
                    const isCompleted = idx < activeIdx;
                    const isCurrent = idx === activeIdx;

                    return (
                      <button
                        key={st.id}
                        type="button"
                        data-active={isCurrent ? "true" : undefined}
                        onClick={() => handleStageChange(st.id)}
                        disabled={isUpdatingStage}
                        title={`Click to set stage to ${st.label}`}
                        className="flex flex-col items-center group relative z-10 cursor-pointer focus:outline-none disabled:cursor-wait shrink-0 px-1"
                      >
                        {/* Circle Number / Icon */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-200 ${isCompleted
                            ? "bg-emerald-600 text-white shadow-2xs group-hover:bg-emerald-700"
                            : isCurrent
                              ? "bg-sky-600 text-white shadow-2xs ring-4 ring-sky-100"
                              : "bg-white border border-slate-300 text-slate-400 group-hover:border-sky-400 group-hover:text-sky-600"
                            }`}
                        >
                          {isCompleted ? (
                            <MdCheck size={12} className="stroke-2" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        {/* Label */}
                        <span
                          className={`text-[9.5px] mt-1.5 max-w-[76px] text-center leading-tight transition-colors ${isCurrent
                            ? "font-bold text-sky-700"
                            : isCompleted
                              ? "font-semibold text-slate-700"
                              : "text-slate-400 group-hover:text-slate-600 font-normal"
                            }`}
                        >
                          {st.short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3 HIGHLIGHT EXECUTION CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Shipment */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <MdOutlineLocalShipping className="text-sky-600" size={13} />
                  <span>Shipment</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {activeIdx >= 4
                    ? "Delivered at site"
                    : activeIdx >= 3
                      ? "In Transit (Dispatched)"
                      : "Awaiting Dispatch"}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {formatDate(project.expected_to_go_live || project.start_date)} · POD tracking
                </p>
              </div>

              {/* Installation */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <MdBuild className="text-purple-600" size={12} />
                  <span>Installation</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {activeIdx >= 5
                    ? "Execution in progress"
                    : activeIdx >= 4
                      ? "Delivered & Ready"
                      : "Scheduled Setup"}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {technicians.length > 0
                    ? `${technicians.length} engineer(s) on job`
                    : "Workforce pending allocation"}
                </p>
              </div>

              {/* Assigned Team */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <MdPeopleOutline className="text-emerald-600" size={13} />
                  <span>Assigned team</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {firstTechName
                    ? `${firstTechName} ${technicians.length > 1
                      ? `+ ${technicians.length - 1} tech`
                      : ""
                    }`
                    : "No technicians allocated"}
                </h4>
                <p className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Lead: {executiveName}</span>
                  <button
                    type="button"
                    onClick={() => onAllocate(project)}
                    className="font-semibold text-sky-600 hover:underline cursor-pointer"
                  >
                    Manage
                  </button>
                </p>
              </div>
            </div>

            {/* DISCUSSION & SCOPE BLOCKS (Exact match with FollowupHistoryView Discussion / Next Action) */}
            <div className="space-y-3 pt-1">
              {/* Scope / Discussion Block */}
              <div className="bg-[#f8fafc] border border-slate-200/60 rounded-xl p-3.5">
                <span className="text-[9px] font-bold tracking-wider text-sky-700 block uppercase mb-1">
                  Project Scope & Technical Specifications
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-normal whitespace-pre-wrap">
                  {project.project_scope_requirements ||
                    "Industrial reverse-osmosis system configuration, high-pressure pump setup, pre-filtration media, membrane housings, piping manifold, testing & commissioning."}
                </p>

                {/* Products Discussed Pills matching FollowupHistoryView */}
                {productsList.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="font-semibold text-slate-400">Products:</span>
                    {productsList.map((p, pIdx) => (
                      <span
                        key={pIdx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                      >
                        {resolveProductName(p)}
                      </span>
                    ))}
                    {project.project_value && (
                      <span className="ml-auto font-bold text-sky-700">
                        {formatCurrency(project.project_value)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Next Action / Operational Milestone Block */}
              <div className="bg-[#f0f9ff] border border-sky-100 rounded-xl p-3.5">
                <span className="text-[9px] font-bold tracking-wider text-sky-800 flex items-center gap-1 uppercase mb-1">
                  <MdArrowForward size={12} />
                  Next Operational Action
                </span>
                <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                  {activeIdx === 0 && "Coordinate site survey with client and dispatch pre-installation checklist."}
                  {activeIdx === 1 && "Complete site verification report and final electrical & plumbing readiness checklist."}
                  {activeIdx === 2 && "Finalize Bill of Materials (BOM), procure RO membranes and high-pressure vessel components."}
                  {activeIdx === 3 && "Generate gate pass & dispatch consignment to customer site with transit tracking."}
                  {activeIdx === 4 && "Verify physical delivery on-site, inspect consignment against delivery challan."}
                  {activeIdx === 5 && "Service technicians to complete pipeline integration, electrical wiring, and plumbing."}
                  {activeIdx === 6 && "Conduct pure-water flow rate test, TDS calibration, and pressure-drop verification."}
                  {activeIdx === 7 && "Handover operational manual, signed customer acceptance form, and start AMC contract."}
                </p>
              </div>
            </div>

            {/* ALLOCATED TECHNICIANS LIST (Timeline / Cards style) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                  Allocated Field Technicians ({technicians.length})
                </span>
                <button
                  type="button"
                  onClick={() => onAllocate(project)}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                >
                  + Manage Technicians
                </button>
              </div>

              {technicians.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {technicians.map((tech) => {
                    const techName =
                      `${tech.first_name || ""} ${tech.last_name || ""}`.trim() ||
                      tech.email;
                    const initial = (techName[0] || "T").toUpperCase();
                    return (
                      <div
                        key={tech.id}
                        className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex items-center justify-between gap-3 hover:border-sky-300 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-[11px] font-bold text-slate-900 truncate">
                              {techName}
                            </h5>
                            <p className="text-[10px] text-slate-400 truncate">
                              {tech.email || "Technician"}
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Assigned
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#f8fafc] border border-dashed border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-[11px] text-slate-500 font-medium">
                    No service engineers allocated yet for this project.
                  </p>
                  <button
                    type="button"
                    onClick={() => onAllocate(project)}
                    className="mt-1.5 text-[11px] font-semibold text-sky-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <MdEngineering size={13} />
                    Allocate field engineers now
                  </button>
                </div>
              )}
            </div>

            {/* PROJECT MATERIALS & EQUIPMENT INVENTORY CARD */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/80 shrink-0">
                    <Package size={17} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                      Project Materials & Equipment Inventory
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Spare parts, equipment, and consumables issued or requested for this project
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
                  {canDirectIssue ? (
                    <>
                      <button
                        type="button"
                        onClick={handleOpenDirectIssue}
                        className="px-2 sm:px-2.5 py-1.5 sm:py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap text-center truncate min-w-0"
                        title="Directly issue and allocate stock to project from warehouse"
                      >
                        <ArrowUpRight size={13} className="shrink-0" />
                        <span className="truncate">Issue Stock</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenStockRequest}
                        className="px-1.5 sm:px-2 py-1.5 sm:py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap text-center truncate min-w-0"
                        title="Submit a stock requisition request"
                      >
                        <Wrench size={11} className="text-slate-500 shrink-0" />
                        <span className="truncate">Request Stock</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenStockRequest}
                      className="col-span-2 sm:col-span-1 px-2.5 py-1.5 sm:py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap text-center truncate min-w-0"
                      title="Request material/parts from warehouse for this project"
                    >
                      <Wrench size={11} className="shrink-0" />
                      <span className="truncate">Request Stock</span>
                    </button>
                  )}

                  {/* Return Stock Button */}
                  <button
                    type="button"
                    onClick={handleOpenReturnStock}
                    className="px-1.5 sm:px-2.5 py-1.5 sm:py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap text-center truncate min-w-0"
                    title="Return unused surplus project materials to warehouse"
                  >
                    <RotateCcw size={11} className="shrink-0" />
                    <span className="truncate">Return Stock</span>
                  </button>
                </div>
              </div>

              {loadingIssuedStock ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading project materials...</span>
                </div>
              ) : stockSummary.items.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-3">
                  <p className="text-xs text-slate-500 font-medium">
                    No materials or equipment have been issued or requested for this project yet.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-1 max-w-lg mx-auto">
                    {canDirectIssue ? (
                      <>
                        <button
                          type="button"
                          onClick={handleOpenDirectIssue}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          <ArrowUpRight size={13} className="shrink-0" />
                          <span>Issue Parts from Inventory</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenStockRequest}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                          <Wrench size={12} className="text-slate-500 shrink-0" />
                          <span>Request Stock</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenStockRequest}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Wrench size={12} className="shrink-0" />
                        <span>Request Materials from Inventory</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenReturnStock}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <RotateCcw size={12} className="shrink-0" />
                      <span>Return Stock</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* 4 Pulse Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Issued</span>
                      <span className="text-sm font-bold text-slate-900 block mt-0.5">{stockSummary.totalIssued}</span>
                      {stockSummary.totalPendingIssue > 0 && (
                        <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                          ({stockSummary.totalPendingIssue} pending approval)
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Installed / Used</span>
                      <span className="text-sm font-bold text-emerald-800 block mt-0.5">{stockSummary.totalUsed}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/80">
                      <span className="text-[9px] font-bold text-sky-600 uppercase tracking-wider block">Returned to Stock</span>
                      <span className="text-sm font-bold text-sky-800 block mt-0.5">{stockSummary.totalReturned}</span>
                      {stockSummary.totalPendingReturn > 0 && (
                        <span className="text-[10px] text-sky-600 font-semibold block mt-0.5">
                          ({stockSummary.totalPendingReturn} pending return)
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">In Hand with Team</span>
                      <span className="text-sm font-bold text-amber-800 block mt-0.5">{stockSummary.totalInHand}</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto border border-slate-200/90 rounded-xl scrollbar-thin">
                    <table className="min-w-[620px] w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                          <th className="py-2.5 px-3">Material / Equipment</th>
                          <th className="py-2.5 px-3 text-center">Issued / Req Qty</th>
                          <th className="py-2.5 px-3">Technician / Allocated</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Status / In Hand</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockSummary.items.map((it) => {
                          const inHand = Math.max(0, it.issuedQty - it.returnedQty);
                          return (
                            <tr key={it.itemId} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800">{it.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {it.code && <span className="font-mono text-[10px] text-slate-400">[{it.code}]</span>}
                                  {it.capacity && (
                                    <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                      {it.capacity}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {it.issuedQty > 0 && (
                                    <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70 inline-block">
                                      {it.issuedQty} {it.unit} (Issued)
                                    </span>
                                  )}
                                  {it.pendingIssueQty > 0 && (
                                    <span className="font-bold text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-block">
                                      +{it.pendingIssueQty} {it.unit} (Requested)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-slate-700 font-medium">{it.technician || "Assigned Team"}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                {it.date ? new Date(it.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {it.pendingIssueQty > 0 && it.issuedQty === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Clock size={10} />
                                    Awaiting Approval
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    In Hand: {inHand} {it.unit}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 1 COLUMN: Sidebar Snapshot & Lifecycle Cards (Exact Followup styling) */}
          <div className="space-y-4">

            {/* CARD 1: Project Snapshot */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5">
              <h3 className="text-xs font-bold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
                Project snapshot
              </h3>

              <div className="space-y-2.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Project ID</span>
                  <span className="font-semibold text-slate-900">{project.project_code || `PRJ-${project.id}`}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Customer</span>
                  <span className="font-semibold text-slate-900 text-right truncate max-w-[150px]" title={customerName}>
                    {customerName}
                  </span>
                </div>

                {(project.site_details || project.site_name) && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-normal">Site Facility</span>
                      <span className="font-semibold text-cyan-700 text-right truncate max-w-[150px]" title={project.site_details?.name || project.site_name}>
                        📍 {project.site_details?.name || project.site_name}
                      </span>
                    </div>
                    {siteLocation && (
                      <div className="flex justify-between items-start gap-2 pt-1 border-t border-slate-50">
                        <span className="text-slate-400 font-normal shrink-0">Site Address</span>
                        <span className="font-medium text-slate-700 text-right text-[11px] leading-tight break-words max-w-[180px]">
                          {siteLocation}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Contact Person</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {project.customer_details?.contact_person || project.customer_details?.name || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Phone</span>
                  <span className="font-semibold text-slate-900 tracking-wide">
                    {maskPhone(project.customer_details?.phone_number || project.customer_details?.mobile_number)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Email</span>
                  <span className="font-semibold text-sky-700 truncate max-w-[140px]" title={project.customer_details?.email}>
                    {project.customer_details?.email || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Executive</span>
                  <span className="font-semibold text-slate-900 text-right">{executiveName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Estimated value</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(project.project_value)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Priority</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${project.priority === "critical"
                      ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                      : project.priority === "high"
                        ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                        : "bg-slate-100 text-slate-700 border border-slate-200/60"
                      }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${project.priority === "critical"
                        ? "bg-rose-500"
                        : project.priority === "high"
                          ? "bg-amber-500"
                          : "bg-slate-500"
                        }`}
                    ></span>
                    {project.priority_display || (project.priority ? project.priority.toUpperCase() : "MEDIUM")}
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 2: Delivery Milestone & Dates */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold text-slate-900">Target delivery date</h3>
                <MdCalendarToday className="text-sky-600" size={14} />
              </div>

              <div className="text-xs sm:text-[13px] font-bold text-slate-900 mt-0.5">
                {formatDate(project.expected_to_go_live || project.start_date)}
              </div>

              <p className="text-[11px] text-slate-500 font-normal leading-relaxed mt-1">
                Started on {formatDate(project.start_date)}. Expected operational handover by {formatDate(project.expected_to_go_live)}.
              </p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-normal">Internal Team:</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[140px]">
                  {project.team_members || "Operations Dept."}
                </span>
              </div>
            </div>

            {/* CARD 3: AMC & Warranty Status */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-900">Warranty & AMC</h3>
                <MdOutlineShield className="text-emerald-600" size={15} />
              </div>

              <div className="space-y-2 text-[11px]">
                {project.amc_contract_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-normal">Contract #</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <MdCheck size={12} className="text-emerald-600" />
                      {project.amc_contract_number}
                    </span>
                  </div>
                )}

                {project.amc_service_frequency && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-normal">Site Visits</span>
                    <span className="font-semibold text-slate-900">
                      {project.amc_service_frequency} {project.amc_no_of_visits !== undefined && project.amc_no_of_visits !== null ? `(${project.amc_no_of_visits} visits)` : ""}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">AMC Start</span>
                  <span className="font-semibold text-slate-900">{formatDate(project.amc_start_date)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">AMC End</span>
                  <span className="font-semibold text-slate-900">{formatDate(project.amc_end_date)}</span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-400 font-normal">Coverage</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {project.has_amc || project.amc_contract_number || project.amc_end_date ? "Active AMC Contract" : "1-Yr Standard Warranty"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>  {/* Closes the big outer bordered container matching FollowupHistoryView */}

      {/* IN-APP INTEGRATED SEND MESSAGE MODAL (MATCHING FOLLOW-UP HISTORY) */}
      <SendMessageModal
        isOpen={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        category="project"
        recordData={messageRecord}
        initialChannel={messageChannel}
        onSuccess={() => { }}
      />

      {/* ISSUE / REQUEST STOCK MODAL */}
      <IssueStockModal
        isOpen={issueStockModalOpen}
        onClose={() => setIssueStockModalOpen(false)}
        onSuccess={() => {
          fetchIssuedStock();
          if (onProjectUpdated) onProjectUpdated();
        }}
        items={inventoryItems}
        baseApi={BASE_API}
        preselectedProject={project}
        isRequestOnly={issueModalMode === "REQUEST" || !canDirectIssue}
      />

      {/* RETURN STOCK MODAL */}
      <ReturnStockModal
        isOpen={returnStockModalOpen}
        onClose={() => setReturnStockModalOpen(false)}
        onSuccess={() => {
          fetchIssuedStock();
          if (onProjectUpdated) onProjectUpdated();
        }}
        items={inventoryItems}
        baseApi={BASE_API}
        preselectedProject={project}
        currentUser={userInfo}
        allocatedTechnicians={technicians}
      />
    </div>
  );
}
