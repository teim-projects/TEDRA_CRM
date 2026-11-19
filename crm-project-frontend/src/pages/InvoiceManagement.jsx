import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MdAdd,
  MdFilterList,
  MdEdit,
  MdDelete,
  MdRemoveRedEye,
  MdDownload
} from "react-icons/md";
import { Search } from "lucide-react";
import Swal from "sweetalert2";
import Base from "../components/Base";
import TableView from "../components/TableView";
import AddInvoiceModal from "../components/invoice/AddInvoiceModal";
import { getBaseApiUrl } from "../utils/apiConfig";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";

export default function InvoiceManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseApi = getBaseApiUrl();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState(() => searchParams.get("filter") || "all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // KPI Summary
  const [summary, setSummary] = useState({
    total_count: 0,
    total_billed: 0,
    total_received: 0,
    total_balance: 0,
    paid_count: 0,
    partial_count: 0,
    unpaid_count: 0
  });

  // Auto-open modal if ?create=true
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowInvoiceModal(true);
      setEditingInvoice(null);
    }
  }, [searchParams]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token =
        localStorage.getItem("access") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        "";
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`${baseApi}/invoice/invoices/?limit=1000`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      setInvoices(list);

      // Summary KPIs
      const sumRes = await fetch(`${baseApi}/invoice/invoices/summary/`, { headers });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }
    } catch (err) {
      console.error("Fetch invoices error:", err);
      setError(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [baseApi]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // View PDF / HTML in new browser tab (Exact 1:1 match with Quotation's handleViewPDF)
  const handleViewPDF = async (invoiceId) => {
    Swal.fire({
      title: "Opening Tax Invoice...",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 50%; animation: spinPdf 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Generating document, please wait...</p>
        </div>
        <style>
          @keyframes spinPdf { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    try {
      const token =
        localStorage.getItem("access") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        "";
      const url = `${baseApi}/invoice/invoices/${invoiceId}/pdf/?disposition=inline`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errMsg = `Server returned HTTP ${response.status}`;
        try {
          const errText = await response.text();
          if (errText) {
            errMsg = `${errMsg}: ${errText.slice(0, 150)}`;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type") || "";
      const blob = await response.blob();
      const fileType = contentType.includes("pdf") ? "application/pdf" : "text/html";
      const typedBlob = new Blob([blob], { type: fileType });
      const fileURL = URL.createObjectURL(typedBlob);

      Swal.close();

      const newWindow = window.open(fileURL, "_blank");
      if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
        const link = document.createElement("a");
        link.href = fileURL;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to open invoice document"
      });
    }
  };

  // Download PDF file
  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    Swal.fire({
      title: "Downloading Invoice PDF...",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #16a34a; border-radius: 50%; animation: spinPdfDown 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Generating PDF file, please wait...</p>
        </div>
        <style>
          @keyframes spinPdfDown { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    try {
      const token =
        localStorage.getItem("access") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        "";
      const url = `${baseApi}/invoice/invoices/${invoiceId}/pdf/?disposition=attachment`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errMsg = `Server returned HTTP ${response.status}`;
        try {
          const errText = await response.text();
          if (errText) errMsg = `${errMsg}: ${errText.slice(0, 150)}`;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const file = new Blob([blob], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = `Tax_Invoice_${invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      Swal.close();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: err.message || "Failed to download PDF"
      });
    }
  };

  // Delete Action
  const handleDelete = (id, invNum) => {
    Swal.fire({
      title: "Delete Invoice?",
      text: `Are you sure you want to permanently delete Tax Invoice #${invNum}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token =
            localStorage.getItem("access") ||
            localStorage.getItem("access_token") ||
            localStorage.getItem("token") ||
            localStorage.getItem("authToken") ||
            "";
          const res = await fetch(`${baseApi}/invoice/invoices/${id}/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error("Delete failed");
          Swal.fire("Deleted!", `Invoice #${invNum} has been deleted.`, "success");
          fetchInvoices();
        } catch (err) {
          Swal.fire("Error", "Could not delete invoice", "error");
        }
      }
    });
  };

  // Filter options
  const filterOptions = [
    { value: "all", label: "All Records" },
    { value: "project", label: "Project Invoices" },
    { value: "amc", label: "AMC Invoices" },
    { value: "service", label: "Service Invoices" },
    { value: "direct", label: "Direct Invoices" },
    { value: "paid", label: "Paid Invoices" },
    { value: "unpaid", label: "Pending / Unpaid" }
  ];

  const currentFilterLabel = filterOptions.find((o) => o.value === filterType)?.label || "All Records";

  // Filtered dataset
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterType === "project" && inv.invoice_type !== "PROJECT") return false;
      if (filterType === "amc" && inv.invoice_type !== "AMC") return false;
      if (filterType === "service" && inv.invoice_type !== "SERVICE") return false;
      if (filterType === "direct" && inv.invoice_type !== "DIRECT") return false;
      if (filterType === "paid" && inv.status !== "PAID") return false;
      if (filterType === "unpaid" && inv.status !== "UNPAID" && inv.status !== "PARTIAL") return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesNum = (inv.invoice_number || "").toLowerCase().includes(q);
        const matchesName = (inv.bill_to_name || "").toLowerCase().includes(q);
        const matchesGstin = (inv.bill_to_gstin || "").toLowerCase().includes(q);
        const matchesContact = (inv.bill_to_contact || "").toLowerCase().includes(q);
        const matchesJob = (inv.job_code || "").toLowerCase().includes(q);
        const matchesPo = (inv.po_number || "").toLowerCase().includes(q);
        return matchesNum || matchesName || matchesGstin || matchesContact || matchesJob || matchesPo;
      }

      return true;
    });
  }, [invoices, filterType, searchTerm]);

  // Pagination
  const totalCount = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const currentPageData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Export to Excel
  const handleExportExcel = () => {
    const formatted = filteredInvoices.map((inv, idx) => ({
      "Sr No": idx + 1,
      "Invoice No": inv.invoice_number || `INV-${inv.id}`,
      "Date": formatExcelDate(inv.invoice_date),
      "Source": inv.invoice_type,
      "Job Code": inv.job_code || "-",
      "Customer / Bill To": inv.bill_to_name || "-",
      "Contact": inv.bill_to_contact || "-",
      "GSTIN": inv.bill_to_gstin || "-",
      "Subtotal (₹)": parseFloat(inv.subtotal || 0),
      "Discount (₹)": parseFloat(inv.discount_total || 0),
      "GST Total (₹)": (parseFloat(inv.cgst_amount || 0) + parseFloat(inv.sgst_amount || 0) + parseFloat(inv.igst_amount || 0)),
      "Grand Total (₹)": parseFloat(inv.grand_total || 0),
      "Received (₹)": parseFloat(inv.received_amount || 0),
      "Balance (₹)": parseFloat(inv.balance_amount || 0),
      "Status": inv.status || "PAID"
    }));

    exportToExcel({
      data: formatted,
      fileName: "Tax_Invoices",
      sheetName: "Invoices"
    });
  };

  // Table Columns - Single-line compact cells matching Quotation row height
  const columns = [
    {
      key: "sr",
      label: "Sr.No",
      render: (_, idx) => (
        <span className="text-slate-600 font-medium text-xs whitespace-nowrap block">
          {(currentPage - 1) * itemsPerPage + (idx + 1)}
        </span>
      ),
      className: "w-12 whitespace-nowrap text-center",
    },
    {
      key: "invoice_number",
      label: "Invoice No",
      render: (r) => (
        <span
          className="text-blue-600 font-bold text-xs whitespace-nowrap cursor-pointer hover:underline block"
          onClick={() => handleViewPDF(r.id)}
          title="Click to view Tax Invoice PDF"
        >
          #{r.invoice_number}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "bill_to_name",
      label: "Company / Client",
      render: (r) => (
        <span
          className="text-slate-900 font-semibold text-xs tracking-tight block max-w-[170px] truncate mx-auto cursor-pointer hover:text-blue-600"
          title={r.bill_to_name || ""}
          onClick={() => handleViewPDF(r.id)}
        >
          {r.bill_to_name || "-"}
        </span>
      ),
      className: "min-w-[130px] max-w-[180px] text-center",
    },
    {
      key: "bill_to_contact",
      label: "Contact",
      render: (r) => (
        <span
          className="text-slate-700 text-xs block max-w-[130px] truncate mx-auto cursor-default"
          title={r.bill_to_contact || ""}
        >
          {r.bill_to_contact || "-"}
        </span>
      ),
      className: "min-w-[110px] max-w-[140px] text-center",
    },
    {
      key: "invoice_type",
      label: "Type",
      render: (r) => {
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (r.invoice_type === "PROJECT") badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
        if (r.invoice_type === "AMC") badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
        if (r.invoice_type === "SERVICE") badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
        return (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider whitespace-nowrap ${badgeColor}`}>
            {r.invoice_type}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
    {
      key: "grand_total",
      label: "Total Amount",
      render: (r) => (
        <span className="text-slate-900 font-bold text-xs whitespace-nowrap block" title={formatCurrency(r.grand_total)}>
          {formatCurrency(r.grand_total)}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "received_amount",
      label: "Received",
      render: (r) => (
        <span className="text-emerald-700 font-semibold text-xs whitespace-nowrap block">
          {formatCurrency(r.received_amount)}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "balance_amount",
      label: "Balance",
      render: (r) => {
        const bal = parseFloat(r.balance_amount) || 0;
        return (
          <span className={`text-xs whitespace-nowrap block font-semibold ${bal > 0 ? "text-rose-600" : "text-slate-400"}`}>
            {formatCurrency(bal)}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
    {
      key: "invoice_date",
      label: "Date",
      render: (r) => (
        <span className="text-slate-600 text-xs whitespace-nowrap block" title={formatDate(r.invoice_date)}>
          {formatDate(r.invoice_date)}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const s = (r.status || "PAID").toUpperCase();
        let color = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (s === "PARTIAL") color = "bg-amber-50 text-amber-700 border-amber-200";
        if (s === "UNPAID") color = "bg-rose-50 text-rose-700 border-rose-200";
        if (s === "CANCELLED") color = "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider whitespace-nowrap ${color}`}>
            {s}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
  ];

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* HEADER BLOCK WITH SKY BLUE ACCENT LINE MATCHING QUOTATION */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Invoice Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? "Synchronizing invoice records..." : `${totalCount} records found`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Search Bar in Header Toolbar */}
            <div className="relative w-40 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search invoices..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 placeholder:text-slate-400 text-slate-800 shadow-2xs"
              />
            </div>

            {/* Quick Filter Dropdown */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
              >
                <MdFilterList className="text-slate-400" />
                {currentFilterLabel}
              </button>

              {showFilterDropdown && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 font-sans">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFilterType(option.value);
                        setShowFilterDropdown(false);
                        setCurrentPage(1);
                        const newParams = new URLSearchParams(searchParams);
                        if (option.value === "all") newParams.delete("filter");
                        else newParams.set("filter", option.value);
                        setSearchParams(newParams, { replace: true });
                      }}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer ${filterType === option.value ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"
                        }`}
                    >
                      <span>{option.label}</span>
                      {filterType === option.value && <span className="text-blue-600 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
              title="Export Invoices to Excel"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              Export
            </button>

            {/* Add Invoice (Exact Quotation Add Button UI) */}
            <button
              type="button"
              onClick={() => {
                setEditingInvoice(null);
                setShowInvoiceModal(true);
              }}
              className="px-3 sm:px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <MdAdd className="text-sm" />
              Add Invoice
            </button>
          </div>
        </div>

        {/* 4 TOP KPI STATS CARDS MATCHING QUOTATION */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Total Invoices</span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {summary.total_count || invoices.length} invoices
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">All tax invoice records</span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Total Billed</span>
            <span className="text-xs sm:text-[13px] font-bold text-sky-700 block mt-0.5">
              {formatCurrency(summary.total_billed)}
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5">Gross revenue invoiced</span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Total Received</span>
            <span className="text-xs sm:text-[13px] font-bold text-emerald-700 block mt-0.5">
              {formatCurrency(summary.total_received)}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Payment collected</span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Pending Balance</span>
            <span className="text-xs sm:text-[13px] font-bold text-rose-700 block mt-0.5">
              {formatCurrency(summary.total_balance)}
            </span>
            <span className="text-[10px] text-rose-600 font-medium block mt-0.5">Outstanding receivables</span>
          </div>
        </div>

        {/* INVOICE TABLE VIEW MATCHING QUOTATION */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <TableView
            columns={columns}
            rows={currentPageData}
            loading={loading}
            error={error}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            pageSize={itemsPerPage}
            emptyMessage="No invoice records found."
            actions={(row) => (
              <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                {/* View PDF (Exact Quotation View PDF behavior) */}
                <button
                  type="button"
                  onClick={() => handleViewPDF(row.id)}
                  className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
                  title="View Tax Invoice (PDF / HTML)"
                >
                  <MdRemoveRedEye />
                </button>

                {/* Edit Invoice (Opens Popup Form) */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingInvoice(row);
                    setShowInvoiceModal(true);
                  }}
                  className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
                  title="Edit Invoice"
                >
                  <MdEdit />
                </button>

                {/* Download PDF */}
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(row.id, row.invoice_number)}
                  className="p-1 bg-slate-100 hover:bg-green-100 text-slate-600 hover:text-green-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
                  title="Download Invoice PDF"
                >
                  <MdDownload />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(row.id, row.invoice_number)}
                  className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
                  title="Delete Invoice"
                >
                  <MdDelete />
                </button>
              </div>
            )}
          />
        </div>
      </div>

      {/* ADD / EDIT INVOICE POPUP MODAL (Matching AddQuotation Style) */}
      {showInvoiceModal && (
        <AddInvoiceModal
          key={editingInvoice ? `edit-${editingInvoice.id}` : `new-${Date.now()}`}
          isOpen={showInvoiceModal}
          invoiceId={editingInvoice?.id}
          initialInvoice={editingInvoice}
          onClose={() => {
            setShowInvoiceModal(false);
            setEditingInvoice(null);
            if (searchParams.get("create")) {
              const p = new URLSearchParams(searchParams);
              p.delete("create");
              setSearchParams(p, { replace: true });
            }
          }}
          onSuccess={(saved) => {
            fetchInvoices();
            if (saved?.id) {
              Swal.fire({
                title: "Invoice Generated!",
                text: `Tax Invoice #${saved.invoice_number || ""} saved. View document now?`,
                icon: "success",
                showCancelButton: true,
                confirmButtonColor: "#0284c7",
                cancelButtonColor: "#64748b",
                confirmButtonText: "View Document",
                cancelButtonText: "Close"
              }).then((res) => {
                if (res.isConfirmed) {
                  handleViewPDF(saved.id);
                }
              });
            }
          }}
        />
      )}
    </Base>
  );
}
