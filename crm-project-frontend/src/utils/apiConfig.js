/**
 * API Configuration Helper for TEDRA CRM
 */
export const getBaseApiUrl = () => {
  return import.meta.env.VITE_BASE_API_URL || "http://localhost:8000";
};

export default {
  getBaseApiUrl,
};
