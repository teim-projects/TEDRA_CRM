import { useEffect, useRef } from "react";
import { getValidAccessToken } from "../utils/authUtils";
import { getBaseApiUrl } from "../utils/apiConfig";

/**
 * Background hook that automatically tracks and syncs the logged-in
 * technician's GPS location to the CRM field map whenever they open/browse the website.
 */
export function useTechnicianLocationTracker() {
  const lastSyncTimeRef = useRef(0);
  const syncInProgressRef = useRef(false);

  useEffect(() => {
    // 1. Verify user is authenticated
    const token = getValidAccessToken();
    if (!token) return;

    // 2. Check if logged-in user has technician role
    let isTech = false;
    try {
      const cached = localStorage.getItem("crm_user_info");
      if (cached) {
        const info = JSON.parse(cached);
        const role = (info?.role_name || info?.role?.name || "").toLowerCase();
        isTech = role.includes("technician") || Boolean(info?.is_technician);
      }
    } catch (_) {}

    if (!isTech) return;
    if (!("geolocation" in navigator)) return;

    const baseApi = getBaseApiUrl();

    const pushLocation = async (coords) => {
      const now = Date.now();
      // Throttle syncs to at most once every 30 seconds to conserve battery and bandwidth
      if (now - lastSyncTimeRef.current < 30000 || syncInProgressRef.current) {
        return;
      }
      syncInProgressRef.current = true;
      try {
        const currentToken = getValidAccessToken();
        if (!currentToken) return;

        await fetch(`${baseApi}/technician/live-location/update/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy || null,
            status: "on_duty",
          }),
        });
        lastSyncTimeRef.current = now;
      } catch (err) {
        console.debug("Technician live location auto-sync error:", err);
      } finally {
        syncInProgressRef.current = false;
      }
    };

    // Immediate initial sync on website open
    navigator.geolocation.getCurrentPosition(
      (pos) => pushLocation(pos.coords),
      (err) => console.debug("Initial background geo sync notice:", err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );

    // Continuous position watcher
    let watchId = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => pushLocation(pos.coords),
        (err) => console.debug("Background watchPosition status:", err.message),
        { enableHighAccuracy: true, maximumAge: 30000 }
      );
    } catch (e) {
      console.debug("watchPosition initialization error:", e);
    }

    // Periodic heartbeat poll every 45 seconds while the browser tab remains open
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => pushLocation(pos.coords),
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    }, 45000);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(intervalId);
    };
  }, []);
}

export default useTechnicianLocationTracker;
