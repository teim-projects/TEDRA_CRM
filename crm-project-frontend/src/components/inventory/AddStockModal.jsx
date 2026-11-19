import React, { useState } from "react";
import { MdClose } from "react-icons/md";
import { ArrowDownRight, Layers, FileText, MapPin } from "lucide-react";
import Swal from "sweetalert2";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function AddStockModal({
  isOpen,
  onClose,
  onSuccess,
  items = [],
  baseApi,
  preselectedItem = null,
}) {
  const api = baseApi || getBaseApiUrl();
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(preselectedItem?.id || (items[0]?.id || ""));
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const currentItem = items.find((it) => String(it.id) === String(selectedItemId)) || preselectedItem;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemId) {
      Swal.fire({ icon: "error", title: "Validation", text: "Please select an inventory item." });
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      Swal.fire({ icon: "error", title: "Validation", text: "Please enter a valid positive quantity." });
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("access") || localStorage.getItem("access_token");

    try {
      const res = await fetch(`${api}/inventory/items/add-stock/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          item_id: selectedItemId,
          quantity: qty,
          unit_price: unitPrice !== "" ? parseFloat(unitPrice) : null,
          reference_number: referenceNumber.trim(),
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Failed to add stock.");
      }

      Swal.fire({
        icon: "success",
        title: "Stock Added",
        text: `Successfully added ${qty} ${currentItem?.unit || "units"} to ${currentItem?.name || "item"}.`,
        timer: 1600,
        showConfirmButton: false,
      });

      onSuccess();
      onClose();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ArrowDownRight size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Add Stock / Inward Receipt
              </h3>
              <p className="text-xs text-slate-500">
                Increase available stock quantity and log audit trail
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Select Item */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Select Inventory Item <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                const match = items.find((it) => String(it.id) === String(e.target.value));
                if (match && match.unit_price) {
                  setUnitPrice(String(match.unit_price));
                }
              }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
              required
            >
              <option value="">-- Choose Item --</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.item_code}) {it.capacity ? `[${it.capacity}]` : ""} - Available: {it.available_stock} {it.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Banner */}
          {currentItem && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Current Available</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {currentItem.available_stock} {currentItem.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Capacity</span>
                <span className="font-medium text-slate-700">
                  {currentItem.capacity || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Unit Cost</span>
                <span className="font-medium text-slate-700">
                  ₹{parseFloat(currentItem.unit_price || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Quantity to Inward <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Layers size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={`Qty in ${currentItem?.unit || "units"}`}
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Unit Price */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Unit Price (₹) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder={currentItem?.unit_price ? String(currentItem.unit_price) : "0.00"}
                className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Reference Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Reference / Invoice / PO / Challan No
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. INV/2026/89 or PO-0012"
                className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Notes / Inward Reason
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Direct purchase from local market / Replenishment"
              className="w-full text-sm border border-slate-200 rounded-lg p-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none transition-all"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? "Adding..." : "Add to Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

