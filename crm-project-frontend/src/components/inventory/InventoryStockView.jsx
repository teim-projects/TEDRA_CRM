import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock
} from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";
import TableView from "../TableView";
import AddInventoryItemModal from "./AddInventoryItemModal";
import AddStockModal from "./AddStockModal";
import ReturnStockModal from "./ReturnStockModal";
import StockHistoryModal from "./StockHistoryModal";
import IssueStockModal from "./IssueStockModal";
import ReturnApprovalsView from "./ReturnApprovalsView";

export default function InventoryStockView({ onRefreshParentCounts, onNavigateTab, baseApi: propBaseApi }) {
  const baseApi = (propBaseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total_items: 0,
    total_available_stock: 0,
    total_used_stock: 0,
    total_returned_stock: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    total_valuation: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isIssueStockOpen, setIsIssueStockOpen] = useState(false);
  const [isReturnStockOpen, setIsReturnStockOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Return Approvals View state & Pending Count
  const [showReturnApprovals, setShowReturnApprovals] = useState(false);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);

  const fetchPendingReturnsCount = async () => {
    try {
      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      const res = await fetch(`${baseApi}/inventory/transactions/?transaction_type=RETURN_STOCK&status=PENDING_APPROVAL`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setPendingReturnsCount(list.length);
      }
    } catch (err) {
      console.warn("Could not fetch pending returns count:", err);
    }
  };

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access");
      const headers = { Authorization: `Bearer ${token}` };

      const [itemsRes, summaryRes] = await Promise.all([
        fetch(`${baseApi}/inventory/items/`, { headers }),
        fetch(`${baseApi}/inventory/items/summary/`, { headers })
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(Array.isArray(data) ? data : data.results || []);
      }
      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }
      fetchPendingReturnsCount();
      if (onRefreshParentCounts) onRefreshParentCounts();
    } catch (err) {
      console.error("Error fetching inventory items:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchPendingReturnsCount();
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.item_code?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.capacity?.toLowerCase().includes(q);

      const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;

      let matchesStatus = true;
      if (selectedStatus === "IN_STOCK") matchesStatus = item.stock_status === "IN_STOCK";
      else if (selectedStatus === "LOW_STOCK") matchesStatus = item.stock_status === "LOW_STOCK";
      else if (selectedStatus === "OUT_OF_STOCK") matchesStatus = item.stock_status === "OUT_OF_STOCK";

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "IN_STOCK":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" /> In Stock
          </span>
        );
      case "LOW_STOCK":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-2.5 h-2.5" /> Low Stock
          </span>
        );
      case "OUT_OF_STOCK":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-2.5 h-2.5" /> Out of Stock
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

  const getAvatarColor = (name) => {
    const colors = [
      "bg-sky-100 text-sky-700",
      "bg-teal-100 text-teal-700",
      "bg-indigo-100 text-indigo-700",
      "bg-blue-100 text-blue-700",
      "bg-emerald-100 text-emerald-700",
      "bg-purple-100 text-purple-700"
    ];
    if (!name) return colors[0];
    const code = name.charCodeAt(0) || 0;
    return colors[code % colors.length];
  };

  // Reusable TableView Columns definition (Matching Lead & Quotation row height)
  const columns = useMemo(() => [
    {
      key: "name",
      label: "ITEM / MATERIAL NAME",
      className: "text-left pl-3 whitespace-nowrap",
      headerClassName: "text-left pl-3 whitespace-nowrap",
      render: (item) => {
        const initial = (item.name || "I").charAt(0).toUpperCase();
        const avatarColor = getAvatarColor(item.name);
        return (
          <div className="flex items-center gap-2 whitespace-nowrap truncate max-w-[220px]" title={item.name}>
            <div
              className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${avatarColor}`}
            >
              {initial}
            </div>
            <span className="font-semibold text-slate-800 uppercase tracking-wide text-xs truncate">
              {item.name}
            </span>
            {item.item_code && (
              <span className="font-mono text-[10px] text-slate-400">
                [{item.item_code}]
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "category",
      label: "CATEGORY",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (item) => (
        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded whitespace-nowrap">
          {item.category || "General"}
        </span>
      )
    },
    {
      key: "capacity",
      label: "CAPACITY",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (item) => (
        item.capacity ? (
          <span className="font-semibold px-1.5 py-0.2 bg-sky-50 text-sky-700 rounded text-[11px] border border-sky-100 whitespace-nowrap">
            {item.capacity}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        )
      )
    },
    {
      key: "available_stock",
      label: "AVAILABLE",
      className: "text-right pr-2 whitespace-nowrap",
      headerClassName: "text-right pr-2 whitespace-nowrap",
      render: (item) => (
        <span className="font-bold text-slate-900 text-xs whitespace-nowrap block">
          {item.available_stock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
        </span>
      )
    },
    {
      key: "used_stock",
      label: "USED",
      className: "text-right pr-2 whitespace-nowrap",
      headerClassName: "text-right pr-2 whitespace-nowrap",
      render: (item) => (
        <span className="text-slate-600 text-xs whitespace-nowrap block">
          {item.used_stock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
        </span>
      )
    },
    {
      key: "stock_status",
      label: "STATUS",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center whitespace-nowrap",
      render: (item) => getStatusBadge(item.stock_status)
    }
  ], []);

  const actionsRenderer = useCallback((item) => (
    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
      {/* Quick Add Stock: [+] */}
      <button
        onClick={() => {
          setSelectedItemForAction(item);
          setIsAddStockOpen(true);
        }}
        className="px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
        title="Add Stock (Inward)"
      >
        + Stock
      </button>

      {/* Quick Issue Stock: [Issue] */}
      <button
        onClick={() => {
          setSelectedItemForAction(item);
          setIsIssueStockOpen(true);
        }}
        className="px-1.5 py-0.5 rounded border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
        title="Issue Stock to Technician"
      >
        <Send className="w-2.5 h-2.5" /> Issue
      </button>

      {/* History Log */}
      <button
        onClick={() => {
          setSelectedItemForAction(item);
          setIsHistoryOpen(true);
        }}
        className="px-1.5 py-0.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        title="Stock Movement Log"
      >
        Log
      </button>

      {/* Edit Button */}
      <button
        onClick={() => {
          setEditingItem(item);
          setIsAddItemOpen(true);
        }}
        className="px-1.5 py-0.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        title="Edit Item Details"
      >
        Edit
      </button>
    </div>
  ), []);

  return (
    <div className="space-y-3.5 font-sans antialiased text-slate-800">
      {/* COMPACT HEADER BLOCK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-0.5 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-8 bg-sky-600 rounded-full block shrink-0" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
              Stock Summary
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time physical inventory levels, capacities, and replenishment thresholds.
            </p>
          </div>
        </div>

        {/* COMPACT ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isFilterOpen || searchQuery || selectedCategory !== "ALL" || selectedStatus !== "ALL"
                ? "bg-sky-50 border-sky-300 text-sky-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddItemOpen(true);
            }}
            className="px-3 sm:px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>

          <button
            onClick={() => {
              setSelectedItemForAction(null);
              setIsAddStockOpen(true);
            }}
            className="px-3 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Add Stock</span>
          </button>

          <button
            onClick={() => {
              setSelectedItemForAction(null);
              setIsIssueStockOpen(true);
            }}
            className="px-3 sm:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Issue Stock</span>
          </button>

          <button
            onClick={() => {
              setSelectedItemForAction(null);
              setIsReturnStockOpen(true);
            }}
            className="px-3 sm:px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Return Stock</span>
          </button>
        </div>
      </div>

      {/* COMPACT STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Available Stock
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-emerald-700 block mt-0.5">
            {Number(summary.total_available_stock || 0).toLocaleString()} units
          </span>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            Ready for dispatch & service
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Used / Dispatched
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-blue-700 block mt-0.5">
            {Number(summary.total_used_stock || 0).toLocaleString()} units
          </span>
          <span className="text-[10px] text-blue-600 font-medium block mt-0.5">
            Consumed across jobs
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Stock Alerts
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-amber-700 block mt-0.5">
            {summary.low_stock_count || 0} low • {summary.out_of_stock_count || 0} empty
          </span>
          <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
            Below replenishment level
          </span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
            Total Catalog Items
          </span>
          <span className="text-xs sm:text-[14px] font-bold text-slate-900 block mt-0.5">
            {summary.total_items || items.length} SKUs
          </span>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            Registered components
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
              placeholder="Search by code, item name, capacity, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
              {["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded text-[11px] transition-all ${
                    selectedStatus === st
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
                setSelectedCategory("ALL");
                setSelectedStatus("ALL");
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* REUSED TABLE VIEW (MATCHING LEAD / CUSTOMER PAGES) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <TableView
          columns={columns}
          rows={paginatedItems}
          loading={isLoading}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          actions={actionsRenderer}
          emptyMessage="No inventory items found matching your filters."
        />
      </div>

      {/* MODALS */}
      {isAddItemOpen && (
        <AddInventoryItemModal
          isOpen={isAddItemOpen}
          onClose={() => {
            setIsAddItemOpen(false);
            setEditingItem(null);
          }}
          onSuccess={fetchItems}
          item={editingItem}
          editItem={editingItem}
          baseApi={baseApi}
        />
      )}

      {isAddStockOpen && (
        <AddStockModal
          isOpen={isAddStockOpen}
          onClose={() => {
            setIsAddStockOpen(false);
            setSelectedItemForAction(null);
          }}
          onSuccess={fetchItems}
          items={items}
          baseApi={baseApi}
          preselectedItem={selectedItemForAction}
        />
      )}

      {isIssueStockOpen && (
        <IssueStockModal
          isOpen={isIssueStockOpen}
          onClose={() => {
            setIsIssueStockOpen(false);
            setSelectedItemForAction(null);
          }}
          onSuccess={fetchItems}
          items={items}
          baseApi={baseApi}
          preselectedItem={selectedItemForAction}
        />
      )}

      {isReturnStockOpen && (
        <ReturnStockModal
          isOpen={isReturnStockOpen}
          onClose={() => {
            setIsReturnStockOpen(false);
            setSelectedItemForAction(null);
          }}
          onSuccess={fetchItems}
          items={items}
          baseApi={baseApi}
          preselectedItem={selectedItemForAction}
        />
      )}

      {isHistoryOpen && selectedItemForAction && (
        <StockHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setSelectedItemForAction(null);
          }}
          item={selectedItemForAction}
          baseApi={baseApi}
        />
      )}
    </div>
  );
}
