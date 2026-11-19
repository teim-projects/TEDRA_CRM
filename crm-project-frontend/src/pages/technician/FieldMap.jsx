import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Base from "../../components/Base";
import {
  MdFilterList,
  MdRefresh,
  MdNavigation,
  MdOutlineRemoveRedEye,
  MdCheckCircle,
  MdPlayArrow,
  MdEngineering,
  MdPerson,
  MdPhone,
  MdLocationOn,
  MdClose,
  MdSearch,
  MdMyLocation,
  MdZoomOutMap,
  MdChevronLeft,
  MdChevronRight,
  MdCalendarToday,
  MdWarning,
  MdRoute,
} from "react-icons/md";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useUserRole } from "../../hooks/useAuth";
import { navigateToLocation, getCurrentCoordinates } from "../../utils/navigation";
import { formatDisplayDate, isServiceDue } from "../../utils/serviceDateUtils";
import LocationPickerModal from "../../components/common/LocationPickerModal";
import StartVisitModal from "../../components/technician/StartVisitModal";
import CompleteVisitModal from "../../components/technician/CompleteVisitModal";
import AddActivityModal from "../../components/technician/AddActivityModal";
import ServiceDetailView from "../../components/amc/ServiceDetailView";
import GeoLocationBadge from "../../components/common/GeoLocationBadge";
import { geocodePincodeOrAddress } from "../../utils/geoUtils";

export default function FieldMap() {
  const navigate = useNavigate();
  const baseApi = import.meta.env.VITE_BASE_API_URL ?? "http://127.0.0.1:8000";
  const { userInfo, userRole } = useUserRole(baseApi);

  const roleName = (userRole?.name || userInfo?.role_name || userInfo?.role?.name || "").toLowerCase();
  const isTechnician = roleName === "technician" || roleName.includes("technician") || Boolean(userInfo?.is_technician);
  const isAdminOrManager = !isTechnician;

  // Format YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // State: Date & Technician filter (Clean internal state without polluting browser URL)
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("all");

  // State: Status filter (all | scheduled | in_progress | completed | missing_pin)
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRoute, setShowRoute] = useState(true);

  // Data
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [mapData, setMapData] = useState({
    date: selectedDate,
    kpis: {
      total_sites: 0,
      pinned_sites: 0,
      missing_pins_count: 0,
      scheduled_count: 0,
      in_progress_count: 0,
      completed_count: 0,
      pending_parts_count: 0,
      active_technicians_count: 0,
    },
    sites: [],
    technicians: [],
    all_technicians: [],
  });

  // Modals & Selected Site
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [siteToPin, setSiteToPin] = useState(null);
  const [serviceForStart, setServiceForStart] = useState(null);
  const [serviceForComplete, setServiceForComplete] = useState(null);
  const [serviceForNote, setServiceForNote] = useState(null);
  const [viewingService, setViewingService] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Map & Leaflet refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const techMarkersGroupRef = useRef(null);
  const connectionLinesGroupRef = useRef(null);
  const polylineRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [geocodedPins, setGeocodedPins] = useState({});

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => setLeafletReady(true);
      script.onerror = () => {
        console.warn("Failed to load Leaflet from CDN");
      };
      document.head.appendChild(script);
    } else {
      const existing = document.getElementById("leaflet-js");
      existing.addEventListener("load", () => setLeafletReady(true));
    }
  }, []);

  // Fetch field map sites strictly for selectedDate
  const fetchFieldMapData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      const params = new URLSearchParams();
      if (selectedDate) params.append("date", selectedDate);
      if (selectedTechnicianId && selectedTechnicianId !== "all") {
        params.append("technician_id", selectedTechnicianId);
      }

      try {
        const res = await fetch(`${baseApi}/technician/field-map/?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to load field dispatch map (Status ${res.status})`);
        }

        const data = await res.json();
        setMapData(data);
      } catch (err) {
        console.error("Error loading field map:", err);
        setError(err.message || "Unable to load sites for map view");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [baseApi, selectedDate, selectedTechnicianId]
  );

  useEffect(() => {
    fetchFieldMapData();
  }, [fetchFieldMapData]);

  // Date Shift helpers
  const shiftDate = (offsetDays) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offsetDays);

    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const nd = String(dateObj.getDate()).padStart(2, "0");
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  const isTodaySelected = selectedDate === getTodayStr();

  // Milestone timestamp formatter
  const formatMilestoneTime = (isoStr) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  };

  // Start Journey via Google Maps navigation & log GPS milestone
  const handleNavigate = async (site) => {
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

    let coords = null;
    try {
      coords = await getCurrentCoordinates().catch(() => null);
      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      await fetch(`${baseApi}/technician/services/${site.id}/start-journey/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          work_type: site.work_type,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          accuracy: coords?.accuracy || null,
          notes: "Technician clicked Navigate to start journey to site.",
        }),
      });
      fetchFieldMapData(true);
    } catch (e) {
      console.warn("Could not log journey start:", e);
    } finally {
      Swal.close();
    }

    // Launch Google Maps navigation in a separate app/tab (keeping CRM website active)
    navigateToLocation({
      latitude: site.latitude,
      longitude: site.longitude,
      address: site.address,
      destinationName: site.customer_name,
    });
  };

  // Auto-resolve missing coordinates using Indian pincode or address geocoding fallback
  useEffect(() => {
    const rawSites = mapData.sites || [];
    const missing = rawSites.filter(
      (s) => (!s.has_coordinates || s.latitude === null || s.longitude === null) && !geocodedPins[s.id]
    );

    if (missing.length === 0) return;

    let isSubscribed = true;
    const resolveMissingPins = async () => {
      const resolvedMap = {};
      for (const site of missing) {
        try {
          const geo = await geocodePincodeOrAddress(site.address, site.pin_code, site.city);
          if (geo && geo.lat && geo.lng) {
            resolvedMap[site.id] = {
              latitude: geo.lat,
              longitude: geo.lng,
              source: geo.source,
            };
          }
        } catch (e) {
          console.debug("Geocode error for site:", site.id, e);
        }
      }

      if (isSubscribed && Object.keys(resolvedMap).length > 0) {
        setGeocodedPins((prev) => ({ ...prev, ...resolvedMap }));
      }
    };

    resolveMissingPins();
    return () => {
      isSubscribed = false;
    };
  }, [mapData.sites, geocodedPins]);

  // Enriched sites incorporating fallback geocoded pins
  const enrichedSites = useMemo(() => {
    const list = mapData.sites || [];
    return list.map((s) => {
      const geo = geocodedPins[s.id];
      if ((!s.has_coordinates || s.latitude === null || s.longitude === null) && geo) {
        return {
          ...s,
          latitude: geo.latitude,
          longitude: geo.longitude,
          has_coordinates: true,
          is_approximate: true,
          approximate_source: geo.source,
        };
      }
      return s;
    });
  }, [mapData.sites, geocodedPins]);

  // Filtered Sites list
  const filteredSites = useMemo(() => {
    let list = enrichedSites;

    if (selectedStatus === "missing_pin") {
      list = list.filter((s) => !s.has_coordinates || s.is_approximate);
    } else if (selectedStatus !== "all") {
      list = list.filter((s) => s.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const num = (s.service_number || "").toLowerCase();
        const cust = (s.customer_name || "").toLowerCase();
        const contact = (s.contact_person || "").toLowerCase();
        const addr = (s.address || "").toLowerCase();
        const eq = (s.equipment || "").toLowerCase();
        const techNames = (s.technicians || []).map((t) => t.name.toLowerCase()).join(" ");
        return (
          num.includes(q) ||
          cust.includes(q) ||
          contact.includes(q) ||
          addr.includes(q) ||
          eq.includes(q) ||
          techNames.includes(q)
        );
      });
    }

    return list;
  }, [enrichedSites, selectedStatus, searchQuery]);

  // Pinned Sites (have valid latitude & longitude)
  const pinnedSites = useMemo(() => {
    return filteredSites.filter(
      (s) =>
        s.has_coordinates &&
        s.latitude !== null &&
        s.longitude !== null &&
        !isNaN(Number(s.latitude)) &&
        !isNaN(Number(s.longitude))
    );
  }, [filteredSites]);

  // Initialize Map
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const L = window.L;
      // Default center: Maharashtra / Pune region
      const defaultCenter = [18.5204, 73.8567];
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      markersGroupRef.current = L.featureGroup().addTo(map);
      connectionLinesGroupRef.current = L.featureGroup().addTo(map);
      techMarkersGroupRef.current = L.featureGroup().addTo(map);
      mapInstanceRef.current = map;
    }
  }, [leafletReady]);

  // Update Markers & Polylines whenever pinnedSites, selectedSiteId, showRoute change
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !markersGroupRef.current) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;

    markersGroup.clearLayers();

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (pinnedSites.length === 0) {
      return;
    }

    const bounds = L.latLngBounds();
    const routeCoords = [];

    pinnedSites.forEach((site, index) => {
      const lat = Number(site.latitude);
      const lng = Number(site.longitude);
      const latLng = [lat, lng];
      bounds.extend(latLng);
      routeCoords.push(latLng);

      const isSelected = selectedSiteId === site.id;

      // Color logic based on status
      let pinColor = "#0284c7"; // Sky Blue for Scheduled
      let pinIconSymbol = `${index + 1}`;
      let statusBadgeClass = "bg-sky-50 text-sky-700 border border-sky-200";
      let statusLabel = "Scheduled";

      if (site.status === "in_progress") {
        pinColor = "#d97706"; // Amber for In Progress
        statusBadgeClass = "bg-amber-50 text-amber-700 border border-amber-200";
        statusLabel = "In Progress";
      } else if (site.status === "completed") {
        pinColor = "#059669"; // Emerald for Completed
        statusBadgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
        statusLabel = "Completed";
      }

      if (site.is_approximate && site.status !== "completed") {
        pinIconSymbol = "📍";
      }

      const pulseHtml =
        site.status === "in_progress"
          ? `<span class="absolute -inset-1 rounded-full bg-amber-400 opacity-75 animate-ping"></span>`
          : "";

      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-200 ${
          isSelected ? "scale-125 z-50" : "hover:scale-110"
        }">
          ${pulseHtml}
          <div style="background-color: ${pinColor};" class="w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-900/10">
            ${
              site.status === "completed"
                ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`
                : pinIconSymbol
            }
          </div>
          <div class="absolute -bottom-1 w-2 h-2 rotate-45 border-r border-b border-white" style="background-color: ${pinColor};"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-field-pin",
        html: iconHtml,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36],
      });

      const marker = L.marker(latLng, { icon: customIcon });

      // Rich popup content matching DS Aqua light design
      const techsHtml = (site.technicians || [])
        .map((t) => `<span class="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px] border border-slate-200">${t.name}</span>`)
        .join(" ");

      const popupContent = `
        <div class="p-2 min-w-[240px] max-w-[280px] font-sans text-slate-800">
          <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
            <span class="font-mono text-xs font-bold text-sky-700">${site.service_number}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusBadgeClass}">${statusLabel}</span>
          </div>
          ${site.is_approximate ? `
            <div class="mb-2 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded font-semibold flex items-center gap-1">
              <span>📍</span>
              <span>Approximate Pin (${site.approximate_source || "Pincode"})</span>
            </div>
          ` : ""}
          <h4 class="font-bold text-slate-900 text-sm leading-snug mb-1">${site.customer_name}</h4>
          ${site.contact_person ? `<p class="text-xs text-slate-600 mb-1 flex items-center gap-1">👤 <span>${site.contact_person}</span> ${site.contact_phone ? `<span class="text-slate-400">(${site.contact_phone})</span>` : ""}</p>` : ""}
          <p class="text-xs text-slate-600 line-clamp-2 mb-2">📍 ${site.address || "Address not specified"}</p>
          ${site.technicians?.length ? `<div class="mb-3"><span class="text-[10px] text-slate-400 font-medium block mb-1">Technicians:</span><div class="flex flex-wrap gap-1">${techsHtml}</div></div>` : ""}
          <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
            <button id="nav-btn-${site.id}" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              Start Journey
            </button>
            <button id="detail-btn-${site.id}" class="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer">
              Details
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300 });

      marker.on("popupopen", () => {
        setSelectedSiteId(site.id);
        const navBtn = document.getElementById(`nav-btn-${site.id}`);
        if (navBtn) {
          navBtn.onclick = () => {
            handleNavigate(site);
          };
        }
        const detailBtn = document.getElementById(`detail-btn-${site.id}`);
        if (detailBtn) {
          detailBtn.onclick = () => {
            setViewingService(site);
          };
        }
      });

      marker.on("click", () => {
        setSelectedSiteId(site.id);
      });

      markersGroup.addLayer(marker);
    });

    // Draw route polyline if enabled
    if (showRoute && routeCoords.length > 1) {
      polylineRef.current = L.polyline(routeCoords, {
        color: "#0284c7",
        weight: 3.5,
        opacity: 0.75,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(map);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [leafletReady, pinnedSites, showRoute, selectedSiteId]);

  // Render Live Technicians Markers and Connection Lines on Leaflet map
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !techMarkersGroupRef.current) return;
    const L = window.L;
    const techGroup = techMarkersGroupRef.current;
    const connGroup = connectionLinesGroupRef.current;

    techGroup.clearLayers();
    if (connGroup) {
      connGroup.clearLayers();
    }

    let liveTechs = mapData.live_technicians || [];
    if (isTechnician) {
      const currentUserId = userInfo?.id || userInfo?.user_id;
      liveTechs = liveTechs.filter((tech) => {
        if (currentUserId && (tech.technician === currentUserId || tech.technician_id === currentUserId || tech.technician?.id === currentUserId)) {
          return true;
        }
        const myName = (userInfo?.name || `${userInfo?.first_name || ""} ${userInfo?.last_name || ""}`).trim().toLowerCase();
        if (myName && tech.technician_name && tech.technician_name.toLowerCase().includes(myName)) {
          return true;
        }
        return false;
      });
    }

    liveTechs.forEach((tech) => {
      if (!tech.latitude || !tech.longitude) return;
      const lat = Number(tech.latitude);
      const lng = Number(tech.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const isEnRoute = tech.status === "en_route";
      const isOnSite = tech.status === "on_site";

      const pinBg = isEnRoute ? "#0284c7" : isOnSite ? "#d97706" : "#059669";
      const pulseColor = isEnRoute ? "bg-sky-400" : isOnSite ? "bg-amber-400" : "bg-emerald-400";
      const iconSymbol = isEnRoute ? "🛵" : isOnSite ? "🔧" : "👤";
      const statusBadge = isEnRoute
        ? "bg-sky-100 text-sky-800 border border-sky-300"
        : isOnSite
        ? "bg-amber-100 text-amber-800 border border-amber-300"
        : "bg-emerald-100 text-emerald-800 border border-emerald-300";

      const displayName = isTechnician ? "My Location" : (tech.technician_name?.split(" ")[0] || "Technician");

      const techIconHtml = `
        <div class="relative flex flex-col items-center cursor-pointer group">
          <span class="absolute -top-1 -left-1 w-8 h-8 rounded-full ${pulseColor} opacity-75 animate-ping"></span>
          <div style="background-color: ${pinBg};" class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-900/15">
            ${iconSymbol}
          </div>
          <div class="mt-0.5 px-1.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold rounded shadow-xs whitespace-nowrap">
            ${displayName}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-live-tech-pin",
        html: techIconHtml,
        iconSize: [40, 48],
        iconAnchor: [20, 24],
        popupAnchor: [0, -24],
      });

      const updatedTimeStr = tech.updated_at
        ? new Date(tech.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

      const popupTitle = isTechnician
        ? `${tech.technician_name || "My Location"} (Your Live Location)`
        : tech.technician_name;

      const popupHtml = `
        <div class="p-2 min-w-[210px] font-sans text-slate-800">
          <div class="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100">
            <span class="font-bold text-xs text-slate-900">${popupTitle}</span>
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusBadge}">${tech.status?.replace("_", " ")}</span>
          </div>
          ${tech.technician_phone ? `<p class="text-xs text-slate-600 mb-1">📞 <strong>${tech.technician_phone}</strong></p>` : ""}
          <p class="text-[10px] text-slate-500 mb-1">Last activity: <strong>${tech.last_action?.replace("_", " ") || "Active"}</strong> ${updatedTimeStr ? `at ${updatedTimeStr}` : ""}</p>
          ${tech.accuracy ? `<p class="text-[9px] text-slate-400">GPS Accuracy: ±${Math.round(tech.accuracy)}m</p>` : ""}
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(popupHtml);
      techGroup.addLayer(marker);
    });

    // Draw connection lines from active technician to their incomplete assigned services
    if (connGroup) {
      pinnedSites.forEach((site) => {
        if (site.status === "completed" || site.status === "cancelled") return;

        const siteLat = Number(site.latitude);
        const siteLng = Number(site.longitude);
        if (isNaN(siteLat) || isNaN(siteLng)) return;

        const assignedIds = [
          ...(site.technicians || []).map((t) => t.id),
          site.service_engineer?.id,
        ].filter(Boolean);

        const assignedTech = liveTechs.find((t) => {
          const techId = t.technician || t.technician_id || t.technician?.id;
          return assignedIds.includes(techId);
        });

        if (assignedTech && assignedTech.latitude && assignedTech.longitude) {
          const tLat = Number(assignedTech.latitude);
          const tLng = Number(assignedTech.longitude);
          if (isNaN(tLat) || isNaN(tLng)) return;

          const isSiteInProgress = site.status === "in_progress";
          const lineColor = isSiteInProgress ? "#d97706" : "#0284c7";

          const line = L.polyline([[tLat, tLng], [siteLat, siteLng]], {
            color: lineColor,
            weight: 3,
            opacity: 0.85,
            dashArray: "6, 8",
            lineCap: "round",
          });

          line.bindTooltip(
            `<div class="p-1 font-sans text-xs">
              <div class="font-bold text-slate-900">🛵 ${assignedTech.technician_name}</div>
              <div class="text-sky-700 font-semibold">${site.service_number} - ${site.customer_name}</div>
              <div class="text-[10px] text-slate-500">Status: ${site.status_display || site.status}</div>
            </div>`,
            { sticky: true }
          );

          connGroup.addLayer(line);
        }
      });
    }
  }, [leafletReady, mapData.live_technicians, pinnedSites, isTechnician, userInfo]);

  // Focus site on map
  const handleFocusSiteOnMap = (site) => {
    setSelectedSiteId(site.id);
    if (!site.has_coordinates || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.flyTo([Number(site.latitude), Number(site.longitude)], 15, {
      duration: 1.2,
    });

    // Open popup
    if (markersGroupRef.current) {
      markersGroupRef.current.eachLayer((layer) => {
        const latLng = layer.getLatLng();
        if (
          Math.abs(latLng.lat - Number(site.latitude)) < 0.0001 &&
          Math.abs(latLng.lng - Number(site.longitude)) < 0.0001
        ) {
          layer.openPopup();
        }
      });
    }
  };

  // Request Technician's live GPS location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (mapInstanceRef.current && window.L) {
          const L = window.L;
          const map = mapInstanceRef.current;

          if (userMarkerRef.current) {
            map.removeLayer(userMarkerRef.current);
          }

          const userHtml = `
            <div class="relative flex items-center justify-center">
              <span class="absolute w-8 h-8 rounded-full bg-sky-500 opacity-40 animate-ping"></span>
              <div class="w-6 h-6 rounded-full bg-sky-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
                📍
              </div>
            </div>
          `;
          const userIcon = L.divIcon({
            className: "user-gps-pin",
            html: userHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          userMarkerRef.current = L.marker([lat, lng], { icon: userIcon })
            .addTo(map)
            .bindPopup(`<div class="p-1 font-sans text-xs font-bold text-slate-800">Your Current Location</div>`)
            .openPopup();

          map.flyTo([lat, lng], 14, { duration: 1.2 });
        }
      },
      (err) => {
        setLocatingUser(false);
        alert(`Could not get current location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Start Site Visit (opens StartVisitModal for photo/camera check-in)
  const handleStartVisit = (site) => {
    const today = getTodayStr();
    if (site.service_date && site.service_date > today) {
      alert(`This visit is scheduled for ${formatDisplayDate(site.service_date)}. It can only be started on or after the scheduled date.`);
      return;
    }
    setServiceForStart(site);
  };

  // Handle saving new/updated coordinates from LocationPickerModal
  const handleSavePinLocation = async (locData) => {
    if (!siteToPin) return;

    const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
    try {
      const res = await fetch(`${baseApi}/technician/field-map/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: siteToPin.id,
          work_type: siteToPin.work_type,
          latitude: locData.latitude,
          longitude: locData.longitude,
          location_url: locData.location_url,
          address: locData.address,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save site GPS coordinates");
      }

      showToast(`GPS location pinned for ${siteToPin.customer_name}!`);
      setSiteToPin(null);
      fetchFieldMapData(true);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-400 text-sm font-semibold animate-bounce">
            <FaCheckCircle className="w-4 h-4 text-white" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* HEADER BLOCK WITH SKY VERTICAL ACCENT LINE (Exact match to other pages) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                  Field Route Map
                </h1>
                <span className="bg-sky-50 border border-sky-200 text-sky-700 text-[11px] px-2 py-0.5 rounded-full font-bold">
                  {formatDisplayDate(selectedDate)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Synchronizing daily field sites..."
                  : `${mapData.sites.length} customer site visits scheduled strictly for this date`}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Quick Shift buttons */}
            <div className="inline-flex items-center bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs">
              <button
                onClick={() => shiftDate(-1)}
                className="p-1 hover:bg-slate-100 text-slate-600 rounded cursor-pointer transition"
                title="Previous Day"
              >
                <MdChevronLeft className="text-lg" />
              </button>

              <button
                onClick={() => setSelectedDate(getTodayStr())}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition ${
                  isTodaySelected
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Today
              </button>

              <button
                onClick={() => shiftDate(1)}
                className="p-1 hover:bg-slate-100 text-slate-600 rounded cursor-pointer transition"
                title="Next Day"
              >
                <MdChevronRight className="text-lg" />
              </button>
            </div>

            {/* Date Input */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            {/* Technician Selector for Admin */}
            {isAdminOrManager && (
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                <option value="all">All Technicians ({mapData.all_technicians?.length || 0})</option>
                {(mapData.all_technicians || []).map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} {tech.count_for_day ? `(${tech.count_for_day} sites)` : ""}
                  </option>
                ))}
              </select>
            )}

            {/* Switch to Work Desk */}
            <button
              onClick={() => navigate("/technician/work-desk")}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <MdEngineering className="text-slate-500 text-sm" />
              <span>Work Desk</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchFieldMapData(false)}
              disabled={loading || refreshing}
              className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-sky-600 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Refresh Map"
            >
              <MdRefresh className={`text-base ${refreshing || loading ? "animate-spin text-sky-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* STATS / KPI ROW (Matches WorkDesk & Technicians design) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Total Sites */}
          <div
            onClick={() => setSelectedStatus("all")}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              selectedStatus === "all"
                ? "border-sky-500 ring-2 ring-sky-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Total Sites</span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {mapData.kpis.total_sites} Sites
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              {formatDisplayDate(selectedDate)}
            </span>
          </div>

          {/* Card 2: Scheduled */}
          <div
            onClick={() => setSelectedStatus("scheduled")}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              selectedStatus === "scheduled"
                ? "border-sky-500 ring-2 ring-sky-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-sky-600 font-medium block uppercase tracking-wider">Scheduled</span>
            <span className="text-xs sm:text-[13px] font-bold text-sky-700 block mt-0.5">
              {mapData.kpis.scheduled_count} Sites
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">Ready for dispatch</span>
          </div>

          {/* Card 3: In Progress */}
          <div
            onClick={() => setSelectedStatus("in_progress")}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              selectedStatus === "in_progress"
                ? "border-amber-500 ring-2 ring-amber-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-amber-600 font-medium block uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              In Progress
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-amber-700 block mt-0.5">
              {mapData.kpis.in_progress_count} Active
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">Technicians on-site</span>
          </div>

          {/* Card 4: Completed */}
          <div
            onClick={() => setSelectedStatus("completed")}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              selectedStatus === "completed"
                ? "border-emerald-500 ring-2 ring-emerald-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-emerald-600 font-medium block uppercase tracking-wider">Completed</span>
            <span className="text-xs sm:text-[13px] font-bold text-emerald-700 block mt-0.5">
              {mapData.kpis.completed_count} Finished
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">Signed-off visits</span>
          </div>

          {/* Card 5: GPS Pinned */}
          <div
            onClick={() => {
              if (mapData.kpis.missing_pins_count > 0) {
                setSelectedStatus("missing_pin");
              } else {
                setSelectedStatus("all");
              }
            }}
            className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              selectedStatus === "missing_pin"
                ? "border-rose-500 ring-2 ring-rose-100 shadow-sm"
                : "border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-500 font-medium block uppercase tracking-wider flex items-center gap-1">
              <MdLocationOn className="text-emerald-600 text-xs" />
              GPS Coordinates
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xs sm:text-[13px] font-bold text-slate-900">
                {mapData.kpis.pinned_sites}/{mapData.kpis.total_sites} Pinned
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              {mapData.kpis.missing_pins_count > 0 ? (
                <span className="text-amber-600 font-semibold">{mapData.kpis.missing_pins_count} Missing Pin (Click)</span>
              ) : (
                <span className="text-emerald-600 font-medium">100% Locations Pinned</span>
              )}
            </span>
          </div>
        </div>

        {/* MAIN SPLIT CARD: Left Site List & Right Interactive Map */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col lg:flex-row h-[720px] min-h-[580px]">
          {/* Left Panel: Site Cards List */}
          <div className="w-full lg:w-[420px] border-r border-slate-200/80 bg-slate-50/50 flex flex-col shrink-0 overflow-hidden">
            {/* Search & Status Filters */}
            <div className="p-3 bg-white border-b border-slate-200/80 space-y-2 shrink-0">
              <div className="relative">
                <MdSearch className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer, site, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-7 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
                <button
                  onClick={() => setSelectedStatus("all")}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedStatus === "all"
                      ? "bg-slate-800 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All ({mapData.sites.length})
                </button>
                <button
                  onClick={() => setSelectedStatus("scheduled")}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedStatus === "scheduled"
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "text-sky-700 bg-sky-50 hover:bg-sky-100"
                  }`}
                >
                  Scheduled ({mapData.kpis.scheduled_count})
                </button>
                <button
                  onClick={() => setSelectedStatus("in_progress")}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedStatus === "in_progress"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-amber-700 bg-amber-50 hover:bg-amber-100"
                  }`}
                >
                  Active ({mapData.kpis.in_progress_count})
                </button>
                <button
                  onClick={() => setSelectedStatus("completed")}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedStatus === "completed"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  }`}
                >
                  Done ({mapData.kpis.completed_count})
                </button>
                {mapData.kpis.missing_pins_count > 0 && (
                  <button
                    onClick={() => setSelectedStatus("missing_pin")}
                    className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                      selectedStatus === "missing_pin"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "text-rose-700 bg-rose-50 hover:bg-rose-100"
                    }`}
                  >
                    <MdWarning className="text-xs" />
                    No Pin ({mapData.kpis.missing_pins_count})
                  </button>
                )}
              </div>
            </div>

            {/* Site Cards List (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                  <MdRefresh className="w-7 h-7 animate-spin text-sky-600" />
                  <p className="text-xs">Loading scheduled visits...</p>
                </div>
              ) : filteredSites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                    <MdCalendarToday className="text-2xl" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">No Scheduled Visits</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                    No customer site visits or services are scheduled on {formatDisplayDate(selectedDate)}.
                  </p>
                  {!isTodaySelected && (
                    <button
                      onClick={() => setSelectedDate(getTodayStr())}
                      className="mt-4 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
                    >
                      Go to Today's Work
                    </button>
                  )}
                </div>
              ) : (
                filteredSites.map((site, index) => {
                  const isSelected = selectedSiteId === site.id;
                  const isCompleted = site.status === "completed";
                  const isInProgress = site.status === "in_progress";

                  return (
                    <div
                      key={`${site.work_type}-${site.id}`}
                      onClick={() => handleFocusSiteOnMap(site)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative bg-white ${
                        isSelected
                          ? "border-sky-500 ring-2 ring-sky-100 shadow-md bg-sky-50/20"
                          : "border-slate-200/80 hover:border-sky-300 hover:shadow-xs"
                      }`}
                    >
                      {/* Header: Sequence, ID, Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center border border-slate-200">
                            {index + 1}
                          </span>
                          <span className="font-mono text-xs font-bold text-sky-700">
                            {site.service_number}
                          </span>
                          {site.priority && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                site.priority === "critical"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : site.priority === "high"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {site.priority_display || site.priority}
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isInProgress
                              ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                              : "bg-sky-50 text-sky-700 border border-sky-200"
                          }`}
                        >
                          {site.status_display || site.status}
                        </span>
                      </div>

                      {/* Customer Name */}
                      <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1 mb-1">
                        {site.customer_name}
                      </h3>

                      {/* Contact Person & Phone */}
                      {site.contact_person && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5 mb-1">
                          <MdPerson className="text-slate-400 text-sm shrink-0" />
                          <span>{site.contact_person}</span>
                          {site.contact_phone && (
                            <a
                              href={`tel:${site.contact_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sky-600 hover:underline flex items-center gap-0.5 ml-1 font-semibold"
                            >
                              <MdPhone className="text-xs" />
                              {site.contact_phone}
                            </a>
                          )}
                        </p>
                      )}

                      {/* Site Address */}
                      <p className="text-xs text-slate-600 line-clamp-2 mb-2 flex items-start gap-1">
                        <MdLocationOn className="text-slate-400 text-sm shrink-0 mt-0.5" />
                        <span>{site.address || "No site address registered"}</span>
                      </p>

                      {/* Assigned Technicians */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                        <span className="text-[10px] text-slate-400 font-medium">Technicians:</span>
                        {site.technicians && site.technicians.length > 0 ? (
                          site.technicians.map((t) => (
                            <span
                              key={t.id}
                              className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200"
                            >
                              {t.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-amber-600 font-semibold italic">Unassigned</span>
                        )}
                      </div>

                      {/* GPS status chip & Card Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        {site.is_approximate ? (
                          <div className="flex items-center gap-1 text-amber-800 text-[11px] font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <MdLocationOn className="text-xs text-amber-600" />
                            <span>Approx ({site.approximate_source})</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSiteToPin(site);
                              }}
                              className="ml-1 text-sky-700 hover:text-sky-800 underline font-bold cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        ) : site.has_coordinates ? (
                          <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <MdLocationOn className="text-xs text-emerald-600" />
                            <span>GPS Pinned ({Number(site.latitude).toFixed(3)}, {Number(site.longitude).toFixed(3)})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-700 text-[11px] font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <FaExclamationTriangle className="text-[10px] text-amber-600" />
                            <span>No GPS Pin</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSiteToPin(site);
                              }}
                              className="ml-1 text-sky-700 hover:text-sky-800 underline font-bold cursor-pointer"
                            >
                              + Pin Now
                            </button>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Navigate / Start Journey Button */}
                          <button
                            onClick={() => handleNavigate(site)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition cursor-pointer"
                            title="Start Driving Navigation via Google Maps"
                          >
                            <MdNavigation className="text-sm" />
                            <span>Navigate</span>
                          </button>

                          {/* View Task Details */}
                          <button
                            onClick={() => setViewingService(site)}
                            className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all text-sm shadow-2xs cursor-pointer"
                            title="View Service Details & Report"
                          >
                            <MdOutlineRemoveRedEye />
                          </button>

                          {/* Start Visit Button */}
                          {site.status === "scheduled" && (
                            <button
                              onClick={() => handleStartVisit(site)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Start Site Visit"
                            >
                              <MdPlayArrow className="text-sm" />
                              <span>Start</span>
                            </button>
                          )}

                          {/* Complete Visit Button */}
                          {site.status === "in_progress" && (
                            <button
                              onClick={() => setServiceForComplete(site)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Complete Site Visit"
                            >
                              <MdCheckCircle className="text-sm" />
                              <span>Complete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Milestone Progress Audit Box (Departed, Arrived, Completed) */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-[10px]">
                        {/* Departed */}
                        <div
                          className={`p-1.5 rounded-lg border ${
                            site.milestones?.journey_started_at
                              ? "bg-sky-50/80 border-sky-200 text-sky-800"
                              : "bg-slate-50 border-slate-100 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            <span>🚗</span>
                            <span>Departed</span>
                          </div>
                          <div className="mt-0.5 text-[11px] font-bold">
                            {formatMilestoneTime(site.milestones?.journey_started_at) || "--:--"}
                          </div>
                          {site.milestones?.journey_lat ? (
                            <div className="mt-1">
                              <GeoLocationBadge
                                latitude={site.milestones.journey_lat}
                                longitude={site.milestones.journey_lng}
                                compact={true}
                                showMapsLink={true}
                              />
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 block mt-0.5">Pending</span>
                          )}
                        </div>

                        {/* Arrived */}
                        <div
                          className={`p-1.5 rounded-lg border ${
                            site.milestones?.visit_started_at
                              ? "bg-amber-50/80 border-amber-200 text-amber-800"
                              : "bg-slate-50 border-slate-100 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            <span>📍</span>
                            <span>Arrived</span>
                          </div>
                          <div className="mt-0.5 text-[11px] font-bold">
                            {formatMilestoneTime(site.milestones?.visit_started_at) || "--:--"}
                          </div>
                          {site.milestones?.visit_lat ? (
                            <div className="mt-1">
                              <GeoLocationBadge
                                latitude={site.milestones.visit_lat}
                                longitude={site.milestones.visit_lng}
                                compact={true}
                                showMapsLink={true}
                              />
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 block mt-0.5">Pending</span>
                          )}
                        </div>

                        {/* Completed */}
                        <div
                          className={`p-1.5 rounded-lg border ${
                            site.milestones?.job_completed_at
                              ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                              : "bg-slate-50 border-slate-100 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            <span>✅</span>
                            <span>Completed</span>
                          </div>
                          <div className="mt-0.5 text-[11px] font-bold">
                            {formatMilestoneTime(site.milestones?.job_completed_at) || "--:--"}
                          </div>
                          {site.milestones?.job_completed_lat ? (
                            <div className="mt-1">
                              <GeoLocationBadge
                                latitude={site.milestones.job_completed_lat}
                                longitude={site.milestones.job_completed_lng}
                                compact={true}
                                showMapsLink={true}
                              />
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 block mt-0.5">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Interactive Leaflet Map */}
          <div className="flex-1 h-full relative overflow-hidden bg-slate-100">
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Floating Map Controls overlay */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              {/* Locate Me */}
              <button
                onClick={handleLocateMe}
                disabled={locatingUser}
                className="px-3 py-2 bg-white/95 hover:bg-white text-slate-700 hover:text-sky-700 rounded-xl shadow-md border border-slate-200 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer backdrop-blur-sm"
                title="Show My Live Location"
              >
                <MdMyLocation className={`text-base text-sky-600 ${locatingUser ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">My Location</span>
              </button>

              {/* Toggle Route Polyline */}
              <button
                onClick={() => setShowRoute((prev) => !prev)}
                className={`px-3 py-2 rounded-xl shadow-md border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer backdrop-blur-sm ${
                  showRoute
                    ? "bg-sky-600 text-white border-sky-500 shadow-sky-500/20"
                    : "bg-white/95 text-slate-700 border-slate-200 hover:bg-white"
                }`}
                title="Toggle Route Sequence Polyline"
              >
                <MdRoute className="text-base" />
                <span className="hidden sm:inline">{showRoute ? "Hide Route" : "Show Route"}</span>
              </button>

              {/* Fit all sites */}
              {pinnedSites.length > 0 && (
                <button
                  onClick={() => {
                    if (mapInstanceRef.current && window.L) {
                      const bounds = window.L.latLngBounds();
                      pinnedSites.forEach((s) => bounds.extend([Number(s.latitude), Number(s.longitude)]));
                      if (bounds.isValid()) {
                        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                      }
                    }
                  }}
                  className="px-3 py-2 bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-700 rounded-xl shadow-md border border-slate-200 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer backdrop-blur-sm"
                  title="Fit All Sites in View"
                >
                  <MdZoomOutMap className="text-base text-emerald-600" />
                  <span className="hidden sm:inline">Fit All Sites</span>
                </button>
              )}
            </div>

            {/* Floating Map Legend bottom-left */}
            <div className="absolute bottom-6 left-4 z-10 bg-white/95 border border-slate-200 p-2.5 rounded-xl shadow-lg backdrop-blur-sm text-xs space-y-1.5 hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Map Pins Legend
              </span>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-sky-600 border border-white shadow-2xs"></span>
                <span>Scheduled Site</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-2xs animate-pulse"></span>
                <span>In Progress Site</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white shadow-2xs"></span>
                <span>Completed Site</span>
              </div>
            </div>
          </div>
        </div>

        {/* MODALS */}
        {/* 1. Location Picker Modal for Pinned Site */}
        {siteToPin && (
          <LocationPickerModal
            isOpen={Boolean(siteToPin)}
            title={`Pin Site Location: ${siteToPin.customer_name}`}
            initialLat={siteToPin.latitude}
            initialLng={siteToPin.longitude}
            initialAddress={siteToPin.address}
            onClose={() => setSiteToPin(null)}
            onSelectLocation={handleSavePinLocation}
          />
        )}

        {/* 1. Start Visit Modal */}
        {serviceForStart && (
          <StartVisitModal
            service={serviceForStart}
            isOpen={Boolean(serviceForStart)}
            baseApi={baseApi}
            onClose={() => setServiceForStart(null)}
            onSuccess={() => {
              setServiceForStart(null);
              showToast("Visit started successfully! Status updated to In Progress.");
              fetchFieldMapData(true);
            }}
          />
        )}

        {/* 2. Complete Visit Modal */}
        {serviceForComplete && (
          <CompleteVisitModal
            service={serviceForComplete}
            isOpen={Boolean(serviceForComplete)}
            baseApi={baseApi}
            onClose={() => setServiceForComplete(null)}
            onSuccess={() => {
              setServiceForComplete(null);
              showToast("Visit completed successfully!");
              fetchFieldMapData(true);
            }}
          />
        )}

        {/* 3. Add Activity Modal */}
        {serviceForNote && (
          <AddActivityModal
            service={serviceForNote}
            isOpen={Boolean(serviceForNote)}
            baseApi={baseApi}
            onClose={() => setServiceForNote(null)}
            onSuccess={() => {
              setServiceForNote(null);
              showToast("Note added successfully!");
              fetchFieldMapData(true);
            }}
          />
        )}

        {/* 4. Complete Service Detail View Modal */}
        {viewingService && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col text-slate-900 border border-slate-200">
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <MdEngineering className="w-5 h-5 text-sky-400" />
                  <span className="font-bold text-sm">Site Task Details: {viewingService.service_number}</span>
                </div>
                <button
                  onClick={() => setViewingService(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <MdClose className="text-lg" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ServiceDetailView
                  service={viewingService}
                  onBack={() => setViewingService(null)}
                  onRefresh={() => fetchFieldMapData(true)}
                  baseApi={baseApi}
                  token={localStorage.getItem("access") || ""}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Base>
  );
}
