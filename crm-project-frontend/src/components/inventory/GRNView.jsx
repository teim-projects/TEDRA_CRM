import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ClipboardCheck,
  Plus,
  Search,
  CheckCircle2,
  RefreshCw,
  X,
  Filter,
  Package,
  Layers,
  FileText
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import TableView from "../TableView";

/**
 * Dedicated Item Component for GRN mapping
 * Displays item details fetched strictly from Purchase Order - NO DROPDOWN
 */
function GRNItemCard({ item, index, onChange }) {
  const isDamaged = Number(item.rejected_quantity) > 0;

  return (
    <div
      className={`p-3 sm:p-3.5 rounded-xl border transition-all text-xs space-y-2.5 ${
        isDamaged
          ? "bg-rose-50/30 border-rose-200"
          : "bg-white border-slate-200 shadow-2xs"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Item Specification Component (Fixed / Non-editable) */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 mt-0.5">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 uppercase tracking-wide text-xs">
                {item.item_name}
              </span>
              {item.item_code && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 font-semibold rounded border border-slate-200">
                  {item.item_code}
                </span>
              )}
              {item.capacity && (
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-semibold rounded border border-indigo-200">
                  {item.capacity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
              <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.2 rounded border border-blue-100">
                PO Ordered: {item.ordered_quantity} {item.unit}
              </span>
              {item.previously_received > 0 && (
                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-medium">
                  Prev. Received: {item.previously_received} {item.unit}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quantities (Received, Damaged, + To Stock) */}
        <div className="grid grid-cols-3 gap-2 shrink-0 sm:w-auto w-full">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              Received Qty
            </label>
            <input
              type="number"
              min="0"
              value={item.received_quantity}
              onChange={(e) => onChange(index, "received_quantity", e.target.value)}
              className="w-full sm:w-24 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-right font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-rose-600 mb-1">
              Damaged Qty
            </label>
            <input
              type="number"
              min="0"
              value={item.rejected_quantity}
              onChange={(e) => onChange(index, "rejected_quantity", e.target.value)}
              className="w-full sm:w-24 px-2.5 py-1.5 text-xs bg-rose-50 border border-rose-300 rounded-lg text-right font-bold text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-emerald-700 mb-1">
              + To Stock
            </label>
            <div className="w-full sm:w-24 px-2.5 py-1.5 text-xs bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-right font-bold">
              +{item.accepted_quantity}
            </div>
          </div>
        </div>
      </div>

      {/* Damage Reason Input (Smoothly appears when damaged > 0) */}
      {isDamaged && (
        <div className="pt-2 border-t border-rose-100 flex items-center gap-2">
          <span className="text-[11px] font-bold text-rose-700 shrink-0">
            Damage Reason:
          </span>
          <input
            type="text"
            value={item.remarks || ""}
            onChange={(e) => onChange(index, "remarks", e.target.value)}
            placeholder="e.g. Broken packaging, transit leakage, seal damaged..."
            className="w-full px-2.5 py-1 text-xs bg-white border border-rose-200 rounded-lg text-rose-900 focus:outline-none focus:border-rose-400"
          />
        </div>
      )}
    </div>
  );
}

export default function GRNView({
  onRefreshParentCounts,
  preselectedPOId = null,
  onClearPreselectedPO,
  baseApi: propBaseApi
}) {
  const baseApi = (propBaseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  const [grns, setGrns] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [viewingGRN, setViewingGRN] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    purchase_order: "",
    vendor: "",
    received_date: new Date().toISOString().split("T")[0],
    challan_number: "",
    invoice_number: "",
    remarks: "",
    items: [
      {
        item: "",
        received_quantity: 1,
        accepted_quantity: 1,
        rejected_quantity: 0,
        unit_price: 0,
        remarks: ""
      }
    ]
  });

  const fetchGRNs = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access");
      const headers = { Authorization: `Bearer ${token}` };

      const [grnRes, vRes, poRes, itemsRes] = await Promise.all([
        fetch(`${baseApi}/inventory/grn/`, { headers }),
        fetch(`${baseApi}/inventory/vendors/`, { headers }),
        fetch(`${baseApi}/inventory/purchase-orders/`, { headers }),
        fetch(`${baseApi}/inventory/items/`, { headers })
      ]);

      if (grnRes.ok) {
        const data = await grnRes.json();
        setGrns(Array.isArray(data) ? data : data.results || []);
      }
      if (vRes.ok) {
        const data = await vRes.json();
        setVendors(Array.isArray(data) ? data : data.results || []);
      }
      if (poRes.ok) {
        const data = await poRes.json();
        setPurchaseOrders(Array.isArray(data) ? data : data.results || []);
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setInventoryItems(Array.isArray(data) ? data : data.results || []);
      }
      if (onRefreshParentCounts) onRefreshParentCounts();
    } catch (err) {
      console.error("Error fetching GRNs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGRNs();
  }, []);

  // Automatically trigger create modal if PO was selected from Purchase Orders page
  useEffect(() => {
    if (preselectedPOId && purchaseOrders.length > 0) {
      handlePOSelect(preselectedPOId);
      setIsCreateOpen(true);
      if (onClearPreselectedPO) onClearPreselectedPO();
    }
  }, [preselectedPOId, purchaseOrders]);

  const openCreateModal = () => {
    const firstActivePO = purchaseOrders.find(
      (p) => p.status === "ORDERED" || p.status === "PARTIALLY_RECEIVED"
    );
    if (firstActivePO) {
      handlePOSelect(firstActivePO.id);
    } else {
      setFormData({
        purchase_order: "",
        vendor: "",
        received_date: new Date().toISOString().split("T")[0],
        challan_number: "",
        invoice_number: "",
        remarks: "",
        items: []
      });
    }
    setErrorMsg("");
    setIsCreateOpen(true);
  };

  const handlePOSelect = (poId) => {
    if (!poId) {
      setFormData((prev) => ({
        ...prev,
        purchase_order: "",
        vendor: "",
        items: []
      }));
      return;
    }

    const selectedPO = purchaseOrders.find((p) => p.id === Number(poId));
    if (selectedPO) {
      const poItems = (selectedPO.items || []).map((poi) => {
        const remaining = Math.max(0, Number(poi.quantity) - Number(poi.received_quantity || 0));
        const itemObj =
          inventoryItems.find(
            (it) => it.id === (typeof poi.item === "object" ? poi.item.id : poi.item)
          ) ||
          poi.item_details ||
          {};
        const itemId = typeof poi.item === "object" ? poi.item.id : poi.item;

        return {
          item: itemId,
          po_item: poi.id,
          item_name: poi.item_name || itemObj.name || poi.item_details?.name || "Inventory Material",
          item_code: poi.item_code || itemObj.item_code || poi.item_details?.item_code || "",
          capacity: itemObj.capacity || poi.item_details?.capacity || "",
          unit: poi.unit || itemObj.unit || poi.item_details?.unit || "Pcs",
          ordered_quantity: Number(poi.quantity) || 0,
          previously_received: Number(poi.received_quantity) || 0,
          received_quantity: remaining > 0 ? remaining : Number(poi.quantity),
          accepted_quantity: remaining > 0 ? remaining : Number(poi.quantity),
          rejected_quantity: 0,
          unit_price: Number(poi.unit_price) || 0,
          remarks: ""
        };
      });

      setFormData((prev) => ({
        ...prev,
        purchase_order: poId,
        vendor: selectedPO.vendor || prev.vendor,
        items: poItems
      }));
    }
  };

  const handleItemChange = (idx, field, value) => {
    const newItems = [...formData.items];
    newItems[idx][field] = value;

    if (field === "received_quantity" || field === "rejected_quantity") {
      const rec = Math.max(0, Number(newItems[idx].received_quantity) || 0);
      const rej = Math.max(0, Number(newItems[idx].rejected_quantity) || 0);
      newItems[idx].accepted_quantity = Math.max(0, rec - rej);
    } else if (field === "accepted_quantity") {
      const rec = Math.max(0, Number(newItems[idx].received_quantity) || 0);
      const acc = Math.max(0, Number(newItems[idx].accepted_quantity) || 0);
      newItems[idx].rejected_quantity = Math.max(0, rec - acc);
    }

    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.purchase_order) {
      setErrorMsg("Please select a Purchase Order to map this GRN against.");
      return;
    }
    if (!formData.vendor) {
      setErrorMsg("Please select a vendor.");
      return;
    }
    if (!formData.items || formData.items.length === 0) {
      setErrorMsg("Selected Purchase Order has no ordered items.");
      return;
    }
    if (formData.items.some((row) => Number(row.received_quantity) < 0 || Number(row.rejected_quantity) < 0)) {
      setErrorMsg("Quantities cannot be negative.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const token = localStorage.getItem("access");
      const mappedItems = formData.items.map((row) => ({
        item: Number(row.item),
        po_item: row.po_item ? Number(row.po_item) : null,
        ordered_quantity: Number(row.ordered_quantity || 0),
        received_quantity: Number(row.received_quantity || 0),
        accepted_quantity: Number(row.accepted_quantity || 0),
        rejected_quantity: Number(row.rejected_quantity || 0),
        unit_price: Number(row.unit_price || 0),
        remarks: row.remarks || ""
      }));

      const payload = {
        purchase_order: Number(formData.purchase_order),
        vendor: Number(formData.vendor),
        received_date: formData.received_date,
        challan_number: formData.challan_number,
        invoice_number: formData.invoice_number,
        remarks: formData.remarks,
        status: "ACCEPTED",
        items: mappedItems,
        items_data: mappedItems
      };

      const res = await fetch(`${baseApi}/inventory/grn/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsCreateOpen(false);
        fetchGRNs();
        if (onRefreshParentCounts) onRefreshParentCounts();
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(
          errData.detail ||
          errData.error ||
          errData.status?.[0] ||
          "Failed to create Goods Receipt Note."
        );
      }
    } catch (err) {
      console.error("Create GRN error:", err);
      setErrorMsg("Error communicating with server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGRNs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return grns.filter((g) => {
      return (
        !q ||
        g.grn_number?.toLowerCase().includes(q) ||
        g.po_number?.toLowerCase().includes(q) ||
        g.vendor_name?.toLowerCase().includes(q) ||
        g.challan_number?.toLowerCase().includes(q) ||
        g.invoice_number?.toLowerCase().includes(q)
      );
    });
  }, [grns, searchQuery]);

  const totalPages = Math.ceil(filteredGRNs.length / pageSize) || 1;
  const paginatedGRNs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGRNs.slice(start, start + pageSize);
  }, [filteredGRNs, currentPage, pageSize]);

  const totalAcceptedUnits = useMemo(() => {
    return grns.reduce((acc, g) => {
      const itemsSum = (g.items || []).reduce((sum, it) => sum + (Number(it.accepted_quantity) || 0), 0);
      return acc + itemsSum;
    }, 0);
  }, [grns]);

  // Reusable TableView Columns definition (Matching Lead & Quotation row height)
  const columns = useMemo(() => [
    {
      key: "grn_number",
      label: "GRN SLIP NUMBER",
      className: "text-left pl-3 whitespace-nowrap",
      headerClassName: "text-left pl-3 whitespace-nowrap",
      render: (grn) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-bold text-slate-900 font-mono text-xs">
            {grn.grn_number}
          </span>
          {grn.received_by_name && (
            <span className="text-[10px] text-slate-400">
              ({grn.received_by_name})
            </span>
          )}
        </div>
      )
    },
    {
      key: "po_number",
      label: "LINKED PO",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (grn) => (
        grn.po_number ? (
          <span className="font-mono text-xs font-semibold text-sky-700 whitespace-nowrap">
            {grn.po_number}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">Direct</span>
        )
      )
    },
    {
      key: "vendor_name",
      label: "SUPPLIER / VENDOR",
      className: "text-left whitespace-nowrap truncate max-w-[180px]",
      headerClassName: "text-left whitespace-nowrap",
      render: (grn) => (
        <span className="font-semibold text-slate-800 text-xs uppercase truncate block max-w-[180px]" title={grn.vendor_name}>
          {grn.vendor_name}
        </span>
      )
    },
    {
      key: "received_date",
      label: "RECEIVED DATE",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (grn) => <span className="text-xs text-slate-600 whitespace-nowrap">{grn.received_date}</span>
    },
    {
      key: "challan_invoice",
      label: "CHALLAN / INVOICE",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (grn) => {
        const doc = [grn.challan_number, grn.invoice_number].filter(Boolean).join(" / ");
        return doc ? (
          <span className="text-xs text-slate-600 font-mono whitespace-nowrap truncate block max-w-[140px] mx-auto" title={doc}>
            {doc}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        );
      }
    },
    {
      key: "items_count",
      label: "ITEMS",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (grn) => (
        <span className="font-bold text-slate-700 text-xs whitespace-nowrap">
          {grn.items?.length || 0}
        </span>
      )
    },
    {
      key: "status",
      label: "STATUS",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: () => (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="w-2.5 h-2.5" /> Completed
        </span>
      )
    }
  ], []);

  const actionsRenderer = useCallback((grn) => (
    <div className="flex items-center justify-center whitespace-nowrap">
      <button
        onClick={() => setViewingGRN(grn)}
        className="px-2 py-0.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        title="View GRN Details"
      >
        View
      </button>
    </div>
  ), []);

  return (
    <div className="space-y-3.5 font-sans antialiased text-slate-800">
      {/* COMPACT HEADER BLOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-0.5 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-8 bg-sky-600 rounded-full block shrink-0" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
              GRN Slips
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage inward goods receipt notes, physical material inspections, and inventory additions.
            </p>
          </div>
        </div>

        {/* COMPACT ACTION BUTTONS */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`col-span-1 w-full sm:w-auto px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
              isFilterOpen || searchQuery
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
            <span>Create GRN</span>
          </button>
        </div>
      </div>

      {/* COMPACT STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total GRN Slips
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-slate-900 block mt-0.5">
            {grns.length} slips
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            Inward verification records
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total Inward Units
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-emerald-700 block mt-0.5">
            {totalAcceptedUnits.toLocaleString()} units
          </span>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            Credited into available stock
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Linked to POs
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-sky-700 block mt-0.5">
            {grns.filter((g) => Boolean(g.purchase_order)).length} orders
          </span>
          <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
            Fulfilled purchase orders
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Verification Rate
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-teal-700 block mt-0.5">
            100% verified
          </span>
          <span className="text-[10px] text-teal-600 font-medium block mt-0.5">
            Quality passed
          </span>
        </div>
      </div>

      {/* FILTER BAR */}
      {isFilterOpen && (
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2.5 animate-fade-in">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search GRN by number, PO #, vendor, challan or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            onClick={() => setSearchQuery("")}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      )}

      {/* REUSED TABLE VIEW (MATCHING LEAD / CUSTOMER PAGES) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <TableView
          columns={columns}
          rows={paginatedGRNs}
          loading={isLoading}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          actions={actionsRenderer}
          emptyMessage="No GRN records found. Click '+ Create GRN' to record inward delivery."
        />
      </div>

      {/* CREATE GRN MODAL (SPACIOUS FULL SIZE MATCHING CUSTOMER FORM) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[96vh] sm:max-h-[92vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
                    Record Goods Receipt Note (GRN)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
                    Perform inward physical inspection and update inventory stock
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-sm scrollbar-thin">
              {errorMsg && (
                <div className="p-3 text-sm bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <div className="bg-sky-50/70 border border-sky-200 p-3 rounded-lg text-xs text-sky-800 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-600" />
                <span>
                  <strong>Automated Inventory Sync:</strong> Accepted quantities will be credited directly into available inventory stock!
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Purchase Order <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.purchase_order}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                  >
                    <option value="">-- Choose Purchase Order to Map --</option>
                    {purchaseOrders
                      .filter((p) => p.status !== "CANCELLED")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.po_number} — {p.vendor_name} ({p.items?.length || 0} items) [{p.status}]
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Vendor / Supplier
                  </label>
                  <div className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 truncate flex items-center">
                    {vendors.find((v) => v.id === Number(formData.vendor))?.name || (formData.purchase_order ? "Loading..." : "-- Select PO First --")}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Received Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.received_date}
                    onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Delivery Challan No.
                  </label>
                  <input
                    type="text"
                    value={formData.challan_number}
                    onChange={(e) => setFormData({ ...formData, challan_number: e.target.value })}
                    placeholder="e.g. DC-9921"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Vendor Invoice No.
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    placeholder="e.g. INV-5542"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Status
                  </label>
                  <div className="px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Inward Verified & Stock Updated</span>
                  </div>
                </div>
              </div>

              {/* LINE ITEMS - STRICTLY FETCHED FROM PO */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                <div className="bg-slate-50/80 px-3.5 sm:px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block truncate">
                      Ordered Materials (From PO)
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate sm:text-clip">
                      Materials fetched strictly from Purchase Order. Enter received and damaged quantities.
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md shrink-0 whitespace-nowrap">
                    {formData.items.length} {formData.items.length === 1 ? "Item" : "Items"}
                  </div>
                </div>

                <div className="p-3.5 space-y-3">
                  {formData.items.length === 0 ? (
                    <div className="py-7 px-3 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-slate-500 space-y-1.5">
                      <ClipboardCheck className="w-7 h-7 text-slate-300 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">No Purchase Order Selected</p>
                      <p className="text-[11px] text-slate-400">Please choose a Purchase Order above to automatically load ordered items.</p>
                    </div>
                  ) : (
                    formData.items.map((row, idx) => (
                      <GRNItemCard
                        key={row.po_item || idx}
                        item={row}
                        index={idx}
                        onChange={handleItemChange}
                      />
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Inspection Remarks / Delivery Notes
                </label>
                <textarea
                  rows="2"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Material condition, packaging check, remarks..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                ></textarea>
              </div>

              <div className="pt-3.5 sm:pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer text-center"
                >
                  {isSubmitting ? "Receiving..." : "Confirm & Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW GRN MODAL */}
      {viewingGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[96vh] sm:max-h-[90vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                      GRN: {viewingGRN.grn_number}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      Completed
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    Inward material receipt & inspection slip details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingGRN(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700 scrollbar-thin">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Vendor / Supplier
                  </span>
                  <span className="font-bold text-slate-900 uppercase text-xs">
                    {viewingGRN.vendor_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Linked PO Number
                  </span>
                  <span className="font-semibold text-sky-700 text-xs font-mono">
                    {viewingGRN.po_number || "Direct Inward"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Received Date
                  </span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {viewingGRN.received_date}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Challan / Invoice
                  </span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {[viewingGRN.challan_number, viewingGRN.invoice_number].filter(Boolean).join(" / ") || "-"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Received & Inspected By
                  </span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {viewingGRN.received_by_name || "Admin"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Material Items Received ({viewingGRN.items?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="px-3 py-2">Item Description</th>
                        <th className="px-3 py-2 text-right">Received</th>
                        <th className="px-3 py-2 text-right text-emerald-700">Accepted</th>
                        <th className="px-3 py-2 text-right text-rose-700">Rejected</th>
                        <th className="px-3 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingGRN.items?.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {it.item_name} <span className="font-mono text-slate-400 text-[11px]">({it.item_code})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700">
                            {it.received_quantity}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-600">
                            +{it.accepted_quantity}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-rose-600">
                            {it.rejected_quantity}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{it.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {viewingGRN.remarks && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-700 block mb-0.5">Inspection Remarks:</span>
                  {viewingGRN.remarks}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
