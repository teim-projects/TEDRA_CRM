/**
 * JWT Authentication Helpers for TEDRA CRM
 * Validates token expiration and safely clears stale credentials.
 */

export function clearAuthSession() {
  const hadAuth = !!(
    localStorage.getItem("access") ||
    localStorage.getItem("token") ||
    localStorage.getItem("refresh") ||
    localStorage.getItem("crm_user_info")
  );
  localStorage.removeItem("access");
  localStorage.removeItem("token");
  localStorage.removeItem("refresh");
  localStorage.removeItem("crm_user_info");

  if (hadAuth && typeof window !== "undefined") {
    window.dispatchEvent(new Event("authChange"));
  }
}

export function getValidAccessToken() {
  const token = localStorage.getItem("access") || localStorage.getItem("token");
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      clearAuthSession();
      return null;
    }

    // Safely decode Base64Url payload with unicode support
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);

    // Check expiration (exp is in seconds)
    if (payload && payload.exp && Date.now() >= payload.exp * 1000) {
      clearAuthSession();
      return null;
    }

    return token;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function isUserLoggedIn() {
  return !!getValidAccessToken();
}

export default {
  getValidAccessToken,
  clearAuthSession,
  isUserLoggedIn,
};

