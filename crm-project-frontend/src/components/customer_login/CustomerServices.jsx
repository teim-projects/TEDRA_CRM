import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Wrench,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  FileText,
  ExternalLink,
  Users,
  MapPin,
  Activity,
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import {
  collectAssignedTechnicians,
  fetchCustomerPortal,
  formatPortalDate,
  formatPortalDateTime,
  matchesSiteFilter,
  mergeCustomerSites,
  SiteBadge,
  SiteFilterBar,
  StatusBadge,
  TechnicianListCard,
} from "./customerUtils";

export default function CustomerServices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const baseApi = getBaseApiUrl();
  const [items, setItems] = useState([]);
  const [customerSites, setCustomerSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [siteFilter, setSiteFilter] = useState(() => searchParams.get("siteId") || "all");
  const [selectedItem, setSelectedItem] = useState(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [srvData, meData] = await Promise.all([
        fetchCustomerPortal(`${baseApi}/api/customer/services/?work_type=single_service`),
        fetchCustomerPortal(`${baseApi}/api/customer/me/`).catch(() => null),
      ]);
      const list = Array.isArray(srvData) ? srvData : srvData.results || [];
      setItems(list.filter((item) => item.work_type === "single_service"));
      setCustomerSites(meData?.customer_profile?.sites || []);
    } catch (err) {
      setError(err.message || "Failed to load services.");
    } finally {
      setLoading(false);
    }
  }, [baseApi]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleSiteChange = (val) => {
    setSiteFilter(val);
    setSelectedItem(null);
    const next = new URLSearchParams(searchParams);
    if (val === "all") next.delete("siteId");
    else next.set("siteId", val);
    setSearchParams(next, { replace: true });
  };

  const siteOptions = useMemo(
    () => mergeCustomerSites(customerSites, items),
    [customerSites, items]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesSiteFilter(item, siteFilter)) {
        return false;
      }
      if (statusTab !== "all" && String(item.status || "").toLowerCase() !== statusTab) {
        return false;
      }
      if (!q) return true;
      const techs = collectAssignedTechnicians(item);
      const haystack = [
        item.service_number,
        item.visit_number,
        item.equipment,
        item.service_type_display,
        item.visit_type_display,
        item.amc_contract_number,
        item.project_code,
        item.site_name,
        item.site_shortcut,
        item.service_address,
        ...techs.map((t) => t.full_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, statusTab, siteFilter]);

  if (selectedItem) {
    const techs = collectAssignedTechnicians(selectedItem);
    const notes = selectedItem.notes || [];
    const attachments = selectedItem.attachments || [];

    return (
      <div className="w-full space-y-5 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-7 shadow-2xs space-y-5 sm:space-y-6 overflow-hidden max-w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                  {selectedItem.service_number || selectedItem.visit_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedItem.work_type === "amc_visit" ? "AMC Visit" : "Service Request"}
                </span>
                <StatusBadge status={selectedItem.status} label={selectedItem.status_display} />
              </div>
              <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug break-words">
                {selectedItem.service_type_display || selectedItem.visit_type_display}
              </h1>
              <div className="pt-0.5">
                <SiteBadge
                  site={selectedItem.site_details}
                  fallbackAddress={selectedItem.service_address}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer self-start shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Back to My Services</span>
            </button>
          </div>

          {/* Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Scheduled Date
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {formatPortalDate(selectedItem.service_date || selectedItem.visit_date)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Completion Date
              </span>
              <span className="text-xs font-bold text-emerald-700 mt-1 block">
                {formatPortalDate(selectedItem.completion_date)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Equipment / System
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                {selectedItem.equipment || "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                AMC / Project Ref
              </span>
              <span className="text-xs font-bold text-sky-700 mt-1 block">
                {selectedItem.amc_contract_number || selectedItem.project_code || "On-Demand"}
              </span>
            </div>
          </div>

          {/* Assigned Technicians */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
              <Users className="w-4 h-4 text-cyan-600" />
              <span>Assigned Technician &amp; Service Engineer</span>
            </h2>
            <TechnicianListCard
              people={techs}
              emptyText="A technician will be assigned to this visit shortly."
            />
          </div>

          {/* Technical Report */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Service Report &amp; Notes
              </h3>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Description / Issue Reported
                </span>
                <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">
                  {selectedItem.description || "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Diagnosis / Inspection Finding
                </span>
                <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">
                  {selectedItem.diagnosis || "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Work Performed / Resolution Notes
                </span>
                <p className="text-emerald-800 font-medium mt-0.5 whitespace-pre-wrap">
                  {selectedItem.resolution_notes || "—"}
                </p>
              </div>
              {selectedItem.service_address && (
                <div className="pt-2 border-t border-slate-100 flex items-start gap-1.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
                  <span>{selectedItem.service_address}</span>
                </div>
              )}
            </div>

            {/* Field Execution Activity Timeline */}
            <div className="p-4 rounded-xl border border-slate-200/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-600" />
                <span>Technician Field Milestones ({notes.length})</span>
              </h3>
              {notes.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No field activity logs recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {n.action_display || n.action}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatPortalDateTime(n.created_at)}
                        </span>
                      </div>
                      {n.technician_name && (
                        <p className="text-[11px] text-cyan-700 font-semibold">
                          By: {n.technician_name}
                        </p>
                      )}
                      {n.notes && <p className="text-[11px] text-slate-600">{n.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Service Photos &amp; Reports ({attachments.length})
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.file_url || att.file}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{att.title || att.file_name || att.stage_display || "Document"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
      {/* Header & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              <span>My Services</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              View your breakdown, inspection, and single service requests, assigned technicians, and reports
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search service #, technician..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 w-full"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 min-w-0">
                <SiteFilterBar
                  sites={siteOptions}
                  value={siteFilter}
                  onChange={handleSiteChange}
                />
              </div>

              <button
                type="button"
                onClick={loadServices}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                title="Refresh Services"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-1 border-t border-slate-100 -mx-1 px-1">
          {[
            { id: "all", label: "All" },
            { id: "scheduled", label: "Scheduled" },
            { id: "in_progress", label: "In Progress" },
            { id: "pending_parts", label: "Pending Parts" },
            { id: "completed", label: "Completed" },
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
          Loading your services and visits...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-xs text-slate-400">
          No single service records found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const techs = collectAssignedTechnicians(item);
            const schedDate = item.service_date || item.visit_date;
            return (
              <div
                key={`${item.work_type}-${item.id}`}
                onClick={() => setSelectedItem(item)}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-cyan-200 transition-all cursor-pointer space-y-3 overflow-hidden min-w-0 w-full max-w-full"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-sky-700 uppercase">
                        {item.service_number || item.visit_number}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold shrink-0">
                        {item.work_type === "amc_visit" ? "AMC Visit" : "Service"}
                      </span>
                      {item.amc_contract_number && (
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          ({item.amc_contract_number})
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2 break-words leading-snug">
                      {item.service_type_display || item.visit_type_display}
                      {item.equipment ? ` · ${item.equipment}` : ""}
                    </h2>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={item.status} label={item.status_display} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-xs">
                  <SiteBadge site={item.site_details} fallbackAddress={item.service_address} />
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {formatPortalDate(schedDate)}
                    </span>
                    {item.completion_date && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {formatPortalDate(item.completion_date)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Assigned Technician
                  </span>
                  <TechnicianListCard
                    people={techs}
                    emptyText="Technician will be allocated soon."
                    compact
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px] text-cyan-700 font-semibold border-t border-slate-100">
                  <span className="truncate min-w-0 text-slate-600">
                    {(item.attachments || []).length > 0
                      ? `${item.attachments.length} attachment(s)`
                      : "Full Technical Report"}
                  </span>
                  <span className="shrink-0 self-end sm:self-auto hover:underline inline-flex items-center gap-1">
                    <span>View Details</span>
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
