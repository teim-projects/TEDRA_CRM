import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Send,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  X,
  UserCheck,
  Wrench,
  PackageCheck,
  ArrowDownLeft
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import TableView from "../TableView";
import IssueStockModal from "./IssueStockModal";
import ReturnStockModal from "./ReturnStockModal";
import TechnicianStockLogModal from "./TechnicianStockLogModal";

export default function StockIssueView({ onRefreshParentCounts, onNavigateTab, baseApi: propBaseApi }) {
  const baseApi = (propBaseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  const [transactions, setTransactions] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedIssueForReturn, setSelectedIssueForReturn] = useState(null);
  const [selectedTechForLog, setSelectedTechForLog] = useState(null);
  const [isTechLogOpen, setIsTechLogOpen] = useState(false);
  const [viewingTx, setViewingTx] = useState(null);

  const fetchStockIssues = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access") || localStorage.getItem("access_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const [txRes, itemsRes] = await Promise.all([
        fetch(`${baseApi}/inventory/transactions/`, { headers }),
        fetch(`${baseApi}/inventory/items/`, { headers }),
      ]);

      if (txRes.ok) {
        const data = await txRes.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        // Filter for ISSUE_STOCK and USED_STOCK
        const issues = list.filter((t) => t.transaction_type === "ISSUE_STOCK" || t.transaction_type === "USED_STOCK");
        setTransactions(issues);
      }

      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setInventoryItems(Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : []);
      }

      if (onRefreshParentCounts) onRefreshParentCounts();
    } catch (err) {
      console.error("Error fetching stock issues:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockIssues();
  }, []);

  const techniciansList = useMemo(() => {
    const set = new Set();
    transactions.forEach((t) => {
      if (t.technician_name) set.add(t.technician_name);
    });
    return Array.from(set);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return transactions.filter((t) => {
      const matchesSearch =
        !q ||
        t.item_name?.toLowerCase().includes(q) ||
        t.item_code?.toLowerCase().includes(q) ||
        t.technician_name?.toLowerCase().includes(q) ||
        t.reference_number?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q);

      const matchesTech = selectedTech === "ALL" || t.technician_name === selectedTech;

      return matchesSearch && matchesTech;
    });
  }, [transactions, searchQuery, selectedTech]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const totalUnitsIssued = useMemo(() => {
    return transactions.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  }, [transactions]);

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

  // Reusable TableView Columns matching Lead & Quotation row height (h-9 sm:h-10)
  const columns = useMemo(() => [
    {
      key: "created_at",
      label: "DATE",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (t) => (
        <span className="text-xs text-slate-600 whitespace-nowrap block" title={formatDate(t.created_at)}>
          {formatDate(t.created_at)}
        </span>
      )
    },
    {
      key: "item_name",
      label: "ITEM / MATERIAL NAME",
      className: "text-left pl-3 whitespace-nowrap",
      headerClassName: "text-left pl-3 whitespace-nowrap",
      render: (t) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap truncate max-w-[220px]" title={`${t.item_name} (${t.item_code || ''})`}>
          <span className="font-semibold text-slate-800 text-xs truncate uppercase">
            {t.item_name}
          </span>
          {t.item_code && (
            <span className="text-[10px] font-mono text-slate-400">
              [{t.item_code}]
            </span>
          )}
        </div>
      )
    },
    {
      key: "quantity",
      label: "QTY ISSUED",
      className: "text-right whitespace-nowrap pr-3",
      headerClassName: "text-right whitespace-nowrap pr-3",
      render: (t) => (
        <span className="font-bold text-sky-700 text-xs whitespace-nowrap block">
          {t.quantity} <span className="text-[10px] font-normal text-slate-400">{t.unit || "units"}</span>
        </span>
      )
    },
    {
      key: "technician",
      label: "TECHNICIAN",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (t) => (
        <span className="text-xs font-semibold text-slate-800 whitespace-nowrap block truncate max-w-[140px] mx-auto" title={t.technician_name || "General Staff"}>
          {t.technician_name ? (
            <button
              type="button"
              onClick={() => {
                setSelectedTechForLog({ id: t.technician, first_name: t.technician_name });
                setIsTechLogOpen(true);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded transition-colors cursor-pointer border border-transparent hover:border-blue-200"
              title="Click to view Technician Stock Log"
            >
              <UserCheck className="w-3 h-3 text-sky-600" />
              <span>{t.technician_name}</span>
            </button>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </span>
      )
    },
    {
      key: "reference_number",
      label: "SERVICE / AMC JOB",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (t) => {
        const ref = t.reference_number || (t.service_number || t.visit_number);
        return ref ? (
          <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 whitespace-nowrap" title={ref}>
            {ref}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        );
      }
    },
    {
      key: "notes",
      label: "REMARKS / PURPOSE",
      className: "text-left whitespace-nowrap max-w-[200px] truncate",
      headerClassName: "text-left whitespace-nowrap",
      render: (t) => (
        <span className="text-xs text-slate-500 truncate block max-w-[200px]" title={t.notes || "-"}>
          {t.notes || "-"}
        </span>
      )
    }
  ], []);

  const actionsRenderer = useCallback((t) => (
    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
      <button
        onClick={() => {
          setSelectedIssueForReturn(t);
          setIsReturnModalOpen(true);
        }}
        className="px-1.5 py-0.5 text-xs font-semibold rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
        title="Return Unused Stock to Inventory"
      >
        Return
      </button>

      <button
        onClick={() => setViewingTx(t)}
        className="px-2 py-0.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        title="View Details"
      >
        View
      </button>
    </div>
  ), []);

  return (
    <div className="space-y-3.5 font-sans antialiased text-slate-800">
      {/* HEADER BLOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-0.5 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-8 bg-sky-600 rounded-full block shrink-0" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
              Stock Issues & Dispatches
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Material dispatches to field technicians for service repairs, installations, and AMC visits.
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isFilterOpen || searchQuery || selectedTech !== "ALL"
                ? "bg-sky-50 border-sky-300 text-sky-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter</span>
          </button>

          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="px-3 sm:px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Issue Stock</span>
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total Issues
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-slate-900 block mt-0.5">
            {transactions.length} records
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            Material disbursements
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total Units Issued
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-sky-700 block mt-0.5">
            {totalUnitsIssued.toLocaleString()} units
          </span>
          <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
            Consumed in jobs
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Technicians Assigned
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-purple-700 block mt-0.5">
            {techniciansList.length} technicians
          </span>
          <span className="text-[10px] text-purple-600 font-medium block mt-0.5">
            Active in field repairs
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Linked to Jobs
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-emerald-700 block mt-0.5">
            {transactions.filter((t) => Boolean(t.reference_number)).length} jobs
          </span>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            Audited service visits
          </span>
        </div>
      </div>

      {/* FILTER BAR */}
      {isFilterOpen && (
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 animate-fade-in">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by item name, SKU, technician, service #, or remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {techniciansList.length > 0 && (
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="ALL">All Technicians</option>
                {techniciansList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedTech("ALL");
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* REUSED TABLE VIEW (MATCHING EXACT ROW HEIGHT AS LEAD & QUOTATION) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <TableView
          columns={columns}
          rows={paginatedTransactions}
          loading={isLoading}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          actions={actionsRenderer}
          emptyMessage="No stock issue records found. Click '+ Issue Stock' to allocate materials to technicians."
        />
      </div>

      {/* ISSUE STOCK MODAL */}
      {isIssueModalOpen && (
        <IssueStockModal
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
          onSuccess={fetchStockIssues}
          items={inventoryItems}
          baseApi={baseApi}
        />
      )}

      {/* RETURN STOCK MODAL (AGAINST ISSUED STOCK) */}
      {isReturnModalOpen && (
        <ReturnStockModal
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            setSelectedIssueForReturn(null);
          }}
          onSuccess={fetchStockIssues}
          items={inventoryItems}
          baseApi={baseApi}
          preselectedIssue={selectedIssueForReturn}
        />
      )}

      {/* TECHNICIAN STOCK LOG MODAL */}
      {isTechLogOpen && selectedTechForLog && (
        <TechnicianStockLogModal
          isOpen={isTechLogOpen}
          onClose={() => {
            setIsTechLogOpen(false);
            setSelectedTechForLog(null);
          }}
          technician={selectedTechForLog}
          baseApi={baseApi}
        />
      )}

      {/* VIEW TRANSACTION DETAILS MODAL */}
      {viewingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Stock Issue Audit Record
                  </h3>
                  <p className="text-xs text-slate-500">
                    Transaction ID #{viewingTx.id} · {formatDate(viewingTx.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingTx(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Material Item
                  </span>
                  <span className="font-bold text-slate-900 text-xs block mt-0.5">
                    {viewingTx.item_name}
                  </span>
                  {viewingTx.item_code && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Code: {viewingTx.item_code}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Quantity Issued
                  </span>
                  <span className="font-bold text-sky-700 text-sm block mt-0.5">
                    {viewingTx.quantity} {viewingTx.unit || "units"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Issued To Technician
                  </span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">
                    {viewingTx.technician_name || "General Operation"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Linked Job Reference
                  </span>
                  <span className="font-mono font-semibold text-blue-700 text-xs block mt-0.5">
                    {viewingTx.reference_number || "-"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Stock Before Issue
                  </span>
                  <span className="font-semibold text-slate-700 text-xs block mt-0.5">
                    {viewingTx.previous_available} {viewingTx.unit || "units"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Stock After Issue
                  </span>
                  <span className="font-bold text-emerald-700 text-xs block mt-0.5">
                    {viewingTx.new_available} {viewingTx.unit || "units"}
                  </span>
                </div>
              </div>

              {viewingTx.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-700 block mb-0.5">Notes / Purpose:</span>
                  {viewingTx.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

