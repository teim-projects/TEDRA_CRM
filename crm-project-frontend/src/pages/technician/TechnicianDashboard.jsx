import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  Phone,
  MapPin,
  Wrench,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  FileText,
  MessageSquare,
  Sparkles,
  Layers,
  Activity,
  Search,
  ExternalLink,
  Eye,
  CheckCircle,
  Briefcase,
  User,
  ShieldCheck,
  Navigation,
  Compass,
} from "lucide-react";
import StartVisitModal from "../../components/technician/StartVisitModal";
import CompleteVisitModal from "../../components/technician/CompleteVisitModal";
import AddActivityModal from "../../components/technician/AddActivityModal";
import ServiceDetailView from "../../components/amc/ServiceDetailView";
import { useUserRole } from "../../hooks/useAuth";
import { navigateToLocation, getCurrentCoordinates } from "../../utils/navigation";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const baseApi = getBaseApiUrl();
  const { userInfo } = useUserRole(baseApi);

  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState("");

  // Filters & Search for Today's Work
  const [todayStatusFilter, setTodayStatusFilter] = useState("all"); // 'all' | 'scheduled' | 'in_progress' | 'completed'
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedServiceForStart, setSelectedServiceForStart] = useState(null);
  const [selectedServiceForComplete, setSelectedServiceForComplete] = useState(null);
  const [selectedServiceForNote, setSelectedServiceForNote] = useState(null);
  const [viewingService, setViewingService] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage("");

    const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
    try {
      const res = await fetch(`${baseApi}/technician/dashboard/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch dashboard (Status: ${res.status})`);
      }

      const data = await res.json();
      setDashboardData(data);
      setLastSyncTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    } catch (err) {
      console.error("Technician dashboard error:", err);
      setErrorMessage(err.message || "Failed to load technician dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [baseApi]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Start Journey via Google Maps navigation & log departure GPS milestone
  const handleNavigate = async (srv) => {
    // 1. Immediately launch Google Maps for turn-by-turn driving navigation
    navigateToLocation({
      latitude: srv.latitude,
      longitude: srv.longitude,
      address: srv.service_address || srv.customer_address,
      destinationName: srv.customer_name || srv.equipment || srv.service_number || "Service Site",
    });

    // 2. Concurrently capture departure GPS and log milestone to backend
    try {
      const coords = await getCurrentCoordinates();
      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      await fetch(`${baseApi}/technician/services/${srv.id}/start-journey/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          work_type: srv.work_type,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          accuracy: coords?.accuracy || null,
          notes: "Technician clicked Navigate to start journey.",
        }),
      });
      fetchDashboardData(true);
    } catch (e) {
      console.warn("Could not log journey start:", e);
    }
  };

  // Handle Starting a Visit with arrival photo/GPS modal
  const handleStartVisit = (service, serviceDate, workType) => {
    const rawDate = serviceDate || service?.service_date || service?.visit_date;
    if (rawDate && !isServiceDue(rawDate)) {
      alert(`This visit is scheduled for ${formatDisplayDate(rawDate)}. You can only start the visit when the scheduled date arrives.`);
      return;
    }
    const targetService = typeof service === "object" && service !== null ? service : { id: service, service_date: rawDate, work_type: workType };
    setSelectedServiceForStart(targetService);
  };

  // Greeting calculation
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const technicianName = useMemo(() => {
    if (userInfo?.full_name?.trim()) return userInfo.full_name;
    if (userInfo?.first_name) return `${userInfo.first_name} ${userInfo.last_name || ""}`.trim();
    return "Field Specialist";
  }, [userInfo]);

  const technicianInitials = useMemo(() => {
    const parts = technicianName.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (technicianName[0] || "T").toUpperCase();
  }, [technicianName]);

  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const kpis = dashboardData?.kpis || {
    total_allocated: 0,
    todays_work_count: 0,
    work_desk_count: 0,
    completed_count: 0,
    in_progress_count: 0,
    pending_parts_count: 0,
    high_priority_count: 0,
    completion_rate: 0,
  };

  const todaysWork = dashboardData?.todays_work || [];
  const activeNow = dashboardData?.active_now || [];
  const upcomingWork = dashboardData?.upcoming_work || [];
  const recentCompleted = dashboardData?.recent_completed || [];

  // Filtered Today's Work
  const filteredTodaysWork = useMemo(() => {
    return todaysWork.filter((item) => {
      if (todayStatusFilter !== "all" && item.status !== todayStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = item.service_number?.toLowerCase().includes(q);
        const matchCust = item.customer_name?.toLowerCase().includes(q);
        const matchEquip = item.equipment?.toLowerCase().includes(q);
        const matchAddr = item.customer_address?.toLowerCase().includes(q);
        return matchNum || matchCust || matchEquip || matchAddr;
      }
      return true;
    });
  }, [todaysWork, todayStatusFilter, searchQuery]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-sans antialiased text-slate-800">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-semibold animate-in slide-in-from-bottom duration-200 border border-slate-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HERO PROFILE & SHIFT SUMMARY BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white rounded-2xl p-5 sm:p-6 border border-slate-700/60 shadow-lg relative overflow-hidden">
        {/* Soft background ambient lighting */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Left: Avatar + Greeting & Role */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center font-bold text-xl sm:text-2xl shadow-md shadow-cyan-500/20 ring-4 ring-white/10 shrink-0">
                {technicianInitials}
              </div>
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"
                title="Active on field"
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-medium text-cyan-300">
                  {greeting},
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  On Duty • Field Ready
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {technicianName}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  TEDRA Operations Specialist
                </span>
                <span className="text-slate-500">•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {todayFormatted}
                </span>
                {lastSyncTime && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-[11px] text-slate-400">
                      Synced {lastSyncTime}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
            <Link
              to="/technician/field-map"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Route Map</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer border border-white/10 disabled:opacity-50"
              title="Sync latest work orders"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-300" : ""
                  }`}
              />
              <span>{isRefreshing ? "Syncing..." : "Sync"}</span>
            </button>

            <Link
              to="/technician/work-desk"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/25 cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5 text-slate-950" />
              <span>Go to Work Desk</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
            </Link>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="underline font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ACTIVE NOW LIVE ALERT BANNER (IF ANY SERVICE IS CURRENTLY IN PROGRESS) */}
      {activeNow.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30 animate-pulse">
                <Activity className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white px-2 py-0.5 rounded-full">
                    Active Live Job
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {activeNow[0].service_number} • {activeNow[0].customer_name}
                  </span>
                </div>
                <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="font-semibold text-slate-800">
                    {activeNow[0].equipment || "Water Treatment Plant"}
                  </span>
                  {activeNow[0].customer_address && (
                    <span className="text-slate-500 truncate max-w-sm">
                      📍 {activeNow[0].customer_address}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
              {activeNow[0].customer_phone && (
                <a
                  href={`tel:${activeNow[0].customer_phone}`}
                  className="px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:text-cyan-700 hover:border-cyan-300 border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Call Site</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => handleNavigate(activeNow[0])}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Navigate turn-by-turn route to site via GPS"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Navigate</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingService(activeNow[0])}
                className="px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:text-cyan-700 hover:border-cyan-300 border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Specs</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedServiceForComplete(activeNow[0])}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Complete & Sign</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-CARD KPI METRICS RIBBON */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Today's Work */}
        <div
          onClick={() => {
            setTodayStatusFilter("all");
            const el = document.getElementById("todays-work-schedule");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Due Today
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-colors">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isLoading ? "—" : kpis.todays_work_count}
            </span>
            <span className="text-[9px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded-md border border-cyan-200/60">
              Today
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            Assigned for today
          </p>
        </div>

        {/* Card 2: Work Desk Queue */}
        <div
          onClick={() => navigate("/technician/work-desk")}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Work Desk
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isLoading ? "—" : kpis.work_desk_count}
            </span>
            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60">
              Queue
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            Total active allocated
          </p>
        </div>

        {/* Card 3: In Progress */}
        <div
          onClick={() => {
            setTodayStatusFilter("in_progress");
            const el = document.getElementById("todays-work-schedule");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              In Progress
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isLoading ? "—" : kpis.in_progress_count}
            </span>
            {kpis.in_progress_count > 0 && (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60 animate-pulse">
                Active
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            Currently on-site
          </p>
        </div>

        {/* Card 4: Completed Work */}
        <div
          onClick={() => {
            setTodayStatusFilter("completed");
            const el = document.getElementById("todays-work-schedule");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Completed
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isLoading ? "—" : kpis.completed_count}
            </span>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
              Resolved
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            Finished & signed-off
          </p>
        </div>

        {/* Card 5: Shift Completion Rate */}
        <div className="col-span-2 md:col-span-1 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-teal-400 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/5 rounded-full -mr-6 -mt-6" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Completion Rate
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isLoading ? "—" : `${kpis.completion_rate}%`}
            </span>
          </div>
          {/* Visual Progress Bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.completion_rate))}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Target performance
          </p>
        </div>
      </div>

      {/* TODAY'S WORK MAIN SCHEDULE CARD */}
      <div
        id="todays-work-schedule"
        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
      >
        {/* Card Header with Filters & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-5 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Today's Assigned Schedule
              </h2>
              <p className="text-[11px] text-slate-500">
                Direct field execution queue for {todayFormatted}
              </p>
            </div>
            <span className="ml-1 px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[11px] font-bold">
              {todaysWork.length} jobs
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Today's Sites on Map button */}
            <Link
              to="/technician/field-map"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200/80 transition-all cursor-pointer shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>🗺️ Today's Map</span>
            </Link>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, customer..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 w-44 sm:w-56"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-[11px] font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setTodayStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${todayStatusFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "hover:text-slate-900"
                  }`}
              >
                All ({todaysWork.length})
              </button>
              <button
                type="button"
                onClick={() => setTodayStatusFilter("scheduled")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${todayStatusFilter === "scheduled"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "hover:text-slate-900"
                  }`}
              >
                Scheduled
              </button>
              <button
                type="button"
                onClick={() => setTodayStatusFilter("in_progress")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${todayStatusFilter === "in_progress"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "hover:text-slate-900"
                  }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => setTodayStatusFilter("completed")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${todayStatusFilter === "completed"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "hover:text-slate-900"
                  }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>

        {/* Card Body */}
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            <div className="w-7 h-7 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading assigned tasks...
          </div>
        ) : filteredTodaysWork.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchQuery || todayStatusFilter !== "all"
                ? "No matching service visits found"
                : "All clear for today!"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || todayStatusFilter !== "all"
                ? "Try clearing your search query or switching filters."
                : "No pending service visits scheduled for today. Check your Work Desk for upcoming allocations."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {(searchQuery || todayStatusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setTodayStatusFilter("all");
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
              <Link
                to="/technician/work-desk"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-xl transition-colors border border-cyan-200/60"
              >
                <span>View Full Work Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTodaysWork.map((srv) => {
              const isCompleted = srv.status === "completed";
              const isInProgress = srv.status === "in_progress";

              return (
                <div
                  key={`${srv.work_type || "srv"}-${srv.id}`}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200/60">
                        {srv.service_number}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {srv.service_category_display || (srv.work_type === "amc_visit" ? "AMC Routine Visit" : "Single Service")}
                      </span>

                      {/* Priority Badges */}
                      {srv.priority === "critical" && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          Critical Priority
                        </span>
                      )}
                      {srv.priority === "high" && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          High Priority
                        </span>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md capitalize ${isCompleted
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isInProgress
                              ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                              : "bg-sky-50 text-sky-700 border border-sky-200"
                          }`}
                      >
                        {srv.status_display || (isCompleted ? "Completed" : isInProgress ? "In Progress" : "Scheduled")}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                      {srv.customer_name || "Customer Site"}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1 font-medium">
                        <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700">{srv.equipment || "Water Treatment Plant"}</span>
                        {srv.serial_number && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({srv.serial_number})
                          </span>
                        )}
                      </div>

                      {srv.customer_phone && (
                        <a
                          href={`tel:${srv.customer_phone}`}
                          className="flex items-center gap-1 font-semibold text-cyan-700 hover:text-cyan-800"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{srv.customer_phone}</span>
                        </a>
                      )}

                      {srv.customer_address && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 max-w-sm truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{srv.customer_address}</span>
                        </div>
                      )}
                    </div>

                    {srv.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                        &ldquo;{srv.description}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Right: Operational Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    {/* View Details Eye Button */}
                    <button
                      type="button"
                      onClick={() => setViewingService(srv)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition-all text-xs font-semibold border border-slate-200/80 cursor-pointer shadow-2xs"
                      title="View Service Details & Technical Report"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Navigate Route GPS Button */}
                    <button
                      type="button"
                      onClick={() => handleNavigate(srv)}
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all text-xs font-semibold border border-emerald-200 cursor-pointer shadow-2xs"
                      title="Navigate turn-by-turn route to site via GPS"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                    </button>

                    {/* Start Visit Button - Enabled only when scheduled date arrives */}
                    {!isCompleted && !isInProgress && (() => {
                      const rawDate = srv.service_date || srv.visit_date;
                      const isDue = isServiceDue(rawDate);
                      return (
                        <button
                          type="button"
                          disabled={!isDue}
                          onClick={() => handleStartVisit(srv, rawDate, srv.work_type)}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${isDue
                              ? "bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 active:scale-95 text-white shadow-xs shadow-cyan-600/20 cursor-pointer"
                              : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                            }`}
                          title={
                            isDue
                              ? "Start visit and set status to In Progress"
                              : `Scheduled for ${formatDisplayDate(rawDate)}. Can only be started on or after scheduled date.`
                          }
                        >
                          <Play className={`w-3 h-3 ${isDue ? "fill-white" : "fill-slate-300 text-slate-300"}`} />
                          <span>Start Visit</span>
                        </button>
                      );
                    })()}

                    {/* Complete Visit Button - Enabled only when started (in progress) and date has arrived */}
                    {!isCompleted && (() => {
                      const rawDate = srv.service_date || srv.visit_date;
                      const isDue = isServiceDue(rawDate);
                      const canComplete = isInProgress && isDue;
                      return (
                        <button
                          type="button"
                          disabled={!canComplete}
                          onClick={() => {
                            if (!isDue) {
                              alert(`This visit is scheduled for ${formatDisplayDate(rawDate)}. It cannot be completed before the scheduled date.`);
                              return;
                            }
                            if (!isInProgress) {
                              alert("You must start the visit (set to In Progress) before you can complete it.");
                              return;
                            }
                            setSelectedServiceForComplete(srv);
                          }}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${canComplete
                              ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs shadow-emerald-600/20 cursor-pointer"
                              : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                            }`}
                          title={
                            !isDue
                              ? `Scheduled for ${formatDisplayDate(rawDate)}. Cannot complete before scheduled date.`
                              : !isInProgress
                                ? "Start visit first to enable completion."
                                : "Complete visit, record diagnosis & work done"
                          }
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      );
                    })()}

                    {/* Add Activity Note Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedServiceForNote(srv)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                      title="Add Note or Activity Log"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECONDARY PANELS: UPCOMING ALLOCATIONS & RECENT COMPLETED */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Scheduled Allocations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Upcoming Allocations
              </h3>
            </div>
            <Link
              to="/technician/work-desk"
              className="text-[11px] font-bold text-cyan-700 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {upcomingWork.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No upcoming future allocations in the pipeline.
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingWork.slice(0, 5).map((srv) => (
                <div
                  key={`${srv.work_type || "srv"}-${srv.id}`}
                  className="p-3 bg-slate-50 hover:bg-cyan-50/40 rounded-xl border border-slate-100 hover:border-cyan-200 transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {srv.customer_name || "Customer Site"}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-cyan-700 font-semibold">{srv.service_number}</span>
                      <span>•</span>
                      <span className="truncate">{srv.equipment || "Water System"}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-semibold text-slate-800 block text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {srv.service_date}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 capitalize mt-0.5 block">
                      {srv.priority || "Normal"} priority
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Completed Activities / Sign-offs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Sign-offs & History
              </h3>
            </div>
            <Link
              to="/technician/work-desk?filter=completed"
              className="text-[11px] font-bold text-cyan-700 hover:underline flex items-center gap-1"
            >
              <span>View Completed</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {recentCompleted.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No completed services logged yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentCompleted.slice(0, 5).map((srv) => (
                <div
                  key={`${srv.work_type || "srv"}-${srv.id}`}
                  className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {srv.customer_name || "Customer Site"}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {srv.service_number} • {srv.equipment || "Equipment"}
                    </div>
                    {srv.resolution_notes && (
                      <p className="text-[10px] text-emerald-800 italic line-clamp-1 mt-0.5">
                        &ldquo;{srv.resolution_notes}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Resolved
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {srv.service_date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <StartVisitModal
        service={selectedServiceForStart}
        isOpen={Boolean(selectedServiceForStart)}
        onClose={() => setSelectedServiceForStart(null)}
        onSuccess={() => {
          showToast("Visit started successfully! Status updated to In Progress.");
          fetchDashboardData(true);
        }}
        baseApi={baseApi}
      />

      <CompleteVisitModal
        service={selectedServiceForComplete}
        isOpen={Boolean(selectedServiceForComplete)}
        onClose={() => setSelectedServiceForComplete(null)}
        onSuccess={() => {
          showToast("Service successfully marked as completed!");
          fetchDashboardData(true);
        }}
        baseApi={baseApi}
      />

      <AddActivityModal
        service={selectedServiceForNote}
        isOpen={Boolean(selectedServiceForNote)}
        onClose={() => setSelectedServiceForNote(null)}
        onSuccess={() => {
          showToast("Activity note recorded successfully!");
          fetchDashboardData(true);
        }}
        baseApi={baseApi}
      />

      {/* Service Detail View Modal for Quick In-Place Inspection without URL pollution */}
      {viewingService && (
        <ServiceDetailView
          service={viewingService}
          isOpen={Boolean(viewingService)}
          onClose={() => setViewingService(null)}
          onRefresh={async () => {
            await fetchDashboardData(true);
          }}
          baseApi={baseApi}
        />
      )}
    </div>
  );
}
