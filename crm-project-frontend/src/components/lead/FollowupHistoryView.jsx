import React, { useState, useEffect, useMemo, useCallback } from "react";
import Swal from "sweetalert2";
import { 
  MdClose,
  MdArrowBack,
  MdCalendarToday, 
  MdCall, 
  MdMail, 
  MdOutlineChatBubbleOutline,
  MdAdd,
  MdArrowForward,
  MdEdit,
  MdDeleteOutline
} from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";
import SendMessageModal from "../templates/SendMessageModal";

export default function FollowupHistoryView({
  leadId,
  initialLead = null,
  baseApi,
  token,
  onBack,
  onAddFollowUp,
  onRefreshList,
  refreshTrigger = 0,
}) {
  const [currentLead, setCurrentLead] = useState(initialLead);
  const [loading, setLoading] = useState(!initialLead);

  // Reschedule state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleRemarks, setRescheduleRemarks] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  // SendMessageModal state
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState("email");

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  // Fetch full lead data including followups
  const fetchLeadDetails = useCallback(async () => {
    if (!leadId || !baseApi) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseApi.replace(/\/$/, "")}/lead/lead/${leadId}/`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentLead(data);
      }
    } catch (err) {
      console.error("Error fetching lead history view:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, baseApi, authHeaders]);

  useEffect(() => {
    fetchLeadDetails();
  }, [fetchLeadDetails, refreshTrigger]);

  useEffect(() => {
    const handleFollowupSaved = (e) => {
      fetchLeadDetails();
      if (onRefreshList) onRefreshList();
    };
    window.addEventListener("followup_saved", handleFollowupSaved);
    return () => {
      window.removeEventListener("followup_saved", handleFollowupSaved);
    };
  }, [fetchLeadDetails, onRefreshList]);

  // Sync reschedule date on toggle
  useEffect(() => {
    if (isRescheduling && currentLead) {
      const existingNextDate = currentLead.followup_date || 
        (Array.isArray(currentLead.followups) && currentLead.followups.length > 0 
          ? currentLead.followups[currentLead.followups.length - 1].next_followup_date 
          : "");
      setRescheduleDate(existingNextDate || new Date().toISOString().split("T")[0]);
      setRescheduleRemarks("");
    }
  }, [isRescheduling, currentLead]);

  // Format date helper: "24 Jun 2025"
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
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
  };

  // Format time helper: "10:20 AM"
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const [h, m] = timeStr.split(":");
      const hours = parseInt(h, 10);
      const ampm = hours >= 12 ? "PM" : "AM";
      const h12 = hours % 12 || 12;
      return `${h12}:${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // Format currency helper: e.g. "₹18.5L" or "₹4,50,000"
  const formatCurrency = (amt) => {
    const num = parseFloat(amt);
    if (isNaN(num) || num <= 0) return "—";
    if (num >= 100000) {
      const inLakhs = num / 100000;
      return `₹${inLakhs % 1 === 0 ? inLakhs.toFixed(0) : inLakhs.toFixed(1)}L`;
    }
    return `₹${num.toLocaleString("en-IN")}`;
  };

  // Mask phone helper: "+91 98•• ••418"
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

  // Follow-ups array sorted chronologically
  const followupsList = useMemo(() => {
    if (!currentLead || !Array.isArray(currentLead.followups)) return [];
    return [...currentLead.followups].sort((a, b) => (a.id || 0) - (b.id || 0));
  }, [currentLead]);

  const latestFollowup = followupsList.length > 0 ? followupsList[followupsList.length - 1] : null;
  // Clean follow-up identifier helper to avoid duplicate prefixes like FU-FL-001
  const formattedFollowupNumber = useMemo(() => {
    if (!latestFollowup?.followup_number) {
      return `FU-001`;
    }
    const raw = String(latestFollowup.followup_number).trim();
    if (raw.startsWith("FU-")) return raw;
    if (raw.startsWith("FL-")) return `FU-${raw.slice(3)}`;
    if (raw.startsWith("F-")) return `FU-${raw.slice(2)}`;
    if (raw.startsWith("F")) return `FU-${raw.slice(1)}`;
    return `FU-${raw}`;
  }, [latestFollowup]);


  // Key metrics
  const totalFollowupsCount = followupsList.length;
  const lastFollowupDate = latestFollowup?.followup_date || currentLead?.last_followup_date || currentLead?.enquiry_date;
  const lastFollowupOwner = latestFollowup?.created_by_details?.full_name || 
    latestFollowup?.created_by_details?.first_name || 
    currentLead?.assigned_executive_details?.full_name || 
    currentLead?.assigned_executive_details?.first_name || 
    "Assigned Executive";

  const nextFollowupDate = currentLead?.followup_date || latestFollowup?.next_followup_date;

  const currentOutcome = currentLead?.pipeline_stage_display || 
    (currentLead?.pipeline_stage ? currentLead.pipeline_stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "New Lead");

  const leadOwnerName = currentLead?.assigned_executive_details?.full_name || 
    currentLead?.assigned_executive_details?.first_name || 
    currentLead?.created_by_details?.full_name || 
    "Neha Kulkarni";

  // Mode label helper
  const getModeLabel = (mode) => {
    const map = {
      call: "Phone call",
      phone_call: "Phone call",
      whatsapp: "WhatsApp",
      email: "Email",
      video_call: "Video call",
      in_person: "In-Person meeting",
      demo: "Product demo",
      site_visit: "Site visit",
    };
    return map[mode] || (mode ? mode.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "Discussion");
  };

  const getResponseBadge = (fu) => {
    const resp = fu.client_response_display || fu.client_response;
    if (resp) return resp;
    if (fu.followup_mode === "site_visit") return "Site visit scheduled";
    if (fu.followup_mode === "demo") return "Demo completed";
    return "Connected";
  };

  // Quick date helper
  const handleQuickDate = (daysToAdd) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setRescheduleDate(d.toISOString().split("T")[0]);
  };

  // Submit Reschedule logic
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleDate) {
      Swal.fire({ icon: "warning", text: "Please select a valid follow-up date." });
      return;
    }

    setSavingReschedule(true);
    try {
      const res = await fetch(`${baseApi.replace(/\/$/, "")}/lead/lead/${currentLead.id}/reschedule/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          followup_date: rescheduleDate,
          next_followup_date: rescheduleDate,
          remarks: rescheduleRemarks || undefined,
          note: rescheduleRemarks || undefined,
        }),
      });

      if (!res.ok) {
        // Fallback to PATCH if needed
        const patchRes = await fetch(`${baseApi.replace(/\/$/, "")}/lead/lead/${currentLead.id}/`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            followup_date: rescheduleDate,
            ...(rescheduleRemarks ? { remarks: rescheduleRemarks } : {}),
          }),
        });

        if (!patchRes.ok) throw new Error("Failed to reschedule follow-up date.");

        if (latestFollowup?.id) {
          await fetch(`${baseApi.replace(/\/$/, "")}/lead/lead-followups/${latestFollowup.id}/`, {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify({
              next_followup_date: rescheduleDate,
              ...(rescheduleRemarks ? { additional_remarks: rescheduleRemarks } : {}),
            }),
          }).catch(() => {});
        }
      }

      Swal.fire({
        icon: "success",
        title: "Follow-up Rescheduled",
        text: `New follow-up date set for ${formatDate(rescheduleDate)}`,
        timer: 1500,
        showConfirmButton: false,
      });

      setCurrentLead(prev => ({
        ...prev,
        followup_date: rescheduleDate,
        remarks: rescheduleRemarks || prev.remarks,
      }));

      setIsRescheduling(false);
      fetchLeadDetails();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error("Reschedule error:", err);
      Swal.fire({ icon: "error", title: "Reschedule Failed", text: err.message || "Could not update follow-up date." });
    } finally {
      setSavingReschedule(false);
    }
  };

  // Open in-app integrated messaging modal for WhatsApp
  const openWhatsAppModal = () => {
    setMessageChannel("whatsapp");
    setMessageModalOpen(true);
  };

  // Open in-app integrated messaging modal for Email
  const openEmailModal = () => {
    setMessageChannel("email");
    setMessageModalOpen(true);
  };

  const handleCall = () => {
    if (!currentLead?.mobile_number) {
      Swal.fire({ icon: "info", text: "No mobile number recorded for this lead." });
      return;
    }
    window.location.href = `tel:${currentLead.mobile_number}`;
  };

  if (loading && !currentLead) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center font-sans text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-sky-500 rounded-full animate-ping"></span>
          <span>Loading follow-up history...</span>
        </div>
      </div>
    );
  }

  if (!currentLead) {
    return (
      <div className="w-full p-6 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-xs font-semibold text-slate-700">Lead record not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700"
        >
          Return to Follow-ups
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pb-10 animate-fade-in text-xs">
      


      {/* 2. THE BIG OUTER BORDERED CONTAINER ENCASING THE WHOLE PAGE (Matching Figma) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-6">

        {/* TOP HEADER SECTION (Inside big outer container) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {/* Lead ID */}
            <div className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">
              <span>LD-{currentLead.id}</span>
            </div>

            {/* Company Title */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              {currentLead.company_name || "Company Name"}
            </h1>

            {/* Subtitle */}
            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
              {currentLead.contact_person || "Contact Person"} · Follow-up owner:{" "}
              <span className="text-slate-700 font-medium">{leadOwnerName}</span>
            </p>
          </div>

          {/* Top Right Controls & Status Pill */}
          <div className="flex items-center gap-2.5 self-start sm:self-center">
            {/* Status Pill Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              {currentOutcome}
            </span>

            {/* Action Buttons: WhatsApp, Email, Edit, Close */}
            <div className="flex items-center gap-1 text-slate-400">
              <button
                type="button"
                onClick={openWhatsAppModal}
                className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title="Open Integrated WhatsApp Message"
              >
                <MdOutlineChatBubbleOutline size={15} />
              </button>
              <button
                type="button"
                onClick={openEmailModal}
                className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Open Integrated Email Composer"
              >
                <MdMail size={15} />
              </button>
              <button
                type="button"
                onClick={() => onAddFollowUp && onAddFollowUp(currentLead)}
                className="p-1.5 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                title="Add / Edit Follow-up"
              >
                <MdEdit size={15} />
              </button>
              <button
                type="button"
                className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Delete"
              >
                <MdDeleteOutline size={16} />
              </button>
            </div>
          </div>
        </div>

      {/* 3. 4 KPI PULSE CARDS ROW (Exact match with Figma Image 1 & 2) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total follow-ups */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Total follow-ups</span>
          <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
            {totalFollowupsCount + 1} discussions
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            Since lead opening
          </span>
        </div>

        {/* Last follow-up */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Last follow-up</span>
          <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
            {formatDate(lastFollowupDate)}
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            By {lastFollowupOwner}
          </span>
        </div>

        {/* Next follow-up */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Next follow-up</span>
          <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
            {formatDate(nextFollowupDate)}
          </span>
          <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
            Scheduled
          </span>
        </div>

        {/* Current outcome */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Current outcome</span>
          <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5 truncate" title={currentOutcome}>
            {currentOutcome}
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            {currentLead.status === "close_win" ? "Lead won" : currentLead.status === "close_loss" ? "Lead closed" : "Lead remains active"}
          </span>
        </div>
      </div>

      {/* 4. MAIN TWO-COLUMN WORKSPACE (Matching Figma) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT 2 COLUMNS: Complete Follow-up History (Bordered Container matching Image) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
          
          {/* Header with Title and Add Button */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Complete follow-up history</span>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {followupsList.length + 1} records
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Numbered from lead opening to the latest discussion
              </p>
            </div>

            <button
              type="button"
              onClick={() => onAddFollowUp && onAddFollowUp(currentLead)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            >
              <MdAdd size={14} />
              <span>Add follow-up</span>
            </button>
          </div>

          {/* TIMELINE LIST (Limited to 2 items view with scroller) */}
          <div className="relative pt-2 max-h-[500px] overflow-y-auto pr-2 slim-scrollbar">
            
            {/* 1. Inception Entry: Lead Opened */}
            <div className="relative pl-10 pb-6 group">
              {/* Vertical connecting line */}
              <div className="absolute left-[12px] top-6 bottom-0 w-0.5 bg-slate-200"></div>

              {/* Circular Number Badge */}
              <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center shadow-xs z-10">
                1
              </div>

              {/* Entry Card with Border Detailing matching Image */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-4.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">Lead opened</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {formatDate(currentLead.enquiry_date || currentLead.created_at)}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Enquiry captured
                  </span>
                </div>

                <div className="text-[10px] text-slate-500 font-normal flex items-center gap-3 mb-2.5">
                  <span>Owner: <strong className="text-slate-700 font-semibold">{leadOwnerName}</strong></span>
                  <span>Lead stage: <strong className="text-slate-700 font-semibold">New</strong></span>
                </div>

                {/* DISCUSSION BLOCK */}
                <div className="bg-[#f8fafc] border border-slate-200/60 rounded-xl p-3 mb-2">
                  <span className="text-[9px] font-bold tracking-wider text-sky-700 block uppercase mb-0.5">
                    Discussion
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                    {currentLead.requirement_details || 
                      `${currentLead.company_name} enquired about a water-treatment requirement. Initial contact details, site location and expected capacity were recorded.`}
                  </p>
                </div>

                {/* NEXT ACTION BLOCK */}
                <div className="bg-[#f0f9ff] border border-sky-100 rounded-xl p-3">
                  <span className="text-[9px] font-bold tracking-wider text-sky-800 flex items-center gap-1 uppercase mb-0.5">
                    <MdArrowForward size={12} />
                    Next Action
                  </span>
                  <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                    {currentLead.remarks || "Make introductory call and validate the requirement."}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Subsequent Follow-up Entries */}
            {followupsList.map((fu, idx) => {
              const itemNumber = idx + 2;
              const isLast = idx === followupsList.length - 1;

              return (
                <div key={fu.id || idx} className="relative pl-10 pb-6 group">
                  {!isLast && (
                    <div className="absolute left-[12px] top-6 bottom-0 w-0.5 bg-slate-200"></div>
                  )}

                  <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center shadow-xs z-10">
                    {itemNumber}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-4.5 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">
                          {getModeLabel(fu.followup_mode)}
                        </span>
                        {fu.followup_number && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-sky-50 text-sky-700 rounded border border-sky-100">
                            {fu.followup_number.startsWith("FL-") 
                              ? `FU-${fu.followup_number.slice(3)}` 
                              : fu.followup_number.startsWith("FU-") 
                              ? fu.followup_number 
                              : `FU-${fu.followup_number}`}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formatDate(fu.followup_date)}
                          {fu.followup_time ? ` · ${formatTime(fu.followup_time)}` : ""}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {getResponseBadge(fu)}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-normal flex items-center gap-3 mb-2.5">
                      <span>
                        Owner:{" "}
                        <strong className="text-slate-700 font-semibold">
                          {fu.created_by_details?.full_name || 
                           fu.created_by_details?.first_name || 
                           leadOwnerName}
                        </strong>
                      </span>
                      <span>
                        Lead stage:{" "}
                        <strong className="text-slate-700 font-semibold capitalize">
                          {fu.current_stage_display || (fu.current_stage ? fu.current_stage.replace(/_/g, " ") : "Contacted")}
                        </strong>
                      </span>
                    </div>

                    {/* DISCUSSION BLOCK */}
                    <div className="bg-[#f8fafc] border border-slate-200/60 rounded-xl p-3 mb-2">
                      <span className="text-[9px] font-bold tracking-wider text-sky-700 block uppercase mb-0.5">
                        Discussion
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                        {fu.discussion_summary || fu.remarks || "Spoke with customer regarding water quality, flow rate capacity, operating hours and requirement checklist."}
                      </p>
                    </div>

                    {/* NEXT ACTION BLOCK */}
                    <div className="bg-[#f0f9ff] border border-sky-100 rounded-xl p-3">
                      <span className="text-[9px] font-bold tracking-wider text-sky-800 flex items-center gap-1 uppercase mb-0.5">
                        <MdArrowForward size={12} />
                        Next Action
                      </span>
                      <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                        {fu.commitment_us || 
                         fu.commitment_client || 
                         fu.additional_remarks || 
                         "Share requirement checklist and collect source-water report."}
                      </p>
                    </div>

                    {/* Products discussed tag if any */}
                    {Array.isArray(fu.products_interested) && fu.products_interested.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="font-semibold text-slate-400">Products:</span>
                        {fu.products_interested.map((p, pIdx) => (
                          <span key={pIdx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            {typeof p === "object" ? p.name || p.product : p}
                          </span>
                        ))}
                        {fu.amount && (
                          <span className="ml-auto font-bold text-sky-700">
                            {formatCurrency(fu.amount)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT 1 COLUMN: Sidebar Snapshot & Reschedule Cards */}
        <div className="space-y-4">
          
          {/* CARD 1: Lead Snapshot (Exact Border Detailing Matching Image) */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5">
            <h3 className="text-xs font-bold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              Lead snapshot
            </h3>

            <div className="space-y-2.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-normal">Lead ID</span>
                <span className="font-semibold text-slate-900">LD-{currentLead.id}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-normal">Contact</span>
                <span className="font-semibold text-slate-900 text-right">{currentLead.contact_person || "—"}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-normal">Phone</span>
                <span className="font-semibold text-slate-900 tracking-wide">{maskPhone(currentLead.mobile_number)}</span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 font-normal shrink-0">Requirement</span>
                <span className="font-semibold text-slate-900 text-right line-clamp-2">
                  {Array.isArray(currentLead.product_interested) && currentLead.product_interested.length > 0
                    ? currentLead.product_interested.map(p => (typeof p === 'object' ? p.name : p)).join(", ")
                    : (currentLead.requirement_details || "Industrial water-treatment system")}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-normal">Estimated value</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(currentLead.amount || currentLead.expected_budget)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-normal">Priority</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  {currentLead.priority_display || (currentLead.priority ? currentLead.priority.toUpperCase() : "High")}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 2: Next Follow-up & Reschedule Logic */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-bold text-slate-900">Next follow-up</h3>
              <MdCalendarToday className="text-sky-600" size={14} />
            </div>

            <div className="text-xs sm:text-[13px] font-bold text-slate-900 mt-0.5">
              {formatDate(nextFollowupDate)}
            </div>

            <p className="text-[11px] text-slate-500 font-normal leading-relaxed mt-1">
              {latestFollowup?.additional_remarks || 
               currentLead.remarks || 
               "Call customer after pending technical documents are ready."}
            </p>

            {/* RESCHEDULE ACTION BUTTON & EXPANDABLE FORM */}
            {!isRescheduling ? (
              <button
                type="button"
                onClick={() => setIsRescheduling(true)}
                className="w-full mt-3 py-1.5 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Reschedule
              </button>
            ) : (
              <form onSubmit={handleRescheduleSubmit} className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select New Follow-up Date *
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-medium text-slate-800"
                  />
                </div>

                {/* Quick date helper buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickDate(1)}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-medium transition-colors"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(3)}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-medium transition-colors"
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(7)}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-medium transition-colors"
                  >
                    Next Week
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Reschedule Reason / Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Client requested callback next week"
                    value={rescheduleRemarks}
                    onChange={(e) => setRescheduleRemarks(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-medium text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingReschedule}
                    className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    {savingReschedule ? "Saving..." : "Save Date"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRescheduling(false)}
                    className="py-1.5 px-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* CARD 3: Direct In-App Integrated Communication */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">
              Communication
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={openWhatsAppModal}
                className="py-1.5 px-1 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer bg-white shadow-2xs"
                title="Send WhatsApp via In-App Integrated Template"
              >
                <FaWhatsapp className="text-emerald-600" size={13} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={openEmailModal}
                className="py-1.5 px-1 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer bg-white shadow-2xs"
                title="Send Email via In-App Integrated Composer"
              >
                <MdMail className="text-blue-600" size={14} />
                <span>Email</span>
              </button>

              <button
                type="button"
                onClick={handleCall}
                className="py-1.5 px-1 border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer bg-white shadow-2xs"
                title="Place Phone Call"
              >
                <MdCall className="text-slate-600" size={14} />
                <span>Call</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      </div>  {/* Closes the big outer bordered container */}

      {/* IN-APP INTEGRATED SEND MESSAGE MODAL (NO REDIRECT!) */}
      <SendMessageModal
        isOpen={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        category="followup"
        recordData={currentLead}
        initialChannel={messageChannel}
        onSuccess={() => {}}
      />
    </div>
  );
}
