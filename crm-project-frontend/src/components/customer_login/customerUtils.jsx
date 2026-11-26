import React from "react";
import { User, Phone, Mail, MapPin, Wrench, X } from "lucide-react";
import { getValidAccessToken, clearAuthSession } from "../../utils/authUtils";

export function formatPortalDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return String(dateStr);
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

export function formatPortalDateTime(dateStr) {
  if (!dateStr) return "—";
  try {
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return String(dateStr);
    return dt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateStr);
  }
}

export function formatINR(val) {
  const num = Number(val || 0);
  if (!num || isNaN(num)) return "—";
  return `₹${num.toLocaleString("en-IN")}`;
}

export async function fetchCustomerPortal(url) {
  const token = getValidAccessToken();
  if (!token) {
    throw new Error("Session expired. Please sign in again.");
  }
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    clearAuthSession();
    throw new Error("Unauthorized session. Please sign in again.");
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || errBody.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function postCustomerPortal(url, body, isFormData = false) {
  const token = getValidAccessToken();
  if (!token) {
    throw new Error("Session expired. Please sign in again.");
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });
  if (res.status === 401) {
    clearAuthSession();
    throw new Error("Unauthorized session. Please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstFieldErr =
      typeof data === "object" && !data.error && !data.detail
        ? Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ")
        : "";
    throw new Error(data.error || data.detail || firstFieldErr || `Request failed (${res.status})`);
  }
  return data;
}

export function matchesSiteFilter(record, siteId) {
  if (!siteId || siteId === "all") return true;
  const target = String(siteId);
  const resolvedId =
    record?.site_details?.id ??
    (typeof record?.site === "object" ? record?.site?.id : record?.site);
  return String(resolvedId || "") === target;
}

export function mergeCustomerSites(primarySites = [], records = []) {
  const map = new Map();
  (primarySites || []).forEach((s) => {
    if (s?.id) map.set(String(s.id), s);
  });
  (records || []).forEach((rec) => {
    if (rec?.site_details?.id && !map.has(String(rec.site_details.id))) {
      map.set(String(rec.site_details.id), rec.site_details);
    }
  });
  return Array.from(map.values());
}

export function SiteFilterBar({ sites = [], value = "all", onChange, variant = "light" }) {
  const selectedSite = sites.find((s) => String(s.id) === String(value)) || null;
  const isDark = variant === "dark";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
          isDark
            ? "bg-white/10 border-white/20 text-white"
            : "bg-white border-slate-200 text-slate-700"
        }`}
      >
        <MapPin className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-cyan-300" : "text-cyan-600"}`} />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Filter by Site"
          className={`text-xs font-semibold bg-transparent focus:outline-none cursor-pointer pr-1 ${
            isDark ? "text-white [&>option]:text-slate-900" : "text-slate-800"
          }`}
        >
          <option value="all">All Sites ({sites.length})</option>
          {sites.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
              {s.site_shortcut ? ` (${s.site_shortcut})` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedSite && (
        <button
          type="button"
          onClick={() => onChange("all")}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
            isDark
              ? "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 border border-cyan-400/30"
              : "bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200"
          }`}
          title="Show All Sites"
        >
          <span>Clear Site Filter</span>
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status, label }) {
  const norm = String(status || "").toLowerCase();
  let cls = "bg-slate-100 text-slate-700 border-slate-200";
  let dotCls = "bg-slate-400";

  if (["completed", "active", "handover", "renewed", "resolved"].includes(norm)) {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    dotCls = "bg-emerald-500";
  } else if (["in_progress", "scheduled", "installation", "testing"].includes(norm)) {
    cls = "bg-sky-50 text-sky-700 border-sky-200";
    dotCls = "bg-sky-500";
  } else if (["open", "expiring_soon", "pending_parts", "material_procurement"].includes(norm)) {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
    dotCls = "bg-amber-500";
  } else if (["expired", "cancelled", "inactive"].includes(norm)) {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    dotCls = "bg-rose-500";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      <span>{label || String(status || "—").replace(/_/g, " ")}</span>
    </span>
  );
}

export function SiteBadge({ site, fallbackAddress = "" }) {
  if (!site?.name) {
    return fallbackAddress ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="truncate max-w-xs">{fallbackAddress}</span>
      </span>
    ) : null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 max-w-full"
      title={`${site.name}${site.site_shortcut ? ` (${site.site_shortcut})` : ""}`}
    >
      <span className="shrink-0">📍</span>
      <span className="truncate">{site.name}</span>
      {site.site_shortcut && (
        <span className="text-[10px] font-mono text-cyan-700 font-bold shrink-0">
          ({site.site_shortcut})
        </span>
      )}
    </span>
  );
}

export function collectAssignedTechnicians(record) {
  const map = new Map();
  const addPerson = (p, fallbackRole) => {
    if (!p || typeof p !== "object") return;
    const key = p.id || p.email || p.full_name;
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        ...p,
        displayRole: p.role_name || fallbackRole || "Technician",
      });
    }
  };

  if (record?.service_engineer_details) {
    addPerson(record.service_engineer_details, "Service Engineer");
  }
  if (Array.isArray(record?.technicians_details)) {
    record.technicians_details.forEach((t) => addPerson(t, "Technician"));
  }
  if (Array.isArray(record?.assigned_technicians)) {
    record.assigned_technicians.forEach((t) => addPerson(t, "Technician"));
  }
  return Array.from(map.values());
}

export function TechnicianListCard({
  people = [],
  emptyText = "Technician will be assigned soon.",
  compact = false,
}) {
  if (!people || people.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic flex items-center gap-1.5">
        <Wrench className="w-3.5 h-3.5 text-slate-300" />
        <span>{emptyText}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {people.map((person, idx) => (
          <span
            key={person.id || idx}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
          >
            <User className="w-3 h-3 text-cyan-600 shrink-0" />
            <span className="font-semibold text-slate-900">{person.full_name}</span>
            {person.mobile_no && (
              <a
                href={`tel:${person.mobile_no}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-cyan-700 hover:underline font-medium"
              >
                ({person.mobile_no})
              </a>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {people.map((person, idx) => {
        const initials = (person.full_name || "T")
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return (
          <div
            key={person.id || idx}
            className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {person.full_name}
                </p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-100 shrink-0">
                  {person.displayRole || "Technician"}
                </span>
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                {person.mobile_no && (
                  <a
                    href={`tel:${person.mobile_no}`}
                    className="flex items-center gap-1 text-cyan-700 hover:underline font-medium"
                  >
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{person.mobile_no}</span>
                  </a>
                )}
                {person.email && (
                  <a
                    href={`mailto:${person.email}`}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-700 truncate"
                  >
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{person.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
