import React, { useState, useEffect, useCallback } from "react";
import {
  Building,
  ShoppingCart,
  ClipboardCheck,
  Send,
  Package,
  RotateCcw
} from "lucide-react";
import { getBaseApiUrl } from "../utils/apiConfig";
import VendorView from "../components/inventory/VendorView";
import PurchaseOrderView from "../components/inventory/PurchaseOrderView";
import GRNView from "../components/inventory/GRNView";
import StockIssueView from "../components/inventory/StockIssueView";
import InventoryStockView from "../components/inventory/InventoryStockView";
import ReturnApprovalsView from "../components/inventory/ReturnApprovalsView";

export default function Inventory() {
  const baseApi = (getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");

  // Active tab: 'vendors', 'po', 'grn', 'issues', 'stock', 'requests'
  const [activeTab, setActiveTab] = useState("vendors");
  const [selectedPOForGRN, setSelectedPOForGRN] = useState(null);

  const handleNavigateTab = (tab, extraData) => {
    if (tab === "grn" && extraData) {
      setSelectedPOForGRN(extraData);
    }
    setActiveTab(tab === "returns" ? "requests" : tab);
  };

  // Summary counts for badges
  const [counts, setCounts] = useState({
    vendors: 0,
    purchaseOrders: 0,
    grns: 0,
    stockIssues: 0,
    stockItems: 0,
    pendingRequests: 0
  });

  const fetchBadgeCounts = useCallback(async () => {
    try {
      const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
      const headers = { Authorization: `Bearer ${token}` };

      const [vRes, poRes, grnRes, issueRes, itemsRes, requestsRes] = await Promise.all([
        fetch(`${baseApi}/inventory/vendors/`, { headers }),
        fetch(`${baseApi}/inventory/purchase-orders/`, { headers }),
        fetch(`${baseApi}/inventory/grn/`, { headers }),
        fetch(`${baseApi}/inventory/transactions/?transaction_type=ISSUE_STOCK`, { headers }),
        fetch(`${baseApi}/inventory/items/`, { headers }),
        fetch(`${baseApi}/inventory/transactions/?status=PENDING_APPROVAL`, { headers })
      ]);

      if (vRes.ok) {
        const d = await vRes.json();
        setCounts((prev) => ({
          ...prev,
          vendors: Array.isArray(d) ? d.length : d.count || 0
        }));
      }
      if (poRes.ok) {
        const d = await poRes.json();
        setCounts((prev) => ({
          ...prev,
          purchaseOrders: Array.isArray(d) ? d.length : d.count || 0
        }));
      }
      if (grnRes.ok) {
        const d = await grnRes.json();
        setCounts((prev) => ({
          ...prev,
          grns: Array.isArray(d) ? d.length : d.count || 0
        }));
      }
      if (issueRes.ok) {
        const d = await issueRes.json();
        setCounts((prev) => ({
          ...prev,
          stockIssues: Array.isArray(d) ? d.length : d.count || 0
        }));
      }
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setCounts((prev) => ({
          ...prev,
          stockItems: Array.isArray(d) ? d.length : d.count || 0
        }));
      }
      if (requestsRes.ok) {
        const d = await requestsRes.json();
        const list = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
        setCounts((prev) => ({
          ...prev,
          pendingRequests: list.length
        }));
      }
    } catch (err) {
      console.warn("Could not fetch inventory badge counts:", err);
    }
  }, [baseApi]);

  useEffect(() => {
    fetchBadgeCounts();
  }, [activeTab, fetchBadgeCounts]);

  const tabs = [
    { id: "vendors", label: "Vendors", count: counts.vendors },
    { id: "po", label: "Purchase Orders", count: counts.purchaseOrders },
    { id: "grn", label: "GRN Slips", count: counts.grns },
    { id: "issues", label: "Stock Issues", count: counts.stockIssues },
    { id: "stock", label: "Stock Summary", count: counts.stockItems },
    { id: "requests", label: "Requests", count: counts.pendingRequests, highlight: counts.pendingRequests > 0 }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3.5">
      {/* COMPACT TOP HORIZONTAL TABS BAR */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit shadow-xs flex-wrap">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : tab.highlight
                  ? "bg-purple-100 text-purple-900 hover:bg-purple-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? "bg-sky-500 text-white"
                      : tab.highlight
                      ? "bg-purple-600 text-white"
                      : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ACTIVE TAB CONTENT VIEW */}
      <div>
        {activeTab === "vendors" && (
          <VendorView
            onRefreshParentCounts={fetchBadgeCounts}
            onNavigateTab={handleNavigateTab}
            baseApi={baseApi}
          />
        )}
        {activeTab === "po" && (
          <PurchaseOrderView
            onRefreshParentCounts={fetchBadgeCounts}
            onNavigateTab={handleNavigateTab}
            baseApi={baseApi}
          />
        )}
        {activeTab === "grn" && (
          <GRNView
            onRefreshParentCounts={fetchBadgeCounts}
            onNavigateTab={handleNavigateTab}
            preselectedPOId={selectedPOForGRN}
            onClearPreselectedPO={() => setSelectedPOForGRN(null)}
            baseApi={baseApi}
          />
        )}
        {activeTab === "issues" && (
          <StockIssueView
            onRefreshParentCounts={fetchBadgeCounts}
            onNavigateTab={handleNavigateTab}
            baseApi={baseApi}
          />
        )}
        {activeTab === "stock" && (
          <InventoryStockView
            onRefreshParentCounts={fetchBadgeCounts}
            onNavigateTab={handleNavigateTab}
            baseApi={baseApi}
          />
        )}
        {(activeTab === "requests" || activeTab === "returns") && (
          <ReturnApprovalsView
            onRefreshParentCounts={fetchBadgeCounts}
            baseApi={baseApi}
          />
        )}
      </div>
    </div>
  );
}
