import React, { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";
import { History, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function StockHistoryModal({
  isOpen,
  onClose,
  item,
  baseApi,
}) {
  const api = (baseApi || getBaseApiUrl() || "http://localhost:8000").replace(/\/$/, "");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !item || !item.id) return;

    const fetchHistory = async () => {
      setLoading(true);
      const token = localStorage.getItem("access") || localStorage.getItem("access_token");
      try {
        const res = await fetch(`${api}/inventory/transactions/?item=${item.id}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
            setTransactions(list);
          } else {
            setTransactions([]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch stock history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, item, baseApi]);

  if (!isOpen || !item) return null;

  const formatDate = (isoStr) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const getBadge = (type) => {
    switch (type) {
      case "ADD_STOCK":
        return { label: "Manual Inward", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ArrowDownRight };
      case "GRN":
        return { label: "GRN Receipt", color: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 };
      case "USED_STOCK":
        return { label: "Stock Consumed", color: "bg-slate-100 text-slate-700 border-slate-200", icon: ArrowUpRight };
      case "RETURN_STOCK":
        return { label: "Stock Return", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle };
      default:
        return { label: type, color: "bg-purple-50 text-purple-700 border-purple-200", icon: History };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Stock Movement Log · {item.name}
              </h3>
              <p className="text-xs text-slate-500">
                SKU: <span className="font-semibold">{item.item_code}</span> | Current Stock: <span className="font-bold text-emerald-700">{item.available_stock} {item.unit}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
              Loading movement history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No movement records logged for this item yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Before → After</th>
                    <th className="py-2.5 px-3">Reference #</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {transactions.map((tx) => {
                    const badge = getBadge(tx.transaction_type);
                    const isInward = tx.transaction_type === "ADD_STOCK" || tx.transaction_type === "GRN";
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color}`}>
                            <badge.icon size={11} /> {badge.label}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isInward ? "text-emerald-700" : "text-amber-700"}`}>
                          {isInward ? "+" : "-"}{tx.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap text-[11px]">
                          {tx.previous_available} → <span className="font-semibold text-slate-800">{tx.new_available}</span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                          {tx.reference_number || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate" title={tx.notes}>
                          {tx.notes || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                          {tx.created_by_name || "System"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

