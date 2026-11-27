import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  Search,
  Calendar,
  CheckCircle2,
  X,
  RefreshCw,
  Users,
  MapPin,
  Clock,
  FileText,
  ExternalLink,
  UserCheck,
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import {
  collectAssignedTechnicians,
  fetchCustomerPortal,
  formatINR,
  formatPortalDate,
  matchesSiteFilter,
  mergeCustomerSites,
  SiteBadge,
  SiteFilterBar,
  StatusBadge,
  TechnicianListCard,
} from "./customerUtils";

export default function CustomerAMCs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const baseApi = getBaseApiUrl();
  const [amcs, setAmcs] = useState([]);
  const [customerSites, setCustomerSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState(() => searchParams.get("siteId") || "all");
  const [selectedAmc, setSelectedAmc] = useState(null);
  const [selectedCycleId, setSelectedCycleId] = useState(null);

  const pickDefaultCycle = useCallback((amcObj) => {
    const rawCycles = Array.isArray(amcObj?.cycles) ? amcObj.cycles : [];
    if (rawCycles.length === 0) return null;
    const active = rawCycles.find((c) =>
      ["active", "expiring_soon"].includes(String(c.status || "").toLowerCase())
    );
    if (active) return active;
    const scheduled = rawCycles.find(
      (c) => String(c.status || "").toLowerCase() === "scheduled"
    );
    if (scheduled) return scheduled;
    return [...rawCycles].sort((a, b) => (b.cycle_number || 0) - (a.cycle_number || 0))[0];
  }, []);

  const openAmcDetail = useCallback(
    (amcObj) => {
      setSelectedAmc(amcObj);
      const defCycle = pickDefaultCycle(amcObj);
      setSelectedCycleId(defCycle ? defCycle.id : null);
    },
    [pickDefaultCycle]
  );

  const loadAmcs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [amcData, meData] = await Promise.all([
        fetchCustomerPortal(`${baseApi}/api/customer/amcs/`),
        fetchCustomerPortal(`${baseApi}/api/customer/me/`).catch(() => null),
      ]);
      const list = Array.isArray(amcData) ? amcData : amcData.results || [];
      setAmcs(list);
      setCustomerSites(meData?.customer_profile?.sites || []);
    } catch (err) {
      setError(err.message || "Failed to load AMC contracts.");
    } finally {
      setLoading(false);
    }
  }, [baseApi]);

  useEffect(() => {
    loadAmcs();
  }, [loadAmcs]);

  const handleSiteChange = (val) => {
    setSiteFilter(val);
    setSelectedAmc(null);
    setSelectedCycleId(null);
    const next = new URLSearchParams(searchParams);
    if (val === "all") next.delete("siteId");
    else next.set("siteId", val);
    setSearchParams(next, { replace: true });
  };

  const siteOptions = useMemo(
    () => mergeCustomerSites(customerSites, amcs),
    [customerSites, amcs]
  );

  const filteredAmcs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return amcs.filter((c) => {
      if (!matchesSiteFilter(c, siteFilter)) {
        return false;
      }
      if (statusFilter !== "all" && String(c.status || "").toLowerCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        c.contract_id,
        c.product,
        c.project_code,
        c.site_details?.name,
        c.site_details?.site_shortcut,
        c.site_address,
        ...(c.assigned_technicians || []).map((t) => t.full_name),
        c.support_coordinator_details?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [amcs, search, statusFilter, siteFilter]);

  if (selectedAmc) {
    const summary = selectedAmc.visits_summary || {};
    const allVisits = selectedAmc.visits || [];
    const sortedCycles = [...(selectedAmc.cycles || [])].sort(
      (a, b) => (a.cycle_number || 0) - (b.cycle_number || 0)
    );
    const activeCycleObj =
      sortedCycles.find((c) => c.id === selectedCycleId) ||
      pickDefaultCycle(selectedAmc) ||
      null;

    const cycleVisits = activeCycleObj
      ? allVisits.filter(
          (v) =>
            v.cycle === activeCycleObj.id ||
            (v.cycle_number && v.cycle_number === activeCycleObj.cycle_number)
        )
      : allVisits;

    const cyclePlanned = activeCycleObj
      ? Math.max(activeCycleObj.no_of_visits || 0, cycleVisits.length)
      : Math.max(summary.total_planned || 0, summary.total_records || 0);
    const cycleCompleted = cycleVisits.filter((v) => v.status === "completed").length;
    const cycleScheduled = cycleVisits.filter((v) => v.status === "scheduled").length;
    const cycleInProgress = cycleVisits.filter((v) => v.status === "in_progress").length;
    const cycleRemaining = Math.max(0, cyclePlanned - cycleCompleted);
    const pct =
      cyclePlanned > 0 ? Math.min(100, Math.round((cycleCompleted / cyclePlanned) * 100)) : 0;

    return (
      <div className="w-full space-y-5 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-7 shadow-2xs space-y-5 sm:space-y-6 overflow-hidden max-w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                  {selectedAmc.contract_id}
                </span>
                <StatusBadge status={selectedAmc.status} label={selectedAmc.status_display} />
                {sortedCycles.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Renewed · {sortedCycles.length} Cycles
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {selectedAmc.amc_type_display || selectedAmc.amc_type}
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug break-words">
                {selectedAmc.product}
              </h1>
              <div className="pt-0.5">
                <SiteBadge
                  site={selectedAmc.site_details}
                  fallbackAddress={selectedAmc.site_address}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedAmc(null);
                setSelectedCycleId(null);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer self-start shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Back to My AMCs</span>
            </button>
          </div>

          {/* AMC CYCLES & RENEWALS AT TOP (Click any cycle to switch visit schedule) */}
          {sortedCycles.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {sortedCycles.length > 1
                    ? `AMC Cycles & Renewals (${sortedCycles.length}) — Click a cycle to view its visits`
                    : "Active AMC Cycle"}
                </h2>
                {activeCycleObj && (
                  <span className="text-[11px] font-semibold text-cyan-700">
                    Showing Cycle #{activeCycleObj.cycle_number}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedCycles.map((cy) => {
                  const isSelected = activeCycleObj?.id === cy.id;
                  return (
                    <button
                      key={cy.id}
                      type="button"
                      onClick={() => setSelectedCycleId(cy.id)}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                        isSelected
                          ? "bg-sky-50/90 border-cyan-500 ring-2 ring-cyan-500/20 shadow-xs"
                          : "bg-slate-50/60 border-slate-200/80 hover:border-cyan-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Cycle #{cy.cycle_number}
                          {cy.cycle_number > 1 ? " (Renewal)" : " (Initial)"}
                        </span>
                        <StatusBadge status={cy.status} label={cy.status_display} />
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {formatPortalDate(cy.start_date)} – {formatPortalDate(cy.end_date)}
                      </p>
                      <p className="text-[11px] font-semibold text-cyan-700">
                        {cy.no_of_visits ?? cy.visits_count} Visits ·{" "}
                        {cy.service_frequency_display || cy.service_frequency}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visit Progress Banner (Scoped to Selected Cycle) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-5 space-y-2.5 sm:space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-start gap-1.5 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    {activeCycleObj ? `Cycle #${activeCycleObj.cycle_number} ` : ""}Visit
                    Completion: {cycleCompleted} of {cyclePlanned} Visits Completed
                  </span>
                </h2>
                <span className="text-sm sm:text-base font-extrabold text-cyan-700 shrink-0">
                  {pct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pl-5 sm:pl-5.5 leading-relaxed">
                Planned Visits: <strong>{cyclePlanned}</strong> · Scheduled:{" "}
                <strong>{cycleScheduled}</strong> · In Progress:{" "}
                <strong>{cycleInProgress}</strong> · Remaining:{" "}
                <strong>{cycleRemaining}</strong>
              </p>
            </div>

            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Contract Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                {activeCycleObj ? `Cycle #${activeCycleObj.cycle_number} Period` : "Contract Period"}
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {formatPortalDate(activeCycleObj?.start_date || selectedAmc.start_date)} –{" "}
                {formatPortalDate(activeCycleObj?.end_date || selectedAmc.end_date)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Service Frequency
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {activeCycleObj?.service_frequency_display ||
                  selectedAmc.service_frequency_display ||
                  selectedAmc.service_frequency}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Payment Terms
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {activeCycleObj?.payment_frequency_display ||
                  selectedAmc.payment_frequency_display ||
                  selectedAmc.payment_frequency}{" "}
                ({formatINR(activeCycleObj?.annual_value ?? selectedAmc.annual_value)})
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Linked Project
              </span>
              <span className="text-xs font-bold text-sky-700 mt-1 block">
                {selectedAmc.project_code || "Direct AMC"}
              </span>
            </div>
          </div>

          {/* Assigned Technicians & Coordinator */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                <Users className="w-4 h-4 text-cyan-600" />
                <span>Assigned Technicians for Visits</span>
              </h2>
              <TechnicianListCard
                people={selectedAmc.assigned_technicians || []}
                emptyText="Technicians will appear here as visits are assigned."
              />
            </div>

            {selectedAmc.support_coordinator_details && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                  <UserCheck className="w-4 h-4 text-sky-600" />
                  <span>Support Coordinator</span>
                </h2>
                <TechnicianListCard
                  people={[
                    {
                      ...selectedAmc.support_coordinator_details,
                      displayRole: "Support Coordinator",
                    },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Selected Cycle Scheduled Visits List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-600" />
                <span>
                  {activeCycleObj ? `Cycle #${activeCycleObj.cycle_number} ` : ""}Visit Schedule (
                  {cycleVisits.length} Scheduled Visits)
                </span>
              </h2>
            </div>

            {cycleVisits.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-400">
                No visits scheduled for this cycle yet.
              </div>
            ) : (
              <div className="space-y-3">
                {cycleVisits.map((v, idx) => {
                  const visitTechs = collectAssignedTechnicians(v);
                  return (
                    <div
                      key={v.id}
                      className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-bold shrink-0">
                            Visit #{v.visit_index || idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {v.visit_number}
                          </span>
                          {v.cycle_number && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 shrink-0">
                              Cycle #{v.cycle_number}
                            </span>
                          )}
                          <span className="text-xs text-slate-600 truncate">
                            · {v.visit_type_display || v.visit_type}
                          </span>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge status={v.status} label={v.status_display} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Scheduled: {formatPortalDate(v.visit_date)}
                        </span>
                        {v.completion_date && (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed: {formatPortalDate(v.completion_date)}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Assigned Technician(s)
                        </span>
                        <TechnicianListCard
                          people={visitTechs}
                          emptyText="Technician not yet allocated for this visit."
                          compact
                        />
                      </div>

                      {(v.diagnosis || v.resolution_notes || v.description) && (
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200/70 text-xs text-slate-600 space-y-1">
                          {v.description && (
                            <p>
                              <strong className="text-slate-800">Scope:</strong> {v.description}
                            </p>
                          )}
                          {v.diagnosis && (
                            <p>
                              <strong className="text-slate-800">Diagnosis:</strong> {v.diagnosis}
                            </p>
                          )}
                          {v.resolution_notes && (
                            <p className="text-emerald-800">
                              <strong>Work Done:</strong> {v.resolution_notes}
                            </p>
                          )}
                        </div>
                      )}

                      {Array.isArray(v.attachments) && v.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {v.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.file_url || att.file}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{att.title || att.file_name || "Attachment"}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(selectedAmc.scope_of_support || selectedAmc.site_address) && (
            <div className="p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              {selectedAmc.site_address && (
                <div className="flex items-start gap-1.5 text-slate-600">
                  <MapPin className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                  <span>{selectedAmc.site_address}</span>
                </div>
              )}
              {selectedAmc.scope_of_support && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Scope of Support
                  </span>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {selectedAmc.scope_of_support}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>My AMC Contracts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View AMC coverage, total scheduled visits, completion status, and assigned technicians
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search AMC ID, product, site..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 w-full"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-initial min-w-0">
              <SiteFilterBar
                sites={siteOptions}
                value={siteFilter}
                onChange={handleSiteChange}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 shrink-0"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="renewed">Renewed</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
            </select>

            <button
              type="button"
              onClick={loadAmcs}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
              title="Refresh AMCs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-xs text-slate-500">
          Loading your AMC contracts...
        </div>
      ) : filteredAmcs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-xs text-slate-400">
          No AMC contracts found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAmcs.map((amc) => {
            const summary = amc.visits_summary || {};
            const total = Math.max(summary.total_planned || 0, summary.total_records || 0);
            const completed = summary.completed || 0;
            const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

            return (
              <div
                key={amc.id}
                onClick={() => openAmcDetail(amc)}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer space-y-3 overflow-hidden min-w-0 w-full max-w-full"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-sky-700 uppercase">
                        {amc.contract_id}
                      </span>
                      {(amc.service_frequency_display || amc.service_frequency) && (
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {amc.service_frequency_display || amc.service_frequency}
                        </span>
                      )}
                      {Array.isArray(amc.cycles) && amc.cycles.length > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          Renewed ({amc.cycles.length} Cycles)
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 mt-1 line-clamp-2 break-words leading-snug">
                      {amc.product}
                    </h2>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={amc.status} label={amc.status_display} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-xs">
                  <SiteBadge site={amc.site_details} fallbackAddress={amc.site_address} />
                  <span className="text-[11px] text-slate-500">
                    {formatPortalDate(amc.start_date)} – {formatPortalDate(amc.end_date)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-700">
                      Visits: {completed} / {total} completed ({summary.scheduled ?? 0} scheduled)
                    </span>
                    <span className="font-bold text-cyan-700">{pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Assigned Technicians
                  </span>
                  <TechnicianListCard
                    people={amc.assigned_technicians || []}
                    emptyText="Technicians assigned per visit"
                    compact
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px] font-semibold border-t border-slate-100">
                  <span className="truncate min-w-0 text-slate-600">
                    {amc.support_coordinator_details ? (
                      <>
                        Coordinator:{" "}
                        <strong className="text-slate-800 font-semibold">
                          {amc.support_coordinator_details.full_name}
                        </strong>
                      </>
                    ) : (
                      "Full Visit Schedule"
                    )}
                  </span>
                  <span className="shrink-0 self-end sm:self-auto text-cyan-700 hover:underline inline-flex items-center gap-1">
                    <span>View Schedule &amp; Details</span>
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
