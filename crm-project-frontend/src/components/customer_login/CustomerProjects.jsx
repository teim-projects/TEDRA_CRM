import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Search,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  X,
  RefreshCw,
  ShieldCheck,
  FileText,
  UserCheck,
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import {
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

const PROJECT_STAGES = [
  { key: "order_confirmed", label: "Order Confirmed" },
  { key: "site_survey", label: "Site Survey" },
  { key: "material_procurement", label: "Material Procurement" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
  { key: "installation", label: "Installation" },
  { key: "testing", label: "Testing" },
  { key: "handover", label: "Handover" },
];

export default function CustomerProjects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const baseApi = getBaseApiUrl();
  const [projects, setProjects] = useState([]);
  const [customerSites, setCustomerSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState(() => searchParams.get("siteId") || "all");
  const [selectedProject, setSelectedProject] = useState(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projData, meData] = await Promise.all([
        fetchCustomerPortal(`${baseApi}/api/customer/projects/`),
        fetchCustomerPortal(`${baseApi}/api/customer/me/`).catch(() => null),
      ]);
      const list = Array.isArray(projData) ? projData : projData.results || [];
      setProjects(list);
      setCustomerSites(meData?.customer_profile?.sites || []);
    } catch (err) {
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [baseApi]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSiteChange = (val) => {
    setSiteFilter(val);
    setSelectedProject(null);
    const next = new URLSearchParams(searchParams);
    if (val === "all") next.delete("siteId");
    else next.set("siteId", val);
    setSearchParams(next, { replace: true });
  };

  const siteOptions = useMemo(
    () => mergeCustomerSites(customerSites, projects),
    [customerSites, projects]
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (!matchesSiteFilter(p, siteFilter)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        p.project_code,
        p.project_stage_display,
        p.site_details?.name,
        p.site_details?.site_shortcut,
        ...(Array.isArray(p.product) ? p.product : []),
        ...(p.technicians_details || []).map((t) => t.full_name),
        p.project_executive_details?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, search, siteFilter]);

  if (selectedProject) {
    const stageIdx = PROJECT_STAGES.findIndex((s) => s.key === selectedProject.project_stage);
    const exec = selectedProject.project_executive_details;
    const techs = selectedProject.technicians_details || [];

    return (
      <div className="w-full space-y-5 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-7 shadow-2xs space-y-5 sm:space-y-6 overflow-hidden max-w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                  {selectedProject.project_code}
                </span>
                <StatusBadge
                  status={selectedProject.project_stage}
                  label={selectedProject.project_stage_display}
                />
                {selectedProject.priority_display && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Priority: {selectedProject.priority_display}
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug break-words">
                {Array.isArray(selectedProject.product) && selectedProject.product.length > 0
                  ? selectedProject.product.join(", ")
                  : "Installation Project"}
              </h1>
              <div className="pt-0.5">
                <SiteBadge site={selectedProject.site_details} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer self-start shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Back to My Projects</span>
            </button>
          </div>

          {/* Stage Timeline */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Project Execution Stage
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {PROJECT_STAGES.map((stage, idx) => {
                const done = stageIdx >= 0 && idx <= stageIdx;
                const current = idx === stageIdx;
                return (
                  <div
                    key={stage.key}
                    className={`p-2 rounded-lg border text-center text-[11px] font-semibold transition-all ${
                      current
                        ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                        : done
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-white text-slate-400 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {done && !current && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{stage.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Start Date
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {formatPortalDate(selectedProject.start_date)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Expected Go-Live
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {formatPortalDate(selectedProject.expected_to_go_live)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Project Value
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {formatINR(selectedProject.project_value)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Linked AMC
              </span>
              <span className="text-xs font-bold text-emerald-700 mt-1 block">
                {selectedProject.amc_contract_number ||
                  (selectedProject.has_amc ? "Active AMC" : "Not Assigned")}
              </span>
            </div>
          </div>

          {/* Assigned Technicians & Project Executive */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                <Users className="w-4 h-4 text-cyan-600" />
                <span>Allocated Technicians for This Project</span>
              </h2>
              <TechnicianListCard
                people={techs}
                emptyText="No technicians allocated to this project yet."
              />
            </div>

            {exec && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                  <UserCheck className="w-4 h-4 text-sky-600" />
                  <span>Project Executive / Manager</span>
                </h2>
                <TechnicianListCard
                  people={[{ ...exec, displayRole: exec.role_name || "Project Executive" }]}
                />
              </div>
            )}

            {selectedProject.team_members && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Team Notes
                </span>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                  {selectedProject.team_members}
                </p>
              </div>
            )}
          </div>

          {/* Site & Scope */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedProject.site_details && (
              <div className="p-4 rounded-xl border border-slate-200/80 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Installation Site Details</span>
                </h3>
                <p className="text-xs font-bold text-slate-900">
                  {selectedProject.site_details.name}{" "}
                  {selectedProject.site_details.site_shortcut &&
                    `(${selectedProject.site_details.site_shortcut})`}
                </p>
                <p className="text-xs text-slate-600">
                  {[
                    selectedProject.site_details.address,
                    selectedProject.site_details.city,
                    selectedProject.site_details.state,
                    selectedProject.site_details.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <div className="text-[11px] text-slate-500 pt-1 flex flex-wrap gap-3">
                  <span>Type: {selectedProject.site_details.site_type}</span>
                  <span>Capacity: {selectedProject.site_details.capacity_cars || 0} Cars</span>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-200/80 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>Scope &amp; AMC Coverage</span>
              </h3>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">
                {selectedProject.project_scope_requirements || "No additional scope notes recorded."}
              </p>
              {(selectedProject.amc_start_date || selectedProject.amc_end_date) && (
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    AMC Period: {formatPortalDate(selectedProject.amc_start_date)} –{" "}
                    {formatPortalDate(selectedProject.amc_end_date)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1 pb-8">
      {/* Header & Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-sky-600" />
            <span>My Projects</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track project milestones, site installations, and assigned technicians (read-only)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, product, technician..."
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
              onClick={loadProjects}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
              title="Refresh Projects"
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
          Loading your projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-xs text-slate-400">
          No projects found matching your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((prj) => {
            const techs = prj.technicians_details || [];
            return (
              <div
                key={prj.id}
                onClick={() => setSelectedProject(prj)}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-cyan-200 transition-all cursor-pointer space-y-3 overflow-hidden min-w-0 w-full max-w-full"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-sky-700 uppercase">
                      {prj.project_code}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2 break-words leading-snug">
                      {Array.isArray(prj.product) && prj.product.length > 0
                        ? prj.product.join(", ")
                        : "Installation Project"}
                    </h2>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={prj.project_stage} label={prj.project_stage_display} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-xs">
                  <SiteBadge site={prj.site_details} />
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Go-Live: {formatPortalDate(prj.expected_to_go_live)}</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-slate-500 min-w-0">
                    <span className="font-semibold text-slate-600">Assigned Technicians</span>
                    {prj.project_executive_details && (
                      <span className="truncate">
                        Manager:{" "}
                        <strong className="text-slate-700">
                          {prj.project_executive_details.full_name}
                        </strong>
                      </span>
                    )}
                  </div>
                  <TechnicianListCard
                    people={techs}
                    emptyText="No technicians allocated yet."
                    compact
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px] text-cyan-700 font-semibold border-t border-slate-100">
                  <span className="truncate min-w-0 text-slate-600">
                    {prj.amc_contract_number
                      ? `AMC: ${prj.amc_contract_number}`
                      : prj.has_amc
                      ? "AMC Linked"
                      : "Standard Project"}
                  </span>
                  <span className="shrink-0 self-end sm:self-auto hover:underline inline-flex items-center gap-1">
                    <span>View Full Details</span>
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
