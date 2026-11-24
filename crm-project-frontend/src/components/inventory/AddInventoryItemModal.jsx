import React, { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";
import { Package, Hash, Tag, Layers, AlertTriangle, FileText, Gauge } from "lucide-react";
import Swal from "sweetalert2";

export default function AddInventoryItemModal({
  isOpen,
  onClose,
  onSuccess,
  item = null,
  editItem = null,
  baseApi,
  catalogProducts = [],
}) {
  const currentItem = item || editItem;
  const isEdit = Boolean(currentItem);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    item_code: "",
    category: "Membranes",
    capacity: "",
    product: "",
    unit: "Pcs",
    reorder_level: "5",
    available_stock: "0",
    hsn_sac_code: "",
    description: "",
  });

  const categories = [
    "Membranes",
    "Pumps",
    "Filters & Cartridges",
    "Chemicals & Antiscalants",
    "Fittings & Pipes",
    "Pressure Vessels & Housings",
    "Instruments & Gauges",
    "Electrical & Control Panels",
    "Valves & Actuators",
    "Spares & Consumables",
    "General",
  ];

  const units = ["Pcs", "Nos", "Kg", "Liters", "Meters", "Sets", "Rolls", "Boxes", "Bags", "Packets"];

  useEffect(() => {
    if (currentItem) {
      setFormData({
        name: currentItem.name || "",
        item_code: currentItem.item_code || "",
        category: currentItem.category || "General",
        capacity: currentItem.capacity || "",
        product: currentItem.product || "",
        unit: currentItem.unit || "Pcs",
        reorder_level: currentItem.reorder_level !== undefined ? String(currentItem.reorder_level) : "5",
        available_stock: currentItem.available_stock !== undefined ? String(currentItem.available_stock) : "0",
        hsn_sac_code: currentItem.hsn_sac_code || "",
        description: currentItem.description || "",
      });
    } else {
      setFormData({
        name: "",
        item_code: "",
        category: "Membranes",
        capacity: "",
        product: "",
        unit: "Pcs",
        reorder_level: "5",
        available_stock: "0",
        hsn_sac_code: "",
        description: "",
      });
    }
  }, [currentItem, isOpen]);

  if (!isOpen) return null;

  const handleProductSelect = (prodId) => {
    const selected = catalogProducts.find((p) => String(p.id) === String(prodId));
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        product: selected.id,
        name: prev.name || selected.name,
        hsn_sac_code: prev.hsn_sac_code || selected.hsn_sac_code || "",
        capacity: prev.capacity || selected.capacity || "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, product: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire({ icon: "error", title: "Validation", text: "Item Name is required." });
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("access") || localStorage.getItem("access_token");

    const payload = {
      name: formData.name.trim(),
      item_code: formData.item_code.trim(),
      category: formData.category,
      capacity: formData.capacity.trim(),
      product: formData.product || null,
      unit: formData.unit,
      reorder_level: parseFloat(formData.reorder_level) || 0,
      available_stock: parseFloat(formData.available_stock) || 0,
      hsn_sac_code: formData.hsn_sac_code || "",
      description: formData.description || "",
    };

    const targetApi = baseApi || (import.meta.env.VITE_BASE_API_URL ?? "http://127.0.0.1:8000");
    const url = isEdit
      ? `${targetApi}/inventory/items/${currentItem.id}/`
      : `${targetApi}/inventory/items/`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || JSON.stringify(errData) || "Failed to save item.");
      }

      Swal.fire({
        icon: "success",
        title: isEdit ? "Item Updated" : "Item Created",
        text: `Inventory item ${formData.name} saved successfully.`,
        timer: 1600,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-3xl w-full mx-auto my-2 sm:my-6 relative max-h-[96vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* HEADER (MATCHING LEAD / CUSTOMER FORMS) */}
        <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-4 sm:px-6 py-3.5 sm:py-4 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
                {isEdit ? "Edit Inventory Item" : "Add New Inventory Item"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {isEdit ? `Item Code: ${currentItem?.item_code || 'N/A'}` : "Register spare parts, raw materials, and consumables to catalog"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* FORM BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-slate-800 scrollbar-thin">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Optional: Link with Catalog Product */}
            {catalogProducts && catalogProducts.length > 0 && !isEdit && (
              <div className="p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-1.5">
                <label className="block text-xs font-semibold text-sky-800">
                  Link With Existing Catalog Product (Optional)
                </label>
                <select
                  value={formData.product}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full text-sm bg-white border border-sky-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="">-- Standalone Item / Not Linked to Product --</option>
                  {catalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_code || "No SKU"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Item Name */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 4040 RO Membrane Dow Filmtec / High Pressure Pump"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  required
                />
              </div>

              {/* Item Code / SKU */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Item Code / SKU <span className="text-slate-400 font-normal">(Auto-generated if empty)</span>
                </label>
                <div className="relative">
                  <Hash size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={formData.item_code}
                    onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                    placeholder="e.g. MEM-4040 or PUMP-01"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Category
                </label>
                <div className="relative">
                  <Tag size={16} className="absolute left-3 top-3 text-slate-400" />
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Capacity */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Gauge size={15} className="text-sky-600" />
                  Capacity
                </label>
                <input
                  type="text"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="e.g. 50 LPH / 100 GPD / 500 Liters / 2 HP"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                />
              </div>

              {/* Unit of Measurement */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Unit of Measurement
                </label>
                <div className="relative">
                  <Layers size={16} className="absolute left-3 top-3 text-slate-400" />
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Initial Available Stock */}
              {!isEdit && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Initial Available Stock
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.available_stock}
                    onChange={(e) => setFormData({ ...formData, available_stock: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  />
                </div>
              )}

              {/* Reorder Level */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-500" />
                  Reorder Alert Level
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                  placeholder="5"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                />
              </div>

              {/* HSN / SAC Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  HSN / SAC Code
                </label>
                <div className="relative">
                  <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={formData.hsn_sac_code}
                    onChange={(e) => setFormData({ ...formData, hsn_sac_code: e.target.value })}
                    placeholder="e.g. 8421"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Description / Technical Specifications
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Item specifications, compatibility, manufacturer notes, etc."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white resize-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3.5 sm:pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors cursor-pointer text-center"
              >
                {loading ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
