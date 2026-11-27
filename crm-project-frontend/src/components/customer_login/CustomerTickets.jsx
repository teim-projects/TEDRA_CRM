import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import {
  Ticket,
  Plus,
  Search,
  RefreshCw,
  X,
  Clock,
  FileText,
  ExternalLink,
  User,
  Phone,
  Upload,
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import {
  fetchCustomerPortal,
  formatPortalDateTime,
  matchesSiteFilter,
  mergeCustomerSites,
  postCustomerPortal,
  SiteBadge,
  SiteFilterBar,
  StatusBadge,
  TechnicianListCard,
} from "./customerUtils";

const CATEGORY_OPTIONS = [
  { value: "breakdown", label: "Breakdown / Emergency" },
  { value: "maintenance", label: "Maintenance Request" },
  { value: "installation", label: "Installation / Site Query" },
  { value: "billing", label: "Billing / AMC Query" },
  { value: "general", label: "General Support" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function CustomerTickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const baseApi = getBaseApiUrl();

  const [tickets, setTickets] = useState([]);
  const [customerSites, setCustomerSites] = useState([]);
  const [customerProjects, setCustomerProjects] = useState([]);
  const [customerAmcs, setCustomerAmcs] = useState([]);
  const [customerProfile, setCustomerProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [siteFilter, setSiteFilter] = useState(() => searchParams.get("siteId") || "all");
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(
    () => searchParams.get("action") === "new"
  );
  const [submitting, setSubmitting] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [form, setForm] = useState({
    site: "",
    amc_contract: "",
    project: "",
    category: "breakdown",
    priority: "medium",
    subject: "",
    description: "",
    contact_person: "",
    contact_phone: "",
  });

  const loadTicketsAndContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tktData, meData, projData, amcData] = await Promise.all([
        fetchCustomerPortal(`${baseApi}/api/customer/tickets/`),
        fetchCustomerPortal(`${baseApi}/api/customer/me/`).catch(() => null),
        fetchCustomerPortal(`${baseApi}/api/customer/projects/`).catch(() => []),
        fetchCustomerPortal(`${baseApi}/api/customer/amcs/`).catch(() => []),
      ]);

      setTickets(Array.isArray(tktData) ? tktData : tktData.results || []);
      const profile = meData?.customer_profile || meData || null;
      setCustomerProfile(profile);
      setCustomerSites(profile?.sites || []);
      setCustomerProjects(Array.isArray(projData) ? projData : projData.results || []);
      setCustomerAmcs(Array.isArray(amcData) ? amcData : amcData.results || []);

      if (profile) {
        setForm((prev) => ({
          ...prev,
          contact_person: prev.contact_person || profile.contact_person || profile.name || "",
          contact_phone: prev.contact_phone || profile.contact_number || "",
        }));
      }
    } catch (err) {
      setError(err.message || "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [baseApi]);

  useEffect(() => {
    loadTicketsAndContext();
  }, [loadTicketsAndContext]);

  const handleSiteChange = (val) => {
    setSiteFilter(val);
    setSelectedTicket(null);
    const next = new URLSearchParams(searchParams);
    if (val === "all") next.delete("siteId");
    else next.set("siteId", val);
    setSearchParams(next, { replace: true });
  };

  const openRaiseModal = () => {
    setForm({
      site: siteFilter !== "all" ? siteFilter : "",
      amc_contract: "",
      project: "",
      category: "breakdown",
      priority: "medium",
      subject: "",
      description: "",
      contact_person: customerProfile?.contact_person || customerProfile?.name || "",
      contact_phone: customerProfile?.contact_number || "",
    });
    setAttachmentFile(null);
    setShowCreateModal(true);
  };

  const closeRaiseModal = () => {
    setShowCreateModal(false);
    if (searchParams.get("action") === "new") {
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  };

  const handleRaiseTicket = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Missing Details",
        text: "Please enter both subject and issue description.",
      });
      return;
    }

    setSubmitting(true);
    try {
      let created;
      if (attachmentFile) {
        const fd = new FormData();
        if (form.site) fd.append("site", form.site);
        if (form.amc_contract) fd.append("amc_contract", form.amc_contract);
        if (form.project) fd.append("project", form.project);
        fd.append("category", form.category);
        fd.append("priority", form.priority);
        fd.append("subject", form.subject.trim());
        fd.append("description", form.description.trim());
        fd.append("contact_person", form.contact_person.trim());
        fd.append("contact_phone", form.contact_phone.trim());
        fd.append("attachment", attachmentFile);
        created = await postCustomerPortal(`${baseApi}/api/customer/tickets/`, fd, true);
      } else {
        const payload = {
          site: form.site ? Number(form.site) : null,
          amc_contract: form.amc_contract ? Number(form.amc_contract) : null,
          project: form.project ? Number(form.project) : null,
          category: form.category,
          priority: form.priority,
          subject: form.subject.trim(),
          description: form.description.trim(),
          contact_person: form.contact_person.trim(),
          contact_phone: form.contact_phone.trim(),
        };
        created = await postCustomerPortal(`${baseApi}/api/customer/tickets/`, payload, false);
      }

      closeRaiseModal();
      await Swal.fire({
        icon: "success",
        title: "Ticket Raised!",
        text: `Ticket ${created?.ticket_number || ""} has been submitted successfully.`,
        timer: 2200,
        showConfirmButton: false,
      });
      loadTicketsAndContext();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text: err.message || "Could not create ticket.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const siteOptions = useMemo(
    () => mergeCustomerSites(customerSites, tickets),
    [customerSites, tickets]
  );

  const modalAmcs = useMemo(() => {
    if (!form.site) return customerAmcs;
    return customerAmcs.filter((a) => matchesSiteFilter(a, form.site));
  }, [customerAmcs, form.site]);

  const modalProjects = useMemo(() => {
    if (!form.site) return customerProjects;
    return customerProjects.filter((p) => matchesSiteFilter(p, form.site));
  }, [customerProjects, form.site]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (!matchesSiteFilter(t, siteFilter)) return false;
      if (statusTab !== "all" && String(t.status || "").toLowerCase() !== statusTab) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        t.ticket_number,
        t.subject,
        t.description,
        t.category_display,
        t.priority_display,
        t.site_details?.name,
        t.site_details?.site_shortcut,
        t.amc_contract_number,
        t.project_code,
        t.assigned_to_details?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tickets, search, statusTab, siteFilter]);

  if (selectedTicket) {
    return (
      <div className="w-full space-y-5 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-7 shadow-2xs space-y-5 sm:space-y-6 overflow-hidden max-w-full">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                  {selectedTicket.ticket_number}
                </span>
                <StatusBadge status={selectedTicket.status} label={selectedTicket.status_display} />
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedTicket.category_display || selectedTicket.category}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 capitalize">
                  Priority: {selectedTicket.priority_display || selectedTicket.priority}
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug break-words">
                {selectedTicket.subject}
              </h1>
              <div className="pt-0.5">
                <SiteBadge site={selectedTicket.site_details} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer self-start shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Back to Tickets</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Raised On
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {formatPortalDateTime(selectedTicket.created_at)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Linked Reference
              </span>
              <span className="text-xs font-bold text-sky-700 mt-1 block">
                {selectedTicket.amc_contract_number || selectedTicket.project_code || "General"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Contact Person
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {selectedTicket.contact_person || "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Contact Phone
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {selectedTicket.contact_phone || "—"}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Issue Description
            </h2>
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {selectedTicket.description}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Assigned Support / Technician
            </h2>
            <TechnicianListCard
              people={
                selectedTicket.assigned_to_details
                  ? [{ ...selectedTicket.assigned_to_details, displayRole: "Assigned Support" }]
                  : []
              }
              emptyText="Ticket is in queue; a team member will be assigned shortly."
            />
          </div>

          {selectedTicket.resolution_notes && (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Resolution Notes
              </h2>
              <p className="text-xs text-emerald-900 whitespace-pre-wrap">
                {selectedTicket.resolution_notes}
              </p>
            </div>
          )}

          {selectedTicket.attachment_url && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Attachment
              </h2>
              <a
                href={selectedTicket.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{selectedTicket.attachment_name || "View Attachment"}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-cyan-600" />
              <span>Support Tickets</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Raise new breakdown, maintenance, or support tickets and track resolution status
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
            <div className="relative w-full sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket #, subject..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 w-full"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:w-48 min-w-0">
                <SiteFilterBar
                  sites={siteOptions}
                  value={siteFilter}
                  onChange={handleSiteChange}
                />
              </div>

              <button
                type="button"
                onClick={loadTicketsAndContext}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                title="Refresh Tickets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={openRaiseModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Raise Ticket</span>
              </button>
            </div>

            <button
              type="button"
              onClick={openRaiseModal}
              className="sm:hidden w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Ticket</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-1 border-t border-slate-100 -mx-1 px-1">
          {[
            { id: "all", label: "All" },
            { id: "open", label: "Open" },
            { id: "in_progress", label: "In Progress" },
            { id: "resolved", label: "Resolved" },
            { id: "closed", label: "Closed" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${statusTab === tab.id
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-xs text-slate-500">
          Loading your support tickets...
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
          <p className="text-xs text-slate-400">
            No support tickets found matching your filter.
          </p>
          <button
            type="button"
            onClick={openRaiseModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Raise Your First Ticket</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((tkt) => (
            <div
              key={tkt.id}
              onClick={() => setSelectedTicket(tkt)}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-cyan-200 transition-all cursor-pointer space-y-3 overflow-hidden min-w-0 w-full max-w-full"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-sky-700 uppercase">
                      {tkt.ticket_number}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold shrink-0">
                      {tkt.category_display || tkt.category}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold capitalize shrink-0">
                      {tkt.priority_display || tkt.priority}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 mt-1 line-clamp-2 break-words leading-snug">
                    {tkt.subject}
                  </h2>
                </div>
                <div className="shrink-0">
                  <StatusBadge status={tkt.status} label={tkt.status_display} />
                </div>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2">{tkt.description}</p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-[11px] text-slate-500">
                <SiteBadge site={tkt.site_details} />
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formatPortalDateTime(tkt.created_at)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px]">
                <span className="truncate min-w-0 text-slate-500">
                  {tkt.assigned_to_details ? (
                    <>
                      Assigned:{" "}
                      <strong className="text-slate-700 font-semibold">
                        {tkt.assigned_to_details.full_name}
                      </strong>
                    </>
                  ) : (
                    "Awaiting assignment"
                  )}
                </span>
                <span className="shrink-0 self-end sm:self-auto text-cyan-700 font-semibold hover:underline inline-flex items-center gap-1">
                  <span>View Details</span>
                  <span aria-hidden="true">→</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RAISE TICKET MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={closeRaiseModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-cyan-600" />
                  <span>Raise New Support Ticket</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Describe your issue and our technical support team will review and respond.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRaiseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRaiseTicket} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Site / Facility
                  </label>
                  <select
                    value={form.site}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        site: e.target.value,
                        amc_contract: "",
                        project: "",
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select Site (Optional)</option>
                    {siteOptions.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} {s.site_shortcut ? `(${s.site_shortcut})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Related AMC Contract
                  </label>
                  <select
                    value={form.amc_contract}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, amc_contract: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select AMC (Optional)</option>
                    {modalAmcs.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.contract_id} — {a.product}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Related Project
                  </label>
                  <select
                    value={form.project}
                    onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select Project (Optional)</option>
                    {modalProjects.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.project_code}
                        {Array.isArray(p.product) && p.product.length ? ` — ${p.product[0]}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Attachment (Photo / PDF)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-600">
                    <Upload className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span className="truncate">
                      {attachmentFile ? attachmentFile.name : "Choose image or PDF (optional)"}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g., Stack parking Bay-02 hydraulic lift stuck"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what happened, bay/pallet number, error message, or preferred visit time..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Site Contact Person</span>
                  </label>
                  <input
                    type="text"
                    value={form.contact_person}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, contact_person: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Contact Phone</span>
                  </label>
                  <input
                    type="text"
                    value={form.contact_phone}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, contact_phone: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRaiseModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
