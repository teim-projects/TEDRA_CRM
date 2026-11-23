import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { navigateToLocation, getGoogleMapsPinUrl } from "../../utils/navigation";
import {
  MdClose,
  MdMail,
  MdEdit,
  MdDeleteOutline,
  MdEngineering,
  MdCheck,
  MdOutlineShield,
  MdAutorenew,
  MdAdd,
  MdVerified,
  MdLocationOn,
  MdPhone,
  MdPerson,
  MdOutlineChatBubbleOutline,
  MdOutlineRemoveRedEye,
  MdHistory,
} from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";
import SendMessageModal from "../templates/SendMessageModal";
import EditVisitModal from "./EditVisitModal";
import CycleVisitsModal from "./CycleVisitsModal";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";

export default function AMCDetailView({
  amc,
  onBack,
  onRenew,
  onEdit,
  onDelete,
  contractServices = [],
  loadingServices = false,
  onRefreshServices,
  onAddService,
  onAllocateService,
  onEditService,
  formatDate,
  token,
  baseApi,
  canEdit = true,
  canDelete = true,
}) {
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [editingVisitModalOpen, setEditingVisitModalOpen] = useState(false);
  const [selectedVisitSlot, setSelectedVisitSlot] = useState(null);
  const [messageChannel, setMessageChannel] = useState("email");
  const [creatingSlotIndex, setCreatingSlotIndex] = useState(null);
  const [updatingServiceId, setUpdatingServiceId] = useState(null);

  // Cycle visits modal & filter state
  const [viewingCycleVisits, setViewingCycleVisits] = useState(null);
  const [selectedCycleId, setSelectedCycleId] = useState("all");

  const navigate = useNavigate();

  if (!amc) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        Contract details are not available.
        <button
          type="button"
          onClick={onBack}
          className="block mx-auto mt-2 px-3 py-1 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  const safeAmc = amc || {};

  const formatSafeDate = (d) => {
    if (!d) return "—";
    if (typeof formatDate === "function") return formatDate(d);
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return String(d);
    }
  };

  const openWhatsAppModal = () => {
    setMessageChannel("whatsapp");
    setMessageModalOpen(true);
  };

  const openEmailModal = () => {
    setMessageChannel("email");
    setMessageModalOpen(true);
  };

  const formatNumber = (num) => String(num || 0).padStart(2, "0");

  const getCycleStatusBadge = (st) => {
    switch (st) {
      case "active":
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px] uppercase">Active</span>;
      case "scheduled":
        return <span className="px-2 py-0.5 bg-sky-100 text-sky-700 font-bold rounded text-[10px] uppercase">Scheduled</span>;
      case "expiring_soon":
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 font-bold rounded text-[10px] uppercase">Expiring Soon</span>;
      case "expired":
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded text-[10px] uppercase">Expired</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px] uppercase">{st || "Inactive"}</span>;
    }
  };

  const customerName =
    safeAmc.customer_details?.company_name ||
    safeAmc.customer_details?.name ||
    safeAmc.customer ||
    "Customer Account";

  const linkedSite = useMemo(() => {
    if (safeAmc.site_details) return safeAmc.site_details;
    if (typeof safeAmc.site === "object" && safeAmc.site !== null) return safeAmc.site;
    return null;
  }, [safeAmc.site_details, safeAmc.site]);

  const displaySiteName =
    safeAmc.site_name ||
    safeAmc.site_details?.name ||
    (typeof safeAmc.site === "object" && safeAmc.site?.name) ||
    linkedSite?.name ||
    "";

  const displaySiteCode =
    safeAmc.site_shortcut ||
    safeAmc.site_details?.site_shortcut ||
    (typeof safeAmc.site === "object" && safeAmc.site?.site_shortcut) ||
    linkedSite?.site_shortcut ||
    "";

  const siteAddress =
    safeAmc.site_address ||
    (linkedSite ? [linkedSite.address, linkedSite.city, linkedSite.state, linkedSite.pincode].filter(Boolean).join(", ") : "") ||
    [safeAmc.customer_details?.billing_address, safeAmc.customer_details?.city, safeAmc.customer_details?.state]
      .filter(Boolean)
      .join(", ") ||
    "Site Location";

  const productName = safeAmc.product || "Water Treatment System";

  const cycles = useMemo(() => (Array.isArray(safeAmc.cycles) ? safeAmc.cycles : []), [safeAmc.cycles]);

  const activeCycle = useMemo(() => {
    if (selectedCycleId === "all") return null;
    return cycles.find((c) => String(c.id) === String(selectedCycleId)) || null;
  }, [selectedCycleId, cycles]);

  // Total visits count for the selected cycle or for the overall contract
  const effectiveTotalVisits = useMemo(() => {
    if (activeCycle) {
      return Math.max(1, parseInt(activeCycle.no_of_visits, 10) || 4);
    }
    return Math.max(1, parseInt(safeAmc.no_of_visits, 10) || 4);
  }, [activeCycle, safeAmc.no_of_visits]);

  const totalVisitsCount = effectiveTotalVisits;

  // Current view services filtered by cycle if selected
  const currentViewServices = useMemo(() => {
    if (!activeCycle) return contractServices;
    return contractServices.filter((s) => {
      if (s.cycle === activeCycle.id || s.cycle?.id === activeCycle.id) return true;
      if (s.cycle_number === activeCycle.cycle_number) return true;
      if (activeCycle.start_date && activeCycle.end_date && (s.visit_date || s.service_date)) {
        const d = s.visit_date || s.service_date;
        return d >= activeCycle.start_date && d <= activeCycle.end_date;
      }
      return false;
    });
  }, [contractServices, activeCycle]);

  // Calculate planned visit slots
  const plannedVisitSlots = useMemo(() => {
    const slots = [];
    const effStartDate = activeCycle ? activeCycle.start_date : safeAmc.start_date;
    const effEndDate = activeCycle ? activeCycle.end_date : safeAmc.end_date;

    const startDateObj = effStartDate ? new Date(effStartDate) : new Date();
    const endDateObj = effEndDate
      ? new Date(effEndDate)
      : new Date(startDateObj.getTime() + 365 * 24 * 60 * 60 * 1000);

    const totalDays = Math.max(
      30,
      Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
    );
    const intervalDays = Math.round(totalDays / effectiveTotalVisits);

    // Sort existing services chronologically
    const sortedServices = [...currentViewServices].sort((a, b) => {
      const da = (a.visit_date || a.service_date) ? new Date(a.visit_date || a.service_date).getTime() : a.id || 0;
      const db = (b.visit_date || b.service_date) ? new Date(b.visit_date || b.service_date).getTime() : b.id || 0;
      return da - db;
    });

    const usedServiceIds = new Set();

    for (let i = 0; i < effectiveTotalVisits; i++) {
      const visitNum = i + 1;
      // Match by explicit visit index or description
      let matchedService = sortedServices.find(
        (s) =>
          !usedServiceIds.has(s.id) &&
          (s.visit_index === visitNum ||
            (s.description && (s.description.includes(`Visit #${formatNumber(visitNum)}`) || s.description.includes(`Visit #${visitNum}`))))
      );

      // If no explicit match, pick the next unused chronological service
      if (!matchedService) {
        matchedService = sortedServices.find((s) => !usedServiceIds.has(s.id)) || null;
      }

      if (matchedService) {
        usedServiceIds.add(matchedService.id);
      }

      let slotDateStr = "";
      if (matchedService?.visit_date || matchedService?.service_date) {
        slotDateStr = matchedService.visit_date || matchedService.service_date;
      } else {
        const slotDate = new Date(startDateObj.getTime() + (i + 1) * intervalDays * 24 * 60 * 60 * 1000);
        if (slotDate > endDateObj) slotDate.setTime(endDateObj.getTime());
        slotDateStr = slotDate.toISOString().split("T")[0];
      }

      slots.push({
        visitNumber: matchedService?.visit_index || visitNum,
        date: slotDateStr,
        service: matchedService,
        cycleNumber: matchedService?.cycle_number || matchedService?.cycle?.cycle_number || activeCycle?.cycle_number || null,
      });
    }

    // Include any additional services beyond total visits count
    sortedServices.forEach((s) => {
      if (!usedServiceIds.has(s.id)) {
        slots.push({
          visitNumber: s.visit_index || slots.length + 1,
          date: s.service_date || s.visit_date || "",
          service: s,
          cycleNumber: s.cycle_number || s.cycle?.cycle_number || null,
        });
      }
    });

    return slots;
  }, [activeCycle, safeAmc.start_date, safeAmc.end_date, effectiveTotalVisits, currentViewServices]);

  // Visit completion metrics
  const completedServicesCount = currentViewServices.filter((s) => s.status === "completed").length;
  const remainingVisitsCount = Math.max(0, effectiveTotalVisits - completedServicesCount);
  const completionPercentage = Math.min(
    100,
    Math.round((completedServicesCount / effectiveTotalVisits) * 100)
  );

  // Next planned visit
  const upcomingServices = currentViewServices.filter(
    (s) => s.status !== "completed" && s.status !== "cancelled"
  );
  const nextVisit = upcomingServices[0] || plannedVisitSlots.find((sl) => !sl.service || sl.service.status !== "completed");
  const nextVisitDate = nextVisit ? nextVisit.service?.service_date || nextVisit.date : null;
  const nextVisitTechList =
    Array.isArray(nextVisit?.service?.technicians_details) && nextVisit.service.technicians_details.length > 0
      ? nextVisit.service.technicians_details
      : Array.isArray(nextVisit?.service?.assigned_technicians_list) && nextVisit.service.assigned_technicians_list.length > 0
        ? nextVisit.service.assigned_technicians_list
        : Array.isArray(nextVisit?.service?.technicians)
          ? nextVisit.service.technicians
          : [];
  const nextVisitTech = nextVisitTechList[0];
  const nextVisitTechName = nextVisitTech
    ? typeof nextVisitTech === "string"
      ? nextVisitTech
      : nextVisitTech.name || `${nextVisitTech.first_name || ""} ${nextVisitTech.last_name || ""}`.trim() || nextVisitTech.username || nextVisitTech.email
    : null;

  // Handle assigning technician to a slot (auto-creates AMCService if not yet logged)
  const handleAssignTechnicianToSlot = async (slot) => {
    if (slot.service) {
      const srvWithDetails = {
        ...slot.service,
        customer_details: slot.service.customer_details || amc.customer_details,
      };
      onAllocateService(srvWithDetails);
      return;
    }

    try {
      setCreatingSlotIndex(slot.visitNumber);
      const payload = {
        amc_contract: amc.id,
        site: amc.site || amc.site_details?.id || null,
        cycle: activeCycle?.id || null,
        customer: amc.customer || amc.customer_details?.id,
        project: amc.project || amc.project_details?.id || null,
        visit_index: slot.visitNumber,
        visit_type: "routine_maintenance",
        visit_date: slot.date,
        service_date: slot.date,
        status: "scheduled",
        priority: "medium",
        visit_address: siteAddress,
        contact_person: amc.customer_details?.contact_person || "",
        contact_phone: amc.customer_details?.contact_number || amc.customer_details?.mobile_number || "",
        description: `Routine Maintenance Visit #${formatNumber(slot.visitNumber)} under AMC ${amc.contract_id || `#${amc.id}`}`,
      };

      const res = await fetch(`${baseApi.replace(/\/$/, "")}/amc/visits/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const createdSrv = await res.json();
        if (!createdSrv.customer_details && amc.customer_details) {
          createdSrv.customer_details = amc.customer_details;
        }
        if (onRefreshServices) onRefreshServices();
        onAllocateService(createdSrv);
      } else {
        const errTxt = await res.text().catch(() => "");
        Swal.fire("Error", `Could not create visit record: ${errTxt}`, "error");
      }
    } catch (err) {
      console.error("Assign slot error:", err);
      Swal.fire("Error", err.message || "Failed to schedule visit slot", "error");
    } finally {
      setCreatingSlotIndex(null);
    }
  };

  // View visit details (redirects to Work Desk detail view)
  const handleViewVisit = async (slot) => {
    let visitRecord = slot.service;
    if (!visitRecord) {
      try {
        setCreatingSlotIndex(slot.visitNumber);
        const payload = {
          amc_contract: amc.id,
          site: amc.site || amc.site_details?.id || null,
          customer: amc.customer || amc.customer_details?.id,
          project: amc.project || amc.project_details?.id || null,
          visit_index: slot.visitNumber,
          visit_type: "routine_maintenance",
          visit_date: slot.date,
          service_date: slot.date,
          status: "scheduled",
          priority: "medium",
          visit_address: siteAddress,
          contact_person: amc.customer_details?.contact_person || "",
          contact_phone: amc.customer_details?.contact_number || amc.customer_details?.mobile_number || "",
          description: `Routine Maintenance Visit #${formatNumber(slot.visitNumber)} under AMC ${amc.contract_id || `#${amc.id}`}`,
        };

        const res = await fetch(`${baseApi.replace(/\/$/, "")}/amc/visits/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          visitRecord = await res.json();
          if (onRefreshServices) onRefreshServices();
        }
      } catch (e) {
        console.error("Auto create visit error:", e);
      } finally {
        setCreatingSlotIndex(null);
      }
    }

    if (visitRecord) {
      const formattedVisit = {
        ...visitRecord,
        work_type: "amc_visit",
        contract_id: amc.contract_id || amc.id,
        customer_details: visitRecord.customer_details || amc.customer_details,
        site_details: visitRecord.site_details || amc.site_details,
        site_name: visitRecord.site_name || amc.site_details?.name || amc.site_name,
        site_shortcut: visitRecord.site_shortcut || amc.site_details?.site_shortcut || amc.site_shortcut,
        equipment: visitRecord.equipment || productName,
        service_date: visitRecord.visit_date || visitRecord.service_date || slot.date,
        service_number: visitRecord.visit_number || `VIS-${String(visitRecord.id).padStart(3, "0")}`,
        service_address: visitRecord.visit_address || siteAddress,
        latitude: visitRecord.latitude || amc.latitude || null,
        longitude: visitRecord.longitude || amc.longitude || null,
        location_url: visitRecord.location_url || amc.location_url || "",
        service_type_display: visitRecord.visit_type_display || "Routine Maintenance",
      };

      navigate("/technician/work-desk", {
        state: { viewingService: formattedVisit, from: "amc" },
      });
    }
  };

  // Quick status update for a service
  const handleQuickStatusChange = async (serviceId, newStatus, scheduledDate, currentStatus) => {
    if (!serviceId) return;

    if (newStatus === "completed") {
      if (scheduledDate && !isServiceDue(scheduledDate)) {
        Swal.fire({
          icon: "warning",
          title: "Cannot Complete Before Scheduled Date",
          text: `This visit is scheduled for ${formatDisplayDate(scheduledDate)}. It cannot be marked completed before the scheduled date arrives.`,
        });
        return;
      }
      if (currentStatus !== "in_progress" && currentStatus !== "completed") {
        Swal.fire({
          icon: "warning",
          title: "Must Start Visit First",
          text: "This visit has not been started yet. Please open the visit and start it (set to In Progress) before marking it completed.",
        });
        return;
      }
    }

    try {
      setUpdatingServiceId(serviceId);
      const res = await fetch(`${baseApi.replace(/\/$/, "")}/amc/visits/${serviceId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          completion_date: newStatus === "completed" ? new Date().toISOString().split("T")[0] : null,
        }),
      });

      if (res.ok) {
        if (onRefreshServices) onRefreshServices();
        Swal.fire({
          icon: "success",
          title: "Status Updated",
          text: `Visit marked as ${newStatus.replace(/_/g, " ")}.`,
          timer: 1200,
          showConfirmButton: false,
        });
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update visit status");
      }
    } catch (err) {
      console.error("Quick status error:", err);
      Swal.fire("Error", err.message || "Failed to update visit status", "error");
    } finally {
      setUpdatingServiceId(null);
    }
  };

  const messageRecord = useMemo(() => {
    return {
      ...safeAmc,
      id: safeAmc.id,
      contract_id: safeAmc.contract_id || `AMC-${safeAmc.id}`,
      company_name: customerName,
      contact_person: safeAmc.customer_details?.contact_person || customerName,
      email: safeAmc.customer_details?.email || "",
      mobile_number: safeAmc.customer_details?.contact_number || safeAmc.customer_details?.mobile_number || "",
      phone: safeAmc.customer_details?.contact_number || safeAmc.customer_details?.mobile_number || "",
    };
  }, [safeAmc, customerName]);

  if (!amc) return null;

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pb-10 text-xs">
      {/* THE BIG OUTER BORDERED CONTAINER ENCASING THE WHOLE PAGE (EXACT FollowupHistoryView & ProjectDetailView STRUCTURE) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-6">

        {/* TOP HEADER SECTION (Inside big outer container) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {/* Contract Code ID Tag */}
            <div className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">
              <span>{amc.contract_id || `AMC-${amc.id}`}</span>
            </div>

            {/* Company Title */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5 truncate">
              {customerName}
            </h1>

            {/* Site Name (Displayed strictly below Customer Name, reduced compact size) */}
            {displaySiteName && (
              <div className="mt-0.5">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs max-w-xs truncate"
                  title={`${displaySiteName}${displaySiteCode ? ` (${displaySiteCode})` : ""}`}
                >
                  <span className="text-[10px] shrink-0">📍</span>
                  <span className="truncate">{displaySiteName}</span>
                  {displaySiteCode && (
                    <span className="text-[9px] font-mono text-cyan-700 font-bold ml-0.5 shrink-0">
                      ({displaySiteCode})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Subtitle */}
            <p className="text-[11px] text-slate-500 font-normal mt-0.5 truncate max-w-md">
              · Annual Maintenance Contract · {siteAddress} · <span className="text-slate-700 font-medium">{productName}</span>
            </p>
          </div>

          {/* Top Right Controls & Status Pill (Strictly in single line matching Image 4) */}
          <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-center shrink-0 flex-nowrap overflow-x-auto max-w-full pb-1 sm:pb-0">
            {/* Status Pill Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs whitespace-nowrap shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {amc.status_display || amc.status || "Active"}
            </span>

            {/* + Renew AMC Button */}
            {canEdit && (
              <button
                type="button"
                onClick={() => onRenew(amc)}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs hover:shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <MdAutorenew size={13} />
                <span>Renew AMC</span>
              </button>
            )}

            {/* Live GPS Route Navigation */}
            <button
              type="button"
              onClick={() =>
                navigateToLocation({
                  latitude: amc.latitude,
                  longitude: amc.longitude,
                  address: siteAddress,
                  destinationName: customerName,
                })
              }
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs hover:shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Get live GPS driving route from your current location"
            >
              <Navigation size={12} className="fill-white" />
              <span>Navigate Route</span>
            </button>

            {/* Action Buttons: WhatsApp, Email, Edit, Delete, Close */}
            <div className="flex items-center gap-0.5 text-slate-400 shrink-0">
              <button
                type="button"
                onClick={openWhatsAppModal}
                className="p-1 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                title="Open WhatsApp Message"
              >
                <FaWhatsapp size={14} />
              </button>
              <button
                type="button"
                onClick={openEmailModal}
                className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                title="Open Email Composer"
              >
                <MdMail size={14} />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(amc)}
                  className="p-1 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer"
                  title="Edit AMC Contract"
                >
                  <MdEdit size={14} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(amc.id)}
                  className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                  title="Delete AMC Contract"
                >
                  <MdDeleteOutline size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={onBack}
                className="p-1 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer ml-0.5 border-l border-slate-200 pl-1.5 text-slate-400"
                title="Close View"
              >
                <MdClose size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* VISIT COMPLETION PROGRESS CARD (Matching FollowupHistoryView Box Detailing) */}
        <div className="bg-[#f8fafc] border border-slate-200/70 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px]">
            <div>
              <span className="font-bold text-slate-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                <MdVerified className="text-sky-600" size={14} />
                Visit Completion:{" "}
                <span className="text-sky-700 normal-case font-bold">
                  {completedServicesCount} of {totalVisitsCount} services completed
                </span>
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {remainingVisitsCount === 0
                  ? "All routine site visits completed for this cycle."
                  : `${remainingVisitsCount} visit${remainingVisitsCount !== 1 ? "s" : ""} remaining before ${formatSafeDate(activeCycle?.end_date || safeAmc.end_date)}`}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-72 shrink-0">
              <div className="flex-1 h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              <span className="text-[11px] font-bold text-sky-700 shrink-0">
                {completionPercentage}% complete
              </span>
            </div>
          </div>
        </div>

        {/* 4 KPI PULSE CARDS ROW (Exact match with FollowupHistoryView & ProjectDetailView) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Contract period */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Contract period
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {formatDate(amc.start_date)} – {formatDate(amc.end_date)}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              Annual coverage
            </span>
          </div>

          {/* KPI 2: Contract value */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Contract value
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              ₹{parseFloat(amc.annual_value || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5 capitalize">
              {amc.payment_frequency_display || amc.payment_frequency || "Quarterly"} billing
            </span>
          </div>

          {/* KPI 3: Service manager */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Service manager
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5 truncate" title={amc.support_coordinator_details?.full_name || amc.support_coordinator_details?.username}>
              {amc.support_coordinator_details?.full_name || amc.support_coordinator_details?.name || amc.support_coordinator_details?.username || "Support Coordinator"}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              Pune service division
            </span>
          </div>

          {/* KPI 4: Next planned visit */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Next planned visit
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {nextVisitDate ? formatDate(nextVisitDate) : "All Visits Completed"}
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5 truncate" title={nextVisitTechName || "Technician not allocated yet"}>
              {nextVisitTechName || "Technician not allocated yet"}
            </span>
          </div>
        </div>

        {/* MAIN TWO-COLUMN WORKSPACE (Matching FollowupHistoryView & ProjectDetailView) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* LEFT 2 COLUMNS: Maintenance Visit History */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">

            {/* Header with Title, Cycle Selector, and Scroll Info */}
            <div className="space-y-2 pb-1 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                    Maintenance visit history
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Every planned visit, technician allocation, and customer confirmation
                  </p>
                </div>

                {plannedVisitSlots.length > 5 && (
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                    Showing 5 of {plannedVisitSlots.length} · Scroll for all
                  </span>
                )}
              </div>

              {/* Cycle Filter Pills if multiple cycles exist */}
              {cycles.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Cycle Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCycleId("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCycleId === "all"
                      ? "bg-slate-900 text-white shadow-2xs font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    All Cycles ({contractServices.length})
                  </button>
                  {cycles.map((c) => {
                    const isSelected = String(c.id) === String(selectedCycleId);
                    const isInitial = c.cycle_number === 1;
                    const cLabel = isInitial ? "Cycle 1 (Initial)" : `Cycle ${c.cycle_number} (Renewal #${c.cycle_number - 1})`;
                    return (
                      <div key={c.id} className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCycleId(c.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isSelected
                            ? "bg-purple-600 text-white shadow-2xs font-bold"
                            : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                            }`}
                        >
                          {cLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingCycleVisits({ cycle: c, amc })}
                          className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors cursor-pointer"
                          title={`View All Visits for ${cLabel}`}
                        >
                          <MdOutlineRemoveRedEye size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* VISITS LIST */}
            {loadingServices ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></span>
                Loading scheduled visits...
              </div>
            ) : (
              <div
                className={`space-y-3 pr-1.5 ${plannedVisitSlots.length > 5
                  ? "max-h-[465px] overflow-y-auto slim-scrollbar"
                  : ""
                  }`}
              >
                {plannedVisitSlots.map((slot) => {
                  const srv = slot.service;
                  const isCompleted = srv?.status === "completed";
                  const isInProgress = srv?.status === "in_progress";

                  const technicians =
                    Array.isArray(srv?.technicians_details) && srv.technicians_details.length > 0
                      ? srv.technicians_details
                      : Array.isArray(srv?.assigned_technicians_list) && srv.assigned_technicians_list.length > 0
                        ? srv.assigned_technicians_list
                        : Array.isArray(srv?.technicians)
                          ? srv.technicians
                          : [];
                  const techNames = technicians
                    .map((t) =>
                      typeof t === "string"
                        ? t
                        : t.name || `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.username || t.email
                    )
                    .filter(Boolean)
                    .join(", ");

                  const visitTitle = `Visit ${formatNumber(slot.visitNumber)} · ${srv?.service_type_display ||
                    (slot.visitNumber % 2 === 1 ? "Preventive maintenance" : "Maintenance + pump inspection")
                    }`;

                  const signerName =
                    srv?.contact_person ||
                    amc.customer_details?.contact_person ||
                    amc.customer_details?.name ||
                    "Customer";

                  const isCreatingThis = creatingSlotIndex === slot.visitNumber;
                  const isUpdatingThis = updatingServiceId === srv?.id;

                  return (
                    <div
                      key={slot.visitNumber}
                      className={`rounded-xl border p-3.5 sm:p-4 shadow-2xs transition-all ${isCompleted
                        ? "bg-white border-slate-200/80 hover:bg-slate-50/50"
                        : "bg-white border-slate-200 hover:border-sky-300"
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                        {/* Left: Icon + Title & Details */}
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Circular Number / Check Badge matching FollowupHistoryView timeline items */}
                          <div className="pt-0.5">
                            {isCompleted ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                                <MdCheck size={12} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                                {slot.visitNumber}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-xs font-bold text-slate-900 leading-snug">
                                {srv?.visit_number ? `${srv.visit_number} · ${srv?.service_type_display || "Routine Maintenance"}` : visitTitle}
                              </h3>
                              {(slot.cycleNumber || srv?.cycle_number || srv?.cycle?.cycle_number) && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  Cycle #{slot.cycleNumber || srv?.cycle_number || srv?.cycle?.cycle_number}
                                </span>
                              )}
                              {(srv?.site_name || srv?.site_details?.name || amc.site_details?.name || amc.site_name) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-50 text-sky-800 border border-sky-200">
                                  <span>📍</span>
                                  <span>{srv?.site_name || srv?.site_details?.name || amc.site_details?.name || amc.site_name}</span>
                                  {(srv?.site_shortcut || srv?.site_details?.site_shortcut || amc.site_details?.site_shortcut || amc.site_shortcut) && (
                                    <span className="font-mono text-[8px] text-sky-600 font-bold">
                                      ({srv?.site_shortcut || srv?.site_details?.site_shortcut || amc.site_details?.site_shortcut || amc.site_shortcut})
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                              {formatDate(slot.date)} ·{" "}
                              {techNames ? (
                                <span>
                                  Technician: <strong className="text-slate-700 font-semibold">{techNames}</strong>
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium italic">
                                  No technician allocated yet
                                </span>
                              )}
                            </p>

                            {srv?.description && (
                              <p className="text-[10px] text-slate-500 mt-1 italic truncate max-w-md">
                                "{srv.description}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Status Badge & Allocate Technician Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-8 sm:pl-0">

                          {/* Status Badge & Customer Confirmation */}
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium capitalize ${isCompleted
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : isInProgress
                                  ? "bg-amber-50 text-amber-700 border border-amber-100"
                                  : "bg-sky-50 text-sky-700 border border-sky-100"
                                }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-emerald-500" : isInProgress ? "bg-amber-500" : "bg-sky-500"
                                  }`}
                              ></span>
                              {srv?.status_display || (isCompleted ? "Completed" : "Scheduled")}
                            </span>

                            <span className="text-[9px] text-slate-400 block mt-0.5 font-normal">
                              {isCompleted
                                ? `Signed by ${signerName}`
                                : techNames
                                  ? "Visit planned"
                                  : "Needs technician"}
                            </span>
                          </div>

                          {/* Action Buttons: View Details, Assign Technician & Status Toggle */}
                          <div className="flex items-center gap-1">
                            {/* View Visit Details Eye Button */}
                            <button
                              type="button"
                              onClick={() => handleViewVisit(slot)}
                              className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-2xs cursor-pointer"
                              title="View Visit Details & Technical Report"
                            >
                              <MdOutlineRemoveRedEye size={14} />
                            </button>

                            {/* Allocate / Assign Technician Button */}
                            <button
                              type="button"
                              onClick={() => handleAssignTechnicianToSlot(slot)}
                              disabled={isCreatingThis}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${techNames
                                ? "bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200"
                                : "bg-sky-600 hover:bg-sky-700 text-white shadow-2xs"
                                }`}
                              title={techNames ? "Change / Re-allocate technicians" : "Assign field technician for this visit"}
                            >
                              <MdEngineering size={12} />
                              <span>{isCreatingThis ? "Opening..." : techNames ? "Re-assign Work" : "Assign Work"}</span>
                            </button>

                            {/* Mark Completed Toggle - Enabled only when visit date arrived and started */}
                            {srv && (() => {
                              const isDue = isServiceDue(slot.date);
                              const isInProgress = srv.status === "in_progress";
                              const canComplete = isCompleted || (isInProgress && isDue);
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(srv.id, isCompleted ? "scheduled" : "completed", slot.date, srv.status)}
                                  disabled={isUpdatingThis || (!isCompleted && !canComplete)}
                                  className={`p-1 rounded-lg text-xs transition-colors border ${isCompleted
                                    ? "bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 border-slate-200 cursor-pointer"
                                    : canComplete
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200 cursor-pointer"
                                      : "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50"
                                    }`}
                                  title={
                                    isCompleted
                                      ? "Mark as Scheduled (Uncomplete)"
                                      : !isDue
                                        ? `Scheduled for ${formatDisplayDate(slot.date)}. Cannot complete before scheduled date.`
                                        : !isInProgress
                                          ? "Start visit first before marking as completed."
                                          : "Mark Visit as Completed"
                                  }
                                >
                                  <MdCheck size={12} />
                                </button>
                              );
                            })()}

                            {/* Reschedule & Edit Visit Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVisitSlot(slot);
                                setEditingVisitModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                              title="Reschedule Service Date & Reassign Technicians"
                            >
                              <MdEdit size={13} />
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 1 COLUMN: Coverage & Site Info */}
          <div className="space-y-4">

            {/* CARD 0: Contract Renewal Cycles (All Cycles & Eye Buttons) */}
            {cycles.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <MdHistory className="text-purple-600" size={16} />
                    <h3 className="text-xs font-bold text-slate-900">Contract Cycles ({cycles.length})</h3>
                  </div>
                  {onRenew && canEdit && (
                    <button
                      type="button"
                      onClick={() => onRenew(amc)}
                      className="text-[10px] text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1 cursor-pointer"
                      title="Renew AMC Contract"
                    >
                      <MdAutorenew size={12} />
                      <span>Renew</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {cycles.map((c) => {
                    const isInitial = c.cycle_number === 1;
                    const label = isInitial ? "Initial Contract" : `Renewal #${c.cycle_number - 1}`;
                    const visitCount = c.visits_count || c.no_of_visits || 4;
                    const isCurrentActive = c.status === "active";

                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-lg border text-xs transition-all ${isCurrentActive
                          ? "bg-purple-50/40 border-purple-200"
                          : "bg-slate-50/70 border-slate-200/80"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded text-[10px]">
                              Cycle #{c.cycle_number}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-800 truncate">
                              {label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {getCycleStatusBadge(c.status)}
                            {/* EYE BUTTON TO VIEW VISITS FOR THIS CYCLE */}
                            <button
                              type="button"
                              onClick={() => setViewingCycleVisits({ cycle: c, amc })}
                              className="px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title={`View Visits for Cycle #${c.cycle_number}`}
                            >
                              <MdOutlineRemoveRedEye size={12} />
                              <span>Visits</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span>Period:</span>
                            <span className="font-medium text-slate-700">
                              {formatDate(c.start_date)} - {formatDate(c.end_date)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Visits / Value:</span>
                            <span className="font-medium text-slate-700">
                              {visitCount} visits · ₹{parseFloat(c.annual_value || 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CARD 1: Coverage */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900">Coverage</h3>
                <MdOutlineShield className="text-emerald-600" size={15} />
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-normal">Labour</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Included
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-normal">Preventive visits</span>
                  <span className="font-semibold text-slate-900">
                    {totalVisitsCount} visits
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-normal">Consumables</span>
                  <span className="font-semibold text-slate-700">Chargeable</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-normal">Emergency visits</span>
                  <span className="font-semibold text-slate-900">2 included</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-400 font-normal">Major spare parts</span>
                  <span className="font-semibold text-slate-500">Excluded</span>
                </div>
              </div>
            </div>

            {/* CARD 2: Site & Customer Snapshot */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-3">
              <div className="pb-1 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900">Site & Contact Snapshot</h3>
                {linkedSite && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Linked Site
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-[11px] text-slate-700">
                {linkedSite && (
                  <div className="p-2.5 bg-sky-50/50 border border-sky-100 rounded-lg space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sky-900 text-xs flex items-center gap-1">
                        📍 {linkedSite.name}
                      </span>
                      {linkedSite.site_shortcut && (
                        <span className="text-[9px] font-mono font-bold text-cyan-700 bg-white border border-cyan-200 px-1.5 py-0.2 rounded">
                          {linkedSite.site_shortcut}
                        </span>
                      )}
                    </div>
                    {linkedSite.site_type && (
                      <p className="text-[10px] text-slate-500 font-medium">
                        🚗 {linkedSite.site_type}
                      </p>
                    )}
                    {linkedSite.owner_name && (
                      <p className="text-[10px] text-slate-600 flex items-center justify-between pt-0.5">
                        <span>In-Charge: <strong className="text-slate-800">{linkedSite.owner_name}</strong></span>
                        {linkedSite.owner_contact && (
                          <span className="text-blue-600 font-medium">{linkedSite.owner_contact}</span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <MdPerson className="text-slate-400 shrink-0 mt-0.5" size={14} />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">Customer Contact</span>
                    <span className="font-semibold text-slate-900">
                      {amc.customer_details?.contact_person || customerName}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MdPhone className="text-slate-400 shrink-0 mt-0.5" size={14} />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">Contact Phone</span>
                    <span className="font-semibold text-slate-900">
                      {amc.customer_details?.contact_number || amc.customer_details?.mobile_number || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MdLocationOn className="text-slate-400 shrink-0 mt-0.5" size={14} />
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-normal">Site Location</span>
                    <span className="font-medium text-slate-800 leading-tight block">
                      {siteAddress}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {amc.latitude && amc.longitude ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 text-[10px] font-bold border border-cyan-200/60 font-mono">
                          <MapPin size={11} className="text-cyan-600" />
                          <span>{Number(amc.latitude).toFixed(4)}, {Number(amc.longitude).toFixed(4)}</span>
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          navigateToLocation({
                            latitude: amc.latitude,
                            longitude: amc.longitude,
                            address: siteAddress,
                            destinationName: customerName,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Navigation size={10} className="fill-emerald-700" />
                        <span>Get Route</span>
                      </button>
                      <a
                        href={getGoogleMapsPinUrl(amc.latitude, amc.longitude, siteAddress)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-cyan-700 transition-colors"
                      >
                        <span>Open Map</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </div>

                {amc.scope_of_support && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-normal mb-1">Scope of Support</span>
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
                      {amc.scope_of_support}
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* IN-APP INTEGRATED SEND MESSAGE MODAL */}
      <SendMessageModal
        isOpen={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        category="amc"
        recordData={messageRecord}
        initialChannel={messageChannel}
        onSuccess={() => { }}
      />

      {/* DEDICATED RESCHEDULE & EDIT VISIT MODAL */}
      <EditVisitModal
        open={editingVisitModalOpen}
        onClose={() => {
          setEditingVisitModalOpen(false);
          setSelectedVisitSlot(null);
        }}
        service={selectedVisitSlot?.service || null}
        slot={selectedVisitSlot}
        amc={amc}
        baseApi={baseApi}
        token={token}
        onSuccess={async () => {
          if (onRefreshServices) await onRefreshServices();
        }}
      />

      {/* DEDICATED CYCLE VISITS MODAL */}
      <CycleVisitsModal
        open={!!viewingCycleVisits}
        onClose={() => setViewingCycleVisits(null)}
        cycle={viewingCycleVisits?.cycle}
        amcContract={viewingCycleVisits?.amc || amc}
        baseApi={baseApi}
        token={token}
        formatDate={formatDate}
      />
    </div>
  );
}
