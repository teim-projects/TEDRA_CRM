/**
 * Universal Turn-by-Turn GPS Navigation Utility.
 * Launches Google Maps with live navigation / journey mode (dir_action=navigate).
 * 
 * When 'origin' is omitted, Google Maps automatically uses the device's live GPS ("Your location").
 * - On Mobile (Android / iOS): Opens Google Maps App and directly starts turn-by-turn voice navigation journey.
 * - On Laptop / Desktop: Opens Google Maps web, sets starting point to 'Your location', and starts the route directions.
 * 
 * IMPORTANT: Opens synchronously inside the click event so browser pop-up blockers never intercept it.
 */

export async function getCurrentCoordinates() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { latitude: null, longitude: null, accuracy: null };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Number(pos.coords.accuracy.toFixed(1)),
        });
      },
      (err) => {
        console.warn("Geolocation permission or sensor response:", err?.message || err);
        resolve({ latitude: null, longitude: null, accuracy: null });
      },
      // 25 second timeout gives the user plenty of time to tap 'Allow' or 'Don't allow'
      // maximumAge: 0 forces fresh GPS readings instead of stale coordinates
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );
  });
}

export function getGoogleMapsNavigationUrl({ latitude, longitude, address }) {
  const hasCoords =
    latitude !== undefined &&
    latitude !== null &&
    String(latitude).trim() !== "" &&
    !isNaN(Number(latitude)) &&
    longitude !== undefined &&
    longitude !== null &&
    String(longitude).trim() !== "" &&
    !isNaN(Number(longitude));

  let destParam = "";
  if (hasCoords) {
    destParam = `${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  } else if (address && String(address).trim()) {
    destParam = encodeURIComponent(String(address).trim());
  }

  if (!destParam) return "";

  // Universal Google Maps URL with dir_action=navigate for turn-by-turn navigation mode
  return `https://www.google.com/maps/dir/?api=1&destination=${destParam}&travelmode=driving&dir_action=navigate`;
}

export function navigateToLocation({
  latitude,
  longitude,
  address,
  destinationName = "Service Site",
}) {
  const navUrl = getGoogleMapsNavigationUrl({ latitude, longitude, address });

  if (!navUrl) {
    alert(
      "No site GPS coordinates or address are set for this site.\n\nPlease click '+ Pin Now' on the site card to set the location on the map."
    );
    return;
  }

  // Create an explicit anchor element with target="_blank"
  // This directs the mobile OS to launch the native Google Maps app or open in a separate tab,
  // NEVER navigating away or replacing the current CRM website tab!
  try {
    const link = document.createElement("a");
    link.href = navUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) link.parentNode.removeChild(link);
      } catch (_) {}
    }, 500);
  } catch (err) {
    console.warn("Anchor navigation failed, attempting window.open:", err);
    window.open(navUrl, "_blank", "noopener,noreferrer");
  }
}

/**
 * Returns a direct Google Maps preview/pin link for given coordinates or address
 */
export function getGoogleMapsPinUrl(latitude, longitude, address) {
  if (
    latitude !== undefined &&
    latitude !== null &&
    longitude !== undefined &&
    longitude !== null &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude))
  ) {
    return `https://www.google.com/maps?q=${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  }
  if (address) {
    return `https://www.google.com/maps?q=${encodeURIComponent(String(address).trim())}`;
  }
  return "";
}
