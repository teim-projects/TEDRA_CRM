import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import {
  MdClose,
  MdArrowBack,
  MdMail,
  MdEdit,
  MdDeleteOutline,
  MdEngineering,
  MdCheck,
  MdCheckCircle,
  MdAdd,
  MdVerified,
  MdLocationOn,
  MdPhone,
  MdPerson,
  MdAccessTime,
  MdOutlinePayment,
  MdChecklist,
  MdPersonAdd,
  MdNotes,
  MdNavigation,
  MdOpenInNew,
  MdMyLocation,
  MdUploadFile,
  MdImage,
  MdPictureAsPdf,
  MdDownload,
  MdCameraAlt,
  MdApartment,
  MdDirectionsCar,
} from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import { Package, RotateCcw, CheckCircle2, Layers, Send, Wrench, AlertCircle, ArrowUpRight, PackagePlus } from "lucide-react";
import { useUserRole } from "../../hooks/useAuth";
import SendMessageModal from "../templates/SendMessageModal";
import AllocateTechniciansModal from "../projects/AllocateTechniciansModal";
import AddActivityModal from "../technician/AddActivityModal";
import LocationPickerModal from "../common/LocationPickerModal";
import UploadAttachmentModal from "../technician/UploadAttachmentModal";
import CompleteVisitModal from "../technician/CompleteVisitModal";
import IssueStockModal from "../inventory/IssueStockModal";
import GeoLocationBadge from "../common/GeoLocationBadge";
import { navigateToLocation, getGoogleMapsPinUrl, getCurrentCoordinates } from "../../utils/navigation";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";

export default function ServiceDetailView({
  service,
  onBack,
  onEdit,
  onDelete,
  onAllocate,
  onRefresh,
  formatDate,
  token,
  baseApi,
  canEdit = true,
  canDelete = true,
}) {
  const [currentService, setCurrentService] = useState(service);

  useEffect(() => {
    setCurrentService(service);
  }, [service]);

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState("email");
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTech, setNewTaskTech] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [notesList, setNotesList] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [editDetailsModalOpen, setEditDetailsModalOpen] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [editDetailsForm, setEditDetailsForm] = useState({
    equipment: "",
    service_type: "",
    description: "",
    diagnosis: "",
    resolution_notes: "",
    service_address: "",
    latitude: "",
    longitude: "",
    location_url: "",
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [attachments, setAttachments] = useState(service.attachments || []);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [attachmentFilter, setAttachmentFilter] = useState("all");

  const filteredAttachments = useMemo(() => {
    if (attachmentFilter === "all") return attachments;
    if (attachmentFilter === "document") {
      return attachments.filter((a) => a.stage === "document" || a.file_type === "pdf");
    }
    return attachments.filter((a) => a.stage === attachmentFilter);
  }, [attachments, attachmentFilter]);

  const BASE_API = (baseApi || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  // Role detection: Superadmin can directly issue stock; Technicians can only request stock
  const { userRole, userInfo, hasPermission } = useUserRole(BASE_API);
  const isSuperUser = Boolean(userInfo?.is_superuser);
  const roleName = (userRole?.name || userInfo?.role_name || userInfo?.role?.name || "").toLowerCase();
  const isTechnician = roleName === "technician" || roleName.includes("technician") || Boolean(userInfo?.is_technician);
  const canDirectIssue = isSuperUser || roleName === "admin" || roleName === "superuser" || hasPermission("inventory", "create") || hasPermission("inventory", "edit");

  // Load and manage tasks for this service from localStorage
  const tasksStorageKey = `service_tasks_${currentService?.id || "temp"}`;
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(tasksStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      { id: 1, title: "Pre-inspection & feed water pressure check", completed: true, time: "10:45 AM" },
      { id: 2, title: "Pre-filter & membrane inspection", completed: true, time: "11:15 AM" },
      { id: 3, title: "Component replacement & chemical flush", completed: currentService?.status === "completed", time: "12:30 PM" },
      { id: 4, title: "Post-service TDS calibration & leak test", completed: currentService?.status === "completed", time: "01:05 PM" },
      { id: 5, title: "Customer sign-off & service report", completed: currentService?.status === "completed", time: "01:20 PM" },
    ];
  });

  // Save tasks to localStorage when updated
  useEffect(() => {
    try {
      localStorage.setItem(tasksStorageKey, JSON.stringify(tasks));
    } catch (e) {
      console.error("Failed to save tasks", e);
    }
  }, [tasks, tasksStorageKey]);

  const fetchNotes = async () => {
    if (!currentService?.id) return;
    const isVisit = Boolean(
      currentService.work_type === "amc_visit" ||
      currentService.amc_contract ||
      currentService.visit_number ||
      currentService.visit_index !== undefined
    );
    const endpoint = isVisit
      ? `${BASE_API}/amc/visits/${currentService.id}/notes/`
      : `${BASE_API}/amc/services/${currentService.id}/notes/`;

    try {
      setLoadingNotes(true);
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotesList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchAttachments = async () => {
    if (!currentService?.id) return;
    const isVisit = Boolean(
      currentService.work_type === "amc_visit" ||
      currentService.amc_contract ||
      currentService.visit_number ||
      currentService.visit_index !== undefined
    );
    const endpoint = isVisit
      ? `${BASE_API}/amc/visits/${currentService.id}/attachments/`
      : `${BASE_API}/amc/services/${currentService.id}/attachments/`;

    try {
      setLoadingAttachments(true);
      const res = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAttachments(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.warn("Could not load service attachments:", err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  // Complete Visit Modal state
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  // Issued Inventory / Spare Parts State
  const [issuedStock, setIssuedStock] = useState(service.issued_inventory || []);
  const [loadingIssuedStock, setLoadingIssuedStock] = useState(false);
  const [issueStockModalOpen, setIssueStockModalOpen] = useState(false);
  const [issueModalMode, setIssueModalMode] = useState("REQUEST"); // "ISSUE" | "REQUEST"
  const [inventoryItems, setInventoryItems] = useState([]);

  const handleOpenDirectIssue = () => {
    setIssueModalMode("ISSUE");
    setIssueStockModalOpen(true);
  };

  const handleOpenStockRequest = () => {
    setIssueModalMode("REQUEST");
    setIssueStockModalOpen(true);
  };

  const fetchIssuedStock = async () => {
    if (!currentService?.id) return;
    const isVisit = Boolean(
      currentService.work_type === "amc_visit" ||
      currentService.amc_contract ||
      currentService.visit_number ||
      currentService.visit_index !== undefined
    );
    const targetParam = isVisit ? `visit=${currentService.id}` : `service=${currentService.id}`;
    setLoadingIssuedStock(true);
    try {
      const res = await fetch(`${BASE_API}/inventory/transactions/?${targetParam}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setIssuedStock(list);
      } else if (Array.isArray(currentService.issued_inventory)) {
        setIssuedStock(currentService.issued_inventory);
      }
    } catch (err) {
      console.warn("Could not load issued inventory:", err);
    } finally {
      setLoadingIssuedStock(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await fetch(`${BASE_API}/inventory/items/`, {
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

  const stockSummary = useMemo(() => {
    const itemMap = {};
    (issuedStock || []).forEach((tx) => {
      const itemId = tx.item || tx.item_id;
      if (!itemId) return;
      if (!itemMap[itemId]) {
        itemMap[itemId] = {
          itemId,
          name: tx.item_name || "Spare Part",
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

  useEffect(() => {
    fetchNotes();
    fetchAttachments();
    fetchIssuedStock();
    fetchInventoryItems();
  }, [currentService?.id]);

  const handleOpenEditDetails = () => {
    setEditDetailsForm({
      equipment: currentService.equipment || currentService.project_details?.project_name || currentService.project_details?.product || "",
      service_type: currentService.service_type || currentService.visit_type || "routine_maintenance",
      description: currentService.description || "",
      diagnosis: currentService.diagnosis || "",
      resolution_notes: currentService.resolution_notes || "",
      service_address: currentService.service_address || currentService.visit_address || siteAddress || "",
      latitude: currentService.latitude || "",
      longitude: currentService.longitude || "",
      location_url: currentService.location_url || "",
    });
    setDetailsError("");
    setEditDetailsModalOpen(true);
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsError("");

    const isVisit = Boolean(
      currentService.work_type === "amc_visit" ||
      currentService.amc_contract ||
      currentService.visit_number ||
      currentService.visit_index !== undefined
    );

    const endpoint = isVisit
      ? `${BASE_API}/amc/visits/${currentService.id}/`
      : `${BASE_API}/amc/services/${currentService.id}/`;

    const payload = isVisit
      ? {
          equipment: editDetailsForm.equipment,
          visit_type: editDetailsForm.service_type,
          description: editDetailsForm.description,
          diagnosis: editDetailsForm.diagnosis,
          resolution_notes: editDetailsForm.resolution_notes,
          visit_address: editDetailsForm.service_address,
          latitude: editDetailsForm.latitude ? parseFloat(editDetailsForm.latitude) : null,
          longitude: editDetailsForm.longitude ? parseFloat(editDetailsForm.longitude) : null,
          location_url: editDetailsForm.location_url || "",
        }
      : {
          equipment: editDetailsForm.equipment,
          service_type: editDetailsForm.service_type,
          description: editDetailsForm.description,
          diagnosis: editDetailsForm.diagnosis,
          resolution_notes: editDetailsForm.resolution_notes,
          service_address: editDetailsForm.service_address,
          latitude: editDetailsForm.latitude ? parseFloat(editDetailsForm.latitude) : null,
          longitude: editDetailsForm.longitude ? parseFloat(editDetailsForm.longitude) : null,
          location_url: editDetailsForm.location_url || "",
        };

    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || JSON.stringify(errJson) || "Failed to update service details");
      }

      const updated = await res.json();
      setCurrentService((prev) => ({ ...prev, ...updated }));
      if (onRefresh) onRefresh(updated);
      setEditDetailsModalOpen(false);
      Swal.fire({
        icon: "success",
        title: "Updated",
        text: "Service details updated successfully.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Error saving service details:", err);
      setDetailsError(err.message || "Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  };

  const safeService = currentService || {};

  const siteObj =
    safeService.site_details ||
    safeService.amc_contract_details?.site_details ||
    safeService.project_details?.site_details ||
    null;

  const siteName =
    safeService.site_name ||
    siteObj?.name ||
    safeService.site?.name ||
    "";

  const siteShortcut =
    safeService.site_shortcut ||
    siteObj?.site_shortcut ||
    safeService.site?.site_shortcut ||
    "";

  const customerName =
    safeService.customer_details?.company_name ||
    safeService.customer_details?.name ||
    safeService.customer_name ||
    safeService.customer ||
    "Customer Account";

  const siteAddress =
    safeService.service_address ||
    safeService.visit_address ||
    siteObj?.address ||
    (siteObj?.city && siteObj?.state ? `${siteObj.city}, ${siteObj.state}` : siteObj?.city) ||
    safeService.customer_details?.billing_address ||
    safeService.customer_details?.city ||
    "—";

  const serviceTitle =
    safeService.description
      ? safeService.description.length > 50
        ? `${safeService.description.substring(0, 50)}...`
        : safeService.description
      : safeService.service_type_display ||
        safeService.visit_type_display ||
        (safeService.service_type ? safeService.service_type.replace(/_/g, " ") : "") ||
        (safeService.visit_type ? safeService.visit_type.replace(/_/g, " ") : "") ||
        (safeService.service_number || safeService.visit_number || "Service");

  const equipmentName =
    safeService.equipment ||
    safeService.project_details?.project_name ||
    safeService.project_details?.product ||
    "";

  const serialNumber =
    safeService.serial_number ||
    safeService.project_details?.project_code ||
    "";

  const isAMCVisit = Boolean(
    safeService.work_type === "amc_visit" ||
    safeService.amc_contract ||
    safeService.contract_id ||
    safeService.visit_number ||
    safeService.visit_index !== undefined ||
    safeService.service_category === "amc_service"
  );

  const techniciansList = useMemo(() => {
    if (!currentService) return [];
    if (Array.isArray(currentService.technicians_details) && currentService.technicians_details.length > 0) {
      return currentService.technicians_details;
    }
    if (Array.isArray(currentService.assigned_technicians_list) && currentService.assigned_technicians_list.length > 0) {
      return currentService.assigned_technicians_list;
    }
    if (Array.isArray(currentService.technicians) && currentService.technicians.length > 0) {
      return currentService.technicians;
    }
    return [];
  }, [currentService]);

  const getTechName = (tech) => {
    if (!tech) return "";
    if (typeof tech === "string") return tech;
    const name = tech.name || `${tech.first_name || ""} ${tech.last_name || ""}`.trim();
    return name || tech.username || tech.email || "Technician";
  };

  const getTechInitials = (tech) => {
    if (!tech) return "T";
    if (typeof tech === "string") return tech.substring(0, 2).toUpperCase();
    const initials = `${tech.first_name?.[0] || ""}${tech.last_name?.[0] || ""}`.toUpperCase();
    if (initials) return initials;
    const name = tech.name || tech.username || tech.email || "";
    return name.substring(0, 2).toUpperCase() || "T";
  };

  const getTechRole = (tech) => {
    if (!tech) return "Field Service Specialist";
    if (typeof tech.role === "string" && tech.role.trim()) return tech.role;
    if (tech.role?.name) return tech.role.name;
    return "Field Service Specialist";
  };

  const getTechPhone = (tech) => {
    if (!tech) return "";
    return tech.mobile_no || tech.mobile || tech.phone || "";
  };

  const primaryTech = techniciansList[0] || currentService.service_engineer_details || null;
  const primaryTechName = primaryTech ? getTechName(primaryTech) : null;
  const primaryTechInitials = primaryTech ? getTechInitials(primaryTech) : "T";

  const serviceCost = parseFloat(currentService.service_cost || 2500);
  const taxes = Math.round(serviceCost * 0.18);
  const totalPayable = serviceCost + taxes;

  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const taskProgressPercent = Math.round((completedTasksCount / Math.max(1, tasks.length)) * 100);

  // Stepper milestones calculations
  const isStarted = currentService.status === "in_progress" || currentService.status === "completed";
  const isDiagnosed = Boolean(currentService.diagnosis) || isStarted;
  const isRepairDone = currentService.status === "completed";
  const isSigned = currentService.status === "completed";

  // Extract field GPS route milestones:
  // 1) From where technician navigated (journey_started)
  // 2) From where technician started work on-site (visit_started)
  // 3) Where technician completed the work (job_completed)
  const journeyMilestone = useMemo(() => {
    const fromNotes = notesList.find((n) => n.action === "journey_started");
    if (fromNotes) return fromNotes;
    const embedded = (currentService?.activities || []).find((a) => a.action === "journey_started");
    if (embedded) return embedded;
    if (currentService?.milestones?.journey_started_at) {
      return {
        action: "journey_started",
        created_at: currentService.milestones.journey_started_at,
        latitude: currentService.milestones.journey_lat,
        longitude: currentService.milestones.journey_lng,
        accuracy: currentService.milestones.journey_accuracy,
        technician_name: currentService.milestones.journey_technician,
        notes: "Technician navigated to site.",
      };
    }
    return null;
  }, [notesList, currentService]);

  const visitMilestone = useMemo(() => {
    const fromNotes = notesList.find((n) => n.action === "visit_started");
    if (fromNotes) return fromNotes;
    const embedded = (currentService?.activities || []).find((a) => a.action === "visit_started");
    if (embedded) return embedded;
    if (currentService?.milestones?.visit_started_at) {
      return {
        action: "visit_started",
        created_at: currentService.milestones.visit_started_at,
        latitude: currentService.milestones.visit_lat,
        longitude: currentService.milestones.visit_lng,
        accuracy: currentService.milestones.visit_accuracy,
        technician_name: currentService.milestones.visit_technician,
        notes: "Technician checked in on-site.",
      };
    }
    return null;
  }, [notesList, currentService]);

  const completedMilestone = useMemo(() => {
    const fromNotes = notesList.find((n) => n.action === "job_completed");
    if (fromNotes) return fromNotes;
    const embedded = (currentService?.activities || []).find((a) => a.action === "job_completed");
    if (embedded) return embedded;
    if (currentService?.milestones?.job_completed_at) {
      return {
        action: "job_completed",
        created_at: currentService.milestones.job_completed_at,
        latitude: currentService.milestones.job_completed_lat,
        longitude: currentService.milestones.job_completed_lng,
        accuracy: currentService.milestones.job_completed_accuracy,
        technician_name: currentService.milestones.job_completed_technician,
        notes: "Work completed and signed off.",
      };
    }
    return null;
  }, [notesList, currentService]);

  const formatDateTimeStr = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const handleStartJourney = async () => {
    // 1. Show waiting indicator for location permission prompt
    Swal.fire({
      title: "Starting Journey...",
      html: `
        <div style="font-size: 13px; color: #475569; padding: 6px 0;">
          Acquiring departure GPS coordinates.<br/>
          <span style="font-weight: 600; color: #0284c7;">Please tap 'Allow' if prompted by your browser.</span>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // 2. Await user response to browser location prompt (Allow or Deny)
    let coords = null;
    try {
      coords = await getCurrentCoordinates().catch(() => null);
    } catch (_) {}

    // 3. Log departure milestone to backend
    try {
      const isVisit = Boolean(
        currentService.work_type === "amc_visit" ||
        currentService.amc_contract ||
        currentService.visit_number ||
        currentService.visit_index !== undefined
      );
      await fetch(`${BASE_API}/technician/services/${currentService.id}/start-journey/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          work_type: isVisit ? "amc_visit" : "single_service",
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          accuracy: coords?.accuracy || null,
          notes: "Technician clicked Navigate Route to start journey.",
        }),
      });
      fetchNotes();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn("Could not log journey milestone:", err);
    } finally {
      Swal.close();
    }

    // 4. Launch Google Maps navigation in a separate app/tab (keeping CRM website active)
    navigateToLocation({
      latitude: currentService.latitude,
      longitude: currentService.longitude,
      address: siteAddress || currentService.service_address || currentService.customer_address,
      destinationName: customerName || equipmentName || "Service Site",
    });
  };

  const openWhatsAppModal = () => {
    setMessageChannel("whatsapp");
    setMessageModalOpen(true);
  };

  const openEmailModal = () => {
    setMessageChannel("email");
    setMessageModalOpen(true);
  };

  const openTechWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = String(phone).replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  const handleToggleTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddNewTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: Date.now(),
      title: newTaskTitle.trim(),
      completed: false,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      technician: newTaskTech || primaryTechName || "Assigned Technician",
      priority: newTaskPriority,
    };

    setTasks((prev) => [...prev, newTask]);
    setNewTaskTitle("");
    setNewTaskTech("");
    setNewTaskPriority("medium");
    setAddTaskModalOpen(false);

    Swal.fire({
      icon: "success",
      title: "Task Added",
      text: "New service task has been added to the checklist.",
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const handleDeleteTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };


  const scheduledDateVal =
    currentService.service_date ||
    currentService.visit_date ||
    currentService.scheduled_date ||
    "";
  const isDateDue = isServiceDue(scheduledDateVal);
  const formattedScheduledDate = formatDisplayDate(scheduledDateVal);
  const isVisit = Boolean(currentService?.work_type === "amc_visit" || currentService?.contract_id || currentService?.visit_number);

  // Quick Status changer
  const handleQuickStatusChange = async (newStatus) => {
    if (newStatus === "in_progress" && !isDateDue) {
      Swal.fire({
        icon: "warning",
        title: "Service Not Due Yet",
        text: `This ${isVisit ? "visit" : "service"} is scheduled for ${formattedScheduledDate}. It can only be started on or after the scheduled date.`,
      });
      return;
    }

    if (newStatus === "completed") {
      if (!isDateDue) {
        Swal.fire({
          icon: "warning",
          title: "Cannot Complete Before Scheduled Date",
          text: `This ${isVisit ? "visit" : "service"} is scheduled for ${formattedScheduledDate}. It cannot be marked completed before the scheduled date arrives.`,
        });
        return;
      }
      if (currentService.status !== "in_progress" && currentService.status !== "completed") {
        Swal.fire({
          icon: "warning",
          title: "Must Start Service First",
          text: `This ${isVisit ? "visit" : "service"} has not been started yet. Please start it first (set to In Progress) before marking it completed.`,
        });
        return;
      }
      setCompleteModalOpen(true);
      return;
    }

    setUpdatingStatus(true);
    const targetUrl = isVisit
      ? `${BASE_API}/amc/visits/${currentService.id}/`
      : `${BASE_API}/amc/services/${currentService.id}/`;
    try {
      const res = await fetch(targetUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: newStatus,
          completion_date: newStatus === "completed" ? new Date().toISOString().split("T")[0] : null,
        }),
      });

      if (res.ok) {
        const updated = await res.json().catch(() => null);
        if (updated) {
          setCurrentService((prev) => ({ ...prev, ...updated }));
        }
        if (onRefresh) onRefresh(updated);
        Swal.fire({
          icon: "success",
          title: "Status Updated",
          text: `Service marked as ${newStatus.replace(/_/g, " ")}.`,
          timer: 1200,
          showConfirmButton: false,
        });
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update status");
      }
    } catch (err) {
      Swal.fire("Error", err.message || "Could not update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const customerPhone =
    currentService.contact_phone ||
    currentService.customer_details?.contact_number ||
    currentService.customer_details?.mobile_number ||
    "";

  const customerEmail =
    safeService.customer_details?.email ||
    safeService.customer_details?.email_address ||
    "";

  if (!currentService) return null;

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pb-10 text-xs">
      {/* BIG OUTER CONTAINER MATCHING AMC DETAIL VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
        
        {/* TOP ROW: Back button & Breadcrumb Navigation (Matching Follow-up History UI) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-95 w-fit"
            title="Return to Work Desk"
          >
            <MdArrowBack size={15} className="text-slate-500" />
            <span>Back to Work Desk</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <button
              onClick={onBack}
              className="hover:text-sky-600 transition-colors cursor-pointer"
            >
              Work Desk
            </button>
            <span>/</span>
            <span className="text-slate-900 font-bold">
              {currentService.service_number || `#SRV-${currentService.id}`}
            </span>
          </div>
        </div>

        {/* TOP HEADER SECTION */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Reference ID Tag */}
            <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wide">
              <span>{currentService.service_number || `#SRV-${currentService.id}`}</span>
            </div>

            {/* Title */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5 truncate">
              {serviceTitle}
            </h1>

            {/* Customer & Site */}
            <div className="mt-0.5">
              <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                {customerName}
              </span>

              {/* Site Name (Reduced size, compact badge below Customer Name) */}
              {siteName && (
                <div className="mt-0.5">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs max-w-full sm:max-w-xs truncate"
                    title={`${siteName}${siteShortcut ? ` (${siteShortcut})` : ""}`}
                  >
                    <span className="text-[10px] shrink-0">📍</span>
                    <span className="truncate">{siteName}</span>
                    {siteShortcut && (
                      <span className="text-[9px] font-mono text-cyan-700 font-bold ml-0.5 shrink-0">
                        ({siteShortcut})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Address */}
              {siteAddress && siteAddress !== "—" && (
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-normal mt-0.5 truncate max-w-md" title={siteAddress}>
                  · {siteAddress}
                </p>
              )}
            </div>
          </div>

          {/* Top Right Controls & Action Buttons (Strictly in single line matching 2nd screenshot) */}
          <div className="flex items-center gap-1.5 sm:gap-2 self-start lg:self-center shrink-0 flex-nowrap overflow-x-auto max-w-full pb-1 sm:pb-0">
            {/* Status Pill Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-2xs capitalize whitespace-nowrap shrink-0 ${
                currentService.status === "completed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : currentService.status === "in_progress"
                  ? "bg-sky-50 text-sky-700 border-sky-100"
                  : "bg-amber-50 text-amber-700 border-amber-100"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  currentService.status === "completed"
                    ? "bg-emerald-500"
                    : currentService.status === "in_progress"
                    ? "bg-sky-500"
                    : "bg-amber-500"
                }`}
              ></span>
              {currentService.status_display || currentService.status?.replace(/_/g, " ") || "In Progress"}
            </span>

            {/* Allocate Work Button - Prominent CTA if no technician allocated */}
            {techniciansList.length === 0 ? (
              <button
                type="button"
                onClick={() => setAllocateModalOpen(true)}
                className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs hover:shadow-sm transition-all cursor-pointer animate-pulse whitespace-nowrap shrink-0"
                title="Allocate Work to Technician"
              >
                <MdEngineering size={14} />
                <span>Allocate Work</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAllocateModalOpen(true)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Reassign / Change Technicians"
              >
                <MdEngineering size={13} className="text-slate-500" />
                <span>Reassign</span>
              </button>
            )}

            {/* Live Navigation Route Button */}
            <button
              type="button"
              onClick={handleStartJourney}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Navigate live turn-by-turn route to site via GPS"
            >
              <MdNavigation size={13} />
              <span>Navigate Route</span>
            </button>

            {/* + Add Task Button (Explicitly requested by user) */}
            <button
              type="button"
              onClick={() => setAddTaskModalOpen(true)}
              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs hover:shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <MdAdd size={14} />
              <span>Add Task</span>
            </button>

            {/* + Upload Photos / PDF Button (Explicitly requested by user side of Add Task) */}
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs hover:shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Upload breakdown/before photos, after photos, or service PDF documents"
            >
              <MdUploadFile size={14} className="text-sky-600" />
              <span>Upload Photos / PDF</span>
            </button>

            {/* Action Buttons: Allocate, Note, WhatsApp, Email, Edit, Delete, Close */}
            <div className="flex items-center gap-0.5 text-slate-400 shrink-0">
              <button
                type="button"
                onClick={() => setAllocateModalOpen(true)}
                className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                title="Allocate / Reassign Technicians"
              >
                <MdEngineering size={15} />
              </button>

              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                className="p-1 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                title="Add Site Note / Activity Log"
              >
                <MdNotes size={15} />
              </button>

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
                  onClick={handleOpenEditDetails}
                  className="p-1 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer"
                  title="Edit Service Record"
                >
                  <MdEdit size={14} />
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(currentService.id)}
                  className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                  title="Delete Service Record"
                >
                  <MdDeleteOutline size={15} />
                </button>
              )}

              <button
                type="button"
                onClick={onBack}
                className="p-1 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer ml-0.5 border-l border-slate-200 pl-1.5 text-slate-400"
                title="Close Service Details"
              >
                <MdClose size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI PULSE CARDS ROW (Exact match with Figma Screenshot & AMCDetailView) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Coverage (Dynamic for AMC visits, single services, chargeable & warranty) */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                Coverage
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  isAMCVisit
                    ? "bg-teal-50 text-teal-700 border border-teal-200"
                    : parseFloat(currentService.service_cost || 0) > 0
                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {isAMCVisit ? "AMC Contract" : parseFloat(currentService.service_cost || 0) > 0 ? "Billable" : "Warranty"}
              </span>
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-1">
              {isAMCVisit
                ? "AMC Contract Covered"
                : parseFloat(currentService.service_cost || 0) > 0
                ? "Chargeable Service"
                : "Warranty / Included"}
            </span>
            <span className="text-[10px] text-slate-500 font-normal block mt-0.5 truncate">
              {isAMCVisit
                ? currentService.contract_id
                  ? `Covered under AMC (${currentService.contract_id}) · Scheduled Visit`
                  : "Contract covered · Scheduled AMC visit"
                : parseFloat(currentService.service_cost || 0) > 0
                ? `Standard on-demand billing · ₹${parseFloat(currentService.service_cost).toLocaleString("en-IN")}`
                : "Warranty covered · Complimentary"}
            </span>
          </div>

          {/* KPI 2: Assigned technician */}
          <div
            onClick={() => setAllocateModalOpen(true)}
            className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs cursor-pointer hover:border-cyan-400 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                Assigned technician
              </span>
              {techniciansList.length === 0 ? (
                <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                  Unallocated
                </span>
              ) : (
                <span className="text-[10px] text-cyan-600 font-semibold group-hover:underline">
                  Change
                </span>
              )}
            </div>
            <span
              className={`text-xs sm:text-[13px] font-bold block mt-1 truncate ${
                primaryTechName ? "text-slate-900" : "text-amber-600"
              }`}
              title={
                techniciansList.length > 1
                  ? techniciansList.map(getTechName).join(", ")
                  : primaryTechName || "No technician allocated"
              }
            >
              {techniciansList.length > 1
                ? `${primaryTechName} (+${techniciansList.length - 1} more)`
                : primaryTechName || "Unassigned"}
            </span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-medium block truncate">
                {primaryTech ? (primaryTech.email || getTechRole(primaryTech)) : "No staff allocated"}
              </span>
              {techniciansList.length === 0 && (
                <span className="text-[10px] text-cyan-600 font-bold underline">
                  Allocate Work
                </span>
              )}
            </div>
          </div>

          {/* KPI 3: Visit schedule */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Visit schedule
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {formatDate ? formatDate(currentService.service_date) : currentService.service_date || "Scheduled"}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              Customer confirmed
            </span>
          </div>

          {/* KPI 4: Time spent / Duration */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Time spent
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {currentService.time_spent || currentService.duration || (currentService.status === "completed" ? "Completed" : currentService.status === "in_progress" ? "In Progress" : "Est. 2h")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              {currentService.status === "completed"
                ? "On-site execution"
                : currentService.status === "in_progress"
                ? "Underway on-site"
                : "Planned standard visit"}
            </span>
          </div>
        </div>

        {/* MAIN TWO-COLUMN WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* LEFT 2 COLUMNS: Service Details and Tasks Checklist */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* CARD 1: Service details (Key-Value Table from Figma) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                    Service details
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Technical report parameters
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenEditDetails}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <MdEdit size={13} />
                    <span>Edit details</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 grid grid-cols-3 gap-2">
                  <span className="text-slate-400 font-medium">Equipment</span>
                  <span className="col-span-2 font-semibold text-slate-900">{equipmentName || "—"}</span>
                </div>

                <div className="py-2.5 grid grid-cols-3 gap-2">
                  <span className="text-slate-400 font-medium">Issue category</span>
                  <span className="col-span-2 font-semibold text-slate-900 capitalize">
                    {currentService.service_type_display ||
                      currentService.visit_type_display ||
                      (currentService.service_type ? currentService.service_type.replace(/_/g, " ") : "") ||
                      (currentService.visit_type ? currentService.visit_type.replace(/_/g, " ") : "") ||
                      "—"}
                  </span>
                </div>

                <div className="py-2.5 grid grid-cols-3 gap-2">
                  <span className="text-slate-400 font-medium">Problem reported</span>
                  <span className="col-span-2 text-slate-700 leading-relaxed">
                    {currentService.description || "—"}
                  </span>
                </div>

                <div className="py-2.5 grid grid-cols-3 gap-2">
                  <span className="text-slate-400 font-medium">Diagnosis</span>
                  <span className="col-span-2 text-slate-700 leading-relaxed">
                    {currentService.diagnosis || "—"}
                  </span>
                </div>

                <div className="py-2.5 grid grid-cols-3 gap-2">
                  <span className="text-slate-400 font-medium">Work performed</span>
                  <span className="col-span-2 text-slate-700 leading-relaxed">
                    {currentService.resolution_notes || "—"}
                  </span>
                </div>

                {/* Linked Parking Facility / Site */}
                {(siteObj || siteName) && (
                  <div className="py-2.5 grid grid-cols-3 gap-2 items-start border-b border-slate-100">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <MdApartment className="text-sky-600 shrink-0" size={14} />
                      <span>Facility site</span>
                    </span>
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {siteName}
                        </span>
                        {siteShortcut && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-50 text-sky-700 font-bold border border-sky-200">
                            {siteShortcut}
                          </span>
                        )}
                        {siteObj?.capacity_cars > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            🚗 {siteObj.capacity_cars} Cars
                          </span>
                        )}
                      </div>
                      {siteObj?.site_type && (
                        <p className="text-[11px] text-slate-500">
                          {siteObj.site_type}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Site Location & Route */}
                <div className="py-2.5 grid grid-cols-3 gap-2 items-start">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <MdLocationOn className="text-rose-500 shrink-0" size={14} />
                    <span>Site location</span>
                  </span>
                  <div className="col-span-2 space-y-1.5">
                    <span className="font-semibold text-slate-900 block leading-relaxed">
                      {siteAddress || "No site address specified"}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {currentService.latitude && currentService.longitude ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-medium">
                          <MdMyLocation size={11} />
                          <span>{Number(currentService.latitude).toFixed(4)}°, {Number(currentService.longitude).toFixed(4)}°</span>
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleStartJourney}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                        title="Get live turn-by-turn driving route"
                      >
                        <MdNavigation size={12} />
                        <span>Get Route</span>
                      </button>
                      {(currentService.latitude && currentService.longitude) || currentService.location_url ? (
                        <a
                          href={getGoogleMapsPinUrl({
                            latitude: currentService.latitude,
                            longitude: currentService.longitude,
                            address: siteAddress,
                            location_url: currentService.location_url,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-800 hover:underline"
                        >
                          <MdOpenInNew size={12} />
                          <span>Open Map</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD: Issued Spare Parts & Materials (Stock Reconciliation) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/80">
                    <Package size={18} />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                      {canDirectIssue
                        ? "Spare Parts & Materials Allocation"
                        : "Spare Parts & Materials Requisition"}
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {canDirectIssue
                        ? "Allocate spare parts directly from warehouse or manage requisition requests for this service visit"
                        : "Request spare parts from warehouse inventory for this service visit"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {stockSummary.items.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {stockSummary.items.length} {stockSummary.items.length === 1 ? "Part" : "Parts"}
                    </span>
                  )}

                  {canDirectIssue ? (
                    <div className="flex items-center gap-1.5">
                      {/* Direct Issue Button for Superadmin / Manager */}
                      <button
                        type="button"
                        onClick={handleOpenDirectIssue}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                        title="Directly issue and allocate stock to technician from warehouse"
                      >
                        <ArrowUpRight size={13} />
                        <span>Issue Stock</span>
                      </button>

                      {/* Requisition Option also accessible to Superadmin */}
                      <button
                        type="button"
                        onClick={handleOpenStockRequest}
                        className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                        title="Submit a stock requisition request"
                      >
                        <Wrench size={11} className="text-slate-500" />
                        <span>Request Stock</span>
                      </button>
                    </div>
                  ) : (
                    /* ONLY Request Stock option for Field Technician */
                    <button
                      type="button"
                      onClick={handleOpenStockRequest}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                      title="Request stock parts from warehouse for this service"
                    >
                      <Wrench size={11} />
                      <span>Request Stock</span>
                    </button>
                  )}
                </div>
              </div>

              {loadingIssuedStock ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading inventory items...</span>
                </div>
              ) : stockSummary.items.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                  <p className="text-xs text-slate-500 font-medium">
                    No spare parts or inventory materials have been requested or issued for this service yet.
                  </p>
                  {canDirectIssue ? (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleOpenDirectIssue}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        <ArrowUpRight size={13} />
                        <span>Issue Parts from Inventory</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenStockRequest}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                      >
                        <Wrench size={12} className="text-slate-500" />
                        <span>Request Stock</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenStockRequest}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Wrench size={12} />
                      <span>Request Parts from Inventory</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* KPI Stat Cards */}
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
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Used / Consumed</span>
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
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">In Hand with Tech</span>
                      <span className="text-sm font-bold text-amber-800 block mt-0.5">{stockSummary.totalInHand}</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto border border-slate-200/90 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                          <th className="py-2.5 px-3">Spare Part / Item</th>
                          <th className="py-2.5 px-3 text-center">Issued / Requested Qty</th>
                          <th className="py-2.5 px-3">Technician</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Status / Reconciliation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockSummary.items.map((it) => {
                          const inHand = Math.max(0, it.issuedQty - it.returnedQty);
                          const isCompleted = currentService.status === "completed";
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
                                <span className="text-slate-700 font-medium">{it.technician || "Assigned Tech"}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                {it.date ? new Date(it.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {isCompleted ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 size={10} />
                                      <span>Used: {it.usedQty} {it.unit}</span>
                                    </span>
                                    {it.returnedQty > 0 && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                        <RotateCcw size={10} />
                                        <span>Returned: {it.returnedQty} {it.unit}</span>
                                      </span>
                                    )}
                                  </div>
                                ) : it.pendingIssueQty > 0 && it.issuedQty === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
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

            {/* CARD 2: Field GPS & Route Milestones (Departure, Arrival, Completion) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/80">
                    <MdNavigation size={18} />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                      Field Route & GPS Milestones
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Audited locations: from where navigated, where work started, and where completed
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  GPS Audit
                </span>
              </div>

              {/* 3 Milestone Columns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Milestone 1: Navigated (Departure Location) */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  journeyMilestone
                    ? "bg-sky-50/60 border-sky-200/80 shadow-2xs"
                    : "bg-slate-50/50 border-dashed border-slate-200"
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-800 flex items-center gap-1.5">
                        <span>🚗</span>
                        <span>1. From Where Navigated</span>
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        journeyMilestone ? "bg-sky-100 text-sky-700 border border-sky-300" : "bg-slate-200/70 text-slate-500"
                      }`}>
                        {journeyMilestone ? "Departed" : "Pending"}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span className="text-slate-400">Timestamp:</span>
                        <span className="font-semibold text-slate-800 font-mono text-[10px]">
                          {journeyMilestone?.created_at ? formatDateTimeStr(journeyMilestone.created_at) : "Not started yet"}
                        </span>
                      </div>

                      {journeyMilestone?.technician_name && (
                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span className="text-slate-400">Technician:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                            {journeyMilestone.technician_name}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200/60">
                        {journeyMilestone?.latitude && journeyMilestone?.longitude ? (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-medium block">Departure Location:</span>
                            <GeoLocationBadge
                              latitude={journeyMilestone.latitude}
                              longitude={journeyMilestone.longitude}
                              accuracy={journeyMilestone.accuracy}
                            />
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic flex items-center justify-between">
                            <span>GPS Coords:</span>
                            <span>No GPS logged</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {journeyMilestone?.latitude && journeyMilestone?.longitude ? (
                    <a
                      href={`https://www.google.com/maps?q=${journeyMilestone.latitude},${journeyMilestone.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full py-1.5 px-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <MdOpenInNew size={12} />
                      <span>View Departure Point on Maps</span>
                    </a>
                  ) : (
                    <div className="mt-3 py-1.5 px-2 bg-slate-100 rounded text-center text-[10px] text-slate-400">
                      Departure location not recorded
                    </div>
                  )}
                </div>

                {/* Milestone 2: Where Work Started (Arrival Location) */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  visitMilestone
                    ? "bg-amber-50/60 border-amber-200/80 shadow-2xs"
                    : "bg-slate-50/50 border-dashed border-slate-200"
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                        <span>📍</span>
                        <span>2. Where Work Started</span>
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        visitMilestone ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-slate-200/70 text-slate-500"
                      }`}>
                        {visitMilestone ? "On-Site" : "Pending"}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span className="text-slate-400">Timestamp:</span>
                        <span className="font-semibold text-slate-800 font-mono text-[10px]">
                          {visitMilestone?.created_at ? formatDateTimeStr(visitMilestone.created_at) : "Awaiting check-in"}
                        </span>
                      </div>

                      {visitMilestone?.technician_name && (
                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span className="text-slate-400">Technician:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                            {visitMilestone.technician_name}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200/60">
                        {visitMilestone?.latitude && visitMilestone?.longitude ? (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-medium block">Check-in Location:</span>
                            <GeoLocationBadge
                              latitude={visitMilestone.latitude}
                              longitude={visitMilestone.longitude}
                              accuracy={visitMilestone.accuracy}
                            />
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic flex items-center justify-between">
                            <span>GPS Coords:</span>
                            <span>No GPS logged</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {visitMilestone?.latitude && visitMilestone?.longitude ? (
                    <a
                      href={`https://www.google.com/maps?q=${visitMilestone.latitude},${visitMilestone.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <MdOpenInNew size={12} />
                      <span>View Check-in Point on Maps</span>
                    </a>
                  ) : (
                    <div className="mt-3 py-1.5 px-2 bg-slate-100 rounded text-center text-[10px] text-slate-400">
                      Check-in location not recorded
                    </div>
                  )}
                </div>

                {/* Milestone 3: Where Work Completed */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  completedMilestone
                    ? "bg-emerald-50/60 border-emerald-200/80 shadow-2xs"
                    : "bg-slate-50/50 border-dashed border-slate-200"
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                        <span>✅</span>
                        <span>3. Where Completed</span>
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        completedMilestone ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-200/70 text-slate-500"
                      }`}>
                        {completedMilestone ? "Completed" : "Pending"}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span className="text-slate-400">Timestamp:</span>
                        <span className="font-semibold text-slate-800 font-mono text-[10px]">
                          {completedMilestone?.created_at ? formatDateTimeStr(completedMilestone.created_at) : "Pending completion"}
                        </span>
                      </div>

                      {completedMilestone?.technician_name && (
                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span className="text-slate-400">Technician:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                            {completedMilestone.technician_name}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200/60">
                        {completedMilestone?.latitude && completedMilestone?.longitude ? (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-medium block">Completion Location:</span>
                            <GeoLocationBadge
                              latitude={completedMilestone.latitude}
                              longitude={completedMilestone.longitude}
                              accuracy={completedMilestone.accuracy}
                            />
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic flex items-center justify-between">
                            <span>GPS Coords:</span>
                            <span>No GPS logged</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {completedMilestone?.latitude && completedMilestone?.longitude ? (
                    <a
                      href={`https://www.google.com/maps?q=${completedMilestone.latitude},${completedMilestone.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <MdOpenInNew size={12} />
                      <span>View Completion Point on Maps</span>
                    </a>
                  ) : (
                    <div className="mt-3 py-1.5 px-2 bg-slate-100 rounded text-center text-[10px] text-slate-400">
                      Completion location not recorded
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 3: Service Tasks & Checklist (With + Add Task button) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                    <MdChecklist className="text-sky-600" size={16} />
                    <span>Service tasks & inspection checklist</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {completedTasksCount} of {tasks.length} tasks completed ({taskProgressPercent}%)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAddTaskModalOpen(true)}
                  className="px-2.5 py-1 text-xs text-sky-600 hover:text-sky-800 font-semibold border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <MdAdd size={14} />
                  <span>Add Task</span>
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${taskProgressPercent}%` }}
                ></div>
              </div>

              {/* Tasks list */}
              <div className="space-y-2 pt-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      task.completed
                        ? "bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/60"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          task.completed
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {task.completed && <MdCheck size={12} className="stroke-2" />}
                      </div>

                      <span
                        className={`text-xs truncate ${
                          task.completed
                            ? "line-through text-slate-400 font-normal"
                            : "text-slate-800 font-medium"
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-2">
                      {task.time && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {task.time}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                        title="Delete Task"
                      >
                        <RxCross2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 4: Site Notes & Activity Logs */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                    <MdNotes className="text-amber-600" size={16} />
                    <span>Site notes & activity logs</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Technician site observations and notes ({notesList.length})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(true)}
                  className="px-2.5 py-1 text-xs text-amber-700 hover:text-amber-800 font-semibold border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-1 cursor-pointer bg-amber-50/50"
                >
                  <MdAdd size={14} />
                  <span>Add Note</span>
                </button>
              </div>

              {loadingNotes ? (
                <div className="py-4 text-center text-xs text-slate-400">Loading notes...</div>
              ) : notesList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No site notes logged yet. Click "+ Add Note" to record observations or requested parts.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {notesList.map((item) => {
                    const isJourney = item.action === "journey_started";
                    const isVisit = item.action === "visit_started";
                    const isCompleted = item.action === "job_completed";
                    const hasGps = item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border space-y-1.5 text-xs transition-colors ${
                          isJourney
                            ? "bg-sky-50/70 border-sky-200"
                            : isVisit
                            ? "bg-amber-50/70 border-amber-200"
                            : isCompleted
                            ? "bg-emerald-50/70 border-emerald-200"
                            : "bg-slate-50/80 border-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-800">
                              {item.technician_name || "Staff"}
                            </span>
                            {isJourney && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                                🚗 Journey Started
                              </span>
                            )}
                            {isVisit && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                📍 Arrived / Started Work
                              </span>
                            )}
                            {isCompleted && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✅ Work Completed
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.created_at ? new Date(item.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "-"}
                          </span>
                        </div>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{item.notes}</p>
                        {hasGps && (
                          <div className="pt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span>📍 GPS: {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}</span>
                            {item.accuracy && <span>(±{Math.round(item.accuracy)}m)</span>}
                            <a
                              href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-600 hover:text-sky-800 font-semibold underline flex items-center gap-0.5"
                            >
                              <span>View on Maps</span>
                              <span>↗</span>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CARD 5: Site Photos & Service Documents (Breakdown Photos, After Photos, Reports) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                    <MdCameraAlt className="text-sky-600" size={16} />
                    <span>Site photos & service documents</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Breakdown / before photos, after photos & PDF reports ({attachments.length})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(true)}
                    className="px-2.5 py-1 text-xs text-sky-600 hover:text-sky-800 font-semibold border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors flex items-center gap-1 cursor-pointer bg-sky-50/50"
                  >
                    <MdUploadFile size={14} />
                    <span>+ Upload Files</span>
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto text-xs">
                {["all", "before", "after", "document"].map((tab) => {
                  const count =
                    tab === "all"
                      ? attachments.length
                      : attachments.filter((a) => a.stage === tab || (tab === "document" && a.file_type === "pdf")).length;
                  const label =
                    tab === "all"
                      ? "All Files"
                      : tab === "before"
                      ? "Before / Breakdown"
                      : tab === "after"
                      ? "After Work"
                      : "PDF & Reports";

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setAttachmentFilter(tab)}
                      className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors cursor-pointer shrink-0 ${
                        attachmentFilter === tab
                          ? "bg-sky-100/70 text-sky-800 font-bold"
                          : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Content Grid */}
              {loadingAttachments ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading attachments...</div>
              ) : filteredAttachments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p>No {attachmentFilter === "all" ? "" : attachmentFilter} photos or documents attached yet.</p>
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(true)}
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-lg border border-sky-200 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MdCameraAlt size={14} />
                    <span>Upload Site Photos / PDF</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredAttachments.map((item) => {
                    const fullUrl = item.file_url?.startsWith("http") ? item.file_url : `${BASE_API}${item.file_url}`;
                    const isPdf = item.file_type === "pdf" || item.file_name?.toLowerCase().endsWith(".pdf");

                    return (
                      <div
                        key={item.id}
                        className="group relative bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden flex flex-col justify-between hover:shadow-xs transition-all"
                      >
                        {isPdf ? (
                          <div className="p-3 flex flex-col items-center justify-center text-center h-28 bg-rose-50/40">
                            <MdPictureAsPdf className="text-rose-500 w-8 h-8 mb-1" />
                            <span className="text-[11px] font-semibold text-slate-700 truncate w-full px-1">
                              {item.file_name || item.title || "Document"}
                            </span>
                          </div>
                        ) : (
                          <div
                            onClick={() => setPreviewImage(fullUrl)}
                            className="relative h-28 bg-slate-100 overflow-hidden cursor-pointer"
                          >
                            <img
                              src={fullUrl}
                              alt={item.title || item.file_name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <span className="text-[10px] font-bold bg-black/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                                Zoom
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                              item.stage === "before"
                                ? "bg-amber-100 text-amber-800"
                                : item.stage === "after"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {item.stage_display || item.stage}
                          </span>

                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="text-slate-400 hover:text-sky-600 p-1 transition-colors"
                            title="Download / Open file"
                          >
                            <MdDownload size={14} />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT 1 COLUMN: DYNAMIC Technician Report & Payment */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* BOX 1: DYNAMIC Technician report (Matching AMC details pattern) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                    Technician report
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Field execution & resolution milestones
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllocateModalOpen(true)}
                  className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
                >
                  {techniciansList.length > 0 ? "Reassign" : "+ Assign"}
                </button>
              </div>

              {/* Dynamic Technician Profiles Banner */}
              {techniciansList.length > 0 ? (
                <div className="space-y-2">
                  {techniciansList.map((tech, idx) => {
                    const initials = getTechInitials(tech);
                    const fullName = getTechName(tech);
                    const roleTitle = getTechRole(tech);
                    const phone = getTechPhone(tech);

                    return (
                      <div
                        key={tech.id || idx}
                        className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-200/70"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate leading-tight text-xs">
                              {fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                              {roleTitle}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {phone && (
                            <>
                              <button
                                type="button"
                                onClick={() => openTechWhatsApp(phone)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="WhatsApp Technician"
                              >
                                <FaWhatsapp size={14} />
                              </button>
                              <a
                                href={`tel:${phone}`}
                                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                title="Call Technician"
                              >
                                <MdPhone size={14} />
                              </a>
                            </>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0 ${
                              currentService.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                                : currentService.status === "in_progress"
                                ? "bg-sky-50 text-sky-700 border-sky-200/60"
                                : "bg-amber-50 text-amber-700 border-amber-200/60"
                            }`}
                          >
                            {currentService.status === "completed"
                              ? "Job complete"
                              : currentService.status === "in_progress"
                              ? "On-Site"
                              : "Assigned"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 border-2 border-dashed border-amber-200 rounded-xl text-center bg-amber-50/40">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
                    <MdEngineering size={22} />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No Technician Allocated</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                    This work has not been allocated to any technician yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAllocateModalOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-95"
                  >
                    <MdPersonAdd size={15} />
                    <span>Allocate Work</span>
                  </button>
                </div>
              )}

              {/* Dynamic Stepper Timeline */}
              <div className="space-y-4 pt-1 pl-1 border-t border-slate-100 pt-3">
                {/* Milestone 1: Job Scheduled */}
                <div className="flex items-start gap-3 relative">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 z-10 shadow-xs">
                    <MdCheck size={13} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 text-xs">Job Scheduled</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDate ? formatDate(currentService.service_date) : currentService.service_date}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Service booked as {currentService.service_type_display || currentService.service_type || "maintenance"}
                    </p>
                  </div>
                </div>

                {/* Milestone 2: Journey Started / Navigated */}
                <div className="flex items-start gap-3 relative">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-xs ${
                      journeyMilestone ? "bg-sky-500 text-white" : "border-2 border-slate-200 bg-white text-slate-300"
                    }`}
                  >
                    {journeyMilestone ? <MdCheck size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-xs ${journeyMilestone ? "text-slate-800" : "text-slate-400"}`}>
                        1. Navigated to Site
                      </span>
                      {journeyMilestone && (
                        <span className="text-[10px] text-sky-600 font-semibold font-mono">
                          {formatDateTimeStr(journeyMilestone.created_at)}
                        </span>
                      )}
                    </div>
                    {journeyMilestone?.latitude && journeyMilestone?.longitude ? (
                      <div className="mt-1">
                        <GeoLocationBadge
                          latitude={journeyMilestone.latitude}
                          longitude={journeyMilestone.longitude}
                          accuracy={journeyMilestone.accuracy}
                          compact={true}
                          showMapsLink={true}
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {journeyMilestone ? "Journey initiated without GPS" : "Awaiting technician departure"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Milestone 3: Arrived on Site & Started Work */}
                <div className="flex items-start gap-3 relative">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-xs ${
                      visitMilestone
                        ? "bg-amber-500 text-white"
                        : isStarted
                        ? "bg-amber-400 text-white animate-pulse"
                        : "border-2 border-slate-200 bg-white text-slate-300"
                    }`}
                  >
                    {visitMilestone ? <MdCheck size={13} /> : isStarted ? <MdAccessTime size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-xs ${visitMilestone || isStarted ? "text-slate-800" : "text-slate-400"}`}>
                        2. Started Work (On-Site)
                      </span>
                      {visitMilestone && (
                        <span className="text-[10px] text-amber-600 font-semibold font-mono">
                          {formatDateTimeStr(visitMilestone.created_at)}
                        </span>
                      )}
                    </div>
                    {visitMilestone?.latitude && visitMilestone?.longitude ? (
                      <div className="mt-1">
                        <GeoLocationBadge
                          latitude={visitMilestone.latitude}
                          longitude={visitMilestone.longitude}
                          accuracy={visitMilestone.accuracy}
                          compact={true}
                          showMapsLink={true}
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        {currentService.diagnosis || (isStarted ? "Technician checked in on-site." : "Awaiting technician check-in on site.")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Milestone 4: Work Completed & Customer Sign-Off */}
                <div className="flex items-start gap-3 relative">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-xs ${
                      completedMilestone || isRepairDone
                        ? "bg-emerald-500 text-white"
                        : "border-2 border-slate-200 bg-white text-slate-300"
                    }`}
                  >
                    {completedMilestone || isRepairDone ? <MdCheck size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold text-xs ${
                          completedMilestone || isRepairDone ? "text-slate-800" : "text-slate-400"
                        }`}
                      >
                        3. Work Completed
                      </span>
                      {completedMilestone && (
                        <span className="text-[10px] text-emerald-600 font-semibold font-mono">
                          {formatDateTimeStr(completedMilestone.created_at)}
                        </span>
                      )}
                    </div>
                    {completedMilestone?.latitude && completedMilestone?.longitude ? (
                      <div className="mt-1">
                        <GeoLocationBadge
                          latitude={completedMilestone.latitude}
                          longitude={completedMilestone.longitude}
                          accuracy={completedMilestone.accuracy}
                          compact={true}
                          showMapsLink={true}
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        {completedMilestone
                          ? `Completed by ${completedMilestone.technician_name || "technician"}.`
                          : isRepairDone
                          ? "Work marked completed."
                          : "Awaiting job resolution and sign-off."}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Quick Actions inside Technician Report */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  {currentService.status !== "in_progress" && currentService.status !== "completed" && (
                    <button
                      type="button"
                      disabled={updatingStatus || !isDateDue}
                      onClick={() => {
                        if (!isDateDue) {
                          Swal.fire({
                            icon: "warning",
                            title: "Service Not Due Yet",
                            text: `This ${isVisit ? "visit" : "service"} is scheduled for ${formattedScheduledDate}. It can only be started on or after the scheduled date.`,
                          });
                          return;
                        }
                        handleQuickStatusChange("in_progress");
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all text-center border ${
                        isDateDue
                          ? "bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200 cursor-pointer"
                          : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                      }`}
                      title={
                        isDateDue
                          ? `Start ${isVisit ? "Visit" : "Service"}`
                          : `Scheduled for ${formattedScheduledDate}. Can only be started on or after scheduled date.`
                      }
                    >
                      Start {isVisit ? "Visit" : "Service"}
                    </button>
                  )}
                  {currentService.status === "in_progress" && (
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => handleQuickStatusChange("completed")}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer text-center shadow-xs"
                    >
                      Complete & Sign Off
                    </button>
                  )}
                </div>

                {!isDateDue && currentService.status !== "in_progress" && currentService.status !== "completed" && (
                  <p className="text-[10px] text-amber-600 font-medium text-center">
                    ⏳ Scheduled for {formattedScheduledDate}. Start will unlock when date arrives.
                  </p>
                )}
              </div>
            </div>

            {/* BOX 2: Payment (From Figma Screenshot) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Payment
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase">
                  Paid
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Service charge</span>
                  <span className="font-semibold text-slate-900">
                    ₹{serviceCost.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Taxes & GST (18%)</span>
                  <span className="font-semibold text-slate-900">
                    ₹{taxes.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">Total payable</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ₹{totalPayable.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* BOX 3: Quick Status Updater */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Update Service Status
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={updatingStatus || !isDateDue}
                  onClick={() => {
                    if (!isDateDue) {
                      Swal.fire({
                        icon: "warning",
                        title: "Service Not Due Yet",
                        text: `This ${isVisit ? "visit" : "service"} is scheduled for ${formattedScheduledDate}. It can only be started on or after the scheduled date.`,
                      });
                      return;
                    }
                    handleQuickStatusChange("in_progress");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    !isDateDue
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                      : currentService.status === "in_progress"
                      ? "bg-sky-600 text-white border-sky-600 cursor-pointer"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
                  }`}
                  title={
                    isDateDue
                      ? "Mark as In Progress"
                      : `Scheduled for ${formattedScheduledDate}. Can only be started on or after scheduled date.`
                  }
                >
                  In Progress
                </button>
                <button
                  type="button"
                  disabled={
                    updatingStatus ||
                    !isDateDue ||
                    (currentService.status !== "in_progress" && currentService.status !== "completed")
                  }
                  onClick={() => {
                    if (!isDateDue) {
                      Swal.fire({
                        icon: "warning",
                        title: "Cannot Complete Before Scheduled Date",
                        text: `This ${isVisit ? "visit" : "service"} is scheduled for ${formattedScheduledDate}. It cannot be marked completed before the scheduled date arrives.`,
                      });
                      return;
                    }
                    if (currentService.status !== "in_progress" && currentService.status !== "completed") {
                      Swal.fire({
                        icon: "warning",
                        title: "Must Start Service First",
                        text: `This ${isVisit ? "visit" : "service"} has not been started yet. Please start it first (set to In Progress) before marking it completed.`,
                      });
                      return;
                    }
                    handleQuickStatusChange("completed");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    !isDateDue || (currentService.status !== "in_progress" && currentService.status !== "completed")
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                      : currentService.status === "completed"
                      ? "bg-emerald-600 text-white border-emerald-600 cursor-pointer"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
                  }`}
                  title={
                    !isDateDue
                      ? `Scheduled for ${formattedScheduledDate}. Cannot complete before scheduled date.`
                      : currentService.status !== "in_progress" && currentService.status !== "completed"
                      ? "Must start service first before marking as completed."
                      : "Mark as Completed"
                  }
                >
                  Completed
                </button>
              </div>
              {!isDateDue ? (
                <p className="text-[10px] text-amber-600 font-medium">
                  Service date: {formattedScheduledDate} (Future date — locked)
                </p>
              ) : currentService.status !== "in_progress" && currentService.status !== "completed" ? (
                <p className="text-[10px] text-slate-500 font-medium">
                  💡 Click "Start {isVisit ? "Visit" : "Service"}" or "In Progress" first to unlock completion.
                </p>
              ) : null}
            </div>

          </div>

        </div>

      </div>

      {/* ADD TASK MODAL (Lead Form styling) */}
      {addTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full mx-auto p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Add Service Task
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Checklist item for service visit inspection
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <RxCross2 size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewTask} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Test feed water pressure & pump cycle"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Assigned Technician
                </label>
                <input
                  type="text"
                  value={newTaskTech}
                  onChange={(e) => setNewTaskTech(e.target.value)}
                  placeholder={primaryTechName || "Assigned Technician"}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Priority
                </label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white h-[38px] cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setAddTaskModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10 cursor-pointer"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALLOCATE TECHNICIANS MODAL */}
      {allocateModalOpen && (
        <AllocateTechniciansModal
          open={allocateModalOpen}
          onClose={() => setAllocateModalOpen(false)}
          entity={currentService}
          endpoint={
            currentService?.work_type === "amc_visit" || currentService?.contract_id || currentService?.visit_number
              ? `${BASE_API}/amc/visits/${currentService.id}/allocate-technicians/`
              : `${BASE_API}/amc/services/${currentService.id}/allocate-technicians/`
          }
          title={`Allocate Technicians — ${currentService.visit_number || currentService.service_number || `#TASK-${currentService.id}`}`}
          baseApi={BASE_API}
          token={token}
          onSuccess={(updatedData) => {
            if (updatedData) {
              setCurrentService((prev) => ({ ...prev, ...updatedData }));
            }
            if (onRefresh) onRefresh(updatedData);
            setAllocateModalOpen(false);
          }}
        />
      )}

      {/* SEND MESSAGE MODAL (WhatsApp / Email) */}
      {messageModalOpen && (
        <SendMessageModal
          isOpen={messageModalOpen}
          onClose={() => setMessageModalOpen(false)}
          category="service"
          recipientData={{
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            entity_type: "service",
            entity_id: currentService.id,
            service_number: currentService.service_number,
            service_date: currentService.service_date,
            customer_name: customerName,
          }}
          defaultChannel={messageChannel}
        />
      )}

      {/* ADD ACTIVITY / NOTE MODAL */}
      {noteModalOpen && (
        <AddActivityModal
          service={currentService}
          isOpen={noteModalOpen}
          onClose={() => setNoteModalOpen(false)}
          onSuccess={(newActivity) => {
            fetchNotes();
            if (onRefresh) onRefresh();
          }}
          baseApi={BASE_API}
        />
      )}

      {/* EDIT SERVICE DETAILS MODAL */}
      {editDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/80">
                  <MdEdit className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Edit Service Details</h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {currentService.service_number || currentService.visit_number || "Service"} • Technical parameters
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditDetailsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RxCross2 className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveDetails} className="p-5 space-y-4 overflow-y-auto">
              {detailsError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {detailsError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Equipment / Machine Name
                </label>
                <input
                  type="text"
                  value={editDetailsForm.equipment}
                  onChange={(e) => setEditDetailsForm((prev) => ({ ...prev, equipment: e.target.value }))}
                  placeholder="e.g. Demineralization (DM) Plant 1500 LPH"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Issue Category / Service Type
                </label>
                <select
                  value={editDetailsForm.service_type}
                  onChange={(e) => setEditDetailsForm((prev) => ({ ...prev, service_type: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer"
                >
                  <option value="routine_maintenance">Routine Maintenance</option>
                  <option value="breakdown_repair">Breakdown / Emergency Repair</option>
                  <option value="filter_replacement">Filter Replacement</option>
                  <option value="membrane_cleaning">Membrane Cleaning / CIP</option>
                  <option value="chemical_dosing">Chemical Dosing & Inspection</option>
                  <option value="inspection_audit">Inspection & Audit</option>
                  <option value="installation_commissioning">Installation & Commissioning</option>
                  <option value="other">Other Service</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Problem Reported / Scope of Work
                </label>
                <textarea
                  rows={2}
                  value={editDetailsForm.description}
                  onChange={(e) => setEditDetailsForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe issues observed, customer complaints, or planned tasks..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Diagnosis / Inspection Finding
                </label>
                <textarea
                  rows={2}
                  value={editDetailsForm.diagnosis}
                  onChange={(e) => setEditDetailsForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                  placeholder="Technical findings, root cause analysis, pressure/flow readings..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Work Performed / Resolution Notes
                </label>
                <textarea
                  rows={3}
                  value={editDetailsForm.resolution_notes}
                  onChange={(e) => setEditDetailsForm((prev) => ({ ...prev, resolution_notes: e.target.value }))}
                  placeholder="Details of servicing performed, replaced spare parts, calibration done..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Site Location & Map Pin
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                  >
                    <MdLocationOn size={13} />
                    <span>📍 Pin on Map</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={editDetailsForm.service_address}
                  onChange={(e) => setEditDetailsForm((prev) => ({ ...prev, service_address: e.target.value }))}
                  placeholder="Street address, building, landmark, area..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                />
                {editDetailsForm.latitude && editDetailsForm.longitude ? (
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                    <MdMyLocation size={12} />
                    <span>Pinned Coordinates: {Number(editDetailsForm.latitude).toFixed(5)}, {Number(editDetailsForm.longitude).toFixed(5)}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditDetailsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {savingDetails ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOCATION PICKER MODAL */}
      <LocationPickerModal
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        initialLat={editDetailsForm.latitude}
        initialLng={editDetailsForm.longitude}
        initialAddress={editDetailsForm.service_address}
        onSelectLocation={(loc) => {
          setEditDetailsForm((prev) => ({
            ...prev,
            latitude: loc.latitude,
            longitude: loc.longitude,
            service_address: loc.address || prev.service_address,
            location_url: loc.location_url || prev.location_url,
          }));
        }}
      />

      {/* UPLOAD ATTACHMENT MODAL */}
      <UploadAttachmentModal
        service={currentService}
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchAttachments();
          if (onRefresh) onRefresh();
        }}
        baseApi={BASE_API}
      />

      {/* IMAGE PREVIEW ZOOM MODAL */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2 cursor-pointer"
            >
              <MdClose size={28} />
            </button>
            <img
              src={previewImage}
              alt="Enlarged preview"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* COMPLETE VISIT MODAL WITH SPARE PARTS RECONCILIATION */}
      <CompleteVisitModal
        service={currentService}
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        onSuccess={(updated) => {
          if (updated) {
            setCurrentService((prev) => ({ ...prev, ...updated }));
          }
          if (onRefresh) onRefresh(updated);
          fetchIssuedStock();
        }}
        baseApi={BASE_API}
      />

      {/* REQUEST / ISSUE STOCK MODAL FOR THIS SERVICE */}
      <IssueStockModal
        isOpen={issueStockModalOpen}
        onClose={() => setIssueStockModalOpen(false)}
        onSuccess={() => {
          fetchIssuedStock();
          if (onRefresh) onRefresh();
        }}
        items={inventoryItems}
        baseApi={BASE_API}
        preselectedService={currentService}
        currentUser={userInfo}
        assignedTechnician={primaryTech}
        isRequestOnly={issueModalMode === "REQUEST"}
      />

    </div>
  );
}
