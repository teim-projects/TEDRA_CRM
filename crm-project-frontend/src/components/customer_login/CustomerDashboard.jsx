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
  Activity,
  Layers,
  Ticket,
  Car,
  Plus,
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

// Project stage pipeline definitions & progression weights
const STAGE_CONFIG = [
  { key: "site_survey", label: "Site Survey", progress: 20, color: "bg-amber-500", text: "text-amber-600", border: "border-amber-200", light: "bg-amber-50" },
  { key: "material_procurement", label: "Procurement", progress: 40, color: "bg-purple-500", text: "text-purple-600", border: "border-purple-200", light: "bg-purple-50" },
  { key: "dispatched", label: "Dispatched", progress: 55, color: "bg-sky-500", text: "text-sky-600", border: "border-sky-200", light: "bg-sky-50" },
  { key: "installation", label: "Installation", progress: 75, color: "bg-cyan-500", text: "text-cyan-600", border: "border-cyan-200", light: "bg-cyan-50" },
  { key: "testing", label: "Testing & QA", progress: 90, color: "bg-indigo-500", text: "text-indigo-600", border: "border-indigo-200", light: "bg-indigo-50" },
  { key: "handover", label: "Handover", progress: 100, color: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-200", light: "bg-emerald-50" },
];

function getStageProgress(stageKey) {
  const normalized = String(stageKey || "").toLowerCase();
  if (normalized === "completed" || normalized === "go_live" || normalized === "handover") return 100;
  const found = STAGE_CONFIG.find((s) => s.key === normalized);
  return found ? found.progress : 25;
}

export default function CustomerDashboard() {
  const baseApi = getBaseApiUrl();
  const [data, setData] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("all");

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const [dashRes, ticketRes] = await Promise.all([
          fetchCustomerPortal(`${baseApi}/api/customer/dashboard/`),
          fetchCustomerPortal(`${baseApi}/api/customer/tickets/`).catch(() => []),
        ]);
        setData(dashRes);
        const rawTkts = Array.isArray(ticketRes) ? ticketRes : ticketRes?.results || [];
        setTickets(rawTkts);
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

  const visibleTickets = useMemo(
    () => tickets.filter((t) => matchesSiteFilter(t, selectedSiteId)),
    [tickets, selectedSiteId]
  );

  // Computed KPIs based on active site filter
  const computedKpis = useMemo(() => {
    const totalPlannedVisits = visibleAmcs.reduce(
      (sum, a) => sum + (Number(a.visits_summary?.total_planned || a.no_of_visits) || 0),
      0
    );
    const totalVisitRecords = visibleAmcs.reduce(
      (sum, a) => sum + (Number(a.visits_summary?.total_records) || 0),
      0
    );
    const completedAmcVisits = visibleAmcs.reduce(
      (sum, a) => sum + (Number(a.visits_summary?.completed) || 0),
      0
    );
    const scheduledAmcVisits = visibleAmcs.reduce(
      (sum, a) => sum + (Number(a.visits_summary?.scheduled) || 0),
      0
    );
    const inProgressAmcVisits = visibleAmcs.reduce(
      (sum, a) => sum + (Number(a.visits_summary?.in_progress) || 0),
      0
    );
    const upcomingSingleCount = visibleSingleServices.filter(
      (s) => !["completed", "cancelled"].includes(String(s.status || "").toLowerCase())
    ).length;

    const openTicketsCount = visibleTickets.filter((t) =>
      ["open", "in_progress"].includes(String(t.status || "").toLowerCase())
    ).length;

    return {
      total_projects: visibleProjects.length,
      active_projects: visibleProjects.filter((p) => p.project_stage !== "handover").length,
      total_amcs: visibleAmcs.length,
      total_amc_visits_planned: totalPlannedVisits || (data?.kpis?.total_amc_visits_planned ?? 0),
      total_amc_visits_records: totalVisitRecords,
      total_amc_visits_completed: completedAmcVisits,
      total_amc_visits_scheduled: scheduledAmcVisits,
      total_amc_visits_in_progress: inProgressAmcVisits,
      total_services: visibleSingleServices.length,
      upcoming_services_count: upcomingSingleCount,
      total_sites: visibleSites.length,
      total_tickets: visibleTickets.length,
      open_tickets: openTicketsCount,
    };
  }, [visibleAmcs, visibleProjects, visibleSingleServices, visibleSites, visibleTickets, data?.kpis]);

  // AMC Visit Breakdown calculations for Donut Chart
  const amcChartData = useMemo(() => {
    const total = Math.max(
      computedKpis.total_amc_visits_planned,
      computedKpis.total_amc_visits_records,
      1
    );
    const completed = computedKpis.total_amc_visits_completed || 0;
    const scheduled = computedKpis.total_amc_visits_scheduled || 0;
    const inProgress = computedKpis.total_amc_visits_in_progress || 0;
    const remaining = Math.max(0, total - completed - scheduled - inProgress);

    const compPct = Math.round((completed / total) * 100);
    const schedPct = Math.round((scheduled / total) * 100);
    const inProgPct = Math.round((inProgress / total) * 100);
    const remPct = Math.max(0, 100 - compPct - schedPct - inProgPct);

    return {
      total,
      completed,
      scheduled,
      inProgress,
      remaining,
      compPct,
      schedPct,
      inProgPct,
      remPct,
      fulfillmentRate: compPct,
    };
  }, [computedKpis]);

  // Project Stage Distribution calculations
  const { projectStageStats, avgPipelineProgress } = useMemo(() => {
    const counts = {
      site_survey: 0,
      material_procurement: 0,
      dispatched: 0,
      installation: 0,
      testing: 0,
      handover: 0,
      other: 0,
    };

    let totalProgressSum = 0;

    visibleProjects.forEach((prj) => {
      const stage = String(prj.project_stage || "").toLowerCase();
      totalProgressSum += getStageProgress(stage);
      if (counts[stage] !== undefined) {
        counts[stage] += 1;
      } else if (stage === "completed" || stage === "go_live") {
        counts.handover += 1;
      } else {
        counts.other += 1;
      }
    });

    const avg = visibleProjects.length > 0 ? Math.round(totalProgressSum / visibleProjects.length) : 0;

    return { projectStageStats: counts, avgPipelineProgress: avg };
  }, [visibleProjects]);

  // Service & Ticket metrics calculations
  const serviceStats = useMemo(() => {
    let breakdown = 0;
    let routine = 0;
    let preventive = 0;
    let other = 0;

    visibleSingleServices.forEach((s) => {
      const type = String(s.service_type || s.service_type_display || "").toLowerCase();
      if (type.includes("breakdown") || type.includes("emergency")) breakdown += 1;
      else if (type.includes("preventive") || type.includes("pm")) preventive += 1;
      else if (type.includes("routine") || type.includes("inspection")) routine += 1;
      else other += 1;
    });

    const openTkts = visibleTickets.filter((t) => String(t.status || "").toLowerCase() === "open").length;
    const inProgTkts = visibleTickets.filter((t) => String(t.status || "").toLowerCase() === "in_progress").length;
    const resolvedTkts = visibleTickets.filter((t) => ["resolved", "closed"].includes(String(t.status || "").toLowerCase())).length;
    const totalTkts = visibleTickets.length;
    const resolutionRate = totalTkts > 0 ? Math.round((resolvedTkts / totalTkts) * 100) : 100;

    return {
      breakdown,
      routine,
      preventive,
      other,
      openTkts,
      inProgTkts,
      resolvedTkts,
      totalTkts,
      resolutionRate,
    };
  }, [visibleSingleServices, visibleTickets]);

  // Site Capacity breakdown
  const totalCarCapacity = useMemo(
    () => visibleSites.reduce((sum, s) => sum + (Number(s.capacity_cars) || 0), 0),
    [visibleSites]
  );

  const siteQuerySuffix = selectedSite ? `?siteId=${selectedSite.id}` : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[440px] text-slate-500 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-semibold text-slate-600">Loading your customer dashboard &amp; telemetry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-rose-200 text-center space-y-3">
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

  // SVG Donut circumference for r=40 is ~251.327
  const CIRCUMFERENCE = 251.327;
  const compStroke = (amcChartData.compPct / 100) * CIRCUMFERENCE;
  const schedStroke = (amcChartData.schedPct / 100) * CIRCUMFERENCE;
  const inProgStroke = (amcChartData.inProgPct / 100) * CIRCUMFERENCE;
  const remStroke = (amcChartData.remPct / 100) * CIRCUMFERENCE;

  return (
    <div className="w-full space-y-4 sm:space-y-5 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-10 max-w-full overflow-hidden">
      {/* 1. HEADER BANNER WITH TOP SITE FILTER DROPDOWN */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 rounded-2xl p-4 sm:p-6 text-white shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border border-cyan-900/40">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {customer.customer_code && (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[10px] sm:text-[11px] font-bold tracking-wide uppercase">
                {customer.customer_code}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-[10px] sm:text-[11px] font-medium border border-white/10">
              Customer Self-Service Portal (View Only)
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight truncate text-white">
            Welcome, {customer.name || customer.contact_person || "Customer"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-300">
            {customer.contact_person && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{customer.contact_person}</span>
              </span>
            )}
            {customer.contact_number && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{customer.contact_number}</span>
              </span>
            )}
            {(customer.city || customer.state) && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{[customer.city, customer.state].filter(Boolean).join(", ")}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:w-48 lg:w-56 min-w-0">
              <SiteFilterBar
                sites={sites}
                value={selectedSiteId}
                onChange={(val) => setSelectedSiteId(val)}
                variant="dark"
              />
            </div>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer shrink-0"
              title="Refresh dashboard metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-300" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            <Link
              to={`/customer-portal/tickets${siteQuerySuffix ? `${siteQuerySuffix}&action=new` : "?action=new"}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-md hover:shadow-cyan-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Raise Ticket</span>
            </Link>
          </div>

          <Link
            to={`/customer-portal/tickets${siteQuerySuffix ? `${siteQuerySuffix}&action=new` : "?action=new"}`}
            className="sm:hidden w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Raise Ticket</span>
          </Link>
        </div>
      </div>

      {/* ACTIVE SITE FILTER PILL */}
      {selectedSite && (
        <div className="bg-sky-50 border border-sky-200/90 rounded-xl px-3.5 py-2 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-sky-950 min-w-0">
            <span className="font-bold shrink-0">Viewing Filtered Site:</span>
            <SiteBadge site={selectedSite} />
            <span className="text-sky-700 hidden sm:inline truncate">
              · {selectedSite.capacity_cars || 0} Cars Capacity · {[selectedSite.city, selectedSite.state].filter(Boolean).join(", ")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSiteId("all")}
            className="text-xs font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer shrink-0"
          >
            Show All Sites
          </button>
        </div>
      )}

      {/* 2. KPI PULSE CARDS WITH PROGRESS METERS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Projects KPI */}
        <Link
          to={`/customer-portal/projects${siteQuerySuffix}`}
          className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all group flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate pr-1">
                My Projects
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2 tracking-tight">
              {computedKpis.total_projects ?? 0}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1">
              <span className="truncate">{computedKpis.active_projects ?? 0} in progress</span>
              <ArrowRight className="w-3 h-3 text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <div className="h-1 sm:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full"
                style={{
                  width: `${computedKpis.total_projects > 0 ? ((computedKpis.active_projects / computedKpis.total_projects) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </Link>

        {/* AMC Contracts KPI */}
        <Link
          to={`/customer-portal/amcs${siteQuerySuffix}`}
          className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate pr-1">
                AMC Contracts
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2 tracking-tight">
              {computedKpis.total_amcs ?? 0}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1">
              <span className="truncate">
                {computedKpis.total_amc_visits_completed ?? 0} /{" "}
                {amcChartData.total} done
              </span>
              <ArrowRight className="w-3 h-3 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <div className="h-1 sm:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                style={{ width: `${amcChartData.compPct}%` }}
              />
            </div>
          </div>
        </Link>

        {/* Services KPI */}
        <Link
          to={`/customer-portal/services${siteQuerySuffix}`}
          className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all group flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate pr-1">
                My Services
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2 tracking-tight">
              {computedKpis.total_services ?? 0}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1">
              <span className="truncate">{computedKpis.upcoming_services_count ?? 0} upcoming</span>
              <ArrowRight className="w-3 h-3 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <div className="h-1 sm:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{
                  width: `${computedKpis.total_services > 0 ? Math.min(100, (computedKpis.upcoming_services_count / computedKpis.total_services) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </Link>

        {/* Registered Sites KPI */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate pr-1">
                Registered Sites
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2 tracking-tight">
              {visibleSites.length}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1">
              <span className="truncate">{totalCarCapacity} car spaces</span>
              <Car className="w-3 h-3 text-cyan-600 shrink-0" />
            </div>
            <div className="h-1 sm:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. CORE ANALYTICS & TELEMETRY CHARTS SECTION */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Activity className="w-4 h-4 text-cyan-600 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Customer Telemetry &amp; Operations Dashboard
            </h2>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:inline">
            Real-time analytics across your contracts, installations &amp; facilities
          </span>
        </div>

        {/* 2X2 CHARTS GRID - PROPORTIONAL & BALANCED HEIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5">
          {/* CHART 1: AMC MAINTENANCE HEALTH & VISIT FULFILLMENT GAUGE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">AMC Maintenance &amp; Visit Health</span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                    Preventive maintenance fulfillment &amp; visit completion status
                  </p>
                </div>
                <Link
                  to={`/customer-portal/amcs${siteQuerySuffix}`}
                  className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-0.5 shrink-0"
                >
                  <span>Contracts</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* DONUT CHART + METRICS */}
              <div className="mt-3.5 flex flex-col sm:flex-row items-center justify-around gap-4">
                {/* SVG DONUT GAUGE */}
                <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="11"
                    />
                    {/* Completed Segment (Emerald) */}
                    {amcChartData.compPct > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="11"
                        strokeDasharray={`${compStroke} ${CIRCUMFERENCE}`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    )}
                    {/* Scheduled Segment (Cyan) */}
                    {amcChartData.schedPct > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#06b6d4"
                        strokeWidth="11"
                        strokeDasharray={`${schedStroke} ${CIRCUMFERENCE}`}
                        strokeDashoffset={String(-compStroke)}
                        className="transition-all duration-700"
                      />
                    )}
                    {/* In Progress Segment (Amber) */}
                    {amcChartData.inProgPct > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="11"
                        strokeDasharray={`${inProgStroke} ${CIRCUMFERENCE}`}
                        strokeDashoffset={String(-(compStroke + schedStroke))}
                        className="transition-all duration-700"
                      />
                    )}
                    {/* Remaining Segment (Slate-300) */}
                    {amcChartData.remPct > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#e2e8f0"
                        strokeWidth="11"
                        strokeDasharray={`${remStroke} ${CIRCUMFERENCE}`}
                        strokeDashoffset={String(-(compStroke + schedStroke + inProgStroke))}
                        className="transition-all duration-700"
                      />
                    )}
                  </svg>

                  {/* Centered Percentage Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
                      {amcChartData.compPct}%
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                      Fulfilled
                    </span>
                  </div>
                </div>

                {/* BREAKDOWN METRICS */}
                <div className="w-full sm:w-auto flex-1 space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs p-1.5 sm:p-2 rounded-lg bg-emerald-50/80 border border-emerald-100">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-900 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Completed</span>
                    </span>
                    <span className="font-bold text-emerald-950 shrink-0">
                      {amcChartData.completed} <span className="text-[10px] text-emerald-700 font-normal">({amcChartData.compPct}%)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] sm:text-xs p-1.5 sm:p-2 rounded-lg bg-cyan-50/80 border border-cyan-100">
                    <span className="flex items-center gap-1.5 font-medium text-cyan-900 truncate">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                      <span>Scheduled</span>
                    </span>
                    <span className="font-bold text-cyan-950 shrink-0">
                      {amcChartData.scheduled} <span className="text-[10px] text-cyan-700 font-normal">({amcChartData.schedPct}%)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] sm:text-xs p-1.5 sm:p-2 rounded-lg bg-amber-50/80 border border-amber-100">
                    <span className="flex items-center gap-1.5 font-medium text-amber-900 truncate">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span>In Progress</span>
                    </span>
                    <span className="font-bold text-amber-950 shrink-0">
                      {amcChartData.inProgress} <span className="text-[10px] text-amber-700 font-normal">({amcChartData.inProgPct}%)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] sm:text-xs p-1.5 sm:p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600 truncate">
                      <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                      <span>Remaining</span>
                    </span>
                    <span className="font-bold text-slate-800 shrink-0">
                      {amcChartData.remaining} <span className="text-[10px] text-slate-500 font-normal">({amcChartData.remPct}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500">
              <span>Total Planned: <strong className="text-slate-800">{amcChartData.total} Visits</strong></span>
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Active AMC Health: Optimal
              </span>
            </div>
          </div>

          {/* CHART 2: PROJECT EXECUTION PIPELINE & MILESTONES (CLEAN VISUAL FUNNEL - NO DUPLICATE CARDS!) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="truncate">Project Execution Pipeline</span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                    Engineering milestones &amp; go-live progression
                  </p>
                </div>
                <Link
                  to={`/customer-portal/projects${siteQuerySuffix}`}
                  className="text-xs font-semibold text-sky-700 hover:underline flex items-center gap-0.5 shrink-0"
                >
                  <span>All Projects</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* PIPELINE MILESTONE STAGE CARDS */}
              <div className="mt-3.5 space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                  {STAGE_CONFIG.map((st) => {
                    const count = projectStageStats[st.key] || 0;
                    return (
                      <div
                        key={st.key}
                        className={`p-1.5 sm:p-2 rounded-xl border ${count > 0 ? `${st.border} ${st.light}` : "border-slate-100 bg-slate-50/50"} transition-all`}
                      >
                        <span className={`text-[9px] sm:text-[10px] font-bold block truncate ${count > 0 ? st.text : "text-slate-400"}`}>
                          {st.label}
                        </span>
                        <span className={`text-sm sm:text-base font-extrabold mt-0.5 block ${count > 0 ? "text-slate-900" : "text-slate-400"}`}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* OVERALL LIFECYCLE PROGRESS BAR */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      <span>Portfolio Delivery Progress</span>
                    </span>
                    <span className="font-extrabold text-sky-800 text-[11px]">
                      {avgPipelineProgress}% Average Stage
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-cyan-500 to-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${avgPipelineProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>Site Survey (20%)</span>
                    <span>Installation (75%)</span>
                    <span>Handover (100%)</span>
                  </div>
                </div>

                {/* SUMMARY HIGHLIGHTS */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                    <span className="text-[10px] text-sky-700 font-semibold block">In Progress</span>
                    <span className="text-sm font-extrabold text-slate-900">{computedKpis.active_projects} Installations</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 font-semibold block">Handed Over</span>
                    <span className="text-sm font-extrabold text-slate-900">{projectStageStats.handover} Operational</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500">
              <span>Total Projects: <strong className="text-slate-800">{computedKpis.total_projects}</strong></span>
              <span className="text-sky-700 font-semibold">
                Milestones Tracked: 100%
              </span>
            </div>
          </div>

          {/* CHART 3: SERVICES & SUPPORT TICKET RESOLUTION MATRIX */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate">Service Requests &amp; Support Tickets</span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                    Breakdown response, routine maintenance &amp; ticket resolution
                  </p>
                </div>
                <Link
                  to={`/customer-portal/tickets${siteQuerySuffix}`}
                  className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-0.5 shrink-0"
                >
                  <span>Tickets</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="mt-3.5 space-y-3">
                {/* TICKET RESOLUTION SPLIT PROGRESS */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Ticket Resolution Health</span>
                    </span>
                    <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] sm:text-[11px] shrink-0">
                      {serviceStats.resolutionRate}% Resolved
                    </span>
                  </div>

                  {/* Multi-segment ticket bar */}
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${serviceStats.totalTkts > 0 ? (serviceStats.resolvedTkts / serviceStats.totalTkts) * 100 : 100}%`,
                      }}
                      title={`Resolved: ${serviceStats.resolvedTkts}`}
                    />
                    <div
                      className="h-full bg-cyan-500"
                      style={{
                        width: `${serviceStats.totalTkts > 0 ? (serviceStats.inProgTkts / serviceStats.totalTkts) * 100 : 0}%`,
                      }}
                      title={`In Progress: ${serviceStats.inProgTkts}`}
                    />
                    <div
                      className="h-full bg-rose-500"
                      style={{
                        width: `${serviceStats.totalTkts > 0 ? (serviceStats.openTkts / serviceStats.totalTkts) * 100 : 0}%`,
                      }}
                      title={`Open: ${serviceStats.openTkts}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span>Open ({serviceStats.openTkts})</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                      <span>In Progress ({serviceStats.inProgTkts})</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Resolved ({serviceStats.resolvedTkts})</span>
                    </span>
                  </div>
                </div>

                {/* SERVICE CATEGORIES BREAKDOWN */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Service Requests By Category
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 sm:p-2.5 rounded-xl border border-rose-100 bg-rose-50/50">
                      <span className="text-[9px] sm:text-[10px] font-bold text-rose-700 block truncate">Breakdown</span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 block">{serviceStats.breakdown}</span>
                    </div>
                    <div className="p-2 sm:p-2.5 rounded-xl border border-cyan-100 bg-cyan-50/50">
                      <span className="text-[9px] sm:text-[10px] font-bold text-cyan-700 block truncate">Routine</span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 block">{serviceStats.routine}</span>
                    </div>
                    <div className="p-2 sm:p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
                      <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 block truncate">Preventive PM</span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 block">{serviceStats.preventive}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500">
              <span>Total Services: <strong className="text-slate-800">{computedKpis.total_services}</strong></span>
              <Link
                to={`/customer-portal/tickets${siteQuerySuffix ? `${siteQuerySuffix}&action=new` : "?action=new"}`}
                className="text-cyan-700 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>+ Log New Request</span>
              </Link>
            </div>
          </div>

          {/* CHART 4: SITE PARKING CAPACITY & INFRASTRUCTURE PORTFOLIO (WITH ONE-CLICK FILTER) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span className="truncate">Site Parking Capacity &amp; Assets</span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                    Parking space allocation &amp; facility portfolio distribution
                  </p>
                </div>
                <span className="text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 shrink-0">
                  {totalCarCapacity} Spaces
                </span>
              </div>

              {/* HORIZONTAL STACKED CAPACITY BAR */}
              <div className="mt-3.5 space-y-2.5">
                <div>
                  <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-slate-500 mb-1.5">
                    <span className="font-semibold text-slate-700">Capacity Share by Facility</span>
                    <span>{visibleSites.length} Active Sites</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-200">
                    {visibleSites.map((site, idx) => {
                      const share = totalCarCapacity > 0 ? (Number(site.capacity_cars || 0) / totalCarCapacity) * 100 : 0;
                      const colors = [
                        "bg-gradient-to-r from-sky-500 to-indigo-600",
                        "bg-gradient-to-r from-cyan-400 to-teal-500",
                        "bg-gradient-to-r from-emerald-400 to-emerald-600",
                        "bg-gradient-to-r from-purple-400 to-purple-600",
                      ];
                      const color = colors[idx % colors.length];
                      return (
                        <div
                          key={site.id}
                          className={`h-full ${color} rounded-sm transition-all hover:opacity-90`}
                          style={{ width: `${share}%` }}
                          title={`${site.name}: ${site.capacity_cars || 0} cars (${Math.round(share)}%)`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* SITES CAPACITY LIST WITH QUICK FOCUS */}
                <div className="space-y-1.5 sm:space-y-2">
                  {visibleSites.slice(0, 3).map((site, idx) => {
                    const share = totalCarCapacity > 0 ? Math.round((Number(site.capacity_cars || 0) / totalCarCapacity) * 100) : 0;
                    const dotColors = ["bg-indigo-500", "bg-cyan-500", "bg-emerald-500", "bg-purple-500"];
                    const dotColor = dotColors[idx % dotColors.length];
                    const isSelected = String(selectedSiteId) === String(site.id);
                    return (
                      <div
                        key={site.id}
                        onClick={() => setSelectedSiteId(isSelected ? "all" : String(site.id))}
                        className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-sky-50/90 border-sky-400 shadow-2xs"
                            : "bg-slate-50/60 border-slate-200/70 hover:border-cyan-300"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {site.name}
                            </h4>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate ml-3.5">
                            {site.site_type || "Facility"} · {[site.city, site.state].filter(Boolean).join(", ")}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-extrabold text-slate-900 block">
                            {site.capacity_cars || 0} <span className="text-[10px] font-normal text-slate-500">Cars</span>
                          </span>
                          <span className="text-[10px] font-bold text-cyan-700">
                            {share}% share
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500">
              <span>Click site to filter whole dashboard</span>
              {selectedSite && (
                <button
                  type="button"
                  onClick={() => setSelectedSiteId("all")}
                  className="text-cyan-700 font-bold hover:underline cursor-pointer"
                >
                  Clear site filter
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. UPCOMING VISITS & ACTIVE AMC CONTRACTS PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Upcoming Visits & Service Schedule */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span className="truncate">Upcoming Visits &amp; Service Schedule</span>
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                  Next scheduled technician visits and service tickets
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Link
                  to={`/customer-portal/services${siteQuerySuffix}`}
                  className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-0.5"
                >
                  <span>Services</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  to={`/customer-portal/amcs${siteQuerySuffix}`}
                  className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-0.5"
                >
                  <span>AMCs</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {visibleUpcoming.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
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
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
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
                          <p className="text-xs font-bold text-slate-900 mt-1 truncate">
                            {item.service_type_display || item.visit_type_display}
                            {item.equipment ? ` · ${item.equipment}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={item.status} label={item.status_display} />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px]">
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
        </div>

        {/* Active AMC Visit Progress */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">AMC Contracts &amp; Visit Progress</span>
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                  Visit counts, completion progress, and maintenance coverage
                </p>
              </div>
              <Link
                to={`/customer-portal/amcs${siteQuerySuffix}`}
                className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-0.5 shrink-0"
              >
                <span>View All ({visibleAmcs.length})</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="mt-3 space-y-2.5">
              {visibleAmcs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No AMC contracts found{selectedSite ? ` for ${selectedSite.name}` : ""}.
                </div>
              ) : (
                visibleAmcs.slice(0, 3).map((amc) => {
                  const summary = amc.visits_summary || {};
                  const total = Math.max(summary.total_planned || 0, summary.total_records || 0, amc.no_of_visits || 0);
                  const completed = summary.completed || 0;
                  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
                  return (
                    <div
                      key={amc.id}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
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

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500">
                        <SiteBadge site={amc.site_details} fallbackAddress={amc.site_address} />
                        <span>
                          {formatPortalDate(amc.start_date)} – {formatPortalDate(amc.end_date)}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-1">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {completed} of {total} visits completed
                            </span>
                          </span>
                          <span className="font-bold text-cyan-700">{pct}%</span>
                        </div>
                        <div className="h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
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
      </div>

      {/* 5. RECENT PROJECTS & ASSIGNED TECHNICIANS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="truncate">My Projects &amp; Assigned Engineering Teams</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
              Execution progress, active stages and technical teams assigned to your sites
            </p>
          </div>
          <Link
            to={`/customer-portal/projects${siteQuerySuffix}`}
            className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-0.5 shrink-0"
          >
            <span>View All ({visibleProjects.length})</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {visibleProjects.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No projects found{selectedSite ? ` for ${selectedSite.name}` : " yet"}.
          </div>
        ) : (
          <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {visibleProjects.slice(0, 3).map((prj) => (
              <div
                key={prj.id}
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-sky-700 block">
                        {prj.project_code}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                        {Array.isArray(prj.product) && prj.product.length > 0
                          ? prj.product.join(", ")
                          : "Parking Installation Project"}
                      </h3>
                    </div>
                    <StatusBadge status={prj.project_stage} label={prj.project_stage_display} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500">
                    <SiteBadge site={prj.site_details} />
                    <span>Go-Live: {formatPortalDate(prj.expected_to_go_live)}</span>
                  </div>
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
