import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin,
  Search,
  Crosshair,
  X,
  Check,
  ExternalLink,
  Navigation,
  Loader2,
  AlertCircle,
  Compass,
  Mail,
  Store,
  Building,
  ChevronRight,
} from "lucide-react";

export default function LocationPickerModal({
  isOpen,
  open,
  onClose,
  initialLat = null,
  initialLng = null,
  initialAddress = "",
  initialLandmark = "",
  initialPincode = "",
  onSelectLocation,
  title = "Pin Exact Site Location",
}) {
  const isModalOpen = Boolean(isOpen || open);

  const [coords, setCoords] = useState({
    lat: initialLat ? Number(initialLat) : 19.076, // Default Maharashtra / Mumbai
    lng: initialLng ? Number(initialLng) : 72.8777,
  });
  const [hasPinned, setHasPinned] = useState(
    Boolean(initialLat && initialLng && !isNaN(Number(initialLat)) && !isNaN(Number(initialLng)))
  );

  const [address, setAddress] = useState(initialAddress || "");
  const [landmark, setLandmark] = useState(initialLandmark || "");
  const [pincode, setPincode] = useState(initialPincode || "");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Close search suggestions when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Helper to extract 6-digit Indian pincode from address details or display name
  const extractPincode = (addressObj, displayName = "") => {
    if (addressObj?.postcode && /^\d{6}$/.test(String(addressObj.postcode).trim())) {
      return String(addressObj.postcode).trim();
    }
    const match = String(displayName).match(/\b([1-9][0-9]{5})\b/);
    if (match) return match[1];
    if (addressObj?.postcode) return String(addressObj.postcode).trim();
    return "";
  };

  // Helper to extract landmark / area from address details
  const extractLandmark = (addressObj, displayName = "") => {
    if (!addressObj) return "";
    const candidate =
      addressObj.landmark ||
      addressObj.amenity ||
      addressObj.shop ||
      addressObj.building ||
      addressObj.commercial ||
      addressObj.industrial ||
      addressObj.neighbourhood ||
      addressObj.suburb ||
      addressObj.road ||
      "";
    return String(candidate).trim();
  };

  // Clean messy administrative tokens (e.g. "K/E Ward", "Zone 3", "Suburban") from query or address
  const cleanAdministrativeNoise = (raw) => {
    if (!raw) return "";
    let q = String(raw).trim();
    q = q.replace(/^Landmark:\s*/i, "").replace(/,\s*Landmark:\s*/gi, ", ");
    q = q.replace(/,\s*India\s*$/i, "");
    q = q.replace(/\b[A-Za-z0-9\/-]+\s+Ward\b/gi, "");
    q = q.replace(/\bWard\s+[A-Za-z0-9\/-]+\b/gi, "");
    q = q.replace(/\bZone\s+\d+\b/gi, "");
    q = q.replace(/\b[A-Za-z0-9\/-]+\s+Zone\b/gi, "");
    q = q.replace(/\bSuburban\b/gi, "");
    q = q.replace(/,\s*,+/g, ", ");
    q = q.replace(/\s+/g, " ").trim();
    return q;
  };

  // Construct a clean, natural address from reverse-geocode data
  const buildCleanAddress = (addrObj, rawDisplayName = "") => {
    if (!addrObj) return cleanAdministrativeNoise(rawDisplayName) || "";

    const poi =
      addrObj.shop ||
      addrObj.amenity ||
      addrObj.building ||
      addrObj.commercial ||
      addrObj.industrial ||
      addrObj.office ||
      null;

    const houseNo = addrObj.house_number ? `No. ${addrObj.house_number}` : null;
    const road = addrObj.road || null;
    const area = addrObj.suburb || addrObj.neighbourhood || addrObj.district || null;
    const c = addrObj.city || addrObj.town || addrObj.village || addrObj.county || null;
    const s = addrObj.state || null;
    const pin = extractPincode(addrObj, rawDisplayName);

    const parts = [poi, houseNo, road, area, c, s, pin].filter(Boolean);

    if (parts.length >= 3) {
      return parts.join(", ");
    }
    return cleanAdministrativeNoise(rawDisplayName) || rawDisplayName;
  };

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isModalOpen) {
      if (initialLat && initialLng && !isNaN(Number(initialLat)) && !isNaN(Number(initialLng))) {
        setCoords({ lat: Number(initialLat), lng: Number(initialLng) });
        setHasPinned(true);
      } else {
        setHasPinned(false);
      }

      setAddress(initialAddress || "");

      if (initialLandmark) {
        setLandmark(initialLandmark);
      } else if (initialAddress && initialAddress.includes("Landmark:")) {
        const parts = initialAddress.split("Landmark:");
        if (parts[1]) setLandmark(parts[1].split(",")[0].split("-")[0].trim());
      } else {
        setLandmark("");
      }

      if (initialPincode) {
        setPincode(initialPincode);
      } else if (initialAddress) {
        const m = initialAddress.match(/\b([1-9][0-9]{5})\b/);
        if (m) setPincode(m[1]);
        else setPincode("");
      } else {
        setPincode("");
      }

      setSearchQuery("");
      setSearchResults([]);
      setErrorMessage("");
    }
  }, [isModalOpen, initialLat, initialLng, initialAddress, initialLandmark, initialPincode]);

  // Dynamically load Leaflet library if not already in document
  useEffect(() => {
    if (!isModalOpen) return;

    if (window.L) {
      setLeafletLoaded(true);
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
      script.onload = () => setLeafletLoaded(true);
      script.onerror = () => {
        console.warn("Could not load Leaflet CDN, using fallback location mode.");
        setLeafletLoaded(false);
      };
      document.head.appendChild(script);
    } else {
      const existingScript = document.getElementById("leaflet-js");
      existingScript.addEventListener("load", () => setLeafletLoaded(true));
    }
  }, [isModalOpen]);

  // Reverse geocode latitude and longitude to get clean formatted address, landmark, and pincode
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      setIsGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const addrObj = data.address || {};
          const disp = data.display_name || "";
          const cleanAddr = buildCleanAddress(addrObj, disp);
          if (cleanAddr) setAddress(cleanAddr);

          const pin = extractPincode(addrObj, disp);
          if (pin) setPincode(pin);

          const lmk = extractLandmark(addrObj, disp);
          if (lmk) setLandmark(lmk);

          setCity(addrObj.city || addrObj.town || addrObj.village || "");
          setStateName(addrObj.state || "");
        }
      }
    } catch (e) {
      console.warn("Reverse geocode error:", e);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Update or move marker to new position
  const updateMarkerPosition = useCallback(
    (lat, lng, shouldReverseGeocode = true) => {
      const parsedLat = Number(lat);
      const parsedLng = Number(lng);
      if (isNaN(parsedLat) || isNaN(parsedLng)) return;

      setCoords({ lat: parsedLat, lng: parsedLng });
      setHasPinned(true);

      if (mapInstanceRef.current && window.L) {
        mapInstanceRef.current.panTo([parsedLat, parsedLng]);

        if (markerInstanceRef.current) {
          markerInstanceRef.current.setLatLng([parsedLat, parsedLng]);
        } else {
          const customIcon = window.L.divIcon({
            className: "custom-leaflet-pin",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab;">
                <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #0284c7, #0f766e); border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
                  <div style="width: 12px; height: 12px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
                </div>
                <div style="width: 10px; height: 4px; background: rgba(0,0,0,0.35); border-radius: 50%; margin-top: -2px;"></div>
              </div>
            `,
            iconSize: [38, 44],
            iconAnchor: [19, 42],
          });

          markerInstanceRef.current = window.L.marker([parsedLat, parsedLng], {
            draggable: true,
            icon: customIcon,
          }).addTo(mapInstanceRef.current);

          markerInstanceRef.current.on("dragend", (event) => {
            const pos = event.target.getLatLng();
            updateMarkerPosition(pos.lat, pos.lng, true);
          });
        }
      }

      if (shouldReverseGeocode) {
        reverseGeocode(parsedLat, parsedLng);
      }
    },
    [reverseGeocode]
  );

  // Initialize Leaflet map
  useEffect(() => {
    if (!isModalOpen || !leafletLoaded || !mapContainerRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: hasPinned ? 16 : 12,
        zoomControl: true,
      });

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e) => {
        updateMarkerPosition(e.latlng.lat, e.latlng.lng, true);
      });

      mapInstanceRef.current = map;

      if (hasPinned) {
        updateMarkerPosition(coords.lat, coords.lng, false);
      }
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      if (!isModalOpen && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, [isModalOpen, leafletLoaded, hasPinned, updateMarkerPosition]);

  // Clean up map when modal closes
  useEffect(() => {
    if (!isModalOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    }
  }, [isModalOpen]);

  // Unified Search Engine: Photon (for Shops, Buildings, POIs with location bias) + Nominatim
  const executeSearch = useCallback(
    async (queryText) => {
      const q = queryText.trim();
      if (!q || q.length < 2) return [];

      const cleaned = cleanAdministrativeNoise(q);
      const combinedResults = [];
      const seenKeys = new Set();

      // 1. Photon Search (Extremely good at shops, buildings, POIs, businesses, tolerant of typos)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          cleaned
        )}&limit=8&lat=${coords.lat}&lon=${coords.lng}`;
        const pRes = await fetch(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData?.features && Array.isArray(pData.features)) {
            pData.features.forEach((feat) => {
              const p = feat.properties || {};
              const [lng, lat] = feat.geometry?.coordinates || [];
              if (lat && lng) {
                const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);

                  const name = p.name || p.street || p.district || p.city || "Location";
                  const district = p.district || p.suburb || p.locality || p.neighbourhood || "";
                  const c = p.city || "";
                  const s = p.state || "";
                  const pin = p.postcode || "";

                  // Construct human-friendly locality line: e.g. "Andheri East, Mumbai · 400069"
                  const localityParts = [district, c, s].filter(Boolean);
                  const localityLine = localityParts.join(", ") + (pin ? ` · ${pin}` : "");

                  // Clean address
                  const addressParts = [
                    p.name !== p.street ? p.name : null,
                    p.housenumber ? `No. ${p.housenumber}` : null,
                    p.street,
                    district,
                    c,
                    s,
                    pin,
                  ].filter(Boolean);

                  const categoryLabel = p.osm_value
                    ? p.osm_value.replace(/_/g, " ")
                    : p.osm_key
                    ? p.osm_key.replace(/_/g, " ")
                    : "Place";

                  combinedResults.push({
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    title: name,
                    category: categoryLabel,
                    locality: localityLine,
                    address: addressParts.length > 0 ? addressParts.join(", ") : name,
                    landmark: district || p.street || name,
                    pincode: pin,
                    city: c,
                    state: s,
                    source: "photon",
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn("Photon search error:", err);
      }

      // 2. Nominatim Search (Great for streets, localities, addresses, pincodes)
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          cleaned
        )}&countrycodes=in&limit=5&addressdetails=1`;
        const nRes = await fetch(nomUrl);
        if (nRes.ok) {
          const nData = await nRes.json();
          if (Array.isArray(nData)) {
            nData.forEach((item) => {
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lon);
              const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);

                const addrObj = item.address || {};
                const pin = extractPincode(addrObj, item.display_name);
                const lmk = extractLandmark(addrObj, item.display_name);
                const c = addrObj.city || addrObj.town || addrObj.village || "";
                const s = addrObj.state || "";
                const title =
                  addrObj.shop ||
                  addrObj.amenity ||
                  addrObj.building ||
                  addrObj.commercial ||
                  addrObj.industrial ||
                  addrObj.office ||
                  addrObj.road ||
                  (item.display_name ? item.display_name.split(",")[0] : "Location");

                const localityParts = [lmk, c, s].filter(Boolean);
                const localityLine = localityParts.join(", ") + (pin ? ` · ${pin}` : "");
                const cleanAddr = buildCleanAddress(addrObj, item.display_name);

                combinedResults.push({
                  lat,
                  lng,
                  title,
                  category: item.type ? item.type.replace(/_/g, " ") : "Location",
                  locality: localityLine,
                  address: cleanAddr,
                  landmark: lmk,
                  pincode: pin,
                  city: c,
                  state: s,
                  source: "nominatim",
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("Nominatim search error:", err);
      }

      // 3. Fallback: If 0 results and query had commas or multiple words, try segmented search
      if (combinedResults.length === 0 && q.includes(",")) {
        const segments = q.split(",").map((s) => s.trim()).filter(Boolean);
        if (segments.length >= 2) {
          // Take first token (shop / building) + last token (city or pincode)
          const fallbackQuery = `${segments[0]} ${segments[segments.length - 1]}`;
          try {
            const fRes = await fetch(
              `https://photon.komoot.io/api/?q=${encodeURIComponent(
                fallbackQuery
              )}&limit=5&lat=${coords.lat}&lon=${coords.lng}`
            );
            if (fRes.ok) {
              const fData = await fRes.json();
              if (fData?.features) {
                fData.features.forEach((feat) => {
                  const p = feat.properties || {};
                  const [lng, lat] = feat.geometry?.coordinates || [];
                  if (lat && lng) {
                    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
                    if (!seenKeys.has(key)) {
                      seenKeys.add(key);
                      const name = p.name || p.street || fallbackQuery;
                      const district = p.district || p.suburb || p.locality || "";
                      const c = p.city || "";
                      const s = p.state || "";
                      const pin = p.postcode || "";
                      combinedResults.push({
                        lat: parseFloat(lat),
                        lng: parseFloat(lng),
                        title: name,
                        category: "Place",
                        locality: [district, c, s].filter(Boolean).join(", ") + (pin ? ` · ${pin}` : ""),
                        address: [name, district, c, s, pin].filter(Boolean).join(", "),
                        landmark: district || name,
                        pincode: pin,
                        city: c,
                        state: s,
                        source: "fallback",
                      });
                    }
                  }
                });
              }
            }
          } catch (e) {
            console.warn("Fallback search error:", e);
          }
        }
      }

      return combinedResults;
    },
    [coords.lat, coords.lng]
  );

  // Apply a selected search result: pins on map, flies to location, and fills address, landmark & pincode
  const applySearchResult = (result, closeDropdown = true) => {
    if (!result || isNaN(result.lat) || isNaN(result.lng)) return;

    if (closeDropdown) {
      setSearchResults([]);
      setSearchQuery("");
    }

    if (result.address) setAddress(result.address);
    if (result.pincode) setPincode(result.pincode);
    if (result.landmark) setLandmark(result.landmark);
    if (result.city) setCity(result.city);
    if (result.state) setStateName(result.state);

    // Automatically pin the location on the map
    updateMarkerPosition(result.lat, result.lng, false);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([result.lat, result.lng], 16);
    }
  };

  // Live Autocomplete as user types (Debounced 350ms)
  const handleQueryInputChange = (val) => {
    setSearchQuery(val);
    setErrorMessage("");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const items = await executeSearch(val);
        setSearchResults(items);
        if (items.length === 0) {
          setErrorMessage("No location matches found. Try specifying the shop name and area (e.g. 'D-Mart Andheri').");
        }
      } catch (err) {
        console.error("Search debounce error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Explicit Search (Submit Form / Press Enter / Click Button) -> Automatically pins the top result
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setErrorMessage("");
    try {
      const items = await executeSearch(query);
      setSearchResults(items);

      if (items && items.length > 0) {
        // AUTOMATICALLY PIN THE TOP RESULT ON THE MAP!
        applySearchResult(items[0], false);
      } else {
        setErrorMessage("No location matches found. Try specifying the shop/building name and area.");
      }
    } catch (err) {
      console.error("Location search submit error:", err);
      setErrorMessage("Could not search location. Please check internet connection.");
    } finally {
      setIsSearching(false);
    }
  };

  // Select a result from the search suggestions dropdown
  const handleSelectSearchResult = (result) => {
    applySearchResult(result, true);
  };

  // GPS "Use My Current Location"
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingGps(true);
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateMarkerPosition(lat, lng, true);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16);
        }
      },
      (err) => {
        setIsDetectingGps(false);
        console.warn("GPS detection error:", err);
        setErrorMessage("Could not detect location. Please grant browser location permission.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Manual Coordinates change
  const handleManualCoordChange = (type, val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const newLat = type === "lat" ? num : coords.lat;
      const newLng = type === "lng" ? num : coords.lng;
      updateMarkerPosition(newLat, newLng, false);
    }
  };

  // Confirm selection: compile complete formatted site address with landmark and pincode
  const handleSaveAndConfirm = () => {
    const finalLat = hasPinned ? Number(coords.lat.toFixed(6)) : null;
    const finalLng = hasPinned ? Number(coords.lng.toFixed(6)) : null;
    const locationUrl =
      finalLat && finalLng ? `https://www.google.com/maps?q=${finalLat},${finalLng}` : "";

    let fullAddress = address.trim();
    const cleanLandmark = landmark.trim();
    const cleanPincode = pincode.trim();

    if (cleanLandmark && !fullAddress.toLowerCase().includes(cleanLandmark.toLowerCase())) {
      fullAddress = fullAddress ? `${fullAddress}, Landmark: ${cleanLandmark}` : `Landmark: ${cleanLandmark}`;
    }

    if (cleanPincode && !fullAddress.includes(cleanPincode)) {
      fullAddress = fullAddress ? `${fullAddress} - ${cleanPincode}` : cleanPincode;
    }

    onSelectLocation({
      latitude: finalLat,
      longitude: finalLng,
      address: fullAddress,
      site_address: fullAddress,
      landmark: cleanLandmark,
      pincode: cleanPincode,
      city: city.trim(),
      state: stateName.trim(),
      location_url: locationUrl,
    });
    onClose();
  };

  if (!isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-slate-900/20 backdrop-blur-xs animate-in fade-in duration-200 font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-3xl flex flex-col max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {title}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Search any shop, building, landmark, area, or address — auto-pins and auto-fills details.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH & AUTOCOMPLETE BAR (High z-index to always stay above Leaflet map panes) */}
        <div
          ref={searchContainerRef}
          className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 relative z-[1100]"
        >
          {/* Search Input with Live Autocomplete */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative z-[1100]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleQueryInputChange(e.target.value)}
                placeholder="Search shop, building, company, landmark, area (e.g. 'Apollo Pharmacy Andheri')..."
                className="w-full pl-9 pr-24 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs bg-white"
              />
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search & Pin"}
              </button>
            </div>

            {/* LIVE AUTOCOMPLETE SUGGESTIONS DROPDOWN (Layered safely above Leaflet map) */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-[1200] max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs ring-1 ring-slate-900/10">
                <div className="px-3 py-1.5 bg-slate-50/95 backdrop-blur-xs text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
                  <span>Suggestions ({searchResults.length} places · Top auto-pinned)</span>
                  <button
                    type="button"
                    onClick={() => setSearchResults([])}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
                  >
                    Close ✕
                  </button>
                </div>

                {searchResults.map((item, idx) => (
                  <button
                    key={`${item.lat}-${item.lng}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSearchResult(item)}
                    className={`w-full text-left p-3 hover:bg-cyan-50/80 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                      idx === 0 ? "bg-cyan-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 mt-0.5">
                        {item.category?.toLowerCase().includes("shop") ? (
                          <Store className="w-3.5 h-3.5" />
                        ) : item.category?.toLowerCase().includes("building") ? (
                          <Building className="w-3.5 h-3.5" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs sm:text-[13px] truncate">
                            {item.title}
                          </span>
                          {item.category && (
                            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {item.category}
                            </span>
                          )}
                        </div>

                        {/* Specific Area / Locality subtitle */}
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                          <span className="text-cyan-600 font-medium">{item.locality || item.address}</span>
                        </p>

                        {idx === 0 && (
                          <span className="text-[10px] text-emerald-700 font-bold block mt-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Currently Auto-Pinned on Map</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 self-center" />
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* GPS Location Button */}
          <button
            type="button"
            onClick={handleDetectCurrentLocation}
            disabled={isDetectingGps}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-700 border border-slate-200 text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-60 z-[1100]"
            title="Detect GPS location from this device"
          >
            {isDetectingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-cyan-600" />
            )}
            <span>{isDetectingGps ? "Detecting GPS..." : "My Location"}</span>
          </button>
        </div>

        {/* ERROR ALERT */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between relative z-[1050]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* MAP CONTAINER */}
        <div className="relative flex-1 min-h-[280px] sm:min-h-[340px] bg-slate-100 z-0">
          <div ref={mapContainerRef} className="w-full h-full min-h-[280px] sm:min-h-[340px] z-0" />

          {/* Overlay Helper Pill */}
          <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            <span>Search any shop, building, or address above, or click/drag the pin</span>
          </div>

          {!leafletLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 text-center z-[500]">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-600 mb-2" />
              <p className="text-xs font-semibold text-slate-700">Loading interactive map...</p>
            </div>
          )}
        </div>

        {/* DETAILS & MANUAL COORDINATES FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3 overflow-y-auto max-h-[320px]">
          {/* Formatted Site Address Row (Auto-filled & Editable) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                <span>Site Address (Auto-filled & Editable)</span>
              </label>
              {isGeocoding && (
                <span className="text-[10px] text-cyan-600 font-semibold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Auto-detecting address...
                </span>
              )}
            </div>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full site address or street details..."
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 leading-relaxed shadow-2xs"
            />
          </div>

          {/* 2-Column Row: Landmark / Area & Pincode (Both Auto-filled & Editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Landmark / Area */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-1">
                <Compass className="w-3.5 h-3.5 text-amber-500" />
                <span>Site Landmark / Area (Editable)</span>
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Near Metro Station / MIDC Phase 2"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
              />
            </div>

            {/* Pincode */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-1">
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                <span>Area Pincode (Postal Code)</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="e.g. 400069 (6-digit pincode)"
                className="w-full px-3 py-1.5 text-xs font-mono font-bold tracking-wider rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Coordinates Bar & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Lat</span>
                <input
                  type="number"
                  step="0.000001"
                  value={coords.lat}
                  onChange={(e) => handleManualCoordChange("lat", e.target.value)}
                  className="w-20 font-mono font-bold text-slate-800 text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Lng</span>
                <input
                  type="number"
                  step="0.000001"
                  value={coords.lng}
                  onChange={(e) => handleManualCoordChange("lng", e.target.value)}
                  className="w-20 font-mono font-bold text-slate-800 text-xs focus:outline-none"
                />
              </div>

              {hasPinned && (
                <a
                  href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-cyan-700 hover:border-cyan-300 transition-colors"
                  title="Preview in Google Maps"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveAndConfirm}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Location</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
