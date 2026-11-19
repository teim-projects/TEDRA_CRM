import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Wrench,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  UserCheck,
  RefreshCw
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function TechnicianStockLogModal({
  isOpen,
  onClose,
  technician,
  baseApi
}) {
  const api = (baseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("serviceWise"); // "serviceWise" | "timeline"
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "IN_HAND" | "RECONCILED"

  const technicianName = useMemo(() => {
    if (!technician) return "Technician";
    return (
      `${technician.first_name || ""} ${technician.last_name || ""}`.trim() ||
      technician.username ||
      technician.email ||
      "Technician"
    );
  }, [technician]);

  const initials = useMemo(() => {
    if (!technician) return "T";
    const f = technician.first_name?.[0] || "";
    const l = technician.last_name?.[0] || "";
    return (f + l).toUpperCase() || technicianName[0]?.toUpperCase() || "T";
  }, [technician, technicianName]);

  const fetchTechTransactions = async () => {
    if (!technician?.id) return;
    setLoading(true);
    try {
      const token =
        localStorage.getItem("access") || localStorage.getItem("access_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(
        `${api}/inventory/transactions/?technician=${technician.id}&limit=500`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setTransactions(list);
      }
    } catch (err) {
      console.error("Error fetching technician stock transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && technician?.id) {
      fetchTechTransactions();
    }
  }, [isOpen, technician?.id]);

  const formatDate = (isoStr) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return isoStr;
    }
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return (
        d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }) +
        " " +
        d.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        })
      );
    } catch {
      return isoStr;
    }
  };

  // Grouped Reconciliation by Service / Reference / Material
  const serviceWiseReconciliation = useMemo(() => {
    const groups = {};

    transactions.forEach((tx) => {
      const ref =
        tx.reference_number ||
        tx.service_number ||
        tx.visit_number ||
        "GENERAL_ISSUE";
      const itemKey = tx.item || tx.item_name || "UNKNOWN_ITEM";
      const groupKey = `${ref}_${itemKey}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          reference: ref,
          service_number: tx.service_number,
          visit_number: tx.visit_number,
          target_info: tx.target_info,
          item_id: tx.item,
          item_name: tx.item_name || "Material Item",
          item_code: tx.item_code || "",
          unit: tx.unit || "units",
          issued_qty: 0,
          used_qty: 0,
          returned_qty: 0,
          earliest_date: tx.created_at,
          latest_date: tx.created_at,
          notes_list: [],
          return_reasons: []
        };
      }

      const grp = groups[groupKey];
      const qty = Number(tx.quantity) || 0;

      if (tx.transaction_type === "ISSUE_STOCK") {
        grp.issued_qty += qty;
        if (new Date(tx.created_at) < new Date(grp.earliest_date)) {
          grp.earliest_date = tx.created_at;
        }
      } else if (tx.transaction_type === "RETURN_STOCK") {
        grp.returned_qty += qty;
        if (tx.notes) grp.return_reasons.push(tx.notes);
      } else if (tx.transaction_type === "USED_STOCK") {
        grp.used_qty += qty;
      }

      if (new Date(tx.created_at) > new Date(grp.latest_date)) {
        grp.latest_date = tx.created_at;
      }

      if (tx.notes && !grp.notes_list.includes(tx.notes)) {
        grp.notes_list.push(tx.notes);
      }
    });

    return Object.values(groups).map((grp) => {
      const remaining_qty = Math.max(
        0,
        grp.issued_qty - grp.returned_qty - grp.used_qty
      );
      return {
        ...grp,
        remaining_qty,
        is_reconciled: remaining_qty === 0 && grp.issued_qty > 0
      };
    });
  }, [transactions]);

  // Overall KPIs
  const kpis = useMemo(() => {
    let totalIssued = 0;
    let totalReturned = 0;
    let totalUsed = 0;

    transactions.forEach((tx) => {
      const q = Number(tx.quantity) || 0;
      if (tx.transaction_type === "ISSUE_STOCK") totalIssued += q;
      else if (tx.transaction_type === "RETURN_STOCK") totalReturned += q;
      else if (tx.transaction_type === "USED_STOCK") totalUsed += q;
    });

    const netRemaining = Math.max(0, totalIssued - totalReturned - totalUsed);

    return {
      totalIssued,
      totalReturned,
      totalUsed,
      netRemaining
    };
  }, [transactions]);

  // Filtered service-wise rows
  const filteredServiceRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return serviceWiseReconciliation.filter((row) => {
      const matchesSearch =
        !q ||
        row.reference.toLowerCase().includes(q) ||
        row.item_name.toLowerCase().includes(q) ||
        row.item_code.toLowerCase().includes(q) ||
        row.notes_list.some((n) => n.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "IN_HAND"
          ? row.remaining_qty > 0
          : statusFilter === "RECONCILED"
          ? row.is_reconciled
          : true;

      return matchesSearch && matchesStatus;
    });
  }, [serviceWiseReconciliation, searchQuery, statusFilter]);

  // Filtered timeline rows
  const filteredTimelineRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((tx) => {
      return (
        !q ||
        tx.item_name?.toLowerCase().includes(q) ||
        tx.item_code?.toLowerCase().includes(q) ||
        tx.reference_number?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        tx.transaction_type_display?.toLowerCase().includes(q)
      );
    });
  }, [transactions, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in font-sans antialiased text-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  {technicianName}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                  Technician Stock Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {technician?.email || technician?.mobile_no
                  ? `${technician?.email || ""} ${
                      technician?.mobile_no ? `• ${technician.mobile_no}` : ""
                    }`
                  : "Material allocations, usage, and field returns record."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTechTransactions}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh Log"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUMMARY KPI BLOCKS */}
        <div className="px-6 py-3.5 bg-slate-100/50 border-b border-slate-200/70 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Total Issued
            </span>
            <span className="text-sm sm:text-base font-bold text-blue-700 block mt-0.5">
              {kpis.totalIssued} <span className="text-xs font-normal text-slate-400">units</span>
            </span>
            <span className="text-[10px] text-blue-600 font-medium block">
              Allocated across jobs
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Used in Services
            </span>
            <span className="text-sm sm:text-base font-bold text-purple-700 block mt-0.5">
              {kpis.totalUsed} <span className="text-xs font-normal text-slate-400">units</span>
            </span>
            <span className="text-[10px] text-purple-600 font-medium block">
              Consumed at customer sites
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Returned to Store
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-700 block mt-0.5">
              {kpis.totalReturned} <span className="text-xs font-normal text-slate-400">units</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block">
              Surplus & unused items
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              In Hand with Tech
            </span>
            <span className="text-sm sm:text-base font-bold text-amber-700 block mt-0.5">
              {kpis.netRemaining} <span className="text-xs font-normal text-slate-400">units</span>
            </span>
            <span className="text-[10px] text-amber-600 font-medium block">
              Pending site use / return
            </span>
          </div>
        </div>

        {/* TABS & SEARCH BAR */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab("serviceWise")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "serviceWise"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Job & Service Ledger ({serviceWiseReconciliation.length})
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "timeline"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Movement Timeline ({transactions.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search job ref, item..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            {activeTab === "serviceWise" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="IN_HAND">In Hand Only</option>
                <option value="RECONCILED">Fully Reconciled</option>
              </select>
            )}
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span>Loading technician inventory movements...</span>
            </div>
          ) : activeTab === "serviceWise" ? (
            /* SERVICE-WISE RECONCILIATION TABLE */
            filteredServiceRows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-1.5 border border-dashed border-slate-200 rounded-xl">
                <Package className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">No Service Stock Records Found</p>
                <p className="text-[11px] text-slate-400">
                  No materials have been issued to {technicianName} matching your search.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-2 px-3">Service / Job Ref</th>
                      <th className="py-2 px-3">Material Item</th>
                      <th className="py-2 px-3 text-center">Date Issued</th>
                      <th className="py-2 px-3 text-right">Issued Qty</th>
                      <th className="py-2 px-3 text-right">Used in Job</th>
                      <th className="py-2 px-3 text-right">Returned</th>
                      <th className="py-2 px-3 text-right">In Hand</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredServiceRows.map((row) => (
                      <tr
                        key={row.key}
                        className="hover:bg-slate-50/80 transition-colors h-10"
                      >
                        <td className="py-1.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-blue-700 text-xs">
                              {row.reference}
                            </span>
                            {row.target_info?.customer && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                {row.target_info.customer}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                            <span className="font-bold text-slate-800 text-xs uppercase truncate">
                              {row.item_name}
                            </span>
                            {row.item_code && (
                              <span className="text-[10px] font-mono px-1 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200">
                                {row.item_code}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-1.5 px-3 text-center text-slate-500 whitespace-nowrap">
                          {formatDate(row.earliest_date)}
                        </td>

                        <td className="py-1.5 px-3 text-right font-bold text-blue-700 whitespace-nowrap">
                          {row.issued_qty}{" "}
                          <span className="text-[10px] font-normal text-slate-400">
                            {row.unit}
                          </span>
                        </td>

                        <td className="py-1.5 px-3 text-right font-medium text-purple-700 whitespace-nowrap">
                          {row.used_qty}{" "}
                          <span className="text-[10px] font-normal text-slate-400">
                            {row.unit}
                          </span>
                        </td>

                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                          {row.returned_qty > 0 ? (
                            <span
                              className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-help"
                              title={
                                row.return_reasons.length > 0
                                  ? row.return_reasons.join(" | ")
                                  : "Returned surplus items"
                              }
                            >
                              {row.returned_qty} {row.unit}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                          {row.remaining_qty > 0 ? (
                            <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {row.remaining_qty} {row.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-medium">0</span>
                          )}
                        </td>

                        <td className="py-1.5 px-3 text-center whitespace-nowrap">
                          {row.is_reconciled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Reconciled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              In Hand
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* TIMELINE / CHRONOLOGICAL AUDIT TRAIL */
            filteredTimelineRows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                No timeline records found matching your filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTimelineRows.map((tx) => {
                  const isIssue = tx.transaction_type === "ISSUE_STOCK";
                  const isReturn = tx.transaction_type === "RETURN_STOCK";
                  const isUsed = tx.transaction_type === "USED_STOCK";

                  return (
                    <div
                      key={tx.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isIssue
                              ? "bg-blue-50 text-blue-600 border border-blue-200"
                              : isReturn
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-purple-50 text-purple-600 border border-purple-200"
                          }`}
                        >
                          {isIssue ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : isReturn ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <Wrench className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                isIssue
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : isReturn
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {tx.transaction_type_display || tx.transaction_type}
                            </span>
                            <span className="font-bold text-slate-900 uppercase">
                              {tx.item_name}
                            </span>
                            {tx.item_code && (
                              <span className="font-mono text-[10px] px-1 text-slate-500 bg-slate-100 rounded">
                                {tx.item_code}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                            <span>Job: <strong className="text-blue-700 font-mono">{tx.reference_number || "-"}</strong></span>
                            <span>•</span>
                            <span>{formatDateTime(tx.created_at)}</span>
                            {tx.notes && (
                              <>
                                <span>•</span>
                                <span className="italic truncate max-w-[280px]" title={tx.notes}>
                                  "{tx.notes}"
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm font-bold block ${
                            isIssue
                              ? "text-blue-700"
                              : isReturn
                              ? "text-emerald-700"
                              : "text-purple-700"
                          }`}
                        >
                          {isIssue ? "+" : isReturn ? "-" : "-"}
                          {tx.quantity} {tx.unit || "units"}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Stock at hand: {tx.new_available}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200/80 bg-slate-50/70 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Total Movements: <strong>{transactions.length}</strong> · Net Pending Balance:{" "}
            <strong className="text-amber-700">{kpis.netRemaining} units</strong>
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

