/**
 * Utility functions to validate scheduled service and visit dates.
 * Ensures services and visits cannot be started before their scheduled date.
 */

export const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateToYMD = (dateValue) => {
  if (!dateValue) return "";
  if (typeof dateValue === "string") {
    const s = dateValue.trim();
    // Match YYYY-MM-DD
    const matchYMD = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (matchYMD) {
      const year = matchYMD[1];
      const month = String(matchYMD[2]).padStart(2, "0");
      const day = String(matchYMD[3]).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    // Match DD-MM-YYYY
    const matchDMY = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (matchDMY) {
      const day = String(matchDMY[1]).padStart(2, "0");
      const month = String(matchDMY[2]).padStart(2, "0");
      const year = matchDMY[3];
      return `${year}-${month}-${day}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } else if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
};

/**
 * Returns true if the service or visit is due (scheduled date is today or in the past).
 * Returns false if the scheduled date is in the future.
 */
export const isServiceDue = (dateValue) => {
  const ymd = parseDateToYMD(dateValue);
  if (!ymd) return true; // If no date specified, do not block
  const today = getLocalTodayString();
  return ymd <= today;
};

/**
 * Formats date into DD-MM-YYYY for display in messages and tooltips.
 */
export const formatDisplayDate = (dateValue) => {
  const ymd = parseDateToYMD(dateValue);
  if (!ymd) return typeof dateValue === "string" ? dateValue : "-";
  const [year, month, day] = ymd.split("-");
  return `${day}-${month}-${year}`;
};

