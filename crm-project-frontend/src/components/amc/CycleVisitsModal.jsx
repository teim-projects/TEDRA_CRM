import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RxCross2 } from "react-icons/rx";
import {
  MdOutlineRemoveRedEye,
  MdCheckCircle,
  MdSchedule,
  MdEngineering,
  MdLocationOn,
  MdOutlineBuild,
  MdAccessTime,
  MdPhone,
  MdPerson,
  MdAutorenew
} from "react-icons/md";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Wrench,
  Search,
  RotateCcw
} from "lucide-react";

export default function CycleVisitsModal({
  open,
  onClose,
  cycle,
  amcContract,
  baseApi = "http://localhost:8000",
  token,
  formatDate = (d) => d || "—"
}) {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const effectiveToken = useMemo(
    () =>
      token ||
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "",
    [token]
  );

  const fetchCycleVisits = useCallback(async () => {
    if (!cycle || !amcContract) return;
    setLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {})
      };

      const url = `${baseApi.replace(/\/$/, "")}/amc/visits/?amc_contract=${amcContract.id}&cycle=${cycle.id}&limit=100`;
      const res = await fetch(url, { headers });

      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setVisits(list);
      } else {
        // Fallback: fetch all visits for the contract and filter locally by cycle ID or date range
        const fallbackUrl = `${baseApi.replace(/\/$/, "")}/amc/visits/?amc_contract=${amcContract.id}&limit=100`;
        const fbRes = await fetch(fallbackUrl, { headers });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const allVisits = Array.isArray(fbData.results) ? fbData.results : Array.isArray(fbData) ? fbData : [];
          const matched = allVisits.filter((v) => {
            if (v.cycle === cycle.id || v.cycle?.id === cycle.id) return true;
            // Fallback match by cycle_number or date range
            if (v.cycle_number === cycle.cycle_number) return true;
            if (cycle.start_date && cycle.end_date && v.visit_date) {
              return v.visit_date >= cycle.start_date && v.visit_date <= cycle.end_date;
            }
            return false;
          });
          setVisits(matched);
        }
      }
    } catch (err) {
      console.error("Failed to fetch cycle visits:", err);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [cycle, amcContract, baseApi, effectiveToken]);

  useEffect(() => {
    if (open && cycle && amcContract) {
      fetchCycleVisits();
      setSearchQuery("");
      setStatusFilter("all");
    } else {
      setVisits([]);
    }
  }, [open, cycle, amcContract, fetchCycleVisits]);

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (statusFilter !== "all" && (v.status || "").toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (v.visit_number || "").toLowerCase();
        const desc = (v.description || "").toLowerCase();
        const notes = (v.resolution_notes || "").toLowerCase();
        const tech = (
          v.technicians_details?.map((t) => `${t.first_name || ""} ${t.last_name || ""}`).join(" ") || ""
        ).toLowerCase();
        return num.includes(q) || desc.includes(q) || notes.includes(q) || tech.includes(q);
      }
      return true;
    });
  }, [visits, statusFilter, searchQuery]);

  if (!open || !cycle || !amcContract) return null;

  const customerName =
    amcContract.customer_details?.company_name ||
    amcContract.customer_details?.name ||
    amcContract.customer?.name ||
    "Customer";

  const completedCount = visits.filter((v) => v.status === "completed").length;
  const inProgressCount = visits.filter((v) => v.status === "in_progress").length;
  const scheduledCount = visits.filter((v) => v.status === "scheduled").length;

  const handleOpenVisitDetail = (visit) => {
    const formattedVisit = {
      ...visit,
      work_type: "amc_visit",
      contract_id: amcContract.contract_id || amcContract.id,
      customer_details: visit.customer_details || amcContract.customer_details,
      site_details: visit.site_details || amcContract.site_details,
      site_name: visit.site_name || visit.site_details?.name || amcContract.site_details?.name || amcContract.site_name,
      site_shortcut: visit.site_shortcut || visit.site_details?.site_shortcut || amcContract.site_details?.site_shortcut || amcContract.site_shortcut,
      equipment: visit.equipment || amcContract.product,
      service_date: visit.visit_date || visit.service_date,
      service_number: visit.visit_number || `VIS-${String(visit.id).padStart(3, "0")}`,
      service_address: visit.visit_address || amcContract.site_address,
      latitude: visit.latitude || amcContract.latitude || null,
      longitude: visit.longitude || amcContract.longitude || null,
      location_url: visit.location_url || amcContract.location_url || "",
      service_type_display: visit.visit_type_display || "Routine Maintenance",
    };

    onClose();
    navigate("/technician/work-desk", {
      state: { viewingService: formattedVisit, from: "amc" },
    });
  };

  const getStatusBadge = (status) => {
    switch ((status || "").toLowerCase()) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={10} /> Completed
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={10} /> In Progress
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Calendar size={10} /> Scheduled
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* HEADER BAR */}
        <div className="bg-white px-5 sm:px-6 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0">
              <RotateCcw size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Visits for Cycle #{cycle.cycle_number}
                </h3>
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                  {cycle.cycle_number === 1 ? "Initial Contract" : `Renewal #${cycle.cycle_number - 1}`}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium capitalize">
                  {cycle.status_display || cycle.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {amcContract.contract_id || `#${amcContract.id}`} — {customerName}
                {(amcContract.site_details?.name || amcContract.site_name) && (
                  <span className="inline-flex items-center gap-1 ml-1.5 px-2 py-0.2 rounded-full text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200">
                    <span>📍</span>
                    <span>{amcContract.site_details?.name || amcContract.site_name}</span>
                  </span>
                )}
                {" "}· Coverage Period:{" "}
                <span className="font-semibold text-slate-700">
                  {formatDate(cycle.start_date)} to {formatDate(cycle.end_date)}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <RxCross2 size={18} />
          </button>
        </div>

        {/* SUMMARY STATS STRIP */}
        <div className="bg-slate-50/80 px-5 sm:px-6 py-3 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Planned Visits</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {visits.length || cycle.no_of_visits || 4} Visits
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Completed</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block">
              {completedCount} Completed
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Scheduled / Pending</span>
            <span className="font-bold text-sky-700 text-sm mt-0.5 block">
              {scheduledCount + inProgressCount} Upcoming
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Cycle Value</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              ₹{parseFloat(cycle.annual_value || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-white">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by visit number, technician, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {["all", "scheduled", "in_progress", "completed"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer capitalize ${
                  statusFilter === st
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "in_progress" ? "In Progress" : st}
              </button>
            ))}
          </div>
        </div>

        {/* VISITS TABLE BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 slim-scrollbar">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading visits for Cycle #{cycle.cycle_number}...</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600 text-sm">No visits found for this cycle</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "No visits matched your filter criteria."
                  : "No visits have been logged or generated for this cycle period yet."}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Visit #</th>
                    <th className="py-2.5 px-3">Visit Date</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Technician(s)</th>
                    <th className="py-2.5 px-3">Site / Work Scope</th>
                    <th className="py-2.5 px-3">Completion Notes</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVisits.map((v) => {
                    const techNames = (
                      v.technicians_details?.map((t) => t.name || `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.username).filter(Boolean).join(", ") ||
                      v.technicians?.map((t) => (typeof t === "string" ? t : t.name)).filter(Boolean).join(", ") ||
                      "Unassigned"
                    );

                    return (
                      <tr key={v.id} className="hover:bg-purple-50/20 transition-colors h-10">
                        {/* Visit Number */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md inline-block">
                            {v.visit_number || `VIS-${v.id}`}
                          </span>
                        </td>

                        {/* Visit Date */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {formatDate(v.visit_date)}
                          </div>
                          {v.completion_date && (
                            <span className="text-[10px] text-emerald-600 block">
                              Completed: {formatDate(v.completion_date)}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {getStatusBadge(v.status)}
                        </td>

                        {/* Technicians */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {techNames.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-700 truncate max-w-[140px]" title={techNames}>
                              {techNames}
                            </span>
                          </div>
                        </td>

                        {/* Site & Scope */}
                        <td className="py-2 px-3">
                          {(v.site_name || v.site_details?.name || amcContract.site_details?.name || amcContract.site_name) && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 mb-1 max-w-[200px] truncate block">
                              <span>📍</span>
                              <span className="truncate">{v.site_name || v.site_details?.name || amcContract.site_details?.name || amcContract.site_name}</span>
                              {(v.site_shortcut || v.site_details?.site_shortcut || amcContract.site_details?.site_shortcut) && (
                                <span className="font-mono text-[9px] text-sky-600">
                                  ({v.site_shortcut || v.site_details?.site_shortcut || amcContract.site_details?.site_shortcut})
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-slate-600 truncate max-w-[200px]" title={v.description}>
                            {v.description || "Routine Maintenance Visit"}
                          </p>
                        </td>

                        {/* Resolution / Findings */}
                        <td className="py-2 px-3">
                          <p className="text-slate-500 truncate max-w-[180px]" title={v.resolution_notes || v.diagnosis || "—"}>
                            {v.resolution_notes || v.diagnosis || "—"}
                          </p>
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenVisitDetail(v)}
                            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Open Visit Technical Details & History"
                          >
                            <MdOutlineRemoveRedEye size={12} />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Showing {filteredVisits.length} of {visits.length} visits for Cycle #{cycle.cycle_number}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

