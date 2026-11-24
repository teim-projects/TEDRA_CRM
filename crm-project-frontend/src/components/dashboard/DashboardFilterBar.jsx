import React, { useMemo } from "react";
import {
  Calendar,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";

export const FILTER_PRESETS = [
  { id: "all", label: "All Time" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "this_quarter", label: "This Quarter" },
  { id: "this_year", label: "This Year" },
  { id: "last_year", label: "Last Year" },
  { id: "custom", label: "Custom Range" },
];

export const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export const QUARTERS = [
  { value: 1, label: "Q1 (Jan - Mar)" },
  { value: 2, label: "Q2 (Apr - Jun)" },
  { value: 3, label: "Q3 (Jul - Sep)" },
  { value: 4, label: "Q4 (Oct - Dec)" },
];

export default function DashboardFilterBar({
  filterConfig,
  onFilterChange,
  onReset,
  availableYears = [],
  totalFilteredCount = 0,
  activeFilterSummary = "All Time",
  onClose,
}) {
  const currentYear = new Date().getFullYear();

  // Ensure available years has valid unique sorted years descending
  const yearsList = useMemo(() => {
    const yearsSet = new Set(availableYears);
    yearsSet.add(currentYear);
    yearsSet.add(currentYear - 1);
    yearsSet.add(currentYear - 2);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [availableYears, currentYear]);

  const isFiltered = filterConfig.mode !== "all" || filterConfig.preset !== "all";

  const handlePresetClick = (presetId) => {
    if (presetId === "all") {
      onReset();
      return;
    }
    if (presetId === "custom") {
      onFilterChange({
        ...filterConfig,
        mode: "custom",
        preset: "custom",
      });
      return;
    }

    onFilterChange({
      ...filterConfig,
      mode: "preset",
      preset: presetId,
    });
  };

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 sm:p-4 space-y-3 transition-all duration-200 box-border overflow-hidden">
      {/* HEADER ROW: TITLE & ACTIONS */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-[#377d58] shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 block leading-tight truncate">
              Filter Dashboard
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Select presets or custom date range
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
              title="Reset to all-time view"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close filter panel"
              aria-label="Close filter panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* PRESETS ROW: RESPONSIVE WRAPPED PILLS */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:inline-block">
          Presets:
        </span>
        {FILTER_PRESETS.map((preset) => {
          const isActive =
            filterConfig.preset === preset.id ||
            (preset.id === "all" && filterConfig.mode === "all" && filterConfig.preset === "all");

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset.id)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-[#377d58] text-white shadow-xs font-semibold"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* DETAILED CONTROLS ROW */}
      <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2.5 sm:gap-3 text-xs">
        {/* VIEW BY SELECTOR */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <label className="text-slate-500 font-medium whitespace-nowrap min-w-[55px] sm:min-w-0">
            View By:
          </label>
          <select
            value={filterConfig.mode}
            onChange={(e) => {
              const newMode = e.target.value;
              onFilterChange({
                ...filterConfig,
                mode: newMode,
                preset: newMode === "all" ? "all" : "custom_mode",
              });
            }}
            className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-1 focus:ring-[#377d58] focus:border-[#377d58] outline-hidden cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="year">Yearly</option>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="custom">Custom Date Range</option>
          </select>
        </div>

        {/* YEAR SELECTOR */}
        {(filterConfig.mode === "year" ||
          filterConfig.mode === "month" ||
          filterConfig.mode === "quarter") && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <label className="text-slate-500 font-medium min-w-[55px] sm:min-w-0">
              Year:
            </label>
            <select
              value={filterConfig.year}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  year: parseInt(e.target.value, 10),
                  preset: "custom_mode",
                })
              }
              className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-1 focus:ring-[#377d58] focus:border-[#377d58] outline-hidden cursor-pointer"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* MONTH SELECTOR */}
        {filterConfig.mode === "month" && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <label className="text-slate-500 font-medium min-w-[55px] sm:min-w-0">
              Month:
            </label>
            <select
              value={filterConfig.month}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  month: parseInt(e.target.value, 10),
                  preset: "custom_mode",
                })
              }
              className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-1 focus:ring-[#377d58] focus:border-[#377d58] outline-hidden cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* QUARTER SELECTOR */}
        {filterConfig.mode === "quarter" && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <label className="text-slate-500 font-medium min-w-[55px] sm:min-w-0">
              Quarter:
            </label>
            <select
              value={filterConfig.quarter}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  quarter: parseInt(e.target.value, 10),
                  preset: "custom_mode",
                })
              }
              className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-1 focus:ring-[#377d58] focus:border-[#377d58] outline-hidden cursor-pointer"
            >
              {QUARTERS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CUSTOM DATE RANGE */}
        {filterConfig.mode === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-medium min-w-[45px] sm:min-w-0">
                From:
              </label>
              <input
                type="date"
                value={filterConfig.startDate || ""}
                onChange={(e) =>
                  onFilterChange({
                    ...filterConfig,
                    startDate: e.target.value,
                    preset: "custom",
                  })
                }
                className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-1 focus:ring-[#377d58] focus:border-[#377d58] outline-hidden text-xs cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-medium min-w-[45px] sm:min-w-0">
                To:
              </label>
              <input
                type="date"
                value={filterConfig.endDate || ""}
                onChange={(e) =>
                  onFilterChange({
                    ...filterConfig,
                    endDate: e.target.value,
                    preset: "custom",
                  })
                }
                className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-1 focus:ring-[#377d58] focus:border-[#377d58] outline-hidden text-xs cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ACTIVE FILTER BADGE SUMMARY */}
        <div className="w-full sm:w-auto sm:ml-auto flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-100/90 text-slate-700 text-[11px] font-semibold border border-slate-200 truncate">
            <Calendar className="w-3 h-3 text-[#377d58] shrink-0" />
            <span className="truncate">{activeFilterSummary}</span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/70 shrink-0">
            <span>{Number(totalFilteredCount).toLocaleString("en-IN")} Records Filtered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
