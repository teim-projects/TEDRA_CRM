import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MdFilterList } from "react-icons/md";
import {
  RotateCcw,
  PackagePlus,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Check,
  X,
  Package,
  Wrench,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  User,
  Building,
  Info
} from "lucide-react";
import Swal from "sweetalert2";
import { getBaseApiUrl } from "../../utils/apiConfig";
import TableView from "../TableView";

export default function ReturnApprovalsView({ onRefreshParentCounts, baseApi }) {
  const api = (baseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  // Safe ref for parent callback to avoid re-triggering fetchRequests
  const onRefreshRef = useRef(onRefreshParentCounts);
  useEffect(() => {
    onRefreshRef.current = onRefreshParentCounts;
  }, [onRefreshParentCounts]);

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filters:
  // typeFilter: 'ALL' | 'ISSUE_STOCK' | 'RETURN_STOCK'
  const [typeFilter, setTypeFilter] = useState("ALL");
  // statusFilter: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [statusFilter, setStatusFilter] = useState("PENDING_APPROVAL");

  // Quick filter options matching Follow-up Management dropdown pattern
  const filterOptions = [
    { value: "ALL", label: "All Records" },
    { value: "RETURN_STOCK", label: "Return Stock" },
    { value: "ISSUE_STOCK", label: "Request Stock" },
  ];

  const currentFilterLabel =
    filterOptions.find((f) => f.value === typeFilter)?.label || "All Records";

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [actionInProgress, setActionInProgress] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchRequests = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      // Fetch both RETURN_STOCK and ISSUE_STOCK
      const res = await fetch(`${api}/inventory/transactions/?transaction_type=RETURN_STOCK,ISSUE_STOCK`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setTransactions(list);
      }
    } catch (err) {
      console.error("Error fetching inventory requests:", err);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchRequests(true);
  }, [fetchRequests]);

  // Helper to resolve originally issued quantity for a return transaction
  const getIssuedQuantity = useCallback((req) => {
    if (!req) return null;
    if (req.issued_quantity != null && req.issued_quantity !== "") {
      return parseFloat(req.issued_quantity);
    }
    if (!transactions || transactions.length === 0) return null;

    // Find matching issue transactions from loaded transactions list
    const issues = transactions.filter((t) => {
      if (t.transaction_type !== "ISSUE_STOCK" || t.status === "REJECTED") return false;
      const sameItem = (t.item === req.item || t.item_id === req.item_id || t.item_name === req.item_name);
      if (!sameItem) return false;

      if (req.service && (t.service === req.service || t.service_number === req.service_number)) return true;
      if (req.visit && (t.visit === req.visit || t.visit_number === req.visit_number)) return true;
      if (req.project && (t.project === req.project || t.project_id === req.project_id || t.project_code === req.project_code)) return true;
      if (req.reference_number && t.reference_number === req.reference_number) return true;
      if (req.technician && t.technician === req.technician) return true;
      return false;
    });

    if (issues.length > 0) {
      return issues.reduce((acc, it) => acc + parseFloat(it.quantity || 0), 0);
    }
    return null;
  }, [transactions]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let pendingTotal = 0;
    let pendingIssue = 0;
    let pendingReturn = 0;
    let totalIssues = 0;
    let totalReturns = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    transactions.forEach((tx) => {
      const isIssue = tx.transaction_type === "ISSUE_STOCK";
      const isReturn = tx.transaction_type === "RETURN_STOCK";
      const s = tx.status || "COMPLETED";

      if (isIssue) totalIssues++;
      if (isReturn) totalReturns++;

      if (s === "PENDING_APPROVAL") {
        pendingTotal++;
        if (isIssue) pendingIssue++;
        if (isReturn) pendingReturn++;
      } else if (s === "APPROVED" || s === "COMPLETED") {
        approvedCount++;
      } else if (s === "REJECTED") {
        rejectedCount++;
      }
    });

    return {
      pendingTotal,
      pendingIssue,
      pendingReturn,
      totalIssues,
      totalReturns,
      approvedCount,
      rejectedCount
    };
  }, [transactions]);

  // Filtered List
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      // Type Filter
      if (typeFilter !== "ALL" && tx.transaction_type !== typeFilter) {
        return false;
      }

      // Status Filter
      const s = tx.status || "COMPLETED";
      if (statusFilter !== "ALL") {
        if (statusFilter === "APPROVED" && s !== "APPROVED" && s !== "COMPLETED") return false;
        if (statusFilter === "PENDING_APPROVAL" && s !== "PENDING_APPROVAL") return false;
        if (statusFilter === "REJECTED" && s !== "REJECTED") return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const itemName = (tx.item_name || "").toLowerCase();
        const itemCode = (tx.item_code || "").toLowerCase();
        const techName = (tx.technician_name || "").toLowerCase();
        const refNo = (tx.reference_number || tx.service_number || tx.visit_number || "").toLowerCase();
        const cust = (tx.target_info?.customer || "").toLowerCase();
        const notes = (tx.notes || "").toLowerCase();
        return (
          itemName.includes(q) ||
          itemCode.includes(q) ||
          techName.includes(q) ||
          refNo.includes(q) ||
          cust.includes(q) ||
          notes.includes(q)
        );
      }
      return true;
    });
  }, [transactions, typeFilter, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Approve Handler (Routes to approve-issue or approve-return)
  const handleApprove = async (tx) => {
    const isIssue = tx.transaction_type === "ISSUE_STOCK";
    const itemName = tx.item_name || "Item";
    const qty = tx.quantity || 0;
    const unit = tx.unit || "Nos";
    const techName = tx.technician_name || "Technician";
    const availStock = tx.available_stock != null ? parseFloat(tx.available_stock) : null;

    let confirmTitle = "";
    let confirmHtml = "";
    let confirmBtnText = "";

    if (isIssue) {
      const isStockSufficient = availStock === null || availStock >= parseFloat(qty);
      confirmTitle = "Approve Stock Issue?";
      confirmHtml = `
        <div class="text-left text-xs text-slate-600 space-y-2">
          <p>You are approving stock requisition of <b>${qty} ${unit}</b> for <b>"${itemName}"</b> requested by <b>${techName}</b>.</p>
          <div class="p-2 rounded bg-slate-50 border border-slate-200 text-slate-700">
            <div><b>Current Warehouse Stock:</b> ${availStock != null ? `${availStock} ${unit}` : "N/A"}</div>
            <div><b>Requested Qty:</b> ${qty} ${unit}</div>
          </div>
          ${
            !isStockSufficient
              ? `<div class="p-2 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold flex items-center gap-1.5">
                   <span>⚠️ Warning: Available warehouse stock (${availStock}) is less than requested quantity (${qty}).</span>
                 </div>`
              : `<div class="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                   ✓ Stock will be immediately deducted from Available Warehouse Inventory and marked as Issued.
                 </div>`
          }
        </div>
      `;
      confirmBtnText = "Yes, Approve & Issue";
    } else {
      confirmTitle = "Approve Stock Return?";
      confirmHtml = `
        <div class="text-left text-xs text-slate-600 space-y-2">
          <p>You are approving <b>${qty} ${unit}</b> of <b>"${itemName}"</b> returned by <b>${techName}</b>.</p>
          <div class="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
            ✓ Stock will be immediately added back to Available Warehouse Inventory.
          </div>
        </div>
      `;
      confirmBtnText = "Yes, Approve & Add to Stock";
    }

    const result = await Swal.fire({
      title: confirmTitle,
      html: confirmHtml,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
      confirmButtonText: confirmBtnText,
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    setActionInProgress(tx.id);
    try {
      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      const endpoint = isIssue
        ? `${api}/inventory/transactions/${tx.id}/approve-issue/`
        : `${api}/inventory/transactions/${tx.id}/approve-return/`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Failed to approve request.");
      }

      Swal.fire({
        icon: "success",
        title: isIssue ? "Stock Issued!" : "Return Approved!",
        text: isIssue
          ? `${qty} ${unit} of "${itemName}" successfully issued to ${techName}.`
          : `+${qty} ${unit} of "${itemName}" successfully added back to inventory.`,
        timer: 2000,
        showConfirmButton: false
      });

      if (viewingRequest && viewingRequest.id === tx.id) {
        setViewingRequest(null);
      }

      await fetchRequests(false);
      if (onRefreshRef.current) onRefreshRef.current();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Approval Failed", text: err.message });
    } finally {
      setActionInProgress(null);
    }
  };

  // Reject Handler (Routes to reject-issue or reject-return)
  const handleReject = async (tx) => {
    const isIssue = tx.transaction_type === "ISSUE_STOCK";
    const itemName = tx.item_name || "Item";

    const { value: reason } = await Swal.fire({
      title: isIssue ? "Reject Stock Requisition?" : "Reject Return Request?",
      input: "text",
      inputLabel: `Specify reason for rejecting "${itemName}" ${isIssue ? "issue request" : "return"}:`,
      inputPlaceholder: isIssue
        ? "e.g. Item out of stock / Not required for this service..."
        : "e.g. Parts physically damaged / not received at warehouse...",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Reject Request",
      cancelButtonText: "Cancel",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "Please enter a reason for rejection.";
        }
      }
    });

    if (!reason) return;

    setActionInProgress(tx.id);
    try {
      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      const endpoint = isIssue
        ? `${api}/inventory/transactions/${tx.id}/reject-issue/`
        : `${api}/inventory/transactions/${tx.id}/reject-return/`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ reason: reason.trim() })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Failed to reject request.");
      }

      Swal.fire({
        icon: "info",
        title: "Request Rejected",
        text: `The ${isIssue ? "issue" : "return"} request was rejected. No inventory changes were made.`,
        timer: 1800,
        showConfirmButton: false
      });

      if (viewingRequest && viewingRequest.id === tx.id) {
        setViewingRequest(null);
      }

      await fetchRequests(false);
      if (onRefreshRef.current) onRefreshRef.current();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    } finally {
      setActionInProgress(null);
    }
  };

  // TableView Column Definitions
  const columns = useMemo(() => [
    {
      key: "index",
      label: "SR.",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (_, idx) => (
        <span className="text-xs text-slate-400 font-mono">
          {(currentPage - 1) * pageSize + idx + 1}
        </span>
      )
    },
    {
      key: "transaction_type",
      label: "TYPE",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (tx) => {
        const isIssue = tx.transaction_type === "ISSUE_STOCK";
        return isIssue ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
            <PackagePlus size={11} className="text-sky-600" />
            Stock Issue
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <RotateCcw size={11} className="text-amber-600" />
            Stock Return
          </span>
        );
      }
    },
    {
      key: "item_name",
      label: "SPARE PART / ITEM",
      className: "text-left whitespace-nowrap",
      headerClassName: "text-left whitespace-nowrap",
      render: (tx) => (
        <div className="text-left">
          <span className="font-bold text-slate-900 text-xs block truncate max-w-[200px]" title={tx.item_name || "Item"}>
            {tx.item_name || "Item"}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
            {tx.item_code && (
              <span className="font-mono text-slate-400">[{tx.item_code}]</span>
            )}
            {tx.item_capacity && (
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold text-[9px]">
                {tx.item_capacity}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: "quantity",
      label: "REQ. / RETURN QTY",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (tx) => {
        const isIssue = tx.transaction_type === "ISSUE_STOCK";
        const issuedQty = !isIssue ? getIssuedQuantity(tx) : null;

        if (isIssue) {
          return (
            <div className="flex flex-col items-center">
              <span className="font-black text-xs px-2 py-0.5 rounded-md inline-block whitespace-nowrap border text-sky-700 bg-sky-50 border-sky-200">
                {tx.quantity}{" "}
                <span className="text-[10px] font-normal text-sky-600">{tx.unit || "Nos"}</span>
              </span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                Requisition
              </span>
            </div>
          );
        }

        return (
          <div className="flex flex-col items-center">
            <span className="font-black text-xs px-2 py-0.5 rounded-md inline-block whitespace-nowrap border text-amber-700 bg-amber-50 border-amber-200">
              Returning: {tx.quantity}{" "}
              <span className="text-[10px] font-normal text-amber-600">{tx.unit || "Nos"}</span>
            </span>
            {issuedQty != null && (
              <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                Issued: <strong className="text-slate-800 font-bold">{issuedQty} {tx.unit || "Nos"}</strong>
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "available_stock",
      label: "WH STOCK",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (tx) => {
        const avail = tx.available_stock != null ? parseFloat(tx.available_stock) : null;
        const reqQty = parseFloat(tx.quantity || 0);
        const isIssue = tx.transaction_type === "ISSUE_STOCK";
        const isLow = isIssue && avail !== null && avail < reqQty;

        if (avail === null) {
          return <span className="text-slate-400 text-xs font-mono">—</span>;
        }

        return (
          <div className="text-center">
            <span
              className={`font-bold text-xs ${
                isLow ? "text-rose-600" : "text-slate-700"
              }`}
            >
              {avail} <span className="text-[10px] font-normal text-slate-400">{tx.unit || "Nos"}</span>
            </span>
            {isLow && (
              <span className="block text-[9px] font-bold text-rose-500 uppercase tracking-tight">
                Low Stock
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "technician_name",
      label: "TECHNICIAN",
      className: "text-left whitespace-nowrap",
      headerClassName: "text-left whitespace-nowrap",
      render: (tx) => (
        <div className="flex items-center gap-1.5 text-left">
          <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-[10px] shrink-0">
            {(tx.technician_name || "T").charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-800 text-xs">
            {tx.technician_name || "Technician"}
          </span>
        </div>
      )
    },
    {
      key: "reference_number",
      label: "JOB / PROJECT",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (tx) => {
        const ref = tx.service_number || tx.visit_number || tx.project_code || tx.reference_number;
        return (
          <div className="text-center">
            {ref ? (
              <span
                className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap inline-block"
                title={ref}
              >
                {ref}
              </span>
            ) : (
              <span className="text-slate-400 text-xs">—</span>
            )}
            {tx.target_info?.customer && (
              <div
                className="text-[10px] text-slate-500 truncate max-w-[130px] mx-auto mt-0.5"
                title={tx.target_info.customer}
              >
                {tx.target_info.customer}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: "notes",
      label: "REMARKS / REASON",
      className: "text-left whitespace-nowrap max-w-[170px] truncate",
      headerClassName: "text-left whitespace-nowrap",
      render: (tx) => (
        <span className="text-xs text-slate-600 truncate block max-w-[170px]" title={tx.notes || "-"}>
          {tx.notes || "—"}
        </span>
      )
    },
    {
      key: "created_at",
      label: "DATE",
      className: "text-center whitespace-nowrap text-slate-500 text-[11px]",
      headerClassName: "text-center whitespace-nowrap",
      render: (tx) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {tx.created_at
            ? new Date(tx.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              })
            : "—"}
        </span>
      )
    },
    {
      key: "status",
      label: "STATUS",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (tx) => {
        const s = tx.status || "COMPLETED";
        if (s === "PENDING_APPROVAL") {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
              <Clock size={10} /> Pending
            </span>
          );
        }
        if (s === "APPROVED" || s === "COMPLETED") {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
              <CheckCircle2 size={10} /> Approved
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <XCircle size={10} /> Rejected
          </span>
        );
      }
    }
  ], [currentPage, pageSize]);

  // Actions Renderer matching DS AQUA CRM inventory palette
  const actionsRenderer = useCallback((tx) => {
    const isPending = tx.status === "PENDING_APPROVAL";
    const isIssue = tx.transaction_type === "ISSUE_STOCK";

    return (
      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
        {isPending ? (
          <>
            {/* Approve Button */}
            <button
              type="button"
              disabled={actionInProgress === tx.id}
              onClick={() => handleApprove(tx)}
              className="px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
              title={isIssue ? "Approve stock issue and deduct from warehouse" : "Approve return and add back to warehouse"}
            >
              <Check size={11} />
              <span>{isIssue ? "Approve Issue" : "Approve Return"}</span>
            </button>

            {/* Reject Button */}
            <button
              type="button"
              disabled={actionInProgress === tx.id}
              onClick={() => handleReject(tx)}
              className="px-2 py-0.5 rounded border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
              title="Reject request"
            >
              <X size={11} />
              <span>Reject</span>
            </button>
          </>
        ) : (
          <span className="text-[10px] text-slate-400 font-medium">
            {tx.status === "REJECTED" ? "Declined" : isIssue ? "Issued" : "Inwarded"}
          </span>
        )}

        {/* View Details Button */}
        <button
          type="button"
          onClick={() => setViewingRequest(tx)}
          className="px-2 py-0.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
          title="View Request Details"
        >
          <Eye size={11} />
          <span>View</span>
        </button>
      </div>
    );
  }, [actionInProgress]);

  return (
    <div className="space-y-3.5 font-sans antialiased text-slate-800">
      {/* COMPACT HEADER BLOCK (EXACT PATTERN AS OTHER INVENTORY TABS) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-0.5 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-8 bg-sky-600 rounded-full block shrink-0" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
              Inventory Requests
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and manage field stock requisitions and unused part return approvals submitted by technicians.
            </p>
          </div>
        </div>

        {/* HEADER ACTIONS (QUICK FILTER DROPDOWN, ADVANCED FILTER & REFRESH) */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Quick Filter Dropdown matching Follow-up Management */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
            >
              <MdFilterList className="text-slate-400" />
              <span>{currentFilterLabel}</span>
            </button>

            {showFilterDropdown && (
              <>
                <div
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setShowFilterDropdown(false)}
                />
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTypeFilter(option.value);
                        setShowFilterDropdown(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer ${
                        typeFilter === option.value
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-slate-700"
                      }`}
                    >
                      <span>{option.label}</span>
                      {typeFilter === option.value && (
                        <span className="text-blue-600 font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isFilterOpen || searchQuery || statusFilter !== "PENDING_APPROVAL"
                ? "bg-sky-50 border-sky-300 text-sky-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter</span>
          </button>

          <button
            type="button"
            onClick={() => fetchRequests(true)}
            disabled={isLoading}
            className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh requests list"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 COMPACT STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div
          onClick={() => {
            setStatusFilter("PENDING_APPROVAL");
            setCurrentPage(1);
          }}
          className={`bg-white p-3 sm:p-3.5 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-amber-300 ${
            statusFilter === "PENDING_APPROVAL" ? "border-amber-300 ring-1 ring-amber-300" : "border-slate-200/80"
          }`}
          title="Click to view all pending requests"
        >
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Pending Requests
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-amber-700 block mt-0.5">
            {stats.pendingTotal} requests
          </span>
          <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
            {stats.pendingIssue} issue · {stats.pendingReturn} return
          </span>
        </div>

        <div
          onClick={() => {
            setTypeFilter("RETURN_STOCK");
            setCurrentPage(1);
          }}
          className={`bg-white p-3 sm:p-3.5 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-amber-300 ${
            typeFilter === "RETURN_STOCK" ? "border-amber-400 ring-1 ring-amber-400" : "border-slate-200/80"
          }`}
          title="Click to filter by Return Stock"
        >
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Return Approvals
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-amber-700 block mt-0.5">
            {stats.totalReturns} returned
          </span>
          <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
            {stats.pendingReturn} pending inwards
          </span>
        </div>

        <div
          onClick={() => {
            setTypeFilter("ISSUE_STOCK");
            setCurrentPage(1);
          }}
          className={`bg-white p-3 sm:p-3.5 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-sky-300 ${
            typeFilter === "ISSUE_STOCK" ? "border-sky-400 ring-1 ring-sky-400" : "border-slate-200/80"
          }`}
          title="Click to filter by Request Stock"
        >
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Stock Issue Requisitions
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-sky-700 block mt-0.5">
            {stats.totalIssues} requested
          </span>
          <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
            {stats.pendingIssue} pending approval
          </span>
        </div>

        <div
          onClick={() => {
            setStatusFilter("APPROVED");
            setCurrentPage(1);
          }}
          className={`bg-white p-3 sm:p-3.5 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-emerald-300 ${
            statusFilter === "APPROVED" ? "border-emerald-400 ring-1 ring-emerald-400" : "border-slate-200/80"
          }`}
          title="Click to view fulfilled / approved requests"
        >
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Fulfilled / Completed
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-emerald-700 block mt-0.5">
            {stats.approvedCount} approved
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            {stats.rejectedCount} rejected requests
          </span>
        </div>
      </div>

      {/* FILTER BAR (COLLAPSIBLE, SEARCH + TYPE + STATUS PILLS) */}
      {isFilterOpen && (
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 animate-fade-in">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search spare part, SKU, technician, service or AMC visit number, customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Request Type Segmented Buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
              {[
                { id: "ALL", label: "All Records" },
                { id: "RETURN_STOCK", label: "Return Stock" },
                { id: "ISSUE_STOCK", label: "Request Stock" }
              ].map((tp) => (
                <button
                  key={tp.id}
                  onClick={() => {
                    setTypeFilter(tp.id);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer ${
                    typeFilter === tp.id
                      ? "bg-white text-sky-700 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tp.label}
                </button>
              ))}
            </div>

            {/* Status Segmented Buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
              {[
                { id: "PENDING_APPROVAL", label: "Pending" },
                { id: "APPROVED", label: "Approved" },
                { id: "REJECTED", label: "Rejected" },
                { id: "ALL", label: "All Status" }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setStatusFilter(st.id);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer ${
                    statusFilter === st.id
                      ? "bg-white text-sky-700 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {st.label}
                  {st.id === "PENDING_APPROVAL" && stats.pendingTotal > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-100 text-amber-800">
                      {stats.pendingTotal}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("ALL");
                setStatusFilter("PENDING_APPROVAL");
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* REUSED TABLE VIEW */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <TableView
          columns={columns}
          rows={paginatedList}
          loading={isLoading}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          actions={actionsRenderer}
          emptyMessage="No stock requests or return approvals found matching your filters."
        />
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewingRequest && (() => {
        const isViewingReturn = viewingRequest.transaction_type === "RETURN_STOCK";
        const viewingIssuedQty = isViewingReturn ? getIssuedQuantity(viewingRequest) : null;
        const viewingReturnQty = isViewingReturn ? parseFloat(viewingRequest.quantity || 0) : null;
        const viewingUsedQty =
          viewingIssuedQty != null && viewingReturnQty != null
            ? Math.max(0, viewingIssuedQty - viewingReturnQty)
            : null;

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {isViewingReturn ? (
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                  ) : (
                    <PackagePlus className="w-4 h-4 text-sky-600" />
                  )}
                  <h3 className="font-bold text-sm text-slate-900">
                    {isViewingReturn
                      ? "Stock Return Approval Details"
                      : "Stock Issue Requisition Details"}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingRequest(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4 text-xs overflow-y-auto">
                {/* Item Info Box */}
                <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/70 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Spare Part / Material
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {viewingRequest.item_name || "Item"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {viewingRequest.item_capacity && (
                        <span className="px-1.5 py-0.5 bg-slate-200/70 text-slate-700 font-semibold rounded text-[10px]">
                          {viewingRequest.item_capacity}
                        </span>
                      )}
                      <span className="font-mono text-xs text-slate-500 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                        {viewingRequest.item_code || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RETURN STOCK QUANTITY COMPARISON (Issued vs Returning) */}
                {isViewingReturn ? (
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                        <RotateCcw size={12} className="text-amber-600" />
                        Stock Reconciliation Breakdown
                      </span>
                      <span className="text-[10px] font-medium text-amber-800 bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                        Field Part Return
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Originally Issued Qty */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                          Issued Qty
                        </span>
                        <span className="text-base font-black text-sky-700 block mt-0.5">
                          {viewingIssuedQty != null ? (
                            `${viewingIssuedQty} ${viewingRequest.unit || "Nos"}`
                          ) : (
                            <span className="text-slate-400 font-normal text-xs">Not recorded</span>
                          )}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          Previously issued to job
                        </span>
                      </div>

                      {/* Now Returning Qty */}
                      <div className="bg-white p-3 rounded-lg border-2 border-amber-400 shadow-2xs ring-2 ring-amber-100">
                        <span className="text-[10px] text-amber-800 block font-bold uppercase tracking-wider">
                          Now Returning
                        </span>
                        <span className="text-base font-black text-amber-700 block mt-0.5">
                          {viewingRequest.quantity} {viewingRequest.unit || "Nos"}
                        </span>
                        <span className="text-[9px] text-amber-600 font-medium block mt-0.5">
                          Returning to warehouse
                        </span>
                      </div>

                      {/* Retained / Used Qty */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                          Used / On Site
                        </span>
                        <span className="text-base font-black text-emerald-700 block mt-0.5">
                          {viewingUsedQty != null ? (
                            `${viewingUsedQty} ${viewingRequest.unit || "Nos"}`
                          ) : (
                            "—"
                          )}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          Installed / consumed
                        </span>
                      </div>
                    </div>

                    {/* Warehouse Inventory Stock Summary Bar */}
                    <div className="flex items-center justify-between bg-white/80 px-3 py-2 rounded-lg border border-amber-200/60 text-[11px]">
                      <span className="text-slate-600 font-medium">
                        Warehouse Stock if Approved:{" "}
                        <strong className="text-emerald-700 font-bold">
                          {viewingRequest.available_stock != null
                            ? `${parseFloat(viewingRequest.available_stock || 0) + (viewingRequest.status === "PENDING_APPROVAL" ? parseFloat(viewingRequest.quantity || 0) : 0)} ${viewingRequest.unit || "Nos"}`
                            : "—"}
                        </strong>
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Current Available: {viewingRequest.available_stock != null ? `${viewingRequest.available_stock} ${viewingRequest.unit || "Nos"}` : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* ISSUE STOCK REQUISITION CARD */
                  <div className="grid grid-cols-3 gap-2 bg-sky-50/50 p-3 rounded-xl border border-sky-100">
                    <div className="bg-white p-3 rounded-lg border border-sky-200 shadow-2xs">
                      <span className="text-[10px] text-sky-800 font-bold uppercase tracking-wider block">
                        Requested Qty
                      </span>
                      <span className="text-base font-black text-sky-700 block mt-0.5">
                        {viewingRequest.quantity} {viewingRequest.unit || "Nos"}
                      </span>
                      <span className="text-[9px] text-sky-600 block mt-0.5">
                        Requested by technician
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                        Warehouse Stock
                      </span>
                      <span className="text-base font-black text-slate-800 block mt-0.5">
                        {viewingRequest.available_stock != null
                          ? `${viewingRequest.available_stock} ${viewingRequest.unit || "Nos"}`
                          : "—"}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Currently in store
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                        Stock After Issue
                      </span>
                      <span
                        className={`text-base font-black block mt-0.5 ${
                          viewingRequest.available_stock != null &&
                          parseFloat(viewingRequest.available_stock) < parseFloat(viewingRequest.quantity || 0)
                            ? "text-rose-600"
                            : "text-slate-800"
                        }`}
                      >
                        {viewingRequest.available_stock != null
                          ? `${Math.max(
                              0,
                              parseFloat(viewingRequest.available_stock || 0) -
                                (viewingRequest.status === "PENDING_APPROVAL"
                                  ? parseFloat(viewingRequest.quantity || 0)
                                  : 0)
                            )} ${viewingRequest.unit || "Nos"}`
                          : "—"}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Projected store balance
                      </span>
                    </div>
                  </div>
                )}

                {/* Technician & Job Context */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-slate-200/70 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                      Requested By (Technician)
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-xs">
                        {(viewingRequest.technician_name || "T").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">
                          {viewingRequest.technician_name || "Technician"}
                        </span>
                        {viewingRequest.technician_mobile && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {viewingRequest.technician_mobile}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200/70 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                      {viewingRequest.target_info?.type === "PROJECT" ? "Target Project" : "Target Service / AMC Visit"}
                    </span>
                    <div className="mt-1">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block">
                        {viewingRequest.service_number ||
                          viewingRequest.visit_number ||
                          viewingRequest.project_code ||
                          viewingRequest.reference_number ||
                          "—"}
                      </span>
                      {viewingRequest.target_info?.customer && (
                        <span className="text-[10px] text-slate-600 block truncate mt-1">
                          {viewingRequest.target_info.customer}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remarks / Reason */}
                <div className="border border-slate-200/70 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                    Technician Remarks / Justification
                  </span>
                  <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">
                    {viewingRequest.notes || "No remarks provided by technician."}
                  </p>
                </div>

                {/* Status & Approver Info */}
                <div className="flex items-center justify-between p-3 bg-slate-50/60 rounded-lg border border-slate-200/60">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Current Status</span>
                    <div className="mt-0.5">
                      {viewingRequest.status === "PENDING_APPROVAL" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={10} /> Pending Warehouse Approval
                        </span>
                      )}
                      {(viewingRequest.status === "APPROVED" || viewingRequest.status === "COMPLETED") && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={10} /> Approved
                        </span>
                      )}
                      {viewingRequest.status === "REJECTED" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle size={10} /> Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Requested Date</span>
                    <span className="text-xs font-medium text-slate-700">
                      {viewingRequest.created_at
                        ? new Date(viewingRequest.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200/80 flex items-center justify-end gap-2 shrink-0">
                {viewingRequest.status === "PENDING_APPROVAL" ? (
                  <>
                    <button
                      type="button"
                      disabled={actionInProgress === viewingRequest.id}
                      onClick={() => handleReject(viewingRequest)}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <X size={12} />
                      <span>Reject Request</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionInProgress === viewingRequest.id}
                      onClick={() => handleApprove(viewingRequest)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      <Check size={12} />
                      <span>
                        {isViewingReturn ? "Approve & Inward" : "Approve & Issue"}
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setViewingRequest(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
