// In-memory cache for coordinates to location names
const memoryGeoCache = new Map();

/**
 * Reverse geocode latitude and longitude to human-readable address/locality name.
 * Uses BigDataCloud client API with OpenStreetMap Nominatim fallback and caching.
 */
export async function reverseGeocodeLocation(lat, lng) {
  if (!lat || !lng) return "";
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) return "";

  // Versioned cache key so broad names (e.g. "Chandrapur, Maharashtra") are refreshed to precise place names ("Rajura")
  const cacheKey = `geo_precise_${numLat.toFixed(4)}_${numLng.toFixed(4)}`;

  // 1. Check memory cache
  if (memoryGeoCache.has(cacheKey)) {
    return memoryGeoCache.get(cacheKey);
  }

  // 2. Check localStorage
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      memoryGeoCache.set(cacheKey, cached);
      return cached;
    }
  } catch (_) {}

  // 3. Try OpenStreetMap Nominatim First (Extracts exact landmark, street, colony, suburb or town without broad district/state)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${numLat}&lon=${numLng}&zoom=18&addressdetails=1`;
    const res = await fetch(osmUrl, {
      headers: { "Accept-Language": "en" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const landmark = a.amenity || a.shop || a.building || a.office;
        const street = a.road || a.pedestrian || a.street;
        const colonyOrSuburb = a.suburb || a.neighbourhood || a.residential || a.subdivision || a.quarter || a.hamlet;
        const townOrVillage = a.town || a.village || a.city_district;
        const city = a.city || a.municipality;

        let parts = [];
        if (landmark) parts.push(landmark);
        if (street && !parts.includes(street)) parts.push(street);
        if (colonyOrSuburb && !parts.includes(colonyOrSuburb)) parts.push(colonyOrSuburb);

        // If no micro-locality found yet, use town or village
        if (parts.length === 0 && townOrVillage) parts.push(townOrVillage);
        // If still nothing, use city
        if (parts.length === 0 && city) parts.push(city);
        // Fallbacks only if nothing else exists
        if (parts.length === 0 && a.county) parts.push(a.county);
        if (parts.length === 0 && a.state_district) parts.push(a.state_district.replace(/\s+District$/i, ""));

        const locName = parts.length > 0
          ? parts.join(", ")
          : (data.display_name?.split(",").slice(0, 2).join(",") || "");

        if (locName) {
          memoryGeoCache.set(cacheKey, locName);
          try { localStorage.setItem(cacheKey, locName); } catch (_) {}
          return locName;
        }
      }
    }
  } catch (err) {
    console.debug("Nominatim geocode failed, falling back to BigDataCloud:", err);
  }

  // 4. Fallback to BigDataCloud (Client-side free reverse geocoding, fast, CORS friendly)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${numLat}&longitude=${numLng}&localityLanguage=en`;
    const res = await fetch(bdcUrl);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const preciseBdc = data.locality || data.neighbourhood || data.subLocality || data.quarter || data.city;
        if (preciseBdc) {
          memoryGeoCache.set(cacheKey, preciseBdc);
          try { localStorage.setItem(cacheKey, preciseBdc); } catch (_) {}
          return preciseBdc;
        }
      }
    }
  } catch (err) {
    console.warn("BigDataCloud geocode failed:", err);
  }

  return "";
}

/**
 * Forward geocodes an address or pincode to approximate latitude/longitude coordinates.
 * Prioritizes 6-digit Indian Postal PIN codes, followed by city or address components.
 * Caches results in-memory and in localStorage.
 */
export async function geocodePincodeOrAddress(address = "", pincode = "", city = "") {
  // 1. Extract 6-digit Indian PIN code from pincode prop or address string
  let cleanPin = (pincode || "").toString().trim();
  if (!cleanPin || !/^[1-9][0-9]{5}$/.test(cleanPin)) {
    const match = (address || "").match(/\b([1-9][0-9]{5})\b/);
    if (match) {
      cleanPin = match[1];
    }
  }

  // Check cache for pincode
  if (cleanPin) {
    const pinCacheKey = `geo_pin_${cleanPin}`;
    if (memoryGeoCache.has(pinCacheKey)) {
      return memoryGeoCache.get(pinCacheKey);
    }
    try {
      const cached = localStorage.getItem(pinCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        memoryGeoCache.set(pinCacheKey, parsed);
        return parsed;
      }
    } catch (_) {}

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cleanPin}&country=India&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
          const result = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            source: `Pincode ${cleanPin}`,
            displayName: data[0].display_name,
          };
          memoryGeoCache.set(pinCacheKey, result);
          try { localStorage.setItem(pinCacheKey, JSON.stringify(result)); } catch (_) {}
          return result;
        }
      }
    } catch (err) {
      console.warn(`Pincode ${cleanPin} geocoding failed:`, err);
    }
  }

  // 2. Fallback to City or Address query
  const cleanCity = (city || "").trim();
  let query = "";
  if (cleanCity) {
    query = `${cleanCity}, India`;
  } else if (address) {
    // Take the last two comma-separated segments (often area / city / state)
    const cleanAddr = address
      .replace(/[^\w\s,]/gi, " ")
      .trim()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-3)
      .join(", ");
    if (cleanAddr) {
      query = `${cleanAddr}, India`;
    }
  }

  if (query) {
    const queryCacheKey = `geo_query_${query.toLowerCase()}`;
    if (memoryGeoCache.has(queryCacheKey)) {
      return memoryGeoCache.get(queryCacheKey);
    }
    try {
      const cached = localStorage.getItem(queryCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        memoryGeoCache.set(queryCacheKey, parsed);
        return parsed;
      }
    } catch (_) {}

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
          const result = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            source: cleanCity ? `City (${cleanCity})` : "Address Approximate",
            displayName: data[0].display_name,
          };
          memoryGeoCache.set(queryCacheKey, result);
          try { localStorage.setItem(queryCacheKey, JSON.stringify(result)); } catch (_) {}
          return result;
        }
      }
    } catch (err) {
      console.warn("Address geocoding failed:", err);
    }
  }

  return null;
}

