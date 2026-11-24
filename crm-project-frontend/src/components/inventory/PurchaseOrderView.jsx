import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  PlusCircle,
  FileText
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import TableView from "../TableView";

export default function PurchaseOrderView({ onRefreshParentCounts, onNavigateTab, baseApi: propBaseApi }) {
  const baseApi = (propBaseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // View Modal
  const [viewingPO, setViewingPO] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    vendor: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_delivery_date: "",
    notes: "",
    terms_and_conditions: "Standard delivery within 7 working days. Payment as per terms.",
    items: [
      {
        item: "",
        quantity: 1,
        unit_price: 0,
        tax_percent: 18
      }
    ]
  });

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access");
      const headers = { Authorization: `Bearer ${token}` };

      const [poRes, vRes, itemsRes] = await Promise.all([
        fetch(`${baseApi}/inventory/purchase-orders/`, { headers }),
        fetch(`${baseApi}/inventory/vendors/`, { headers }),
        fetch(`${baseApi}/inventory/items/`, { headers })
      ]);

      if (poRes.ok) {
        const data = await poRes.json();
        setOrders(Array.isArray(data) ? data : data.results || []);
      }
      if (vRes.ok) {
        const data = await vRes.json();
        setVendors(Array.isArray(data) ? data : data.results || []);
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setInventoryItems(Array.isArray(data) ? data : data.results || []);
      }
      if (onRefreshParentCounts) onRefreshParentCounts();
    } catch (err) {
      console.error("Error fetching purchase orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openCreateModal = () => {
    setFormData({
      vendor: vendors[0]?.id || "",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      notes: "",
      terms_and_conditions: "Standard delivery within 7 working days. Payment as per terms.",
      items: [
        {
          item: inventoryItems[0]?.id || "",
          quantity: 1,
          unit_price: inventoryItems[0]?.unit_price || 0,
          tax_percent: 18
        }
      ]
    });
    setErrorMsg("");
    setIsCreateOpen(true);
  };

  const handleAddItemRow = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          item: inventoryItems[0]?.id || "",
          quantity: 1,
          unit_price: inventoryItems[0]?.unit_price || 0,
          tax_percent: 18
        }
      ]
    });
  };

  const handleRemoveItemRow = (idx) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== idx);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (idx, field, value) => {
    const newItems = [...formData.items];
    newItems[idx][field] = value;

    if (field === "item") {
      const selected = inventoryItems.find((it) => it.id === Number(value));
      if (selected) {
        newItems[idx].unit_price = Number(selected.unit_price) || 0;
      }
    }
    setFormData({ ...formData, items: newItems });
  };

  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    formData.items.forEach((row) => {
      const qty = Number(row.quantity) || 0;
      const price = Number(row.unit_price) || 0;
      const taxPct = Number(row.tax_percent) || 0;

      const rowSub = qty * price;
      const rowTax = rowSub * (taxPct / 100);

      subtotal += rowSub;
      taxAmount += rowTax;
    });

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount
    };
  }, [formData.items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vendor) {
      setErrorMsg("Please select a vendor.");
      return;
    }
    if (formData.items.some((row) => !row.item || Number(row.quantity) <= 0)) {
      setErrorMsg("Please ensure all items are selected with valid quantities.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const token = localStorage.getItem("access");
      const mappedItems = formData.items.map((row) => ({
        item: Number(row.item),
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        tax_percent: Number(row.tax_percent)
      }));

      const payload = {
        vendor: Number(formData.vendor),
        order_date: formData.order_date,
        expected_delivery_date: formData.expected_delivery_date || null,
        notes: formData.notes,
        terms_and_conditions: formData.terms_and_conditions,
        status: "ORDERED",
        items: mappedItems,
        items_data: mappedItems
      };

      const res = await fetch(`${baseApi}/inventory/purchase-orders/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsCreateOpen(false);
        fetchOrders();
      } else {
        let errMsg = "Failed to create Purchase Order.";
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await res.json();
            errMsg =
              errData.detail ||
              errData.error ||
              (errData.vendor && `Vendor: ${errData.vendor[0]}`) ||
              JSON.stringify(errData);
          } else {
            errMsg = `Server error (${res.status}). Please check input details.`;
          }
        } catch {
          errMsg = `Server error (${res.status}).`;
        }
        setErrorMsg(errMsg);
      }
    } catch (err) {
      console.error("Create PO error:", err);
      setErrorMsg("Error communicating with server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (poId, newStatus) => {
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${baseApi}/inventory/purchase-orders/${poId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchOrders();
        if (viewingPO && viewingPO.id === poId) {
          setViewingPO((prev) => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleDelete = async (poId, poNumber) => {
    if (!window.confirm(`Delete Purchase Order "${poNumber}"?`)) return;
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${baseApi}/inventory/purchase-orders/${poId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchOrders();
        if (viewingPO && viewingPO.id === poId) setViewingPO(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "ORDERED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck className="w-2.5 h-2.5" /> Ordered
          </span>
        );
      case "PARTIALLY_RECEIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-2.5 h-2.5" /> Partial
          </span>
        );
      case "RECEIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" /> Received
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-2.5 h-2.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orders.filter((po) => {
      const matchesSearch =
        !q ||
        po.po_number?.toLowerCase().includes(q) ||
        po.vendor_name?.toLowerCase().includes(q) ||
        po.notes?.toLowerCase().includes(q);

      const matchesStatus = selectedStatus === "ALL" || po.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, selectedStatus]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const totalSpend = useMemo(() => {
    return orders.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
  }, [orders]);

  // Reusable TableView Columns definition (Matching Lead & Quotation row height)
  const columns = useMemo(() => [
    {
      key: "po_number",
      label: "PO NUMBER / REF",
      className: "text-left pl-3 whitespace-nowrap",
      headerClassName: "text-left pl-3 whitespace-nowrap",
      render: (po) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-bold text-slate-900 font-mono text-xs">
            {po.po_number}
          </span>
          {po.created_by_name && (
            <span className="text-[10px] text-slate-400">
              ({po.created_by_name})
            </span>
          )}
        </div>
      )
    },
    {
      key: "vendor_name",
      label: "SUPPLIER / VENDOR",
      className: "text-left whitespace-nowrap truncate max-w-[180px]",
      headerClassName: "text-left whitespace-nowrap",
      render: (po) => (
        <span className="font-semibold text-slate-800 text-xs uppercase truncate block max-w-[180px]" title={po.vendor_name}>
          {po.vendor_name}
        </span>
      )
    },
    {
      key: "order_date",
      label: "ORDER DATE",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (po) => <span className="text-xs text-slate-600 whitespace-nowrap">{po.order_date}</span>
    },
    {
      key: "expected_delivery_date",
      label: "DELIVERY DATE",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (po) => <span className="text-xs text-slate-600 whitespace-nowrap">{po.expected_delivery_date || "-"}</span>
    },
    {
      key: "items_count",
      label: "ITEMS",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (po) => <span className="font-bold text-slate-700 text-xs">{po.items?.length || 0}</span>
    },
    {
      key: "total_amount",
      label: "TOTAL AMOUNT",
      className: "text-right pr-3 whitespace-nowrap",
      headerClassName: "text-right pr-3 whitespace-nowrap",
      render: (po) => (
        <span className="font-bold text-slate-900 text-xs whitespace-nowrap block">
          ₹{Number(po.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: "status",
      label: "STATUS",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (po) => getStatusBadge(po.status)
    }
  ], []);

  const actionsRenderer = useCallback((po) => (
    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
      {po.status !== "RECEIVED" && po.status !== "CANCELLED" && (
        <button
          onClick={() => {
            if (onNavigateTab) onNavigateTab("grn", po.id);
          }}
          className="px-1.5 py-0.5 rounded border border-teal-300 text-teal-700 bg-teal-50/50 hover:bg-teal-100 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
          title="Receive Material & Record GRN"
        >
          + GRN
        </button>
      )}

      <button
        onClick={() => setViewingPO(po)}
        className="px-2 py-0.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        title="View PO Details"
      >
        View
      </button>

      {po.status === "DRAFT" && (
        <button
          onClick={() => handleDelete(po.id, po.po_number)}
          className="px-2 py-0.5 text-xs font-medium rounded bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
          title="Delete PO"
        >
          Delete
        </button>
      )}
    </div>
  ), [onNavigateTab]);

  return (
    <div className="space-y-3.5 font-sans antialiased text-slate-800">
      {/* COMPACT HEADER BLOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-0.5 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-8 bg-sky-600 rounded-full block shrink-0" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
              Purchase Orders
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track and manage procurement orders, order fulfillment, and supplier delivery status.
            </p>
          </div>
        </div>

        {/* COMPACT ACTION BUTTONS */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`col-span-1 w-full sm:w-auto px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${isFilterOpen || searchQuery || selectedStatus !== "ALL"
              ? "bg-sky-50 border-sky-300 text-sky-700"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Filter</span>
          </button>

          <button
            onClick={openCreateModal}
            className="col-span-1 w-full sm:w-auto px-3 sm:px-3.5 py-2 sm:py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Create PO</span>
            <span className="hidden sm:inline">Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* COMPACT STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total Purchase Orders
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-slate-900 block mt-0.5">
            {orders.length} orders
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            All issued procurements
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Pending / In Transit
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-blue-700 block mt-0.5">
            {orders.filter((o) => o.status === "ORDERED" || o.status === "PARTIALLY_RECEIVED").length} pending
          </span>
          <span className="text-[10px] text-blue-600 font-medium block mt-0.5">
            Awaiting supplier dispatch
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Completed / Received
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-emerald-700 block mt-0.5">
            {orders.filter((o) => o.status === "RECEIVED").length} fulfilled
          </span>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            Stock verified & updated
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total Procurement Spend
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-slate-900 block mt-0.5">
            ₹{Number(totalSpend).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            Cumulative order volume
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
              placeholder="Search PO by number or vendor name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
              {["ALL", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded text-[11px] transition-all ${selectedStatus === st
                    ? "bg-white text-sky-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  {st === "ALL" ? "All" : st.replace("_", " ")}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("ALL");
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
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
          rows={paginatedOrders}
          loading={isLoading}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          actions={actionsRenderer}
          emptyMessage="No purchase orders found matching your filters."
        />
      </div>

      {/* CREATE PURCHASE ORDER MODAL (SPACIOUS FULL SIZE) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-4xl w-full mx-auto my-2 sm:my-6 relative max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden">
            <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <ShoppingCart size={20} className="sm:w-[22px] sm:h-[22px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
                    Issue New Purchase Order
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Order raw materials, membranes, pumps, and spares from authorized vendors
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-slate-800 scrollbar-thin">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 text-sm">
                {errorMsg && (
                  <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Select Vendor <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    >
                      <option value="">-- Choose Vendor --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.vendor_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Order Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.order_date}
                      onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Expected Delivery Date
                    </label>
                    <input
                      type="date"
                      value={formData.expected_delivery_date}
                      onChange={(e) =>
                        setFormData({ ...formData, expected_delivery_date: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    />
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Order Items
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" /> Add Item
                    </button>
                  </div>

                  <div className="p-3 sm:p-3.5 space-y-2.5">
                    {formData.items.map((row, idx) => {
                      const rowTotal =
                        Number(row.quantity) * Number(row.unit_price) * (1 + Number(row.tax_percent) / 100);
                      return (
                        <div
                          key={idx}
                          className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 text-xs space-y-2.5 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center"
                        >
                          <div className="sm:col-span-5 space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-[11px] font-semibold text-slate-600">
                                Item
                              </label>
                              {formData.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="sm:hidden text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Remove item"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <select
                              value={row.item}
                              onChange={(e) => handleItemChange(idx, "item", e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg truncate"
                            >
                              <option value="">-- Choose Item --</option>
                              {inventoryItems.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({it.item_code}) {it.capacity ? `[${it.capacity}]` : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-10 gap-2 sm:contents">
                            <div className="col-span-3 sm:col-span-2 space-y-1">
                              <label className="block text-[11px] font-semibold text-slate-600">
                                Qty
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={row.quantity}
                                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs bg-white border border-slate-200 rounded-lg text-right font-semibold"
                              />
                            </div>

                            <div className="col-span-4 sm:col-span-2 space-y-1">
                              <label className="block text-[11px] font-semibold text-slate-600">
                                Price (₹)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.unit_price}
                                onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs bg-white border border-slate-200 rounded-lg text-right"
                              />
                            </div>

                            <div className="col-span-3 sm:col-span-2 text-right space-y-1">
                              <label className="block text-[11px] font-semibold text-slate-600">
                                Total
                              </label>
                              <span className="font-bold text-slate-800 text-xs block py-1.5 sm:py-2 truncate">
                                ₹{rowTotal.toFixed(2)}
                              </span>
                            </div>

                            <div className="hidden sm:flex sm:col-span-1 justify-center items-center pt-5">
                              {formData.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Remove item"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-50 px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-col items-end gap-1.5 text-xs">
                    <div className="flex justify-between w-full sm:w-64 text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold">₹{calculatedTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between w-full sm:w-64 text-slate-600">
                      <span>Tax (18%):</span>
                      <span className="font-semibold">₹{calculatedTotals.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between w-full sm:w-64 text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5 mt-0.5">
                      <span>Total Amount:</span>
                      <span className="text-sky-700">₹{calculatedTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Notes & Special Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Urgent requirement for installation project."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white resize-none"
                  ></textarea>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3.5 sm:pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors cursor-pointer text-center"
                  >
                    {isSubmitting ? "Creating PO..." : "Issue Purchase Order"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PURCHASE ORDER MODAL */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-2xl w-full mx-auto my-2 sm:my-6 relative max-h-[96vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-4 sm:px-6 py-3.5 sm:py-4 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-sky-600 shrink-0" />
                <span className="text-sm sm:text-base font-bold text-slate-800 truncate">
                  PO: {viewingPO.po_number}
                </span>
                <span className="shrink-0">{getStatusBadge(viewingPO.status)}</span>
              </div>
              <button
                onClick={() => setViewingPO(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-sm text-slate-700 scrollbar-thin">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-xs text-slate-400 block">Vendor</span>
                  <span className="font-bold text-slate-800 uppercase">{viewingPO.vendor_name}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Order Date</span>
                  <span className="font-semibold text-slate-800">{viewingPO.order_date}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Expected Delivery</span>
                  <span className="font-semibold text-slate-800">{viewingPO.expected_delivery_date || "-"}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Created By</span>
                  <span className="font-semibold text-slate-800">{viewingPO.created_by_name || "Admin"}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Line Items
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Ordered</th>
                        <th className="px-3 py-2 text-right">Received</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPO.items?.map((it) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {it.item_name} <span className="font-mono text-slate-400">({it.item_code})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{it.quantity}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                            {it.received_quantity || 0}
                          </td>
                          <td className="px-3 py-2 text-right">₹{Number(it.unit_price).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-bold">₹{Number(it.total_amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center bg-sky-50/50 p-4 rounded-xl border border-sky-100">
                <span className="font-bold text-slate-700">Total Order Valuation:</span>
                <span className="text-base font-extrabold text-sky-800">
                  ₹{Number(viewingPO.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {viewingPO.status !== "RECEIVED" && viewingPO.status !== "CANCELLED" && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">Change Status:</span>
                  <div className="flex items-center gap-2">
                    {viewingPO.status === "DRAFT" && (
                      <button
                        onClick={() => handleUpdateStatus(viewingPO.id, "ORDERED")}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Mark as Ordered
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateStatus(viewingPO.id, "CANCELLED")}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md"
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
