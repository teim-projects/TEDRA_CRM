import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  ShieldCheck,
  Wrench,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowRight,
  User,
  Phone,
  Building2,
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import {
  collectAssignedTechnicians,
  fetchCustomerPortal,
  formatPortalDate,
  matchesSiteFilter,
  SiteBadge,
  SiteFilterBar,
  StatusBadge,
  TechnicianListCard,
} from "./customerUtils";

export default function CustomerDashboard() {
  const baseApi = getBaseApiUrl();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("all");
  const [showAllSites, setShowAllSites] = useState(false);

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const res = await fetchCustomerPortal(`${baseApi}/api/customer/dashboard/`);
        setData(res);
      } catch (err) {
        setError(err.message || "Failed to load customer dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [baseApi]
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const customer = data?.customer || {};
  const sites = data?.sites || [];
  const allProjects = data?.projects || [];
  const allAmcs = data?.amcs || [];
  const allServices = data?.services || [];
  const allUpcomingSchedule = data?.upcoming_schedule || [];

  const selectedSite = useMemo(
    () => sites.find((s) => String(s.id) === String(selectedSiteId)) || null,
    [sites, selectedSiteId]
  );

  const visibleSites = useMemo(
    () => (selectedSite ? sites.filter((s) => String(s.id) === String(selectedSiteId)) : sites),
    [sites, selectedSite, selectedSiteId]
  );

  const visibleProjects = useMemo(
    () => allProjects.filter((p) => matchesSiteFilter(p, selectedSiteId)),
    [allProjects, selectedSiteId]
  );

  const visibleAmcs = useMemo(
    () => allAmcs.filter((c) => matchesSiteFilter(c, selectedSiteId)),
    [allAmcs, selectedSiteId]
  );

  const visibleUpcoming = useMemo(
    () => allUpcomingSchedule.filter((s) => matchesSiteFilter(s, selectedSiteId)),
    [allUpcomingSchedule, selectedSiteId]
  );

  const visibleSingleServices = useMemo(
    () => allServices.filter((s) => matchesSiteFilter(s, selectedSiteId)),
    [allServices, selectedSiteId]
  );

  const computedKpis = useMemo(() => {
    if (!selectedSite) {
      return data?.kpis || {};
    }
    const totalPlannedVisits = visibleAmcs.reduce((sum, a) => sum + (Number(a.no_of_visits) || 0), 0);
    const totalVisitRecords = visibleAmcs.reduce(
      (sum, a) => sum + (Number(a.visits_summary?.total_records) || 0),
      0
    );
    const completedAmcVisits = visibleAmcs.reduce(
      (sum, a) => sum + (Number(a.visits_summary?.completed) || 0),
      0
    );
    const upcomingSingleCount = visibleSingleServices.filter(
      (s) => !["completed", "cancelled"].includes(String(s.status || "").toLowerCase())
    ).length;
    return {
      total_projects: visibleProjects.length,
      active_projects: visibleProjects.filter((p) => p.project_stage !== "handover").length,
      total_amcs: visibleAmcs.length,
      total_amc_visits_planned: totalPlannedVisits,
      total_amc_visits_records: totalVisitRecords,
      total_amc_visits_completed: completedAmcVisits,
      total_services: visibleSingleServices.length,
      upcoming_services_count: upcomingSingleCount,
      total_sites: visibleSites.length,
    };
  }, [selectedSite, data?.kpis, visibleAmcs, visibleProjects, visibleSingleServices, visibleSites]);

  const siteQuerySuffix = selectedSite ? `?siteId=${selectedSite.id}` : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[420px] text-slate-500 text-sm">
        Loading your portal overview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-rose-200 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => loadDashboard(false)}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const displayedSites = showAllSites ? visibleSites : visibleSites.slice(0, 3);

  return (
    <div className="w-full space-y-5 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
      {/* HEADER BANNER WITH TOP SITE FILTER DROPDOWN */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {customer.customer_code && (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 text-[11px] font-bold tracking-wide uppercase">
                {customer.customer_code}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-[11px] font-medium">
              Customer Self-Service Portal (View Only)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            Welcome, {customer.name || customer.contact_person || "Customer"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
            {customer.contact_person && (
              <span className="inline-flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-cyan-300" />
                {customer.contact_person}
              </span>
            )}
            {customer.contact_number && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-cyan-300" />
                {customer.contact_number}
              </span>
            )}
            {(customer.city || customer.state) && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-cyan-300" />
                {[customer.city, customer.state].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <SiteFilterBar
            sites={sites}
            value={selectedSiteId}
            onChange={(val) => setSelectedSiteId(val)}
            variant="dark"
          />

          <Link
            to={`/customer-portal/tickets${siteQuerySuffix ? `${siteQuerySuffix}&action=new` : "?action=new"}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-xs transition-all shrink-0"
          >
            <span>+ Raise Ticket</span>
          </Link>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ACTIVE SITE FILTER BANNER */}
      {selectedSite && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-sky-900">
            <span className="font-bold">Viewing Site:</span>
            <SiteBadge site={selectedSite} />
            <span className="text-sky-700 hidden sm:inline">
              · {selectedSite.capacity_cars || 0} Cars · {[selectedSite.city, selectedSite.state].filter(Boolean).join(", ")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSiteId("all")}
            className="text-xs font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer"
          >
            Show All Sites
          </button>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link
          to={`/customer-portal/projects${siteQuerySuffix}`}
          className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md hover:border-cyan-200 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              My Projects
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {computedKpis.total_projects ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{computedKpis.active_projects ?? 0} in progress</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>

        <Link
          to={`/customer-portal/amcs${siteQuerySuffix}`}
          className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              AMC Contracts
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {computedKpis.total_amcs ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>
              {computedKpis.total_amc_visits_completed ?? 0} /{" "}
              {Math.max(
                computedKpis.total_amc_visits_planned ?? 0,
                computedKpis.total_amc_visits_records ?? 0
              )}{" "}
              visits done
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>

        <Link
          to={`/customer-portal/services${siteQuerySuffix}`}
          className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md hover:border-amber-200 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              My Services
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {computedKpis.total_services ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{computedKpis.upcoming_services_count ?? 0} upcoming services</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Registered Sites
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {visibleSites.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {visibleSites.reduce((sum, s) => sum + (Number(s.capacity_cars) || 0), 0)} total car spaces
          </div>
        </div>
      </div>

      {/* REGISTERED SITES SECTION (SHOWING SITE NAMES & QUICK SITE SELECT) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-600" />
              <span>My Sites ({visibleSites.length})</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click any site to filter your dashboard data by that location
            </p>
          </div>
          {visibleSites.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllSites((prev) => !prev)}
              className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{showAllSites ? "Show Top 3" : `View All (${visibleSites.length})`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {visibleSites.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No registered sites found.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {displayedSites.map((site) => {
              const isSelected = String(selectedSiteId) === String(site.id);
              return (
                <div
                  key={site.id}
                  onClick={() => setSelectedSiteId(isSelected ? "all" : String(site.id))}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? "bg-sky-50/90 border-sky-400 shadow-xs"
                      : "bg-slate-50/60 border-slate-200/80 hover:border-cyan-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">
                      📍 {site.name}
                    </h3>
                    {site.site_shortcut && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 shrink-0">
                        {site.site_shortcut}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">
                    {site.site_type || "Parking Facility"} · {site.capacity_cars || 0} Cars
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {[site.address, site.city, site.state, site.pincode].filter(Boolean).join(", ")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPCOMING VISITS & SERVICE SCHEDULE (MAX 3) + ACTIVE AMCS (MAX 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Schedule */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-600" />
                <span>Upcoming Visits &amp; Service Schedule</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Next scheduled technician visits and service tickets
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to={`/customer-portal/services${siteQuerySuffix}`}
                className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-1"
              >
                <span>My Services</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to={`/customer-portal/amcs${siteQuerySuffix}`}
                className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>My AMCs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-3 space-y-3 flex-1">
            {visibleUpcoming.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No upcoming visits or open service tickets scheduled
                {selectedSite ? ` for ${selectedSite.name}` : ""}.
              </div>
            ) : (
              visibleUpcoming.slice(0, 3).map((item) => {
                const techs = collectAssignedTechnicians(item);
                const dateVal = item.service_date || item.visit_date;
                return (
                  <div
                    key={`${item.work_type}-${item.id}`}
                    className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-cyan-700">
                            {item.service_number || item.visit_number}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-semibold">
                            {item.work_type === "amc_visit" ? "AMC Visit" : "Service Request"}
                          </span>
                          {item.amc_contract_number && (
                            <span className="text-[10px] font-mono text-slate-500">
                              ({item.amc_contract_number})
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-1">
                          {item.service_type_display || item.visit_type_display}
                          {item.equipment ? ` · ${item.equipment}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={item.status} label={item.status_display} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <SiteBadge site={item.site_details} fallbackAddress={item.service_address} />
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>{formatPortalDate(dateVal)}</span>
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Assigned Technician
                      </span>
                      <TechnicianListCard people={techs} compact />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active AMC Visit Progress (MAX 3) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>AMC Contracts &amp; Visit Progress</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Visit counts, completion progress, and maintenance coverage
              </p>
            </div>
            <Link
              to={`/customer-portal/amcs${siteQuerySuffix}`}
              className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-1 shrink-0"
            >
              <span>View All ({visibleAmcs.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-3 space-y-3 flex-1">
            {visibleAmcs.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No AMC contracts found{selectedSite ? ` for ${selectedSite.name}` : ""}.
              </div>
            ) : (
              visibleAmcs.slice(0, 3).map((amc) => {
                const summary = amc.visits_summary || {};
                const total = Math.max(summary.total_planned || 0, summary.total_records || 0);
                const completed = summary.completed || 0;
                const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
                return (
                  <div
                    key={amc.id}
                    className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-sky-700">
                            {amc.contract_id}
                          </span>
                          {Array.isArray(amc.cycles) && amc.cycles.length > 1 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Renewed ({amc.cycles.length} Cycles)
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            {amc.service_frequency_display || amc.service_frequency}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                          {amc.product}
                        </p>
                      </div>
                      <StatusBadge status={amc.status} label={amc.status_display} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <SiteBadge site={amc.site_details} fallbackAddress={amc.site_address} />
                      <span>
                        {formatPortalDate(amc.start_date)} – {formatPortalDate(amc.end_date)}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {completed} of {total} visits completed
                          </span>
                        </span>
                        <span className="font-bold text-cyan-700">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RECENT PROJECTS (MAX 3 + VIEW ALL) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-sky-600" />
              <span>My Projects &amp; Assigned Technicians</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Execution progress and technical team assigned to your installations
            </p>
          </div>
          <Link
            to={`/customer-portal/projects${siteQuerySuffix}`}
            className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>View All ({visibleProjects.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {visibleProjects.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No projects found{selectedSite ? ` for ${selectedSite.name}` : " yet"}.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {visibleProjects.slice(0, 3).map((prj) => (
              <div
                key={prj.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-sky-700">
                      {prj.project_code}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 mt-0.5">
                      {Array.isArray(prj.product) && prj.product.length > 0
                        ? prj.product.join(", ")
                        : "Parking Installation Project"}
                    </h3>
                  </div>
                  <StatusBadge status={prj.project_stage} label={prj.project_stage_display} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <SiteBadge site={prj.site_details} />
                  <span>Go-Live: {formatPortalDate(prj.expected_to_go_live)}</span>
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Project Technicians
                  </span>
                  <TechnicianListCard
                    people={prj.technicians_details || []}
                    emptyText="No technicians allocated yet."
                    compact
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
